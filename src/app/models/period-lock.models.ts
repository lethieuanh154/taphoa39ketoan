/**
 * PERIOD LOCK - KHÓA SỔ KẾ TOÁN
 *
 * Theo Thông tư 99/2025/TT-BTC
 * Yêu cầu bắt buộc khi quyết toán thuế / kiểm toán
 *
 * NGUYÊN TẮC BẤT BIẾN:
 * 1. Số liệu đã khóa ≠ sửa trực tiếp
 * 2. Chỉ được điều chỉnh bằng bút toán điều chỉnh
 * 3. Khóa tháng → khi đã khóa tháng trước
 * 4. Khóa năm → khi đã khóa toàn bộ 12 tháng
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại kỳ kế toán
 */
export type PeriodType = 'MONTH' | 'QUARTER' | 'YEAR';

/**
 * Trạng thái kỳ
 */
export type PeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thông tin khóa kỳ
 */
export interface PeriodLock {
  id: string;
  period: string;                 // YYYY-MM (tháng) hoặc YYYY-Q1 (quý) hoặc YYYY (năm)
  periodType: PeriodType;
  year: number;
  month?: number;                 // 1-12 (chỉ có với MONTH)
  quarter?: number;               // 1-4 (chỉ có với QUARTER)
  status: PeriodStatus;
  lockedAt?: Date;                // Ngày khóa
  lockedBy?: string;              // UserID người khóa
  lockedByName?: string;          // Tên người khóa
  unlockedAt?: Date;              // Ngày mở khóa (nếu có)
  unlockedBy?: string;            // UserID người mở khóa
  unlockedByName?: string;        // Tên người mở khóa
  unlockReason?: string;          // Lý do mở khóa (BẮT BUỘC)
  closedAt?: Date;                // Ngày chốt sổ cuối cùng
  closedBy?: string;
  closedByName?: string;
}

/**
 * Điều kiện khóa sổ
 */
export interface PeriodLockChecklist {
  period: string;
  canLock: boolean;
  checks: PeriodLockCheck[];
  missingChecks: string[];
}

/**
 * Một điều kiện kiểm tra
 */
export interface PeriodLockCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  details?: string;
  severity: 'REQUIRED' | 'WARNING';
}

/**
 * Các điều kiện cần thiết để khóa kỳ
 */
export interface LockRequirements {
  trialBalanceValid: boolean;     // Trial Balance cân đối
  balanceSheetValid: boolean;     // BCĐKT hợp lệ
  incomeStatementValid: boolean;  // KQKD hợp lệ
  cashFlowValid: boolean;         // LCTT hợp lệ
  previousPeriodLocked: boolean;  // Kỳ trước đã khóa
  noUnreconciledItems: boolean;   // Không có mục chưa đối chiếu
  allVouchersApproved: boolean;   // Tất cả chứng từ đã duyệt
}

/**
 * Request khóa/mở khóa kỳ
 */
export interface PeriodLockRequest {
  period: string;
  action: 'LOCK' | 'UNLOCK';
  reason?: string;                // Bắt buộc với UNLOCK
  userId: string;
  userName: string;
}

/**
 * Response từ API
 */
export interface PeriodLockResponse {
  success: boolean;
  periodLock: PeriodLock;
  message: string;
  auditLogId?: string;
}

/**
 * Danh sách các kỳ
 */
export interface PeriodListResponse {
  periods: PeriodLock[];
  currentPeriod: string;          // Kỳ hiện tại
  lastLockedPeriod?: string;      // Kỳ khóa gần nhất
  nextLockablePeriod?: string;    // Kỳ có thể khóa tiếp
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Labels cho trạng thái
 */
export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  'OPEN': 'Đang mở',
  'LOCKED': 'Đã khóa',
  'CLOSED': 'Đã chốt sổ'
};

/**
 * Colors cho trạng thái
 */
export const PERIOD_STATUS_COLORS: Record<PeriodStatus, string> = {
  'OPEN': '#22c55e',      // Green
  'LOCKED': '#f59e0b',    // Amber
  'CLOSED': '#6b7280'     // Gray
};

/**
 * Icons cho trạng thái
 */
export const PERIOD_STATUS_ICONS: Record<PeriodStatus, string> = {
  'OPEN': 'fa-lock-open',
  'LOCKED': 'fa-lock',
  'CLOSED': 'fa-check-double'
};

/**
 * Labels cho loại kỳ
 */
export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  'MONTH': 'Tháng',
  'QUARTER': 'Quý',
  'YEAR': 'Năm'
};

/**
 * Các điều kiện kiểm tra mặc định
 */
export const DEFAULT_LOCK_CHECKS: Omit<PeriodLockCheck, 'passed' | 'details'>[] = [
  {
    id: 'trial_balance',
    name: 'Bảng cân đối TK',
    description: 'Tổng Nợ = Tổng Có',
    severity: 'REQUIRED'
  },
  {
    id: 'balance_sheet',
    name: 'Bảng CĐKT',
    description: 'Tài sản = Nguồn vốn',
    severity: 'REQUIRED'
  },
  {
    id: 'income_statement',
    name: 'Báo cáo KQKD',
    description: 'Báo cáo KQKD hợp lệ',
    severity: 'REQUIRED'
  },
  {
    id: 'cash_flow',
    name: 'Lưu chuyển tiền tệ',
    description: 'Tiền cuối = Tiền đầu + LC thuần',
    severity: 'REQUIRED'
  },
  {
    id: 'previous_period',
    name: 'Kỳ trước đã khóa',
    description: 'Phải khóa kỳ trước trước khi khóa kỳ này',
    severity: 'REQUIRED'
  },
  {
    id: 'vouchers_approved',
    name: 'Chứng từ đã duyệt',
    description: 'Tất cả chứng từ trong kỳ đã được duyệt',
    severity: 'WARNING'
  },
  {
    id: 'no_draft_entries',
    name: 'Không có bút toán nháp',
    description: 'Không còn bút toán ở trạng thái nháp',
    severity: 'WARNING'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tạo period string từ năm và tháng
 */
export function createPeriodString(year: number, month?: number, quarter?: number): string {
  if (month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  if (quarter) {
    return `${year}-Q${quarter}`;
  }
  return String(year);
}

/**
 * Parse period string
 */
export function parsePeriodString(period: string): {
  year: number;
  month?: number;
  quarter?: number;
  type: PeriodType;
} {
  // YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    return { year, month, type: 'MONTH' };
  }
  // YYYY-Q1 format
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const year = parseInt(period.substring(0, 4));
    const quarter = parseInt(period.substring(6));
    return { year, quarter, type: 'QUARTER' };
  }
  // YYYY format
  if (/^\d{4}$/.test(period)) {
    return { year: parseInt(period), type: 'YEAR' };
  }
  throw new Error(`Invalid period format: ${period}`);
}

/**
 * Lấy kỳ trước đó
 */
export function getPreviousPeriod(period: string): string {
  const parsed = parsePeriodString(period);

  if (parsed.type === 'MONTH' && parsed.month) {
    if (parsed.month === 1) {
      return createPeriodString(parsed.year - 1, 12);
    }
    return createPeriodString(parsed.year, parsed.month - 1);
  }

  if (parsed.type === 'QUARTER' && parsed.quarter) {
    if (parsed.quarter === 1) {
      return createPeriodString(parsed.year - 1, undefined, 4);
    }
    return createPeriodString(parsed.year, undefined, parsed.quarter - 1);
  }

  if (parsed.type === 'YEAR') {
    return String(parsed.year - 1);
  }

  return period;
}

/**
 * Lấy kỳ tiếp theo
 */
export function getNextPeriod(period: string): string {
  const parsed = parsePeriodString(period);

  if (parsed.type === 'MONTH' && parsed.month) {
    if (parsed.month === 12) {
      return createPeriodString(parsed.year + 1, 1);
    }
    return createPeriodString(parsed.year, parsed.month + 1);
  }

  if (parsed.type === 'QUARTER' && parsed.quarter) {
    if (parsed.quarter === 4) {
      return createPeriodString(parsed.year + 1, undefined, 1);
    }
    return createPeriodString(parsed.year, undefined, parsed.quarter + 1);
  }

  if (parsed.type === 'YEAR') {
    return String(parsed.year + 1);
  }

  return period;
}

/**
 * Format period để hiển thị
 */
export function formatPeriodLabel(period: string): string {
  const parsed = parsePeriodString(period);

  if (parsed.type === 'MONTH' && parsed.month) {
    return `Tháng ${parsed.month}/${parsed.year}`;
  }

  if (parsed.type === 'QUARTER' && parsed.quarter) {
    return `Quý ${parsed.quarter}/${parsed.year}`;
  }

  return `Năm ${parsed.year}`;
}

/**
 * Kiểm tra xem có thể khóa kỳ không
 */
export function canLockPeriod(checklist: PeriodLockChecklist): boolean {
  return checklist.checks
    .filter(c => c.severity === 'REQUIRED')
    .every(c => c.passed);
}

/**
 * Lấy danh sách tháng trong năm
 */
export function getMonthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => createPeriodString(year, i + 1));
}

/**
 * Lấy danh sách quý trong năm
 */
export function getQuartersInYear(year: number): string[] {
  return Array.from({ length: 4 }, (_, i) => createPeriodString(year, undefined, i + 1));
}

/**
 * Kiểm tra period có thuộc kỳ khóa không
 */
export function isDateInLockedPeriod(date: Date, lockedPeriods: PeriodLock[]): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const periodString = createPeriodString(year, month);

  return lockedPeriods.some(p =>
    p.period === periodString &&
    (p.status === 'LOCKED' || p.status === 'CLOSED')
  );
}

/**
 * Role có quyền khóa sổ
 */
export const LOCK_ALLOWED_ROLES = ['CHIEF_ACCOUNTANT', 'ADMIN'];

/**
 * Role có quyền mở khóa sổ
 */
export const UNLOCK_ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Kiểm tra quyền khóa sổ
 */
export function canUserLockPeriod(userRole: string): boolean {
  return LOCK_ALLOWED_ROLES.includes(userRole);
}

/**
 * Kiểm tra quyền mở khóa sổ
 */
export function canUserUnlockPeriod(userRole: string): boolean {
  return UNLOCK_ALLOWED_ROLES.includes(userRole);
}
