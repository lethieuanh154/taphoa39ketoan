/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DANH MỤC HÀNG HÓA - PRODUCT MASTER
 * Quản lý hàng hóa, dịch vụ cho mua/bán, kho (TK 156, 155, 152, 153)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại hàng hóa
 */
export type ProductType =
  | 'GOODS'         // Hàng hóa (TK 156)
  | 'FINISHED'      // Thành phẩm (TK 155)
  | 'MATERIAL'      // Nguyên vật liệu (TK 152)
  | 'TOOL'          // Công cụ dụng cụ (TK 153)
  | 'SERVICE';      // Dịch vụ

/**
 * Nhóm hàng hóa
 */
export type ProductGroup =
  | 'FOOD'          // Thực phẩm
  | 'BEVERAGE'      // Đồ uống
  | 'HOUSEHOLD'     // Gia dụng
  | 'ELECTRONICS'   // Điện tử
  | 'STATIONERY'    // Văn phòng phẩm
  | 'RAW_MATERIAL'  // Nguyên liệu
  | 'SERVICE'       // Dịch vụ
  | 'OTHER';        // Khác

/**
 * Phương pháp tính giá xuất kho
 */
export type CostingMethod =
  | 'FIFO'          // Nhập trước xuất trước
  | 'WEIGHTED_AVG'  // Bình quân gia quyền
  | 'SPECIFIC';     // Đích danh

/**
 * Trạng thái
 */
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Đơn vị tính
 */
export interface ProductUnit {
  unit: string;                    // Đơn vị: Cái, Hộp, Thùng
  conversionRate: number;          // Tỷ lệ quy đổi về ĐVT chính
  barcode?: string;                // Mã vạch
  isDefault: boolean;              // ĐVT chính
}

/**
 * Hàng hóa
 */
export interface Product {
  id: string;
  code: string;                    // Mã hàng: SP001
  barcode?: string;                // Mã vạch
  name: string;                    // Tên hàng hóa
  shortName?: string;              // Tên viết tắt
  productType: ProductType;
  productGroup: ProductGroup;

  // Đơn vị tính
  unit: string;                    // ĐVT chính
  units: ProductUnit[];            // Danh sách ĐVT

  // Giá
  costPrice: number;               // Giá vốn
  salePrice: number;               // Giá bán
  minPrice?: number;               // Giá bán tối thiểu
  maxPrice?: number;               // Giá bán tối đa

  // Thuế
  vatRate: number;                 // Thuế suất GTGT (0, 5, 8, 10, -1, -2)

  // Kho
  costingMethod: CostingMethod;    // PP tính giá xuất
  minStock?: number;               // Tồn kho tối thiểu
  maxStock?: number;               // Tồn kho tối đa
  currentStock: number;            // Tồn kho hiện tại

  // Kế toán
  inventoryAccount: string;        // TK tồn kho (156, 155, 152, 153)
  revenueAccount: string;          // TK doanh thu (511x)
  cogsAccount: string;             // TK giá vốn (632)
  purchaseAccount: string;         // TK mua hàng (1561, 152...)

  // Mô tả
  description?: string;
  specifications?: string;         // Quy cách
  origin?: string;                 // Xuất xứ
  brand?: string;                  // Thương hiệu
  warranty?: string;               // Bảo hành

  // Hình ảnh
  imageUrl?: string;

  // Trạng thái
  status: ProductStatus;

  // Nhà cung cấp chính
  primarySupplierId?: string;
  primarySupplierCode?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Filter
 */
export interface ProductFilter {
  search?: string;
  productType?: ProductType;
  productGroup?: ProductGroup;
  status?: ProductStatus;
  hasStock?: boolean;              // Có tồn kho
  lowStock?: boolean;              // Tồn kho thấp
}

/**
 * Tồn kho theo kho
 */
export interface ProductStock {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  costValue: number;               // Giá trị tồn
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const PRODUCT_TYPES: { value: ProductType; label: string; account: string }[] = [
  { value: 'GOODS', label: 'Hàng hóa', account: '156' },
  { value: 'FINISHED', label: 'Thành phẩm', account: '155' },
  { value: 'MATERIAL', label: 'Nguyên vật liệu', account: '152' },
  { value: 'TOOL', label: 'Công cụ dụng cụ', account: '153' },
  { value: 'SERVICE', label: 'Dịch vụ', account: '' }
];

export const PRODUCT_GROUPS: { value: ProductGroup; label: string }[] = [
  { value: 'FOOD', label: 'Thực phẩm' },
  { value: 'BEVERAGE', label: 'Đồ uống' },
  { value: 'HOUSEHOLD', label: 'Gia dụng' },
  { value: 'ELECTRONICS', label: 'Điện tử' },
  { value: 'STATIONERY', label: 'Văn phòng phẩm' },
  { value: 'RAW_MATERIAL', label: 'Nguyên liệu' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'OTHER', label: 'Khác' }
];

export const COSTING_METHODS: { value: CostingMethod; label: string }[] = [
  { value: 'WEIGHTED_AVG', label: 'Bình quân gia quyền' },
  { value: 'FIFO', label: 'Nhập trước xuất trước' },
  { value: 'SPECIFIC', label: 'Đích danh' }
];

export const PRODUCT_STATUS: { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Đang kinh doanh' },
  { value: 'INACTIVE', label: 'Tạm ngừng' },
  { value: 'DISCONTINUED', label: 'Ngừng kinh doanh' }
];

export const COMMON_UNITS = [
  'Cái', 'Chiếc', 'Bộ', 'Hộp', 'Thùng', 'Kg', 'Gram', 'Lít', 'Mét', 'M2', 'M3',
  'Tấn', 'Chai', 'Lon', 'Gói', 'Túi', 'Cuộn', 'Tờ', 'Quyển', 'Giờ', 'Ngày', 'Tháng'
];

export const VAT_RATES = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 10, label: '10%' },
  { value: -1, label: 'Không chịu thuế' },
  { value: -2, label: 'Không kê khai' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateProductCode(sequence: number): string {
  return `SP${String(sequence).padStart(4, '0')}`;
}

export function validateProduct(product: Partial<Product>): string[] {
  const errors: string[] = [];
  if (!product.code?.trim()) errors.push('Mã hàng hóa là bắt buộc');
  if (!product.name?.trim()) errors.push('Tên hàng hóa là bắt buộc');
  if (!product.unit?.trim()) errors.push('Đơn vị tính là bắt buộc');
  if (product.salePrice !== undefined && product.salePrice < 0) errors.push('Giá bán không được âm');
  if (product.costPrice !== undefined && product.costPrice < 0) errors.push('Giá vốn không được âm');
  return errors;
}

export function getInventoryAccount(productType: ProductType): string {
  const found = PRODUCT_TYPES.find(t => t.value === productType);
  return found?.account || '156';
}

export function isLowStock(product: Product): boolean {
  if (!product.minStock) return false;
  return product.currentStock < product.minStock;
}

export function isOverStock(product: Product): boolean {
  if (!product.maxStock) return false;
  return product.currentStock > product.maxStock;
}
