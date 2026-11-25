import { AccountHistoryEntry } from './chart-of-accounts.models';

/**
 * DANH MỤC HÀNG HÓA (ledger-rs `/api/ledger/items`, spec 003-danh-muc-hang-hoa)
 *
 * Mã theo quy ước Vietda: HH… (hàng hóa) / KM… (hàng khuyến mại); HH17 = HH0017 (so theo số). Để trống → BE tự cấp số LỚN NHẤT + 1.
 * ĐVT chính = ĐVT Vietda (kế toán). Hệ số luôn là CHUỖI (BE trả `numeric::text`, vd "30.000000") — không đổi sang number khi lưu.
 */

export type ItemKind = 'GOODS' | 'PROMO';
export type ItemStatus = 'ACTIVE' | 'INACTIVE';
export type VatRate = '0' | '5' | '8' | '10' | 'KCT' | 'KKKNT';

/** 1 <unit> = factor <ĐVT chính> */
export interface ItemUnit {
  unit: string;
  factor: string;
}

/** factor: 1 ĐVT chính = N ĐVT nhỏ nhất KiotViet (cùng nghĩa `he_so` Firestore) */
export interface ItemMaster {
  masterCode: string;
  masterId?: number;
  kvUnit: string;
  factor: string;
  source: 'import' | 'manual';
}

export interface Item {
  code: string;
  kind: ItemKind;
  name: string;
  unit: string;
  inventoryAccount: string;
  vatRate?: VatRate;
  note: string;
  status: ItemStatus;
  units: ItemUnit[];
  masters: ItemMaster[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface ItemFilter {
  search?: string;           // mã / mã master theo tiền tố, tên có hoặc không dấu
  kind?: ItemKind;
  status?: ItemStatus;
}

/** factor gửi lên: số hoặc chuỗi ("30", "0,25") — BE đổi sang Decimal */
export interface UnitInput {
  unit: string;
  factor: string | number;
}

export interface MasterInput {
  masterCode: string;
  masterId?: number;
  kvUnit?: string;
  factor?: string | number;
}

export interface NewItemInput {
  code?: string;             // trống → tự cấp theo kind
  kind?: ItemKind;
  name: string;
  unit: string;
  inventoryAccount?: string; // trống → 1561
  vatRate?: VatRate | '';
  note?: string;
  status?: ItemStatus;
  units?: UnitInput[];
  masters?: MasterInput[];
}

/** Đổi `unit` khi đã có ĐVT phụ / mã master → PHẢI kèm `units` (thay cả danh sách) + `masters` (hệ số mới MỌI mã master) — BE 409 LA224 */
export interface ItemPatch {
  name?: string;
  unit?: string;
  inventoryAccount?: string;
  vatRate?: VatRate | '';    // '' = bỏ thuế suất
  note?: string;
  status?: ItemStatus;
  units?: UnitInput[];
  masters?: MasterInput[];
}

export type ItemHistoryEntry = AccountHistoryEntry;

/** Kết quả nạp DM Vietda (xem trước / ghi) */
export interface VietdaImportResult {
  dryRun: boolean;
  rows: number;
  create: { code: string; name: string; unit: string }[];
  update: {
    code: string; fileCode: string; oldName: string; newName: string; oldUnit: string; newUnit: string;
    fields: ('name' | 'unit')[];
    unitLocked: boolean;     // đổi ĐVT mà đã có ĐVT phụ / mã master → nạp KHÔNG đổi ĐVT (sửa trên trang, nhập lại hệ số)
    applied: boolean;
  }[];
  same: number;
  skipTotal: number;
  skip: { key: string; reason: string }[];   // tối đa 300 dòng
}

/** 1 dòng bảng ghép mã master (Firestore qua FastAPI `/api/vietda-codes`) */
export interface MasterImportRow {
  masterCode: string;
  masterId?: number;
  hh: string;
  kvUnit?: string;
  heSo?: number | string | null;   // null = 1
}

export interface MasterImportResult {
  dryRun: boolean;
  link: { masterCode: string; itemCode: string }[];
  filledId: number;
  skipTotal: number;
  skip: { key: string; reason: string }[];
  conflict: { key: string; reason: string }[];
}

export const ITEM_KINDS: { value: ItemKind; label: string; prefix: string }[] = [
  { value: 'GOODS', label: 'Hàng hóa', prefix: 'HH' },
  { value: 'PROMO', label: 'Hàng khuyến mại', prefix: 'KM' }
];

export const VAT_RATES: { value: VatRate; label: string }[] = [
  { value: '0', label: '0%' }, { value: '5', label: '5%' }, { value: '8', label: '8%' }, { value: '10', label: '10%' },
  { value: 'KCT', label: 'Không chịu thuế' }, { value: 'KKKNT', label: 'Không kê khai, nộp thuế' }
];

/** Giống CHECK ở DB — chỉ để báo sớm trên form */
export const ITEM_CODE_RE = /^(HH|KM)[0-9]{1,6}$/;

export function getItemKindName(kind: ItemKind): string {
  return ITEM_KINDS.find(k => k.value === kind)?.label ?? kind;
}

/** "30.000000" → "30"; "0.250000" → "0.25" (hiển thị) */
export function formatFactor(f: string): string {
  return f.includes('.') ? f.replace(/0+$/, '').replace(/\.$/, '') : f;
}

/** "1 Thùng = 30 gói" */
export function unitText(u: ItemUnit, mainUnit: string): string {
  return `1 ${u.unit} = ${formatFactor(u.factor)} ${mainUnit}`;
}

/** "1 gói = 4 lốc (KiotViet)" */
export function masterFactorText(m: ItemMaster, mainUnit: string): string {
  return `1 ${mainUnit} = ${formatFactor(m.factor)} ${m.kvUnit || 'ĐVT KiotViet'}`;
}
