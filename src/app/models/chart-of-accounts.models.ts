/**
 * HỆ THỐNG TÀI KHOẢN KẾ TOÁN - CHART OF ACCOUNTS
 *
 * Theo Thông tư 133/2016/TT-BTC
 * Dành cho Doanh nghiệp nhỏ & vừa
 *
 * CẤU TRÚC TÀI KHOẢN:
 * - Loại 1: Tài sản ngắn hạn (111-157)
 * - Loại 2: Tài sản dài hạn (211-243)
 * - Loại 3: Nợ phải trả (331-356)
 * - Loại 4: Vốn chủ sở hữu (411-421)
 * - Loại 5: Doanh thu (511-521)
 * - Loại 6: Chi phí sản xuất, kinh doanh (611-642)
 * - Loại 7: Thu nhập khác (711)
 * - Loại 8: Chi phí khác (811-821)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loại tài khoản
 */
export type AccountType =
  | 'ASSET_SHORT'       // Tài sản ngắn hạn (Loại 1)
  | 'ASSET_LONG'        // Tài sản dài hạn (Loại 2)
  | 'LIABILITY'         // Nợ phải trả (Loại 3)
  | 'EQUITY'            // Vốn chủ sở hữu (Loại 4)
  | 'REVENUE'           // Doanh thu (Loại 5)
  | 'EXPENSE_PROD'      // Chi phí SX-KD (Loại 6)
  | 'INCOME_OTHER'      // Thu nhập khác (Loại 7)
  | 'EXPENSE_OTHER';    // Chi phí khác (Loại 8)

/**
 * Tính chất số dư tài khoản
 */
export type AccountNature = 'DEBIT' | 'CREDIT' | 'BOTH';

/**
 * Trạng thái tài khoản
 */
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SYSTEM';

/**
 * Một tài khoản kế toán
 */
export interface Account {
  id: string;                   // UUID
  code: string;                 // Mã TK: 111, 1111, 11111...
  name: string;                 // Tên TK: Tiền mặt
  nameEn?: string;              // Tên tiếng Anh (optional)
  parentCode?: string;          // Mã TK cha: 111 -> null, 1111 -> 111
  type: AccountType;            // Loại TK
  nature: AccountNature;        // Tính chất số dư
  level: number;                // Cấp độ: 1 = TK bậc 1, 2 = TK bậc 2, 3 = TK bậc 3
  isParent: boolean;            // Có TK con không?
  isDetailRequired: boolean;    // Bắt buộc hạch toán chi tiết? (theo đối tượng)
  detailType?: DetailType;      // Loại chi tiết: CUSTOMER, SUPPLIER, EMPLOYEE...
  description?: string;         // Mô tả
  note?: string;                // Ghi chú
  status: AccountStatus;        // Trạng thái
  isSystemAccount: boolean;     // TK hệ thống (không được sửa/xóa)
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Loại chi tiết cho TK cần theo dõi đối tượng
 */
export type DetailType =
  | 'CUSTOMER'      // Khách hàng (TK 131)
  | 'SUPPLIER'      // Nhà cung cấp (TK 331)
  | 'EMPLOYEE'      // Nhân viên (TK 334, 141)
  | 'BANK'          // Ngân hàng (TK 112)
  | 'INVENTORY'     // Hàng tồn kho (TK 152-157)
  | 'FIXED_ASSET'   // TSCĐ (TK 211)
  | 'CONTRACT'      // Hợp đồng
  | 'PROJECT'       // Dự án/Công trình
  | 'DEPARTMENT'    // Phòng ban
  | 'NONE';         // Không cần chi tiết

/**
 * Filter tìm kiếm tài khoản
 */
export interface AccountFilter {
  search?: string;              // Tìm theo mã hoặc tên
  type?: AccountType;           // Lọc theo loại
  level?: number;               // Lọc theo cấp
  status?: AccountStatus;       // Lọc theo trạng thái
  isParent?: boolean;           // Chỉ lấy TK cha hoặc TK lá
  parentCode?: string;          // Lấy TK con của TK cha
}

/**
 * Nhóm tài khoản (cho hiển thị)
 */
export interface AccountGroup {
  code: string;                 // Mã nhóm: 1, 2, 3...
  name: string;                 // Tên nhóm: Tài sản ngắn hạn
  type: AccountType;
  accounts: Account[];
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DANH MỤC TÀI KHOẢN THEO TT133/2016/TT-BTC
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccountTemplate {
  code: string;
  name: string;
  nameEn?: string;
  type: AccountType;
  nature: AccountNature;
  isDetailRequired?: boolean;
  detailType?: DetailType;
  description?: string;
}

/**
 * LOẠI 1: TÀI SẢN NGẮN HẠN
 */
export const ACCOUNT_TYPE_1_SHORT_TERM_ASSETS: AccountTemplate[] = [
  // === TK 111 - TIỀN MẶT ===
  { code: '111', name: 'Tiền mặt', nameEn: 'Cash on hand', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1111', name: 'Tiền Việt Nam', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1112', name: 'Ngoại tệ', type: 'ASSET_SHORT', nature: 'DEBIT' },

  // === TK 112 - TIỀN GỬI NGÂN HÀNG ===
  { code: '112', name: 'Tiền gửi ngân hàng', nameEn: 'Cash in bank', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'BANK' },
  { code: '1121', name: 'Tiền Việt Nam', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'BANK' },
  { code: '1122', name: 'Ngoại tệ', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'BANK' },

  // === TK 131 - PHẢI THU CỦA KHÁCH HÀNG ===
  { code: '131', name: 'Phải thu của khách hàng', nameEn: 'Receivables from customers', type: 'ASSET_SHORT', nature: 'BOTH', isDetailRequired: true, detailType: 'CUSTOMER', description: 'Dư Nợ: Phải thu; Dư Có: Người mua trả trước' },

  // === TK 133 - THUẾ GTGT ĐƯỢC KHẤU TRỪ ===
  { code: '133', name: 'Thuế GTGT được khấu trừ', nameEn: 'VAT deductible', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1332', name: 'Thuế GTGT được khấu trừ của TSCĐ', type: 'ASSET_SHORT', nature: 'DEBIT' },

  // === TK 138 - PHẢI THU KHÁC ===
  { code: '138', name: 'Phải thu khác', nameEn: 'Other receivables', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1381', name: 'Tài sản thiếu chờ xử lý', type: 'ASSET_SHORT', nature: 'DEBIT' },
  { code: '1388', name: 'Phải thu khác', type: 'ASSET_SHORT', nature: 'DEBIT' },

  // === TK 141 - TẠM ỨNG ===
  { code: '141', name: 'Tạm ứng', nameEn: 'Advances', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'EMPLOYEE' },

  // === TK 152 - NGUYÊN LIỆU, VẬT LIỆU ===
  { code: '152', name: 'Nguyên liệu, vật liệu', nameEn: 'Raw materials', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },

  // === TK 153 - CÔNG CỤ, DỤNG CỤ ===
  { code: '153', name: 'Công cụ, dụng cụ', nameEn: 'Tools and supplies', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },

  // === TK 154 - CHI PHÍ SẢN XUẤT KINH DOANH DỞ DANG ===
  { code: '154', name: 'Chi phí SXKD dở dang', nameEn: 'Work in process', type: 'ASSET_SHORT', nature: 'DEBIT' },

  // === TK 155 - THÀNH PHẨM ===
  { code: '155', name: 'Thành phẩm', nameEn: 'Finished goods', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },

  // === TK 156 - HÀNG HÓA ===
  { code: '156', name: 'Hàng hóa', nameEn: 'Goods', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },
  { code: '1561', name: 'Giá mua hàng hóa', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },
  { code: '1562', name: 'Chi phí thu mua hàng hóa', type: 'ASSET_SHORT', nature: 'DEBIT' },

  // === TK 157 - HÀNG GỬI ĐI BÁN ===
  { code: '157', name: 'Hàng gửi đi bán', nameEn: 'Goods in transit', type: 'ASSET_SHORT', nature: 'DEBIT', isDetailRequired: true, detailType: 'INVENTORY' },
];

/**
 * LOẠI 2: TÀI SẢN DÀI HẠN
 */
export const ACCOUNT_TYPE_2_LONG_TERM_ASSETS: AccountTemplate[] = [
  // === TK 211 - TÀI SẢN CỐ ĐỊNH HỮU HÌNH ===
  { code: '211', name: 'Tài sản cố định hữu hình', nameEn: 'Tangible fixed assets', type: 'ASSET_LONG', nature: 'DEBIT', isDetailRequired: true, detailType: 'FIXED_ASSET' },
  { code: '2111', name: 'Nhà cửa, vật kiến trúc', type: 'ASSET_LONG', nature: 'DEBIT' },
  { code: '2112', name: 'Máy móc, thiết bị', type: 'ASSET_LONG', nature: 'DEBIT' },
  { code: '2113', name: 'Phương tiện vận tải', type: 'ASSET_LONG', nature: 'DEBIT' },
  { code: '2114', name: 'Thiết bị, dụng cụ quản lý', type: 'ASSET_LONG', nature: 'DEBIT' },
  { code: '2118', name: 'TSCĐ hữu hình khác', type: 'ASSET_LONG', nature: 'DEBIT' },

  // === TK 214 - HAO MÒN TSCĐ ===
  { code: '214', name: 'Hao mòn tài sản cố định', nameEn: 'Accumulated depreciation', type: 'ASSET_LONG', nature: 'CREDIT', description: 'TK điều chỉnh giảm TSCĐ' },
  { code: '2141', name: 'Hao mòn TSCĐ hữu hình', type: 'ASSET_LONG', nature: 'CREDIT' },
  { code: '2142', name: 'Hao mòn TSCĐ thuê tài chính', type: 'ASSET_LONG', nature: 'CREDIT' },
  { code: '2143', name: 'Hao mòn TSCĐ vô hình', type: 'ASSET_LONG', nature: 'CREDIT' },

  // === TK 242 - CHI PHÍ TRẢ TRƯỚC ===
  { code: '242', name: 'Chi phí trả trước', nameEn: 'Prepaid expenses', type: 'ASSET_LONG', nature: 'DEBIT' },

  // === TK 243 - TÀI SẢN THUẾ THU NHẬP HOÃN LẠI ===
  { code: '243', name: 'Tài sản thuế TNHL', nameEn: 'Deferred tax assets', type: 'ASSET_LONG', nature: 'DEBIT' },
];

/**
 * LOẠI 3: NỢ PHẢI TRẢ
 */
export const ACCOUNT_TYPE_3_LIABILITIES: AccountTemplate[] = [
  // === TK 331 - PHẢI TRẢ CHO NGƯỜI BÁN ===
  { code: '331', name: 'Phải trả cho người bán', nameEn: 'Payables to suppliers', type: 'LIABILITY', nature: 'BOTH', isDetailRequired: true, detailType: 'SUPPLIER', description: 'Dư Có: Phải trả; Dư Nợ: Trả trước NCC' },

  // === TK 333 - THUẾ VÀ CÁC KHOẢN PHẢI NỘP NHÀ NƯỚC ===
  { code: '333', name: 'Thuế và các khoản phải nộp NN', nameEn: 'Taxes payable', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3331', name: 'Thuế GTGT phải nộp', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '33311', name: 'Thuế GTGT đầu ra', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3334', name: 'Thuế TNDN', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3335', name: 'Thuế TNCN', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3338', name: 'Thuế khác', type: 'LIABILITY', nature: 'CREDIT' },

  // === TK 334 - PHẢI TRẢ NGƯỜI LAO ĐỘNG ===
  { code: '334', name: 'Phải trả người lao động', nameEn: 'Payables to employees', type: 'LIABILITY', nature: 'CREDIT', isDetailRequired: true, detailType: 'EMPLOYEE' },

  // === TK 338 - PHẢI TRẢ, PHẢI NỘP KHÁC ===
  { code: '338', name: 'Phải trả, phải nộp khác', nameEn: 'Other payables', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3381', name: 'Tài sản thừa chờ giải quyết', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3382', name: 'Kinh phí công đoàn', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3383', name: 'Bảo hiểm xã hội', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3384', name: 'Bảo hiểm y tế', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3386', name: 'Bảo hiểm thất nghiệp', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3388', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', nature: 'CREDIT' },

  // === TK 341 - VAY VÀ NỢ THUÊ TÀI CHÍNH ===
  { code: '341', name: 'Vay và nợ thuê tài chính', nameEn: 'Borrowings', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3411', name: 'Các khoản đi vay', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3412', name: 'Nợ thuê tài chính', type: 'LIABILITY', nature: 'CREDIT' },

  // === TK 352 - DỰ PHÒNG PHẢI TRẢ ===
  { code: '352', name: 'Dự phòng phải trả', nameEn: 'Provisions', type: 'LIABILITY', nature: 'CREDIT' },

  // === TK 353 - QUỸ KHEN THƯỞNG, PHÚC LỢI ===
  { code: '353', name: 'Quỹ khen thưởng, phúc lợi', nameEn: 'Bonus and welfare fund', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3531', name: 'Quỹ khen thưởng', type: 'LIABILITY', nature: 'CREDIT' },
  { code: '3532', name: 'Quỹ phúc lợi', type: 'LIABILITY', nature: 'CREDIT' },
];

/**
 * LOẠI 4: VỐN CHỦ SỞ HỮU
 */
export const ACCOUNT_TYPE_4_EQUITY: AccountTemplate[] = [
  // === TK 411 - VỐN ĐẦU TƯ CỦA CHỦ SỞ HỮU ===
  { code: '411', name: 'Vốn đầu tư của chủ sở hữu', nameEn: 'Owner\'s capital', type: 'EQUITY', nature: 'CREDIT' },

  // === TK 418 - CÁC QUỸ THUỘC VỐN CHỦ SỞ HỮU ===
  { code: '418', name: 'Các quỹ thuộc vốn chủ sở hữu', nameEn: 'Equity reserves', type: 'EQUITY', nature: 'CREDIT' },

  // === TK 421 - LỢI NHUẬN SAU THUẾ CHƯA PHÂN PHỐI ===
  { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', nameEn: 'Retained earnings', type: 'EQUITY', nature: 'BOTH', description: 'Dư Có: Lãi; Dư Nợ: Lỗ' },
  { code: '4211', name: 'Lợi nhuận sau thuế chưa phân phối năm trước', type: 'EQUITY', nature: 'BOTH' },
  { code: '4212', name: 'Lợi nhuận sau thuế chưa phân phối năm nay', type: 'EQUITY', nature: 'BOTH' },
];

/**
 * LOẠI 5: DOANH THU
 */
export const ACCOUNT_TYPE_5_REVENUE: AccountTemplate[] = [
  // === TK 511 - DOANH THU BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ ===
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', nameEn: 'Sales revenue', type: 'REVENUE', nature: 'CREDIT' },
  { code: '5111', name: 'Doanh thu bán hàng hóa', type: 'REVENUE', nature: 'CREDIT' },
  { code: '5112', name: 'Doanh thu bán thành phẩm', type: 'REVENUE', nature: 'CREDIT' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ', type: 'REVENUE', nature: 'CREDIT' },
  { code: '5118', name: 'Doanh thu khác', type: 'REVENUE', nature: 'CREDIT' },

  // === TK 515 - DOANH THU HOẠT ĐỘNG TÀI CHÍNH ===
  { code: '515', name: 'Doanh thu hoạt động tài chính', nameEn: 'Financial income', type: 'REVENUE', nature: 'CREDIT' },

  // === TK 521 - CÁC KHOẢN GIẢM TRỪ DOANH THU ===
  { code: '521', name: 'Các khoản giảm trừ doanh thu', nameEn: 'Sales deductions', type: 'REVENUE', nature: 'DEBIT', description: 'TK điều chỉnh giảm DT' },
  { code: '5211', name: 'Chiết khấu thương mại', type: 'REVENUE', nature: 'DEBIT' },
  { code: '5212', name: 'Giảm giá hàng bán', type: 'REVENUE', nature: 'DEBIT' },
  { code: '5213', name: 'Hàng bán bị trả lại', type: 'REVENUE', nature: 'DEBIT' },
];

/**
 * LOẠI 6: CHI PHÍ SẢN XUẤT, KINH DOANH
 */
export const ACCOUNT_TYPE_6_EXPENSE_PROD: AccountTemplate[] = [
  // === TK 611 - MUA HÀNG (PHƯƠNG PHÁP KKĐK) ===
  { code: '611', name: 'Mua hàng', nameEn: 'Purchases', type: 'EXPENSE_PROD', nature: 'DEBIT', description: 'Dùng cho phương pháp KKĐK' },

  // === TK 632 - GIÁ VỐN HÀNG BÁN ===
  { code: '632', name: 'Giá vốn hàng bán', nameEn: 'Cost of goods sold', type: 'EXPENSE_PROD', nature: 'DEBIT' },

  // === TK 635 - CHI PHÍ TÀI CHÍNH ===
  { code: '635', name: 'Chi phí tài chính', nameEn: 'Financial expenses', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6351', name: 'Chi phí lãi vay', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6352', name: 'Chi phí tài chính khác', type: 'EXPENSE_PROD', nature: 'DEBIT' },

  // === TK 642 - CHI PHÍ QUẢN LÝ KINH DOANH ===
  { code: '642', name: 'Chi phí quản lý kinh doanh', nameEn: 'General & administrative expenses', type: 'EXPENSE_PROD', nature: 'DEBIT', description: 'DN nhỏ không tách TK 641' },
  { code: '6421', name: 'Chi phí nhân viên', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6422', name: 'Chi phí vật liệu, dụng cụ', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6423', name: 'Chi phí khấu hao TSCĐ', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6424', name: 'Thuế, phí và lệ phí', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6425', name: 'Chi phí dự phòng', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6426', name: 'Chi phí bằng tiền khác', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6427', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE_PROD', nature: 'DEBIT' },
  { code: '6428', name: 'Chi phí khác', type: 'EXPENSE_PROD', nature: 'DEBIT' },
];

/**
 * LOẠI 7: THU NHẬP KHÁC
 */
export const ACCOUNT_TYPE_7_INCOME_OTHER: AccountTemplate[] = [
  { code: '711', name: 'Thu nhập khác', nameEn: 'Other income', type: 'INCOME_OTHER', nature: 'CREDIT' },
];

/**
 * LOẠI 8: CHI PHÍ KHÁC
 */
export const ACCOUNT_TYPE_8_EXPENSE_OTHER: AccountTemplate[] = [
  { code: '811', name: 'Chi phí khác', nameEn: 'Other expenses', type: 'EXPENSE_OTHER', nature: 'DEBIT' },

  // === TK 821 - CHI PHÍ THUẾ TNDN ===
  { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', nameEn: 'Corporate income tax expense', type: 'EXPENSE_OTHER', nature: 'DEBIT' },
  { code: '8211', name: 'Chi phí thuế TNDN hiện hành', type: 'EXPENSE_OTHER', nature: 'DEBIT' },
  { code: '8212', name: 'Chi phí thuế TNDN hoãn lại', type: 'EXPENSE_OTHER', nature: 'DEBIT' },
];

/**
 * TẤT CẢ TÀI KHOẢN
 */
export const ALL_ACCOUNTS_TEMPLATE: AccountTemplate[] = [
  ...ACCOUNT_TYPE_1_SHORT_TERM_ASSETS,
  ...ACCOUNT_TYPE_2_LONG_TERM_ASSETS,
  ...ACCOUNT_TYPE_3_LIABILITIES,
  ...ACCOUNT_TYPE_4_EQUITY,
  ...ACCOUNT_TYPE_5_REVENUE,
  ...ACCOUNT_TYPE_6_EXPENSE_PROD,
  ...ACCOUNT_TYPE_7_INCOME_OTHER,
  ...ACCOUNT_TYPE_8_EXPENSE_OTHER,
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lấy level từ mã tài khoản
 */
export function getAccountLevel(code: string): number {
  return code.length - 2; // 111 -> 1, 1111 -> 2, 11111 -> 3
}

/**
 * Lấy mã TK cha
 */
export function getParentCode(code: string): string | undefined {
  if (code.length <= 3) return undefined;
  return code.substring(0, code.length - 1);
}

/**
 * Lấy loại TK từ mã
 */
export function getAccountTypeFromCode(code: string): AccountType {
  const firstDigit = code[0];
  switch (firstDigit) {
    case '1': return 'ASSET_SHORT';
    case '2': return 'ASSET_LONG';
    case '3': return 'LIABILITY';
    case '4': return 'EQUITY';
    case '5': return 'REVENUE';
    case '6': return 'EXPENSE_PROD';
    case '7': return 'INCOME_OTHER';
    case '8': return 'EXPENSE_OTHER';
    default: return 'ASSET_SHORT';
  }
}

/**
 * Lấy tên loại TK
 */
export function getAccountTypeName(type: AccountType): string {
  const names: Record<AccountType, string> = {
    'ASSET_SHORT': 'Loại 1 - Tài sản ngắn hạn',
    'ASSET_LONG': 'Loại 2 - Tài sản dài hạn',
    'LIABILITY': 'Loại 3 - Nợ phải trả',
    'EQUITY': 'Loại 4 - Vốn chủ sở hữu',
    'REVENUE': 'Loại 5 - Doanh thu',
    'EXPENSE_PROD': 'Loại 6 - Chi phí SXKD',
    'INCOME_OTHER': 'Loại 7 - Thu nhập khác',
    'EXPENSE_OTHER': 'Loại 8 - Chi phí khác'
  };
  return names[type];
}

/**
 * Lấy tên tính chất số dư
 */
export function getAccountNatureName(nature: AccountNature): string {
  const names: Record<AccountNature, string> = {
    'DEBIT': 'Dư Nợ',
    'CREDIT': 'Dư Có',
    'BOTH': 'Dư Nợ hoặc Có'
  };
  return names[nature];
}

/**
 * Kiểm tra mã TK có hợp lệ không
 */
export function isValidAccountCode(code: string): boolean {
  if (!code || code.length < 3) return false;
  if (!/^\d+$/.test(code)) return false;
  const firstDigit = code[0];
  return ['1', '2', '3', '4', '5', '6', '7', '8'].includes(firstDigit);
}

/**
 * Lấy các TK con trực tiếp
 */
export function getChildAccounts(accounts: Account[], parentCode: string): Account[] {
  return accounts.filter(a =>
    a.parentCode === parentCode ||
    (a.code.startsWith(parentCode) && a.code.length === parentCode.length + 1)
  );
}

/**
 * Tìm kiếm TK
 */
export function searchAccounts(accounts: Account[], search: string): Account[] {
  const searchLower = search.toLowerCase();
  return accounts.filter(a =>
    a.code.includes(search) ||
    a.name.toLowerCase().includes(searchLower) ||
    (a.nameEn && a.nameEn.toLowerCase().includes(searchLower))
  );
}
