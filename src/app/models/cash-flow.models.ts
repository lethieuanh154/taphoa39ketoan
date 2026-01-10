/**
 * BÁO CÁO LƯU CHUYỂN TIỀN TỆ - CASH FLOW STATEMENT
 * Phương pháp gián tiếp (Indirect Method)
 *
 * Theo Thông tư 99/2025/TT-BTC
 * Mẫu B03-DNN (Doanh nghiệp nhỏ & vừa)
 *
 * NGUYÊN TẮC BẤT BIẾN:
 * - Tiền cuối kỳ = Tiền đầu kỳ + Lưu chuyển tiền thuần
 * - READ-ONLY: Dữ liệu 100% từ KQKD + BCĐKT + Trial Balance
 * - Chỉ được lập khi các BCTC khác hợp lệ
 *
 * CÔNG THỨC GIÁN TIẾP:
 * Lợi nhuận sau thuế
 * + Khấu hao, dự phòng (không dùng tiền)
 * +/- Thay đổi vốn lưu động
 * = Lưu chuyển tiền từ HĐKD
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Một dòng trong báo cáo LCTT
 */
export interface CashFlowRow {
  code: string;           // Mã chỉ tiêu: 01, 02, 03...
  name: string;           // Tên chỉ tiêu
  level: number;          // Cấp độ: 0 = tổng, 1 = nhóm, 2 = chi tiết
  amount: number;         // Số tiền kỳ này
  previousAmount?: number;// Số tiền kỳ trước
  accountMapping: string[];// TK kế toán liên quan
  formula?: string;       // Công thức tính (nếu có)
  note?: string;          // Ghi chú nghiệp vụ
  isTotal?: boolean;      // Là dòng tổng?
  isNegative?: boolean;   // Giá trị âm (điều chỉnh giảm)?
}

/**
 * Một section trong báo cáo LCTT
 */
export interface CashFlowSection {
  id: string;             // ID: 'operating', 'investing', 'financing'
  title: string;          // Tiêu đề section
  rows: CashFlowRow[];    // Các dòng chi tiết
  total: number;          // Tổng lưu chuyển tiền section
  previousTotal?: number; // Tổng kỳ trước
}

/**
 * Toàn bộ báo cáo LCTT
 */
export interface CashFlowReport {
  // I. Lưu chuyển tiền từ hoạt động kinh doanh
  operating: CashFlowSection;

  // II. Lưu chuyển tiền từ hoạt động đầu tư
  investing: CashFlowSection;

  // III. Lưu chuyển tiền từ hoạt động tài chính
  financing: CashFlowSection;

  // Tổng hợp
  summary: {
    netCashFlow: number;        // Lưu chuyển tiền thuần trong kỳ
    cashBeginning: number;      // Tiền đầu kỳ
    cashEnding: number;         // Tiền cuối kỳ
    cashEndingCalculated: number; // Tiền cuối kỳ (tính toán)
    previousNetCashFlow?: number;
  };

  // Validation
  validation: CashFlowValidation;

  // Metadata
  period: {
    from: string;
    to: string;
    label: string;
    isLocked: boolean;
  };
  generatedAt: string;
  companyName?: string;
  taxCode?: string;
}

/**
 * Kết quả kiểm tra báo cáo LCTT
 */
export interface CashFlowValidation {
  isValid: boolean;           // Báo cáo hợp lệ?
  isCashBalanced: boolean;    // Tiền cuối kỳ khớp?
  cashDifference: number;     // Chênh lệch tiền
  canSubmit: boolean;         // Có thể nộp CQT?
  errors: string[];           // Danh sách lỗi
  warnings: string[];         // Danh sách cảnh báo
  explanations: string[];     // Giải thích (LN ≠ Tiền)
}

/**
 * Filter cho báo cáo LCTT
 */
export interface CashFlowFilter {
  periodType: 'month' | 'quarter' | 'year';
  year: number;
  month?: number;
  quarter?: number;
  showPreviousPeriod: boolean;
  compareWithPreviousYear: boolean;
}

/**
 * Dữ liệu đầu vào để tính LCTT
 */
export interface CashFlowInputData {
  // Từ KQKD
  netProfit: number;              // Lợi nhuận sau thuế (60)

  // Từ Trial Balance - Phát sinh
  depreciationExpense: number;    // Khấu hao TSCĐ (PS Có TK 214)
  provisionExpense: number;       // Chi phí dự phòng (PS Nợ TK 229)
  interestExpense: number;        // Chi phí lãi vay (PS Nợ TK 635)
  interestIncome: number;         // Thu nhập lãi tiền gửi (PS Có TK 515)
  assetDisposalGain: number;      // Lãi thanh lý TSCĐ (PS Có TK 711)
  assetDisposalLoss: number;      // Lỗ thanh lý TSCĐ (PS Nợ TK 811)

  // Từ BCĐKT - So sánh đầu kỳ & cuối kỳ
  receivablesChange: number;      // Thay đổi phải thu (131)
  inventoryChange: number;        // Thay đổi tồn kho (152, 156)
  prepaidChange: number;          // Thay đổi chi phí trả trước (242)
  payablesChange: number;         // Thay đổi phải trả (331)
  accruedChange: number;          // Thay đổi chi phí phải trả (334, 338)
  taxPayableChange: number;       // Thay đổi thuế phải nộp (333)
  advanceFromCustomerChange: number; // Thay đổi người mua trả trước

  // Hoạt động đầu tư
  fixedAssetPurchase: number;     // Mua TSCĐ (PS Nợ TK 211)
  fixedAssetDisposal: number;     // Thanh lý TSCĐ (thu tiền)
  investmentPurchase: number;     // Mua đầu tư (PS Nợ TK 228)
  investmentDisposal: number;     // Bán đầu tư (thu tiền)
  interestReceived: number;       // Tiền lãi đã thu

  // Hoạt động tài chính
  capitalContribution: number;    // Góp vốn (PS Có TK 411)
  borrowings: number;             // Vay (PS Có TK 341)
  loanRepayment: number;          // Trả nợ vay (PS Nợ TK 341)
  dividendPaid: number;           // Cổ tức đã trả (PS Nợ TK 421)
  interestPaid: number;           // Lãi vay đã trả

  // Số dư tiền
  cashBeginning: number;          // Tiền đầu kỳ (111 + 112)
  cashEnding: number;             // Tiền cuối kỳ (111 + 112)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CẤU TRÚC BÁO CÁO LCTT THEO TT 99
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH
 */
export const OPERATING_ACTIVITIES_TEMPLATE: Omit<CashFlowRow, 'amount'>[] = [
  // 1. Lợi nhuận trước thuế
  {
    code: '01',
    name: '1. Lợi nhuận trước thuế',
    level: 1,
    accountMapping: ['421'],
    note: 'Từ Báo cáo KQKD - Mã 50'
  },
  // 2. Điều chỉnh cho các khoản
  {
    code: '02',
    name: '2. Điều chỉnh cho các khoản:',
    level: 1,
    accountMapping: [],
    isTotal: true
  },
  {
    code: '03',
    name: '   - Khấu hao TSCĐ',
    level: 2,
    accountMapping: ['214'],
    note: 'Phát sinh Có TK 214'
  },
  {
    code: '04',
    name: '   - Các khoản dự phòng',
    level: 2,
    accountMapping: ['229'],
    note: 'Phát sinh Nợ TK 229'
  },
  {
    code: '05',
    name: '   - Lãi/lỗ từ hoạt động đầu tư',
    level: 2,
    accountMapping: ['711', '811'],
    note: 'Lỗ (+), Lãi (-)',
    isNegative: true
  },
  {
    code: '06',
    name: '   - Chi phí lãi vay',
    level: 2,
    accountMapping: ['635'],
    note: 'Phát sinh Nợ TK 635'
  },
  // 3. Lợi nhuận từ HĐKD trước thay đổi VLĐ
  {
    code: '08',
    name: '3. Lợi nhuận từ HĐKD trước thay đổi vốn lưu động',
    level: 1,
    accountMapping: [],
    isTotal: true,
    formula: '01 + 02'
  },
  // 4. Thay đổi vốn lưu động
  {
    code: '09',
    name: '   - Tăng/giảm các khoản phải thu',
    level: 2,
    accountMapping: ['131'],
    note: 'Tăng (-), Giảm (+)'
  },
  {
    code: '10',
    name: '   - Tăng/giảm hàng tồn kho',
    level: 2,
    accountMapping: ['152', '156'],
    note: 'Tăng (-), Giảm (+)'
  },
  {
    code: '11',
    name: '   - Tăng/giảm các khoản phải trả',
    level: 2,
    accountMapping: ['331', '334', '338'],
    note: 'Tăng (+), Giảm (-)'
  },
  {
    code: '12',
    name: '   - Tăng/giảm chi phí trả trước',
    level: 2,
    accountMapping: ['242'],
    note: 'Tăng (-), Giảm (+)'
  },
  {
    code: '13',
    name: '   - Thuế TNDN đã nộp',
    level: 2,
    accountMapping: ['3334'],
    note: 'Phát sinh Nợ TK 3334',
    isNegative: true
  },
  // 5. Lưu chuyển tiền thuần từ HĐKD
  {
    code: '20',
    name: 'Lưu chuyển tiền thuần từ hoạt động kinh doanh',
    level: 0,
    accountMapping: [],
    isTotal: true,
    formula: '08 + (09 to 13)'
  }
];

/**
 * II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ
 */
export const INVESTING_ACTIVITIES_TEMPLATE: Omit<CashFlowRow, 'amount'>[] = [
  {
    code: '21',
    name: '1. Tiền chi mua sắm TSCĐ',
    level: 1,
    accountMapping: ['211'],
    note: 'Phát sinh Nợ TK 211 (chi tiền)',
    isNegative: true
  },
  {
    code: '22',
    name: '2. Tiền thu thanh lý TSCĐ',
    level: 1,
    accountMapping: ['211', '711'],
    note: 'Thu tiền từ thanh lý'
  },
  {
    code: '23',
    name: '3. Tiền chi đầu tư góp vốn',
    level: 1,
    accountMapping: ['228'],
    note: 'Phát sinh Nợ TK 228',
    isNegative: true
  },
  {
    code: '24',
    name: '4. Tiền thu hồi đầu tư góp vốn',
    level: 1,
    accountMapping: ['228'],
    note: 'Thu hồi vốn đầu tư'
  },
  {
    code: '25',
    name: '5. Tiền thu lãi cho vay, cổ tức',
    level: 1,
    accountMapping: ['515'],
    note: 'Phát sinh Có TK 515 (thu tiền)'
  },
  {
    code: '30',
    name: 'Lưu chuyển tiền thuần từ hoạt động đầu tư',
    level: 0,
    accountMapping: [],
    isTotal: true,
    formula: '21 + 22 + 23 + 24 + 25'
  }
];

/**
 * III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH
 */
export const FINANCING_ACTIVITIES_TEMPLATE: Omit<CashFlowRow, 'amount'>[] = [
  {
    code: '31',
    name: '1. Tiền thu từ phát hành cổ phiếu, góp vốn',
    level: 1,
    accountMapping: ['411'],
    note: 'Phát sinh Có TK 411 (thu tiền)'
  },
  {
    code: '32',
    name: '2. Tiền chi trả vốn góp',
    level: 1,
    accountMapping: ['411'],
    note: 'Giảm vốn (chi tiền)',
    isNegative: true
  },
  {
    code: '33',
    name: '3. Tiền vay ngắn hạn, dài hạn nhận được',
    level: 1,
    accountMapping: ['341'],
    note: 'Phát sinh Có TK 341'
  },
  {
    code: '34',
    name: '4. Tiền chi trả nợ gốc vay',
    level: 1,
    accountMapping: ['341'],
    note: 'Phát sinh Nợ TK 341',
    isNegative: true
  },
  {
    code: '35',
    name: '5. Tiền chi trả nợ thuê tài chính',
    level: 1,
    accountMapping: ['342'],
    note: 'Thuê tài chính',
    isNegative: true
  },
  {
    code: '36',
    name: '6. Cổ tức, lợi nhuận đã trả',
    level: 1,
    accountMapping: ['421'],
    note: 'Phát sinh Nợ TK 421 (chi tiền)',
    isNegative: true
  },
  {
    code: '40',
    name: 'Lưu chuyển tiền thuần từ hoạt động tài chính',
    level: 0,
    accountMapping: [],
    isTotal: true,
    formula: '31 + 32 + 33 + 34 + 35 + 36'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate báo cáo LCTT
 */
export function validateCashFlowReport(report: CashFlowReport): CashFlowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const explanations: string[] = [];

  // 1. Kiểm tra công thức cơ bản: Tiền cuối = Tiền đầu + LC thuần
  const calculatedCashEnding = report.summary.cashBeginning + report.summary.netCashFlow;
  const cashDifference = Math.abs(report.summary.cashEnding - calculatedCashEnding);
  const isCashBalanced = cashDifference < 1; // Tolerance 1 VNĐ

  if (!isCashBalanced) {
    errors.push(`Tiền cuối kỳ không khớp: Thực tế ${formatCurrency(report.summary.cashEnding)} ≠ Tính toán ${formatCurrency(calculatedCashEnding)}`);
    errors.push(`Chênh lệch: ${formatCurrency(cashDifference)}`);
  }

  // 2. Kiểm tra logic: Lợi nhuận ≠ Tiền
  const netProfit = report.operating.rows.find(r => r.code === '01')?.amount || 0;
  const operatingCashFlow = report.operating.total;

  if (netProfit > 0 && operatingCashFlow < 0) {
    // Có lãi nhưng tiền âm - cần giải thích
    const receivablesIncrease = report.operating.rows.find(r => r.code === '09')?.amount || 0;
    const inventoryIncrease = report.operating.rows.find(r => r.code === '10')?.amount || 0;

    if (receivablesIncrease < 0) {
      explanations.push(`Phải thu tăng ${formatCurrency(Math.abs(receivablesIncrease))} → Tiền giảm tương ứng`);
    }
    if (inventoryIncrease < 0) {
      explanations.push(`Tồn kho tăng ${formatCurrency(Math.abs(inventoryIncrease))} → Tiền giảm tương ứng`);
    }

    if (explanations.length === 0) {
      warnings.push('Có lợi nhuận nhưng dòng tiền kinh doanh âm - cần xem xét lại');
    }
  }

  if (netProfit < 0 && operatingCashFlow > 0) {
    // Lỗ nhưng tiền dương - cần giải thích
    const payablesIncrease = report.operating.rows.find(r => r.code === '11')?.amount || 0;
    const depreciation = report.operating.rows.find(r => r.code === '03')?.amount || 0;

    if (payablesIncrease > 0) {
      explanations.push(`Nợ phải trả tăng ${formatCurrency(payablesIncrease)} → Giữ lại tiền`);
    }
    if (depreciation > 0) {
      explanations.push(`Khấu hao ${formatCurrency(depreciation)} không dùng tiền`);
    }
  }

  // 3. Kiểm tra số âm bất hợp lý
  if (report.summary.cashEnding < 0) {
    errors.push('Tiền cuối kỳ không thể âm');
  }

  if (report.summary.cashBeginning < 0) {
    errors.push('Tiền đầu kỳ không thể âm');
  }

  const isValid = errors.length === 0;
  const canSubmit = isValid && isCashBalanced;

  return {
    isValid,
    isCashBalanced,
    cashDifference,
    canSubmit,
    errors,
    warnings,
    explanations
  };
}

/**
 * Tính lưu chuyển tiền thuần
 */
export function calculateNetCashFlow(
  operating: number,
  investing: number,
  financing: number
): number {
  return operating + investing + financing;
}

/**
 * Tính thay đổi khoản mục BCĐKT
 * @param endingBalance Số dư cuối kỳ
 * @param beginningBalance Số dư đầu kỳ
 * @param isAsset True nếu là tài sản (tăng → tiền giảm)
 */
export function calculateBalanceChange(
  endingBalance: number,
  beginningBalance: number,
  isAsset: boolean
): number {
  const change = endingBalance - beginningBalance;
  // Tài sản tăng → Tiền giảm (âm)
  // Nợ phải trả tăng → Tiền tăng (dương)
  return isAsset ? -change : change;
}

/**
 * Format số tiền
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

/**
 * Kiểm tra có thể lập báo cáo LCTT không
 */
export interface CashFlowPrerequisites {
  canGenerate: boolean;
  reasons: string[];
  trialBalanceOk: boolean;
  balanceSheetOk: boolean;
  incomeStatementOk: boolean;
  periodLocked: boolean;
}

export function checkCashFlowPrerequisites(
  trialBalanceValid: boolean,
  balanceSheetValid: boolean,
  incomeStatementValid: boolean,
  periodLocked: boolean
): CashFlowPrerequisites {
  const reasons: string[] = [];

  if (!trialBalanceValid) {
    reasons.push('Bảng cân đối tài khoản chưa cân đối');
  }
  if (!balanceSheetValid) {
    reasons.push('Bảng cân đối kế toán chưa hợp lệ');
  }
  if (!incomeStatementValid) {
    reasons.push('Báo cáo kết quả kinh doanh chưa hợp lệ');
  }
  if (!periodLocked) {
    reasons.push('Kỳ kế toán chưa được khóa sổ');
  }

  return {
    canGenerate: reasons.length === 0,
    reasons,
    trialBalanceOk: trialBalanceValid,
    balanceSheetOk: balanceSheetValid,
    incomeStatementOk: incomeStatementValid,
    periodLocked
  };
}
