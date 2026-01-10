/**
 * BẢNG CÂN ĐỐI KẾ TOÁN - BALANCE SHEET
 *
 * Theo Thông tư 99/2025/TT-BTC
 * Mẫu B01-DNN (Doanh nghiệp nhỏ & vừa)
 *
 * NGUYÊN TẮC BẤT BIẾN:
 * - TỔNG TÀI SẢN = TỔNG NGUỒN VỐN
 * - READ-ONLY: Dữ liệu 100% từ Bảng cân đối tài khoản
 * - Chỉ được lập khi Trial Balance cân đối
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Một dòng trong BCĐKT
 */
export interface BalanceSheetRow {
  code: string;           // Mã chỉ tiêu: 100, 110, 111...
  name: string;           // Tên chỉ tiêu
  note?: string;          // Thuyết minh (nếu có)
  level: number;          // Cấp độ: 0 = tổng, 1 = nhóm, 2 = chi tiết
  amount: number;         // Số cuối kỳ
  previousAmount?: number;// Số đầu năm (optional)
  accountMapping: string[];// TK kế toán mapping
  isTotal?: boolean;      // Là dòng tổng cộng?
  isNegative?: boolean;   // Số âm (VD: Hao mòn TSCĐ)
}

/**
 * Một phần (section) trong BCĐKT
 */
export interface BalanceSheetSection {
  id: string;             // ID section: 'A', 'B', 'C', 'D'
  title: string;          // Tiêu đề
  rows: BalanceSheetRow[];
  total: number;
  previousTotal?: number;
}

/**
 * Toàn bộ BCĐKT
 */
export interface BalanceSheetReport {
  // TÀI SẢN
  assets: {
    shortTerm: BalanceSheetSection;   // A. Tài sản ngắn hạn
    longTerm: BalanceSheetSection;    // B. Tài sản dài hạn
    total: number;
    previousTotal?: number;
  };

  // NGUỒN VỐN
  liabilitiesAndEquity: {
    liabilities: BalanceSheetSection; // C. Nợ phải trả
    equity: BalanceSheetSection;      // D. Vốn chủ sở hữu
    total: number;
    previousTotal?: number;
  };

  // Kiểm tra cân đối
  validation: BalanceSheetValidation;

  // Metadata
  period: {
    endDate: string;      // Ngày kết thúc kỳ
    label: string;        // "31/12/2025"
    isLocked: boolean;
  };
  generatedAt: string;
  companyName?: string;
  taxCode?: string;
}

/**
 * Kết quả kiểm tra BCĐKT
 */
export interface BalanceSheetValidation {
  isBalanced: boolean;          // Tài sản = Nguồn vốn?
  difference: number;           // Chênh lệch
  canSubmit: boolean;           // Có thể nộp CQT?
  errors: string[];             // Danh sách lỗi
  warnings: string[];           // Danh sách cảnh báo
}

/**
 * Filter cho BCĐKT
 */
export interface BalanceSheetFilter {
  periodType: 'month' | 'quarter' | 'year';
  year: number;
  month?: number;
  quarter?: number;
  showPreviousPeriod: boolean;  // Hiển thị cột "Số đầu năm"
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING TÀI KHOẢN → CHỈ TIÊU BCĐKT
// Theo Thông tư 99/2025/TT-BTC - Mẫu B01-DNN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Template cấu trúc BCĐKT theo TT99
 */
export interface BalanceSheetTemplate {
  code: string;
  name: string;
  level: number;
  accountMapping: string[];
  isNegative?: boolean;
  note?: string;
}

// A. TÀI SẢN NGẮN HẠN (Mã 100)
export const SHORT_TERM_ASSETS_TEMPLATE: BalanceSheetTemplate[] = [
  { code: '100', name: 'A. TÀI SẢN NGẮN HẠN', level: 0, accountMapping: [] },

  { code: '110', name: 'I. Tiền và các khoản tương đương tiền', level: 1, accountMapping: [] },
  { code: '111', name: '1. Tiền', level: 2, accountMapping: ['111', '112'] },

  { code: '130', name: 'II. Các khoản phải thu ngắn hạn', level: 1, accountMapping: [] },
  { code: '131', name: '1. Phải thu ngắn hạn của khách hàng', level: 2, accountMapping: ['131'] },
  { code: '132', name: '2. Trả trước cho người bán ngắn hạn', level: 2, accountMapping: ['331'], note: 'Dư Nợ TK 331' },
  { code: '136', name: '3. Phải thu ngắn hạn khác', level: 2, accountMapping: ['138', '141'] },

  { code: '140', name: 'III. Hàng tồn kho', level: 1, accountMapping: [] },
  { code: '141', name: '1. Hàng tồn kho', level: 2, accountMapping: ['152', '153', '154', '155', '156', '157'] },

  { code: '150', name: 'IV. Tài sản ngắn hạn khác', level: 1, accountMapping: [] },
  { code: '151', name: '1. Thuế GTGT được khấu trừ', level: 2, accountMapping: ['133', '1331', '1332'] },
  { code: '152', name: '2. Thuế và các khoản phải thu Nhà nước', level: 2, accountMapping: ['333'], note: 'Dư Nợ TK 333' },
];

// B. TÀI SẢN DÀI HẠN (Mã 200)
export const LONG_TERM_ASSETS_TEMPLATE: BalanceSheetTemplate[] = [
  { code: '200', name: 'B. TÀI SẢN DÀI HẠN', level: 0, accountMapping: [] },

  { code: '220', name: 'I. Tài sản cố định', level: 1, accountMapping: [] },
  { code: '221', name: '1. Tài sản cố định hữu hình', level: 2, accountMapping: [] },
  { code: '222', name: '   - Nguyên giá', level: 3, accountMapping: ['211'] },
  { code: '223', name: '   - Giá trị hao mòn lũy kế', level: 3, accountMapping: ['214'], isNegative: true },
];

// C. NỢ PHẢI TRẢ (Mã 300)
export const LIABILITIES_TEMPLATE: BalanceSheetTemplate[] = [
  { code: '300', name: 'C. NỢ PHẢI TRẢ', level: 0, accountMapping: [] },

  { code: '310', name: 'I. Nợ ngắn hạn', level: 1, accountMapping: [] },
  { code: '311', name: '1. Phải trả người bán ngắn hạn', level: 2, accountMapping: ['331'], note: 'Dư Có TK 331' },
  { code: '312', name: '2. Người mua trả tiền trước ngắn hạn', level: 2, accountMapping: ['131'], note: 'Dư Có TK 131' },
  { code: '313', name: '3. Thuế và các khoản phải nộp Nhà nước', level: 2, accountMapping: ['333', '3331', '3334', '3335'] },
  { code: '314', name: '4. Phải trả người lao động', level: 2, accountMapping: ['334'] },
  { code: '318', name: '5. Phải trả ngắn hạn khác', level: 2, accountMapping: ['338', '3383', '3384', '3386'] },
];

// D. VỐN CHỦ SỞ HỮU (Mã 400)
export const EQUITY_TEMPLATE: BalanceSheetTemplate[] = [
  { code: '400', name: 'D. VỐN CHỦ SỞ HỮU', level: 0, accountMapping: [] },

  { code: '410', name: 'I. Vốn chủ sở hữu', level: 1, accountMapping: [] },
  { code: '411', name: '1. Vốn góp của chủ sở hữu', level: 2, accountMapping: ['411'] },
  { code: '421', name: '2. Lợi nhuận sau thuế chưa phân phối', level: 2, accountMapping: ['421', '4211', '4212'] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kiểm tra BCĐKT có cân đối không
 */
export function validateBalanceSheet(report: BalanceSheetReport): BalanceSheetValidation {
  const totalAssets = report.assets.total;
  const totalLiabilitiesAndEquity = report.liabilitiesAndEquity.total;
  const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = difference < 0.01; // Tolerance for rounding

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isBalanced) {
    errors.push(`Tổng tài sản (${formatCurrency(totalAssets)}) ≠ Tổng nguồn vốn (${formatCurrency(totalLiabilitiesAndEquity)})`);
    errors.push(`Chênh lệch: ${formatCurrency(difference)}`);
  }

  if (totalAssets < 0) {
    errors.push('Tổng tài sản không thể âm');
  }

  if (report.liabilitiesAndEquity.equity.total < 0) {
    warnings.push('Vốn chủ sở hữu âm - doanh nghiệp có thể đang lỗ vượt vốn');
  }

  return {
    isBalanced,
    difference,
    canSubmit: isBalanced && errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format số tiền
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

/**
 * Lấy số dư từ Trial Balance theo mã TK
 */
export function getBalanceByAccounts(
  trialBalanceData: Map<string, { debit: number; credit: number }>,
  accountCodes: string[],
  balanceType: 'debit' | 'credit' | 'net' = 'net'
): number {
  let total = 0;

  accountCodes.forEach(code => {
    const balance = trialBalanceData.get(code);
    if (balance) {
      switch (balanceType) {
        case 'debit':
          total += balance.debit;
          break;
        case 'credit':
          total += balance.credit;
          break;
        case 'net':
        default:
          total += (balance.debit - balance.credit);
      }
    }
  });

  return total;
}

/**
 * Tính tổng một section
 */
export function calculateSectionTotal(rows: BalanceSheetRow[]): number {
  return rows
    .filter(r => r.level === 2 || r.level === 3) // Chỉ tính các dòng chi tiết
    .reduce((sum, row) => {
      const amount = row.isNegative ? -Math.abs(row.amount) : row.amount;
      return sum + amount;
    }, 0);
}

/**
 * Nhóm chỉ tiêu con theo cha
 */
export function groupRowsByParent(rows: BalanceSheetRow[]): Map<string, BalanceSheetRow[]> {
  const groups = new Map<string, BalanceSheetRow[]>();

  rows.forEach(row => {
    const parentCode = row.code.substring(0, row.code.length - 1) + '0';
    if (!groups.has(parentCode)) {
      groups.set(parentCode, []);
    }
    groups.get(parentCode)!.push(row);
  });

  return groups;
}
