/**
 * BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH - INCOME STATEMENT
 *
 * Theo Thông tư 133/2016/TT-BTC & định hướng Thông tư 99/2025/TT-BTC
 * Mẫu B02-DNN (Doanh nghiệp nhỏ & vừa)
 *
 * NGUYÊN TẮC:
 * - LÃI/LỖ = DOANH THU - CHI PHÍ
 * - READ-ONLY: Dữ liệu 100% từ Sổ cái (Ledger)
 * - Chỉ được lập khi kỳ đã khóa sổ
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Một dòng trong Báo cáo KQKD
 */
export interface IncomeStatementRow {
  code: string;             // Mã chỉ tiêu: 01, 02, 10, 11...
  name: string;             // Tên chỉ tiêu
  note?: string;            // Thuyết minh (nếu có)
  level: number;            // Cấp độ: 0 = tổng, 1 = nhóm, 2 = chi tiết
  amount: number;           // Số kỳ này
  previousAmount?: number;  // Số kỳ trước / Lũy kế từ đầu năm
  accountMapping: string[]; // TK kế toán mapping
  formula?: string;         // Công thức tính (VD: "01 - 02")
  isTotal?: boolean;        // Là dòng tổng cộng?
  isNegative?: boolean;     // Trừ đi (VD: Các khoản giảm trừ doanh thu)
  isCalculated?: boolean;   // Tính từ công thức, không từ TK
}

/**
 * Một phần (section) trong Báo cáo KQKD
 */
export interface IncomeStatementSection {
  id: string;               // ID section
  title: string;            // Tiêu đề
  rows: IncomeStatementRow[];
  total: number;
  previousTotal?: number;
}

/**
 * Toàn bộ Báo cáo KQKD
 */
export interface IncomeStatementReport {
  // Các chỉ tiêu chính
  rows: IncomeStatementRow[];

  // Tổng hợp key figures
  summary: {
    // Doanh thu thuần
    netRevenue: number;
    previousNetRevenue?: number;

    // Lợi nhuận gộp
    grossProfit: number;
    previousGrossProfit?: number;

    // Lợi nhuận từ HĐKD
    operatingProfit: number;
    previousOperatingProfit?: number;

    // Lợi nhuận trước thuế
    profitBeforeTax: number;
    previousProfitBeforeTax?: number;

    // Lợi nhuận sau thuế
    netProfit: number;
    previousNetProfit?: number;
  };

  // Validation
  validation: IncomeStatementValidation;

  // Metadata
  period: {
    startDate: string;      // Ngày bắt đầu kỳ
    endDate: string;        // Ngày kết thúc kỳ
    label: string;          // "Tháng 12/2025", "Quý IV/2025", "Năm 2025"
    isLocked: boolean;
  };
  generatedAt: string;
  companyName?: string;
  taxCode?: string;
}

/**
 * Kết quả kiểm tra Báo cáo KQKD
 */
export interface IncomeStatementValidation {
  isValid: boolean;           // Báo cáo hợp lệ?
  canSubmit: boolean;         // Có thể nộp CQT?
  errors: string[];           // Danh sách lỗi
  warnings: string[];         // Danh sách cảnh báo
}

/**
 * Filter cho Báo cáo KQKD
 */
export interface IncomeStatementFilter {
  periodType: 'month' | 'quarter' | 'year';
  year: number;
  month?: number;
  quarter?: number;
  compareType: 'previous_period' | 'ytd' | 'same_period_last_year' | 'none';
  // previous_period: So với kỳ trước
  // ytd: Lũy kế từ đầu năm
  // same_period_last_year: Cùng kỳ năm trước
  // none: Không so sánh
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING TÀI KHOẢN → CHỈ TIÊU BÁO CÁO KQKD
// Theo Thông tư 133/2016/TT-BTC - Mẫu B02-DNN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Template cấu trúc Báo cáo KQKD
 */
export interface IncomeStatementTemplate {
  code: string;
  name: string;
  level: number;
  accountMapping: string[];
  balanceType?: 'credit' | 'debit' | 'net';  // Loại số dư cần lấy
  formula?: string;                           // Công thức: "01 - 02"
  isNegative?: boolean;
  note?: string;
}

/**
 * TEMPLATE BÁO CÁO KQKD THEO TT133 - MẪU B02-DNN
 *
 * Cấu trúc:
 * 01. Doanh thu bán hàng và cung cấp dịch vụ
 * 02. Các khoản giảm trừ doanh thu
 * 10. Doanh thu thuần = 01 - 02
 * 11. Giá vốn hàng bán
 * 20. Lợi nhuận gộp = 10 - 11
 * 21. Doanh thu hoạt động tài chính
 * 22. Chi phí tài chính
 * 24. Chi phí quản lý kinh doanh
 * 30. Lợi nhuận thuần từ HĐKD = 20 + 21 - 22 - 24
 * 31. Thu nhập khác
 * 32. Chi phí khác
 * 40. Lợi nhuận khác = 31 - 32
 * 50. Tổng lợi nhuận trước thuế = 30 + 40
 * 51. Chi phí thuế TNDN
 * 60. Lợi nhuận sau thuế = 50 - 51
 */
export const INCOME_STATEMENT_TEMPLATE: IncomeStatementTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN I: DOANH THU & LỢI NHUẬN GỘP
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '01',
    name: '1. Doanh thu bán hàng và cung cấp dịch vụ',
    level: 1,
    accountMapping: ['511', '5111', '5112', '5113', '5118'],
    balanceType: 'credit',
    note: 'TK 511 - Phát sinh Có'
  },
  {
    code: '02',
    name: '2. Các khoản giảm trừ doanh thu',
    level: 1,
    accountMapping: ['521', '5211', '5212', '5213'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 521 - Phát sinh Nợ (số âm)'
  },
  {
    code: '10',
    name: '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)',
    level: 0,
    accountMapping: [],
    formula: '01 - 02'
  },
  {
    code: '11',
    name: '4. Giá vốn hàng bán',
    level: 1,
    accountMapping: ['632'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 632 - Phát sinh Nợ'
  },
  {
    code: '20',
    name: '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)',
    level: 0,
    accountMapping: [],
    formula: '10 - 11'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN II: DOANH THU & CHI PHÍ TÀI CHÍNH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '21',
    name: '6. Doanh thu hoạt động tài chính',
    level: 1,
    accountMapping: ['515', '5151', '5152', '5153', '5154', '5155'],
    balanceType: 'credit',
    note: 'TK 515 - Phát sinh Có'
  },
  {
    code: '22',
    name: '7. Chi phí tài chính',
    level: 1,
    accountMapping: ['635', '6351', '6352'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 635 - Phát sinh Nợ'
  },
  {
    code: '23',
    name: '   - Trong đó: Chi phí lãi vay',
    level: 2,
    accountMapping: ['6351'],
    balanceType: 'debit',
    note: 'TK 6351 - Lãi vay'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN III: CHI PHÍ QUẢN LÝ KINH DOANH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '24',
    name: '8. Chi phí quản lý kinh doanh',
    level: 1,
    accountMapping: ['642', '6421', '6422', '6423', '6424', '6425', '6426', '6427', '6428'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 642 - Chi phí QLDN (SME không tách 641)'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN IV: LỢI NHUẬN TỪ HOẠT ĐỘNG KINH DOANH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '30',
    name: '9. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 24)',
    level: 0,
    accountMapping: [],
    formula: '20 + 21 - 22 - 24'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN V: THU NHẬP & CHI PHÍ KHÁC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '31',
    name: '10. Thu nhập khác',
    level: 1,
    accountMapping: ['711'],
    balanceType: 'credit',
    note: 'TK 711 - Thu nhập khác'
  },
  {
    code: '32',
    name: '11. Chi phí khác',
    level: 1,
    accountMapping: ['811'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 811 - Chi phí khác'
  },
  {
    code: '40',
    name: '12. Lợi nhuận khác (40 = 31 - 32)',
    level: 0,
    accountMapping: [],
    formula: '31 - 32'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHẦN VI: LỢI NHUẬN TRƯỚC THUẾ & SAU THUẾ
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: '50',
    name: '13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)',
    level: 0,
    accountMapping: [],
    formula: '30 + 40'
  },
  {
    code: '51',
    name: '14. Chi phí thuế TNDN',
    level: 1,
    accountMapping: ['821', '8211', '8212'],
    balanceType: 'debit',
    isNegative: true,
    note: 'TK 821 - Chi phí thuế TNDN'
  },
  {
    code: '60',
    name: '15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)',
    level: 0,
    accountMapping: [],
    formula: '50 - 51'
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse công thức tính
 * VD: "01 - 02" => { codes: ['01', '02'], operators: ['-'] }
 */
export interface FormulaParseResult {
  codes: string[];
  operators: ('+' | '-')[];
}

export function parseFormula(formula: string): FormulaParseResult {
  const codes: string[] = [];
  const operators: ('+' | '-')[] = [];

  // Split by + or - while keeping the operators
  const parts = formula.split(/\s*([\+\-])\s*/);

  parts.forEach((part, index) => {
    if (part === '+' || part === '-') {
      operators.push(part);
    } else if (part.trim()) {
      codes.push(part.trim());
    }
  });

  return { codes, operators };
}

/**
 * Tính giá trị từ công thức
 */
export function calculateFromFormula(
  formula: string,
  rowValues: Map<string, number>
): number {
  const { codes, operators } = parseFormula(formula);

  if (codes.length === 0) return 0;

  let result = rowValues.get(codes[0]) || 0;

  for (let i = 0; i < operators.length; i++) {
    const nextValue = rowValues.get(codes[i + 1]) || 0;
    if (operators[i] === '+') {
      result += nextValue;
    } else {
      result -= nextValue;
    }
  }

  return result;
}

/**
 * Kiểm tra Báo cáo KQKD
 */
export function validateIncomeStatement(report: IncomeStatementReport): IncomeStatementValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Kiểm tra doanh thu âm
  if (report.summary.netRevenue < 0) {
    warnings.push('Doanh thu thuần âm - cần kiểm tra các bút toán giảm trừ doanh thu');
  }

  // Kiểm tra lỗ
  if (report.summary.netProfit < 0) {
    warnings.push(`Kỳ báo cáo có kết quả lỗ: ${formatCurrency(report.summary.netProfit)}`);
  }

  // Kiểm tra tỷ lệ lợi nhuận gộp
  if (report.summary.netRevenue > 0) {
    const grossMargin = (report.summary.grossProfit / report.summary.netRevenue) * 100;
    if (grossMargin < 0) {
      warnings.push('Tỷ suất lợi nhuận gộp âm - giá vốn cao hơn doanh thu');
    }
    if (grossMargin > 90) {
      warnings.push('Tỷ suất lợi nhuận gộp > 90% - cần kiểm tra lại giá vốn');
    }
  }

  // Kiểm tra chi phí quản lý bất thường
  const cpqldn = report.rows.find(r => r.code === '24')?.amount || 0;
  if (cpqldn > 0 && report.summary.netRevenue > 0) {
    const cpRatio = (cpqldn / report.summary.netRevenue) * 100;
    if (cpRatio > 50) {
      warnings.push(`Chi phí QLDN chiếm ${cpRatio.toFixed(1)}% doanh thu - cần kiểm tra`);
    }
  }

  return {
    isValid: errors.length === 0,
    canSubmit: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format số tiền
 */
function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return sign + new Intl.NumberFormat('vi-VN').format(Math.abs(value)) + ' VNĐ';
}

/**
 * Lấy số phát sinh từ Sổ cái
 */
export function getAmountFromLedger(
  ledgerData: Map<string, { debitAmount: number; creditAmount: number }>,
  accountCodes: string[],
  balanceType: 'credit' | 'debit' | 'net' = 'net'
): number {
  let total = 0;

  accountCodes.forEach(code => {
    // Tìm TK chính xác hoặc TK con
    ledgerData.forEach((balance, accountCode) => {
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

/**
 * Tạo summary từ các dòng
 */
export function buildSummary(rows: IncomeStatementRow[]): IncomeStatementReport['summary'] {
  const getValue = (code: string): number => {
    return rows.find(r => r.code === code)?.amount || 0;
  };

  const getPreviousValue = (code: string): number | undefined => {
    return rows.find(r => r.code === code)?.previousAmount;
  };

  return {
    netRevenue: getValue('10'),
    previousNetRevenue: getPreviousValue('10'),

    grossProfit: getValue('20'),
    previousGrossProfit: getPreviousValue('20'),

    operatingProfit: getValue('30'),
    previousOperatingProfit: getPreviousValue('30'),

    profitBeforeTax: getValue('50'),
    previousProfitBeforeTax: getPreviousValue('50'),

    netProfit: getValue('60'),
    previousNetProfit: getPreviousValue('60'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mã các dòng tổng cộng (level 0)
 */
export const TOTAL_ROW_CODES = ['10', '20', '30', '40', '50', '60'];

/**
 * Mã các dòng highlight (quan trọng)
 */
export const HIGHLIGHT_ROW_CODES = ['10', '20', '30', '50', '60'];

/**
 * Thuế suất TNDN hiện hành (2025)
 */
export const CIT_RATE = 0.20; // 20%

/**
 * Thuế suất TNDN ưu đãi SME (nếu có)
 */
export const CIT_RATE_SME = 0.17; // 17% cho DN nhỏ & siêu nhỏ
