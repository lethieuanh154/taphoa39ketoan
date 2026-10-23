# Routes - TapHoa39KeToan

## Cấu trúc Routing

```
/ (MainLayoutComponent)
├── dashboard
├── danh-muc/
│   ├── tai-khoan
│   ├── khach-hang
│   ├── nha-cung-cap
│   ├── nhan-vien
│   ├── hang-hoa
│   └── ngan-hang
├── chung-tu/
│   ├── phieu-thu
│   ├── phieu-chi
│   ├── phieu-nhap-kho
│   ├── phieu-xuat-kho
│   └── chung-tu-khac
├── ban-hang/
│   ├── hoa-don-ban-ra
│   └── cong-no-131
├── mua-hang/
│   ├── hoa-don-mua-vao
│   └── cong-no-331
├── kho/
│   ├── the-kho
│   ├── nhap-xuat-ton
│   └── gia-von-632
├── luong/
│   ├── bang-luong
│   ├── thanh-toan-luong
│   └── bao-hiem
├── tien/
│   ├── quy-tien-mat
│   └── tien-ngan-hang
├── thue/
│   ├── gtgt
│   ├── tncn
│   ├── tndn
│   └── mon-bai
├── so-tong-hop/
│   ├── nhat-ky-chung
│   ├── so-cai
│   └── bang-can-doi-tai-khoan
├── bao-cao/
│   ├── bang-can-doi-ke-toan
│   ├── ket-qua-kinh-doanh
│   ├── luu-chuyen-tien-te
│   ├── thue
│   └── quan-tri
└── he-thong/
    ├── khoa-so
    ├── audit-trail
    ├── phan-quyen
    └── cai-dat
```

> Cây trên là tên cũ, không khớp `app.routes.ts` (path thật dạng `*-page`). Menu hiện tại: mục dưới.

## Menu 3 mục (22/10/2026) — `layouts/main-layout/menu.config.ts`

Sidebar dựng từ `MENU_SECTIONS`: **Tiện ích** (link thẳng — Đối soát hóa đơn XML đứng đầu, trước Kiểm tra HĐ tự động (user 23/10/2026) — + nhóm Đối soát CK, Kiểm tra số lượng hóa đơn) · **Kế toán chi tiết** (nhóm 1–11) · **Thiết lập** (link thẳng).
Thêm / bớt trang trong menu → sửa `menu.config.ts`, không sửa HTML. Nhóm chứa trang đang mở tự bung khi điều hướng.

| Mục | Path | Component | Ghi chú |
|-----|------|-----------|---------|
| Tiện ích | `/invoice-check-page` | InvoiceCheckPageComponent (`loadComponent`) | Kiểm tra HĐ tự động (23/10/2026). `?run=<id>` = mở 1 lần kiểm. `noPeriodBar` |
| Tiện ích | nhóm **Đối soát CK** → `/bank-reconciliation-page` | BankReconciliationPageComponent (`loadComponent`) | "Chuyển khoản HĐ đầu ra" (23/10/2026) — khoảng ngày theo thanh chọn kỳ / theo sao kê |
| Tiện ích | nhóm **Đối soát CK** → `/bank-reconciliation-in-page` | BankReconciliationInPageComponent (lazy) | "Chuyển khoản HĐ đầu vào" (23/10/2026): HĐ mua (thư mục XML / Gmail) ⇄ tiền ra trên sao kê TPBank |
| Tiện ích | `/invoice-reconciliation-page` | InvoiceReconciliationPageComponent (`loadComponent`, tải riêng) | Đối soát hóa đơn XML (23/10/2026). `?run=<id>` = mở 1 lần đối soát |
| Tiện ích (mục cuối, sau các nhóm — `tailItems`) | `/tax-figures-page` | TaxFiguresPageComponent (`loadComponent`) | Số liệu khai thuế (bước 5, 23/10/2026): 01/GTGT, PL142, bảng kê bán ra / mua vào, 05/KK-TNCN. `?run=<id>` |
| Tiện ích | `/item-mapping-page` | ItemMappingPageComponent (`loadComponent`) | Ánh xạ hàng hóa (23/10/2026). `?run=<id>` (trống = lần đối soát mới nhất). `canDeactivate` hỏi lại khi còn thay đổi chưa lưu |
| Tiện ích | nhóm **Kiểm tra số lượng hóa đơn** (đổi tên từ "Đồng bộ hóa đơn" 23/10/2026): `/accountant-pages/ledger-8-dong-bo-hoa-don-v2` (đầu vào: XML máy ⇄ Gmail), `/accountant-pages/ledger-9-dong-bo-hoa-don-dau-ra` (đầu ra: XML máy ⇄ HĐĐT KiotViet) | | Trước là nhóm 0 "Kiểm tra hóa đơn tự động"; chuyển sang Tiện ích (user 22/10/2026) |
| Kế toán chi tiết | 1. Danh mục … 10. Báo cáo, **11. Khóa sổ & Kiểm toán** (`period-lock-page`, `audit-trail-page`) | | |
| Thiết lập | `/user-roles-page`, `/system-settings-page` | | Chuyển khỏi nhóm "Hệ thống" cũ |

Route data `noPeriodBar: true` → ẩn thanh chọn kỳ (đang đặt cho 6 trang Danh mục + 2 trang Thiết lập).
Link `/thue/mon-bai` (Lệ phí môn bài) có trong menu từ trước nhưng **chưa có route** → về dashboard.

---

## Chi tiết Routes

### Dashboard
| Path | Component | Status |
|------|-----------|--------|
| `/dashboard` | AccountantDashboardComponent | ✅ ACTIVE |

### 1. Danh mục kế toán
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/danh-muc/tai-khoan` | ChartOfAccountsPageComponent | - | ✅ ACTIVE |
| `/danh-muc/khach-hang` | PlaceholderComponent | title: 'Danh mục khách hàng' | ⏳ Placeholder |
| `/danh-muc/nha-cung-cap` | PlaceholderComponent | title: 'Danh mục nhà cung cấp' | ⏳ Placeholder |
| `/danh-muc/nhan-vien` | PlaceholderComponent | title: 'Danh mục nhân viên' | ⏳ Placeholder |
| `/danh-muc/hang-hoa` | PlaceholderComponent | title: 'Danh mục hàng hóa - dịch vụ' | ⏳ Placeholder |
| `/danh-muc/ngan-hang` | PlaceholderComponent | title: 'Danh mục ngân hàng' | ⏳ Placeholder |

### 2. Chứng từ kế toán
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/chung-tu/phieu-thu` | CashVoucherPageComponent | type: 'RECEIPT' | ✅ ACTIVE |
| `/chung-tu/phieu-chi` | CashVoucherPageComponent | type: 'PAYMENT' | ✅ ACTIVE |
| `/chung-tu/phieu-nhap-kho` | PlaceholderComponent | title: 'Phiếu nhập kho' | ⏳ Placeholder |
| `/chung-tu/phieu-xuat-kho` | PlaceholderComponent | title: 'Phiếu xuất kho' | ⏳ Placeholder |
| `/chung-tu/chung-tu-khac` | PlaceholderComponent | title: 'Chứng từ khác' | ⏳ Placeholder |

### 3. Bán hàng & Công nợ phải thu
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/ban-hang/hoa-don-ban-ra` | InvoicePageComponent | type: 'OUTPUT' | ✅ ACTIVE |
| `/ban-hang/cong-no-131` | PlaceholderComponent | title: 'Sổ chi tiết TK 131' | ⏳ Placeholder |

### 4. Mua hàng & Công nợ phải trả
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/mua-hang/hoa-don-mua-vao` | InvoicePageComponent | type: 'INPUT' | ✅ ACTIVE |
| `/mua-hang/cong-no-331` | PlaceholderComponent | title: 'Sổ chi tiết TK 331' | ⏳ Placeholder |

### 5. Kho & Giá vốn
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/kho/the-kho` | PlaceholderComponent | title: 'Thẻ kho' | ⏳ Placeholder |
| `/kho/nhap-xuat-ton` | PlaceholderComponent | title: 'Tổng hợp N-X-T' | ⏳ Placeholder |
| `/kho/gia-von-632` | PlaceholderComponent | title: 'Giá vốn hàng bán' | ⏳ Placeholder |

### 6. Lương & Các khoản trích
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/luong/bang-luong` | PlaceholderComponent | title: 'Bảng lương' | ⏳ Placeholder |
| `/luong/thanh-toan-luong` | PlaceholderComponent | title: 'Thanh toán lương' | ⏳ Placeholder |
| `/luong/bao-hiem` | PlaceholderComponent | title: 'BHXH, BHYT, BHTN' | ⏳ Placeholder |

### 7. Tiền & Ngân hàng
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/tien/quy-tien-mat` | PlaceholderComponent | title: 'Sổ quỹ tiền mặt' | ⏳ Placeholder |
| `/tien/tien-ngan-hang` | PlaceholderComponent | title: 'Sổ tiền gửi ngân hàng' | ⏳ Placeholder |

### 8. Thuế
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/thue/gtgt` | PlaceholderComponent | title: 'Thuế GTGT' | ⏳ Placeholder |
| `/thue/tncn` | PlaceholderComponent | title: 'Thuế TNCN' | ⏳ Placeholder |
| `/thue/tndn` | PlaceholderComponent | title: 'Thuế TNDN' | ⏳ Placeholder |
| `/thue/mon-bai` | PlaceholderComponent | title: 'Lệ phí môn bài' | ⏳ Placeholder |

### 9. Sổ kế toán tổng hợp
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/so-tong-hop/nhat-ky-chung` | JournalPageComponent | - | ✅ ACTIVE |
| `/so-tong-hop/so-cai` | LedgerPageComponent | - | ✅ ACTIVE |
| `/so-tong-hop/bang-can-doi-tai-khoan` | TrialBalancePageComponent | - | ✅ ACTIVE |

### 10. Báo cáo tài chính
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/bao-cao/bang-can-doi-ke-toan` | BalanceSheetPageComponent | - | ✅ ACTIVE |
| `/bao-cao/ket-qua-kinh-doanh` | IncomeStatementPageComponent | - | ✅ ACTIVE |
| `/bao-cao/luu-chuyen-tien-te` | CashFlowPageComponent | - | ✅ ACTIVE |
| `/bao-cao/thue` | PlaceholderComponent | title: 'Tờ khai thuế GTGT' | ⏳ Placeholder |
| `/bao-cao/quan-tri` | PlaceholderComponent | title: 'Báo cáo quản trị' | ⏳ Placeholder |

### 11. Hệ thống & Quản trị
| Path | Component | Data | Status |
|------|-----------|------|--------|
| `/he-thong/khoa-so` | PeriodLockPageComponent | - | ✅ ACTIVE |
| `/he-thong/audit-trail` | AuditTrailPageComponent | - | ✅ ACTIVE |
| `/he-thong/phan-quyen` | PlaceholderComponent | title: 'Phân quyền người dùng' | ⏳ Placeholder |
| `/he-thong/cai-dat` | PlaceholderComponent | title: 'Cài đặt hệ thống' | ⏳ Placeholder |

---

## Thống kê

| Nhóm | Active | Placeholder | Tổng |
|------|--------|-------------|------|
| Dashboard | 1 | 0 | 1 |
| Danh mục | 1 | 5 | 6 |
| Chứng từ | 2 | 3 | 5 |
| Bán hàng | 1 | 1 | 2 |
| Mua hàng | 1 | 1 | 2 |
| Kho | 0 | 3 | 3 |
| Lương | 0 | 3 | 3 |
| Tiền | 0 | 2 | 2 |
| Thuế | 0 | 4 | 4 |
| Sổ tổng hợp | 3 | 0 | 3 |
| Báo cáo | 3 | 2 | 5 |
| Hệ thống | 2 | 2 | 4 |
| **TỔNG** | **14** | **26** | **40** |

---

## Route Guards

Đã có (22/10/2026) — `guards/auth.guard.ts`:
- `/login` → `LoginPageComponent`, `canActivate: [loginGuard]` (đã đăng nhập thì về `/accountant-dashboard`).
- Route `''` (MainLayout + mọi page con, kể cả `**`) → `canActivate: [authGuard]`: chờ `AuthService.authState$.ready`,
  chưa đăng nhập → `/login?returnUrl=<url>`.

```typescript
// Còn dự kiến:
RoleGuard          // Kiểm tra quyền (khi có phân quyền — user-roles-page)
PeriodLockGuard    // Kiểm tra khóa sổ khi edit
```

---

## Imports trong app.routes.ts

```typescript
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { AccountantDashboardComponent } from './components/accountant-dashboard/accountant-dashboard.component';
import { PlaceholderComponent } from './components/placeholder/placeholder.component';
import { JournalPageComponent } from './components/journal-page/journal-page.component';
import { LedgerPageComponent } from './components/ledger-page/ledger-page.component';
import { TrialBalancePageComponent } from './components/trial-balance-page/trial-balance-page.component';
import { BalanceSheetPageComponent } from './components/balance-sheet-page/balance-sheet-page.component';
import { CashFlowPageComponent } from './components/cash-flow-page/cash-flow-page.component';
import { AuditTrailPageComponent } from './components/audit-trail-page/audit-trail-page.component';
import { PeriodLockPageComponent } from './components/period-lock-page/period-lock-page.component';
import { IncomeStatementPageComponent } from './components/income-statement-page/income-statement-page.component';
import { ChartOfAccountsPageComponent } from './components/chart-of-accounts-page/chart-of-accounts-page.component';
import { CashVoucherPageComponent } from './components/cash-voucher-page/cash-voucher-page.component';
import { InvoicePageComponent } from './components/accountant-pages/invoice-page/invoice-page.component';
```
