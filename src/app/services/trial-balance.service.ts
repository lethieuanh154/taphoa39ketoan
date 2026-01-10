import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  TrialBalanceRow,
  TrialBalanceFilter,
  TrialBalanceResponse,
  BalanceCheckResult,
  checkTrialBalance,
  checkAbnormalBalance
} from '../models/trial-balance.models';
import {
  STANDARD_ACCOUNTS,
  calculateClosingBalance
} from '../models/ledger.models';

/**
 * TRIAL BALANCE SERVICE
 * Service quản lý Bảng cân đối tài khoản
 *
 * LƯU Ý NGHIỆP VỤ:
 * - READ-ONLY: Không cho phép thêm/sửa/xóa
 * - Dữ liệu 100% tự động từ Sổ cái
 * - Kiểm tra cân đối: Tổng Nợ = Tổng Có
 * - Là checkpoint bắt buộc trước khi lập BCTC
 */
@Injectable({
  providedIn: 'root'
})
export class TrialBalanceService {

  constructor() {}

  /**
   * Lấy Bảng cân đối tài khoản
   */
  getTrialBalance(filter: TrialBalanceFilter): Observable<TrialBalanceResponse> {
    // TODO: Gọi API thực tế
    // return this.http.get<TrialBalanceResponse>('/api/accounting/trial-balance', { params: { ... } });

    const rows = this.generateDemoData(filter);
    const balanceCheck = checkTrialBalance(rows);

    return of({
      rows: rows,
      balanceCheck: balanceCheck,
      period: {
        from: this.getPeriodStart(filter),
        to: this.getPeriodEnd(filter),
        label: this.getPeriodLabel(filter),
        isLocked: this.checkPeriodLocked(filter)
      },
      generatedAt: new Date().toISOString()
    }).pipe(delay(300));
  }

  /**
   * Kiểm tra cân đối
   */
  checkBalance(rows: TrialBalanceRow[]): BalanceCheckResult {
    return checkTrialBalance(rows);
  }

  /**
   * Xuất Excel theo mẫu TT 99/2025
   */
  exportExcel(filter: TrialBalanceFilter): Observable<Blob> {
    // TODO: Gọi API xuất file
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * In PDF theo mẫu TT 99/2025
   */
  exportPDF(filter: TrialBalanceFilter): Observable<Blob> {
    // TODO: Gọi API in PDF
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * Kiểm tra có thể lập BCTC không
   */
  canGenerateFinancialReport(filter: TrialBalanceFilter): Observable<{ canGenerate: boolean; reasons: string[] }> {
    return new Observable(observer => {
      this.getTrialBalance(filter).subscribe({
        next: (response) => {
          const reasons: string[] = [];

          if (!response.balanceCheck.isFullyBalanced) {
            reasons.push('Bảng cân đối tài khoản chưa cân đối');
          }
          if (response.balanceCheck.abnormalAccounts > 0) {
            reasons.push(`Có ${response.balanceCheck.abnormalAccounts} tài khoản bất thường`);
          }
          if (!response.period.isLocked) {
            reasons.push('Kỳ kế toán chưa được khóa');
          }

          observer.next({
            canGenerate: reasons.length === 0,
            reasons: reasons
          });
          observer.complete();
        },
        error: (err) => observer.error(err)
      });
    });
  }

  // === PRIVATE METHODS ===

  private getPeriodStart(filter: TrialBalanceFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const startMonth = (filter.quarter - 1) * 3 + 1;
      return `${filter.year}-${String(startMonth).padStart(2, '0')}-01`;
    }
    return `${filter.year}-01-01`;
  }

  private getPeriodEnd(filter: TrialBalanceFilter): string {
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

  private getPeriodLabel(filter: TrialBalanceFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `Tháng ${filter.month}/${filter.year}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      return `Quý ${filter.quarter}/${filter.year}`;
    }
    return `Năm ${filter.year}`;
  }

  private checkPeriodLocked(filter: TrialBalanceFilter): boolean {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    if (filter.year < currentYear) return true;
    if (filter.year === currentYear && filter.month && filter.month < currentMonth) return true;

    return false;
  }

  private generateDemoData(filter: TrialBalanceFilter): TrialBalanceRow[] {
    // Demo data - các TK có số dư
    const accountData: Record<string, { openD: number; openC: number; periodD: number; periodC: number }> = {
      // Loại 1: Tài sản
      '111': { openD: 50000000, openC: 0, periodD: 28500000, periodC: 23700000 },
      '112': { openD: 200000000, openC: 0, periodD: 20000000, periodC: 0 },
      '131': { openD: 35000000, openC: 0, periodD: 16500000, periodC: 3500000 },
      '1331': { openD: 5000000, openC: 0, periodD: 800000, periodC: 0 },
      '156': { openD: 80000000, openC: 0, periodD: 8000000, periodC: 10000000 },

      // Loại 3: Nợ phải trả
      '331': { openD: 0, openC: 25000000, periodD: 2000000, periodC: 8800000 },
      '334': { openD: 0, openC: 0, periodD: 2500000, periodC: 25000000 },
      '3331': { openD: 0, openC: 3000000, periodD: 0, periodC: 1500000 },
      '3335': { openD: 0, openC: 0, periodD: 0, periodC: 500000 },
      '3383': { openD: 0, openC: 2000000, periodD: 0, periodC: 6250000 },

      // Loại 4: Vốn CSH
      '411': { openD: 0, openC: 500000000, periodD: 0, periodC: 0 },
      '421': { openD: 0, openC: 0, periodD: 0, periodC: 0 }, // Sẽ tính sau

      // Loại 5: Doanh thu
      '511': { openD: 0, openC: 0, periodD: 0, periodC: 20000000 },

      // Loại 6: Giá vốn & Chi phí
      '632': { openD: 0, openC: 0, periodD: 10000000, periodC: 0 },
      '642': { openD: 0, openC: 0, periodD: 30950000, periodC: 0 },
    };

    // Tính lợi nhuận để cân đối
    // Tổng dư Nợ đầu kỳ = 50 + 200 + 35 + 5 + 80 = 370 triệu
    // Tổng dư Có đầu kỳ = 25 + 3 + 2 + 500 = 530 triệu
    // Chênh lệch = 160 triệu → đây là LNST năm trước
    accountData['421'] = { openD: 0, openC: 160000000, periodD: 0, periodC: 0 };

    const rows: TrialBalanceRow[] = [];

    Object.entries(accountData).forEach(([code, data]) => {
      const template = STANDARD_ACCOUNTS.find(a => a.code === code);
      if (!template) return;

      const closing = calculateClosingBalance(
        data.openD,
        data.openC,
        data.periodD,
        data.periodC
      );

      const row: TrialBalanceRow = {
        accountCode: code,
        accountName: template.name,
        level: template.level,
        parentCode: template.parentCode,
        openingDebit: data.openD,
        openingCredit: data.openC,
        periodDebit: data.periodD,
        periodCredit: data.periodC,
        closingDebit: closing.closingDebit,
        closingCredit: closing.closingCredit,
        accountType: template.type,
        nature: template.nature,
        isAbnormal: false,
        entryCount: Math.floor(Math.random() * 10) + 1
      };

      // Kiểm tra bất thường
      const abnormalCheck = checkAbnormalBalance(row);
      row.isAbnormal = abnormalCheck.isAbnormal;
      row.abnormalReason = abnormalCheck.reason;

      rows.push(row);
    });

    // Lọc theo điều kiện
    let filteredRows = rows;

    if (!filter.includeZeroBalance) {
      filteredRows = filteredRows.filter(r =>
        r.openingDebit !== 0 || r.openingCredit !== 0 ||
        r.periodDebit !== 0 || r.periodCredit !== 0 ||
        r.closingDebit !== 0 || r.closingCredit !== 0
      );
    }

    if (!filter.includeSubAccounts) {
      filteredRows = filteredRows.filter(r => r.level === 1);
    }

    if (filter.accountLevel) {
      filteredRows = filteredRows.filter(r => r.level <= filter.accountLevel!);
    }

    return filteredRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }
}
