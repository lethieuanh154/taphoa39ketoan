import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  InsuranceReport,
  InsuranceDetail,
  InsuranceReportStatus,
  generateReportNo,
  calculateEmployeeContribution,
  calculateCompanyContribution,
  calculateInsuranceSummary,
  getSubmissionDeadline
} from '../models/insurance.models';
import { Employee } from '../models/employee.models';

@Injectable({
  providedIn: 'root'
})
export class InsuranceService {
  private reports$ = new BehaviorSubject<InsuranceReport[]>([]);

  constructor() {
    this.initializeDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getReports(): Observable<InsuranceReport[]> {
    return this.reports$.asObservable();
  }

  getReportsByYear(year: number): Observable<InsuranceReport[]> {
    return this.reports$.pipe(
      map(list => list.filter(r => r.year === year))
    );
  }

  getReportById(id: string): Observable<InsuranceReport | undefined> {
    return this.reports$.pipe(
      map(list => list.find(r => r.id === id))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE FROM EMPLOYEES
  // ═══════════════════════════════════════════════════════════════════════════════

  createReport(month: number, year: number, employees: Employee[]): InsuranceReport {
    const details: InsuranceDetail[] = employees.map(emp => {
      const empContrib = calculateEmployeeContribution(emp.insuranceSalary);
      const compContrib = calculateCompanyContribution(emp.insuranceSalary);

      return {
        id: this.generateId(),
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: emp.fullName,
        department: emp.departmentName,
        socialInsuranceNo: emp.insurance.socialInsuranceNo,
        healthInsuranceNo: emp.insurance.healthInsuranceNo,
        insuranceSalary: emp.insuranceSalary,
        employeeSocial: empContrib.social,
        employeeHealth: empContrib.health,
        employeeUnemployment: empContrib.unemployment,
        totalEmployeeContribution: empContrib.total,
        companySocial: compContrib.social,
        companyHealth: compContrib.health,
        companyUnemployment: compContrib.unemployment,
        companyAccident: compContrib.accident,
        totalCompanyContribution: compContrib.total,
        totalContribution: empContrib.total + compContrib.total
      };
    });

    const report: InsuranceReport = {
      id: this.generateId(),
      reportNo: generateReportNo(month, year),
      reportType: 'MONTHLY',
      month,
      year,
      details,
      summary: calculateInsuranceSummary(details),
      status: 'DRAFT',
      submissionDeadline: getSubmissionDeadline(month, year),
      createdAt: new Date(),
      createdBy: 'admin'
    };

    const current = this.reports$.getValue();
    this.reports$.next([...current, report]);
    return report;
  }

  updateReport(id: string, updates: Partial<InsuranceReport>): void {
    const current = this.reports$.getValue();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return;

    const report = current[index];
    if (report.status !== 'DRAFT') return;

    const updated = { ...report, ...updates };
    if (updates.details) {
      updated.summary = calculateInsuranceSummary(updates.details);
    }

    current[index] = updated;
    this.reports$.next([...current]);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  submitReport(id: string): void {
    const current = this.reports$.getValue();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'SUBMITTED',
      submittedAt: new Date()
    };
    this.reports$.next([...current]);
  }

  approveReport(id: string): void {
    const current = this.reports$.getValue();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return;

    if (current[index].status !== 'SUBMITTED') return;

    current[index] = {
      ...current[index],
      status: 'APPROVED'
    };
    this.reports$.next([...current]);
  }

  markAsPaid(id: string, paidDate?: Date): void {
    const current = this.reports$.getValue();
    const index = current.findIndex(r => r.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'PAID',
      paidAt: paidDate || new Date()
    };
    this.reports$.next([...current]);
  }

  deleteReport(id: string): void {
    const current = this.reports$.getValue();
    const report = current.find(r => r.id === id);
    if (!report || report.status !== 'DRAFT') return;

    this.reports$.next(current.filter(r => r.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getYearSummary(year: number): Observable<{
    totalSocial: number;
    totalHealth: number;
    totalUnemployment: number;
    totalAccident: number;
    grandTotal: number;
    paidTotal: number;
    unpaidTotal: number;
  }> {
    return this.reports$.pipe(
      map(list => {
        const yearReports = list.filter(r => r.year === year);
        const paidReports = yearReports.filter(r => r.status === 'PAID');

        return {
          totalSocial: yearReports.reduce((sum, r) => sum + r.summary.bySocialInsurance, 0),
          totalHealth: yearReports.reduce((sum, r) => sum + r.summary.byHealthInsurance, 0),
          totalUnemployment: yearReports.reduce((sum, r) => sum + r.summary.byUnemploymentInsurance, 0),
          totalAccident: yearReports.reduce((sum, r) => sum + r.summary.byAccidentInsurance, 0),
          grandTotal: yearReports.reduce((sum, r) => sum + r.summary.grandTotal, 0),
          paidTotal: paidReports.reduce((sum, r) => sum + r.summary.grandTotal, 0),
          unpaidTotal: yearReports.filter(r => r.status !== 'PAID').reduce((sum, r) => sum + r.summary.grandTotal, 0)
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'INS' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private initializeDemoData(): void {
    const demoReports: InsuranceReport[] = [
      {
        id: 'INS001',
        reportNo: 'BHXH-202512',
        reportType: 'MONTHLY',
        month: 12,
        year: 2025,
        details: [
          {
            id: 'INSD001',
            employeeId: 'EMP001',
            employeeCode: 'NV0001',
            employeeName: 'Nguyễn Văn An',
            department: 'Kế toán',
            socialInsuranceNo: 'SH123456789',
            healthInsuranceNo: 'DN1234567890123',
            insuranceSalary: 15000000,
            employeeSocial: 1200000,
            employeeHealth: 225000,
            employeeUnemployment: 150000,
            totalEmployeeContribution: 1575000,
            companySocial: 2625000,
            companyHealth: 450000,
            companyUnemployment: 150000,
            companyAccident: 75000,
            totalCompanyContribution: 3300000,
            totalContribution: 4875000
          },
          {
            id: 'INSD002',
            employeeId: 'EMP002',
            employeeCode: 'NV0002',
            employeeName: 'Trần Thị Bích',
            department: 'Kinh doanh',
            socialInsuranceNo: 'SH234567890',
            healthInsuranceNo: 'DN2345678901234',
            insuranceSalary: 12000000,
            employeeSocial: 960000,
            employeeHealth: 180000,
            employeeUnemployment: 120000,
            totalEmployeeContribution: 1260000,
            companySocial: 2100000,
            companyHealth: 360000,
            companyUnemployment: 120000,
            companyAccident: 60000,
            totalCompanyContribution: 2640000,
            totalContribution: 3900000
          },
          {
            id: 'INSD003',
            employeeId: 'EMP003',
            employeeCode: 'NV0003',
            employeeName: 'Lê Văn Cường',
            department: 'Kho vận',
            socialInsuranceNo: 'SH345678901',
            healthInsuranceNo: 'DN3456789012345',
            insuranceSalary: 10000000,
            employeeSocial: 800000,
            employeeHealth: 150000,
            employeeUnemployment: 100000,
            totalEmployeeContribution: 1050000,
            companySocial: 1750000,
            companyHealth: 300000,
            companyUnemployment: 100000,
            companyAccident: 50000,
            totalCompanyContribution: 2200000,
            totalContribution: 3250000
          }
        ],
        summary: {
          employeeCount: 3,
          totalInsuranceSalary: 37000000,
          totalEmployeeSocial: 2960000,
          totalEmployeeHealth: 555000,
          totalEmployeeUnemployment: 370000,
          totalEmployeeContribution: 3885000,
          totalCompanySocial: 6475000,
          totalCompanyHealth: 1110000,
          totalCompanyUnemployment: 370000,
          totalCompanyAccident: 185000,
          totalCompanyContribution: 8140000,
          grandTotal: 12025000,
          bySocialInsurance: 9435000,
          byHealthInsurance: 1665000,
          byUnemploymentInsurance: 740000,
          byAccidentInsurance: 185000
        },
        status: 'PAID',
        submissionDeadline: new Date(2026, 0, 20),
        submittedAt: new Date(2025, 11, 18),
        paidAt: new Date(2025, 11, 20),
        createdAt: new Date(2025, 11, 15),
        createdBy: 'admin'
      }
    ];

    this.reports$.next(demoReports);
  }
}
