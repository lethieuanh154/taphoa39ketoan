/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCT PAGE COMPONENT - DANH MỤC HÀNG HÓA
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ProductService } from '../../services/product.service';
import {
  Product,
  ProductType,
  ProductGroup,
  ProductStatus,
  ProductFilter,
  ProductUnit,
  PRODUCT_TYPES,
  PRODUCT_GROUPS,
  COSTING_METHODS,
  PRODUCT_STATUS,
  COMMON_UNITS,
  VAT_RATES,
  isLowStock,
  isOverStock
} from '../../models/product.models';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.css'
})
export class ProductPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;

  filter: ProductFilter = { search: '', status: 'ACTIVE' };
  selectedProduct: Product | null = null;

  showCreateModal = false;
  showDetailModal = false;
  showDeleteConfirm = false;
  isEditMode = false;

  formData: Partial<Product> = {};
  formUnits: ProductUnit[] = [];

  productTypes = PRODUCT_TYPES;
  productGroups = PRODUCT_GROUPS;
  costingMethods = COSTING_METHODS;
  productStatus = PRODUCT_STATUS;
  commonUnits = COMMON_UNITS;
  vatRates = VAT_RATES;

  stats = {
    total: 0,
    active: 0,
    lowStock: 0,
    totalValue: 0,
    byType: {} as Record<ProductType, number>
  };

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadStats();
    this.productService.loading$.pipe(takeUntil(this.destroy$)).subscribe(l => this.loading = l);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts(): void {
    this.productService.getProducts(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products;
        this.filteredProducts = products;
      });
  }

  loadStats(): void {
    this.productService.products$.pipe(takeUntil(this.destroy$)).subscribe(products => {
      this.stats.total = products.length;
      this.stats.active = products.filter(p => p.status === 'ACTIVE').length;
      this.stats.lowStock = products.filter(p => p.status === 'ACTIVE' && isLowStock(p)).length;
    });
    this.productService.getCountByType().pipe(takeUntil(this.destroy$)).subscribe(c => this.stats.byType = c);
    this.productService.getTotalStockValue().pipe(takeUntil(this.destroy$)).subscribe(v => this.stats.totalValue = v);
  }

  onFilterChange(): void { this.loadProducts(); }
  onStatusFilterChange(status: ProductStatus | ''): void {
    this.filter.status = status || undefined;
    this.loadProducts();
  }

  // CREATE / EDIT
  openCreateModal(): void {
    this.isEditMode = false;
    this.productService.getNextProductCode().pipe(takeUntil(this.destroy$)).subscribe(code => {
      this.formData = {
        code,
        productType: 'GOODS',
        productGroup: 'OTHER',
        unit: 'Cái',
        vatRate: 10,
        costingMethod: 'WEIGHTED_AVG',
        costPrice: 0,
        salePrice: 0,
        currentStock: 0,
        status: 'ACTIVE',
        inventoryAccount: '1561',
        revenueAccount: '5111',
        cogsAccount: '632',
        purchaseAccount: '1561'
      };
      this.formUnits = [{ unit: 'Cái', conversionRate: 1, isDefault: true }];
      this.showCreateModal = true;
    });
  }

  openEditModal(product: Product): void {
    this.isEditMode = true;
    this.selectedProduct = product;
    this.formData = { ...product };
    this.formUnits = [...(product.units || [])];
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.formData = {};
    this.formUnits = [];
    this.selectedProduct = null;
    this.isEditMode = false;
  }

  addUnit(): void {
    this.formUnits.push({ unit: '', conversionRate: 1, isDefault: false });
  }

  removeUnit(i: number): void {
    if (this.formUnits[i].isDefault) {
      alert('Không thể xóa đơn vị tính chính');
      return;
    }
    this.formUnits.splice(i, 1);
  }

  setDefaultUnit(i: number): void {
    this.formUnits.forEach((u, idx) => u.isDefault = idx === i);
    this.formData.unit = this.formUnits[i].unit;
  }

  onProductTypeChange(): void {
    const type = PRODUCT_TYPES.find(t => t.value === this.formData.productType);
    if (type && type.account) {
      this.formData.inventoryAccount = type.account;
      this.formData.purchaseAccount = type.account;
    }
  }

  saveProduct(): void {
    if (!this.validateForm()) return;

    const data: Partial<Product> = {
      ...this.formData,
      units: this.formUnits.filter(u => u.unit),
      unit: this.formUnits.find(u => u.isDefault)?.unit || this.formData.unit
    };

    const obs = this.isEditMode && this.selectedProduct
      ? this.productService.updateProduct(this.selectedProduct.id, data)
      : this.productService.createProduct(data);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.closeCreateModal(); this.loadProducts(); this.loadStats(); },
      error: (err) => alert(err.message)
    });
  }

  validateForm(): boolean {
    if (!this.formData.code?.trim()) { alert('Vui lòng nhập mã hàng hóa'); return false; }
    if (!this.formData.name?.trim()) { alert('Vui lòng nhập tên hàng hóa'); return false; }
    if (!this.formUnits.some(u => u.unit && u.isDefault)) { alert('Vui lòng chọn đơn vị tính chính'); return false; }
    return true;
  }

  // VIEW / DELETE
  viewDetail(product: Product): void { this.selectedProduct = product; this.showDetailModal = true; }
  closeDetailModal(): void { this.showDetailModal = false; this.selectedProduct = null; }

  confirmDelete(product: Product): void { this.selectedProduct = product; this.showDeleteConfirm = true; }
  deleteProduct(): void {
    if (!this.selectedProduct) return;
    this.productService.deleteProduct(this.selectedProduct.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.showDeleteConfirm = false; this.selectedProduct = null; this.loadProducts(); this.loadStats(); },
      error: (err) => alert(err.message)
    });
  }

  // UTILITIES
  getProductTypeLabel(type: ProductType): string { return PRODUCT_TYPES.find(t => t.value === type)?.label || type; }
  getProductGroupLabel(group: ProductGroup): string { return PRODUCT_GROUPS.find(g => g.value === group)?.label || group; }
  getStatusLabel(status: ProductStatus): string {
    return PRODUCT_STATUS.find(s => s.value === status)?.label || status;
  }
  getStatusClass(status: ProductStatus): string {
    if (status === 'ACTIVE') return 'status-active';
    if (status === 'INACTIVE') return 'status-inactive';
    return 'status-discontinued';
  }
  getVatLabel(rate: number): string {
    if (rate === -1) return 'KCT';
    if (rate === -2) return 'KKK';
    return rate + '%';
  }
  isLowStock(product: Product): boolean { return isLowStock(product); }
  isOverStock(product: Product): boolean { return isOverStock(product); }
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }
  formatNumber(num: number): string {
    return new Intl.NumberFormat('vi-VN').format(num);
  }
}
