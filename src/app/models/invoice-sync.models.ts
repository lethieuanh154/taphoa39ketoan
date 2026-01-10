/**
 * INVOICE SYNC MODELS
 * Models for invoice synchronization between tax portal and local system
 */

/**
 * Hóa đơn đầu vào (Purchase Invoice / Input Invoice)
 */
export interface HoaDonDauVao {
  id?: string;                  // Firestore document ID
  soHoaDon: string;             // Invoice number
  ngayHoaDon: string;           // Invoice date (YYYY-MM-DD)
  maSoThueNCC: string;          // Supplier tax code
  tenNCC: string;               // Supplier name
  tongTien: number;             // Total amount
  thueGTGT: number;             // VAT amount
  nguon: NguonDuLieu;           // Data source
  ocrConfidence?: number;       // OCR confidence (for local invoices)
}

/**
 * Hóa đơn đầu ra (Sales Invoice / Output Invoice)
 */
export interface HoaDonDauRa {
  id?: string;                  // Firestore document ID
  soHoaDon: string;             // Invoice number
  ngayHoaDon: string;           // Invoice date (YYYY-MM-DD)
  maSoThueKH: string;           // Customer tax code
  tenKhachHang: string;         // Customer name
  tongTien: number;             // Total amount
  thueGTGT: number;             // VAT amount
  nguon: NguonDuLieu;           // Data source
}

/**
 * Nguồn dữ liệu
 */
export enum NguonDuLieu {
  TRANG_THUE = 'TRANG_THUE',     // From tax portal (gdt.gov.vn)
  LOCAL = 'LOCAL',               // From local files/OCR
  HE_THONG = 'HE_THONG'         // From internal system/API
}

/**
 * Kết quả so sánh hóa đơn đầu vào
 */
export interface KetQuaSoSanhDauVao {
  soHoaDon: string;
  ngayHoaDon: string;
  tenNCC: string;
  nguonBiLech: string;          // Which source has discrepancy
  truongKhongKhop: string[];    // Fields that don't match
  duLieuTrangThue: Partial<HoaDonDauVao> | null;
  duLieuLocal: Partial<HoaDonDauVao> | null;
  trangThai: TrangThaiDongBo;   // Sync status
}

/**
 * Kết quả so sánh hóa đơn đầu ra
 */
export interface KetQuaSoSanhDauRa {
  soHoaDon: string;
  ngayHoaDon: string;
  tenKhachHang: string;
  nguonBiLech: string;
  truongKhongKhop: string[];
  duLieuTrangThue: Partial<HoaDonDauRa> | null;
  duLieuHeThong: Partial<HoaDonDauRa> | null;
  trangThai: TrangThaiDongBo;
}

/**
 * Trạng thái đồng bộ
 */
export enum TrangThaiDongBo {
  THIEU_O_TRANG_THUE = 'THIEU_O_TRANG_THUE',       // Missing on tax portal
  THIEU_O_LOCAL = 'THIEU_O_LOCAL',                 // Missing in local data
  THIEU_O_HE_THONG = 'THIEU_O_HE_THONG',           // Missing in system
  SAI_DU_LIEU = 'SAI_DU_LIEU',                     // Data mismatch
  KHOP = 'KHOP'                                     // Matched
}

/**
 * Bộ lọc theo ngày/tháng
 */
export interface FilterNgayThang {
  tuNgay?: string;    // From date (YYYY-MM-DD)
  denNgay?: string;   // To date (YYYY-MM-DD)
  thang?: number;     // Month (1-12)
  nam?: number;       // Year
}

/**
 * Kết quả tổng hợp so sánh
 */
export interface TongHopSoSanh {
  tongSoHoaDonTrangThue: number;
  tongSoHoaDonLocal: number;
  soHoaDonKhop: number;
  soHoaDonKhongKhop: number;
  soHoaDonThieu: number;
}

/**
 * Kết quả import file
 */
export interface ImportResult {
  totalFiles: number;
  totalInvoices: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors?: string[];
}

/**
 * Dữ liệu hóa đơn từ AI parsing (Gemini 3 Flash)
 * Schema mới cho internal_invoices
 */
export interface AiInvoiceData {
  invoiceNo: string;
  invoiceSymbol?: string;
  invoiceDate: string;              // YYYY-MM-DD
  supplier: {
    name: string;
    taxCode: string;
    address?: string;
  };
  buyer?: {
    name?: string;
    taxCode?: string;
  };
  items: AiInvoiceItem[];
  totalBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  confidence?: number;              // 0-1, from AI parsing
}

/**
 * Chi tiết hàng hóa trong hóa đơn AI
 */
export interface AiInvoiceItem {
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Record đối chiếu từ server
 */
export interface ReconciliationRecord {
  invoiceKey: string;
  taxInvoiceId: string | null;
  internalInvoiceId: string | null;
  status: 'MATCH' | 'MISSING_INTERNAL' | 'MISSING_TAX' | 'MISMATCH';
  diff: {
    totalAmount: number;
    vatAmount: number;
  };
  taxData?: {
    invoiceNo: string;
    invoiceDate: string;
    sellerName: string;
    sellerTaxCode: string;
    totalAmount: number;
    vatAmount: number;
  };
  internalData?: {
    invoiceNo: string;
    invoiceDate: string;
    supplierName: string;
    supplierTaxCode: string;
    totalAmount: number;
    vatAmount: number;
    ocrConfidence?: number;
  };
  checkedAt?: string;
}

/**
 * Kết quả đối chiếu từ server
 */
export interface ReconciliationResult {
  summary: TongHopSoSanh;
  reconciliations: ReconciliationRecord[];
}
