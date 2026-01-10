/**
 * AUDIT LOG - DẤU VẾT KIỂM TOÁN
 *
 * Theo Thông tư 99/2025/TT-BTC
 * Yêu cầu bắt buộc khi quyết toán thuế / kiểm toán
 *
 * NGUYÊN TẮC BẤT BIẾN:
 * - Mọi thay đổi PHẢI có dấu vết
 * - KHÔNG được xóa dữ liệu kế toán
 * - Truy vết: AI sửa, SỬA GÌ, KHI NÀO, TRƯỚC & SAU
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại đối tượng được ghi log
 */
export type AuditEntityType =
  | 'VOUCHER'           // Chứng từ kế toán
  | 'JOURNAL'           // Bút toán nhật ký
  | 'LEDGER'            // Sổ cái
  | 'TRIAL_BALANCE'     // Bảng cân đối TK
  | 'BALANCE_SHEET'     // BCĐKT
  | 'INCOME_STATEMENT'  // KQKD
  | 'CASH_FLOW'         // LCTT
  | 'PERIOD_LOCK'       // Khóa kỳ
  | 'ACCOUNT'           // Tài khoản
  | 'CUSTOMER'          // Khách hàng
  | 'SUPPLIER'          // Nhà cung cấp
  | 'EMPLOYEE'          // Nhân viên
  | 'PRODUCT';          // Hàng hóa

/**
 * Loại hành động
 * ❌ KHÔNG có DELETE - Dữ liệu kế toán không được xóa
 */
export type AuditAction =
  | 'CREATE'            // Tạo mới
  | 'UPDATE'            // Cập nhật
  | 'ADJUST'            // Điều chỉnh (bút toán điều chỉnh)
  | 'LOCK'              // Khóa kỳ
  | 'UNLOCK'            // Mở khóa kỳ (SUPER ADMIN)
  | 'APPROVE'           // Phê duyệt
  | 'REJECT'            // Từ chối
  | 'CANCEL'            // Hủy (soft delete)
  | 'RESTORE'           // Khôi phục
  | 'EXPORT'            // Xuất báo cáo
  | 'PRINT';            // In báo cáo

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bản ghi Audit Log
 */
export interface AuditLog {
  id: string;                     // ID unique
  entityType: AuditEntityType;    // Loại đối tượng
  entityId: string;               // ID bản ghi
  entityName?: string;            // Tên/số hiệu để hiển thị
  action: AuditAction;            // Hành động
  before: any | null;             // Dữ liệu TRƯỚC khi thay đổi (JSON)
  after: any | null;              // Dữ liệu SAU khi thay đổi (JSON)
  changes?: AuditChange[];        // Chi tiết các field thay đổi
  userId: string;                 // ID người thực hiện
  userName: string;               // Tên người thực hiện
  userRole: string;               // Role người thực hiện
  timestamp: Date;                // Thời điểm
  ipAddress?: string;             // IP address
  userAgent?: string;             // Browser/device info
  reason?: string;                // Lý do (bắt buộc với ADJUST, UNLOCK)
  period?: string;                // Kỳ kế toán liên quan (YYYY-MM)
  sessionId?: string;             // Session ID
}

/**
 * Chi tiết một field thay đổi
 */
export interface AuditChange {
  field: string;                  // Tên field
  fieldLabel: string;             // Label hiển thị
  oldValue: any;                  // Giá trị cũ
  newValue: any;                  // Giá trị mới
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';
}

/**
 * Filter cho Audit Log
 */
export interface AuditLogFilter {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  period?: string;
  searchText?: string;            // Tìm trong reason, entityName
}

/**
 * Response từ API
 */
export interface AuditLogResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalActions: number;
    byAction: Record<AuditAction, number>;
    byEntityType: Record<AuditEntityType, number>;
    uniqueUsers: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Labels cho Entity Type
 */
export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  'VOUCHER': 'Chứng từ kế toán',
  'JOURNAL': 'Bút toán nhật ký',
  'LEDGER': 'Sổ cái',
  'TRIAL_BALANCE': 'Bảng cân đối TK',
  'BALANCE_SHEET': 'Bảng CĐKT',
  'INCOME_STATEMENT': 'Báo cáo KQKD',
  'CASH_FLOW': 'Lưu chuyển tiền tệ',
  'PERIOD_LOCK': 'Khóa kỳ kế toán',
  'ACCOUNT': 'Tài khoản',
  'CUSTOMER': 'Khách hàng',
  'SUPPLIER': 'Nhà cung cấp',
  'EMPLOYEE': 'Nhân viên',
  'PRODUCT': 'Hàng hóa'
};

/**
 * Labels cho Action
 */
export const ACTION_LABELS: Record<AuditAction, string> = {
  'CREATE': 'Tạo mới',
  'UPDATE': 'Cập nhật',
  'ADJUST': 'Điều chỉnh',
  'LOCK': 'Khóa kỳ',
  'UNLOCK': 'Mở khóa',
  'APPROVE': 'Phê duyệt',
  'REJECT': 'Từ chối',
  'CANCEL': 'Hủy',
  'RESTORE': 'Khôi phục',
  'EXPORT': 'Xuất báo cáo',
  'PRINT': 'In báo cáo'
};

/**
 * Màu sắc cho Action
 */
export const ACTION_COLORS: Record<AuditAction, string> = {
  'CREATE': '#22c55e',    // Green
  'UPDATE': '#3b82f6',    // Blue
  'ADJUST': '#f59e0b',    // Amber
  'LOCK': '#8b5cf6',      // Purple
  'UNLOCK': '#ef4444',    // Red
  'APPROVE': '#10b981',   // Emerald
  'REJECT': '#f43f5e',    // Rose
  'CANCEL': '#6b7280',    // Gray
  'RESTORE': '#06b6d4',   // Cyan
  'EXPORT': '#64748b',    // Slate
  'PRINT': '#64748b'      // Slate
};

/**
 * Icons cho Action (FontAwesome)
 */
export const ACTION_ICONS: Record<AuditAction, string> = {
  'CREATE': 'fa-plus-circle',
  'UPDATE': 'fa-pen',
  'ADJUST': 'fa-sliders',
  'LOCK': 'fa-lock',
  'UNLOCK': 'fa-lock-open',
  'APPROVE': 'fa-check-circle',
  'REJECT': 'fa-times-circle',
  'CANCEL': 'fa-ban',
  'RESTORE': 'fa-rotate-left',
  'EXPORT': 'fa-file-export',
  'PRINT': 'fa-print'
};

/**
 * Actions yêu cầu BẮT BUỘC phải có reason
 */
export const ACTIONS_REQUIRE_REASON: AuditAction[] = [
  'ADJUST',
  'UNLOCK',
  'CANCEL',
  'REJECT'
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tạo Audit Log entry
 */
export function createAuditLog(
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  userId: string,
  userName: string,
  userRole: string,
  before: any,
  after: any,
  reason?: string
): Omit<AuditLog, 'id' | 'timestamp'> {
  // Validate: Actions yêu cầu reason
  if (ACTIONS_REQUIRE_REASON.includes(action) && !reason) {
    throw new Error(`Hành động "${ACTION_LABELS[action]}" bắt buộc phải có lý do`);
  }

  const changes = before && after ? detectChanges(before, after) : undefined;

  return {
    entityType,
    entityId,
    action,
    before,
    after,
    changes,
    userId,
    userName,
    userRole,
    reason
  };
}

/**
 * Phát hiện các thay đổi giữa 2 object
 */
export function detectChanges(before: any, after: any): AuditChange[] {
  const changes: AuditChange[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  allKeys.forEach(key => {
    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        fieldLabel: key, // TODO: Map to friendly labels
        oldValue: oldVal,
        newValue: newVal,
        dataType: detectDataType(newVal ?? oldVal)
      });
    }
  });

  return changes;
}

/**
 * Detect data type
 */
function detectDataType(value: any): AuditChange['dataType'] {
  if (value === null || value === undefined) return 'string';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Format giá trị để hiển thị trong diff
 */
export function formatAuditValue(value: any, dataType: AuditChange['dataType']): string {
  if (value === null || value === undefined) return '(trống)';

  switch (dataType) {
    case 'number':
      return new Intl.NumberFormat('vi-VN').format(value);
    case 'date':
      return new Date(value).toLocaleDateString('vi-VN');
    case 'boolean':
      return value ? 'Có' : 'Không';
    case 'array':
      return `[${value.length} mục]`;
    case 'object':
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}

/**
 * Kiểm tra action có cần reason không
 */
export function isReasonRequired(action: AuditAction): boolean {
  return ACTIONS_REQUIRE_REASON.includes(action);
}
