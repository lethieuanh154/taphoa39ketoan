/**
 * WAREHOUSE MODELS - Phiếu Nhập/Xuất Kho
 * Theo Thông tư 133/2016/TT-BTC
 *
 * TK 156 - Hàng hóa
 * TK 155 - Thành phẩm
 * TK 152 - Nguyên liệu, vật liệu
 * TK 153 - Công cụ, dụng cụ
 */

// ═══════════════════════════════════════════════════════════════════
// ENUMS & TYPES
// ═══════════════════════════════════════════════════════════════════

/** Loại phiếu kho */
export type WarehouseVoucherType = 'RECEIPT' | 'ISSUE';

/** Trạng thái phiếu kho */
export type WarehouseVoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

/** Loại nhập kho */
export type ReceiptType =
  | 'PURCHASE'        // Nhập mua
  | 'RETURN_SALE'     // Nhập hàng bán bị trả lại
  | 'TRANSFER_IN'     // Nhập điều chuyển nội bộ
  | 'PRODUCTION'      // Nhập thành phẩm sản xuất
  | 'INVENTORY_PLUS'  // Kiểm kê thừa
  | 'OTHER_IN';       // Nhập khác

/** Loại xuất kho */
export type IssueType =
  | 'SALE'            // Xuất bán
  | 'RETURN_PURCHASE' // Xuất trả lại NCC
  | 'TRANSFER_OUT'    // Xuất điều chuyển nội bộ
  | 'PRODUCTION_USE'  // Xuất sử dụng sản xuất
  | 'INVENTORY_MINUS' // Kiểm kê thiếu
  | 'OTHER_OUT';      // Xuất khác

/** Mapping loại nhập kho */
export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  PURCHASE: 'Nhập mua',
  RETURN_SALE: 'Nhập hàng bán bị trả lại',
  TRANSFER_IN: 'Nhập điều chuyển nội bộ',
  PRODUCTION: 'Nhập thành phẩm sản xuất',
  INVENTORY_PLUS: 'Kiểm kê thừa',
  OTHER_IN: 'Nhập khác'
};

/** Mapping loại xuất kho */
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  SALE: 'Xuất bán',
  RETURN_PURCHASE: 'Xuất trả lại NCC',
  TRANSFER_OUT: 'Xuất điều chuyển nội bộ',
  PRODUCTION_USE: 'Xuất sử dụng sản xuất',
  INVENTORY_MINUS: 'Kiểm kê thiếu',
  OTHER_OUT: 'Xuất khác'
};

/** Mapping trạng thái */
export const VOUCHER_STATUS_LABELS: Record<WarehouseVoucherStatus, string> = {
  DRAFT: 'Nháp',
  POSTED: 'Đã ghi sổ',
  CANCELLED: 'Đã hủy'
};

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

/** Chi tiết phiếu kho */
export interface WarehouseVoucherLine {
  id: string;
  lineNo: number;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  inventoryAccount: string;  // TK kho: 156, 155, 152, 153
  expenseAccount?: string;   // TK chi phí/giá vốn: 632, 621, 627
  warehouseCode?: string;    // Mã kho (nếu nhiều kho)
  batchNo?: string;          // Số lô
  expiryDate?: Date;         // Hạn sử dụng
  note?: string;
}

/** Phiếu nhập/xuất kho */
export interface WarehouseVoucher {
  id: string;
  voucherNo: string;           // Số phiếu: PNK-001, PXK-001
  voucherType: WarehouseVoucherType;
  receiptType?: ReceiptType;   // Loại nhập (nếu RECEIPT)
  issueType?: IssueType;       // Loại xuất (nếu ISSUE)
  voucherDate: Date;
  status: WarehouseVoucherStatus;

  // Đối tượng liên quan
  partnerId?: string;          // Mã KH/NCC
  partnerName?: string;        // Tên KH/NCC
  partnerCode?: string;

  // Chứng từ gốc
  refVoucherNo?: string;       // Số CT gốc (HĐ, ĐH)
  refVoucherDate?: Date;
  refVoucherType?: string;     // 'INVOICE' | 'ORDER'

  // Kho
  warehouseCode: string;       // Mã kho
  warehouseName: string;       // Tên kho

  // Người thực hiện
  keeper?: string;             // Thủ kho
  receiver?: string;           // Người nhận (xuất) / giao (nhập)

  // Chi tiết
  lines: WarehouseVoucherLine[];

  // Tổng hợp
  totalQuantity: number;
  totalAmount: number;

  // Bút toán
  debitAccount: string;        // TK Nợ
  creditAccount: string;       // TK Có

  // Ghi chú
  description?: string;
  note?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  postedAt?: Date;
  postedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
}

/** Bộ lọc phiếu kho */
export interface WarehouseVoucherFilter {
  voucherType?: WarehouseVoucherType;
  receiptType?: ReceiptType;
  issueType?: IssueType;
  status?: WarehouseVoucherStatus;
  fromDate?: Date;
  toDate?: Date;
  warehouseCode?: string;
  partnerId?: string;
  productId?: string;
  searchText?: string;
}

/** Thống kê phiếu kho */
export interface WarehouseVoucherSummary {
  totalVouchers: number;
  draftCount: number;
  postedCount: number;
  cancelledCount: number;
  totalQuantity: number;
  totalAmount: number;
}

/** Thẻ kho - theo dõi tồn kho theo sản phẩm */
export interface StockCard {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  warehouseCode: string;
  openingQty: number;
  openingAmount: number;
  receiptQty: number;
  receiptAmount: number;
  issueQty: number;
  issueAmount: number;
  closingQty: number;
  closingAmount: number;
  movements: StockMovement[];
}

/** Chi tiết biến động kho */
export interface StockMovement {
  date: Date;
  voucherNo: string;
  voucherType: WarehouseVoucherType;
  description: string;
  receiptQty: number;
  receiptAmount: number;
  issueQty: number;
  issueAmount: number;
  balanceQty: number;
  balanceAmount: number;
}

/** Danh mục kho */
export interface Warehouse {
  code: string;
  name: string;
  address?: string;
  keeper?: string;
  phone?: string;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT VALUES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Danh sách kho mặc định */
export const DEFAULT_WAREHOUSES: Warehouse[] = [
  { code: 'KHO1', name: 'Kho chính', address: 'Số 39, Đường ABC', keeper: 'Nguyễn Văn A', isActive: true },
  { code: 'KHO2', name: 'Kho phụ', address: 'Số 40, Đường XYZ', keeper: 'Trần Văn B', isActive: true }
];

/** Tạo phiếu kho rỗng */
export function createEmptyWarehouseVoucher(type: WarehouseVoucherType): Partial<WarehouseVoucher> {
  return {
    voucherType: type,
    voucherDate: new Date(),
    status: 'DRAFT',
    warehouseCode: 'KHO1',
    warehouseName: 'Kho chính',
    lines: [],
    totalQuantity: 0,
    totalAmount: 0,
    debitAccount: type === 'RECEIPT' ? '156' : '632',
    creditAccount: type === 'RECEIPT' ? '331' : '156',
    createdAt: new Date(),
    createdBy: 'admin'
  };
}

/** Tạo dòng chi tiết rỗng */
export function createEmptyVoucherLine(): Partial<WarehouseVoucherLine> {
  return {
    id: '',
    lineNo: 1,
    productId: '',
    productCode: '',
    productName: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    inventoryAccount: '156'
  };
}

/** Mapping bút toán theo loại nhập kho */
export const RECEIPT_JOURNAL_MAPPING: Record<ReceiptType, { debit: string; credit: string; description: string }> = {
  PURCHASE: { debit: '156', credit: '331', description: 'Nhập kho hàng mua' },
  RETURN_SALE: { debit: '156', credit: '632', description: 'Nhập kho hàng bán bị trả lại' },
  TRANSFER_IN: { debit: '156', credit: '156', description: 'Nhập điều chuyển nội bộ' },
  PRODUCTION: { debit: '155', credit: '154', description: 'Nhập kho thành phẩm' },
  INVENTORY_PLUS: { debit: '156', credit: '711', description: 'Nhập kho kiểm kê thừa' },
  OTHER_IN: { debit: '156', credit: '338', description: 'Nhập kho khác' }
};

/** Mapping bút toán theo loại xuất kho */
export const ISSUE_JOURNAL_MAPPING: Record<IssueType, { debit: string; credit: string; description: string }> = {
  SALE: { debit: '632', credit: '156', description: 'Xuất kho bán hàng' },
  RETURN_PURCHASE: { debit: '331', credit: '156', description: 'Xuất kho trả lại NCC' },
  TRANSFER_OUT: { debit: '156', credit: '156', description: 'Xuất điều chuyển nội bộ' },
  PRODUCTION_USE: { debit: '621', credit: '152', description: 'Xuất kho sử dụng SX' },
  INVENTORY_MINUS: { debit: '811', credit: '156', description: 'Xuất kho kiểm kê thiếu' },
  OTHER_OUT: { debit: '811', credit: '156', description: 'Xuất kho khác' }
};

/** Tính tổng phiếu kho */
export function calculateVoucherTotals(lines: WarehouseVoucherLine[]): { totalQuantity: number; totalAmount: number } {
  return lines.reduce((acc, line) => ({
    totalQuantity: acc.totalQuantity + line.quantity,
    totalAmount: acc.totalAmount + line.amount
  }), { totalQuantity: 0, totalAmount: 0 });
}

/** Tính thành tiền dòng chi tiết */
export function calculateLineAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}
