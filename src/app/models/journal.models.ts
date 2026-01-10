/**
 * SỔ NHẬT KÝ CHUNG - DATA MODELS
 * Theo Thông tư 133/2016/TT-BTC
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Sổ nhật ký chung ghi nhận TOÀN BỘ bút toán phát sinh theo TRÌNH TỰ THỜI GIAN
 * - Là nguồn dữ liệu để lên Sổ cái và Báo cáo tài chính
 * - Dữ liệu tự động sinh từ chứng từ gốc, KHÔNG nhập tay
 */

/**
 * Loại nguồn chứng từ
 */
export type VoucherSourceType =
  | 'PHIEU_THU'      // Phiếu thu tiền mặt
  | 'PHIEU_CHI'      // Phiếu chi tiền mặt
  | 'UNC_THU'        // Ủy nhiệm chi thu
  | 'UNC_CHI'        // Ủy nhiệm chi chi
  | 'HOA_DON_BAN'    // Hóa đơn bán hàng
  | 'HOA_DON_MUA'    // Hóa đơn mua hàng
  | 'PHIEU_NHAP'     // Phiếu nhập kho
  | 'PHIEU_XUAT'     // Phiếu xuất kho
  | 'BANG_LUONG'     // Bảng lương
  | 'KHAU_HAO'       // Khấu hao TSCĐ
  | 'PHAN_BO'        // Phân bổ chi phí
  | 'KET_CHUYEN'     // Kết chuyển cuối kỳ
  | 'DIEU_CHINH'     // Bút toán điều chỉnh
  | 'KHAC';          // Chứng từ khác

/**
 * Trạng thái bút toán
 */
export type JournalEntryStatus =
  | 'NORMAL'         // Bình thường
  | 'ADJUSTMENT'     // Điều chỉnh
  | 'REVERSAL';      // Storno (ghi âm)

/**
 * Bút toán trong sổ nhật ký chung
 */
export interface JournalEntry {
  id: string;

  // Thông tin thời gian
  entryDate: Date | string;        // Ngày ghi sổ
  voucherDate: Date | string;      // Ngày chứng từ

  // Thông tin chứng từ
  voucherNumber: string;           // Số chứng từ
  description: string;             // Diễn giải

  // Tài khoản kế toán
  debitAccount: string;            // TK Nợ (VD: 111, 131, 632)
  debitAccountName?: string;       // Tên TK Nợ
  creditAccount: string;           // TK Có (VD: 511, 331, 156)
  creditAccountName?: string;      // Tên TK Có

  // Số tiền
  amount: number;                  // Số tiền

  // Nguồn chứng từ (để drill-down)
  sourceType: VoucherSourceType;   // Loại chứng từ nguồn
  sourceId: string;                // ID chứng từ nguồn
  sourceNumber?: string;           // Số chứng từ nguồn

  // Thông tin kỳ kế toán
  period: string;                  // Kỳ kế toán (VD: "2026-01")
  fiscalYear: number;              // Năm tài chính

  // Trạng thái
  status: JournalEntryStatus;
  isLocked: boolean;               // Đã khóa sổ chưa

  // Audit
  createdAt?: Date | string;
  createdBy?: string;
}

/**
 * Bộ lọc sổ nhật ký chung
 */
export interface JournalFilter {
  periodType: 'month' | 'quarter' | 'year' | 'custom';
  month?: number;
  quarter?: number;
  year: number;
  fromDate?: Date | string;
  toDate?: Date | string;
  sourceType?: VoucherSourceType;
  accountCode?: string;            // Lọc theo TK
  searchText?: string;
}

/**
 * Tổng hợp sổ nhật ký
 */
export interface JournalSummary {
  totalDebit: number;              // Tổng phát sinh Nợ
  totalCredit: number;             // Tổng phát sinh Có
  entryCount: number;              // Số bút toán
  isBalanced: boolean;             // Cân đối hay không
  difference: number;              // Chênh lệch (nếu có)
}

/**
 * Kết quả API
 */
export interface JournalResponse {
  entries: JournalEntry[];
  summary: JournalSummary;
  period: {
    from: string;
    to: string;
    isLocked: boolean;
    lockedAt?: string;
    lockedBy?: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Chi tiết chứng từ nguồn (khi drill-down)
 */
export interface VoucherDetail {
  id: string;
  type: VoucherSourceType;
  number: string;
  date: Date | string;
  description: string;
  totalAmount: number;
  entries: JournalEntry[];         // Các bút toán liên quan
  attachments?: string[];          // File đính kèm
  createdBy?: string;
  approvedBy?: string;
}

/**
 * Mapping tên loại chứng từ
 */
export const VOUCHER_SOURCE_LABELS: Record<VoucherSourceType, string> = {
  'PHIEU_THU': 'Phiếu thu',
  'PHIEU_CHI': 'Phiếu chi',
  'UNC_THU': 'UNC thu',
  'UNC_CHI': 'UNC chi',
  'HOA_DON_BAN': 'HĐ bán hàng',
  'HOA_DON_MUA': 'HĐ mua hàng',
  'PHIEU_NHAP': 'Phiếu nhập kho',
  'PHIEU_XUAT': 'Phiếu xuất kho',
  'BANG_LUONG': 'Bảng lương',
  'KHAU_HAO': 'Khấu hao',
  'PHAN_BO': 'Phân bổ',
  'KET_CHUYEN': 'Kết chuyển',
  'DIEU_CHINH': 'Điều chỉnh',
  'KHAC': 'Khác'
};

/**
 * Màu sắc theo loại chứng từ
 */
export const VOUCHER_SOURCE_COLORS: Record<VoucherSourceType, string> = {
  'PHIEU_THU': '#10b981',
  'PHIEU_CHI': '#ef4444',
  'UNC_THU': '#10b981',
  'UNC_CHI': '#ef4444',
  'HOA_DON_BAN': '#3b82f6',
  'HOA_DON_MUA': '#f59e0b',
  'PHIEU_NHAP': '#8b5cf6',
  'PHIEU_XUAT': '#ec4899',
  'BANG_LUONG': '#06b6d4',
  'KHAU_HAO': '#6b7280',
  'PHAN_BO': '#6b7280',
  'KET_CHUYEN': '#374151',
  'DIEU_CHINH': '#dc2626',
  'KHAC': '#9ca3af'
};
