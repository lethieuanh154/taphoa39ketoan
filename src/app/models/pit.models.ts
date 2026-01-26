/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * THUẾ THU NHẬP CÁ NHÂN - PERSONAL INCOME TAX (PIT)
 * TK 3335 - Thuế TNCN phải nộp
 * Theo Luật Thuế TNCN & Thông tư 111/2013/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PITDeclarationStatus = 'DRAFT' | 'SUBMITTED' | 'PAID' | 'CANCELLED';
export type PITDeclarationType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chi tiết thuế TNCN từng nhân viên
 */
export interface PITDetail {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  taxCode?: string;
  department?: string;

  // Thu nhập
  grossSalary: number;          // Tổng thu nhập
  insuranceDeduction: number;   // BH NLĐ đóng
  taxableIncome: number;        // Thu nhập chịu thuế

  // Giảm trừ
  personalDeduction: number;    // Giảm trừ bản thân (11tr)
  dependentCount: number;       // Số người phụ thuộc
  dependentDeduction: number;   // Giảm trừ NPT
  totalDeduction: number;

  // Thuế
  taxableAmount: number;        // Thu nhập tính thuế
  pitAmount: number;            // Thuế TNCN phải nộp

  notes?: string;
}

/**
 * Tờ khai thuế TNCN
 */
export interface PITDeclaration {
  id: string;
  declarationNo: string;        // TNCN-202501
  declarationType: PITDeclarationType;
  period: string;               // "01/2025" hoặc "Q1/2025"
  month?: number;
  quarter?: number;
  year: number;

  // Chi tiết
  details: PITDetail[];

  // Tổng hợp
  summary: PITSummary;

  // Trạng thái
  status: PITDeclarationStatus;

  // Hạn nộp
  submissionDeadline: Date;
  submittedAt?: Date;
  paidAt?: Date;

  // Audit
  createdAt: Date;
  createdBy: string;
  notes?: string;
}

/**
 * Tổng hợp thuế TNCN
 */
export interface PITSummary {
  employeeCount: number;
  taxableEmployeeCount: number; // Số NV phải nộp thuế
  totalGrossSalary: number;
  totalInsuranceDeduction: number;
  totalTaxableIncome: number;
  totalPersonalDeduction: number;
  totalDependentDeduction: number;
  totalTaxableAmount: number;
  totalPITAmount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const PIT_DECLARATION_STATUSES: { value: PITDeclarationStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'PAID', label: 'Đã nộp thuế' },
  { value: 'CANCELLED', label: 'Đã hủy' }
];

// Giảm trừ gia cảnh 2024
export const PERSONAL_DEDUCTION = 11000000;    // 11 triệu/tháng
export const DEPENDENT_DEDUCTION = 4400000;    // 4.4 triệu/người/tháng

// Biểu thuế lũy tiến từng phần
export const PIT_BRACKETS = [
  { from: 0, to: 5000000, rate: 0.05, deduction: 0 },
  { from: 5000000, to: 10000000, rate: 0.10, deduction: 250000 },
  { from: 10000000, to: 18000000, rate: 0.15, deduction: 750000 },
  { from: 18000000, to: 32000000, rate: 0.20, deduction: 1650000 },
  { from: 32000000, to: 52000000, rate: 0.25, deduction: 3250000 },
  { from: 52000000, to: 80000000, rate: 0.30, deduction: 5850000 },
  { from: 80000000, to: Infinity, rate: 0.35, deduction: 9850000 }
];

// TK kế toán
export const PIT_ACCOUNTS = {
  pit: '3335',                  // Thuế TNCN phải nộp
  salaryPayable: '334'          // Phải trả người lao động
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateDeclarationNo(month: number, year: number): string {
  return `TNCN-${year}${month.toString().padStart(2, '0')}`;
}

/**
 * Tính thuế TNCN theo biểu lũy tiến
 */
export function calculatePIT(taxableAmount: number): number {
  if (taxableAmount <= 0) return 0;

  let tax = 0;
  let remaining = taxableAmount;

  for (const bracket of PIT_BRACKETS) {
    const bracketSize = bracket.to - bracket.from;
    const taxableInBracket = Math.min(remaining, bracketSize);

    if (taxableInBracket <= 0) break;

    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }

  return Math.round(tax);
}

/**
 * Tính nhanh thuế TNCN (công thức rút gọn)
 */
export function calculatePITQuick(taxableAmount: number): number {
  if (taxableAmount <= 0) return 0;

  for (let i = PIT_BRACKETS.length - 1; i >= 0; i--) {
    const bracket = PIT_BRACKETS[i];
    if (taxableAmount > bracket.from) {
      return Math.round(taxableAmount * bracket.rate - bracket.deduction);
    }
  }
  return 0;
}

export function calculatePITSummary(details: PITDetail[]): PITSummary {
  return {
    employeeCount: details.length,
    taxableEmployeeCount: details.filter(d => d.pitAmount > 0).length,
    totalGrossSalary: details.reduce((sum, d) => sum + d.grossSalary, 0),
    totalInsuranceDeduction: details.reduce((sum, d) => sum + d.insuranceDeduction, 0),
    totalTaxableIncome: details.reduce((sum, d) => sum + d.taxableIncome, 0),
    totalPersonalDeduction: details.reduce((sum, d) => sum + d.personalDeduction, 0),
    totalDependentDeduction: details.reduce((sum, d) => sum + d.dependentDeduction, 0),
    totalTaxableAmount: details.reduce((sum, d) => sum + d.taxableAmount, 0),
    totalPITAmount: details.reduce((sum, d) => sum + d.pitAmount, 0)
  };
}

export function getSubmissionDeadline(month: number, year: number): Date {
  // Hạn nộp tờ khai: ngày 20 tháng sau
  let deadlineMonth = month + 1;
  let deadlineYear = year;
  if (deadlineMonth > 12) {
    deadlineMonth = 1;
    deadlineYear++;
  }
  return new Date(deadlineYear, deadlineMonth - 1, 20);
}
