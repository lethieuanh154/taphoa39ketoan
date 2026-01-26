/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GIÁ VỐN HÀNG BÁN - COST OF GOODS SOLD (COGS)
 * TK 632 - Theo Thông tư 133/2016/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phương pháp tính giá vốn
 */
export type CostingMethod =
  | 'FIFO'              // Nhập trước - Xuất trước
  | 'WEIGHTED_AVERAGE'  // Bình quân gia quyền
  | 'SPECIFIC';         // Đích danh (từng lô)

/**
 * Loại giao dịch giá vốn
 */
export type COGSTransactionType =
  | 'SALE'              // Xuất bán hàng
  | 'RETURN'            // Trả lại hàng mua
  | 'INTERNAL_USE'      // Sử dụng nội bộ
  | 'WRITE_OFF'         // Hao hụt, mất mát
  | 'ADJUSTMENT';       // Điều chỉnh

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chi tiết giá vốn theo sản phẩm
 */
export interface COGSLine {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;

  // Số lượng và đơn giá
  quantity: number;
  unitCost: number;         // Đơn giá vốn
  totalCost: number;        // Tổng giá vốn

  // Giá bán (để tính lãi gộp)
  sellingPrice?: number;
  revenue?: number;
  grossProfit?: number;

  // Thông tin kho
  warehouseId?: string;
  warehouseName?: string;

  // Chứng từ liên quan
  voucherId?: string;
  voucherNo?: string;
  voucherDate?: Date;

  // Phương pháp tính
  costingMethod: CostingMethod;
}

/**
 * Bản ghi giá vốn
 */
export interface COGSEntry {
  id: string;
  entryNo: string;
  entryDate: Date;

  // Loại giao dịch
  transactionType: COGSTransactionType;

  // Chứng từ gốc
  sourceVoucherId: string;
  sourceVoucherNo: string;
  sourceVoucherType: string;  // ISSUE, INVOICE, etc.

  // Đối tượng
  customerId?: string;
  customerName?: string;

  // Chi tiết
  lines: COGSLine[];

  // Tổng cộng
  totalQuantity: number;
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  grossProfitMargin: number;  // %

  // Kế toán
  debitAccount: string;       // TK Nợ: 632
  creditAccount: string;      // TK Có: 1561

  // Trạng thái
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';

  // Ghi chú
  notes?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  postedAt?: Date;
  postedBy?: string;
}

/**
 * Báo cáo giá vốn theo sản phẩm
 */
export interface COGSByProduct {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;

  // Kỳ báo cáo
  openingQuantity: number;
  openingCost: number;

  purchaseQuantity: number;
  purchaseCost: number;

  soldQuantity: number;
  soldCost: number;           // Giá vốn xuất bán

  closingQuantity: number;
  closingCost: number;

  // Hiệu quả
  revenue: number;
  grossProfit: number;
  grossProfitMargin: number;
}

/**
 * Tổng hợp giá vốn theo kỳ
 */
export interface COGSSummary {
  period: string;             // "01/2025"
  fromDate: Date;
  toDate: Date;

  // Tổng giá vốn
  totalCOGS: number;
  totalRevenue: number;
  totalGrossProfit: number;
  avgGrossMargin: number;

  // Chi tiết theo loại
  byType: {
    type: COGSTransactionType;
    label: string;
    cost: number;
    percentage: number;
  }[];

  // Top sản phẩm
  topProducts: {
    productCode: string;
    productName: string;
    soldQuantity: number;
    cost: number;
    revenue: number;
    profit: number;
    margin: number;
  }[];

  // Số lượng giao dịch
  entryCount: number;
  lineCount: number;
}

/**
 * Filter
 */
export interface COGSFilter {
  fromDate?: Date;
  toDate?: Date;
  productId?: string;
  customerId?: string;
  warehouseId?: string;
  transactionType?: COGSTransactionType;
  status?: 'DRAFT' | 'POSTED' | 'CANCELLED';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const COSTING_METHODS: { value: CostingMethod; label: string; description: string }[] = [
  { value: 'FIFO', label: 'FIFO', description: 'Nhập trước - Xuất trước' },
  { value: 'WEIGHTED_AVERAGE', label: 'Bình quân gia quyền', description: 'Tính giá bình quân theo số lượng tồn' },
  { value: 'SPECIFIC', label: 'Đích danh', description: 'Theo từng lô hàng cụ thể' }
];

export const COGS_TRANSACTION_TYPES: { value: COGSTransactionType; label: string }[] = [
  { value: 'SALE', label: 'Xuất bán hàng' },
  { value: 'RETURN', label: 'Trả lại hàng mua' },
  { value: 'INTERNAL_USE', label: 'Sử dụng nội bộ' },
  { value: 'WRITE_OFF', label: 'Hao hụt, mất mát' },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh' }
];

/**
 * Tài khoản kế toán liên quan
 */
export const COGS_ACCOUNTS = {
  COGS: '632',                  // Giá vốn hàng bán
  INVENTORY: '1561',            // Hàng hóa
  FINISHED_GOODS: '155',        // Thành phẩm
  RAW_MATERIALS: '152',         // Nguyên vật liệu
  SUPPLIES: '153'               // Công cụ dụng cụ
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tính giá vốn theo phương pháp bình quân gia quyền
 */
export function calculateWeightedAverageCost(
  openingQty: number,
  openingCost: number,
  purchaseQty: number,
  purchaseCost: number
): number {
  const totalQty = openingQty + purchaseQty;
  if (totalQty === 0) return 0;
  return (openingCost + purchaseCost) / totalQty;
}

/**
 * Tính lãi gộp
 */
export function calculateGrossProfit(revenue: number, cogs: number): number {
  return revenue - cogs;
}

/**
 * Tính tỷ suất lãi gộp
 */
export function calculateGrossProfitMargin(revenue: number, cogs: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cogs) / revenue) * 100;
}

/**
 * Tạo số chứng từ giá vốn
 */
export function generateCOGSEntryNo(date: Date): string {
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `GV-${dateStr}-${random}`;
}

/**
 * Validate entry
 */
export function validateCOGSEntry(entry: Partial<COGSEntry>): string[] {
  const errors: string[] = [];
  if (!entry.entryDate) errors.push('Ngày ghi nhận là bắt buộc');
  if (!entry.sourceVoucherNo) errors.push('Chứng từ gốc là bắt buộc');
  if (!entry.lines || entry.lines.length === 0) errors.push('Phải có ít nhất 1 dòng chi tiết');
  return errors;
}
