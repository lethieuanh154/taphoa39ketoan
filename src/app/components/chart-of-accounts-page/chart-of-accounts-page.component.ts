import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, debounceTime, startWith, switchMap, takeUntil } from 'rxjs';
import { ChartOfAccountsService } from '../../services/chart-of-accounts.service';
import { httpErrorText } from '../../services/auth.service';
import {
  Account,
  AccountFilter,
  AccountGroup,
  AccountHistoryEntry,
  AccountType,
  AccountNature,
  AccountStatus,
  DetailType,
  getAccountTypeName,
  getAccountNatureName,
  getAccountTypeFromCode,
  isValidAccountCode,
  getParentCode
} from '../../models/chart-of-accounts.models';

const LOG = '[ChartOfAccountsPage]';

/**
 * HỆ THỐNG TÀI KHOẢN KẾ TOÁN - CHART OF ACCOUNTS
 *
 * Theo Thông tư 133/2016/TT-BTC. Dữ liệu ở ledger-rs (`/api/ledger/accounts*`); ràng buộc do BE kiểm,
 * trang chỉ hiển thị đúng lý do BE trả về (401 ≠ 403 ≠ 409/422 ≠ mất kết nối).
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
  private filterChange$ = new Subject<void>();

  // === DATA STATE ===
  accounts: Account[] = [];              // toàn bộ danh mục (thống kê, chọn TK cha)
  accountGroups: AccountGroup[] = [];
  filteredAccounts: Account[] = [];      // kết quả lọc từ BE

  // === FILTER STATE ===
  filter: AccountFilter = {};
  searchText: string = '';
  selectedType: AccountType | '' = '';
  statusFilter: AccountStatus | '' = '';   // '' = tất cả (TK ngừng dùng vẫn hiển thị — R4)
  onlyPostable: boolean = false;

  // === UI STATE ===
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  viewMode: 'tree' | 'list' | 'group' = 'tree';
  expandedCodes: Set<string> = new Set();

  // === MODAL STATE ===
  showAddModal: boolean = false;
  showEditModal: boolean = false;
  showDetailModal: boolean = false;
  selectedAccount: Account | null = null;
  parentFixed: boolean = false;          // mở "Thêm TK con" từ 1 dòng → không đổi TK cha

  // === HISTORY STATE ===
  history: AccountHistoryEntry[] | null = null;
  historyLoading: boolean = false;
  historyError: string = '';

  // === FORM STATE ===
  newAccount: Partial<Account> = {};
  editAccount: Partial<Account> = {};
  formErrors: string[] = [];
  saving: boolean = false;

  // === OPTIONS ===
  accountTypes: { value: AccountType; label: string }[] = [
    { value: 'ASSET_SHORT', label: 'Loại 1 - Tài sản ngắn hạn' },
    { value: 'ASSET_LONG', label: 'Loại 2 - Tài sản dài hạn' },
    { value: 'LIABILITY', label: 'Loại 3 - Nợ phải trả' },
    { value: 'EQUITY', label: 'Loại 4 - Vốn chủ sở hữu' },
    { value: 'REVENUE', label: 'Loại 5 - Doanh thu' },
    { value: 'EXPENSE_PROD', label: 'Loại 6 - Chi phí SXKD' },
    { value: 'INCOME_OTHER', label: 'Loại 7 - Thu nhập khác' },
    { value: 'EXPENSE_OTHER', label: 'Loại 8 - Chi phí khác' },
    { value: 'RESULT', label: 'Loại 9 - Xác định KQKD' }
  ];

  accountNatures: { value: AccountNature; label: string }[] = [
    { value: 'DEBIT', label: 'Dư Nợ' },
    { value: 'CREDIT', label: 'Dư Có' },
    { value: 'BOTH', label: 'Dư Nợ hoặc Có' },
    { value: 'NONE', label: 'Không có số dư' }
  ];

  detailTypes: { value: DetailType; label: string }[] = [
    { value: 'NONE', label: 'Không theo dõi' },
    { value: 'CUSTOMER', label: 'Khách hàng' },
    { value: 'SUPPLIER', label: 'Nhà cung cấp' },
    { value: 'EMPLOYEE', label: 'Nhân viên' },
    { value: 'BANK', label: 'Ngân hàng' },
    { value: 'INVENTORY', label: 'Vật tư hàng hóa' },
    { value: 'FIXED_ASSET', label: 'TSCĐ' },
    { value: 'CONTRACT', label: 'Hợp đồng' },
    { value: 'PROJECT', label: 'Công trình' },
    { value: 'DEPARTMENT', label: 'Bộ phận' }
  ];

  private fieldLabels: Record<string, string> = {
    name: 'Tên', note: 'Ghi chú', nature: 'Tính chất', detail_type: 'Đối tượng', status: 'Trạng thái'
  };

  constructor(private coaService: ChartOfAccountsService) { }

  ngOnInit(): void {
    // Tìm kiếm + lọc gọi BE (R12); gõ liên tục chỉ gửi request cuối
    this.filterChange$.pipe(
      startWith(undefined),
      debounceTime(300),
      switchMap(() => {
        const filter = this.buildFilter();
        this.isLoading = true;
        return this.coaService.getAccounts(filter).pipe(
          catchError(err => {
            this.isLoading = false;
            this.errorMessage = `Không tải được danh mục tài khoản: ${this.reasonText(err)}`;
            console.warn(`${LOG} lọc TK lỗi — ${httpErrorText(err)}`, filter);
            return EMPTY;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(accounts => {
      this.filteredAccounts = accounts;
      this.isLoading = false;
      if (this.hasFilter) {
        accounts.filter(a => a.isParent).forEach(a => this.expandedCodes.add(a.code));
      }
      console.info(`${LOG} hiển thị ${accounts.length} TK`, this.filter);
    });
    this.loadAccounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Toàn bộ danh mục (thống kê, nhóm, chọn TK cha) + làm mới danh sách đang lọc */
  loadAccounts(): void {
    this.errorMessage = '';
    this.coaService.getAccounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (accounts) => {
          const first = this.accounts.length === 0;
          this.accounts = accounts;
          if (first) {
            accounts.filter(a => a.level === 1).forEach(a => this.expandedCodes.add(a.code));
          }
          console.info(`${LOG} tải ${accounts.length} TK`);
        },
        error: (err) => {
          console.warn(`${LOG} tải danh mục lỗi — ${httpErrorText(err)}`);
          this.errorMessage = `Không tải được danh mục tài khoản: ${this.reasonText(err)}`;
        }
      });
    this.loadAccountGroups();
    this.filterChange$.next();
  }

  loadAccountGroups(): void {
    this.coaService.getAccountGroups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (groups) => {
          this.accountGroups = groups;
        },
        error: (err) => {
          console.warn(`${LOG} tải nhóm TK lỗi — ${httpErrorText(err)}`);
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER & SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  private buildFilter(): AccountFilter {
    this.filter = {
      search: this.searchText.trim() || undefined,
      type: this.selectedType || undefined,
      status: this.statusFilter || undefined,
      postable: this.onlyPostable || undefined
    };
    return this.filter;
  }

  get hasFilter(): boolean {
    return !!(this.searchText.trim() || this.selectedType || this.statusFilter || this.onlyPostable);
  }

  applyFilter(): void {
    this.filterChange$.next();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  onTypeChange(): void {
    this.applyFilter();
  }

  onStatusChange(): void {
    this.applyFilter();
  }

  onPostableChange(): void {
    this.applyFilter();
  }

  clearSearch(): void {
    this.searchText = '';
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedType = '';
    this.statusFilter = '';
    this.onlyPostable = false;
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TREE VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  /** Gốc cây = TK không có TK cha trong kết quả lọc (khi tìm "1121" vẫn hiện dù 112 không khớp) */
  getTopLevelAccounts(): Account[] {
    const codes = new Set(this.filteredAccounts.map(a => a.code));
    return this.filteredAccounts.filter(a => !a.parentCode || !codes.has(a.parentCode));
  }

  getChildAccounts(parentCode: string): Account[] {
    return this.filteredAccounts.filter(a => a.parentCode === parentCode);
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

  /** TK cha chọn được: cấp 1–3 đang dùng (TK con tối đa cấp 4 — R6) */
  get parentOptions(): Account[] {
    return this.accounts.filter(a => a.level <= 3 && a.status === 'ACTIVE');
  }

  canAddChild(account: Account): boolean {
    return account.level <= 3 && account.status === 'ACTIVE';
  }

  openAddModal(parentCode?: string): void {
    this.parentFixed = !!parentCode;
    // nature / detailType để trống → BE lấy theo TK cha (R6)
    this.newAccount = { parentCode, code: parentCode ?? '' };
    this.formErrors = [];
    this.showAddModal = true;
  }

  onNewParentChange(): void {
    const p = this.newAccount.parentCode;
    if (p && !(this.newAccount.code ?? '').startsWith(p)) {
      this.newAccount.code = p;
    }
  }

  get newAccountTypeName(): string {
    const code = this.newAccount.code ?? '';
    return /^[1-9]/.test(code) ? getAccountTypeName(getAccountTypeFromCode(code)) : '-';
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.newAccount = {};
    this.formErrors = [];
  }

  /** TK hệ thống vẫn sửa được tên, ghi chú, tính chất, đối tượng, trạng thái; mã và TK cha luôn khóa (R7) */
  openEditModal(account: Account): void {
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
    this.history = null;
    this.historyError = '';
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedAccount = null;
    this.history = null;
  }

  editFromDetail(): void {
    const account = this.selectedAccount;
    this.closeDetailModal();
    if (account) this.openEditModal(account);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY (R8)
  // ═══════════════════════════════════════════════════════════════════════════

  loadHistory(): void {
    const code = this.selectedAccount?.code;
    if (!code) return;
    this.historyLoading = true;
    this.historyError = '';
    this.coaService.getHistory(code)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.history = rows;
          this.historyLoading = false;
          console.info(`${LOG} lịch sử ${code}: ${rows.length} dòng`);
        },
        error: (err) => {
          this.historyLoading = false;
          this.historyError = this.reasonText(err);
          console.warn(`${LOG} lịch sử ${code} lỗi — ${httpErrorText(err)}`);
        }
      });
  }

  getActionLabel(action: AccountHistoryEntry['action']): string {
    switch (action) {
      case 'INSERT': return 'Thêm';
      case 'UPDATE': return 'Sửa';
      case 'DELETE': return 'Xóa';
      default: return action;
    }
  }

  getFieldLabel(field: string): string {
    return this.fieldLabels[field] ?? field;
  }

  formatValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '(trống)';
    const v = String(value);
    if (field === 'nature') return getAccountNatureName(v as AccountNature) ?? v;
    if (field === 'detail_type') return this.detailTypes.find(d => d.value === v)?.label ?? v;
    if (field === 'status') return this.getStatusLabel(v);
    return v;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  validateNewAccount(): boolean {
    this.formErrors = [];
    const code = (this.newAccount.code ?? '').trim();
    const parentCode = this.newAccount.parentCode;

    if (!code) {
      this.formErrors.push('Mã tài khoản là bắt buộc');
    } else if (!isValidAccountCode(code)) {
      this.formErrors.push('Mã tài khoản không hợp lệ (3–6 chữ số, bắt đầu bằng 1–9)');
    } else if (parentCode) {
      if (!code.startsWith(parentCode) || code.length !== parentCode.length + 1) {
        this.formErrors.push(`Mã TK con phải là mã TK cha ${parentCode} thêm đúng 1 chữ số`);
      }
    } else if (code.length !== 3) {
      this.formErrors.push(`TK cấp 1 phải có 3 chữ số — chọn TK cha ${getParentCode(code) ?? ''} nếu là TK con`);
    }

    if (!this.newAccount.name?.trim()) {
      this.formErrors.push('Tên tài khoản là bắt buộc');
    }
    if (!parentCode && !this.newAccount.nature) {
      this.formErrors.push('TK cấp 1 phải chọn tính chất số dư');
    }

    if (this.formErrors.length) {
      console.warn(`${LOG} thêm TK ${code}: form chưa hợp lệ — ${this.formErrors.join('; ')}`);
    }
    return this.formErrors.length === 0;
  }

  saveNewAccount(): void {
    if (this.saving || !this.validateNewAccount()) return;
    const code = this.newAccount.code!.trim();
    this.saving = true;

    this.coaService.addAccount({
      code,
      name: this.newAccount.name!.trim(),
      parentCode: this.newAccount.parentCode,
      nature: this.newAccount.nature,
      detailType: this.newAccount.detailType,
      note: this.newAccount.note
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (acc) => {
          this.saving = false;
          console.info(`${LOG} đã thêm TK ${acc.code}`);
          this.closeAddModal();
          this.showSuccess(`Đã thêm TK ${acc.code} - ${acc.name}`);
          if (acc.parentCode) this.expandedCodes.add(acc.parentCode);
          this.loadAccounts();
        },
        error: (err) => {
          this.saving = false;
          console.warn(`${LOG} thêm TK ${code} bị từ chối — ${httpErrorText(err)}`);
          this.formErrors = [this.reasonText(err)];
        }
      });
  }

  saveEditAccount(): void {
    if (this.saving) return;
    if (!this.editAccount.name?.trim()) {
      this.formErrors = ['Tên tài khoản là bắt buộc'];
      console.warn(`${LOG} sửa TK ${this.editAccount.code}: thiếu tên`);
      return;
    }
    const code = this.editAccount.code!;
    this.saving = true;

    this.coaService.updateAccount(code, {
      name: this.editAccount.name.trim(),
      note: this.editAccount.note ?? '',
      nature: this.editAccount.nature,
      detailType: this.editAccount.detailType,
      status: this.editAccount.status
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          console.info(`${LOG} đã sửa TK ${code}`);
          this.closeEditModal();
          this.showSuccess(`Đã lưu TK ${code}`);
          this.loadAccounts();
        },
        error: (err) => {
          this.saving = false;
          console.warn(`${LOG} sửa TK ${code} bị từ chối — ${httpErrorText(err)}`);
          this.formErrors = [this.reasonText(err)];
        }
      });
  }

  /** Xóa hẳn — chỉ TK tự mở, chưa phát sinh, không còn TK con (BE kiểm). Ngừng dùng = sửa trạng thái. */
  deleteAccount(account: Account): void {
    if (!confirm(`Xóa hẳn tài khoản ${account.code} - ${account.name}?\n` +
      'Muốn giữ lại nhưng không cho hạch toán nữa thì dùng "Sửa" → Trạng thái "Ngừng dùng".')) {
      return;
    }

    this.coaService.deleteAccount(account.code)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.info(`${LOG} đã xóa TK ${account.code}`);
          this.showSuccess(`Đã xóa TK ${account.code}`);
          this.loadAccounts();
        },
        error: (err) => {
          console.warn(`${LOG} xóa TK ${account.code} bị từ chối — ${httpErrorText(err)}`);
          this.errorMessage = `Không xóa được TK ${account.code}: ${this.reasonText(err)}`;
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
          a.download = `He_thong_tai_khoan_${new Date().toLocaleDateString('sv-SE')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
          console.info(`${LOG} đã tải file Excel (${blob.size} byte)`);
        },
        error: (err) => {
          console.warn(`${LOG} xuất Excel lỗi — ${httpErrorText(err)}`);
          this.errorMessage = `Không xuất được Excel: ${this.reasonText(err)}`;
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Lý do cho người dùng — tách 401 / 403 / mất kết nối / lỗi hệ thống; 4xx khác giữ nguyên message BE */
  reasonText(err: unknown): string {
    const e = err as HttpErrorResponse;
    const detail: string = e?.error?.detail || '';
    switch (true) {
      case e?.status === 0:
        return 'Không kết nối được máy chủ sổ cái (ledger-rs) — kiểm tra mạng hoặc server';
      case e?.status === 401:
        return `Phiên đăng nhập hết hạn hoặc chưa đăng nhập — tải lại trang / đăng nhập lại${detail ? ` (${detail})` : ''}`;
      case e?.status === 403:
        return `Email này không có quyền dùng Kế toán chi tiết${detail ? ` (${detail})` : ''}`;
      case e?.status >= 500:
        return 'Lỗi hệ thống ở máy chủ sổ cái, thử lại sau';
      default:
        return detail || httpErrorText(err);
    }
  }

  dismissError(): void {
    this.errorMessage = '';
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => {
      if (this.successMessage === msg) this.successMessage = '';
    }, 4000);
  }

  getTypeName(type: AccountType): string {
    return getAccountTypeName(type);
  }

  getNatureName(nature: AccountNature): string {
    return getAccountNatureName(nature);
  }

  getDetailTypeName(detailType?: DetailType): string {
    return this.detailTypes.find(d => d.value === (detailType ?? 'NONE'))?.label ?? '-';
  }

  getNatureClass(nature: AccountNature): string {
    switch (nature) {
      case 'DEBIT': return 'nature-debit';
      case 'CREDIT': return 'nature-credit';
      case 'BOTH': return 'nature-both';
      case 'NONE': return 'nature-none';
      default: return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Đang dùng';
      case 'INACTIVE': return 'Ngừng dùng';
      default: return status;
    }
  }

  get totalAccounts(): number {
    return this.accounts.length;
  }

  get activeAccounts(): number {
    return this.accounts.filter(a => a.status === 'ACTIVE').length;
  }

  get postableAccounts(): number {
    return this.accounts.filter(a => a.postable).length;
  }
}
