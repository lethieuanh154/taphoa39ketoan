import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
import {
  BalanceSheetReport,
  BalanceSheetSection,
  BalanceSheetRow,
  BalanceSheetFilter,
  BalanceSheetValidation,
  validateBalanceSheet,
  SHORT_TERM_ASSETS_TEMPLATE,
  LONG_TERM_ASSETS_TEMPLATE,
  LIABILITIES_TEMPLATE,
  EQUITY_TEMPLATE
} from '../models/balance-sheet.models';
import { TrialBalanceService } from './trial-balance.service';
import { TrialBalanceRow, TrialBalanceFilter } from '../models/trial-balance.models';

/**
 * BALANCE SHEET SERVICE
 * Service tạo Bảng cân đối kế toán
 *
 * LƯU Ý NGHIỆP VỤ:
 * - READ-ONLY: Không cho phép chỉnh sửa số liệu
 * - Dữ liệu 100% từ Bảng cân đối tài khoản
 * - Chỉ được lập khi Trial Balance cân đối
 * - Tổng Tài sản PHẢI = Tổng Nguồn vốn
 */
@Injectable({
  providedIn: 'root'
})
export class BalanceSheetService {

  constructor(private trialBalanceService: TrialBalanceService) {}

  /**
   * Tạo Bảng cân đối kế toán
   */
  generateBalanceSheet(filter: BalanceSheetFilter): Observable<BalanceSheetReport> {
    // Chuyển đổi filter sang format Trial Balance
    const tbFilter: TrialBalanceFilter = {
      periodType: filter.periodType,
      year: filter.year,
      month: filter.month,
      quarter: filter.quarter,
      includeZeroBalance: true,
      includeSubAccounts: true
    };

    return this.trialBalanceService.getTrialBalance(tbFilter).pipe(
      map(response => {
        // Kiểm tra điều kiện lập BCTC
        if (!response.balanceCheck.canGenerateReport) {
          throw new Error('Không thể lập BCTC: Bảng cân đối tài khoản chưa hợp lệ');
        }

        // Chuyển Trial Balance thành Map để tra cứu nhanh
        const balanceMap = this.createBalanceMap(response.rows);

        // Tạo các section
        const shortTermAssets = this.buildSection('A', 'TÀI SẢN NGẮN HẠN', SHORT_TERM_ASSETS_TEMPLATE, balanceMap);
        const longTermAssets = this.buildSection('B', 'TÀI SẢN DÀI HẠN', LONG_TERM_ASSETS_TEMPLATE, balanceMap);
        const liabilities = this.buildSection('C', 'NỢ PHẢI TRẢ', LIABILITIES_TEMPLATE, balanceMap);
        const equity = this.buildSection('D', 'VỐN CHỦ SỞ HỮU', EQUITY_TEMPLATE, balanceMap);

        const totalAssets = shortTermAssets.total + longTermAssets.total;
        const totalLiabilitiesAndEquity = liabilities.total + equity.total;

        const report: BalanceSheetReport = {
          assets: {
            shortTerm: shortTermAssets,
            longTerm: longTermAssets,
            total: totalAssets
          },
          liabilitiesAndEquity: {
            liabilities: liabilities,
            equity: equity,
            total: totalLiabilitiesAndEquity
          },
          validation: validateBalanceSheet({
            assets: { shortTerm: shortTermAssets, longTerm: longTermAssets, total: totalAssets },
            liabilitiesAndEquity: { liabilities, equity, total: totalLiabilitiesAndEquity },
            validation: {} as BalanceSheetValidation,
            period: { endDate: '', label: '', isLocked: false },
            generatedAt: ''
          }),
          period: {
            endDate: response.period.to,
            label: this.formatPeriodLabel(filter),
            isLocked: response.period.isLocked
          },
          generatedAt: new Date().toISOString()
        };

        return report;
      }),
      delay(300)
    );
  }

  /**
   * Kiểm tra có thể lập BCĐKT không
   */
  canGenerateBalanceSheet(filter: BalanceSheetFilter): Observable<{ canGenerate: boolean; reasons: string[] }> {
    const tbFilter: TrialBalanceFilter = {
      periodType: filter.periodType,
      year: filter.year,
      month: filter.month,
      quarter: filter.quarter,
      includeZeroBalance: false,
      includeSubAccounts: false
    };

    return this.trialBalanceService.getTrialBalance(tbFilter).pipe(
      map(response => {
        const reasons: string[] = [];

        if (!response.balanceCheck.isFullyBalanced) {
          reasons.push('Bảng cân đối tài khoản chưa cân đối');
        }
        if (response.balanceCheck.abnormalAccounts > 0) {
          reasons.push(`Có ${response.balanceCheck.abnormalAccounts} tài khoản bất thường`);
        }
        if (!response.period.isLocked) {
          reasons.push('Kỳ kế toán chưa được khóa sổ');
        }

        return {
          canGenerate: reasons.length === 0,
          reasons
        };
      })
    );
  }

  /**
   * Xuất Excel
   */
  exportExcel(filter: BalanceSheetFilter): Observable<Blob> {
    // TODO: Implement Excel export
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * In PDF
   */
  exportPDF(filter: BalanceSheetFilter): Observable<Blob> {
    // TODO: Implement PDF export
    return of(new Blob()).pipe(delay(500));
  }

  // === PRIVATE METHODS ===

  /**
   * Tạo Map từ Trial Balance rows để tra cứu nhanh
   */
  private createBalanceMap(rows: TrialBalanceRow[]): Map<string, { debit: number; credit: number }> {
    const map = new Map<string, { debit: number; credit: number }>();

    rows.forEach(row => {
      map.set(row.accountCode, {
        debit: row.closingDebit,
        credit: row.closingCredit
      });
    });

    return map;
  }

  /**
   * Xây dựng một section của BCĐKT
   */
  private buildSection(
    id: string,
    title: string,
    template: { code: string; name: string; level: number; accountMapping: string[]; isNegative?: boolean; note?: string }[],
    balanceMap: Map<string, { debit: number; credit: number }>
  ): BalanceSheetSection {
    const rows: BalanceSheetRow[] = [];

    template.forEach(item => {
      let amount = 0;

      if (item.accountMapping.length > 0) {
        // Tính toán số tiền từ các TK mapping
        item.accountMapping.forEach(accountCode => {
          const balance = balanceMap.get(accountCode);
          if (balance) {
            // Quy tắc:
            // - Tài sản: lấy dư Nợ
            // - Nguồn vốn: lấy dư Có
            // - Một số TK đặc biệt (331, 131) có thể dư 2 bên
            if (id === 'A' || id === 'B') {
              // Tài sản - ưu tiên dư Nợ
              if (item.note?.includes('Dư Nợ')) {
                amount += balance.debit;
              } else {
                amount += balance.debit - balance.credit;
              }
            } else {
              // Nguồn vốn - ưu tiên dư Có
              if (item.note?.includes('Dư Có')) {
                amount += balance.credit;
              } else {
                amount += balance.credit - balance.debit;
              }
            }
          }
        });
      }

      // Xử lý số âm (VD: Hao mòn TSCĐ)
      if (item.isNegative) {
        amount = -Math.abs(amount);
      }

      rows.push({
        code: item.code,
        name: item.name,
        level: item.level,
        amount: amount,
        accountMapping: item.accountMapping,
        isNegative: item.isNegative,
        note: item.note
      });
    });

    // Tính tổng
    const total = this.calculateTotal(rows, id);

    // Cập nhật số tiền cho các dòng tổng (level 0, 1)
    this.updateGroupTotals(rows);

    return { id, title, rows, total };
  }

  /**
   * Tính tổng section
   */
  private calculateTotal(rows: BalanceSheetRow[], sectionId: string): number {
    // Tài sản dài hạn cần xử lý đặc biệt (có hao mòn)
    if (sectionId === 'B') {
      const nguyenGia = rows.find(r => r.code === '222')?.amount || 0;
      const haoMon = rows.find(r => r.code === '223')?.amount || 0;
      return nguyenGia + haoMon; // haoMon đã là số âm
    }

    // Các section khác: cộng các dòng chi tiết
    return rows
      .filter(r => r.level === 2)
      .reduce((sum, row) => sum + row.amount, 0);
  }

  /**
   * Cập nhật số tiền cho các dòng tổng nhóm
   */
  private updateGroupTotals(rows: BalanceSheetRow[]): void {
    // Tính tổng cho level 1 (nhóm)
    const level1Rows = rows.filter(r => r.level === 1);
    level1Rows.forEach(groupRow => {
      const groupCode = groupRow.code;
      // Lấy các dòng con (level 2, 3) có mã bắt đầu tương tự
      const children = rows.filter(r =>
        r.level > 1 &&
        r.code.startsWith(groupCode.substring(0, 2)) &&
        r.code !== groupCode
      );

      // Chỉ tính các dòng level 2 để tránh tính trùng
      groupRow.amount = children
        .filter(c => c.level === 2)
        .reduce((sum, c) => sum + c.amount, 0);

      // Trường hợp đặc biệt: TSCĐ = Nguyên giá + Hao mòn
      if (groupCode === '221') {
        const nguyenGia = rows.find(r => r.code === '222')?.amount || 0;
        const haoMon = rows.find(r => r.code === '223')?.amount || 0;
        groupRow.amount = nguyenGia + haoMon;
      }
    });

    // Tính tổng cho level 0 (tổng section)
    const level0Row = rows.find(r => r.level === 0);
    if (level0Row) {
      level0Row.amount = level1Rows.reduce((sum, r) => sum + r.amount, 0);
      level0Row.isTotal = true;
    }
  }

  /**
   * Format nhãn kỳ
   */
  private formatPeriodLabel(filter: BalanceSheetFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      const lastDay = new Date(filter.year, filter.month, 0).getDate();
      return `${lastDay}/${filter.month}/${filter.year}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const endMonth = filter.quarter * 3;
      const lastDay = new Date(filter.year, endMonth, 0).getDate();
      return `${lastDay}/${endMonth}/${filter.year}`;
    }
    return `31/12/${filter.year}`;
  }
}
