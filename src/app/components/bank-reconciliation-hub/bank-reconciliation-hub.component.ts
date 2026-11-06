/**
 * ĐỐI SOÁT CK — 1 trang cho cả BÁN RA + MUA VÀO (06/11/2026, user: "gộp 2 phần mua vào và bán ra vào chung 1 trang").
 * Chọn sao kê TPBank 1 lần ở đầu trang: .xlsx → bán ra (Ghi có ⇄ HĐĐT) + mua vào (Ghi nợ ⇄ HĐ XML); .pdf chỉ đọc được tiền ra.
 * 2 tab dùng lại 2 trang cũ ở chế độ nhúng ([embedded]): BankReconciliationPageComponent / BankReconciliationInPageComponent.
 * "Xuất Excel" = 1 file .xlsx cho tool VietDA (utils/bank-recon-export.util.ts) thay các CSV riêng từng bảng.
 * Route cũ /bank-reconciliation-in-page chuyển về đây (?tab=mua-vao).
 */
import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BankReconciliationPageComponent } from '../bank-reconciliation-page/bank-reconciliation-page.component';
import { BankReconciliationInPageComponent } from '../bank-reconciliation-in-page/bank-reconciliation-in-page.component';
import { TienIchCacheService } from '../../services/tien-ich-cache.service';
import { buildBankReconWorkbook } from '../../utils/bank-recon-export.util';

const LOG = '[BankReconHub]';
/** File sao kê đã chọn (File, IndexedDB) — mở lại trang thì đọc lại cho phần bán ra; phần mua vào tự lưu GD tiền ra riêng */
const FILES_KEY = 'tpbank-statement-files';

type Tab = 'ban-ra' | 'mua-vao';

@Component({
  selector: 'app-bank-reconciliation-hub',
  standalone: true,
  imports: [CommonModule, BankReconciliationPageComponent, BankReconciliationInPageComponent],
  templateUrl: './bank-reconciliation-hub.component.html',
  styleUrl: './bank-reconciliation-hub.component.css'
})
export class BankReconciliationHubComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cache = inject(TienIchCacheService);

  @ViewChild(BankReconciliationPageComponent, { static: true }) sale!: BankReconciliationPageComponent;
  @ViewChild(BankReconciliationInPageComponent, { static: true }) purchase!: BankReconciliationInPageComponent;

  tab: Tab = 'ban-ra';
  files: File[] = [];
  loading = false;
  error = '';
  exportNote = '';

  ngOnInit(): void {
    this.tab = this.route.snapshot.queryParamMap.get('tab') === 'mua-vao' ? 'mua-vao' : 'ban-ra';
  }

  ngAfterViewInit(): void {
    void this.restore();
  }

  setTab(t: Tab): void {
    this.tab = t;
    void this.router.navigate([], { queryParams: { tab: t === 'mua-vao' ? t : null }, replaceUrl: true });
  }

  /** Mở lại trang: đọc lại file sao kê đã lưu cho phần bán ra (mua vào tự khôi phục GD tiền ra trong ngOnInit của nó) */
  private async restore(): Promise<void> {
    const c = await this.cache.get<File[]>(FILES_KEY);
    if (!c?.data?.length) return;
    this.files = c.data;
    const xlsx = this.files.filter(f => !/\.pdf$/i.test(f.name));
    console.log(`${LOG} Dùng lại ${this.files.length} file sao kê đã chọn lúc ${new Date(c.savedAt).toLocaleString('vi-VN')}`);
    if (xlsx.length) await this.sale.loadStatementFiles(xlsx);
  }

  /** `append` = thêm file vào sao kê đang dùng (vd thêm tháng mới); GD trùng Mã GD tự bỏ ở cả 2 phần. */
  async onStatementSelected(event: Event, append = false): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files || []);
    input.value = '';
    if (!picked.length) return;
    this.error = '';
    this.exportNote = '';
    this.loading = true;
    const xlsx = picked.filter(f => !/\.pdf$/i.test(f.name));
    console.log(`${LOG} Sao kê ${append ? 'thêm' : 'chọn'} ${picked.map(f => f.name).join(', ')} (${xlsx.length} .xlsx, ${picked.length - xlsx.length} .pdf)`);
    try {
      await Promise.all([
        xlsx.length ? this.sale.loadStatementFiles(xlsx, append && this.files.length > 0) : Promise.resolve(),
        this.purchase.loadBankFiles(picked, append),
      ]);
      this.files = append ? [...this.files, ...picked] : picked;
      await this.cache.set<File[]>(FILES_KEY, this.files);
      if (!xlsx.length) this.error = 'File PDF chỉ đọc được tiền ra (mua vào) — phần bán ra cần sao kê .xlsx.';
    } catch (e: any) {
      console.error(`${LOG} Đọc sao kê lỗi: ${e?.message || e}`);
      this.error = `Không đọc được sao kê: ${e?.message || e}`;
    } finally {
      this.loading = false;
    }
  }

  clearStatement(): void {
    this.sale.clearBank();
    this.purchase.clearBank();
    this.files = [];
    this.exportNote = '';
    void this.cache.remove(FILES_KEY);
    console.log(`${LOG} Bỏ sao kê`);
  }

  get fileNames(): string {
    const n = this.files.map(f => f.name);
    return n.length > 3 ? `${n[0]} … ${n[n.length - 1]}` : n.join(', ');
  }
  get creditCount(): number { return this.sale?.bank?.count ?? 0; }
  get debitCount(): number { return this.purchase?.bank?.transactions.length ?? 0; }
  get canExport(): boolean { return !!this.sale?.kvLoaded || !!this.purchase?.result || !!this.purchase?.bank; }

  /** 1 file .xlsx: Nhap-VietDA (Thu + Chi) + các bảng bán ra / mua vào (bank-recon-export.util.ts) */
  exportExcel(): void {
    const s = this.sale.exportData();
    const name = `doi-soat-ck_${s.from}_${s.to}.xlsx`;
    try {
      const { bytes, summary } = buildBankReconWorkbook({
        from: s.from, to: s.to, statementFiles: this.files.map(f => f.name),
        salePairs: s.pairs, saleWithBank: s.withBank,
        purchaseRows: this.purchase.result?.rows ?? null, debitTxns: this.purchase.bank?.transactions ?? [],
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      this.exportNote = `Đã xuất ${name}: ${summary}`;
      console.log(`${LOG} Xuất ${name} — ${summary}`);
    } catch (e: any) {
      console.error(`${LOG} Xuất Excel lỗi: ${e?.message || e}`);
      this.error = `Không xuất được Excel: ${e?.message || e}`;
    }
  }

  /** CSV Đối soát bán ra như trước (doi-soat-ck_*.csv) — tool VietDA bản hiện tại còn đọc file này; bỏ khi tool đọc được Excel */
  exportLegacyCsv(): void {
    this.sale.exportCsv();
  }
}
