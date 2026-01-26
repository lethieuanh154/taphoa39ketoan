/**
 * VAT MODELS - Thuế Giá Trị Gia Tăng
 * Theo Thông tư 80/2021/TT-BTC về kê khai thuế
 *
 * Tờ khai thuế GTGT mẫu 01/GTGT
 * Bảng kê hóa đơn mua vào (PL 01-2/GTGT)
 * Bảng kê hóa đơn bán ra (PL 01-1/GTGT)
 */

// ═══════════════════════════════════════════════════════════════════
// ENUMS & TYPES
// ═══════════════════════════════════════════════════════════════════

/** Kỳ kê khai */
export type VATDeclarationPeriod = 'MONTHLY' | 'QUARTERLY';

/** Trạng thái tờ khai */
export type VATDeclarationStatus = 'DRAFT' | 'SUBMITTED' | 'ADJUSTED';

/** Loại hóa đơn trong bảng kê */
export type VATInvoiceType =
  | 'DOMESTIC'           // Hóa đơn trong nước
  | 'IMPORT'             // Hóa đơn nhập khẩu
  | 'EXPORT'             // Hóa đơn xuất khẩu
  | 'NON_DEDUCTIBLE';    // Hóa đơn không được khấu trừ

/** Thuế suất GTGT */
export type VATRate = 0 | 5 | 8 | 10 | -1 | -2;
// -1: Không chịu thuế (exempt)
// -2: Không kê khai (non-declarable)

/** Mapping thuế suất */
export const VAT_RATE_LABELS: Record<number, string> = {
  0: '0%',
  5: '5%',
  8: '8%',
  10: '10%',
  [-1]: 'Không chịu thuế',
  [-2]: 'Không kê khai'
};

/** Mapping trạng thái */
export const VAT_STATUS_LABELS: Record<VATDeclarationStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã nộp',
  ADJUSTED: 'Điều chỉnh'
};

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

/** Dòng chi tiết trong bảng kê */
export interface VATInvoiceLine {
  id: string;
  lineNo: number;
  invoiceNo: string;           // Số hóa đơn
  invoiceDate: Date;           // Ngày hóa đơn
  invoiceSerial?: string;      // Ký hiệu hóa đơn
  partnerTaxCode: string;      // MST đối tác
  partnerName: string;         // Tên đối tác
  goodsServiceName: string;    // Tên hàng hóa/dịch vụ
  amount: number;              // Giá trị HHDV chưa thuế
  vatRate: VATRate;            // Thuế suất
  vatAmount: number;           // Tiền thuế GTGT
  totalAmount: number;         // Tổng thanh toán
  invoiceType: VATInvoiceType; // Loại hóa đơn
  isDeductible: boolean;       // Được khấu trừ
  sourceVoucherId?: string;    // ID hóa đơn gốc
  note?: string;
}

/** Bảng kê hóa đơn mua vào */
export interface VATInputSchedule {
  id: string;
  periodMonth: number;         // Tháng kê khai (1-12)
  periodYear: number;          // Năm kê khai
  periodType: VATDeclarationPeriod;
  lines: VATInvoiceLine[];

  // Tổng hợp theo thuế suất
  summary: {
    totalInvoices: number;
    // Thuế suất 0%
    amount0: number;
    vat0: number;
    // Thuế suất 5%
    amount5: number;
    vat5: number;
    // Thuế suất 8%
    amount8: number;
    vat8: number;
    // Thuế suất 10%
    amount10: number;
    vat10: number;
    // Không chịu thuế
    amountExempt: number;
    // Tổng cộng
    totalAmount: number;
    totalVat: number;
    totalDeductible: number;   // Thuế được khấu trừ
  };
}

/** Bảng kê hóa đơn bán ra */
export interface VATOutputSchedule {
  id: string;
  periodMonth: number;
  periodYear: number;
  periodType: VATDeclarationPeriod;
  lines: VATInvoiceLine[];

  // Tổng hợp theo thuế suất
  summary: {
    totalInvoices: number;
    // Thuế suất 0%
    amount0: number;
    vat0: number;
    // Thuế suất 5%
    amount5: number;
    vat5: number;
    // Thuế suất 8%
    amount8: number;
    vat8: number;
    // Thuế suất 10%
    amount10: number;
    vat10: number;
    // Không chịu thuế
    amountExempt: number;
    // Tổng cộng
    totalAmount: number;
    totalVat: number;
  };
}

/** Tờ khai thuế GTGT mẫu 01/GTGT */
export interface VATDeclaration {
  id: string;
  declarationNo: string;       // Số tờ khai
  periodMonth: number;         // Kỳ tính thuế: tháng
  periodQuarter?: number;      // Kỳ tính thuế: quý (1-4)
  periodYear: number;          // Năm
  periodType: VATDeclarationPeriod;
  status: VATDeclarationStatus;
  isAmendment: boolean;        // Tờ khai bổ sung
  amendmentNo?: number;        // Lần bổ sung

  // [22] Hàng hóa dịch vụ bán ra
  // [22a] Hàng hóa, dịch vụ bán ra không chịu thuế
  salesExempt: number;
  // [23] Hàng hóa, dịch vụ bán ra chịu thuế suất 0%
  sales0: number;
  // [24] Hàng hóa, dịch vụ bán ra chịu thuế suất 5%
  sales5: number;
  vat5Output: number;
  // [25] Hàng hóa, dịch vụ bán ra chịu thuế suất 8%
  sales8: number;
  vat8Output: number;
  // [26] Hàng hóa, dịch vụ bán ra chịu thuế suất 10%
  sales10: number;
  vat10Output: number;
  // [27] Tổng doanh số bán ra
  totalSales: number;
  // [28] Tổng thuế GTGT đầu ra
  totalVatOutput: number;

  // [29] Hàng hóa, dịch vụ mua vào
  // [29a] Giá trị HHDV mua vào
  totalPurchases: number;
  // [29b] Thuế GTGT mua vào
  totalVatInput: number;

  // [30] Thuế GTGT được khấu trừ kỳ trước chuyển sang
  vatCreditBroughtForward: number;

  // [31] Tổng số thuế GTGT được khấu trừ
  totalVatDeductible: number;

  // [32] Thuế GTGT còn phải nộp (+) hoặc thuế GTGT còn được khấu trừ (-)
  vatPayableOrCredit: number;

  // [33] Thuế GTGT đề nghị hoàn
  vatRefundRequested: number;

  // [34] Thuế GTGT còn được khấu trừ chuyển kỳ sau
  vatCreditCarryForward: number;

  // Bảng kê đính kèm
  inputScheduleId?: string;
  outputScheduleId?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  submittedAt?: Date;
  submittedBy?: string;
  note?: string;
}

/** Bộ lọc tờ khai */
export interface VATDeclarationFilter {
  periodYear?: number;
  periodMonth?: number;
  periodQuarter?: number;
  periodType?: VATDeclarationPeriod;
  status?: VATDeclarationStatus;
}

/** Thống kê VAT */
export interface VATSummary {
  totalDeclarations: number;
  draftCount: number;
  submittedCount: number;
  totalVatOutput: number;
  totalVatInput: number;
  totalVatPayable: number;
  totalVatCredit: number;
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT VALUES & HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Tạo tờ khai rỗng */
export function createEmptyVATDeclaration(periodMonth: number, periodYear: number): Partial<VATDeclaration> {
  return {
    periodMonth,
    periodYear,
    periodType: 'MONTHLY',
    status: 'DRAFT',
    isAmendment: false,
    salesExempt: 0,
    sales0: 0,
    sales5: 0,
    vat5Output: 0,
    sales8: 0,
    vat8Output: 0,
    sales10: 0,
    vat10Output: 0,
    totalSales: 0,
    totalVatOutput: 0,
    totalPurchases: 0,
    totalVatInput: 0,
    vatCreditBroughtForward: 0,
    totalVatDeductible: 0,
    vatPayableOrCredit: 0,
    vatRefundRequested: 0,
    vatCreditCarryForward: 0,
    createdAt: new Date(),
    createdBy: 'admin'
  };
}

/** Tạo bảng kê rỗng */
export function createEmptyScheduleSummary() {
  return {
    totalInvoices: 0,
    amount0: 0, vat0: 0,
    amount5: 0, vat5: 0,
    amount8: 0, vat8: 0,
    amount10: 0, vat10: 0,
    amountExempt: 0,
    totalAmount: 0,
    totalVat: 0,
    totalDeductible: 0
  };
}

/** Tính thuế từ giá trị và thuế suất */
export function calculateVAT(amount: number, vatRate: VATRate): number {
  if (vatRate < 0) return 0; // Không chịu thuế hoặc không kê khai
  return Math.round(amount * vatRate / 100);
}

/** Tính tổng từ giá trị và thuế */
export function calculateTotal(amount: number, vatAmount: number): number {
  return amount + vatAmount;
}

/** Tính thuế phải nộp / được khấu trừ */
export function calculateVATPayable(declaration: Partial<VATDeclaration>): number {
  const totalDeductible = (declaration.totalVatInput || 0) + (declaration.vatCreditBroughtForward || 0);
  const vatPayable = (declaration.totalVatOutput || 0) - totalDeductible;
  return vatPayable;
}

/** Format tên kỳ kê khai */
export function formatPeriodName(periodMonth: number, periodYear: number, periodType: VATDeclarationPeriod): string {
  if (periodType === 'QUARTERLY') {
    const quarter = Math.ceil(periodMonth / 3);
    return `Quý ${quarter}/${periodYear}`;
  }
  return `Tháng ${String(periodMonth).padStart(2, '0')}/${periodYear}`;
}

/** Lấy tháng bắt đầu của quý */
export function getQuarterStartMonth(quarter: number): number {
  return (quarter - 1) * 3 + 1;
}

/** Lấy tháng kết thúc của quý */
export function getQuarterEndMonth(quarter: number): number {
  return quarter * 3;
}

/** Kiểm tra kỳ kê khai hợp lệ */
export function isValidPeriod(month: number, year: number): boolean {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year > currentYear) return false;
  if (year === currentYear && month > currentMonth) return false;
  return true;
}

/** Lấy kỳ kê khai hiện tại */
export function getCurrentPeriod(): { month: number; year: number } {
  const now = new Date();
  let month = now.getMonth(); // Previous month (0-11 becomes 1-12 for previous month)
  let year = now.getFullYear();

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return { month, year };
}
