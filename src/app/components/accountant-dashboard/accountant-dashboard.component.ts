import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

/**
 * ACCOUNTANT DASHBOARD - TRANG CHỦ KẾ TOÁN DOANH NGHIỆP
 *
 * Theo Thông tư 133/2016/TT-BTC & định hướng Thông tư 99/2025/TT-BTC
 * Dành cho Công ty TNHH 1 thành viên - DN nhỏ & vừa
 */

interface PeriodOption {
  value: string;
  label: string;
}

interface QuickSummary {
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
  vatPhaiNop: number;
  vatDuocKhauTru: number;
  soDuTienMat: number;
  soDuNganHang: number;
}

interface QuickAction {
  icon: string;
  label: string;
  route: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-accountant-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accountant-dashboard.component.html',
  styleUrl: './accountant-dashboard.component.css'
})
export class AccountantDashboardComponent implements OnInit {

  // === HEADER: Kỳ kế toán ===
  selectedPeriodType: 'month' | 'quarter' | 'year' = 'month';
  selectedMonth: number = new Date().getMonth() + 1;
  selectedQuarter: number = Math.ceil((new Date().getMonth() + 1) / 3);
  selectedYear: number = new Date().getFullYear();
  isPeriodLocked: boolean = false;

  months: PeriodOption[] = [
    { value: '1', label: 'Tháng 1' },
    { value: '2', label: 'Tháng 2' },
    { value: '3', label: 'Tháng 3' },
    { value: '4', label: 'Tháng 4' },
    { value: '5', label: 'Tháng 5' },
    { value: '6', label: 'Tháng 6' },
    { value: '7', label: 'Tháng 7' },
    { value: '8', label: 'Tháng 8' },
    { value: '9', label: 'Tháng 9' },
    { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' },
    { value: '12', label: 'Tháng 12' }
  ];

  quarters: PeriodOption[] = [
    { value: '1', label: 'Quý I' },
    { value: '2', label: 'Quý II' },
    { value: '3', label: 'Quý III' },
    { value: '4', label: 'Quý IV' }
  ];

  years: number[] = [];

  // === DASHBOARD SUMMARY ===
  summary: QuickSummary = {
    doanhThu: 0,
    chiPhi: 0,
    loiNhuan: 0,
    vatPhaiNop: 0,
    vatDuocKhauTru: 0,
    soDuTienMat: 0,
    soDuNganHang: 0
  };

  // === QUICK ACTIONS: Luồng kế toán ===
  quickActions: QuickAction[] = [
    {
      icon: 'fa-file-invoice',
      label: 'Nhập chứng từ',
      route: '/accountant/chung-tu',
      description: 'Phiếu thu, chi, nhập xuất kho',
      color: '#3b82f6'
    },
    {
      icon: 'fa-calculator',
      label: 'Hạch toán tự động',
      route: '/accountant/so-cai',
      description: 'Sinh bút toán Nợ/Có',
      color: '#10b981'
    },
    {
      icon: 'fa-handshake',
      label: 'Công nợ',
      route: '/accountant/cong-no-phai-thu',
      description: 'Kiểm tra 131/331',
      color: '#f59e0b'
    },
    {
      icon: 'fa-sync',
      label: 'Đối chiếu HĐ',
      route: '/accountant/dong-bo-hd-vao',
      description: 'Đồng bộ hóa đơn đầu vào/ra',
      color: '#8b5cf6'
    },
    {
      icon: 'fa-chart-bar',
      label: 'Báo cáo',
      route: '/accountant/bao-cao',
      description: 'BCTC, Thuế, Quản trị',
      color: '#ef4444'
    }
  ];

  // === RECENT ACTIVITIES ===
  recentActivities: { date: string; description: string; type: string }[] = [];

  ngOnInit(): void {
    this.initYears();
    this.loadSummaryData();
    this.loadRecentActivities();
  }

  initYears(): void {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
      this.years.push(y);
    }
  }

  loadSummaryData(): void {
    // TODO: Gọi API lấy dữ liệu thực tế
    // Demo data
    this.summary = {
      doanhThu: 250000000,
      chiPhi: 180000000,
      loiNhuan: 70000000,
      vatPhaiNop: 8500000,
      vatDuocKhauTru: 12000000,
      soDuTienMat: 45000000,
      soDuNganHang: 320000000
    };
  }

  loadRecentActivities(): void {
    // TODO: Gọi API lấy hoạt động gần đây
    this.recentActivities = [
      { date: '03/01/2026', description: 'Phiếu chi PC001 - Thanh toán tiền điện', type: 'chi' },
      { date: '02/01/2026', description: 'Phiếu thu PT015 - Thu công nợ KH Minh Anh', type: 'thu' },
      { date: '02/01/2026', description: 'Nhập kho NK008 - Hàng hóa từ NCC ABC', type: 'nhap' },
      { date: '01/01/2026', description: 'Hóa đơn bán ra HĐ00156 - Đã hạch toán', type: 'ban' }
    ];
  }

  get periodLabel(): string {
    switch (this.selectedPeriodType) {
      case 'month':
        return `Tháng ${this.selectedMonth}/${this.selectedYear}`;
      case 'quarter':
        return `Quý ${this.selectedQuarter}/${this.selectedYear}`;
      case 'year':
        return `Năm ${this.selectedYear}`;
    }
  }

  onPeriodChange(): void {
    this.loadSummaryData();
  }

  lockPeriod(): void {
    if (confirm(`Bạn có chắc chắn muốn KHÓA SỔ kỳ ${this.periodLabel}?\n\nSau khi khóa sổ, không thể sửa/xóa chứng từ trong kỳ này.`)) {
      this.isPeriodLocked = true;
      alert(`Đã khóa sổ kỳ ${this.periodLabel}`);
    }
  }

  unlockPeriod(): void {
    if (confirm(`Bạn có chắc chắn muốn MỞ KHÓA kỳ ${this.periodLabel}?\n\nViệc này cần thẩm quyền Kế toán trưởng.`)) {
      this.isPeriodLocked = false;
      alert(`Đã mở khóa kỳ ${this.periodLabel}`);
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'thu': return 'fa-arrow-down';
      case 'chi': return 'fa-arrow-up';
      case 'nhap': return 'fa-box';
      case 'xuat': return 'fa-truck';
      case 'ban': return 'fa-receipt';
      default: return 'fa-file';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'thu': return '#10b981';
      case 'chi': return '#ef4444';
      case 'nhap': return '#3b82f6';
      case 'xuat': return '#f59e0b';
      case 'ban': return '#8b5cf6';
      default: return '#6b7280';
    }
  }
}
