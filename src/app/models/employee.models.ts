/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DANH MỤC NHÂN VIÊN - EMPLOYEE MASTER
 * Quản lý thông tin nhân viên cho bảng lương, BHXH, thuế TNCN
 * Theo Thông tư 133/2016/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Giới tính
 */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/**
 * Loại hợp đồng
 */
export type ContractType =
  | 'INDEFINITE'      // Không xác định thời hạn
  | 'DEFINITE'        // Xác định thời hạn
  | 'SEASONAL'        // Thời vụ / dưới 12 tháng
  | 'PROBATION'       // Thử việc
  | 'COLLABORATOR';   // Cộng tác viên

/**
 * Trạng thái làm việc
 */
export type EmployeeStatus =
  | 'WORKING'         // Đang làm việc
  | 'ON_LEAVE'        // Nghỉ phép
  | 'MATERNITY'       // Nghỉ thai sản
  | 'SUSPENDED'       // Tạm nghỉ
  | 'RESIGNED';       // Đã nghỉ việc

/**
 * Loại nhân viên
 */
export type EmployeeType =
  | 'FULL_TIME'       // Toàn thời gian
  | 'PART_TIME'       // Bán thời gian
  | 'CONTRACT'        // Hợp đồng
  | 'INTERN';         // Thực tập

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thông tin người phụ thuộc (giảm trừ gia cảnh)
 */
export interface Dependent {
  id: string;
  fullName: string;
  relationship: string;      // Quan hệ: Con, Bố, Mẹ, Vợ/Chồng
  dateOfBirth: Date;
  idNumber?: string;         // CMND/CCCD
  taxCode?: string;          // MST (nếu có)
  deductionFrom: Date;       // Giảm trừ từ ngày
  deductionTo?: Date;        // Giảm trừ đến ngày
  isActive: boolean;
}

/**
 * Thông tin bảo hiểm
 */
export interface InsuranceInfo {
  socialInsuranceNo?: string;     // Số sổ BHXH
  healthInsuranceNo?: string;     // Số thẻ BHYT
  healthInsurancePlace?: string;  // Nơi KCB ban đầu
  insuranceSalary: number;        // Lương đóng BH
  socialInsuranceDate?: Date;     // Ngày tham gia BHXH
  healthInsuranceDate?: Date;     // Ngày tham gia BHYT
  unemploymentInsuranceDate?: Date; // Ngày tham gia BHTN
}

/**
 * Thông tin ngân hàng
 */
export interface BankAccount {
  bankCode: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  branch?: string;
}

/**
 * Nhân viên
 */
export interface Employee {
  id: string;
  code: string;                   // Mã NV: NV001
  fullName: string;               // Họ tên
  gender: Gender;
  dateOfBirth: Date;
  placeOfBirth?: string;          // Nơi sinh
  nationality?: string;           // Quốc tịch

  // Giấy tờ tùy thân
  idNumber: string;               // CMND/CCCD
  idIssueDate?: Date;             // Ngày cấp
  idIssuePlace?: string;          // Nơi cấp
  taxCode?: string;               // Mã số thuế cá nhân

  // Liên hệ
  phone: string;
  email?: string;
  address?: string;
  permanentAddress?: string;      // Địa chỉ thường trú

  // Công việc
  departmentId?: string;          // Mã phòng ban
  departmentName?: string;        // Tên phòng ban
  position: string;               // Chức vụ
  employeeType: EmployeeType;
  contractType: ContractType;
  hireDate: Date;                 // Ngày vào làm
  contractStartDate?: Date;       // Ngày bắt đầu HĐ
  contractEndDate?: Date;         // Ngày kết thúc HĐ
  resignDate?: Date;              // Ngày nghỉ việc

  // Lương
  baseSalary: number;             // Lương cơ bản
  insuranceSalary: number;        // Lương đóng BH
  salaryCoefficient?: number;     // Hệ số lương (nếu theo ngạch)

  // Bảo hiểm
  insurance: InsuranceInfo;

  // Người phụ thuộc
  dependents: Dependent[];

  // Ngân hàng
  bankAccount?: BankAccount;

  // Kế toán
  salaryAccount: string;          // TK 334 - Phải trả người lao động
  advanceAccount: string;         // TK 141 - Tạm ứng

  // Trạng thái
  status: EmployeeStatus;

  // Ghi chú
  notes?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Filter tìm kiếm
 */
export interface EmployeeFilter {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  employeeType?: EmployeeType;
  contractType?: ContractType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' }
];

export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'INDEFINITE', label: 'Không xác định thời hạn' },
  { value: 'DEFINITE', label: 'Xác định thời hạn' },
  { value: 'SEASONAL', label: 'Thời vụ / dưới 12 tháng' },
  { value: 'PROBATION', label: 'Thử việc' },
  { value: 'COLLABORATOR', label: 'Cộng tác viên' }
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'WORKING', label: 'Đang làm việc' },
  { value: 'ON_LEAVE', label: 'Nghỉ phép' },
  { value: 'MATERNITY', label: 'Nghỉ thai sản' },
  { value: 'SUSPENDED', label: 'Tạm nghỉ' },
  { value: 'RESIGNED', label: 'Đã nghỉ việc' }
];

export const EMPLOYEE_TYPES: { value: EmployeeType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Toàn thời gian' },
  { value: 'PART_TIME', label: 'Bán thời gian' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INTERN', label: 'Thực tập' }
];

export const RELATIONSHIPS = [
  'Con', 'Bố', 'Mẹ', 'Vợ', 'Chồng', 'Ông', 'Bà', 'Anh', 'Chị', 'Em', 'Khác'
];

/**
 * Mức giảm trừ gia cảnh 2024
 */
export const TAX_DEDUCTION = {
  PERSONAL: 11000000,      // Giảm trừ bản thân: 11 triệu/tháng
  DEPENDENT: 4400000       // Giảm trừ người phụ thuộc: 4.4 triệu/tháng
};

/**
 * Tỷ lệ đóng bảo hiểm 2024
 */
export const INSURANCE_RATES = {
  // Người lao động đóng
  EMPLOYEE: {
    SOCIAL: 0.08,          // BHXH: 8%
    HEALTH: 0.015,         // BHYT: 1.5%
    UNEMPLOYMENT: 0.01     // BHTN: 1%
  },
  // Doanh nghiệp đóng
  EMPLOYER: {
    SOCIAL: 0.175,         // BHXH: 17.5%
    HEALTH: 0.03,          // BHYT: 3%
    UNEMPLOYMENT: 0.01     // BHTN: 1%
  }
};

/**
 * Mức lương tối thiểu vùng 2024
 */
export const MINIMUM_WAGE = {
  REGION_1: 4960000,
  REGION_2: 4410000,
  REGION_3: 3860000,
  REGION_4: 3450000
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateEmployeeCode(sequence: number): string {
  return `NV${String(sequence).padStart(4, '0')}`;
}

export function validateEmployee(employee: Partial<Employee>): string[] {
  const errors: string[] = [];
  if (!employee.code?.trim()) errors.push('Mã nhân viên là bắt buộc');
  if (!employee.fullName?.trim()) errors.push('Họ tên là bắt buộc');
  if (!employee.idNumber?.trim()) errors.push('CMND/CCCD là bắt buộc');
  if (!employee.phone?.trim()) errors.push('Số điện thoại là bắt buộc');
  if (!employee.position?.trim()) errors.push('Chức vụ là bắt buộc');
  if (!employee.hireDate) errors.push('Ngày vào làm là bắt buộc');
  if (employee.baseSalary !== undefined && employee.baseSalary < 0) {
    errors.push('Lương cơ bản không được âm');
  }
  return errors;
}

export function calculateInsuranceEmployee(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  total: number;
} {
  const social = insuranceSalary * INSURANCE_RATES.EMPLOYEE.SOCIAL;
  const health = insuranceSalary * INSURANCE_RATES.EMPLOYEE.HEALTH;
  const unemployment = insuranceSalary * INSURANCE_RATES.EMPLOYEE.UNEMPLOYMENT;
  return {
    social,
    health,
    unemployment,
    total: social + health + unemployment
  };
}

export function calculateInsuranceEmployer(insuranceSalary: number): {
  social: number;
  health: number;
  unemployment: number;
  total: number;
} {
  const social = insuranceSalary * INSURANCE_RATES.EMPLOYER.SOCIAL;
  const health = insuranceSalary * INSURANCE_RATES.EMPLOYER.HEALTH;
  const unemployment = insuranceSalary * INSURANCE_RATES.EMPLOYER.UNEMPLOYMENT;
  return {
    social,
    health,
    unemployment,
    total: social + health + unemployment
  };
}

export function calculateTaxDeduction(dependentCount: number): number {
  return TAX_DEDUCTION.PERSONAL + (dependentCount * TAX_DEDUCTION.DEPENDENT);
}
