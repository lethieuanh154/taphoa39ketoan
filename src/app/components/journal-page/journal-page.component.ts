import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { JournalService } from '../../services/journal.service';
import {
  JournalEntry,
  JournalFilter,
  JournalSummary,
  VoucherSourceType,
  VOUCHER_SOURCE_LABELS,
  VOUCHER_SOURCE_COLORS,
  VoucherDetail
} from '../../models/journal.models';

/**
 * SỔ NHẬT KÝ CHUNG - GENERAL JOURNAL
 *
 * NGHIỆP VỤ KẾ TOÁN:
 * - Ghi nhận TOÀN BỘ bút toán phát sinh theo TRÌNH TỰ THỜI GIAN
 * - Mỗi dòng = 1 bút toán (Nợ - Có)
 * - Dữ liệu TỰ ĐỘNG từ chứng từ gốc, KHÔNG nhập tay
 * - Là nguồn để lên Sổ cái và BCTC
 *
 * NGUYÊN TẮC:
 * - Tổng phát sinh Nợ = Tổng phát sinh Có (kiểm tra cân đối)
 * - Chỉ READ-ONLY, không thêm/sửa/xóa trực tiếp
 * - Hỗ trợ drill-down về chứng từ gốc
 */
@Component({
  selector: 'app-journal-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.css'
})
export class JournalPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === FILTER STATE ===
  filter: JournalFilter = {
    periodType: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
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
  entries: JournalEntry[] = [];
  summary: JournalSummary = {
    totalDebit: 0,
    totalCredit: 0,
    entryCount: 0,
    isBalanced: true,
    difference: 0
  };

  // === PERIOD STATE ===
  periodFrom: string = '';
  periodTo: string = '';
  isPeriodLocked: boolean = false;

  // === PAGINATION ===
  currentPage: number = 1;
  pageSize: number = 50;
  totalItems: number = 0;
  totalPages: number = 0;

  // === UI STATE ===
  isLoading: boolean = false;
  selectedEntry: JournalEntry | null = null;
  voucherDetail: VoucherDetail | null = null;
  showDetailDrawer: boolean = false;

  // === SORT ===
  sortColumn: string = 'entryDate';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private journalService: JournalService) {
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

    this.journalService.getJournalEntries(this.filter, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.entries = response.entries;
          this.summary = response.summary;
          this.periodFrom = response.period.from;
          this.periodTo = response.period.to;
          this.isPeriodLocked = response.period.isLocked;
          this.totalItems = response.pagination.totalItems;
          this.totalPages = response.pagination.totalPages;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tải dữ liệu sổ nhật ký:', err);
          this.isLoading = false;
        }
      });
  }

  // === FILTER HANDLERS ===

  onPeriodTypeChange(): void {
    // Reset các giá trị khi đổi loại kỳ
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
    this.currentPage = 1;
    this.loadData();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadData();
  }

  // === PAGINATION ===

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadData();
    }
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // === SORTING ===

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.entries.sort((a: any, b: any) => {
      let valA = a[column];
      let valB = b[column];

      if (column === 'entryDate' || column === 'voucherDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
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

  // === ROW CLICK - DRILL DOWN ===

  onRowClick(entry: JournalEntry): void {
    this.selectedEntry = entry;
    this.showDetailDrawer = true;
    this.loadVoucherDetail(entry);
  }

  private loadVoucherDetail(entry: JournalEntry): void {
    this.journalService.getVoucherDetail(entry.sourceType, entry.sourceId)
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
    this.journalService.exportToExcel(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SoNhatKyChung_${this.periodFrom}_${this.periodTo}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          alert('Lỗi xuất Excel. Vui lòng thử lại.');
        }
      });
  }

  printPDF(): void {
    this.journalService.printPDF(this.filter)
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

  // === HELPERS ===

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  getSourceLabel(type: VoucherSourceType): string {
    return VOUCHER_SOURCE_LABELS[type] || type;
  }

  getSourceColor(type: VoucherSourceType): string {
    return VOUCHER_SOURCE_COLORS[type] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'NORMAL': return 'Bình thường';
      case 'ADJUSTMENT': return 'Điều chỉnh';
      case 'REVERSAL': return 'Storno';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'NORMAL': return 'status-normal';
      case 'ADJUSTMENT': return 'status-adjustment';
      case 'REVERSAL': return 'status-reversal';
      default: return '';
    }
  }

  get periodLabel(): string {
    if (this.filter.periodType === 'month' && this.filter.month) {
      return `Tháng ${this.filter.month}/${this.filter.year}`;
    }
    if (this.filter.periodType === 'quarter' && this.filter.quarter) {
      return `Quý ${this.filter.quarter}/${this.filter.year}`;
    }
    if (this.filter.periodType === 'year') {
      return `Năm ${this.filter.year}`;
    }
    return `${this.formatDate(this.filter.fromDate!)} - ${this.formatDate(this.filter.toDate!)}`;
  }
}
