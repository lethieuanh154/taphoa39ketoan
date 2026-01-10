import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ChartOfAccountsService } from '../../services/chart-of-accounts.service';
import {
  Account,
  AccountFilter,
  AccountGroup,
  AccountType,
  AccountNature,
  getAccountTypeName,
  getAccountNatureName,
  isValidAccountCode,
  getAccountLevel,
  getParentCode
} from '../../models/chart-of-accounts.models';

/**
 * HỆ THỐNG TÀI KHOẢN KẾ TOÁN - CHART OF ACCOUNTS
 *
 * Theo Thông tư 133/2016/TT-BTC
 */
@Component({
  selector: 'app-chart-of-accounts-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chart-of-accounts-page.component.html',
  styleUrl: './chart-of-accounts-page.component.css'
})
export class ChartOfAccountsPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === DATA STATE ===
  accounts: Account[] = [];
  accountGroups: AccountGroup[] = [];
  filteredAccounts: Account[] = [];

  // === FILTER STATE ===
  filter: AccountFilter = {};
  searchText: string = '';
  selectedType: AccountType | '' = '';
  showInactive: boolean = false;

  // === UI STATE ===
  isLoading: boolean = false;
  errorMessage: string = '';
  viewMode: 'tree' | 'list' | 'group' = 'tree';
  expandedCodes: Set<string> = new Set();

  // === MODAL STATE ===
  showAddModal: boolean = false;
  showEditModal: boolean = false;
  showDetailModal: boolean = false;
  selectedAccount: Account | null = null;

  // === FORM STATE ===
  newAccount: Partial<Account> = {};
  editAccount: Partial<Account> = {};
  formErrors: string[] = [];

  // === OPTIONS ===
  accountTypes: { value: AccountType; label: string }[] = [
    { value: 'ASSET_SHORT', label: 'Loại 1 - Tài sản ngắn hạn' },
    { value: 'ASSET_LONG', label: 'Loại 2 - Tài sản dài hạn' },
    { value: 'LIABILITY', label: 'Loại 3 - Nợ phải trả' },
    { value: 'EQUITY', label: 'Loại 4 - Vốn chủ sở hữu' },
    { value: 'REVENUE', label: 'Loại 5 - Doanh thu' },
    { value: 'EXPENSE_PROD', label: 'Loại 6 - Chi phí SXKD' },
    { value: 'INCOME_OTHER', label: 'Loại 7 - Thu nhập khác' },
    { value: 'EXPENSE_OTHER', label: 'Loại 8 - Chi phí khác' }
  ];

  accountNatures: { value: AccountNature; label: string }[] = [
    { value: 'DEBIT', label: 'Dư Nợ' },
    { value: 'CREDIT', label: 'Dư Có' },
    { value: 'BOTH', label: 'Dư Nợ hoặc Có' }
  ];

  constructor(private coaService: ChartOfAccountsService) { }

  ngOnInit(): void {
    this.loadAccounts();
    this.loadAccountGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadAccounts(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.coaService.getAccounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          this.applyFilter();
          this.isLoading = false;

          // Expand top-level accounts by default
          accounts.filter(a => a.level === 1).forEach(a => this.expandedCodes.add(a.code));
        },
        error: (err) => {
          console.error('Lỗi tải danh mục TK:', err);
          this.errorMessage = 'Lỗi tải danh mục tài khoản';
          this.isLoading = false;
        }
      });
  }

  loadAccountGroups(): void {
    this.coaService.getAccountGroups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (groups) => {
          this.accountGroups = groups;
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER & SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let filtered = [...this.accounts];

    // Search
    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(a =>
        a.code.includes(this.searchText) ||
        a.name.toLowerCase().includes(search) ||
        (a.nameEn && a.nameEn.toLowerCase().includes(search))
      );
    }

    // Type filter
    if (this.selectedType) {
      filtered = filtered.filter(a => a.type === this.selectedType);
    }

    // Status filter
    if (!this.showInactive) {
      filtered = filtered.filter(a => a.status === 'ACTIVE');
    }

    this.filteredAccounts = filtered;
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  onTypeChange(): void {
    this.applyFilter();
  }

  onShowInactiveChange(): void {
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedType = '';
    this.showInactive = false;
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TREE VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  getTopLevelAccounts(): Account[] {
    return this.filteredAccounts.filter(a => a.level === 1);
  }

  getChildAccounts(parentCode: string): Account[] {
    return this.filteredAccounts.filter(a =>
      a.parentCode === parentCode ||
      (a.code.startsWith(parentCode) && a.code.length === parentCode.length + 1)
    );
  }

  isExpanded(code: string): boolean {
    return this.expandedCodes.has(code);
  }

  toggleExpand(code: string): void {
    if (this.expandedCodes.has(code)) {
      this.expandedCodes.delete(code);
    } else {
      this.expandedCodes.add(code);
    }
  }

  expandAll(): void {
    this.accounts.forEach(a => {
      if (a.isParent) this.expandedCodes.add(a.code);
    });
  }

  collapseAll(): void {
    this.expandedCodes.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ═══════════════════════════════════════════════════════════════════════════

  setViewMode(mode: 'tree' | 'list' | 'group'): void {
    this.viewMode = mode;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  openAddModal(parentCode?: string): void {
    this.newAccount = {
      parentCode: parentCode,
      type: parentCode ? this.accounts.find(a => a.code === parentCode)?.type : 'ASSET_SHORT',
      nature: 'DEBIT',
      status: 'ACTIVE',
      isSystemAccount: false,
      isParent: false,
      isDetailRequired: false
    };
    this.formErrors = [];
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.newAccount = {};
    this.formErrors = [];
  }

  openEditModal(account: Account): void {
    if (account.isSystemAccount) {
      alert('Không thể sửa tài khoản hệ thống');
      return;
    }
    this.editAccount = { ...account };
    this.formErrors = [];
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editAccount = {};
    this.formErrors = [];
  }

  openDetailModal(account: Account): void {
    this.selectedAccount = account;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedAccount = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  validateNewAccount(): boolean {
    this.formErrors = [];

    if (!this.newAccount.code) {
      this.formErrors.push('Mã tài khoản là bắt buộc');
    } else if (!isValidAccountCode(this.newAccount.code)) {
      this.formErrors.push('Mã tài khoản không hợp lệ (chỉ chứa số, bắt đầu bằng 1-8)');
    }

    if (!this.newAccount.name) {
      this.formErrors.push('Tên tài khoản là bắt buộc');
    }

    if (this.newAccount.parentCode) {
      const parent = this.accounts.find(a => a.code === this.newAccount.parentCode);
      if (!parent) {
        this.formErrors.push('Tài khoản cha không tồn tại');
      } else if (!this.newAccount.code?.startsWith(this.newAccount.parentCode)) {
        this.formErrors.push('Mã TK con phải bắt đầu bằng mã TK cha');
      }
    }

    return this.formErrors.length === 0;
  }

  saveNewAccount(): void {
    if (!this.validateNewAccount()) return;

    this.coaService.isCodeExists(this.newAccount.code!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exists) => {
          if (exists) {
            this.formErrors.push('Mã tài khoản đã tồn tại');
            return;
          }

          const account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> = {
            code: this.newAccount.code!,
            name: this.newAccount.name!,
            nameEn: this.newAccount.nameEn,
            parentCode: this.newAccount.parentCode,
            type: this.newAccount.type!,
            nature: this.newAccount.nature!,
            level: getAccountLevel(this.newAccount.code!),
            isParent: false,
            isDetailRequired: this.newAccount.isDetailRequired || false,
            detailType: this.newAccount.detailType,
            description: this.newAccount.description,
            status: 'ACTIVE',
            isSystemAccount: false
          };

          this.coaService.addAccount(account)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.closeAddModal();
                this.loadAccounts();
                this.loadAccountGroups();
              },
              error: (err) => {
                this.formErrors.push(err.message || 'Lỗi thêm tài khoản');
              }
            });
        }
      });
  }

  saveEditAccount(): void {
    if (!this.editAccount.name) {
      this.formErrors = ['Tên tài khoản là bắt buộc'];
      return;
    }

    this.coaService.updateAccount(this.editAccount.code!, this.editAccount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeEditModal();
          this.loadAccounts();
        },
        error: (err) => {
          this.formErrors = [err.message || 'Lỗi cập nhật tài khoản'];
        }
      });
  }

  deleteAccount(account: Account): void {
    if (account.isSystemAccount) {
      alert('Không thể xóa tài khoản hệ thống');
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${account.code} - ${account.name}?`)) {
      return;
    }

    this.coaService.deleteAccount(account.code)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadAccounts();
          this.loadAccountGroups();
        },
        error: (err) => {
          alert(err.message || 'Lỗi xóa tài khoản');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  exportExcel(): void {
    this.coaService.exportExcel()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `He_thong_tai_khoan_${new Date().toISOString().slice(0, 10)}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  getTypeName(type: AccountType): string {
    return getAccountTypeName(type);
  }

  getNatureName(nature: AccountNature): string {
    return getAccountNatureName(nature);
  }

  getNatureClass(nature: AccountNature): string {
    switch (nature) {
      case 'DEBIT': return 'nature-debit';
      case 'CREDIT': return 'nature-credit';
      case 'BOTH': return 'nature-both';
      default: return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      case 'SYSTEM': return 'status-system';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Hoạt động';
      case 'INACTIVE': return 'Ngừng SD';
      case 'SYSTEM': return 'Hệ thống';
      default: return status;
    }
  }

  get totalAccounts(): number {
    return this.accounts.length;
  }

  get activeAccounts(): number {
    return this.accounts.filter(a => a.status === 'ACTIVE').length;
  }

  get leafAccounts(): number {
    return this.accounts.filter(a => !a.isParent).length;
  }
}
