# Models - TapHoa39KeToan

## Tổng quan Files

| File | Size | Nội dung |
|------|------|----------|
| ledger.models.ts | 26 KB | 7 loại sổ (S1-S7), Journal Entry |
| chart-of-accounts.models.ts | 22 KB | Account, AccountType, Template ~70 TK |
| invoice.models.ts | 15 KB | Invoice, InvoiceLine, VAT helpers |
| cash-voucher.models.ts | 14 KB | CashVoucher, VoucherLine |
| balance-sheet.models.ts | 11 KB | BalanceSheet sections |
| income-statement.models.ts | 18 KB | KQKD template, 15 chỉ tiêu |
| cash-flow.models.ts | 17 KB | CashFlow 3 activities |
| audit-log.models.ts | 11 KB | AuditLog, actions |
| period-lock.models.ts | 12 KB | PeriodLock, authorization |
| journal.models.ts | 5.1 KB | JournalEntry, JournalFilter |
| trial-balance.models.ts | 11 KB | TrialBalance structure |
| internal-document.models.ts | 4 KB | Internal docs |
| invoice-sync.models.ts | 5 KB | Invoice sync |

---

## 1. invoice.models.ts

### Types
```typescript
type InvoiceType = 'INPUT' | 'OUTPUT';
type InvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'ADJUSTED';
type VATInvoiceType = 'HDON' | 'HDON_BL' | 'HDON_KT' | 'HDON_XKVC';
type PaymentMethod = 'CASH' | 'BANK' | 'CREDIT' | 'MIXED';
type VATRate = 0 | 5 | 8 | 10 | -1 | -2; // -1: Không chịu thuế, -2: Không kê khai
```

### Interfaces
```typescript
interface InvoiceLine {
  id: string;
  lineNo: number;
  productCode?: string;
  productName: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;         // Chưa VAT
  vatRate: VATRate;
  vatAmount: number;
  totalAmount: number;    // Đã VAT
  accountCode?: string;   // TK hạch toán
  discount?: number;
  note?: string;
}

interface Invoice {
  id: string;
  invoiceType: InvoiceType;
  vatInvoiceType: VATInvoiceType;
  invoiceNo: string;          // 00000001
  invoiceSeries: string;      // 1C25TTT
  invoiceDate: Date;
  postingDate?: Date;

  // Đối tác
  partnerId?: string;
  partnerCode?: string;
  partnerName: string;
  partnerTaxCode?: string;
  partnerAddress?: string;
  buyerName?: string;

  // Chi tiết
  lines: InvoiceLine[];

  // Tổng tiền
  totalQuantity: number;
  subTotal: number;
  totalDiscount: number;
  totalVAT: number;
  grandTotal: number;
  amountInWords?: string;

  // Thanh toán
  paymentMethod: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmount: number;
  dueDate?: Date;

  // Trạng thái
  status: InvoiceStatus;

  // HĐĐT
  taxAuthCode?: string;       // Mã CQT
  signedDate?: Date;
  signedBy?: string;

  // Điều chỉnh
  originalInvoiceId?: string;
  originalInvoiceNo?: string;
  adjustmentReason?: string;

  // Audit
  preparedBy: string;
  preparedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  note?: string;
}

interface InvoiceFilter {
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  fromDate?: Date;
  toDate?: Date;
  partnerId?: string;
  partnerTaxCode?: string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  search?: string;
  vatRate?: VATRate;
}
```

### Constants
```typescript
VAT_RATES = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 10, label: '10%' },
  { value: -1, label: 'Không chịu thuế' },
  { value: -2, label: 'Không kê khai' }
];

COMMON_UNITS = ['Cái', 'Chiếc', 'Bộ', 'Hộp', 'Thùng', 'Kg', ...];

REVENUE_ACCOUNTS = [
  { code: '5111', name: 'Doanh thu bán hàng hóa' },
  { code: '5112', name: 'Doanh thu bán thành phẩm' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ' },
  { code: '5118', name: 'Doanh thu khác' }
];

EXPENSE_ACCOUNTS = [
  { code: '156', name: 'Hàng hóa' },
  { code: '1561', name: 'Giá mua hàng hóa' },
  { code: '152', name: 'Nguyên liệu, vật liệu' },
  { code: '153', name: 'Công cụ, dụng cụ' },
  { code: '6421', name: 'Chi phí nhân viên' },
  { code: '6422', name: 'Chi phí vật liệu' },
  { code: '6427', name: 'Chi phí dịch vụ mua ngoài' },
  { code: '6428', name: 'Chi phí bằng tiền khác' },
  { code: '242', name: 'Chi phí trả trước' }
];
```

### Helper Functions
```typescript
calculateVAT(amount: number, vatRate: VATRate): number
calculateLineTotal(line): { amount, vatAmount, totalAmount }
calculateInvoiceTotals(lines): { totalQuantity, subTotal, totalDiscount, totalVAT, grandTotal }
numberToWordsVN(num: number): string
generateInvoiceNo(sequence: number): string
validateInvoice(invoice): string[]
generateJournalFromInvoice(invoice): JournalEntry[]
```

### Bút toán sinh ra
```typescript
// HĐ bán ra (OUTPUT):
Nợ 131 (Phải thu KH) = grandTotal
  Có 511x (Doanh thu) = subTotal
  Có 33311 (VAT đầu ra) = totalVAT

// HĐ mua vào (INPUT):
Nợ 156/152/642 (Hàng/Chi phí) = subTotal
Nợ 1331 (VAT đầu vào) = totalVAT
  Có 331 (Phải trả NCC) = grandTotal
```

---

## 2. chart-of-accounts.models.ts

### Types
```typescript
type AccountType =
  | 'ASSET_SHORT'      // Loại 1: TS ngắn hạn
  | 'ASSET_LONG'       // Loại 2: TS dài hạn
  | 'LIABILITY_SHORT'  // Loại 3: Nợ ngắn hạn
  | 'LIABILITY_LONG'   // Loại 4: Nợ dài hạn (phần nợ)
  | 'EQUITY'           // Loại 4: Vốn CSH
  | 'REVENUE'          // Loại 5: Doanh thu
  | 'EXPENSE_COGS'     // Loại 6: Giá vốn
  | 'EXPENSE_OTHER';   // Loại 6: Chi phí khác

type AccountNature = 'DEBIT' | 'CREDIT' | 'BOTH';
type AccountStatus = 'ACTIVE' | 'INACTIVE';
```

### Interface
```typescript
interface Account {
  code: string;           // '111', '1111'
  name: string;           // 'Tiền mặt'
  nameEn?: string;        // 'Cash on hand'
  type: AccountType;
  nature: AccountNature;
  parentCode?: string;    // '111' for '1111'
  level: number;          // 1, 2, 3...
  status: AccountStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Template TK theo TT 133 (~70 tài khoản)
```typescript
// Loại 1: TS ngắn hạn
111  Tiền mặt
1111 Tiền Việt Nam
1112 Ngoại tệ
112  Tiền gửi ngân hàng
131  Phải thu khách hàng
133  Thuế GTGT được khấu trừ
1331 Thuế GTGT đầu vào
152  Nguyên liệu, vật liệu
153  Công cụ, dụng cụ
154  Chi phí SXKD dở dang
155  Thành phẩm
156  Hàng hóa
1561 Giá mua hàng hóa
1562 Chi phí mua hàng

// Loại 2: TS dài hạn
211  TSCĐ hữu hình
214  Hao mòn TSCĐ
242  Chi phí trả trước

// Loại 3: Nợ phải trả
331  Phải trả người bán
333  Thuế và các khoản phải nộp
3331 Thuế GTGT phải nộp
33311 Thuế GTGT đầu ra
334  Phải trả người lao động
338  Phải trả, phải nộp khác

// Loại 4: Vốn chủ sở hữu
411  Vốn đầu tư của CSH
421  Lợi nhuận sau thuế chưa PP
4211 LNST chưa PP năm trước
4212 LNST chưa PP năm nay

// Loại 5: Doanh thu
511  Doanh thu bán hàng
5111 DT bán hàng hóa
5112 DT bán thành phẩm
5113 DT cung cấp dịch vụ
515  Doanh thu tài chính
521  Các khoản giảm trừ DT

// Loại 6: Chi phí
632  Giá vốn hàng bán
635  Chi phí tài chính
642  Chi phí quản lý kinh doanh
6421 Chi phí nhân viên
6422 Chi phí vật liệu
6423 Chi phí đồ dùng văn phòng
6424 Chi phí khấu hao TSCĐ
6425 Thuế, phí và lệ phí
6426 Chi phí dự phòng
6427 Chi phí dịch vụ mua ngoài
6428 Chi phí bằng tiền khác

// Loại 7-8: Thu nhập/Chi phí khác
711  Thu nhập khác
811  Chi phí khác
821  Chi phí thuế TNDN
```

---

## 3. cash-voucher.models.ts

### Types
```typescript
type VoucherType = 'RECEIPT' | 'PAYMENT';
type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PaymentMethod = 'CASH' | 'BANK' | 'MIXED';
```

### Interfaces
```typescript
interface VoucherLine {
  id: string;
  lineNo: number;
  description: string;
  accountCode: string;
  amount: number;
  vatRate?: VATRate;
  vatAmount?: number;
  note?: string;
}

interface CashVoucher {
  id: string;
  voucherType: VoucherType;
  voucherNo: string;          // PT001, PC001
  voucherDate: Date;

  // Đối tượng
  partnerId?: string;
  partnerName: string;
  partnerAddress?: string;

  // Chi tiết
  lines: VoucherLine[];

  // Tổng
  totalAmount: number;
  totalVAT: number;
  grandTotal: number;
  amountInWords?: string;

  // Trạng thái
  status: VoucherStatus;

  // Audit
  preparedBy: string;
  preparedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  postedBy?: string;
  postedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;

  createdAt: Date;
  updatedAt: Date;
  note?: string;
}
```

### Bút toán sinh ra
```typescript
// Phiếu thu (RECEIPT):
Nợ 111 (Tiền mặt) = grandTotal
  Có [accountCode] = amount (theo từng dòng)

// Phiếu chi (PAYMENT):
Nợ [accountCode] = amount (theo từng dòng)
  Có 111 (Tiền mặt) = grandTotal
```

---

## 4. income-statement.models.ts

### Template KQKD (B02-DNN) - 15 chỉ tiêu
```typescript
INCOME_STATEMENT_TEMPLATE = [
  { code: '01', name: '1. Doanh thu bán hàng và CCDV',
    level: 1, accountMapping: ['511'], balanceType: 'credit' },

  { code: '02', name: '2. Các khoản giảm trừ doanh thu',
    level: 1, accountMapping: ['521'], balanceType: 'debit' },

  { code: '10', name: '3. Doanh thu thuần (10 = 01 - 02)',
    level: 0, accountMapping: [], formula: '01 - 02' },

  { code: '11', name: '4. Giá vốn hàng bán',
    level: 1, accountMapping: ['632'], balanceType: 'debit' },

  { code: '20', name: '5. Lợi nhuận gộp (20 = 10 - 11)',
    level: 0, accountMapping: [], formula: '10 - 11' },

  { code: '21', name: '6. Doanh thu hoạt động tài chính',
    level: 1, accountMapping: ['515'], balanceType: 'credit' },

  { code: '22', name: '7. Chi phí tài chính',
    level: 1, accountMapping: ['635'], balanceType: 'debit' },

  { code: '24', name: '8. Chi phí quản lý kinh doanh',
    level: 1, accountMapping: ['642'], balanceType: 'debit' },

  { code: '30', name: '9. LN thuần từ HĐKD (30 = 20 + 21 - 22 - 24)',
    level: 0, accountMapping: [], formula: '20 + 21 - 22 - 24' },

  { code: '31', name: '10. Thu nhập khác',
    level: 1, accountMapping: ['711'], balanceType: 'credit' },

  { code: '32', name: '11. Chi phí khác',
    level: 1, accountMapping: ['811'], balanceType: 'debit' },

  { code: '40', name: '12. LN khác (40 = 31 - 32)',
    level: 0, accountMapping: [], formula: '31 - 32' },

  { code: '50', name: '13. Tổng LN kế toán trước thuế (50 = 30 + 40)',
    level: 0, accountMapping: [], formula: '30 + 40' },

  { code: '51', name: '14. Chi phí thuế TNDN',
    level: 1, accountMapping: ['821'], balanceType: 'debit' },

  { code: '60', name: '15. LN sau thuế TNDN (60 = 50 - 51)',
    level: 0, accountMapping: [], formula: '50 - 51' }
];
```

---

## 5. ledger.models.ts

### 7 Loại sổ theo TT 88/2021 (HKD)
```typescript
S1_HKD  // Sổ chi tiết doanh thu
S2_HKD  // Sổ chi tiết vật tư, hàng hóa
S3_HKD  // Sổ chi tiết thanh toán với NCC
S4_HKD  // Sổ chi tiết thanh toán với KH
S5_HKD  // Sổ chi tiết tiền mặt
S6_HKD  // Sổ chi tiết tiền gửi NH
S7_HKD  // Sổ chi tiết chi phí
```

### Journal Entry
```typescript
interface JournalEntry {
  id: string;
  date: Date;
  voucherType: string;      // 'PT', 'PC', 'HD', ...
  voucherNo: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  debitAmount: number;
  creditAmount: number;
  createdAt: Date;
  createdBy: string;
}
```
