import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  VATDeclaration,
  VATDeclarationStatus,
  VATDeclarationPeriod,
  VATDeclarationFilter,
  VATSummary,
  VATInputSchedule,
  VATOutputSchedule,
  VATInvoiceLine,
  VATRate,
  createEmptyVATDeclaration,
  createEmptyScheduleSummary,
  calculateVATPayable,
  formatPeriodName,
  getCurrentPeriod
} from '../models/vat.models';

@Injectable({
  providedIn: 'root'
})
export class VATService {
  private readonly STORAGE_KEY = 'taphoa39_vat_declarations';

  private declarationsSubject = new BehaviorSubject<VATDeclaration[]>([]);

  constructor() {
    this.loadFromStorage();
  }

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const declarations = JSON.parse(stored).map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt),
          submittedAt: d.submittedAt ? new Date(d.submittedAt) : undefined
        }));
        this.declarationsSubject.next(declarations);
      } else {
        this.declarationsSubject.next(this.getDemoData());
        this.saveToStorage();
      }
    } catch (e) {
      console.error('Error loading VAT declarations:', e);
      this.declarationsSubject.next(this.getDemoData());
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.declarationsSubject.value));
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════

  private getDemoData(): VATDeclaration[] {
    const now = new Date();
    const currentYear = now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

    return [
      // Tờ khai tháng trước đã nộp
      {
        id: 'VAT-001',
        declarationNo: `01GTGT-${prevYear}${String(prevMonth).padStart(2, '0')}-001`,
        periodMonth: prevMonth,
        periodYear: prevYear,
        periodType: 'MONTHLY',
        status: 'SUBMITTED',
        isAmendment: false,
        salesExempt: 0,
        sales0: 5000000,
        sales5: 20000000,
        vat5Output: 1000000,
        sales8: 15000000,
        vat8Output: 1200000,
        sales10: 80000000,
        vat10Output: 8000000,
        totalSales: 120000000,
        totalVatOutput: 10200000,
        totalPurchases: 70000000,
        totalVatInput: 6500000,
        vatCreditBroughtForward: 500000,
        totalVatDeductible: 7000000,
        vatPayableOrCredit: 3200000,
        vatRefundRequested: 0,
        vatCreditCarryForward: 0,
        createdAt: new Date(prevYear, prevMonth - 1, 15),
        createdBy: 'admin',
        submittedAt: new Date(prevYear, prevMonth, 18),
        submittedBy: 'admin',
        note: 'Tờ khai thuế GTGT hàng tháng'
      },
      // Tờ khai tháng hiện tại (nháp)
      {
        id: 'VAT-002',
        declarationNo: `01GTGT-${currentYear}${String(now.getMonth() + 1).padStart(2, '0')}-001`,
        periodMonth: now.getMonth() + 1,
        periodYear: currentYear,
        periodType: 'MONTHLY',
        status: 'DRAFT',
        isAmendment: false,
        salesExempt: 2000000,
        sales0: 3000000,
        sales5: 25000000,
        vat5Output: 1250000,
        sales8: 18000000,
        vat8Output: 1440000,
        sales10: 95000000,
        vat10Output: 9500000,
        totalSales: 143000000,
        totalVatOutput: 12190000,
        totalPurchases: 85000000,
        totalVatInput: 7800000,
        vatCreditBroughtForward: 0,
        totalVatDeductible: 7800000,
        vatPayableOrCredit: 4390000,
        vatRefundRequested: 0,
        vatCreditCarryForward: 0,
        createdAt: new Date(),
        createdBy: 'admin',
        note: 'Đang lập tờ khai'
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  getDeclarations(filter?: VATDeclarationFilter): Observable<VATDeclaration[]> {
    return this.declarationsSubject.asObservable().pipe(
      map(declarations => this.applyFilter(declarations, filter))
    );
  }

  getDeclarationById(id: string): Observable<VATDeclaration | undefined> {
    return this.declarationsSubject.asObservable().pipe(
      map(declarations => declarations.find(d => d.id === id))
    );
  }

  getDeclarationByPeriod(month: number, year: number): Observable<VATDeclaration | undefined> {
    return this.declarationsSubject.asObservable().pipe(
      map(declarations => declarations.find(d =>
        d.periodMonth === month && d.periodYear === year && !d.isAmendment
      ))
    );
  }

  createDeclaration(declaration: Partial<VATDeclaration>): Observable<VATDeclaration> {
    const newDeclaration: VATDeclaration = {
      ...createEmptyVATDeclaration(declaration.periodMonth || 1, declaration.periodYear || new Date().getFullYear()),
      ...declaration,
      id: `VAT-${Date.now()}`,
      declarationNo: this.generateDeclarationNo(declaration.periodMonth!, declaration.periodYear!),
      status: 'DRAFT',
      createdAt: new Date(),
      createdBy: 'admin'
    } as VATDeclaration;

    // Calculate totals
    this.calculateDeclarationTotals(newDeclaration);

    const declarations = [...this.declarationsSubject.value, newDeclaration];
    this.declarationsSubject.next(declarations);
    this.saveToStorage();

    return of(newDeclaration);
  }

  updateDeclaration(id: string, updates: Partial<VATDeclaration>): Observable<VATDeclaration | undefined> {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1) return of(undefined);

    const existing = declarations[index];
    if (existing.status === 'SUBMITTED') {
      console.error('Cannot update submitted declaration');
      return of(undefined);
    }

    const updated = { ...existing, ...updates };
    this.calculateDeclarationTotals(updated);

    declarations[index] = updated;
    this.declarationsSubject.next([...declarations]);
    this.saveToStorage();

    return of(updated);
  }

  deleteDeclaration(id: string): Observable<boolean> {
    const declarations = this.declarationsSubject.value;
    const declaration = declarations.find(d => d.id === id);

    if (!declaration || declaration.status === 'SUBMITTED') {
      return of(false);
    }

    const filtered = declarations.filter(d => d.id !== id);
    this.declarationsSubject.next(filtered);
    this.saveToStorage();

    return of(true);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  submitDeclaration(id: string): Observable<VATDeclaration | undefined> {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1) return of(undefined);

    const declaration = declarations[index];
    if (declaration.status !== 'DRAFT') {
      console.error('Only DRAFT declarations can be submitted');
      return of(undefined);
    }

    declaration.status = 'SUBMITTED';
    declaration.submittedAt = new Date();
    declaration.submittedBy = 'admin';

    declarations[index] = { ...declaration };
    this.declarationsSubject.next([...declarations]);
    this.saveToStorage();

    return of(declaration);
  }

  createAmendment(originalId: string): Observable<VATDeclaration | undefined> {
    const original = this.declarationsSubject.value.find(d => d.id === originalId);
    if (!original || original.status !== 'SUBMITTED') {
      return of(undefined);
    }

    // Count existing amendments
    const amendmentCount = this.declarationsSubject.value.filter(d =>
      d.periodMonth === original.periodMonth &&
      d.periodYear === original.periodYear &&
      d.isAmendment
    ).length;

    const amendment: VATDeclaration = {
      ...original,
      id: `VAT-${Date.now()}`,
      declarationNo: this.generateDeclarationNo(original.periodMonth, original.periodYear, amendmentCount + 1),
      status: 'DRAFT',
      isAmendment: true,
      amendmentNo: amendmentCount + 1,
      createdAt: new Date(),
      createdBy: 'admin',
      submittedAt: undefined,
      submittedBy: undefined
    };

    const declarations = [...this.declarationsSubject.value, amendment];
    this.declarationsSubject.next(declarations);
    this.saveToStorage();

    return of(amendment);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════

  getSummary(year?: number): Observable<VATSummary> {
    return this.declarationsSubject.asObservable().pipe(
      map(declarations => {
        const filtered = year
          ? declarations.filter(d => d.periodYear === year)
          : declarations;

        const submitted = filtered.filter(d => d.status === 'SUBMITTED');

        return {
          totalDeclarations: filtered.length,
          draftCount: filtered.filter(d => d.status === 'DRAFT').length,
          submittedCount: submitted.length,
          totalVatOutput: submitted.reduce((sum, d) => sum + d.totalVatOutput, 0),
          totalVatInput: submitted.reduce((sum, d) => sum + d.totalVatInput, 0),
          totalVatPayable: submitted.filter(d => d.vatPayableOrCredit > 0)
            .reduce((sum, d) => sum + d.vatPayableOrCredit, 0),
          totalVatCredit: submitted.filter(d => d.vatPayableOrCredit < 0)
            .reduce((sum, d) => sum + Math.abs(d.vatPayableOrCredit), 0)
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // IMPORT FROM INVOICES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Lấy dữ liệu từ hóa đơn để tổng hợp vào tờ khai
   * Trong thực tế sẽ gọi InvoiceService để lấy dữ liệu
   */
  calculateFromInvoices(month: number, year: number): Observable<Partial<VATDeclaration>> {
    // TODO: Integrate with InvoiceService
    // For now, return placeholder data
    const data: Partial<VATDeclaration> = {
      periodMonth: month,
      periodYear: year,
      salesExempt: 0,
      sales0: 0,
      sales5: 0,
      vat5Output: 0,
      sales8: 0,
      vat8Output: 0,
      sales10: 0,
      vat10Output: 0,
      totalSales: 0,
      totalVatOutput: 0,
      totalPurchases: 0,
      totalVatInput: 0
    };

    return of(data);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private applyFilter(declarations: VATDeclaration[], filter?: VATDeclarationFilter): VATDeclaration[] {
    if (!filter) return declarations;

    return declarations.filter(d => {
      if (filter.periodYear && d.periodYear !== filter.periodYear) return false;
      if (filter.periodMonth && d.periodMonth !== filter.periodMonth) return false;
      if (filter.periodType && d.periodType !== filter.periodType) return false;
      if (filter.status && d.status !== filter.status) return false;
      return true;
    });
  }

  private generateDeclarationNo(month: number, year: number, amendmentNo?: number): string {
    const base = `01GTGT-${year}${String(month).padStart(2, '0')}`;
    if (amendmentNo) {
      return `${base}-BS${amendmentNo}`;
    }
    return `${base}-001`;
  }

  private calculateDeclarationTotals(declaration: VATDeclaration): void {
    // Total sales
    declaration.totalSales = (declaration.salesExempt || 0) +
      (declaration.sales0 || 0) +
      (declaration.sales5 || 0) +
      (declaration.sales8 || 0) +
      (declaration.sales10 || 0);

    // Total VAT output
    declaration.totalVatOutput = (declaration.vat5Output || 0) +
      (declaration.vat8Output || 0) +
      (declaration.vat10Output || 0);

    // Total VAT deductible
    declaration.totalVatDeductible = (declaration.totalVatInput || 0) +
      (declaration.vatCreditBroughtForward || 0);

    // VAT payable or credit
    declaration.vatPayableOrCredit = declaration.totalVatOutput - declaration.totalVatDeductible;

    // VAT carry forward (if credit)
    if (declaration.vatPayableOrCredit < 0) {
      declaration.vatCreditCarryForward = Math.abs(declaration.vatPayableOrCredit) -
        (declaration.vatRefundRequested || 0);
    } else {
      declaration.vatCreditCarryForward = 0;
    }
  }

  getNextDeclarationNo(month: number, year: number): string {
    return this.generateDeclarationNo(month, year);
  }

  getCurrentPeriod(): { month: number; year: number } {
    return getCurrentPeriod();
  }

  formatPeriodName(month: number, year: number, type: VATDeclarationPeriod): string {
    return formatPeriodName(month, year, type);
  }
}
