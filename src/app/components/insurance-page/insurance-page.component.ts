import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { InsuranceService } from '../../services/insurance.service';
import { EmployeeService } from '../../services/employee.service';
import {
  InsuranceReport,
  InsuranceReportStatus,
  INSURANCE_REPORT_STATUSES,
  INSURANCE_RATES_2024
} from '../../models/insurance.models';
import { Employee } from '../../models/employee.models';

@Component({
  selector: 'app-insurance-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './insurance-page.component.html',
  styleUrl: './insurance-page.component.css'
})
export class InsurancePageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  reports: InsuranceReport[] = [];
  employees: Employee[] = [];
  selectedReport: InsuranceReport | null = null;

  // Year statistics
  yearStats = {
    totalSocial: 0,
    totalHealth: 0,
    totalUnemployment: 0,
    totalAccident: 0,
    grandTotal: 0,
    paidTotal: 0,
    unpaidTotal: 0
  };

  // Filter
  filterYear: number;
  years: number[] = [];

  // Constants
  statuses = INSURANCE_REPORT_STATUSES;
  rates = INSURANCE_RATES_2024;

  // Create Modal
  showCreateModal = false;
  newMonth: number;
  newYear: number;

  // Detail Modal
  showDetailModal = false;
  editingReport: InsuranceReport | null = null;

  // Loading
  isLoading = false;

  constructor(
    private insuranceService: InsuranceService,
    private employeeService: EmployeeService
  ) {
    const now = new Date();
    this.filterYear = now.getFullYear();
    this.newMonth = now.getMonth() + 1;
    this.newYear = now.getFullYear();

    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadEmployees();
    this.loadYearStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadReports(): void {
    this.isLoading = true;
    this.insuranceService.getReportsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(reports => {
        this.reports = reports.sort((a, b) => b.month - a.month);
        this.isLoading = false;
      });
  }

  loadEmployees(): void {
    this.employeeService.getActiveEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe(employees => {
        this.employees = employees;
      });
  }

  loadYearStats(): void {
    this.insuranceService.getYearSummary(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.yearStats = stats;
      });
  }

  onYearChange(): void {
    this.loadReports();
    this.loadYearStats();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE REPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    if (this.employees.length === 0) {
      alert('Không có nhân viên để tạo báo cáo BH');
      return;
    }
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createReport(): void {
    if (this.employees.length === 0) return;

    // Kiểm tra xem đã có báo cáo tháng này chưa
    const exists = this.reports.find(r =>
      r.month === this.newMonth && r.year === this.newYear
    );
    if (exists) {
      alert(`Đã có báo cáo BH tháng ${this.newMonth}/${this.newYear}`);
      return;
    }

    const report = this.insuranceService.createReport(
      this.newMonth,
      this.newYear,
      this.employees
    );

    this.closeCreateModal();
    this.loadReports();
    this.loadYearStats();
    this.viewReport(report);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW REPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  viewReport(report: InsuranceReport): void {
    this.selectedReport = report;
    this.editingReport = JSON.parse(JSON.stringify(report));
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedReport = null;
    this.editingReport = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  submitReport(id: string): void {
    if (confirm('Bạn có chắc chắn muốn nộp báo cáo BH này?')) {
      this.insuranceService.submitReport(id);
      this.loadReports();
      this.closeDetailModal();
    }
  }

  approveReport(id: string): void {
    if (confirm('Xác nhận cơ quan BHXH đã duyệt?')) {
      this.insuranceService.approveReport(id);
      this.loadReports();
      this.closeDetailModal();
    }
  }

  markAsPaid(id: string): void {
    if (confirm('Xác nhận đã đóng bảo hiểm?')) {
      this.insuranceService.markAsPaid(id);
      this.loadReports();
      this.loadYearStats();
      this.closeDetailModal();
    }
  }

  deleteReport(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) {
      this.insuranceService.deleteReport(id);
      this.loadReports();
      this.loadYearStats();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    if (!this.editingReport) return;

    const r = this.editingReport;
    let csv = `BAO CAO DONG BAO HIEM THANG ${r.month}/${r.year}\n\n`;
    csv += 'STT,Ma NV,Ho ten,Phong ban,So so BHXH,Luong dong BH,BHXH NLD,BHYT NLD,BHTN NLD,Tong NLD,BHXH DN,BHYT DN,BHTN DN,BHTNLD,Tong DN,Tong cong\n';

    r.details.forEach((d, i) => {
      csv += `${i + 1},${d.employeeCode},"${d.employeeName}",${d.department || ''},${d.socialInsuranceNo || ''},${d.insuranceSalary},${d.employeeSocial},${d.employeeHealth},${d.employeeUnemployment},${d.totalEmployeeContribution},${d.companySocial},${d.companyHealth},${d.companyUnemployment},${d.companyAccident},${d.totalCompanyContribution},${d.totalContribution}\n`;
    });

    csv += `\nTONG,,,,${r.summary.totalInsuranceSalary},${r.summary.totalEmployeeSocial},${r.summary.totalEmployeeHealth},${r.summary.totalEmployeeUnemployment},${r.summary.totalEmployeeContribution},${r.summary.totalCompanySocial},${r.summary.totalCompanyHealth},${r.summary.totalCompanyUnemployment},${r.summary.totalCompanyAccident},${r.summary.totalCompanyContribution},${r.summary.grandTotal}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BHXH_${r.month}_${r.year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    if (amount === 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getMonthLabel(month: number): string {
    return `Tháng ${month.toString().padStart(2, '0')}`;
  }

  getMonths(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  getStatusLabel(status: InsuranceReportStatus): string {
    return INSURANCE_REPORT_STATUSES.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: InsuranceReportStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'SUBMITTED': return 'status-submitted';
      case 'APPROVED': return 'status-approved';
      case 'PAID': return 'status-paid';
      default: return '';
    }
  }

  isOverdue(report: InsuranceReport): boolean {
    if (report.status === 'PAID') return false;
    return new Date() > new Date(report.submissionDeadline);
  }
}
