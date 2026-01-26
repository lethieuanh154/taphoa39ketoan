import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  COGSEntry,
  COGSLine,
  COGSByProduct,
  COGSSummary,
  COGSFilter,
  COGSTransactionType,
  CostingMethod,
  generateCOGSEntryNo,
  calculateGrossProfit,
  calculateGrossProfitMargin,
  COGS_ACCOUNTS
} from '../models/cogs.models';

@Injectable({
  providedIn: 'root'
})
export class COGSService {
  private entriesSubject = new BehaviorSubject<COGSEntry[]>([]);
  public entries$ = this.entriesSubject.asObservable();

  // Phương pháp tính giá vốn mặc định
  private costingMethod: CostingMethod = 'WEIGHTED_AVERAGE';

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════════

  getEntries(): Observable<COGSEntry[]> {
    return this.entries$;
  }

  getEntryById(id: string): Observable<COGSEntry | undefined> {
    return this.entries$.pipe(
      map(entries => entries.find(e => e.id === id))
    );
  }

  getEntriesByFilter(filter: COGSFilter): Observable<COGSEntry[]> {
    return this.entries$.pipe(
      map(entries => {
        let result = [...entries];

        if (filter.fromDate) {
          result = result.filter(e => new Date(e.entryDate) >= filter.fromDate!);
        }
        if (filter.toDate) {
          result = result.filter(e => new Date(e.entryDate) <= filter.toDate!);
        }
        if (filter.productId) {
          result = result.filter(e => e.lines.some(l => l.productId === filter.productId));
        }
        if (filter.customerId) {
          result = result.filter(e => e.customerId === filter.customerId);
        }
        if (filter.transactionType) {
          result = result.filter(e => e.transactionType === filter.transactionType);
        }
        if (filter.status) {
          result = result.filter(e => e.status === filter.status);
        }

        return result.sort((a, b) =>
          new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
        );
      })
    );
  }

  createEntry(data: Partial<COGSEntry>): COGSEntry {
    const entries = this.entriesSubject.value;
    const date = data.entryDate ? new Date(data.entryDate) : new Date();

    // Calculate totals
    const lines = data.lines || [];
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalCost = lines.reduce((sum, l) => sum + l.totalCost, 0);
    const totalRevenue = lines.reduce((sum, l) => sum + (l.revenue || 0), 0);
    const grossProfit = calculateGrossProfit(totalRevenue, totalCost);

    const newEntry: COGSEntry = {
      id: `cogs_${Date.now()}`,
      entryNo: data.entryNo || generateCOGSEntryNo(date),
      entryDate: date,
      transactionType: data.transactionType || 'SALE',
      sourceVoucherId: data.sourceVoucherId || '',
      sourceVoucherNo: data.sourceVoucherNo || '',
      sourceVoucherType: data.sourceVoucherType || 'ISSUE',
      customerId: data.customerId,
      customerName: data.customerName,
      lines,
      totalQuantity,
      totalCost,
      totalRevenue,
      grossProfit,
      grossProfitMargin: calculateGrossProfitMargin(totalRevenue, totalCost),
      debitAccount: COGS_ACCOUNTS.COGS,
      creditAccount: COGS_ACCOUNTS.INVENTORY,
      status: 'DRAFT',
      notes: data.notes,
      createdAt: new Date(),
      createdBy: 'admin'
    };

    this.entriesSubject.next([...entries, newEntry]);
    return newEntry;
  }

  updateEntry(id: string, data: Partial<COGSEntry>): boolean {
    const entries = this.entriesSubject.value;
    const index = entries.findIndex(e => e.id === id);

    if (index === -1) return false;
    if (entries[index].status !== 'DRAFT') return false;

    // Recalculate if lines changed
    if (data.lines) {
      const lines = data.lines;
      data.totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
      data.totalCost = lines.reduce((sum, l) => sum + l.totalCost, 0);
      data.totalRevenue = lines.reduce((sum, l) => sum + (l.revenue || 0), 0);
      data.grossProfit = calculateGrossProfit(data.totalRevenue, data.totalCost);
      data.grossProfitMargin = calculateGrossProfitMargin(data.totalRevenue, data.totalCost);
    }

    entries[index] = { ...entries[index], ...data };
    this.entriesSubject.next([...entries]);
    return true;
  }

  deleteEntry(id: string): boolean {
    const entries = this.entriesSubject.value;
    const entry = entries.find(e => e.id === id);
    if (!entry || entry.status !== 'DRAFT') return false;

    this.entriesSubject.next(entries.filter(e => e.id !== id));
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  postEntry(id: string): boolean {
    const entries = this.entriesSubject.value;
    const index = entries.findIndex(e => e.id === id);

    if (index === -1 || entries[index].status !== 'DRAFT') return false;

    entries[index] = {
      ...entries[index],
      status: 'POSTED',
      postedAt: new Date(),
      postedBy: 'admin'
    };

    this.entriesSubject.next([...entries]);
    return true;
  }

  cancelEntry(id: string): boolean {
    const entries = this.entriesSubject.value;
    const index = entries.findIndex(e => e.id === id);

    if (index === -1 || entries[index].status !== 'POSTED') return false;

    entries[index] = {
      ...entries[index],
      status: 'CANCELLED'
    };

    this.entriesSubject.next([...entries]);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  getCOGSSummary(fromDate: Date, toDate: Date): Observable<COGSSummary> {
    return this.entries$.pipe(
      map(entries => {
        const posted = entries.filter(e =>
          e.status === 'POSTED' &&
          new Date(e.entryDate) >= fromDate &&
          new Date(e.entryDate) <= toDate
        );

        // Totals
        const totalCOGS = posted.reduce((sum, e) => sum + e.totalCost, 0);
        const totalRevenue = posted.reduce((sum, e) => sum + e.totalRevenue, 0);
        const totalGrossProfit = calculateGrossProfit(totalRevenue, totalCOGS);

        // By type
        const typeMap = new Map<COGSTransactionType, number>();
        posted.forEach(e => {
          const current = typeMap.get(e.transactionType) || 0;
          typeMap.set(e.transactionType, current + e.totalCost);
        });

        const byType = Array.from(typeMap.entries()).map(([type, cost]) => ({
          type,
          label: this.getTypeLabel(type),
          cost,
          percentage: totalCOGS > 0 ? (cost / totalCOGS) * 100 : 0
        }));

        // Top products
        const productMap = new Map<string, {
          productCode: string;
          productName: string;
          soldQuantity: number;
          cost: number;
          revenue: number;
        }>();

        posted.forEach(e => {
          e.lines.forEach(l => {
            const existing = productMap.get(l.productId) || {
              productCode: l.productCode,
              productName: l.productName,
              soldQuantity: 0,
              cost: 0,
              revenue: 0
            };
            productMap.set(l.productId, {
              ...existing,
              soldQuantity: existing.soldQuantity + l.quantity,
              cost: existing.cost + l.totalCost,
              revenue: existing.revenue + (l.revenue || 0)
            });
          });
        });

        const topProducts = Array.from(productMap.values())
          .map(p => ({
            ...p,
            profit: p.revenue - p.cost,
            margin: calculateGrossProfitMargin(p.revenue, p.cost)
          }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 10);

        return {
          period: `${(fromDate.getMonth() + 1).toString().padStart(2, '0')}/${fromDate.getFullYear()}`,
          fromDate,
          toDate,
          totalCOGS,
          totalRevenue,
          totalGrossProfit,
          avgGrossMargin: calculateGrossProfitMargin(totalRevenue, totalCOGS),
          byType,
          topProducts,
          entryCount: posted.length,
          lineCount: posted.reduce((sum, e) => sum + e.lines.length, 0)
        };
      })
    );
  }

  getCOGSByProduct(fromDate: Date, toDate: Date): Observable<COGSByProduct[]> {
    return this.entries$.pipe(
      map(entries => {
        const posted = entries.filter(e =>
          e.status === 'POSTED' &&
          new Date(e.entryDate) >= fromDate &&
          new Date(e.entryDate) <= toDate
        );

        const productMap = new Map<string, COGSByProduct>();

        posted.forEach(e => {
          e.lines.forEach(l => {
            const existing = productMap.get(l.productId);
            if (existing) {
              existing.soldQuantity += l.quantity;
              existing.soldCost += l.totalCost;
              existing.revenue += l.revenue || 0;
            } else {
              productMap.set(l.productId, {
                productId: l.productId,
                productCode: l.productCode,
                productName: l.productName,
                unit: l.unit,
                openingQuantity: 0,
                openingCost: 0,
                purchaseQuantity: 0,
                purchaseCost: 0,
                soldQuantity: l.quantity,
                soldCost: l.totalCost,
                closingQuantity: 0,
                closingCost: 0,
                revenue: l.revenue || 0,
                grossProfit: 0,
                grossProfitMargin: 0
              });
            }
          });
        });

        // Calculate profit
        return Array.from(productMap.values()).map(p => ({
          ...p,
          grossProfit: p.revenue - p.soldCost,
          grossProfitMargin: calculateGrossProfitMargin(p.revenue, p.soldCost)
        }));
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private getTypeLabel(type: COGSTransactionType): string {
    const types: { [key: string]: string } = {
      'SALE': 'Xuất bán hàng',
      'RETURN': 'Trả lại NCC',
      'INTERNAL_USE': 'Sử dụng nội bộ',
      'WRITE_OFF': 'Hao hụt',
      'ADJUSTMENT': 'Điều chỉnh'
    };
    return types[type] || type;
  }

  setCostingMethod(method: CostingMethod): void {
    this.costingMethod = method;
  }

  getCostingMethod(): CostingMethod {
    return this.costingMethod;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const now = new Date();
    const entries: COGSEntry[] = [
      {
        id: 'cogs_001',
        entryNo: 'GV-202501-001',
        entryDate: new Date(now.getFullYear(), now.getMonth(), 5),
        transactionType: 'SALE',
        sourceVoucherId: 'issue_001',
        sourceVoucherNo: 'PXK-202501-001',
        sourceVoucherType: 'ISSUE',
        customerId: 'cust_001',
        customerName: 'Công ty TNHH ABC',
        lines: [
          {
            id: 'line_001',
            productId: 'prod_001',
            productCode: 'SP001',
            productName: 'Gạo ST25 5kg',
            unit: 'Túi',
            quantity: 50,
            unitCost: 85000,
            totalCost: 4250000,
            sellingPrice: 120000,
            revenue: 6000000,
            grossProfit: 1750000,
            costingMethod: 'WEIGHTED_AVERAGE'
          },
          {
            id: 'line_002',
            productId: 'prod_002',
            productCode: 'SP002',
            productName: 'Dầu ăn Neptune 1L',
            unit: 'Chai',
            quantity: 30,
            unitCost: 35000,
            totalCost: 1050000,
            sellingPrice: 48000,
            revenue: 1440000,
            grossProfit: 390000,
            costingMethod: 'WEIGHTED_AVERAGE'
          }
        ],
        totalQuantity: 80,
        totalCost: 5300000,
        totalRevenue: 7440000,
        grossProfit: 2140000,
        grossProfitMargin: 28.76,
        debitAccount: '632',
        creditAccount: '1561',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 5),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 5),
        postedBy: 'admin'
      },
      {
        id: 'cogs_002',
        entryNo: 'GV-202501-002',
        entryDate: new Date(now.getFullYear(), now.getMonth(), 10),
        transactionType: 'SALE',
        sourceVoucherId: 'issue_002',
        sourceVoucherNo: 'PXK-202501-002',
        sourceVoucherType: 'ISSUE',
        customerId: 'cust_002',
        customerName: 'Siêu thị Mini Mart',
        lines: [
          {
            id: 'line_003',
            productId: 'prod_003',
            productCode: 'SP003',
            productName: 'Nước mắm Chin Su 500ml',
            unit: 'Chai',
            quantity: 100,
            unitCost: 18000,
            totalCost: 1800000,
            sellingPrice: 25000,
            revenue: 2500000,
            grossProfit: 700000,
            costingMethod: 'WEIGHTED_AVERAGE'
          },
          {
            id: 'line_004',
            productId: 'prod_004',
            productCode: 'SP004',
            productName: 'Mì Hảo Hảo thùng 30 gói',
            unit: 'Thùng',
            quantity: 20,
            unitCost: 95000,
            totalCost: 1900000,
            sellingPrice: 130000,
            revenue: 2600000,
            grossProfit: 700000,
            costingMethod: 'WEIGHTED_AVERAGE'
          }
        ],
        totalQuantity: 120,
        totalCost: 3700000,
        totalRevenue: 5100000,
        grossProfit: 1400000,
        grossProfitMargin: 27.45,
        debitAccount: '632',
        creditAccount: '1561',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 10),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 10),
        postedBy: 'admin'
      },
      {
        id: 'cogs_003',
        entryNo: 'GV-202501-003',
        entryDate: new Date(now.getFullYear(), now.getMonth(), 15),
        transactionType: 'SALE',
        sourceVoucherId: 'issue_003',
        sourceVoucherNo: 'PXK-202501-003',
        sourceVoucherType: 'ISSUE',
        customerId: 'cust_003',
        customerName: 'Cửa hàng tiện lợi 24H',
        lines: [
          {
            id: 'line_005',
            productId: 'prod_001',
            productCode: 'SP001',
            productName: 'Gạo ST25 5kg',
            unit: 'Túi',
            quantity: 30,
            unitCost: 85000,
            totalCost: 2550000,
            sellingPrice: 118000,
            revenue: 3540000,
            grossProfit: 990000,
            costingMethod: 'WEIGHTED_AVERAGE'
          }
        ],
        totalQuantity: 30,
        totalCost: 2550000,
        totalRevenue: 3540000,
        grossProfit: 990000,
        grossProfitMargin: 27.97,
        debitAccount: '632',
        creditAccount: '1561',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 15),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 15),
        postedBy: 'admin'
      },
      {
        id: 'cogs_004',
        entryNo: 'GV-202501-004',
        entryDate: new Date(now.getFullYear(), now.getMonth(), 18),
        transactionType: 'WRITE_OFF',
        sourceVoucherId: 'issue_004',
        sourceVoucherNo: 'PXK-202501-004',
        sourceVoucherType: 'ISSUE',
        lines: [
          {
            id: 'line_006',
            productId: 'prod_005',
            productCode: 'SP005',
            productName: 'Sữa TH True Milk 1L',
            unit: 'Hộp',
            quantity: 10,
            unitCost: 28000,
            totalCost: 280000,
            costingMethod: 'WEIGHTED_AVERAGE'
          }
        ],
        totalQuantity: 10,
        totalCost: 280000,
        totalRevenue: 0,
        grossProfit: -280000,
        grossProfitMargin: 0,
        debitAccount: '632',
        creditAccount: '1561',
        status: 'POSTED',
        notes: 'Hàng hết hạn sử dụng',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 18),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 18),
        postedBy: 'admin'
      },
      {
        id: 'cogs_005',
        entryNo: 'GV-202501-005',
        entryDate: new Date(now.getFullYear(), now.getMonth(), 20),
        transactionType: 'SALE',
        sourceVoucherId: 'issue_005',
        sourceVoucherNo: 'PXK-202501-005',
        sourceVoucherType: 'ISSUE',
        customerId: 'cust_001',
        customerName: 'Công ty TNHH ABC',
        lines: [
          {
            id: 'line_007',
            productId: 'prod_002',
            productCode: 'SP002',
            productName: 'Dầu ăn Neptune 1L',
            unit: 'Chai',
            quantity: 50,
            unitCost: 35000,
            totalCost: 1750000,
            sellingPrice: 49000,
            revenue: 2450000,
            grossProfit: 700000,
            costingMethod: 'WEIGHTED_AVERAGE'
          }
        ],
        totalQuantity: 50,
        totalCost: 1750000,
        totalRevenue: 2450000,
        grossProfit: 700000,
        grossProfitMargin: 28.57,
        debitAccount: '632',
        creditAccount: '1561',
        status: 'DRAFT',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 20),
        createdBy: 'admin'
      }
    ];

    this.entriesSubject.next(entries);
  }
}
