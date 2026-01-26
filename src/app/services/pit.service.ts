import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  PITDeclaration,
  PITDetail,
  PITDeclarationStatus,
  generateDeclarationNo,
  calculatePIT,
  calculatePITSummary,
  getSubmissionDeadline,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION
} from '../models/pit.models';
import { Payroll } from '../models/payroll.models';

@Injectable({
  providedIn: 'root'
})
export class PITService {
  private declarations$ = new BehaviorSubject<PITDeclaration[]>([]);

  constructor() {
    this.initializeDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getDeclarations(): Observable<PITDeclaration[]> {
    return this.declarations$.asObservable();
  }

  getDeclarationsByYear(year: number): Observable<PITDeclaration[]> {
    return this.declarations$.pipe(
      map(list => list.filter(d => d.year === year))
    );
  }

  getDeclarationById(id: string): Observable<PITDeclaration | undefined> {
    return this.declarations$.pipe(
      map(list => list.find(d => d.id === id))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE FROM PAYROLL
  // ═══════════════════════════════════════════════════════════════════════════════

  createFromPayroll(payroll: Payroll): PITDeclaration {
    const details: PITDetail[] = payroll.lines.map(pl => ({
      id: this.generateId(),
      employeeId: pl.employeeId,
      employeeCode: pl.employeeCode,
      employeeName: pl.employeeName,
      department: pl.department,
      grossSalary: pl.grossSalary,
      insuranceDeduction: pl.totalInsuranceDeduction,
      taxableIncome: pl.taxableIncome,
      personalDeduction: pl.personalDeduction,
      dependentCount: Math.round(pl.dependentDeduction / DEPENDENT_DEDUCTION),
      dependentDeduction: pl.dependentDeduction,
      totalDeduction: pl.personalDeduction + pl.dependentDeduction,
      taxableAmount: pl.taxableAmount,
      pitAmount: pl.pitAmount
    }));

    const declaration: PITDeclaration = {
      id: this.generateId(),
      declarationNo: generateDeclarationNo(payroll.month, payroll.year),
      declarationType: 'MONTHLY',
      period: `${payroll.month.toString().padStart(2, '0')}/${payroll.year}`,
      month: payroll.month,
      year: payroll.year,
      details,
      summary: calculatePITSummary(details),
      status: 'DRAFT',
      submissionDeadline: getSubmissionDeadline(payroll.month, payroll.year),
      createdAt: new Date(),
      createdBy: 'admin'
    };

    const current = this.declarations$.getValue();
    this.declarations$.next([...current, declaration]);
    return declaration;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  submitDeclaration(id: string): void {
    const current = this.declarations$.getValue();
    const index = current.findIndex(d => d.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'SUBMITTED',
      submittedAt: new Date()
    };
    this.declarations$.next([...current]);
  }

  markAsPaid(id: string, paidDate?: Date): void {
    const current = this.declarations$.getValue();
    const index = current.findIndex(d => d.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'PAID',
      paidAt: paidDate || new Date()
    };
    this.declarations$.next([...current]);
  }

  cancelDeclaration(id: string): void {
    const current = this.declarations$.getValue();
    const index = current.findIndex(d => d.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'CANCELLED'
    };
    this.declarations$.next([...current]);
  }

  deleteDeclaration(id: string): void {
    const current = this.declarations$.getValue();
    const declaration = current.find(d => d.id === id);
    if (!declaration || declaration.status !== 'DRAFT') return;

    this.declarations$.next(current.filter(d => d.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getYearSummary(year: number): Observable<{
    totalPIT: number;
    paidPIT: number;
    unpaidPIT: number;
    declarationCount: number;
  }> {
    return this.declarations$.pipe(
      map(list => {
        const yearDeclarations = list.filter(d => d.year === year);
        const paidDeclarations = yearDeclarations.filter(d => d.status === 'PAID');

        return {
          totalPIT: yearDeclarations.reduce((sum, d) => sum + d.summary.totalPITAmount, 0),
          paidPIT: paidDeclarations.reduce((sum, d) => sum + d.summary.totalPITAmount, 0),
          unpaidPIT: yearDeclarations.filter(d => d.status !== 'PAID' && d.status !== 'CANCELLED')
            .reduce((sum, d) => sum + d.summary.totalPITAmount, 0),
          declarationCount: yearDeclarations.length
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'PIT' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private initializeDemoData(): void {
    const demoDeclarations: PITDeclaration[] = [
      {
        id: 'PIT001',
        declarationNo: 'TNCN-202512',
        declarationType: 'MONTHLY',
        period: '12/2025',
        month: 12,
        year: 2025,
        details: [
          {
            id: 'PITD001',
            employeeId: 'EMP001',
            employeeCode: 'NV0001',
            employeeName: 'Nguyễn Văn An',
            taxCode: '8123456789',
            department: 'Kế toán',
            grossSalary: 25000000,
            insuranceDeduction: 1575000,
            taxableIncome: 23425000,
            personalDeduction: 11000000,
            dependentCount: 1,
            dependentDeduction: 4400000,
            totalDeduction: 15400000,
            taxableAmount: 8025000,
            pitAmount: 552500
          },
          {
            id: 'PITD002',
            employeeId: 'EMP002',
            employeeCode: 'NV0002',
            employeeName: 'Trần Thị Bích',
            taxCode: '8234567890',
            department: 'Kinh doanh',
            grossSalary: 18000000,
            insuranceDeduction: 1260000,
            taxableIncome: 16740000,
            personalDeduction: 11000000,
            dependentCount: 0,
            dependentDeduction: 0,
            totalDeduction: 11000000,
            taxableAmount: 5740000,
            pitAmount: 361000
          },
          {
            id: 'PITD003',
            employeeId: 'EMP003',
            employeeCode: 'NV0003',
            employeeName: 'Lê Văn Cường',
            department: 'Kho vận',
            grossSalary: 14000000,
            insuranceDeduction: 1050000,
            taxableIncome: 12950000,
            personalDeduction: 11000000,
            dependentCount: 2,
            dependentDeduction: 8800000,
            totalDeduction: 19800000,
            taxableAmount: 0,
            pitAmount: 0
          }
        ],
        summary: {
          employeeCount: 3,
          taxableEmployeeCount: 2,
          totalGrossSalary: 57000000,
          totalInsuranceDeduction: 3885000,
          totalTaxableIncome: 53115000,
          totalPersonalDeduction: 33000000,
          totalDependentDeduction: 13200000,
          totalTaxableAmount: 13765000,
          totalPITAmount: 913500
        },
        status: 'PAID',
        submissionDeadline: new Date(2026, 0, 20),
        submittedAt: new Date(2025, 11, 18),
        paidAt: new Date(2025, 11, 20),
        createdAt: new Date(2025, 11, 15),
        createdBy: 'admin'
      }
    ];

    this.declarations$.next(demoDeclarations);
  }
}
