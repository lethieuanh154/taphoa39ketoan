import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { OtherVoucherService } from '../../services/other-voucher.service';
import {
  OtherVoucher, OtherVoucherFilter, OtherVoucherType, OtherVoucherStatus,
  VoucherEntry, OTHER_VOUCHER_TYPES, OTHER_VOUCHER_STATUSES,
  validateOtherVoucher, calculateTotals, isBalanced
} from '../../models/other-voucher.models';

@Component({
  selector: 'app-other-voucher-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './other-voucher-page.component.html',
  styleUrl: './other-voucher-page.component.css'
})
export class OtherVoucherPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  vouchers: OtherVoucher[] = [];
  filteredVouchers: OtherVoucher[] = [];

  // Filter
  filter: OtherVoucherFilter = {};
  searchText = '';

  // Statistics
  stats = {
    total: 0,
    draft: 0,
    posted: 0,
    cancelled: 0,
    totalAmount: 0
  };

  // Modal
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  editingVoucher: Partial<OtherVoucher> = {};
  validationErrors: string[] = [];

  // Constants
  voucherTypes = OTHER_VOUCHER_TYPES;
  voucherStatuses = OTHER_VOUCHER_STATUSES;

  // Loading
  isLoading = false;

  constructor(private otherVoucherService: OtherVoucherService) {}

  ngOnInit(): void {
    this.loadVouchers();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadVouchers(): void {
    this.isLoading = true;
    this.otherVoucherService.getVouchers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(vouchers => {
        this.vouchers = vouchers;
        this.applyFilter();
        this.isLoading = false;
      });
  }

  private loadStatistics(): void {
    this.otherVoucherService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.vouchers];

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(v =>
        v.voucherNo.toLowerCase().includes(search) ||
        v.description.toLowerCase().includes(search)
      );
    }

    if (this.filter.voucherType) {
      result = result.filter(v => v.voucherType === this.filter.voucherType);
    }

    if (this.filter.status) {
      result = result.filter(v => v.status === this.filter.status);
    }

    // Sort by date desc
    result.sort((a, b) => new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime());

    this.filteredVouchers = result;
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
    this.editingVoucher = {
      voucherType: 'ADJUSTMENT',
      voucherDate: new Date(),
      status: 'DRAFT',
      entries: [this.createEmptyEntry(1)]
    };
    this.validationErrors = [];
    this.showModal = true;
  }

  openEditModal(voucher: OtherVoucher): void {
    if (voucher.status !== 'DRAFT') {
      alert('Chỉ có thể sửa chứng từ ở trạng thái Nháp');
      return;
    }
    this.modalMode = 'edit';
    this.editingVoucher = JSON.parse(JSON.stringify(voucher));
    this.validationErrors = [];
    this.showModal = true;
  }

  openViewModal(voucher: OtherVoucher): void {
    this.modalMode = 'view';
    this.editingVoucher = { ...voucher };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingVoucher = {};
    this.validationErrors = [];
  }

  saveVoucher(): void {
    this.validationErrors = validateOtherVoucher(this.editingVoucher);

    if (this.validationErrors.length > 0) {
      return;
    }

    if (this.modalMode === 'create') {
      this.otherVoucherService.createVoucher(this.editingVoucher)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadVouchers();
          this.loadStatistics();
        });
    } else if (this.modalMode === 'edit' && this.editingVoucher.id) {
      this.otherVoucherService.updateVoucher(this.editingVoucher.id, this.editingVoucher)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadVouchers();
          this.loadStatistics();
        });
    }
  }

  deleteVoucher(voucher: OtherVoucher): void {
    if (voucher.status !== 'DRAFT') {
      alert('Chỉ có thể xóa chứng từ ở trạng thái Nháp');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa chứng từ "${voucher.voucherNo}"?`)) {
      this.otherVoucherService.deleteVoucher(voucher.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadVouchers();
          this.loadStatistics();
        });
    }
  }

  postVoucher(voucher: OtherVoucher): void {
    if (voucher.status !== 'DRAFT') return;
    if (confirm(`Ghi sổ chứng từ "${voucher.voucherNo}"?`)) {
      this.otherVoucherService.postVoucher(voucher.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadVouchers();
          this.loadStatistics();
        });
    }
  }

  cancelVoucher(voucher: OtherVoucher): void {
    if (voucher.status !== 'POSTED') return;
    const reason = prompt('Nhập lý do hủy:');
    if (reason) {
      this.otherVoucherService.cancelVoucher(voucher.id, reason)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadVouchers();
          this.loadStatistics();
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTRY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  private createEmptyEntry(lineNo: number): VoucherEntry {
    return {
      id: 'e_' + Date.now() + '_' + lineNo,
      lineNo,
      accountCode: '',
      description: '',
      debitAmount: 0,
      creditAmount: 0
    };
  }

  addEntry(): void {
    if (!this.editingVoucher.entries) {
      this.editingVoucher.entries = [];
    }
    const lineNo = this.editingVoucher.entries.length + 1;
    this.editingVoucher.entries.push(this.createEmptyEntry(lineNo));
  }

  removeEntry(index: number): void {
    if (this.editingVoucher.entries && this.editingVoucher.entries.length > 1) {
      this.editingVoucher.entries.splice(index, 1);
      // Renumber
      this.editingVoucher.entries.forEach((e, i) => e.lineNo = i + 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getVoucherTypeLabel(type: OtherVoucherType): string {
    return this.voucherTypes.find(t => t.value === type)?.label || type;
  }

  getStatusLabel(status: OtherVoucherStatus): string {
    return this.voucherStatuses.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: OtherVoucherStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'POSTED': return 'status-posted';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getTotals(): { totalDebit: number; totalCredit: number; balanced: boolean } {
    const entries = this.editingVoucher.entries || [];
    const totals = calculateTotals(entries);
    return {
      ...totals,
      balanced: isBalanced(entries)
    };
  }

  getBalanceDiff(): number {
    const totals = this.getTotals();
    return Math.abs(totals.totalDebit - totals.totalCredit);
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  onDateChange(field: string, dateString: string): void {
    if (dateString) {
      (this.editingVoucher as any)[field] = new Date(dateString);
    }
  }
}
