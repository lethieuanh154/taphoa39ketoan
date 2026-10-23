/**
 * LEDGER 8 - KIỂM TRA SỐ LƯỢNG HÓA ĐƠN ĐẦU VÀO (Tiện ích → Kiểm tra số lượng hóa đơn)
 * So sánh Gmail (HĐ NCC gửi qua email) vs danh sách HĐ trong thư mục XML trên máy (app FDI tải từ cổng thuế).
 * 23/10/2026: bỏ nguồn GDT (cổng thuế chặn tự động hóa) → đọc XML trong trình duyệt (utils/invoice-xml.util.ts), không upload.
 * 23/10/2026 chiều: khoảng ngày = KỲ ở thanh chọn kỳ (bỏ ô Từ / Đến ở cả 2 tab — trùng, dễ lệch với kỳ). Đọc XML + lấy Gmail chạy
 * NỀN (BackgroundJobService) → chuyển trang không dừng; quay lại thấy tiến độ (khung log) / kết quả.
 */

import { Component, OnInit, OnDestroy, HostListener, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import {
  InvoiceServiceV2,
  Invoice,
  InvoiceFilter,
  Pagination,
  FieldDiff,
  PortalLink,
  LiveReconcileRow
} from '../invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';
import { PeriodService } from '../../../services/period.service';
import { CompanyService } from '../../../services/company.service';
import { BgJob } from '../../../services/background-job.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst } from '../../../utils/invoice-xml.util';
import { CachedXml, PurchaseInvoiceSourceService } from '../../../services/purchase-invoice-source.service';
import { environment } from '../../../../environments/environment';
import { TableLoadingComponent } from '../../shared/table-loading/table-loading.component';

const LOG = '[InvoiceCountIn]';
/** XML đã đọc + link Gmail đã lấy (IndexedDB, PurchaseInvoiceSourceService) → mở lại trang không phải chọn / tải lại */


@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TableLoadingComponent],
  templateUrl: './ledger-8-dong-bo-hoa-don-v2.component.html',
  styleUrls: ['./ledger-8-dong-bo-hoa-don-v2.component.css']
})
export class Ledger8DongBoHoaDonV2Component implements OnInit, OnDestroy {
  filterForm: FormGroup;

  // Gmail labels for supplier filter
  gmailLabels: {id: string, name: string, displayName: string}[] = [];
  labelMappings: {labelId: string, labelName: string, displayName: string, supplierTaxCode: string, supplierName: string}[] = [];

  // Loading states
  loadingLabels = false;

  // Current filter
  currentFilter: InvoiceFilter = {};

  private destroy$ = new Subject<void>();

  // === Main Tabs ===
  activeMainTab: 'reconcile' | 'portal' = 'reconcile';

  // === Portal Links Tab ===
  portalLinks: Invoice[] = [];
  portalLinksFiltered: Invoice[] = [];
  loadingPortalLinks = false;
  portalLinksPagination: Pagination = {
    hasNext: false, hasPrev: false, firstDocId: null, lastDocId: null, pageSize: 50, count: 0
  };
  portalLinksCurrentFilter: InvoiceFilter = {};
  portalLinksLabelId = '';
  portalLinksLabelSearch = '';
  labelDropdownOpen = false;
  portalLinksFromDate = new Date().toISOString().split('T')[0];
  portalLinksToDate = new Date().toISOString().split('T')[0];
  portalLinksSearchNo = '';

  // === Live Reconciliation (Gmail vs GDT) ===
  liveReconciling = false;
  liveResults: LiveReconcileRow[] = [];
  liveSummary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0, noInvoiceNo: 0, dupEmails: 0 };
  liveGmailCount = 0;
  liveGdtCount = 0;
  liveSaving = false;
  liveSaved = false;
  liveStatusLog: string[] = [];

  // === Danh sách HĐ từ thư mục XML trên máy (thay GDT) ===
  xmlInvoices: LocalXmlInvoice[] = [];   // HĐ đầu vào (bên mua = công ty)
  xmlFolder = '';
  xmlReading = false;
  xmlInfo = '';
  xmlError = '';
  companyMst = '';
  /** MST đã nhập khác MST tự nhận từ XML */
  mstWarning = '';
  xmlSavedAt: number | null = null;
  private rawXml: XmlReadResult | null = null;
  /** thời điểm lấy link Gmail của kết quả đang xem */
  gmailFetchedAt: number | null = null;

  private companyService = inject(CompanyService);
  /** XML + Gmail dùng chung với Đối soát CK → Chuyển khoản HĐ đầu vào */
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
    // Kỳ mặc định theo thanh chọn kỳ (PeriodService)
    const period = this.periodService.period();

    this.filterForm = this.fb.group({
      fromDate: [period.from],
      toDate: [period.to],
      gmailLabel: [''],
      pageSize: [25]
    });

    // Khoảng ngày luôn theo kỳ ở thanh chọn kỳ (cả tab Đối chiếu lẫn tab Links HĐ gốc)
    effect(() => {
      const p = this.periodService.period();
      const prev = this.filterForm.value;
      const changed = prev.fromDate !== p.from || prev.toDate !== p.to;
      this.filterForm.patchValue({ fromDate: p.from, toDate: p.to }, { emitEvent: false });
      this.portalLinksFromDate = p.from;
      this.portalLinksToDate = p.to;
      if (changed && this.rawXml && !this.liveReconciling) {
        console.log(`${LOG} Kỳ đổi → ${p.from} → ${p.to}: hiện kết quả đã lưu của kỳ này (nếu có)`);
        this.liveResults = [];
        this.liveStatusLog = [];
        void this.runLiveReconciliation(false, true);
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
    void this.restore();
  }

  /** Mở lại trang: XML đã đọc lần trước; có link Gmail đã lấy cho bộ lọc đang chọn → đối chiếu ngay từ bản lưu */
  private async restore(): Promise<void> {
    const running = this.source.runningXml();
    if (running) {
      console.log(`${LOG} Quay lại trang: đang đọc thư mục "${running.meta['folder']}" (chạy nền) → chờ tiếp`);
      await this.awaitXmlJob(running);
    } else {
      const c = await this.source.cachedXml();
      if (!c || this.rawXml || this.xmlReading) return;
      this.xmlFolder = c.data.folder;
      this.rawXml = c.data.result;
      this.xmlSavedAt = c.savedAt;
      this.applyXml();
      console.log(`${LOG} Dùng XML đã đọc lúc ${this.viTime(c.savedAt)} ("${this.xmlFolder}", ${this.xmlInvoices.length} HĐ)`);
    }
    if (!this.xmlInvoices.length) return;
    const gmail = this.source.runningGmail();
    if (gmail) {
      console.log(`${LOG} Quay lại trang: đang lấy Gmail ${gmail.meta['from']} → ${gmail.meta['to']} (chạy nền) → chờ tiếp`);
      this.liveReconciling = true;
      this.liveStatusLog = gmail.log;
      await gmail.promise.catch(() => null);
      this.liveReconciling = false;
    }
    await this.runLiveReconciliation(false, true);
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
      this.xmlError = `Không đọc được thư mục XML: ${e?.message || e}`;
      this.xmlInvoices = [];
      this.rawXml = null;
    } finally {
      this.xmlReading = false;
      this.xmlJob = null;
    }
  }

  viTime(ms: number | null): string {
    return ms ? new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================================================
  // FILTER METHODS
  // ==========================================================================

  applyFilter(): void {
    const values = this.filterForm.value;
    const baseFilter: InvoiceFilter = { pageSize: values.pageSize };
    if (values.fromDate) baseFilter.fromDate = values.fromDate;
    if (values.toDate) baseFilter.toDate = values.toDate;
    if (values.gmailLabel) {
      const mapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
      if (mapping?.supplierTaxCode) {
        baseFilter.supplierTaxCode = mapping.supplierTaxCode;
      }
    }
    this.currentFilter = baseFilter;
  }

  /**
   * Load Gmail labels from KeToanBackEnd for supplier filter
   */
  async loadGmailLabels(): Promise<void> {
    this.loadingLabels = true;

    // Try IndexedDB cache first (24h expiry)
    const cached = await this.cacheService.getCachedGmailLabels();
    if (cached && cached.length > 0) {
      this.gmailLabels = cached.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
      this.loadingLabels = false;
      console.log('📦 Gmail labels from cache:', this.gmailLabels.length);
      this.loadLabelMappings();
      return;
    }

    // Cache miss → call API
    const gmailUid = localStorage.getItem('gmail_uid');
    const url = `${environment.ketoanBackendUrl}/api/gmail/labels${gmailUid ? '?uid=' + gmailUid : ''}`;
    console.log('🏷️ loadGmailLabels() → API', url);
    this.http.get<{success: boolean, labels: {id: string, name: string}[]}>(url)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingLabels = false))
      .subscribe({
        next: (response) => {
          const allLabels = response.labels || [];
          this.gmailLabels = allLabels.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
          console.log('✅ Gmail labels from API:', this.gmailLabels.length);
          this.cacheService.cacheGmailLabels(allLabels);
          this.loadLabelMappings();
        },
        error: (err) => console.error('❌ loadGmailLabels error:', err)
      });
  }

  /**
   * Build label → supplierTaxCode mappings via name matching
   */
  loadLabelMappings(): void {
    console.log('🔗 loadLabelMappings() — matching', this.gmailLabels.length, 'labels to suppliers');
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
              labelId: label.id,
              labelName: label.name,
              displayName: label.displayName,
              supplierTaxCode: matched?.taxCode || '',
              supplierName: matched?.name || label.displayName
            };
          });
          const mapped = this.labelMappings.filter(m => m.supplierTaxCode).length;
          console.log(`✅ labelMappings built: ${this.labelMappings.length} labels, ${mapped} matched to taxCode`);
        },
        error: (err) => console.error('❌ loadLabelMappings error:', err)
      });
  }

  formatDiffValue(diff: FieldDiff): string {
    if (diff.diffType === 'number') {
      if (typeof diff.diff === 'number') {
        const prefix = diff.diff > 0 ? '+' : '';
        return prefix + this.formatCurrency(diff.diff);
      }
    }
    return String(diff.diff || '');
  }

  // ==========================================================================
  // PORTAL & PROVIDER METHODS
  // ==========================================================================

  /**
   * Open portal URL in new tab to view original invoice
   */
  openPortalUrl(invoice: Invoice): void {
    if (invoice.portalUrl) {
      window.open(invoice.portalUrl, '_blank');
    }
  }

  openGmailMessage(invoice: Invoice): void {
    const threadId = (invoice as any).gmailThreadId || (invoice as any).gmailMessageId;
    console.log('[openGmailMessage]', { threadId, gmailThreadId: (invoice as any).gmailThreadId, gmailMessageId: (invoice as any).gmailMessageId, invoice });
    if (threadId) {
      const url = `https://mail.google.com/mail/u/1/#all/${threadId}`;
      console.log('[openGmailMessage] Opening:', url);
      window.open(url, '_blank');
    }
  }

  get filteredGmailLabels() {
    if (!this.portalLinksLabelSearch.trim()) return this.gmailLabels;
    const q = this.portalLinksLabelSearch.toLowerCase();
    return this.gmailLabels.filter(l => l.displayName.toLowerCase().includes(q));
  }

  @HostListener('document:click')
  closeLabelDropdown() {
    this.labelDropdownOpen = false;
  }

  onLabelTriggerClick(e: Event) {
    e.stopPropagation();
    this.labelDropdownOpen = !this.labelDropdownOpen;
    if (this.labelDropdownOpen) this.portalLinksLabelSearch = '';
  }

  selectPortalLabel(id: string) {
    this.portalLinksLabelId = id;
    this.labelDropdownOpen = false;
  }

  getSelectedLabelName(): string {
    if (!this.portalLinksLabelId) return '';
    return this.gmailLabels.find(l => l.id === this.portalLinksLabelId)?.displayName || '';
  }

  getProviderClass(provider: string): string {
    const classes: Record<string, string> = {
      'VIETTEL': 'provider-viettel',
      'VNPT': 'provider-vnpt',
      'MISA': 'provider-misa',
      'VIN_HOADON': 'provider-vinhoadon',
      'KIOTVIET': 'provider-kiotviet',
      'MOBIFONE': 'provider-mobifone',
      'EINVOICE': 'provider-einvoice',
      'EHOADON': 'provider-ehoadon',
      'ASIAINVOICE': 'provider-asiainvoice',
      'MINVOICE': 'provider-minvoice',
      'WININVOICE': 'provider-wininvoice'
    };
    return classes[provider] || 'provider-default';
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  formatCurrency(amount: number | undefined): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(dateStr: string | undefined): string {
    return this.invoiceService.formatDate(dateStr);
  }

  /**
   * Reset filter to default
   */
  resetFilter(): void {
    const period = this.periodService.period();
    console.log(`${LOG} Đặt lại bộ lọc → kỳ ${period.from} → ${period.to}`);
    this.filterForm.reset({ fromDate: period.from, toDate: period.to, gmailLabel: '', pageSize: 25 });
    this.applyFilter();
  }

  /** Chọn thư mục / file XML HĐ (app FDI) → đọc trong trình duyệt, giữ HĐ đầu vào (bên mua = MST công ty). */
  async onXmlSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || `${files.length} file`;
    this.xmlError = '';
    this.xmlInfo = '';
    // chạy nền: đổi trang vẫn đọc tiếp, đọc xong ghi IndexedDB ngay trong việc
    await this.awaitXmlJob(this.source.startXml(files, folder));
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
    const out = r.invoices.length - this.xmlInvoices.length;
    const dates = this.xmlInvoices.map(i => i.tdlap).filter(Boolean).sort();
    this.xmlInfo = `${this.xmlInvoices.length} HĐ đầu vào`
      + (dates.length ? ` (ngày ${this.formatGdtDate(dates[0])} → ${this.formatGdtDate(dates[dates.length - 1])})` : '')
      + ` · MST công ty ${this.companyMst || '?'}${set ? '' : ' (tự nhận)'} · đọc ${r.nFiles} file XML`
      + (out ? ` · bỏ ${out} HĐ khác` : '') + (r.nNotInvoice ? ` · ${r.nNotInvoice} XML không phải HĐ` : '')
      + (r.nDuplicates ? ` · ${r.nDuplicates} trùng` : '') + (r.errors.length ? ` · ${r.errors.length} file lỗi` : '');
    this.xmlError = this.xmlInvoices.length ? '' : 'Không tìm thấy HĐ đầu vào nào của MST công ty trong thư mục đã chọn (cần file XML hóa đơn điện tử hoặc ZIP chứa XML).';
  }

  /**
   * Force reload data (bỏ qua cache)
   * Dùng cho nút "Tải lại"
   */
  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading data...');
    await this.cacheService.clearAllCache();
    this.applyFilter();
    this.loadGmailLabels();
  }

  async forceReloadReconcile(): Promise<void> {
    console.log('🔄 Force reloading reconcile...');
    await this.cacheService.clearAllCache();
    this.loadGmailLabels();
    await this.runLiveReconciliation(true);
  }

  switchMainTab(tab: 'reconcile' | 'portal'): void {
    this.activeMainTab = tab;
  }

  // ==========================================================================
  // PORTAL LINKS TAB
  // ==========================================================================

  loadPortalLinks(): void {
    this.loadingPortalLinks = true;

    const gmailUid = localStorage.getItem('gmail_uid') || '';

    // Calculate days_back from date filters
    let daysBack = 30;
    if (this.portalLinksFromDate) {
      const from = new Date(this.portalLinksFromDate);
      const now = new Date();
      daysBack = Math.max(1, Math.ceil((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    const params = {
      uid: gmailUid,
      labelId: this.portalLinksLabelId || undefined,
      daysBack,
      pageSize: 50,
    };

    console.log('🔗 loadPortalLinks() → Gmail direct', params);

    this.invoiceService.getPortalLinksFromGmail(params)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (response) => {
          console.log('🔗 [PortalLinks] Gmail returned:', {
            total: response.total,
            withPortalUrl: response.portalLinks.filter(p => p.portalUrl).length,
            withCredentials: response.portalLinks.filter(p => p.portalCredentials && Object.keys(p.portalCredentials).length > 0).length,
            withProvider: response.portalLinks.filter(p => p.invoiceProvider).length,
          });

          // Map PortalLink[] to Invoice[] for template compatibility
          this.portalLinks = response.portalLinks.map(pl => ({
            id: pl.gmailId,
            invoiceKey: pl.gmailId,
            invoiceNo: pl.invoiceNo || '',
            supplierName: pl.supplierName || pl.gmailFrom,
            supplierTaxCode: pl.supplierTaxCode || '',
            issueDate: pl.issueDate,
            issueDateKey: pl.issueDate?.split('T')[0] || '',
            monthKey: '',
            year: 0,
            totalBeforeVat: 0,
            vatRate: 0,
            vatAmount: 0,
            totalAmount: 0,
            source: 'AI_PDF' as any,
            reconcileStatus: 'PENDING' as any,
            createdAt: pl.issueDate,
            portalUrl: pl.portalUrl,
            portalPdfUrl: pl.portalPdfUrl,
            invoiceProvider: pl.invoiceProvider,
            portalCredentials: pl.portalCredentials,
            gmailFrom: pl.gmailFrom,
            gmailMessageId: pl.gmailId,
            gmailThreadId: (pl as any).gmailThreadId || pl.gmailId,
          } as Invoice));

          // Client-side date filtering (API only supports days_back, not exact range)
          if (this.portalLinksFromDate || this.portalLinksToDate) {
            this.portalLinks = this.portalLinks.filter(inv => {
              const d = inv.issueDateKey;
              if (!d) return true;
              if (this.portalLinksFromDate && d < this.portalLinksFromDate) return false;
              if (this.portalLinksToDate && d > this.portalLinksToDate) return false;
              return true;
            });
          }

          this.portalLinksPagination = {
            hasNext: false, hasPrev: false,
            firstDocId: null, lastDocId: null,
            pageSize: 50, count: response.total
          };
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error loading portal links from Gmail:', err)
      });
  }

  applyPortalLinksSearch(): void {
    if (!this.portalLinksSearchNo.trim()) {
      this.portalLinksFiltered = this.portalLinks;
      return;
    }
    const q = this.portalLinksSearchNo.trim().toLowerCase();
    this.portalLinksFiltered = this.portalLinks.filter(inv =>
      inv.invoiceNo?.toLowerCase().includes(q) ||
      inv.supplierName?.toLowerCase().includes(q) ||
      inv.invoiceProvider?.toLowerCase().includes(q)
    );
  }

  getLookupCode(inv: Invoice): string {
    if (!inv.portalCredentials) return '';
    const c = inv.portalCredentials as Record<string, string>;
    return c['lookupCode'] || '';
  }

  getSecretCode(inv: Invoice): string {
    if (!inv.portalCredentials) return '';
    const c = inv.portalCredentials as Record<string, string>;
    const parts: string[] = [];
    if (c['secretCode']) parts.push(c['secretCode']);
    if (c['taxCode']) parts.push(`MST: ${c['taxCode']}`);
    return parts.join(' | ');
  }

  nextPortalPage(): void {
    if (!this.portalLinksPagination.hasNext || !this.portalLinksPagination.lastDocId) return;
    this.loadingPortalLinks = true;
    this.invoiceService.getNextPage(this.portalLinksCurrentFilter, this.portalLinksPagination.lastDocId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (result) => {
          this.portalLinks = result.invoices;
          this.portalLinksPagination = result.pagination;
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error:', err)
      });
  }

  prevPortalPage(): void {
    if (!this.portalLinksPagination.hasPrev || !this.portalLinksPagination.firstDocId) return;
    this.loadingPortalLinks = true;
    this.invoiceService.getPrevPage(this.portalLinksCurrentFilter, this.portalLinksPagination.firstDocId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (result) => {
          this.portalLinks = result.invoices;
          this.portalLinksPagination = result.pagination;
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error:', err)
      });
  }

  // ==========================================================================
  // LIVE RECONCILIATION — Gmail vs GDT (parallel)
  // ==========================================================================

  /**
   * `force` = bỏ bản lưu, tải lại Gmail. `cacheOnly` (mở lại trang) = chỉ đối chiếu khi đã có link Gmail lưu cho bộ lọc đang chọn.
   */
  async runLiveReconciliation(force = false, cacheOnly = false): Promise<void> {
    if (!this.xmlInvoices.length) {
      console.warn(`${LOG} Chưa chọn thư mục XML → không đối chiếu`);
      this.xmlError = 'Chọn thư mục XML hóa đơn đầu vào (app FDI tải về) trước khi đối chiếu.';
      return;
    }

    const values = this.filterForm.value;
    const labelMapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
    const labelId = labelMapping ? this.gmailLabels.find(l => l.name === values.gmailLabel)?.id : undefined;
    const mst = labelMapping?.supplierTaxCode || '';
    const gmailParams = { label: values.gmailLabel, labelId, from: values.fromDate, to: values.toDate };
    const cached = force ? null : await this.source.cachedGmail(gmailParams);
    if (cacheOnly && !cached) return;

    this.liveReconciling = true;
    this.liveResults = [];
    this.liveSaved = false;
    const stamp = (msg: string) => `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.liveStatusLog = [stamp('Bắt đầu đối chiếu...')];
    const addLog = (msg: string) => this.liveStatusLog.push(stamp(msg));

    // HĐ trong thư mục XML có ngày lập trong kỳ
    const gdt = this.xmlInvoices.filter(i => (!values.fromDate || i.tdlap >= values.fromDate) && (!values.toDate || i.tdlap <= values.toDate));
    addLog(`XML (thư mục "${this.xmlFolder}"): ${gdt.length}/${this.xmlInvoices.length} HĐ trong kỳ ${values.fromDate} → ${values.toDate}`);
    let gmailLinks: PortalLink[];
    if (cached) {
      addLog(`Gmail: dùng ${cached.data.length} link đã lấy lúc ${this.viTime(cached.savedAt)} (bấm "Tải lại" để lấy email mới)`);
      this.gmailFetchedAt = cached.savedAt;
      gmailLinks = cached.data;
    } else {
      // chạy nền: đổi trang vẫn lấy tiếp; khung log = log của việc (quay lại trang vẫn thấy)
      const job = this.source.startGmail(gmailParams);
      job.log.unshift(...this.liveStatusLog);
      this.liveStatusLog = job.log;
      try {
        gmailLinks = await job.promise;
        this.gmailFetchedAt = Date.now();
      } catch (err: any) {
        console.error(`${LOG} Đối chiếu lỗi:`, err?.status, err?.error?.detail || err?.message || err);
        this.liveReconciling = false;
        alert('Lỗi đối chiếu: ' + (err?.message || err));
        return;
      }
    }

    let gdtInvoices = gdt;
    // Filter by NCC MST if selected
    if (mst) {
      gmailLinks = gmailLinks.filter(pl => this._normalizeTaxCode(pl.supplierTaxCode) === this._normalizeTaxCode(mst));
      gdtInvoices = gdtInvoices.filter(inv => this._normalizeTaxCode(inv.nbmst) === this._normalizeTaxCode(mst));
    }
    // Lọc Gmail theo kỳ
    if (values.fromDate || values.toDate) {
      gmailLinks = gmailLinks.filter(pl => {
        const d = (pl.invoiceDate || pl.issueDate || '').split('T')[0];
        if (values.fromDate && d < values.fromDate) return false;
        if (values.toDate && d > values.toDate) return false;
        return true;
      });
    }
    this.liveGmailCount = gmailLinks.length;
    this.liveGdtCount = gdtInvoices.length;
    addLog(`Sau lọc: Gmail=${gmailLinks.length}, XML=${gdtInvoices.length}`);
    addLog('Đang so khớp...');
    this._matchAndCompare(gmailLinks, gdtInvoices);
    addLog(`Hoàn tất: ${this.liveResults.length} kết quả`);
    this.liveReconciling = false;
  }

  /**
   * Ghép email Gmail ⇄ HĐ XML (viết lại 23/10/2026 sau khi chạy Gmail thật tháng 10: 143 email chỉ ra 101 dòng):
   * - Email không đọc được số HĐ → dòng "Gmail không đọc được số HĐ" (trước bị bỏ qua, không hiện).
   * - Gộp email chỉ khi CÙNG số HĐ + ký hiệu + MST + người gửi (NCC gửi lại) → 1 dòng ghi "N email". Cùng số HĐ mà khác ký hiệu /
   *   MST / người gửi là HĐ khác nhau → không gộp (trước gộp theo "số|MST", email thiếu MST trùng số đè nhau).
   * - Ghép XML: cùng số HĐ; email có MST thì phải cùng MST bán; có ký hiệu thì phải cùng ký hiệu (bỏ chữ số mẫu số đầu:
   *   "1C26TYT" = "C26TYT"). Mỗi HĐ XML ghép 1 email; email khác cũng trúng HĐ XML đã ghép → cộng vào số email của dòng đó.
   */
  private _matchAndCompare(gmailLinks: PortalLink[], gdtInvoices: LocalXmlInvoice[]): void {
    const symbolOf = (s: string) => (s || '').toUpperCase().replace(/^\d/, '').trim();
    const senderOf = (s: string) => ((s || '').match(/<([^>]+)>/)?.[1] || s || '').trim().toLowerCase();

    // 1. Gom email: bỏ email trùng (cùng số + ký hiệu + MST + người gửi)
    type GmailEntry = { pl: PortalLink; no: string; sym: string; mst: string; count: number };
    const entries = new Map<string, GmailEntry>();
    const noNumber: PortalLink[] = [];
    for (const pl of gmailLinks) {
      const no = /\d/.test(pl.invoiceNo || '') ? this._normalizeInvoiceNo(pl.invoiceNo) : '';
      if (!no) {
        noNumber.push(pl);
        continue;
      }
      const sym = symbolOf(pl.invoiceSymbol || '');
      const mst = this._normalizeTaxCode(pl.supplierTaxCode);
      const id = `${no}|${sym}|${mst}|${senderOf(pl.gmailFrom)}`;
      const e = entries.get(id);
      if (e) {
        e.count++;
        if (!e.pl.hasAmounts && pl.hasAmounts) e.pl = pl;   // giữ email có số tiền
      } else {
        entries.set(id, { pl, no, sym, mst, count: 1 });
      }
    }

    // 2. XML theo số HĐ
    const xmlByNo = new Map<string, LocalXmlInvoice[]>();
    for (const inv of gdtInvoices) {
      const no = this._normalizeInvoiceNo(String(inv.shdon));
      xmlByNo.set(no, [...(xmlByNo.get(no) || []), inv]);
    }

    const results: LiveReconcileRow[] = [];
    const summary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0, noInvoiceNo: 0, dupEmails: 0 };
    const rowOfXml = new Map<LocalXmlInvoice, LiveReconcileRow>();

    // 3. Ghép từng email
    for (const e of entries.values()) {
      let cands = xmlByNo.get(e.no) || [];
      if (e.mst) cands = cands.filter(x => this._normalizeTaxCode(x.nbmst) === e.mst);
      if (e.sym) cands = cands.filter(x => symbolOf(x.khhdon) === e.sym);
      const free = cands.filter(x => !rowOfXml.has(x));
      const gdt = free[0];
      if (gdt) {
        const row = this._liveRow(e.pl, gdt, e.count);
        if (free.length > 1) {
          row.note = `Email thiếu ${e.mst ? 'ký hiệu' : e.sym ? 'MST' : 'MST + ký hiệu'}: có ${free.length} HĐ XML cùng số ${e.no} — đã ghép HĐ đầu tiên, kiểm tra lại`;
          console.warn(`${LOG} ${row.note}`);
        }
        rowOfXml.set(gdt, row);
        results.push(row);
      } else if (cands.length) {
        // HĐ XML đã ghép với email khác → email này là bản gửi thêm của cùng HĐ
        const row = rowOfXml.get(cands[0])!;
        row.gmailCount = (row.gmailCount || 1) + e.count;
        if (!row.gmailData?.hasAmounts && e.pl.hasAmounts) Object.assign(row, this._liveRow(e.pl, cands[0], row.gmailCount));
        console.log(`${LOG} Email số ${e.no} (${senderOf(e.pl.gmailFrom)}) cùng HĐ XML đã ghép → cộng vào dòng (${row.gmailCount} email)`);
      } else {
        results.push(this._liveRow(e.pl, null, e.count));
      }
    }

    // 4. HĐ XML không có email
    for (const inv of gdtInvoices) {
      if (!rowOfXml.has(inv)) results.push(this._liveRow(null, inv, 0));
    }

    // 5. Email không đọc được số HĐ
    for (const pl of noNumber) {
      const row = this._liveRow(pl, null, 1);
      row.status = 'NO_INVOICE_NO';
      results.push(row);
    }

    for (const r of results) {
      summary.total++;
      if (r.status === 'MATCH') summary.matched++;
      else if (r.status === 'MISMATCH') summary.mismatch++;
      else if (r.status === 'MISSING_GMAIL') summary.missingGmail++;
      else if (r.status === 'MISSING_GDT') summary.missingGdt++;
      else if (r.status === 'NO_AMOUNT') summary.noAmount++;
      else if (r.status === 'NO_INVOICE_NO') summary.noInvoiceNo++;
      if ((r.gmailCount || 0) > 1) summary.dupEmails += (r.gmailCount || 0) - 1;
    }

    const statusOrder: Record<string, number> = { 'MISMATCH': 0, 'MISSING_GMAIL': 1, 'MISSING_GDT': 2, 'NO_INVOICE_NO': 3, 'NO_AMOUNT': 4, 'MATCH': 5 };
    results.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

    this.liveResults = results;
    this.liveSummary = summary;
    console.log(`${LOG} Ghép xong: ${gmailLinks.length} email → ${entries.size} HĐ khác nhau + ${noNumber.length} email không đọc được số HĐ; `
      + `XML ${gdtInvoices.length}`, summary);
    if (noNumber.length) console.warn(`${LOG} ${noNumber.length} email không đọc được số HĐ (hiện thành dòng riêng)`);
  }

  /** 1 dòng kết quả từ email (có thể null) + HĐ XML (có thể null) */
  private _liveRow(gm: PortalLink | null, gdt: LocalXmlInvoice | null, gmailCount: number): LiveReconcileRow {
    const row: LiveReconcileRow = {
      invoiceKey: gdt ? `${gdt.khmshdon}${gdt.khhdon}-${gdt.shdon}` : (gm?.invoiceNo || gm?.gmailSubject || ''),
      matchKey: gdt ? `${gdt.shdon}|${gdt.nbmst}` : `${gm?.invoiceNo || ''}|${gm?.supplierTaxCode || ''}`,
      status: 'MATCH',
      fieldDiffs: [],
      gmailCount,
      gmailThreadId: gm ? (gm.gmailThreadId || gm.gmailId) : undefined,
    };
    if (gm) {
      row.gmailData = {
        gmailFrom: gm.gmailFrom || '',
        gmailSubject: gm.gmailSubject || '',
        hasAmounts: !!gm.hasAmounts,
        invoiceNo: gm.invoiceNo || '',
        invoiceSymbol: gm.invoiceSymbol || '',
        supplierTaxCode: gm.supplierTaxCode || '',
        supplierName: gm.supplierName || '',
        totalBeforeVat: gm.totalBeforeVat || 0,
        vatAmount: gm.vatAmount || 0,
        totalAmount: gm.totalAmount || 0,
        invoiceDate: gm.invoiceDate || gm.issueDate || '',
        parseSource: gm.parseSource || 'none',
      };
    }
    if (gdt) {
      row.gdtData = {
        shdon: gdt.shdon, khhdon: gdt.khhdon, nbmst: gdt.nbmst, nbten: gdt.nbten,
        tgtcthue: gdt.tgtcthue, tgtthue: gdt.tgtthue, tgtttbso: gdt.tgtttbso, tdlap: gdt.tdlap,
      };
    }
    if (gm && gdt) {
      if (!gm.hasAmounts) {
        row.status = 'NO_AMOUNT';
      } else {
        row.fieldDiffs = this._compareAmounts(gm, gdt);
        if (row.fieldDiffs.length) row.status = 'MISMATCH';
      }
    } else {
      row.status = gm ? 'MISSING_GDT' : 'MISSING_GMAIL';
    }
    return row;
  }

  /** Mở email gốc (cùng dạng link với tab Links HĐ gốc) */
  openLiveGmail(row: LiveReconcileRow): void {
    if (!row.gmailThreadId) return;
    const url = `https://mail.google.com/mail/u/1/#all/${row.gmailThreadId}`;
    console.log(`${LOG} Mở email gốc: ${url}`);
    window.open(url, '_blank');
  }

  private _normalizeInvoiceNo(no: string): string {
    if (!no) return '';
    // If format is "SYMBOL-NUMBER" (e.g. "1C26TAA-00038308"), extract part after last hyphen
    const parts = no.split('-');
    const lastPart = parts[parts.length - 1];
    const candidate = lastPart.replace(/\D/g, '');
    if (candidate) {
      const num = parseInt(candidate, 10);
      if (!isNaN(num)) return String(num);
    }
    // Fallback: strip all non-digits
    const num = parseInt(no.replace(/\D/g, ''), 10);
    return isNaN(num) ? no.trim().toLowerCase() : String(num);
  }

  private _normalizeTaxCode(taxCode: string): string {
    if (!taxCode) return '';
    // Strip branch suffix like -001
    return taxCode.replace(/-\d+$/, '').trim();
  }

  private _compareAmounts(gm: PortalLink, gdt: LocalXmlInvoice): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const tolerance = 1;

    // Only compare if gmail has parsed amounts
    if (!gm.hasAmounts) return [];

    const fields: [string, string, number, number][] = [
      ['Tổng tiền trước thuế', 'totalBeforeVat', gm.totalBeforeVat || 0, gdt.tgtcthue || 0],
      ['Tiền thuế GTGT', 'vatAmount', gm.vatAmount || 0, gdt.tgtthue || 0],
      ['Tổng tiền thanh toán', 'totalAmount', gm.totalAmount || 0, gdt.tgtttbso || 0],
    ];

    for (const [label, field, gmVal, gdtVal] of fields) {
      if (Math.abs(gmVal - gdtVal) > tolerance) {
        diffs.push({
          field,
          fieldLabel: label,
          taxValue: gdtVal,
          internalValue: gmVal,
          diff: gmVal - gdtVal,
          diffType: 'number',
        });
      }
    }

    return diffs;
  }

  saveLiveResults(): void {
    if (this.liveResults.length === 0) return;

    this.liveSaving = true;
    this.invoiceService.saveLiveReconciliation(this.liveResults)
      .pipe(takeUntil(this.destroy$), finalize(() => this.liveSaving = false))
      .subscribe({
        next: (res) => {
          this.liveSaved = true;
          console.log('💾 Saved live reconciliation:', res.saved);
        },
        error: (err) => {
          console.error('❌ Save error:', err);
          alert('Lỗi lưu kết quả: ' + (err.message || err));
        }
      });
  }

  getLiveStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'MATCH': 'Khớp',
      'MISMATCH': 'Sai số',
      'MISSING_GMAIL': 'Thiếu Gmail',
      'MISSING_GDT': 'Thiếu XML',
      'NO_AMOUNT': 'Chưa có số liệu',
      'NO_INVOICE_NO': 'Gmail không đọc được số HĐ',
    };
    return labels[status] || status;
  }

  getLiveStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'MATCH': 'live-match',
      'MISMATCH': 'live-mismatch',
      'MISSING_GMAIL': 'live-missing',
      'MISSING_GDT': 'live-missing',
      'NO_AMOUNT': 'live-no-amount',
      'NO_INVOICE_NO': 'live-no-number',
    };
    return classes[status] || '';
  }

  formatGdtDate(tdlap: string): string {
    if (!tdlap) return '';
    try {
      const d = new Date(tdlap);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return tdlap;
    }
  }
}
