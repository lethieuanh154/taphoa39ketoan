import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PITService } from '../../services/pit.service';
import { PayrollService } from '../../services/payroll.service';
import {
  PITDeclaration,
  PITDeclarationStatus,
  PIT_DECLARATION_STATUSES,
  PIT_BRACKETS,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION
} from '../../models/pit.models';
import { Payroll } from '../../models/payroll.models';

@Component({
  selector: 'app-pit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pit-page.component.html',
  styleUrl: './pit-page.component.css'
})
export class PITPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  declarations: PITDeclaration[] = [];
  payrolls: Payroll[] = [];
  selectedDeclaration: PITDeclaration | null = null;

  // Year stats
  yearStats = {
    totalPIT: 0,
    paidPIT: 0,
    unpaidPIT: 0,
    declarationCount: 0
  };

  // Filter
  filterYear: number;
  years: number[] = [];

  // Constants
  statuses = PIT_DECLARATION_STATUSES;
  brackets = PIT_BRACKETS;
  personalDeduction = PERSONAL_DEDUCTION;
  dependentDeduction = DEPENDENT_DEDUCTION;

  // Create Modal
  showCreateModal = false;
  selectedPayroll: Payroll | null = null;

  // Detail Modal
  showDetailModal = false;
  editingDeclaration: PITDeclaration | null = null;

  // Loading
  isLoading = false;

  constructor(
    private pitService: PITService,
    private payrollService: PayrollService
  ) {
    const now = new Date();
    this.filterYear = now.getFullYear();

    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadDeclarations();
    this.loadPayrolls();
    this.loadYearStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadDeclarations(): void {
    this.isLoading = true;
    this.pitService.getDeclarationsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(declarations => {
        this.declarations = declarations.sort((a, b) => (b.month || 0) - (a.month || 0));
        this.isLoading = false;
      });
  }

  loadPayrolls(): void {
    this.payrollService.getPayrollsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(payrolls => {
        // Chỉ lấy bảng lương đã duyệt
        this.payrolls = payrolls.filter(p => p.status === 'APPROVED' || p.status === 'PAID');
      });
  }

  loadYearStats(): void {
    this.pitService.getYearSummary(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.yearStats = stats;
      });
  }

  onYearChange(): void {
    this.loadDeclarations();
    this.loadPayrolls();
    this.loadYearStats();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE DECLARATION
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    if (this.payrolls.length === 0) {
      alert('Không có bảng lương để tạo tờ khai thuế TNCN');
      return;
    }
    this.selectedPayroll = null;
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.selectedPayroll = null;
  }

  selectPayroll(payroll: Payroll): void {
    this.selectedPayroll = payroll;
  }

  createDeclaration(): void {
    if (!this.selectedPayroll) return;

    // Kiểm tra đã có tờ khai chưa
    const exists = this.declarations.find(d =>
      d.month === this.selectedPayroll!.month && d.year === this.selectedPayroll!.year
    );
    if (exists) {
      alert(`Đã có tờ khai thuế TNCN tháng ${this.selectedPayroll.month}/${this.selectedPayroll.year}`);
      return;
    }

    const declaration = this.pitService.createFromPayroll(this.selectedPayroll);
    this.closeCreateModal();
    this.loadDeclarations();
    this.loadYearStats();
    this.viewDeclaration(declaration);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW DECLARATION
  // ═══════════════════════════════════════════════════════════════════════════════

  viewDeclaration(declaration: PITDeclaration): void {
    this.selectedDeclaration = declaration;
    this.editingDeclaration = JSON.parse(JSON.stringify(declaration));
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedDeclaration = null;
    this.editingDeclaration = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  submitDeclaration(id: string): void {
    if (confirm('Bạn có chắc chắn muốn nộp tờ khai thuế TNCN này?')) {
      this.pitService.submitDeclaration(id);
      this.loadDeclarations();
      this.closeDetailModal();
    }
  }

  markAsPaid(id: string): void {
    if (confirm('Xác nhận đã nộp thuế TNCN?')) {
      this.pitService.markAsPaid(id);
      this.loadDeclarations();
      this.loadYearStats();
      this.closeDetailModal();
    }
  }

  cancelDeclaration(id: string): void {
    if (confirm('Bạn có chắc chắn muốn hủy tờ khai này?')) {
      this.pitService.cancelDeclaration(id);
      this.loadDeclarations();
      this.loadYearStats();
    }
  }

  deleteDeclaration(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa tờ khai này?')) {
      this.pitService.deleteDeclaration(id);
      this.loadDeclarations();
      this.loadYearStats();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  print(): void {
    window.print();
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

  formatPercent(rate: number): string {
    return (rate * 100).toFixed(0) + '%';
  }

  getMonthLabel(month: number): string {
    return `Tháng ${month.toString().padStart(2, '0')}`;
  }

  getStatusLabel(status: PITDeclarationStatus): string {
    return PIT_DECLARATION_STATUSES.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: PITDeclarationStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'SUBMITTED': return 'status-submitted';
      case 'PAID': return 'status-paid';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  isOverdue(declaration: PITDeclaration): boolean {
    if (declaration.status === 'PAID' || declaration.status === 'CANCELLED') return false;
    return new Date() > new Date(declaration.submissionDeadline);
  }

  isLastBracket(bracket: { to: number }): boolean {
    return bracket.to === Infinity;
  }
}
