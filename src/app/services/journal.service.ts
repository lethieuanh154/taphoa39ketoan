import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  JournalEntry,
  JournalFilter,
  JournalResponse,
  JournalSummary,
  VoucherDetail,
  VoucherSourceType
} from '../models/journal.models';

/**
 * JOURNAL SERVICE
 * Service quản lý Sổ nhật ký chung
 *
 * LƯU Ý NGHIỆP VỤ:
 * - Sổ NKC chỉ READ-ONLY, không cho thêm/sửa/xóa trực tiếp
 * - Dữ liệu được tổng hợp từ các chứng từ nguồn
 * - Hỗ trợ drill-down về chứng từ gốc
 */
@Injectable({
  providedIn: 'root'
})
export class JournalService {

  private currentFilter$ = new BehaviorSubject<JournalFilter>({
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  constructor() {}

  /**
   * Lấy danh sách bút toán theo bộ lọc
   */
  getJournalEntries(filter: JournalFilter, page: number = 1, pageSize: number = 50): Observable<JournalResponse> {
    // TODO: Gọi API thực tế
    // return this.http.get<JournalResponse>('/api/accounting/journal', { params: { ... } });

    // Demo data
    const demoEntries = this.generateDemoData(filter);
    const summary = this.calculateSummary(demoEntries);

    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = demoEntries.slice(startIndex, startIndex + pageSize);

    return of({
      entries: paginatedEntries,
      summary: summary,
      period: {
        from: this.getPeriodStart(filter),
        to: this.getPeriodEnd(filter),
        isLocked: filter.month && filter.month < new Date().getMonth() + 1 ? true : false
      },
      pagination: {
        page: page,
        pageSize: pageSize,
        totalItems: demoEntries.length,
        totalPages: Math.ceil(demoEntries.length / pageSize)
      }
    }).pipe(delay(300)); // Simulate network delay
  }

  /**
   * Lấy chi tiết chứng từ nguồn
   */
  getVoucherDetail(sourceType: VoucherSourceType, sourceId: string): Observable<VoucherDetail> {
    // TODO: Gọi API thực tế
    // return this.http.get<VoucherDetail>(`/api/accounting/voucher/${sourceType}/${sourceId}`);

    // Demo
    return of({
      id: sourceId,
      type: sourceType,
      number: 'PT001',
      date: new Date().toISOString(),
      description: 'Thu tiền bán hàng - KH Minh Anh',
      totalAmount: 5000000,
      entries: [],
      createdBy: 'admin',
      approvedBy: 'ketoan'
    }).pipe(delay(200));
  }

  /**
   * Xuất Excel
   */
  exportToExcel(filter: JournalFilter): Observable<Blob> {
    // TODO: Gọi API xuất file
    // return this.http.get('/api/accounting/journal/export', { responseType: 'blob', params: { ... } });

    return of(new Blob()).pipe(delay(500));
  }

  /**
   * In PDF
   */
  printPDF(filter: JournalFilter): Observable<Blob> {
    // TODO: Gọi API in PDF
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * Kiểm tra kỳ có bị khóa không
   */
  isPeriodLocked(period: string): Observable<boolean> {
    // TODO: Gọi API kiểm tra
    const [year, month] = period.split('-').map(Number);
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    return of(year < currentYear || (year === currentYear && month < currentMonth));
  }

  // === PRIVATE METHODS ===

  private getPeriodStart(filter: JournalFilter): string {
    if (filter.periodType === 'custom' && filter.fromDate) {
      return filter.fromDate as string;
    }
    if (filter.periodType === 'month' && filter.month) {
      return `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const startMonth = (filter.quarter - 1) * 3 + 1;
      return `${filter.year}-${String(startMonth).padStart(2, '0')}-01`;
    }
    return `${filter.year}-01-01`;
  }

  private getPeriodEnd(filter: JournalFilter): string {
    if (filter.periodType === 'custom' && filter.toDate) {
      return filter.toDate as string;
    }
    if (filter.periodType === 'month' && filter.month) {
      const lastDay = new Date(filter.year, filter.month, 0).getDate();
      return `${filter.year}-${String(filter.month).padStart(2, '0')}-${lastDay}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const endMonth = filter.quarter * 3;
      const lastDay = new Date(filter.year, endMonth, 0).getDate();
      return `${filter.year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
    }
    return `${filter.year}-12-31`;
  }

  private calculateSummary(entries: JournalEntry[]): JournalSummary {
    const totalDebit = entries.reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.amount, 0);

    return {
      totalDebit,
      totalCredit,
      entryCount: entries.length,
      isBalanced: totalDebit === totalCredit,
      difference: Math.abs(totalDebit - totalCredit)
    };
  }

  private generateDemoData(filter: JournalFilter): JournalEntry[] {
    const entries: JournalEntry[] = [];
    const year = filter.year;
    const month = filter.month || 1;

    // Demo: Tạo các bút toán mẫu
    const demoTransactions = [
      // Phiếu thu
      { debit: '111', credit: '511', amount: 5000000, desc: 'Thu tiền bán hàng - KH001', source: 'PHIEU_THU' as VoucherSourceType, voucher: 'PT001' },
      { debit: '111', credit: '131', amount: 3500000, desc: 'Thu công nợ - KH Minh Anh', source: 'PHIEU_THU' as VoucherSourceType, voucher: 'PT002' },

      // Phiếu chi
      { debit: '331', credit: '111', amount: 2000000, desc: 'Trả tiền NCC ABC', source: 'PHIEU_CHI' as VoucherSourceType, voucher: 'PC001' },
      { debit: '642', credit: '111', amount: 500000, desc: 'Chi phí văn phòng', source: 'PHIEU_CHI' as VoucherSourceType, voucher: 'PC002' },
      { debit: '642', credit: '111', amount: 1200000, desc: 'Tiền điện tháng 12', source: 'PHIEU_CHI' as VoucherSourceType, voucher: 'PC003' },

      // Hóa đơn bán
      { debit: '131', credit: '511', amount: 15000000, desc: 'Bán hàng - HĐ0001256', source: 'HOA_DON_BAN' as VoucherSourceType, voucher: 'HD001256' },
      { debit: '131', credit: '3331', amount: 1500000, desc: 'Thuế GTGT đầu ra - HĐ0001256', source: 'HOA_DON_BAN' as VoucherSourceType, voucher: 'HD001256' },

      // Hóa đơn mua
      { debit: '156', credit: '331', amount: 8000000, desc: 'Mua hàng hóa - NCC XYZ', source: 'HOA_DON_MUA' as VoucherSourceType, voucher: 'MH001' },
      { debit: '1331', credit: '331', amount: 800000, desc: 'Thuế GTGT đầu vào - MH001', source: 'HOA_DON_MUA' as VoucherSourceType, voucher: 'MH001' },

      // Xuất kho
      { debit: '632', credit: '156', amount: 10000000, desc: 'Giá vốn hàng bán', source: 'PHIEU_XUAT' as VoucherSourceType, voucher: 'XK001' },

      // Lương
      { debit: '642', credit: '334', amount: 25000000, desc: 'Chi phí lương T12/2025', source: 'BANG_LUONG' as VoucherSourceType, voucher: 'BL12' },
      { debit: '642', credit: '3383', amount: 4250000, desc: 'BHXH DN đóng', source: 'BANG_LUONG' as VoucherSourceType, voucher: 'BL12' },
      { debit: '334', credit: '3383', amount: 2000000, desc: 'BHXH NV đóng', source: 'BANG_LUONG' as VoucherSourceType, voucher: 'BL12' },
      { debit: '334', credit: '3335', amount: 500000, desc: 'Thuế TNCN khấu trừ', source: 'BANG_LUONG' as VoucherSourceType, voucher: 'BL12' },

      // Chuyển khoản
      { debit: '112', credit: '111', amount: 20000000, desc: 'Nộp tiền vào ngân hàng', source: 'UNC_CHI' as VoucherSourceType, voucher: 'UNC001' },
    ];

    demoTransactions.forEach((t, index) => {
      const day = Math.min(index + 1, 28);
      entries.push({
        id: `JE${year}${month}${String(index + 1).padStart(4, '0')}`,
        entryDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        voucherDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        voucherNumber: t.voucher,
        description: t.desc,
        debitAccount: t.debit,
        debitAccountName: this.getAccountName(t.debit),
        creditAccount: t.credit,
        creditAccountName: this.getAccountName(t.credit),
        amount: t.amount,
        sourceType: t.source,
        sourceId: `${t.source}_${t.voucher}`,
        sourceNumber: t.voucher,
        period: `${year}-${String(month).padStart(2, '0')}`,
        fiscalYear: year,
        status: 'NORMAL',
        isLocked: false
      });
    });

    return entries.sort((a, b) =>
      new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
  }

  private getAccountName(code: string): string {
    const accounts: Record<string, string> = {
      '111': 'Tiền mặt',
      '112': 'Tiền gửi ngân hàng',
      '131': 'Phải thu khách hàng',
      '1331': 'Thuế GTGT được khấu trừ',
      '156': 'Hàng hóa',
      '331': 'Phải trả người bán',
      '334': 'Phải trả người lao động',
      '3331': 'Thuế GTGT phải nộp',
      '3335': 'Thuế TNCN',
      '3383': 'Bảo hiểm xã hội',
      '511': 'Doanh thu bán hàng',
      '632': 'Giá vốn hàng bán',
      '642': 'Chi phí quản lý doanh nghiệp'
    };
    return accounts[code] || code;
  }
}
