/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCT SERVICE - DANH MỤC HÀNG HÓA
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, map, delay } from 'rxjs';
import {
  Product,
  ProductType,
  ProductGroup,
  ProductStatus,
  ProductFilter,
  generateProductCode,
  validateProduct,
  getInventoryAccount,
  isLowStock
} from '../models/product.models';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.loadDemoData();
  }

  private loadDemoData(): void {
    const demoProducts: Product[] = [
      {
        id: 'PRD-001',
        code: 'SP0001',
        barcode: '8934567890123',
        name: 'Gạo ST25 túi 5kg',
        shortName: 'Gạo ST25',
        productType: 'GOODS',
        productGroup: 'FOOD',
        unit: 'Túi',
        units: [
          { unit: 'Túi', conversionRate: 1, isDefault: true },
          { unit: 'Thùng', conversionRate: 10, isDefault: false }
        ],
        costPrice: 95000,
        salePrice: 120000,
        vatRate: 5,
        costingMethod: 'WEIGHTED_AVG',
        minStock: 50,
        maxStock: 500,
        currentStock: 150,
        inventoryAccount: '1561',
        revenueAccount: '5111',
        cogsAccount: '632',
        purchaseAccount: '1561',
        origin: 'Việt Nam',
        brand: 'ST25',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-06-01')
      },
      {
        id: 'PRD-002',
        code: 'SP0002',
        barcode: '8934567890124',
        name: 'Dầu ăn Neptune 1L',
        shortName: 'Dầu Neptune',
        productType: 'GOODS',
        productGroup: 'FOOD',
        unit: 'Chai',
        units: [
          { unit: 'Chai', conversionRate: 1, isDefault: true },
          { unit: 'Thùng', conversionRate: 12, isDefault: false }
        ],
        costPrice: 38000,
        salePrice: 45000,
        vatRate: 8,
        costingMethod: 'WEIGHTED_AVG',
        minStock: 100,
        currentStock: 200,
        inventoryAccount: '1561',
        revenueAccount: '5111',
        cogsAccount: '632',
        purchaseAccount: '1561',
        origin: 'Việt Nam',
        brand: 'Neptune',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'PRD-003',
        code: 'SP0003',
        name: 'Nước mắm Phú Quốc 500ml',
        productType: 'GOODS',
        productGroup: 'FOOD',
        unit: 'Chai',
        units: [{ unit: 'Chai', conversionRate: 1, isDefault: true }],
        costPrice: 28000,
        salePrice: 35000,
        vatRate: 8,
        costingMethod: 'WEIGHTED_AVG',
        minStock: 50,
        currentStock: 30,
        inventoryAccount: '1561',
        revenueAccount: '5111',
        cogsAccount: '632',
        purchaseAccount: '1561',
        origin: 'Việt Nam',
        status: 'ACTIVE',
        createdAt: new Date('2024-02-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-02-01')
      },
      {
        id: 'PRD-004',
        code: 'SP0004',
        name: 'Sữa tươi Vinamilk 1L',
        productType: 'GOODS',
        productGroup: 'BEVERAGE',
        unit: 'Hộp',
        units: [
          { unit: 'Hộp', conversionRate: 1, isDefault: true },
          { unit: 'Thùng', conversionRate: 12, isDefault: false }
        ],
        costPrice: 25000,
        salePrice: 32000,
        vatRate: 5,
        costingMethod: 'FIFO',
        minStock: 100,
        currentStock: 180,
        inventoryAccount: '1561',
        revenueAccount: '5111',
        cogsAccount: '632',
        purchaseAccount: '1561',
        origin: 'Việt Nam',
        brand: 'Vinamilk',
        status: 'ACTIVE',
        createdAt: new Date('2024-02-15'),
        createdBy: 'admin',
        updatedAt: new Date('2024-02-15')
      },
      {
        id: 'PRD-005',
        code: 'DV0001',
        name: 'Dịch vụ vận chuyển',
        productType: 'SERVICE',
        productGroup: 'SERVICE',
        unit: 'Chuyến',
        units: [{ unit: 'Chuyến', conversionRate: 1, isDefault: true }],
        costPrice: 0,
        salePrice: 500000,
        vatRate: 8,
        costingMethod: 'SPECIFIC',
        currentStock: 0,
        inventoryAccount: '',
        revenueAccount: '5113',
        cogsAccount: '632',
        purchaseAccount: '',
        status: 'ACTIVE',
        createdAt: new Date('2024-03-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-03-01')
      },
      {
        id: 'PRD-006',
        code: 'NL0001',
        name: 'Bao bì carton',
        productType: 'MATERIAL',
        productGroup: 'RAW_MATERIAL',
        unit: 'Cái',
        units: [{ unit: 'Cái', conversionRate: 1, isDefault: true }],
        costPrice: 5000,
        salePrice: 0,
        vatRate: 8,
        costingMethod: 'WEIGHTED_AVG',
        minStock: 200,
        currentStock: 500,
        inventoryAccount: '152',
        revenueAccount: '',
        cogsAccount: '632',
        purchaseAccount: '152',
        status: 'ACTIVE',
        createdAt: new Date('2024-03-15'),
        createdBy: 'admin',
        updatedAt: new Date('2024-03-15')
      }
    ];

    this.productsSubject.next(demoProducts);
  }

  // CRUD
  getProducts(filter?: ProductFilter): Observable<Product[]> {
    return this.products$.pipe(
      map(products => {
        if (!filter) return products;
        return products.filter(p => {
          if (filter.search) {
            const keyword = filter.search.toLowerCase();
            const fields = [p.code, p.name, p.shortName || '', p.barcode || '', p.brand || ''].join(' ').toLowerCase();
            if (!fields.includes(keyword)) return false;
          }
          if (filter.productType && p.productType !== filter.productType) return false;
          if (filter.productGroup && p.productGroup !== filter.productGroup) return false;
          if (filter.status && p.status !== filter.status) return false;
          if (filter.hasStock && p.currentStock <= 0) return false;
          if (filter.lowStock && !isLowStock(p)) return false;
          return true;
        });
      })
    );
  }

  getProductById(id: string): Observable<Product | undefined> {
    return this.products$.pipe(map(products => products.find(p => p.id === id)));
  }

  getProductByCode(code: string): Observable<Product | undefined> {
    return this.products$.pipe(map(products => products.find(p => p.code === code)));
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    const errors = validateProduct(product);
    if (errors.length > 0) throw new Error(errors.join(', '));

    const products = this.productsSubject.value;
    if (products.some(p => p.code === product.code)) {
      throw new Error('Mã hàng hóa đã tồn tại');
    }

    const now = new Date();
    const newProduct: Product = {
      id: `PRD-${String(products.length + 1).padStart(3, '0')}`,
      code: product.code!,
      barcode: product.barcode,
      name: product.name!,
      shortName: product.shortName,
      productType: product.productType || 'GOODS',
      productGroup: product.productGroup || 'OTHER',
      unit: product.unit!,
      units: product.units || [{ unit: product.unit!, conversionRate: 1, isDefault: true }],
      costPrice: product.costPrice || 0,
      salePrice: product.salePrice || 0,
      minPrice: product.minPrice,
      maxPrice: product.maxPrice,
      vatRate: product.vatRate ?? 10,
      costingMethod: product.costingMethod || 'WEIGHTED_AVG',
      minStock: product.minStock,
      maxStock: product.maxStock,
      currentStock: product.currentStock || 0,
      inventoryAccount: product.inventoryAccount || getInventoryAccount(product.productType || 'GOODS'),
      revenueAccount: product.revenueAccount || '5111',
      cogsAccount: product.cogsAccount || '632',
      purchaseAccount: product.purchaseAccount || getInventoryAccount(product.productType || 'GOODS'),
      description: product.description,
      specifications: product.specifications,
      origin: product.origin,
      brand: product.brand,
      warranty: product.warranty,
      imageUrl: product.imageUrl,
      status: product.status || 'ACTIVE',
      primarySupplierId: product.primarySupplierId,
      primarySupplierCode: product.primarySupplierCode,
      createdAt: now,
      createdBy: 'admin',
      updatedAt: now
    };

    this.productsSubject.next([...products, newProduct]);
    return of(newProduct).pipe(delay(300));
  }

  updateProduct(id: string, updates: Partial<Product>): Observable<Product> {
    const products = this.productsSubject.value;
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Không tìm thấy hàng hóa');

    if (updates.code && updates.code !== products[index].code) {
      if (products.some(p => p.code === updates.code && p.id !== id)) {
        throw new Error('Mã hàng hóa đã tồn tại');
      }
    }

    const updated: Product = { ...products[index], ...updates, updatedAt: new Date(), updatedBy: 'admin' };
    products[index] = updated;
    this.productsSubject.next([...products]);
    return of(updated).pipe(delay(300));
  }

  deleteProduct(id: string): Observable<boolean> {
    const products = this.productsSubject.value;
    const product = products.find(p => p.id === id);
    if (!product) throw new Error('Không tìm thấy hàng hóa');
    if (product.currentStock > 0) throw new Error('Không thể xóa hàng hóa còn tồn kho');

    this.productsSubject.next(products.filter(p => p.id !== id));
    return of(true).pipe(delay(300));
  }

  // Stock operations
  updateStock(id: string, quantity: number, isIncrease: boolean): Observable<Product> {
    const products = this.productsSubject.value;
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Không tìm thấy hàng hóa');

    const product = products[index];
    const newStock = isIncrease ? product.currentStock + quantity : product.currentStock - quantity;
    if (newStock < 0) throw new Error('Số lượng tồn kho không đủ');

    const updated: Product = { ...product, currentStock: newStock, updatedAt: new Date() };
    products[index] = updated;
    this.productsSubject.next([...products]);
    return of(updated).pipe(delay(300));
  }

  // Utilities
  getNextProductCode(): Observable<string> {
    return this.products$.pipe(
      map(products => {
        const maxNum = products.reduce((max, p) => {
          const match = p.code.match(/\d+/);
          const num = match ? parseInt(match[0], 10) : 0;
          return num > max ? num : max;
        }, 0);
        return generateProductCode(maxNum + 1);
      })
    );
  }

  getProductDropdown(): Observable<{ id: string; code: string; name: string; unit: string; salePrice: number; vatRate: number }[]> {
    return this.products$.pipe(
      map(products =>
        products
          .filter(p => p.status === 'ACTIVE')
          .map(p => ({ id: p.id, code: p.code, name: p.name, unit: p.unit, salePrice: p.salePrice, vatRate: p.vatRate }))
      )
    );
  }

  getLowStockProducts(): Observable<Product[]> {
    return this.products$.pipe(
      map(products => products.filter(p => p.status === 'ACTIVE' && isLowStock(p)))
    );
  }

  getCountByType(): Observable<Record<ProductType, number>> {
    return this.products$.pipe(
      map(products => {
        const counts: Record<ProductType, number> = { GOODS: 0, FINISHED: 0, MATERIAL: 0, TOOL: 0, SERVICE: 0 };
        products.forEach(p => { if (p.status === 'ACTIVE') counts[p.productType]++; });
        return counts;
      })
    );
  }

  getTotalStockValue(): Observable<number> {
    return this.products$.pipe(
      map(products => products.reduce((total, p) => total + (p.currentStock * p.costPrice), 0))
    );
  }
}
