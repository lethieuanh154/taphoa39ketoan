import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VATService } from '../../services/vat.service';
import {
  VATDeclaration,
  VATDeclarationStatus,
  VATDeclarationPeriod,
  VATSummary,
  VAT_STATUS_LABELS,
  createEmptyVATDeclaration
} from '../../models/vat.models';

@Component({
  selector: 'app-vat-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vat-page.component.html',
  styleUrl: './vat-page.component.css'
})
export class VATPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  declarations: VATDeclaration[] = [];
  filteredDeclarations: VATDeclaration[] = [];
  summary: VATSummary = {
    totalDeclarations: 0, draftCount: 0, submittedCount: 0,
    totalVatOutput: 0, totalVatInput: 0, totalVatPayable: 0, totalVatCredit: 0
  };

  // Filter
  filterYear: number;
  filterStatus: VATDeclarationStatus | '' = '';
  years: number[] = [];

  // Modals
  showCreateModal = false;
  showDetailModal = false;
  showEditModal = false;

  // Form
  editingDeclaration: Partial<VATDeclaration> = {};
  selectedDeclaration: VATDeclaration | null = null;
  newPeriodMonth: number;
  newPeriodYear: number;

  // Loading
  isLoading = false;
  isSaving = false;

  // Labels
  statusLabels = VAT_STATUS_LABELS;

  constructor(private vatService: VATService) {
    const now = new Date();
    this.filterYear = now.getFullYear();
    this.newPeriodYear = now.getFullYear();
    this.newPeriodMonth = now.getMonth() === 0 ? 12 : now.getMonth();

    // Generate year options
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadData(): void {
    this.isLoading = true;

    this.vatService.getDeclarations({ periodYear: this.filterYear })
      .pipe(takeUntil(this.destroy$))
      .subscribe(declarations => {
        this.declarations = declarations.sort((a, b) => {
          if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear;
          return b.periodMonth - a.periodMonth;
        });
        this.applyFilter();
        this.isLoading = false;
      });

    this.vatService.getSummary(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.summary = summary;
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.declarations];

    if (this.filterStatus) {
      result = result.filter(d => d.status === this.filterStatus);
    }

    this.filteredDeclarations = result;
  }

  onYearChange(): void {
    this.loadData();
  }

  onStatusFilterChange(): void {
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    const period = this.vatService.getCurrentPeriod();
    this.newPeriodMonth = period.month;
    this.newPeriodYear = period.year;
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createDeclaration(): void {
    // Check if declaration already exists
    this.vatService.getDeclarationByPeriod(this.newPeriodMonth, this.newPeriodYear)
      .subscribe(existing => {
        if (existing) {
          alert(`Đã tồn tại tờ khai cho kỳ ${this.newPeriodMonth}/${this.newPeriodYear}`);
          return;
        }

        const newDeclaration = createEmptyVATDeclaration(this.newPeriodMonth, this.newPeriodYear);
        this.vatService.createDeclaration(newDeclaration)
          .subscribe(() => {
            this.loadData();
            this.closeCreateModal();
          });
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // EDIT
  // ═══════════════════════════════════════════════════════════════════

  openEditModal(declaration: VATDeclaration): void {
    if (declaration.status === 'SUBMITTED') return;
    this.editingDeclaration = JSON.parse(JSON.stringify(declaration));
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingDeclaration = {};
  }

  calculateTotals(): void {
    // Total sales
    this.editingDeclaration.totalSales =
      (this.editingDeclaration.salesExempt || 0) +
      (this.editingDeclaration.sales0 || 0) +
      (this.editingDeclaration.sales5 || 0) +
      (this.editingDeclaration.sales8 || 0) +
      (this.editingDeclaration.sales10 || 0);

    // Total VAT output
    this.editingDeclaration.totalVatOutput =
      (this.editingDeclaration.vat5Output || 0) +
      (this.editingDeclaration.vat8Output || 0) +
      (this.editingDeclaration.vat10Output || 0);

    // Total deductible
    this.editingDeclaration.totalVatDeductible =
      (this.editingDeclaration.totalVatInput || 0) +
      (this.editingDeclaration.vatCreditBroughtForward || 0);

    // VAT payable/credit
    this.editingDeclaration.vatPayableOrCredit =
      (this.editingDeclaration.totalVatOutput || 0) -
      (this.editingDeclaration.totalVatDeductible || 0);

    // Carry forward
    if ((this.editingDeclaration.vatPayableOrCredit || 0) < 0) {
      this.editingDeclaration.vatCreditCarryForward =
        Math.abs(this.editingDeclaration.vatPayableOrCredit || 0) -
        (this.editingDeclaration.vatRefundRequested || 0);
    } else {
      this.editingDeclaration.vatCreditCarryForward = 0;
    }
  }

  calculateVat5(): void {
    this.editingDeclaration.vat5Output = Math.round((this.editingDeclaration.sales5 || 0) * 0.05);
    this.calculateTotals();
  }

  calculateVat8(): void {
    this.editingDeclaration.vat8Output = Math.round((this.editingDeclaration.sales8 || 0) * 0.08);
    this.calculateTotals();
  }

  calculateVat10(): void {
    this.editingDeclaration.vat10Output = Math.round((this.editingDeclaration.sales10 || 0) * 0.10);
    this.calculateTotals();
  }

  saveDeclaration(): void {
    if (!this.editingDeclaration.id) return;

    this.isSaving = true;
    this.vatService.updateDeclaration(this.editingDeclaration.id, this.editingDeclaration)
      .subscribe({
        next: () => {
          this.loadData();
          this.closeEditModal();
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VIEW DETAIL
  // ═══════════════════════════════════════════════════════════════════

  viewDetail(declaration: VATDeclaration): void {
    this.selectedDeclaration = declaration;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedDeclaration = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  submitDeclaration(declaration: VATDeclaration): void {
    if (declaration.status !== 'DRAFT') return;

    if (confirm('Bạn có chắc muốn nộp tờ khai này? Sau khi nộp sẽ không thể sửa đổi.')) {
      this.vatService.submitDeclaration(declaration.id)
        .subscribe(() => {
          this.loadData();
          if (this.showDetailModal) {
            this.vatService.getDeclarationById(declaration.id).subscribe(d => {
              if (d) this.selectedDeclaration = d;
            });
          }
        });
    }
  }

  createAmendment(declaration: VATDeclaration): void {
    if (declaration.status !== 'SUBMITTED') return;

    if (confirm('Tạo tờ khai bổ sung cho kỳ này?')) {
      this.vatService.createAmendment(declaration.id)
        .subscribe(amendment => {
          if (amendment) {
            this.loadData();
            this.closeDetailModal();
            this.openEditModal(amendment);
          }
        });
    }
  }

  deleteDeclaration(declaration: VATDeclaration): void {
    if (declaration.status === 'SUBMITTED') return;

    if (confirm('Bạn có chắc muốn xóa tờ khai này?')) {
      this.vatService.deleteDeclaration(declaration.id)
        .subscribe(() => {
          this.loadData();
          this.closeDetailModal();
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatPeriod(declaration: VATDeclaration): string {
    return this.vatService.formatPeriodName(
      declaration.periodMonth,
      declaration.periodYear,
      declaration.periodType
    );
  }

  getEditingPeriodName(): string {
    if (!this.editingDeclaration.periodMonth || !this.editingDeclaration.periodYear) {
      return '';
    }
    return this.vatService.formatPeriodName(
      this.editingDeclaration.periodMonth,
      this.editingDeclaration.periodYear,
      this.editingDeclaration.periodType || 'MONTHLY'
    );
  }

  getStatusClass(status: VATDeclarationStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'SUBMITTED': return 'status-submitted';
      case 'ADJUSTED': return 'status-adjusted';
      default: return '';
    }
  }

  getVatResultClass(amount: number): string {
    if (amount > 0) return 'vat-payable';
    if (amount < 0) return 'vat-credit';
    return '';
  }

  get months(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
}
