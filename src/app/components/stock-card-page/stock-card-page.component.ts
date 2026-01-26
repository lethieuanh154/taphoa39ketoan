import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WarehouseService } from '../../services/warehouse.service';
import { ProductService } from '../../services/product.service';
import { StockCard, StockMovement, Warehouse } from '../../models/warehouse.models';
import { Product } from '../../models/product.models';

@Component({
  selector: 'app-stock-card-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-card-page.component.html',
  styleUrl: './stock-card-page.component.css'
})
export class StockCardPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  stockCard: StockCard | null = null;
  products: Product[] = [];
  warehouses: Warehouse[] = [];

  // Filter
  selectedProductId = '';
  selectedWarehouseCode = '';
  fromDate: Date;
  toDate: Date;

  // Summary
  totalProducts = 0;
  totalStockValue = 0;
  lowStockCount = 0;

  // Loading
  isLoading = false;

  constructor(
    private warehouseService: WarehouseService,
    private productService: ProductService
  ) {
    // Default: current month
    const now = new Date();
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadWarehouses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  private loadProducts(): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products.filter(p => p.status === 'ACTIVE' && p.productType !== 'SERVICE');
        this.totalProducts = this.products.length;
        this.lowStockCount = this.products.filter(p => p.minStock !== undefined && p.currentStock <= p.minStock).length;
        this.totalStockValue = this.products.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);
      });
  }

  private loadWarehouses(): void {
    this.warehouseService.getActiveWarehouses()
      .pipe(takeUntil(this.destroy$))
      .subscribe(warehouses => {
        this.warehouses = warehouses;
        if (warehouses.length > 0 && !this.selectedWarehouseCode) {
          this.selectedWarehouseCode = warehouses[0].code;
        }
      });
  }

  loadStockCard(): void {
    if (!this.selectedProductId) {
      this.stockCard = null;
      return;
    }

    this.isLoading = true;

    this.warehouseService.getStockCard(
      this.selectedProductId,
      this.selectedWarehouseCode,
      this.fromDate,
      this.toDate
    ).pipe(takeUntil(this.destroy$))
      .subscribe(card => {
        this.stockCard = card;
        this.isLoading = false;
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTER
  // ═══════════════════════════════════════════════════════════════════

  onProductChange(): void {
    this.loadStockCard();
  }

  onWarehouseChange(): void {
    this.loadStockCard();
  }

  onDateChange(): void {
    if (this.fromDate && this.toDate && this.selectedProductId) {
      this.loadStockCard();
    }
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

    this.onDateChange();
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════

  exportToExcel(): void {
    if (!this.stockCard) return;

    // Simple CSV export
    const headers = ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'Nhập SL', 'Nhập TT', 'Xuất SL', 'Xuất TT', 'Tồn SL', 'Tồn TT'];
    const rows = this.stockCard.movements.map(m => [
      this.formatDate(m.date),
      m.voucherNo,
      m.voucherType === 'RECEIPT' ? 'Nhập' : 'Xuất',
      m.description,
      m.receiptQty || '',
      m.receiptAmount || '',
      m.issueQty || '',
      m.issueAmount || '',
      m.balanceQty,
      m.balanceAmount
    ]);

    const csvContent = [
      `THẺ KHO - ${this.stockCard.productCode} - ${this.stockCard.productName}`,
      `Kỳ: ${this.formatDate(this.fromDate)} - ${this.formatDate(this.toDate)}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TheKho_${this.stockCard.productCode}_${this.formatDateForFile(new Date())}.csv`;
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

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  }

  formatDateForFile(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  getMovementTypeClass(type: string): string {
    return type === 'RECEIPT' ? 'type-receipt' : 'type-issue';
  }

  getMovementTypeLabel(type: string): string {
    return type === 'RECEIPT' ? 'Nhập' : 'Xuất';
  }

  getSelectedProduct(): Product | undefined {
    return this.products.find(p => p.id === this.selectedProductId);
  }

  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  onFromDateChange(dateString: string): void {
    this.fromDate = this.parseDate(dateString);
    this.onDateChange();
  }

  onToDateChange(dateString: string): void {
    this.toDate = this.parseDate(dateString);
    this.onDateChange();
  }
}
