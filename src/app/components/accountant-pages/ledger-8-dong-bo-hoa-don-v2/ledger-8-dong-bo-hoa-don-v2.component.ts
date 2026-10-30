/**
 * LEDGER 8 - KIỂM TRA SỐ LƯỢNG HÓA ĐƠN ĐẦU VÀO (Tiện ích → Kiểm tra số lượng hóa đơn)
 * 23/10/2026: bỏ nguồn GDT (cổng thuế chặn tự động hóa) → đọc XML trong trình duyệt (utils/invoice-xml.util.ts), không upload.
 * 23/10/2026 chiều: khoảng ngày = KỲ ở thanh chọn kỳ. Đọc XML chạy NỀN (BackgroundJobService) → chuyển trang không dừng.
 * 28/10/2026 (user): bỏ đối chiếu Gmail ⇄ XML (portal-links + scrape cổng NCC) → trang gồm:
 * - Đếm nhanh: số email Gmail ⇄ số HĐ XML (giữ — Gmail chỉ còn dùng ở đây). 28/10/2026: bỏ bảng theo ngày + nút "Gmail ngày này" →
 *   tổng email ⇄ tổng HĐ + 2 cột lệch (HĐ chưa thấy email | email chưa ghép HĐ); email trễ ≤ LAG_DAYS ngày vẫn ghép đúng HĐ.
 * - Danh sách HĐ đầu vào + cột HĐ gốc: mã / link tra cứu lấy từ XML (utils/invoice-lookup.util.ts), lưu Firestore qua
 *   InvoiceLookupService (tự lưu sau mỗi lần chọn thư mục) → máy khác mở trang thấy ngay danh sách + link của kỳ, không cần thư mục.
 *   28/10/2026: HĐ chưa có link NCC (NCC HĐĐT chưa biết / người bán có trang tra cứu riêng) → kế toán dán link từ email NCC 1 lần
 *   (nút "Gán link") cho cả NCC HĐĐT / người bán / riêng 1 HĐ; link có mã tra cứu của HĐ → tự thành link mẫu mở thẳng mọi HĐ.
 */

import { Component, OnInit, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { InvoiceServiceV2 } from '../invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';
import { PeriodService } from '../../../services/period.service';
import { CompanyService } from '../../../services/company.service';
import { BgJob } from '../../../services/background-job.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst } from '../../../utils/invoice-xml.util';
import { CachedXml, GmailCount, PurchaseInvoiceSourceService } from '../../../services/purchase-invoice-source.service';
import { CountEmail, CountResult, LAG_DAYS, compareCounts, countFetchTo } from '../../../utils/invoice-count.util';
import { AuthService, httpErrorText } from '../../../services/auth.service';
import {
  GDT_LOOKUP_URL, InvoiceLookupService, SavedLookup, fromXml, gdtLookupText, lookupKey
} from '../../../services/invoice-lookup.service';
import { LookupPortal, applyPortal, isHttpUrl, linkTemplate, looksInvoiceSpecific } from '../../../utils/invoice-lookup.util';
import { environment } from '../../../../environments/environment';
import { TableLoadingComponent } from '../../shared/table-loading/table-loading.component';

const LOG = '[InvoiceCountIn]';
const MAX_SAVED_DAYS = 92;

type LinkKind = 'direct' | 'portal' | 'gdt';
type AssignScope = 'tcgp' | 'seller' | 'invoice';

/** 1 dòng danh sách HĐ đầu vào: XML trên máy và / hoặc bản lưu máy chủ */
export interface InRow {
  key: string;
  date: string; template: string; series: string; no: number;
  sellerMst: string; sellerName: string;
  beforeVat: number; vat: number; total: number;
  tcgp: string; provider: string; code: string; codeField: string; url: string; kind: LinkKind;
  inXml: boolean; saved: boolean;
  /** link riêng HĐ này kế toán dán tay (máy chủ `manual_url`) */
  manualUrl: string;
  /** link đang dùng là link gán tay theo phạm vi nào ('' = lấy từ XML / bảng NCC có sẵn) */
  assigned: '' | AssignScope;
  /** link gốc từ XML / bản lưu (trước khi áp link gán tay) */
  baseUrl: string; baseDirect: boolean;
}

/** Nhóm HĐ chưa có link NCC — gán 1 lần cho cả nhóm */
export interface NeedLinkGroup { id: string; label: string; n: number; withCode: boolean; sample: InRow; }

@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TableLoadingComponent],
  templateUrl: './ledger-8-dong-bo-hoa-don-v2.component.html',
  styleUrls: ['./ledger-8-dong-bo-hoa-don-v2.component.css']
})
export class Ledger8DongBoHoaDonV2Component implements OnInit, OnDestroy {
  filterForm: FormGroup;

  // Gmail labels — lọc Đếm nhanh theo NCC
  gmailLabels: {id: string, name: string, displayName: string}[] = [];
  labelMappings: {labelId: string, labelName: string, displayName: string, supplierTaxCode: string, supplierName: string}[] = [];
  loadingLabels = false;

  private destroy$ = new Subject<void>();

  // === Danh sách HĐ từ thư mục XML trên máy ===
  xmlInvoices: LocalXmlInvoice[] = [];   // HĐ đầu vào (bên mua = công ty)
  xmlFolder = '';
  xmlReading = false;
  xmlInfo = '';
  xmlError = '';
  companyMst = '';
  /** MST đã nhập khác MST tự nhận từ XML */
  mstWarning = '';
  xmlSavedAt: number | null = null;
  /** bản XML lưu trên máy đọc trước 28/10/2026 — chưa có mã tra cứu → chọn lại thư mục */
  xmlNoLookup = false;
  private rawXml: XmlReadResult | null = null;

  // Đếm nhanh (25/10/2026): số email nhận trong kỳ ⇄ số HĐ XML, lệch thì so theo ngày
  counting = false;
  countResult: CountResult | null = null;
  countFetchedAt: number | null = null;
  countTruncated = false;
  /** email có trong hộp thư mà máy chủ đọc lỗi (không có trong kết quả → có thể báo lệch sai) */
  countUnread = 0;
  countError = '';
  /** bảng phụ dưới phần lệch: các cặp đã khớp / email gửi trùng */
  countView: '' | 'pairs' | 'dups' = '';
  readonly lagDays = LAG_DAYS;
  /** hộp thư hóa đơn (GMAIL_INVOICE_ACCOUNT) → link Gmail mở đúng tài khoản; chưa biết thì dùng /u/1/ như trước */
  gmailAccount = '';

  // Link HĐ gốc (Firestore invoice_lookups)
  saved: SavedLookup[] = [];
  savedLoading = false;
  savedError = '';
  saving = false;
  saveInfo = '';
  rows: InRow[] = [];
  q = '';
  kindFilter: '' | LinkKind | 'unknown' = '';
  page = 1;
  readonly pageSize = 50;
  copiedMsg = '';
  private copiedTimer: any = null;
  readonly gdtUrl = GDT_LOOKUP_URL;

  // Link tra cứu gán tay (Firestore invoice_lookup_portals)
  portals: LookupPortal[] = [];
  private portalMap = new Map<string, LookupPortal>();
  portalsError = '';
  showPortals = false;
  needLink: NeedLinkGroup[] = [];
  /** HĐ (khóa lookupKey) → email NCC đã ghép ở Đếm nhanh — mở email lấy link tra cứu */
  private pairEmail = new Map<string, CountEmail>();
  editRow: InRow | null = null;
  editScope: AssignScope = 'tcgp';
  editUrl = '';
  editName = '';
  editBusy = false;
  editError = '';

  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private lookups = inject(InvoiceLookupService);
  /** XML dùng chung với Đối soát CK → Chuyển khoản HĐ đầu vào */
  private source = inject(PurchaseInvoiceSourceService);
  readonly periodLabel = inject(PeriodService).label;
  /** việc đọc thư mục đang chạy nền (tiến độ lấy từ đây) */
  xmlJob: BgJob<CachedXml> | null = null;

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceServiceV2,
    private cacheService: AccountantCacheService,
    private periodService: PeriodService,
    private http: HttpClient
  ) {
    const period = this.periodService.period();
    this.filterForm = this.fb.group({ fromDate: [period.from], toDate: [period.to], gmailLabel: [''] });

    // Khoảng ngày luôn theo kỳ ở thanh chọn kỳ
    effect(() => {
      const p = this.periodService.period();
      const prev = this.filterForm.value;
      const changed = prev.fromDate !== p.from || prev.toDate !== p.to;
      this.filterForm.patchValue({ fromDate: p.from, toDate: p.to }, { emitEvent: false });
      if (changed) {
        console.log(`${LOG} Kỳ đổi → ${p.from} → ${p.to}: tải lại link HĐ gốc + Đếm nhanh đã lưu của kỳ này`);
        void this.loadSaved();
        this.countResult = null;
        this.pairEmail.clear();
        if (this.rawXml) void this.runQuickCount(false, true);
      }
    });
    effect(() => {
      const mst = this.companyService.mst();
      if (this.rawXml) {
        console.log(`${LOG} MST công ty đổi → ${mst || '(tự nhận)'}: lọc lại XML`);
        this.applyXml();
      }
    });
  }

  ngOnInit(): void {
    this.loadGmailLabels();
    this.authService.getGmailStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: s => this.gmailAccount = s.account || '',
      error: err => console.warn(`${LOG} Không lấy được hộp thư Gmail (${httpErrorText(err)}) → link Gmail dùng /u/1/`)
    });
    void this.loadSaved();
    void this.loadPortals();
    void this.restore();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.copiedTimer);
  }

  /** Mở lại trang: XML đã đọc lần trước + Đếm nhanh đã lưu của kỳ */
  private async restore(): Promise<void> {
    const running = this.source.runningXml();
    if (running) {
      console.log(`${LOG} Quay lại trang: đang đọc thư mục "${running.meta['folder']}" (chạy nền) → chờ tiếp`);
      await this.awaitXmlJob(running, true);
    } else {
      const c = await this.source.cachedXml();
      if (!c || this.rawXml || this.xmlReading) return;
      this.xmlFolder = c.data.folder;
      this.rawXml = c.data.result;
      this.xmlSavedAt = c.savedAt;
      this.applyXml();
      console.log(`${LOG} Dùng XML đã đọc lúc ${this.viTime(c.savedAt)} ("${this.xmlFolder}", ${this.xmlInvoices.length} HĐ)`);
    }
    if (this.xmlInvoices.length) await this.runQuickCount(false, true);
  }

  /** Chờ việc đọc thư mục chạy nền xong → dùng kết quả; `fresh` = vừa đọc thư mục → lưu link HĐ gốc lên máy chủ */
  private async awaitXmlJob(job: BgJob<CachedXml>, fresh: boolean): Promise<void> {
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
      this.xmlError = `Không đọc được thư mục XML: ${e?.message || e}`;
      this.xmlInvoices = [];
      this.rawXml = null;
    } finally {
      this.xmlReading = false;
      this.xmlJob = null;
    }
    if (fresh && this.xmlInvoices.length) await this.saveLinks();
  }

  viTime(ms: number | null): string {
    return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }

  viIsoTime(iso?: string): string {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) ? this.viTime(ms) : '';
  }

  /** Load Gmail labels from KeToanBackEnd — lọc Đếm nhanh theo NCC */
  async loadGmailLabels(): Promise<void> {
    this.loadingLabels = true;
    const cached = await this.cacheService.getCachedGmailLabels();
    if (cached && cached.length > 0) {
      this.gmailLabels = cached.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
      this.loadingLabels = false;
      console.log(`${LOG} Nhãn Gmail (bản lưu): ${this.gmailLabels.length}`);
      this.loadLabelMappings();
      return;
    }
    this.http.get<{success: boolean, labels: {id: string, name: string}[]}>(`${environment.ketoanBackendUrl}/api/gmail/labels`)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingLabels = false))
      .subscribe({
        next: (response) => {
          const allLabels = response.labels || [];
          this.gmailLabels = allLabels.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
          console.log(`${LOG} Nhãn Gmail: ${this.gmailLabels.length}`);
          this.cacheService.cacheGmailLabels(allLabels);
          this.loadLabelMappings();
        },
        error: (err) => console.warn(`${LOG} Không lấy được nhãn Gmail: ${httpErrorText(err)}`)
      });
  }

  /** Nhãn Gmail → MST NCC (so tên) — để Đếm nhanh lọc HĐ XML cùng NCC */
  loadLabelMappings(): void {
    this.invoiceService.getInternalSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers) => {
          this.labelMappings = this.gmailLabels.map(label => {
            const matched = suppliers.find(s =>
              s.name.toLowerCase().includes(label.displayName.toLowerCase()) ||
              label.displayName.toLowerCase().includes(s.name.toLowerCase())
            );
            return {
              labelId: label.id, labelName: label.name, displayName: label.displayName,
              supplierTaxCode: matched?.taxCode || '', supplierName: matched?.name || label.displayName
            };
          });
          console.log(`${LOG} Nhãn → MST NCC: ${this.labelMappings.filter(m => m.supplierTaxCode).length}/${this.labelMappings.length}`);
        },
        error: (err) => console.warn(`${LOG} Không ghép được nhãn Gmail với NCC: ${httpErrorText(err)}`)
      });
  }

  /** Chọn thư mục / file XML HĐ (app FDI) → đọc trong trình duyệt, giữ HĐ đầu vào (bên mua = MST công ty). */
  async onXmlSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    // chọn file ZIP / RAR (không phải thư mục) → không có webkitRelativePath: lấy tên file
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} file`);
    this.xmlError = '';
    this.xmlInfo = '';
    this.saveInfo = '';
    // chạy nền: đổi trang vẫn đọc tiếp, đọc xong ghi IndexedDB ngay trong việc
    await this.awaitXmlJob(this.source.startXml(files, folder), true);
  }

  /** Lọc HĐ đầu vào (bên mua = MST công ty — CompanyService, chưa nhập thì tự nhận) từ XML đã đọc */
  private applyXml(): void {
    const r = this.rawXml;
    if (!r) return;
    const detected = detectCompanyMst(r.invoices, 'buyer');
    const set = this.companyService.mst();
    this.companyMst = set || detected;
    this.mstWarning = set && detected && set !== detected
      ? `MST công ty đã nhập ${set} khác MST bên mua gặp nhiều nhất trong XML ${detected} — kiểm tra lại thư mục, hoặc bấm "MST" ở góc dưới để đổi.` : '';
    if (this.mstWarning) console.warn(`${LOG} ${this.mstWarning}`);
    const isIn = (i: LocalXmlInvoice) => !this.companyMst || i.nmmst === this.companyMst;
    this.xmlInvoices = r.invoices.filter(isIn);
    this.xmlNoLookup = this.xmlInvoices.length > 0 && this.xmlInvoices.every(i => !i.lookup);
    if (this.xmlNoLookup) console.warn(`${LOG} XML đã lưu trên máy đọc trước khi có mã tra cứu → cần chọn lại thư mục`);
    const out = r.invoices.length - this.xmlInvoices.length;
    const dates = this.xmlInvoices.map(i => i.tdlap).filter(Boolean).sort();
    this.xmlInfo = `${this.xmlInvoices.length} HĐ đầu vào`
      + (dates.length ? ` (ngày ${this.viDate(dates[0])} → ${this.viDate(dates[dates.length - 1])})` : '')
      + ` · MST công ty ${this.companyMst || '?'}${set ? '' : ' (tự nhận)'} · đọc ${r.nFiles} file XML`
      + (out ? ` · bỏ ${out} HĐ khác` : '') + (r.nNotInvoice ? ` · ${r.nNotInvoice} XML không phải HĐ` : '')
      + (r.nDuplicates ? ` · ${r.nDuplicates} trùng` : '') + (r.errors.length ? ` · ${r.errors.length} file lỗi` : '');
    this.xmlError = this.xmlInvoices.length ? '' : 'Không tìm thấy HĐ đầu vào nào của MST công ty trong thư mục đã chọn (cần file XML hóa đơn điện tử hoặc ZIP chứa XML).';
    this.buildRows();
  }

  // ===== LINK HĐ GỐC =====
  get savedRangeError(): string {
    const v = this.filterForm.value;
    if (!v.fromDate || !v.toDate || v.fromDate > v.toDate) return 'Chọn kỳ trên thanh chọn kỳ';
    const days = (Date.parse(v.toDate) - Date.parse(v.fromDate)) / 86400000 + 1;
    return days > MAX_SAVED_DAYS ? `Kỳ dài ${days} ngày — link HĐ gốc đã lưu chỉ đọc tối đa ${MAX_SAVED_DAYS} ngày, chọn Tháng hoặc Quý` : '';
  }

  /** Đọc link HĐ gốc đã lưu (Firestore) của kỳ */
  async loadSaved(): Promise<void> {
    const v = this.filterForm.value;
    this.savedError = this.savedRangeError;
    if (this.savedError) {
      console.warn(`${LOG} Không đọc link HĐ gốc đã lưu: ${this.savedError}`);
      this.saved = [];
      this.buildRows();
      return;
    }
    this.savedLoading = true;
    try {
      this.saved = await this.lookups.list('in', v.fromDate, v.toDate);
    } catch (e: any) {
      console.error(`${LOG} Đọc link HĐ gốc ${v.fromDate} → ${v.toDate} lỗi: ${httpErrorText(e)}`);
      this.savedError = `Không đọc được link HĐ gốc đã lưu: ${e?.error?.detail || httpErrorText(e)}`;
      this.saved = [];
    } finally {
      this.savedLoading = false;
    }
    this.buildRows();
  }

  /** Lưu mã / link tra cứu của MỌI HĐ đầu vào trong thư mục (không chỉ kỳ đang chọn) lên máy chủ */
  async saveLinks(): Promise<void> {
    if (!this.xmlInvoices.length) return;
    if (this.xmlNoLookup) {
      this.saveInfo = 'Bản XML trên máy chưa có mã tra cứu — chọn lại thư mục rồi mới lưu.';
      console.warn(`${LOG} ${this.saveInfo}`);
      return;
    }
    this.saving = true;
    this.saveInfo = '';
    try {
      const r = await this.lookups.save('in', this.xmlInvoices.map(fromXml));
      const withCode = this.xmlInvoices.filter(i => i.lookup?.code).length;
      this.saveInfo = `Đã lưu link HĐ gốc lên máy chủ: ${r.saved} HĐ (${withCode} có mã tra cứu)` + (r.skipped ? ` · bỏ ${r.skipped} HĐ thiếu dữ liệu` : '');
      await this.loadSaved();
    } catch (e: any) {
      console.error(`${LOG} Lưu link HĐ gốc lỗi: ${httpErrorText(e)}`);
      this.saveInfo = `Không lưu được link HĐ gốc lên máy chủ: ${e?.error?.detail || httpErrorText(e)} — danh sách vẫn xem được trên máy này.`;
    } finally {
      this.saving = false;
    }
  }

  /** Gộp XML trong kỳ + bản lưu máy chủ theo khóa MST bán | mẫu số + ký hiệu | số. XML ưu tiên (mới đọc), thiếu mã thì lấy mã đã lưu. */
  private buildRows(keepPage = false): void {
    const v = this.filterForm.value;
    const map = new Map<string, InRow>();
    for (const s of this.saved) {
      const k = lookupKey(s.seller_mst, s.template || '', s.series || '', s.number);
      map.set(k, this.row(k, {
        date: s.date, template: s.template || '', series: s.series || '', no: Number(s.number), sellerMst: s.seller_mst,
        sellerName: s.seller_name || '', beforeVat: s.total_before_vat || 0, vat: s.vat || 0, total: s.total || 0,
        tcgp: s.tcgp || '', provider: s.provider || '', code: s.code || '', codeField: s.code_field || '', url: s.url || '',
        direct: !!s.direct, inXml: false, saved: true, manualUrl: s.manual_url || '',
      }));
    }
    for (const i of this.xmlInvoices) {
      if ((v.fromDate && i.tdlap < v.fromDate) || (v.toDate && i.tdlap > v.toDate)) continue;
      const k = lookupKey(i.nbmst, i.khmshdon, i.khhdon, i.shdon);
      const old = map.get(k);
      // XML có mã / link → dùng của XML; không có (vd bản lưu máy cũ) → giữ mã đã lưu trên máy chủ
      const l = i.lookup && (i.lookup.code || i.lookup.url) ? i.lookup : null;
      map.set(k, this.row(k, {
        date: i.tdlap, template: i.khmshdon, series: i.khhdon, no: i.shdon, sellerMst: i.nbmst, sellerName: i.nbten,
        beforeVat: i.tgtcthue, vat: i.tgtthue, total: i.tgtttbso,
        tcgp: i.lookup?.tcgp || old?.tcgp || '', provider: i.lookup?.provider || old?.provider || '',
        code: l ? l.code : old?.code || '', codeField: l ? l.codeField : old?.codeField || '', url: l ? l.url : old?.baseUrl || '',
        direct: l ? l.direct : !!old?.baseDirect, inXml: true, saved: !!old, manualUrl: old?.manualUrl || '',
      }));
    }
    this.rows = [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.sellerName.localeCompare(b.sellerName) || b.no - a.no);
    this.needLink = this.groupNeedLink();
    if (!keepPage || this.page > this.pageCount) this.page = 1;
  }

  /**
   * Chọn link cho 1 HĐ: link riêng HĐ (dán tay) > link gán tay theo người bán > theo NCC HĐĐT > link XML / bảng NCC có sẵn.
   * Link gán tay không đè link MỞ THẲNG có sẵn (MISA).
   */
  private row(key: string, x: Omit<InRow, 'key' | 'kind' | 'assigned' | 'baseUrl' | 'baseDirect'> & { direct: boolean }): InRow {
    const { direct, ...rest } = x;
    let url = x.url, isDirect = direct && !!x.url, provider = x.provider, assigned: InRow['assigned'] = '';
    const byTcgp = x.tcgp ? this.portalMap.get(`tcgp-${x.tcgp}`) : undefined;
    const p = this.portalMap.get(`seller-${x.sellerMst}`) || byTcgp;
    if (x.manualUrl) {
      url = x.manualUrl;
      isDirect = true;
      assigned = 'invoice';
    } else if (p && !isDirect) {
      ({ url, direct: isDirect } = applyPortal(p, x.code));
      assigned = p.scope;
    }
    if (!provider && byTcgp?.name) provider = byTcgp.name;
    const kind: LinkKind = isDirect && url ? 'direct' : url ? 'portal' : 'gdt';
    return { key, ...rest, provider, url, kind, assigned, baseUrl: x.url, baseDirect: direct };
  }

  /** HĐ chỉ tra được ở CQT, gom nhóm: có mã → theo NCC HĐĐT (1 link mẫu cho mọi người bán dùng NCC đó); không mã → theo người bán */
  private groupNeedLink(): NeedLinkGroup[] {
    const g = new Map<string, NeedLinkGroup>();
    for (const r of this.rows) {
      if (r.kind !== 'gdt') continue;
      const byTcgp = !!(r.code && r.tcgp);
      const id = byTcgp ? `tcgp-${r.tcgp}` : `seller-${r.sellerMst}`;
      const cur = g.get(id);
      if (cur) cur.n++;
      else g.set(id, { id, n: 1, withCode: byTcgp, sample: r,
        label: byTcgp ? (r.provider || `NCC HĐĐT ${r.tcgp}`) : (r.sellerName || r.sellerMst) });
    }
    return [...g.values()].sort((a, b) => Number(b.withCode) - Number(a.withCode) || b.n - a.n || a.label.localeCompare(b.label));
  }

  // ===== LINK TRA CỨU GÁN TAY =====
  async loadPortals(): Promise<void> {
    this.portalsError = '';
    try {
      this.portals = (await this.lookups.listPortals()).sort((a, b) => (a.name || a.mst).localeCompare(b.name || b.mst));
    } catch (e: any) {
      console.error(`${LOG} Đọc link tra cứu gán tay lỗi: ${httpErrorText(e)}`);
      this.portalsError = `Không đọc được link tra cứu đã gán: ${e?.error?.detail || httpErrorText(e)}`;
      this.portals = [];
    }
    this.portalMap = new Map(this.portals.map(p => [p.id, p]));
    this.buildRows(true);
  }

  /** email NCC đã ghép với HĐ này ở Đếm nhanh (chưa đếm → null) */
  emailOf(r: InRow): CountEmail | null {
    return this.pairEmail.get(r.key) || null;
  }

  openEdit(r: InRow): void {
    this.editRow = r;
    this.editError = '';
    const p = r.assigned === 'tcgp' ? this.portalMap.get(`tcgp-${r.tcgp}`) : r.assigned === 'seller' ? this.portalMap.get(`seller-${r.sellerMst}`) : undefined;
    this.editScope = r.assigned || (r.code && r.tcgp ? 'tcgp' : 'seller');
    this.editUrl = r.assigned === 'invoice' ? r.manualUrl : p?.url || '';
    this.editName = p?.name || '';
    console.info(`${LOG} Mở gán link ${r.template}${r.series}-${r.no} (${r.sellerMst}, NCC HĐĐT ${r.tcgp || '?'}, ${r.code ? 'có mã' : 'không mã'})`);
  }

  closeEdit(): void {
    if (!this.editBusy) this.editRow = null;
  }

  /** Số HĐ trong kỳ chịu ảnh hưởng nếu gán theo phạm vi */
  scopeCount(scope: AssignScope): number {
    const r = this.editRow;
    if (!r) return 0;
    if (scope === 'invoice') return 1;
    return this.rows.filter(x => scope === 'tcgp' ? x.tcgp === r.tcgp : x.sellerMst === r.sellerMst).length;
  }

  /** Xem trước kết quả gán: link sẽ lưu + giải thích; `error` chặn lưu, `warn` chỉ nhắc */
  get editPlan(): { url: string; direct: boolean; note: string; warn: string; error: string } {
    const r = this.editRow, u = this.editUrl.trim();
    const out = { url: u, direct: false, note: '', warn: '', error: '' };
    if (!r) return out;
    if (!u) return { ...out, error: 'Dán link tra cứu (từ email NCC hoặc trang tra cứu của NCC).' };
    if (!isHttpUrl(u)) return { ...out, error: 'Link phải bắt đầu bằng http:// hoặc https://, không có khoảng trắng.' };
    if (this.editScope === 'invoice') {
      return { ...out, direct: true, note: 'Chỉ HĐ này: nút "Mở HĐ gốc" mở thẳng link này.',
        error: r.saved ? '' : 'HĐ này chưa lưu lên máy chủ — bấm "Lưu lên máy chủ" trước.' };
    }
    const who = this.editScope === 'tcgp' ? `dùng NCC HĐĐT ${r.provider || r.tcgp}` : `của ${r.sellerName || r.sellerMst}`;
    const tpl = linkTemplate(u, r.code);
    if (tpl) {
      return { ...out, url: tpl, direct: true,
        note: `Thấy mã tra cứu ${r.code} trong link → mọi HĐ ${who} có mã sẽ MỞ THẲNG HĐ gốc (link mẫu: ${tpl}).` };
    }
    const warn = looksInvoiceSpecific(u)
      ? 'Link có vẻ là link riêng của 1 HĐ (có mã trong link nhưng không phải mã tra cứu trong XML) — dùng chung sẽ mở sai HĐ. '
        + 'Chọn "Chỉ HĐ này", hoặc dán link trang tra cứu chung của NCC.'
      : '';
    return { ...out, warn,
      note: `Mọi HĐ ${who} sẽ có nút "Tra cứu NCC"${r.code ? ' (bấm là chép sẵn mã tra cứu để dán)' : ' — XML không có mã, lấy mã trong email NCC'}.` };
  }

  async saveEdit(): Promise<void> {
    const r = this.editRow, plan = this.editPlan, scope = this.editScope;
    if (!r || plan.error || this.editBusy) return;
    this.editBusy = true;
    this.editError = '';
    try {
      if (scope === 'invoice') {
        await this.lookups.setManualUrl('in', { seller_mst: r.sellerMst, template: r.template, series: r.series, number: r.no }, plan.url);
        this.setSavedManual(r, plan.url);
        this.buildRows(true);
      } else {
        await this.lookups.savePortal(scope, scope === 'tcgp' ? r.tcgp : r.sellerMst, this.editName.trim(), plan.url);
        await this.loadPortals();
      }
      this.flash(`Đã gán link tra cứu ${this.scopeLabel(scope)} — ${this.scopeCount(scope)} HĐ trong kỳ được cập nhật`);
      this.editRow = null;
    } catch (e: any) {
      console.error(`${LOG} Gán link tra cứu ${scope} lỗi: ${httpErrorText(e)}`);
      this.editError = `Không lưu được: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.editBusy = false;
    }
  }

  /** Bỏ link gán tay đang áp cho HĐ (theo phạm vi của nó) */
  async removeAssigned(r: InRow): Promise<void> {
    const scope = r.assigned;
    if (!scope || this.editBusy || !confirm(`Bỏ link tra cứu đã gán ${this.scopeLabel(scope)}?`)) return;
    this.editBusy = true;
    this.editError = '';
    try {
      if (scope === 'invoice') {
        await this.lookups.setManualUrl('in', { seller_mst: r.sellerMst, template: r.template, series: r.series, number: r.no }, '');
        this.setSavedManual(r, '');
        this.buildRows(true);
      } else {
        await this.lookups.deletePortal(scope, scope === 'tcgp' ? r.tcgp : r.sellerMst);
        await this.loadPortals();
      }
      this.editRow = null;
    } catch (e: any) {
      console.error(`${LOG} Bỏ link gán ${scope} lỗi: ${httpErrorText(e)}`);
      this.editError = `Không bỏ được: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.editBusy = false;
    }
  }

  async deletePortal(p: LookupPortal): Promise<void> {
    if (!confirm(`Xóa link tra cứu gán cho ${p.name || p.mst}?`)) return;
    try {
      await this.lookups.deletePortal(p.scope, p.mst);
      await this.loadPortals();
    } catch (e: any) {
      console.error(`${LOG} Xóa link tra cứu ${p.id} lỗi: ${httpErrorText(e)}`);
      this.portalsError = `Không xóa được: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  scopeLabel(s: AssignScope): string {
    return s === 'tcgp' ? 'theo NCC HĐĐT' : s === 'seller' ? 'theo người bán' : 'riêng HĐ này';
  }

  private setSavedManual(r: InRow, url: string): void {
    const s = this.saved.find(x => lookupKey(x.seller_mst, x.template || '', x.series || '', x.number) === r.key);
    if (s) s.manual_url = url;
  }

  get counts() {
    const c = { all: this.rows.length, direct: 0, portal: 0, gdt: 0, unknown: 0, withCode: 0, saved: 0 };
    for (const r of this.rows) {
      c[r.kind]++;
      if (r.code) c.withCode++;
      if (!r.provider) c.unknown++;
      if (r.saved) c.saved++;
    }
    return c;
  }

  get filteredRows(): InRow[] {
    let rows = this.rows;
    if (this.kindFilter === 'unknown') rows = rows.filter(r => !r.provider);
    else if (this.kindFilter) rows = rows.filter(r => r.kind === this.kindFilter);
    const q = this.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => `${r.no} ${r.template}${r.series} ${r.sellerMst} ${r.sellerName} ${r.provider} ${r.tcgp}`.toLowerCase().includes(q));
    return rows;
  }

  get pageRows(): InRow[] {
    const s = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(s, s + this.pageSize);
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)); }

  setKind(k: '' | LinkKind | 'unknown'): void {
    this.kindFilter = k;
    this.page = 1;
  }

  /** Link của nút HĐ gốc: mở thẳng / trang tra cứu NCC / cổng CQT */
  linkOf(r: InRow): string {
    return r.url || this.gdtUrl;
  }

  /** Bấm nút HĐ gốc (thẻ <a> tự mở tab): link không mở thẳng → chép mã (hoặc thông tin tra cứu CQT) để dán vào trang tra cứu */
  onOpenLink(r: InRow): void {
    const what = r.kind === 'direct' ? 'mở thẳng' : r.kind === 'portal' ? `trang tra cứu ${r.provider || r.url}` : 'cổng CQT';
    console.info(`${LOG} Mở HĐ gốc ${r.template}${r.series}-${r.no} (${r.sellerMst}): ${what}${r.assigned ? ' · link gán tay ' + r.assigned : ''}`);
    if (r.kind === 'portal' && r.code) void this.copy(r.code, `Đã chép mã tra cứu ${r.code} — dán vào trang tra cứu (MST bán ${r.sellerMst})`);
    if (r.kind === 'portal' && !r.code) this.flash('XML không có mã tra cứu — lấy mã trong email NCC gửi HĐ này');
    if (r.kind === 'gdt') void this.copy(gdtLookupText({ seller_mst: r.sellerMst, template: r.template, series: r.series, number: r.no, vat: r.vat, total: r.total }),
      'Đã chép MST bán / ký hiệu / số / tiền — dán vào trang tra cứu HĐ của cổng CQT');
  }

  async copy(text: string, msg = `Đã chép ${text}`): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedMsg = msg;
    } catch (e: any) {
      console.warn(`${LOG} Không chép được vào clipboard: ${e?.message || e}`);
      this.copiedMsg = `Không chép tự động được — tự chép: ${text}`;
    }
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copiedMsg = '', 6000);
  }

  private flash(msg: string): void {
    this.copiedMsg = msg;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copiedMsg = '', 6000);
  }

  kindLabel(r: InRow): string {
    return r.kind === 'direct' ? 'Mở HĐ gốc' : r.kind === 'portal' ? 'Tra cứu NCC' : 'Tra cứu CQT';
  }

  kindTitle(r: InRow): string {
    if (r.assigned === 'invoice') return 'Mở link riêng HĐ này (kế toán đã dán)';
    if (r.kind === 'direct') return `Mở thẳng HĐ trên ${r.provider || r.url}${r.assigned ? ' (link gán tay ' + this.scopeLabel(r.assigned) + ')' : ''}`;
    if (r.kind === 'portal') return `Mở trang tra cứu${r.provider ? ' ' + r.provider : ''} và chép mã ${r.code} (dán vào ô mã tra cứu)`;
    return `${r.provider ? r.provider + ' không ghi' : 'XML không có'} mã tra cứu → mở cổng CQT, chép sẵn MST bán / ký hiệu / số / tiền`;
  }

  /** CSV (dấu ; · UTF-8 BOM) theo bộ lọc đang chọn */
  exportCsv(): void {
    const cell = (v: string | number | null | undefined) => {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Ngày', 'Ký hiệu', 'Số', 'MST bán', 'Người bán', 'Chưa thuế', 'Thuế', 'Tổng TT', 'NCC HĐĐT', 'MST NCC HĐĐT', 'Mã tra cứu', 'Link tra cứu'];
    const lines = [head.join(';'), ...this.filteredRows.map(r => [this.viDate(r.date), `${r.template}${r.series}`, r.no, r.sellerMst,
      r.sellerName, r.beforeVat, r.vat, r.total, r.provider, r.tcgp, r.code, this.linkOf(r)].map(cell).join(';'))];
    const v = this.filterForm.value;
    const name = `hd-dau-vao-link-goc_${v.fromDate}_${v.toDate}.csv`;
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`${LOG} Xuất ${name} (${this.filteredRows.length} dòng)`);
  }

  // ===== ĐẾM NHANH =====
  /** `force` = đếm lại từ Gmail; `cacheOnly` (mở lại trang / đổi kỳ) = chỉ dùng bản đã lưu hoặc việc đang chạy */
  async runQuickCount(force = false, cacheOnly = false): Promise<void> {
    if (!this.xmlInvoices.length) {
      if (!cacheOnly) this.xmlError = 'Chọn thư mục XML hóa đơn đầu vào (app FDI tải về) trước khi đếm.';
      return;
    }
    const v = this.filterForm.value;
    const labelId = v.gmailLabel ? this.gmailLabels.find(l => l.name === v.gmailLabel)?.id : undefined;
    // lấy email tới hết ngày cuối kỳ + LAG_DAYS: NCC gửi trễ (HĐ 31/10, email 01/11) vẫn ghép được
    const p = { label: v.gmailLabel, labelId, from: v.fromDate, to: countFetchTo(v.toDate) };
    let job = this.source.runningGmailCount();
    if (job && (job.meta['from'] !== p.from || job.meta['to'] !== p.to || job.meta['label'] !== p.label)) job = undefined;
    if (!job) {
      const c = force ? null : await this.source.cachedGmailCount(p);
      if (c) {
        this.countFetchedAt = c.savedAt;
        this.buildCount(c.data);
        return;
      }
      if (cacheOnly) return;
      job = this.source.startGmailCount(p);
    } else if (cacheOnly) {
      console.log(`${LOG} Quay lại trang: đang đếm email ${p.from} → ${p.to} (chạy nền) → chờ tiếp`);
    }
    this.counting = true;
    this.countError = '';
    try {
      const data = await job.promise;
      this.countFetchedAt = Date.now();
      this.buildCount(data);
    } catch (e: any) {
      console.error(`${LOG} Đếm email lỗi: ${httpErrorText(e)}`);
      this.countError = `Không đếm được email Gmail: ${e?.error?.detail || e?.error?.error || e?.message || e}`;
    } finally {
      this.counting = false;
    }
  }

  private buildCount(d: GmailCount): void {
    const v = this.filterForm.value;
    const mst = this.labelMappings.find(m => m.labelName === v.gmailLabel)?.supplierTaxCode || '';
    const invoices = this.xmlInvoices
      .filter(i => !mst || this._normalizeTaxCode(i.nbmst) === this._normalizeTaxCode(mst))
      .map(i => ({ date: i.tdlap, no: String(i.shdon), symbol: `${i.khmshdon}${i.khhdon}`, seller: i.nbten, sellerMst: i.nbmst, total: i.tgtttbso }));
    this.countResult = compareCounts(invoices, d.emails, v.fromDate, v.toDate);
    this.countTruncated = d.truncated;
    this.countUnread = Math.max(0, (d.listed || 0) - d.emails.length);
    if (this.countUnread) console.warn(`${LOG} ${this.countUnread} email máy chủ đọc lỗi — kết quả có thể thiếu, bấm "Đếm lại email"`);
    const r = this.countResult;
    this.pairEmail = new Map(r.pairs.map(p => [lookupKey(p.invoice.sellerMst, '', p.invoice.symbol, p.invoice.no), p.email]));
    console.log(`${LOG} Đếm nhanh ${v.fromDate} → ${v.toDate}: ${r.email} email ⇄ ${r.xml} HĐ XML → ${r.ok ? 'khớp' : 'lệch'}; `
      + `${r.byKey}/${r.pairs.length} cặp theo khóa HĐ, ${r.xmlOnly.length} HĐ chưa thấy email, ${r.emailOnly.length} email không khớp, `
      + `${r.duplicates.length} gửi trùng, ${r.late} gửi trễ, ${r.afterPeriod} nhận sau kỳ, ${r.prevPeriod} của HĐ kỳ trước, ${r.noKey} email không có khóa HĐ`);
  }

  /** HĐ chưa có email gom theo NCC (nhiều nhất trước) — nhìn nhanh NCC nào chưa gửi */
  get missBySeller(): { seller: string; n: number }[] {
    const m = new Map<string, number>();
    for (const i of this.countResult?.xmlOnly || []) m.set(i.seller, (m.get(i.seller) || 0) + 1);
    return [...m.entries()].map(([seller, n]) => ({ seller, n })).sort((a, b) => b.n - a.n || a.seller.localeCompare(b.seller));
  }

  setCountView(v: '' | 'pairs' | 'dups'): void {
    this.countView = this.countView === v ? '' : v;
  }

  // Đang chạy = cờ của trang HOẶC việc nền còn chạy (25/10/2026): quay lại trang thấy loading NGAY, không đợi đọc xong bản XML đã lưu
  get xmlBusy(): boolean { return this.xmlReading || !!this.source.runningXml(); }
  get countBusy(): boolean { return this.counting || !!this.source.runningGmailCount(); }
  get xmlProgressText(): string { return (this.xmlJob || this.source.runningXml())?.progress || ''; }

  /** `/mail/u/<email>/` (email trong path) → Gmail "Temporary Error (404)" (28/10/2026) → chọn hộp thư bằng `?authuser=<email>` */
  private gmailBase(): string {
    return this.gmailAccount
      ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(this.gmailAccount)}`
      : 'https://mail.google.com/mail/u/1/';
  }

  /** Link mở 1 email (thẻ <a> → bấm giữa / Ctrl+bấm mở tab mới được, không bị chặn popup) */
  countEmailUrl(e: CountEmail): string {
    return `${this.gmailBase()}#all/${e.thread_id || e.id}`;
  }

  logOpenGmail(what: string): void {
    console.info(`${LOG} Mở Gmail: ${what}`);
  }

  private _normalizeTaxCode(taxCode: string): string {
    if (!taxCode) return '';
    return taxCode.replace(/-\d+$/, '').trim();
  }

  /** "28/10 09:15" — giờ Gmail nhận (`at` ISO giờ VN) */
  viMailTime(at: string): string {
    return `${at.slice(8, 10)}/${at.slice(5, 7)} ${at.slice(11, 16)}`;
  }

  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN');
  }
}
