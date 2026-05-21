import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

// Components
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
import { CustomerPageComponent } from './components/customer-page/customer-page.component';
import { SupplierPageComponent } from './components/supplier-page/supplier-page.component';
import { ProductPageComponent } from './components/product-page/product-page.component';
import { WarehousePageComponent } from './components/warehouse-page/warehouse-page.component';
import { VATPageComponent } from './components/vat-page/vat-page.component';
import { StockCardPageComponent } from './components/stock-card-page/stock-card-page.component';
import { InventoryReportPageComponent } from './components/inventory-report-page/inventory-report-page.component';
import { ReceivableLedgerPageComponent } from './components/receivable-ledger-page/receivable-ledger-page.component';
import { PayableLedgerPageComponent } from './components/payable-ledger-page/payable-ledger-page.component';
import { CashBookPageComponent } from './components/cash-book-page/cash-book-page.component';
import { EmployeePageComponent } from './components/employee-page/employee-page.component';
import { BankPageComponent } from './components/bank-page/bank-page.component';
import { OtherVoucherPageComponent } from './components/other-voucher-page/other-voucher-page.component';
import { BankBookPageComponent } from './components/bank-book-page/bank-book-page.component';
import { COGSPageComponent } from './components/cogs-page/cogs-page.component';
import { VATDeclarationPageComponent } from './components/vat-declaration-page/vat-declaration-page.component';
import { PayrollPageComponent } from './components/payroll-page/payroll-page.component';
import { SalaryPaymentPageComponent } from './components/salary-payment-page/salary-payment-page.component';
import { InsurancePageComponent } from './components/insurance-page/insurance-page.component';
import { PITPageComponent } from './components/pit-page/pit-page.component';
import { CITPageComponent } from './components/cit-page/cit-page.component';
import { ManagementReportsPageComponent } from './components/management-reports-page/management-reports-page.component';
import { UserRolesPageComponent } from './components/user-roles-page/user-roles-page.component';
import { SystemSettingsPageComponent } from './components/system-settings-page/system-settings-page.component';
import { Ledger8DongBoHoaDonV2Component } from './components/accountant-pages/ledger-8-dong-bo-hoa-don-v2/ledger-8-dong-bo-hoa-don-v2.component';
import { Ledger9DongBoHoaDonDauRaComponent } from './components/accountant-pages/ledger-9-dong-bo-hoa-don-dau-ra/ledger-9-dong-bo-hoa-don-dau-ra.component';
import { PurchaseInvoicePageComponent } from './components/accountant-pages/purchase-invoice-page/purchase-invoice-page.component';
import { SalesInvoicePageComponent } from './components/accountant-pages/sales-invoice-page/sales-invoice-page.component';

/**
 * TAPHOA39KETOAN ROUTES
 * Hệ thống Kế toán Doanh nghiệp độc lập
 *
 * Theo Thông tư 133/2016/TT-BTC & định hướng Thông tư 99/2025/TT-BTC
 * Dành cho Công ty TNHH 1 thành viên - Doanh nghiệp nhỏ & vừa
 */
export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      // ═══════════════════════════════════════════════════════════════════
      // DASHBOARD
      // ═══════════════════════════════════════════════════════════════════
      { path: '', redirectTo: 'accountant-dashboard', pathMatch: 'full' },
      { path: 'accountant-dashboard', component: AccountantDashboardComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 0. ĐỒNG BỘ HÓA ĐƠN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'accountant-pages/ledger-8-dong-bo-hoa-don-v2', component: Ledger8DongBoHoaDonV2Component },
      { path: 'accountant-pages/ledger-9-dong-bo-hoa-don-dau-ra', component: Ledger9DongBoHoaDonDauRaComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 1. DANH MỤC KẾ TOÁN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'chart-of-accounts-page', component: ChartOfAccountsPageComponent },
      { path: 'customer-page', component: CustomerPageComponent },
      { path: 'supplier-page', component: SupplierPageComponent },
      { path: 'employee-page', component: EmployeePageComponent },
      { path: 'product-page', component: ProductPageComponent },
      { path: 'bank-page', component: BankPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 2. CHỨNG TỪ KẾ TOÁN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'cash-voucher-page/receipt', component: CashVoucherPageComponent, data: { type: 'RECEIPT' } },
      { path: 'cash-voucher-page/payment', component: CashVoucherPageComponent, data: { type: 'PAYMENT' } },
      { path: 'warehouse-page/receipt', component: WarehousePageComponent, data: { type: 'RECEIPT' } },
      { path: 'warehouse-page/issue', component: WarehousePageComponent, data: { type: 'ISSUE' } },
      { path: 'other-voucher-page', component: OtherVoucherPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 3. BÁN HÀNG & CÔNG NỢ PHẢI THU
      // ═══════════════════════════════════════════════════════════════════
      { path: 'accountant-pages/sales-invoice-page', component: SalesInvoicePageComponent },
      { path: 'receivable-ledger-page', component: ReceivableLedgerPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 4. MUA HÀNG & CÔNG NỢ PHẢI TRẢ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'accountant-pages/purchase-invoice-page', component: PurchaseInvoicePageComponent },
      { path: 'payable-ledger-page', component: PayableLedgerPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 5. KHO & GIÁ VỐN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'stock-card-page', component: StockCardPageComponent },
      { path: 'inventory-report-page', component: InventoryReportPageComponent },
      { path: 'cogs-page', component: COGSPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 6. LƯƠNG & CÁC KHOẢN TRÍCH
      // ═══════════════════════════════════════════════════════════════════
      { path: 'payroll-page', component: PayrollPageComponent },
      { path: 'salary-payment-page', component: SalaryPaymentPageComponent },
      { path: 'insurance-page', component: InsurancePageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 7. TIỀN & NGÂN HÀNG
      // ═══════════════════════════════════════════════════════════════════
      { path: 'cash-book-page', component: CashBookPageComponent },
      { path: 'bank-book-page', component: BankBookPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 8. THUẾ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'vat-page', component: VATPageComponent },
      { path: 'pit-page', component: PITPageComponent },
      { path: 'cit-page', component: CITPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 9. SỔ KẾ TOÁN TỔNG HỢP
      // ═══════════════════════════════════════════════════════════════════
      { path: 'journal-page', component: JournalPageComponent },
      { path: 'ledger-page', component: LedgerPageComponent },
      { path: 'trial-balance-page', component: TrialBalancePageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 10. BÁO CÁO TÀI CHÍNH
      // ═══════════════════════════════════════════════════════════════════
      { path: 'balance-sheet-page', component: BalanceSheetPageComponent },
      { path: 'income-statement-page', component: IncomeStatementPageComponent },
      { path: 'cash-flow-page', component: CashFlowPageComponent },
      { path: 'vat-declaration-page', component: VATDeclarationPageComponent },
      { path: 'management-reports-page', component: ManagementReportsPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 11. HỆ THỐNG & QUẢN TRỊ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'period-lock-page', component: PeriodLockPageComponent },
      { path: 'audit-trail-page', component: AuditTrailPageComponent },
      { path: 'user-roles-page', component: UserRolesPageComponent },
      { path: 'system-settings-page', component: SystemSettingsPageComponent },
    ],
  },
  // Catch-all redirect
  { path: '**', redirectTo: 'accountant-dashboard' }
];
