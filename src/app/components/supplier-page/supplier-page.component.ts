/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SUPPLIER PAGE COMPONENT - DANH MỤC NHÀ CUNG CẤP
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { SupplierService } from '../../services/supplier.service';
import {
  Supplier,
  SupplierType,
  SupplierGroup,
  SupplierStatus,
  SupplierFilter,
  SupplierContact,
  SupplierBankAccount,
  SUPPLIER_TYPES,
  SUPPLIER_GROUPS,
  SUPPLIER_STATUS,
  formatSupplierAddress
} from '../../models/supplier.models';

@Component({
  selector: 'app-supplier-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-page.component.html',
  styleUrl: './supplier-page.component.css'
})
export class SupplierPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  loading = false;

  filter: SupplierFilter = { search: '', status: 'ACTIVE' };
  selectedSupplier: Supplier | null = null;

  showCreateModal = false;
  showDetailModal = false;
  showDeleteConfirm = false;
  isEditMode = false;

  formData: Partial<Supplier> = {};
  formContacts: SupplierContact[] = [];
  formBankAccounts: SupplierBankAccount[] = [];

  supplierTypes = SUPPLIER_TYPES;
  supplierGroups = SUPPLIER_GROUPS;
  supplierStatus = SUPPLIER_STATUS;

  stats = {
    total: 0,
    active: 0,
    inactive: 0,
    byGroup: {} as Record<SupplierGroup, number>
  };

  constructor(private supplierService: SupplierService) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadStats();
    this.supplierService.loading$.pipe(takeUntil(this.destroy$)).subscribe(l => this.loading = l);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(suppliers => {
        this.suppliers = suppliers;
        this.filteredSuppliers = suppliers;
      });
  }

  loadStats(): void {
    this.supplierService.suppliers$.pipe(takeUntil(this.destroy$)).subscribe(suppliers => {
      this.stats.total = suppliers.length;
      this.stats.active = suppliers.filter(s => s.status === 'ACTIVE').length;
      this.stats.inactive = suppliers.filter(s => s.status === 'INACTIVE').length;
    });
    this.supplierService.getCountByGroup().pipe(takeUntil(this.destroy$)).subscribe(c => this.stats.byGroup = c);
  }

  onFilterChange(): void { this.loadSuppliers(); }
  onStatusFilterChange(status: SupplierStatus | ''): void {
    this.filter.status = status || undefined;
    this.loadSuppliers();
  }

  // CREATE / EDIT
  openCreateModal(): void {
    this.isEditMode = false;
    this.supplierService.getNextSupplierCode().pipe(takeUntil(this.destroy$)).subscribe(code => {
      this.formData = {
        code,
        supplierType: 'OTHER',
        supplierGroup: 'GOODS',
        status: 'ACTIVE',
        paymentTermDays: 0,
        accountCode: '331'
      };
      this.formContacts = [];
      this.formBankAccounts = [];
      this.showCreateModal = true;
    });
  }

  openEditModal(supplier: Supplier): void {
    this.isEditMode = true;
    this.selectedSupplier = supplier;
    this.formData = { ...supplier };
    this.formContacts = [...(supplier.contacts || [])];
    this.formBankAccounts = [...(supplier.bankAccounts || [])];
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.formData = {};
    this.formContacts = [];
    this.formBankAccounts = [];
    this.selectedSupplier = null;
    this.isEditMode = false;
  }

  addContact(): void { this.formContacts.push({ name: '', position: '', phone: '', email: '' }); }
  removeContact(i: number): void { this.formContacts.splice(i, 1); }
  addBankAccount(): void { this.formBankAccounts.push({ bankName: '', accountNumber: '', accountHolder: '', branch: '' }); }
  removeBankAccount(i: number): void { this.formBankAccounts.splice(i, 1); }

  saveSupplier(): void {
    if (!this.validateForm()) return;
    const data: Partial<Supplier> = {
      ...this.formData,
      contacts: this.formContacts.filter(c => c.name),
      bankAccounts: this.formBankAccounts.filter(b => b.bankName && b.accountNumber)
    };

    const obs = this.isEditMode && this.selectedSupplier
      ? this.supplierService.updateSupplier(this.selectedSupplier.id, data)
      : this.supplierService.createSupplier(data);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.closeCreateModal(); this.loadSuppliers(); this.loadStats(); },
      error: (err) => alert(err.message)
    });
  }

  validateForm(): boolean {
    if (!this.formData.code?.trim()) { alert('Vui lòng nhập mã NCC'); return false; }
    if (!this.formData.name?.trim()) { alert('Vui lòng nhập tên NCC'); return false; }
    if (!this.formData.address?.trim()) { alert('Vui lòng nhập địa chỉ'); return false; }
    return true;
  }

  // VIEW / DELETE
  viewDetail(supplier: Supplier): void { this.selectedSupplier = supplier; this.showDetailModal = true; }
  closeDetailModal(): void { this.showDetailModal = false; this.selectedSupplier = null; }

  confirmDelete(supplier: Supplier): void { this.selectedSupplier = supplier; this.showDeleteConfirm = true; }
  deleteSupplier(): void {
    if (!this.selectedSupplier) return;
    this.supplierService.deleteSupplier(this.selectedSupplier.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.showDeleteConfirm = false; this.selectedSupplier = null; this.loadSuppliers(); this.loadStats(); },
      error: (err) => alert(err.message)
    });
  }

  // UTILITIES
  getSupplierTypeLabel(type: SupplierType): string { return SUPPLIER_TYPES.find(t => t.value === type)?.label || type; }
  getSupplierGroupLabel(group: SupplierGroup): string { return SUPPLIER_GROUPS.find(g => g.value === group)?.label || group; }
  getStatusLabel(status: SupplierStatus): string { return status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng HĐ'; }
  getStatusClass(status: SupplierStatus): string { return status === 'ACTIVE' ? 'status-active' : 'status-inactive'; }
  formatCurrency(amount: number | undefined): string {
    if (!amount) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
  formatFullAddress(supplier: Supplier): string { return formatSupplierAddress(supplier); }
}
