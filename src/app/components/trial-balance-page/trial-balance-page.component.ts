import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TrialBalanceService } from '../../services/trial-balance.service';
import {
  TrialBalanceRow,
  TrialBalanceFilter,
  BalanceCheckResult,
  BalanceStatus,
  getBalanceStatus,
  BALANCE_STATUS_LABELS,
  BALANCE_STATUS_COLORS
} from '../../models/trial-balance.models';
import { ACCOUNT_TYPE_LABELS } from '../../models/ledger.models';

/**
 * BẢNG CÂN ĐỐI TÀI KHOẢN - TRIAL BALANCE
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Tổng hợp số dư tất cả TK trong kỳ
 * - Kiểm tra: Tổng Nợ = Tổng Có
 * - Là checkpoint bắt buộc trước khi lập BCTC
 *
 * NGUYÊN TẮC:
 * - READ-ONLY tuyệt đối
 * - Dữ liệu 100% tự động từ Sổ cái
 * - Không cho lập BCTC nếu lệch cân đối
 */
@Component({
  selector: 'app-trial-balance-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trial-balance-page.component.html',
  styleUrl: './trial-balance-page.component.css'
})
export class TrialBalancePageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: TrialBalanceFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    includeZeroBalance: false,
    includeSubAccounts: false
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
  rows: TrialBalanceRow[] = [];
  balanceCheck: BalanceCheckResult | null = null;

  // === PERIOD STATE ===
  periodFrom: string = '';
  periodTo: string = '';
  periodLabel: string = '';
  isPeriodLocked: boolean = false;
  generatedAt: string = '';

  // === UI STATE ===
  isLoading: boolean = false;
  balanceStatus: BalanceStatus = 'BALANCED';

  // === SORT STATE ===
  sortColumn: string = 'accountCode';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private trialBalanceService: TrialBalanceService,
    private router: Router
  ) {
    this.initYears();
  }

  ngOnInit(): void {
    this.loadData();
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

  loadData(): void {
    this.isLoading = true;

    this.trialBalanceService.getTrialBalance(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rows = response.rows;
          this.balanceCheck = response.balanceCheck;
          this.periodFrom = response.period.from;
          this.periodTo = response.period.to;
          this.periodLabel = response.period.label;
          this.isPeriodLocked = response.period.isLocked;
          this.generatedAt = response.generatedAt;
          this.balanceStatus = getBalanceStatus(response.balanceCheck);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tải bảng cân đối tài khoản:', err);
          this.isLoading = false;
        }
      });
  }

  // === FILTER HANDLERS ===

  onPeriodTypeChange(): void {
    if (this.filter.periodType === 'month') {
      this.filter.month = new Date().getMonth() + 1;
      this.filter.quarter = undefined;
    } else if (this.filter.periodType === 'quarter') {
      this.filter.quarter = Math.ceil((new Date().getMonth() + 1) / 3);
      this.filter.month = undefined;
    } else if (this.filter.periodType === 'year') {
      this.filter.month = undefined;
      this.filter.quarter = undefined;
    }
    this.loadData();
  }

  onFilterChange(): void {
    this.loadData();
  }

  // === SORTING ===

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.rows.sort((a: any, b: any) => {
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

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // === DRILL-DOWN ===

  onRowClick(row: TrialBalanceRow): void {
    // Navigate to Sổ cái theo TK
    this.router.navigate(['/accountant/so-tong-hop/so-cai'], {
      queryParams: { account: row.accountCode }
    });
  }

  // === EXPORT ===

  exportExcel(): void {
    this.trialBalanceService.exportExcel(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `BangCanDoiTK_${this.periodLabel.replace(/\//g, '-')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  exportPDF(): void {
    this.trialBalanceService.exportPDF(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        },
        error: () => {
          alert('Lỗi in PDF. Vui lòng thử lại.');
        }
      });
  }

  // === HELPERS ===

  formatCurrency(value: number): string {
    if (value === 0) return '-';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('vi-VN');
  }

  getTypeLabel(type: string): string {
    return ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS] || type;
  }

  getStatusLabel(status: BalanceStatus): string {
    return BALANCE_STATUS_LABELS[status];
  }

  getStatusColor(status: BalanceStatus): string {
    return BALANCE_STATUS_COLORS[status];
  }

  getRowClass(row: TrialBalanceRow): string {
    const classes: string[] = [];
    if (row.level === 2) classes.push('level-2');
    if (row.level === 3) classes.push('level-3');
    if (row.isAbnormal) classes.push('abnormal');
    return classes.join(' ');
  }

  // === COMPUTED GETTERS ===

  get isBalanced(): boolean {
    return this.balanceCheck?.isFullyBalanced ?? false;
  }

  get canGenerateReport(): boolean {
    return this.balanceCheck?.canGenerateReport ?? false;
  }

  get abnormalCount(): number {
    return this.rows.filter(r => r.isAbnormal).length;
  }

  get totalAccounts(): number {
    return this.rows.filter(r => r.level === 1).length;
  }
}
