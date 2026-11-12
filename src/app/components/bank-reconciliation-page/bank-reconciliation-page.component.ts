import { Component, Input, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';
import { ReconTableComponent } from '../shared/recon-table/recon-table.component';
import { PeriodService } from '../../services/period.service';
import { CompanyService } from '../../services/company.service';
import { BgJob } from '../../services/background-job.service';
import { CachedXml } from '../../services/purchase-invoice-source.service';
import { SaleInvoiceSourceService } from '../../services/sale-invoice-source.service';
import { LocalXmlInvoice } from '../../utils/invoice-xml.util';
import { parseTpBankStatement, BankStatementResult } from '../../utils/tpbank-statement.util';
import {
  ReconInvoice, ReconPair, expandInvoiceItems, reconcileWithFallback, buildReconCsv, EINVOICE_AMOUNT_TOLERANCE, EINVOICE_PUBLISH_LAG_DAYS
} from '../../utils/transfer-reconcile.util';
import { ReconViewRow, SALE_CHIPS, saleViewRows } from '../../utils/recon-view.util';

/**
 * ĐỐI SOÁT CK — BÁN RA (KeToan): HĐ đầu ra từ THƯ MỤC XML ⇄ tiền vào (Ghi có) trên sao kê TPBank.
 * 13/11/2026: KHÁC BanHang có chủ đích — kế toán đối soát theo XML (chứng từ pháp lý), không lấy HĐ từ einvoiceapp.
 * XML chỉ có NGÀY lập (= ngày phát hành), không có giờ bán / mã HĐ KiotViet / ghi chú "chuyển khoản N lần" ⇒
 * - khớp theo số tiền trong CÙNG NGÀY (bước 1), phần dư cùng số tiền trong [ngày HĐ − EINVOICE_PUBLISH_LAG_DAYS, ngày HĐ + 1]
 *   = "Khớp (phát hành trễ)" — GD trước ngày lập: xanh, chỉ ghi chú; GD sau ngày lập: vàng. Không có tab CK nhiều lần / CK dư như BanHang.
 * - HĐ ghi Tiền mặt (HTTToan) chỉ dùng khớp GD còn dư trong cùng ngày (reconcileWithFallback).
 * - Lấy HĐ đến ngày cuối + EINVOICE_PUBLISH_LAG_DAYS (HĐ bán cuối kỳ phát hành sau); HĐ sau kỳ không khớp thì bỏ (không báo thiếu GD).
 * Logic khớp: utils/transfer-reconcile.util.ts (mirror BanHang); hiển thị: utils/recon-view.util.ts + app-recon-table (dùng chung Mua vào).
 */
const LOG = '[BankRecon]';
const DAY = 1440;

@Component({
  selector: 'app-bank-reconciliation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent, ReconTableComponent],
  templateUrl: './bank-reconciliation-page.component.html',
  styleUrls: ['./bank-reconciliation-page.component.css']
})
export class BankReconciliationPageComponent implements OnInit {
  private periodService = inject(PeriodService);
  private companyService = inject(CompanyService);
  private source = inject(SaleInvoiceSourceService);
  readonly periodLabel = this.periodService.label;
  readonly chips = SALE_CHIPS;
  readonly lagDays = EINVOICE_PUBLISH_LAG_DAYS;

  /** Nhúng trong trang Đối soát CK gộp (06/11/2026): sao kê chọn ở trang chứa (loadStatementFiles), xuất 1 file Excel ở đó */
  @Input() embedded = false;

  // Khoảng ngày đối soát (yyyy-mm-dd): theo thanh chọn kỳ; có sao kê → theo ngày GD thực tế trong file
  fromDate = '';
  toDate = '';
  dateNote = '';

  // Sao kê (Ghi có), gộp nhiều file, loại trùng Mã GD
  bank: BankStatementResult | null = null;
  bankFileName = '';
  parsingFile = false;

  // XML HĐ đầu ra
  xmlFolder = '';
  xmlJob: BgJob<CachedXml> | null = null;
  xmlReading = false;
  xmlSavedAt: number | null = null;
  xmlInfo = '';
  mstWarning = '';
  /** HĐ đọc từ bản lưu cũ chưa có hình thức thanh toán → coi như CK, nhắc đọc lại thư mục */
  noPaymentCount = 0;
  private xmlRaw: CachedXml | null = null;
  private xmlSales: LocalXmlInvoice[] = [];
  private xmlById = new Map<string, LocalXmlInvoice>();

  private invoices: ReconInvoice[] = [];
  private fallbackInvoices: ReconInvoice[] = [];
  private pairs: ReconPair[] = [];
  viewRows: ReconViewRow[] = [];
  outsideUnmatched = 0;
  error = '';

  constructor() {
    effect(() => {
      const p = this.periodService.period();
      if (this.bank) return;
      this.fromDate = p.from;
      this.toDate = p.to;
      this.computeRows();
    });
    effect(() => {
      this.companyService.mst();
      if (this.xmlRaw) {
        this.applyXml();
        this.computeRows();
      }
    });
  }

  ngOnInit(): void {
    void this.restoreXml();
  }

  /** Mở lại trang: XML đã đọc (ở đây hoặc trang Kiểm tra số lượng HĐ đầu ra) / đang đọc nền → dùng ngay */
  private async restoreXml(): Promise<void> {
    const job = this.source.runningXml();
    if (job) {
      await this.awaitXml(job);
    } else {
      const c = await this.source.cachedXml();
      if (c) {
        this.xmlRaw = c.data;
        this.xmlFolder = c.data.folder;
        this.xmlSavedAt = c.savedAt;
        console.log(`${LOG} Dùng XML đầu ra đã đọc lúc ${new Date(c.savedAt).toLocaleString('vi-VN')} ("${c.data.folder}")`);
        this.applyXml();
      }
    }
    this.computeRows();
  }

  async onXmlSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    // chọn file ZIP / RAR (không phải thư mục) → không có webkitRelativePath: lấy tên file
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} file`);
    this.error = '';
    console.log(`${LOG} Chọn XML đầu ra "${folder}" (${files.length} file)`);
    await this.awaitXml(this.source.startXml(files, folder));
    this.computeRows();
  }

  private async awaitXml(job: BgJob<CachedXml>): Promise<void> {
    this.xmlJob = job;
    this.xmlReading = true;
    this.xmlFolder = job.meta['folder'];
    try {
      this.xmlRaw = await job.promise;
      this.xmlSavedAt = Date.now();
      this.applyXml();
    } catch (e: any) {
      console.error(`${LOG} Không đọc được thư mục XML đầu ra: ${e?.message || e}`);
      this.error = `Không đọc được thư mục XML: ${e?.message || e}`;
    } finally {
      this.xmlReading = false;
      this.xmlJob = null;
    }
  }

  private applyXml(): void {
    if (!this.xmlRaw) return;
    const set = this.companyService.mst();
    const { mst, detected, invoices } = this.source.xmlSales(this.xmlRaw.result, set);
    this.mstWarning = set && detected && set !== detected
      ? `MST công ty đã nhập ${set} khác MST bên bán gặp nhiều nhất trong XML ${detected} — có đúng thư mục HĐ đầu ra không?` : '';
    this.xmlSales = invoices;
    this.xmlById = new Map(invoices.map(i => [String(SaleInvoiceSourceService.toRecon(i).id), i]));
    this.noPaymentCount = invoices.filter(i => i.httt === undefined).length;
    const days = invoices.map(i => i.tdlap).sort();
    this.xmlInfo = `${invoices.length.toLocaleString('vi-VN')} HĐ đầu ra (MST ${mst || '?'})`
      + (days.length ? ` · ngày lập ${this.viDate(days[0])} → ${this.viDate(days[days.length - 1])}` : '');
    console.log(`${LOG} XML "${this.xmlFolder}": ${this.xmlInfo}` + (this.noPaymentCount ? ` · ${this.noPaymentCount} HĐ bản lưu cũ chưa có HTTT` : ''));
  }

  // ===== sao kê =====
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    await this.loadStatementFiles(files);
  }

  /** Đọc file Bảng kê .xlsx (Ghi có). `append` = thêm vào sao kê đang có (trang gộp: nút "Thêm file"), GD trùng Mã GD tự bỏ. */
  async loadStatementFiles(files: File[], append = false): Promise<void> {
    if (files.length === 0) return;
    this.error = '';
    this.parsingFile = true;
    const names = [...(append && this.bank ? this.bankFileName.split(' + ') : []), ...files.map(f => f.name)];
    this.bankFileName = names.join(' + ');
    try {
      const results: BankStatementResult[] = append && this.bank ? [this.bank] : [];
      for (const f of files) results.push(await parseTpBankStatement(f));
      this.bank = this.mergeStatements(results);
      console.log(`${LOG} Sao kê: ${files.length} file, ${this.bank.count} GD ghi có, tổng ${this.bank.totalCredit.toLocaleString('vi-VN')} ₫ (${this.bank.fromDate} → ${this.bank.toDate})`);
      this.applyBankDateRange();
    } catch (e: any) {
      console.warn(`${LOG} Không đọc được sao kê (${files.map(f => f.name).join(', ')}): ${e?.message || e}`);
      this.bank = null;
      this.dateNote = '';
      this.error = e?.message || 'Không đọc được file Bảng kê.';
    } finally {
      this.parsingFile = false;
      this.computeRows();
    }
  }

  /** Bỏ sao kê → khoảng ngày về theo thanh chọn kỳ. */
  clearBank(): void {
    this.bank = null;
    this.bankFileName = '';
    this.dateNote = '';
    const p = this.periodService.period();
    this.fromDate = p.from;
    this.toDate = p.to;
    this.computeRows();
  }

  private mergeStatements(list: BankStatementResult[]): BankStatementResult {
    if (list.length === 1) return list[0];
    const seen = new Set<string>();
    const transactions = list.flatMap(r => r.transactions).filter(t => {
      const key = t.code || `${t.date}|${t.credit}|${t.desc}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const pick = (vals: string[], dir: 1 | -1) => vals.filter(Boolean).sort((a, b) => a.localeCompare(b) * dir)[0] || '';
    return {
      transactions,
      totalCredit: transactions.reduce((s, t) => s + t.credit, 0),
      count: transactions.length,
      fromDate: pick(list.map(r => r.fromDate), 1),
      toDate: pick(list.map(r => r.toDate), -1),
      firstTxnAt: pick(list.map(r => r.firstTxnAt), 1),
      lastTxnAt: pick(list.map(r => r.lastTxnAt), -1),
      periodFrom: pick(list.map(r => r.periodFrom), 1),
      periodTo: pick(list.map(r => r.periodTo), -1),
    };
  }

  /** Khoảng ngày bám NGÀY GIAO DỊCH thực tế trong file (TPBank lọc bảng kê theo Ngày giá trị — GD Chủ Nhật nằm ở kỳ Thứ 2). */
  private applyBankDateRange(): void {
    this.dateNote = '';
    const b = this.bank;
    if (!b?.fromDate || !b.toDate) return;
    this.fromDate = b.fromDate;
    this.toDate = b.toDate;
    const period = b.periodFrom && b.periodTo
      ? `Kỳ sao kê ${this.viDate(b.periodFrom)} → ${this.viDate(b.periodTo)} (lọc theo Ngày giá trị) · ` : '';
    const span = b.fromDate === b.toDate ? `GD thực tế ngày ${this.viDate(b.fromDate)}`
      : `GD thực tế ${this.viStamp(b.firstTxnAt)} → ${this.viStamp(b.lastTxnAt)}`;
    this.dateNote = `${period}${span} · đối soát với HĐ lập ${this.viDate(b.fromDate)} → ${this.viDate(b.toDate)}`
      + ` (+ ${EINVOICE_PUBLISH_LAG_DAYS} ngày sau cho HĐĐT phát hành trễ).`;
  }

  onDatesChanged(): void {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) return;
    console.log(`${LOG} Khoảng ngày → ${this.fromDate} → ${this.toDate}`);
    this.computeRows();
  }

  // ===== đối soát =====
  get sourceReady(): boolean { return !!this.xmlRaw; }
  get canCompare(): boolean { return !!this.bank && this.sourceReady; }

  private computeRows(): void {
    if (!this.canCompare || !this.fromDate || !this.toDate) {
      this.pairs = [];
      this.viewRows = [];
      this.invoices = this.fallbackInvoices = [];
      this.computeStats();
      return;
    }
    const t0 = performance.now();
    const lastDay = this.addDays(this.toDate, EINVOICE_PUBLISH_LAG_DAYS);
    const all = this.xmlSales.filter(i => i.tdlap >= this.fromDate && i.tdlap <= lastDay).map(SaleInvoiceSourceService.toRecon);
    this.invoices = all.filter(i => i.paymentMethod !== 'TM');
    this.fallbackInvoices = all.filter(i => i.paymentMethod === 'TM');
    const pairs = reconcileWithFallback(expandInvoiceItems(this.invoices), expandInvoiceItems(this.fallbackInvoices),
      this.bank!.transactions, {
        windowBeforeMin: 0, windowAfterMin: DAY - 1,   // cùng ngày lập (giờ HĐ = 00:00)
        lateWindow: { beforeMin: EINVOICE_PUBLISH_LAG_DAYS * DAY, afterMin: 2 * DAY - 1 },
        periodFrom: this.fromDate, periodTo: this.toDate, amountTolerance: EINVOICE_AMOUNT_TOLERANCE,
      });
    // HĐ lập sau kỳ (lấy thêm cho HĐĐT phát hành trễ) mà không khớp GD → thuộc kỳ sau, không báo "HĐ thiếu GD"
    const toKey = this.viKey(this.toDate);
    const outside = (p: ReconPair) => p.kind === 'invoice_only' && this.viKey(p.item!.invoice.time) > toKey;
    this.outsideUnmatched = pairs.filter(outside).length;
    this.pairs = pairs.filter(p => !outside(p));
    this.viewRows = saleViewRows(this.pairs, id => {
      const x = this.xmlById.get(id);
      return x ? { party: x.nmten || x.nmhvten || '', mst: x.nmmst, payment: x.httt || '' } : undefined;
    });
    this.computeStats();
    console.log(`${LOG} Đối soát ${this.fromDate} → ${this.toDate}: ${this.invoices.length} HĐ CK/TMCK + ${this.fallbackInvoices.length} HĐ TM`
      + ` (đến ${lastDay}) ⇄ ${this.bankCount} GD — khớp ${this.matchedCount}, khác ngày ${this.lateCount}, HĐ thiếu GD ${this.invoiceUnmatched},`
      + ` GD thừa ${this.bankUnmatched}, HĐ sau kỳ bỏ ${this.outsideUnmatched} · khớp ${this.matchRate}% (${(performance.now() - t0).toFixed(0)} ms)`);
  }

  /** Dữ liệu cho file Excel tổng hợp của trang gộp (utils/bank-recon-export.util.ts). null = chưa đối soát được. */
  exportData(): { pairs: ReconPair[] | null; view: ReconViewRow[]; withBank: boolean; from: string; to: string } {
    return { pairs: this.canCompare ? this.pairs : null, view: this.viewRows, withBank: !!this.bank, from: this.fromDate, to: this.toDate };
  }

  /** CSV Đối soát như trước (doi-soat-ck_*.csv) — tool VietDA bản hiện tại đọc cột Mã GD / Số HĐĐT / Ký hiệu HĐĐT / Trạng thái */
  exportCsv(): void {
    const name = `doi-soat-ck_${this.fromDate}_${this.toDate}.csv`;
    const url = URL.createObjectURL(new Blob([buildReconCsv(this.pairs)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`${LOG} Xuất ${name}`);
  }

  // ===== tổng hợp =====
  get bankTotal(): number { return this.bank?.totalCredit ?? 0; }
  get bankCount(): number { return this.bank?.transactions.length ?? 0; }
  kvTotal = 0;          // Σ HĐ CK trong kỳ + HĐ khớp GD (kể cả HĐ TM / HĐ lập sau kỳ đã khớp)
  invoiceCount = 0;
  fallbackMatched = 0;
  matchedCount = 0;
  lateCount = 0;
  invoiceUnmatched = 0;
  bankUnmatched = 0;

  private computeStats(): void {
    this.kvTotal = this.invoiceCount = this.fallbackMatched = this.matchedCount = this.lateCount = this.invoiceUnmatched = this.bankUnmatched = 0;
    const fallback = new Set(this.fallbackInvoices);
    for (const p of this.pairs) {
      if (p.item) {
        this.kvTotal += p.item.amount;
        this.invoiceCount++;
        if (fallback.has(p.item.invoice)) this.fallbackMatched++;
      }
      if (p.kind === 'matched') this.matchedCount++;
      else if (p.kind === 'matched_late') this.lateCount++;
      else if (p.kind === 'invoice_only') this.invoiceUnmatched++;
      else this.bankUnmatched++;
    }
  }

  get difference(): number { return this.bankTotal - this.kvTotal; }
  get isBalanced(): boolean { return this.canCompare && this.invoiceUnmatched === 0 && this.bankUnmatched === 0; }
  /** % GD ghi có đã khớp HĐ */
  get matchRate(): string {
    return this.bankCount ? ((100 * (this.bankCount - this.bankUnmatched)) / this.bankCount).toFixed(1) : '0';
  }

  // ===== định dạng =====
  private addDays(iso: string, n: number): string {
    return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  }
  /** 'dd/mm/yyyy' | 'yyyy-mm-dd' → 'yyyymmdd' để so sánh */
  private viKey(s: string): string {
    const vi = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    return vi ? `${vi[3]}${vi[2]}${vi[1]}` : s.slice(0, 10).replace(/-/g, '');
  }
  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }
  private viStamp(stamp: string): string {
    return `${this.viDate(stamp.slice(0, 10))} ${stamp.slice(11, 16)}`;
  }
  viTime(ms: number | null): string {
    return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }
  formatVnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : n.toLocaleString('vi-VN') + ' ₫';
  }
}
