import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PayrollService } from '../../services/payroll.service';
import { EmployeeService } from '../../services/employee.service';
import {
  Payroll,
  PayrollLine,
  PayrollStatus,
  PAYROLL_STATUSES,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION,
  INSURANCE_RATES
} from '../../models/payroll.models';
import { Employee } from '../../models/employee.models';

@Component({
  selector: 'app-payroll-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payroll-page.component.html',
  styleUrl: './payroll-page.component.css'
})
export class PayrollPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  payrolls: Payroll[] = [];
  employees: Employee[] = [];
  selectedPayroll: Payroll | null = null;

  // Filter
  filterYear: number;
  years: number[] = [];

  // Constants
  statuses = PAYROLL_STATUSES;

  // Create Modal
  showCreateModal = false;
  newMonth: number;
  newYear: number;
  newLines: Partial<PayrollLine>[] = [];

  // Detail Modal
  showDetailModal = false;
  editingPayroll: Payroll | null = null;

  // Loading
  isLoading = false;

  constructor(
    private payrollService: PayrollService,
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
    this.loadPayrolls();
    this.loadEmployees();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadPayrolls(): void {
    this.isLoading = true;
    this.payrollService.getPayrollsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(payrolls => {
        this.payrolls = payrolls;
        this.isLoading = false;
      });
  }

  loadEmployees(): void {
    this.employeeService.getEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe(employees => {
        this.employees = employees.filter(e => e.status === 'WORKING');
      });
  }

  onYearChange(): void {
    this.loadPayrolls();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE PAYROLL
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    // Initialize lines from active employees
    this.newLines = this.employees.map(emp => ({
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.fullName,
      department: emp.departmentName,
      position: emp.position,
      workingDays: 26,
      baseSalary: emp.baseSalary || 0,
      allowances: {
        position: 0,
        responsibility: 0,
        lunch: 800000,
        phone: 200000,
        travel: 500000,
        other: 0
      },
      overtimePay: 0,
      otherDeductions: {
        advance: 0,
        loan: 0,
        penalty: 0,
        other: 0
      }
    }));

    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.newLines = [];
  }

  createPayroll(): void {
    if (this.newLines.length === 0) return;

    const payroll = this.payrollService.createPayroll(
      this.newMonth,
      this.newYear,
      this.newLines as PayrollLine[]
    );

    this.closeCreateModal();
    this.loadPayrolls();
    this.viewPayroll(payroll);
  }

  removeEmployeeFromNew(index: number): void {
    this.newLines.splice(index, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW/EDIT PAYROLL
  // ═══════════════════════════════════════════════════════════════════════════════

  viewPayroll(payroll: Payroll): void {
    this.selectedPayroll = payroll;
    this.editingPayroll = JSON.parse(JSON.stringify(payroll)); // Deep copy
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedPayroll = null;
    this.editingPayroll = null;
  }

  savePayroll(): void {
    if (!this.editingPayroll) return;

    this.payrollService.updatePayroll(this.editingPayroll.id, {
      lines: this.editingPayroll.lines
    });

    this.loadPayrolls();
    this.closeDetailModal();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  approvePayroll(id: string): void {
    if (confirm('Bạn có chắc chắn muốn duyệt bảng lương này?')) {
      this.payrollService.approvePayroll(id);
      this.loadPayrolls();
      this.closeDetailModal();
    }
  }

  markAsPaid(id: string): void {
    const dateStr = prompt('Nhập ngày chi lương (DD/MM/YYYY):');
    if (dateStr) {
      const [d, m, y] = dateStr.split('/').map(Number);
      const paymentDate = new Date(y, m - 1, d);
      this.payrollService.markAsPaid(id, paymentDate);
      this.loadPayrolls();
      this.closeDetailModal();
    }
  }

  cancelPayroll(id: string): void {
    if (confirm('Bạn có chắc chắn muốn hủy bảng lương này?')) {
      this.payrollService.cancelPayroll(id);
      this.loadPayrolls();
    }
  }

  deletePayroll(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa bảng lương này?')) {
      this.payrollService.deletePayroll(id);
      this.loadPayrolls();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    if (!this.editingPayroll) return;

    const p = this.editingPayroll;
    let csv = `BANG LUONG THANG ${p.month}/${p.year}\n\n`;
    csv += 'STT,Ma NV,Ho ten,Phong ban,Chuc vu,Ngay cong,Luong CB,Phu cap,Tong TN,BH NLD,Thue TNCN,Khau tru khac,Thuc linh\n';

    p.lines.forEach((line, i) => {
      csv += `${i + 1},${line.employeeCode},"${line.employeeName}",${line.department || ''},${line.position || ''},${line.workingDays},${line.actualSalary},${line.totalAllowances},${line.grossSalary},${line.totalInsuranceDeduction},${line.pitAmount},${line.totalOtherDeductions},${line.netSalary}\n`;
    });

    csv += `\nTONG,,,,,${p.summary.totalWorkingDays},${p.summary.totalBaseSalary},${p.summary.totalAllowances},${p.summary.totalGrossSalary},${p.summary.totalInsuranceDeduction},${p.summary.totalPIT},${p.summary.totalOtherDeductions},${p.summary.totalNetSalary}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bang_Luong_${p.month}_${p.year}.csv`;
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

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getMonthLabel(month: number): string {
    return `Tháng ${month.toString().padStart(2, '0')}`;
  }

  getStatusLabel(status: PayrollStatus): string {
    return PAYROLL_STATUSES.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: PayrollStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'APPROVED': return 'status-approved';
      case 'PAID': return 'status-paid';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getMonths(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  getTotalAllowance(line: Partial<PayrollLine>): number {
    if (!line.allowances) return 0;
    return Object.values(line.allowances).reduce((a, b) => a + b, 0);
  }

  getTotalGross(): number {
    return this.payrolls.reduce((sum, p) => sum + p.summary.totalGrossSalary, 0);
  }

  getTotalDeductions(): number {
    return this.payrolls.reduce((sum, p) => sum + p.summary.totalDeductions, 0);
  }

  getTotalNet(): number {
    return this.payrolls.reduce((sum, p) => sum + p.summary.totalNetSalary, 0);
  }
}
