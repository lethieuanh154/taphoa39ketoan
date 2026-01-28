/**
 * INVOICE SERVICE V2 - SCALABLE VERSION
 * Angular service với pagination và optimized queries cho 100.000+ hóa đơn
 *
 * Features:
 * - Pagination với cursor-based navigation
 * - Filter theo ngày/tháng/năm/NCC
 * - Mặc định load 30 ngày gần nhất, 50 records
 * - Caching supplier list
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ============================================================================
// INTERFACES
// ============================================================================

export type InvoiceSource = 'TAX_PORTAL' | 'AI_PDF';
export type ReconcileStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'MISMATCH';

export interface Invoice {
  id: string;
  invoiceKey: string;
  invoiceNo: string;
  invoiceSymbol?: string;

  // Supplier
  supplierName: string;
  supplierTaxCode: string;
  supplierAddress?: string;

  // Buyer
  buyerName?: string;
  buyerTaxCode?: string;

  // Dates
  issueDate: string;  // ISO format
  issueDateKey: string;  // YYYY-MM-DD
  monthKey: string;  // YYYY-MM
  year: number;

  // Amounts
  totalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;

  // Source & Status
  source: InvoiceSource;
  reconcileStatus: ReconcileStatus;
  matchedInvoiceId?: string;

  // Items (chỉ có với AI_PDF)
  items?: InvoiceItem[];

  // Metadata
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Supplier {
  id: string;
  taxCode: string;
  name: string;
  address?: string;
  invoiceCount: number;
  lastInvoiceDate?: string;
}

export interface Pagination {
  hasNext: boolean;
  hasPrev: boolean;
  firstDocId: string | null;
  lastDocId: string | null;
  pageSize: number;
  count: number;
}

export interface InvoiceQueryResult {
  invoices: Invoice[];
  pagination: Pagination;
  error?: string;
}

export interface InvoiceFilter {
  source?: InvoiceSource;
  year?: number;
  monthKey?: string;
  fromDate?: string;  // YYYY-MM-DD
  toDate?: string;    // YYYY-MM-DD
  supplierTaxCode?: string;
  reconcileStatus?: ReconcileStatus;
  pageSize?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}

export interface ReconciliationSummary {
  taxPortalCount: number;
  aiPdfCount: number;
  matchedCount: number;
  unmatchedCount: number;
  mismatchCount: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  failed: number;
  errors?: string[];
  parseErrors?: string[];
}

/**
 * Chi tiết sai lệch giữa 2 hóa đơn
 */
export interface FieldDiff {
  field: string;
  fieldLabel: string;
  taxValue: any;
  internalValue: any;
  diff: any;
  diffType: 'number' | 'string' | 'date';
}

/**
 * Kết quả đối chiếu 1 hóa đơn
 */
export interface ReconciliationResult {
  id: string;
  invoiceKey: string;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_TAX';
  taxInvoiceId?: string;
  internalInvoiceId?: string;
  fieldDiffs: FieldDiff[];
  taxData?: {
    invoiceNo: string;
    invoiceSymbol?: string;
    invoiceDate: string;
    supplierName: string;
    supplierTaxCode: string;
    totalBeforeVat: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
  };
  internalData?: {
    invoiceNo: string;
    invoiceSymbol?: string;
    invoiceDate: string;
    supplierName: string;
    supplierTaxCode: string;
    supplierAddress?: string;
    totalBeforeVat: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
  };
  checkedAt: string;
}

/**
 * Dữ liệu hóa đơn từ AI parsing (Gemini 3 Flash)
 * Dùng cho invoice-processing-page
 */
export interface AiInvoiceData {
  invoiceNo: string;
  invoiceSymbol?: string;
  invoiceDate: string;              // YYYY-MM-DD
  supplier: {
    name: string;
    taxCode: string;
    address?: string;
  };
  buyer?: {
    name?: string;
    taxCode?: string;
    address?: string;
  };
  items: AiInvoiceItem[];
  totalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  confidence?: number;              // 0-1, from AI parsing
}

/**
 * Chi tiết hàng hóa trong hóa đơn AI
 */
export interface AiInvoiceItem {
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Hóa đơn AI đã lưu trong Firestore
 * Dùng cho dialog chọn hóa đơn đã xử lý trước đó
 */
export interface RecentAiInvoice {
  id: string;
  invoiceNo: string;
  invoiceSymbol?: string;
  invoiceDate: string;
  invoiceKey: string;
  supplier: {
    name: string;
    taxCode: string;
    address?: string;
  };
  supplierName: string;
  supplierTaxCode: string;
  buyer?: {
    name?: string;
    taxCode?: string;
    address?: string;
  };
  buyerName?: string;
  buyerTaxCode?: string;
  items: AiInvoiceItem[];
  totalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  source: string;
  aiModel?: string;
  confidence?: number;
  createdAt: string;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class InvoiceServiceV2 {
  private readonly apiUrl = `${environment.domainUrl}/api/v2/invoices`;

  // Cache suppliers
  private suppliersCache$ = new BehaviorSubject<Supplier[]>([]);

  // Current filter state
  private currentFilter$ = new BehaviorSubject<InvoiceFilter>({});

  constructor(private http: HttpClient) {}

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Query hóa đơn với filter và pagination
   */
  getInvoices(filter: InvoiceFilter = {}): Observable<InvoiceQueryResult> {
    let params = new HttpParams();

    if (filter.source) params = params.set('source', filter.source);
    if (filter.year) params = params.set('year', filter.year.toString());
    if (filter.monthKey) params = params.set('monthKey', filter.monthKey);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if (filter.supplierTaxCode) params = params.set('supplierTaxCode', filter.supplierTaxCode);
    if (filter.reconcileStatus) params = params.set('reconcileStatus', filter.reconcileStatus);
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());
    if (filter.cursor) params = params.set('cursor', filter.cursor);
    if (filter.direction) params = params.set('direction', filter.direction);

    return this.http.get<InvoiceQueryResult>(this.apiUrl, { params }).pipe(
      tap(result => console.log(`📊 Loaded ${result.invoices.length} invoices`)),
      catchError(this.handleError)
    );
  }

  /**
   * Load mặc định: 30 ngày gần nhất, 50 records
   */
  getInvoicesDefault(source?: InvoiceSource): Observable<InvoiceQueryResult> {
    let params = new HttpParams();
    if (source) params = params.set('source', source);

    return this.http.get<InvoiceQueryResult>(`${this.apiUrl}/default`, { params }).pipe(
      tap(result => console.log(`📊 Default load: ${result.invoices.length} invoices`)),
      catchError(this.handleError)
    );
  }

  /**
   * Load trang tiếp theo
   */
  getNextPage(currentFilter: InvoiceFilter, lastDocId: string): Observable<InvoiceQueryResult> {
    return this.getInvoices({
      ...currentFilter,
      cursor: lastDocId,
      direction: 'next'
    });
  }

  /**
   * Load trang trước
   */
  getPrevPage(currentFilter: InvoiceFilter, firstDocId: string): Observable<InvoiceQueryResult> {
    return this.getInvoices({
      ...currentFilter,
      cursor: firstDocId,
      direction: 'prev'
    });
  }

  // ==========================================================================
  // CREATE METHODS
  // ==========================================================================

  /**
   * Tạo 1 hóa đơn
   */
  createInvoice(invoice: Partial<Invoice>, source: InvoiceSource): Observable<{ success: boolean; message: string; docId?: string }> {
    return this.http.post<{ success: boolean; message: string; docId: string }>(
      this.apiUrl,
      { ...invoice, source }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Import nhiều hóa đơn (JSON)
   */
  batchImport(invoices: Partial<Invoice>[], source: InvoiceSource): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      `${this.apiUrl}/batch`,
      { invoices, source }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Import từ XML files (trang thuế)
   */
  importXml(files: File[]): Observable<ImportResult> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.http.post<ImportResult>(
      `${this.apiUrl}/import-xml`,
      formData
    ).pipe(
      tap(result => console.log(`📥 Imported ${result.imported} invoices from XML`)),
      catchError(this.handleError)
    );
  }

  /**
   * Lưu hóa đơn từ AI parsing (Gemini 3 Flash)
   * Dùng cho invoice-processing-page
   */
  saveAiInvoice(invoiceData: AiInvoiceData): Observable<{ success: boolean; message: string; docId?: string }> {
    console.log('💾 Saving AI invoice to Firestore...', invoiceData.invoiceNo);

    // Sử dụng API legacy vì invoice-processing-page vẫn dùng schema cũ
    return this.http.post<{ success: boolean; message: string; docId: string }>(
      `${this.apiUrl.replace('/v2/invoices', '/invoices')}/save-ai-invoice`,
      invoiceData
    ).pipe(
      tap(result => console.log(`✅ Saved AI invoice: ${invoiceData.invoiceNo}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy danh sách hóa đơn AI đã lưu trong N ngày gần đây
   * Dùng cho dialog chọn hóa đơn đã xử lý trước đó
   */
  getRecentAiInvoices(days: number = 1): Observable<{ success: boolean; invoices: RecentAiInvoice[]; total: number }> {
    const params = new HttpParams().set('days', days.toString());

    return this.http.get<{ success: boolean; invoices: RecentAiInvoice[]; total: number }>(
      `${this.apiUrl.replace('/v2/invoices', '/invoices')}/recent-ai-invoices`,
      { params }
    ).pipe(
      tap(result => console.log(`📋 Loaded ${result.total} recent AI invoices`)),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy chi tiết 1 hóa đơn AI theo ID
   */
  getAiInvoiceById(docId: string): Observable<{ success: boolean; invoice: RecentAiInvoice }> {
    return this.http.get<{ success: boolean; invoice: RecentAiInvoice }>(
      `${this.apiUrl.replace('/v2/invoices', '/invoices')}/ai-invoice/${docId}`
    ).pipe(
      tap(result => console.log(`📄 Loaded AI invoice: ${result.invoice?.invoiceNo}`)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // SUPPLIER METHODS
  // ==========================================================================

  /**
   * Lấy danh sách nhà cung cấp (cho dropdown)
   */
  getSuppliers(search?: string, limit: number = 50): Observable<Supplier[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (search) params = params.set('search', search);

    return this.http.get<{ suppliers: Supplier[]; count: number }>(
      `${this.apiUrl}/suppliers`,
      { params }
    ).pipe(
      map(res => res.suppliers),
      tap(suppliers => {
        if (!search) {
          this.suppliersCache$.next(suppliers);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy suppliers từ cache
   */
  getCachedSuppliers(): Observable<Supplier[]> {
    return this.suppliersCache$.asObservable();
  }

  // ==========================================================================
  // RECONCILIATION METHODS
  // ==========================================================================

  /**
   * Lấy tổng hợp đối chiếu
   */
  getReconciliationSummary(monthKey?: string, year?: number): Observable<ReconciliationSummary> {
    let params = new HttpParams();
    if (monthKey) params = params.set('monthKey', monthKey);
    if (year) params = params.set('year', year.toString());

    return this.http.get<ReconciliationSummary>(
      `${this.apiUrl}/reconciliation/summary`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Chạy đối chiếu tự động
   */
  runReconciliation(monthKey?: string): Observable<{
    success: boolean;
    processed: number;
    matched: number;
    unmatched: number;
    mismatch: number;
  }> {
    return this.http.post<any>(
      `${this.apiUrl}/reconciliation/run`,
      { monthKey }
    ).pipe(
      tap(result => console.log(`🔄 Reconciliation: ${result.matched} matched, ${result.unmatched} unmatched`)),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy danh sách kết quả đối chiếu với chi tiết sai lệch
   */
  getReconciliationResults(status?: string, limit: number = 50): Observable<{
    results: ReconciliationResult[];
    count: number;
  }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (status) params = params.set('status', status);

    return this.http.get<{ results: ReconciliationResult[]; count: number }>(
      `${this.apiUrl}/reconciliation/results`,
      { params }
    ).pipe(
      tap(result => console.log(`📋 Got ${result.count} reconciliation results`)),
      catchError(this.handleError)
    );
  }

  /**
   * Xóa một kết quả đối chiếu
   */
  deleteReconciliationResult(resultId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/reconciliation/results/${resultId}`
    ).pipe(
      tap(() => console.log(`🗑️ Deleted reconciliation result: ${resultId}`)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // DELETE METHODS
  // ==========================================================================

  /**
   * Xóa hóa đơn theo nguồn
   */
  clearBySource(source: InvoiceSource): Observable<{ success: boolean; deleted: number }> {
    const params = new HttpParams().set('source', source);
    return this.http.delete<{ success: boolean; deleted: number }>(
      `${this.apiUrl}/clear`,
      { params }
    ).pipe(
      tap(result => console.log(`🗑️ Cleared ${result.deleted} ${source} invoices`)),
      catchError(this.handleError)
    );
  }

  /**
   * Xóa tất cả hóa đơn
   */
  clearAll(): Observable<{ success: boolean; taxDeleted: number; aiDeleted: number }> {
    return this.http.delete<{ success: boolean; taxDeleted: number; aiDeleted: number }>(
      `${this.apiUrl}/clear-all`
    ).pipe(
      tap(result => console.log(`🗑️ Cleared all: ${result.taxDeleted} TAX + ${result.aiDeleted} AI`)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Filter state management
   */
  setCurrentFilter(filter: InvoiceFilter): void {
    this.currentFilter$.next(filter);
  }

  getCurrentFilter(): Observable<InvoiceFilter> {
    return this.currentFilter$.asObservable();
  }

  /**
   * Format currency (VND)
   */
  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  /**
   * Format date for display
   */
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  }

  /**
   * Get status label
   */
  getStatusLabel(status: ReconcileStatus): string {
    const labels: Record<ReconcileStatus, string> = {
      PENDING: 'Chưa đối chiếu',
      MATCHED: 'Khớp',
      UNMATCHED: 'Thiếu',
      MISMATCH: 'Sai số'
    };
    return labels[status] || status;
  }

  /**
   * Get status CSS class
   */
  getStatusClass(status: ReconcileStatus): string {
    const classes: Record<ReconcileStatus, string> = {
      PENDING: 'status-pending',
      MATCHED: 'status-matched',
      UNMATCHED: 'status-unmatched',
      MISMATCH: 'status-mismatch'
    };
    return classes[status] || '';
  }

  /**
   * Get source label
   */
  getSourceLabel(source: InvoiceSource): string {
    const labels: Record<InvoiceSource, string> = {
      TAX_PORTAL: 'Trang thuế',
      AI_PDF: 'AI (PDF)'
    };
    return labels[source] || source;
  }

  /**
   * Generate month options for filter
   */
  getMonthOptions(year: number = new Date().getFullYear()): { value: string; label: string }[] {
    const options = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${m.toString().padStart(2, '0')}`;
      options.push({
        value: monthKey,
        label: `Tháng ${m}/${year}`
      });
    }
    return options;
  }

  /**
   * Generate year options for filter
   */
  getYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }

  /**
   * Error handler
   */
  private handleError(error: any): Observable<never> {
    console.error('InvoiceServiceV2 error:', error);

    let errorMessage = 'Đã xảy ra lỗi';
    if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
