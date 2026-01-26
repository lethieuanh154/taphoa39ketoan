/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GIAO DỊCH NGÂN HÀNG - BANK TRANSACTIONS
 * Quản lý các giao dịch tiền gửi ngân hàng TK 112
 * Theo Thông tư 133/2016/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại giao dịch ngân hàng
 */
export type BankTransactionType =
  | 'DEPOSIT'           // Nộp tiền vào TK
  | 'WITHDRAW'          // Rút tiền từ TK
  | 'TRANSFER_IN'       // Chuyển khoản đến
  | 'TRANSFER_OUT'      // Chuyển khoản đi
  | 'BANK_FEE'          // Phí ngân hàng
  | 'INTEREST'          // Lãi tiền gửi
  | 'PAYMENT'           // Thanh toán cho NCC
  | 'COLLECTION'        // Thu tiền từ KH
  | 'SALARY'            // Chi lương
  | 'TAX_PAYMENT'       // Nộp thuế
  | 'OTHER';            // Khác

/**
 * Trạng thái giao dịch
 */
export type BankTransactionStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Giao dịch ngân hàng
 */
export interface BankTransaction {
  id: string;
  transactionNo: string;        // Số chứng từ: UNC-001, BC-001
  transactionDate: Date;

  // Tài khoản ngân hàng
  bankAccountId: string;
  bankAccountNo: string;
  bankName: string;

  // Loại giao dịch
  transactionType: BankTransactionType;
  isCredit: boolean;            // true: Ghi có (thu), false: Ghi nợ (chi)

  // Số tiền
  amount: number;
  currency: string;
  exchangeRate?: number;        // Tỷ giá nếu ngoại tệ
  amountInVND?: number;         // Quy đổi VND

  // Đối tác
  counterpartyType?: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'TAX' | 'BANK' | 'OTHER';
  counterpartyId?: string;
  counterpartyName?: string;
  counterpartyBank?: string;
  counterpartyAccountNo?: string;

  // Nội dung
  description: string;
  referenceNo?: string;         // Số tham chiếu NH

  // Kế toán
  debitAccount: string;         // TK Nợ
  creditAccount: string;        // TK Có

  // Chứng từ liên quan
  relatedVoucherId?: string;
  relatedVoucherNo?: string;
  relatedVoucherType?: string;

  // Trạng thái
  status: BankTransactionStatus;

  // Audit
  createdAt: Date;
  createdBy: string;
  postedAt?: Date;
  postedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
}

/**
 * Bank Book Line (Dòng sổ tiền gửi NH)
 */
export interface BankBookLine {
  date: Date;
  transactionNo: string;
  transactionType: BankTransactionType;
  description: string;
  counterpartyName?: string;
  debitAmount: number;          // Thu vào
  creditAmount: number;         // Chi ra
  balance: number;
  transactionId?: string;
  referenceNo?: string;
}

/**
 * Bank Book Summary
 */
export interface BankBookSummary {
  bankAccountId: string;
  bankAccountNo: string;
  bankName: string;
  currency: string;
  openingBalance: number;
  totalDebit: number;           // Tổng thu
  totalCredit: number;          // Tổng chi
  closingBalance: number;
  transactionCount: number;
}

/**
 * Filter
 */
export interface BankTransactionFilter {
  bankAccountId?: string;
  transactionType?: BankTransactionType;
  status?: BankTransactionStatus;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const BANK_TRANSACTION_TYPES: { value: BankTransactionType; label: string; isCredit: boolean }[] = [
  { value: 'DEPOSIT', label: 'Nộp tiền', isCredit: true },
  { value: 'WITHDRAW', label: 'Rút tiền', isCredit: false },
  { value: 'TRANSFER_IN', label: 'Chuyển khoản đến', isCredit: true },
  { value: 'TRANSFER_OUT', label: 'Chuyển khoản đi', isCredit: false },
  { value: 'COLLECTION', label: 'Thu tiền khách hàng', isCredit: true },
  { value: 'PAYMENT', label: 'Thanh toán NCC', isCredit: false },
  { value: 'SALARY', label: 'Chi lương', isCredit: false },
  { value: 'TAX_PAYMENT', label: 'Nộp thuế', isCredit: false },
  { value: 'INTEREST', label: 'Lãi tiền gửi', isCredit: true },
  { value: 'BANK_FEE', label: 'Phí ngân hàng', isCredit: false },
  { value: 'OTHER', label: 'Khác', isCredit: false }
];

export const BANK_TRANSACTION_STATUSES: { value: BankTransactionStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'POSTED', label: 'Đã ghi sổ' },
  { value: 'CANCELLED', label: 'Đã hủy' }
];

/**
 * Định khoản mặc định theo loại giao dịch
 */
export const DEFAULT_ENTRIES: { [key in BankTransactionType]: { debit: string; credit: string } } = {
  'DEPOSIT': { debit: '1121', credit: '1111' },           // Nộp tiền mặt vào NH
  'WITHDRAW': { debit: '1111', credit: '1121' },          // Rút tiền mặt từ NH
  'TRANSFER_IN': { debit: '1121', credit: '1121' },       // CK từ TK khác
  'TRANSFER_OUT': { debit: '1121', credit: '1121' },      // CK sang TK khác
  'COLLECTION': { debit: '1121', credit: '131' },         // Thu nợ KH
  'PAYMENT': { debit: '331', credit: '1121' },            // Trả nợ NCC
  'SALARY': { debit: '334', credit: '1121' },             // Chi lương
  'TAX_PAYMENT': { debit: '333', credit: '1121' },        // Nộp thuế
  'INTEREST': { debit: '1121', credit: '515' },           // Lãi tiền gửi
  'BANK_FEE': { debit: '6425', credit: '1121' },          // Phí NH
  'OTHER': { debit: '1121', credit: '1121' }              // Khác
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateTransactionNo(type: BankTransactionType, date: Date): string {
  const prefix = type === 'TRANSFER_OUT' || type === 'PAYMENT' || type === 'SALARY' || type === 'TAX_PAYMENT' || type === 'BANK_FEE' || type === 'WITHDRAW'
    ? 'BC'   // Báo có (chi ra)
    : 'BN';  // Báo nợ (thu vào)
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${dateStr}-${random}`;
}

export function getTransactionTypeLabel(type: BankTransactionType): string {
  return BANK_TRANSACTION_TYPES.find(t => t.value === type)?.label || 'Khác';
}

export function isDebitTransaction(type: BankTransactionType): boolean {
  return BANK_TRANSACTION_TYPES.find(t => t.value === type)?.isCredit ?? false;
}

export function validateBankTransaction(transaction: Partial<BankTransaction>): string[] {
  const errors: string[] = [];
  if (!transaction.bankAccountId) errors.push('Tài khoản ngân hàng là bắt buộc');
  if (!transaction.transactionDate) errors.push('Ngày giao dịch là bắt buộc');
  if (!transaction.transactionType) errors.push('Loại giao dịch là bắt buộc');
  if (!transaction.amount || transaction.amount <= 0) errors.push('Số tiền phải lớn hơn 0');
  if (!transaction.description?.trim()) errors.push('Diễn giải là bắt buộc');
  return errors;
}
