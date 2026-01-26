import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CashVoucherService } from '../../services/cash-voucher.service';
import { CashVoucher } from '../../models/cash-voucher.models';

interface CashBookLine {
  date: Date;
  voucherNo: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  description: string;
  receiptAmount: number;
  paymentAmount: number;
  balance: number;
  voucherId?: string;
}

interface CashBookSummary {
  openingBalance: number;
  totalReceipt: number;
  totalPayment: number;
  closingBalance: number;
  transactionCount: number;
}

@Component({
  selector: 'app-cash-book-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-book-page.component.html',
  styleUrl: './cash-book-page.component.css'
})
export class CashBookPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  cashBookLines: CashBookLine[] = [];
  summary: CashBookSummary = {
    openingBalance: 0,
    totalReceipt: 0,
    totalPayment: 0,
    closingBalance: 0,
    transactionCount: 0
  };

  // Filter
  fromDate: Date;
  toDate: Date;
  filterType: '' | 'RECEIPT' | 'PAYMENT' = '';

  // Loading
  isLoading = false;

  constructor(private cashVoucherService: CashVoucherService) {
    // Default to current month
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadData(): void {
    this.isLoading = true;

    // Get all posted cash vouchers
    this.cashVoucherService.getVouchers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(vouchers => {
        this.buildCashBook(vouchers);
        this.isLoading = false;
      });
  }

  private buildCashBook(vouchers: CashVoucher[]): void {
    // Filter by date range and posted status
    let filtered = vouchers.filter(v => {
      const vDate = new Date(v.voucherDate);
      return v.status === 'POSTED' &&
        vDate >= this.fromDate &&
        vDate <= this.toDate;
    });

    // Filter by type if selected
    if (this.filterType) {
      filtered = filtered.filter(v => v.voucherType === this.filterType);
    }

    // Sort by date
    filtered.sort((a, b) => new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime());

    // Calculate opening balance (sum of all transactions before fromDate)
    const openingVouchers = vouchers.filter(v => {
      const vDate = new Date(v.voucherDate);
      return v.status === 'POSTED' && vDate < this.fromDate;
    });

    let openingBalance = 10000000; // Initial cash (demo)
    openingVouchers.forEach(v => {
      if (v.voucherType === 'RECEIPT') {
        openingBalance += v.totalAmount;
      } else {
        openingBalance -= v.totalAmount;
      }
    });

    // Build cash book lines
    let runningBalance = openingBalance;
    this.cashBookLines = filtered.map(v => {
      const isReceipt = v.voucherType === 'RECEIPT';
      if (isReceipt) {
        runningBalance += v.totalAmount;
      } else {
        runningBalance -= v.totalAmount;
      }

      return {
        date: new Date(v.voucherDate),
        voucherNo: v.voucherNo,
        voucherType: v.voucherType,
        description: v.description || v.reason,
        receiptAmount: isReceipt ? v.totalAmount : 0,
        paymentAmount: !isReceipt ? v.totalAmount : 0,
        balance: runningBalance,
        voucherId: v.id
      };
    });

    // Calculate summary
    const totalReceipt = this.cashBookLines.reduce((sum, l) => sum + l.receiptAmount, 0);
    const totalPayment = this.cashBookLines.reduce((sum, l) => sum + l.paymentAmount, 0);

    this.summary = {
      openingBalance,
      totalReceipt,
      totalPayment,
      closingBalance: openingBalance + totalReceipt - totalPayment,
      transactionCount: this.cashBookLines.length
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTER HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  onFromDateChange(dateString: string): void {
    this.fromDate = dateString ? new Date(dateString) : new Date();
    this.loadData();
  }

  onToDateChange(dateString: string): void {
    this.toDate = dateString ? new Date(dateString) : new Date();
    this.loadData();
  }

  onTypeFilterChange(): void {
    this.loadData();
  }

  setDateRange(range: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth'): void {
    const now = new Date();

    switch (range) {
      case 'today':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        this.toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'thisWeek':
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        this.fromDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
        this.toDate = now;
        break;
      case 'thisMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
    }

    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    // Build CSV content
    let csv = 'Ngày,Số chứng từ,Loại,Diễn giải,Thu,Chi,Tồn\n';

    // Opening balance row
    csv += `${this.formatDate(this.fromDate)},,,"Số dư đầu kỳ",,,${this.summary.openingBalance}\n`;

    // Transaction rows
    this.cashBookLines.forEach(line => {
      csv += `${this.formatDate(line.date)},${line.voucherNo},${line.voucherType === 'RECEIPT' ? 'Thu' : 'Chi'},"${line.description}",${line.receiptAmount || ''},${line.paymentAmount || ''},${line.balance}\n`;
    });

    // Totals row
    csv += `,,,Cộng phát sinh,${this.summary.totalReceipt},${this.summary.totalPayment},\n`;
    csv += `${this.formatDate(this.toDate)},,,"Số dư cuối kỳ",,,${this.summary.closingBalance}\n`;

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Quy_Tien_Mat_${this.formatDateForFile(this.fromDate)}_${this.formatDateForFile(this.toDate)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    if (amount === 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  private formatDateForFile(date: Date): string {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getFullYear()}`;
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-positive';
    if (balance < 0) return 'balance-negative';
    return 'balance-zero';
  }

  getTypeLabel(type: 'RECEIPT' | 'PAYMENT'): string {
    return type === 'RECEIPT' ? 'Thu' : 'Chi';
  }
}
