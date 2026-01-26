/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DANH MỤC NGÂN HÀNG - BANK MASTER
 * Quản lý thông tin ngân hàng và tài khoản ngân hàng của doanh nghiệp
 * Theo Thông tư 133/2016/TT-BTC - TK 112
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại tài khoản ngân hàng
 */
export type BankAccountType =
  | 'CHECKING'        // Tài khoản thanh toán
  | 'SAVINGS'         // Tài khoản tiết kiệm
  | 'DEPOSIT'         // Tài khoản tiền gửi có kỳ hạn
  | 'LOAN';           // Tài khoản vay

/**
 * Loại tiền tệ
 */
export type Currency = 'VND' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'OTHER';

/**
 * Trạng thái tài khoản
 */
export type BankAccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ngân hàng (danh mục ngân hàng)
 */
export interface Bank {
  id: string;
  code: string;               // Mã NH: VCB, TCB, BIDV
  name: string;               // Tên đầy đủ
  shortName: string;          // Tên viết tắt
  swiftCode?: string;         // SWIFT/BIC code
  bin?: string;               // Bank Identification Number (Napas)
  logo?: string;              // URL logo
  isActive: boolean;
}

/**
 * Tài khoản ngân hàng của doanh nghiệp
 */
export interface BankAccount {
  id: string;
  bankId: string;             // ID ngân hàng
  bankCode: string;           // Mã NH
  bankName: string;           // Tên NH

  accountNo: string;          // Số tài khoản
  accountName: string;        // Tên chủ TK (tên DN)
  accountType: BankAccountType;
  currency: Currency;

  branch?: string;            // Chi nhánh
  branchAddress?: string;     // Địa chỉ chi nhánh

  // Số dư
  openingBalance: number;     // Số dư đầu kỳ
  currentBalance: number;     // Số dư hiện tại

  // Kế toán
  glAccount: string;          // TK kế toán: 1121, 1122

  // Thông tin bổ sung
  contactPerson?: string;     // Người liên hệ tại NH
  contactPhone?: string;

  // Internet Banking
  ibUsername?: string;        // Username IB
  ibStatus?: 'ACTIVE' | 'INACTIVE';

  // Trạng thái
  status: BankAccountStatus;
  isDefault: boolean;         // TK mặc định

  // Ghi chú
  notes?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Filter
 */
export interface BankAccountFilter {
  search?: string;
  bankId?: string;
  accountType?: BankAccountType;
  currency?: Currency;
  status?: BankAccountStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const BANK_ACCOUNT_TYPES: { value: BankAccountType; label: string }[] = [
  { value: 'CHECKING', label: 'Tài khoản thanh toán' },
  { value: 'SAVINGS', label: 'Tài khoản tiết kiệm' },
  { value: 'DEPOSIT', label: 'Tiền gửi có kỳ hạn' },
  { value: 'LOAN', label: 'Tài khoản vay' }
];

export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'VND', label: 'Việt Nam Đồng', symbol: '₫' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { value: 'OTHER', label: 'Khác', symbol: '' }
];

export const BANK_ACCOUNT_STATUSES: { value: BankAccountStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngừng' },
  { value: 'CLOSED', label: 'Đã đóng' }
];

/**
 * Danh sách ngân hàng Việt Nam phổ biến
 */
export const VIETNAM_BANKS: Bank[] = [
  { id: 'bank_vcb', code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank', swiftCode: 'BFTVVNVX', bin: '970436', isActive: true },
  { id: 'bank_tcb', code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank', swiftCode: 'VTCBVNVX', bin: '970407', isActive: true },
  { id: 'bank_bidv', code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV', swiftCode: 'BIDVVNVX', bin: '970418', isActive: true },
  { id: 'bank_vtb', code: 'VTB', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank', swiftCode: 'ICBVVNVX', bin: '970415', isActive: true },
  { id: 'bank_acb', code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB', swiftCode: 'ASCBVNVX', bin: '970416', isActive: true },
  { id: 'bank_mb', code: 'MB', name: 'Ngân hàng TMCP Quân đội', shortName: 'MB Bank', swiftCode: 'MSCBVNVX', bin: '970422', isActive: true },
  { id: 'bank_vpb', code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank', swiftCode: 'VPBKVNVX', bin: '970432', isActive: true },
  { id: 'bank_shb', code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB', swiftCode: 'SHBAVNVX', bin: '970443', isActive: true },
  { id: 'bank_tpb', code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank', swiftCode: 'TPBVVNVX', bin: '970423', isActive: true },
  { id: 'bank_msb', code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', shortName: 'MSB', swiftCode: 'MCOBVNVX', bin: '970426', isActive: true },
  { id: 'bank_hdb', code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank', swiftCode: 'HABORVNX', bin: '970437', isActive: true },
  { id: 'bank_scb', code: 'SCB', name: 'Ngân hàng TMCP Sài Gòn', shortName: 'SCB', swiftCode: 'SACLVNVX', bin: '970429', isActive: true },
  { id: 'bank_ocb', code: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB', swiftCode: 'ORCOVNVX', bin: '970448', isActive: true },
  { id: 'bank_eib', code: 'EIB', name: 'Ngân hàng TMCP Xuất nhập khẩu Việt Nam', shortName: 'Eximbank', swiftCode: 'EBVIVNVX', bin: '970431', isActive: true },
  { id: 'bank_stb', code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank', swiftCode: 'SGTTVNVX', bin: '970403', isActive: true },
  { id: 'bank_agr', code: 'AGR', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank', swiftCode: 'VBAAVNVX', bin: '970405', isActive: true }
];

/**
 * TK kế toán ngân hàng
 */
export const BANK_GL_ACCOUNTS = [
  { code: '1121', name: 'Tiền gửi ngân hàng - VNĐ' },
  { code: '1122', name: 'Tiền gửi ngân hàng - Ngoại tệ' },
  { code: '1123', name: 'Tiền gửi ngân hàng - Vàng, bạc' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function validateBankAccount(account: Partial<BankAccount>): string[] {
  const errors: string[] = [];
  if (!account.bankId) errors.push('Ngân hàng là bắt buộc');
  if (!account.accountNo?.trim()) errors.push('Số tài khoản là bắt buộc');
  if (!account.accountName?.trim()) errors.push('Tên chủ tài khoản là bắt buộc');
  if (!account.glAccount?.trim()) errors.push('Tài khoản kế toán là bắt buộc');
  return errors;
}

export function formatAccountNo(accountNo: string): string {
  // Format: xxxx xxxx xxxx xxxx
  return accountNo.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function getBankByCode(code: string): Bank | undefined {
  return VIETNAM_BANKS.find(b => b.code === code);
}
