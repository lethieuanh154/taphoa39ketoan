/**
 * BẢNG CÂN ĐỐI TÀI KHOẢN - TRIAL BALANCE
 *
 * Theo Thông tư 99/2025/TT-BTC
 * Dành cho Công ty TNHH 1 thành viên
 *
 * NGUYÊN TẮC:
 * - READ-ONLY: Dữ liệu 100% tự động từ Sổ cái
 * - Tổng Dư Nợ = Tổng Dư Có (cả đầu kỳ và cuối kỳ)
 * - Là checkpoint bắt buộc trước khi lập BCTC
 * - Không cho phép nhập/chỉnh sửa số liệu
 */

import { AccountType, AccountNature } from './ledger.models';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Một dòng trong Bảng cân đối tài khoản
 */
export interface TrialBalanceRow {
  accountCode: string;          // Mã TK: 111, 112, 131...
  accountName: string;          // Tên TK
  level: number;                // Cấp TK: 1, 2, 3
  parentCode?: string;          // TK cha

  // Số dư đầu kỳ
  openingDebit: number;         // Dư Nợ đầu kỳ
  openingCredit: number;        // Dư Có đầu kỳ

  // Phát sinh trong kỳ
  periodDebit: number;          // Phát sinh Nợ
  periodCredit: number;         // Phát sinh Có

  // Số dư cuối kỳ
  closingDebit: number;         // Dư Nợ cuối kỳ
  closingCredit: number;        // Dư Có cuối kỳ

  // Metadata
  accountType: AccountType;     // Loại TK
  nature: AccountNature;        // Bản chất TK (dư Nợ/Có)
  isAbnormal: boolean;          // Có bất thường không?
  abnormalReason?: string;      // Lý do bất thường
  entryCount: number;           // Số bút toán trong kỳ
}

/**
 * Filter cho Bảng cân đối TK
 */
export interface TrialBalanceFilter {
  periodType: 'month' | 'quarter' | 'year';
  year: number;
  month?: number;               // 1-12
  quarter?: number;             // 1-4
  includeZeroBalance: boolean;  // Hiển thị TK số dư = 0
  includeSubAccounts: boolean;  // Hiển thị TK chi tiết
  accountLevel?: number;        // Lọc theo cấp TK
}

/**
 * Tổng hợp kiểm tra cân đối
 */
export interface BalanceCheckResult {
  // Số dư đầu kỳ
  openingDebitTotal: number;
  openingCreditTotal: number;
  openingBalanced: boolean;
  openingDifference: number;

  // Phát sinh trong kỳ
  periodDebitTotal: number;
  periodCreditTotal: number;
  periodBalanced: boolean;
  periodDifference: number;

  // Số dư cuối kỳ
  closingDebitTotal: number;
  closingCreditTotal: number;
  closingBalanced: boolean;
  closingDifference: number;

  // Tổng hợp
  isFullyBalanced: boolean;     // Tất cả đều cân đối?
  canGenerateReport: boolean;   // Có thể lập BCTC?
  abnormalAccounts: number;     // Số TK bất thường
  warningMessages: string[];    // Các cảnh báo
}

/**
 * Response từ API
 */
export interface TrialBalanceResponse {
  rows: TrialBalanceRow[];
  balanceCheck: BalanceCheckResult;
  period: {
    from: string;
    to: string;
    label: string;
    isLocked: boolean;
  };
  generatedAt: string;
}

/**
 * Lỗi cân đối
 */
export interface BalanceError {
  type: 'OPENING' | 'CLOSING' | 'PERIOD' | 'ABNORMAL';
  accountCode?: string;
  accountName?: string;
  expectedValue: number;
  actualValue: number;
  difference: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ngưỡng chênh lệch cho phép (do làm tròn)
 */
export const BALANCE_TOLERANCE = 0.01;

/**
 * Trạng thái cân đối
 */
export type BalanceStatus = 'BALANCED' | 'UNBALANCED' | 'WARNING';

export const BALANCE_STATUS_LABELS: Record<BalanceStatus, string> = {
  'BALANCED': 'Cân đối',
  'UNBALANCED': 'Lệch',
  'WARNING': 'Cảnh báo'
};

export const BALANCE_STATUS_COLORS: Record<BalanceStatus, string> = {
  'BALANCED': '#22c55e',
  'UNBALANCED': '#ef4444',
  'WARNING': '#f59e0b'
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kiểm tra cân đối của bảng
 */
export function checkTrialBalance(rows: TrialBalanceRow[]): BalanceCheckResult {
  // Chỉ tính TK cấp 1 (tránh tính trùng)
  const level1Rows = rows.filter(r => r.level === 1);

  const openingDebitTotal = level1Rows.reduce((sum, r) => sum + r.openingDebit, 0);
  const openingCreditTotal = level1Rows.reduce((sum, r) => sum + r.openingCredit, 0);
  const periodDebitTotal = level1Rows.reduce((sum, r) => sum + r.periodDebit, 0);
  const periodCreditTotal = level1Rows.reduce((sum, r) => sum + r.periodCredit, 0);
  const closingDebitTotal = level1Rows.reduce((sum, r) => sum + r.closingDebit, 0);
  const closingCreditTotal = level1Rows.reduce((sum, r) => sum + r.closingCredit, 0);

  const openingDiff = Math.abs(openingDebitTotal - openingCreditTotal);
  const periodDiff = Math.abs(periodDebitTotal - periodCreditTotal);
  const closingDiff = Math.abs(closingDebitTotal - closingCreditTotal);

  const openingBalanced = openingDiff <= BALANCE_TOLERANCE;
  const periodBalanced = periodDiff <= BALANCE_TOLERANCE;
  const closingBalanced = closingDiff <= BALANCE_TOLERANCE;

  const abnormalAccounts = rows.filter(r => r.isAbnormal).length;
  const isFullyBalanced = openingBalanced && periodBalanced && closingBalanced;

  const warningMessages: string[] = [];
  if (!openingBalanced) {
    warningMessages.push(`Số dư đầu kỳ lệch: ${formatCurrency(openingDiff)}`);
  }
  if (!periodBalanced) {
    warningMessages.push(`Phát sinh trong kỳ lệch: ${formatCurrency(periodDiff)}`);
  }
  if (!closingBalanced) {
    warningMessages.push(`Số dư cuối kỳ lệch: ${formatCurrency(closingDiff)}`);
  }
  if (abnormalAccounts > 0) {
    warningMessages.push(`${abnormalAccounts} tài khoản có số dư bất thường`);
  }

  return {
    openingDebitTotal,
    openingCreditTotal,
    openingBalanced,
    openingDifference: openingDiff,

    periodDebitTotal,
    periodCreditTotal,
    periodBalanced,
    periodDifference: periodDiff,

    closingDebitTotal,
    closingCreditTotal,
    closingBalanced,
    closingDifference: closingDiff,

    isFullyBalanced,
    canGenerateReport: isFullyBalanced && abnormalAccounts === 0,
    abnormalAccounts,
    warningMessages
  };
}

/**
 * Format số tiền
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

/**
 * Kiểm tra TK có số dư bất thường không
 */
export function checkAbnormalBalance(row: TrialBalanceRow): { isAbnormal: boolean; reason?: string } {
  // TK lưỡng tính không kiểm tra
  if (row.nature === 'AMPHIBIOUS') {
    return { isAbnormal: false };
  }

  // TK dư Nợ mà có dư Có
  if (row.nature === 'DEBIT') {
    if (row.closingCredit > 0 && row.closingDebit === 0) {
      return {
        isAbnormal: true,
        reason: `TK ${row.accountCode} có bản chất dư Nợ nhưng đang dư Có`
      };
    }
  }

  // TK dư Có mà có dư Nợ
  if (row.nature === 'CREDIT') {
    if (row.closingDebit > 0 && row.closingCredit === 0) {
      return {
        isAbnormal: true,
        reason: `TK ${row.accountCode} có bản chất dư Có nhưng đang dư Nợ`
      };
    }
  }

  return { isAbnormal: false };
}

/**
 * Lấy trạng thái cân đối
 */
export function getBalanceStatus(balanceCheck: BalanceCheckResult): BalanceStatus {
  if (balanceCheck.isFullyBalanced && balanceCheck.abnormalAccounts === 0) {
    return 'BALANCED';
  }
  if (!balanceCheck.isFullyBalanced) {
    return 'UNBALANCED';
  }
  return 'WARNING';
}

/**
 * Nhóm TK theo loại để hiển thị
 */
export interface TrialBalanceGroup {
  type: AccountType;
  label: string;
  rows: TrialBalanceRow[];
  subtotal: {
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
  };
}

export function groupTrialBalanceByType(rows: TrialBalanceRow[]): TrialBalanceGroup[] {
  const groups: TrialBalanceGroup[] = [
    { type: 'ASSET', label: 'Loại 1 - Tài sản', rows: [], subtotal: createEmptySubtotal() },
    { type: 'LIABILITY', label: 'Loại 3 - Nợ phải trả', rows: [], subtotal: createEmptySubtotal() },
    { type: 'EQUITY', label: 'Loại 4 - Vốn chủ sở hữu', rows: [], subtotal: createEmptySubtotal() },
    { type: 'REVENUE', label: 'Loại 5 - Doanh thu', rows: [], subtotal: createEmptySubtotal() },
    { type: 'COST', label: 'Loại 6 - Giá vốn', rows: [], subtotal: createEmptySubtotal() },
    { type: 'EXPENSE', label: 'Loại 6,8 - Chi phí', rows: [], subtotal: createEmptySubtotal() },
  ];

  rows.forEach(row => {
    const group = groups.find(g => g.type === row.accountType);
    if (group) {
      group.rows.push(row);
      if (row.level === 1) {
        group.subtotal.openingDebit += row.openingDebit;
        group.subtotal.openingCredit += row.openingCredit;
        group.subtotal.periodDebit += row.periodDebit;
        group.subtotal.periodCredit += row.periodCredit;
        group.subtotal.closingDebit += row.closingDebit;
        group.subtotal.closingCredit += row.closingCredit;
      }
    }
  });

  return groups.filter(g => g.rows.length > 0);
}

function createEmptySubtotal() {
  return {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    closingDebit: 0,
    closingCredit: 0
  };
}
