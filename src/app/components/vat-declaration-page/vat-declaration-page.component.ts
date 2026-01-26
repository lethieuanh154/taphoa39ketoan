import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VATDeclarationService } from '../../services/vat-declaration.service';
import {
  VATDeclaration,
  VATDeclarationData,
  DeclarationPeriod,
  DeclarationStatus,
  DECLARATION_PERIODS,
  DECLARATION_STATUSES,
  getDeclarationDeadline,
  validateDeclaration
} from '../../models/vat-declaration.models';

@Component({
  selector: 'app-vat-declaration-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vat-declaration-page.component.html',
  styleUrl: './vat-declaration-page.component.css'
})
export class VATDeclarationPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  declarations: VATDeclaration[] = [];
  selectedDeclaration: VATDeclaration | null = null;

  // Filter
  filterYear: number;
  filterStatus: DeclarationStatus | '' = '';

  // Constants
  periods = DECLARATION_PERIODS;
  statuses = DECLARATION_STATUSES;
  years: number[] = [];

  // New declaration form
  showCreateModal = false;
  newPeriod: DeclarationPeriod = 'MONTHLY';
  newYear: number;
  newPeriodNo = 1;
  declarationData: VATDeclarationData | null = null;

  // Edit/View modal
  showDetailModal = false;
  editingDeclaration: VATDeclaration | null = null;
  isEditing = false;
  validationErrors: string[] = [];

  // Loading
  isLoading = false;

  constructor(private vatDeclarationService: VATDeclarationService) {
    const now = new Date();
    this.filterYear = now.getFullYear();
    this.newYear = now.getFullYear();
    this.newPeriodNo = now.getMonth() + 1;

    // Years for dropdown
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadDeclarations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  loadDeclarations(): void {
    this.isLoading = true;
    this.vatDeclarationService.getDeclarationsByYear(this.filterYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe(declarations => {
        let result = declarations;
        if (this.filterStatus) {
          result = result.filter(d => d.status === this.filterStatus);
        }
        this.declarations = result.sort((a, b) => {
          // Sort by period (month/quarter)
          const aPeriod = a.month || (a.quarter || 0) * 3;
          const bPeriod = b.month || (b.quarter || 0) * 3;
          return bPeriod - aPeriod;
        });
        this.isLoading = false;
      });
  }

  onYearChange(): void {
    this.loadDeclarations();
  }

  onStatusChange(): void {
    this.loadDeclarations();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE DECLARATION
  // ═══════════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.showCreateModal = true;
    this.declarationData = null;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.declarationData = null;
  }

  onPeriodTypeChange(): void {
    this.newPeriodNo = 1;
    this.declarationData = null;
  }

  getAvailablePeriodNos(): number[] {
    if (this.newPeriod === 'MONTHLY') {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else {
      return [1, 2, 3, 4];
    }
  }

  getPeriodNoLabel(no: number): string {
    if (this.newPeriod === 'MONTHLY') {
      return `Tháng ${no.toString().padStart(2, '0')}`;
    } else {
      return `Quý ${no}`;
    }
  }

  generateData(): void {
    this.declarationData = this.vatDeclarationService.generateDeclarationData(
      this.newPeriod, this.newYear, this.newPeriodNo
    );

    // Get carry forward from previous
    const carryForward = this.vatDeclarationService.getCarryForwardFromPreviousPeriod(
      this.newPeriod, this.newYear, this.newPeriodNo
    );
    this.declarationData.carryForwardFromPrevious = carryForward;
  }

  createDeclaration(): void {
    if (!this.declarationData) return;

    const newDec = this.vatDeclarationService.createDeclaration(
      this.declarationData,
      this.newPeriod,
      this.newYear,
      this.newPeriodNo
    );

    this.closeCreateModal();
    this.loadDeclarations();

    // Open the new declaration for review
    this.viewDeclaration(newDec);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIEW/EDIT DECLARATION
  // ═══════════════════════════════════════════════════════════════════════════════

  viewDeclaration(declaration: VATDeclaration): void {
    this.selectedDeclaration = declaration;
    this.editingDeclaration = { ...declaration };
    this.isEditing = false;
    this.showDetailModal = true;
    this.validationErrors = [];
  }

  editDeclaration(): void {
    if (!this.selectedDeclaration || this.selectedDeclaration.status !== 'DRAFT') return;
    this.isEditing = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedDeclaration = null;
    this.editingDeclaration = null;
    this.isEditing = false;
  }

  saveDeclaration(): void {
    if (!this.editingDeclaration) return;

    this.validationErrors = validateDeclaration(this.editingDeclaration);
    if (this.validationErrors.length > 0) return;

    this.vatDeclarationService.updateDeclaration(this.editingDeclaration.id, this.editingDeclaration);
    this.loadDeclarations();
    this.closeDetailModal();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  submitDeclaration(id: string): void {
    if (confirm('Bạn có chắc chắn muốn nộp tờ khai này?')) {
      this.vatDeclarationService.submitDeclaration(id);
      this.loadDeclarations();
      this.closeDetailModal();
    }
  }

  acceptDeclaration(id: string): void {
    this.vatDeclarationService.acceptDeclaration(id);
    this.loadDeclarations();
    this.closeDetailModal();
  }

  rejectDeclaration(id: string): void {
    const reason = prompt('Nhập lý do từ chối:');
    if (reason) {
      this.vatDeclarationService.rejectDeclaration(id, reason);
      this.loadDeclarations();
      this.closeDetailModal();
    }
  }

  deleteDeclaration(id: string): void {
    if (confirm('Bạn có chắc chắn muốn xóa tờ khai này?')) {
      this.vatDeclarationService.deleteDeclaration(id);
      this.loadDeclarations();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════════

  print(): void {
    window.print();
  }

  exportToXML(): void {
    if (!this.editingDeclaration) return;

    // Generate XML format (simplified)
    const d = this.editingDeclaration;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu>
  <HSoKhaiThue>
    <TTinChung>
      <TKhai>
        <maTKhai>01/GTGT</maTKhai>
        <tenTKhai>TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG</tenTKhai>
        <moTa>Mẫu số 01/GTGT</moTa>
      </TKhai>
      <NNT>
        <mst>${d.taxCode}</mst>
        <tenNNT>${d.companyName}</tenNNT>
        <dChi>${d.address}</dChi>
      </NNT>
      <kyKKhai>${d.taxPeriod}</kyKKhai>
    </TTinChung>
    <CTieuTKhai>
      <ct21>${d.line21_noTaxRevenue}</ct21>
      <ct22>${d.line22_zeroRateRevenue}</ct22>
      <ct23>${d.line23_fivePercentRevenue}</ct23>
      <ct23a>${d.line23_fivePercentVAT}</ct23a>
      <ct24>${d.line24_eightPercentRevenue}</ct24>
      <ct24a>${d.line24_eightPercentVAT}</ct24a>
      <ct25>${d.line25_tenPercentRevenue}</ct25>
      <ct25a>${d.line25_tenPercentVAT}</ct25a>
      <ct26>${d.line26_totalRevenue}</ct26>
      <ct27>${d.line27_totalOutputVAT}</ct27>
      <ct28>${d.line28_totalPurchase}</ct28>
      <ct29>${d.line29_totalInputVAT}</ct29>
      <ct30>${d.line30_deductibleInputVAT}</ct30>
      <ct31>${d.line31_increaseAdjustment}</ct31>
      <ct32>${d.line32_decreaseAdjustment}</ct32>
      <ct33>${d.line33_carryForwardFromPrevious}</ct33>
      <ct34>${d.line34_totalDeductibleVAT}</ct34>
      <ct35>${d.line35_vatPayable}</ct35>
      <ct36>${d.line36_vatNotDeducted}</ct36>
      <ct37>${d.line37_vatRefundRequest}</ct37>
      <ct38>${d.line38_carryForwardToNext}</ct38>
    </CTieuTKhai>
  </HSoKhaiThue>
</HSoThueDTu>`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ToKhai_01GTGT_${d.taxPeriod.replace('/', '')}.xml`;
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

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getStatusLabel(status: DeclarationStatus): string {
    return DECLARATION_STATUSES.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: DeclarationStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'SUBMITTED': return 'status-submitted';
      case 'ACCEPTED': return 'status-accepted';
      case 'REJECTED': return 'status-rejected';
      default: return '';
    }
  }

  getDeadline(declaration: VATDeclaration): Date {
    const periodNo = declaration.month || declaration.quarter || 1;
    return getDeclarationDeadline(declaration.period, declaration.year, periodNo);
  }

  isOverdue(declaration: VATDeclaration): boolean {
    if (declaration.status !== 'DRAFT') return false;
    return new Date() > this.getDeadline(declaration);
  }

  getVATResult(declaration: VATDeclaration): { label: string; amount: number; class: string } {
    if (declaration.line35_vatPayable > 0) {
      return {
        label: 'Thuế GTGT phải nộp',
        amount: declaration.line35_vatPayable,
        class: 'result-payable'
      };
    } else if (declaration.line38_carryForwardToNext > 0) {
      return {
        label: 'Còn được KT kỳ sau',
        amount: declaration.line38_carryForwardToNext,
        class: 'result-carryforward'
      };
    } else {
      return {
        label: 'Cân bằng',
        amount: 0,
        class: 'result-balanced'
      };
    }
  }
}
