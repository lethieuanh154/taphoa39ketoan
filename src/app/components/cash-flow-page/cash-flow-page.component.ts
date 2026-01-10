import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CashFlowService } from '../../services/cash-flow.service';
import {
  CashFlowReport,
  CashFlowSection,
  CashFlowRow,
  CashFlowFilter,
  CashFlowValidation,
  CashFlowPrerequisites
} from '../../models/cash-flow.models';

/**
 * BÁO CÁO LƯU CHUYỂN TIỀN TỆ - CASH FLOW STATEMENT
 * Phương pháp gián tiếp (Indirect Method)
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Giải thích: Lợi nhuận ≠ Tiền
 * - Tiền cuối kỳ = Tiền đầu kỳ + LC thuần
 * - Theo mẫu B03-DNN (Thông tư 99/2025/TT-BTC)
 *
 * NGUYÊN TẮC:
 * - READ-ONLY tuyệt đối
 * - Dữ liệu 100% từ KQKD + BCĐKT + Trial Balance
 * - Chỉ lập khi tất cả BCTC hợp lệ
 */
@Component({
  selector: 'app-cash-flow-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-flow-page.component.html',
  styleUrl: './cash-flow-page.component.css'
})
export class CashFlowPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: CashFlowFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    showPreviousPeriod: false,
    compareWithPreviousYear: false
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
  report: CashFlowReport | null = null;
  prerequisites: CashFlowPrerequisites | null = null;

  // === UI STATE ===
  isLoading: boolean = false;
  errorMessage: string = '';

  // === DRILL-DOWN STATE ===
  selectedRow: CashFlowRow | null = null;
  showDrillDown: boolean = false;

  constructor(private cashFlowService: CashFlowService) {
    this.initYears();
  }

  ngOnInit(): void {
    this.checkPrerequisites();
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

  checkPrerequisites(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.cashFlowService.checkPrerequisites(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.prerequisites = result;
          this.isLoading = false;

          if (result.canGenerate) {
            this.generateReport();
          } else {
            this.report = null;
          }
        },
        error: (err) => {
          console.error('Lỗi kiểm tra điều kiện:', err);
          this.isLoading = false;
          this.errorMessage = 'Lỗi kiểm tra điều kiện lập báo cáo';
        }
      });
  }

  generateReport(): void {
    if (!this.prerequisites?.canGenerate) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.cashFlowService.generateCashFlowReport(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tạo báo cáo LCTT:', err);
          this.isLoading = false;
          this.errorMessage = err.message || 'Lỗi tạo báo cáo lưu chuyển tiền tệ';
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
    this.checkPrerequisites();
  }

  onFilterChange(): void {
    this.checkPrerequisites();
  }

  // === DRILL-DOWN ===

  onRowClick(row: CashFlowRow): void {
    if (row.accountMapping && row.accountMapping.length > 0) {
      this.selectedRow = row;
      this.showDrillDown = true;
    }
  }

  closeDrillDown(): void {
    this.showDrillDown = false;
    this.selectedRow = null;
  }

  // === EXPORT ===

  exportExcel(): void {
    this.cashFlowService.exportExcel(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `LCTT_${this.report?.period.label.replace(/\//g, '-')}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  exportPDF(): void {
    this.cashFlowService.exportPDF(this.filter)
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
    const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
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

  getRowClass(row: CashFlowRow): string {
    const classes: string[] = [];
    if (row.level === 0) classes.push('level-0', 'total-row');
    if (row.level === 1) classes.push('level-1');
    if (row.level === 2) classes.push('level-2');
    if (row.isTotal) classes.push('subtotal-row');
    if (row.isNegative && row.amount !== 0) classes.push('negative');
    if (row.accountMapping && row.accountMapping.length > 0) classes.push('clickable');
    return classes.join(' ');
  }

  getAmountClass(amount: number): string {
    if (amount < 0) return 'negative-amount';
    if (amount === 0) return 'zero-amount';
    return 'positive-amount';
  }

  // === COMPUTED GETTERS ===

  get canGenerate(): boolean {
    return this.prerequisites?.canGenerate ?? false;
  }

  get cannotGenerateReasons(): string[] {
    return this.prerequisites?.reasons ?? [];
  }

  get validation(): CashFlowValidation | null {
    return this.report?.validation ?? null;
  }

  get isValid(): boolean {
    return this.validation?.isValid ?? false;
  }

  get isCashBalanced(): boolean {
    return this.validation?.isCashBalanced ?? false;
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

  get explanations(): string[] {
    return this.validation?.explanations ?? [];
  }

  get periodLabel(): string {
    return this.report?.period.label ?? '';
  }

  get isPeriodLocked(): boolean {
    return this.report?.period.isLocked ?? false;
  }

  // === SECTION GETTERS ===

  get operatingSection(): CashFlowSection | null {
    return this.report?.operating ?? null;
  }

  get investingSection(): CashFlowSection | null {
    return this.report?.investing ?? null;
  }

  get financingSection(): CashFlowSection | null {
    return this.report?.financing ?? null;
  }

  get netCashFlow(): number {
    return this.report?.summary.netCashFlow ?? 0;
  }

  get cashBeginning(): number {
    return this.report?.summary.cashBeginning ?? 0;
  }

  get cashEnding(): number {
    return this.report?.summary.cashEnding ?? 0;
  }

  get cashEndingCalculated(): number {
    return this.report?.summary.cashEndingCalculated ?? 0;
  }
}
