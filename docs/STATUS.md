# Trạng thái hoàn thành - TapHoa39KeToan

**Cập nhật**: 22/10/2026 (rà lại tầng dữ liệu — xem mục "Trạng thái thực tế")
**Build status**: SUCCESS (1.74 MB, 26/01/2025)

---

## Tổng quan tiến độ

> ⚠️ "100%" bên dưới (26/01/2025) chỉ tính **giao diện**. Kiểm tra code ngày 22/10/2026: **chưa page nào hoàn chỉnh về dữ liệu**.

| Metric | Giá trị |
|--------|---------|
| Mục menu nhóm 1–11 của Kế toán chi tiết (không tính Kiểm tra số lượng hóa đơn ledger-8/9, nay ở Tiện ích) | 39 |
| Có giao diện | 39 (100%) |
| Lưu thật một phần (KeToanBackEnd) | 6 |
| Nguồn dữ liệu đã chết (GDT) | 4 |
| Chỉ có dữ liệu demo / lưu trong bộ nhớ | 27 |
| Chưa có chức năng / lỗi route | 2 |
| **Hoàn chỉnh cả dữ liệu** | **0** |

---

## ⏳ KẾ HOẠCH TIẾP THEO (21/10/2026)

| Việc | Plan | Trạng thái |
|---|---|---|
| **KeToan thay Vietda + tái cấu trúc UI** — menu 3 mục Tiện ích / Kế toán chi tiết / Thiết lập (22/10); nhập HĐ → Đối soát CK → hạch toán; kiểm HĐ đầu ra trước phát hành hằng ngày; số liệu khai thuế để copy/paste; Pha 0 = bảo mật + trang đăng nhập Google | `../plan-ketoan-flow.md` | Chưa làm — hỏi user mục 5 trước khi code (câu 10 đã chốt 22/10: job KiotViet ở KeToanBackEnd) |
| Bước 1: đối soát hóa đơn XML (đọc từ thư mục trên máy) + bảng kê + page tờ khai TNCN từ bảng lương | `../plan-doi-soat-web.md` | Chưa làm — hỏi user các quyết định ở mục 9 |
| Tải XML hóa đơn từ cổng thuế (extension) | `../plan-gdt-extension.md` | **Hủy** |
| "Đối soát CK", "Xuất bảng quy đổi" từ BanHang | `../plan-gdt-extension.md` mục 13 | Sau khi xong đối soát |

---

## ⚠️ TRẠNG THÁI THỰC TẾ — page chưa hoàn thành (kiểm tra code 22/10/2026)

Ký hiệu: 🟡 lưu thật một phần · 🟠 giao diện xong, nguồn dữ liệu đã chết · 🔴 chỉ có dữ liệu demo / lưu trong bộ nhớ
(F5 là mất) · ⛔ chưa có chức năng / lỗi. Nhóm theo menu mới (`../plan-ketoan-flow.md` mục 1). Route là route thật trong
`app.routes.ts` (bảng "Giao diện đã có" bên dưới còn ghi tên route cũ).

**Lỗi gốc:** phiếu thu / chi và phiếu kho đã ghi sổ **không sinh bút toán** sang Nhật ký chung. `journal.service`,
`general-ledger.service`, `trial-balance.service` tự sinh dữ liệu demo (lệnh gọi API đang bị comment), nên Sổ cái, Cân đối
tài khoản, CĐKT, KQKD, LCTT, Tờ khai GTGT đều ra **số giả**. Đây là mạch phải nối trước khi thay Vietda.

### Tiện ích

| Nhóm | Page | Route | TT | Thiếu / ghi chú |
|---|---|---|---|---|
| — | Kiểm tra HĐ tự động | `invoice-check-page` | 🟢 | 23/10/2026: job BE kiểm HĐ nháp einvoice 00:00 (bật `SCHEDULER_ENABLED` trên VPS) + Kiểm tra ngay; kiểm số học + thuế suất theo mã master (kế toán đặt / HĐ vào gần nhất); đặt thuế suất đúng ngay trên page. 23/10 thêm: so tổng tiền với HĐ bán KiotViet cùng mã, link mở đúng HĐ (`bills-invoice-vat?id=`). Chưa có: HĐ bán chưa chuyển nháp |
| — | Đối soát CK → Chuyển khoản HĐ đầu ra | `bank-reconciliation-page` | 🟢 | 23/10/2026: port BanHang (utils mirror), HĐ CK qua KeToanBackEnd (Firestore theo ngày, job 00:20), phân trang. Chưa có: HĐ vào ↔ tiền trả NCC, sinh phiếu thu (bước 3) |
| — | Đối soát hóa đơn XML | `invoice-reconciliation-page` | 🟡 | 23/10/2026: chạy được thật (upload → KeToanBackEnd `/api/reconciliation`, 15 tab như Excel của script). Chưa có: giá vốn bình quân + Bảng kê + Số liệu khai thuế (bước 5); chưa nối vào kho / hạch toán |
| — | Số liệu khai thuế | `tax-figures-page` | 🟢 | 23/10/2026 (bước 5): 01/GTGT ([22] sửa được), PL142, bảng kê 01-1 (bảng + Excel mẫu), 05/KK-TNCN (bảng lương tải lên) — TNCN Q3/2026 khớp tờ khai đã nộp. Chưa thử 01/GTGT với thư mục XML thật cả quý |
| — | Ánh xạ hàng hóa | `item-mapping-page` | 🟡 | 23/10/2026: sửa Mã master / Hệ số / Mã Vietda / Đã kiểm, tìm mã master KiotViet, lưu Firestore, Chạy lại đối soát. Chưa có: nhập hàng loạt `anh_xa_hang_hoa.xlsx` cũ lên máy chủ (hiện file chỉ dùng cho lần chạy có file đó) |
| Kiểm tra số lượng hóa đơn (tên cũ "Đồng bộ hóa đơn", đổi 23/10/2026) | HĐ đầu vào (ledger-8) | `accountant-pages/ledger-8-dong-bo-hoa-don-v2` | 🟡 | 23/10/2026: bỏ GDT → chọn thư mục XML trên máy (FDI, đọc trong trình duyệt `utils/invoice-xml.util.ts`) ⇄ Gmail portal-links. Chưa thử với Gmail thật |
| | HĐ đầu ra (ledger-9) | `accountant-pages/ledger-9-dong-bo-hoa-don-dau-ra` | 🟢 | 23/10/2026 viết lại (bản cũ gọi `/api/v2/invoices/output` + `/api/kiotviet/*` — KeToanBackEnd không có): thư mục XML trên máy ⇄ HĐĐT KiotViet (`GET /api/einvoice-check/bills`) theo mẫu số + ký hiệu + số; khớp / lệch tiền / chỉ XML / chỉ KiotViet, CSV, link mở HĐĐT. `OutputInvoiceServiceV2` + `KiotvietService.getInvoices` nay không page nào dùng (chỉ còn kiểu trong `accountant-cache.service`) |

### Kế toán chi tiết

| Nhóm | Page | Route | TT | Thiếu / ghi chú |
|---|---|---|---|---|
| 1. Danh mục | Hệ thống tài khoản | `chart-of-accounts-page` | 🔴 | 70 TK cài sẵn trong code; thêm / sửa không lưu |
| | Khách hàng | `customer-page` | 🔴 | `loadDemoData()` |
| | Nhà cung cấp | `supplier-page` | 🔴 | `loadDemoData()` |
| | Nhân viên | `employee-page` | 🔴 | `loadDemoData()` |
| | Hàng hóa - Dịch vụ | `product-page` | 🔴 | `loadDemoData()`; chưa dùng mã Vietda / mã master (plan mục 3) |
| | Ngân hàng | `bank-page` | 🔴 | `loadDemoData()` |
| 2. Chứng từ | Phiếu thu, Phiếu chi | `cash-voucher-page/receipt`, `/payment` | 🟡 | Lưu thật (`/api/cash-vouchers`). Xuất Excel / PDF trả file rỗng "Demo". POSTED chưa sinh bút toán |
| | Phiếu nhập kho, Phiếu xuất kho | `warehouse-page/receipt`, `/issue` | 🟡 | Phiếu lưu thật (warehouse-voucher API). Danh sách kho ở localStorage; hàng hóa / KH / NCC chọn từ danh mục demo |
| | Chứng từ nghiệp vụ khác | `other-voucher-page` | 🔴 | `loadDemoData()` |
| 3. Bán hàng | Hóa đơn bán ra | `accountant-pages/sales-invoice-page` | 🟠 | HĐ lấy từ GDT (đã chặn) + cache IndexedDB. Nút tạo phiếu thu + xuất kho từ HĐ dùng service thật |
| | Sổ chi tiết TK 131 | `receivable-ledger-page` | 🟠 | HĐ từ GDT cache + phiếu thu thật |
| 4. Mua hàng | Hóa đơn mua vào | `accountant-pages/purchase-invoice-page` | 🟠 | Như HĐ bán ra |
| | Sổ chi tiết TK 331 | `payable-ledger-page` | 🟠 | HĐ từ GDT cache + phiếu chi thật |
| 5. Kho | Thẻ kho | `stock-card-page` | 🟡 | Phiếu kho thật; danh mục hàng demo |
| | Tổng hợp N-X-T | `inventory-report-page` | 🔴 | Số giả: tồn đầu = tồn − 10, nhập 20, xuất 10 |
| | Giá vốn hàng bán (632) | `cogs-page` | 🔴 | `loadDemoData()`; phải đổi sang bình quân gia quyền (plan mục 2 bước 3) |
| 6. Lương | Bảng lương | `payroll-page` | 🔴 | `loadDemoData()`; chưa đọc `LUONG SM 2026.xlsx` |
| | Thanh toán lương | `salary-payment-page` | 🔴 | Lưu trong bộ nhớ, tạo từ bảng lương demo |
| | BHXH, BHYT, BHTN | `insurance-page` | 🔴 | Lưu trong bộ nhớ, tạo từ bảng lương demo |
| 7. Tiền | Sổ quỹ tiền mặt (111) | `cash-book-page` | 🟡 | Đọc phiếu thu / chi thật; số dư đầu kỳ ghi cứng 10.000.000 |
| | Sổ tiền gửi NH (112) | `bank-book-page` | 🔴 | `DEFAULT_ENTRIES` + `loadDemoData()`; số dư đầu 50.000.000 demo |
| 8. Thuế | Thuế GTGT | `vat-page` | 🔴 | localStorage + demo |
| | Thuế TNCN | `pit-page` | 🔴 | Lưu trong bộ nhớ; mức giảm trừ cũ 11.000.000 / 4.400.000 (2026: 15.500.000 / 6.200.000) |
| | Thuế TNDN | `cit-page` | 🔴 | Page tự tạo demo, không có service |
| | Lệ phí môn bài | `thue/mon-bai` | ⛔ | Có trong menu nhưng **không có route** → bị đưa về Tổng quan |
| 9. Sổ tổng hợp | Sổ nhật ký chung | `journal-page` | 🔴 | `generateDemoData()`, API bị comment |
| | Sổ cái theo TK | `ledger-page` | 🔴 | `generateDemoAccounts/Entries()`; xuất toàn bộ sổ cái "đang phát triển" |
| | Bảng cân đối TK | `trial-balance-page` | 🔴 | `generateDemoData()` |
| 10. Báo cáo | Bảng cân đối kế toán | `balance-sheet-page` | 🔴 | Tính từ Cân đối TK demo |
| | Báo cáo KQKD | `income-statement-page` | 🔴 | `buildDemoReport()`; xuất Excel / PDF trả file rỗng "Demo" |
| | Lưu chuyển tiền tệ | `cash-flow-page` | 🔴 | `generateDemoInputData()` |
| | Tờ khai thuế GTGT | `vat-declaration-page` | 🔴 | `loadDemoData()`; sẽ thay bằng page số liệu copy / paste HTKK (plan mục 2) |
| | Báo cáo quản trị | `management-reports-page` | ⛔ | Chỉ có thẻ, bấm vào báo "Tính năng đang phát triển" |
| Khóa sổ + Dấu vết | Khóa sổ kế toán | `period-lock-page` | 🔴 | Lưu trong bộ nhớ; quyền ghi cứng `CHIEF_ACCOUNTANT`; bước kiểm tra trước khi khóa luôn "pass" |
| | Dấu vết kiểm toán | `audit-trail-page` | 🔴 | Lưu trong bộ nhớ (API bị comment); xuất báo cáo "đang phát triển" |

### Thiết lập

| Page | Route | TT | Thiếu / ghi chú |
|---|---|---|---|
| Phân quyền | `user-roles-page` | 🔴 | User / role ghi cứng trong component; nút "Lưu" chỉ hiện thông báo; chưa nối đăng nhập |
| Cài đặt | `system-settings-page` | 🔴 | Nút "Lưu" chỉ hiện thông báo; sao lưu / khôi phục "đang phát triển" |

---

## GIAO DIỆN ĐÃ CÓ (39/39) — dữ liệu xem mục "Trạng thái thực tế"

### Dashboard (1/1) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 1 | Tổng quan (dữ liệu thật 23/10/2026: GTGT từ Đối soát XML, phiếu thu/chi, kho, Kiểm tra HĐ) | `/accountant-dashboard` | AccountantDashboardComponent |

### Danh mục (6/6) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 2 | Hệ thống tài khoản | `/danh-muc/tai-khoan` | ChartOfAccountsPageComponent |
| 3 | Danh mục khách hàng | `/danh-muc/khach-hang` | CustomerPageComponent |
| 4 | Danh mục nhà cung cấp | `/danh-muc/nha-cung-cap` | SupplierPageComponent |
| 5 | Danh mục hàng hóa | `/danh-muc/hang-hoa` | ProductPageComponent |
| 6 | Danh mục nhân viên | `/danh-muc/nhan-vien` | EmployeePageComponent |
| 7 | Danh mục ngân hàng | `/danh-muc/ngan-hang` | BankPageComponent |

### Chứng từ (5/5) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 8 | Phiếu thu | `/chung-tu/phieu-thu` | CashVoucherPageComponent |
| 9 | Phiếu chi | `/chung-tu/phieu-chi` | CashVoucherPageComponent |
| 10 | Phiếu nhập kho | `/chung-tu/phieu-nhap-kho` | WarehousePageComponent |
| 11 | Phiếu xuất kho | `/chung-tu/phieu-xuat-kho` | WarehousePageComponent |
| 12 | Chứng từ khác | `/chung-tu/chung-tu-khac` | OtherVoucherPageComponent |

### Bán hàng (2/2) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 13 | Hóa đơn bán ra | `/ban-hang/hoa-don-ban-ra` | InvoicePageComponent |
| 14 | Sổ chi tiết TK 131 | `/ban-hang/cong-no-131` | ReceivableLedgerPageComponent |

### Mua hàng (2/2) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 15 | Hóa đơn mua vào | `/mua-hang/hoa-don-mua-vao` | InvoicePageComponent |
| 16 | Sổ chi tiết TK 331 | `/mua-hang/cong-no-331` | PayableLedgerPageComponent |

### Kho (3/3) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 17 | Thẻ kho | `/kho/the-kho` | StockCardPageComponent |
| 18 | Tổng hợp NXT | `/kho/nhap-xuat-ton` | InventoryReportPageComponent |
| 19 | Giá vốn hàng bán | `/kho/gia-von-632` | COGSPageComponent |

### Lương (3/3) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 20 | Bảng lương | `/luong/bang-luong` | PayrollPageComponent |
| 21 | Thanh toán lương | `/luong/thanh-toan-luong` | SalaryPaymentPageComponent |
| 22 | BHXH, BHYT, BHTN | `/luong/bao-hiem` | InsurancePageComponent |

### Tiền (2/2) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 23 | Sổ quỹ tiền mặt | `/tien/quy-tien-mat` | CashBookPageComponent |
| 24 | Sổ tiền gửi NH | `/tien/tien-ngan-hang` | BankBookPageComponent |

### Thuế (3/3) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 25 | Thuế GTGT | `/thue/gtgt` | VATPageComponent |
| 26 | Thuế TNCN | `/thue/tncn` | PITPageComponent |
| 27 | Thuế TNDN | `/thue/tndn` | CITPageComponent |

### Sổ tổng hợp (3/3) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 28 | Sổ nhật ký chung | `/so-tong-hop/nhat-ky-chung` | JournalPageComponent |
| 29 | Sổ cái | `/so-tong-hop/so-cai` | LedgerPageComponent |
| 30 | Bảng cân đối TK | `/so-tong-hop/bang-can-doi-tai-khoan` | TrialBalancePageComponent |

### Báo cáo tài chính (5/5) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 31 | Bảng CĐKT (B01-DNN) | `/bao-cao/bang-can-doi-ke-toan` | BalanceSheetPageComponent |
| 32 | Báo cáo KQKD (B02-DNN) | `/bao-cao/ket-qua-kinh-doanh` | IncomeStatementPageComponent |
| 33 | LCTT (B03-DNN) | `/bao-cao/luu-chuyen-tien-te` | CashFlowPageComponent |
| 34 | Tờ khai thuế GTGT | `/bao-cao/thue` | VATDeclarationPageComponent |
| 35 | Báo cáo quản trị | `/bao-cao/quan-tri` | ManagementReportsPageComponent |

### Hệ thống (4/4) ✓
| # | Tính năng | Route | Component |
|---|-----------|-------|-----------|
| 36 | Khóa sổ | `/he-thong/khoa-so` | PeriodLockPageComponent |
| 37 | Audit Trail | `/he-thong/audit-trail` | AuditTrailPageComponent |
| 38 | Phân quyền người dùng | `/he-thong/phan-quyen` | UserRolesPageComponent |
| 39 | Cài đặt hệ thống | `/he-thong/cai-dat` | SystemSettingsPageComponent |

---

## Changelog

### 26/01/2025 - Session 6 (FINAL)
- ✅ Hoàn thành **Payroll Page** (Bảng lương TK 334) - Purple theme
- ✅ Hoàn thành **Salary Payment Page** (Thanh toán lương) - Green theme
- ✅ Hoàn thành **Insurance Page** (BHXH/BHYT/BHTN TK 3383/3384/3386) - Cyan theme
- ✅ Hoàn thành **PIT Page** (Thuế TNCN TK 3335) - Indigo theme
- ✅ Hoàn thành **CIT Page** (Thuế TNDN TK 3334) - Sky Blue theme
- ✅ Hoàn thành **Management Reports Page** (Báo cáo quản trị) - Multi-color KPI
- ✅ Hoàn thành **User Roles Page** (Phân quyền người dùng) - Purple theme
- ✅ Hoàn thành **System Settings Page** (Cài đặt hệ thống) - Slate theme
- Tiến độ: 30 → **39 pages (100%)**
- Build: 1.74 MB

### 22/01/2025 - Session 5
- ✅ Hoàn thành **Bank Book Page** (Sổ tiền gửi NH) - Teal theme
- ✅ Hoàn thành **COGS Page** (Giá vốn hàng bán TK 632) - Orange theme
- ✅ Hoàn thành **VAT Declaration Page** (Tờ khai thuế GTGT 01/GTGT) - Red theme
- Tiến độ: 27 → 30 pages (77%)
- Build: 1.53 MB

### 22/01/2025 - Session 4
- ✅ Hoàn thành **Employee Page** (Danh mục nhân viên) - Teal theme
- ✅ Hoàn thành **Bank Page** (Danh mục ngân hàng) - Navy Blue theme
- ✅ Hoàn thành **Other Voucher Page** (Chứng từ khác) - Amber/Orange theme
- Tiến độ: 24 → 27 pages (69%)
- Build: 1.39 MB

### 22/01/2025 - Session 3
- ✅ Hoàn thành **Stock Card Page** (Thẻ kho)
- ✅ Hoàn thành **Inventory Report Page** (Tổng hợp NXT)
- ✅ Hoàn thành **Receivable Ledger Page** (Sổ chi tiết TK 131)
- ✅ Hoàn thành **Payable Ledger Page** (Sổ chi tiết TK 331)
- ✅ Hoàn thành **Cash Book Page** (Sổ quỹ tiền mặt)
- Tiến độ: 14 → 24 pages (60%)
- Build: 1.26 MB

### 21/01/2025 - Session 2
- ✅ Hoàn thành **Customer Page** (Danh mục khách hàng)
- ✅ Hoàn thành **Supplier Page** (Danh mục nhà cung cấp)
- ✅ Hoàn thành **Product Page** (Danh mục hàng hóa)
- ✅ Hoàn thành **Warehouse Page** (Phiếu nhập/xuất kho)
- ✅ Hoàn thành **VAT Page** (Thuế GTGT)
- Tiến độ: 14 → 19 pages

### 19/01/2025 - Session 1
- Tạo documentation files trong `/docs/`
- Xác nhận 14/40 pages hoàn thành
- Build: 887.39 kB

### Previous
- Hoàn thành Income Statement (KQKD)
- Hoàn thành Chart of Accounts
- Hoàn thành Cash Vouchers (Phiếu thu/chi)
- Hoàn thành Invoice (Hóa đơn mua/bán)
- Hoàn thành Journal, Ledger, Trial Balance
- Hoàn thành Balance Sheet, Cash Flow
- Hoàn thành Period Lock, Audit Trail

---

## Ghi chú kỹ thuật

### Components mới tạo (Session 6)
```
src/app/components/
├── payroll-page/              # Bảng lương TK 334 - Purple theme
├── salary-payment-page/       # Thanh toán lương - Green theme
├── insurance-page/            # BHXH/BHYT/BHTN - Cyan theme
├── pit-page/                  # Thuế TNCN TK 3335 - Indigo theme
├── cit-page/                  # Thuế TNDN TK 3334 - Sky Blue theme
├── management-reports-page/   # Báo cáo quản trị - Multi-color
├── user-roles-page/           # Phân quyền - Purple theme
└── system-settings-page/      # Cài đặt hệ thống - Slate theme

src/app/models/
├── payroll.models.ts          # Payroll, PayrollLine, PayrollStatus
├── salary-payment.models.ts   # SalaryPayment, PaymentLine, PaymentMethod
├── insurance.models.ts        # InsuranceReport, InsuranceDetail, RATES
└── pit.models.ts              # PITDeclaration, PITDetail, PIT_BRACKETS

src/app/services/
├── payroll.service.ts         # CRUD, calculate, approve workflow
├── salary-payment.service.ts  # CRUD, createFromPayroll, workflow
├── insurance.service.ts       # CRUD, createReport, getYearSummary
└── pit.service.ts             # CRUD, createFromPayroll, tax brackets
```

### Tỷ lệ bảo hiểm 2024
| Loại | Người LĐ | Doanh nghiệp |
|------|----------|--------------|
| BHXH | 8% | 17.5% |
| BHYT | 1.5% | 3% |
| BHTN | 1% | 1% |
| BHTNLD | - | 0.5% |
| **Tổng** | **10.5%** | **22%** |

### Biểu thuế TNCN lũy tiến
| Bậc | Thu nhập tính thuế/tháng | Thuế suất |
|-----|--------------------------|-----------|
| 1 | Đến 5 triệu | 5% |
| 2 | 5 - 10 triệu | 10% |
| 3 | 10 - 18 triệu | 15% |
| 4 | 18 - 32 triệu | 20% |
| 5 | 32 - 52 triệu | 25% |
| 6 | 52 - 80 triệu | 30% |
| 7 | Trên 80 triệu | 35% |

Giảm trừ: Bản thân 11 triệu/tháng, NPT 4.4 triệu/người/tháng (mức cũ, `PITService` vẫn dùng; năm 2026: 15,5 triệu / 6,2 triệu)

### Dependencies (thiết kế giao diện — 22/10/2026: phần lớn CHƯA nối dữ liệu thật, xem "Trạng thái thực tế")
```
✅ Danh mục KH/NCC/Hàng hóa → Hóa đơn, Phiếu kho
✅ Hóa đơn, Phiếu thu/chi → Công nợ 131/331
✅ Phiếu nhập/xuất kho → Thẻ kho, NXT
✅ Phiếu thu/chi → Sổ quỹ tiền mặt
✅ Hóa đơn mua/bán → Thuế GTGT
✅ Danh mục nhân viên → Bảng lương, BHXH
✅ Danh mục ngân hàng → Sổ tiền gửi NH
✅ Chứng từ khác → Bút toán điều chỉnh, khấu hao
✅ Phiếu xuất kho → Giá vốn hàng bán TK 632
✅ Hóa đơn mua/bán → Tờ khai thuế GTGT 01/GTGT
✅ Bảng lương → Thanh toán lương, Thuế TNCN, BHXH
```

---

## Giao diện đã đủ (26/01/2025) — dữ liệu chưa (22/10/2026)

Giao diện TapHoa39KeToan đã có **100%** (chưa nối dữ liệu thật — mục "Trạng thái thực tế"):
- 11 module chức năng
- 39 trang/màn hình
- Tuân thủ Thông tư 133/2016/TT-BTC
- Dành cho Công ty TNHH 1 thành viên - Doanh nghiệp nhỏ & vừa
