/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BẢO HIỂM XÃ HỘI - SOCIAL INSURANCE
 * TK 3383: BHXH | TK 3384: BHYT | TK 3386: BHTN
 * Theo Luật BHXH 2014 & Nghị định 115/2015/NĐ-CP
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type InsuranceType = 'SOCIAL' | 'HEALTH' | 'UNEMPLOYMENT';
export type InsuranceReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID';
export type InsuranceReportType = 'MONTHLY' | 'ADJUSTMENT' | 'ANNUAL';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chi tiết đóng BH từng nhân viên
 */
export interface InsuranceDetail {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department?: string;

  // Số sổ/thẻ
  socialInsuranceNo?: string;
  healthInsuranceNo?: string;

  // Mức đóng
  insuranceSalary: number;

  // NLĐ đóng
  employeeSocial: number;       // BHXH 8%
  employeeHealth: number;       // BHYT 1.5%
  employeeUnemployment: number; // BHTN 1%
  totalEmployeeContribution: number;

  // DN đóng
  companySocial: number;        // BHXH 17.5%
  companyHealth: number;        // BHYT 3%
  companyUnemployment: number;  // BHTN 1%
  companyAccident: number;      // BHTNLĐ-BNN 0.5%
  totalCompanyContribution: number;

  // Tổng
  totalContribution: number;

  notes?: string;
}

/**
 * Báo cáo đóng BH tháng
 */
export interface InsuranceReport {
  id: string;
  reportNo: string;             // BHXH-202501
  reportType: InsuranceReportType;
  month: number;
  year: number;

  // Liên kết
  payrollId?: string;
  payrollNo?: string;

  // Chi tiết
  details: InsuranceDetail[];

  // Tổng hợp
  summary: InsuranceSummary;

  // Trạng thái
  status: InsuranceReportStatus;

  // Ngày nộp/đóng
  submissionDeadline: Date;     // Ngày hạn nộp (20 hàng tháng)
  submittedAt?: Date;
  paidAt?: Date;

  // Audit
  createdAt: Date;
  createdBy: string;
  notes?: string;
}

/**
 * Tổng hợp đóng BH
 */
export interface InsuranceSummary {
  employeeCount: number;
  totalInsuranceSalary: number;

  // NLĐ đóng
  totalEmployeeSocial: number;
  totalEmployeeHealth: number;
  totalEmployeeUnemployment: number;
  totalEmployeeContribution: number;

  // DN đóng
  totalCompanySocial: number;
  totalCompanyHealth: number;
  totalCompanyUnemployment: number;
  totalCompanyAccident: number;
  totalCompanyContribution: number;

  // Tổng cộng
  grandTotal: number;

  // Theo loại
  bySocialInsurance: number;    // BHXH tổng
  byHealthInsurance: number;    // BHYT tổng
  byUnemploymentInsurance: number; // BHTN tổng
  byAccidentInsurance: number;  // BHTNLĐ tổng
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const INSURANCE_TYPES: { value: InsuranceType; label: string; account: string }[] = [
  { value: 'SOCIAL', label: 'BHXH', account: '3383' },
  { value: 'HEALTH', label: 'BHYT', account: '3384' },
  { value: 'UNEMPLOYMENT', label: 'BHTN', account: '3386' }
];

export const INSURANCE_REPORT_STATUSES: { value: InsuranceReportStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'PAID', label: 'Đã đóng' }
];

// Tỷ lệ đóng BH 2024 (theo Luật BHXH)
export const INSURANCE_RATES_2024 = {
  employee: {
    social: 0.08,        // 8%
    health: 0.015,       // 1.5%
    unemployment: 0.01   // 1%
  },
  company: {
    social: 0.175,       // 17.5%
    health: 0.03,        // 3%
    unemployment: 0.01,  // 1%
    accident: 0.005      // 0.5% (BHTNLĐ-BNN)
  }
};

// Mức lương cơ sở 2024
export const BASE_SALARY_2024 = 2340000;

// Mức đóng BHXH tối đa = 20 x lương cơ sở
export const MAX_INSURANCE_SALARY_2024 = BASE_SALARY_2024 * 20; // 46,800,000

// TK kế toán
export const INSURANCE_ACCOUNTS = {
  socialInsurance: '3383',
  healthInsurance: '3384',
  accidentInsurance: '3385',
  unemploymentInsurance: '3386',
  insuranceExpense: '6422',
  salaryDeduction: '334'
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateReportNo(month: number, year: number): string {
  return `BHXH-${year}${month.toString().padStart(2, '0')}`;
}

export function calculateEmployeeContribution(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  total: number;
} {
  const cappedSalary = Math.min(insuranceSalary, MAX_INSURANCE_SALARY_2024);
  const social = Math.round(cappedSalary * INSURANCE_RATES_2024.employee.social);
  const health = Math.round(cappedSalary * INSURANCE_RATES_2024.employee.health);
  const unemployment = Math.round(cappedSalary * INSURANCE_RATES_2024.employee.unemployment);

  return {
    social,
    health,
    unemployment,
    total: social + health + unemployment
  };
}

export function calculateCompanyContribution(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  accident: number;
  total: number;
} {
  const cappedSalary = Math.min(insuranceSalary, MAX_INSURANCE_SALARY_2024);
  const social = Math.round(cappedSalary * INSURANCE_RATES_2024.company.social);
  const health = Math.round(cappedSalary * INSURANCE_RATES_2024.company.health);
  const unemployment = Math.round(cappedSalary * INSURANCE_RATES_2024.company.unemployment);
  const accident = Math.round(cappedSalary * INSURANCE_RATES_2024.company.accident);

  return {
    social,
    health,
    unemployment,
    accident,
    total: social + health + unemployment + accident
  };
}

export function calculateInsuranceSummary(details: InsuranceDetail[]): InsuranceSummary {
  return {
    employeeCount: details.length,
    totalInsuranceSalary: details.reduce((sum, d) => sum + d.insuranceSalary, 0),

    totalEmployeeSocial: details.reduce((sum, d) => sum + d.employeeSocial, 0),
    totalEmployeeHealth: details.reduce((sum, d) => sum + d.employeeHealth, 0),
    totalEmployeeUnemployment: details.reduce((sum, d) => sum + d.employeeUnemployment, 0),
    totalEmployeeContribution: details.reduce((sum, d) => sum + d.totalEmployeeContribution, 0),

    totalCompanySocial: details.reduce((sum, d) => sum + d.companySocial, 0),
    totalCompanyHealth: details.reduce((sum, d) => sum + d.companyHealth, 0),
    totalCompanyUnemployment: details.reduce((sum, d) => sum + d.companyUnemployment, 0),
    totalCompanyAccident: details.reduce((sum, d) => sum + d.companyAccident, 0),
    totalCompanyContribution: details.reduce((sum, d) => sum + d.totalCompanyContribution, 0),

    grandTotal: details.reduce((sum, d) => sum + d.totalContribution, 0),

    bySocialInsurance: details.reduce((sum, d) => sum + d.employeeSocial + d.companySocial, 0),
    byHealthInsurance: details.reduce((sum, d) => sum + d.employeeHealth + d.companyHealth, 0),
    byUnemploymentInsurance: details.reduce((sum, d) => sum + d.employeeUnemployment + d.companyUnemployment, 0),
    byAccidentInsurance: details.reduce((sum, d) => sum + d.companyAccident, 0)
  };
}

export function getSubmissionDeadline(month: number, year: number): Date {
  // Hạn nộp: ngày 20 tháng sau
  let deadlineMonth = month + 1;
  let deadlineYear = year;
  if (deadlineMonth > 12) {
    deadlineMonth = 1;
    deadlineYear++;
  }
  return new Date(deadlineYear, deadlineMonth - 1, 20);
}
