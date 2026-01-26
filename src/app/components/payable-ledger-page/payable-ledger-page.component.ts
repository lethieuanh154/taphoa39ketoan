import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SupplierService } from '../../services/supplier.service';
import { Supplier } from '../../models/supplier.models';

interface PayableLine {
  date: Date;
  voucherNo: string;
  voucherType: string;
  description: string;
  debitAmount: number;  // Phát sinh Nợ (giảm công nợ - trả tiền)
  creditAmount: number; // Phát sinh Có (tăng công nợ - mua hàng)
  balance: number;
}

interface SupplierPayable {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: PayableLine[];
}

interface PayableSummary {
  totalSuppliers: number;
  totalOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalClosingBalance: number;
}

@Component({
  selector: 'app-payable-ledger-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payable-ledger-page.component.html',
  styleUrl: './payable-ledger-page.component.css'
})
export class PayableLedgerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  suppliers: Supplier[] = [];
  supplierPayables: SupplierPayable[] = [];
  selectedSupplierData: SupplierPayable | null = null;

  selectedSupplierId = '';
  fromDate: Date;
  toDate: Date;

  summary: PayableSummary = {
    totalSuppliers: 0,
    totalOpeningBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalClosingBalance: 0
  };

  viewMode: 'summary' | 'detail' = 'summary';
  isLoading = false;

  constructor(private supplierService: SupplierService) {
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSuppliers(): void {
    this.supplierService.getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(suppliers => {
        this.suppliers = suppliers.filter(s => s.status === 'ACTIVE');
      });
  }

  loadData(): void {
    this.isLoading = true;

    this.supplierService.getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(suppliers => {
        this.generatePayableData(suppliers.filter(s => s.status === 'ACTIVE'));
        this.isLoading = false;
      });
  }

  private generatePayableData(suppliers: Supplier[]): void {
    const now = new Date();

    this.supplierPayables = suppliers.map(s => {
      const openingBalance = Math.floor(Math.random() * 80000000);
      const credit1 = Math.floor(Math.random() * 50000000);
      const credit2 = Math.floor(Math.random() * 30000000);
      const debit1 = Math.floor(Math.random() * 40000000);

      let balance = openingBalance;
      const lines: PayableLine[] = [
        {
          date: new Date(now.getFullYear(), now.getMonth(), 3),
          voucherNo: `PNK-${s.code}-001`,
          voucherType: 'RECEIPT',
          description: 'Nhập kho hàng mua',
          debitAmount: 0,
          creditAmount: credit1,
          balance: balance += credit1
        },
        {
          date: new Date(now.getFullYear(), now.getMonth(), 15),
          voucherNo: `PC-${s.code}-001`,
          voucherType: 'PAYMENT',
          description: 'Thanh toán tiền hàng',
          debitAmount: debit1,
          creditAmount: 0,
          balance: balance -= debit1
        },
        {
          date: new Date(now.getFullYear(), now.getMonth(), 25),
          voucherNo: `PNK-${s.code}-002`,
          voucherType: 'RECEIPT',
          description: 'Nhập kho hàng mua',
          debitAmount: 0,
          creditAmount: credit2,
          balance: balance += credit2
        }
      ];

      return {
        supplierId: s.id,
        supplierCode: s.code,
        supplierName: s.name,
        openingBalance,
        totalDebit: debit1,
        totalCredit: credit1 + credit2,
        closingBalance: balance,
        lines
      };
    });

    this.calculateSummary();
  }

  private calculateSummary(): void {
    this.summary = {
      totalSuppliers: this.supplierPayables.length,
      totalOpeningBalance: this.supplierPayables.reduce((sum, s) => sum + s.openingBalance, 0),
      totalDebit: this.supplierPayables.reduce((sum, s) => sum + s.totalDebit, 0),
      totalCredit: this.supplierPayables.reduce((sum, s) => sum + s.totalCredit, 0),
      totalClosingBalance: this.supplierPayables.reduce((sum, s) => sum + s.closingBalance, 0)
    };
  }

  showSummary(): void {
    this.viewMode = 'summary';
    this.selectedSupplierId = '';
    this.selectedSupplierData = null;
  }

  showDetail(supplierId: string): void {
    this.selectedSupplierId = supplierId;
    this.selectedSupplierData = this.supplierPayables.find(s => s.supplierId === supplierId) || null;
    this.viewMode = 'detail';
  }

  onSupplierChange(): void {
    if (this.selectedSupplierId) {
      this.showDetail(this.selectedSupplierId);
    } else {
      this.showSummary();
    }
  }

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

  exportToExcel(): void {
    let csvContent: string;
    if (this.viewMode === 'summary') {
      const headers = ['STT', 'Mã NCC', 'Tên nhà cung cấp', 'Dư đầu kỳ', 'PS Nợ', 'PS Có', 'Dư cuối kỳ'];
      const rows = this.supplierPayables.map((s, i) => [
        i + 1, s.supplierCode, s.supplierName, s.openingBalance, s.totalDebit, s.totalCredit, s.closingBalance
      ]);
      csvContent = [
        'SỔ CHI TIẾT TÀI KHOẢN 331 - PHẢI TRẢ NHÀ CUNG CẤP',
        `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
        '', headers.join(','),
        ...rows.map(r => r.join(',')),
        '', `Tổng cộng,,,${this.summary.totalOpeningBalance},${this.summary.totalDebit},${this.summary.totalCredit},${this.summary.totalClosingBalance}`
      ].join('\n');
    } else {
      const s = this.selectedSupplierData!;
      const headers = ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'PS Nợ', 'PS Có', 'Số dư'];
      const rows = s.lines.map(l => [
        this.formatDate(l.date), l.voucherNo, this.getVoucherTypeLabel(l.voucherType),
        l.description, l.debitAmount || '', l.creditAmount || '', l.balance
      ]);
      csvContent = [
        `SỔ CHI TIẾT TK 331 - ${s.supplierCode} - ${s.supplierName}`,
        `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
        '', headers.join(','),
        `${this.formatDate(this.fromDate)},,,"Dư đầu kỳ",,,"${s.openingBalance}"`,
        ...rows.map(r => r.join(',')),
        `${this.formatDate(this.toDate)},,,"Dư cuối kỳ",,,"${s.closingBalance}"`
      ].join('\n');
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoCongNo331_${this.formatDateForFile(new Date())}.csv`;
    link.click();
  }

  print(): void { window.print(); }

  formatCurrency(amount: number): string { return new Intl.NumberFormat('vi-VN').format(amount); }
  formatDate(date: Date): string { return new Date(date).toLocaleDateString('vi-VN'); }
  formatDateForFile(date: Date): string { return date.toISOString().split('T')[0].replace(/-/g, ''); }

  getVoucherTypeLabel(type: string): string {
    const labels: Record<string, string> = { 'RECEIPT': 'Nhập kho', 'PAYMENT': 'Phiếu chi', 'RETURN': 'Trả hàng', 'OTHER': 'Khác' };
    return labels[type] || type;
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-credit';
    if (balance < 0) return 'balance-debit';
    return '';
  }

  parseDate(dateString: string): Date { return new Date(dateString); }
  onFromDateChange(dateString: string): void { this.fromDate = this.parseDate(dateString); this.loadData(); }
  onToDateChange(dateString: string): void { this.toDate = this.parseDate(dateString); this.loadData(); }
}
