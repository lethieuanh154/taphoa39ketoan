import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { WarehouseService } from '../../services/warehouse.service';
import { Product, PRODUCT_TYPES, PRODUCT_GROUPS } from '../../models/product.models';
import { Warehouse } from '../../models/warehouse.models';

interface InventoryLine {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  productType: string;
  productGroup: string;
  openingQty: number;
  openingAmount: number;
  receiptQty: number;
  receiptAmount: number;
  issueQty: number;
  issueAmount: number;
  closingQty: number;
  closingAmount: number;
}

interface InventorySummary {
  totalProducts: number;
  openingAmount: number;
  receiptAmount: number;
  issueAmount: number;
  closingAmount: number;
}

@Component({
  selector: 'app-inventory-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-report-page.component.html',
  styleUrl: './inventory-report-page.component.css'
})
export class InventoryReportPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  inventoryLines: InventoryLine[] = [];
  filteredLines: InventoryLine[] = [];
  products: Product[] = [];
  warehouses: Warehouse[] = [];

  // Filter
  selectedWarehouseCode = '';
  filterProductType = '';
  filterProductGroup = '';
  searchText = '';
  fromDate: Date;
  toDate: Date;

  // Summary
  summary: InventorySummary = {
    totalProducts: 0,
    openingAmount: 0,
    receiptAmount: 0,
    issueAmount: 0,
    closingAmount: 0
  };

  // Labels
  productTypesList = PRODUCT_TYPES;
  productGroupsList = PRODUCT_GROUPS;

  // Loading
  isLoading = false;

  constructor(
    private productService: ProductService,
    private warehouseService: WarehouseService
  ) {
    // Default: current month
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadWarehouses(): void {
    this.warehouseService.getActiveWarehouses()
      .pipe(takeUntil(this.destroy$))
      .subscribe(warehouses => {
        this.warehouses = warehouses;
      });
  }

  loadData(): void {
    this.isLoading = true;

    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products.filter(p => p.status === 'ACTIVE' && p.productType !== 'SERVICE');
        this.generateInventoryReport();
        this.isLoading = false;
      });
  }

  private generateInventoryReport(): void {
    // In real app, this would query warehouse vouchers to calculate actual movements
    // For demo, using product currentStock as basis

    this.inventoryLines = this.products.map(p => ({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      unit: p.unit,
      productType: p.productType,
      productGroup: p.productGroup,
      openingQty: Math.max(0, p.currentStock - 10), // Demo: simulated opening
      openingAmount: Math.max(0, p.currentStock - 10) * p.costPrice,
      receiptQty: 20, // Demo: simulated receipt
      receiptAmount: 20 * p.costPrice,
      issueQty: 10, // Demo: simulated issue
      issueAmount: 10 * p.costPrice,
      closingQty: p.currentStock,
      closingAmount: p.currentStock * p.costPrice
    }));

    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════

  applyFilter(): void {
    let result = [...this.inventoryLines];

    if (this.filterProductType) {
      result = result.filter(l => l.productType === this.filterProductType);
    }

    if (this.filterProductGroup) {
      result = result.filter(l => l.productGroup === this.filterProductGroup);
    }

    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      result = result.filter(l =>
        l.productCode.toLowerCase().includes(search) ||
        l.productName.toLowerCase().includes(search)
      );
    }

    this.filteredLines = result;
    this.calculateSummary();
  }

  private calculateSummary(): void {
    this.summary = {
      totalProducts: this.filteredLines.length,
      openingAmount: this.filteredLines.reduce((sum, l) => sum + l.openingAmount, 0),
      receiptAmount: this.filteredLines.reduce((sum, l) => sum + l.receiptAmount, 0),
      issueAmount: this.filteredLines.reduce((sum, l) => sum + l.issueAmount, 0),
      closingAmount: this.filteredLines.reduce((sum, l) => sum + l.closingAmount, 0)
    };
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  onSearch(): void {
    this.applyFilter();
  }

  clearFilters(): void {
    this.filterProductType = '';
    this.filterProductGroup = '';
    this.searchText = '';
    this.applyFilter();
  }

  setDateRange(range: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear'): void {
    const now = new Date();

    switch (range) {
      case 'thisMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        this.toDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        this.fromDate = new Date(now.getFullYear(), quarter * 3, 1);
        this.toDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'thisYear':
        this.fromDate = new Date(now.getFullYear(), 0, 1);
        this.toDate = new Date(now.getFullYear(), 11, 31);
        break;
    }

    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════

  exportToExcel(): void {
    const headers = ['STT', 'Mã hàng', 'Tên hàng hóa', 'ĐVT', 'Tồn đầu SL', 'Tồn đầu TT', 'Nhập SL', 'Nhập TT', 'Xuất SL', 'Xuất TT', 'Tồn cuối SL', 'Tồn cuối TT'];
    const rows = this.filteredLines.map((l, i) => [
      i + 1,
      l.productCode,
      l.productName,
      l.unit,
      l.openingQty,
      l.openingAmount,
      l.receiptQty,
      l.receiptAmount,
      l.issueQty,
      l.issueAmount,
      l.closingQty,
      l.closingAmount
    ]);

    const csvContent = [
      `BÁO CÁO TỔNG HỢP NHẬP - XUẤT - TỒN`,
      `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      `Tổng cộng,,,,${this.summary.openingAmount},,${this.summary.receiptAmount},,${this.summary.issueAmount},,${this.summary.closingAmount}`
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NhapXuatTon_${this.formatDateForFile(new Date())}.csv`;
    link.click();
  }

  print(): void {
    window.print();
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('vi-VN');
  }

  formatDateForFile(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  getProductTypeLabel(type: string): string {
    const found = this.productTypesList.find(t => t.value === type);
    return found?.label || type;
  }

  getProductGroupLabel(group: string): string {
    const found = this.productGroupsList.find(g => g.value === group);
    return found?.label || group;
  }

  get productTypes(): { value: string; label: string }[] {
    return this.productTypesList;
  }

  get productGroups(): { value: string; label: string }[] {
    return this.productGroupsList;
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  onFromDateChange(dateString: string): void {
    this.fromDate = this.parseDate(dateString);
    this.loadData();
  }

  onToDateChange(dateString: string): void {
    this.toDate = this.parseDate(dateString);
    this.loadData();
  }
}
