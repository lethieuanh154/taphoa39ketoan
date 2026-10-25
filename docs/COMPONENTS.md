# Components - TapHoa39KeToan

## 1. AccountantDashboardComponent — Tổng quan (dữ liệu thật từ 23/10/2026)

**Path**: `components/accountant-dashboard/`
**Route**: `/accountant-dashboard` (trang chủ)

### Chức năng
Theo kỳ ở thanh chọn kỳ (PeriodService); mỗi khối tải riêng, 1 nguồn lỗi chỉ báo lỗi ở khối đó; đổi kỳ nhanh không bị kết quả cũ ghi đè.
- **Thuế GTGT**: lần Đối soát hóa đơn XML (đã xong) có kỳ ĐÚNG kỳ đang chọn → [34] [35] [23] [25] [40] [43]; [22] = số kế toán nhập ở
  Số liệu khai thuế (localStorage `ketoan_v22_<run>`), chưa nhập thì [22] trong XML tờ khai kỳ trước; tính [40]/[43] bằng
  `utils/gtgt.util.ts` `recalcGtgt` (dùng chung với trang Số liệu khai thuế). Kỳ chưa có lần đối soát → trạng thái trống + link
  Đối soát hóa đơn XML / lần đối soát gần nhất (không hiện số).
- **Chứng từ & kiểm tra**: phiếu thu / chi (`/api/cash-vouchers/statistics`, không tính phiếu hủy — KHÔNG phải số dư 111/112),
  phiếu nhập / xuất kho (`/api/warehouse-vouchers/statistics`), lần Kiểm tra HĐ tự động gần nhất (lỗi / cảnh báo, lịch BẬT/TẮT).
- **Hoạt động trong kỳ**: phiếu thu / chi, phiếu kho (bỏ phiếu hủy) + lần đối soát XML tạo trong kỳ → 10 mục mới nhất.
- Thao tác nhanh: Đối soát hóa đơn XML, Kiểm tra HĐ tự động, Đối soát CK, Số liệu khai thuế, Phiếu thu / chi.
- ĐÃ BỎ (23/10/2026): số liệu giả, thẻ Chi phí / Lợi nhuận / số dư 111-112 (chưa có sổ cái + số dư đầu kỳ thật), bộ chọn kỳ riêng,
  nút Khóa sổ giả (PeriodLockService vẫn là demo).

### Dependencies
- PeriodService, ReconciliationService (listRuns, getFigures — có cache IndexedDB), CashVoucherApiService, WarehouseVoucherApiService,
  EinvoiceCheckService

---

## 2. JournalPageComponent

**Path**: `components/journal-page/`
**Route**: `/so-tong-hop/nhat-ky-chung`

### Chức năng
- Sổ nhật ký chung - READ ONLY
- Hiển thị tất cả transactions theo thứ tự ngày
- Filter: Kỳ (tháng/quý/năm), từ ngày - đến ngày
- Drill-down đến chứng từ gốc
- Kiểm tra Nợ = Có

### Dependencies
- JournalService

---

## 3. LedgerPageComponent

**Path**: `components/ledger-page/`
**Route**: `/so-tong-hop/so-cai`

### Chức năng
- Sổ cái theo tài khoản - READ ONLY
- Số dư đầu kỳ + Phát sinh Nợ/Có = Số dư cuối kỳ
- Filter: Kỳ, tài khoản, tính chất TK (Nợ/Có)
- Option hiển thị TK có số dư = 0
- Drill-down đến chứng từ

### Dependencies
- GeneralLedgerService

---

## 4. TrialBalancePageComponent

**Path**: `components/trial-balance-page/`
**Route**: `/so-tong-hop/bang-can-doi-tai-khoan`

### Chức năng
- Bảng cân đối tài khoản
- Tổng Nợ = Tổng Có (validation)
- Tổng hợp tất cả TK với số dư đầu/cuối kỳ

### Dependencies
- TrialBalanceService

---

## 5. BalanceSheetPageComponent

**Path**: `components/balance-sheet-page/`
**Route**: `/bao-cao/bang-can-doi-ke-toan`

### Chức năng
- Báo cáo tài chính: Bảng CĐKT (Mẫu B01-DNN)
- Cấu trúc: Tài sản = Nợ phải trả + Vốn chủ sở hữu
- Filter theo kỳ báo cáo
- So sánh kỳ trước

### Dependencies
- BalanceSheetService

---

## 6. IncomeStatementPageComponent

**Path**: `components/income-statement-page/`
**Route**: `/bao-cao/ket-qua-kinh-doanh`

### Chức năng
- Báo cáo KQKD (Mẫu B02-DNN)
- 15 chỉ tiêu theo TT 133
- Doanh thu - Chi phí = Lợi nhuận
- Summary cards: Doanh thu thuần, Giá vốn, LN gộp, LN thuần

### Template mapping (invoice.models.ts)
```typescript
INCOME_STATEMENT_TEMPLATE: [
  { code: '01', name: 'Doanh thu bán hàng', accountMapping: ['511'] },
  { code: '02', name: 'Các khoản giảm trừ', accountMapping: ['521'] },
  { code: '10', name: 'Doanh thu thuần', formula: '01 - 02' },
  // ... 15 chỉ tiêu
]
```

### Dependencies
- IncomeStatementService

---

## 7. CashFlowPageComponent

**Path**: `components/cash-flow-page/`
**Route**: `/bao-cao/luu-chuyen-tien-te`

### Chức năng
- Báo cáo LCTT (Mẫu B03-DNN)
- 3 hoạt động: Kinh doanh, Đầu tư, Tài chính
- Phương pháp trực tiếp

### Dependencies
- CashFlowService

---

## 8. ChartOfAccountsPageComponent

**Path**: `components/chart-of-accounts-page/`
**Route**: `/danh-muc/tai-khoan`

### Chức năng
- Hệ thống tài khoản theo TT 133
- 3 view modes: Tree / List / Group
- CRUD: Thêm / Sửa / Xem chi tiết TK
- Search & filter
- 8 loại TK (Loại 1-8)

### Account Types
```typescript
ASSET_SHORT      // Loại 1: TS ngắn hạn
ASSET_LONG       // Loại 2: TS dài hạn
LIABILITY_SHORT  // Loại 3: Nợ ngắn hạn
LIABILITY_LONG   // Loại 4: Nợ dài hạn
EQUITY           // Loại 4: Vốn CSH
REVENUE          // Loại 5: Doanh thu
EXPENSE_COGS     // Loại 6: Giá vốn
EXPENSE_OTHER    // Loại 6: Chi phí khác
```

### Dependencies
- ChartOfAccountsService

---

## 9. CashVoucherPageComponent

**Path**: `components/cash-voucher-page/`
**Route**: `/chung-tu/phieu-thu` (RECEIPT) | `/chung-tu/phieu-chi` (PAYMENT)

### Chức năng
- Quản lý phiếu thu/chi tiền mặt
- Workflow: DRAFT → POSTED → CANCELLED
- Tự động sinh bút toán (Journal Entry)
- Multi-line support
- VAT handling

### Bút toán sinh ra
```
Phiếu thu: Nợ 111 / Có 131, 511, 711...
Phiếu chi: Nợ 331, 642, 811... / Có 111
```

### Route Data
```typescript
{ path: 'phieu-thu', data: { type: 'RECEIPT' } }
{ path: 'phieu-chi', data: { type: 'PAYMENT' } }
```

### Dependencies
- CashVoucherService

---

## 10. InvoicePageComponent

**Path**: `components/accountant-pages/invoice-page/`
**Route**: `/ban-hang/hoa-don-ban-ra` (OUTPUT) | `/mua-hang/hoa-don-mua-vao` (INPUT)

### Chức năng
- Quản lý hóa đơn GTGT (TT 78/2021)
- 2 loại: Bán ra (OUTPUT) / Mua vào (INPUT)
- Workflow: DRAFT → POSTED → CANCELLED / ADJUSTED
- Payment tracking: UNPAID → PARTIAL → PAID
- VAT calculation (0%, 5%, 8%, 10%, không chịu thuế)
- Journal entry generation

### Bút toán sinh ra
```
HĐ bán ra:  Nợ 131 / Có 511, 3331
HĐ mua vào: Nợ 156, 152, 642, 133 / Có 331
```

### Route Data
```typescript
{ path: 'hoa-don-ban-ra', data: { type: 'OUTPUT' } }
{ path: 'hoa-don-mua-vao', data: { type: 'INPUT' } }
```

### Features
- Summary cards: Tổng HĐ, Giá trị, VAT, Đã TT, Chưa TT
- Status tabs: Tất cả / Nháp / Đã ghi sổ / Đã hủy
- Filters: Ngày, trạng thái TT, search
- Modals: Create, Detail, Journal, Cancel, Payment

### Dependencies
- InvoiceService (trong models/invoice.service.ts)

---

## 11. PeriodLockPageComponent

**Path**: `components/period-lock-page/`
**Route**: `/he-thong/khoa-so`

### Chức năng
- Khóa sổ kế toán theo kỳ
- Ngăn chỉnh sửa dữ liệu kỳ đã khóa
- Yêu cầu authorization để mở khóa
- Lịch sử khóa/mở

### Dependencies
- PeriodLockService

---

## 12. AuditTrailPageComponent

**Path**: `components/audit-trail-page/`
**Route**: `/he-thong/audit-trail`

### Chức năng
- Theo dõi lịch sử thao tác
- Log: User, Action, Timestamp, Changes
- Filter theo user, action type, date range

### Dependencies
- AuditLogService

---

## 13. PlaceholderComponent

**Path**: `components/placeholder/`
**Route**: Nhiều routes chưa implement

### Chức năng
- Template cho các tính năng chưa phát triển
- Hiển thị title từ route data
- Message "Tính năng đang phát triển"

---

## 14. MainLayoutComponent

**Path**: `layouts/main-layout/`

### Chức năng
- Master layout với sidebar navigation
- Menu 3 mục (22/10/2026) dựng từ `menu.config.ts`: Tiện ích (gồm nhóm Đối soát CK, Kiểm tra số lượng hóa đơn) · Kế toán chi tiết (nhóm 1–11) · Thiết lập — chi tiết ở
  `docs/ROUTES.md` mục "Menu 3 mục". Mặc định mở Tiện ích + Kế toán chi tiết; nhóm chứa trang đang mở tự bung khi điều hướng.
- Thanh chọn kỳ `<app-period-selector>` dính trên đầu vùng nội dung (ẩn khi route data `noPeriodBar: true`)
- RouterOutlet cho child components
- Responsive design
- Cuối sidebar (22/10/2026): email đang đăng nhập + trạng thái Gmail của hộp thư hóa đơn; menu "Kết nối Gmail" (khi
  chưa có refresh token) và "Đăng xuất". Đã bỏ popup `shared/hddt-token-dialog` (đăng nhập cổng thuế GDT — GDT chặn tự động).
- MST công ty (23/10/2026, `CompanyService`): chưa nhập → popup nhập tự hiện; dòng `MST: …` dưới trạng thái Gmail ở góc dưới
  sidebar, bấm để đổi (cũng có trong menu tài khoản).

---

## InvoiceReconciliationPageComponent — Tiện ích "Đối soát hóa đơn XML" (23/10/2026)

**Path**: `components/invoice-reconciliation-page/` — route `/invoice-reconciliation-page` (lazy).

- Bảng quy đổi ĐVT KiotViet: trạng thái + "Cập nhật bảng quy đổi" + "Tải JSON".
- "Chọn thư mục" (`<input webkitdirectory>`) → tóm tắt file sẽ gửi (XML, ZIP, bảng lương, danh mục Vietda, ánh xạ) → kỳ
  tính thuế: **theo thanh chọn kỳ** (mặc định) hoặc tự nhận quý → MST (tùy chọn) → **Đối soát**: nén (0–20%) → upload
  (20–50%) → máy chủ chạy (tiến trình theo bước của BE).
- Kết quả: thẻ số liệu (HĐ vào / ra, mặt hàng cần xem, ngoại lệ Cao / TB / Thấp), lưu ý của script, 15 tab (bỏ "Huong dan" —
  nội dung thành khung "Hướng dẫn đọc tab này"), tải Excel đầy đủ / ZIP XML quy đổi. Bảng = `app-server-table`.
- "Các lần đối soát gần đây" (lưu 7 ngày trên máy chủ): Xem / Xóa. Lần đang xem nằm trên URL `?run=<id>`.

## BankReconciliationPageComponent — Tiện ích "Đối soát CK" (23/10/2026)

**Path**: `components/bank-reconciliation-page/` — route `/bank-reconciliation-page` (lazy). Port BanHang cùng tên.

- Chọn 1 / nhiều file Bảng kê TPBank (.xlsx, `utils/tpbank-statement.util.ts`) → khoảng ngày = ngày GD thực tế trong file;
  chưa import → theo thanh chọn kỳ (`PeriodService`). "Bỏ sao kê" → về theo kỳ.
- **Lấy hóa đơn KiotViet** → `BankReconciliationService.load()`: đọc HĐ CK đã lưu trên máy chủ; ngày chưa lấy / chưa hết ngày →
  máy chủ lấy từ KiotViet (≤ 7 ngày / lần, có tiến trình). **Lấy lại từ KiotViet** = mọi ngày (cập nhật trạng thái HĐĐT).
- Khớp theo số tiền + 3 tab Đối soát / CK nhiều lần / CK dư + Xuất CSV: y BanHang (`utils/transfer-reconcile.util.ts`).
  Khác BanHang: bảng 2 cột **phân trang** (100–1000 dòng / trang, KeToan chưa có `@angular/cdk`), bỏ nút "Đánh sao HĐ thiếu".
- (23/10/2026) Tab CK nhiều lần + CK dư có cột **Số HĐ** (số HĐĐT CQT đã chấp nhận, `readKvEInvoice`; chưa có → trống, rê chuột xem
  trạng thái). CSV các tab vốn đã có cột HĐĐT.

## TaxFiguresPageComponent — Tiện ích "Số liệu khai thuế" (bước 5, 23/10/2026)

**Path**: `components/tax-figures-page/` — route `/tax-figures-page?run=<id>` (lazy), mục CUỐI của Tiện ích (`tailItems` trong menu).

- Chọn lần đối soát (mặc định mới nhất; nhắc khi khác kỳ đang chọn). Chỉ hiện số để copy / paste HTKK — nút copy = số thuần.
- **01/GTGT**: dòng theo thứ tự HTKK (`tk_rows` của BE); ô **[22]** sửa được → tính lại [40a] [40] [41] [43] ngay (nhớ theo lần
  đối soát trong localStorage `ketoan_v22_<id>`, nút Mặc định); cột Đã nộp / Kết quả khi thư mục có XML tờ khai cùng kỳ.
- **Phụ lục 142**: [06] [08] [09] + bảng I / II (server-table). **Bảng kê bán ra / mua vào**: server-table (lọc cột Nhóm, xuất
  Excel / CSV theo bộ lọc) + nút tải bảng kê Excel theo mẫu 01-1.
- **05/KK-TNCN**: từ bảng lương trong thư mục đối soát, hoặc chọn file bảng lương (+ XML tờ khai đã nộp để so) → tính theo kỳ đang
  chọn (`POST /api/reconciliation/tncn`); bảng chi tiết theo người.

## Ledger8 / Ledger9 — Tiện ích "Kiểm tra số lượng hóa đơn" (23/10/2026)

- Đọc thư mục XML HĐĐT trên máy (app FDI) bằng `utils/invoice-xml.util.ts` (`readInvoiceFiles` — XML + ZIP lồng, `DOMParser`,
  khóa trùng MST bán | ký hiệu | số; `detectCompanyMst(invoices, 'buyer' | 'seller')`) — không tải XML lên máy chủ.
- **Đầu vào** (`ledger-8-dong-bo-hoa-don-v2`): giữ HĐ bên mua = công ty → đối chiếu với Gmail portal-links (thay GDT), kỳ mặc định
  theo thanh chọn kỳ. Logic so khớp `_matchAndCompare` giữ nguyên (trường `gdtData` nay là dữ liệu XML). Gmail thiếu MST (HAR
  23/10: 17/20 email) → khớp số HĐ + ký hiệu (bỏ chữ số mẫu số đầu); Gmail lấy đúng kỳ (`before_date`, page_size 500).
  Ghép viết lại 23/10/2026 (`_matchAndCompare`, sau lần chạy Gmail thật tháng 10: 143 email chỉ ra 101 dòng): email không đọc
  được số HĐ → dòng "Gmail không đọc được số HĐ" (có tiêu đề + nút mở email); chỉ gộp email cùng số + ký hiệu + MST + người
  gửi ("N email"), cùng số khác ký hiệu / người gửi = HĐ khác; mỗi HĐ XML ghép 1 email, email khác trúng HĐ đã ghép cộng vào số
  email của dòng; email chưa lấy được số tiền hiện "?" thay vì 0 đ. Thẻ tổng thêm "Chưa có số tiền", "Gmail không đọc được số
  HĐ", "Email gửi trùng" + dòng cộng đối chiếu số email.
- **Đầu ra** (`ledger-9-dong-bo-hoa-don-dau-ra`, viết lại): giữ HĐ bên bán = công ty → so với HĐĐT KiotViet đã phát hành
  (`EinvoiceCheckService.listBills`, ≤ 92 ngày) theo mẫu số + ký hiệu + số → Khớp / Lệch số tiền (chưa thuế, thuế, tổng TT) /
  Chỉ XML / Chỉ KiotViet; nháp chỉ đếm. Lọc, tìm, phân trang 100, Xuất CSV, link mở HĐ trên einvoiceapp.
- (23/10/2026) Cả 2 trang: MST công ty lấy từ `CompanyService` (chưa nhập mới tự nhận; khác MST tự nhận → cảnh báo). XML đã đọc,
  HĐĐT / link Gmail đã lấy lưu IndexedDB (`TienIchCacheService`) → quay lại trang hiện ngay kết quả cũ; "Lấy lại từ KiotViet" /
  "Tải lại" / chọn lại thư mục để cập nhật.
- (23/10/2026 chiều) Cả 2 trang: bỏ ô Từ / Đến ngày (cả tab Links HĐ gốc) — khoảng ngày = KỲ ở thanh chọn kỳ (đổi kỳ → hiện kết quả
  đã lưu của kỳ mới); đọc XML, lấy HĐĐT, lấy Gmail chạy NỀN (`BackgroundJobService`) → chuyển trang không dừng, quay lại thấy tiến độ.
  Đầu ra bỏ nút "Theo ngày trong XML"; kỳ > 92 ngày → nhắc chọn Tháng / Quý.

## InvoiceCheckPageComponent — Tiện ích "Kiểm tra HĐ tự động" (23/10/2026)

**Path**: `components/invoice-check-page/` — route `/invoice-check-page?run=<id>` (lazy, không thanh chọn kỳ).

- Trạng thái lịch tự kiểm của máy chủ (00:00, 12:00, 17:00, 21:00); **Kiểm tra ngay**: chỉ HĐ nháp còn tồn (23/10/2026 bỏ kiểm HĐ
  đã phát hành) → hỏi tiến trình mỗi 1,5 giây.
- Kết quả: thống kê (HĐ lỗi / cần xem / không lỗi / mặt hàng chưa biết thuế suất đúng), tab HĐ có lỗi (mặc định) · Tất cả HĐ ·
  Chưa biết thuế suất đúng (có khung giải thích nguồn thuế suất) · Mã không có trong bảng quy đổi · Thuế suất đúng theo mã master.
  Mã HĐ = link mở đúng HĐ trên einvoiceapp (`?id=`) + nút copy. Lệch tiền ≥ 1đ = Lỗi, TRỪ thuế làm tròn lên / xuống < 1đ (thuế dòng; thuế nhóm = cộng các dòng đúng) — user 23/10/2026 chiều.
- Đặt thuế suất đúng: tại dòng lỗi ("Đúng là 10%" / "Khóa 8%"), tại bảng chưa có thuế suất, hoặc bảng thuế suất (chọn / bỏ) →
  `PUT /tax-rates`, áp dụng từ lần kiểm sau. Lịch sử các lần kiểm.

## ItemMappingPageComponent — Tiện ích "Ánh xạ hàng hóa" (23/10/2026)

**Path**: `components/item-mapping-page/` — route `/item-mapping-page?run=<id>` (lazy, `canDeactivate` → `canLeave()`).

- Chọn lần đối soát (mặc định mới nhất) → tab Đầu vào / Đầu ra (bảng `anh-xa-*` của BE, phân trang / tìm / lọc / sắp xếp ở BE).
- Sửa được (cột vàng): **Đã kiểm** (checkbox), **Mã master** (+ nút tìm theo mã / mã vạch / tên trong bảng quy đổi KiotViet;
  bấm tên = chọn mã, bấm 1 ĐVT = chọn mã + hệ số của ĐVT đó), **Hệ số** (nhận `24`, `0.5`, `1.234,5`; sai → ô đỏ, không cho
  lưu), **Mã Vietda**. "SL quy đổi" tính lại ngay khi sửa hệ số.
- Lọc nhanh theo cờ "Cần xem": Chưa ghép · Thiếu hệ số · Tin cậy thấp · Lệch ĐVT. Thay đổi chưa lưu giữ khi chuyển trang /
  lọc; hoàn tác từng dòng hoặc "Bỏ thay đổi"; rời trang / đóng tab khi chưa lưu → hỏi lại.
- **Lưu** → `PUT /runs/{id}/mapping` (cột "Đã lưu" = Có) → **Chạy lại đối soát** → mở lần chạy mới ở trang Đối soát.
- Trang Đối soát có nút "Sửa ánh xạ hàng hóa (n cần xem)"; lần chạy lại ghi "Chạy lại" và ẩn nút tải XML quy đổi.

## ServerTableComponent — bảng phân trang phía máy chủ (23/10/2026)

**Path**: `components/shared/server-table/` — `<app-server-table [source]="...">`, `source: ServerTableSource`
`{ id, load(query) → Observable<TabPage>, export?(format, query) }`. Đổi `id` → về trang 1, xóa lọc.

- Tìm (không cần dấu), lọc từng cột (dòng ô lọc dưới tiêu đề), bấm tiêu đề để sắp xếp (tăng → giảm → bỏ), phân trang
  20–500 dòng, xuất Excel / CSV đúng bộ lọc. Gõ xong 0,4 giây mới gọi BE.
- Định dạng theo `formats` (mã định dạng Excel của script: `#,##0`, `#,##0.00`, `#,##0.###`, `0.0%`), ngày `dd/mm/yyyy`,
  số không có định dạng (số HĐ, STT) hiện nguyên. **Bảng mới có nhiều dòng nên dùng component này.**

---

## PeriodSelectorComponent (22/10/2026)

**Path**: `components/shared/period-selector/` — đặt trong MainLayout, không đặt lại trong từng page.

- Nút: Hôm nay · Tuần này · Tháng · Quý · Năm · Từ ngày – đến ngày; nút ◀ ▶ = kỳ trước / kỳ sau.
- Tháng / Quý / Năm: chọn bằng dropdown (năm 2020 → năm sau); Từ ngày – đến ngày: 2 ô ngày + "Áp dụng" (lỗi hiện ngay
  trên thanh). Bên phải hiện khoảng ngày thật của kỳ.
- Trạng thái nằm ở `PeriodService` (`docs/SERVICES.md`).

---

## LoginPageComponent (22/10/2026)

**Path**: `components/login-page/` — route `/login` (ngoài MainLayout, `loginGuard`)

### Chức năng
- Nút "Đăng nhập bằng Google" → `AuthService.signInWithGoogle()`; lỗi whitelist / popup bị chặn / máy chủ không phản hồi
  hiện ngay trên trang.
- Đăng nhập xong mà hộp thư hóa đơn chưa có refresh token Gmail → bước "Kết nối Gmail" (1 lần) hoặc "Để sau".
- Xong → `returnUrl` (chỉ nhận đường dẫn nội bộ) hoặc `/accountant-dashboard`.

### Dependencies
- AuthService

## BankReconciliationInPageComponent — Tiện ích "Đối soát CK → Chuyển khoản HĐ đầu vào" (23/10/2026)

**Path**: `components/bank-reconciliation-in-page/` — route `/bank-reconciliation-in-page` (lazy).

Giống "Chuyển khoản HĐ đầu ra" nhưng HĐ là HĐ **mua vào** và tiền là tiền **ra** (Ghi nợ) trên sao kê TPBank.
- **Nguồn HĐ** (chọn 1, nhớ lựa chọn): thư mục XML (app FDI `…\purchase`) hoặc Gmail — dùng chung bản đã đọc / đã lấy với Kiểm tra số lượng
  HĐ đầu vào (`PurchaseInvoiceSourceService`, IndexedDB `xml-in` / `gmail-links:*:<kỳ>`, chạy nền). HĐ theo kỳ ở thanh chọn kỳ; XML dùng cả
  HĐ ngoài kỳ để ghép tiền trả HĐ cũ nhưng chỉ báo "HĐ chưa thấy CK" cho HĐ trong kỳ. Gmail: chỉ email có số HĐ + số tiền mới đối soát được.
- **Sao kê**: 1 hoặc nhiều file Bảng kê TPBank → `utils/tpbank-debit.util.ts` (cột D Ghi nợ; bỏ GD trùng khi chọn trùng file), lưu
  IndexedDB `tpbank-debit`. Đo thật: sao kê tháng 9 = 86 GD tiền ra (3.803 GD tiền vào), 100% có chủ TK nhận.
- **Ghép** `utils/purchase-transfer-reconcile.util.ts`: 1 CK = 1 HĐ (số tiền bằng nhau, ưu tiên tên người nhận giống tên NCC — bỏ
  "Công ty / TNHH / Thương mại…", không dấu — hoặc diễn giải có số HĐ, ngày gần) → 1 CK trả nhiều HĐ cùng NCC (2–8 HĐ) → 1 HĐ trả
  nhiều lần (2–4 CK) → HĐ chưa thấy CK / CK không có HĐ (kèm gợi ý CK / HĐ cùng NCC lệch số tiền). CK trong [ngày HĐ − 30, + 120 ngày].
  Độ tin cậy cao / vừa / thấp ("Khớp — cần xem" = chỉ khớp số tiền, tên người nhận khác tên NCC).
- Thống kê, lọc theo kết quả, tìm, phân trang 100, Xuất CSV, mở email gốc (nguồn Gmail).

## TableLoadingComponent — vòng xoay "đang tải" của bảng (23/10/2026)

**Path**: `components/shared/table-loading/` — `<app-table-loading [text]="..." [overlay]="true|false">`.
- Mặc định (chưa có bảng): vòng xoay + chữ giữa vùng bảng (cao ≥ 160px). `overlay` (đang tải lại khi đã có bảng): phủ mờ lên bảng cũ —
  phần tử cha phải `position: relative`.
- Dùng ở: `server-table` (mọi bảng Đối soát hóa đơn XML / Số liệu khai thuế), Kiểm tra HĐ tự động (mở lần kiểm, bảng thuế suất), Số liệu
  khai thuế, Ánh xạ hàng hóa, Chuyển khoản HĐ đầu ra / đầu vào, Kiểm tra số lượng HĐ đầu vào / đầu ra (cả bảng Links HĐ gốc), Tổng quan.

- (24/10/2026) **Chuyển khoản HĐ đầu vào chọn được sao kê PDF** (`utils/tpbank-pdf.util.ts`, `pdfjs-dist` 4.10.38 tải khi cần; worker nạp như module
  qua `globalThis.pdfjsWorker`, không cần file asset): file PDF TPBank in xoay ngang — mỗi GD 1 cột dọc, mỗi thông tin 1 dải y; đo trên T03.pdf (22 trang):
  đủ 384 GD ghi có + 45 GD ghi nợ, khớp file xlsx cùng tháng từng GD (PDF có thể CẮT tên chủ TK quá dài — so tên vẫn ghép được).
  Chọn lẫn .xlsx + .pdf: gộp, bỏ GD trùng theo mã GD (`mergeDebitStatements`).
- (24/10/2026) **Chuyển khoản HĐ đầu ra**: lấy xong mà KiotViet không có HĐ CK nào trong khoảng ngày → cảnh báo rõ. Đo 24/10/2026: KiotViet chỉ
  ghi phương thức "chuyển khoản" từ khoảng đầu 04/2026 (tháng 3: 25–40 HĐ / ngày, 0 HĐ CK) → tháng 3 trở về trước không đối soát được.
- (24/10/2026) Kiểm tra HĐ tự động: lịch 4 giờ / ngày → chỉ hiện "Lần tới" gần nhất (trước bị lỗi NG0955 trùng khóa `einvoice_check`).
- (25/10/2026) **Chuyển khoản HĐ đầu vào — nhiều sao kê**: chọn nhiều file 1 lần (Ctrl / Shift, vd T01.pdf + T02.pdf + T03.pdf, trộn .xlsx / .pdf)
  hoặc **Thêm file** vào sao kê đang dùng; chip từng file (số GD tiền ra, tổng) có nút bỏ file. Bỏ GD trùng theo mã GD + giờ + số tiền
  (TPBank ghi PHÍ chuyển khoản trùng mã GD với khoản chuyển — bỏ trùng chỉ theo mã từng xóa nhầm phí). Đo: T01 8 · T02 24 · T03 45 GD ra.
- (25/10/2026) **Kiểm tra số lượng HĐ đầu vào — Đếm nhanh** (`utils/invoice-count.util.ts` `compareCounts`,
  `PurchaseInvoiceSourceService.startGmailCount` → BE `/api/gmail/message-count`): chỉ ĐẾM email nhận trong kỳ (người gửi / tiêu đề /
  giờ, không nội dung / đính kèm / scrape) ⇄ số HĐ XML trong kỳ (kể cả HĐ thay thế / điều chỉnh). Tổng bằng nhau = **Khớp số lượng**;
  lệch → bảng theo NGÀY (ngày lập HĐ ⇄ ngày Gmail nhận), chỉ hiện ngày chênh (tùy chọn hiện mọi ngày), bấm 1 ngày xem email + HĐ XML
  của ngày đó, gợi ý "gửi trễ / sớm 1 ngày". Chạy nền + lưu IndexedDB `gmail-count:<nhãn>:<từ>:<đến>`; nhãn NCC đang chọn thì lọc theo nhãn.
