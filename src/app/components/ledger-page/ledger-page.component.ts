import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import {
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  GeneralLedgerFilter,
  GeneralLedgerSummary,
  GeneralLedgerVoucherDetail,
  GeneralLedgerSourceType,
  GENERAL_LEDGER_SOURCE_LABELS,
  GENERAL_LEDGER_SOURCE_COLORS,
  ACCOUNT_NATURE_LABELS,
  ACCOUNT_TYPE_LABELS
} from '../../models/ledger.models';

/**
 * SỔ CÁI THEO TÀI KHOẢN - GENERAL LEDGER BY ACCOUNT
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Tập hợp & phân loại nghiệp vụ theo TÀI KHOẢN
 * - Mỗi TK có: Số dư đầu kỳ + Phát sinh Nợ/Có = Số dư cuối kỳ
 * - Dữ liệu TỰ ĐỘNG từ Sổ nhật ký chung, KHÔNG nhập tay
 * - Nguồn để lập Bảng cân đối TK và BCTC
 *
 * NGUYÊN TẮC:
 * - Tổng phát sinh Nợ = Tổng phát sinh Có (kiểm tra cân đối)
 * - Chỉ READ-ONLY, không thêm/sửa/xóa trực tiếp
 * - Hỗ trợ drill-down về chứng từ gốc
 */
@Component({
  selector: 'app-ledger-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ledger-page.component.html',
  styleUrl: './ledger-page.component.css'
})
export class LedgerPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: GeneralLedgerFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    showZeroBalance: false
  };

  months = [
    { value: 1, label: 'Tháng 1' },
    { value: 2, label: 'Tháng 2' },
    { value: 3, label: 'Tháng 3' },
    { value: 4, label: 'Tháng 4' },
    { value: 5, label: 'Tháng 5' },
    { value: 6, label: 'Tháng 6' },
    { value: 7, label: 'Tháng 7' },
    { value: 8, label: 'Tháng 8' },
    { value: 9, label: 'Tháng 9' },
    { value: 10, label: 'Tháng 10' },
    { value: 11, label: 'Tháng 11' },
    { value: 12, label: 'Tháng 12' }
  ];

  quarters = [
    { value: 1, label: 'Quý I' },
    { value: 2, label: 'Quý II' },
    { value: 3, label: 'Quý III' },
    { value: 4, label: 'Quý IV' }
  ];

  years: number[] = [];

  // === DATA STATE ===
  accounts: GeneralLedgerAccount[] = [];
  selectedAccount: GeneralLedgerAccount | null = null;
  accountEntries: GeneralLedgerEntry[] = [];
  summary: GeneralLedgerSummary = {
    totalAccounts: 0,
    totalDebit: 0,
    totalCredit: 0,
    isBalanced: true,
    difference: 0,
    abnormalAccounts: 0,
    zeroBalanceAccounts: 0
  };

  // === PERIOD STATE ===
  periodFrom: string = '';
  periodTo: string = '';
  periodLabel: string = '';
  isPeriodLocked: boolean = false;

  // === UI STATE ===
  isLoading: boolean = false;
  isLoadingDetail: boolean = false;
  showDetailDrawer: boolean = false;
  voucherDetail: GeneralLedgerVoucherDetail | null = null;
  selectedEntry: GeneralLedgerEntry | null = null;

  // === SORT STATE ===
  sortColumn: string = 'accountCode';
  sortDirection: 'asc' | 'desc' = 'asc';
  detailSortColumn: string = 'date';
  detailSortDirection: 'asc' | 'desc' = 'asc';

  constructor(private ledgerService: GeneralLedgerService) {
    this.initYears();
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === INITIALIZATION ===

  private initYears(): void {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
      this.years.push(y);
    }
  }

  // === DATA LOADING ===

  loadAccounts(): void {
    this.isLoading = true;
    this.selectedAccount = null;
    this.accountEntries = [];

    this.ledgerService.getAccounts(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.accounts = response.accounts;
          this.summary = response.summary;
          this.periodFrom = response.period.from;
          this.periodTo = response.period.to;
          this.periodLabel = response.period.label;
          this.isPeriodLocked = response.period.isLocked;
          this.isLoading = false;

          // Tự động chọn TK đầu tiên nếu có
          if (this.accounts.length > 0) {
            this.selectAccount(this.accounts[0]);
          }
        },
        error: (err) => {
          console.error('Lỗi tải danh sách tài khoản:', err);
          this.isLoading = false;
        }
      });
  }

  selectAccount(account: GeneralLedgerAccount): void {
    this.selectedAccount = account;
    this.loadAccountDetail(account.accountCode);
  }

  private loadAccountDetail(accountCode: string): void {
    this.isLoadingDetail = true;

    this.ledgerService.getLedgerByAccount(accountCode, this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.accountEntries = response.entries;
          this.isLoadingDetail = false;
        },
        error: (err) => {
          console.error('Lỗi tải chi tiết sổ cái:', err);
          this.isLoadingDetail = false;
        }
      });
  }

  // === FILTER HANDLERS ===

  onPeriodTypeChange(): void {
    if (this.filter.periodType === 'month') {
      this.filter.month = new Date().getMonth() + 1;
      this.filter.quarter = undefined;
      this.filter.fromDate = undefined;
      this.filter.toDate = undefined;
    } else if (this.filter.periodType === 'quarter') {
      this.filter.quarter = Math.ceil((new Date().getMonth() + 1) / 3);
      this.filter.month = undefined;
      this.filter.fromDate = undefined;
      this.filter.toDate = undefined;
    } else if (this.filter.periodType === 'year') {
      this.filter.month = undefined;
      this.filter.quarter = undefined;
      this.filter.fromDate = undefined;
      this.filter.toDate = undefined;
    }
    this.loadAccounts();
  }

  onFilterChange(): void {
    this.loadAccounts();
  }

  // === SORTING - MASTER LIST ===

  sortAccountsBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.accounts.sort((a: any, b: any) => {
      let valA = a[column];
      let valB = b[column];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getAccountSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // === SORTING - DETAIL LIST ===

  sortEntriesBy(column: string): void {
    if (this.detailSortColumn === column) {
      this.detailSortDirection = this.detailSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.detailSortColumn = column;
      this.detailSortDirection = 'asc';
    }

    this.accountEntries.sort((a: any, b: any) => {
      let valA = a[column];
      let valB = b[column];

      if (column === 'date' || column === 'voucherDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return this.detailSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.detailSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getEntrySortIcon(column: string): string {
    if (this.detailSortColumn !== column) return 'fa-sort';
    return this.detailSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // === DRILL-DOWN ===

  onEntryClick(entry: GeneralLedgerEntry): void {
    this.selectedEntry = entry;
    this.showDetailDrawer = true;
    this.loadVoucherDetail(entry);
  }

  private loadVoucherDetail(entry: GeneralLedgerEntry): void {
    this.ledgerService.getVoucherDetail(entry.sourceType, entry.sourceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.voucherDetail = detail;
        },
        error: (err) => {
          console.error('Lỗi tải chi tiết chứng từ:', err);
        }
      });
  }

  closeDetailDrawer(): void {
    this.showDetailDrawer = false;
    this.selectedEntry = null;
    this.voucherDetail = null;
  }

  // === EXPORT ===

  exportExcel(): void {
    if (!this.selectedAccount) {
      alert('Vui lòng chọn tài khoản để xuất');
      return;
    }

    this.ledgerService.exportExcel(this.selectedAccount.accountCode, this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SoCai_${this.selectedAccount!.accountCode}_${this.periodLabel.replace(/\//g, '-')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  exportPDF(): void {
    if (!this.selectedAccount) {
      alert('Vui lòng chọn tài khoản để in');
      return;
    }

    this.ledgerService.exportPDF(this.selectedAccount.accountCode, this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        },
        error: (err) => {
          alert('Lỗi in PDF. Vui lòng thử lại.');
        }
      });
  }

  exportAllExcel(): void {
    // Xuất tất cả TK
    alert('Chức năng xuất toàn bộ sổ cái đang phát triển');
  }

  // === HELPERS ===

  formatCurrency(value: number): string {
    if (value === 0) return '-';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  getSourceLabel(type: GeneralLedgerSourceType): string {
    return GENERAL_LEDGER_SOURCE_LABELS[type] || type;
  }

  getSourceColor(type: GeneralLedgerSourceType): string {
    return GENERAL_LEDGER_SOURCE_COLORS[type] || '#6b7280';
  }

  getNatureLabel(nature: string): string {
    return ACCOUNT_NATURE_LABELS[nature as keyof typeof ACCOUNT_NATURE_LABELS] || nature;
  }

  getTypeLabel(type: string): string {
    return ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS] || type;
  }

  getBalanceStatusClass(status: string): string {
    switch (status) {
      case 'NORMAL': return 'status-normal';
      case 'ABNORMAL': return 'status-abnormal';
      case 'ZERO': return 'status-zero';
      default: return '';
    }
  }

  getBalanceStatusIcon(status: string): string {
    switch (status) {
      case 'NORMAL': return 'fa-check-circle';
      case 'ABNORMAL': return 'fa-exclamation-triangle';
      case 'ZERO': return 'fa-minus-circle';
      default: return '';
    }
  }

  getBalanceStatusLabel(status: string): string {
    switch (status) {
      case 'NORMAL': return 'Hợp lệ';
      case 'ABNORMAL': return 'Bất thường';
      case 'ZERO': return 'Không PS';
      default: return '';
    }
  }

  // Tính tổng phát sinh chi tiết
  get totalDetailDebit(): number {
    return this.accountEntries.reduce((sum, e) => sum + e.debit, 0);
  }

  get totalDetailCredit(): number {
    return this.accountEntries.reduce((sum, e) => sum + e.credit, 0);
  }

  // Tính số dư cuối kỳ từ chi tiết
  get closingBalance(): { debit: number; credit: number } {
    if (!this.selectedAccount) return { debit: 0, credit: 0 };

    const netOpening = this.selectedAccount.openingDebit - this.selectedAccount.openingCredit;
    const netMovement = this.totalDetailDebit - this.totalDetailCredit;
    const netClosing = netOpening + netMovement;

    if (netClosing >= 0) {
      return { debit: netClosing, credit: 0 };
    } else {
      return { debit: 0, credit: Math.abs(netClosing) };
    }
  }

  // Check có cảnh báo bất thường không
  get hasAbnormalWarning(): boolean {
    return this.summary.abnormalAccounts > 0;
  }

  // Check sổ cái có cân đối không
  get isLedgerBalanced(): boolean {
    return this.summary.isBalanced;
  }
}
