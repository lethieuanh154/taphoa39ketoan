import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  route?: string;
}

@Component({
  selector: 'app-management-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './management-reports-page.component.html',
  styleUrl: './management-reports-page.component.css'
})
export class ManagementReportsPageComponent implements OnInit {
  reports: ReportCard[] = [];
  categories = ['Doanh thu', 'Chi phí', 'Lợi nhuận', 'Công nợ', 'Kho hàng', 'Nhân sự'];
  filterCategory = '';

  // KPIs
  kpis = {
    revenue: 2500000000,
    expenses: 2100000000,
    profit: 400000000,
    profitMargin: 16,
    receivables: 350000000,
    payables: 280000000,
    inventory: 450000000,
    cashBalance: 520000000
  };

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.reports = [
      { id: 'R001', title: 'Báo cáo doanh thu theo tháng', description: 'Thống kê doanh thu theo từng tháng trong năm', icon: '📊', category: 'Doanh thu' },
      { id: 'R002', title: 'Báo cáo doanh thu theo sản phẩm', description: 'Phân tích doanh thu theo từng sản phẩm/dịch vụ', icon: '📦', category: 'Doanh thu' },
      { id: 'R003', title: 'Báo cáo doanh thu theo khách hàng', description: 'Top khách hàng theo doanh thu', icon: '👥', category: 'Doanh thu' },
      { id: 'R004', title: 'Báo cáo chi phí theo loại', description: 'Phân tích chi phí theo từng danh mục', icon: '💰', category: 'Chi phí' },
      { id: 'R005', title: 'Báo cáo chi phí theo phòng ban', description: 'Chi phí phát sinh theo từng phòng ban', icon: '🏢', category: 'Chi phí' },
      { id: 'R006', title: 'Báo cáo lãi lỗ theo quý', description: 'So sánh lãi lỗ qua các quý', icon: '📈', category: 'Lợi nhuận' },
      { id: 'R007', title: 'Báo cáo biên lợi nhuận', description: 'Phân tích biên lợi nhuận gộp, ròng', icon: '💹', category: 'Lợi nhuận' },
      { id: 'R008', title: 'Báo cáo công nợ phải thu', description: 'Theo dõi công nợ khách hàng theo tuổi nợ', icon: '📋', category: 'Công nợ' },
      { id: 'R009', title: 'Báo cáo công nợ phải trả', description: 'Theo dõi công nợ nhà cung cấp', icon: '📝', category: 'Công nợ' },
      { id: 'R010', title: 'Báo cáo tồn kho', description: 'Tình hình tồn kho theo sản phẩm', icon: '📦', category: 'Kho hàng' },
      { id: 'R011', title: 'Báo cáo hàng tồn kho chậm luân chuyển', description: 'Hàng tồn quá hạn, chậm bán', icon: '⚠️', category: 'Kho hàng' },
      { id: 'R012', title: 'Báo cáo chi phí lương', description: 'Tổng hợp chi phí lương theo phòng ban', icon: '👔', category: 'Nhân sự' },
      { id: 'R013', title: 'Báo cáo bảo hiểm', description: 'Tổng hợp chi phí bảo hiểm', icon: '🏥', category: 'Nhân sự' }
    ];
  }

  get filteredReports(): ReportCard[] {
    if (!this.filterCategory) return this.reports;
    return this.reports.filter(r => r.category === this.filterCategory);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  openReport(report: ReportCard): void {
    alert(`Mở báo cáo: ${report.title}\n\n(Tính năng đang phát triển)`);
  }
}
