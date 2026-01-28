import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

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
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {

  // Sidebar collapse state
  isSidebarCollapsed: boolean = false;

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

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleGroup(groupKey: string): void {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
    }
    this.expandedGroups[groupKey] = !this.expandedGroups[groupKey];
  }

  exportCurrentMonth(): void {
    alert('Chức năng xuất dữ liệu sẽ được cập nhật.');
  }

  printCurrentMonth(): void {
    alert('Chức năng in sẽ được cập nhật.');
  }
}
