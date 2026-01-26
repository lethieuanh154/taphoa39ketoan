import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  SalaryPayment,
  SalaryPaymentLine,
  SalaryPaymentStatus,
  PaymentMethod,
  generatePaymentNo,
  calculatePaymentSummary,
  SALARY_PAYMENT_ACCOUNTS
} from '../models/salary-payment.models';
import { Payroll, PayrollLine } from '../models/payroll.models';

@Injectable({
  providedIn: 'root'
})
export class SalaryPaymentService {
  private payments$ = new BehaviorSubject<SalaryPayment[]>([]);
  private sequenceCounter = 1;

  constructor() {
    this.initializeDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getPayments(): Observable<SalaryPayment[]> {
    return this.payments$.asObservable();
  }

  getPaymentsByYear(year: number): Observable<SalaryPayment[]> {
    return this.payments$.pipe(
      map(list => list.filter(p => p.payrollYear === year))
    );
  }

  getPaymentById(id: string): Observable<SalaryPayment | undefined> {
    return this.payments$.pipe(
      map(list => list.find(p => p.id === id))
    );
  }

  getPaymentsByPayroll(payrollId: string): Observable<SalaryPayment[]> {
    return this.payments$.pipe(
      map(list => list.filter(p => p.payrollId === payrollId))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE FROM PAYROLL
  // ═══════════════════════════════════════════════════════════════════════════════

  createFromPayroll(
    payroll: Payroll,
    paymentDate: Date,
    method: PaymentMethod,
    bankAccountId?: string
  ): SalaryPayment {
    const lines: SalaryPaymentLine[] = payroll.lines.map(pl => ({
      id: this.generateId(),
      employeeId: pl.employeeId,
      employeeCode: pl.employeeCode,
      employeeName: pl.employeeName,
      department: pl.department,
      netSalary: pl.netSalary,
      advanceAmount: pl.otherDeductions.advance,
      remainingAmount: pl.netSalary - pl.otherDeductions.advance,
      paymentAmount: pl.netSalary - pl.otherDeductions.advance,
      paymentMethod: method,
      notes: ''
    }));

    const payment: SalaryPayment = {
      id: this.generateId(),
      paymentNo: generatePaymentNo(paymentDate, this.sequenceCounter++),
      paymentDate,
      payrollId: payroll.id,
      payrollNo: payroll.payrollNo,
      payrollMonth: payroll.month,
      payrollYear: payroll.year,
      lines,
      summary: calculatePaymentSummary(lines),
      primaryMethod: method,
      bankAccountId,
      status: 'DRAFT',
      debitAccount: SALARY_PAYMENT_ACCOUNTS.salary,
      creditAccount: method === 'CASH' ? SALARY_PAYMENT_ACCOUNTS.cash : SALARY_PAYMENT_ACCOUNTS.bank,
      createdAt: new Date(),
      createdBy: 'admin'
    };

    const current = this.payments$.getValue();
    this.payments$.next([...current, payment]);
    return payment;
  }

  updatePayment(id: string, updates: Partial<SalaryPayment>): void {
    const current = this.payments$.getValue();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return;

    const payment = current[index];
    if (payment.status !== 'DRAFT') return;

    const updated = { ...payment, ...updates };
    if (updates.lines) {
      updated.summary = calculatePaymentSummary(updates.lines);
    }

    current[index] = updated;
    this.payments$.next([...current]);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  approvePayment(id: string): void {
    const current = this.payments$.getValue();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return;

    const payment = current[index];
    if (payment.status !== 'DRAFT') return;

    current[index] = {
      ...payment,
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: 'admin'
    };
    this.payments$.next([...current]);
  }

  markAsPaid(id: string, paidDate?: Date): void {
    const current = this.payments$.getValue();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return;

    const payment = current[index];
    if (payment.status !== 'APPROVED') return;

    current[index] = {
      ...payment,
      status: 'PAID',
      paidAt: paidDate || new Date(),
      paidBy: 'admin'
    };
    this.payments$.next([...current]);
  }

  cancelPayment(id: string): void {
    const current = this.payments$.getValue();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return;

    current[index] = {
      ...current[index],
      status: 'CANCELLED'
    };
    this.payments$.next([...current]);
  }

  deletePayment(id: string): void {
    const current = this.payments$.getValue();
    const payment = current.find(p => p.id === id);
    if (!payment || payment.status !== 'DRAFT') return;

    this.payments$.next(current.filter(p => p.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'SP' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private initializeDemoData(): void {
    const demoPayments: SalaryPayment[] = [
      {
        id: 'SP001',
        paymentNo: 'CTL-20251200001',
        paymentDate: new Date(2025, 0, 10),
        payrollId: 'PR001',
        payrollNo: 'BL-202512',
        payrollMonth: 12,
        payrollYear: 2025,
        lines: [
          {
            id: 'SPL001',
            employeeId: 'EMP001',
            employeeCode: 'NV0001',
            employeeName: 'Nguyễn Văn An',
            department: 'Kế toán',
            netSalary: 18500000,
            advanceAmount: 0,
            remainingAmount: 18500000,
            paymentAmount: 18500000,
            paymentMethod: 'BANK_TRANSFER',
            bankAccountNo: '1234567890',
            bankName: 'Vietcombank'
          },
          {
            id: 'SPL002',
            employeeId: 'EMP002',
            employeeCode: 'NV0002',
            employeeName: 'Trần Thị Bích',
            department: 'Kinh doanh',
            netSalary: 15200000,
            advanceAmount: 2000000,
            remainingAmount: 13200000,
            paymentAmount: 13200000,
            paymentMethod: 'BANK_TRANSFER',
            bankAccountNo: '0987654321',
            bankName: 'Techcombank'
          },
          {
            id: 'SPL003',
            employeeId: 'EMP003',
            employeeCode: 'NV0003',
            employeeName: 'Lê Văn Cường',
            department: 'Kho vận',
            netSalary: 12800000,
            advanceAmount: 0,
            remainingAmount: 12800000,
            paymentAmount: 12800000,
            paymentMethod: 'CASH'
          }
        ],
        summary: {
          employeeCount: 3,
          totalNetSalary: 46500000,
          totalAdvance: 2000000,
          totalRemaining: 44500000,
          totalPayment: 44500000,
          cashPayment: 12800000,
          bankTransfer: 31700000
        },
        primaryMethod: 'BANK_TRANSFER',
        bankAccountId: 'BA001',
        status: 'PAID',
        debitAccount: '334',
        creditAccount: '112',
        createdAt: new Date(2025, 0, 8),
        createdBy: 'admin',
        approvedAt: new Date(2025, 0, 9),
        approvedBy: 'giamdoc',
        paidAt: new Date(2025, 0, 10),
        paidBy: 'admin'
      }
    ];

    this.payments$.next(demoPayments);
    this.sequenceCounter = 2;
  }
}
