import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { BalanceSheetService } from '../../services/balance-sheet.service';
import {
  BalanceSheetReport,
  BalanceSheetSection,
  BalanceSheetRow,
  BalanceSheetFilter,
  BalanceSheetValidation
} from '../../models/balance-sheet.models';

/**
 * BẢNG CÂN ĐỐI KẾ TOÁN - BALANCE SHEET
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Báo cáo tài chính quan trọng nhất
 * - TỔNG TÀI SẢN = TỔNG NGUỒN VỐN
 * - Theo mẫu B01-DNN (Thông tư 99/2025/TT-BTC)
 *
 * NGUYÊN TẮC:
 * - READ-ONLY tuyệt đối
 * - Dữ liệu 100% từ Bảng cân đối tài khoản
 * - Chỉ lập khi TB cân đối & kỳ đã khóa
 */
@Component({
  selector: 'app-balance-sheet-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './balance-sheet-page.component.html',
  styleUrl: './balance-sheet-page.component.css'
})
export class BalanceSheetPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: BalanceSheetFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    showPreviousPeriod: false
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
  report: BalanceSheetReport | null = null;
  validation: BalanceSheetValidation | null = null;

  // === UI STATE ===
  isLoading: boolean = false;
  canGenerate: boolean = false;
  cannotGenerateReasons: string[] = [];
  errorMessage: string = '';

  constructor(private balanceSheetService: BalanceSheetService) {
    this.initYears();
  }

  ngOnInit(): void {
    this.checkCanGenerate();
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

  checkCanGenerate(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.balanceSheetService.canGenerateBalanceSheet(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.canGenerate = result.canGenerate;
          this.cannotGenerateReasons = result.reasons;
          this.isLoading = false;

          // Auto-generate if can
          if (this.canGenerate) {
            this.generateReport();
          } else {
            this.report = null;
          }
        },
        error: (err) => {
          console.error('Lỗi kiểm tra điều kiện lập BCĐKT:', err);
          this.isLoading = false;
          this.errorMessage = 'Lỗi kiểm tra điều kiện lập báo cáo';
        }
      });
  }

  generateReport(): void {
    if (!this.canGenerate) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.balanceSheetService.generateBalanceSheet(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.validation = report.validation;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tạo BCĐKT:', err);
          this.isLoading = false;
          this.errorMessage = err.message || 'Lỗi tạo bảng cân đối kế toán';
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
    this.checkCanGenerate();
  }

  onFilterChange(): void {
    this.checkCanGenerate();
  }

  // === EXPORT ===

  exportExcel(): void {
    this.balanceSheetService.exportExcel(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `BCDKT_${this.report?.period.label.replace(/\//g, '-')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  exportPDF(): void {
    this.balanceSheetService.exportPDF(this.filter)
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

  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === 0) return '-';
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

  getRowClass(row: BalanceSheetRow): string {
    const classes: string[] = [];
    if (row.level === 0) classes.push('level-0', 'total-row');
    if (row.level === 1) classes.push('level-1', 'group-row');
    if (row.level === 2) classes.push('level-2');
    if (row.level === 3) classes.push('level-3');
    if (row.isNegative) classes.push('negative');
    if (row.isTotal) classes.push('total-row');
    return classes.join(' ');
  }

  getAmountClass(amount: number): string {
    if (amount < 0) return 'negative-amount';
    if (amount === 0) return 'zero-amount';
    return '';
  }

  // === COMPUTED GETTERS ===

  get isBalanced(): boolean {
    return this.validation?.isBalanced ?? false;
  }

  get difference(): number {
    return this.validation?.difference ?? 0;
  }

  get canSubmit(): boolean {
    return this.validation?.canSubmit ?? false;
  }

  get validationErrors(): string[] {
    return this.validation?.errors ?? [];
  }

  get validationWarnings(): string[] {
    return this.validation?.warnings ?? [];
  }

  get periodLabel(): string {
    return this.report?.period.label ?? '';
  }

  get isPeriodLocked(): boolean {
    return this.report?.period.isLocked ?? false;
  }

  get generatedAt(): string {
    return this.report?.generatedAt ?? '';
  }

  // === SECTION GETTERS ===

  get shortTermAssets(): BalanceSheetSection | null {
    return this.report?.assets.shortTerm ?? null;
  }

  get longTermAssets(): BalanceSheetSection | null {
    return this.report?.assets.longTerm ?? null;
  }

  get totalAssets(): number {
    return this.report?.assets.total ?? 0;
  }

  get liabilities(): BalanceSheetSection | null {
    return this.report?.liabilitiesAndEquity.liabilities ?? null;
  }

  get equity(): BalanceSheetSection | null {
    return this.report?.liabilitiesAndEquity.equity ?? null;
  }

  get totalLiabilitiesAndEquity(): number {
    return this.report?.liabilitiesAndEquity.total ?? 0;
  }
}
