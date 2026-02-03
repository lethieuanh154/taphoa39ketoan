import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { HddtService } from '../../services/hddt.service';
import { HddtTokenDialogComponent } from '../../components/shared/hddt-token-dialog/hddt-token-dialog.component';

/**
 * MAIN LAYOUT COMPONENT
 * Layout chính cho hệ thống Kế toán Doanh nghiệp
 * Theo Thông tư 133/2016/TT-BTC & định hướng Thông tư 99/2025/TT-BTC
 *
 * Hệ thống độc lập - Kết nối với TapHoa39BackEnd qua API
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, HddtTokenDialogComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  private hddtService = inject(HddtService);

  @ViewChild('tokenDialog') tokenDialog!: HddtTokenDialogComponent;

  // Sidebar collapse state
  isSidebarCollapsed: boolean = false;

  // HDDT profile dropdown
  showProfileMenu = false;

  // Expanded groups state
  expandedGroups: { [key: string]: boolean } = {
    kiemTraHoaDon: true,  // 0. Kiểm tra hóa đơn tự động - mở mặc định
    danhMuc: false,
    chungTu: false,
    banHang: false,
    muaHang: false,
    kho: false,
    luong: false,
    tien: false,
    thue: false,
    soTongHop: true,
    baoCao: false,
    heThong: true
  };

  get hddtProfileName(): string {
    const profile = this.hddtService.getProfile();
    return profile?.name || '';
  }

  get hddtUsername(): string {
    const profile = this.hddtService.getProfile();
    return profile?.username || profile?.id || '';
  }

  get isHddtConnected(): boolean {
    return this.hddtService.hasToken();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
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

  openLoginDialog(): void {
    this.showProfileMenu = false;
    if (this.tokenDialog) {
      this.tokenDialog.openDialog();
    }
  }

  hddtLogout(): void {
    this.showProfileMenu = false;
    this.hddtService.clearToken();
    if (this.tokenDialog) {
      this.tokenDialog.openDialog();
    }
  }

  onTokenSaved(): void {
    this.showProfileMenu = false;
  }
}
