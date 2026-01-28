/**
 * LEDGER 9 - ĐỒNG BỘ HÓA ĐƠN ĐẦU RA (Output Invoices)
 * Đồng bộ hóa đơn từ Trang thuế với Hóa đơn KiotViet
 * Scalable component cho 100.000+ hóa đơn
 *
 * Features:
 * - Pagination với cursor-based navigation
 * - Filter theo ngày/tháng/năm/KH
 * - Mặc định filter theo ngày hôm nay (range)
 * - Local invoices load trực tiếp từ KiotViet API
 * - Reconciliation summary
 * - IndexedDB cache để giảm API calls
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { OutputInvoiceServiceV2, OutputInvoice, OutputInvoiceFilter, OutputInvoiceSource, OutputPagination, OutputReconciliationSummary, OutputReconcileStatus, OutputReconciliationResult, OutputFieldDiff } from '../output-invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';
import { KiotvietService, KiotVietInvoice } from '../../../services/kiotviet.service';

@Component({
  selector: 'app-ledger-9-dong-bo-hoa-don-dau-ra',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ledger-9-dong-bo-hoa-don-dau-ra.component.html',
  styleUrls: ['./ledger-9-dong-bo-hoa-don-dau-ra.component.css']
})
export class Ledger9DongBoHoaDonDauRaComponent implements OnInit, OnDestroy {
  // Filter form
  filterForm: FormGroup;

  // Data - Tách riêng 2 nguồn để hiển thị song song
  taxInvoices: OutputInvoice[] = [];       // Hóa đơn từ trang thuế (TAX_PORTAL_OUTPUT)
  localInvoices: OutputInvoice[] = [];     // Hóa đơn từ Local (KiotViet) - hiển thị trên UI (phân trang)
  allLocalInvoices: OutputInvoice[] = [];  // Tất cả hóa đơn KiotViet (trước phân trang)
  kiotVietInvoices: KiotVietInvoice[] = []; // Raw data từ KiotViet API

  // Frontend pagination cho KiotViet (vì KiotViet API không hỗ trợ cursor pagination)
  localCurrentPage = 0;

  // Pagination riêng cho từng nguồn
  taxPagination: OutputPagination = {
    hasNext: false,
    hasPrev: false,
    firstDocId: null,
    lastDocId: null,
    pageSize: 25,
    count: 0
  };
  localPagination: OutputPagination = {
    hasNext: false,
    hasPrev: false,
    firstDocId: null,
    lastDocId: null,
    pageSize: 25,
    count: 0
  };

  // Customers for dropdown
  customers: string[] = [];

  // Reconciliation summary
  summary: OutputReconciliationSummary | null = null;

  // Reconciliation results (chi tiết sai lệch)
  reconciliationResults: OutputReconciliationResult[] = [];
  selectedResult: OutputReconciliationResult | null = null;
  showMismatchModal = false;
  loadingResults = false;

  // Loading states
  loading = false;
  loadingTax = false;        // Loading cho bảng TAX_PORTAL_OUTPUT
  loadingLocal = false;      // Loading cho bảng KiotViet
  loadingCustomers = false;
  loadingSummary = false;
  reconciling = false;
  clearing = false;
  importing = false;

  // Current filter
  currentFilter: OutputInvoiceFilter = {};

  // Options
  yearOptions: number[] = [];
  monthOptions: { value: string; label: string }[] = [];

  // Destroy subject
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private invoiceService: OutputInvoiceServiceV2,
    private cacheService: AccountantCacheService,
    private kiotvietService: KiotvietService
  ) {
    const currentYear = new Date().getFullYear();
    const today = this.formatDateToDisplay(new Date());

    this.filterForm = this.fb.group({
      source: [''],           // '' = tất cả, 'TAX_PORTAL_OUTPUT', 'LOCAL'
      filterType: ['range'],  // 'all', 'month', 'year', 'range' - Mặc định là 'range' (hôm nay)
      monthKey: [`${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`],
      year: [currentYear],
      fromDate: [today],
      toDate: [today],
      customerName: [''],
      reconcileStatus: [''],  // '', 'PENDING', 'MATCHED', 'UNMATCHED', 'MISMATCH'
      pageSize: [25]
    });

    // Generate options
    this.yearOptions = this.invoiceService.getYearOptions();
    this.monthOptions = this.invoiceService.getMonthOptions(currentYear);
  }

  ngOnInit(): void {
    console.log('Ledger 9 - Output Invoices initialized');

    // Load customers for dropdown
    this.loadCustomers();

    // Load default data
    this.loadDefault();

    // Listen to year changes to update month options
    this.filterForm.get('year')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(year => {
        this.monthOptions = this.invoiceService.getMonthOptions(year);
      });

    // Listen to pageSize changes to update KiotViet pagination
    this.filterForm.get('pageSize')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Reset về trang đầu và áp dụng lại phân trang với pageSize mới
        if (this.allLocalInvoices.length > 0) {
          this.localCurrentPage = 0;
          this.applyLocalPagination();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================================================
  // LOAD METHODS
  // ==========================================================================

  loadDefault(): void {
    this.applyFilter();
  }

  /**
   * Apply filter and reload - Load cả 2 nguồn song song
   */
  applyFilter(forceReload = false): void {
    const values = this.filterForm.value;
    const baseFilter: OutputInvoiceFilter = {
      pageSize: values.pageSize
    };

    // Date filter based on type
    switch (values.filterType) {
      case 'all':
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
        if (values.fromDate) {
          baseFilter.fromDate = this.parseDisplayDateToApi(values.fromDate);
        }
        if (values.toDate) {
          baseFilter.toDate = this.parseDisplayDateToApi(values.toDate);
        }
        break;
    }

    // Customer filter
    if (values.customerName) {
      baseFilter.customerName = values.customerName;
    }

    // Status filter
    if (values.reconcileStatus) {
      baseFilter.reconcileStatus = values.reconcileStatus as OutputReconcileStatus;
    }

    this.currentFilter = baseFilter;

    // Load cả 2 nguồn song song
    this.loadTaxInvoices({ ...baseFilter, source: 'TAX_PORTAL_OUTPUT' }, forceReload);
    this.loadLocalInvoices({ ...baseFilter, source: 'LOCAL' }, forceReload);
    this.loadSummary(forceReload);
  }

  /**
   * Load hóa đơn từ TAX_PORTAL_OUTPUT (trang thuế - đầu ra)
   */
  async loadTaxInvoices(filter: OutputInvoiceFilter, forceReload = false): Promise<void> {
    this.loadingTax = true;

    // Thử lấy từ cache trước (nếu không force reload)
    if (!forceReload) {
      const cached = await this.cacheService.getCachedOutputInvoices(filter);
      if (cached) {
        this.taxInvoices = cached.invoices;
        this.taxPagination = cached.pagination;
        this.loadingTax = false;
        console.log('📦 TAX_PORTAL_OUTPUT loaded from cache:', cached.invoices.length, 'invoices');
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
          console.log('✅ TAX_PORTAL_OUTPUT:', result.invoices.length, 'invoices');
          // Lưu vào cache
          await this.cacheService.cacheOutputInvoices(filter, result.invoices, result.pagination);
        },
        error: (err) => {
          console.error('Error loading TAX OUTPUT invoices:', err);
        }
      });
  }

  /**
   * Load hóa đơn từ LOCAL (KiotViet API trực tiếp)
   */
  async loadLocalInvoices(filter: OutputInvoiceFilter, forceReload = false): Promise<void> {
    this.loadingLocal = true;

    try {
      // Lấy fromDate và toDate từ filter
      let fromDate: string;
      let toDate: string;

      if (filter.fromDate && filter.toDate) {
        fromDate = filter.fromDate;
        toDate = filter.toDate;
      } else if (filter.monthKey) {
        // Nếu filter theo tháng, tính fromDate và toDate
        const parts = filter.monthKey.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        // Tính ngày cuối tháng
        const lastDay = new Date(year, month, 0).getDate();
        toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      } else if (filter.year) {
        // Filter theo năm
        fromDate = `${filter.year}-01-01`;
        toDate = `${filter.year}-12-31`;
      } else {
        // Mặc định: hôm nay
        const today = new Date();
        fromDate = today.toISOString().split('T')[0];
        toDate = fromDate;
      }

      console.log(`📡 Loading KiotViet invoices from ${fromDate} to ${toDate}...`);

      // Gọi KiotViet API trực tiếp
      const kiotVietInvoices = await this.kiotvietService.getInvoices(fromDate, toDate);
      this.kiotVietInvoices = kiotVietInvoices;

      // Convert KiotViet invoices sang OutputInvoice format và lưu tất cả
      this.allLocalInvoices = this.convertKiotVietToOutputInvoices(kiotVietInvoices);

      // Reset về trang đầu và áp dụng phân trang frontend
      this.localCurrentPage = 0;
      this.applyLocalPagination();

      console.log(`✅ LOCAL (KiotViet): ${this.allLocalInvoices.length} total invoices loaded`);

    } catch (err: any) {
      console.error('Error loading KiotViet invoices:', err);
      this.allLocalInvoices = [];
      this.localInvoices = [];
      this.localPagination = {
        hasNext: false,
        hasPrev: false,
        firstDocId: null,
        lastDocId: null,
        pageSize: 0,
        count: 0
      };

      // Hiển thị lỗi nếu là lỗi token
      if (err.message?.includes('KIOTVIET_TOKEN_EXPIRED') || err.message?.includes('đăng nhập')) {
        alert('Phiên đăng nhập KiotViet đã hết hạn. Vui lòng đăng nhập lại.');
      }
    } finally {
      this.loadingLocal = false;
    }
  }

  /**
   * Áp dụng phân trang frontend cho KiotViet invoices
   */
  private applyLocalPagination(): void {
    const pageSize = this.filterForm.value.pageSize || 25;
    const startIndex = this.localCurrentPage * pageSize;
    const endIndex = startIndex + pageSize;

    // Lấy slice của data cho trang hiện tại
    this.localInvoices = this.allLocalInvoices.slice(startIndex, endIndex);

    // Tính toán pagination info
    const totalCount = this.allLocalInvoices.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    this.localPagination = {
      hasNext: this.localCurrentPage < totalPages - 1,
      hasPrev: this.localCurrentPage > 0,
      firstDocId: this.localInvoices.length > 0 ? this.localInvoices[0].id : null,
      lastDocId: this.localInvoices.length > 0 ? this.localInvoices[this.localInvoices.length - 1].id : null,
      pageSize: pageSize,
      count: totalCount  // Tổng số hóa đơn (không phải số hiển thị)
    };
  }

  /**
   * Convert KiotViet invoice sang OutputInvoice format
   */
  private convertKiotVietToOutputInvoices(kiotVietInvoices: KiotVietInvoice[]): OutputInvoice[] {
    return kiotVietInvoices.map(inv => {
      // Parse date từ KiotViet format
      const purchaseDate = inv.PurchaseDate ? inv.PurchaseDate.split('T')[0] : '';

      return {
        id: String(inv.Id),
        invoiceNo: inv.Code || '',
        invoiceSymbol: '',
        invoiceDate: purchaseDate,
        issueDate: purchaseDate,
        customerName: inv.CustomerName || 'Khách lẻ',
        customerTaxCode: '',
        customerAddress: inv.CustomerAddress || '',
        totalBeforeVat: inv.SubTotal || inv.Total || 0,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: inv.TotalPayment || inv.Total || 0,
        source: 'LOCAL' as OutputInvoiceSource,
        reconcileStatus: 'PENDING' as OutputReconcileStatus,
        createdAt: inv.CreatedDate,
        updatedAt: inv.CreatedDate
      };
    });
  }

  /**
   * Load trang tiếp cho TAX_PORTAL_OUTPUT
   */
  nextTaxPage(): void {
    if (!this.taxPagination.hasNext || !this.taxPagination.lastDocId) return;

    this.loadingTax = true;
    const filter: OutputInvoiceFilter = { ...this.currentFilter, source: 'TAX_PORTAL_OUTPUT' };

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
   * Load trang trước cho TAX_PORTAL_OUTPUT
   */
  prevTaxPage(): void {
    if (!this.taxPagination.hasPrev || !this.taxPagination.firstDocId) return;

    this.loadingTax = true;
    const filter: OutputInvoiceFilter = { ...this.currentFilter, source: 'TAX_PORTAL_OUTPUT' };

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
   * Load trang tiếp cho LOCAL (frontend pagination)
   */
  nextLocalPage(): void {
    if (!this.localPagination.hasNext) return;
    this.localCurrentPage++;
    this.applyLocalPagination();
  }

  /**
   * Load trang trước cho LOCAL (frontend pagination)
   */
  prevLocalPage(): void {
    if (!this.localPagination.hasPrev) return;
    this.localCurrentPage--;
    this.applyLocalPagination();
  }

  /**
   * Load customers for dropdown
   */
  loadCustomers(): void {
    this.loadingCustomers = true;

    this.invoiceService.getCustomers()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingCustomers = false)
      )
      .subscribe({
        next: (customers) => {
          this.customers = customers;
        },
        error: (err) => console.error('Error loading customers:', err)
      });
  }

  /**
   * Load reconciliation summary
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
      const cached = await this.cacheService.getCachedOutputSummary(monthKey, year);
      if (cached) {
        this.summary = cached;
        this.loadingSummary = false;
        console.log('📦 Output Summary loaded from cache');
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
          await this.cacheService.cacheOutputSummary(summary, monthKey, year);
        },
        error: (err) => console.error('Error loading summary:', err)
      });
  }

  // ==========================================================================
  // IMPORT METHODS
  // ==========================================================================

  /**
   * Upload and import XML files (output invoices from tax portal)
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
            await this.cacheService.invalidateOutputBySource('TAX_PORTAL_OUTPUT');
            this.loadCustomers();
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

  /**
   * Reload local invoices từ KiotViet
   */
  reloadLocalInvoices(): void {
    this.loadLocalInvoices({ ...this.currentFilter, source: 'LOCAL' }, true);
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
      : 'Bạn có muốn chạy đối chiếu cho tất cả hóa đơn đầu ra?';

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
          this.cacheService.clearAllOutputCache();
          this.applyFilter(true);
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
          console.log('📋 Loaded output reconciliation results:', response.count);
        },
        error: (err) => {
          console.error('Error loading reconciliation results:', err);
        }
      });
  }

  /**
   * Hiển thị chi tiết sai lệch cho 1 hóa đơn
   */
  showMismatchDetails(result: OutputReconciliationResult): void {
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
   * Xóa một kết quả đối chiếu
   */
  deleteReconciliationResult(result: OutputReconciliationResult): void {
    const confirmMsg = `Bạn có chắc muốn xóa kết quả đối chiếu cho hóa đơn ${result.invoiceKey}?`;
    if (!confirm(confirmMsg)) return;

    this.invoiceService.deleteReconciliationResult(result.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
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
      'MISSING_LOCAL': 'result-missing',
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
      'MISSING_LOCAL': 'Thiếu bên Local',
      'MISSING_TAX': 'Thiếu bên Thuế'
    };
    return labels[status] || status;
  }

  /**
   * Format giá trị sai lệch để hiển thị
   */
  formatDiffValue(diff: OutputFieldDiff): string {
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
  getFieldDiffsCount(result: OutputReconciliationResult): number {
    return result.fieldDiffs?.length || 0;
  }

  // ==========================================================================
  // DELETE METHODS
  // ==========================================================================

  /**
   * Clear invoices by source
   */
  clearBySource(source: OutputInvoiceSource): void {
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
          await this.cacheService.clearAllOutputCache();
          this.applyFilter(true);
          this.loadCustomers();
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
      `Bạn có chắc chắn muốn xóa TẤT CẢ hóa đơn đầu ra?\n\n` +
      `Hành động này KHÔNG THỂ hoàn tác!`
    );

    if (!confirmed) return;

    const doubleConfirm = confirm(
      `🔴 XÁC NHẬN LẦN CUỐI\n\n` +
      `Nhấn OK để XÓA VĨNH VIỄN tất cả hóa đơn đầu ra.`
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
          alert(`✅ Đã xóa ${result.taxDeleted} hóa đơn thuế + ${result.localDeleted} hóa đơn local`);
          await this.cacheService.clearAllOutputCache();
          this.applyFilter(true);
          this.loadCustomers();
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

  formatDateToDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  parseDisplayDateToApi(displayDate: string): string {
    if (!displayDate) return '';
    const parts = displayDate.split('/');
    if (parts.length !== 3) return displayDate;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

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

  validateDateInput(fieldName: 'fromDate' | 'toDate'): void {
    const value = this.filterForm.get(fieldName)?.value;
    if (value && !this.isValidDisplayDate(value)) {
      alert(`Ngày không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy`);
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

  getStatusLabel(status: OutputReconcileStatus | undefined): string {
    return this.invoiceService.getStatusLabel(status);
  }

  getStatusClass(status: OutputReconcileStatus | undefined): string {
    return this.invoiceService.getStatusClass(status);
  }

  getSourceLabel(source: OutputInvoiceSource): string {
    return this.invoiceService.getSourceLabel(source);
  }

  resetFilter(): void {
    const currentYear = new Date().getFullYear();
    const today = this.formatDateToDisplay(new Date());

    this.filterForm.reset({
      source: '',
      filterType: 'range',  // Mặc định là 'range' (hôm nay)
      monthKey: `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
      year: currentYear,
      fromDate: today,
      toDate: today,
      customerName: '',
      reconcileStatus: '',
      pageSize: 25
    });

    this.applyFilter();
    this.loadCustomers();
  }

  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading output data...');
    await this.cacheService.clearAllOutputCache();
    this.applyFilter(true);
    this.loadCustomers();
  }

  trackByInvoice(index: number, invoice: OutputInvoice): string {
    return invoice.id;
  }

  /**
   * Tính tổng số trang cho KiotViet invoices
   */
  getTotalLocalPages(): number {
    const pageSize = this.filterForm.value.pageSize || 25;
    return Math.max(1, Math.ceil(this.allLocalInvoices.length / pageSize));
  }
}
