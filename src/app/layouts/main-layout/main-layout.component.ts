import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { PeriodSelectorComponent } from '../../components/shared/period-selector/period-selector.component';
import { MENU_SECTIONS, matchesRoute } from './menu.config';

const LOG = '[MainLayout]';

/**
 * MAIN LAYOUT COMPONENT
 * Layout chính cho hệ thống Kế toán Doanh nghiệp
 * Theo Thông tư 133/2016/TT-BTC & định hướng Thông tư 99/2025/TT-BTC
 *
 * Menu 3 mục (menu.config.ts) + thanh chọn kỳ dùng chung (PeriodService).
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet, PeriodSelectorComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private companyService = inject(CompanyService);

  readonly sections = MENU_SECTIONS;

  // Sidebar collapse state
  isSidebarCollapsed: boolean = false;

  // Tài khoản đăng nhập + trạng thái Gmail của hộp thư hóa đơn
  showProfileMenu = false;
  userEmail = '';
  gmailAccount = '';
  gmailConnected = true;

  // MST công ty — popup tự hiện khi chưa nhập, bấm "MST: …" ở góc dưới để đổi
  readonly companyMst = this.companyService.mst;
  showMstDialog = false;
  mstDraft = '';
  mstDialogError = '';

  // Mục cấp 1 và nhóm đang mở — nhóm chứa trang hiện tại tự mở khi điều hướng
  expandedSections: { [key: string]: boolean } = {
    tienIch: true,
    keToanChiTiet: true,
    thietLap: false
  };
  expandedGroups: { [key: string]: boolean } = {};

  // Ẩn thanh chọn kỳ ở trang không theo kỳ (route data `noPeriodBar`)
  showPeriodBar = true;

  ngOnInit(): void {
    this.userEmail = this.authService.currentUser?.email || '';
    this.loadGmailStatus();
    if (!this.companyMst()) {
      console.info(`${LOG} Chưa có MST công ty → hiện popup nhập`);
      this.openMstDialog();
    }
    this.onNavigated(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => this.onNavigated(e.urlAfterRedirects));
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleSection(sectionKey: string): void {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
      this.expandedSections[sectionKey] = true;
      return;
    }
    this.expandedSections[sectionKey] = !this.expandedSections[sectionKey];
  }

  toggleGroup(groupKey: string): void {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
    }
    this.expandedGroups[groupKey] = !this.expandedGroups[groupKey];
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  /** Bấm vào vùng nội dung → đóng menu tài khoản (hàm trả void để Angular không chặn hành vi mặc định của cú bấm) */
  closeProfileMenu(): void {
    this.showProfileMenu = false;
  }

  async connectGmail(): Promise<void> {
    this.showProfileMenu = false;
    console.info(`${LOG} Bấm kết nối Gmail ${this.gmailAccount}`);
    await this.authService.connectGmail();
    this.loadGmailStatus();
  }

  /** Gọi từ cú bấm trong khung tài khoản → chặn lan lên để không bật / tắt menu tài khoản */
  openMstDialog(event?: Event): void {
    event?.stopPropagation();
    this.showProfileMenu = false;
    this.mstDraft = this.companyMst();
    this.mstDialogError = '';
    this.showMstDialog = true;
  }

  closeMstDialog(): void {
    if (!this.companyMst()) console.info(`${LOG} Bỏ qua nhập MST (sẽ hỏi lại lần mở sau)`);
    this.showMstDialog = false;
  }

  saveMst(): void {
    this.mstDialogError = this.companyService.setMst(this.mstDraft);
    if (!this.mstDialogError) this.showMstDialog = false;
  }

  logout(): void {
    this.showProfileMenu = false;
    this.authService.logout();
  }

  private onNavigated(url: string): void {
    const path = url.split(/[?#]/)[0];
    this.expandMenuFor(path);

    let snapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }
    this.showPeriodBar = !snapshot.data['noPeriodBar'];
  }

  private expandMenuFor(path: string): void {
    for (const section of this.sections) {
      if ([...(section.items ?? []), ...(section.tailItems ?? [])].some(item => matchesRoute(path, item.route))) {
        this.expandedSections[section.key] = true;
        return;
      }
      const group = section.groups?.find(g => g.items.some(item => matchesRoute(path, item.route)));
      if (group) {
        this.expandedSections[section.key] = true;
        this.expandedGroups[group.key] = true;
        return;
      }
    }
    if (path !== '/' && path !== '/accountant-dashboard') {
      console.debug(`${LOG} ${path} không có trong menu`);
    }
  }

  private loadGmailStatus(): void {
    this.authService.getGmailStatus().subscribe({
      next: status => {
        this.gmailAccount = status.account;
        this.gmailConnected = status.hasRefreshToken;
      },
      error: () => {
        console.warn(`${LOG} Không lấy được trạng thái Gmail → hiện "chưa kết nối"`);
        this.gmailConnected = false;
      }
    });
  }
}
