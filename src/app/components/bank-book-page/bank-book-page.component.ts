import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { BankTransactionService } from '../../services/bank-transaction.service';
import { BankService } from '../../services/bank.service';
import {
  BankTransaction,
  BankTransactionType,
  BankBookLine,
  BankBookSummary,
  BANK_TRANSACTION_TYPES,
  getTransactionTypeLabel,
  generateTransactionNo,
  DEFAULT_ENTRIES,
  validateBankTransaction
} from '../../models/bank-transaction.models';
import { BankAccount, VIETNAM_BANKS } from '../../models/bank.models';

@Component({
  selector: 'app-bank-book-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bank-book-page.component.html',
  styleUrl: './bank-book-page.component.css'
})
export class BankBookPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  bankAccounts: BankAccount[] = [];
  transactions: BankTransaction[] = [];
  bankBookLines: BankBookLine[] = [];
  summary: BankBookSummary = {
    bankAccountId: '',
    bankAccountNo: '',
    bankName: '',
    currency: 'VND',
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    transactionCount: 0
  };

  // Filter
  selectedAccountId = '';
  fromDate: Date;
  toDate: Date;
  filterType: BankTransactionType | '' = '';
  searchText = '';

  // Transaction types
  transactionTypes = BANK_TRANSACTION_TYPES;

  // Modal
  showModal = false;
  isEditing = false;
  editingTransaction: Partial<BankTransaction> = {};
  validationErrors: string[] = [];

  // Loading
  isLoading = false;

  constructor(
    private bankTransactionService: BankTransactionService,
    private bankService: BankService
  ) {
    // Default to current month
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadBankAccounts();
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadBankAccounts(): void {
    this.bankService.getActiveBankAccounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts: BankAccount[]) => {
        this.bankAccounts = accounts;
        if (this.bankAccounts.length > 0 && !this.selectedAccountId) {
          this.selectedAccountId = this.bankAccounts[0].id;
          this.buildBankBook();
        }
      });
  }

  private loadTransactions(): void {
    this.isLoading = true;
    this.bankTransactionService.getTransactions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => {
        this.transactions = transactions;
        this.buildBankBook();
        this.isLoading = false;
      });
  }

  private buildBankBook(): void {
    if (!this.selectedAccountId) return;

    const account = this.bankAccounts.find(a => a.id === this.selectedAccountId);
    if (!account) return;

    // Filter transactions
    let filtered = this.transactions.filter(t => {
      const tDate = new Date(t.transactionDate);
      return t.bankAccountId === this.selectedAccountId &&
        t.status === 'POSTED' &&
        tDate >= this.fromDate &&
        tDate <= this.toDate;
    });

    // Filter by type
    if (this.filterType) {
      filtered = filtered.filter(t => t.transactionType === this.filterType);
    }

    // Search filter
    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(t =>
        t.transactionNo.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.counterpartyName?.toLowerCase().includes(search)
      );
    }

    // Sort by date
    filtered.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

    // Calculate opening balance
    const beforePeriod = this.transactions.filter(t => {
      const tDate = new Date(t.transactionDate);
      return t.bankAccountId === this.selectedAccountId &&
        t.status === 'POSTED' &&
        tDate < this.fromDate;
    });

    let openingBalance = account.openingBalance || 50000000; // Demo initial
    beforePeriod.forEach(t => {
      if (t.isCredit) {
        openingBalance += t.amount;
      } else {
        openingBalance -= t.amount;
      }
    });

    // Build book lines
    let runningBalance = openingBalance;
    this.bankBookLines = filtered.map(t => {
      if (t.isCredit) {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }

      return {
        date: new Date(t.transactionDate),
        transactionNo: t.transactionNo,
        transactionType: t.transactionType,
        description: t.description,
        counterpartyName: t.counterpartyName,
        debitAmount: t.isCredit ? t.amount : 0,
        creditAmount: !t.isCredit ? t.amount : 0,
        balance: runningBalance,
        transactionId: t.id,
        referenceNo: t.referenceNo
      };
    });

    // Calculate summary
    const totalDebit = this.bankBookLines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredit = this.bankBookLines.reduce((sum, l) => sum + l.creditAmount, 0);

    this.summary = {
      bankAccountId: account.id,
      bankAccountNo: account.accountNo,
      bankName: account.bankName,
      currency: account.currency,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: openingBalance + totalDebit - totalCredit,
      transactionCount: this.bankBookLines.length
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTER HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  onAccountChange(): void {
    this.buildBankBook();
  }

  onFromDateChange(dateString: string): void {
    this.fromDate = dateString ? new Date(dateString) : new Date();
    this.buildBankBook();
  }

  onToDateChange(dateString: string): void {
    this.toDate = dateString ? new Date(dateString) : new Date();
    this.buildBankBook();
  }

  onTypeFilterChange(): void {
    this.buildBankBook();
  }

  onSearchChange(): void {
    this.buildBankBook();
  }

  setDateRange(range: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter'): void {
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
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        this.fromDate = new Date(now.getFullYear(), quarter * 3, 1);
        this.toDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
    }

    this.buildBankBook();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  openNewTransaction(): void {
    const account = this.bankAccounts.find(a => a.id === this.selectedAccountId);
    this.isEditing = false;
    this.editingTransaction = {
      transactionDate: new Date(),
      bankAccountId: this.selectedAccountId,
      bankAccountNo: account?.accountNo || '',
      bankName: account?.bankName || '',
      transactionType: 'COLLECTION',
      isCredit: true,
      amount: 0,
      currency: 'VND',
      description: '',
      debitAccount: '1121',
      creditAccount: '131'
    };
    this.validationErrors = [];
    this.showModal = true;
  }

  editTransaction(transactionId: string): void {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (!transaction || transaction.status !== 'DRAFT') return;

    this.isEditing = true;
    this.editingTransaction = { ...transaction };
    this.validationErrors = [];
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingTransaction = {};
    this.validationErrors = [];
  }

  onTransactionTypeChange(): void {
    const type = BANK_TRANSACTION_TYPES.find(t => t.value === this.editingTransaction.transactionType);
    if (type) {
      this.editingTransaction.isCredit = type.isCredit;
      const defaultEntry = DEFAULT_ENTRIES[this.editingTransaction.transactionType!];
      this.editingTransaction.debitAccount = defaultEntry.debit;
      this.editingTransaction.creditAccount = defaultEntry.credit;
    }
  }

  saveTransaction(): void {
    this.validationErrors = validateBankTransaction(this.editingTransaction);
    if (this.validationErrors.length > 0) return;

    if (this.isEditing && this.editingTransaction.id) {
      this.bankTransactionService.updateTransaction(this.editingTransaction.id, this.editingTransaction);
    } else {
      this.bankTransactionService.createTransaction(this.editingTransaction);
    }

    this.closeModal();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  postTransaction(id: string): void {
    if (confirm('Bạn có chắc chắn muốn ghi sổ giao dịch này?')) {
      this.bankTransactionService.postTransaction(id);
    }
  }

  cancelTransaction(id: string): void {
    const reason = prompt('Nhập lý do hủy giao dịch:');
    if (reason) {
      this.bankTransactionService.cancelTransaction(id, reason);
    }
  }

  deleteTransaction(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
      this.bankTransactionService.deleteTransaction(id);
    }
  }

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    let csv = 'Ngày,Số CT,Loại GD,Đối tác,Diễn giải,Số tham chiếu,Thu vào,Chi ra,Số dư\n';

    // Opening balance
    csv += `${this.formatDate(this.fromDate)},,,,Số dư đầu kỳ,,,${this.summary.openingBalance}\n`;

    // Transactions
    this.bankBookLines.forEach(line => {
      csv += `${this.formatDate(line.date)},${line.transactionNo},${this.getTypeLabel(line.transactionType)},"${line.counterpartyName || ''}","${line.description}",${line.referenceNo || ''},${line.debitAmount || ''},${line.creditAmount || ''},${line.balance}\n`;
    });

    // Totals
    csv += `,,,,"Cộng phát sinh",,${this.summary.totalDebit},${this.summary.totalCredit},\n`;
    csv += `${this.formatDate(this.toDate)},,,,Số dư cuối kỳ,,,${this.summary.closingBalance}\n`;

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Tien_Gui_NH_${this.summary.bankAccountNo}_${this.formatDateForFile(this.fromDate)}_${this.formatDateForFile(this.toDate)}.csv`;
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

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatDateInput(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
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

  getTypeLabel(type: BankTransactionType): string {
    return getTransactionTypeLabel(type);
  }

  getTypeClass(type: BankTransactionType): string {
    const creditTypes: BankTransactionType[] = ['DEPOSIT', 'TRANSFER_IN', 'COLLECTION', 'INTEREST'];
    return creditTypes.includes(type) ? 'type-credit' : 'type-debit';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'DRAFT': return 'Nháp';
      case 'POSTED': return 'Đã ghi sổ';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'POSTED': return 'status-posted';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getDraftTransactions(): BankTransaction[] {
    return this.transactions.filter(t =>
      t.bankAccountId === this.selectedAccountId &&
      t.status === 'DRAFT'
    );
  }
}
