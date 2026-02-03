import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import {
  WarehouseVoucher,
  WarehouseVoucherLine,
  WarehouseVoucherType,
  WarehouseVoucherStatus,
  WarehouseVoucherFilter,
  WarehouseVoucherSummary,
  ReceiptType,
  IssueType,
  Warehouse,
  StockCard,
  StockMovement,
  DEFAULT_WAREHOUSES,
  RECEIPT_JOURNAL_MAPPING,
  ISSUE_JOURNAL_MAPPING,
  calculateVoucherTotals,
  calculateLineAmount
} from '../models/warehouse.models';
import { WarehouseVoucherApiService, CreateWarehouseVoucherDTO, WarehouseVoucherFilter as ApiFilter } from './warehouse-voucher-api.service';

@Injectable({
  providedIn: 'root'
})
export class WarehouseService {
  private apiService = inject(WarehouseVoucherApiService);

  private readonly WAREHOUSE_STORAGE_KEY = 'taphoa39_warehouses';

  private vouchersSubject = new BehaviorSubject<WarehouseVoucher[]>([]);
  private warehousesSubject = new BehaviorSubject<Warehouse[]>([]);
  private isLoaded = false;

  constructor() {
    this.loadWarehouses();
  }

  // ═══════════════════════════════════════════════════════════════════
  // WAREHOUSE MANAGEMENT (Local storage - không liên quan đến phiếu)
  // ═══════════════════════════════════════════════════════════════════

  private loadWarehouses(): void {
    try {
      const stored = localStorage.getItem(this.WAREHOUSE_STORAGE_KEY);
      if (stored) {
        this.warehousesSubject.next(JSON.parse(stored));
      } else {
        this.warehousesSubject.next(DEFAULT_WAREHOUSES);
        localStorage.setItem(this.WAREHOUSE_STORAGE_KEY, JSON.stringify(DEFAULT_WAREHOUSES));
      }
    } catch (e) {
      this.warehousesSubject.next(DEFAULT_WAREHOUSES);
    }
  }

  getWarehouses(): Observable<Warehouse[]> {
    return this.warehousesSubject.asObservable();
  }

  getActiveWarehouses(): Observable<Warehouse[]> {
    return this.warehousesSubject.asObservable().pipe(
      map(warehouses => warehouses.filter(w => w.isActive))
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS - Kết nối với Backend API
  // ═══════════════════════════════════════════════════════════════════

  getVouchers(filter?: WarehouseVoucherFilter): Observable<WarehouseVoucher[]> {
    const apiFilter: ApiFilter = {};

    if (filter) {
      if (filter.voucherType) apiFilter.voucher_type = filter.voucherType;
      if (filter.status) apiFilter.status = filter.status;
      if (filter.warehouseCode) apiFilter.warehouse_code = filter.warehouseCode;
      if (filter.fromDate) apiFilter.from_date = this.formatDateForApi(filter.fromDate);
      if (filter.toDate) apiFilter.to_date = this.formatDateForApi(filter.toDate);
    }

    return this.apiService.getAll(apiFilter).pipe(
      tap(vouchers => {
        this.vouchersSubject.next(vouchers);
        this.isLoaded = true;
      }),
      map(vouchers => {
        // Apply client-side filtering for fields not supported by API
        return this.applyClientSideFilter(vouchers, filter);
      }),
      catchError(this.handleError)
    );
  }

  private applyClientSideFilter(vouchers: WarehouseVoucher[], filter?: WarehouseVoucherFilter): WarehouseVoucher[] {
    if (!filter) return vouchers;

    let filtered = [...vouchers];

    if (filter.receiptType) {
      filtered = filtered.filter(v => v.receiptType === filter.receiptType);
    }

    if (filter.issueType) {
      filtered = filtered.filter(v => v.issueType === filter.issueType);
    }

    if (filter.partnerId) {
      filtered = filtered.filter(v => v.partnerId === filter.partnerId);
    }

    if (filter.productId) {
      filtered = filtered.filter(v =>
        v.lines.some(l => l.productId === filter.productId)
      );
    }

    if (filter.searchText) {
      const search = filter.searchText.toLowerCase();
      filtered = filtered.filter(v => {
        const matchVoucher = v.voucherNo.toLowerCase().includes(search) ||
          v.partnerName?.toLowerCase().includes(search) ||
          v.description?.toLowerCase().includes(search);
        const matchLine = v.lines.some(l =>
          l.productCode.toLowerCase().includes(search) ||
          l.productName.toLowerCase().includes(search)
        );
        return matchVoucher || matchLine;
      });
    }

    return filtered.sort((a, b) =>
      new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime()
    );
  }

  getVoucherById(id: string): Observable<WarehouseVoucher | undefined> {
    return this.apiService.getById(id).pipe(
      catchError(err => {
        if (err.status === 404) return of(undefined);
        return throwError(() => err);
      })
    );
  }

  createVoucher(voucher: Partial<WarehouseVoucher>): Observable<WarehouseVoucher> {
    // Prepare lines
    const lines = (voucher.lines || []).map((line, idx) => ({
      ...line,
      lineNo: idx + 1,
      amount: calculateLineAmount(line.quantity || 0, line.unitPrice || 0)
    }));

    // Set journal accounts based on type
    let debitAccount = voucher.debitAccount || '156';
    let creditAccount = voucher.creditAccount || '331';

    if (voucher.voucherType === 'RECEIPT' && voucher.receiptType) {
      const mapping = RECEIPT_JOURNAL_MAPPING[voucher.receiptType];
      debitAccount = mapping.debit;
      creditAccount = mapping.credit;
    } else if (voucher.voucherType === 'ISSUE' && voucher.issueType) {
      const mapping = ISSUE_JOURNAL_MAPPING[voucher.issueType];
      debitAccount = mapping.debit;
      creditAccount = mapping.credit;
    }

    const dto: CreateWarehouseVoucherDTO = {
      voucherType: voucher.voucherType!,
      receiptType: voucher.receiptType,
      issueType: voucher.issueType,
      voucherDate: voucher.voucherDate || new Date(),
      warehouseCode: voucher.warehouseCode || 'KHO1',
      warehouseName: voucher.warehouseName || 'Kho chính',
      partnerId: voucher.partnerId,
      partnerCode: voucher.partnerCode,
      partnerName: voucher.partnerName,
      refVoucherNo: voucher.refVoucherNo,
      refVoucherDate: voucher.refVoucherDate,
      refVoucherType: voucher.refVoucherType,
      keeper: voucher.keeper,
      receiver: voucher.receiver,
      debitAccount,
      creditAccount,
      description: voucher.description,
      note: voucher.note,
      lines: lines as WarehouseVoucherLine[]
    };

    return this.apiService.create(dto).pipe(
      tap(newVoucher => {
        const current = this.vouchersSubject.value;
        this.vouchersSubject.next([newVoucher, ...current]);
      }),
      catchError(this.handleError)
    );
  }

  updateVoucher(id: string, updates: Partial<WarehouseVoucher>): Observable<WarehouseVoucher | undefined> {
    // Recalculate totals if lines changed
    if (updates.lines) {
      updates.lines = updates.lines.map((line, idx) => ({
        ...line,
        lineNo: idx + 1,
        amount: calculateLineAmount(line.quantity || 0, line.unitPrice || 0)
      }));
      const totals = calculateVoucherTotals(updates.lines as WarehouseVoucherLine[]);
      updates.totalQuantity = totals.totalQuantity;
      updates.totalAmount = totals.totalAmount;
    }

    return this.apiService.update(id, updates as CreateWarehouseVoucherDTO).pipe(
      tap(voucher => {
        const current = this.vouchersSubject.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchersSubject.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteVoucher(id: string): Observable<boolean> {
    return this.apiService.delete(id).pipe(
      map(() => {
        const current = this.vouchersSubject.value;
        this.vouchersSubject.next(current.filter(v => v.id !== id));
        return true;
      }),
      catchError(() => of(false))
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  postVoucher(id: string): Observable<WarehouseVoucher | undefined> {
    return this.apiService.post(id).pipe(
      tap(voucher => {
        const current = this.vouchersSubject.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchersSubject.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  cancelVoucher(id: string, reason: string): Observable<WarehouseVoucher | undefined> {
    if (!reason || reason.length < 10) {
      return throwError(() => new Error('Lý do hủy phải >= 10 ký tự'));
    }

    return this.apiService.cancel(id, reason).pipe(
      tap(voucher => {
        const current = this.vouchersSubject.value;
        const idx = current.findIndex(v => v.id === id);
        if (idx >= 0) {
          current[idx] = voucher;
          this.vouchersSubject.next([...current]);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY & STATISTICS
  // ═══════════════════════════════════════════════════════════════════

  getSummary(type: WarehouseVoucherType, filter?: WarehouseVoucherFilter): Observable<WarehouseVoucherSummary> {
    const fromDate = filter?.fromDate ? this.formatDateForApi(filter.fromDate) : undefined;
    const toDate = filter?.toDate ? this.formatDateForApi(filter.toDate) : undefined;

    return this.apiService.getStatistics(type, fromDate, toDate).pipe(
      map(stats => ({
        totalVouchers: stats.total_vouchers,
        draftCount: stats.by_status.draft,
        postedCount: stats.by_status.posted,
        cancelledCount: stats.by_status.cancelled,
        totalQuantity: type === 'RECEIPT' ? stats.total_receipt_quantity : stats.total_issue_quantity,
        totalAmount: type === 'RECEIPT' ? stats.total_receipt_amount : stats.total_issue_amount
      })),
      catchError(() => {
        // Fallback to client-side calculation
        return this.getVouchers({ ...filter, voucherType: type }).pipe(
          map(vouchers => ({
            totalVouchers: vouchers.length,
            draftCount: vouchers.filter(v => v.status === 'DRAFT').length,
            postedCount: vouchers.filter(v => v.status === 'POSTED').length,
            cancelledCount: vouchers.filter(v => v.status === 'CANCELLED').length,
            totalQuantity: vouchers.filter(v => v.status !== 'CANCELLED')
              .reduce((sum, v) => sum + v.totalQuantity, 0),
            totalAmount: vouchers.filter(v => v.status !== 'CANCELLED')
              .reduce((sum, v) => sum + v.totalAmount, 0)
          }))
        );
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STOCK CARD
  // ═══════════════════════════════════════════════════════════════════

  getStockCard(productId: string, warehouseCode: string, fromDate: Date, toDate: Date): Observable<StockCard> {
    // This needs to be calculated from vouchers
    return this.getVouchers({
      warehouseCode: warehouseCode || undefined,
      fromDate,
      toDate
    }).pipe(
      map(vouchers => {
        const postedVouchers = vouchers
          .filter(v => v.status === 'POSTED')
          .sort((a, b) => new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime());

        let openingQty = 0;
        let openingAmount = 0;
        let receiptQty = 0;
        let receiptAmount = 0;
        let issueQty = 0;
        let issueAmount = 0;
        const movements: StockMovement[] = [];
        let balance = openingQty;
        let balanceAmount = openingAmount;

        let productCode = '';
        let productName = '';
        let unit = '';

        for (const voucher of postedVouchers) {
          for (const line of voucher.lines) {
            if (line.productId === productId) {
              if (!productCode) {
                productCode = line.productCode;
                productName = line.productName;
                unit = line.unit;
              }

              const isReceipt = voucher.voucherType === 'RECEIPT';
              const rQty = isReceipt ? line.quantity : 0;
              const rAmt = isReceipt ? line.amount : 0;
              const iQty = isReceipt ? 0 : line.quantity;
              const iAmt = isReceipt ? 0 : line.amount;

              if (isReceipt) {
                receiptQty += line.quantity;
                receiptAmount += line.amount;
                balance += line.quantity;
                balanceAmount += line.amount;
              } else {
                issueQty += line.quantity;
                issueAmount += line.amount;
                balance -= line.quantity;
                balanceAmount -= line.amount;
              }

              movements.push({
                date: new Date(voucher.voucherDate),
                voucherNo: voucher.voucherNo,
                voucherType: voucher.voucherType,
                description: voucher.description || '',
                receiptQty: rQty,
                receiptAmount: rAmt,
                issueQty: iQty,
                issueAmount: iAmt,
                balanceQty: balance,
                balanceAmount: balanceAmount
              });
            }
          }
        }

        return {
          productId,
          productCode,
          productName,
          unit,
          warehouseCode,
          openingQty,
          openingAmount,
          receiptQty,
          receiptAmount,
          issueQty,
          issueAmount,
          closingQty: balance,
          closingAmount: balanceAmount,
          movements
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  getNextVoucherNo(type: WarehouseVoucherType): string {
    // Backend auto-generates, but provide preview
    const prefix = type === 'RECEIPT' ? 'PNK' : 'PXK';
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    const vouchers = this.vouchersSubject.value
      .filter(v => v.voucherType === type)
      .filter(v => v.voucherNo.includes(yearMonth));

    const maxNo = vouchers.reduce((max, v) => {
      const match = v.voucherNo.match(/-(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);

    return `${prefix}-${yearMonth}-${String(maxNo + 1).padStart(3, '0')}`;
  }

  private formatDateForApi(date: Date): string {
    return date.toISOString();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Đã xảy ra lỗi';

    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else if (error.error?.detail) {
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
  refresh(): Observable<WarehouseVoucher[]> {
    return this.getVouchers();
  }

  /**
   * Get cached vouchers
   */
  getCachedVouchers(): WarehouseVoucher[] {
    return this.vouchersSubject.value;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LINE OPERATIONS - Now handled through full voucher update
  // ═══════════════════════════════════════════════════════════════════

  addLine(voucherId: string, line: Partial<WarehouseVoucherLine>): Observable<WarehouseVoucher | undefined> {
    return this.getVoucherById(voucherId).pipe(
      map(voucher => {
        if (!voucher || voucher.status !== 'DRAFT') return undefined;

        const newLine: WarehouseVoucherLine = {
          ...line,
          id: `WHL-${Date.now()}`,
          lineNo: voucher.lines.length + 1,
          amount: calculateLineAmount(line.quantity || 0, line.unitPrice || 0)
        } as WarehouseVoucherLine;

        const updatedLines = [...voucher.lines, newLine];
        return { ...voucher, lines: updatedLines };
      }),
      map(voucher => {
        if (!voucher) return undefined;
        this.updateVoucher(voucherId, { lines: voucher.lines });
        return voucher;
      })
    );
  }

  updateLine(voucherId: string, lineId: string, updates: Partial<WarehouseVoucherLine>): Observable<WarehouseVoucher | undefined> {
    return this.getVoucherById(voucherId).pipe(
      map(voucher => {
        if (!voucher || voucher.status !== 'DRAFT') return undefined;

        const lineIndex = voucher.lines.findIndex(l => l.id === lineId);
        if (lineIndex === -1) return undefined;

        const updatedLine = { ...voucher.lines[lineIndex], ...updates };
        updatedLine.amount = calculateLineAmount(updatedLine.quantity, updatedLine.unitPrice);

        const updatedLines = [...voucher.lines];
        updatedLines[lineIndex] = updatedLine;

        return { ...voucher, lines: updatedLines };
      }),
      map(voucher => {
        if (!voucher) return undefined;
        this.updateVoucher(voucherId, { lines: voucher.lines });
        return voucher;
      })
    );
  }

  removeLine(voucherId: string, lineId: string): Observable<WarehouseVoucher | undefined> {
    return this.getVoucherById(voucherId).pipe(
      map(voucher => {
        if (!voucher || voucher.status !== 'DRAFT') return undefined;

        const updatedLines = voucher.lines
          .filter(l => l.id !== lineId)
          .map((l, i) => ({ ...l, lineNo: i + 1 }));

        return { ...voucher, lines: updatedLines };
      }),
      map(voucher => {
        if (!voucher) return undefined;
        this.updateVoucher(voucherId, { lines: voucher.lines });
        return voucher;
      })
    );
  }
}
