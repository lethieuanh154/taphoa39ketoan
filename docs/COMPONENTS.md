# Components - TapHoa39KeToan

## 1. AccountantDashboardComponent

**Path**: `components/accountant-dashboard/`
**Route**: `/dashboard`

### Chức năng
- Hiển thị KPI tổng quan: Doanh thu, Chi phí, Lợi nhuận, VAT, Tiền mặt
- Bộ lọc kỳ: Tháng / Quý / Năm
- Quick actions: Tạo phiếu thu/chi, hóa đơn
- Recent activity feed
- Period lock/unlock status

### Dependencies
- AccountantService, PeriodLockService

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
- 12 menu groups (expandable)
- RouterOutlet cho child components
- Export/Print buttons (placeholder)
- Responsive design

### Menu Groups (mặc định expanded)
- soTongHop: true
- heThong: true
