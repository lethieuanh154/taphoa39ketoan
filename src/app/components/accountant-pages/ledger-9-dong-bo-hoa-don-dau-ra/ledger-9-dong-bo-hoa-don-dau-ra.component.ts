/**
 * LEDGER 9 - KIỂM TRA SỐ LƯỢNG HÓA ĐƠN ĐẦU RA (Tiện ích → Kiểm tra số lượng hóa đơn)
 * Danh sách HĐ trong thư mục XML trên máy (app FDI tải từ cổng thuế — thư mục `sold`) ⇄ HĐĐT KiotViet (einvoice, qua
 * KeToanBackEnd /api/einvoice-check/bills). Viết lại 23/10/2026 (user chọn nguồn so = HĐĐT KiotViet): bản cũ đọc HĐ "trang thuế"
 * qua /api/v2/invoices/output và KiotViet qua /api/kiotviet/* — cả 2 route KHÔNG tồn tại trên KeToanBackEnd.
 * Khóa so: mẫu số + ký hiệu + số HĐ. XML đọc ngay trên trình duyệt (utils/invoice-xml.util.ts), không tải lên máy chủ.
 * MST công ty = CompanyService (popup ở MainLayout), chưa nhập thì tự nhận từ XML. XML đã đọc + HĐĐT đã lấy lưu IndexedDB
 * (TienIchCacheService) → mở lại trang hiện ngay kết quả cũ, bấm "Lấy lại từ KiotViet" / chọn lại thư mục để cập nhật.
 * 23/10/2026: khoảng ngày = KỲ ở thanh chọn kỳ (bỏ ô Từ / Đến riêng — trùng, dễ lệch với kỳ). Đọc XML + lấy HĐĐT chạy NỀN
 * (BackgroundJobService) → chuyển trang không dừng; quay lại thấy tiến độ / kết quả.
 * 28/10/2026: link HĐ gốc — XML máy tính tiền KHÔNG có mã tra cứu → mã = `verify_code` của HĐĐT KiotViet, link = trang einvoiceapp;
 * mỗi lần lấy HĐĐT mới từ KiotViet tự lưu lên máy chủ (InvoiceLookupService, Firestore `invoice_lookups` chiều 'out').
 */
import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { httpErrorText } from '../../../services/auth.service';
import { EinvoiceBill, EinvoiceCheckService } from '../../../services/einvoice-check.service';
import { PeriodService } from '../../../services/period.service';
import { CompanyService } from '../../../services/company.service';
import { TienIchCacheService } from '../../../services/tien-ich-cache.service';
import { BackgroundJobService, BgJob } from '../../../services/background-job.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst, readInvoiceFiles } from '../../../utils/invoice-xml.util';
import { TableLoadingComponent } from '../../shared/table-loading/table-loading.component';
import { InvoiceLookupService, LookupItem } from '../../../services/invoice-lookup.service';

const LOG = '[InvoiceCountOut]';
const TOL = 1;
const MAX_DAYS = 92;
const CACHE_XML = 'xml-out';

interface CachedXml { folder: string; result: XmlReadResult; }
interface CachedBills { einvoice_url: string; bills: EinvoiceBill[]; }

type RowStatus = 'mismatch' | 'only_xml' | 'only_kv' | 'match';

interface CompareRow {
  key: string;
  status: RowStatus;
  xml: LocalXmlInvoice | null;
  kv: EinvoiceBill | null;
  diffs: string[];
}

@Component({
  selector: 'app-ledger-9-dong-bo-hoa-don-dau-ra',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './ledger-9-dong-bo-hoa-don-dau-ra.component.html',
  styleUrls: ['./ledger-9-dong-bo-hoa-don-dau-ra.component.css']
})
export class Ledger9DongBoHoaDonDauRaComponent {
  private service = inject(EinvoiceCheckService);
  private periodService = inject(PeriodService);
  private companyService = inject(CompanyService);
  private cache = inject(TienIchCacheService);
  private jobs = inject(BackgroundJobService);
  private lookups = inject(InvoiceLookupService);
  readonly periodLabel = this.periodService.label;

  fromDate = '';
  toDate = '';

  // XML trên máy
  xmlInvoices: LocalXmlInvoice[] = [];
  xmlFolder = '';
  xmlReading = false;
  /** việc đọc thư mục đang chạy nền (tiến độ lấy từ đây — vẫn chạy khi đã chuyển trang) */
  xmlJob: BgJob<CachedXml> | null = null;
  xmlInfo = '';
  xmlDates: [string, string] | null = null;
  companyMst = '';
  /** MST đã nhập khác MST tự nhận từ XML */
  mstWarning = '';
  /** thời điểm đọc thư mục (bản lưu IndexedDB) */
  xmlSavedAt: number | null = null;
  private rawXml: XmlReadResult | null = null;

  // HĐĐT KiotViet
  loadingKv = false;
  einvoiceUrl = '';
  drafts: EinvoiceBill[] = [];
  /** thời điểm lấy HĐĐT của kết quả đang xem */
  kvFetchedAt: number | null = null;

  // Kết quả
  rows: CompareRow[] = [];
  compared = false;
  comparedRange = '';
  counts = { xml: 0, kv: 0, match: 0, mismatch: 0, only_xml: 0, only_kv: 0 };
  filter: '' | RowStatus = '';
  q = '';
  page = 1;
  readonly pageSize = 100;
  error = '';
  /** lưu link HĐ gốc lên máy chủ */
  linkInfo = '';
  copiedMsg = '';
  private copiedTimer: any = null;

  readonly statusLabel: Record<RowStatus, string> = {
    mismatch: 'Lệch số tiền', only_xml: 'Chỉ có trên XML', only_kv: 'Chỉ có trên KiotViet', match: 'Khớp'
  };
  readonly chips: { value: '' | RowStatus; label: string }[] = [
    { value: '', label: 'Tất cả' }, { value: 'mismatch', label: 'Lệch số tiền' }, { value: 'only_xml', label: 'Chỉ XML' },
    { value: 'only_kv', label: 'Chỉ KiotViet' }, { value: 'match', label: 'Khớp' }];

  constructor() {
    effect(() => {
      const p = this.periodService.period();
      const changed = !!this.fromDate && (p.from !== this.fromDate || p.to !== this.toDate);
      this.fromDate = p.from;
      this.toDate = p.to;
      if (changed && this.rawXml) {
        console.log(`${LOG} Kỳ đổi → ${p.from} → ${p.to}: hiện kết quả đã lưu của kỳ này (nếu có)`);
        this.compared = false;
        void this.compare(false, true);
      }
    });
    effect(() => {
      const mst = this.companyService.mst();
      if (this.rawXml) {
        console.log(`${LOG} MST công ty đổi → ${mst || '(tự nhận)'}: lọc lại XML`);
        this.applyXml();
        this.compared = false;
      }
    });
    void this.restore();
  }

  /** Mở lại trang: XML đã đọc lần trước + HĐĐT đã lấy cho kỳ đang chọn (nếu có) → hiện ngay, không gọi máy chủ */
  private async restore(): Promise<void> {
    if (!this.fromDate || !this.toDate) ({ from: this.fromDate, to: this.toDate } = this.periodService.period());
    const running = this.jobs.get<CachedXml>(CACHE_XML);
    if (running) {
      console.log(`${LOG} Quay lại trang: đang đọc thư mục "${running.meta['folder']}" (chạy nền) → chờ tiếp`);
      await this.awaitXmlJob(running);
    } else {
      const c = await this.cache.get<CachedXml>(CACHE_XML);
      if (!c || this.rawXml || this.xmlReading) return;
      this.xmlFolder = c.data.folder;
      this.rawXml = c.data.result;
      this.xmlSavedAt = c.savedAt;
      this.applyXml();
      console.log(`${LOG} Dùng XML đã đọc lúc ${this.viTime(c.savedAt)} ("${this.xmlFolder}", ${this.xmlInvoices.length} HĐ)`);
    }
    if (!this.xmlInvoices.length || this.rangeError) return;
    const bills = this.jobs.find<CachedBills>('einvoice-bills:');
    if (bills) {
      console.log(`${LOG} Quay lại trang: đang lấy HĐĐT ${bills.meta['from']} → ${bills.meta['to']} (chạy nền) → chờ tiếp`);
      this.loadingKv = true;
      await bills.promise.catch(() => null);
      this.loadingKv = false;
    }
    await this.compare(false, true);
  }

  /** Chờ việc đọc thư mục chạy nền xong → dùng kết quả (cũng dùng khi quay lại trang giữa chừng) */
  private async awaitXmlJob(job: BgJob<CachedXml>): Promise<void> {
    this.xmlJob = job;
    this.xmlReading = true;
    this.xmlFolder = job.meta['folder'];
    try {
      const { result: r } = await job.promise;
      this.rawXml = r;
      this.xmlSavedAt = Date.now();
      this.applyXml();
      console.log(`${LOG} Thư mục "${this.xmlFolder}": ${this.xmlInfo}`);
      if (r.errors.length) console.warn(`${LOG} File XML lỗi:`, r.errors.slice(0, 10));
    } catch (e: any) {
      console.error(`${LOG} Không đọc được thư mục XML: ${e?.message || e}`);
      this.error = `Không đọc được thư mục XML: ${e?.message || e}`;
      this.xmlInvoices = [];
      this.rawXml = null;
    } finally {
      this.xmlReading = false;
      this.xmlJob = null;
    }
  }

  async onXmlSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || `${files.length} file`;
    this.error = '';
    this.xmlInfo = '';
    this.compared = false;
    // chạy nền: đổi trang vẫn đọc tiếp, đọc xong ghi IndexedDB ngay trong việc
    const job = this.jobs.run<CachedXml>(CACHE_XML, `Đọc thư mục XML đầu ra "${folder}"`, { folder }, async j => {
      const result = await readInvoiceFiles(files, (d, t) => j.progress = `${d}/${t} file`);
      await this.cache.set<CachedXml>(CACHE_XML, { folder, result });
      return { folder, result };
    });
    await this.awaitXmlJob(job);
  }

  /** Lọc HĐ đầu ra (bên bán = MST công ty) từ XML đã đọc */
  private applyXml(): void {
    const r = this.rawXml;
    if (!r) return;
    const detected = detectCompanyMst(r.invoices, 'seller');
    const set = this.companyService.mst();
    this.companyMst = set || detected;
    this.mstWarning = set && detected && set !== detected
      ? `MST công ty đã nhập ${set} khác MST bên bán gặp nhiều nhất trong XML ${detected} — kiểm tra lại thư mục, hoặc bấm "MST" ở góc dưới để đổi.` : '';
    if (this.mstWarning) console.warn(`${LOG} ${this.mstWarning}`);
    this.xmlInvoices = r.invoices.filter(i => !this.companyMst || i.nbmst === this.companyMst);
    const skipped = r.invoices.length - this.xmlInvoices.length;
    const dates = this.xmlInvoices.map(i => i.tdlap).filter(Boolean).sort();
    this.xmlDates = dates.length ? [dates[0], dates[dates.length - 1]] : null;
    this.xmlInfo = `${this.xmlInvoices.length} HĐ đầu ra` + (this.xmlDates ? ` (ngày ${this.viDate(this.xmlDates[0])} → ${this.viDate(this.xmlDates[1])})` : '')
      + ` · MST công ty ${this.companyMst || '?'}${set ? '' : ' (tự nhận)'} · đọc ${r.nFiles} file XML` + (skipped ? ` · bỏ ${skipped} HĐ khác` : '')
      + (r.nNotInvoice ? ` · ${r.nNotInvoice} XML không phải HĐ` : '') + (r.nDuplicates ? ` · ${r.nDuplicates} trùng` : '')
      + (r.errors.length ? ` · ${r.errors.length} file lỗi` : '');
    this.error = this.xmlInvoices.length ? '' : 'Không tìm thấy HĐ đầu ra nào của MST công ty trong thư mục đã chọn (cần file XML hóa đơn điện tử hoặc ZIP chứa XML).';
  }

  // Đang chạy = cờ của trang HOẶC việc nền còn chạy (25/10/2026): quay lại trang thấy loading NGAY, không đợi đọc xong bản XML đã lưu
  get xmlBusy(): boolean { return this.xmlReading || !!this.jobs.get(CACHE_XML); }
  get kvBusy(): boolean { return this.loadingKv || !!this.jobs.find('einvoice-bills:'); }
  get xmlProgressText(): string { return (this.xmlJob || this.jobs.get<CachedXml>(CACHE_XML))?.progress || ''; }

  get rangeError(): string {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) return 'Chọn kỳ trên thanh chọn kỳ';
    const days = (Date.parse(this.toDate) - Date.parse(this.fromDate)) / 86400000 + 1;
    return days > MAX_DAYS ? `Kỳ đang chọn dài ${days} ngày — tối đa ${MAX_DAYS} ngày mỗi lần, chọn kỳ Tháng hoặc Quý` : '';
  }

  /** `force` = bỏ bản lưu, lấy lại HĐĐT từ máy chủ. `cacheOnly` (mở lại trang) = chỉ dùng bản lưu, không có thì thôi. */
  async compare(force = false, cacheOnly = false): Promise<void> {
    if (!this.xmlInvoices.length) {
      console.warn(`${LOG} Chưa chọn thư mục XML → không so`);
      this.error = 'Chọn thư mục XML hóa đơn đầu ra (app FDI tải về) trước.';
      return;
    }
    if (this.rangeError) {
      console.warn(`${LOG} Khoảng ngày không hợp lệ: ${this.fromDate} → ${this.toDate}`);
      this.error = this.rangeError;
      return;
    }
    const cacheKey = `einvoice-bills:${this.fromDate}:${this.toDate}`;
    const cached = force ? null : await this.cache.get<CachedBills>(cacheKey);
    if (cacheOnly && !cached) return;
    this.loadingKv = true;
    this.error = '';
    let fresh = false;
    try {
      let res: CachedBills;
      if (cached) {
        res = cached.data;
        this.kvFetchedAt = cached.savedAt;
        console.log(`${LOG} HĐĐT ${this.fromDate} → ${this.toDate}: dùng bản lưu lúc ${this.viTime(cached.savedAt)} (${res.bills.length} HĐ)`);
      } else {
        const [from, to] = [this.fromDate, this.toDate];
        // chạy nền: đổi trang vẫn lấy tiếp, xong ghi IndexedDB ngay trong việc
        res = await this.jobs.run<CachedBills>(cacheKey, `Lấy HĐĐT KiotViet ${from} → ${to}`, { from, to }, async () => {
          const r = await this.service.listBills(from, to);
          const data = { einvoice_url: r.einvoice_url, bills: r.bills };
          await this.cache.set<CachedBills>(cacheKey, data);
          return data;
        }).promise;
        this.kvFetchedAt = Date.now();
        fresh = true;
      }
      this.einvoiceUrl = res.einvoice_url;
      const published = res.bills.filter(b => b.number);
      this.drafts = res.bills.filter(b => !b.number);
      this.build(published);
      this.comparedRange = `${this.viDate(this.fromDate)} → ${this.viDate(this.toDate)}`;
      console.log(`${LOG} ${this.comparedRange}: XML ${this.counts.xml}, HĐĐT ${this.counts.kv} (nháp ${this.drafts.length}) → khớp ${this.counts.match}, `
        + `lệch ${this.counts.mismatch}, chỉ XML ${this.counts.only_xml}, chỉ KiotViet ${this.counts.only_kv}`);
    } catch (e: any) {
      console.error(`${LOG} Lấy HĐĐT KiotViet ${this.fromDate} → ${this.toDate} lỗi: ${httpErrorText(e)}`);
      this.error = `Không lấy được HĐĐT KiotViet: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.loadingKv = false;
    }
    if (fresh && this.rows.length) await this.saveLinks();
  }

  /** HĐĐT đã lưu trên máy trước 28/10/2026 không có mã tra cứu → cần "Lấy lại từ KiotViet" */
  get kvNoCode(): boolean {
    return this.rows.some(r => r.kv) && this.rows.every(r => !r.kv || r.kv.verify_code === undefined);
  }

  /** Lưu link HĐ gốc (mã tra cứu KiotViet + link einvoiceapp) của mọi dòng đang so lên máy chủ. Không gửi thông tin người mua. */
  async saveLinks(): Promise<void> {
    const items: LookupItem[] = [];
    for (const r of this.rows) {
      const x = r.xml, b = r.kv;
      const number = x?.shdon ?? Number(b?.number);
      if (!number) continue;
      items.push({
        date: x?.tdlap || (b?.date || '').slice(0, 10), seller_mst: this.companyMst, template: x?.khmshdon || b?.template || '1',
        series: x?.khhdon || b?.series || '', number, total_before_vat: x?.tgtcthue ?? b?.amount, vat: x?.tgtthue ?? b?.amount_vat,
        total: x?.tgtttbso ?? b?.total, mccqt: x?.mccqt || b?.cqt_code || '', provider: b ? 'KiotViet HĐĐT' : '',
        code: b?.verify_code || '', code_field: b?.verify_code ? 'verify_code' : '', url: b ? this.billUrl(b) : '', direct: b ? true : undefined,
        einvoice_id: b?.id || '', kv_code: b?.code || '',
      });
    }
    if (!items.length || !this.companyMst) {
      console.warn(`${LOG} Không lưu link HĐ gốc: ${!this.companyMst ? 'chưa biết MST công ty' : 'không có dòng nào'}`);
      return;
    }
    try {
      const r = await this.lookups.save('out', items);
      this.linkInfo = `Đã lưu link HĐ gốc lên máy chủ: ${r.saved} HĐ (${items.filter(i => i.code).length} có mã tra cứu)`;
    } catch (e: any) {
      console.error(`${LOG} Lưu link HĐ gốc lỗi: ${httpErrorText(e)}`);
      this.linkInfo = `Không lưu được link HĐ gốc lên máy chủ: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedMsg = `Đã chép mã tra cứu ${text}`;
    } catch (e: any) {
      console.warn(`${LOG} Không chép được vào clipboard: ${e?.message || e}`);
      this.copiedMsg = `Không chép tự động được — tự chép: ${text}`;
    }
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copiedMsg = '', 5000);
  }

  private build(bills: EinvoiceBill[]): void {
    const key = (tpl: string, series: string, no: number) => `${tpl || '1'}${(series || '').toUpperCase()}-${no}`;
    const xml = new Map<string, LocalXmlInvoice>();
    for (const i of this.xmlInvoices) {
      if (i.tdlap >= this.fromDate && i.tdlap <= this.toDate) xml.set(key(i.khmshdon, i.khhdon, i.shdon), i);
    }
    const kv = new Map<string, EinvoiceBill>();
    for (const b of bills) kv.set(key(b.template, b.series, Number(b.number)), b);
    const rows: CompareRow[] = [];
    for (const k of new Set([...xml.keys(), ...kv.keys()])) {
      const x = xml.get(k) || null;
      const b = kv.get(k) || null;
      const diffs: string[] = [];
      if (x && b) {
        const cmp: [string, number, number][] = [['Chưa thuế', x.tgtcthue, b.amount], ['Thuế', x.tgtthue, b.amount_vat], ['Tổng TT', x.tgtttbso, b.total]];
        for (const [label, a, c] of cmp) {
          if (Math.abs(a - c) > TOL) diffs.push(`${label}: XML ${this.vnd(a)} ≠ KiotViet ${this.vnd(c)}`);
        }
      }
      rows.push({ key: k, xml: x, kv: b, diffs, status: !x ? 'only_kv' : !b ? 'only_xml' : diffs.length ? 'mismatch' : 'match' });
    }
    const order: Record<RowStatus, number> = { mismatch: 0, only_xml: 1, only_kv: 2, match: 3 };
    rows.sort((a, b) => (order[a.status] - order[b.status]) || this.rowNo(b) - this.rowNo(a));
    this.rows = rows;
    this.counts = { xml: xml.size, kv: kv.size, match: 0, mismatch: 0, only_xml: 0, only_kv: 0 };
    for (const r of rows) this.counts[r.status]++;
    this.compared = true;
    this.filter = '';
    this.page = 1;
  }

  private rowNo(r: CompareRow): number {
    return r.xml?.shdon ?? (Number(r.kv?.number) || 0);
  }

  get filteredRows(): CompareRow[] {
    let rows = this.filter ? this.rows.filter(r => r.status === this.filter) : this.rows;
    const q = this.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => `${r.key} ${r.kv?.code || ''} ${r.xml?.nmten || ''}`.toLowerCase().includes(q));
    return rows;
  }

  get pageRows(): CompareRow[] {
    const s = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(s, s + this.pageSize);
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)); }

  setFilter(f: '' | RowStatus): void {
    this.filter = f;
    this.page = 1;
  }

  billUrl(b: EinvoiceBill): string {
    return `${this.einvoiceUrl}?id=${encodeURIComponent(b.id)}`;
  }

  /** CSV (dấu ; · UTF-8 BOM) theo bộ lọc đang chọn */
  exportCsv(): void {
    const cell = (v: string | number | null | undefined) => {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Kết quả', 'Ký hiệu - Số', 'Ngày XML', 'Người mua (XML)', 'Chưa thuế XML', 'Thuế XML', 'Tổng TT XML',
      'Mã HĐ KiotViet', 'Ngày HĐĐT', 'Chưa thuế KiotViet', 'Thuế KiotViet', 'Tổng TT KiotViet', 'Mã tra cứu', 'Chi tiết lệch'];
    const lines = [head.join(';'), ...this.filteredRows.map(r => [
      this.statusLabel[r.status], r.key, r.xml ? this.viDate(r.xml.tdlap) : '', r.xml?.nmten || '', r.xml?.tgtcthue, r.xml?.tgtthue,
      r.xml?.tgtttbso, r.kv?.code || '', r.kv ? r.kv.date.slice(0, 10) : '', r.kv?.amount, r.kv?.amount_vat, r.kv?.total,
      r.kv?.verify_code || '', r.diffs.join(' | ')].map(cell).join(';'))];
    const name = `kiem-tra-so-luong-hd-dau-ra_${this.fromDate}_${this.toDate}.csv`;
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`${LOG} Xuất ${name} (${this.filteredRows.length} dòng)`);
  }

  viTime(ms: number | null): string {
    return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }

  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN');
  }
}
