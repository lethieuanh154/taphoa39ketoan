/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DANH MỤC NHÀ CUNG CẤP - SUPPLIER MASTER
 * Quản lý thông tin NCC cho hóa đơn mua vào, công nợ phải trả (TK 331)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại nhà cung cấp
 */
export type SupplierType =
  | 'MANUFACTURER'   // Nhà sản xuất
  | 'DISTRIBUTOR'    // Nhà phân phối
  | 'WHOLESALER'     // Bán buôn
  | 'SERVICE'        // Dịch vụ
  | 'OTHER';         // Khác

/**
 * Nhóm nhà cung cấp
 */
export type SupplierGroup =
  | 'GOODS'          // Hàng hóa
  | 'MATERIAL'       // Nguyên vật liệu
  | 'ASSET'          // Tài sản cố định
  | 'SERVICE'        // Dịch vụ
  | 'UTILITY'        // Điện nước, viễn thông
  | 'OTHER';         // Khác

/**
 * Trạng thái nhà cung cấp
 */
export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thông tin liên hệ
 */
export interface SupplierContact {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
}

/**
 * Thông tin ngân hàng
 */
export interface SupplierBankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
}

/**
 * Nhà cung cấp
 */
export interface Supplier {
  id: string;
  code: string;                    // Mã NCC: NCC001
  name: string;                    // Tên nhà cung cấp
  shortName?: string;              // Tên viết tắt
  supplierType: SupplierType;
  supplierGroup: SupplierGroup;

  // Thông tin pháp lý
  taxCode?: string;                // Mã số thuế
  businessLicense?: string;        // Số ĐKKD
  legalRepresentative?: string;    // Người đại diện pháp luật

  // Địa chỉ
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;

  // Liên hệ
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  contacts: SupplierContact[];

  // Ngân hàng
  bankAccounts: SupplierBankAccount[];

  // Điều khoản thanh toán
  paymentTermDays: number;         // Số ngày được nợ (mặc định 0)
  creditLimit?: number;            // Hạn mức công nợ

  // Kế toán
  accountCode: string;             // TK công nợ (mặc định 331)

  // Trạng thái
  status: SupplierStatus;

  // Ghi chú
  note?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Filter tìm kiếm nhà cung cấp
 */
export interface SupplierFilter {
  search?: string;
  supplierType?: SupplierType;
  supplierGroup?: SupplierGroup;
  status?: SupplierStatus;
}

/**
 * Tổng hợp công nợ NCC
 */
export interface SupplierDebtSummary {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const SUPPLIER_TYPES: { value: SupplierType; label: string }[] = [
  { value: 'MANUFACTURER', label: 'Nhà sản xuất' },
  { value: 'DISTRIBUTOR', label: 'Nhà phân phối' },
  { value: 'WHOLESALER', label: 'Bán buôn' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'OTHER', label: 'Khác' }
];

export const SUPPLIER_GROUPS: { value: SupplierGroup; label: string }[] = [
  { value: 'GOODS', label: 'Hàng hóa' },
  { value: 'MATERIAL', label: 'Nguyên vật liệu' },
  { value: 'ASSET', label: 'Tài sản cố định' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'UTILITY', label: 'Điện nước, viễn thông' },
  { value: 'OTHER', label: 'Khác' }
];

export const SUPPLIER_STATUS: { value: SupplierStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateSupplierCode(sequence: number): string {
  return `NCC${String(sequence).padStart(4, '0')}`;
}

export function validateSupplier(supplier: Partial<Supplier>): string[] {
  const errors: string[] = [];
  if (!supplier.code?.trim()) errors.push('Mã NCC là bắt buộc');
  if (!supplier.name?.trim()) errors.push('Tên NCC là bắt buộc');
  if (!supplier.address?.trim()) errors.push('Địa chỉ là bắt buộc');
  return errors;
}

export function formatSupplierAddress(supplier: Supplier): string {
  const parts = [supplier.address];
  if (supplier.ward) parts.push(supplier.ward);
  if (supplier.district) parts.push(supplier.district);
  if (supplier.province) parts.push(supplier.province);
  return parts.filter(p => p).join(', ');
}
