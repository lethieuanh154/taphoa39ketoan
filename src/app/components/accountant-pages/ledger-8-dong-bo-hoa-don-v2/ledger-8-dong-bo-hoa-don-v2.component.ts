/**
 * LEDGER 8 - KIỂM TRA SỐ LƯỢNG HÓA ĐƠN ĐẦU VÀO (Tiện ích → Kiểm tra số lượng hóa đơn)
 * So sánh Gmail (HĐ NCC gửi qua email) vs danh sách HĐ trong thư mục XML trên máy (app FDI tải từ cổng thuế).
 * 23/10/2026: bỏ nguồn GDT (cổng thuế chặn tự động hóa) → đọc XML trong trình duyệt (utils/invoice-xml.util.ts), không upload.
 */

import { Component, OnInit, OnDestroy, HostListener, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, map, tap } from 'rxjs/operators';

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
import { TienIchCacheService } from '../../../services/tien-ich-cache.service';
import { LocalXmlInvoice, XmlReadResult, readInvoiceFiles, detectCompanyMst } from '../../../utils/invoice-xml.util';
import { environment } from '../../../../environments/environment';

const LOG = '[InvoiceCountIn]';
/** IndexedDB (TienIchCacheService): XML đã đọc + link Gmail đã lấy theo nhãn + kỳ → mở lại trang không phải chọn / tải lại */
const CACHE_XML = 'xml-in';

interface CachedXml { folder: string; result: XmlReadResult; }

@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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
  liveSummary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0 };
  liveGmailCount = 0;
  liveGdtCount = 0;
  liveSaving = false;
  liveSaved = false;
  liveStatusLog: string[] = [];

  // === Danh sách HĐ từ thư mục XML trên máy (thay GDT) ===
  xmlInvoices: LocalXmlInvoice[] = [];   // HĐ đầu vào (bên mua = công ty)
  xmlFolder = '';
  xmlReading = false;
  xmlProgress = '';
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
  private tienIchCache = inject(TienIchCacheService);

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
    const c = await this.tienIchCache.get<CachedXml>(CACHE_XML);
    if (!c || this.rawXml || this.xmlReading) return;
    this.xmlFolder = c.data.folder;
    this.rawXml = c.data.result;
    this.xmlSavedAt = c.savedAt;
    this.applyXml();
    console.log(`${LOG} Dùng XML đã đọc lúc ${this.viTime(c.savedAt)} ("${this.xmlFolder}", ${this.xmlInvoices.length} HĐ)`);
    if (this.xmlInvoices.length) await this.runLiveReconciliation(false, true);
  }

  /** Khóa cache link Gmail: nhãn + kỳ */
  private gmailCacheKey(label: string, from: string, to: string): string {
    return `gmail-links:${label || '*'}:${from || ''}:${to || ''}`;
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
    this.xmlFolder = (files[0] as any).webkitRelativePath?.split('/')[0] || `${files.length} file`;
    this.xmlReading = true;
    this.xmlError = '';
    this.xmlInfo = '';
    try {
      const r = await readInvoiceFiles(files, (d, t) => this.xmlProgress = `${d}/${t} file`);
      this.rawXml = r;
      this.xmlSavedAt = Date.now();
      this.applyXml();
      console.log(`${LOG} Thư mục "${this.xmlFolder}": ${this.xmlInfo}`);
      if (r.errors.length) console.warn(`${LOG} File XML lỗi:`, r.errors.slice(0, 10));
      await this.tienIchCache.set<CachedXml>(CACHE_XML, { folder: this.xmlFolder, result: r });
    } catch (e: any) {
      console.error(`${LOG} Không đọc được thư mục XML: ${e?.message || e}`);
      this.xmlError = `Không đọc được thư mục XML: ${e?.message || e}`;
      this.xmlInvoices = [];
      this.rawXml = null;
    } finally {
      this.xmlReading = false;
      this.xmlProgress = '';
    }
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
    const fromDate = values.fromDate ? new Date(values.fromDate) : new Date();

    // Gmail params
    const gmailUid = localStorage.getItem('gmail_uid') || '';
    let daysBack = 30;
    if (values.fromDate) {
      const now = new Date();
      daysBack = Math.max(1, Math.ceil((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    const labelMapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
    const labelId = labelMapping ? this.gmailLabels.find(l => l.name === values.gmailLabel)?.id : undefined;
    const mst = labelMapping?.supplierTaxCode || '';
    const gmailKey = this.gmailCacheKey(values.gmailLabel, values.fromDate, values.toDate);
    const cached = force ? null : await this.tienIchCache.get<PortalLink[]>(gmailKey);
    if (cacheOnly && !cached) return;

    this.liveReconciling = true;
    this.liveResults = [];
    this.liveSaved = false;
    this.liveStatusLog = [`[${new Date().toLocaleTimeString()}] Bắt đầu đối chiếu...`];

    const addLog = (msg: string) => this.liveStatusLog = [...this.liveStatusLog, `[${new Date().toLocaleTimeString()}] ${msg}`];

    // HĐ trong thư mục XML có ngày lập trong kỳ
    const gdt = this.xmlInvoices.filter(i => (!values.fromDate || i.tdlap >= values.fromDate) && (!values.toDate || i.tdlap <= values.toDate));
    addLog(`XML (thư mục "${this.xmlFolder}"): ${gdt.length}/${this.xmlInvoices.length} HĐ trong kỳ ${values.fromDate} → ${values.toDate}`);
    if (cached) {
      addLog(`Gmail: dùng ${cached.data.length} link đã lấy lúc ${this.viTime(cached.savedAt)} (bấm "Tải lại" để lấy email mới)`);
      this.gmailFetchedAt = cached.savedAt;
    } else {
      addLog(`Đang tải Gmail (daysBack=${daysBack})...`);
    }

    const gmail$ = cached ? of({ gmailLinks: cached.data, gdtInvoices: gdt }) : this.invoiceService.getPortalLinksFromGmail({
      uid: gmailUid,
      labelId,
      daysBack,
      pageSize: 500,
      parseAttachments: true,
      beforeDate: values.toDate || undefined,   // chỉ email trong kỳ (kỳ quá khứ không bị page_size cắt mất)
    }).pipe(
      tap(res => addLog(`Gmail: ${(res.portalLinks || []).length} portal links`)),
      switchMap(gmail => {
        let gmailLinks = gmail.portalLinks || [];

        const toScrape = gmailLinks
          .filter(pl => !pl.hasAmounts && !!pl.portalUrl)
          .map(pl => ({ gmailId: pl.gmailId, portalUrl: pl.portalUrl, provider: pl.invoiceProvider || '', credentials: pl.portalCredentials || {} }));

        if (!toScrape.length) {
          addLog('Không có portal nào cần scrape XML');
          return of({ gmailLinks, gdtInvoices: gdt || [] });
        }

        addLog(`Đang scrape XML từ ${toScrape.length} portal...`);
        return this.invoiceService.scrapePortalXml(toScrape).pipe(
          map(res => {
            const scraped = new Map((res.results || []).filter(r => r.success && r.amounts).map(r => [r.gmailId, r.amounts!]));
            addLog(`Scrape xong: ${scraped.size}/${toScrape.length} OK`);
            gmailLinks = gmailLinks.map(pl => scraped.has(pl.gmailId) ? { ...pl, ...scraped.get(pl.gmailId) } : pl);
            return { gmailLinks, gdtInvoices: gdt || [] };
          }),
          catchError(err => {
            addLog(`Scrape lỗi: ${err.message || err}`);
            return of({ gmailLinks, gdtInvoices: gdt || [] });
          })
        );
      }),
      tap(({ gmailLinks }) => {
        this.gmailFetchedAt = Date.now();
        void this.tienIchCache.set<PortalLink[]>(gmailKey, gmailLinks);
      })
    );

    gmail$.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.liveReconciling = false)
    ).subscribe({
      next: ({ gmailLinks, gdtInvoices }) => {
        // Filter by NCC MST if selected
        if (mst) {
          gmailLinks = gmailLinks.filter(pl => this._normalizeTaxCode(pl.supplierTaxCode) === this._normalizeTaxCode(mst));
          gdtInvoices = gdtInvoices.filter(inv => this._normalizeTaxCode(inv.nbmst) === this._normalizeTaxCode(mst));
        }

        // Filter Gmail by date range
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
      },
      error: (err) => {
        console.error(`${LOG} Đối chiếu lỗi:`, err?.status, err?.error?.detail || err?.message || err);
        alert('Lỗi đối chiếu: ' + (err.message || err));
      }
    });
  }

  private _matchAndCompare(gmailLinks: PortalLink[], gdtInvoices: LocalXmlInvoice[]): void {
    // Build maps with normalized keys
    const gmailMap = new Map<string, PortalLink>();
    for (const pl of gmailLinks) {
      const key = this._makeMatchKey(pl.invoiceNo, pl.supplierTaxCode);
      console.log(`[Gmail] raw="${pl.invoiceNo}" taxCode="${pl.supplierTaxCode}" → key="${key}"`);
      if (key && key !== '|') gmailMap.set(key, pl);
      else console.warn(`[Gmail] SKIPPED (empty key): invoiceNo="${pl.invoiceNo}" from="${pl.gmailFrom}"`);
    }

    const gdtMap = new Map<string, LocalXmlInvoice>();
    for (const inv of gdtInvoices) {
      const key = this._makeMatchKey(String(inv.shdon), inv.nbmst);
      console.log(`[XML]   raw="${inv.shdon}" taxCode="${inv.nbmst}" → key="${key}"`);
      if (key && key !== '|') gdtMap.set(key, inv);
      else console.warn(`[XML]   SKIPPED (empty key): shdon="${inv.shdon}"`);
    }

    console.log(`[Reconcile] Gmail keys (${gmailMap.size}):`, [...gmailMap.keys()]);
    console.log(`[Reconcile] XML keys   (${gdtMap.size}):`, [...gdtMap.keys()]);

    // Gmail thiếu MST (HAR 23/10/2026: 17/20 email không có MST, 15/20 có ký hiệu) → khớp theo số HĐ + KÝ HIỆU (bỏ chữ số
    // mẫu số đầu: "1C26TYT" = "C26TYT"); chỉ khi email không có ký hiệu mới khớp theo số HĐ (lấy HĐ XML đầu tiên cùng số)
    const symbolOf = (s: string) => (s || '').toUpperCase().replace(/^\d/, '').trim();
    const resolvedGmailMap = new Map<string, PortalLink>();
    for (const [key, pl] of gmailMap) {
      if (key.endsWith('|')) {
        const noOnly = key.slice(0, -1);
        const sameNo = [...gdtMap.entries()].filter(([k]) => k.startsWith(noOnly + '|'));
        const sym = symbolOf(pl.invoiceSymbol || '');
        const hit = sym ? sameNo.find(([, x]) => symbolOf(x.khhdon) === sym) : sameNo[0];
        const gdtKey = hit?.[0];
        if (sym && !hit && sameNo.length) console.warn(`${LOG} Gmail số ${noOnly} ký hiệu ${sym}: có ${sameNo.length} HĐ XML cùng số nhưng khác ký hiệu → không khớp`);
        if (gdtKey) {
          console.log(`[Reconcile] Gmail "${key}" → resolved to GDT key "${gdtKey}"`);
          resolvedGmailMap.set(gdtKey, pl);
        } else {
          resolvedGmailMap.set(key, pl);
        }
      } else {
        resolvedGmailMap.set(key, pl);
      }
    }
    console.log(`[Reconcile] Resolved Gmail keys:`, [...resolvedGmailMap.keys()]);

    const allKeys = new Set([...resolvedGmailMap.keys(), ...gdtMap.keys()]);
    const results: LiveReconcileRow[] = [];
    const summary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0 };

    for (const key of allKeys) {
      const gm = resolvedGmailMap.get(key);
      const gdt = gdtMap.get(key);
      summary.total++;

      const row: LiveReconcileRow = {
        invoiceKey: gdt ? `${gdt.khmshdon}${gdt.khhdon}-${gdt.shdon}` : (gm?.invoiceNo || key),
        matchKey: key,
        status: 'MATCH',
        fieldDiffs: [],
      };

      if (gm) {
        row.gmailData = {
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
          shdon: gdt.shdon,
          khhdon: gdt.khhdon,
          nbmst: gdt.nbmst,
          nbten: gdt.nbten,
          tgtcthue: gdt.tgtcthue,
          tgtthue: gdt.tgtthue,
          tgtttbso: gdt.tgtttbso,
          tdlap: gdt.tdlap,
        };
      }

      if (gm && gdt) {
        if (!gm.hasAmounts) {
          row.status = 'NO_AMOUNT';
          summary.noAmount++;
        } else {
          const diffs = this._compareAmounts(gm, gdt);
          if (diffs.length > 0) {
            row.status = 'MISMATCH';
            row.fieldDiffs = diffs;
            summary.mismatch++;
          } else {
            summary.matched++;
          }
        }
      } else if (!gm) {
        row.status = 'MISSING_GMAIL';
        summary.missingGmail++;
      } else {
        row.status = 'MISSING_GDT';
        summary.missingGdt++;
      }

      results.push(row);
    }

    // Sort: MISMATCH first, then MISSING, then MATCH
    const statusOrder: Record<string, number> = { 'MISMATCH': 0, 'MISSING_GMAIL': 1, 'MISSING_GDT': 2, 'NO_AMOUNT': 3, 'MATCH': 4 };
    results.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

    this.liveResults = results;
    this.liveSummary = summary;
    console.log('⚖️ Live reconciliation done:', summary);
  }

  private _makeMatchKey(invoiceNo: string, taxCode: string): string {
    const normalNo = this._normalizeInvoiceNo(invoiceNo);
    const normalTax = this._normalizeTaxCode(taxCode);
    return `${normalNo}|${normalTax}`;
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
