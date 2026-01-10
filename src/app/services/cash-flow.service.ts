import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
import {
  CashFlowReport,
  CashFlowSection,
  CashFlowRow,
  CashFlowFilter,
  CashFlowValidation,
  CashFlowPrerequisites,
  CashFlowInputData,
  validateCashFlowReport,
  calculateNetCashFlow,
  calculateBalanceChange,
  checkCashFlowPrerequisites,
  OPERATING_ACTIVITIES_TEMPLATE,
  INVESTING_ACTIVITIES_TEMPLATE,
  FINANCING_ACTIVITIES_TEMPLATE
} from '../models/cash-flow.models';
import { TrialBalanceService } from './trial-balance.service';
import { BalanceSheetService } from './balance-sheet.service';
import { TrialBalanceFilter } from '../models/trial-balance.models';
import { BalanceSheetFilter } from '../models/balance-sheet.models';

/**
 * CASH FLOW SERVICE
 * Service tạo Báo cáo Lưu chuyển tiền tệ - Phương pháp gián tiếp
 *
 * LƯU Ý NGHIỆP VỤ:
 * - READ-ONLY: Không cho phép chỉnh sửa số liệu
 * - Dữ liệu từ: KQKD + BCĐKT + Trial Balance
 * - Chỉ được lập khi tất cả BCTC hợp lệ
 * - Tiền cuối kỳ = Tiền đầu kỳ + LC thuần
 */
@Injectable({
  providedIn: 'root'
})
export class CashFlowService {

  constructor(
    private trialBalanceService: TrialBalanceService,
    private balanceSheetService: BalanceSheetService
  ) {}

  /**
   * Kiểm tra điều kiện lập báo cáo LCTT
   */
  checkPrerequisites(filter: CashFlowFilter): Observable<CashFlowPrerequisites> {
    const tbFilter: TrialBalanceFilter = {
      periodType: filter.periodType,
      year: filter.year,
      month: filter.month,
      quarter: filter.quarter,
      includeZeroBalance: false,
      includeSubAccounts: false
    };

    const bsFilter: BalanceSheetFilter = {
      periodType: filter.periodType,
      year: filter.year,
      month: filter.month,
      quarter: filter.quarter,
      showPreviousPeriod: true
    };

    return forkJoin({
      trialBalance: this.trialBalanceService.getTrialBalance(tbFilter),
      balanceSheetCheck: this.balanceSheetService.canGenerateBalanceSheet(bsFilter)
    }).pipe(
      map(({ trialBalance, balanceSheetCheck }) => {
        const trialBalanceValid = trialBalance.balanceCheck.isFullyBalanced;
        const balanceSheetValid = balanceSheetCheck.canGenerate;
        // Giả định KQKD hợp lệ nếu TB cân đối
        const incomeStatementValid = trialBalanceValid;
        const periodLocked = trialBalance.period.isLocked;

        return checkCashFlowPrerequisites(
          trialBalanceValid,
          balanceSheetValid,
          incomeStatementValid,
          periodLocked
        );
      })
    );
  }

  /**
   * Tạo Báo cáo Lưu chuyển tiền tệ
   */
  generateCashFlowReport(filter: CashFlowFilter): Observable<CashFlowReport> {
    return this.checkPrerequisites(filter).pipe(
      switchMap(prerequisites => {
        if (!prerequisites.canGenerate) {
          throw new Error('Không thể lập Báo cáo LCTT: ' + prerequisites.reasons.join(', '));
        }

        // Lấy dữ liệu đầu vào
        return this.getInputData(filter);
      }),
      map(inputData => {
        // Xây dựng các section
        const operating = this.buildOperatingSection(inputData);
        const investing = this.buildInvestingSection(inputData);
        const financing = this.buildFinancingSection(inputData);

        // Tính lưu chuyển tiền thuần
        const netCashFlow = calculateNetCashFlow(
          operating.total,
          investing.total,
          financing.total
        );

        const cashEndingCalculated = inputData.cashBeginning + netCashFlow;

        const report: CashFlowReport = {
          operating,
          investing,
          financing,
          summary: {
            netCashFlow,
            cashBeginning: inputData.cashBeginning,
            cashEnding: inputData.cashEnding,
            cashEndingCalculated
          },
          validation: {} as CashFlowValidation,
          period: {
            from: this.getPeriodStart(filter),
            to: this.getPeriodEnd(filter),
            label: this.formatPeriodLabel(filter),
            isLocked: true
          },
          generatedAt: new Date().toISOString()
        };

        // Validate báo cáo
        report.validation = validateCashFlowReport(report);

        return report;
      }),
      delay(300)
    );
  }

  /**
   * Xuất Excel theo mẫu B03-DNN
   */
  exportExcel(filter: CashFlowFilter): Observable<Blob> {
    // TODO: Implement Excel export
    return of(new Blob()).pipe(delay(500));
  }

  /**
   * In PDF theo mẫu B03-DNN
   */
  exportPDF(filter: CashFlowFilter): Observable<Blob> {
    // TODO: Implement PDF export
    return of(new Blob()).pipe(delay(500));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy dữ liệu đầu vào từ các nguồn
   */
  private getInputData(filter: CashFlowFilter): Observable<CashFlowInputData> {
    // TODO: Thay bằng API thực tế
    // Hiện tại dùng demo data
    return of(this.generateDemoInputData(filter)).pipe(delay(200));
  }

  /**
   * Xây dựng Section I - Hoạt động kinh doanh
   */
  private buildOperatingSection(data: CashFlowInputData): CashFlowSection {
    const rows: CashFlowRow[] = [];

    // 01. Lợi nhuận trước thuế
    rows.push({
      ...OPERATING_ACTIVITIES_TEMPLATE[0],
      amount: data.netProfit
    });

    // 02. Điều chỉnh cho các khoản (header)
    let adjustmentTotal = 0;

    // 03. Khấu hao TSCĐ
    rows.push({
      ...OPERATING_ACTIVITIES_TEMPLATE[2],
      amount: data.depreciationExpense
    });
    adjustmentTotal += data.depreciationExpense;

    // 04. Các khoản dự phòng
    rows.push({
      ...OPERATING_ACTIVITIES_TEMPLATE[3],
      amount: data.provisionExpense
    });
    adjustmentTotal += data.provisionExpense;

    // 05. Lãi/lỗ từ hoạt động đầu tư
    const investmentGainLoss = data.assetDisposalLoss - data.assetDisposalGain;
    rows.push({
      ...OPERATING_ACTIVITIES_TEMPLATE[4],
      amount: investmentGainLoss
    });
    adjustmentTotal += investmentGainLoss;

    // 06. Chi phí lãi vay
    rows.push({
      ...OPERATING_ACTIVITIES_TEMPLATE[5],
      amount: data.interestExpense
    });
    adjustmentTotal += data.interestExpense;

    // Cập nhật dòng 02
    rows.splice(1, 0, {
      ...OPERATING_ACTIVITIES_TEMPLATE[1],
      amount: adjustmentTotal
    });

    // 08. Lợi nhuận từ HĐKD trước thay đổi VLĐ
    const profitBeforeWC = data.netProfit + adjustmentTotal;
    rows.push({
      code: '08',
      name: '3. Lợi nhuận từ HĐKD trước thay đổi vốn lưu động',
      level: 1,
      accountMapping: [],
      amount: profitBeforeWC,
      isTotal: true
    });

    // Thay đổi vốn lưu động
    let wcChangeTotal = 0;

    // 09. Tăng/giảm phải thu
    const receivablesChange = -data.receivablesChange; // Tăng (-), Giảm (+)
    rows.push({
      code: '09',
      name: '   - Tăng/giảm các khoản phải thu',
      level: 2,
      accountMapping: ['131'],
      amount: receivablesChange,
      note: data.receivablesChange > 0 ? 'Phải thu tăng → Tiền giảm' : 'Phải thu giảm → Tiền tăng'
    });
    wcChangeTotal += receivablesChange;

    // 10. Tăng/giảm tồn kho
    const inventoryChange = -data.inventoryChange; // Tăng (-), Giảm (+)
    rows.push({
      code: '10',
      name: '   - Tăng/giảm hàng tồn kho',
      level: 2,
      accountMapping: ['152', '156'],
      amount: inventoryChange,
      note: data.inventoryChange > 0 ? 'Tồn kho tăng → Tiền giảm' : 'Tồn kho giảm → Tiền tăng'
    });
    wcChangeTotal += inventoryChange;

    // 11. Tăng/giảm phải trả
    const payablesChange = data.payablesChange + data.accruedChange; // Tăng (+), Giảm (-)
    rows.push({
      code: '11',
      name: '   - Tăng/giảm các khoản phải trả',
      level: 2,
      accountMapping: ['331', '334', '338'],
      amount: payablesChange,
      note: payablesChange > 0 ? 'Nợ phải trả tăng → Giữ lại tiền' : 'Nợ phải trả giảm → Chi tiền'
    });
    wcChangeTotal += payablesChange;

    // 12. Tăng/giảm chi phí trả trước
    const prepaidChange = -data.prepaidChange;
    rows.push({
      code: '12',
      name: '   - Tăng/giảm chi phí trả trước',
      level: 2,
      accountMapping: ['242'],
      amount: prepaidChange
    });
    wcChangeTotal += prepaidChange;

    // 13. Thuế TNDN đã nộp (giả định = 20% lợi nhuận nếu có lãi)
    const taxPaid = data.netProfit > 0 ? -(data.netProfit * 0.2 * 0.5) : 0; // 50% thuế đã nộp
    rows.push({
      code: '13',
      name: '   - Thuế TNDN đã nộp',
      level: 2,
      accountMapping: ['3334'],
      amount: taxPaid,
      isNegative: true
    });
    wcChangeTotal += taxPaid;

    // 20. Lưu chuyển tiền thuần từ HĐKD
    const operatingTotal = profitBeforeWC + wcChangeTotal;
    rows.push({
      code: '20',
      name: 'Lưu chuyển tiền thuần từ hoạt động kinh doanh',
      level: 0,
      accountMapping: [],
      amount: operatingTotal,
      isTotal: true
    });

    return {
      id: 'operating',
      title: 'I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH',
      rows,
      total: operatingTotal
    };
  }

  /**
   * Xây dựng Section II - Hoạt động đầu tư
   */
  private buildInvestingSection(data: CashFlowInputData): CashFlowSection {
    const rows: CashFlowRow[] = [];

    // 21. Tiền chi mua sắm TSCĐ
    rows.push({
      code: '21',
      name: '1. Tiền chi mua sắm TSCĐ',
      level: 1,
      accountMapping: ['211'],
      amount: -data.fixedAssetPurchase,
      isNegative: true
    });

    // 22. Tiền thu thanh lý TSCĐ
    rows.push({
      code: '22',
      name: '2. Tiền thu thanh lý TSCĐ',
      level: 1,
      accountMapping: ['211', '711'],
      amount: data.fixedAssetDisposal
    });

    // 23. Tiền chi đầu tư góp vốn
    rows.push({
      code: '23',
      name: '3. Tiền chi đầu tư góp vốn',
      level: 1,
      accountMapping: ['228'],
      amount: -data.investmentPurchase,
      isNegative: true
    });

    // 24. Tiền thu hồi đầu tư
    rows.push({
      code: '24',
      name: '4. Tiền thu hồi đầu tư góp vốn',
      level: 1,
      accountMapping: ['228'],
      amount: data.investmentDisposal
    });

    // 25. Tiền thu lãi cho vay, cổ tức
    rows.push({
      code: '25',
      name: '5. Tiền thu lãi cho vay, cổ tức',
      level: 1,
      accountMapping: ['515'],
      amount: data.interestReceived
    });

    // 30. Tổng
    const investingTotal = -data.fixedAssetPurchase + data.fixedAssetDisposal
      - data.investmentPurchase + data.investmentDisposal + data.interestReceived;

    rows.push({
      code: '30',
      name: 'Lưu chuyển tiền thuần từ hoạt động đầu tư',
      level: 0,
      accountMapping: [],
      amount: investingTotal,
      isTotal: true
    });

    return {
      id: 'investing',
      title: 'II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ',
      rows,
      total: investingTotal
    };
  }

  /**
   * Xây dựng Section III - Hoạt động tài chính
   */
  private buildFinancingSection(data: CashFlowInputData): CashFlowSection {
    const rows: CashFlowRow[] = [];

    // 31. Tiền thu từ góp vốn
    rows.push({
      code: '31',
      name: '1. Tiền thu từ phát hành cổ phiếu, góp vốn',
      level: 1,
      accountMapping: ['411'],
      amount: data.capitalContribution
    });

    // 32. Tiền chi trả vốn góp
    rows.push({
      code: '32',
      name: '2. Tiền chi trả vốn góp',
      level: 1,
      accountMapping: ['411'],
      amount: 0,
      isNegative: true
    });

    // 33. Tiền vay nhận được
    rows.push({
      code: '33',
      name: '3. Tiền vay ngắn hạn, dài hạn nhận được',
      level: 1,
      accountMapping: ['341'],
      amount: data.borrowings
    });

    // 34. Tiền chi trả nợ gốc vay
    rows.push({
      code: '34',
      name: '4. Tiền chi trả nợ gốc vay',
      level: 1,
      accountMapping: ['341'],
      amount: -data.loanRepayment,
      isNegative: true
    });

    // 35. Tiền chi trả nợ thuê tài chính
    rows.push({
      code: '35',
      name: '5. Tiền chi trả nợ thuê tài chính',
      level: 1,
      accountMapping: ['342'],
      amount: 0,
      isNegative: true
    });

    // 36. Cổ tức đã trả
    rows.push({
      code: '36',
      name: '6. Cổ tức, lợi nhuận đã trả',
      level: 1,
      accountMapping: ['421'],
      amount: -data.dividendPaid,
      isNegative: true
    });

    // 40. Tổng
    const financingTotal = data.capitalContribution + data.borrowings
      - data.loanRepayment - data.dividendPaid;

    rows.push({
      code: '40',
      name: 'Lưu chuyển tiền thuần từ hoạt động tài chính',
      level: 0,
      accountMapping: [],
      amount: financingTotal,
      isTotal: true
    });

    return {
      id: 'financing',
      title: 'III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH',
      rows,
      total: financingTotal
    };
  }

  /**
   * Demo data - sẽ thay bằng API thực tế
   */
  private generateDemoInputData(filter: CashFlowFilter): CashFlowInputData {
    // Lấy từ Trial Balance demo data
    // Tiền đầu kỳ: 111 (50tr) + 112 (200tr) = 250tr
    const cashBeginning = 250000000;

    // Phát sinh trong kỳ từ demo TB:
    // 111: PS Nợ 28.5tr, PS Có 23.7tr → Tăng 4.8tr
    // 112: PS Nợ 20tr, PS Có 0 → Tăng 20tr
    // Tiền cuối = 250 + 4.8 + 20 = 274.8tr
    const cashEnding = 274800000;

    return {
      // Từ KQKD - giả định
      netProfit: 10000000, // Lợi nhuận sau thuế: 10 triệu

      // Từ Trial Balance - Phát sinh
      depreciationExpense: 5000000,    // Khấu hao 5tr
      provisionExpense: 0,              // Không có dự phòng
      interestExpense: 0,               // Không có lãi vay
      interestIncome: 0,
      assetDisposalGain: 0,
      assetDisposalLoss: 0,

      // Thay đổi vốn lưu động (từ BCĐKT)
      // 131: Đầu kỳ 35tr, Cuối kỳ 48tr → Tăng 13tr
      receivablesChange: 13000000,
      // 156: Đầu kỳ 80tr, Cuối kỳ 78tr → Giảm 2tr
      inventoryChange: -2000000,
      prepaidChange: 0,
      // 331: Đầu kỳ 25tr, Cuối kỳ 31.8tr → Tăng 6.8tr
      payablesChange: 6800000,
      // 334: Đầu kỳ 0, Cuối kỳ 22.5tr → Tăng 22.5tr
      accruedChange: 22500000,
      taxPayableChange: 2000000,
      advanceFromCustomerChange: 0,

      // Hoạt động đầu tư
      fixedAssetPurchase: 0,
      fixedAssetDisposal: 0,
      investmentPurchase: 0,
      investmentDisposal: 0,
      interestReceived: 0,

      // Hoạt động tài chính
      capitalContribution: 0,
      borrowings: 0,
      loanRepayment: 0,
      dividendPaid: 0,
      interestPaid: 0,

      // Số dư tiền
      cashBeginning,
      cashEnding
    };
  }

  private getPeriodStart(filter: CashFlowFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      const startMonth = (filter.quarter - 1) * 3 + 1;
      return `${filter.year}-${String(startMonth).padStart(2, '0')}-01`;
    }
    return `${filter.year}-01-01`;
  }

  private getPeriodEnd(filter: CashFlowFilter): string {
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

  private formatPeriodLabel(filter: CashFlowFilter): string {
    if (filter.periodType === 'month' && filter.month) {
      return `Tháng ${filter.month}/${filter.year}`;
    }
    if (filter.periodType === 'quarter' && filter.quarter) {
      return `Quý ${filter.quarter}/${filter.year}`;
    }
    return `Năm ${filter.year}`;
  }
}
