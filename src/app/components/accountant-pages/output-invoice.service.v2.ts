/**
 * OUTPUT INVOICE SERVICE V2
 * Service cho đồng bộ hóa đơn đầu ra
 * - Trang thuế (TAX_PORTAL_OUTPUT) vs Local invoices
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ==========================================================================
// TYPES
// ==========================================================================

export type OutputInvoiceSource = 'TAX_PORTAL_OUTPUT' | 'LOCAL';

export type OutputReconcileStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'MISMATCH';

export interface OutputInvoice {
  id: string;
  invoiceNo: string;
  invoiceSymbol?: string;
  invoiceDate?: string;
  issueDate?: string;

  // Customer info (for output invoices)
  customerName?: string;
  customerTaxCode?: string;
  customerAddress?: string;

  // Amounts
  totalBeforeVat?: number;
  vatRate?: number;
  vatAmount?: number;
  totalAmount?: number;

  // Source & Status
  source: OutputInvoiceSource;
  reconcileStatus?: OutputReconcileStatus;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface OutputInvoiceFilter {
  source?: OutputInvoiceSource;
  fromDate?: string;      // yyyy-mm-dd
  toDate?: string;        // yyyy-mm-dd
  monthKey?: string;      // yyyy-mm
  year?: number;
  customerName?: string;
  reconcileStatus?: OutputReconcileStatus;
  pageSize?: number;
  afterDocId?: string;
  beforeDocId?: string;
}

export interface OutputPagination {
  hasNext: boolean;
  hasPrev: boolean;
  firstDocId: string | null;
  lastDocId: string | null;
  pageSize: number;
  count: number;
}

export interface OutputReconciliationSummary {
  taxPortalCount: number;
  localCount: number;
  matchedCount: number;
  unmatchedCount: number;
  mismatchCount: number;
}

export interface OutputFieldDiff {
  field: string;
  fieldLabel: string;
  taxValue: any;
  localValue: any;
  diff: any;
  diffType: 'string' | 'number' | 'date';
}

export interface OutputReconciliationResult {
  id: string;
  invoiceKey: string;
  status: string;
  taxInvoiceId?: string;
  localInvoiceId?: string;
  taxData?: any;
  localData?: any;
  fieldDiffs?: OutputFieldDiff[];
  checkedAt?: string;
}

// ==========================================================================
// SERVICE
// ==========================================================================

@Injectable({
  providedIn: 'root'
})
export class OutputInvoiceServiceV2 {
  private apiUrl = `${environment.domainUrl}/api/v2/invoices/output`;

  constructor(private http: HttpClient) {}

  // ==========================================================================
  // GET METHODS
  // ==========================================================================

  /**
   * Get invoices with pagination
   */
  getInvoices(filter: OutputInvoiceFilter): Observable<{ invoices: OutputInvoice[]; pagination: OutputPagination }> {
    let params = new HttpParams();

    if (filter.source) params = params.set('source', filter.source);
    if (filter.fromDate) params = params.set('from_date', filter.fromDate);
    if (filter.toDate) params = params.set('to_date', filter.toDate);
    if (filter.monthKey) params = params.set('month_key', filter.monthKey);
    if (filter.year) params = params.set('year', filter.year.toString());
    if (filter.customerName) params = params.set('customer_name', filter.customerName);
    if (filter.reconcileStatus) params = params.set('reconcile_status', filter.reconcileStatus);
    if (filter.pageSize) params = params.set('page_size', filter.pageSize.toString());
    if (filter.afterDocId) params = params.set('after_doc_id', filter.afterDocId);
    if (filter.beforeDocId) params = params.set('before_doc_id', filter.beforeDocId);

    return this.http.get<{ invoices: OutputInvoice[]; pagination: OutputPagination }>(
      this.apiUrl,
      { params }
    ).pipe(
      tap(result => console.log(`📄 Output Invoices loaded: ${result.invoices.length}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Get next page
   */
  getNextPage(filter: OutputInvoiceFilter, lastDocId: string): Observable<{ invoices: OutputInvoice[]; pagination: OutputPagination }> {
    return this.getInvoices({ ...filter, afterDocId: lastDocId, beforeDocId: undefined });
  }

  /**
   * Get previous page
   */
  getPrevPage(filter: OutputInvoiceFilter, firstDocId: string): Observable<{ invoices: OutputInvoice[]; pagination: OutputPagination }> {
    return this.getInvoices({ ...filter, beforeDocId: firstDocId, afterDocId: undefined });
  }

  /**
   * Get customers for dropdown
   */
  getCustomers(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/customers`).pipe(
      tap(customers => console.log(`👥 Output Customers loaded: ${customers.length}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Get reconciliation summary
   */
  getReconciliationSummary(monthKey?: string, year?: number): Observable<OutputReconciliationSummary> {
    let params = new HttpParams();
    if (monthKey) params = params.set('month_key', monthKey);
    if (year) params = params.set('year', year.toString());

    return this.http.get<OutputReconciliationSummary>(
      `${this.apiUrl}/summary`,
      { params }
    ).pipe(
      tap(summary => console.log('📊 Output Summary loaded:', summary)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // IMPORT / SYNC METHODS
  // ==========================================================================

  /**
   * Import XML files (output invoices from tax portal)
   */
  importXml(files: File[]): Observable<{ success: boolean; imported: number; duplicates: number; failed: number }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.http.post<{ success: boolean; imported: number; duplicates: number; failed: number }>(
      `${this.apiUrl}/import/xml`,
      formData
    ).pipe(
      tap(result => console.log('📥 Output XML Import result:', result)),
      catchError(this.handleError)
    );
  }

  /**
   * Sync invoices from local (invoices-page)
   */
  syncLocalInvoices(): Observable<{ success: boolean; synced: number; updated: number; skipped: number }> {
    return this.http.post<{ success: boolean; synced: number; updated: number; skipped: number }>(
      `${this.apiUrl}/sync/local`,
      {}
    ).pipe(
      tap(result => console.log('🔄 Local invoices synced:', result)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // RECONCILIATION METHODS
  // ==========================================================================

  /**
   * Run reconciliation
   */
  runReconciliation(monthKey?: string): Observable<{ success: boolean; processed: number; matched: number; unmatched: number; mismatch: number }> {
    let params = new HttpParams();
    if (monthKey) params = params.set('month_key', monthKey);

    return this.http.post<{ success: boolean; processed: number; matched: number; unmatched: number; mismatch: number }>(
      `${this.apiUrl}/reconciliation/run`,
      {},
      { params }
    ).pipe(
      tap(result => console.log('🔍 Output Reconciliation result:', result)),
      catchError(this.handleError)
    );
  }

  /**
   * Get reconciliation results
   */
  getReconciliationResults(status?: string, limit = 50): Observable<{ results: OutputReconciliationResult[]; count: number }> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    params = params.set('limit', limit.toString());

    return this.http.get<{ results: OutputReconciliationResult[]; count: number }>(
      `${this.apiUrl}/reconciliation/results`,
      { params }
    ).pipe(
      tap(result => console.log(`📋 Got ${result.count} output reconciliation results`)),
      catchError(this.handleError)
    );
  }

  /**
   * Delete a reconciliation result
   */
  deleteReconciliationResult(resultId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/reconciliation/results/${resultId}`
    ).pipe(
      tap(() => console.log(`🗑️ Deleted output reconciliation result: ${resultId}`)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // DELETE METHODS
  // ==========================================================================

  /**
   * Clear invoices by source
   */
  clearBySource(source: OutputInvoiceSource): Observable<{ success: boolean; deleted: number }> {
    return this.http.delete<{ success: boolean; deleted: number }>(
      `${this.apiUrl}/clear`,
      { params: new HttpParams().set('source', source) }
    ).pipe(
      tap(result => console.log(`🗑️ Cleared ${result.deleted} output invoices from ${source}`)),
      catchError(this.handleError)
    );
  }

  /**
   * Clear all output invoices
   */
  clearAll(): Observable<{ success: boolean; taxDeleted: number; localDeleted: number }> {
    return this.http.delete<{ success: boolean; taxDeleted: number; localDeleted: number }>(
      `${this.apiUrl}/clear-all`
    ).pipe(
      tap(result => console.log(`🗑️ Cleared all output invoices: tax=${result.taxDeleted}, local=${result.localDeleted}`)),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  getYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }

  getMonthOptions(year: number): { value: string; label: string }[] {
    const months: { value: string; label: string }[] = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (let m = 12; m >= 1; m--) {
      // If year is current year, only show up to current month
      if (year === currentYear && m > currentMonth) continue;

      const monthStr = m.toString().padStart(2, '0');
      months.push({
        value: `${year}-${monthStr}`,
        label: `Tháng ${m}/${year}`
      });
    }
    return months;
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';

    // Try to parse as ISO date (yyyy-mm-dd)
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    // Already in dd/mm/yyyy format
    return dateStr;
  }

  getStatusLabel(status: OutputReconcileStatus | undefined): string {
    const labels: Record<string, string> = {
      'PENDING': 'Chưa đối chiếu',
      'MATCHED': 'Khớp',
      'UNMATCHED': 'Thiếu',
      'MISMATCH': 'Sai số'
    };
    return labels[status || 'PENDING'] || 'Chưa đối chiếu';
  }

  getStatusClass(status: OutputReconcileStatus | undefined): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'MATCHED': 'status-matched',
      'UNMATCHED': 'status-unmatched',
      'MISMATCH': 'status-mismatch'
    };
    return classes[status || 'PENDING'] || 'status-pending';
  }

  getSourceLabel(source: OutputInvoiceSource): string {
    const labels: Record<string, string> = {
      'TAX_PORTAL_OUTPUT': 'Trang thuế (Đầu ra)',
      'LOCAL': 'Local'
    };
    return labels[source] || source;
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Có lỗi xảy ra';

    if (error.status === 0) {
      errorMessage = 'Không thể kết nối đến server';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
