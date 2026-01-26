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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AccountantDashboardComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 1. DANH MỤC KẾ TOÁN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'danh-muc/tai-khoan', component: ChartOfAccountsPageComponent },
      { path: 'danh-muc/khach-hang', component: CustomerPageComponent },
      { path: 'danh-muc/nha-cung-cap', component: SupplierPageComponent },
      { path: 'danh-muc/nhan-vien', component: EmployeePageComponent },
      { path: 'danh-muc/hang-hoa', component: ProductPageComponent },
      { path: 'danh-muc/ngan-hang', component: BankPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 2. CHỨNG TỪ KẾ TOÁN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'chung-tu/phieu-thu', component: CashVoucherPageComponent, data: { type: 'RECEIPT' } },
      { path: 'chung-tu/phieu-chi', component: CashVoucherPageComponent, data: { type: 'PAYMENT' } },
      { path: 'chung-tu/phieu-nhap-kho', component: WarehousePageComponent, data: { type: 'RECEIPT' } },
      { path: 'chung-tu/phieu-xuat-kho', component: WarehousePageComponent, data: { type: 'ISSUE' } },
      { path: 'chung-tu/chung-tu-khac', component: OtherVoucherPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 3. BÁN HÀNG & CÔNG NỢ PHẢI THU
      // ═══════════════════════════════════════════════════════════════════
      { path: 'ban-hang/hoa-don-ban-ra', component: InvoicePageComponent, data: { type: 'OUTPUT' } },
      { path: 'ban-hang/cong-no-131', component: ReceivableLedgerPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 4. MUA HÀNG & CÔNG NỢ PHẢI TRẢ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'mua-hang/hoa-don-mua-vao', component: InvoicePageComponent, data: { type: 'INPUT' } },
      { path: 'mua-hang/cong-no-331', component: PayableLedgerPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 5. KHO & GIÁ VỐN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'kho/the-kho', component: StockCardPageComponent },
      { path: 'kho/nhap-xuat-ton', component: InventoryReportPageComponent },
      { path: 'kho/gia-von-632', component: COGSPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 6. LƯƠNG & CÁC KHOẢN TRÍCH
      // ═══════════════════════════════════════════════════════════════════
      { path: 'luong/bang-luong', component: PayrollPageComponent },
      { path: 'luong/thanh-toan-luong', component: SalaryPaymentPageComponent },
      { path: 'luong/bao-hiem', component: InsurancePageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 7. TIỀN & NGÂN HÀNG
      // ═══════════════════════════════════════════════════════════════════
      { path: 'tien/quy-tien-mat', component: CashBookPageComponent },
      { path: 'tien/tien-ngan-hang', component: BankBookPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 8. THUẾ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'thue/gtgt', component: VATPageComponent },
      { path: 'thue/tncn', component: PITPageComponent },
      { path: 'thue/tndn', component: CITPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 9. SỔ KẾ TOÁN TỔNG HỢP
      // ═══════════════════════════════════════════════════════════════════
      { path: 'so-tong-hop/nhat-ky-chung', component: JournalPageComponent },
      { path: 'so-tong-hop/so-cai', component: LedgerPageComponent },
      { path: 'so-tong-hop/bang-can-doi-tai-khoan', component: TrialBalancePageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 10. BÁO CÁO TÀI CHÍNH
      // ═══════════════════════════════════════════════════════════════════
      { path: 'bao-cao/bang-can-doi-ke-toan', component: BalanceSheetPageComponent },
      { path: 'bao-cao/ket-qua-kinh-doanh', component: IncomeStatementPageComponent },
      { path: 'bao-cao/luu-chuyen-tien-te', component: CashFlowPageComponent },
      { path: 'bao-cao/thue', component: VATDeclarationPageComponent },
      { path: 'bao-cao/quan-tri', component: ManagementReportsPageComponent },

      // ═══════════════════════════════════════════════════════════════════
      // 11. HỆ THỐNG & QUẢN TRỊ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'he-thong/khoa-so', component: PeriodLockPageComponent },
      { path: 'he-thong/audit-trail', component: AuditTrailPageComponent },
      { path: 'he-thong/phan-quyen', component: UserRolesPageComponent },
      { path: 'he-thong/cai-dat', component: SystemSettingsPageComponent },
    ],
  },
  // Catch-all redirect
  { path: '**', redirectTo: 'dashboard' }
];
