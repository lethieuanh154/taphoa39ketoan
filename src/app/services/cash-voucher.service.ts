import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError, throwError, BehaviorSubject, tap, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CashVoucher,
  VoucherLine,
  VoucherType,
  VoucherStatus,
  VoucherFilter,
  CreateVoucherDTO,
  generateVoucherNo,
  calculateVoucherTotals,
  numberToWords,
  validateVoucher,
  generateJournalEntry,
  JournalEntryLine
} from '../models/cash-voucher.models';
import { CashVoucherApiService, CashVoucherFilter } from './cash-voucher-api.service';

/**
 * SERVICE: PHIẾU THU / PHIẾU CHI
 *
 * Quản lý chứng từ thu chi tiền mặt - Kết nối với Backend API
 */
@Injectable({
  providedIn: 'root'
})
export class CashVoucherService {

  private apiService = inject(CashVoucherApiService);

  // Cache data locally for quick access
  private vouchers$ = new BehaviorSubject<CashVoucher[]>([]);
  private isLoaded = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách phiếu
   */
  getVouchers(filter?: VoucherFilter): Observable<CashVoucher[]> {
    const apiFilter: CashVoucherFilter = {};

    if (filter) {
      if (filter.voucherType) apiFilter.voucher_type = filter.voucherType;
      if (filter.status) apiFilter.status = filter.status;
      if (filter.fromDate) apiFilter.from_date = this.formatDateForApi(filter.fromDate);
      if (filter.toDate) apiFilter.to_date = this.formatDateForApi(filter.toDate);
    }

    return this.apiService.getAll(apiFilter).pipe(
      tap(vouchers => {
        this.vouchers$.next(vouchers);
        this.isLoaded = true;
      }),
      map(vouchers => {
        // Apply client-side filtering for fields not supported by API
        let filtered = [...vouchers];

        if (filter?.search) {
          const search = filter.search.toLowerCase();
          filtered = filtered.filter(v =>
            v.voucherNo.toLowerCase().includes(search) ||
            v.relatedObjectName.toLowerCase().includes(search) ||
            v.reason.toLowerCase().includes(search)
          );
        }

        if (filter?.relatedObjectType) {
          filtered = filtered.filter(v => v.relatedObjectType === filter.relatedObjectType);
        }

        if (filter?.relatedObjectId) {
          filtered = filtered.filter(v => v.relatedObjectId === filter.relatedObjectId);
        }

        if (filter?.cashAccountCode) {
          filtered = filtered.filter(v => v.cashAccountCode === filter.cashAccountCode);
        }

        return filtered.sort((a, b) =>
          new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime()
        );
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy phiếu theo ID
   */
  getVoucherById(id: string): Observable<CashVoucher | null> {
    return this.apiService.getById(id).pipe(
      catchError(err => {
        if (err.status === 404) return of(null);
        return throwError(() => err);
      })
    );
  }

  /**
   * Lấy phiếu theo số phiếu
   */
  getVoucherByNo(voucherNo: string): Observable<CashVoucher | null> {
    return this.getVouchers().pipe(
      map(vouchers => vouchers.find(v => v.voucherNo === voucherNo) || null)
    );
  }

  /**
   * Tạo phiếu mới
   */
  createVoucher(dto: CreateVoucherDTO): Observable<CashVoucher> {
    // Validate client-side first
    const tempVoucher: Partial<CashVoucher> = {
      voucherDate: dto.voucherDate,
      relatedObjectName: dto.relatedObjectName,
      reason: dto.reason,
      cashAccountCode: dto.cashAccountCode,
      lines: dto.lines.map((line, idx) => ({
        ...line,
        id: `temp-${idx}`,
        lineNo: idx + 1
      }))
    };

    const errors = validateVoucher(tempVoucher);
    if (errors.length > 0) {
      return throwError(() => new Error(errors.join(', ')));
    }

    return this.apiService.create(dto).pipe(
      tap(voucher => {
        // Update local cache
        const current = this.vouchers$.value;
        this.vouchers$.next([voucher, ...current]);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Cập nhật phiếu
   */
  updateVoucher(id: string, updates: Partial<CashVoucher>): Observable<CashVoucher> {
    return this.apiService.update(id, updates as any).pipe(
      tap(voucher => {
        // Update local cache
        const current = this.vouchers$.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchers$.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Ghi sổ phiếu
   */
  postVoucher(id: string): Observable<CashVoucher> {
    return this.apiService.post(id).pipe(
      tap(voucher => {
        // Update local cache
        const current = this.vouchers$.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchers$.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Hủy phiếu
   */
  cancelVoucher(id: string, reason: string): Observable<CashVoucher> {
    if (!reason || reason.length < 10) {
      return throwError(() => new Error('Lý do hủy phải >= 10 ký tự'));
    }

    return this.apiService.cancel(id, reason).pipe(
      tap(voucher => {
        // Update local cache
        const current = this.vouchers$.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchers$.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Xóa phiếu
   */
  deleteVoucher(id: string): Observable<void> {
    return this.apiService.delete(id).pipe(
      tap(() => {
        // Remove from local cache
        const current = this.vouchers$.value;
        this.vouchers$.next(current.filter(v => v.id !== id));
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lấy bút toán từ phiếu
   */
  getJournalEntry(id: string): Observable<JournalEntryLine[]> {
    return this.getVoucherById(id).pipe(
      map(voucher => {
        if (!voucher) {
          throw new Error('Không tìm thấy phiếu');
        }
        return generateJournalEntry(voucher);
      })
    );
  }

  /**
   * Lấy số phiếu tiếp theo
   */
  getNextVoucherNo(type: VoucherType): Observable<string> {
    // Backend will auto-generate, but we can provide a preview
    return this.getVouchers({ voucherType: type }).pipe(
      map(vouchers => {
        const count = vouchers.length + 1;
        return generateVoucherNo(type, count);
      })
    );
  }

  /**
   * Thống kê theo loại phiếu
   */
  getStatistics(filter?: VoucherFilter): Observable<{
    totalReceipts: number;
    totalPayments: number;
    receiptAmount: number;
    paymentAmount: number;
    netCashFlow: number;
  }> {
    const fromDate = filter?.fromDate ? this.formatDateForApi(filter.fromDate) : undefined;
    const toDate = filter?.toDate ? this.formatDateForApi(filter.toDate) : undefined;

    return this.apiService.getStatistics(fromDate, toDate).pipe(
      map(stats => ({
        totalReceipts: stats.receipt_count,
        totalPayments: stats.payment_count,
        receiptAmount: stats.total_receipt_amount,
        paymentAmount: stats.total_payment_amount,
        netCashFlow: stats.net_cash_flow
      })),
      catchError(() => {
        // Fallback to client-side calculation if API fails
        return this.getVouchers(filter).pipe(
          map(vouchers => {
            const postedVouchers = vouchers.filter(v => v.status === 'POSTED');
            const receipts = postedVouchers.filter(v => v.voucherType === 'RECEIPT');
            const payments = postedVouchers.filter(v => v.voucherType === 'PAYMENT');

            const receiptAmount = receipts.reduce((sum, v) => sum + v.grandTotal, 0);
            const paymentAmount = payments.reduce((sum, v) => sum + v.grandTotal, 0);

            return {
              totalReceipts: receipts.length,
              totalPayments: payments.length,
              receiptAmount,
              paymentAmount,
              netCashFlow: receiptAmount - paymentAmount
            };
          })
        );
      })
    );
  }

  /**
   * Xuất Excel
   */
  exportExcel(filter?: VoucherFilter): Observable<Blob> {
    // TODO: Implement backend export endpoint
    return of(new Blob(['Demo Excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  /**
   * In phiếu
   */
  printVoucher(id: string): Observable<Blob> {
    // TODO: Implement backend print endpoint
    return of(new Blob(['Demo PDF'], { type: 'application/pdf' }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private formatDateForApi(date: Date): string {
    return date.toISOString();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Đã xảy ra lỗi';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      message = error.error.message;
    } else if (error.error?.detail) {
      // Backend error with detail
      message = error.error.detail;
    } else if (error.status === 0) {
      message = 'Không thể kết nối đến server. Vui lòng kiểm tra Backend đang chạy.';
    } else if (error.status === 404) {
      message = 'Không tìm thấy phiếu';
    } else if (error.status === 400) {
      message = 'Dữ liệu không hợp lệ';
    } else if (error.status === 500) {
      message = 'Lỗi server';
    }

    return throwError(() => new Error(message));
  }

  /**
   * Refresh data from server
   */
  refresh(): Observable<CashVoucher[]> {
    return this.getVouchers();
  }

  /**
   * Get cached vouchers (for quick access)
   */
  getCachedVouchers(): CashVoucher[] {
    return this.vouchers$.value;
  }
}
