import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SalaryPaymentService } from '../../services/salary-payment.service';
import { PayrollService } from '../../services/payroll.service';
import { BankService } from '../../services/bank.service';
import {
  SalaryPayment,
  SalaryPaymentStatus,
  PaymentMethod,
  SALARY_PAYMENT_STATUSES,
  PAYMENT_METHODS
} from '../../models/salary-payment.models';
import { Payroll } from '../../models/payroll.models';
import { BankAccount } from '../../models/bank.models';

@Component({
  selector: 'app-salary-payment-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-payment-page.component.html',
  styleUrl: './salary-payment-page.component.css'
})
export class SalaryPaymentPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  payments: SalaryPayment[] = [];
  payrolls: Payroll[] = [];
  bankAccounts: BankAccount[] = [];
  selectedPayment: SalaryPayment | null = null;

  // Filter
  filterYear: number;
  years: number[] = [];

  // Constants
  statuses = SALARY_PAYMENT_STATUSES;
  methods = PAYMENT_METHODS;

  // Create Modal
  showCreateModal = false;
  selectedPayroll: Payroll | null = null;
  newPaymentDate: string = '';
  newPaymentMethod: PaymentMethod = 'BANK_TRANSFER';
  newBankAccountId: string = '';

  // Detail Modal
  showDetailModal = false;
  editingPayment: SalaryPayment | null = null;

  // Loading
  isLoading = false;

  constructor(
    private paymentService: SalaryPaymentService,
    private payrollService: PayrollService,
    private bankService: BankService
  ) {
    const now = new Date();
    this.filterYear = now.getFullYear();
    this.newPaymentDate = now.toISOString().split('T')[0];

    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadPayments();
    this.loadApprovedPayrolls();
    this.loadBankAccounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadPayments(): void {
    this.isLoading = true;
    this.paymentService.getPaymentsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(payments => {
        this.payments = payments;
        this.isLoading = false;
      });
  }

  loadApprovedPayrolls(): void {
    this.payrollService.getPayrolls()
      .pipe(takeUntil(this.destroy$))
      .subscribe(payrolls => {
        // Chỉ lấy bảng lương đã duyệt nhưng chưa chi
        this.payrolls = payrolls.filter(p => p.status === 'APPROVED');
      });
  }

  loadBankAccounts(): void {
    this.bankService.getActiveBankAccounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(accounts => {
        this.bankAccounts = accounts;
        if (accounts.length > 0) {
          const defaultAcc = accounts.find(a => a.isDefault);
          this.newBankAccountId = defaultAcc?.id || accounts[0].id;
        }
      });
  }

  onYearChange(): void {
    this.loadPayments();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE PAYMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    if (this.payrolls.length === 0) {
      alert('Không có bảng lương đã duyệt để thanh toán');
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

  createPayment(): void {
    if (!this.selectedPayroll || !this.newPaymentDate) return;

    const payment = this.paymentService.createFromPayroll(
      this.selectedPayroll,
      new Date(this.newPaymentDate),
      this.newPaymentMethod,
      this.newPaymentMethod === 'BANK_TRANSFER' ? this.newBankAccountId : undefined
    );

    this.closeCreateModal();
    this.loadPayments();
    this.loadApprovedPayrolls();
    this.viewPayment(payment);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW/EDIT PAYMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  viewPayment(payment: SalaryPayment): void {
    this.selectedPayment = payment;
    this.editingPayment = JSON.parse(JSON.stringify(payment));
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedPayment = null;
    this.editingPayment = null;
  }

  savePayment(): void {
    if (!this.editingPayment) return;

    this.paymentService.updatePayment(this.editingPayment.id, {
      lines: this.editingPayment.lines
    });

    this.loadPayments();
    this.closeDetailModal();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  approvePayment(id: string): void {
    if (confirm('Bạn có chắc chắn muốn duyệt phiếu thanh toán này?')) {
      this.paymentService.approvePayment(id);
      this.loadPayments();
      this.closeDetailModal();
    }
  }

  markAsPaid(id: string): void {
    if (confirm('Bạn có chắc chắn đã chi lương cho nhân viên?')) {
      this.paymentService.markAsPaid(id);
      this.loadPayments();
      this.closeDetailModal();
    }
  }

  cancelPayment(id: string): void {
    if (confirm('Bạn có chắc chắn muốn hủy phiếu thanh toán này?')) {
      this.paymentService.cancelPayment(id);
      this.loadPayments();
    }
  }

  deletePayment(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa phiếu thanh toán này?')) {
      this.paymentService.deletePayment(id);
      this.loadPayments();
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

  getMonthLabel(month: number): string {
    return `Tháng ${month.toString().padStart(2, '0')}`;
  }

  getStatusLabel(status: SalaryPaymentStatus): string {
    return SALARY_PAYMENT_STATUSES.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: SalaryPaymentStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'APPROVED': return 'status-approved';
      case 'PAID': return 'status-paid';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getMethodLabel(method: PaymentMethod): string {
    return PAYMENT_METHODS.find(m => m.value === method)?.label || method;
  }

  getTotalPayments(): number {
    return this.payments.reduce((sum, p) => sum + p.summary.totalPayment, 0);
  }

  getTotalCash(): number {
    return this.payments.reduce((sum, p) => sum + p.summary.cashPayment, 0);
  }

  getTotalBank(): number {
    return this.payments.reduce((sum, p) => sum + p.summary.bankTransfer, 0);
  }

  getPaidCount(): number {
    return this.payments.filter(p => p.status === 'PAID').length;
  }
}
