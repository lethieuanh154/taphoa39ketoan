import { AccountHistoryEntry } from './chart-of-accounts.models';

/**
 * DANH MỤC ĐỐI TƯỢNG (ledger-rs `/api/ledger/partners`, spec 002-danh-muc-doi-tuong)
 *
 * Mỗi bản ghi đúng 1 vai (= `detailType` của TK). 1 công ty vừa mua vừa bán = 2 bản ghi (KH… + NCC…) cùng MST.
 * Mã không bao giờ sửa; để trống khi tạo → BE tự cấp KH0001 / NCC0001 / NV0001 / NH0001.
 */

export type PartnerRole = 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'BANK';
export type PartnerStatus = 'ACTIVE' | 'INACTIVE';

export interface Partner {
  code: string;
  role: PartnerRole;
  name: string;
  taxCode?: string;          // 10 số, 10-3 số hoặc 12 số; không trùng trong cùng vai
  address: string;
  phone: string;
  email: string;
  note: string;
  bankAccountNo?: string;    // chỉ vai BANK (bắt buộc, không trùng)
  bankName?: string;         // chỉ vai BANK (bắt buộc)
  bankBranch?: string;       // chỉ vai BANK
  status: PartnerStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface PartnerFilter {
  search?: string;           // mã / MST theo tiền tố, tên có hoặc không dấu
  role?: PartnerRole;
  status?: PartnerStatus;
}

export interface NewPartnerInput {
  code?: string;             // trống → tự cấp
  role: PartnerRole;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  note?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankBranch?: string;
  status?: PartnerStatus;
}

/** Sửa: mọi trường trừ mã, vai. Chuỗi rỗng = xóa giá trị (vd bỏ MST). */
export type PartnerPatch = Partial<Omit<NewPartnerInput, 'code' | 'role'>>;

export type PartnerHistoryEntry = AccountHistoryEntry;

/** 1 dòng gửi lên khi tạo từ XML (FE đã gộp theo MST) */
export interface PartnerImportItem {
  taxCode: string;
  name: string;
  address?: string;
}

/** MST đã có cùng vai nhưng tên / địa chỉ trong XML khác bản đang lưu (giá trị XML rỗng không tính là khác) */
export interface PartnerImportChange {
  code: string;
  taxCode: string;
  oldName: string;
  newName: string;
  oldAddress: string;
  newAddress: string;
  fields: ('name' | 'address')[];
  applied: boolean;          // true = đã cập nhật theo XML (chỉ khi ghi thật + kế toán đã tick)
}

export interface PartnerImportResult {
  dryRun: boolean;
  create: { code?: string; taxCode: string; name: string }[];   // code chỉ có khi ghi thật
  update: PartnerImportChange[];
  skip: { taxCode: string; name: string; reason: string; code?: string }[];
}

export const PARTNER_ROLES: { value: PartnerRole; label: string; prefix: string }[] = [
  { value: 'CUSTOMER', label: 'Khách hàng', prefix: 'KH' },
  { value: 'SUPPLIER', label: 'Nhà cung cấp', prefix: 'NCC' },
  { value: 'EMPLOYEE', label: 'Nhân viên', prefix: 'NV' },
  { value: 'BANK', label: 'Ngân hàng', prefix: 'NH' }
];

export function getPartnerRoleName(role: PartnerRole): string {
  return PARTNER_ROLES.find(r => r.value === role)?.label ?? role;
}

export function getPartnerStatusName(status: PartnerStatus): string {
  return status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng';
}

/** Giống CHECK ở DB — chỉ để báo sớm trên form, BE vẫn là nơi quyết định */
export const TAX_CODE_RE = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/;
export const PARTNER_CODE_RE = /^[A-Z0-9_-]{1,20}$/;

export function normalizeTaxCode(v: string | undefined | null): string {
  return (v ?? '').replace(/\s+/g, '');
}
