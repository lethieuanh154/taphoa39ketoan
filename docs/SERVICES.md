# Services - TapHoa39KeToan

## Tổng quan

| Service | File | Size | Mô tả |
|---------|------|------|-------|
| AccountantService | services/accountant.service.ts | 15 KB | Core data management |
| AccountantCacheService | services/accountant-cache.service.ts | 16 KB | Caching layer |
| JournalService | services/journal.service.ts | 9.6 KB | Sổ nhật ký chung |
| GeneralLedgerService | services/general-ledger.service.ts | 17 KB | Sổ cái |
| TrialBalanceService | services/trial-balance.service.ts | 8.5 KB | Bảng cân đối TK |
| BalanceSheetService | services/balance-sheet.service.ts | 10 KB | BCĐKT |
| IncomeStatementService | services/income-statement.service.ts | 16 KB | Báo cáo KQKD |
| CashFlowService | services/cash-flow.service.ts | 18 KB | LCTT |
| ChartOfAccountsService | services/chart-of-accounts.service.ts | 9.5 KB | Hệ thống TK |
| CashVoucherService | services/cash-voucher.service.ts | 17 KB | Phiếu thu/chi |
| InvoiceService | **models**/invoice.service.ts | 28 KB | Hóa đơn |
| AuditLogService | services/audit-log.service.ts | 13 KB | Audit trail |
| PeriodLockService | services/period-lock.service.ts | 18 KB | Khóa sổ |
| KiotVietService | services/kiotviet.service.ts | 29 KB | KiotViet integration |
| ExportService | services/export.service.ts | 9.2 KB | Export PDF/Excel |
| FilterService | services/filter.service.ts | 6.4 KB | Filter utilities |
| FormattingUtils | services/formatting.utils.ts | 4.3 KB | Format helpers |

---

## 1. AccountantService

**File**: `services/accountant.service.ts`

### Chức năng
- Quản lý 7 loại sổ kế toán (S1-HKD đến S7-HKD) theo TT 88/2021
- LocalStorage persistence
- CRUD operations cho ledger entries

### Methods chính
```typescript
getLedgerData(type: LedgerType): Observable<LedgerEntry[]>
saveLedgerData(type: LedgerType, data: LedgerEntry[]): void
clearAllData(): void
```

---

## 2. JournalService

**File**: `services/journal.service.ts`

### Chức năng
- Quản lý sổ nhật ký chung
- Filter theo kỳ, ngày, loại chứng từ
- READ-ONLY (dữ liệu từ các chứng từ gốc)

### Methods chính
```typescript
getJournalEntries(filter: JournalFilter): Observable<JournalEntry[]>
getEntryByVoucherId(voucherId: string): Observable<JournalEntry | null>
```

---

## 3. GeneralLedgerService

**File**: `services/general-ledger.service.ts`

### Chức năng
- Sổ cái theo tài khoản
- Tính số dư đầu kỳ, phát sinh, số dư cuối kỳ
- Filter theo TK, kỳ, tính chất

### Methods chính
```typescript
getLedgerByAccount(accountCode: string, filter): Observable<LedgerAccount>
getAllLedgers(filter): Observable<LedgerAccount[]>
getAccountBalance(accountCode: string, date: Date): Observable<number>
```

---

## 4. TrialBalanceService

**File**: `services/trial-balance.service.ts`

### Chức năng
- Tổng hợp bảng cân đối tài khoản
- Validation: Tổng Nợ = Tổng Có

### Methods chính
```typescript
getTrialBalance(periodEnd: Date): Observable<TrialBalanceEntry[]>
validateBalance(): Observable<{ valid: boolean; diff: number }>
```

---

## 5. BalanceSheetService

**File**: `services/balance-sheet.service.ts`

### Chức năng
- Tạo báo cáo BCĐKT (B01-DNN)
- Mapping TK → Chỉ tiêu theo TT 133

### Methods chính
```typescript
generateReport(periodEnd: Date): Observable<BalanceSheetReport>
getAssets(): Observable<BalanceSheetSection>
getLiabilities(): Observable<BalanceSheetSection>
getEquity(): Observable<BalanceSheetSection>
```

---

## 6. IncomeStatementService

**File**: `services/income-statement.service.ts`

### Chức năng
- Tạo báo cáo KQKD (B02-DNN)
- 15 chỉ tiêu với công thức tính

### Methods chính
```typescript
generateReport(fromDate, toDate): Observable<IncomeStatementReport>
getRevenue(): Observable<number>
getExpenses(): Observable<number>
getNetProfit(): Observable<number>
```

---

## 7. CashFlowService

**File**: `services/cash-flow.service.ts`

### Chức năng
- Báo cáo lưu chuyển tiền tệ (B03-DNN)
- Phương pháp trực tiếp
- 3 hoạt động: Operating, Investing, Financing

### Methods chính
```typescript
generateReport(fromDate, toDate): Observable<CashFlowReport>
getOperatingCashFlow(): Observable<number>
getInvestingCashFlow(): Observable<number>
getFinancingCashFlow(): Observable<number>
```

---

## 8. ChartOfAccountsService

**File**: `services/chart-of-accounts.service.ts`

### Chức năng
- CRUD hệ thống tài khoản
- Quản lý hierarchy (parent-child)
- BehaviorSubject state management

### Methods chính
```typescript
getAccounts(): Observable<Account[]>
getAccountByCode(code: string): Observable<Account | null>
createAccount(account: Account): Observable<Account>
updateAccount(code: string, updates): Observable<Account>
deleteAccount(code: string): Observable<boolean>
getAccountTree(): Observable<AccountTreeNode[]>
```

---

## 9. CashVoucherService

**File**: `services/cash-voucher.service.ts`

### Chức năng
- CRUD phiếu thu/chi
- Workflow management (Draft → Posted → Cancelled)
- Journal entry generation

### Methods chính
```typescript
getVouchers(filter: VoucherFilter): Observable<CashVoucher[]>
getVoucherById(id: string): Observable<CashVoucher | null>
createVoucher(voucher: Partial<CashVoucher>): Observable<CashVoucher>
postVoucher(id: string): Observable<CashVoucher>
cancelVoucher(id: string, reason: string): Observable<CashVoucher>
getSummary(type: VoucherType, filter): Observable<VoucherSummary>
```

---

## 10. InvoiceService

**File**: `models/invoice.service.ts` ⚠️ (nằm trong models/, không phải services/)

### Chức năng
- CRUD hóa đơn mua vào/bán ra
- Workflow: Draft → Posted → Cancelled/Adjusted
- Payment tracking
- VAT calculation
- Journal entry generation

### Methods chính
```typescript
getInvoices(filter: InvoiceFilter): Observable<Invoice[]>
getInvoiceById(id: string): Observable<Invoice | null>
createInvoice(invoice: Partial<Invoice>): Observable<Invoice>
updateInvoice(id: string, updates): Observable<Invoice>
deleteInvoice(id: string): Observable<boolean>
postInvoice(id: string): Observable<Invoice>
cancelInvoice(id: string, reason: string): Observable<Invoice>
updatePayment(id: string, amount: number, date: Date): Observable<Invoice>
getSummary(type: InvoiceType, filter): Observable<InvoiceSummary>
getDueInvoices(daysAhead: number): Observable<Invoice[]>
getOverdueInvoices(): Observable<Invoice[]>
```

### Demo Data
- 3 hóa đơn bán ra (OUTPUT): INV-OUT-001, 002, 003
- 3 hóa đơn mua vào (INPUT): INV-IN-001, 002, 003

---

## 11. PeriodLockService

**File**: `services/period-lock.service.ts`

### Chức năng
- Khóa/mở sổ kế toán theo kỳ
- Authorization check
- Lock history

### Methods chính
```typescript
lockPeriod(periodEnd: Date, reason: string): Observable<PeriodLock>
unlockPeriod(periodEnd: Date, authCode: string): Observable<boolean>
isLocked(date: Date): Observable<boolean>
getLockHistory(): Observable<PeriodLock[]>
```

---

## 12. AuditLogService

**File**: `services/audit-log.service.ts`

### Chức năng
- Ghi log mọi thao tác
- Filter theo user, action, date

### Methods chính
```typescript
log(action: AuditAction): void
getLogs(filter: AuditFilter): Observable<AuditLog[]>
getLogsByUser(userId: string): Observable<AuditLog[]>
```

---

## 13. KiotVietService

**File**: `services/kiotviet.service.ts`

### Chức năng
- Tích hợp với KiotViet POS
- Sync sản phẩm, đơn hàng, khách hàng

### Methods chính
```typescript
connect(credentials): Observable<boolean>
syncProducts(): Observable<Product[]>
syncOrders(fromDate, toDate): Observable<Order[]>
syncCustomers(): Observable<Customer[]>
```

---

## 14. ExportService

**File**: `services/export.service.ts`

### Chức năng
- Export báo cáo ra PDF/Excel
- Print support

### Methods chính
```typescript
exportToPDF(data, template): Promise<Blob>
exportToExcel(data, columns): Promise<Blob>
print(elementId: string): void
```

---

## 15. FilterService

**File**: `services/filter.service.ts`

### Chức năng
- Common filter utilities
- Date range helpers
- Period calculations

---

## 16. FormattingUtils

**File**: `services/formatting.utils.ts`

### Chức năng
- Format currency (VND)
- Format numbers
- Date formatting
- Number to words (Vietnamese)

### Functions
```typescript
formatCurrency(amount: number): string  // "1.234.567 ₫"
formatNumber(num: number): string       // "1.234.567"
formatDate(date: Date): string          // "15/01/2025"
formatDateTime(date: Date): string      // "15/01/2025 14:30:00"
numberToWords(num: number): string      // "Một triệu hai trăm..."
```

---

## AuthService + authInterceptor (đăng nhập — 22/10/2026)

**Path**: `services/auth.service.ts`, `interceptors/auth.interceptor.ts`, `guards/auth.guard.ts`

### Chức năng
- Đăng nhập Google bằng Firebase Auth project **`quanlysongminh`** (`environment.firebaseGmail`, app tên `ketoan-auth`,
  SDK `firebase` thuần — không dùng `@angular/fire`), scope `gmail.readonly`.
- Email phải qua whitelist của KeToanBackEnd: `GET /api/auth/me` (401/403 → đăng xuất Firebase).
- Access token Gmail lúc đăng nhập (~1 giờ) → `POST /api/gmail/auth/save` (BE chỉ lưu khi người đăng nhập = hộp thư hóa đơn).
- `authInterceptor` gắn header `X-Id-Token` (Firebase ID token) cho mọi request HttpClient lên BE (URL tương đối `/...` hoặc
  bắt đầu bằng `ketoanBackendUrl` / `apiUrl` / `domainUrl`). Request dùng `fetch()` trực tiếp KHÔNG được gắn.

### Methods chính
```typescript
authState$: Observable<{ ready: boolean; user: User | null }>  // guard chờ ready
signInWithGoogle(): Promise<void>      // popup Google → /api/auth/me → lưu access token Gmail
logout(): Promise<void>                // signOut → /login
getIdToken(): Promise<string | null>   // dùng cho interceptor
getGmailStatus(): Observable<GmailStatus>  // /api/gmail/auth/status: account, hasTokens, hasRefreshToken
connectGmail(): Promise<boolean>       // popup /api/gmail/auth/url (gọi trong handler click), lấy refresh token 1 lần
```

---

## PeriodService — kỳ dùng chung (22/10/2026)

**Path**: `services/period.service.ts` — trạng thái của thanh chọn kỳ (`components/shared/period-selector/`) ở MainLayout.

### Chức năng
- Loại kỳ: `today` · `week` (thứ Hai – Chủ nhật) · `month` · `quarter` · `year` · `custom` (Từ ngày – đến ngày).
- Ngày dạng chuỗi `'YYYY-MM-DD'` theo giờ máy, `to` tính cả ngày cuối. Mặc định: tháng hiện tại. Lưu `localStorage`
  key `ketoan_period` (đọc lỗi → về tháng hiện tại, có log `[Period]`).
- **Page mới phải đọc kỳ từ đây** (không tự làm bộ lọc tháng/năm riêng). Page cũ (dữ liệu demo) **chưa nối** — nối khi viết lại.

### Methods chính
```typescript
period: Signal<AccountingPeriod>          // { type, from, to }
period$: Observable<AccountingPeriod>     // cho code RxJS (vd gọi API theo kỳ)
label: Signal<string>                     // "Tháng 10/2026", "Quý 4/2026", "Tuần 19/10 – 25/10/2026"…
selectPreset(type)                        // Hôm nay/Tuần này theo ngày hiện tại; Tháng/Quý/Năm theo đầu kỳ đang chọn
setMonth(y, m) / setQuarter(y, q) / setYear(y)
setCustom(from, to): string | null        // trả lý do lỗi (để hiện) hoặc null
shift(1 | -1)                             // kỳ sau / kỳ trước, giữ loại kỳ (custom: dịch đúng số ngày)
contains(date): boolean
```

---

## ReconciliationService — đối soát hóa đơn XML (23/10/2026)

**Path**: `services/reconciliation.service.ts` — API KeToanBackEnd `/api/reconciliation/*`, `/api/kiotviet/unit-conversion/*`
(chi tiết: `TapHoa39KeToanBackEnd/docs/RECONCILIATION.md`).

### Methods chính
```typescript
scanFolder(files): FolderScan            // lọc như doi_soat.py: XML/ZIP + (thư mục gốc) *luong*.xlsx, QUYDOI*.xlsx, anh_xa_hang_hoa.xlsx,
                                         // bang_quy_doi_kiotviet*.json; bỏ thư mục script tự tạo, ~$...; cảnh báo .xlsm/~$cache1
zipFiles(scan, onProgress): Promise<Blob>   // fflate Zip + ZipDeflate level 6, giữ giờ sửa file, nhả luồng mỗi 200 file
upload(zip, scan, opts, onProgress): Promise<runId>   // XHR (withFetch không báo tiến trình upload), tự gắn X-Id-Token
listRuns() / getRun(id) / deleteRun(id)
getTab(id, key, query) / exportTab(id, key, title, 'xlsx'|'csv', query)   // query: page, pageSize, q, sort, desc, filters
downloadReport(id) / downloadCloneZip(id)
catalogStatus() / refreshCatalog() / downloadCatalog()   // bảng quy đổi ĐVT KiotViet
rerun(id): Observable<newRunId>          // chạy lại với ánh xạ mới nhất (BE dùng dữ liệu đã phân tích)
saveMapping(id, edits: MappingEdit[])     // {key, ma_master, he_so, ma_vietda, da_kiem} → {saved, removed, skipped}
searchCatalog(q): Observable<CatalogItem[]>   // tìm mã master: code, name, unit, units[{unit, conversion}]
```

## BankReconciliationService — Đối soát CK (23/10/2026)

`services/bank-reconciliation.service.ts` — `/api/bank-reconciliation/*` của KeToanBackEnd (HĐ CK KiotViet lưu theo ngày).
```typescript
getRange(from, to): Promise<TransferRange>   // invoices (tên trường KiotViet), days, missing, incomplete, oldest_sync, auto_sync
sync(from, to)                               // nhờ BE lấy lại từ KiotViet (≤ 31 ngày)
load(from, to, force, onProgress)            // đọc → lấy ngày thiếu / chưa đủ (force = mọi ngày) theo đoạn ≤ 7 ngày → đọc lại
```
Logic khớp: `utils/transfer-reconcile.util.ts` + `utils/tpbank-statement.util.ts` — **MIRROR giống hệt BanHang** (CLAUDE.md gốc).

## EinvoiceCheckService — Kiểm tra HĐ tự động (23/10/2026)

`services/einvoice-check.service.ts` — `/api/einvoice-check/*`.
```typescript
listRuns(): Promise<RunList>                 // busy, scheduler {enabled, jobs}, check_time, einvoice_url, runs
start(scope: 'draft'|'accepted', from?, to?) // → id (409 khi đang kiểm)
getRun(id)                                   // progress khi đang chạy; counts, bills, unknown, unmapped khi xong
taxRates() / setTaxRate(master, name, rate)  // thuế suất đúng theo mã master; rate '' = bỏ thuế suất kế toán đặt
listBills(from, to)                          // HĐĐT KiotViet mọi trạng thái ≤ 92 ngày (Kiểm tra số lượng HĐ đầu ra)
setTaxRatesBulk(items)                       // xác nhận hàng loạt thuế suất đúng (mặt hàng chỉ dùng 1 thuế suất)
```
ReconciliationService thêm (bước 5): `getFigures(id)` (01/GTGT + PL142 + TNCN + định nghĩa dòng), `downloadBangKe(id)`,
`tncnFromPayroll(file, from, to, toKhai[])`.
```
```
- Tải file: HttpClient `responseType: 'blob'` (interceptor gắn token) → link tạm; tên file đặt ở FE (không đọc
  `Content-Disposition` vì CORS dev không mở header này).

## CompanyService — MST công ty dùng chung (23/10/2026)

`services/company.service.ts` — MST công ty lưu `localStorage` `ketoan_company_mst` (theo trình duyệt, đăng xuất không xóa).
```typescript
mst: Signal<string>          // '' = chưa nhập
setMst(value): string        // '' = đã lưu; khác = lý do lỗi (10 số, chi nhánh 10 số + "-" + 3 số)
normalizeMst(v) / mstError(v)
```
- MainLayout: chưa có MST → **popup nhập** tự hiện (có "Để sau" — lần mở sau hỏi lại). Góc dưới sidebar (dưới "Gmail: …") hiện
  `MST: …`, bấm vào để đổi; menu tài khoản cũng có "Đổi MST công ty".
- Dùng ở: Kiểm tra số lượng HĐ đầu vào / đầu ra (lọc XML theo MST thay cho tự nhận; khác MST tự nhận → cảnh báo; đổi MST → lọc
  lại ngay), Đối soát hóa đơn XML (ô "MST công ty" mặc định = MST này, sửa tay được cho 1 lần chạy).

## TienIchCacheService — cache IndexedDB các trang Tiện ích (23/10/2026)

`services/tien-ich-cache.service.ts` — DB `ketoan_tien_ich_cache`, store `entries` `{key, data, savedAt}` (qua IndexedDBService).
```typescript
get<T>(key, maxAgeMs?) / getMany<T>(keys) / set<T>(key, data) / setMany(items) / remove(key) / clearAll()
```
Lỗi IndexedDB chỉ log cảnh báo (trang chạy như không có cache). Mục quá 45 ngày tự xóa; **đăng xuất xóa hết** (AuthService.logout).

| Khóa | Lưu gì | Ai dùng | Khi nào lấy lại |
|---|---|---|---|
| `xml-in` / `xml-out` | XML đã đọc từ thư mục (ledger-8 / ledger-9) | mở lại trang hiện ngay, không phải chọn lại thư mục | chọn lại thư mục |
| `einvoice-bills:<from>:<to>` | HĐĐT KiotViet theo khoảng ngày | ledger-9 | nút "Lấy lại từ KiotViet" |
| `gmail-links:<nhãn>:<from>:<to>` | link HĐ gốc Gmail (đã gộp số tiền scrape) | ledger-8 | nút "Tải lại" |
| `ck-range:<from>:<to>` | HĐ CK của khoảng ngày kết thúc trước hôm nay > 8 ngày, đủ mọi ngày | BankReconciliationService.load | "Lấy lại từ KiotViet" (force) |
| `check-run:<id>` | lần Kiểm tra HĐ đã xong / lỗi | EinvoiceCheckService.getRun | không đổi nữa |
| `figures:<id>` | số liệu khai thuế của 1 lần đối soát | ReconciliationService.getFigures | không đổi nữa (xóa lần chạy → xóa) |

Mở lại ledger-8 / ledger-9: có XML lưu + kết quả HĐĐT / Gmail lưu cho kỳ đang chọn → đối chiếu lại ngay từ bản lưu (không gọi máy chủ);
trang ghi "đọc lúc … / lấy lúc … (đã lưu trên máy)".

## BackgroundJobService — việc chạy nền của trang Tiện ích (23/10/2026)

`services/background-job.service.ts` — giữ việc đang chạy ở service (sống suốt phiên) thay vì component → **chuyển trang không dừng**.
```typescript
run<T>(key, label, meta, fn: (job) => Promise<T>): BgJob<T>   // cùng key đang chạy → dùng lại, không chạy trùng
get<T>(key) / find<T>(prefix)                                  // việc đang chạy (xong / lỗi thì tự bỏ khỏi danh sách)
BgJob = { key, label, startedAt, progress, log[], meta, promise }
```
Dùng ở Kiểm tra số lượng HĐ: đọc thư mục XML (`xml-in` / `xml-out`, `progress` = "120/450 file"), lấy HĐĐT KiotViet
(`einvoice-bills:<from>:<to>`), lấy Gmail + scrape (`gmail-links:...`, `log` = khung log). Việc tự ghi kết quả vào IndexedDB
(TienIchCacheService) → quay lại trang: còn chạy thì hiện tiến độ / log và chờ tiếp, xong rồi thì đọc bản lưu. Tải lại cả trang (F5)
thì việc đang chạy mất (bản đã lưu vẫn còn).
`active = signal<BgJob[]>` (25/10/2026) — danh sách việc đang chạy; MainLayout hiện khung **"Đang chạy nền (N)"** góc phải dưới,
thấy ở mọi trang (tên việc · tiến độ · giờ bắt đầu), hết việc thì ẩn.

## PurchaseInvoiceSourceService — nguồn HĐ đầu vào dùng chung (23/10/2026)

`services/purchase-invoice-source.service.ts` — Kiểm tra số lượng HĐ đầu vào + Chuyển khoản HĐ đầu vào dùng CHUNG 1 bản XML / Gmail.
```typescript
startXml(files, folder) / runningXml() / cachedXml()          // IndexedDB `xml-in`, chạy nền (BackgroundJobService)
xmlPurchases(result, companyMst) → { mst, detected, invoices }   // bên mua = MST công ty (chưa nhập → tự nhận)
startGmail({label, labelId?, from, to}) / runningGmail() / cachedGmail(p)   // portal-links + scrape, khóa `gmail-links:<nhãn>:<từ>:<đến>`
static fromXml(LocalXmlInvoice) / fromGmail(links, from, to) → PurchaseInv[]  // Gmail: chỉ email có số HĐ + số tiền, bỏ trùng
```
- (25/10/2026) `PurchaseInvoiceSourceService`: `startGmailCount(p)` / `runningGmailCount()` / `cachedGmailCount(p)` — Đếm nhanh
  (`GET /api/gmail/message-count`, chạy nền, IndexedDB `gmail-count:*`) → `GmailCount {count, listed, truncated, emails[]}`.
