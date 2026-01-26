/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BẢNG LƯƠNG - PAYROLL
 * TK 334 - Phải trả người lao động
 * Theo Thông tư 133/2016/TT-BTC & Luật BHXH
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chi tiết lương từng nhân viên
 */
export interface PayrollLine {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department?: string;
  position?: string;

  // Ngày công
  workingDays: number;        // Ngày công thực tế
  standardDays: number;       // Ngày công chuẩn (26)
  overtimeHours: number;      // Giờ làm thêm
  leavedays: number;          // Ngày nghỉ phép

  // Lương cơ bản
  baseSalary: number;         // Lương cơ bản
  actualSalary: number;       // Lương thực tế = baseSalary * workingDays / standardDays

  // Phụ cấp
  allowances: {
    position: number;         // Phụ cấp chức vụ
    responsibility: number;   // Phụ cấp trách nhiệm
    lunch: number;            // Phụ cấp ăn trưa
    phone: number;            // Phụ cấp điện thoại
    travel: number;           // Phụ cấp đi lại
    other: number;            // Phụ cấp khác
  };
  totalAllowances: number;

  // Làm thêm giờ
  overtimePay: number;        // Tiền làm thêm giờ

  // Tổng thu nhập
  grossSalary: number;        // = actualSalary + totalAllowances + overtimePay

  // Các khoản trừ - Bảo hiểm (người lao động đóng)
  insuranceDeductions: {
    socialInsurance: number;  // BHXH 8%
    healthInsurance: number;  // BHYT 1.5%
    unemploymentInsurance: number; // BHTN 1%
  };
  totalInsuranceDeduction: number; // 10.5%

  // Thuế TNCN
  taxableIncome: number;      // Thu nhập chịu thuế
  personalDeduction: number;  // Giảm trừ bản thân (11tr)
  dependentDeduction: number; // Giảm trừ người phụ thuộc (4.4tr x số NPT)
  taxableAmount: number;      // Thu nhập tính thuế
  pitAmount: number;          // Thuế TNCN

  // Các khoản trừ khác
  otherDeductions: {
    advance: number;          // Tạm ứng
    loan: number;             // Vay công ty
    penalty: number;          // Phạt
    other: number;            // Khác
  };
  totalOtherDeductions: number;

  // Tổng các khoản trừ
  totalDeductions: number;    // = totalInsurance + pitAmount + totalOther

  // Thực lĩnh
  netSalary: number;          // = grossSalary - totalDeductions

  // Chi phí công ty (BH công ty đóng)
  companyInsurance: {
    socialInsurance: number;  // BHXH 17.5%
    healthInsurance: number;  // BHYT 3%
    unemploymentInsurance: number; // BHTN 1%
    accidentInsurance: number;    // BHTNLĐ-BNN 0.5%
  };
  totalCompanyInsurance: number; // 22%

  // Tổng chi phí lương
  totalLaborCost: number;     // = grossSalary + totalCompanyInsurance

  // Ghi chú
  notes?: string;
}

/**
 * Bảng lương tháng
 */
export interface Payroll {
  id: string;
  payrollNo: string;          // BL-202501
  month: number;              // 1-12
  year: number;

  // Thông tin chung
  paymentDate?: Date;         // Ngày chi lương
  periodFrom: Date;           // Từ ngày
  periodTo: Date;             // Đến ngày
  standardDays: number;       // Ngày công chuẩn tháng

  // Chi tiết
  lines: PayrollLine[];

  // Tổng hợp
  summary: PayrollSummary;

  // Trạng thái
  status: PayrollStatus;

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
 * Tổng hợp bảng lương
 */
export interface PayrollSummary {
  employeeCount: number;
  totalWorkingDays: number;

  // Thu nhập
  totalBaseSalary: number;
  totalAllowances: number;
  totalOvertimePay: number;
  totalGrossSalary: number;

  // Khấu trừ
  totalInsuranceDeduction: number;
  totalPIT: number;
  totalOtherDeductions: number;
  totalDeductions: number;

  // Thực lĩnh
  totalNetSalary: number;

  // Chi phí công ty
  totalCompanyInsurance: number;
  totalLaborCost: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const PAYROLL_STATUSES: { value: PayrollStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'PAID', label: 'Đã chi' },
  { value: 'CANCELLED', label: 'Đã hủy' }
];

// Tỷ lệ bảo hiểm 2024
export const INSURANCE_RATES = {
  employee: {
    social: 0.08,       // BHXH 8%
    health: 0.015,      // BHYT 1.5%
    unemployment: 0.01  // BHTN 1%
  },
  company: {
    social: 0.175,      // BHXH 17.5%
    health: 0.03,       // BHYT 3%
    unemployment: 0.01, // BHTN 1%
    accident: 0.005     // BHTNLĐ-BNN 0.5%
  }
};

// Mức lương tối thiểu vùng 2024
export const MINIMUM_WAGE = {
  region1: 4960000,
  region2: 4410000,
  region3: 3860000,
  region4: 3450000
};

// Mức đóng BHXH tối đa = 20 x lương cơ sở
export const BASE_SALARY_2024 = 2340000; // Lương cơ sở 2024
export const MAX_INSURANCE_SALARY = BASE_SALARY_2024 * 20; // 46,800,000

// Giảm trừ gia cảnh
export const PERSONAL_DEDUCTION = 11000000;      // 11 triệu/tháng
export const DEPENDENT_DEDUCTION = 4400000;       // 4.4 triệu/người/tháng

// Biểu thuế TNCN lũy tiến từng phần
export const PIT_BRACKETS = [
  { from: 0, to: 5000000, rate: 0.05 },
  { from: 5000000, to: 10000000, rate: 0.10 },
  { from: 10000000, to: 18000000, rate: 0.15 },
  { from: 18000000, to: 32000000, rate: 0.20 },
  { from: 32000000, to: 52000000, rate: 0.25 },
  { from: 52000000, to: 80000000, rate: 0.30 },
  { from: 80000000, to: Infinity, rate: 0.35 }
];

// TK kế toán
export const PAYROLL_ACCOUNTS = {
  salary: '334',            // Phải trả người lao động
  salaryExpense: '6421',    // Chi phí tiền lương
  socialInsurance: '3383',  // BHXH
  healthInsurance: '3384',  // BHYT
  unemploymentInsurance: '3386', // BHTN
  accidentInsurance: '3385',// BHTNLĐ-BNN
  pit: '3335',              // Thuế TNCN
  insuranceExpense: '6422'  // Chi phí bảo hiểm
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tính lương thực tế theo ngày công
 */
export function calculateActualSalary(baseSalary: number, workingDays: number, standardDays: number): number {
  return Math.round(baseSalary * workingDays / standardDays);
}

/**
 * Tính tiền làm thêm giờ
 * Ngày thường: 150%, Cuối tuần: 200%, Lễ: 300%
 */
export function calculateOvertimePay(hourlyRate: number, hours: number, type: 'normal' | 'weekend' | 'holiday' = 'normal'): number {
  const rates = { normal: 1.5, weekend: 2.0, holiday: 3.0 };
  return Math.round(hourlyRate * hours * rates[type]);
}

/**
 * Tính bảo hiểm người lao động đóng
 */
export function calculateEmployeeInsurance(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  total: number;
} {
  // Mức đóng không vượt quá 20 lần lương cơ sở
  const cappedSalary = Math.min(insuranceSalary, MAX_INSURANCE_SALARY);

  const social = Math.round(cappedSalary * INSURANCE_RATES.employee.social);
  const health = Math.round(cappedSalary * INSURANCE_RATES.employee.health);
  const unemployment = Math.round(cappedSalary * INSURANCE_RATES.employee.unemployment);

  return {
    social,
    health,
    unemployment,
    total: social + health + unemployment
  };
}

/**
 * Tính bảo hiểm công ty đóng
 */
export function calculateCompanyInsurance(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  accident: number;
  total: number;
} {
  const cappedSalary = Math.min(insuranceSalary, MAX_INSURANCE_SALARY);

  const social = Math.round(cappedSalary * INSURANCE_RATES.company.social);
  const health = Math.round(cappedSalary * INSURANCE_RATES.company.health);
  const unemployment = Math.round(cappedSalary * INSURANCE_RATES.company.unemployment);
  const accident = Math.round(cappedSalary * INSURANCE_RATES.company.accident);

  return {
    social,
    health,
    unemployment,
    accident,
    total: social + health + unemployment + accident
  };
}

/**
 * Tính thuế TNCN theo biểu lũy tiến
 */
export function calculatePIT(taxableAmount: number): number {
  if (taxableAmount <= 0) return 0;

  let tax = 0;
  let remaining = taxableAmount;

  for (const bracket of PIT_BRACKETS) {
    const bracketAmount = bracket.to - bracket.from;
    const taxableInBracket = Math.min(remaining, bracketAmount);

    if (taxableInBracket <= 0) break;

    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }

  return Math.round(tax);
}

/**
 * Tính thu nhập tính thuế
 */
export function calculateTaxableAmount(
  grossSalary: number,
  insuranceDeduction: number,
  personalDeduction: number,
  dependentDeduction: number
): number {
  const taxableIncome = grossSalary - insuranceDeduction;
  const totalDeduction = personalDeduction + dependentDeduction;
  return Math.max(0, taxableIncome - totalDeduction);
}

/**
 * Generate payroll number
 */
export function generatePayrollNo(month: number, year: number): string {
  return `BL-${year}${month.toString().padStart(2, '0')}`;
}

/**
 * Tính tổng hợp bảng lương
 */
export function calculatePayrollSummary(lines: PayrollLine[]): PayrollSummary {
  return {
    employeeCount: lines.length,
    totalWorkingDays: lines.reduce((sum, l) => sum + l.workingDays, 0),
    totalBaseSalary: lines.reduce((sum, l) => sum + l.actualSalary, 0),
    totalAllowances: lines.reduce((sum, l) => sum + l.totalAllowances, 0),
    totalOvertimePay: lines.reduce((sum, l) => sum + l.overtimePay, 0),
    totalGrossSalary: lines.reduce((sum, l) => sum + l.grossSalary, 0),
    totalInsuranceDeduction: lines.reduce((sum, l) => sum + l.totalInsuranceDeduction, 0),
    totalPIT: lines.reduce((sum, l) => sum + l.pitAmount, 0),
    totalOtherDeductions: lines.reduce((sum, l) => sum + l.totalOtherDeductions, 0),
    totalDeductions: lines.reduce((sum, l) => sum + l.totalDeductions, 0),
    totalNetSalary: lines.reduce((sum, l) => sum + l.netSalary, 0),
    totalCompanyInsurance: lines.reduce((sum, l) => sum + l.totalCompanyInsurance, 0),
    totalLaborCost: lines.reduce((sum, l) => sum + l.totalLaborCost, 0)
  };
}
