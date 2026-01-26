import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Payroll,
  PayrollLine,
  PayrollStatus,
  PayrollSummary,
  generatePayrollNo,
  calculatePayrollSummary,
  calculateActualSalary,
  calculateEmployeeInsurance,
  calculateCompanyInsurance,
  calculateTaxableAmount,
  calculatePIT,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION
} from '../models/payroll.models';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private payrollsSubject = new BehaviorSubject<Payroll[]>([]);
  public payrolls$ = this.payrollsSubject.asObservable();

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════════

  getPayrolls(): Observable<Payroll[]> {
    return this.payrolls$;
  }

  getPayrollById(id: string): Observable<Payroll | undefined> {
    return this.payrolls$.pipe(
      map(list => list.find(p => p.id === id))
    );
  }

  getPayrollByPeriod(month: number, year: number): Observable<Payroll | undefined> {
    return this.payrolls$.pipe(
      map(list => list.find(p => p.month === month && p.year === year))
    );
  }

  getPayrollsByYear(year: number): Observable<Payroll[]> {
    return this.payrolls$.pipe(
      map(list => list.filter(p => p.year === year).sort((a, b) => b.month - a.month))
    );
  }

  createPayroll(month: number, year: number, lines: PayrollLine[]): Payroll {
    const payrolls = this.payrollsSubject.value;
    const standardDays = 26;

    // Calculate each line
    const calculatedLines = lines.map(line => this.calculatePayrollLine(line, standardDays));

    const newPayroll: Payroll = {
      id: `payroll_${Date.now()}`,
      payrollNo: generatePayrollNo(month, year),
      month,
      year,
      periodFrom: new Date(year, month - 1, 1),
      periodTo: new Date(year, month, 0),
      standardDays,
      lines: calculatedLines,
      summary: calculatePayrollSummary(calculatedLines),
      status: 'DRAFT',
      createdAt: new Date(),
      createdBy: 'admin'
    };

    this.payrollsSubject.next([...payrolls, newPayroll]);
    return newPayroll;
  }

  updatePayroll(id: string, data: Partial<Payroll>): boolean {
    const payrolls = this.payrollsSubject.value;
    const index = payrolls.findIndex(p => p.id === id);

    if (index === -1) return false;
    if (payrolls[index].status !== 'DRAFT') return false;

    // Recalculate if lines changed
    if (data.lines) {
      const standardDays = data.standardDays || payrolls[index].standardDays;
      data.lines = data.lines.map(line => this.calculatePayrollLine(line, standardDays));
      data.summary = calculatePayrollSummary(data.lines);
    }

    payrolls[index] = { ...payrolls[index], ...data };
    this.payrollsSubject.next([...payrolls]);
    return true;
  }

  deletePayroll(id: string): boolean {
    const payrolls = this.payrollsSubject.value;
    const payroll = payrolls.find(p => p.id === id);
    if (!payroll || payroll.status !== 'DRAFT') return false;

    this.payrollsSubject.next(payrolls.filter(p => p.id !== id));
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  approvePayroll(id: string): boolean {
    const payrolls = this.payrollsSubject.value;
    const index = payrolls.findIndex(p => p.id === id);

    if (index === -1 || payrolls[index].status !== 'DRAFT') return false;

    payrolls[index] = {
      ...payrolls[index],
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: 'admin'
    };

    this.payrollsSubject.next([...payrolls]);
    return true;
  }

  markAsPaid(id: string, paymentDate: Date): boolean {
    const payrolls = this.payrollsSubject.value;
    const index = payrolls.findIndex(p => p.id === id);

    if (index === -1 || payrolls[index].status !== 'APPROVED') return false;

    payrolls[index] = {
      ...payrolls[index],
      status: 'PAID',
      paymentDate,
      paidAt: new Date(),
      paidBy: 'admin'
    };

    this.payrollsSubject.next([...payrolls]);
    return true;
  }

  cancelPayroll(id: string): boolean {
    const payrolls = this.payrollsSubject.value;
    const index = payrolls.findIndex(p => p.id === id);

    if (index === -1) return false;
    if (payrolls[index].status === 'PAID') return false;

    payrolls[index] = {
      ...payrolls[index],
      status: 'CANCELLED'
    };

    this.payrollsSubject.next([...payrolls]);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  calculatePayrollLine(line: Partial<PayrollLine>, standardDays: number): PayrollLine {
    const workingDays = line.workingDays || standardDays;
    const baseSalary = line.baseSalary || 0;

    // Lương thực tế
    const actualSalary = calculateActualSalary(baseSalary, workingDays, standardDays);

    // Phụ cấp
    const allowances = line.allowances || {
      position: 0, responsibility: 0, lunch: 0, phone: 0, travel: 0, other: 0
    };
    const totalAllowances = Object.values(allowances).reduce((a, b) => a + b, 0);

    // Làm thêm giờ
    const overtimePay = line.overtimePay || 0;

    // Tổng thu nhập
    const grossSalary = actualSalary + totalAllowances + overtimePay;

    // Bảo hiểm NLĐ đóng (tính trên lương cơ bản)
    const empInsurance = calculateEmployeeInsurance(baseSalary);
    const insuranceDeductions = {
      socialInsurance: empInsurance.social,
      healthInsurance: empInsurance.health,
      unemploymentInsurance: empInsurance.unemployment
    };
    const totalInsuranceDeduction = empInsurance.total;

    // Thu nhập chịu thuế
    const taxableIncome = grossSalary - totalInsuranceDeduction;
    const dependentCount = 0; // Should come from employee data
    const dependentDeduction = dependentCount * DEPENDENT_DEDUCTION;

    // Thu nhập tính thuế
    const taxableAmount = calculateTaxableAmount(
      grossSalary,
      totalInsuranceDeduction,
      PERSONAL_DEDUCTION,
      dependentDeduction
    );

    // Thuế TNCN
    const pitAmount = calculatePIT(taxableAmount);

    // Các khoản trừ khác
    const otherDeductions = line.otherDeductions || {
      advance: 0, loan: 0, penalty: 0, other: 0
    };
    const totalOtherDeductions = Object.values(otherDeductions).reduce((a, b) => a + b, 0);

    // Tổng khấu trừ
    const totalDeductions = totalInsuranceDeduction + pitAmount + totalOtherDeductions;

    // Thực lĩnh
    const netSalary = grossSalary - totalDeductions;

    // Bảo hiểm công ty đóng
    const compInsurance = calculateCompanyInsurance(baseSalary);
    const companyInsurance = {
      socialInsurance: compInsurance.social,
      healthInsurance: compInsurance.health,
      unemploymentInsurance: compInsurance.unemployment,
      accidentInsurance: compInsurance.accident
    };
    const totalCompanyInsurance = compInsurance.total;

    // Tổng chi phí lao động
    const totalLaborCost = grossSalary + totalCompanyInsurance;

    return {
      id: line.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: line.employeeId || '',
      employeeCode: line.employeeCode || '',
      employeeName: line.employeeName || '',
      department: line.department,
      position: line.position,
      workingDays,
      standardDays,
      overtimeHours: line.overtimeHours || 0,
      leavedays: line.leavedays || 0,
      baseSalary,
      actualSalary,
      allowances,
      totalAllowances,
      overtimePay,
      grossSalary,
      insuranceDeductions,
      totalInsuranceDeduction,
      taxableIncome,
      personalDeduction: PERSONAL_DEDUCTION,
      dependentDeduction,
      taxableAmount,
      pitAmount,
      otherDeductions,
      totalOtherDeductions,
      totalDeductions,
      netSalary,
      companyInsurance,
      totalCompanyInsurance,
      totalLaborCost,
      notes: line.notes
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  getYearlySummary(year: number): Observable<{
    months: { month: number; summary: PayrollSummary | null }[];
    yearTotal: PayrollSummary;
  }> {
    return this.payrolls$.pipe(
      map(payrolls => {
        const yearPayrolls = payrolls.filter(p => p.year === year && p.status !== 'CANCELLED');

        const months = [];
        for (let m = 1; m <= 12; m++) {
          const payroll = yearPayrolls.find(p => p.month === m);
          months.push({
            month: m,
            summary: payroll ? payroll.summary : null
          });
        }

        // Year total
        const yearTotal: PayrollSummary = {
          employeeCount: 0,
          totalWorkingDays: 0,
          totalBaseSalary: 0,
          totalAllowances: 0,
          totalOvertimePay: 0,
          totalGrossSalary: 0,
          totalInsuranceDeduction: 0,
          totalPIT: 0,
          totalOtherDeductions: 0,
          totalDeductions: 0,
          totalNetSalary: 0,
          totalCompanyInsurance: 0,
          totalLaborCost: 0
        };

        yearPayrolls.forEach(p => {
          yearTotal.employeeCount = Math.max(yearTotal.employeeCount, p.summary.employeeCount);
          yearTotal.totalWorkingDays += p.summary.totalWorkingDays;
          yearTotal.totalBaseSalary += p.summary.totalBaseSalary;
          yearTotal.totalAllowances += p.summary.totalAllowances;
          yearTotal.totalOvertimePay += p.summary.totalOvertimePay;
          yearTotal.totalGrossSalary += p.summary.totalGrossSalary;
          yearTotal.totalInsuranceDeduction += p.summary.totalInsuranceDeduction;
          yearTotal.totalPIT += p.summary.totalPIT;
          yearTotal.totalOtherDeductions += p.summary.totalOtherDeductions;
          yearTotal.totalDeductions += p.summary.totalDeductions;
          yearTotal.totalNetSalary += p.summary.totalNetSalary;
          yearTotal.totalCompanyInsurance += p.summary.totalCompanyInsurance;
          yearTotal.totalLaborCost += p.summary.totalLaborCost;
        });

        return { months, yearTotal };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const now = new Date();
    const year = now.getFullYear();
    const lastMonth = now.getMonth(); // 0-indexed, so this is last month

    // Demo employees data
    const employees = [
      { id: 'emp_001', code: 'NV001', name: 'Nguyễn Văn An', dept: 'Kinh doanh', pos: 'Trưởng phòng', salary: 25000000 },
      { id: 'emp_002', code: 'NV002', name: 'Trần Thị Bình', dept: 'Kế toán', pos: 'Kế toán trưởng', salary: 20000000 },
      { id: 'emp_003', code: 'NV003', name: 'Lê Văn Cường', dept: 'Kinh doanh', pos: 'Nhân viên', salary: 12000000 },
      { id: 'emp_004', code: 'NV004', name: 'Phạm Thị Dung', dept: 'Kế toán', pos: 'Nhân viên', salary: 10000000 },
      { id: 'emp_005', code: 'NV005', name: 'Hoàng Văn Em', dept: 'Kho', pos: 'Thủ kho', salary: 9000000 }
    ];

    // Create last month's payroll
    const lines: PayrollLine[] = employees.map(emp => {
      return this.calculatePayrollLine({
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: emp.name,
        department: emp.dept,
        position: emp.pos,
        workingDays: 26,
        baseSalary: emp.salary,
        allowances: {
          position: emp.pos.includes('Trưởng') ? 2000000 : 0,
          responsibility: emp.pos.includes('Trưởng') ? 1000000 : 0,
          lunch: 800000,
          phone: emp.pos.includes('Trưởng') ? 500000 : 200000,
          travel: 500000,
          other: 0
        },
        overtimePay: 0
      }, 26);
    });

    const payroll: Payroll = {
      id: 'payroll_001',
      payrollNo: generatePayrollNo(lastMonth || 12, lastMonth === 0 ? year - 1 : year),
      month: lastMonth || 12,
      year: lastMonth === 0 ? year - 1 : year,
      periodFrom: new Date(lastMonth === 0 ? year - 1 : year, (lastMonth || 12) - 1, 1),
      periodTo: new Date(lastMonth === 0 ? year - 1 : year, lastMonth || 12, 0),
      standardDays: 26,
      lines,
      summary: calculatePayrollSummary(lines),
      status: 'PAID',
      paymentDate: new Date(year, lastMonth, 10),
      createdAt: new Date(year, lastMonth, 1),
      createdBy: 'admin',
      approvedAt: new Date(year, lastMonth, 5),
      approvedBy: 'admin',
      paidAt: new Date(year, lastMonth, 10),
      paidBy: 'admin'
    };

    this.payrollsSubject.next([payroll]);
  }
}
