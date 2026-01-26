import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  VATDeclaration,
  VATDeclarationData,
  DeclarationPeriod,
  DeclarationType,
  DeclarationStatus,
  OutputInvoiceDetail,
  InputInvoiceDetail,
  generateDeclarationNo,
  calculateTotalDeductibleVAT,
  calculateVATPayable,
  calculateVATNotDeducted,
  getPeriodLabel
} from '../models/vat-declaration.models';

@Injectable({
  providedIn: 'root'
})
export class VATDeclarationService {
  private declarationsSubject = new BehaviorSubject<VATDeclaration[]>([]);
  public declarations$ = this.declarationsSubject.asObservable();

  // Company info (should come from settings)
  private companyInfo = {
    name: 'CÔNG TY TNHH TẬP HÓA 39',
    taxCode: '0123456789',
    address: '39 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    phone: '024-12345678',
    email: 'ketoan@taphoa39.vn',
    representative: 'Nguyễn Văn A',
    accountant: 'Trần Thị B'
  };

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════════

  getDeclarations(): Observable<VATDeclaration[]> {
    return this.declarations$;
  }

  getDeclarationById(id: string): Observable<VATDeclaration | undefined> {
    return this.declarations$.pipe(
      map(list => list.find(d => d.id === id))
    );
  }

  getDeclarationsByYear(year: number): Observable<VATDeclaration[]> {
    return this.declarations$.pipe(
      map(list => list.filter(d => d.year === year))
    );
  }

  getDeclarationByPeriod(period: DeclarationPeriod, year: number, periodNo: number): Observable<VATDeclaration | undefined> {
    return this.declarations$.pipe(
      map(list => list.find(d =>
        d.period === period &&
        d.year === year &&
        (period === 'MONTHLY' ? d.month === periodNo : d.quarter === periodNo) &&
        d.declarationType === 'ORIGINAL'
      ))
    );
  }

  createDeclaration(data: VATDeclarationData, period: DeclarationPeriod, year: number, periodNo: number): VATDeclaration {
    const declarations = this.declarationsSubject.value;
    const taxPeriod = period === 'MONTHLY'
      ? `${periodNo.toString().padStart(2, '0')}/${year}`
      : `Q${periodNo}/${year}`;

    const newDeclaration: VATDeclaration = {
      id: `vat_dec_${Date.now()}`,
      declarationNo: generateDeclarationNo('ORIGINAL', taxPeriod),
      declarationType: 'ORIGINAL',
      period,
      taxPeriod,
      year,
      month: period === 'MONTHLY' ? periodNo : undefined,
      quarter: period === 'QUARTERLY' ? periodNo : undefined,

      // Company info
      companyName: this.companyInfo.name,
      taxCode: this.companyInfo.taxCode,
      address: this.companyInfo.address,
      phone: this.companyInfo.phone,
      email: this.companyInfo.email,
      representative: this.companyInfo.representative,
      accountant: this.companyInfo.accountant,

      // Part I - Output
      line21_noTaxRevenue: data.outputSummary.noTaxRevenue,
      line22_zeroRateRevenue: data.outputSummary.zeroRateRevenue,
      line23_fivePercentRevenue: data.outputSummary.fivePercentRevenue,
      line23_fivePercentVAT: data.outputSummary.fivePercentVAT,
      line24_eightPercentRevenue: data.outputSummary.eightPercentRevenue,
      line24_eightPercentVAT: data.outputSummary.eightPercentVAT,
      line25_tenPercentRevenue: data.outputSummary.tenPercentRevenue,
      line25_tenPercentVAT: data.outputSummary.tenPercentVAT,
      line26_totalRevenue: data.outputSummary.totalRevenue,
      line27_totalOutputVAT: data.outputSummary.totalOutputVAT,

      // Part II - Input
      line28_totalPurchase: data.inputSummary.totalPurchase,
      line29_totalInputVAT: data.inputSummary.totalInputVAT,
      line30_deductibleInputVAT: data.inputSummary.deductibleInputVAT,
      line31_increaseAdjustment: 0,
      line32_decreaseAdjustment: 0,
      line33_carryForwardFromPrevious: data.carryForwardFromPrevious,

      // Part III - Calculation
      line34_totalDeductibleVAT: 0,
      line35_vatPayable: 0,
      line36_vatNotDeducted: 0,
      line37_vatRefundRequest: 0,
      line38_carryForwardToNext: 0,

      status: 'DRAFT',
      createdAt: new Date(),
      createdBy: 'admin',
      updatedAt: new Date()
    };

    // Calculate Part III
    this.recalculateDeclaration(newDeclaration);

    this.declarationsSubject.next([...declarations, newDeclaration]);
    return newDeclaration;
  }

  updateDeclaration(id: string, data: Partial<VATDeclaration>): boolean {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1) return false;
    if (declarations[index].status !== 'DRAFT') return false;

    const updated = { ...declarations[index], ...data, updatedAt: new Date() };
    this.recalculateDeclaration(updated);

    declarations[index] = updated;
    this.declarationsSubject.next([...declarations]);
    return true;
  }

  deleteDeclaration(id: string): boolean {
    const declarations = this.declarationsSubject.value;
    const declaration = declarations.find(d => d.id === id);
    if (!declaration || declaration.status !== 'DRAFT') return false;

    this.declarationsSubject.next(declarations.filter(d => d.id !== id));
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  submitDeclaration(id: string): boolean {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1 || declarations[index].status !== 'DRAFT') return false;

    declarations[index] = {
      ...declarations[index],
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedBy: 'admin',
      updatedAt: new Date()
    };

    this.declarationsSubject.next([...declarations]);
    return true;
  }

  acceptDeclaration(id: string): boolean {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1 || declarations[index].status !== 'SUBMITTED') return false;

    declarations[index] = {
      ...declarations[index],
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      updatedAt: new Date()
    };

    this.declarationsSubject.next([...declarations]);
    return true;
  }

  rejectDeclaration(id: string, reason: string): boolean {
    const declarations = this.declarationsSubject.value;
    const index = declarations.findIndex(d => d.id === id);

    if (index === -1 || declarations[index].status !== 'SUBMITTED') return false;

    declarations[index] = {
      ...declarations[index],
      status: 'REJECTED',
      rejectedReason: reason,
      updatedAt: new Date()
    };

    this.declarationsSubject.next([...declarations]);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private recalculateDeclaration(declaration: VATDeclaration): void {
    // Line 34 = 30 + 31 - 32 + 33
    declaration.line34_totalDeductibleVAT = calculateTotalDeductibleVAT(
      declaration.line30_deductibleInputVAT,
      declaration.line31_increaseAdjustment,
      declaration.line32_decreaseAdjustment,
      declaration.line33_carryForwardFromPrevious
    );

    // Line 35 = max(0, 27 - 34)
    declaration.line35_vatPayable = calculateVATPayable(
      declaration.line27_totalOutputVAT,
      declaration.line34_totalDeductibleVAT
    );

    // Line 36 = max(0, 34 - 27)
    declaration.line36_vatNotDeducted = calculateVATNotDeducted(
      declaration.line27_totalOutputVAT,
      declaration.line34_totalDeductibleVAT
    );

    // Line 38 = 36 - 37
    declaration.line38_carryForwardToNext = declaration.line36_vatNotDeducted - declaration.line37_vatRefundRequest;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA GENERATION (for creating new declaration)
  // ═══════════════════════════════════════════════════════════════════════════════

  generateDeclarationData(period: DeclarationPeriod, year: number, periodNo: number): VATDeclarationData {
    // This would normally pull from Invoice and VAT services
    // For demo, return sample data

    const fromDate = period === 'MONTHLY'
      ? new Date(year, periodNo - 1, 1)
      : new Date(year, (periodNo - 1) * 3, 1);

    const toDate = period === 'MONTHLY'
      ? new Date(year, periodNo, 0)
      : new Date(year, periodNo * 3, 0);

    // Sample output invoices
    const outputInvoices: OutputInvoiceDetail[] = [
      { invoiceId: 'inv_001', invoiceNo: 'HĐ-001', invoiceDate: fromDate, customerName: 'Công ty ABC', customerTaxCode: '0123456789', revenue: 50000000, vatRate: 10, vatAmount: 5000000 },
      { invoiceId: 'inv_002', invoiceNo: 'HĐ-002', invoiceDate: fromDate, customerName: 'Công ty XYZ', customerTaxCode: '0987654321', revenue: 30000000, vatRate: 10, vatAmount: 3000000 },
      { invoiceId: 'inv_003', invoiceNo: 'HĐ-003', invoiceDate: fromDate, customerName: 'Siêu thị Mini', revenue: 20000000, vatRate: 8, vatAmount: 1600000 },
    ];

    // Sample input invoices
    const inputInvoices: InputInvoiceDetail[] = [
      { invoiceId: 'pinv_001', invoiceNo: 'MV-001', invoiceDate: fromDate, supplierName: 'NCC A', supplierTaxCode: '1111111111', purchaseAmount: 40000000, vatRate: 10, vatAmount: 4000000, isDeductible: true },
      { invoiceId: 'pinv_002', invoiceNo: 'MV-002', invoiceDate: fromDate, supplierName: 'NCC B', supplierTaxCode: '2222222222', purchaseAmount: 15000000, vatRate: 8, vatAmount: 1200000, isDeductible: true },
    ];

    return {
      period: getPeriodLabel(period, year, periodNo),
      fromDate,
      toDate,
      outputInvoices,
      outputSummary: {
        noTaxRevenue: 0,
        zeroRateRevenue: 0,
        fivePercentRevenue: 0,
        fivePercentVAT: 0,
        eightPercentRevenue: 20000000,
        eightPercentVAT: 1600000,
        tenPercentRevenue: 80000000,
        tenPercentVAT: 8000000,
        totalRevenue: 100000000,
        totalOutputVAT: 9600000
      },
      inputInvoices,
      inputSummary: {
        totalPurchase: 55000000,
        totalInputVAT: 5200000,
        deductibleInputVAT: 5200000,
        nonDeductibleInputVAT: 0
      },
      carryForwardFromPrevious: 0
    };
  }

  getCarryForwardFromPreviousPeriod(period: DeclarationPeriod, year: number, periodNo: number): number {
    // Find previous period's declaration
    const declarations = this.declarationsSubject.value;

    let prevYear = year;
    let prevPeriodNo = periodNo - 1;

    if (period === 'MONTHLY') {
      if (prevPeriodNo < 1) {
        prevPeriodNo = 12;
        prevYear = year - 1;
      }
    } else {
      if (prevPeriodNo < 1) {
        prevPeriodNo = 4;
        prevYear = year - 1;
      }
    }

    const prevDeclaration = declarations.find(d =>
      d.period === period &&
      d.year === prevYear &&
      (period === 'MONTHLY' ? d.month === prevPeriodNo : d.quarter === prevPeriodNo) &&
      d.status === 'ACCEPTED'
    );

    return prevDeclaration?.line38_carryForwardToNext || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const declarations: VATDeclaration[] = [
      {
        id: 'vat_dec_001',
        declarationNo: '01/GTGT-122024',
        declarationType: 'ORIGINAL',
        period: 'MONTHLY',
        taxPeriod: '12/2024',
        year: 2024,
        month: 12,

        companyName: this.companyInfo.name,
        taxCode: this.companyInfo.taxCode,
        address: this.companyInfo.address,
        phone: this.companyInfo.phone,
        email: this.companyInfo.email,
        representative: this.companyInfo.representative,
        accountant: this.companyInfo.accountant,

        line21_noTaxRevenue: 0,
        line22_zeroRateRevenue: 0,
        line23_fivePercentRevenue: 0,
        line23_fivePercentVAT: 0,
        line24_eightPercentRevenue: 25000000,
        line24_eightPercentVAT: 2000000,
        line25_tenPercentRevenue: 120000000,
        line25_tenPercentVAT: 12000000,
        line26_totalRevenue: 145000000,
        line27_totalOutputVAT: 14000000,

        line28_totalPurchase: 80000000,
        line29_totalInputVAT: 7500000,
        line30_deductibleInputVAT: 7500000,
        line31_increaseAdjustment: 0,
        line32_decreaseAdjustment: 0,
        line33_carryForwardFromPrevious: 0,

        line34_totalDeductibleVAT: 7500000,
        line35_vatPayable: 6500000,
        line36_vatNotDeducted: 0,
        line37_vatRefundRequest: 0,
        line38_carryForwardToNext: 0,

        status: 'ACCEPTED',
        submittedAt: new Date(2025, 0, 15),
        submittedBy: 'admin',
        acceptedAt: new Date(2025, 0, 18),

        createdAt: new Date(2025, 0, 10),
        createdBy: 'admin',
        updatedAt: new Date(2025, 0, 18)
      },
      {
        id: 'vat_dec_002',
        declarationNo: '01/GTGT-012025',
        declarationType: 'ORIGINAL',
        period: 'MONTHLY',
        taxPeriod: '01/2025',
        year: 2025,
        month: 1,

        companyName: this.companyInfo.name,
        taxCode: this.companyInfo.taxCode,
        address: this.companyInfo.address,
        phone: this.companyInfo.phone,
        email: this.companyInfo.email,
        representative: this.companyInfo.representative,
        accountant: this.companyInfo.accountant,

        line21_noTaxRevenue: 0,
        line22_zeroRateRevenue: 0,
        line23_fivePercentRevenue: 5000000,
        line23_fivePercentVAT: 250000,
        line24_eightPercentRevenue: 30000000,
        line24_eightPercentVAT: 2400000,
        line25_tenPercentRevenue: 150000000,
        line25_tenPercentVAT: 15000000,
        line26_totalRevenue: 185000000,
        line27_totalOutputVAT: 17650000,

        line28_totalPurchase: 95000000,
        line29_totalInputVAT: 9000000,
        line30_deductibleInputVAT: 9000000,
        line31_increaseAdjustment: 0,
        line32_decreaseAdjustment: 0,
        line33_carryForwardFromPrevious: 0,

        line34_totalDeductibleVAT: 9000000,
        line35_vatPayable: 8650000,
        line36_vatNotDeducted: 0,
        line37_vatRefundRequest: 0,
        line38_carryForwardToNext: 0,

        status: 'DRAFT',

        createdAt: new Date(),
        createdBy: 'admin',
        updatedAt: new Date()
      }
    ];

    this.declarationsSubject.next(declarations);
  }
}
