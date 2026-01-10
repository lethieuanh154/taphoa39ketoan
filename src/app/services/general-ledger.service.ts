import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  GeneralLedgerFilter,
  GeneralLedgerResponse,
  GeneralLedgerDetailResponse,
  GeneralLedgerSummary,
  GeneralLedgerVoucherDetail,
  GeneralLedgerSourceType,
  STANDARD_ACCOUNTS,
  calculateClosingBalance,
  isAbnormalBalance
} from '../models/ledger.models';

/**
 * GENERAL LEDGER SERVICE
 * Service quản lý Sổ cái theo tài khoản
 *
 * LƯU Ý NGHIỆP VỤ:
 * - Sổ cái chỉ READ-ONLY, không cho thêm/sửa/xóa trực tiếp
 * - Dữ liệu được tổng hợp từ Sổ nhật ký chung
 * - Hỗ trợ drill-down về chứng từ gốc
 * - Kiểm tra cân đối: Tổng Nợ = Tổng Có
 */
@Injectable({
  providedIn: 'root'
})
export class GeneralLedgerService {

  constructor() {}

  /**
   * Lấy danh sách tất cả tài khoản có phát sinh trong kỳ
   */
  getAccounts(filter: GeneralLedgerFilter): Observable<GeneralLedgerResponse> {
    // TODO: Gọi API thực tế
    // return this.http.get<GeneralLedgerResponse>('/api/accounting/ledger/accounts', { params: { ... } });

    const accounts = this.generateDemoAccounts(filter);
    const summary = this.calculateSummary(accounts);

    return of({
      accounts: accounts,
      summary: summary,
      period: {
        from: this.getPeriodStart(filter),
        to: this.getPeriodEnd(filter),
        label: this.getPeriodLabel(filter),
        isLocked: this.checkPeriodLocked(filter)
      }
    }).pipe(delay(300));
  }

  /**
   * Lấy chi tiết Sổ cái theo tài khoản
   */
  getLedgerByAccount(accountCode: string, filter: GeneralLedgerFilter): Observable<GeneralLedgerDetailResponse> {
    // TODO: Gọi API thực tế
    // return this.http.get<GeneralLedgerDetailResponse>(`/api/accounting/ledger/${accountCode}`, { params: { ... } });

    const account = this.generateAccountDetail(accountCode, filter);
    const entries = this.generateDemoEntries(accountCode, filter);

    return of({
      account: account,
      entries: entries,
      period: {
        from: this.getPeriodStart(filter),
        to: this.getPeriodEnd(filter),
        label: this.getPeriodLabel(filter),
        isLocked: this.checkPeriodLocked(filter)
      }
    }).pipe(delay(300));
  }

  /**
   * Lấy chi tiết chứng từ nguồn (Drill-down)
   */
  getVoucherDetail(sourceType: GeneralLedgerSourceType, sourceId: string): Observable<GeneralLedgerVoucherDetail> {
    // TODO: Gọi API thực tế
    return of({
      voucherType: sourceType,
      voucherNo: sourceId.split('_')[1] || sourceId,
      voucherDate: new Date().toISOString(),
      description: 'Chi tiết chứng từ demo',
      totalAmount: 5000000,
      partner: 'Công ty ABC',
      taxCode: '0123456789',
      journalEntries: [
        { debitAccount: '111', creditAccount: '511', amount: 5000000, description: 'Thu tiền bán hàng' }
      ],
      relatedDocuments: []
    }).pipe(delay(200));
  }

  /**
   * Xuất Excel sổ cái
   */
  exportExcel(accountCode: string, filter: GeneralLedgerFilter): Observable<Blob> {
    // TODO: Gọi API xuất file
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * In PDF sổ cái
   */
  exportPDF(accountCode: string, filter: GeneralLedgerFilter): Observable<Blob> {
    // TODO: Gọi API in PDF
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * Kiểm tra sổ cái có khớp với sổ nhật ký chung không
   */
  validateAgainstJournal(filter: GeneralLedgerFilter): Observable<{ isValid: boolean; differences: any[] }> {
    // TODO: Gọi API kiểm tra
    return of({ isValid: true, differences: [] }).pipe(delay(500));
  }

  // === PRIVATE METHODS ===

  private getPeriodStart(filter: GeneralLedgerFilter): string {
    if (filter.periodType === 'custom' && filter.fromDate) {
      return filter.fromDate;
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

  private getPeriodEnd(filter: GeneralLedgerFilter): string {
    if (filter.periodType === 'custom' && filter.toDate) {
      return filter.toDate;
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

  private getPeriodLabel(filter: GeneralLedgerFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `Tháng ${filter.month}/${filter.year}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      return `Quý ${filter.quarter}/${filter.year}`;
    }
    if (filter.periodType === 'year') {
      return `Năm ${filter.year}`;
    }
    return `${filter.fromDate} - ${filter.toDate}`;
  }

  private checkPeriodLocked(filter: GeneralLedgerFilter): boolean {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (filter.year < currentYear) return true;
    if (filter.year === currentYear && filter.month && filter.month < currentMonth) return true;

    return false;
  }

  private calculateSummary(accounts: GeneralLedgerAccount[]): GeneralLedgerSummary {
    const totalDebit = accounts.reduce((sum, a) => sum + a.totalDebit, 0);
    const totalCredit = accounts.reduce((sum, a) => sum + a.totalCredit, 0);
    const abnormalCount = accounts.filter(a => a.balanceStatus === 'ABNORMAL').length;
    const zeroCount = accounts.filter(a => a.balanceStatus === 'ZERO').length;

    return {
      totalAccounts: accounts.length,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      difference: Math.abs(totalDebit - totalCredit),
      abnormalAccounts: abnormalCount,
      zeroBalanceAccounts: zeroCount
    };
  }

  private generateDemoAccounts(filter: GeneralLedgerFilter): GeneralLedgerAccount[] {
    // Demo data - các TK có phát sinh trong kỳ
    const accountsWithData = [
      { code: '111', openD: 50000000, openC: 0, debit: 28500000, credit: 23700000 },
      { code: '112', openD: 200000000, openC: 0, debit: 20000000, credit: 0 },
      { code: '131', openD: 35000000, openC: 0, debit: 16500000, credit: 3500000 },
      { code: '1331', openD: 5000000, openC: 0, debit: 800000, credit: 0 },
      { code: '156', openD: 80000000, openC: 0, debit: 8000000, credit: 10000000 },
      { code: '331', openD: 0, openC: 25000000, debit: 2000000, credit: 8800000 },
      { code: '334', openD: 0, openC: 0, debit: 2500000, credit: 25000000 },
      { code: '3331', openD: 0, openC: 3000000, debit: 0, credit: 1500000 },
      { code: '3335', openD: 0, openC: 0, debit: 0, credit: 500000 },
      { code: '3383', openD: 0, openC: 2000000, debit: 0, credit: 6250000 },
      { code: '411', openD: 0, openC: 500000000, debit: 0, credit: 0 },
      { code: '511', openD: 0, openC: 0, debit: 0, credit: 20000000 },
      { code: '632', openD: 0, openC: 0, debit: 10000000, credit: 0 },
      { code: '642', openD: 0, openC: 0, debit: 30950000, credit: 0 },
    ];

    const accounts: GeneralLedgerAccount[] = [];

    accountsWithData.forEach(data => {
      const template = STANDARD_ACCOUNTS.find(a => a.code === data.code);
      if (!template) return;

      const closing = calculateClosingBalance(data.openD, data.openC, data.debit, data.credit);
      const isAbnormal = isAbnormalBalance(data.code, closing.closingDebit, closing.closingCredit);
      const isZero = closing.closingDebit === 0 && closing.closingCredit === 0 &&
                     data.debit === 0 && data.credit === 0;

      accounts.push({
        accountCode: template.code,
        accountName: template.name,
        parentCode: template.parentCode,
        level: template.level,
        accountType: template.type,
        nature: template.nature,
        openingDebit: data.openD,
        openingCredit: data.openC,
        totalDebit: data.debit,
        totalCredit: data.credit,
        closingDebit: closing.closingDebit,
        closingCredit: closing.closingCredit,
        balanceStatus: isAbnormal ? 'ABNORMAL' : (isZero ? 'ZERO' : 'NORMAL'),
        hasChildren: STANDARD_ACCOUNTS.some(a => a.parentCode === template.code),
        entryCount: Math.floor(Math.random() * 10) + 1
      });
    });

    // Lọc TK có số dư = 0 nếu cần
    if (!filter.showZeroBalance) {
      return accounts.filter(a => a.balanceStatus !== 'ZERO');
    }

    return accounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  private generateAccountDetail(accountCode: string, filter: GeneralLedgerFilter): GeneralLedgerAccount {
    const template = STANDARD_ACCOUNTS.find(a => a.code === accountCode);

    if (!template) {
      return {
        accountCode,
        accountName: 'Tài khoản không xác định',
        level: 1,
        accountType: 'ASSET',
        nature: 'DEBIT',
        openingDebit: 0,
        openingCredit: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        balanceStatus: 'ZERO',
        hasChildren: false,
        entryCount: 0
      };
    }

    // Demo số liệu
    const demoData: Record<string, { openD: number; openC: number; debit: number; credit: number }> = {
      '111': { openD: 50000000, openC: 0, debit: 28500000, credit: 23700000 },
      '112': { openD: 200000000, openC: 0, debit: 20000000, credit: 0 },
      '131': { openD: 35000000, openC: 0, debit: 16500000, credit: 3500000 },
      '156': { openD: 80000000, openC: 0, debit: 8000000, credit: 10000000 },
      '331': { openD: 0, openC: 25000000, debit: 2000000, credit: 8800000 },
      '511': { openD: 0, openC: 0, debit: 0, credit: 20000000 },
      '632': { openD: 0, openC: 0, debit: 10000000, credit: 0 },
      '642': { openD: 0, openC: 0, debit: 30950000, credit: 0 },
    };

    const data = demoData[accountCode] || { openD: 0, openC: 0, debit: 0, credit: 0 };
    const closing = calculateClosingBalance(data.openD, data.openC, data.debit, data.credit);
    const isAbnormal = isAbnormalBalance(accountCode, closing.closingDebit, closing.closingCredit);

    return {
      accountCode: template.code,
      accountName: template.name,
      parentCode: template.parentCode,
      level: template.level,
      accountType: template.type,
      nature: template.nature,
      openingDebit: data.openD,
      openingCredit: data.openC,
      totalDebit: data.debit,
      totalCredit: data.credit,
      closingDebit: closing.closingDebit,
      closingCredit: closing.closingCredit,
      balanceStatus: isAbnormal ? 'ABNORMAL' : 'NORMAL',
      hasChildren: STANDARD_ACCOUNTS.some(a => a.parentCode === template.code),
      entryCount: 10
    };
  }

  private generateDemoEntries(accountCode: string, filter: GeneralLedgerFilter): GeneralLedgerEntry[] {
    const year = filter.year;
    const month = filter.month || 1;
    const entries: GeneralLedgerEntry[] = [];

    // Demo data theo từng TK
    const entriesData: Record<string, Array<{
      day: number;
      voucher: string;
      desc: string;
      debit: number;
      credit: number;
      counter: string;
      source: GeneralLedgerSourceType;
    }>> = {
      '111': [
        { day: 1, voucher: 'PT001', desc: 'Thu tiền bán hàng - KH001', debit: 5000000, credit: 0, counter: '511', source: 'RECEIPT' },
        { day: 3, voucher: 'PT002', desc: 'Thu công nợ - KH Minh Anh', debit: 3500000, credit: 0, counter: '131', source: 'RECEIPT' },
        { day: 5, voucher: 'PC001', desc: 'Trả tiền NCC ABC', debit: 0, credit: 2000000, counter: '331', source: 'PAYMENT' },
        { day: 8, voucher: 'PC002', desc: 'Chi phí văn phòng', debit: 0, credit: 500000, counter: '642', source: 'PAYMENT' },
        { day: 12, voucher: 'PC003', desc: 'Tiền điện tháng', debit: 0, credit: 1200000, counter: '642', source: 'PAYMENT' },
        { day: 15, voucher: 'UNC001', desc: 'Nộp tiền vào ngân hàng', debit: 0, credit: 20000000, counter: '112', source: 'BANK_TRANSFER' },
        { day: 20, voucher: 'PT003', desc: 'Thu tiền bán hàng - KH002', debit: 20000000, credit: 0, counter: '511', source: 'RECEIPT' },
      ],
      '112': [
        { day: 15, voucher: 'UNC001', desc: 'Nhận tiền từ quỹ tiền mặt', debit: 20000000, credit: 0, counter: '111', source: 'BANK_TRANSFER' },
      ],
      '131': [
        { day: 10, voucher: 'HD001256', desc: 'Bán hàng - Công ty XYZ', debit: 15000000, credit: 0, counter: '511', source: 'INVOICE_OUT' },
        { day: 10, voucher: 'HD001256', desc: 'Thuế GTGT đầu ra', debit: 1500000, credit: 0, counter: '3331', source: 'INVOICE_OUT' },
        { day: 3, voucher: 'PT002', desc: 'Thu công nợ - KH Minh Anh', debit: 0, credit: 3500000, counter: '111', source: 'RECEIPT' },
      ],
      '156': [
        { day: 7, voucher: 'MH001', desc: 'Mua hàng hóa - NCC XYZ', debit: 8000000, credit: 0, counter: '331', source: 'INVOICE_IN' },
        { day: 18, voucher: 'XK001', desc: 'Xuất kho bán hàng', debit: 0, credit: 10000000, counter: '632', source: 'INVENTORY_OUT' },
      ],
      '331': [
        { day: 7, voucher: 'MH001', desc: 'Mua hàng hóa - NCC XYZ', debit: 0, credit: 8000000, counter: '156', source: 'INVOICE_IN' },
        { day: 7, voucher: 'MH001', desc: 'Thuế GTGT đầu vào', debit: 0, credit: 800000, counter: '1331', source: 'INVOICE_IN' },
        { day: 5, voucher: 'PC001', desc: 'Trả tiền NCC ABC', debit: 2000000, credit: 0, counter: '111', source: 'PAYMENT' },
      ],
      '511': [
        { day: 1, voucher: 'PT001', desc: 'Thu tiền bán hàng - KH001', debit: 0, credit: 5000000, counter: '111', source: 'RECEIPT' },
        { day: 10, voucher: 'HD001256', desc: 'Bán hàng - Công ty XYZ', debit: 0, credit: 15000000, counter: '131', source: 'INVOICE_OUT' },
      ],
      '632': [
        { day: 18, voucher: 'XK001', desc: 'Giá vốn hàng bán', debit: 10000000, credit: 0, counter: '156', source: 'INVENTORY_OUT' },
      ],
      '642': [
        { day: 8, voucher: 'PC002', desc: 'Chi phí văn phòng', debit: 500000, credit: 0, counter: '111', source: 'PAYMENT' },
        { day: 12, voucher: 'PC003', desc: 'Tiền điện tháng', debit: 1200000, credit: 0, counter: '111', source: 'PAYMENT' },
        { day: 25, voucher: 'BL12', desc: 'Chi phí lương T12/2025', debit: 25000000, credit: 0, counter: '334', source: 'SALARY' },
        { day: 25, voucher: 'BL12', desc: 'BHXH DN đóng', debit: 4250000, credit: 0, counter: '3383', source: 'SALARY' },
      ],
    };

    const data = entriesData[accountCode] || [];

    // Tính số dư đầu kỳ cho running balance
    const account = this.generateAccountDetail(accountCode, filter);
    let runningDebit = account.openingDebit;
    let runningCredit = account.openingCredit;

    data.forEach((e, index) => {
      runningDebit += e.debit;
      runningCredit += e.credit;

      const counterTemplate = STANDARD_ACCOUNTS.find(a => a.code === e.counter);

      entries.push({
        id: `LE${accountCode}${year}${month}${String(index + 1).padStart(4, '0')}`,
        date: `${year}-${String(month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
        voucherDate: `${year}-${String(month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
        voucherNo: e.voucher,
        description: e.desc,
        debit: e.debit,
        credit: e.credit,
        counterpartAccount: e.counter,
        counterpartName: counterTemplate?.name || e.counter,
        runningDebit: runningDebit,
        runningCredit: runningCredit,
        sourceType: e.source,
        sourceId: `${e.source}_${e.voucher}`,
        isLocked: this.checkPeriodLocked(filter)
      });
    });

    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}
