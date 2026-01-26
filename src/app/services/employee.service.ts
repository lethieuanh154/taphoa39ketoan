import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Employee, EmployeeFilter, EmployeeStatus, EmployeeType, ContractType,
  generateEmployeeCode, Dependent, InsuranceInfo
} from '../models/employee.models';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private employees$ = new BehaviorSubject<Employee[]>([]);
  private sequenceNo = 10;

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getEmployees(): Observable<Employee[]> {
    return this.employees$.asObservable();
  }

  getEmployeeById(id: string): Observable<Employee | undefined> {
    return this.employees$.pipe(
      map(list => list.find(e => e.id === id))
    );
  }

  getEmployeeByCode(code: string): Observable<Employee | undefined> {
    return this.employees$.pipe(
      map(list => list.find(e => e.code === code))
    );
  }

  getActiveEmployees(): Observable<Employee[]> {
    return this.employees$.pipe(
      map(list => list.filter(e => e.status === 'WORKING'))
    );
  }

  filterEmployees(filter: EmployeeFilter): Observable<Employee[]> {
    return this.employees$.pipe(
      map(list => {
        let result = [...list];

        if (filter.search) {
          const search = filter.search.toLowerCase();
          result = result.filter(e =>
            e.code.toLowerCase().includes(search) ||
            e.fullName.toLowerCase().includes(search) ||
            e.phone.includes(search) ||
            e.idNumber.includes(search)
          );
        }

        if (filter.departmentId) {
          result = result.filter(e => e.departmentId === filter.departmentId);
        }

        if (filter.status) {
          result = result.filter(e => e.status === filter.status);
        }

        if (filter.employeeType) {
          result = result.filter(e => e.employeeType === filter.employeeType);
        }

        if (filter.contractType) {
          result = result.filter(e => e.contractType === filter.contractType);
        }

        return result;
      })
    );
  }

  createEmployee(data: Partial<Employee>): Observable<Employee> {
    const employees = this.employees$.getValue();

    const newEmployee: Employee = {
      id: this.generateId(),
      code: data.code || generateEmployeeCode(this.sequenceNo++),
      fullName: data.fullName || '',
      gender: data.gender || 'MALE',
      dateOfBirth: data.dateOfBirth || new Date(1990, 0, 1),
      placeOfBirth: data.placeOfBirth,
      nationality: data.nationality || 'Việt Nam',

      idNumber: data.idNumber || '',
      idIssueDate: data.idIssueDate,
      idIssuePlace: data.idIssuePlace,
      taxCode: data.taxCode,

      phone: data.phone || '',
      email: data.email,
      address: data.address,
      permanentAddress: data.permanentAddress,

      departmentId: data.departmentId,
      departmentName: data.departmentName,
      position: data.position || '',
      employeeType: data.employeeType || 'FULL_TIME',
      contractType: data.contractType || 'INDEFINITE',
      hireDate: data.hireDate || new Date(),
      contractStartDate: data.contractStartDate,
      contractEndDate: data.contractEndDate,
      resignDate: data.resignDate,

      baseSalary: data.baseSalary || 0,
      insuranceSalary: data.insuranceSalary || 0,
      salaryCoefficient: data.salaryCoefficient,

      insurance: data.insurance || {
        insuranceSalary: data.insuranceSalary || 0
      },

      dependents: data.dependents || [],

      bankAccount: data.bankAccount,

      salaryAccount: data.salaryAccount || '334',
      advanceAccount: data.advanceAccount || '141',

      status: data.status || 'WORKING',
      notes: data.notes,

      createdAt: new Date(),
      createdBy: 'system',
      updatedAt: new Date()
    };

    employees.push(newEmployee);
    this.employees$.next(employees);
    return of(newEmployee);
  }

  updateEmployee(id: string, data: Partial<Employee>): Observable<Employee | undefined> {
    const employees = this.employees$.getValue();
    const index = employees.findIndex(e => e.id === id);

    if (index === -1) return of(undefined);

    employees[index] = {
      ...employees[index],
      ...data,
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    this.employees$.next(employees);
    return of(employees[index]);
  }

  deleteEmployee(id: string): Observable<boolean> {
    const employees = this.employees$.getValue();
    const index = employees.findIndex(e => e.id === id);

    if (index === -1) return of(false);

    employees.splice(index, 1);
    this.employees$.next(employees);
    return of(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getStatistics(): Observable<{
    total: number;
    working: number;
    onLeave: number;
    resigned: number;
    totalSalary: number;
    avgSalary: number;
  }> {
    return this.employees$.pipe(
      map(list => {
        const working = list.filter(e => e.status === 'WORKING');
        const totalSalary = working.reduce((sum, e) => sum + e.baseSalary, 0);
        return {
          total: list.length,
          working: working.length,
          onLeave: list.filter(e => e.status === 'ON_LEAVE' || e.status === 'MATERNITY').length,
          resigned: list.filter(e => e.status === 'RESIGNED').length,
          totalSalary,
          avgSalary: working.length > 0 ? totalSalary / working.length : 0
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  checkCodeExists(code: string, excludeId?: string): Observable<boolean> {
    return this.employees$.pipe(
      map(list => list.some(e => e.code === code && e.id !== excludeId))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const demoEmployees: Employee[] = [
      {
        id: 'emp_001',
        code: 'NV0001',
        fullName: 'Nguyễn Văn An',
        gender: 'MALE',
        dateOfBirth: new Date(1985, 5, 15),
        placeOfBirth: 'Hà Nội',
        nationality: 'Việt Nam',
        idNumber: '001085012345',
        idIssueDate: new Date(2020, 0, 10),
        idIssuePlace: 'CA TP Hà Nội',
        taxCode: '8012345678',
        phone: '0901234567',
        email: 'nguyenvanan@company.com',
        address: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội',
        permanentAddress: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội',
        departmentId: 'dept_001',
        departmentName: 'Kế toán',
        position: 'Kế toán trưởng',
        employeeType: 'FULL_TIME',
        contractType: 'INDEFINITE',
        hireDate: new Date(2018, 2, 1),
        contractStartDate: new Date(2018, 5, 1),
        baseSalary: 25000000,
        insuranceSalary: 20000000,
        insurance: {
          socialInsuranceNo: 'BH0123456789',
          healthInsuranceNo: 'HS1234567890123',
          healthInsurancePlace: 'BV Bạch Mai',
          insuranceSalary: 20000000,
          socialInsuranceDate: new Date(2018, 2, 1),
          healthInsuranceDate: new Date(2018, 2, 1),
          unemploymentInsuranceDate: new Date(2018, 2, 1)
        },
        dependents: [
          {
            id: 'dep_001',
            fullName: 'Nguyễn Văn Bình',
            relationship: 'Con',
            dateOfBirth: new Date(2015, 8, 20),
            deductionFrom: new Date(2020, 0, 1),
            isActive: true
          }
        ],
        bankAccount: {
          bankCode: 'VCB',
          bankName: 'Vietcombank',
          accountNo: '0011234567890',
          accountName: 'NGUYEN VAN AN',
          branch: 'Chi nhánh Hà Nội'
        },
        salaryAccount: '334',
        advanceAccount: '141',
        status: 'WORKING',
        createdAt: new Date(2018, 2, 1),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'emp_002',
        code: 'NV0002',
        fullName: 'Trần Thị Bích',
        gender: 'FEMALE',
        dateOfBirth: new Date(1990, 11, 25),
        placeOfBirth: 'TP Hồ Chí Minh',
        nationality: 'Việt Nam',
        idNumber: '079090012345',
        idIssueDate: new Date(2021, 5, 15),
        idIssuePlace: 'CA TP HCM',
        taxCode: '8023456789',
        phone: '0912345678',
        email: 'tranthibich@company.com',
        address: '456 Lê Lợi, Quận 1, TP HCM',
        permanentAddress: '456 Lê Lợi, Quận 1, TP HCM',
        departmentId: 'dept_001',
        departmentName: 'Kế toán',
        position: 'Kế toán viên',
        employeeType: 'FULL_TIME',
        contractType: 'INDEFINITE',
        hireDate: new Date(2019, 6, 15),
        contractStartDate: new Date(2019, 9, 15),
        baseSalary: 15000000,
        insuranceSalary: 15000000,
        insurance: {
          socialInsuranceNo: 'BH0234567890',
          healthInsuranceNo: 'HS2345678901234',
          healthInsurancePlace: 'BV Chợ Rẫy',
          insuranceSalary: 15000000,
          socialInsuranceDate: new Date(2019, 6, 15),
          healthInsuranceDate: new Date(2019, 6, 15),
          unemploymentInsuranceDate: new Date(2019, 6, 15)
        },
        dependents: [],
        bankAccount: {
          bankCode: 'TCB',
          bankName: 'Techcombank',
          accountNo: '19012345678901',
          accountName: 'TRAN THI BICH',
          branch: 'Chi nhánh Quận 1'
        },
        salaryAccount: '334',
        advanceAccount: '141',
        status: 'WORKING',
        createdAt: new Date(2019, 6, 15),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'emp_003',
        code: 'NV0003',
        fullName: 'Lê Văn Cường',
        gender: 'MALE',
        dateOfBirth: new Date(1988, 3, 10),
        placeOfBirth: 'Đà Nẵng',
        nationality: 'Việt Nam',
        idNumber: '048088012345',
        idIssueDate: new Date(2019, 8, 20),
        idIssuePlace: 'CA TP Đà Nẵng',
        phone: '0923456789',
        email: 'levancuong@company.com',
        address: '789 Nguyễn Văn Linh, Đà Nẵng',
        departmentId: 'dept_002',
        departmentName: 'Kinh doanh',
        position: 'Trưởng phòng kinh doanh',
        employeeType: 'FULL_TIME',
        contractType: 'INDEFINITE',
        hireDate: new Date(2017, 0, 10),
        contractStartDate: new Date(2017, 3, 10),
        baseSalary: 22000000,
        insuranceSalary: 20000000,
        insurance: {
          socialInsuranceNo: 'BH0345678901',
          healthInsuranceNo: 'HS3456789012345',
          healthInsurancePlace: 'BV Đà Nẵng',
          insuranceSalary: 20000000,
          socialInsuranceDate: new Date(2017, 0, 10),
          healthInsuranceDate: new Date(2017, 0, 10),
          unemploymentInsuranceDate: new Date(2017, 0, 10)
        },
        dependents: [
          {
            id: 'dep_002',
            fullName: 'Lê Thị Dung',
            relationship: 'Vợ',
            dateOfBirth: new Date(1990, 7, 5),
            deductionFrom: new Date(2018, 0, 1),
            isActive: true
          },
          {
            id: 'dep_003',
            fullName: 'Lê Văn Đức',
            relationship: 'Con',
            dateOfBirth: new Date(2018, 11, 15),
            deductionFrom: new Date(2019, 0, 1),
            isActive: true
          }
        ],
        bankAccount: {
          bankCode: 'BIDV',
          bankName: 'BIDV',
          accountNo: '31234567890123',
          accountName: 'LE VAN CUONG',
          branch: 'Chi nhánh Đà Nẵng'
        },
        salaryAccount: '334',
        advanceAccount: '141',
        status: 'WORKING',
        createdAt: new Date(2017, 0, 10),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'emp_004',
        code: 'NV0004',
        fullName: 'Phạm Thị Duyên',
        gender: 'FEMALE',
        dateOfBirth: new Date(1995, 1, 28),
        placeOfBirth: 'Hải Phòng',
        nationality: 'Việt Nam',
        idNumber: '031095012345',
        idIssueDate: new Date(2022, 2, 10),
        idIssuePlace: 'CA TP Hải Phòng',
        phone: '0934567890',
        email: 'phamthiduyen@company.com',
        address: '321 Lạch Tray, Hải Phòng',
        departmentId: 'dept_003',
        departmentName: 'Nhân sự',
        position: 'Nhân viên nhân sự',
        employeeType: 'FULL_TIME',
        contractType: 'DEFINITE',
        hireDate: new Date(2023, 0, 15),
        contractStartDate: new Date(2023, 0, 15),
        contractEndDate: new Date(2025, 0, 14),
        baseSalary: 12000000,
        insuranceSalary: 12000000,
        insurance: {
          socialInsuranceNo: 'BH0456789012',
          healthInsuranceNo: 'HS4567890123456',
          healthInsurancePlace: 'BV Việt Tiệp',
          insuranceSalary: 12000000,
          socialInsuranceDate: new Date(2023, 0, 15),
          healthInsuranceDate: new Date(2023, 0, 15),
          unemploymentInsuranceDate: new Date(2023, 0, 15)
        },
        dependents: [],
        salaryAccount: '334',
        advanceAccount: '141',
        status: 'WORKING',
        createdAt: new Date(2023, 0, 15),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'emp_005',
        code: 'NV0005',
        fullName: 'Hoàng Văn Em',
        gender: 'MALE',
        dateOfBirth: new Date(1992, 6, 20),
        placeOfBirth: 'Nghệ An',
        nationality: 'Việt Nam',
        idNumber: '038092012345',
        idIssueDate: new Date(2020, 10, 5),
        idIssuePlace: 'CA tỉnh Nghệ An',
        phone: '0945678901',
        email: 'hoangvanem@company.com',
        address: '654 Trần Phú, Vinh, Nghệ An',
        departmentId: 'dept_002',
        departmentName: 'Kinh doanh',
        position: 'Nhân viên kinh doanh',
        employeeType: 'FULL_TIME',
        contractType: 'PROBATION',
        hireDate: new Date(2024, 10, 1),
        contractStartDate: new Date(2024, 10, 1),
        contractEndDate: new Date(2025, 1, 28),
        baseSalary: 8000000,
        insuranceSalary: 8000000,
        insurance: {
          insuranceSalary: 8000000
        },
        dependents: [],
        salaryAccount: '334',
        advanceAccount: '141',
        status: 'WORKING',
        createdAt: new Date(2024, 10, 1),
        createdBy: 'system',
        updatedAt: new Date()
      }
    ];

    this.employees$.next(demoEmployees);
  }
}
