import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { httpErrorText } from '../../services/auth.service';
import { PeriodService, AccountingPeriod } from '../../services/period.service';
import { ReconciliationRun, ReconciliationService } from '../../services/reconciliation.service';
import { CashVoucherApiService, CashVoucherStatistics } from '../../services/cash-voucher-api.service';
import { WarehouseVoucherApiService, WarehouseVoucherStatistics } from '../../services/warehouse-voucher-api.service';
import { CheckRun, EinvoiceCheckService } from '../../services/einvoice-check.service';
import { recalcGtgt, savedV22 } from '../../utils/gtgt.util';

/**
 * TỔNG QUAN (trang chủ KeToan) — 23/10/2026: bỏ số liệu giả, chỉ hiện dữ liệu THẬT theo kỳ ở thanh chọn kỳ (PeriodService):
 * - Thuế GTGT: lần Đối soát hóa đơn XML (đã xong) có kỳ ĐÚNG kỳ đang chọn → [34] [35] [23] [25] [40] [43] (01/GTGT, [22] kế toán
 *   nhập ở trang Số liệu khai thuế). Không có lần đối soát của kỳ → báo chưa có, không đoán.
 * - Thu / chi: phiếu thu / chi KeToanBackEnd /api/cash-vouchers/statistics (không tính phiếu hủy). KHÔNG phải số dư 111 / 112
 *   (chưa có số dư đầu kỳ).
 * - Kho: phiếu nhập / xuất kho /api/warehouse-vouchers/statistics.
 * - Kiểm tra HĐ tự động: lần kiểm gần nhất (lỗi / cảnh báo).
 * - Hoạt động gần đây: phiếu thu / chi, phiếu kho trong kỳ + các lần đối soát XML / kiểm HĐ.
 * Bỏ thẻ Chi phí / Lợi nhuận (chưa có sổ cái thật) và nút Khóa sổ giả (PeriodLockService đang là dữ liệu demo).
 * Mỗi khối tải riêng — 1 nguồn lỗi chỉ báo lỗi ở khối đó.
 */
const LOG = '[Dashboard]';

interface Activity { date: Date; description: string; type: 'thu' | 'chi' | 'nhap' | 'xuat' | 'doisoat'; route: string; }

interface TaxCard { code: string; label: string; value: number; tone: string; icon: string; }

@Component({
  selector: 'app-accountant-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './accountant-dashboard.component.html',
  styleUrl: './accountant-dashboard.component.css'
})
export class AccountantDashboardComponent {
  private periodService = inject(PeriodService);
  private reconciliation = inject(ReconciliationService);
  private cashApi = inject(CashVoucherApiService);
  private warehouseApi = inject(WarehouseVoucherApiService);
  private einvoiceCheck = inject(EinvoiceCheckService);

  readonly periodLabel = this.periodService.label;

  // Thuế GTGT (Đối soát hóa đơn XML)
  taxLoading = false;
  taxError = '';
  taxRun: ReconciliationRun | null = null;
  /** lần đối soát xong gần nhất (khác kỳ) — gợi ý khi kỳ đang chọn chưa có */
  latestRun: ReconciliationRun | null = null;
  taxCards: TaxCard[] = [];
  v22Source = '';

  // Thu / chi + kho
  cashStats: CashVoucherStatistics | null = null;
  cashError = '';
  whStats: WarehouseVoucherStatistics | null = null;
  whError = '';

  // Kiểm tra HĐ tự động
  checkRun: CheckRun | null = null;
  checkScheduler: boolean | null = null;
  checkError = '';

  // Hoạt động gần đây
  activities: Activity[] = [];
  activitiesLoading = false;

  readonly quickActions = [
    { icon: 'fa-file-code', label: 'Đối soát hóa đơn XML', route: '/invoice-reconciliation-page', description: 'Thư mục XML FDI → bảng kê, tờ khai', color: '#3b82f6' },
    { icon: 'fa-rotate', label: 'Kiểm tra HĐ tự động', route: '/invoice-check-page', description: 'HĐ nháp trước khi phát hành', color: '#10b981' },
    { icon: 'fa-money-bill-transfer', label: 'Đối soát CK', route: '/bank-reconciliation-page', description: 'Sao kê TPBank ⇄ HĐ chuyển khoản', color: '#f59e0b' },
    { icon: 'fa-calculator', label: 'Số liệu khai thuế', route: '/tax-figures-page', description: '01/GTGT, PL142, 05/KK-TNCN', color: '#8b5cf6' },
    { icon: 'fa-arrow-down', label: 'Phiếu thu / chi', route: '/cash-voucher-page/receipt', description: 'Chứng từ tiền mặt', color: '#ef4444' },
  ];

  /** đổi kỳ nhanh → kết quả của lần tải cũ về sau không được ghi đè */
  private seq = 0;

  constructor() {
    effect(() => {
      const p = this.periodService.period();
      const s = ++this.seq;
      console.log(`${LOG} Kỳ ${p.from} → ${p.to}: tải số liệu`);
      void this.loadTax(p, s).then(runs => this.loadActivities(p, runs, s));
      void this.loadCash(p, s);
      void this.loadWarehouse(p, s);
      void this.loadCheck();
    });
  }

  /** → các lần đối soát XML đã xong (cho Hoạt động gần đây) */
  private async loadTax(p: AccountingPeriod, s: number): Promise<ReconciliationRun[]> {
    this.taxLoading = true;
    this.taxError = '';
    this.taxCards = [];
    this.taxRun = null;
    let done: ReconciliationRun[] = [];
    try {
      const { runs } = await firstValueFrom(this.reconciliation.listRuns());
      if (s !== this.seq) return [];
      done = runs.filter(r => r.status === 'done' && r.summary);
      this.latestRun = done[0] || null;
      this.taxRun = done.find(r => r.summary!.from === p.from && r.summary!.to === p.to) || null;
      if (!this.taxRun) {
        console.log(`${LOG} Không có lần đối soát XML cho kỳ ${p.from} → ${p.to} (${done.length} lần xong)`);
        return done;
      }
      const fig = await this.reconciliation.getFigures(this.taxRun.id);
      if (s !== this.seq) return [];
      if (!fig.tax) {
        this.taxError = 'Lần đối soát này không có số liệu tờ khai GTGT.';
        return done;
      }
      const v = savedV22(this.taxRun.id);
      this.v22Source = v !== null ? 'kế toán nhập ở trang Số liệu khai thuế' : fig.tax.v22 ? 'tờ khai kỳ trước trong thư mục XML' : 'chưa nhập (= 0)';
      const tk = recalcGtgt(fig.tax.tk, v ?? fig.tax.v22 ?? 0);
      this.taxCards = [
        { code: '34', label: 'Doanh thu bán ra', value: tk['34'] || 0, tone: 'revenue', icon: 'fa-arrow-trend-up' },
        { code: '35', label: 'Thuế GTGT đầu ra', value: tk['35'] || 0, tone: 'vat-pay', icon: 'fa-file-invoice-dollar' },
        { code: '23', label: 'Hàng hóa, dịch vụ mua vào', value: tk['23'] || 0, tone: 'expense', icon: 'fa-cart-shopping' },
        { code: '25', label: 'Thuế GTGT được khấu trừ', value: tk['25'] || 0, tone: 'vat-credit', icon: 'fa-receipt' },
        { code: '40', label: 'Thuế GTGT còn phải nộp', value: tk['40'] || 0, tone: 'profit', icon: 'fa-building-columns' },
        { code: '43', label: 'Còn được khấu trừ chuyển kỳ sau', value: tk['43'] || 0, tone: 'cash', icon: 'fa-forward' },
      ];
      console.log(`${LOG} GTGT kỳ ${p.from} → ${p.to} từ lần ${this.taxRun.id}: [34] ${tk['34']}, [40] ${tk['40']}, [43] ${tk['43']}`);
    } catch (e: any) {
      console.error(`${LOG} Không tải được số liệu GTGT: ${httpErrorText(e)}`);
      if (s === this.seq) this.taxError = `Không tải được số liệu thuế: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      if (s === this.seq) this.taxLoading = false;
    }
    return done;
  }

  private async loadCash(p: AccountingPeriod, s: number): Promise<void> {
    this.cashError = '';
    try {
      const stats = await firstValueFrom(this.cashApi.getStatistics(p.from, `${p.to}T23:59:59`));
      if (s !== this.seq) return;
      this.cashStats = stats;
      console.log(`${LOG} Phiếu thu / chi: ${this.cashStats.total_vouchers} phiếu, thu ${this.cashStats.total_receipt_amount}, chi ${this.cashStats.total_payment_amount}`);
    } catch (e: any) {
      console.error(`${LOG} Không tải được thống kê phiếu thu / chi: ${httpErrorText(e)}`);
      this.cashStats = null;
      this.cashError = `Không tải được phiếu thu / chi: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  private async loadWarehouse(p: AccountingPeriod, s: number): Promise<void> {
    this.whError = '';
    try {
      const stats = await firstValueFrom(this.warehouseApi.getStatistics(undefined, p.from, `${p.to}T23:59:59`));
      if (s !== this.seq) return;
      this.whStats = stats;
      console.log(`${LOG} Phiếu kho: ${this.whStats.total_vouchers} phiếu`);
    } catch (e: any) {
      console.error(`${LOG} Không tải được thống kê phiếu kho: ${httpErrorText(e)}`);
      this.whStats = null;
      this.whError = `Không tải được phiếu kho: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  private async loadCheck(): Promise<void> {
    this.checkError = '';
    try {
      const list = await this.einvoiceCheck.listRuns();
      this.checkScheduler = list.scheduler.enabled;
      this.checkRun = list.runs.find(r => r.status === 'done') || null;
    } catch (e: any) {
      console.error(`${LOG} Không tải được Kiểm tra HĐ tự động: ${httpErrorText(e)}`);
      this.checkRun = null;
      this.checkError = `Không tải được Kiểm tra HĐ tự động: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  /** Phiếu thu / chi, phiếu kho trong kỳ + lần đối soát XML (trong kỳ đang chọn) → 10 mục mới nhất */
  private async loadActivities(p: AccountingPeriod, runs: ReconciliationRun[], s: number): Promise<void> {
    if (s !== this.seq) return;
    this.activitiesLoading = true;
    const from = new Date(`${p.from}T00:00:00`), to = new Date(`${p.to}T23:59:59`);
    const inPeriod = (d: Date) => d >= from && d <= to;
    const out: Activity[] = [];
    const filter = { from_date: p.from, to_date: `${p.to}T23:59:59`, limit: 200 };
    const [cash, wh] = await Promise.allSettled([
      firstValueFrom(this.cashApi.getAll(filter)),
      firstValueFrom(this.warehouseApi.getAll(filter)),
    ]);
    if (cash.status === 'fulfilled') {
      for (const v of cash.value) {
        if (v.status === 'CANCELLED') continue;
        const thu = v.voucherType === 'RECEIPT';
        out.push({ date: new Date(v.voucherDate), type: thu ? 'thu' : 'chi', route: `/cash-voucher-page/${thu ? 'receipt' : 'payment'}`,
          description: `${thu ? 'Phiếu thu' : 'Phiếu chi'} ${v.voucherNo} — ${this.formatCurrency(v.totalAmount)} đ${v.description ? ' · ' + v.description : ''}` });
      }
    } else {
      console.warn(`${LOG} Hoạt động: không lấy được phiếu thu / chi — ${httpErrorText(cash.reason)}`);
    }
    if (wh.status === 'fulfilled') {
      for (const v of wh.value) {
        if (v.status === 'CANCELLED') continue;
        const nhap = v.voucherType === 'RECEIPT';
        out.push({ date: new Date(v.voucherDate), type: nhap ? 'nhap' : 'xuat', route: `/warehouse-page/${nhap ? 'receipt' : 'issue'}`,
          description: `${nhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho'} ${v.voucherNo} — ${this.formatCurrency(v.totalAmount)} đ${v.partnerName ? ' · ' + v.partnerName : ''}` });
      }
    } else {
      console.warn(`${LOG} Hoạt động: không lấy được phiếu kho — ${httpErrorText(wh.reason)}`);
    }
    for (const r of runs) {
      const d = new Date(r.created_at);
      if (!isNaN(d.getTime()) && inPeriod(d)) {
        out.push({ date: d, type: 'doisoat', route: `/tax-figures-page`,
          description: `Đối soát hóa đơn XML kỳ ${r.summary?.period || '?'} — ${r.summary?.n_invoices_in ?? 0} HĐ vào, ${r.summary?.n_invoices_out ?? 0} HĐ ra` });
      }
    }
    if (s !== this.seq) return;
    out.sort((a, b) => b.date.getTime() - a.date.getTime());
    this.activities = out.slice(0, 10);
    console.log(`${LOG} Hoạt động trong kỳ: ${out.length} mục`);
    this.activitiesLoading = false;
  }

  get taxPeriodNote(): string {
    const r = this.taxRun;
    if (!r) return '';
    const t = new Date(r.created_at);
    return `Theo lần Đối soát hóa đơn XML lúc ${isNaN(t.getTime()) ? r.created_at : t.toLocaleString('vi-VN')} — ${r.summary?.n_invoices_in ?? 0} HĐ vào, `
      + `${r.summary?.n_invoices_out ?? 0} HĐ ra. [22] ${this.v22Source}.`;
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0));
  }

  getActivityIcon(type: Activity['type']): string {
    return { thu: 'fa-arrow-down', chi: 'fa-arrow-up', nhap: 'fa-box', xuat: 'fa-truck', doisoat: 'fa-file-code' }[type];
  }

  getActivityColor(type: Activity['type']): string {
    return { thu: '#10b981', chi: '#ef4444', nhap: '#3b82f6', xuat: '#f59e0b', doisoat: '#8b5cf6' }[type];
  }
}
