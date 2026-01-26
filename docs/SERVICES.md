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
