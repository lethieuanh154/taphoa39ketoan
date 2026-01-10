/**
 * CHỨNG TỪ NỘI BỘ - HỘ KINH DOANH
 * Phục vụ sinh dữ liệu cho 7 sổ kế toán HKD (Circular 88/2021/TT-BTC)
 * KHÔNG phải chứng từ kế toán doanh nghiệp
 */

// Loại chứng từ nội bộ
export enum LoaiChungTu {
  THU_TIEN = 'THU_TIEN',           // Thu tiền → S6, S7
  CHI_TIEN = 'CHI_TIEN',           // Chi tiền → S3, S6
  NHAP_HANG = 'NHAP_HANG',         // Nhập hàng → S2
  XUAT_HANG = 'XUAT_HANG',         // Xuất hàng → S2
  NOP_THUE = 'NOP_THUE'            // Nộp thuế → S4, S7
}

// Phương thức thanh toán
export enum PhuongThucThanhToan {
  TIEN_MAT = 'TIEN_MAT',
  CHUYEN_KHOAN = 'CHUYEN_KHOAN'
}

// Nhóm chi phí (cho CHI_TIEN)
export enum NhomChiPhi {
  VAT_LIEU = 'Tiền vật liệu, dụng cụ, hàng hóa',
  NHAN_CONG = 'Tiền nhân công',
  KHAU_HAO = 'Chi phí khấu hao TSCĐ',
  THUE_MAT_BANG = 'Chi phí thuê nhà, đất, mặt bằng SXKD',
  DIEN_NUOC = 'Chi phí điện, nước, nhiên liệu',
  VAN_CHUYEN = 'Chi phí vận chuyển',
  MUA_NGOAI_KHAC = 'Chi phí mua ngoài khác'
}

// Loại thuế (cho NOP_THUE)
export enum LoaiThue {
  VAT = 'Thuế GTGT',
  TNCN_KD = 'Thuế TNCN từ kinh doanh',
  MON_BAI = 'Thuế môn bài',
  KHAC = 'Thuế khác'
}

// Lý do xuất hàng (cho XUAT_HANG)
export enum LyDoXuat {
  BAN_HANG = 'Bán hàng',
  NOI_BO = 'Sử dụng nội bộ'
}

// Chi tiết hàng hóa (cho NHAP_HANG, XUAT_HANG)
export interface ChiTietHangHoa {
  id?: string;
  tenHangHoa: string;
  soLuong: number;
  donGia?: number;      // Chỉ có trong NHAP_HANG
  thanhTien?: number;   // Tự tính = soLuong * donGia
}

// Chứng từ nội bộ (base interface)
export interface ChungTuNoiBo {
  id: string;
  loaiChungTu: LoaiChungTu;
  ngayChungTu: string;              // ISO date string
  noiDung: string;
  soTien: number;
  phuongThucThanhToan: PhuongThucThanhToan;
  ghiChu?: string;

  // Trường riêng cho THU_TIEN
  nguoiNopTien?: string;

  // Trường riêng cho CHI_TIEN
  nhomChiPhi?: NhomChiPhi;
  coHoaDon?: boolean;

  // Trường riêng cho NHAP_HANG
  nhaCungCap?: string;
  danhSachHangHoa?: ChiTietHangHoa[];

  // Trường riêng cho XUAT_HANG
  lyDoXuat?: LyDoXuat;
  // danhSachHangHoa?: ChiTietHangHoa[] (dùng chung với NHAP_HANG)

  // Trường riêng cho NOP_THUE
  loaiThue?: LoaiThue;
  kyThue?: string;                  // VD: "T01/2024", "Q1/2024", "2024"
}

// Mapping chứng từ → Sổ kế toán bị ảnh hưởng
export const CHUNG_TU_MAPPING = {
  [LoaiChungTu.THU_TIEN]: {
    soKeToan: ['S6', 'S7'],
    dienGiai: 'Thu tiền → Ghi vào Sổ quỹ tiền mặt (S6) hoặc Sổ tiền gửi ngân hàng (S7)'
  },
  [LoaiChungTu.CHI_TIEN]: {
    soKeToan: ['S3', 'S6'],
    dienGiai: 'Chi tiền → Ghi vào Sổ chi phí SXKD (S3) và Sổ quỹ tiền mặt (S6)'
  },
  [LoaiChungTu.NHAP_HANG]: {
    soKeToan: ['S2'],
    dienGiai: 'Nhập hàng → Ghi vào Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa (S2)'
  },
  [LoaiChungTu.XUAT_HANG]: {
    soKeToan: ['S2'],
    dienGiai: 'Xuất hàng → Ghi vào Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa (S2)'
  },
  [LoaiChungTu.NOP_THUE]: {
    soKeToan: ['S4', 'S7'],
    dienGiai: 'Nộp thuế → Ghi vào Sổ theo dõi nghĩa vụ thuế với NSNN (S4) và Sổ tiền gửi ngân hàng (S7)'
  }
};

// Label hiển thị cho dropdown
export const LOAI_CHUNG_TU_LABELS = {
  [LoaiChungTu.THU_TIEN]: 'Thu tiền',
  [LoaiChungTu.CHI_TIEN]: 'Chi tiền',
  [LoaiChungTu.NHAP_HANG]: 'Nhập hàng',
  [LoaiChungTu.XUAT_HANG]: 'Xuất hàng',
  [LoaiChungTu.NOP_THUE]: 'Nộp thuế'
};

export const PHUONG_THUC_THANH_TOAN_LABELS = {
  [PhuongThucThanhToan.TIEN_MAT]: 'Tiền mặt',
  [PhuongThucThanhToan.CHUYEN_KHOAN]: 'Chuyển khoản'
};

export const LY_DO_XUAT_LABELS = {
  [LyDoXuat.BAN_HANG]: 'Bán hàng',
  [LyDoXuat.NOI_BO]: 'Sử dụng nội bộ'
};
