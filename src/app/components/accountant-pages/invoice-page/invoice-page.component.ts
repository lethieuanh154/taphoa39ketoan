/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INVOICE PAGE COMPONENT - HÓA ĐƠN MUA VÀO / BÁN RA
 * Quản lý hóa đơn GTGT theo Thông tư 78/2021/TT-BTC
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { InvoiceService, InvoiceSummary } from '../../../models/invoice.service';
import {
  Invoice,
  InvoiceLine,
  InvoiceType,
  InvoiceStatus,
  InvoiceFilter,
  VATRate,
  VAT_RATES,
  COMMON_UNITS,
  REVENUE_ACCOUNTS,
  EXPENSE_ACCOUNTS,
  calculateLineTotal,
  calculateInvoiceTotals,
  generateJournalFromInvoice
} from '../../../models/invoice.models';

@Component({
  selector: 'app-invoice-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invoice-page.component.html',
  styleUrl: './invoice-page.component.css'
})
export class InvoicePageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  invoiceType: InvoiceType = 'OUTPUT';
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  summary: InvoiceSummary | null = null;
  loading = false;

  // Filter - using InvoiceFilter interface properties
  filter: InvoiceFilter = {
    fromDate: this.getFirstDayOfMonth(),
    toDate: this.getLastDayOfMonth(),
    search: ''
  };

  // Selected invoice
  selectedInvoice: Invoice | null = null;

  // Modals
  showCreateModal = false;
  showDetailModal = false;
  showJournalModal = false;
  showCancelModal = false;
  showPaymentModal = false;

  // Form data
  formData: Partial<Invoice> = {};
  formLines: InvoiceLine[] = [];
  cancelReason = '';
  paymentAmount = 0;
  paymentDate = new Date();

  // Reference data
  vatRates = VAT_RATES;
  units = COMMON_UNITS;
  revenueAccounts = REVENUE_ACCOUNTS;
  expenseAccounts = EXPENSE_ACCOUNTS;

  // Active tab for status filter
  activeStatusTab: 'all' | InvoiceStatus = 'all';

  constructor(
    private route: ActivatedRoute,
    private invoiceService: InvoiceService
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    // Get invoice type from route data
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.invoiceType = data['type'] || 'OUTPUT';
      this.loadInvoices();
    });

    // Subscribe to loading state
    this.invoiceService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadInvoices(): void {
    const filterWithType: InvoiceFilter = {
      ...this.filter,
      invoiceType: this.invoiceType
    };

    this.invoiceService.getInvoices(filterWithType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(invoices => {
        this.invoices = invoices;
        this.applyStatusFilter();
      });

    this.invoiceService.getSummary(this.invoiceType, this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => this.summary = summary);
  }

  applyStatusFilter(): void {
    if (this.activeStatusTab === 'all') {
      this.filteredInvoices = [...this.invoices];
    } else {
      this.filteredInvoices = this.invoices.filter(inv => inv.status === this.activeStatusTab);
    }
  }

  onFilterChange(): void {
    this.loadInvoices();
  }

  onStatusTabChange(status: 'all' | InvoiceStatus): void {
    this.activeStatusTab = status;
    this.applyStatusFilter();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE INVOICE
  // ═══════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.formData = {
      invoiceType: this.invoiceType,
      invoiceDate: new Date(),
      invoiceSeries: '1C25TTT',
      paymentMethod: 'CASH'
    };
    this.formLines = [this.createEmptyLine(1)];
    this.showCreateModal = true;
  }

  createEmptyLine(lineNo: number): InvoiceLine {
    return {
      id: `NEW-${Date.now()}-${lineNo}`,
      lineNo,
      productCode: '',
      productName: '',
      unit: 'Cái',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      vatRate: 8,
      vatAmount: 0,
      totalAmount: 0,
      accountCode: this.invoiceType === 'OUTPUT' ? '5111' : '1561'
    };
  }

  addLine(): void {
    const newLine = this.createEmptyLine(this.formLines.length + 1);
    this.formLines = [...this.formLines, newLine];
  }

  removeLine(index: number): void {
    if (this.formLines.length > 1) {
      this.formLines = this.formLines.filter((_, i) => i !== index);
      // Renumber lines
      this.formLines.forEach((line, i) => line.lineNo = i + 1);
    }
  }

  onLineChange(index: number): void {
    const line = this.formLines[index];
    const calculated = calculateLineTotal(line);
    line.amount = calculated.amount;
    line.vatAmount = calculated.vatAmount;
    line.totalAmount = calculated.totalAmount;
  }

  onAccountChange(index: number): void {
    const line = this.formLines[index];
    const accounts = this.invoiceType === 'OUTPUT' ? this.revenueAccounts : this.expenseAccounts;
    const account = accounts.find(a => a.code === line.accountCode);
    // accountName is not in InvoiceLine interface, just for display
  }

  getFormTotals(): { subTotal: number; totalVAT: number; grandTotal: number } {
    let subTotal = 0;
    let totalVAT = 0;

    this.formLines.forEach(line => {
      subTotal += line.amount || 0;
      totalVAT += line.vatAmount || 0;
    });

    return {
      subTotal,
      totalVAT,
      grandTotal: subTotal + totalVAT
    };
  }

  saveInvoice(): void {
    if (!this.validateForm()) return;

    const invoiceData: Partial<Invoice> = {
      ...this.formData,
      lines: this.formLines
    };

    this.invoiceService.createInvoice(invoiceData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showCreateModal = false;
          this.loadInvoices();
        },
        error: (err) => alert(err.message)
      });
  }

  validateForm(): boolean {
    if (!this.formData.partnerName) {
      alert(this.invoiceType === 'OUTPUT' ? 'Vui lòng nhập tên khách hàng' : 'Vui lòng nhập tên nhà cung cấp');
      return false;
    }

    if (this.formLines.length === 0) {
      alert('Vui lòng thêm ít nhất một dòng hàng hóa');
      return false;
    }

    for (const line of this.formLines) {
      if (!line.productName) {
        alert('Vui lòng nhập tên hàng hóa/dịch vụ');
        return false;
      }
      if (line.quantity <= 0) {
        alert('Số lượng phải lớn hơn 0');
        return false;
      }
      if (line.unitPrice < 0) {
        alert('Đơn giá không được âm');
        return false;
      }
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW INVOICE DETAIL
  // ═══════════════════════════════════════════════════════════════════════════

  viewDetail(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedInvoice = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  postInvoice(invoice: Invoice): void {
    if (!confirm('Bạn có chắc muốn ghi sổ hóa đơn này? Bút toán sẽ được tạo tự động.')) return;

    this.invoiceService.postInvoice(invoice.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadInvoices();
          if (this.selectedInvoice?.id === invoice.id) {
            this.invoiceService.getInvoiceById(invoice.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe(inv => this.selectedInvoice = inv || null);
          }
        },
        error: (err) => alert(err.message)
      });
  }

  openCancelModal(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  confirmCancel(): void {
    if (!this.selectedInvoice) return;
    if (!this.cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy');
      return;
    }

    this.invoiceService.cancelInvoice(this.selectedInvoice.id, this.cancelReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showCancelModal = false;
          this.loadInvoices();
        },
        error: (err) => alert(err.message)
      });
  }

  deleteInvoice(invoice: Invoice): void {
    if (!confirm('Bạn có chắc muốn xóa hóa đơn này?')) return;

    this.invoiceService.deleteInvoice(invoice.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadInvoices();
          if (this.showDetailModal) {
            this.closeDetailModal();
          }
        },
        error: (err) => alert(err.message)
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT
  // ═══════════════════════════════════════════════════════════════════════════

  openPaymentModal(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.paymentAmount = invoice.grandTotal - (invoice.paidAmount || 0);
    this.paymentDate = new Date();
    this.showPaymentModal = true;
  }

  confirmPayment(): void {
    if (!this.selectedInvoice) return;
    if (this.paymentAmount <= 0) {
      alert('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    this.invoiceService.updatePayment(this.selectedInvoice.id, this.paymentAmount, this.paymentDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showPaymentModal = false;
          this.loadInvoices();
        },
        error: (err) => alert(err.message)
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════

  viewJournalEntries(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.showJournalModal = true;
  }

  getJournalEntries(): any[] {
    if (!this.selectedInvoice) return [];
    return generateJournalFromInvoice(this.selectedInvoice);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  getPageTitle(): string {
    return this.invoiceType === 'OUTPUT' ? 'Hóa đơn bán ra' : 'Hóa đơn mua vào';
  }

  getPageSubtitle(): string {
    return this.invoiceType === 'OUTPUT'
      ? 'Quản lý hóa đơn GTGT bán ra theo TT 78/2021/TT-BTC'
      : 'Quản lý hóa đơn GTGT mua vào theo TT 78/2021/TT-BTC';
  }

  getStatusLabel(status: InvoiceStatus): string {
    const labels: Record<InvoiceStatus, string> = {
      'DRAFT': 'Nháp',
      'POSTED': 'Đã ghi sổ',
      'CANCELLED': 'Đã hủy',
      'ADJUSTED': 'Đã điều chỉnh'
    };
    return labels[status];
  }

  getStatusClass(status: InvoiceStatus): string {
    const classes: Record<InvoiceStatus, string> = {
      'DRAFT': 'status-draft',
      'POSTED': 'status-posted',
      'CANCELLED': 'status-cancelled',
      'ADJUSTED': 'status-adjusted'
    };
    return classes[status];
  }

  getPaymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'UNPAID': 'Chưa thanh toán',
      'PARTIAL': 'Thanh toán một phần',
      'PAID': 'Đã thanh toán'
    };
    return labels[status] || status;
  }

  getPaymentStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'UNPAID': 'payment-unpaid',
      'PARTIAL': 'payment-partial',
      'PAID': 'payment-paid'
    };
    return classes[status] || '';
  }

  getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'CASH': 'Tiền mặt',
      'BANK': 'Chuyển khoản',
      'CREDIT': 'Công nợ',
      'MIXED': 'Kết hợp'
    };
    return labels[method] || method;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatDateTime(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('vi-VN');
  }

  getFirstDayOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  getLastDayOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  getCountByStatus(status: InvoiceStatus): number {
    return this.invoices.filter(inv => inv.status === status).length;
  }

  getRemainingAmount(invoice: Invoice): number {
    return invoice.grandTotal - (invoice.paidAmount || 0);
  }

  isOverdue(invoice: Invoice): boolean {
    if (!invoice.dueDate || invoice.paymentStatus === 'PAID') return false;
    return new Date(invoice.dueDate) < new Date();
  }

  getAccounts(): { code: string; name: string }[] {
    return this.invoiceType === 'OUTPUT' ? this.revenueAccounts : this.expenseAccounts;
  }

  getAccountName(code: string): string {
    const accounts = this.getAccounts();
    const account = accounts.find(a => a.code === code);
    return account ? account.name : '';
  }
}
