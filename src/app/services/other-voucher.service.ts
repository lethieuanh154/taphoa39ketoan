import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  OtherVoucher, OtherVoucherFilter, OtherVoucherType, OtherVoucherStatus,
  VoucherEntry, generateOtherVoucherNo, calculateTotals
} from '../models/other-voucher.models';

@Injectable({
  providedIn: 'root'
})
export class OtherVoucherService {
  private vouchers$ = new BehaviorSubject<OtherVoucher[]>([]);
  private sequenceNo = 10;

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getVouchers(): Observable<OtherVoucher[]> {
    return this.vouchers$.asObservable();
  }

  getVoucherById(id: string): Observable<OtherVoucher | undefined> {
    return this.vouchers$.pipe(
      map(list => list.find(v => v.id === id))
    );
  }

  filterVouchers(filter: OtherVoucherFilter): Observable<OtherVoucher[]> {
    return this.vouchers$.pipe(
      map(list => {
        let result = [...list];

        if (filter.search) {
          const search = filter.search.toLowerCase();
          result = result.filter(v =>
            v.voucherNo.toLowerCase().includes(search) ||
            v.description.toLowerCase().includes(search)
          );
        }

        if (filter.voucherType) {
          result = result.filter(v => v.voucherType === filter.voucherType);
        }

        if (filter.status) {
          result = result.filter(v => v.status === filter.status);
        }

        if (filter.fromDate) {
          result = result.filter(v => new Date(v.voucherDate) >= filter.fromDate!);
        }

        if (filter.toDate) {
          result = result.filter(v => new Date(v.voucherDate) <= filter.toDate!);
        }

        return result.sort((a, b) =>
          new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime()
        );
      })
    );
  }

  createVoucher(data: Partial<OtherVoucher>): Observable<OtherVoucher> {
    const vouchers = this.vouchers$.getValue();
    const totals = calculateTotals(data.entries || []);

    const newVoucher: OtherVoucher = {
      id: this.generateId(),
      voucherType: data.voucherType || 'ADJUSTMENT',
      voucherNo: data.voucherNo || generateOtherVoucherNo(this.sequenceNo++),
      voucherDate: data.voucherDate || new Date(),
      postingDate: data.postingDate,
      description: data.description || '',
      reason: data.reason,
      entries: data.entries || [],
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      attachments: data.attachments,
      originalVoucherNo: data.originalVoucherNo,
      originalVoucherDate: data.originalVoucherDate,
      status: data.status || 'DRAFT',
      preparedBy: data.preparedBy || 'system',
      preparedAt: new Date(),
      createdAt: new Date(),
      createdBy: 'system',
      updatedAt: new Date()
    };

    vouchers.push(newVoucher);
    this.vouchers$.next(vouchers);
    return of(newVoucher);
  }

  updateVoucher(id: string, data: Partial<OtherVoucher>): Observable<OtherVoucher | undefined> {
    const vouchers = this.vouchers$.getValue();
    const index = vouchers.findIndex(v => v.id === id);

    if (index === -1) return of(undefined);

    // Recalculate totals if entries changed
    if (data.entries) {
      const totals = calculateTotals(data.entries);
      data.totalDebit = totals.totalDebit;
      data.totalCredit = totals.totalCredit;
    }

    vouchers[index] = {
      ...vouchers[index],
      ...data,
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    this.vouchers$.next(vouchers);
    return of(vouchers[index]);
  }

  deleteVoucher(id: string): Observable<boolean> {
    const vouchers = this.vouchers$.getValue();
    const index = vouchers.findIndex(v => v.id === id);

    if (index === -1) return of(false);
    if (vouchers[index].status === 'POSTED') return of(false);

    vouchers.splice(index, 1);
    this.vouchers$.next(vouchers);
    return of(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  postVoucher(id: string): Observable<OtherVoucher | undefined> {
    return this.updateVoucher(id, {
      status: 'POSTED',
      postingDate: new Date(),
      postedBy: 'system',
      postedAt: new Date()
    });
  }

  cancelVoucher(id: string, reason: string): Observable<OtherVoucher | undefined> {
    return this.updateVoucher(id, {
      status: 'CANCELLED',
      cancelledBy: 'system',
      cancelledAt: new Date(),
      cancelReason: reason
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getStatistics(): Observable<{
    total: number;
    draft: number;
    posted: number;
    cancelled: number;
    totalAmount: number;
    byType: { type: OtherVoucherType; count: number }[];
  }> {
    return this.vouchers$.pipe(
      map(list => {
        const byType = new Map<OtherVoucherType, number>();
        list.forEach(v => {
          byType.set(v.voucherType, (byType.get(v.voucherType) || 0) + 1);
        });

        return {
          total: list.length,
          draft: list.filter(v => v.status === 'DRAFT').length,
          posted: list.filter(v => v.status === 'POSTED').length,
          cancelled: list.filter(v => v.status === 'CANCELLED').length,
          totalAmount: list.filter(v => v.status === 'POSTED').reduce((sum, v) => sum + v.totalDebit, 0),
          byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count }))
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'ov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const demoVouchers: OtherVoucher[] = [
      {
        id: 'ov_001',
        voucherType: 'DEPRECIATION',
        voucherNo: 'CT202501001',
        voucherDate: new Date(2025, 0, 31),
        postingDate: new Date(2025, 0, 31),
        description: 'Trích khấu hao TSCĐ tháng 01/2025',
        entries: [
          { id: 'e1', lineNo: 1, accountCode: '6424', accountName: 'CP khấu hao TSCĐ', description: 'Khấu hao TSCĐ văn phòng', debitAmount: 5000000, creditAmount: 0 },
          { id: 'e2', lineNo: 2, accountCode: '214', accountName: 'Hao mòn TSCĐ', description: 'Hao mòn TSCĐ văn phòng', debitAmount: 0, creditAmount: 5000000 }
        ],
        totalDebit: 5000000,
        totalCredit: 5000000,
        status: 'POSTED',
        preparedBy: 'Kế toán',
        preparedAt: new Date(2025, 0, 31),
        postedBy: 'Kế toán trưởng',
        postedAt: new Date(2025, 0, 31),
        createdAt: new Date(2025, 0, 31),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ov_002',
        voucherType: 'AMORTIZATION',
        voucherNo: 'CT202501002',
        voucherDate: new Date(2025, 0, 31),
        postingDate: new Date(2025, 0, 31),
        description: 'Phân bổ CCDC tháng 01/2025',
        entries: [
          { id: 'e3', lineNo: 1, accountCode: '6423', accountName: 'CP CCDC', description: 'Phân bổ CCDC văn phòng', debitAmount: 2000000, creditAmount: 0 },
          { id: 'e4', lineNo: 2, accountCode: '242', accountName: 'CP trả trước', description: 'Phân bổ từ TK 242', debitAmount: 0, creditAmount: 2000000 }
        ],
        totalDebit: 2000000,
        totalCredit: 2000000,
        status: 'POSTED',
        preparedBy: 'Kế toán',
        preparedAt: new Date(2025, 0, 31),
        postedBy: 'Kế toán trưởng',
        postedAt: new Date(2025, 0, 31),
        createdAt: new Date(2025, 0, 31),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ov_003',
        voucherType: 'ADJUSTMENT',
        voucherNo: 'CT202501003',
        voucherDate: new Date(2025, 0, 15),
        description: 'Điều chỉnh số dư TK 131 - KH001',
        reason: 'Sai số dư từ kỳ trước',
        entries: [
          { id: 'e5', lineNo: 1, accountCode: '131', accountName: 'Phải thu KH', description: 'Điều chỉnh tăng phải thu KH001', debitAmount: 1500000, creditAmount: 0, partnerId: 'KH001', partnerName: 'Công ty A' },
          { id: 'e6', lineNo: 2, accountCode: '4211', accountName: 'LN chưa phân phối', description: 'Điều chỉnh LN', debitAmount: 0, creditAmount: 1500000 }
        ],
        totalDebit: 1500000,
        totalCredit: 1500000,
        status: 'DRAFT',
        preparedBy: 'Kế toán',
        preparedAt: new Date(2025, 0, 15),
        createdAt: new Date(2025, 0, 15),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ov_004',
        voucherType: 'CLOSING',
        voucherNo: 'CT202412001',
        voucherDate: new Date(2024, 11, 31),
        postingDate: new Date(2024, 11, 31),
        description: 'Kết chuyển doanh thu - chi phí năm 2024',
        entries: [
          { id: 'e7', lineNo: 1, accountCode: '511', accountName: 'DT bán hàng', description: 'Kết chuyển DT bán hàng', debitAmount: 500000000, creditAmount: 0 },
          { id: 'e8', lineNo: 2, accountCode: '911', accountName: 'Xác định KQKD', description: 'Kết chuyển DT vào 911', debitAmount: 0, creditAmount: 500000000 },
          { id: 'e9', lineNo: 3, accountCode: '911', accountName: 'Xác định KQKD', description: 'Kết chuyển giá vốn', debitAmount: 350000000, creditAmount: 0 },
          { id: 'e10', lineNo: 4, accountCode: '632', accountName: 'Giá vốn hàng bán', description: 'Kết chuyển GVHB', debitAmount: 0, creditAmount: 350000000 }
        ],
        totalDebit: 850000000,
        totalCredit: 850000000,
        status: 'POSTED',
        preparedBy: 'Kế toán',
        preparedAt: new Date(2024, 11, 31),
        postedBy: 'Kế toán trưởng',
        postedAt: new Date(2024, 11, 31),
        createdAt: new Date(2024, 11, 31),
        createdBy: 'system',
        updatedAt: new Date()
      }
    ];

    this.vouchers$.next(demoVouchers);
  }
}
