/**
 * HÓA ĐƠN MUA VÀO / BÁN RA - INVOICES
 *
 * Theo Thông tư 78/2021/TT-BTC - Hóa đơn điện tử
 * Nghị định 123/2020/NĐ-CP
 *
 * NGHIỆP VỤ:
 * - Hóa đơn bán ra (Output): Ghi nhận doanh thu, thuế GTGT đầu ra
 * - Hóa đơn mua vào (Input): Ghi nhận chi phí/hàng hóa, thuế GTGT đầu vào
 *
 * BÚT TOÁN:
 * - Hóa đơn bán ra: Nợ 131, 111, 112 / Có 511, 3331
 * - Hóa đơn mua vào: Nợ 156, 152, 642, 133 / Có 331, 111, 112
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại hóa đơn
 */
export type InvoiceType = 'INPUT' | 'OUTPUT'; // Mua vào / Bán ra

/**
 * Trạng thái hóa đơn
 */
export type InvoiceStatus =
  | 'DRAFT'        // Nháp
  | 'POSTED'       // Đã ghi sổ
  | 'CANCELLED'    // Đã hủy
  | 'ADJUSTED';    // Đã điều chỉnh

/**
 * Loại hóa đơn GTGT
 */
export type VATInvoiceType =
  | 'HDON'         // Hóa đơn GTGT
  | 'HDON_BL'      // Hóa đơn bán lẻ
  | 'HDON_KT'      // Hóa đơn kiêm tờ khai
  | 'HDON_XKVC';   // Hóa đơn xuất khẩu

/**
 * Phương thức thanh toán
 */
export type PaymentMethod = 'CASH' | 'BANK' | 'CREDIT' | 'MIXED';

/**
 * Thuế suất GTGT
 */
export type VATRate = 0 | 5 | 8 | 10 | -1 | -2; // -1: Không chịu thuế, -2: Không kê khai

/**
 * Một dòng chi tiết hóa đơn
 */
export interface InvoiceLine {
  id: string;
  lineNo: number;              // STT
  productCode?: string;        // Mã hàng hóa/dịch vụ
  productName: string;         // Tên hàng hóa/dịch vụ
  unit?: string;               // Đơn vị tính
  quantity: number;            // Số lượng
  unitPrice: number;           // Đơn giá
  amount: number;              // Thành tiền (chưa VAT)
  vatRate: VATRate;            // Thuế suất GTGT
  vatAmount: number;           // Tiền thuế GTGT
  totalAmount: number;         // Tổng tiền (đã VAT)
  accountCode?: string;        // TK hạch toán (chi phí/doanh thu)
  discount?: number;           // Chiết khấu (nếu có)
  note?: string;               // Ghi chú
}

/**
 * Hóa đơn
 */
export interface Invoice {
  id: string;
  invoiceType: InvoiceType;    // INPUT / OUTPUT
  vatInvoiceType: VATInvoiceType;

  // Số hiệu hóa đơn điện tử
  invoiceNo: string;           // Số hóa đơn: 00000001
  invoiceSeries: string;       // Ký hiệu: 1C24TAA (mẫu mới)
  invoiceDate: Date;           // Ngày hóa đơn
  postingDate?: Date;          // Ngày ghi sổ

  // Thông tin đối tác
  partnerId?: string;          // ID khách hàng/NCC
  partnerCode?: string;        // Mã KH/NCC
  partnerName: string;         // Tên KH/NCC
  partnerTaxCode?: string;     // MST
  partnerAddress?: string;     // Địa chỉ
  buyerName?: string;          // Người mua hàng (HĐ bán ra)

  // Chi tiết hàng hóa/dịch vụ
  lines: InvoiceLine[];

  // Tổng tiền
  totalQuantity: number;       // Tổng SL
  subTotal: number;            // Tổng tiền hàng (chưa VAT)
  totalDiscount: number;       // Tổng chiết khấu
  totalVAT: number;            // Tổng tiền thuế
  grandTotal: number;          // Tổng cộng thanh toán
  amountInWords?: string;      // Số tiền bằng chữ

  // Thanh toán
  paymentMethod: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmount: number;          // Số tiền đã thanh toán
  dueDate?: Date;              // Hạn thanh toán

  // Trạng thái
  status: InvoiceStatus;

  // HĐĐT - Mã CQT
  taxAuthCode?: string;        // Mã CQT tra cứu
  signedDate?: Date;           // Ngày ký số
  signedBy?: string;           // Người ký số

  // Hóa đơn gốc (nếu là HĐ điều chỉnh)
  originalInvoiceId?: string;
  originalInvoiceNo?: string;
  adjustmentReason?: string;

  // Chứng từ liên quan
  relatedDocNo?: string;       // Số hợp đồng, đơn hàng...

  // Audit
  preparedBy: string;
  preparedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  note?: string;
}

/**
 * Filter tìm kiếm hóa đơn
 */
export interface InvoiceFilter {
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  fromDate?: Date;
  toDate?: Date;
  partnerId?: string;
  partnerTaxCode?: string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  search?: string;             // Tìm theo số HĐ, tên đối tác
  vatRate?: VATRate;
}

/**
 * DTO tạo hóa đơn
 */
export interface CreateInvoiceDTO {
  invoiceType: InvoiceType;
  vatInvoiceType?: VATInvoiceType;
  invoiceNo?: string;
  invoiceSeries?: string;
  invoiceDate: Date;
  partnerId?: string;
  partnerCode?: string;
  partnerName: string;
  partnerTaxCode?: string;
  partnerAddress?: string;
  buyerName?: string;
  lines: Omit<InvoiceLine, 'id'>[];
  paymentMethod: PaymentMethod;
  dueDate?: Date;
  relatedDocNo?: string;
  note?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thuế suất GTGT phổ biến
 */
export const VAT_RATES: { value: VATRate; label: string }[] = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 10, label: '10%' },
  { value: -1, label: 'Không chịu thuế' },
  { value: -2, label: 'Không kê khai' }
];

/**
 * Đơn vị tính phổ biến
 */
export const COMMON_UNITS = [
  'Cái', 'Chiếc', 'Bộ', 'Hộp', 'Thùng', 'Kg', 'Gram', 'Lít', 'Mét', 'M2', 'M3',
  'Tấn', 'Chai', 'Lon', 'Gói', 'Túi', 'Cuộn', 'Tờ', 'Quyển', 'Giờ', 'Ngày', 'Tháng'
];

/**
 * TK doanh thu phổ biến (HĐ bán ra)
 */
export const REVENUE_ACCOUNTS = [
  { code: '5111', name: 'Doanh thu bán hàng hóa' },
  { code: '5112', name: 'Doanh thu bán thành phẩm' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ' },
  { code: '5118', name: 'Doanh thu khác' }
];

/**
 * TK chi phí/tài sản phổ biến (HĐ mua vào)
 */
export const EXPENSE_ACCOUNTS = [
  { code: '156', name: 'Hàng hóa' },
  { code: '1561', name: 'Giá mua hàng hóa' },
  { code: '152', name: 'Nguyên liệu, vật liệu' },
  { code: '153', name: 'Công cụ, dụng cụ' },
  { code: '6421', name: 'Chi phí nhân viên' },
  { code: '6422', name: 'Chi phí vật liệu' },
  { code: '6427', name: 'Chi phí dịch vụ mua ngoài' },
  { code: '6428', name: 'Chi phí bằng tiền khác' },
  { code: '242', name: 'Chi phí trả trước' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tính thuế GTGT từ số tiền và thuế suất
 */
export function calculateVAT(amount: number, vatRate: VATRate): number {
  if (vatRate < 0) return 0; // Không chịu thuế hoặc không kê khai
  return Math.round(amount * vatRate / 100);
}

/**
 * Tính tổng tiền một dòng
 */
export function calculateLineTotal(line: Partial<InvoiceLine>): {
  amount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const quantity = line.quantity || 0;
  const unitPrice = line.unitPrice || 0;
  const discount = line.discount || 0;
  const vatRate = line.vatRate ?? 10;

  const amount = quantity * unitPrice - discount;
  const vatAmount = calculateVAT(amount, vatRate);
  const totalAmount = amount + vatAmount;

  return { amount, vatAmount, totalAmount };
}

/**
 * Tính tổng hóa đơn
 */
export function calculateInvoiceTotals(lines: InvoiceLine[]): {
  totalQuantity: number;
  subTotal: number;
  totalDiscount: number;
  totalVAT: number;
  grandTotal: number;
} {
  let totalQuantity = 0;
  let subTotal = 0;
  let totalDiscount = 0;
  let totalVAT = 0;

  lines.forEach(line => {
    totalQuantity += line.quantity;
    subTotal += line.amount;
    totalDiscount += line.discount || 0;
    totalVAT += line.vatAmount;
  });

  return {
    totalQuantity,
    subTotal,
    totalDiscount,
    totalVAT,
    grandTotal: subTotal + totalVAT
  };
}

/**
 * Chuyển số thành chữ
 */
export function numberToWordsVN(num: number): string {
  if (num === 0) return 'Không đồng';

  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

  const readThree = (n: number): string => {
    if (n === 0) return '';
    let r = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    if (h > 0) r += ones[h] + ' trăm ';
    if (t > 1) {
      r += tens[t] + ' ';
      if (o === 1) r += 'mốt ';
      else if (o === 5) r += 'lăm ';
      else if (o > 0) r += ones[o] + ' ';
    } else if (t === 1) {
      r += 'mười ';
      if (o === 5) r += 'lăm ';
      else if (o > 0) r += ones[o] + ' ';
    } else if (h > 0 && o > 0) {
      r += 'lẻ ' + ones[o] + ' ';
    } else if (o > 0) {
      r += ones[o] + ' ';
    }
    return r.trim();
  };

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  let result = '';
  let ui = 0;
  while (num > 0) {
    const three = num % 1000;
    if (three > 0) {
      result = readThree(three) + ' ' + units[ui] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    ui++;
  }
  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

/**
 * Tạo số hóa đơn tự động
 */
export function generateInvoiceNo(sequence: number): string {
  return String(sequence).padStart(8, '0');
}

/**
 * Validate hóa đơn
 */
export function validateInvoice(invoice: Partial<Invoice>): string[] {
  const errors: string[] = [];

  if (!invoice.invoiceDate) {
    errors.push('Ngày hóa đơn là bắt buộc');
  }

  if (!invoice.partnerName) {
    errors.push('Tên đối tác là bắt buộc');
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    errors.push('Hóa đơn phải có ít nhất một dòng chi tiết');
  } else {
    invoice.lines.forEach((line, idx) => {
      if (!line.productName) {
        errors.push(`Dòng ${idx + 1}: Tên hàng hóa/dịch vụ là bắt buộc`);
      }
      if (line.quantity <= 0) {
        errors.push(`Dòng ${idx + 1}: Số lượng phải > 0`);
      }
      if (line.unitPrice < 0) {
        errors.push(`Dòng ${idx + 1}: Đơn giá không hợp lệ`);
      }
    });
  }

  return errors;
}

/**
 * Tạo bút toán từ hóa đơn
 */
export interface JournalEntry {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

export function generateJournalFromInvoice(invoice: Invoice): JournalEntry[] {
  const entries: JournalEntry[] = [];

  if (invoice.invoiceType === 'OUTPUT') {
    // === HÓA ĐƠN BÁN RA ===
    // Nợ 131 (phải thu KH) / Có 511 (DT), 3331 (VAT)

    // Nợ 131 - Tổng phải thu
    entries.push({
      accountCode: '131',
      accountName: 'Phải thu khách hàng',
      debitAmount: invoice.grandTotal,
      creditAmount: 0,
      description: `Thu tiền ${invoice.partnerName}`
    });

    // Có 511x - Doanh thu theo từng dòng
    invoice.lines.forEach(line => {
      const accountCode = line.accountCode || '5111';
      entries.push({
        accountCode,
        accountName: 'Doanh thu',
        debitAmount: 0,
        creditAmount: line.amount,
        description: line.productName
      });
    });

    // Có 3331 - Thuế GTGT đầu ra
    if (invoice.totalVAT > 0) {
      entries.push({
        accountCode: '33311',
        accountName: 'Thuế GTGT đầu ra',
        debitAmount: 0,
        creditAmount: invoice.totalVAT,
        description: 'Thuế GTGT'
      });
    }
  } else {
    // === HÓA ĐƠN MUA VÀO ===
    // Nợ 156/152/642... (hàng/chi phí), 133 (VAT) / Có 331 (phải trả NCC)

    // Nợ 156x/152/642... - Hàng hóa/chi phí theo từng dòng
    invoice.lines.forEach(line => {
      const accountCode = line.accountCode || '156';
      entries.push({
        accountCode,
        accountName: 'Hàng hóa/Chi phí',
        debitAmount: line.amount,
        creditAmount: 0,
        description: line.productName
      });
    });

    // Nợ 133 - Thuế GTGT đầu vào
    if (invoice.totalVAT > 0) {
      entries.push({
        accountCode: '1331',
        accountName: 'Thuế GTGT được khấu trừ',
        debitAmount: invoice.totalVAT,
        creditAmount: 0,
        description: 'Thuế GTGT đầu vào'
      });
    }

    // Có 331 - Phải trả NCC
    entries.push({
      accountCode: '331',
      accountName: 'Phải trả người bán',
      debitAmount: 0,
      creditAmount: invoice.grandTotal,
      description: `Phải trả ${invoice.partnerName}`
    });
  }

  return entries;
}
