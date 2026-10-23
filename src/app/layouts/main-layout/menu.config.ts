/**
 * MENU 3 MỤC (quyết định 22/10/2026 — plan-ketoan-flow.md mục 1)
 * Tiện ích (gồm nhóm Đối soát CK, Kiểm tra số lượng hóa đơn) · Kế toán chi tiết (nhóm 1–11) · Thiết lập
 */
export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  /** Nhãn nhóm con hiện ngay trước mục này (vd "Báo cáo thuế"). */
  subgroup?: string;
}

export interface MenuGroup {
  key: string;
  number?: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

export interface MenuSection {
  key: string;
  label: string;
  icon: string;
  /** Mục link thẳng (Tiện ích, Thiết lập). */
  items?: MenuItem[];
  /** Nhóm mở/đóng được (Đối soát CK, Kiểm tra số lượng hóa đơn, nhóm 1–11 của Kế toán chi tiết). */
  groups?: MenuGroup[];
  /** Link thẳng vẽ SAU các nhóm (mục cuối của Tiện ích: Số liệu khai thuế — user 23/10/2026). */
  tailItems?: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    key: 'tienIch',
    label: 'Tiện ích',
    icon: 'fa-toolbox',
    items: [
      // Đối soát hóa đơn XML đứng đầu (user 23/10/2026): là nguồn thuế suất HĐ vào cho Kiểm tra HĐ tự động
      { label: 'Đối soát hóa đơn XML', icon: 'fa-file-code', route: '/invoice-reconciliation-page' },
      { label: 'Kiểm tra HĐ tự động', icon: 'fa-rotate', route: '/invoice-check-page' },
      { label: 'Ánh xạ hàng hóa', icon: 'fa-link', route: '/item-mapping-page' },
    ],
    groups: [
      {
        // 23/10/2026: tách 2 mục con — đầu ra (HĐ KiotViet CK ⇄ sao kê TPBank) xong; đầu vào (HĐ mua ⇄ tiền trả NCC) chưa làm
        key: 'doiSoatCk', label: 'Đối soát CK', icon: 'fa-money-bill-transfer',
        items: [
          { label: 'Chuyển khoản HĐ đầu ra', icon: 'fa-file-export', route: '/bank-reconciliation-page' },
          { label: 'Chuyển khoản HĐ đầu vào', icon: 'fa-file-import', route: '/bank-reconciliation-in-page' },
        ],
      },
      {
        // 23/10/2026: đổi tên từ "Đồng bộ hóa đơn" (user)
        key: 'kiemTraSoLuongHd', label: 'Kiểm tra số lượng hóa đơn', icon: 'fa-file-circle-check',
        items: [
          { label: 'Hóa đơn đầu vào', icon: 'fa-file-import', route: '/accountant-pages/ledger-8-dong-bo-hoa-don-v2' },
          { label: 'Hóa đơn đầu ra', icon: 'fa-file-export', route: '/accountant-pages/ledger-9-dong-bo-hoa-don-dau-ra' },
        ],
      },
    ],
    tailItems: [
      { label: 'Số liệu khai thuế', icon: 'fa-calculator', route: '/tax-figures-page' },
    ],
  },
  {
    key: 'keToanChiTiet',
    label: 'Kế toán chi tiết',
    icon: 'fa-layer-group',
    groups: [
      {
        key: 'danhMuc', number: '1.', label: 'Danh mục kế toán', icon: 'fa-folder-tree',
        items: [
          { label: 'Hệ thống tài khoản', icon: 'fa-sitemap', route: '/chart-of-accounts-page' },
          { label: 'Khách hàng', icon: 'fa-user-tie', route: '/customer-page' },
          { label: 'Nhà cung cấp', icon: 'fa-truck-field', route: '/supplier-page' },
          { label: 'Nhân viên', icon: 'fa-id-badge', route: '/employee-page' },
          { label: 'Hàng hóa - Dịch vụ', icon: 'fa-boxes-stacked', route: '/product-page' },
          { label: 'Ngân hàng', icon: 'fa-building-columns', route: '/bank-page' },
        ],
      },
      {
        key: 'chungTu', number: '2.', label: 'Chứng từ kế toán', icon: 'fa-file-invoice',
        items: [
          { label: 'Phiếu thu', icon: 'fa-arrow-down', route: '/cash-voucher-page/receipt' },
          { label: 'Phiếu chi', icon: 'fa-arrow-up', route: '/cash-voucher-page/payment' },
          { label: 'Phiếu nhập kho', icon: 'fa-box-archive', route: '/warehouse-page/receipt' },
          { label: 'Phiếu xuất kho', icon: 'fa-truck-ramp-box', route: '/warehouse-page/issue' },
          { label: 'Chứng từ nghiệp vụ khác', icon: 'fa-file-circle-plus', route: '/other-voucher-page' },
        ],
      },
      {
        key: 'banHang', number: '3.', label: 'Bán hàng & Công nợ thu', icon: 'fa-cart-shopping',
        items: [
          { label: 'Hóa đơn bán ra', icon: 'fa-file-invoice-dollar', route: '/accountant-pages/sales-invoice-page' },
          { label: 'Sổ chi tiết TK 131', icon: 'fa-hand-holding-dollar', route: '/receivable-ledger-page' },
        ],
      },
      {
        key: 'muaHang', number: '4.', label: 'Mua hàng & Công nợ trả', icon: 'fa-truck',
        items: [
          { label: 'Hóa đơn mua vào', icon: 'fa-file-import', route: '/accountant-pages/purchase-invoice-page' },
          { label: 'Sổ chi tiết TK 331', icon: 'fa-credit-card', route: '/payable-ledger-page' },
        ],
      },
      {
        key: 'kho', number: '5.', label: 'Kho & Giá vốn', icon: 'fa-warehouse',
        items: [
          { label: 'Thẻ kho', icon: 'fa-clipboard-list', route: '/stock-card-page' },
          { label: 'Tổng hợp N-X-T', icon: 'fa-chart-simple', route: '/inventory-report-page' },
          { label: 'Giá vốn hàng bán (632)', icon: 'fa-calculator', route: '/cogs-page' },
        ],
      },
      {
        key: 'luong', number: '6.', label: 'Lương & Trích theo lương', icon: 'fa-money-bill-wave',
        items: [
          { label: 'Bảng lương', icon: 'fa-table', route: '/payroll-page' },
          { label: 'Thanh toán lương', icon: 'fa-money-check', route: '/salary-payment-page' },
          { label: 'BHXH, BHYT, BHTN', icon: 'fa-shield-halved', route: '/insurance-page' },
        ],
      },
      {
        key: 'tien', number: '7.', label: 'Tiền & Ngân hàng', icon: 'fa-wallet',
        items: [
          { label: 'Sổ quỹ tiền mặt (111)', icon: 'fa-cash-register', route: '/cash-book-page' },
          { label: 'Sổ tiền gửi NH (112)', icon: 'fa-university', route: '/bank-book-page' },
        ],
      },
      {
        key: 'thue', number: '8.', label: 'Thuế', icon: 'fa-landmark',
        items: [
          { label: 'Thuế GTGT', icon: 'fa-percent', route: '/vat-page' },
          { label: 'Thuế TNCN', icon: 'fa-user-minus', route: '/pit-page' },
          { label: 'Thuế TNDN', icon: 'fa-building', route: '/cit-page' },
          { label: 'Lệ phí môn bài', icon: 'fa-scroll', route: '/thue/mon-bai' },
        ],
      },
      {
        key: 'soTongHop', number: '9.', label: 'Sổ kế toán tổng hợp', icon: 'fa-book',
        items: [
          { label: 'Sổ nhật ký chung', icon: 'fa-book-open', route: '/journal-page' },
          { label: 'Sổ cái theo TK', icon: 'fa-book-bookmark', route: '/ledger-page' },
          { label: 'Bảng cân đối TK', icon: 'fa-scale-balanced', route: '/trial-balance-page' },
        ],
      },
      {
        key: 'baoCao', number: '10.', label: 'Báo cáo', icon: 'fa-chart-pie',
        items: [
          { label: 'Bảng cân đối kế toán', icon: 'fa-file-invoice-dollar', route: '/balance-sheet-page', subgroup: 'Báo cáo tài chính' },
          { label: 'Báo cáo KQKD', icon: 'fa-file-lines', route: '/income-statement-page' },
          { label: 'Lưu chuyển tiền tệ', icon: 'fa-money-bill-transfer', route: '/cash-flow-page' },
          { label: 'Tờ khai thuế GTGT', icon: 'fa-file-invoice', route: '/vat-declaration-page', subgroup: 'Báo cáo thuế' },
          { label: 'Báo cáo quản trị', icon: 'fa-chart-line', route: '/management-reports-page', subgroup: 'Báo cáo quản trị' },
        ],
      },
      {
        key: 'khoaSo', number: '11.', label: 'Khóa sổ & Kiểm toán', icon: 'fa-lock',
        items: [
          { label: 'Khóa sổ kế toán', icon: 'fa-lock', route: '/period-lock-page' },
          { label: 'Dấu vết kiểm toán', icon: 'fa-clock-rotate-left', route: '/audit-trail-page' },
        ],
      },
    ],
  },
  {
    key: 'thietLap',
    label: 'Thiết lập',
    icon: 'fa-sliders',
    items: [
      { label: 'Phân quyền', icon: 'fa-user-shield', route: '/user-roles-page' },
      { label: 'Cài đặt', icon: 'fa-gear', route: '/system-settings-page' },
    ],
  },
];

/** Đường dẫn (không query/fragment) có thuộc mục menu này không. */
export function matchesRoute(url: string, route: string): boolean {
  return url === route || url.startsWith(route + '/');
}
