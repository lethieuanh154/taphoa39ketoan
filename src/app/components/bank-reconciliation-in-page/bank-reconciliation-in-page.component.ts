/**
 * ĐỐI SOÁT CK → CHUYỂN KHOẢN HĐ ĐẦU VÀO (23/10/2026) — HĐ mua vào ⇄ tiền RA (Ghi nợ) trên sao kê TPBank.
 * Giống "Chuyển khoản HĐ đầu ra", nguồn HĐ = thư mục XML (app FDI, `…\purchase`) — dùng chung bản đã đọc với "Kiểm tra số lượng HĐ
 * đầu vào" (PurchaseInvoiceSourceService, IndexedDB, chạy nền). 28/10/2026: bỏ nguồn Gmail (portal-links + scrape cổng NCC đã gỡ).
 * HĐ: theo KỲ ở thanh chọn kỳ (XML: dùng cả HĐ ngoài kỳ để ghép tiền trả HĐ cũ, nhưng chỉ báo "HĐ chưa thấy CK" cho HĐ trong kỳ).
 * Sao kê: mọi GD tiền ra trong file đã chọn (lưu IndexedDB `tpbank-debit`). Ghép: utils/purchase-transfer-reconcile.util.ts.
 */
import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodService } from '../../services/period.service';
import { CompanyService } from '../../services/company.service';
import { TienIchCacheService } from '../../services/tien-ich-cache.service';
import { BgJob } from '../../services/background-job.service';
import { CachedXml, PurchaseInvoiceSourceService } from '../../services/purchase-invoice-source.service';
import { DebitStatement, mergeDebitStatements, parseTpBankDebitFiles } from '../../utils/tpbank-debit.util';
import {
  PURCHASE_KIND_LABEL, PurchaseInv, PurchaseMatchKind, PurchaseMatchRow, PurchaseReconResult, buildPurchaseReconCsv,
  reconcilePurchaseTransfers, MAX_DAYS_AFTER, MAX_DAYS_BEFORE
} from '../../utils/purchase-transfer-reconcile.util';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';

const LOG = '[BankReconIn]';
const BANK_KEY = 'tpbank-debit';

@Component({
  selector: 'app-bank-reconciliation-in-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './bank-reconciliation-in-page.component.html',
  styleUrl: './bank-reconciliation-in-page.component.css'
})
export class BankReconciliationInPageComponent implements OnInit {
  private periodService = inject(PeriodService);
  private companyService = inject(CompanyService);
  private cache = inject(TienIchCacheService);
  private source = inject(PurchaseInvoiceSourceService);

  readonly periodLabel = this.periodService.label;
  readonly kindLabel = PURCHASE_KIND_LABEL;
  readonly window = { before: MAX_DAYS_BEFORE, after: MAX_DAYS_AFTER };
  from = '';
  to = '';

  // XML
  xmlFolder = '';
  xmlJob: BgJob<CachedXml> | null = null;
  xmlReading = false;
  xmlSavedAt: number | null = null;
  xmlInfo = '';
  mstWarning = '';
  private xmlRaw: CachedXml | null = null;
  private xmlInvoices: PurchaseInv[] = [];

  // Sao kê
  bank: DebitStatement | null = null;
  bankSavedAt: number | null = null;
  parsing = false;

  // Kết quả
  result: PurchaseReconResult | null = null;
  filter: '' | PurchaseMatchKind | 'low' = '';
  q = '';
  page = 1;
  readonly pageSize = 100;
  error = '';

  readonly chips: { value: '' | PurchaseMatchKind | 'low'; label: string }[] = [
    { value: '', label: 'Tất cả' }, { value: 'invoice_only', label: 'HĐ chưa thấy CK' }, { value: 'bank_only', label: 'CK không có HĐ' },
    { value: 'low', label: 'Khớp — cần xem' }, { value: 'matched', label: 'Khớp 1–1' }, { value: 'matched_group', label: '1 CK trả nhiều HĐ' },
    { value: 'matched_split', label: '1 HĐ trả nhiều lần' }];

  constructor() {
    effect(() => {
      const p = this.periodService.period();
      const changed = !!this.from && (p.from !== this.from || p.to !== this.to);
      this.from = p.from;
      this.to = p.to;
      if (changed) {
        console.log(`${LOG} Kỳ đổi → ${p.from} → ${p.to}`);
        if (this.xmlRaw) this.applyXml();
        this.recompute();
      }
    });
    effect(() => {
      this.companyService.mst();
      if (this.xmlRaw) {
        this.applyXml();
        this.recompute();
      }
    });
  }

  ngOnInit(): void {
    void this.restore();
  }

  /** Mở lại trang: sao kê + XML đã lưu (hoặc đang chạy nền) → đối soát ngay */
  private async restore(): Promise<void> {
    const b = await this.cache.get<DebitStatement>(BANK_KEY);
    if (b) {
      this.bank = b.data;
      this.bankSavedAt = b.savedAt;
      console.log(`${LOG} Dùng sao kê đã đọc lúc ${this.viTime(b.savedAt)}: ${b.data.transactions.length} GD tiền ra`);
    }
    const xj = this.source.runningXml();
    if (xj) {
      await this.awaitXml(xj);
    } else {
      const c = await this.source.cachedXml();
      if (c) {
        this.xmlRaw = c.data;
        this.xmlFolder = c.data.folder;
        this.xmlSavedAt = c.savedAt;
        this.applyXml();
      }
    }
    this.recompute();
  }

  async onXmlSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || `${files.length} file`;
    this.error = '';
    await this.awaitXml(this.source.startXml(files, folder));
    this.recompute();
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
      console.error(`${LOG} Không đọc được thư mục XML: ${e?.message || e}`);
      this.error = `Không đọc được thư mục XML: ${e?.message || e}`;
    } finally {
      this.xmlReading = false;
      this.xmlJob = null;
    }
  }

  private applyXml(): void {
    if (!this.xmlRaw) return;
    const set = this.companyService.mst();
    const { mst, detected, invoices } = this.source.xmlPurchases(this.xmlRaw.result, set);
    this.mstWarning = set && detected && set !== detected
      ? `MST công ty đã nhập ${set} khác MST bên mua gặp nhiều nhất trong XML ${detected} — kiểm tra lại thư mục.` : '';
    this.xmlInvoices = invoices.map(PurchaseInvoiceSourceService.fromXml);
    const inPeriod = this.xmlInvoices.filter(i => i.date >= this.from && i.date <= this.to).length;
    this.xmlInfo = `${this.xmlInvoices.length} HĐ đầu vào (MST ${mst || '?'}) · ${inPeriod} HĐ trong kỳ`;
    console.log(`${LOG} XML "${this.xmlFolder}": ${this.xmlInfo}`);
  }

  // ===== sao kê =====
  /** `append` = THÊM vào sao kê đang có (vd thêm tháng mới); mặc định thay sao kê. Chọn được nhiều file 1 lần (giữ Ctrl / Shift). */
  async onBankSelected(event: Event, append = false): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.parsing = true;
    this.error = '';
    try {
      // .xlsx (Bảng kê) và .pdf (Sao kê giao dịch) — chọn lẫn được; PDF đọc bằng pdfjs-dist (chỉ tải thư viện khi có file PDF)
      const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
      const xlsx = files.filter(f => !/\.pdf$/i.test(f.name));
      const parts = xlsx.length ? [await parseTpBankDebitFiles(xlsx)] : [];
      if (pdfs.length) {
        // Worker của pdf.js nạp như module JS (bundle, tải khi cần) và chạy ngay trên luồng chính qua globalThis.pdfjsWorker —
        // KHÔNG dùng file asset riêng (24/10/2026: thiếu file / dev server chưa khởi động lại → "Setting up fake worker failed").
        // Sao kê 22 trang đọc ~0,1 giây nên không cần luồng riêng.
        const [pdfjs, worker, { parseTpBankPdf, pdfToDebitStatement }] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs'), import('../../utils/tpbank-pdf.util')]);
        (globalThis as any).pdfjsWorker = worker;
        for (const f of pdfs) {
          const t0 = performance.now();
          const ps = await parseTpBankPdf(new Uint8Array(await f.arrayBuffer()), pdfjs);
          if (!ps.rows.length) throw new Error(`${f.name}: không thấy giao dịch nào — có đúng file Sao kê TPBank (PDF) không?`);
          const d = pdfToDebitStatement(ps, f.name);
          console.log(`${LOG} PDF ${f.name}: ${ps.pages} trang, ${ps.rows.length} GD (${d.transactions.length} tiền ra) — ${(performance.now() - t0).toFixed(0)} ms`);
          parts.push(d);
        }
      }
      const st = mergeDebitStatements(append && this.bank ? [this.bank, ...parts] : parts);
      this.bank = st;
      this.bankSavedAt = Date.now();
      await this.cache.set<DebitStatement>(BANK_KEY, st);
      console.log(`${LOG} Sao kê ${st.files.join(', ')}: ${st.transactions.length} GD tiền ra, ${st.fromDate} → ${st.toDate}`);
      if (!st.transactions.length) this.error = 'Sao kê không có giao dịch tiền ra (Ghi nợ) nào.';
      this.recompute();
    } catch (e: any) {
      console.error(`${LOG} Không đọc được sao kê: ${e?.message || e}`);
      this.error = `Không đọc được sao kê: ${e?.message || e}`;
    } finally {
      this.parsing = false;
    }
  }

  /** Từng file trong sao kê đang dùng + số GD tiền ra của file đó */
  get bankFiles(): { name: string; count: number; total: number }[] {
    const by = new Map<string, { name: string; count: number; total: number }>();
    for (const f of this.bank?.files || []) by.set(f, { name: f, count: 0, total: 0 });
    for (const t of this.bank?.transactions || []) {
      const k = t.file || this.bank!.files[0] || '';
      const x = by.get(k) || { name: k, count: 0, total: 0 };
      x.count++;
      x.total += t.amount;
      by.set(k, x);
    }
    return [...by.values()];
  }

  /** Bỏ 1 file khỏi sao kê đang dùng */
  removeBankFile(name: string): void {
    if (!this.bank) return;
    const files = this.bank.files.filter(f => f !== name);
    if (!files.length) {
      this.clearBank();
      return;
    }
    const transactions = this.bank.transactions.filter(t => (t.file || this.bank!.files[0]) !== name);
    const isos = transactions.map(t => t.iso).sort();
    this.bank = { ...this.bank, files, transactions, total: transactions.reduce((s, t) => s + t.amount, 0),
      fromDate: (isos[0] || this.bank.fromDate).slice(0, 10), toDate: (isos[isos.length - 1] || this.bank.toDate).slice(0, 10) };
    void this.cache.set<DebitStatement>(BANK_KEY, this.bank);
    console.log(`${LOG} Bỏ file ${name}: còn ${files.length} file, ${transactions.length} GD tiền ra`);
    this.recompute();
  }

  clearBank(): void {
    this.bank = null;
    this.bankSavedAt = null;
    void this.cache.remove(BANK_KEY);
    this.recompute();
  }

  // ===== đối soát =====
  get invoices(): PurchaseInv[] {
    return this.xmlInvoices;
  }

  get sourceReady(): boolean {
    return !!this.xmlRaw;
  }

  private recompute(): void {
    if (!this.bank || !this.sourceReady) {
      this.result = null;
      return;
    }
    const t0 = performance.now();
    this.result = reconcilePurchaseTransfers(this.invoices, this.bank.transactions, { from: this.from, to: this.to });
    this.page = 1;
    const c = this.result.counts;
    console.log(`${LOG} Đối soát ${this.invoices.length} HĐ ⇄ ${this.bank.transactions.length} GD: khớp ${c.matched}, `
      + `gộp ${c.matched_group}, tách ${c.matched_split}, HĐ chưa thấy CK ${c.invoice_only}, CK không có HĐ ${c.bank_only} `
      + `(${(performance.now() - t0).toFixed(0)} ms)`);
  }

  countOf(v: '' | PurchaseMatchKind | 'low'): number {
    if (!this.result) return 0;
    if (!v) return this.result.rows.length;
    if (v === 'low') return this.result.rows.filter(r => r.kind.startsWith('matched') && r.confidence !== 'cao').length;
    return this.result.counts[v];
  }

  get filteredRows(): PurchaseMatchRow[] {
    if (!this.result) return [];
    let rows = this.result.rows;
    if (this.filter === 'low') rows = rows.filter(r => r.kind.startsWith('matched') && r.confidence !== 'cao');
    else if (this.filter) rows = rows.filter(r => r.kind === this.filter);
    const q = this.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r => [...r.invoices.map(i => `${i.symbol}-${i.no} ${i.sellerName} ${i.sellerMst} ${i.total}`),
        ...r.txns.map(t => `${t.counterparty} ${t.desc} ${t.amount} ${t.code}`)].join(' ').toLowerCase().includes(q));
    }
    return rows;
  }

  get pageRows(): PurchaseMatchRow[] {
    const s = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(s, s + this.pageSize);
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)); }

  setFilter(f: '' | PurchaseMatchKind | 'low'): void {
    this.filter = f;
    this.page = 1;
  }

  exportCsv(): void {
    const name = `ck-hd-dau-vao_${this.from}_${this.to}.csv`;
    const url = URL.createObjectURL(new Blob(['﻿' + buildPurchaseReconCsv(this.filteredRows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`${LOG} Xuất ${name} (${this.filteredRows.length} dòng)`);
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN');
  }

  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }

  viTime(ms: number | null): string {
    return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }
}
