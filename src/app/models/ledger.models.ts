/**
 * Accounting Ledger Models
 * Circular 88/2021/TT-BTC - Appendix 2 Compliant
 * Vietnamese Household Business (Hộ Kinh Doanh) - 7 Sổ Kế Toán
 * Mẫu sổ kế toán: S1-HKD → S7-HKD
 */

// ============ COMMON TYPES ============
export interface ChungTu {
  soHieu: string;      // Số hiệu
  ngayThang: Date;     // Ngày, tháng
}

export interface LedgerHeader {
  tenHoKinhDoanh: string;           // HỘ, CÁ NHÂN KINH DOANH
  diaChi: string;                   // Địa chỉ
  tenDiaDiemKinhDoanh?: string;     // Tên địa điểm kinh doanh
  nam: number;                      // Năm
  mauSo: string;                    // Mẫu số (S1-HKD, S2-HKD, etc.)
}

// ============ S1-HKD: SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ ============
export interface S1_DoanhThu {
  id?: string;
  ngayThangGhiSo: Date;                        // Cột A: Ngày, tháng ghi sổ
  chungTu: ChungTu;                            // Cột B, C: Chứng từ
  dienGiai: string;                            // Cột D: Diễn giải
  // Doanh thu bán hàng hóa, dịch vụ:
  doanhThuPhanPhoi: number;                    // Phân phối, cung cấp hàng hóa
  doanhThuDichVu?: number;                     // Dịch vụ (optional)
  doanhThuSanXuat?: number;                    // Sản xuất (optional)
  doanhThuKhac: number;                        // Hoạt động kinh doanh khác
  ghiChu?: string;                             // Ghi chú
}

// ============ S2-HKD: SỔ CHI TIẾT VẬT LIỆU, DỤNG CỤ, SẢN PHẨM, HÀNG HÓA ============
export interface S2_VatLieu {
  id?: string;
  chungTu: ChungTu;                            // Chứng từ (Số hiệu, Ngày tháng)
  dienGiai: string;                            // Diễn giải
  donViTinh: string;                           // Đơn vị tính
  donGia: number;                              // Đơn giá
  // Nhập
  nhapSoLuong: number;                         // Số lượng nhập
  nhapThanhTien: number;                       // Thành tiền nhập
  // Xuất
  xuatSoLuong: number;                         // Số lượng xuất
  xuatThanhTien: number;                       // Thành tiền xuất
  // Tồn
  tonSoLuong: number;                          // Số lượng tồn
  tonThanhTien: number;                        // Thành tiền tồn
  ghiChu?: string;                             // Ghi chú
}

// ============ S3-HKD: SỔ CHI PHÍ SẢN XUẤT, KINH DOANH ============
export interface S3_ChiPhi {
  id?: string;
  ngayThangGhiSo: Date;                        // Cột A: Ngày, tháng ghi sổ
  chungTu: ChungTu;                            // Cột B, C: Chứng từ
  dienGiai: string;                            // Cột D: Diễn giải
  tongSoTien: number;                          // Tổng số tiền (cột E)
  // Chia ra (7 cột phân loại chi phí theo TT88):
  tienVatLieu: number;                         // Tiền vật liệu, dụng cụ, hàng hóa (cột 1)
  tienNhanCong: number;                        // Tiền nhân công (cột 2)
  chiPhiKhauHao: number;                       // Chi phí khấu hao TSCĐ (cột 3)
  chiPhiThueMatBang: number;                   // Chi phí thuê nhà, đất, mặt bằng SXKD (cột 4)
  chiPhiDienNuoc: number;                      // Chi phí điện, nước, nhiên liệu (cột 5)
  chiPhiVanChuyen: number;                     // Chi phí vận chuyển (cột 6)
  chiPhiMuaNgoaiKhac: number;                  // Chi phí mua ngoài khác (cột 7)
}

// ============ S4-HKD: SỔ THEO DÕI TÌNH HÌNH THỰC HIỆN NGHĨA VỤ THUẾ VỚI NSNN ============
export interface S4_NghiaVuThue {
  id?: string;
  chungTu: ChungTu;                            // Chứng từ (Số hiệu, Ngày tháng)
  dienGiai: string;                            // Diễn giải
  soThuePhaINop: number;                       // Số thuế phải nộp (cột 1)
  soThueDaNop: number;                         // Số thuế đã nộp (cột 2)
  ghiChu?: string;                             // Ghi chú
}

// ============ S5-HKD: SỔ THEO DÕI TÌNH HÌNH THANH TOÁN TIỀN LƯƠNG VÀ CÁC KHOẢN NỘP THEO LƯƠNG ============
export interface S5_TienLuong {
  id?: string;
  ngayThangGhiSo: Date;                        // Ngày, tháng ghi sổ
  chungTu: ChungTu;                            // Chứng từ (Số hiệu, Ngày tháng)
  dienGiai: string;                            // Diễn giải
  // Tiền lương (cột 1, 2, 3)
  luongPhaiTra: number;                        // Số phải trả
  luongDaTra: number;                          // Số đã trả
  luongConPhaiTra: number;                     // Số còn phải trả
  // BHXH (cột 4, 5, 6)
  bhxhPhaiNop: number;                         // Số phải nộp
  bhxhDaNop: number;                           // Số đã nộp
  bhxhConPhaiNop: number;                      // Số còn phải nộp
  // BHYT (cột 7, 8, 9)
  bhytPhaiNop: number;                         // Số phải nộp
  bhytDaNop: number;                           // Số đã nộp
  bhytConPhaiNop: number;                      // Số còn phải nộp
  // BHTN (cột 10, 11, 12)
  bhtnPhaiNop: number;                         // Số phải nộp
  bhtnDaNop: number;                           // Số đã nộp
  bhtnConPhaiNop: number;                      // Số còn phải nộp
  ghiChu?: string;                             // Ghi chú
}

// ============ S6-HKD: SỔ QUỸ TIỀN MẶT ============
export interface S6_QuyTienMat {
  id?: string;
  ngayThangGhiSo: Date;                        // Ngày, tháng ghi sổ (cột A)
  ngayThangChungTu: Date;                      // Ngày, tháng chứng từ (cột B)
  soHieuChungTu: string;                       // Số hiệu chứng từ (cột C)
  dienGiai: string;                            // Diễn giải (cột D)
  // Số tiền
  soTienThu: number;                           // Thu (cột 1)
  soTienChi: number;                           // Chi (cột 2)
  soTienTon: number;                           // Tồn (cột 3)
  ghiChu?: string;                             // Ghi chú (cột E)
}

// ============ S7-HKD: SỔ TIỀN GỬI NGÂN HÀNG ============
export interface S7_TienNganHang {
  id?: string;
  ngayThangGhiSo: Date;                        // Ngày, tháng ghi sổ (cột A)
  chungTu: ChungTu;                            // Chứng từ (Số hiệu B, Ngày tháng C)
  dienGiai: string;                            // Diễn giải (cột D)
  // Số tiền
  soTienGuiVao: number;                        // Gửi vào (cột 1)
  soTienRutRa: number;                         // Rút ra (cột 2)
  soTienConLai: number;                        // Còn lại (cột 3)
  ghiChu?: string;                             // Ghi chú (cột E)
}

// ============ FOOTER SUMMARY TYPES ============
export interface LedgerFooter {
  soDuDauKy?: number;
  soPhatSinhTrongKy?: number;
  congPhatSinhTrongKy?: number;
  soDuCuoiKy?: number;
  tongCong?: number;
}

// ============ BACKWARD COMPATIBILITY - OLD INTERFACES ============

export interface Ledger1DoanhThu {
  id?: string;
  ngayBan: Date;
  soHoaDon: string;
  hinhThucBan: 'TM' | 'CK';
  nhomHang: 'NuocNgot' | 'BanhKeo' | 'NhuYeuPham' | 'Khac';
  doanhThuChuaVAT: number;
  thueVAT: number;
  tongTienThanhToan: number;
  ghiChu?: string;
}

export interface Ledger2VatLieu {
  id?: string;
  ngay: Date;
  tenHang: string;
  donViTinh: string;
  tonDauKy: number;
  nhapTrongKy: number;
  xuatTrongKy: number;
  haoHutHuy?: number;
  tonCuoiKy: number;
  ghiChu?: string;
}

export interface Ledger3ChiPhi {
  id?: string;
  ngayChi: Date;
  noiDungChi: string;
  loaiChiPhi: 'GiaVon' | 'LuongCong' | 'ThueMBang' | 'DienNuoc' | 'VanChuyen' | 'Khac';
  soTienChuaVAT: number;
  vatKhauTru: number;
  tongTien: number;
  hinhThucThanhToan: 'TM' | 'CK';
  chungTuKemTheo?: string;
  ghiChu?: string;
}

export interface Ledger4ANhanVienChinhThuc {
  id?: string;
  thang: string;
  hoTen: string;
  luongCoBan: number;
  phuCap: number;
  tongLuong: number;
  bhxhNLD: number;
  bhxhChuHo: number;
  thucLinh: number;
  hinhThucTra: 'TM' | 'CK';
  kyNhan: boolean;
}

export interface Ledger4BNhanVienKhoan {
  id?: string;
  ngayChi: Date;
  hoTen: string;
  congViecKhoan: string;
  soTienKhoan: number;
  soCMND_CCCD: string;
  camKet08: boolean;
  thueTNCNKhauTru: number;
  soTienThucTra: number;
  kyNhan: boolean;
}

export interface Ledger5CongNo {
  id?: string;
  ngay: Date;
  doiTuong: string;
  loaiDoiTuong: 'NhaCungCap' | 'KhachHang';
  noiDung: string;
  phatsinhTang: number;
  phatsinhGiam: number;
  soDu: number;
  hanThanhToan: Date;
  ghiChu?: string;
}

export interface Ledger6QuyTienMat {
  id?: string;
  ngay: Date;
  noiDungThuChi: string;
  thu: number;
  chi: number;
  tonQuy: number;
  nguoiThuChi?: string;
  ghiChu?: string;
}

export interface Ledger7TienNganHang {
  id?: string;
  ngay: Date;
  soChungTu: string;
  noiDungGiaoDich: string;
  thu: number;
  chi: number;
  soDu: number;
  doiTuongLienQuan?: string;
  ghiChu?: string;
  highlight?: boolean;
}

export interface MonthYearFilter {
  month: number;
  year: number;
}

export interface LedgerStats {
  totalRows: number;
  sumByColumn?: { [key: string]: number };
}

export type AllLedgerTypes =
  | S1_DoanhThu
  | S2_VatLieu
  | S3_ChiPhi
  | S4_NghiaVuThue
  | S5_TienLuong
  | S6_QuyTienMat
  | S7_TienNganHang;

// ═══════════════════════════════════════════════════════════════════════════════
// SỔ CÁI THEO TÀI KHOẢN - GENERAL LEDGER BY ACCOUNT (DOANH NGHIỆP)
// Theo Thông tư 133/2016/TT-BTC & TT 99/2025/TT-BTC
// Dành cho Công ty TNHH 1 thành viên
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại nguồn chứng từ cho Sổ cái
 */
export type GeneralLedgerSourceType =
  | 'INVOICE_IN'      // Hóa đơn mua vào
  | 'INVOICE_OUT'     // Hóa đơn bán ra
  | 'RECEIPT'         // Phiếu thu
  | 'PAYMENT'         // Phiếu chi
  | 'INVENTORY_IN'    // Phiếu nhập kho
  | 'INVENTORY_OUT'   // Phiếu xuất kho
  | 'SALARY'          // Bảng lương
  | 'DEPRECIATION'    // Khấu hao TSCĐ
  | 'BANK_TRANSFER'   // Chuyển khoản ngân hàng
  | 'ADJUSTMENT'      // Bút toán điều chỉnh
  | 'OPENING'         // Số dư đầu kỳ
  | 'OTHER';          // Khác

export const GENERAL_LEDGER_SOURCE_LABELS: Record<GeneralLedgerSourceType, string> = {
  'INVOICE_IN': 'HĐ mua vào',
  'INVOICE_OUT': 'HĐ bán ra',
  'RECEIPT': 'Phiếu thu',
  'PAYMENT': 'Phiếu chi',
  'INVENTORY_IN': 'Phiếu nhập',
  'INVENTORY_OUT': 'Phiếu xuất',
  'SALARY': 'Bảng lương',
  'DEPRECIATION': 'Khấu hao',
  'BANK_TRANSFER': 'CK ngân hàng',
  'ADJUSTMENT': 'Điều chỉnh',
  'OPENING': 'Số dư đầu',
  'OTHER': 'Khác'
};

export const GENERAL_LEDGER_SOURCE_COLORS: Record<GeneralLedgerSourceType, string> = {
  'INVOICE_IN': '#ef4444',
  'INVOICE_OUT': '#22c55e',
  'RECEIPT': '#3b82f6',
  'PAYMENT': '#f97316',
  'INVENTORY_IN': '#8b5cf6',
  'INVENTORY_OUT': '#ec4899',
  'SALARY': '#14b8a6',
  'DEPRECIATION': '#6b7280',
  'BANK_TRANSFER': '#0ea5e9',
  'ADJUSTMENT': '#eab308',
  'OPENING': '#6366f1',
  'OTHER': '#71717a'
};

/**
 * Bản chất tài khoản
 */
export type AccountNature = 'DEBIT' | 'CREDIT' | 'AMPHIBIOUS';

export const ACCOUNT_NATURE_LABELS: Record<AccountNature, string> = {
  'DEBIT': 'Dư Nợ',
  'CREDIT': 'Dư Có',
  'AMPHIBIOUS': 'Lưỡng tính'
};

/**
 * Loại tài khoản
 */
export type AccountType =
  | 'ASSET'           // Tài sản
  | 'LIABILITY'       // Nợ phải trả
  | 'EQUITY'          // Vốn chủ sở hữu
  | 'REVENUE'         // Doanh thu
  | 'EXPENSE'         // Chi phí
  | 'COST';           // Giá vốn

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  'ASSET': 'Tài sản',
  'LIABILITY': 'Nợ phải trả',
  'EQUITY': 'Vốn CSH',
  'REVENUE': 'Doanh thu',
  'EXPENSE': 'Chi phí',
  'COST': 'Giá vốn'
};

/**
 * Trạng thái số dư
 */
export type BalanceStatus = 'NORMAL' | 'ABNORMAL' | 'ZERO';

/**
 * Tài khoản kế toán trong Sổ cái
 */
export interface GeneralLedgerAccount {
  accountCode: string;        // Mã TK: 111, 112, 131, 331, 511...
  accountName: string;        // Tên TK
  parentCode?: string;        // TK cha (nếu có)
  level: number;              // Cấp TK: 1, 2, 3
  accountType: AccountType;   // Loại TK
  nature: AccountNature;      // Bản chất

  // Số dư
  openingDebit: number;       // Dư Nợ đầu kỳ
  openingCredit: number;      // Dư Có đầu kỳ
  totalDebit: number;         // Tổng phát sinh Nợ
  totalCredit: number;        // Tổng phát sinh Có
  closingDebit: number;       // Dư Nợ cuối kỳ
  closingCredit: number;      // Dư Có cuối kỳ

  // Trạng thái
  balanceStatus: BalanceStatus;
  hasChildren: boolean;
  isExpanded?: boolean;
  entryCount: number;         // Số bút toán
}

/**
 * Chi tiết Sổ cái theo TK
 */
export interface GeneralLedgerEntry {
  id: string;
  date: Date | string;        // Ngày ghi sổ
  voucherDate: Date | string; // Ngày chứng từ
  voucherNo: string;          // Số chứng từ
  description: string;        // Diễn giải

  debit: number;              // Phát sinh Nợ
  credit: number;             // Phát sinh Có

  counterpartAccount: string; // TK đối ứng
  counterpartName?: string;   // Tên TK đối ứng

  // Số dư lũy kế (running balance)
  runningDebit: number;       // Dư Nợ lũy kế
  runningCredit: number;      // Dư Có lũy kế

  // Nguồn chứng từ
  sourceType: GeneralLedgerSourceType;
  sourceId: string;

  // Trạng thái
  isLocked: boolean;
  isAbnormal?: boolean;
}

/**
 * Filter cho Sổ cái
 */
export interface GeneralLedgerFilter {
  periodType: 'month' | 'quarter' | 'year' | 'custom';
  year: number;
  month?: number;             // 1-12
  quarter?: number;           // 1-4
  fromDate?: string;          // YYYY-MM-DD
  toDate?: string;            // YYYY-MM-DD

  accountCode?: string;       // Lọc theo TK cụ thể
  accountLevel?: number;      // Lọc theo cấp TK
  showZeroBalance?: boolean;  // Hiển thị TK số dư = 0
  showDetails?: boolean;      // Hiển thị chi tiết phát sinh
}

/**
 * Tổng hợp Sổ cái
 */
export interface GeneralLedgerSummary {
  totalAccounts: number;      // Tổng số TK
  totalDebit: number;         // Tổng phát sinh Nợ
  totalCredit: number;        // Tổng phát sinh Có
  isBalanced: boolean;        // Cân đối?
  difference: number;         // Chênh lệch

  abnormalAccounts: number;   // Số TK bất thường
  zeroBalanceAccounts: number;// Số TK dư = 0
}

/**
 * Response danh sách tài khoản
 */
export interface GeneralLedgerResponse {
  accounts: GeneralLedgerAccount[];
  summary: GeneralLedgerSummary;
  period: {
    from: string;
    to: string;
    label: string;
    isLocked: boolean;
  };
}

/**
 * Response chi tiết Sổ cái theo TK
 */
export interface GeneralLedgerDetailResponse {
  account: GeneralLedgerAccount;
  entries: GeneralLedgerEntry[];
  period: {
    from: string;
    to: string;
    label: string;
    isLocked: boolean;
  };
}

/**
 * Chi tiết chứng từ gốc (Drill-down)
 */
export interface GeneralLedgerVoucherDetail {
  voucherType: GeneralLedgerSourceType;
  voucherNo: string;
  voucherDate: Date | string;
  description: string;
  totalAmount: number;

  partner?: string;           // Khách hàng / NCC
  taxCode?: string;           // MST

  journalEntries: {
    debitAccount: string;
    creditAccount: string;
    amount: number;
    description: string;
  }[];

  relatedDocuments?: {
    type: string;
    number: string;
    id: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DANH MỤC TÀI KHOẢN CHUẨN (THEO TT 133/2016)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccountTemplate {
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  level: number;
  parentCode?: string;
}

export const STANDARD_ACCOUNTS: AccountTemplate[] = [
  // LOẠI 1: TÀI SẢN
  { code: '111', name: 'Tiền mặt', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '1111', name: 'Tiền Việt Nam', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '111' },
  { code: '1112', name: 'Ngoại tệ', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '111' },

  { code: '112', name: 'Tiền gửi ngân hàng', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '1121', name: 'Tiền Việt Nam', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '112' },
  { code: '1122', name: 'Ngoại tệ', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '112' },

  { code: '131', name: 'Phải thu của khách hàng', type: 'ASSET', nature: 'AMPHIBIOUS', level: 1 },
  { code: '133', name: 'Thuế GTGT được khấu trừ', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '133' },
  { code: '1332', name: 'Thuế GTGT được khấu trừ của TSCĐ', type: 'ASSET', nature: 'DEBIT', level: 2, parentCode: '133' },

  { code: '141', name: 'Tạm ứng', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '152', name: 'Nguyên liệu, vật liệu', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '153', name: 'Công cụ, dụng cụ', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '154', name: 'Chi phí SXKD dở dang', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '155', name: 'Thành phẩm', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '156', name: 'Hàng hóa', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '157', name: 'Hàng gửi đi bán', type: 'ASSET', nature: 'DEBIT', level: 1 },

  { code: '211', name: 'TSCĐ hữu hình', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '214', name: 'Hao mòn TSCĐ', type: 'ASSET', nature: 'CREDIT', level: 1 },

  // LOẠI 2: NỢ PHẢI TRẢ
  { code: '331', name: 'Phải trả cho người bán', type: 'LIABILITY', nature: 'AMPHIBIOUS', level: 1 },
  { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', type: 'LIABILITY', nature: 'CREDIT', level: 1 },
  { code: '3331', name: 'Thuế GTGT phải nộp', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '333' },
  { code: '33311', name: 'Thuế GTGT đầu ra', type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '3331' },
  { code: '3334', name: 'Thuế TNDN', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3335', name: 'Thuế TNCN', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '333' },

  { code: '334', name: 'Phải trả người lao động', type: 'LIABILITY', nature: 'CREDIT', level: 1 },
  { code: '338', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', nature: 'CREDIT', level: 1 },
  { code: '3383', name: 'BHXH', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3384', name: 'BHYT', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3386', name: 'BHTN', type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '338' },

  // LOẠI 4: VỐN CHỦ SỞ HỮU
  { code: '411', name: 'Vốn đầu tư của chủ sở hữu', type: 'EQUITY', nature: 'CREDIT', level: 1 },
  { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', type: 'EQUITY', nature: 'CREDIT', level: 1 },
  { code: '4211', name: 'LNST chưa phân phối năm trước', type: 'EQUITY', nature: 'CREDIT', level: 2, parentCode: '421' },
  { code: '4212', name: 'LNST chưa phân phối năm nay', type: 'EQUITY', nature: 'CREDIT', level: 2, parentCode: '421' },

  // LOẠI 5: DOANH THU
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: 'REVENUE', nature: 'CREDIT', level: 1 },
  { code: '5111', name: 'Doanh thu bán hàng hóa', type: 'REVENUE', nature: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5112', name: 'Doanh thu bán thành phẩm', type: 'REVENUE', nature: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ', type: 'REVENUE', nature: 'CREDIT', level: 2, parentCode: '511' },

  { code: '515', name: 'Doanh thu hoạt động tài chính', type: 'REVENUE', nature: 'CREDIT', level: 1 },
  { code: '521', name: 'Các khoản giảm trừ doanh thu', type: 'REVENUE', nature: 'DEBIT', level: 1 },

  // LOẠI 6: CHI PHÍ
  { code: '632', name: 'Giá vốn hàng bán', type: 'COST', nature: 'DEBIT', level: 1 },
  { code: '635', name: 'Chi phí tài chính', type: 'EXPENSE', nature: 'DEBIT', level: 1 },
  { code: '641', name: 'Chi phí bán hàng', type: 'EXPENSE', nature: 'DEBIT', level: 1 },
  { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: 'EXPENSE', nature: 'DEBIT', level: 1 },

  // LOẠI 8: THU NHẬP KHÁC
  { code: '711', name: 'Thu nhập khác', type: 'REVENUE', nature: 'CREDIT', level: 1 },

  // LOẠI 8: CHI PHÍ KHÁC
  { code: '811', name: 'Chi phí khác', type: 'EXPENSE', nature: 'DEBIT', level: 1 },
  { code: '821', name: 'Chi phí thuế TNDN', type: 'EXPENSE', nature: 'DEBIT', level: 1 },

  // LOẠI 9: XÁC ĐỊNH KẾT QUẢ
  { code: '911', name: 'Xác định kết quả kinh doanh', type: 'EQUITY', nature: 'AMPHIBIOUS', level: 1 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Xác định bản chất số dư bình thường của TK
 */
export function getNormalBalance(accountCode: string): AccountNature {
  const account = STANDARD_ACCOUNTS.find(a => a.code === accountCode);
  if (account) {
    return account.nature;
  }

  // Quy tắc theo đầu số TK
  const firstDigit = accountCode.charAt(0);
  switch (firstDigit) {
    case '1': // Tài sản
    case '6': // Chi phí
    case '8': // Chi phí khác (trừ 821)
      return 'DEBIT';
    case '3': // Nợ phải trả
    case '4': // Vốn CSH
    case '5': // Doanh thu
    case '7': // Thu nhập khác
      return 'CREDIT';
    default:
      return 'AMPHIBIOUS';
  }
}

/**
 * Kiểm tra số dư có bất thường không
 */
export function isAbnormalBalance(
  accountCode: string,
  debitBalance: number,
  creditBalance: number
): boolean {
  const nature = getNormalBalance(accountCode);

  // TK lưỡng tính không bất thường
  if (nature === 'AMPHIBIOUS') return false;

  // TK dư Nợ mà có số dư Có
  if (nature === 'DEBIT' && creditBalance > 0 && debitBalance === 0) return true;

  // TK dư Có mà có số dư Nợ
  if (nature === 'CREDIT' && debitBalance > 0 && creditBalance === 0) return true;

  return false;
}

/**
 * Tính số dư cuối kỳ
 */
export function calculateClosingBalance(
  openingDebit: number,
  openingCredit: number,
  totalDebit: number,
  totalCredit: number
): { closingDebit: number; closingCredit: number } {
  const netOpening = openingDebit - openingCredit;
  const netMovement = totalDebit - totalCredit;
  const netClosing = netOpening + netMovement;

  if (netClosing >= 0) {
    return { closingDebit: netClosing, closingCredit: 0 };
  } else {
    return { closingDebit: 0, closingCredit: Math.abs(netClosing) };
  }
}

/**
 * Lấy thông tin TK từ danh mục chuẩn
 */
export function getAccountInfo(accountCode: string): AccountTemplate | undefined {
  return STANDARD_ACCOUNTS.find(a => a.code === accountCode);
}

/**
 * Kiểm tra TK có phải TK chi tiết (cấp cuối) không
 */
export function isDetailAccount(accountCode: string): boolean {
  return !STANDARD_ACCOUNTS.some(a => a.parentCode === accountCode);
}
