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
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  FieldDiff
} from '../invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';

@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  // Suppliers for dropdown
  suppliers: Supplier[] = [];

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
  loadingSuppliers = false;
  loadingSummary = false;
  reconciling = false;
  clearing = false;
  importing = false;

  // Current filter
  currentFilter: InvoiceFilter = {};

  // Options
  yearOptions: number[] = [];
  monthOptions: { value: string; label: string }[] = [];

  // Destroy subject
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceServiceV2,
    private cacheService: AccountantCacheService
  ) {
    const currentYear = new Date().getFullYear();
    const today = this.formatDateToDisplay(new Date());

    this.filterForm = this.fb.group({
      source: [''],           // '' = tất cả, 'TAX_PORTAL', 'AI_PDF'
      filterType: ['all'],    // 'all', 'month', 'year', 'range' - Mặc định là tất cả để thấy data ngay
      monthKey: [`${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`],
      year: [currentYear],
      fromDate: [today],      // Giữ giá trị để khi user đổi qua 'range' thì có sẵn
      toDate: [today],        // Giữ giá trị để khi user đổi qua 'range' thì có sẵn
      supplierTaxCode: [''],
      reconcileStatus: [''],  // '', 'PENDING', 'MATCHED', 'UNMATCHED', 'MISMATCH'
      pageSize: [25]
    });

    // Generate options
    this.yearOptions = this.invoiceService.getYearOptions();
    this.monthOptions = this.invoiceService.getMonthOptions(currentYear);
  }

  ngOnInit(): void {
    console.log('Ledger 8 V2 initialized');

    // Load suppliers for dropdown
    this.loadSuppliers();

    // Load default data (30 ngày gần nhất)
    this.loadDefault();

    // Listen to year changes to update month options
    this.filterForm.get('year')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(year => {
        this.monthOptions = this.invoiceService.getMonthOptions(year);
      });
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
    const baseFilter: InvoiceFilter = {
      pageSize: values.pageSize
    };

    // Date filter based on type
    switch (values.filterType) {
      case 'all':
        // Không filter theo ngày - lấy tất cả
        break;
      case 'month':
        if (values.monthKey) {
          baseFilter.monthKey = values.monthKey;
        }
        break;
      case 'year':
        if (values.year) {
          baseFilter.year = values.year;
        }
        break;
      case 'range':
        // Convert dd/mm/yyyy -> yyyy-mm-dd cho API
        if (values.fromDate) {
          baseFilter.fromDate = this.parseDisplayDateToApi(values.fromDate);
        }
        if (values.toDate) {
          baseFilter.toDate = this.parseDisplayDateToApi(values.toDate);
        }
        break;
    }

    // Supplier filter
    if (values.supplierTaxCode) {
      baseFilter.supplierTaxCode = values.supplierTaxCode;
    }

    // Status filter
    if (values.reconcileStatus) {
      baseFilter.reconcileStatus = values.reconcileStatus as ReconcileStatus;
    }

    this.currentFilter = baseFilter;

    // Load cả 2 nguồn song song
    this.loadTaxInvoices({ ...baseFilter, source: 'TAX_PORTAL' }, forceReload);
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

    // Thử lấy từ cache trước (nếu không force reload)
    if (!forceReload) {
      const cached = await this.cacheService.getCachedInvoices(filter);
      if (cached) {
        this.aiInvoices = cached.invoices;
        this.aiPagination = cached.pagination;
        this.loadingAi = false;
        console.log('📦 AI_PDF loaded from cache:', cached.invoices.length, 'invoices');
        return;
      }
    }

    this.invoiceService.getInvoices(filter)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingAi = false)
      )
      .subscribe({
        next: async (result) => {
          this.aiInvoices = result.invoices;
          this.aiPagination = result.pagination;
          console.log('✅ AI_PDF:', result.invoices.length, 'invoices');
          // Lưu vào cache
          await this.cacheService.cacheInvoices(filter, result.invoices, result.pagination);
        },
        error: (err) => {
          console.error('Error loading AI invoices:', err);
        }
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

    this.loadingAi = true;
    const filter: InvoiceFilter = { ...this.currentFilter, source: 'AI_PDF' };

    this.invoiceService.getNextPage(filter, this.aiPagination.lastDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingAi = false)
      )
      .subscribe({
        next: (result) => {
          this.aiInvoices = result.invoices;
          this.aiPagination = result.pagination;
        },
        error: (err) => console.error('Error:', err)
      });
  }

  /**
   * Load trang trước cho AI_PDF
   */
  prevAiPage(): void {
    if (!this.aiPagination.hasPrev || !this.aiPagination.firstDocId) return;

    this.loadingAi = true;
    const filter: InvoiceFilter = { ...this.currentFilter, source: 'AI_PDF' };

    this.invoiceService.getPrevPage(filter, this.aiPagination.firstDocId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingAi = false)
      )
      .subscribe({
        next: (result) => {
          this.aiInvoices = result.invoices;
          this.aiPagination = result.pagination;
        },
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
   * Load suppliers for dropdown
   */
  loadSuppliers(): void {
    this.loadingSuppliers = true;

    this.invoiceService.getSuppliers()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingSuppliers = false)
      )
      .subscribe({
        next: (suppliers) => {
          this.suppliers = suppliers;
        },
        error: (err) => console.error('Error loading suppliers:', err)
      });
  }

  /**
   * Load reconciliation summary (sử dụng cache nếu có)
   */
  async loadSummary(forceReload = false): Promise<void> {
    this.loadingSummary = true;
    const values = this.filterForm.value;

    let monthKey: string | undefined;
    let year: number | undefined;

    if (values.filterType === 'month') {
      monthKey = values.monthKey;
    } else if (values.filterType === 'year') {
      year = values.year;
    }

    // Thử lấy từ cache trước
    if (!forceReload) {
      const cached = await this.cacheService.getCachedSummary(monthKey, year);
      if (cached) {
        this.summary = cached;
        this.loadingSummary = false;
        console.log('📦 Summary loaded from cache');
        return;
      }
    }

    this.invoiceService.getReconciliationSummary(monthKey, year)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingSummary = false)
      )
      .subscribe({
        next: async (summary) => {
          this.summary = summary;
          // Lưu vào cache
          await this.cacheService.cacheSummary(summary, monthKey, year);
        },
        error: (err) => console.error('Error loading summary:', err)
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
            this.loadSuppliers();
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
    const values = this.filterForm.value;
    const monthKey = values.filterType === 'month' ? values.monthKey : undefined;

    const confirmMsg = monthKey
      ? `Bạn có muốn chạy đối chiếu cho tháng ${monthKey}?`
      : 'Bạn có muốn chạy đối chiếu cho tất cả hóa đơn?';

    if (!confirm(confirmMsg)) return;

    this.reconciling = true;

    this.invoiceService.runReconciliation(monthKey)
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
          this.loadSuppliers();  // Reload suppliers dropdown
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
          this.loadSuppliers();  // Reload suppliers dropdown
        },
        error: (err) => {
          console.error('Error clearing all:', err);
          alert('Lỗi xóa: ' + err.message);
        }
      });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Format Date object thành dd/mm/yyyy để hiển thị
   */
  formatDateToDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse dd/mm/yyyy thành yyyy-mm-dd cho API
   */
  parseDisplayDateToApi(displayDate: string): string {
    if (!displayDate) return '';
    const parts = displayDate.split('/');
    if (parts.length !== 3) return displayDate;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Validate format dd/mm/yyyy
   */
  isValidDisplayDate(dateStr: string): boolean {
    if (!dateStr) return false;
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;

    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 2000 || year > 2100) return false;

    return true;
  }

  /**
   * Validate date input khi blur
   */
  validateDateInput(fieldName: 'fromDate' | 'toDate'): void {
    const value = this.filterForm.get(fieldName)?.value;
    if (value && !this.isValidDisplayDate(value)) {
      alert(`Ngày không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy`);
      // Reset về hôm nay
      this.filterForm.patchValue({
        [fieldName]: this.formatDateToDisplay(new Date())
      });
    }
  }

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
    const currentYear = new Date().getFullYear();
    const today = this.formatDateToDisplay(new Date());

    this.filterForm.reset({
      source: '',
      filterType: 'all', // Reset về mặc định là tất cả để thấy data ngay
      monthKey: `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
      year: currentYear,
      fromDate: today,
      toDate: today,
      supplierTaxCode: '',
      reconcileStatus: '',
      pageSize: 25
    });

    this.applyFilter();
    this.loadSuppliers();
  }

  /**
   * Force reload data (bỏ qua cache)
   * Dùng cho nút "Tải lại"
   */
  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading data...');
    await this.cacheService.clearAllCache();  // Xóa tất cả cache bao gồm summary
    this.applyFilter(true);
    this.loadSuppliers();  // Reload suppliers dropdown
  }

  /**
   * Track by function for ngFor
   */
  trackByInvoice(index: number, invoice: Invoice): string {
    return invoice.id;
  }
}
