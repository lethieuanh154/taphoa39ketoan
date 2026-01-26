import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.models';

interface ReceivableLine {
  date: Date;
  voucherNo: string;
  voucherType: string;
  description: string;
  debitAmount: number;  // Phát sinh Nợ (tăng công nợ)
  creditAmount: number; // Phát sinh Có (giảm công nợ)
  balance: number;
}

interface CustomerReceivable {
  customerId: string;
  customerCode: string;
  customerName: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: ReceivableLine[];
}

interface ReceivableSummary {
  totalCustomers: number;
  totalOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalClosingBalance: number;
}

@Component({
  selector: 'app-receivable-ledger-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receivable-ledger-page.component.html',
  styleUrl: './receivable-ledger-page.component.css'
})
export class ReceivableLedgerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  customers: Customer[] = [];
  customerReceivables: CustomerReceivable[] = [];
  selectedCustomerData: CustomerReceivable | null = null;

  // Filter
  selectedCustomerId = '';
  fromDate: Date;
  toDate: Date;

  // Summary
  summary: ReceivableSummary = {
    totalCustomers: 0,
    totalOpeningBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalClosingBalance: 0
  };

  // View mode
  viewMode: 'summary' | 'detail' = 'summary';

  // Loading
  isLoading = false;

  constructor(private customerService: CustomerService) {
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadCustomers(): void {
    this.customerService.getCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(customers => {
        this.customers = customers.filter(c => c.status === 'ACTIVE');
      });
  }

  loadData(): void {
    this.isLoading = true;

    // In real app, this would query from invoices and cash vouchers
    // For demo, generate sample data
    this.customerService.getCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(customers => {
        this.generateReceivableData(customers.filter(c => c.status === 'ACTIVE'));
        this.isLoading = false;
      });
  }

  private generateReceivableData(customers: Customer[]): void {
    const now = new Date();

    this.customerReceivables = customers.map(c => {
      const openingBalance = Math.floor(Math.random() * 50000000);
      const debit1 = Math.floor(Math.random() * 30000000);
      const debit2 = Math.floor(Math.random() * 20000000);
      const credit1 = Math.floor(Math.random() * 25000000);

      let balance = openingBalance;
      const lines: ReceivableLine[] = [
        {
          date: new Date(now.getFullYear(), now.getMonth(), 5),
          voucherNo: `HD-${c.code}-001`,
          voucherType: 'INVOICE',
          description: 'Bán hàng - HĐ GTGT',
          debitAmount: debit1,
          creditAmount: 0,
          balance: balance += debit1
        },
        {
          date: new Date(now.getFullYear(), now.getMonth(), 12),
          voucherNo: `PT-${c.code}-001`,
          voucherType: 'RECEIPT',
          description: 'Thu tiền khách hàng',
          debitAmount: 0,
          creditAmount: credit1,
          balance: balance -= credit1
        },
        {
          date: new Date(now.getFullYear(), now.getMonth(), 20),
          voucherNo: `HD-${c.code}-002`,
          voucherType: 'INVOICE',
          description: 'Bán hàng - HĐ GTGT',
          debitAmount: debit2,
          creditAmount: 0,
          balance: balance += debit2
        }
      ];

      return {
        customerId: c.id,
        customerCode: c.code,
        customerName: c.name,
        openingBalance,
        totalDebit: debit1 + debit2,
        totalCredit: credit1,
        closingBalance: balance,
        lines
      };
    });

    this.calculateSummary();
  }

  private calculateSummary(): void {
    this.summary = {
      totalCustomers: this.customerReceivables.length,
      totalOpeningBalance: this.customerReceivables.reduce((sum, c) => sum + c.openingBalance, 0),
      totalDebit: this.customerReceivables.reduce((sum, c) => sum + c.totalDebit, 0),
      totalCredit: this.customerReceivables.reduce((sum, c) => sum + c.totalCredit, 0),
      totalClosingBalance: this.customerReceivables.reduce((sum, c) => sum + c.closingBalance, 0)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // VIEW
  // ═══════════════════════════════════════════════════════════════════

  showSummary(): void {
    this.viewMode = 'summary';
    this.selectedCustomerId = '';
    this.selectedCustomerData = null;
  }

  showDetail(customerId: string): void {
    this.selectedCustomerId = customerId;
    this.selectedCustomerData = this.customerReceivables.find(c => c.customerId === customerId) || null;
    this.viewMode = 'detail';
  }

  onCustomerChange(): void {
    if (this.selectedCustomerId) {
      this.showDetail(this.selectedCustomerId);
    } else {
      this.showSummary();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATE RANGE
  // ═══════════════════════════════════════════════════════════════════

  setDateRange(range: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear'): void {
    const now = new Date();

    switch (range) {
      case 'thisMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        this.fromDate = new Date(now.getFullYear(), quarter * 3, 1);
        this.toDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'thisYear':
        this.fromDate = new Date(now.getFullYear(), 0, 1);
        this.toDate = new Date(now.getFullYear(), 11, 31);
        break;
    }

    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════

  exportToExcel(): void {
    let csvContent: string;

    if (this.viewMode === 'summary') {
      const headers = ['STT', 'Mã KH', 'Tên khách hàng', 'Dư đầu kỳ', 'PS Nợ', 'PS Có', 'Dư cuối kỳ'];
      const rows = this.customerReceivables.map((c, i) => [
        i + 1, c.customerCode, c.customerName, c.openingBalance, c.totalDebit, c.totalCredit, c.closingBalance
      ]);

      csvContent = [
        'SỔ CHI TIẾT TÀI KHOẢN 131 - PHẢI THU KHÁCH HÀNG',
        `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(',')),
        '',
        `Tổng cộng,,,${this.summary.totalOpeningBalance},${this.summary.totalDebit},${this.summary.totalCredit},${this.summary.totalClosingBalance}`
      ].join('\n');
    } else {
      const c = this.selectedCustomerData!;
      const headers = ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'PS Nợ', 'PS Có', 'Số dư'];
      const rows = c.lines.map(l => [
        this.formatDate(l.date), l.voucherNo, this.getVoucherTypeLabel(l.voucherType),
        l.description, l.debitAmount || '', l.creditAmount || '', l.balance
      ]);

      csvContent = [
        `SỔ CHI TIẾT TK 131 - ${c.customerCode} - ${c.customerName}`,
        `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
        '',
        headers.join(','),
        `${this.formatDate(this.fromDate)},,,"Dư đầu kỳ",,,"${c.openingBalance}"`,
        ...rows.map(r => r.join(',')),
        `${this.formatDate(this.toDate)},,,"Dư cuối kỳ",,,"${c.closingBalance}"`
      ].join('\n');
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoCongNo131_${this.formatDateForFile(new Date())}.csv`;
    link.click();
  }

  print(): void {
    window.print();
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatDateForFile(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  getVoucherTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'INVOICE': 'Hóa đơn',
      'RECEIPT': 'Phiếu thu',
      'RETURN': 'Trả hàng',
      'OTHER': 'Khác'
    };
    return labels[type] || type;
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-debit';
    if (balance < 0) return 'balance-credit';
    return '';
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  onFromDateChange(dateString: string): void {
    this.fromDate = this.parseDate(dateString);
    this.loadData();
  }

  onToDateChange(dateString: string): void {
    this.toDate = this.parseDate(dateString);
    this.loadData();
  }
}
