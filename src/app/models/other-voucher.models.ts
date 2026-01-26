/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CHỨNG TỪ KHÁC - OTHER VOUCHERS
 * Bút toán điều chỉnh, kết chuyển, phân bổ
 * Theo Thông tư 133/2016/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại chứng từ khác
 */
export type OtherVoucherType =
  | 'ADJUSTMENT'       // Bút toán điều chỉnh
  | 'TRANSFER'         // Kết chuyển
  | 'DEPRECIATION'     // Khấu hao TSCĐ
  | 'AMORTIZATION'     // Phân bổ CCDC
  | 'ALLOCATION'       // Phân bổ chi phí
  | 'CLOSING'          // Kết chuyển cuối kỳ
  | 'OPENING'          // Số dư đầu kỳ
  | 'OTHER';           // Khác

/**
 * Trạng thái chứng từ
 */
export type OtherVoucherStatus =
  | 'DRAFT'            // Nháp
  | 'POSTED'           // Đã ghi sổ
  | 'CANCELLED';       // Đã hủy

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dòng bút toán
 */
export interface VoucherEntry {
  id: string;
  lineNo: number;
  accountCode: string;          // Mã tài khoản
  accountName?: string;         // Tên tài khoản
  description: string;          // Diễn giải
  debitAmount: number;          // Số tiền Nợ
  creditAmount: number;         // Số tiền Có
  partnerId?: string;           // Mã đối tượng (KH/NCC)
  partnerName?: string;         // Tên đối tượng
  departmentId?: string;        // Mã phòng ban
  projectId?: string;           // Mã dự án
}

/**
 * Chứng từ khác
 */
export interface OtherVoucher {
  id: string;
  voucherType: OtherVoucherType;
  voucherNo: string;            // Số chứng từ: CT001
  voucherDate: Date;            // Ngày chứng từ
  postingDate?: Date;           // Ngày hạch toán

  // Nội dung
  description: string;          // Diễn giải chung
  reason?: string;              // Lý do

  // Chi tiết bút toán
  entries: VoucherEntry[];

  // Tổng tiền (phải cân đối Nợ = Có)
  totalDebit: number;
  totalCredit: number;

  // Chứng từ gốc đính kèm
  attachments?: string[];
  originalVoucherNo?: string;
  originalVoucherDate?: Date;

  // Trạng thái
  status: OtherVoucherStatus;

  // Người thực hiện
  preparedBy: string;
  preparedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Filter
 */
export interface OtherVoucherFilter {
  search?: string;
  voucherType?: OtherVoucherType;
  status?: OtherVoucherStatus;
  fromDate?: Date;
  toDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const OTHER_VOUCHER_TYPES: { value: OtherVoucherType; label: string; description: string }[] = [
  { value: 'ADJUSTMENT', label: 'Bút toán điều chỉnh', description: 'Điều chỉnh số liệu sai sót' },
  { value: 'TRANSFER', label: 'Kết chuyển', description: 'Kết chuyển số dư tài khoản' },
  { value: 'DEPRECIATION', label: 'Khấu hao TSCĐ', description: 'Trích khấu hao tài sản cố định' },
  { value: 'AMORTIZATION', label: 'Phân bổ CCDC', description: 'Phân bổ công cụ dụng cụ' },
  { value: 'ALLOCATION', label: 'Phân bổ chi phí', description: 'Phân bổ chi phí cho đối tượng' },
  { value: 'CLOSING', label: 'Kết chuyển cuối kỳ', description: 'Kết chuyển doanh thu, chi phí' },
  { value: 'OPENING', label: 'Số dư đầu kỳ', description: 'Nhập số dư đầu kỳ' },
  { value: 'OTHER', label: 'Khác', description: 'Các bút toán khác' }
];

export const OTHER_VOUCHER_STATUSES: { value: OtherVoucherStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'POSTED', label: 'Đã ghi sổ' },
  { value: 'CANCELLED', label: 'Đã hủy' }
];

/**
 * Mẫu bút toán phổ biến
 */
export const COMMON_ENTRIES = {
  // Kết chuyển doanh thu
  REVENUE_CLOSING: [
    { debit: '511', credit: '911', description: 'Kết chuyển doanh thu bán hàng' },
    { debit: '515', credit: '911', description: 'Kết chuyển doanh thu tài chính' },
    { debit: '711', credit: '911', description: 'Kết chuyển thu nhập khác' }
  ],
  // Kết chuyển chi phí
  EXPENSE_CLOSING: [
    { debit: '911', credit: '632', description: 'Kết chuyển giá vốn hàng bán' },
    { debit: '911', credit: '641', description: 'Kết chuyển chi phí bán hàng' },
    { debit: '911', credit: '642', description: 'Kết chuyển chi phí QLDN' },
    { debit: '911', credit: '635', description: 'Kết chuyển chi phí tài chính' },
    { debit: '911', credit: '811', description: 'Kết chuyển chi phí khác' }
  ],
  // Khấu hao TSCĐ
  DEPRECIATION: [
    { debit: '6274', credit: '214', description: 'Khấu hao TSCĐ sản xuất' },
    { debit: '6414', credit: '214', description: 'Khấu hao TSCĐ bán hàng' },
    { debit: '6424', credit: '214', description: 'Khấu hao TSCĐ quản lý' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateOtherVoucherNo(sequence: number, year?: number): string {
  const yr = year || new Date().getFullYear();
  return `CT${yr}${String(sequence).padStart(5, '0')}`;
}

export function validateOtherVoucher(voucher: Partial<OtherVoucher>): string[] {
  const errors: string[] = [];

  if (!voucher.voucherDate) {
    errors.push('Ngày chứng từ là bắt buộc');
  }

  if (!voucher.description?.trim()) {
    errors.push('Diễn giải là bắt buộc');
  }

  if (!voucher.entries || voucher.entries.length === 0) {
    errors.push('Phải có ít nhất một dòng bút toán');
  } else {
    // Validate each entry
    voucher.entries.forEach((entry, idx) => {
      if (!entry.accountCode) {
        errors.push(`Dòng ${idx + 1}: Tài khoản là bắt buộc`);
      }
      if (entry.debitAmount === 0 && entry.creditAmount === 0) {
        errors.push(`Dòng ${idx + 1}: Phải có số tiền Nợ hoặc Có`);
      }
      if (entry.debitAmount > 0 && entry.creditAmount > 0) {
        errors.push(`Dòng ${idx + 1}: Không thể vừa có Nợ vừa có Có trên cùng một dòng`);
      }
    });

    // Check balance
    const totalDebit = voucher.entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
    const totalCredit = voucher.entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Bút toán không cân đối: Nợ = ${totalDebit}, Có = ${totalCredit}`);
    }
  }

  return errors;
}

export function calculateTotals(entries: VoucherEntry[]): { totalDebit: number; totalCredit: number } {
  return {
    totalDebit: entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0),
    totalCredit: entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0)
  };
}

export function isBalanced(entries: VoucherEntry[]): boolean {
  const { totalDebit, totalCredit } = calculateTotals(entries);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}
