import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WarehouseService } from '../../services/warehouse.service';
import { ProductService } from '../../services/product.service';
import { CustomerService } from '../../services/customer.service';
import { SupplierService } from '../../services/supplier.service';

import {
  WarehouseVoucher,
  WarehouseVoucherLine,
  WarehouseVoucherType,
  WarehouseVoucherStatus,
  WarehouseVoucherFilter,
  WarehouseVoucherSummary,
  ReceiptType,
  IssueType,
  Warehouse,
  RECEIPT_TYPE_LABELS,
  ISSUE_TYPE_LABELS,
  VOUCHER_STATUS_LABELS,
  createEmptyWarehouseVoucher,
  createEmptyVoucherLine
} from '../../models/warehouse.models';
import { Product } from '../../models/product.models';

@Component({
  selector: 'app-warehouse-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-page.component.html',
  styleUrl: './warehouse-page.component.css'
})
export class WarehousePageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Page config
  voucherType: WarehouseVoucherType = 'RECEIPT';
  pageTitle = 'Phiếu Nhập Kho';
  pageSubtitle = 'Quản lý phiếu nhập kho hàng hóa';

  // Data
  vouchers: WarehouseVoucher[] = [];
  filteredVouchers: WarehouseVoucher[] = [];
  summary: WarehouseVoucherSummary = {
    totalVouchers: 0, draftCount: 0, postedCount: 0, cancelledCount: 0,
    totalQuantity: 0, totalAmount: 0
  };

  // Dropdowns
  warehouses: Warehouse[] = [];
  products: Product[] = [];
  partners: { id: string; code: string; name: string }[] = [];

  // Filter
  filter: WarehouseVoucherFilter = {};
  statusFilter: WarehouseVoucherStatus | '' = '';
  searchText = '';

  // Modals
  showCreateModal = false;
  showDetailModal = false;
  showJournalModal = false;
  showCancelModal = false;

  // Form data
  editingVoucher: Partial<WarehouseVoucher> = {};
  selectedVoucher: WarehouseVoucher | null = null;
  cancelReason = '';

  // New line form
  newLine: Partial<WarehouseVoucherLine> = {};
  selectedProductId = '';

  // Loading
  isLoading = false;
  isSaving = false;

  // Labels
  receiptTypeLabels = RECEIPT_TYPE_LABELS;
  issueTypeLabels = ISSUE_TYPE_LABELS;
  statusLabels = VOUCHER_STATUS_LABELS;

  constructor(
    private route: ActivatedRoute,
    private warehouseService: WarehouseService,
    private productService: ProductService,
    private customerService: CustomerService,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    // Get voucher type from route
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.voucherType = data['type'] || 'RECEIPT';
      this.updatePageConfig();
      this.loadData();
    });

    // Load dropdowns
    this.loadWarehouses();
    this.loadProducts();
    this.loadPartners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAGE CONFIG
  // ═══════════════════════════════════════════════════════════════════

  private updatePageConfig(): void {
    if (this.voucherType === 'RECEIPT') {
      this.pageTitle = 'Phiếu Nhập Kho';
      this.pageSubtitle = 'Quản lý phiếu nhập kho hàng hóa, nguyên vật liệu';
    } else {
      this.pageTitle = 'Phiếu Xuất Kho';
      this.pageSubtitle = 'Quản lý phiếu xuất kho bán hàng, sử dụng';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadData(): void {
    this.isLoading = true;

    this.warehouseService.getVouchers({ voucherType: this.voucherType })
      .pipe(takeUntil(this.destroy$))
      .subscribe(vouchers => {
        this.vouchers = vouchers.sort((a, b) => b.voucherDate.getTime() - a.voucherDate.getTime());
        this.applyFilter();
        this.isLoading = false;
      });

    this.warehouseService.getSummary(this.voucherType)
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.summary = summary;
      });
  }

  private loadWarehouses(): void {
    this.warehouseService.getActiveWarehouses()
      .pipe(takeUntil(this.destroy$))
      .subscribe(warehouses => {
        this.warehouses = warehouses;
      });
  }

  private loadProducts(): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products.filter(p => p.status === 'ACTIVE' && p.productType !== 'SERVICE');
      });
  }

  private loadPartners(): void {
    if (this.voucherType === 'RECEIPT') {
      // Load suppliers for receipt
      this.supplierService.getSupplierDropdown()
        .pipe(takeUntil(this.destroy$))
        .subscribe(suppliers => {
          this.partners = suppliers;
        });
    } else {
      // Load customers for issue
      this.customerService.getCustomerDropdown()
        .pipe(takeUntil(this.destroy$))
        .subscribe(customers => {
          this.partners = customers;
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.vouchers];

    if (this.statusFilter) {
      result = result.filter(v => v.status === this.statusFilter);
    }

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(v =>
        v.voucherNo.toLowerCase().includes(search) ||
        v.partnerName?.toLowerCase().includes(search) ||
        v.description?.toLowerCase().includes(search) ||
        v.lines.some(l => l.productCode.toLowerCase().includes(search) || l.productName.toLowerCase().includes(search))
      );
    }

    if (this.filter.fromDate) {
      result = result.filter(v => v.voucherDate >= this.filter.fromDate!);
    }

    if (this.filter.toDate) {
      result = result.filter(v => v.voucherDate <= this.filter.toDate!);
    }

    if (this.filter.warehouseCode) {
      result = result.filter(v => v.warehouseCode === this.filter.warehouseCode);
    }

    this.filteredVouchers = result;
  }

  onSearch(): void {
    this.applyFilter();
  }

  onStatusFilterChange(): void {
    this.applyFilter();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.searchText = '';
    this.filter = {};
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE / EDIT
  // ═══════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.editingVoucher = {
      ...createEmptyWarehouseVoucher(this.voucherType),
      voucherNo: this.warehouseService.getNextVoucherNo(this.voucherType),
      receiptType: this.voucherType === 'RECEIPT' ? 'PURCHASE' : undefined,
      issueType: this.voucherType === 'ISSUE' ? 'SALE' : undefined
    };
    this.newLine = createEmptyVoucherLine();
    this.selectedProductId = '';
    this.showCreateModal = true;
  }

  openEditModal(voucher: WarehouseVoucher): void {
    if (voucher.status !== 'DRAFT') return;
    this.editingVoucher = JSON.parse(JSON.stringify(voucher));
    this.newLine = createEmptyVoucherLine();
    this.selectedProductId = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.editingVoucher = {};
    this.newLine = {};
  }

  onWarehouseChange(): void {
    const warehouse = this.warehouses.find(w => w.code === this.editingVoucher.warehouseCode);
    if (warehouse) {
      this.editingVoucher.warehouseName = warehouse.name;
      this.editingVoucher.keeper = warehouse.keeper;
    }
  }

  onPartnerChange(): void {
    const partner = this.partners.find(p => p.id === this.editingVoucher.partnerId);
    if (partner) {
      this.editingVoucher.partnerCode = partner.code;
      this.editingVoucher.partnerName = partner.name;
    }
  }

  onReceiptTypeChange(): void {
    // Update journal accounts based on receipt type
  }

  onIssueTypeChange(): void {
    // Update journal accounts based on issue type
  }

  // ═══════════════════════════════════════════════════════════════════
  // LINE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  onProductSelect(): void {
    const product = this.products.find(p => p.id === this.selectedProductId);
    if (product) {
      this.newLine = {
        ...createEmptyVoucherLine(),
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        unitPrice: this.voucherType === 'RECEIPT' ? product.costPrice : product.costPrice,
        inventoryAccount: product.inventoryAccount || '156'
      };
    }
  }

  calculateLineAmount(): void {
    if (this.newLine.quantity && this.newLine.unitPrice) {
      this.newLine.amount = Math.round(this.newLine.quantity * this.newLine.unitPrice);
    }
  }

  addLineToVoucher(): void {
    if (!this.newLine.productId || !this.newLine.quantity || this.newLine.quantity <= 0) {
      return;
    }

    const line: WarehouseVoucherLine = {
      ...this.newLine,
      id: `WHL-${Date.now()}`,
      lineNo: (this.editingVoucher.lines?.length || 0) + 1,
      amount: Math.round((this.newLine.quantity || 0) * (this.newLine.unitPrice || 0))
    } as WarehouseVoucherLine;

    if (!this.editingVoucher.lines) {
      this.editingVoucher.lines = [];
    }
    this.editingVoucher.lines.push(line);
    this.recalculateTotals();

    // Reset form
    this.newLine = createEmptyVoucherLine();
    this.selectedProductId = '';
  }

  removeLine(index: number): void {
    if (this.editingVoucher.lines) {
      this.editingVoucher.lines.splice(index, 1);
      // Renumber
      this.editingVoucher.lines.forEach((l, i) => l.lineNo = i + 1);
      this.recalculateTotals();
    }
  }

  recalculateTotals(): void {
    if (this.editingVoucher.lines) {
      this.editingVoucher.totalQuantity = this.editingVoucher.lines.reduce((sum, l) => sum + l.quantity, 0);
      this.editingVoucher.totalAmount = this.editingVoucher.lines.reduce((sum, l) => sum + l.amount, 0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════

  saveVoucher(): void {
    if (!this.editingVoucher.warehouseCode || !this.editingVoucher.lines?.length) {
      return;
    }

    this.isSaving = true;

    if (this.editingVoucher.id) {
      // Update
      this.warehouseService.updateVoucher(this.editingVoucher.id, this.editingVoucher)
        .subscribe({
          next: () => {
            this.loadData();
            this.closeCreateModal();
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          }
        });
    } else {
      // Create
      this.warehouseService.createVoucher(this.editingVoucher)
        .subscribe({
          next: () => {
            this.loadData();
            this.closeCreateModal();
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          }
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // VIEW DETAIL
  // ═══════════════════════════════════════════════════════════════════

  viewDetail(voucher: WarehouseVoucher): void {
    this.selectedVoucher = voucher;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedVoucher = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // JOURNAL ENTRY
  // ═══════════════════════════════════════════════════════════════════

  viewJournal(voucher: WarehouseVoucher): void {
    this.selectedVoucher = voucher;
    this.showJournalModal = true;
  }

  closeJournalModal(): void {
    this.showJournalModal = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  postVoucher(voucher: WarehouseVoucher): void {
    if (voucher.status !== 'DRAFT') return;

    this.warehouseService.postVoucher(voucher.id)
      .subscribe(() => {
        this.loadData();
        if (this.showDetailModal) {
          this.warehouseService.getVoucherById(voucher.id).subscribe(v => {
            if (v) this.selectedVoucher = v;
          });
        }
      });
  }

  openCancelModal(voucher: WarehouseVoucher): void {
    this.selectedVoucher = voucher;
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelReason = '';
  }

  confirmCancel(): void {
    if (!this.selectedVoucher || !this.cancelReason) return;

    this.warehouseService.cancelVoucher(this.selectedVoucher.id, this.cancelReason)
      .subscribe(() => {
        this.loadData();
        this.closeCancelModal();
        this.closeDetailModal();
      });
  }

  deleteVoucher(voucher: WarehouseVoucher): void {
    if (voucher.status !== 'DRAFT') return;

    if (confirm('Bạn có chắc muốn xóa phiếu này?')) {
      this.warehouseService.deleteVoucher(voucher.id)
        .subscribe(() => {
          this.loadData();
        });
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
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatDateTime(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('vi-VN');
  }

  parseDate(dateString: string): Date | undefined {
    return dateString ? new Date(dateString) : undefined;
  }

  onVoucherDateChange(dateString: string): void {
    this.editingVoucher.voucherDate = this.parseDate(dateString);
  }

  onRefVoucherDateChange(dateString: string): void {
    this.editingVoucher.refVoucherDate = this.parseDate(dateString);
  }

  getStatusClass(status: WarehouseVoucherStatus): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'POSTED': return 'status-posted';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  getReceiptTypeLabel(type: ReceiptType | undefined): string {
    return type ? this.receiptTypeLabels[type] : '';
  }

  getIssueTypeLabel(type: IssueType | undefined): string {
    return type ? this.issueTypeLabels[type] : '';
  }

  getSubTypeLabel(voucher: WarehouseVoucher): string {
    if (voucher.voucherType === 'RECEIPT') {
      return this.getReceiptTypeLabel(voucher.receiptType);
    } else {
      return this.getIssueTypeLabel(voucher.issueType);
    }
  }

  get receiptTypes(): ReceiptType[] {
    return Object.keys(this.receiptTypeLabels) as ReceiptType[];
  }

  get issueTypes(): IssueType[] {
    return Object.keys(this.issueTypeLabels) as IssueType[];
  }
}
