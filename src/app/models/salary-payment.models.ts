/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * THANH TOÁN LƯƠNG - SALARY PAYMENT
 * Nợ TK 334 / Có TK 111, 112
 * Theo Thông tư 133/2016/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type SalaryPaymentStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chi tiết thanh toán từng nhân viên
 */
export interface SalaryPaymentLine {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department?: string;

  // Từ bảng lương
  netSalary: number;          // Thực lĩnh theo bảng lương
  advanceAmount: number;       // Tạm ứng đã nhận
  remainingAmount: number;     // Còn phải trả = netSalary - advanceAmount

  // Thanh toán kỳ này
  paymentAmount: number;       // Số tiền thanh toán
  paymentMethod: PaymentMethod;
  bankAccountNo?: string;      // Số TK ngân hàng (nếu CK)
  bankName?: string;           // Tên ngân hàng

  // Ghi chú
  notes?: string;
}

/**
 * Phiếu thanh toán lương
 */
export interface SalaryPayment {
  id: string;
  paymentNo: string;          // CTL-2025010001
  paymentDate: Date;

  // Liên kết bảng lương
  payrollId: string;
  payrollNo: string;
  payrollMonth: number;
  payrollYear: number;

  // Chi tiết
  lines: SalaryPaymentLine[];

  // Tổng hợp
  summary: SalaryPaymentSummary;

  // Phương thức chính
  primaryMethod: PaymentMethod;
  bankAccountId?: string;     // TK ngân hàng công ty

  // Trạng thái
  status: SalaryPaymentStatus;

  // Kế toán
  debitAccount: string;       // TK 334
  creditAccount: string;      // TK 111 hoặc 112

  // Audit
  createdAt: Date;
  createdBy: string;
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  paidBy?: string;
  notes?: string;
}

/**
 * Tổng hợp thanh toán
 */
export interface SalaryPaymentSummary {
  employeeCount: number;
  totalNetSalary: number;
  totalAdvance: number;
  totalRemaining: number;
  totalPayment: number;
  cashPayment: number;
  bankTransfer: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' }
];

export const SALARY_PAYMENT_STATUSES: { value: SalaryPaymentStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'PAID', label: 'Đã chi' },
  { value: 'CANCELLED', label: 'Đã hủy' }
];

export const SALARY_PAYMENT_ACCOUNTS = {
  salary: '334',              // Nợ: Phải trả người lao động
  cash: '111',               // Có: Tiền mặt
  bank: '112'                // Có: Tiền gửi ngân hàng
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generatePaymentNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `CTL-${year}${month}${String(sequence).padStart(4, '0')}`;
}

export function calculatePaymentSummary(lines: SalaryPaymentLine[]): SalaryPaymentSummary {
  return {
    employeeCount: lines.length,
    totalNetSalary: lines.reduce((sum, l) => sum + l.netSalary, 0),
    totalAdvance: lines.reduce((sum, l) => sum + l.advanceAmount, 0),
    totalRemaining: lines.reduce((sum, l) => sum + l.remainingAmount, 0),
    totalPayment: lines.reduce((sum, l) => sum + l.paymentAmount, 0),
    cashPayment: lines.filter(l => l.paymentMethod === 'CASH').reduce((sum, l) => sum + l.paymentAmount, 0),
    bankTransfer: lines.filter(l => l.paymentMethod === 'BANK_TRANSFER').reduce((sum, l) => sum + l.paymentAmount, 0)
  };
}
