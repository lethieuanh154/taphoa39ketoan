/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TỜ KHAI THUẾ GTGT - VAT DECLARATION
 * Mẫu 01/GTGT theo Thông tư 80/2021/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kỳ khai thuế
 */
export type DeclarationPeriod = 'MONTHLY' | 'QUARTERLY';

/**
 * Loại tờ khai
 */
export type DeclarationType = 'ORIGINAL' | 'AMENDED';

/**
 * Trạng thái tờ khai
 */
export type DeclarationStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tờ khai thuế GTGT mẫu 01/GTGT
 */
export interface VATDeclaration {
  id: string;
  declarationNo: string;              // Số tờ khai
  declarationType: DeclarationType;   // Loại tờ khai
  amendmentNo?: number;               // Lần điều chỉnh (nếu là AMENDED)

  // Kỳ khai thuế
  period: DeclarationPeriod;
  taxPeriod: string;                  // "01/2025" hoặc "Q1/2025"
  year: number;
  month?: number;                     // 1-12 nếu MONTHLY
  quarter?: number;                   // 1-4 nếu QUARTERLY

  // Thông tin doanh nghiệp
  companyName: string;
  taxCode: string;
  address: string;
  phone?: string;
  email?: string;
  representative: string;             // Người đại diện
  accountant?: string;                // Kế toán trưởng

  // ═══════════════════════════════════════════════════════════════════
  // PHẦN I - HÀNG HÓA DỊCH VỤ BÁN RA
  // ═══════════════════════════════════════════════════════════════════

  // [21] Không chịu thuế
  line21_noTaxRevenue: number;

  // [22] Chịu thuế suất 0%
  line22_zeroRateRevenue: number;

  // [23] Chịu thuế suất 5%
  line23_fivePercentRevenue: number;
  line23_fivePercentVAT: number;

  // [24] Chịu thuế suất 8% (áp dụng 2022-2024)
  line24_eightPercentRevenue: number;
  line24_eightPercentVAT: number;

  // [25] Chịu thuế suất 10%
  line25_tenPercentRevenue: number;
  line25_tenPercentVAT: number;

  // [26] Tổng doanh thu
  line26_totalRevenue: number;

  // [27] Tổng thuế GTGT đầu ra
  line27_totalOutputVAT: number;

  // ═══════════════════════════════════════════════════════════════════
  // PHẦN II - HÀNG HÓA DỊCH VỤ MUA VÀO
  // ═══════════════════════════════════════════════════════════════════

  // [28] Tổng giá trị HHDV mua vào
  line28_totalPurchase: number;

  // [29] Tổng thuế GTGT đầu vào
  line29_totalInputVAT: number;

  // [30] Thuế GTGT đầu vào được khấu trừ
  line30_deductibleInputVAT: number;

  // [31] Điều chỉnh tăng thuế GTGT được khấu trừ
  line31_increaseAdjustment: number;

  // [32] Điều chỉnh giảm thuế GTGT được khấu trừ
  line32_decreaseAdjustment: number;

  // [33] Thuế GTGT còn được khấu trừ chuyển kỳ sau (kỳ trước)
  line33_carryForwardFromPrevious: number;

  // ═══════════════════════════════════════════════════════════════════
  // PHẦN III - XÁC ĐỊNH NGHĨA VỤ THUẾ
  // ═══════════════════════════════════════════════════════════════════

  // [34] Tổng số thuế GTGT được khấu trừ
  // = [30] + [31] - [32] + [33]
  line34_totalDeductibleVAT: number;

  // [35] Thuế GTGT phải nộp (nếu [27] > [34])
  // = [27] - [34]
  line35_vatPayable: number;

  // [36] Thuế GTGT chưa khấu trừ hết (nếu [27] < [34])
  // = [34] - [27]
  line36_vatNotDeducted: number;

  // [37] Thuế GTGT đề nghị hoàn
  line37_vatRefundRequest: number;

  // [38] Thuế GTGT còn được khấu trừ chuyển kỳ sau
  // = [36] - [37]
  line38_carryForwardToNext: number;

  // ═══════════════════════════════════════════════════════════════════
  // TRẠNG THÁI VÀ AUDIT
  // ═══════════════════════════════════════════════════════════════════

  status: DeclarationStatus;
  submittedAt?: Date;
  submittedBy?: string;
  acceptedAt?: Date;
  rejectedReason?: string;

  notes?: string;

  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Chi tiết hóa đơn đầu ra cho tờ khai
 */
export interface OutputInvoiceDetail {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: Date;
  customerName: string;
  customerTaxCode?: string;
  revenue: number;
  vatRate: number;
  vatAmount: number;
}

/**
 * Chi tiết hóa đơn đầu vào cho tờ khai
 */
export interface InputInvoiceDetail {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: Date;
  supplierName: string;
  supplierTaxCode: string;
  purchaseAmount: number;
  vatRate: number;
  vatAmount: number;
  isDeductible: boolean;
}

/**
 * Tổng hợp dữ liệu để lập tờ khai
 */
export interface VATDeclarationData {
  period: string;
  fromDate: Date;
  toDate: Date;

  // Output
  outputInvoices: OutputInvoiceDetail[];
  outputSummary: {
    noTaxRevenue: number;
    zeroRateRevenue: number;
    fivePercentRevenue: number;
    fivePercentVAT: number;
    eightPercentRevenue: number;
    eightPercentVAT: number;
    tenPercentRevenue: number;
    tenPercentVAT: number;
    totalRevenue: number;
    totalOutputVAT: number;
  };

  // Input
  inputInvoices: InputInvoiceDetail[];
  inputSummary: {
    totalPurchase: number;
    totalInputVAT: number;
    deductibleInputVAT: number;
    nonDeductibleInputVAT: number;
  };

  // Previous period
  carryForwardFromPrevious: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const DECLARATION_PERIODS: { value: DeclarationPeriod; label: string }[] = [
  { value: 'MONTHLY', label: 'Tháng' },
  { value: 'QUARTERLY', label: 'Quý' }
];

export const DECLARATION_TYPES: { value: DeclarationType; label: string }[] = [
  { value: 'ORIGINAL', label: 'Tờ khai lần đầu' },
  { value: 'AMENDED', label: 'Tờ khai bổ sung' }
];

export const DECLARATION_STATUSES: { value: DeclarationStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'ACCEPTED', label: 'Đã chấp nhận' },
  { value: 'REJECTED', label: 'Bị từ chối' }
];

export const VAT_RATES = [0, 5, 8, 10];

// Hạn nộp tờ khai: Ngày 20 của tháng tiếp theo (tháng) hoặc ngày cuối quý tiếp theo (quý)
export function getDeclarationDeadline(period: DeclarationPeriod, year: number, periodNo: number): Date {
  if (period === 'MONTHLY') {
    // Ngày 20 tháng sau
    return new Date(year, periodNo, 20); // periodNo = month (0-indexed + 1 = next month)
  } else {
    // Ngày cuối tháng đầu quý sau
    const nextQuarterFirstMonth = periodNo * 3; // Q1 = 3 (Apr), Q2 = 6 (Jul), etc.
    return new Date(year, nextQuarterFirstMonth + 1, 0); // Last day of first month of next quarter
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateDeclarationNo(type: DeclarationType, period: string, amendmentNo?: number): string {
  const typeCode = type === 'ORIGINAL' ? '01' : `01-${amendmentNo?.toString().padStart(2, '0')}`;
  return `${typeCode}/GTGT-${period.replace('/', '')}`;
}

export function calculateTotalDeductibleVAT(
  deductibleInputVAT: number,
  increaseAdjustment: number,
  decreaseAdjustment: number,
  carryForward: number
): number {
  return deductibleInputVAT + increaseAdjustment - decreaseAdjustment + carryForward;
}

export function calculateVATPayable(outputVAT: number, totalDeductibleVAT: number): number {
  return Math.max(0, outputVAT - totalDeductibleVAT);
}

export function calculateVATNotDeducted(outputVAT: number, totalDeductibleVAT: number): number {
  return Math.max(0, totalDeductibleVAT - outputVAT);
}

export function validateDeclaration(declaration: Partial<VATDeclaration>): string[] {
  const errors: string[] = [];
  if (!declaration.taxPeriod) errors.push('Kỳ tính thuế là bắt buộc');
  if (!declaration.companyName) errors.push('Tên doanh nghiệp là bắt buộc');
  if (!declaration.taxCode) errors.push('Mã số thuế là bắt buộc');
  if (!declaration.representative) errors.push('Người đại diện là bắt buộc');
  return errors;
}

export function getPeriodLabel(period: DeclarationPeriod, year: number, periodNo: number): string {
  if (period === 'MONTHLY') {
    return `Tháng ${periodNo.toString().padStart(2, '0')}/${year}`;
  } else {
    return `Quý ${periodNo}/${year}`;
  }
}
