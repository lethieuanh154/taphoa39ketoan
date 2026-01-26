import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { BankService } from '../../services/bank.service';
import {
  Bank, BankAccount, BankAccountFilter, BankAccountType, Currency, BankAccountStatus,
  VIETNAM_BANKS, BANK_ACCOUNT_TYPES, CURRENCIES, BANK_ACCOUNT_STATUSES, BANK_GL_ACCOUNTS,
  validateBankAccount, formatAccountNo
} from '../../models/bank.models';

@Component({
  selector: 'app-bank-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bank-page.component.html',
  styleUrl: './bank-page.component.css'
})
export class BankPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  bankAccounts: BankAccount[] = [];
  filteredAccounts: BankAccount[] = [];
  banks: Bank[] = VIETNAM_BANKS;

  // Filter
  filter: BankAccountFilter = {};
  searchText = '';

  // Statistics
  stats = {
    totalAccounts: 0,
    activeAccounts: 0,
    totalBalance: 0,
    byBank: [] as { bankName: string; count: number; balance: number }[]
  };

  // Modal
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  editingAccount: Partial<BankAccount> = {};
  validationErrors: string[] = [];

  // Constants
  accountTypes = BANK_ACCOUNT_TYPES;
  currencies = CURRENCIES;
  accountStatuses = BANK_ACCOUNT_STATUSES;
  glAccounts = BANK_GL_ACCOUNTS;

  // Loading
  isLoading = false;

  constructor(private bankService: BankService) {}

  ngOnInit(): void {
    this.loadBankAccounts();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadBankAccounts(): void {
    this.isLoading = true;
    this.bankService.getBankAccounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(accounts => {
        this.bankAccounts = accounts;
        this.applyFilter();
        this.isLoading = false;
      });
  }

  private loadStatistics(): void {
    this.bankService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.bankAccounts];

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(a =>
        a.accountNo.includes(search) ||
        a.accountName.toLowerCase().includes(search) ||
        a.bankName.toLowerCase().includes(search) ||
        a.branch?.toLowerCase().includes(search)
      );
    }

    if (this.filter.bankId) {
      result = result.filter(a => a.bankId === this.filter.bankId);
    }

    if (this.filter.accountType) {
      result = result.filter(a => a.accountType === this.filter.accountType);
    }

    if (this.filter.currency) {
      result = result.filter(a => a.currency === this.filter.currency);
    }

    if (this.filter.status) {
      result = result.filter(a => a.status === this.filter.status);
    }

    this.filteredAccounts = result;
  }

  onSearch(): void {
    this.applyFilter();
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchText = '';
    this.filter = {};
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODAL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingAccount = {
      accountType: 'CHECKING',
      currency: 'VND',
      status: 'ACTIVE',
      glAccount: '1121',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: false
    };
    this.validationErrors = [];
    this.showModal = true;
  }

  openEditModal(account: BankAccount): void {
    this.modalMode = 'edit';
    this.editingAccount = { ...account };
    this.validationErrors = [];
    this.showModal = true;
  }

  openViewModal(account: BankAccount): void {
    this.modalMode = 'view';
    this.editingAccount = { ...account };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAccount = {};
    this.validationErrors = [];
  }

  saveAccount(): void {
    this.validationErrors = validateBankAccount(this.editingAccount);

    if (this.validationErrors.length > 0) {
      return;
    }

    if (this.modalMode === 'create') {
      this.bankService.createBankAccount(this.editingAccount)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadBankAccounts();
          this.loadStatistics();
        });
    } else if (this.modalMode === 'edit' && this.editingAccount.id) {
      this.bankService.updateBankAccount(this.editingAccount.id, this.editingAccount)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadBankAccounts();
          this.loadStatistics();
        });
    }
  }

  deleteAccount(account: BankAccount): void {
    if (confirm(`Bạn có chắc muốn xóa tài khoản "${account.accountNo}" tại ${account.bankName}?`)) {
      this.bankService.deleteBankAccount(account.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadBankAccounts();
          this.loadStatistics();
        });
    }
  }

  setAsDefault(account: BankAccount): void {
    this.bankService.updateBankAccount(account.id, { isDefault: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadBankAccounts();
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  formatCurrency(amount: number, currency: Currency = 'VND'): string {
    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
    }
    const curr = this.currencies.find(c => c.value === currency);
    return curr?.symbol + new Intl.NumberFormat('en-US').format(amount);
  }

  formatAccountNo(accountNo: string): string {
    return formatAccountNo(accountNo);
  }

  getAccountTypeLabel(type: BankAccountType): string {
    return this.accountTypes.find(t => t.value === type)?.label || type;
  }

  getCurrencyLabel(currency: Currency): string {
    return this.currencies.find(c => c.value === currency)?.label || currency;
  }

  getStatusLabel(status: BankAccountStatus): string {
    return this.accountStatuses.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: BankAccountStatus): string {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      case 'CLOSED': return 'status-closed';
      default: return '';
    }
  }

  onBankChange(): void {
    const bank = this.banks.find(b => b.id === this.editingAccount.bankId);
    if (bank) {
      this.editingAccount.bankCode = bank.code;
      this.editingAccount.bankName = bank.shortName;
    }
  }

  onCurrencyChange(): void {
    if (this.editingAccount.currency === 'VND') {
      this.editingAccount.glAccount = '1121';
    } else {
      this.editingAccount.glAccount = '1122';
    }
  }
}
