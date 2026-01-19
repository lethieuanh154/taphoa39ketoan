import { Injectable } from '@angular/core';
import { Observable, of, delay, map, BehaviorSubject } from 'rxjs';
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

/**
 * SERVICE: PHIẾU THU / PHIẾU CHI
 *
 * Quản lý chứng từ thu chi tiền mặt
 */
@Injectable({
  providedIn: 'root'
})
export class CashVoucherService {

  private vouchers$ = new BehaviorSubject<CashVoucher[]>([]);
  private receiptSequence = 1;
  private paymentSequence = 1;

  constructor() {
    this.initializeDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách phiếu
   */
  getVouchers(filter?: VoucherFilter): Observable<CashVoucher[]> {
    return this.vouchers$.pipe(
      delay(200),
      map(vouchers => {
        let filtered = [...vouchers];

        if (filter) {
          if (filter.voucherType) {
            filtered = filtered.filter(v => v.voucherType === filter.voucherType);
          }

          if (filter.status) {
            filtered = filtered.filter(v => v.status === filter.status);
          }

          if (filter.fromDate) {
            filtered = filtered.filter(v => new Date(v.voucherDate) >= filter.fromDate!);
          }

          if (filter.toDate) {
            filtered = filtered.filter(v => new Date(v.voucherDate) <= filter.toDate!);
          }

          if (filter.relatedObjectType) {
            filtered = filtered.filter(v => v.relatedObjectType === filter.relatedObjectType);
          }

          if (filter.relatedObjectId) {
            filtered = filtered.filter(v => v.relatedObjectId === filter.relatedObjectId);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            filtered = filtered.filter(v =>
              v.voucherNo.toLowerCase().includes(search) ||
              v.relatedObjectName.toLowerCase().includes(search) ||
              v.reason.toLowerCase().includes(search)
            );
          }

          if (filter.cashAccountCode) {
            filtered = filtered.filter(v => v.cashAccountCode === filter.cashAccountCode);
          }
        }

        return filtered.sort((a, b) =>
          new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime()
        );
      })
    );
  }

  /**
   * Lấy phiếu theo ID
   */
  getVoucherById(id: string): Observable<CashVoucher | null> {
    return this.vouchers$.pipe(
      delay(100),
      map(vouchers => vouchers.find(v => v.id === id) || null)
    );
  }

  /**
   * Lấy phiếu theo số phiếu
   */
  getVoucherByNo(voucherNo: string): Observable<CashVoucher | null> {
    return this.vouchers$.pipe(
      delay(100),
      map(vouchers => vouchers.find(v => v.voucherNo === voucherNo) || null)
    );
  }

  /**
   * Tạo phiếu mới
   */
  createVoucher(dto: CreateVoucherDTO): Observable<CashVoucher> {
    return of(null).pipe(
      delay(300),
      map(() => {
        // Generate voucher number
        const sequence = dto.voucherType === 'RECEIPT'
          ? this.receiptSequence++
          : this.paymentSequence++;

        const voucherNo = generateVoucherNo(dto.voucherType, sequence);

        // Calculate totals
        const lines: VoucherLine[] = dto.lines.map((line, idx) => ({
          ...line,
          id: `line_${Date.now()}_${idx}`,
          lineNo: idx + 1
        }));

        const totals = calculateVoucherTotals(lines);

        const voucher: CashVoucher = {
          id: `voucher_${Date.now()}`,
          voucherType: dto.voucherType,
          voucherNo,
          voucherDate: dto.voucherDate,
          relatedObjectType: dto.relatedObjectType,
          relatedObjectId: dto.relatedObjectId,
          relatedObjectCode: dto.relatedObjectCode,
          relatedObjectName: dto.relatedObjectName,
          address: dto.address,
          reason: dto.reason,
          description: dto.description,
          paymentMethod: dto.paymentMethod,
          cashAccountCode: dto.cashAccountCode,
          lines,
          totalAmount: totals.totalAmount,
          totalTaxAmount: totals.totalTaxAmount,
          grandTotal: totals.grandTotal,
          amountInWords: numberToWords(totals.grandTotal),
          status: 'DRAFT',
          receiverName: dto.receiverName,
          receiverId: dto.receiverId,
          originalVoucherNo: dto.originalVoucherNo,
          originalVoucherDate: dto.originalVoucherDate,
          preparedBy: 'Nguyễn Văn A',
          preparedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user_001'
        };

        const currentVouchers = this.vouchers$.value;
        this.vouchers$.next([...currentVouchers, voucher]);

        return voucher;
      })
    );
  }

  /**
   * Cập nhật phiếu
   */
  updateVoucher(id: string, updates: Partial<CashVoucher>): Observable<CashVoucher> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const currentVouchers = this.vouchers$.value;
        const index = currentVouchers.findIndex(v => v.id === id);

        if (index < 0) {
          throw new Error('Không tìm thấy phiếu');
        }

        const voucher = currentVouchers[index];
        if (voucher.status !== 'DRAFT') {
          throw new Error('Chỉ có thể sửa phiếu nháp');
        }

        // Recalculate totals if lines changed
        let totals = {
          totalAmount: voucher.totalAmount,
          totalTaxAmount: voucher.totalTaxAmount,
          grandTotal: voucher.grandTotal
        };

        if (updates.lines) {
          totals = calculateVoucherTotals(updates.lines);
        }

        const updatedVoucher: CashVoucher = {
          ...voucher,
          ...updates,
          ...totals,
          amountInWords: numberToWords(totals.grandTotal),
          updatedAt: new Date()
        };

        currentVouchers[index] = updatedVoucher;
        this.vouchers$.next([...currentVouchers]);

        return updatedVoucher;
      })
    );
  }

  /**
   * Ghi sổ phiếu
   */
  postVoucher(id: string): Observable<CashVoucher> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const currentVouchers = this.vouchers$.value;
        const index = currentVouchers.findIndex(v => v.id === id);

        if (index < 0) {
          throw new Error('Không tìm thấy phiếu');
        }

        const voucher = currentVouchers[index];
        if (voucher.status !== 'DRAFT') {
          throw new Error('Chỉ có thể ghi sổ phiếu nháp');
        }

        // Validate
        const errors = validateVoucher(voucher);
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }

        const updatedVoucher: CashVoucher = {
          ...voucher,
          status: 'POSTED',
          postingDate: new Date(),
          postedBy: 'Nguyễn Văn A',
          postedAt: new Date(),
          updatedAt: new Date()
        };

        currentVouchers[index] = updatedVoucher;
        this.vouchers$.next([...currentVouchers]);

        return updatedVoucher;
      })
    );
  }

  /**
   * Hủy phiếu
   */
  cancelVoucher(id: string, reason: string): Observable<CashVoucher> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const currentVouchers = this.vouchers$.value;
        const index = currentVouchers.findIndex(v => v.id === id);

        if (index < 0) {
          throw new Error('Không tìm thấy phiếu');
        }

        const voucher = currentVouchers[index];
        if (voucher.status === 'CANCELLED') {
          throw new Error('Phiếu đã bị hủy');
        }

        if (!reason || reason.length < 10) {
          throw new Error('Lý do hủy phải >= 10 ký tự');
        }

        const updatedVoucher: CashVoucher = {
          ...voucher,
          status: 'CANCELLED',
          cancelledBy: 'Nguyễn Văn A',
          cancelledAt: new Date(),
          cancelReason: reason,
          updatedAt: new Date()
        };

        currentVouchers[index] = updatedVoucher;
        this.vouchers$.next([...currentVouchers]);

        return updatedVoucher;
      })
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
    const sequence = type === 'RECEIPT' ? this.receiptSequence : this.paymentSequence;
    return of(generateVoucherNo(type, sequence)).pipe(delay(100));
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
  }

  /**
   * Xuất Excel
   */
  exportExcel(filter?: VoucherFilter): Observable<Blob> {
    return of(new Blob(['Demo Excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      .pipe(delay(500));
  }

  /**
   * In phiếu
   */
  printVoucher(id: string): Observable<Blob> {
    return of(new Blob(['Demo PDF'], { type: 'application/pdf' }))
      .pipe(delay(500));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════

  private initializeDemoData(): void {
    const currentYear = new Date().getFullYear();

    const demoVouchers: CashVoucher[] = [
      // Phiếu thu
      {
        id: 'pt_001',
        voucherType: 'RECEIPT',
        voucherNo: `PT${currentYear}00001`,
        voucherDate: new Date(currentYear, 0, 5),
        postingDate: new Date(currentYear, 0, 5),
        relatedObjectType: 'CUSTOMER',
        relatedObjectId: 'cust_001',
        relatedObjectCode: 'KH001',
        relatedObjectName: 'Công ty TNHH ABC',
        address: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
        reason: 'Thu tiền khách hàng trả nợ',
        paymentMethod: 'CASH',
        cashAccountCode: '1111',
        lines: [
          {
            id: 'line_001',
            lineNo: 1,
            description: 'Thu nợ hóa đơn HD001',
            accountCode: '131',
            accountName: 'Phải thu khách hàng',
            amount: 15000000,
            taxAmount: 0
          }
        ],
        totalAmount: 15000000,
        totalTaxAmount: 0,
        grandTotal: 15000000,
        amountInWords: 'Mười lăm triệu đồng',
        status: 'POSTED',
        receiverName: 'Nguyễn Văn B',
        preparedBy: 'Lê Thị C',
        preparedAt: new Date(currentYear, 0, 5),
        approvedBy: 'Trần Văn D',
        approvedAt: new Date(currentYear, 0, 5),
        postedBy: 'Lê Thị C',
        postedAt: new Date(currentYear, 0, 5),
        createdAt: new Date(currentYear, 0, 5),
        updatedAt: new Date(currentYear, 0, 5),
        createdBy: 'user_001'
      },
      {
        id: 'pt_002',
        voucherType: 'RECEIPT',
        voucherNo: `PT${currentYear}00002`,
        voucherDate: new Date(currentYear, 0, 10),
        postingDate: new Date(currentYear, 0, 10),
        relatedObjectType: 'CUSTOMER',
        relatedObjectName: 'Khách lẻ',
        reason: 'Thu tiền bán hàng',
        paymentMethod: 'CASH',
        cashAccountCode: '1111',
        lines: [
          {
            id: 'line_002',
            lineNo: 1,
            description: 'Bán hàng tạp hóa',
            accountCode: '5111',
            accountName: 'Doanh thu bán hàng hóa',
            amount: 2500000,
            taxAmount: 0
          }
        ],
        totalAmount: 2500000,
        totalTaxAmount: 0,
        grandTotal: 2500000,
        amountInWords: 'Hai triệu năm trăm nghìn đồng',
        status: 'POSTED',
        preparedBy: 'Lê Thị C',
        preparedAt: new Date(currentYear, 0, 10),
        postedBy: 'Lê Thị C',
        postedAt: new Date(currentYear, 0, 10),
        createdAt: new Date(currentYear, 0, 10),
        updatedAt: new Date(currentYear, 0, 10),
        createdBy: 'user_001'
      },

      // Phiếu chi
      {
        id: 'pc_001',
        voucherType: 'PAYMENT',
        voucherNo: `PC${currentYear}00001`,
        voucherDate: new Date(currentYear, 0, 7),
        postingDate: new Date(currentYear, 0, 7),
        relatedObjectType: 'SUPPLIER',
        relatedObjectId: 'supp_001',
        relatedObjectCode: 'NCC001',
        relatedObjectName: 'Công ty CP XYZ',
        address: '456 Lê Lợi, Q.1, TP.HCM',
        reason: 'Chi trả nợ nhà cung cấp',
        paymentMethod: 'CASH',
        cashAccountCode: '1111',
        lines: [
          {
            id: 'line_003',
            lineNo: 1,
            description: 'Thanh toán hóa đơn mua hàng MH001',
            accountCode: '331',
            accountName: 'Phải trả người bán',
            amount: 8000000,
            taxAmount: 0
          }
        ],
        totalAmount: 8000000,
        totalTaxAmount: 0,
        grandTotal: 8000000,
        amountInWords: 'Tám triệu đồng',
        status: 'POSTED',
        receiverName: 'Phạm Văn E',
        preparedBy: 'Lê Thị C',
        preparedAt: new Date(currentYear, 0, 7),
        approvedBy: 'Trần Văn D',
        approvedAt: new Date(currentYear, 0, 7),
        postedBy: 'Lê Thị C',
        postedAt: new Date(currentYear, 0, 7),
        createdAt: new Date(currentYear, 0, 7),
        updatedAt: new Date(currentYear, 0, 7),
        createdBy: 'user_001'
      },
      {
        id: 'pc_002',
        voucherType: 'PAYMENT',
        voucherNo: `PC${currentYear}00002`,
        voucherDate: new Date(currentYear, 0, 15),
        relatedObjectType: 'EMPLOYEE',
        relatedObjectId: 'emp_001',
        relatedObjectCode: 'NV001',
        relatedObjectName: 'Nguyễn Văn F',
        reason: 'Chi tạm ứng công tác phí',
        paymentMethod: 'CASH',
        cashAccountCode: '1111',
        lines: [
          {
            id: 'line_004',
            lineNo: 1,
            description: 'Tạm ứng đi công tác Hà Nội',
            accountCode: '141',
            accountName: 'Tạm ứng',
            amount: 5000000,
            taxAmount: 0
          }
        ],
        totalAmount: 5000000,
        totalTaxAmount: 0,
        grandTotal: 5000000,
        amountInWords: 'Năm triệu đồng',
        status: 'DRAFT',
        receiverName: 'Nguyễn Văn F',
        receiverId: '079123456789',
        preparedBy: 'Lê Thị C',
        preparedAt: new Date(currentYear, 0, 15),
        createdAt: new Date(currentYear, 0, 15),
        updatedAt: new Date(currentYear, 0, 15),
        createdBy: 'user_001'
      }
    ];

    this.vouchers$.next(demoVouchers);
    this.receiptSequence = 3;
    this.paymentSequence = 3;
  }
}
