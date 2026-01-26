import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { EmployeeService } from '../../services/employee.service';
import {
  Employee, EmployeeFilter, EmployeeStatus, EmployeeType, ContractType, Gender,
  GENDERS, CONTRACT_TYPES, EMPLOYEE_STATUSES, EMPLOYEE_TYPES,
  validateEmployee, Dependent, BankAccount, InsuranceInfo
} from '../../models/employee.models';

@Component({
  selector: 'app-employee-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-page.component.html',
  styleUrl: './employee-page.component.css'
})
export class EmployeePageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];

  // Filter
  filter: EmployeeFilter = {};
  searchText = '';

  // Statistics
  stats = {
    total: 0,
    working: 0,
    onLeave: 0,
    resigned: 0,
    totalSalary: 0,
    avgSalary: 0
  };

  // Modal
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  editingEmployee: Partial<Employee> = {};
  validationErrors: string[] = [];

  // Constants
  genders = GENDERS;
  contractTypes = CONTRACT_TYPES;
  employeeStatuses = EMPLOYEE_STATUSES;
  employeeTypes = EMPLOYEE_TYPES;

  // Loading
  isLoading = false;

  // Active tab in modal
  activeTab: 'info' | 'work' | 'salary' | 'insurance' | 'bank' = 'info';

  constructor(private employeeService: EmployeeService) {}

  ngOnInit(): void {
    this.loadEmployees();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadEmployees(): void {
    this.isLoading = true;
    this.employeeService.getEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe(employees => {
        this.employees = employees;
        this.applyFilter();
        this.isLoading = false;
      });
  }

  private loadStatistics(): void {
    this.employeeService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.employees];

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(e =>
        e.code.toLowerCase().includes(search) ||
        e.fullName.toLowerCase().includes(search) ||
        e.phone.includes(search) ||
        e.position.toLowerCase().includes(search)
      );
    }

    if (this.filter.status) {
      result = result.filter(e => e.status === this.filter.status);
    }

    if (this.filter.employeeType) {
      result = result.filter(e => e.employeeType === this.filter.employeeType);
    }

    if (this.filter.contractType) {
      result = result.filter(e => e.contractType === this.filter.contractType);
    }

    this.filteredEmployees = result;
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

  // ═══════════════════════════════════════════════════════════════════
  // MODAL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingEmployee = {
      gender: 'MALE',
      employeeType: 'FULL_TIME',
      contractType: 'INDEFINITE',
      status: 'WORKING',
      hireDate: new Date(),
      baseSalary: 0,
      insuranceSalary: 0,
      insurance: { insuranceSalary: 0 },
      dependents: [],
      salaryAccount: '334',
      advanceAccount: '141'
    };
    this.validationErrors = [];
    this.activeTab = 'info';
    this.showModal = true;
  }

  openEditModal(employee: Employee): void {
    this.modalMode = 'edit';
    this.editingEmployee = { ...employee };
    this.validationErrors = [];
    this.activeTab = 'info';
    this.showModal = true;
  }

  openViewModal(employee: Employee): void {
    this.modalMode = 'view';
    this.editingEmployee = { ...employee };
    this.activeTab = 'info';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingEmployee = {};
    this.validationErrors = [];
  }

  saveEmployee(): void {
    this.validationErrors = validateEmployee(this.editingEmployee);

    if (this.validationErrors.length > 0) {
      return;
    }

    if (this.modalMode === 'create') {
      this.employeeService.createEmployee(this.editingEmployee)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadEmployees();
          this.loadStatistics();
        });
    } else if (this.modalMode === 'edit' && this.editingEmployee.id) {
      this.employeeService.updateEmployee(this.editingEmployee.id, this.editingEmployee)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
          this.loadEmployees();
          this.loadStatistics();
        });
    }
  }

  deleteEmployee(employee: Employee): void {
    if (confirm(`Bạn có chắc muốn xóa nhân viên "${employee.fullName}"?`)) {
      this.employeeService.deleteEmployee(employee.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadEmployees();
          this.loadStatistics();
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEPENDENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  addDependent(): void {
    if (!this.editingEmployee.dependents) {
      this.editingEmployee.dependents = [];
    }
    this.editingEmployee.dependents.push({
      id: 'dep_' + Date.now(),
      fullName: '',
      relationship: 'Con',
      dateOfBirth: new Date(),
      deductionFrom: new Date(),
      isActive: true
    });
  }

  removeDependent(index: number): void {
    if (this.editingEmployee.dependents) {
      this.editingEmployee.dependents.splice(index, 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getStatusLabel(status: EmployeeStatus): string {
    return this.employeeStatuses.find(s => s.value === status)?.label || status;
  }

  getStatusClass(status: EmployeeStatus): string {
    switch (status) {
      case 'WORKING': return 'status-working';
      case 'ON_LEAVE': return 'status-leave';
      case 'MATERNITY': return 'status-maternity';
      case 'SUSPENDED': return 'status-suspended';
      case 'RESIGNED': return 'status-resigned';
      default: return '';
    }
  }

  getGenderLabel(gender: Gender): string {
    return this.genders.find(g => g.value === gender)?.label || gender;
  }

  getContractTypeLabel(type: ContractType): string {
    return this.contractTypes.find(t => t.value === type)?.label || type;
  }

  getEmployeeTypeLabel(type: EmployeeType): string {
    return this.employeeTypes.find(t => t.value === type)?.label || type;
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  onDateChange(field: string, dateString: string): void {
    if (dateString) {
      (this.editingEmployee as any)[field] = new Date(dateString);
    }
  }

  onDependentDateChange(index: number, field: string, dateString: string): void {
    if (this.editingEmployee.dependents && dateString) {
      (this.editingEmployee.dependents[index] as any)[field] = new Date(dateString);
    }
  }

  setTab(tab: 'info' | 'work' | 'salary' | 'insurance' | 'bank'): void {
    this.activeTab = tab;
  }

  getDependentCount(): number {
    return this.editingEmployee.dependents?.filter(d => d.isActive).length || 0;
  }
}
