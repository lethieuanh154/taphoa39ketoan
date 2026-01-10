import { Injectable } from '@angular/core';
import { Observable, of, delay, map } from 'rxjs';
import {
  IncomeStatementReport,
  IncomeStatementRow,
  IncomeStatementFilter,
  IncomeStatementValidation,
  INCOME_STATEMENT_TEMPLATE,
  calculateFromFormula,
  validateIncomeStatement,
  buildSummary,
  TOTAL_ROW_CODES
} from '../models/income-statement.models';

/**
 * SERVICE: BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH
 *
 * NGUYÊN TẮC:
 * - READ-ONLY: Không được sửa dữ liệu
 * - Dữ liệu 100% từ Sổ cái (Ledger) - phát sinh trong kỳ
 * - Chỉ lập khi kỳ đã khóa sổ
 */
@Injectable({
  providedIn: 'root'
})
export class IncomeStatementService {

  constructor() { }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Kiểm tra điều kiện lập Báo cáo KQKD
   */
  canGenerateIncomeStatement(filter: IncomeStatementFilter): Observable<{
    canGenerate: boolean;
    reasons: string[];
  }> {
    // Demo: Luôn cho phép
    return of({
      canGenerate: true,
      reasons: []
    }).pipe(delay(300));
  }

  /**
   * Tạo Báo cáo KQKD
   */
  generateIncomeStatement(filter: IncomeStatementFilter): Observable<IncomeStatementReport> {
    return of(null).pipe(
      delay(500),
      map(() => this.buildDemoReport(filter))
    );
  }

  /**
   * Xuất Excel
   */
  exportExcel(filter: IncomeStatementFilter): Observable<Blob> {
    // Demo: Trả về blob rỗng
    return of(new Blob(['Demo Excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      .pipe(delay(500));
  }

  /**
   * Xuất PDF
   */
  exportPDF(filter: IncomeStatementFilter): Observable<Blob> {
    // Demo: Trả về blob rỗng
    return of(new Blob(['Demo PDF'], { type: 'application/pdf' }))
      .pipe(delay(500));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO DATA BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  private buildDemoReport(filter: IncomeStatementFilter): IncomeStatementReport {
    // Tạo dữ liệu demo realistic cho cửa hàng tạp hóa
    const demoLedgerData = this.getDemoLedgerData(filter);

    // Build các dòng từ template
    const rows = this.buildRowsFromTemplate(demoLedgerData, filter);

    // Build summary
    const summary = buildSummary(rows);

    // Build report
    const report: IncomeStatementReport = {
      rows,
      summary,
      validation: { isValid: true, canSubmit: true, errors: [], warnings: [] },
      period: {
        startDate: this.getPeriodStartDate(filter),
        endDate: this.getPeriodEndDate(filter),
        label: this.getPeriodLabel(filter),
        isLocked: true
      },
      generatedAt: new Date().toISOString(),
      companyName: 'CÔNG TY TNHH TẠP HÓA 39',
      taxCode: '0123456789'
    };

    // Validate
    report.validation = validateIncomeStatement(report);

    return report;
  }

  /**
   * Build các dòng từ template
   */
  private buildRowsFromTemplate(
    ledgerData: Map<string, { debitAmount: number; creditAmount: number }>,
    filter: IncomeStatementFilter
  ): IncomeStatementRow[] {
    const rows: IncomeStatementRow[] = [];
    const rowValues = new Map<string, number>();

    // Lấy dữ liệu kỳ trước cho so sánh
    const previousLedgerData = this.getDemoPreviousLedgerData(filter);
    const previousRowValues = new Map<string, number>();

    // Pass 1: Tính các dòng từ TK (không có formula)
    INCOME_STATEMENT_TEMPLATE.forEach(template => {
      if (!template.formula && template.accountMapping.length > 0) {
        let amount = this.getAmountFromAccounts(ledgerData, template.accountMapping, template.balanceType || 'net');
        if (template.isNegative) {
          amount = Math.abs(amount); // Đảm bảo số dương cho hiển thị
        }
        rowValues.set(template.code, amount);

        // Kỳ trước
        let prevAmount = this.getAmountFromAccounts(previousLedgerData, template.accountMapping, template.balanceType || 'net');
        if (template.isNegative) {
          prevAmount = Math.abs(prevAmount);
        }
        previousRowValues.set(template.code, prevAmount);
      }
    });

    // Pass 2: Tính các dòng từ công thức
    INCOME_STATEMENT_TEMPLATE.forEach(template => {
      if (template.formula) {
        const amount = calculateFromFormula(template.formula, rowValues);
        rowValues.set(template.code, amount);

        const prevAmount = calculateFromFormula(template.formula, previousRowValues);
        previousRowValues.set(template.code, prevAmount);
      }
    });

    // Pass 3: Build final rows
    INCOME_STATEMENT_TEMPLATE.forEach(template => {
      const amount = rowValues.get(template.code) || 0;
      const previousAmount = filter.compareType !== 'none' ? previousRowValues.get(template.code) : undefined;

      rows.push({
        code: template.code,
        name: template.name,
        note: template.note,
        level: template.level,
        amount: template.isNegative ? -Math.abs(amount) : amount,
        previousAmount: previousAmount !== undefined
          ? (template.isNegative ? -Math.abs(previousAmount) : previousAmount)
          : undefined,
        accountMapping: template.accountMapping,
        formula: template.formula,
        isTotal: TOTAL_ROW_CODES.includes(template.code),
        isNegative: template.isNegative,
        isCalculated: !!template.formula
      });
    });

    return rows;
  }

  /**
   * Lấy số tiền từ các tài khoản
   */
  private getAmountFromAccounts(
    ledgerData: Map<string, { debitAmount: number; creditAmount: number }>,
    accountCodes: string[],
    balanceType: 'credit' | 'debit' | 'net'
  ): number {
    let total = 0;

    accountCodes.forEach(code => {
      ledgerData.forEach((balance, accountCode) => {
        // Khớp TK chính xác hoặc TK con
        if (accountCode === code || accountCode.startsWith(code)) {
          switch (balanceType) {
            case 'credit':
              total += balance.creditAmount;
              break;
            case 'debit':
              total += balance.debitAmount;
              break;
            case 'net':
            default:
              total += (balance.creditAmount - balance.debitAmount);
          }
        }
      });
    });

    return total;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO LEDGER DATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Dữ liệu Sổ cái demo cho kỳ hiện tại
   */
  private getDemoLedgerData(filter: IncomeStatementFilter): Map<string, { debitAmount: number; creditAmount: number }> {
    const data = new Map<string, { debitAmount: number; creditAmount: number }>();

    // Multiplier theo loại kỳ
    const multiplier = filter.periodType === 'year' ? 12 :
                       filter.periodType === 'quarter' ? 3 : 1;

    // TK 511 - Doanh thu bán hàng (Có)
    data.set('5111', { debitAmount: 0, creditAmount: 285000000 * multiplier });
    data.set('5112', { debitAmount: 0, creditAmount: 45000000 * multiplier });

    // TK 521 - Các khoản giảm trừ DT (Nợ)
    data.set('5211', { debitAmount: 2500000 * multiplier, creditAmount: 0 }); // Chiết khấu TM
    data.set('5213', { debitAmount: 1200000 * multiplier, creditAmount: 0 }); // Hàng bán bị trả lại

    // TK 632 - Giá vốn hàng bán (Nợ)
    data.set('632', { debitAmount: 235000000 * multiplier, creditAmount: 0 });

    // TK 515 - Doanh thu tài chính (Có)
    data.set('5151', { debitAmount: 0, creditAmount: 850000 * multiplier }); // Lãi tiền gửi

    // TK 635 - Chi phí tài chính (Nợ)
    data.set('6351', { debitAmount: 1500000 * multiplier, creditAmount: 0 }); // Lãi vay

    // TK 642 - Chi phí QLDN (Nợ)
    data.set('6421', { debitAmount: 25000000 * multiplier, creditAmount: 0 }); // Lương NV
    data.set('6422', { debitAmount: 3500000 * multiplier, creditAmount: 0 });  // VPP
    data.set('6423', { debitAmount: 4200000 * multiplier, creditAmount: 0 });  // Khấu hao
    data.set('6424', { debitAmount: 2800000 * multiplier, creditAmount: 0 });  // Thuế, phí
    data.set('6427', { debitAmount: 8500000 * multiplier, creditAmount: 0 });  // Dịch vụ mua ngoài
    data.set('6428', { debitAmount: 3200000 * multiplier, creditAmount: 0 });  // Chi phí khác

    // TK 711 - Thu nhập khác (Có)
    data.set('711', { debitAmount: 0, creditAmount: 1800000 * multiplier });

    // TK 811 - Chi phí khác (Nợ)
    data.set('811', { debitAmount: 500000 * multiplier, creditAmount: 0 });

    // TK 821 - Chi phí thuế TNDN (Nợ)
    // Tính: (Lợi nhuận trước thuế) * 20%
    const doanhThuThuan = (285000000 + 45000000 - 2500000 - 1200000) * multiplier;
    const giaVon = 235000000 * multiplier;
    const loiNhuanGop = doanhThuThuan - giaVon;
    const dtTaiChinh = 850000 * multiplier;
    const cpTaiChinh = 1500000 * multiplier;
    const cpQLDN = (25000000 + 3500000 + 4200000 + 2800000 + 8500000 + 3200000) * multiplier;
    const loiNhuanKD = loiNhuanGop + dtTaiChinh - cpTaiChinh - cpQLDN;
    const thuNhapKhac = 1800000 * multiplier;
    const chiPhiKhac = 500000 * multiplier;
    const loiNhuanTruocThue = loiNhuanKD + thuNhapKhac - chiPhiKhac;
    const thueTNDN = Math.max(0, loiNhuanTruocThue * 0.20);

    data.set('8211', { debitAmount: thueTNDN, creditAmount: 0 });

    return data;
  }

  /**
   * Dữ liệu Sổ cái demo cho kỳ trước (để so sánh)
   */
  private getDemoPreviousLedgerData(filter: IncomeStatementFilter): Map<string, { debitAmount: number; creditAmount: number }> {
    const data = new Map<string, { debitAmount: number; creditAmount: number }>();

    const multiplier = filter.periodType === 'year' ? 12 :
                       filter.periodType === 'quarter' ? 3 : 1;

    // Giảm 5-10% so với kỳ hiện tại
    const factor = 0.92;

    data.set('5111', { debitAmount: 0, creditAmount: 285000000 * multiplier * factor });
    data.set('5112', { debitAmount: 0, creditAmount: 45000000 * multiplier * factor });
    data.set('5211', { debitAmount: 2200000 * multiplier, creditAmount: 0 });
    data.set('5213', { debitAmount: 1000000 * multiplier, creditAmount: 0 });
    data.set('632', { debitAmount: 220000000 * multiplier * factor, creditAmount: 0 });
    data.set('5151', { debitAmount: 0, creditAmount: 750000 * multiplier });
    data.set('6351', { debitAmount: 1600000 * multiplier, creditAmount: 0 });
    data.set('6421', { debitAmount: 24000000 * multiplier, creditAmount: 0 });
    data.set('6422', { debitAmount: 3200000 * multiplier, creditAmount: 0 });
    data.set('6423', { debitAmount: 4200000 * multiplier, creditAmount: 0 });
    data.set('6424', { debitAmount: 2500000 * multiplier, creditAmount: 0 });
    data.set('6427', { debitAmount: 7800000 * multiplier, creditAmount: 0 });
    data.set('6428', { debitAmount: 2900000 * multiplier, creditAmount: 0 });
    data.set('711', { debitAmount: 0, creditAmount: 1500000 * multiplier });
    data.set('811', { debitAmount: 400000 * multiplier, creditAmount: 0 });

    // Tính thuế TNDN kỳ trước
    const prevLNTT = this.calculateProfitBeforeTax(data, multiplier);
    const prevThue = Math.max(0, prevLNTT * 0.20);
    data.set('8211', { debitAmount: prevThue, creditAmount: 0 });

    return data;
  }

  private calculateProfitBeforeTax(
    data: Map<string, { debitAmount: number; creditAmount: number }>,
    multiplier: number
  ): number {
    let dt = 0, gtru = 0, gv = 0, dtTC = 0, cpTC = 0, cpQL = 0, tnK = 0, cpK = 0;

    data.forEach((balance, code) => {
      if (code.startsWith('511')) dt += balance.creditAmount;
      if (code.startsWith('521')) gtru += balance.debitAmount;
      if (code === '632') gv += balance.debitAmount;
      if (code.startsWith('515')) dtTC += balance.creditAmount;
      if (code.startsWith('635')) cpTC += balance.debitAmount;
      if (code.startsWith('642')) cpQL += balance.debitAmount;
      if (code === '711') tnK += balance.creditAmount;
      if (code === '811') cpK += balance.debitAmount;
    });

    const dtThuan = dt - gtru;
    const lnGop = dtThuan - gv;
    const lnKD = lnGop + dtTC - cpTC - cpQL;
    const lnKhac = tnK - cpK;
    return lnKD + lnKhac;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getPeriodStartDate(filter: IncomeStatementFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const startMonth = (filter.quarter - 1) * 3 + 1;
      return `${filter.year}-${String(startMonth).padStart(2, '0')}-01`;
    }
    return `${filter.year}-01-01`;
  }

  private getPeriodEndDate(filter: IncomeStatementFilter): string {
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

  private getPeriodLabel(filter: IncomeStatementFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `Tháng ${filter.month}/${filter.year}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const quarterNames = ['I', 'II', 'III', 'IV'];
      return `Quý ${quarterNames[filter.quarter - 1]}/${filter.year}`;
    }
    return `Năm ${filter.year}`;
  }
}
