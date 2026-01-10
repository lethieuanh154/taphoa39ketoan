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
      { path: 'danh-muc/khach-hang', component: PlaceholderComponent, data: { title: 'Danh mục khách hàng' } },
      { path: 'danh-muc/nha-cung-cap', component: PlaceholderComponent, data: { title: 'Danh mục nhà cung cấp' } },
      { path: 'danh-muc/nhan-vien', component: PlaceholderComponent, data: { title: 'Danh mục nhân viên' } },
      { path: 'danh-muc/hang-hoa', component: PlaceholderComponent, data: { title: 'Danh mục hàng hóa - dịch vụ' } },
      { path: 'danh-muc/ngan-hang', component: PlaceholderComponent, data: { title: 'Danh mục ngân hàng' } },

      // ═══════════════════════════════════════════════════════════════════
      // 2. CHỨNG TỪ KẾ TOÁN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'chung-tu/phieu-thu', component: PlaceholderComponent, data: { title: 'Phiếu thu' } },
      { path: 'chung-tu/phieu-chi', component: PlaceholderComponent, data: { title: 'Phiếu chi' } },
      { path: 'chung-tu/phieu-nhap-kho', component: PlaceholderComponent, data: { title: 'Phiếu nhập kho' } },
      { path: 'chung-tu/phieu-xuat-kho', component: PlaceholderComponent, data: { title: 'Phiếu xuất kho' } },
      { path: 'chung-tu/chung-tu-khac', component: PlaceholderComponent, data: { title: 'Chứng từ khác' } },

      // ═══════════════════════════════════════════════════════════════════
      // 3. BÁN HÀNG & CÔNG NỢ PHẢI THU
      // ═══════════════════════════════════════════════════════════════════
      { path: 'ban-hang/hoa-don-ban-ra', component: PlaceholderComponent, data: { title: 'Hóa đơn bán ra' } },
      { path: 'ban-hang/cong-no-131', component: PlaceholderComponent, data: { title: 'Sổ chi tiết TK 131' } },

      // ═══════════════════════════════════════════════════════════════════
      // 4. MUA HÀNG & CÔNG NỢ PHẢI TRẢ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'mua-hang/hoa-don-mua-vao', component: PlaceholderComponent, data: { title: 'Hóa đơn mua vào' } },
      { path: 'mua-hang/cong-no-331', component: PlaceholderComponent, data: { title: 'Sổ chi tiết TK 331' } },

      // ═══════════════════════════════════════════════════════════════════
      // 5. KHO & GIÁ VỐN
      // ═══════════════════════════════════════════════════════════════════
      { path: 'kho/the-kho', component: PlaceholderComponent, data: { title: 'Thẻ kho' } },
      { path: 'kho/nhap-xuat-ton', component: PlaceholderComponent, data: { title: 'Tổng hợp N-X-T' } },
      { path: 'kho/gia-von-632', component: PlaceholderComponent, data: { title: 'Giá vốn hàng bán' } },

      // ═══════════════════════════════════════════════════════════════════
      // 6. LƯƠNG & CÁC KHOẢN TRÍCH
      // ═══════════════════════════════════════════════════════════════════
      { path: 'luong/bang-luong', component: PlaceholderComponent, data: { title: 'Bảng lương' } },
      { path: 'luong/thanh-toan-luong', component: PlaceholderComponent, data: { title: 'Thanh toán lương' } },
      { path: 'luong/bao-hiem', component: PlaceholderComponent, data: { title: 'BHXH, BHYT, BHTN' } },

      // ═══════════════════════════════════════════════════════════════════
      // 7. TIỀN & NGÂN HÀNG
      // ═══════════════════════════════════════════════════════════════════
      { path: 'tien/quy-tien-mat', component: PlaceholderComponent, data: { title: 'Sổ quỹ tiền mặt' } },
      { path: 'tien/tien-ngan-hang', component: PlaceholderComponent, data: { title: 'Sổ tiền gửi ngân hàng' } },

      // ═══════════════════════════════════════════════════════════════════
      // 8. THUẾ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'thue/gtgt', component: PlaceholderComponent, data: { title: 'Thuế GTGT' } },
      { path: 'thue/tncn', component: PlaceholderComponent, data: { title: 'Thuế TNCN' } },
      { path: 'thue/tndn', component: PlaceholderComponent, data: { title: 'Thuế TNDN' } },
      { path: 'thue/mon-bai', component: PlaceholderComponent, data: { title: 'Lệ phí môn bài' } },

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
      { path: 'bao-cao/thue', component: PlaceholderComponent, data: { title: 'Tờ khai thuế GTGT' } },
      { path: 'bao-cao/quan-tri', component: PlaceholderComponent, data: { title: 'Báo cáo quản trị' } },

      // ═══════════════════════════════════════════════════════════════════
      // 11. HỆ THỐNG & QUẢN TRỊ
      // ═══════════════════════════════════════════════════════════════════
      { path: 'he-thong/khoa-so', component: PeriodLockPageComponent },
      { path: 'he-thong/audit-trail', component: AuditTrailPageComponent },
      { path: 'he-thong/phan-quyen', component: PlaceholderComponent, data: { title: 'Phân quyền người dùng' } },
      { path: 'he-thong/cai-dat', component: PlaceholderComponent, data: { title: 'Cài đặt hệ thống' } },
    ],
  },
  // Catch-all redirect
  { path: '**', redirectTo: 'dashboard' }
];
