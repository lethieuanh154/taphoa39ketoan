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
 * - Loại 9: Xác định kết quả kinh doanh (911)
 *
 * Danh mục lưu ở ledger-rs (Postgres) — `/api/ledger/accounts`, xem ChartOfAccountsService.
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
  | 'EXPENSE_OTHER'     // Chi phí khác (Loại 8)
  | 'RESULT';           // Xác định KQKD (Loại 9)

/**
 * Tính chất số dư tài khoản (NONE = TK loại 5–9, không có số dư cuối kỳ)
 */
export type AccountNature = 'DEBIT' | 'CREDIT' | 'BOTH' | 'NONE';

/**
 * Trạng thái tài khoản (TK hệ thống xem `isSystemAccount`, không phải trạng thái)
 */
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Một tài khoản kế toán
 */
export interface Account {
  code: string;                 // Mã TK: 111, 1111, 11111... (khóa chính, không đổi được)
  name: string;                 // Tên TK: Tiền mặt
  nameEn?: string;              // Tên tiếng Anh (BE không lưu)
  parentCode?: string;          // Mã TK cha: 111 -> undefined, 1111 -> 111
  type: AccountType;            // Loại TK (BE suy từ chữ số đầu)
  nature: AccountNature;        // Tính chất số dư
  level: number;                // Cấp độ: 1 = TK bậc 1, 2 = TK bậc 2, 3 = TK bậc 3
  isParent: boolean;            // Có TK con không? (= !isLeaf)
  isLeaf?: boolean;             // Không có TK con — BE luôn trả; optional chỉ để form tạo TK
  postable?: boolean;           // Được hạch toán = TK lá + đang dùng — BE luôn trả
  isDetailRequired: boolean;    // Bắt buộc hạch toán chi tiết? (= detailType khác NONE)
  detailType?: DetailType;      // Loại chi tiết: CUSTOMER, SUPPLIER, EMPLOYEE...
  description?: string;         // Mô tả (BE không lưu — dùng note)
  note?: string;                // Ghi chú
  status: AccountStatus;        // Trạng thái
  isSystemAccount: boolean;     // TK hệ thống (nạp từ TÀI KHOẢN.xlsx): không đổi mã/cha, không xóa
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * 1 dòng lịch sử thêm/sửa/xóa TK (GET /api/ledger/accounts/{code}/history), mới nhất trước
 */
export interface AccountHistoryEntry {
  id: string;
  at: Date;
  userEmail: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  changes: { field: string; old: unknown; new: unknown }[];   // chỉ có với UPDATE
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
  search?: string;              // Tìm theo tiền tố mã hoặc tên (có/không dấu) — lọc ở BE
  type?: AccountType;           // Lọc theo loại — BE
  status?: AccountStatus;       // Lọc theo trạng thái — BE
  postable?: boolean;           // true = chỉ TK được hạch toán — BE
  level?: number;               // Lọc theo cấp — lọc tại FE
  isParent?: boolean;           // Chỉ lấy TK cha hoặc TK lá — lọc tại FE
  parentCode?: string;          // Lấy TK con của TK cha — lọc tại FE
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
    case '9': return 'RESULT';
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
    'EXPENSE_OTHER': 'Loại 8 - Chi phí khác',
    'RESULT': 'Loại 9 - Xác định KQKD'
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
    'BOTH': 'Dư Nợ hoặc Có',
    'NONE': 'Không có số dư'
  };
  return names[nature];
}

/**
 * Kiểm tra mã TK có hợp lệ không — cùng luật BE `accounts_code_chk`: 3–6 chữ số, bắt đầu 1–9
 */
export function isValidAccountCode(code: string): boolean {
  return !!code && /^[1-9][0-9]{2,5}$/.test(code);
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
