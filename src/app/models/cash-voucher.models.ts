/**
 * PHIẾU THU / PHIẾU CHI - CASH VOUCHERS
 *
 * Theo Thông tư 133/2016/TT-BTC
 * Chứng từ kế toán gốc - Nghiệp vụ thu chi tiền mặt
 *
 * NGHIỆP VỤ:
 * - Phiếu thu: Thu tiền mặt từ KH, thu hồi tạm ứng, thu khác
 * - Phiếu chi: Chi mua hàng, chi lương, chi phí, chi khác
 *
 * BÚT TOÁN:
 * - Phiếu thu: Nợ 111 / Có 131, 511, 711...
 * - Phiếu chi: Nợ 331, 156, 642... / Có 111
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại phiếu
 */
export type VoucherType = 'RECEIPT' | 'PAYMENT'; // Thu / Chi

/**
 * Trạng thái phiếu
 */
export type VoucherStatus =
  | 'DRAFT'      // Nháp - chưa ghi sổ
  | 'POSTED'     // Đã ghi sổ
  | 'CANCELLED'; // Đã hủy

/**
 * Phương thức thanh toán
 */
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';

/**
 * Đối tượng liên quan
 */
export type RelatedObjectType =
  | 'CUSTOMER'    // Khách hàng
  | 'SUPPLIER'    // Nhà cung cấp
  | 'EMPLOYEE'    // Nhân viên
  | 'OTHER';      // Khác

/**
 * Một dòng chi tiết phiếu thu/chi
 */
export interface VoucherLine {
  id: string;
  lineNo: number;                // Số thứ tự dòng
  description: string;           // Diễn giải chi tiết
  accountCode: string;           // Tài khoản đối ứng
  accountName?: string;          // Tên tài khoản
  amount: number;                // Số tiền
  taxCode?: string;              // Mã thuế (nếu có)
  taxRate?: number;              // Thuế suất
  taxAmount?: number;            // Tiền thuế
}

/**
 * Phiếu thu / Phiếu chi
 */
export interface CashVoucher {
  id: string;
  voucherType: VoucherType;      // Thu / Chi
  voucherNo: string;             // Số phiếu: PT001, PC001
  voucherDate: Date;             // Ngày phiếu
  postingDate?: Date;            // Ngày ghi sổ

  // Đối tượng
  relatedObjectType: RelatedObjectType;
  relatedObjectId?: string;      // ID đối tượng
  relatedObjectCode?: string;    // Mã đối tượng
  relatedObjectName: string;     // Tên đối tượng (bắt buộc)
  address?: string;              // Địa chỉ

  // Nội dung
  reason: string;                // Lý do thu/chi
  description?: string;          // Diễn giải

  // Phương thức
  paymentMethod: PaymentMethod;
  cashAccountCode: string;       // TK tiền: 111, 1111, 1112

  // Chi tiết
  lines: VoucherLine[];

  // Tổng tiền
  totalAmount: number;           // Tổng tiền
  totalTaxAmount: number;        // Tổng tiền thuế
  grandTotal: number;            // Tổng cộng

  // Chữ (viết bằng chữ)
  amountInWords?: string;

  // Trạng thái
  status: VoucherStatus;

  // Người thực hiện
  receiverName?: string;         // Người nộp/nhận tiền
  receiverId?: string;           // CMND/CCCD

  // Chứng từ gốc
  originalVoucherNo?: string;    // Số chứng từ gốc (hóa đơn, hợp đồng...)
  originalVoucherDate?: Date;

  // Phê duyệt
  preparedBy: string;            // Người lập phiếu
  preparedAt: Date;
  approvedBy?: string;           // Kế toán trưởng
  approvedAt?: Date;
  postedBy?: string;             // Người ghi sổ
  postedAt?: Date;
  cancelledBy?: string;          // Người hủy
  cancelledAt?: Date;
  cancelReason?: string;         // Lý do hủy

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Filter tìm kiếm phiếu thu/chi
 */
export interface VoucherFilter {
  voucherType?: VoucherType;
  status?: VoucherStatus;
  fromDate?: Date;
  toDate?: Date;
  relatedObjectType?: RelatedObjectType;
  relatedObjectId?: string;
  search?: string;               // Tìm theo số phiếu, tên đối tượng
  cashAccountCode?: string;      // Lọc theo TK tiền
}

/**
 * DTO tạo phiếu mới
 */
export interface CreateVoucherDTO {
  voucherType: VoucherType;
  voucherDate: Date;
  relatedObjectType: RelatedObjectType;
  relatedObjectId?: string;
  relatedObjectCode?: string;
  relatedObjectName: string;
  address?: string;
  reason: string;
  description?: string;
  paymentMethod: PaymentMethod;
  cashAccountCode: string;
  lines: Omit<VoucherLine, 'id'>[];
  receiverName?: string;
  receiverId?: string;
  originalVoucherNo?: string;
  originalVoucherDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prefix số phiếu
 */
export const VOUCHER_PREFIX = {
  RECEIPT: 'PT',   // Phiếu thu
  PAYMENT: 'PC'    // Phiếu chi
};

/**
 * Tài khoản tiền mặt
 */
export const CASH_ACCOUNTS = [
  { code: '1111', name: 'Tiền mặt VNĐ' },
  { code: '1112', name: 'Tiền mặt ngoại tệ' }
];

/**
 * Tài khoản ngân hàng
 */
export const BANK_ACCOUNTS = [
  { code: '1121', name: 'Tiền gửi NH - VNĐ' },
  { code: '1122', name: 'Tiền gửi NH - Ngoại tệ' }
];

/**
 * Lý do thu tiền phổ biến
 */
export const RECEIPT_REASONS = [
  'Thu tiền bán hàng',
  'Thu tiền khách hàng trả nợ',
  'Thu hồi tạm ứng',
  'Thu tiền lãi tiền gửi',
  'Thu tiền hoàn thuế',
  'Thu tiền khác'
];

/**
 * Lý do chi tiền phổ biến
 */
export const PAYMENT_REASONS = [
  'Chi mua hàng hóa',
  'Chi trả nợ nhà cung cấp',
  'Chi tạm ứng cho nhân viên',
  'Chi lương nhân viên',
  'Chi phí văn phòng',
  'Chi phí điện nước',
  'Chi phí thuê mặt bằng',
  'Chi nộp thuế',
  'Chi phí khác'
];

/**
 * TK đối ứng phổ biến - Phiếu thu
 */
export const RECEIPT_CONTRA_ACCOUNTS = [
  { code: '131', name: 'Phải thu khách hàng', description: 'Thu tiền KH trả nợ' },
  { code: '5111', name: 'DT bán hàng hóa', description: 'Thu tiền bán hàng' },
  { code: '5112', name: 'DT bán thành phẩm', description: 'Thu tiền bán thành phẩm' },
  { code: '5113', name: 'DT cung cấp dịch vụ', description: 'Thu tiền dịch vụ' },
  { code: '141', name: 'Tạm ứng', description: 'Thu hồi tạm ứng' },
  { code: '515', name: 'DT hoạt động TC', description: 'Thu lãi tiền gửi' },
  { code: '711', name: 'Thu nhập khác', description: 'Thu nhập khác' }
];

/**
 * TK đối ứng phổ biến - Phiếu chi
 */
export const PAYMENT_CONTRA_ACCOUNTS = [
  { code: '331', name: 'Phải trả người bán', description: 'Chi trả nợ NCC' },
  { code: '156', name: 'Hàng hóa', description: 'Chi mua hàng hóa' },
  { code: '152', name: 'Nguyên liệu, vật liệu', description: 'Chi mua NVL' },
  { code: '153', name: 'Công cụ, dụng cụ', description: 'Chi mua CCDC' },
  { code: '141', name: 'Tạm ứng', description: 'Chi tạm ứng' },
  { code: '334', name: 'Phải trả NLĐ', description: 'Chi lương' },
  { code: '6421', name: 'CP nhân viên', description: 'Chi phí nhân viên' },
  { code: '6422', name: 'CP vật liệu', description: 'Chi phí vật liệu' },
  { code: '6427', name: 'CP dịch vụ mua ngoài', description: 'Chi phí dịch vụ' },
  { code: '6428', name: 'CP bằng tiền khác', description: 'Chi phí khác' },
  { code: '333', name: 'Thuế phải nộp', description: 'Chi nộp thuế' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tạo số phiếu tự động
 */
export function generateVoucherNo(type: VoucherType, sequence: number, year?: number): string {
  const prefix = VOUCHER_PREFIX[type];
  const yr = year || new Date().getFullYear();
  const seq = String(sequence).padStart(5, '0');
  return `${prefix}${yr}${seq}`;
}

/**
 * Tính tổng tiền các dòng
 */
export function calculateVoucherTotals(lines: VoucherLine[]): {
  totalAmount: number;
  totalTaxAmount: number;
  grandTotal: number;
} {
  let totalAmount = 0;
  let totalTaxAmount = 0;

  lines.forEach(line => {
    totalAmount += line.amount;
    totalTaxAmount += line.taxAmount || 0;
  });

  return {
    totalAmount,
    totalTaxAmount,
    grandTotal: totalAmount + totalTaxAmount
  };
}

/**
 * Chuyển số thành chữ (VNĐ)
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Không đồng';

  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

  const readThreeDigits = (n: number): string => {
    if (n === 0) return '';

    let result = '';
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const one = n % 10;

    if (hundred > 0) {
      result += ones[hundred] + ' trăm ';
    }

    if (ten > 1) {
      result += tens[ten] + ' ';
      if (one === 1) {
        result += 'mốt ';
      } else if (one === 5) {
        result += 'lăm ';
      } else if (one > 0) {
        result += ones[one] + ' ';
      }
    } else if (ten === 1) {
      result += 'mười ';
      if (one === 5) {
        result += 'lăm ';
      } else if (one > 0) {
        result += ones[one] + ' ';
      }
    } else if (ten === 0 && hundred > 0 && one > 0) {
      result += 'lẻ ' + ones[one] + ' ';
    } else if (one > 0) {
      result += ones[one] + ' ';
    }

    return result.trim();
  };

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  let result = '';
  let unitIndex = 0;

  while (num > 0) {
    const threeDigits = num % 1000;
    if (threeDigits > 0) {
      const words = readThreeDigits(threeDigits);
      result = words + ' ' + units[unitIndex] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    unitIndex++;
  }

  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

/**
 * Validate phiếu thu/chi
 */
export function validateVoucher(voucher: Partial<CashVoucher>): string[] {
  const errors: string[] = [];

  if (!voucher.voucherDate) {
    errors.push('Ngày phiếu là bắt buộc');
  }

  if (!voucher.relatedObjectName) {
    errors.push('Tên đối tượng là bắt buộc');
  }

  if (!voucher.reason) {
    errors.push('Lý do thu/chi là bắt buộc');
  }

  if (!voucher.cashAccountCode) {
    errors.push('Tài khoản tiền là bắt buộc');
  }

  if (!voucher.lines || voucher.lines.length === 0) {
    errors.push('Phải có ít nhất một dòng chi tiết');
  } else {
    voucher.lines.forEach((line, idx) => {
      if (!line.accountCode) {
        errors.push(`Dòng ${idx + 1}: Tài khoản đối ứng là bắt buộc`);
      }
      if (!line.amount || line.amount <= 0) {
        errors.push(`Dòng ${idx + 1}: Số tiền phải lớn hơn 0`);
      }
    });
  }

  return errors;
}

/**
 * Tạo bút toán từ phiếu thu/chi
 */
export interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

export function generateJournalEntry(voucher: CashVoucher): JournalEntryLine[] {
  const entries: JournalEntryLine[] = [];

  if (voucher.voucherType === 'RECEIPT') {
    // Phiếu thu: Nợ TK tiền
    entries.push({
      accountCode: voucher.cashAccountCode,
      accountName: 'Tiền mặt',
      debitAmount: voucher.grandTotal,
      creditAmount: 0,
      description: voucher.reason
    });

    // Có các TK đối ứng
    voucher.lines.forEach(line => {
      entries.push({
        accountCode: line.accountCode,
        accountName: line.accountName || '',
        debitAmount: 0,
        creditAmount: line.amount + (line.taxAmount || 0),
        description: line.description
      });
    });
  } else {
    // Phiếu chi: Nợ các TK đối ứng
    voucher.lines.forEach(line => {
      entries.push({
        accountCode: line.accountCode,
        accountName: line.accountName || '',
        debitAmount: line.amount,
        creditAmount: 0,
        description: line.description
      });

      // Thuế GTGT đầu vào (nếu có)
      if (line.taxAmount && line.taxAmount > 0) {
        entries.push({
          accountCode: '1331',
          accountName: 'Thuế GTGT được khấu trừ',
          debitAmount: line.taxAmount,
          creditAmount: 0,
          description: `Thuế GTGT - ${line.description}`
        });
      }
    });

    // Có TK tiền
    entries.push({
      accountCode: voucher.cashAccountCode,
      accountName: 'Tiền mặt',
      debitAmount: 0,
      creditAmount: voucher.grandTotal,
      description: voucher.reason
    });
  }

  return entries;
}
