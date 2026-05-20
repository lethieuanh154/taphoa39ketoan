/**
 * LEDGER 8 - ĐỒNG BỘ HÓA ĐƠN ĐẦU VÀO (Input Invoices)
 * Đồng bộ hóa đơn từ Trang thuế với Hóa đơn AI/PDF
 * Scalable component cho 100.000+ hóa đơn
 *
 * Features:
 * - Pagination với cursor-based navigation
 * - Filter theo ngày/tháng/năm/NCC
 * - Mặc định filter theo ngày hôm nay
 * - Reconciliation summary
 * - IndexedDB cache để giảm API calls
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import {
  InvoiceServiceV2,
  Invoice,
  InvoiceFilter,
  InvoiceSource,
  Pagination,
  ReconciliationSummary,
  Supplier,
  ReconcileStatus,
  ReconciliationResult,
  FieldDiff,
  PortalLink
} from '../invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';
import { HddtService, HddtInvoice } from '../../../services/hddt.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './ledger-8-dong-bo-hoa-don-v2.component.html',
  styleUrls: ['./ledger-8-dong-bo-hoa-don-v2.component.css']
})
export class Ledger8DongBoHoaDonV2Component implements OnInit, OnDestroy {
  // Filter form
  filterForm: FormGroup;

  // Data - Tách riêng 2 nguồn để hiển thị song song
  taxInvoices: Invoice[] = [];       // Hóa đơn từ trang thuế (TAX_PORTAL)
  aiInvoices: Invoice[] = [];        // Hóa đơn từ AI/PDF (AI_PDF)

  // Pagination riêng cho từng nguồn
  taxPagination: Pagination = {
    hasNext: false,
    hasPrev: false,
    firstDocId: null,
    lastDocId: null,
    pageSize: 25,
    count: 0
  };
  aiPagination: Pagination = {
    hasNext: false,
    hasPrev: false,
    firstDocId: null,
    lastDocId: null,
    pageSize: 25,
    count: 0
  };

  // Legacy - giữ để tương thích
  invoices: Invoice[] = [];
  pagination: Pagination = {
    hasNext: false,
    hasPrev: false,
    firstDocId: null,
    lastDocId: null,
    pageSize: 25,
    count: 0
  };

  // Gmail labels for supplier filter
  gmailLabels: {id: string, name: string, displayName: string}[] = [];
  internalSuppliers: Supplier[] = [];
  labelMappings: {labelId: string, labelName: string, displayName: string, supplierTaxCode: string, supplierName: string}[] = [];

  // Reconciliation summary
  summary: ReconciliationSummary | null = null;

  // Reconciliation results (chi tiết sai lệch)
  reconciliationResults: ReconciliationResult[] = [];
  selectedResult: ReconciliationResult | null = null;
  showMismatchModal = false;
  loadingResults = false;

  // Invoice compare modal (hiển thị toàn bộ 2 hóa đơn side-by-side)
  showCompareModal = false;
  compareResult: ReconciliationResult | null = null;
  compareTaxInvoice: Invoice | null = null;
  compareAiInvoice: Invoice | null = null;
  loadingCompareData = false;

  // Loading states
  loading = false;
  loadingTax = false;       // Loading cho bảng TAX_PORTAL
  loadingAi = false;        // Loading cho bảng AI_PDF
  loadingLabels = false;
  loadingSummary = false;
  reconciling = false;
  clearing = false;
  importing = false;

  // Current filter
  currentFilter: InvoiceFilter = {};

  // Options
  providerOptions: { name: string; count: number }[] = [];
  selectedProvider = '';

  // Destroy subject
  private destroy$ = new Subject<void>();

  // === GDT Direct Fetch (Tax portal) ===
  hddtInvoices: HddtInvoice[] = [];
  fetchingGdt = false;
  gdtError = '';
  gdtMode = false;   // true = tax panel shows live GDT data

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
  portalLinksSupplierTaxCode = '';
  portalLinksLabelId = '';
  portalLinksFromDate = new Date().toISOString().split('T')[0];
  portalLinksToDate = new Date().toISOString().split('T')[0];
  portalLinksSearchNo = '';
  expandedPortalLinkId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceServiceV2,
    private cacheService: AccountantCacheService,
    private hddtService: HddtService,
    private http: HttpClient
  ) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    this.filterForm = this.fb.group({
      fromDate: [today],
      toDate: [today],
      gmailLabel: [''],
      pageSize: [25]
    });
  }

  ngOnInit(): void {
    console.log('Ledger 8 V2 initialized');

    // Load Gmail labels for supplier filter
    this.loadGmailLabels();

    // Load providers for filter
    this.loadProviders();

    // Load default data (30 ngày gần nhất)
    this.loadDefault();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================================================
  // LOAD METHODS
  // ==========================================================================

  /**
   * Load mặc định (theo filter hiện tại - mặc định là hôm nay)
   */
  loadDefault(): void {
    // Sử dụng applyFilter thay vì getInvoicesDefault
    // Vì mặc định filter đã được set là hôm nay
    this.applyFilter();
  }

  /**
   * Apply filter and reload - Load cả 2 nguồn song song
   */
  applyFilter(forceReload = false): void {
    const values = this.filterForm.value;
    const baseFilter: InvoiceFilter = { pageSize: values.pageSize };

    if (values.fromDate) baseFilter.fromDate = values.fromDate;
    if (values.toDate) baseFilter.toDate = values.toDate;

    // Map gmail label → supplierTaxCode
    if (values.gmailLabel) {
      const mapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
      if (mapping?.supplierTaxCode) {
        baseFilter.supplierTaxCode = mapping.supplierTaxCode;
      }
    }

    this.currentFilter = baseFilter;
    console.log('🔍 applyFilter()', { forceReload, filter: baseFilter, gmailLabel: values.gmailLabel });

    // Chỉ load AI invoices — Tax invoices load thủ công qua "Tải từ GDT"
    this.loadAiInvoices({ ...baseFilter, source: 'AI_PDF' }, forceReload);
    this.loadSummary(forceReload);
  }

  /**
   * Load hóa đơn từ TAX_PORTAL (trang thuế) - với IndexedDB cache
   */
  async loadTaxInvoices(filter: InvoiceFilter, forceReload = false): Promise<void> {
    this.loadingTax = true;

    // Thử lấy từ cache trước (nếu không force reload)
    if (!forceReload) {
      const cached = await this.cacheService.getCachedInvoices(filter);
      if (cached) {
        this.taxInvoices = cached.invoices;
        this.taxPagination = cached.pagination;
        this.loadingTax = false;
        console.log('📦 TAX_PORTAL loaded from cache:', cached.invoices.length, 'invoices');
        return;
      }
    }

    this.invoiceService.getInvoices(filter)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingTax = false)
      )
      .subscribe({
        next: async (result) => {
          this.taxInvoices = result.invoices;
          this.taxPagination = result.pagination;
          console.log('✅ TAX_PORTAL:', result.invoices.length, 'invoices');
          // Lưu vào cache
          await this.cacheService.cacheInvoices(filter, result.invoices, result.pagination);
        },
        error: (err) => {
          console.error('Error loading TAX invoices:', err);
        }
      });
  }

  /**
   * Load hóa đơn từ AI_PDF - với IndexedDB cache
   */
  async loadAiInvoices(filter: InvoiceFilter, forceReload = false): Promise<void> {
    this.loadingAi = true;
    console.log('📄 loadAiInvoices()', { forceReload, filter });

    // Thử lấy từ cache trước (nếu không force reload)
    if (!forceReload) {
      const cached = await this.cacheService.getCachedInvoices(filter);
      if (cached) {
        this.aiInvoices = cached.invoices;
        this.aiPagination = cached.pagination;
        this.loadingAi = false;
        console.log('📦 AI_PDF from cache:', cached.invoices.length, 'invoices');
        return;
      }
    }

    // Use KeToanBackEnd to read from supplies-invoices Firestore directly
    const internalFilter: InvoiceFilter = { ...filter };
    delete (internalFilter as any).source;
    if (this.selectedProvider) {
      (internalFilter as any).invoiceProvider = this.selectedProvider;
    }

    console.log('🌐 loadAiInvoices → getInternalInvoices()', internalFilter);
    this.invoiceService.getInternalInvoices(internalFilter)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingAi = false))
      .subscribe({
        next: async (result) => {
          this.aiInvoices = result.invoices;
          this.aiPagination = result.pagination;
          console.log('✅ AI_PDF loaded:', result.invoices.length, 'invoices | hasNext:', result.pagination.hasNext);
          await this.cacheService.cacheInvoices(filter, result.invoices, result.pagination);
        },
        error: (err) => console.error('❌ loadAiInvoices error:', err)
      });
  }

  /**
   * Load trang tiếp cho TAX_PORTAL
   */
  nextTaxPage(): void {
    if (!this.taxPagination.hasNext || !this.taxPagination.lastDocId) return;

    this.loadingTax = true;
    const filter: InvoiceFilter = { ...this.currentFilter, source: 'TAX_PORTAL' };

    this.invoiceService.getNextPage(filter, this.taxPagination.lastDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingTax = false)
      )
      .subscribe({
        next: (result) => {
          this.taxInvoices = result.invoices;
          this.taxPagination = result.pagination;
        },
        error: (err) => console.error('Error:', err)
      });
  }

  /**
   * Load trang trước cho TAX_PORTAL
   */
  prevTaxPage(): void {
    if (!this.taxPagination.hasPrev || !this.taxPagination.firstDocId) return;

    this.loadingTax = true;
    const filter: InvoiceFilter = { ...this.currentFilter, source: 'TAX_PORTAL' };

    this.invoiceService.getPrevPage(filter, this.taxPagination.firstDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingTax = false)
      )
      .subscribe({
        next: (result) => {
          this.taxInvoices = result.invoices;
          this.taxPagination = result.pagination;
        },
        error: (err) => console.error('Error:', err)
      });
  }

  /**
   * Load trang tiếp cho AI_PDF
   */
  nextAiPage(): void {
    if (!this.aiPagination.hasNext || !this.aiPagination.lastDocId) return;

    console.log('⏭️ nextAiPage() cursor:', this.aiPagination.lastDocId);
    this.loadingAi = true;
    this.invoiceService.getInternalInvoices({ ...this.currentFilter, cursor: this.aiPagination.lastDocId, direction: 'next' })
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingAi = false))
      .subscribe({
        next: (result) => { this.aiInvoices = result.invoices; this.aiPagination = result.pagination; },
        error: (err) => console.error('Error:', err)
      });
  }

  prevAiPage(): void {
    if (!this.aiPagination.hasPrev || !this.aiPagination.firstDocId) return;

    console.log('⏮️ prevAiPage() cursor:', this.aiPagination.firstDocId);
    this.loadingAi = true;
    this.invoiceService.getInternalInvoices({ ...this.currentFilter, cursor: this.aiPagination.firstDocId, direction: 'prev' })
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingAi = false))
      .subscribe({
        next: (result) => { this.aiInvoices = result.invoices; this.aiPagination = result.pagination; },
        error: (err) => console.error('Error:', err)
      });
  }

  /**
   * Load invoices with filter (sử dụng cache nếu có)
   */
  async loadInvoices(filter: InvoiceFilter, forceReload = false): Promise<void> {
    this.loading = true;

    // Thử lấy từ cache trước (nếu không force reload)
    if (!forceReload) {
      const cached = await this.cacheService.getCachedInvoices(filter);
      if (cached) {
        this.invoices = cached.invoices;
        this.pagination = cached.pagination;
        this.loading = false;
        console.log('📦 Loaded from cache:', cached.invoices.length, 'invoices');
        return;
      }
    }

    // Không có cache hoặc force reload -> gọi API
    this.invoiceService.getInvoices(filter)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: async (result) => {
          this.invoices = result.invoices;
          this.pagination = result.pagination;
          console.log('✅ Loaded from API:', result.invoices.length, 'invoices');

          // Lưu vào cache
          await this.cacheService.cacheInvoices(filter, result.invoices, result.pagination);
        },
        error: (err) => {
          console.error('Error loading invoices:', err);
          alert('Lỗi tải dữ liệu: ' + err.message);
        }
      });
  }

  /**
   * Load next page
   */
  nextPage(): void {
    if (!this.pagination.hasNext || !this.pagination.lastDocId) return;

    this.loading = true;

    this.invoiceService.getNextPage(this.currentFilter, this.pagination.lastDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.invoices = result.invoices;
          this.pagination = result.pagination;
        },
        error: (err) => {
          console.error('Error loading next page:', err);
          alert('Lỗi tải trang tiếp: ' + err.message);
        }
      });
  }

  /**
   * Load previous page
   */
  prevPage(): void {
    if (!this.pagination.hasPrev || !this.pagination.firstDocId) return;

    this.loading = true;

    this.invoiceService.getPrevPage(this.currentFilter, this.pagination.firstDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.invoices = result.invoices;
          this.pagination = result.pagination;
        },
        error: (err) => {
          console.error('Error loading prev page:', err);
          alert('Lỗi tải trang trước: ' + err.message);
        }
      });
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
          this.internalSuppliers = suppliers;
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

  /**
   * Load reconciliation summary (sử dụng cache nếu có)
   */
  async loadSummary(forceReload = false): Promise<void> {
    this.loadingSummary = true;
    console.log('📊 loadSummary()', { forceReload });

    if (!forceReload) {
      const cached = await this.cacheService.getCachedSummary(undefined, undefined);
      if (cached) {
        this.summary = cached;
        this.loadingSummary = false;
        console.log('📦 summary from cache:', cached);
        return;
      }
    }

    this.invoiceService.getReconciliationSummary(undefined, undefined)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingSummary = false))
      .subscribe({
        next: async (summary) => {
          this.summary = summary;
          console.log('✅ summary loaded:', summary);
          await this.cacheService.cacheSummary(summary, undefined, undefined);
        },
        error: (err) => console.error('❌ loadSummary error:', err)
      });
  }

  // ==========================================================================
  // IMPORT METHODS
  // ==========================================================================

  /**
   * Upload and import XML files
   */
  uploadXmlFiles(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.multiple = true;

    input.onchange = (event: any) => {
      const files = Array.from(event.target.files) as File[];
      if (files.length === 0) return;

      this.importing = true;

      this.invoiceService.importXml(files)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.importing = false)
        )
        .subscribe({
          next: async (result) => {
            const msg = `Import hoàn tất!\n` +
              `- Đã import: ${result.imported}\n` +
              `- Trùng lặp: ${result.duplicates}\n` +
              `- Lỗi: ${result.failed}`;
            alert(msg);

            // Invalidate cache và reload data
            await this.cacheService.invalidateBySource('TAX_PORTAL');
            // Reload suppliers để dropdown có data mới
            this.loadGmailLabels();
            this.applyFilter(true);
          },
          error: (err) => {
            console.error('Error importing XML:', err);
            alert('Lỗi import: ' + err.message);
          }
        });
    };

    input.click();
  }

  // ==========================================================================
  // RECONCILIATION METHODS
  // ==========================================================================

  /**
   * Run reconciliation
   */
  runReconciliation(): void {
    if (!confirm('Bạn có muốn chạy đối chiếu cho tất cả hóa đơn?')) return;

    console.log('⚖️ runReconciliation() started');
    this.reconciling = true;

    this.invoiceService.runReconciliation(undefined)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.reconciling = false)
      )
      .subscribe({
        next: (result) => {
          const msg = `Đối chiếu hoàn tất!\n` +
            `- Đã xử lý: ${result.processed}\n` +
            `- Khớp: ${result.matched}\n` +
            `- Thiếu: ${result.unmatched}\n` +
            `- Sai số: ${result.mismatch}`;
          alert(msg);

          // Invalidate cache và reload tất cả data (force reload)
          this.cacheService.clearAllCache();
          this.applyFilter(true);  // Force reload để cập nhật summary và invoices
          this.loadReconciliationResults();
        },
        error: (err) => {
          console.error('Error reconciling:', err);
          alert('Lỗi đối chiếu: ' + err.message);
        }
      });
  }

  /**
   * Load kết quả đối chiếu (chi tiết sai lệch)
   */
  loadReconciliationResults(status?: string): void {
    this.loadingResults = true;

    this.invoiceService.getReconciliationResults(status, 100)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingResults = false)
      )
      .subscribe({
        next: (response) => {
          this.reconciliationResults = response.results;
          console.log('📋 Loaded reconciliation results:', response.count);
          // Debug: log chi tiết để kiểm tra fieldDiffs
          if (response.results.length > 0) {
            console.log('📋 First result:', JSON.stringify(response.results[0], null, 2));
            console.log('📋 fieldDiffs:', response.results[0].fieldDiffs);
          }
        },
        error: (err) => {
          console.error('Error loading reconciliation results:', err);
        }
      });
  }

  /**
   * Hiển thị chi tiết sai lệch cho 1 hóa đơn
   */
  showMismatchDetails(result: ReconciliationResult): void {
    this.selectedResult = result;
    this.showMismatchModal = true;
  }

  /**
   * Đóng modal chi tiết sai lệch
   */
  closeMismatchModal(): void {
    this.showMismatchModal = false;
    this.selectedResult = null;
  }

  /**
   * Hiển thị popup so sánh 2 hóa đơn (toàn bộ thông tin)
   * Được gọi khi click vào row trong bảng kết quả đối chiếu
   */
  showInvoiceCompareModal(result: ReconciliationResult): void {
    this.compareResult = result;
    this.showCompareModal = true;
    this.loadingCompareData = true;

    // Lấy dữ liệu đầy đủ của 2 hóa đơn từ taxData và internalData trong result
    // Nếu result đã có taxData/internalData thì dùng luôn
    // Cast qua unknown để bypass strict type checking vì data từ backend có thể khác type
    if (result.taxData) {
      this.compareTaxInvoice = result.taxData as unknown as Invoice;
    } else {
      this.compareTaxInvoice = null;
    }

    if (result.internalData) {
      this.compareAiInvoice = result.internalData as unknown as Invoice;
    } else {
      this.compareAiInvoice = null;
    }

    this.loadingCompareData = false;
    console.log('📋 Compare modal opened:', result.invoiceKey);
    console.log('📋 Tax invoice:', this.compareTaxInvoice);
    console.log('📋 AI invoice:', this.compareAiInvoice);
  }

  /**
   * Đóng modal so sánh hóa đơn
   */
  closeCompareModal(): void {
    this.showCompareModal = false;
    this.compareResult = null;
    this.compareTaxInvoice = null;
    this.compareAiInvoice = null;
  }

  /**
   * Xóa một kết quả đối chiếu
   */
  deleteReconciliationResult(result: ReconciliationResult): void {
    const confirmMsg = `Bạn có chắc muốn xóa kết quả đối chiếu cho hóa đơn ${result.invoiceKey}?`;
    if (!confirm(confirmMsg)) return;

    this.invoiceService.deleteReconciliationResult(result.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Xóa khỏi danh sách hiện tại
            this.reconciliationResults = this.reconciliationResults.filter(r => r.id !== result.id);
            console.log('🗑️ Deleted reconciliation result:', result.id);
          } else {
            alert('Lỗi xóa: ' + response.message);
          }
        },
        error: (err) => {
          console.error('Error deleting reconciliation result:', err);
          alert('Lỗi xóa: ' + err.message);
        }
      });
  }

  /**
   * Lấy class CSS cho status đối chiếu
   */
  getReconcileResultStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'MATCH': 'result-match',
      'MISMATCH': 'result-mismatch',
      'MISSING_INTERNAL': 'result-missing',
      'MISSING_TAX': 'result-missing'
    };
    return classes[status] || '';
  }

  /**
   * Lấy label cho status đối chiếu
   */
  getReconcileResultStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'MATCH': 'Khớp',
      'MISMATCH': 'Sai số',
      'MISSING_INTERNAL': 'Thiếu bên AI',
      'MISSING_TAX': 'Thiếu bên Thuế'
    };
    return labels[status] || status;
  }

  /**
   * Format giá trị sai lệch để hiển thị
   */
  formatDiffValue(diff: FieldDiff): string {
    if (diff.diffType === 'number') {
      if (typeof diff.diff === 'number') {
        const prefix = diff.diff > 0 ? '+' : '';
        return prefix + this.formatCurrency(diff.diff);
      }
    }
    return String(diff.diff || '');
  }

  /**
   * Lấy số lượng field diffs (handle undefined/null)
   */
  getFieldDiffsCount(result: ReconciliationResult): number {
    return result.fieldDiffs?.length || 0;
  }

  // ==========================================================================
  // DELETE METHODS
  // ==========================================================================

  /**
   * Clear invoices by source
   */
  clearBySource(source: InvoiceSource): void {
    const label = this.invoiceService.getSourceLabel(source);
    const confirmed = confirm(
      `⚠️ CẢNH BÁO!\n\n` +
      `Bạn có chắc chắn muốn xóa TẤT CẢ hóa đơn từ ${label}?\n\n` +
      `Hành động này KHÔNG THỂ hoàn tác!`
    );

    if (!confirmed) return;

    this.clearing = true;

    this.invoiceService.clearBySource(source)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.clearing = false)
      )
      .subscribe({
        next: async (result) => {
          alert(`✅ Đã xóa ${result.deleted} hóa đơn từ ${label}`);
          await this.cacheService.clearAllCache();  // Xóa tất cả cache bao gồm summary
          this.applyFilter(true);
          this.loadGmailLabels();  // Reload suppliers dropdown
        },
        error: (err) => {
          console.error('Error clearing:', err);
          alert('Lỗi xóa: ' + err.message);
        }
      });
  }

  /**
   * Clear all invoices
   */
  clearAll(): void {
    const confirmed = confirm(
      `⚠️ CẢNH BÁO QUAN TRỌNG!\n\n` +
      `Bạn có chắc chắn muốn xóa TẤT CẢ hóa đơn?\n\n` +
      `Hành động này KHÔNG THỂ hoàn tác!`
    );

    if (!confirmed) return;

    const doubleConfirm = confirm(
      `🔴 XÁC NHẬN LẦN CUỐI\n\n` +
      `Nhấn OK để XÓA VĨNH VIỄN tất cả hóa đơn.`
    );

    if (!doubleConfirm) return;

    this.clearing = true;

    this.invoiceService.clearAll()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.clearing = false)
      )
      .subscribe({
        next: async (result) => {
          alert(`✅ Đã xóa ${result.taxDeleted} hóa đơn thuế + ${result.aiDeleted} hóa đơn AI`);
          await this.cacheService.clearAllCache();
          this.applyFilter(true);
          this.loadGmailLabels();  // Reload suppliers dropdown
        },
        error: (err) => {
          console.error('Error clearing all:', err);
          alert('Lỗi xóa: ' + err.message);
        }
      });
  }

  // ==========================================================================
  // PORTAL & PROVIDER METHODS
  // ==========================================================================

  /**
   * Load invoice providers from KeToanBackEnd
   */
  async loadProviders(): Promise<void> {
    // Try IndexedDB cache first (24h expiry)
    const cached = await this.cacheService.getCachedProviders();
    if (cached && cached.length > 0) {
      this.providerOptions = cached;
      console.log('📦 Providers from cache:', cached.length);
      return;
    }

    // Cache miss → call API
    this.invoiceService.getInternalProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.providerOptions = result.providers;
          console.log('✅ Providers from API:', result.providers.length);
          this.cacheService.cacheProviders(result.providers);
        },
        error: (err) => console.error('Error loading providers:', err)
      });
  }

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

  /**
   * Filter by provider
   */
  filterByProvider(provider: string): void {
    this.selectedProvider = provider;
    this.applyFilter(true);
  }

  /**
   * Get provider badge class
   */
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

  /**
   * Get source tab label
   */
  getSourceTabLabel(sourceTab: string): string {
    const labels: Record<string, string> = {
      'upload': 'XML',
      'pdf': 'PDF',
      'email': 'Email',
      'clone_image': 'Clone'
    };
    return labels[sourceTab] || sourceTab || '';
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

  getStatusLabel(status: ReconcileStatus): string {
    return this.invoiceService.getStatusLabel(status);
  }

  getStatusClass(status: ReconcileStatus): string {
    return this.invoiceService.getStatusClass(status);
  }

  getSourceLabel(source: InvoiceSource): string {
    return this.invoiceService.getSourceLabel(source);
  }

  /**
   * Reset filter to default
   */
  resetFilter(): void {
    const today = new Date().toISOString().split('T')[0];
    console.log('🔄 resetFilter() → today:', today);
    this.filterForm.reset({ fromDate: today, toDate: today, gmailLabel: '', pageSize: 25 });
    this.applyFilter();
  }

  /**
   * Force reload data (bỏ qua cache)
   * Dùng cho nút "Tải lại"
   */
  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading data...');
    await this.cacheService.clearAllCache();  // Xóa tất cả cache bao gồm summary
    this.applyFilter(true);
    this.loadGmailLabels();  // Reload suppliers dropdown
  }

  /**
   * Track by function for ngFor
   */
  trackByInvoice(_index: number, invoice: Invoice): string {
    return invoice.id;
  }

  // ==========================================================================
  // GDT DIRECT FETCH — Tax portal live data
  // ==========================================================================

  switchMainTab(tab: 'reconcile' | 'portal'): void {
    this.activeMainTab = tab;
  }

  fetchFromGdt(): void {
    if (!this.hddtService.hasToken()) {
      alert('Chưa đăng nhập GDT. Vui lòng đăng nhập tại trang Hóa đơn mua vào trước.');
      return;
    }

    const values = this.filterForm.value;
    const today = new Date();
    const fromDate = values.fromDate ? new Date(values.fromDate) : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = values.toDate ? new Date(values.toDate) : today;
    const mapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
    const mst = mapping?.supplierTaxCode || '';
    console.log('🏛️ fetchFromGdt()', { fromDate: values.fromDate, toDate: values.toDate, gmailLabel: values.gmailLabel, mst });

    this.fetchingGdt = true;
    this.gdtError = '';
    this.loadingTax = true;

    this.hddtService.getPurchaseInvoicesInRange(fromDate, toDate, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.fetchingGdt = false; this.loadingTax = false; }))
      .subscribe({
        next: (invoices) => {
          this.hddtInvoices = mst ? invoices.filter(inv => inv.nbmst === mst) : invoices;
          this.gdtMode = true;
        },
        error: (err) => {
          this.gdtError = err.message || 'Lỗi tải từ GDT';
        }
      });
  }

  resetGdtMode(): void {
    this.gdtMode = false;
    this.hddtInvoices = [];
    this.gdtError = '';
    this.loadTaxInvoices({ ...this.currentFilter, source: 'TAX_PORTAL' });
  }

  getHddtInvoiceNo(inv: HddtInvoice): string {
    return `${inv.khhdon}-${inv.shdon}`;
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
            source: 'AI_PDF' as InvoiceSource,
            reconcileStatus: 'PENDING' as ReconcileStatus,
            createdAt: pl.issueDate,
            portalUrl: pl.portalUrl,
            portalPdfUrl: pl.portalPdfUrl,
            invoiceProvider: pl.invoiceProvider,
            portalCredentials: pl.portalCredentials,
            gmailFrom: pl.gmailFrom,
            gmailMessageId: pl.gmailId,
            gmailThreadId: (pl as any).gmailThreadId || pl.gmailId,
          } as Invoice));

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

  togglePortalCredentials(id: string): void {
    this.expandedPortalLinkId = this.expandedPortalLinkId === id ? null : id;
  }

  getCredentialsDisplay(inv: Invoice): string {
    if (!inv.portalCredentials) return '';
    const c = inv.portalCredentials as Record<string, string>;
    const parts: string[] = [];
    if (c['secretCode']) parts.push(`Mã BM: ${c['secretCode']}`);
    if (c['taxCode']) parts.push(`MST: ${c['taxCode']}`);
    if (c['lookupCode']) parts.push(`Mã TC: ${c['lookupCode']}`);
    return parts.join('  |  ');
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
}
