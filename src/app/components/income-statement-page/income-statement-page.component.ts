import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { IncomeStatementService } from '../../services/income-statement.service';
import {
  IncomeStatementReport,
  IncomeStatementRow,
  IncomeStatementFilter,
  IncomeStatementValidation,
  HIGHLIGHT_ROW_CODES
} from '../../models/income-statement.models';

/**
 * BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH - INCOME STATEMENT
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Báo cáo lãi/lỗ trong kỳ
 * - LỢI NHUẬN = DOANH THU - CHI PHÍ
 * - Theo mẫu B02-DNN (Thông tư 133/2016)
 *
 * NGUYÊN TẮC:
 * - READ-ONLY tuyệt đối
 * - Dữ liệu 100% từ Sổ cái (phát sinh trong kỳ)
 * - Chỉ lập khi kỳ đã khóa sổ
 */
@Component({
  selector: 'app-income-statement-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './income-statement-page.component.html',
  styleUrl: './income-statement-page.component.css'
})
export class IncomeStatementPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: IncomeStatementFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    compareType: 'previous_period'
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

  compareTypes = [
    { value: 'previous_period', label: 'Kỳ trước' },
    { value: 'same_period_last_year', label: 'Cùng kỳ năm trước' },
    { value: 'ytd', label: 'Lũy kế từ đầu năm' },
    { value: 'none', label: 'Không so sánh' }
  ];

  years: number[] = [];

  // === DATA STATE ===
  report: IncomeStatementReport | null = null;
  validation: IncomeStatementValidation | null = null;

  // === UI STATE ===
  isLoading: boolean = false;
  canGenerate: boolean = false;
  cannotGenerateReasons: string[] = [];
  errorMessage: string = '';

  constructor(private incomeStatementService: IncomeStatementService) {
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

    this.incomeStatementService.canGenerateIncomeStatement(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.canGenerate = result.canGenerate;
          this.cannotGenerateReasons = result.reasons;
          this.isLoading = false;

          if (this.canGenerate) {
            this.generateReport();
          } else {
            this.report = null;
          }
        },
        error: (err) => {
          console.error('Lỗi kiểm tra điều kiện lập BC KQKD:', err);
          this.isLoading = false;
          this.errorMessage = 'Lỗi kiểm tra điều kiện lập báo cáo';
        }
      });
  }

  generateReport(): void {
    if (!this.canGenerate) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.incomeStatementService.generateIncomeStatement(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.validation = report.validation;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tạo BC KQKD:', err);
          this.isLoading = false;
          this.errorMessage = err.message || 'Lỗi tạo báo cáo kết quả kinh doanh';
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
    this.incomeStatementService.exportExcel(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `BC_KQKD_${this.report?.period.label.replace(/\//g, '-')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  exportPDF(): void {
    this.incomeStatementService.exportPDF(this.filter)
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
    if (value === undefined) return '-';
    if (value === 0) return '-';
    const sign = value < 0 ? '(' : '';
    const endSign = value < 0 ? ')' : '';
    return sign + new Intl.NumberFormat('vi-VN').format(Math.abs(value)) + endSign;
  }

  formatPercent(current: number, previous: number | undefined): string {
    if (!previous || previous === 0) return '-';
    const change = ((current - previous) / Math.abs(previous)) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
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

  getRowClass(row: IncomeStatementRow): string {
    const classes: string[] = [];

    // Level classes
    if (row.level === 0) classes.push('level-0', 'total-row');
    if (row.level === 1) classes.push('level-1');
    if (row.level === 2) classes.push('level-2');

    // Highlight important rows
    if (HIGHLIGHT_ROW_CODES.includes(row.code)) {
      classes.push('highlight-row');
    }

    // Negative amount
    if (row.amount < 0) {
      classes.push('negative');
    }

    // Profit/Loss indication
    if (row.code === '60') {
      classes.push(row.amount >= 0 ? 'profit' : 'loss');
    }

    return classes.join(' ');
  }

  getAmountClass(amount: number): string {
    if (amount < 0) return 'negative-amount';
    if (amount === 0) return 'zero-amount';
    return '';
  }

  getChangeClass(current: number, previous: number | undefined): string {
    if (!previous) return '';
    const change = current - previous;
    if (change > 0) return 'positive-change';
    if (change < 0) return 'negative-change';
    return '';
  }

  // === COMPUTED GETTERS ===

  get isValid(): boolean {
    return this.validation?.isValid ?? false;
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

  get showPreviousColumn(): boolean {
    return this.filter.compareType !== 'none';
  }

  get previousColumnLabel(): string {
    switch (this.filter.compareType) {
      case 'previous_period': return 'Kỳ trước';
      case 'same_period_last_year': return 'Cùng kỳ năm trước';
      case 'ytd': return 'Lũy kế';
      default: return '';
    }
  }

  // === SUMMARY GETTERS ===

  get netRevenue(): number {
    return this.report?.summary.netRevenue ?? 0;
  }

  get grossProfit(): number {
    return this.report?.summary.grossProfit ?? 0;
  }

  get grossMargin(): number {
    if (!this.netRevenue || this.netRevenue === 0) return 0;
    return (this.grossProfit / this.netRevenue) * 100;
  }

  get operatingProfit(): number {
    return this.report?.summary.operatingProfit ?? 0;
  }

  get operatingMargin(): number {
    if (!this.netRevenue || this.netRevenue === 0) return 0;
    return (this.operatingProfit / this.netRevenue) * 100;
  }

  get profitBeforeTax(): number {
    return this.report?.summary.profitBeforeTax ?? 0;
  }

  get netProfit(): number {
    return this.report?.summary.netProfit ?? 0;
  }

  get netProfitMargin(): number {
    if (!this.netRevenue || this.netRevenue === 0) return 0;
    return (this.netProfit / this.netRevenue) * 100;
  }

  get isProfitable(): boolean {
    return this.netProfit >= 0;
  }
}
