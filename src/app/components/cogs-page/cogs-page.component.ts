import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { COGSService } from '../../services/cogs.service';
import {
  COGSEntry,
  COGSSummary,
  COGSByProduct,
  COGSTransactionType,
  COGS_TRANSACTION_TYPES,
  COSTING_METHODS,
  calculateGrossProfitMargin
} from '../../models/cogs.models';

type ViewMode = 'summary' | 'entries' | 'byProduct';

@Component({
  selector: 'app-cogs-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cogs-page.component.html',
  styleUrl: './cogs-page.component.css'
})
export class COGSPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // View
  viewMode: ViewMode = 'summary';

  // Data
  entries: COGSEntry[] = [];
  summary: COGSSummary | null = null;
  byProductData: COGSByProduct[] = [];

  // Filter
  fromDate: Date;
  toDate: Date;
  filterType: COGSTransactionType | '' = '';
  filterStatus: '' | 'DRAFT' | 'POSTED' | 'CANCELLED' = '';
  searchText = '';

  // Constants
  transactionTypes = COGS_TRANSACTION_TYPES;
  costingMethods = COSTING_METHODS;
  currentCostingMethod = 'WEIGHTED_AVERAGE';

  // Loading
  isLoading = false;

  // Modal
  showDetailModal = false;
  selectedEntry: COGSEntry | null = null;

  constructor(private cogsService: COGSService) {
    // Default to current month
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.currentCostingMethod = this.cogsService.getCostingMethod();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadData(): void {
    this.isLoading = true;

    // Load entries
    this.cogsService.getEntriesByFilter({
      fromDate: this.fromDate,
      toDate: this.toDate,
      transactionType: this.filterType || undefined,
      status: this.filterStatus || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe(entries => {
        this.entries = entries;
        if (this.searchText) {
          const search = this.searchText.toLowerCase();
          this.entries = this.entries.filter(e =>
            e.entryNo.toLowerCase().includes(search) ||
            e.sourceVoucherNo.toLowerCase().includes(search) ||
            e.customerName?.toLowerCase().includes(search)
          );
        }
      });

    // Load summary
    this.cogsService.getCOGSSummary(this.fromDate, this.toDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.summary = summary;
      });

    // Load by product
    this.cogsService.getCOGSByProduct(this.fromDate, this.toDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.byProductData = data.sort((a, b) => b.soldCost - a.soldCost);
        this.isLoading = false;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW SWITCHING
  // ═══════════════════════════════════════════════════════════════════════════════

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTER HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  onFromDateChange(dateString: string): void {
    this.fromDate = dateString ? new Date(dateString) : new Date();
    this.loadData();
  }

  onToDateChange(dateString: string): void {
    this.toDate = dateString ? new Date(dateString) : new Date();
    this.loadData();
  }

  onFilterChange(): void {
    this.loadData();
  }

  setDateRange(range: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear'): void {
    const now = new Date();

    switch (range) {
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
      case 'thisYear':
        this.fromDate = new Date(now.getFullYear(), 0, 1);
        this.toDate = new Date(now.getFullYear(), 11, 31);
        break;
    }

    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  viewEntry(entry: COGSEntry): void {
    this.selectedEntry = entry;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedEntry = null;
  }

  postEntry(id: string): void {
    if (confirm('Bạn có chắc chắn muốn ghi sổ bút toán giá vốn này?')) {
      this.cogsService.postEntry(id);
      this.loadData();
    }
  }

  cancelEntry(id: string): void {
    if (confirm('Bạn có chắc chắn muốn hủy bút toán giá vốn này?')) {
      this.cogsService.cancelEntry(id);
      this.loadData();
    }
  }

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    let csv = '';

    if (this.viewMode === 'summary') {
      csv = 'Báo cáo Giá vốn hàng bán\n';
      csv += `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}\n\n`;
      csv += `Tổng giá vốn,${this.summary?.totalCOGS || 0}\n`;
      csv += `Tổng doanh thu,${this.summary?.totalRevenue || 0}\n`;
      csv += `Lãi gộp,${this.summary?.totalGrossProfit || 0}\n`;
      csv += `Tỷ suất lãi gộp,${this.summary?.avgGrossMargin?.toFixed(2) || 0}%\n`;
    } else if (this.viewMode === 'entries') {
      csv = 'Số CT,Ngày,Loại GD,CT gốc,Khách hàng,Giá vốn,Doanh thu,Lãi gộp,Trạng thái\n';
      this.entries.forEach(e => {
        csv += `${e.entryNo},${this.formatDate(e.entryDate)},${this.getTypeLabel(e.transactionType)},${e.sourceVoucherNo},${e.customerName || ''},${e.totalCost},${e.totalRevenue},${e.grossProfit},${this.getStatusLabel(e.status)}\n`;
      });
    } else {
      csv = 'Mã SP,Tên SP,ĐVT,SL bán,Giá vốn,Doanh thu,Lãi gộp,% Lãi gộp\n';
      this.byProductData.forEach(p => {
        csv += `${p.productCode},"${p.productName}",${p.unit},${p.soldQuantity},${p.soldCost},${p.revenue},${p.grossProfit},${p.grossProfitMargin.toFixed(2)}%\n`;
      });
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gia_Von_Hang_Ban_${this.formatDateForFile(this.fromDate)}_${this.formatDateForFile(this.toDate)}.csv`;
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

  formatPercent(value: number): string {
    return value.toFixed(2) + '%';
  }

  getTypeLabel(type: COGSTransactionType): string {
    return COGS_TRANSACTION_TYPES.find(t => t.value === type)?.label || type;
  }

  getTypeClass(type: COGSTransactionType): string {
    switch (type) {
      case 'SALE': return 'type-sale';
      case 'WRITE_OFF': return 'type-writeoff';
      case 'RETURN': return 'type-return';
      default: return 'type-other';
    }
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

  getProfitClass(profit: number): string {
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-zero';
  }

  getMarginClass(margin: number): string {
    if (margin >= 30) return 'margin-high';
    if (margin >= 20) return 'margin-medium';
    if (margin >= 10) return 'margin-low';
    return 'margin-negative';
  }

  // Chart data for byType
  getChartWidth(percentage: number): string {
    return Math.min(percentage, 100) + '%';
  }

  getTotalCOGS(): number {
    return this.entries
      .filter(e => e.status === 'POSTED')
      .reduce((sum, e) => sum + e.totalCost, 0);
  }

  getTotalRevenue(): number {
    return this.entries
      .filter(e => e.status === 'POSTED')
      .reduce((sum, e) => sum + e.totalRevenue, 0);
  }

  getTotalProfit(): number {
    return this.getTotalRevenue() - this.getTotalCOGS();
  }
}
