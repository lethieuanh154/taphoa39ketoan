import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
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
  StockCard,
  StockMovement,
  DEFAULT_WAREHOUSES,
  RECEIPT_JOURNAL_MAPPING,
  ISSUE_JOURNAL_MAPPING,
  calculateVoucherTotals,
  calculateLineAmount
} from '../models/warehouse.models';

@Injectable({
  providedIn: 'root'
})
export class WarehouseService {
  private readonly STORAGE_KEY = 'taphoa39_warehouse_vouchers';
  private readonly WAREHOUSE_STORAGE_KEY = 'taphoa39_warehouses';

  private vouchersSubject = new BehaviorSubject<WarehouseVoucher[]>([]);
  private warehousesSubject = new BehaviorSubject<Warehouse[]>([]);

  constructor() {
    this.loadFromStorage();
    this.loadWarehouses();
  }

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const vouchers = JSON.parse(stored).map((v: any) => ({
          ...v,
          voucherDate: new Date(v.voucherDate),
          createdAt: new Date(v.createdAt),
          postedAt: v.postedAt ? new Date(v.postedAt) : undefined,
          cancelledAt: v.cancelledAt ? new Date(v.cancelledAt) : undefined,
          refVoucherDate: v.refVoucherDate ? new Date(v.refVoucherDate) : undefined,
          lines: v.lines.map((l: any) => ({
            ...l,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined
          }))
        }));
        this.vouchersSubject.next(vouchers);
      } else {
        this.vouchersSubject.next(this.getDemoData());
        this.saveToStorage();
      }
    } catch (e) {
      console.error('Error loading warehouse vouchers:', e);
      this.vouchersSubject.next(this.getDemoData());
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.vouchersSubject.value));
  }

  private loadWarehouses(): void {
    try {
      const stored = localStorage.getItem(this.WAREHOUSE_STORAGE_KEY);
      if (stored) {
        this.warehousesSubject.next(JSON.parse(stored));
      } else {
        this.warehousesSubject.next(DEFAULT_WAREHOUSES);
        localStorage.setItem(this.WAREHOUSE_STORAGE_KEY, JSON.stringify(DEFAULT_WAREHOUSES));
      }
    } catch (e) {
      this.warehousesSubject.next(DEFAULT_WAREHOUSES);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════

  private getDemoData(): WarehouseVoucher[] {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    return [
      // Phiếu nhập kho
      {
        id: 'WH-R-001',
        voucherNo: 'PNK-2025/01-001',
        voucherType: 'RECEIPT',
        receiptType: 'PURCHASE',
        voucherDate: lastMonth,
        status: 'POSTED',
        partnerId: 'SUP-001',
        partnerCode: 'NCC001',
        partnerName: 'Công ty TNHH Thực phẩm ABC',
        refVoucherNo: 'INV-IN-001',
        refVoucherType: 'INVOICE',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        keeper: 'Nguyễn Văn A',
        receiver: 'Trần Văn B',
        lines: [
          {
            id: 'WHL-001',
            lineNo: 1,
            productId: 'PROD-001',
            productCode: 'SP001',
            productName: 'Gạo ST25 5kg',
            unit: 'Bao',
            quantity: 100,
            unitPrice: 180000,
            amount: 18000000,
            inventoryAccount: '156',
            warehouseCode: 'KHO1'
          },
          {
            id: 'WHL-002',
            lineNo: 2,
            productId: 'PROD-002',
            productCode: 'SP002',
            productName: 'Dầu ăn Tường An 1L',
            unit: 'Chai',
            quantity: 50,
            unitPrice: 42000,
            amount: 2100000,
            inventoryAccount: '156',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 150,
        totalAmount: 20100000,
        debitAccount: '156',
        creditAccount: '331',
        description: 'Nhập kho hàng mua từ NCC ABC',
        createdAt: lastMonth,
        createdBy: 'admin',
        postedAt: lastMonth,
        postedBy: 'admin'
      },
      {
        id: 'WH-R-002',
        voucherNo: 'PNK-2025/01-002',
        voucherType: 'RECEIPT',
        receiptType: 'PURCHASE',
        voucherDate: new Date(now.getFullYear(), now.getMonth(), 5),
        status: 'POSTED',
        partnerId: 'SUP-002',
        partnerCode: 'NCC002',
        partnerName: 'Công ty CP Nước giải khát XYZ',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        keeper: 'Nguyễn Văn A',
        lines: [
          {
            id: 'WHL-003',
            lineNo: 1,
            productId: 'PROD-003',
            productCode: 'SP003',
            productName: 'Nước suối Aquafina 500ml',
            unit: 'Thùng',
            quantity: 200,
            unitPrice: 85000,
            amount: 17000000,
            inventoryAccount: '156',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 200,
        totalAmount: 17000000,
        debitAccount: '156',
        creditAccount: '331',
        description: 'Nhập kho nước uống',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 5),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 5),
        postedBy: 'admin'
      },
      {
        id: 'WH-R-003',
        voucherNo: 'PNK-2025/01-003',
        voucherType: 'RECEIPT',
        receiptType: 'PURCHASE',
        voucherDate: new Date(),
        status: 'DRAFT',
        partnerId: 'SUP-003',
        partnerCode: 'NCC003',
        partnerName: 'Công ty TNHH Gia dụng Việt',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        lines: [
          {
            id: 'WHL-004',
            lineNo: 1,
            productId: 'PROD-004',
            productCode: 'SP004',
            productName: 'Bột giặt OMO 3kg',
            unit: 'Túi',
            quantity: 30,
            unitPrice: 125000,
            amount: 3750000,
            inventoryAccount: '156',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 30,
        totalAmount: 3750000,
        debitAccount: '156',
        creditAccount: '331',
        description: 'Nhập kho bột giặt',
        createdAt: new Date(),
        createdBy: 'admin'
      },

      // Phiếu xuất kho
      {
        id: 'WH-I-001',
        voucherNo: 'PXK-2025/01-001',
        voucherType: 'ISSUE',
        issueType: 'SALE',
        voucherDate: new Date(now.getFullYear(), now.getMonth() - 1, 20),
        status: 'POSTED',
        partnerId: 'CUS-001',
        partnerCode: 'KH001',
        partnerName: 'Công ty TNHH Bách Hóa Xanh',
        refVoucherNo: 'INV-OUT-001',
        refVoucherType: 'INVOICE',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        keeper: 'Nguyễn Văn A',
        receiver: 'Lê Văn C',
        lines: [
          {
            id: 'WHL-005',
            lineNo: 1,
            productId: 'PROD-001',
            productCode: 'SP001',
            productName: 'Gạo ST25 5kg',
            unit: 'Bao',
            quantity: 20,
            unitPrice: 180000,
            amount: 3600000,
            inventoryAccount: '156',
            expenseAccount: '632',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 20,
        totalAmount: 3600000,
        debitAccount: '632',
        creditAccount: '156',
        description: 'Xuất kho bán hàng cho Bách Hóa Xanh',
        createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 20),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth() - 1, 20),
        postedBy: 'admin'
      },
      {
        id: 'WH-I-002',
        voucherNo: 'PXK-2025/01-002',
        voucherType: 'ISSUE',
        issueType: 'SALE',
        voucherDate: new Date(now.getFullYear(), now.getMonth(), 10),
        status: 'POSTED',
        partnerId: 'CUS-002',
        partnerCode: 'KH002',
        partnerName: 'Siêu thị Co.opmart',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        keeper: 'Nguyễn Văn A',
        lines: [
          {
            id: 'WHL-006',
            lineNo: 1,
            productId: 'PROD-002',
            productCode: 'SP002',
            productName: 'Dầu ăn Tường An 1L',
            unit: 'Chai',
            quantity: 30,
            unitPrice: 42000,
            amount: 1260000,
            inventoryAccount: '156',
            expenseAccount: '632',
            warehouseCode: 'KHO1'
          },
          {
            id: 'WHL-007',
            lineNo: 2,
            productId: 'PROD-003',
            productCode: 'SP003',
            productName: 'Nước suối Aquafina 500ml',
            unit: 'Thùng',
            quantity: 50,
            unitPrice: 85000,
            amount: 4250000,
            inventoryAccount: '156',
            expenseAccount: '632',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 80,
        totalAmount: 5510000,
        debitAccount: '632',
        creditAccount: '156',
        description: 'Xuất kho bán hàng cho Co.opmart',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 10),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 10),
        postedBy: 'admin'
      },
      {
        id: 'WH-I-003',
        voucherNo: 'PXK-2025/01-003',
        voucherType: 'ISSUE',
        issueType: 'SALE',
        voucherDate: new Date(),
        status: 'DRAFT',
        partnerId: 'CUS-003',
        partnerCode: 'KH003',
        partnerName: 'Cửa hàng Tạp hóa Minh Tâm',
        warehouseCode: 'KHO1',
        warehouseName: 'Kho chính',
        lines: [
          {
            id: 'WHL-008',
            lineNo: 1,
            productId: 'PROD-001',
            productCode: 'SP001',
            productName: 'Gạo ST25 5kg',
            unit: 'Bao',
            quantity: 10,
            unitPrice: 180000,
            amount: 1800000,
            inventoryAccount: '156',
            expenseAccount: '632',
            warehouseCode: 'KHO1'
          }
        ],
        totalQuantity: 10,
        totalAmount: 1800000,
        debitAccount: '632',
        creditAccount: '156',
        description: 'Xuất kho bán lẻ',
        createdAt: new Date(),
        createdBy: 'admin'
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  getVouchers(filter?: WarehouseVoucherFilter): Observable<WarehouseVoucher[]> {
    return this.vouchersSubject.asObservable().pipe(
      map(vouchers => this.applyFilter(vouchers, filter))
    );
  }

  getVoucherById(id: string): Observable<WarehouseVoucher | undefined> {
    return this.vouchersSubject.asObservable().pipe(
      map(vouchers => vouchers.find(v => v.id === id))
    );
  }

  createVoucher(voucher: Partial<WarehouseVoucher>): Observable<WarehouseVoucher> {
    const newVoucher: WarehouseVoucher = {
      ...voucher,
      id: this.generateId(voucher.voucherType!),
      voucherNo: this.getNextVoucherNo(voucher.voucherType!),
      status: 'DRAFT',
      createdAt: new Date(),
      createdBy: 'admin',
      lines: voucher.lines || [],
      totalQuantity: 0,
      totalAmount: 0
    } as WarehouseVoucher;

    // Calculate totals
    const totals = calculateVoucherTotals(newVoucher.lines);
    newVoucher.totalQuantity = totals.totalQuantity;
    newVoucher.totalAmount = totals.totalAmount;

    // Set journal accounts
    this.setJournalAccounts(newVoucher);

    const vouchers = [...this.vouchersSubject.value, newVoucher];
    this.vouchersSubject.next(vouchers);
    this.saveToStorage();

    return of(newVoucher);
  }

  updateVoucher(id: string, updates: Partial<WarehouseVoucher>): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const index = vouchers.findIndex(v => v.id === id);

    if (index === -1) return of(undefined);

    const existing = vouchers[index];
    if (existing.status !== 'DRAFT') {
      console.error('Cannot update posted/cancelled voucher');
      return of(undefined);
    }

    const updated = { ...existing, ...updates };

    // Recalculate totals
    const totals = calculateVoucherTotals(updated.lines);
    updated.totalQuantity = totals.totalQuantity;
    updated.totalAmount = totals.totalAmount;

    // Update journal accounts
    this.setJournalAccounts(updated);

    vouchers[index] = updated;
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    return of(updated);
  }

  deleteVoucher(id: string): Observable<boolean> {
    const vouchers = this.vouchersSubject.value;
    const voucher = vouchers.find(v => v.id === id);

    if (!voucher || voucher.status !== 'DRAFT') {
      return of(false);
    }

    const filtered = vouchers.filter(v => v.id !== id);
    this.vouchersSubject.next(filtered);
    this.saveToStorage();

    return of(true);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  postVoucher(id: string): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const index = vouchers.findIndex(v => v.id === id);

    if (index === -1) return of(undefined);

    const voucher = vouchers[index];
    if (voucher.status !== 'DRAFT') {
      console.error('Voucher is not in DRAFT status');
      return of(undefined);
    }

    if (voucher.lines.length === 0) {
      console.error('Voucher has no lines');
      return of(undefined);
    }

    voucher.status = 'POSTED';
    voucher.postedAt = new Date();
    voucher.postedBy = 'admin';

    vouchers[index] = { ...voucher };
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    // TODO: Update stock in ProductService
    // TODO: Create journal entry in JournalService

    return of(voucher);
  }

  cancelVoucher(id: string, reason: string): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const index = vouchers.findIndex(v => v.id === id);

    if (index === -1) return of(undefined);

    const voucher = vouchers[index];
    if (voucher.status === 'CANCELLED') {
      console.error('Voucher is already cancelled');
      return of(undefined);
    }

    voucher.status = 'CANCELLED';
    voucher.cancelledAt = new Date();
    voucher.cancelledBy = 'admin';
    voucher.cancelReason = reason;

    vouchers[index] = { ...voucher };
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    // TODO: Reverse stock in ProductService if was POSTED
    // TODO: Create reversal journal entry if was POSTED

    return of(voucher);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY & STATISTICS
  // ═══════════════════════════════════════════════════════════════════

  getSummary(type: WarehouseVoucherType, filter?: WarehouseVoucherFilter): Observable<WarehouseVoucherSummary> {
    return this.vouchersSubject.asObservable().pipe(
      map(vouchers => {
        const filtered = this.applyFilter(vouchers, { ...filter, voucherType: type });
        return {
          totalVouchers: filtered.length,
          draftCount: filtered.filter(v => v.status === 'DRAFT').length,
          postedCount: filtered.filter(v => v.status === 'POSTED').length,
          cancelledCount: filtered.filter(v => v.status === 'CANCELLED').length,
          totalQuantity: filtered.filter(v => v.status !== 'CANCELLED')
            .reduce((sum, v) => sum + v.totalQuantity, 0),
          totalAmount: filtered.filter(v => v.status !== 'CANCELLED')
            .reduce((sum, v) => sum + v.totalAmount, 0)
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // WAREHOUSE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  getWarehouses(): Observable<Warehouse[]> {
    return this.warehousesSubject.asObservable();
  }

  getActiveWarehouses(): Observable<Warehouse[]> {
    return this.warehousesSubject.asObservable().pipe(
      map(warehouses => warehouses.filter(w => w.isActive))
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STOCK CARD
  // ═══════════════════════════════════════════════════════════════════

  getStockCard(productId: string, warehouseCode: string, fromDate: Date, toDate: Date): Observable<StockCard> {
    return this.vouchersSubject.asObservable().pipe(
      map(vouchers => {
        const relevantVouchers = vouchers
          .filter(v => v.status === 'POSTED')
          .filter(v => !warehouseCode || v.warehouseCode === warehouseCode)
          .filter(v => v.voucherDate >= fromDate && v.voucherDate <= toDate)
          .sort((a, b) => a.voucherDate.getTime() - b.voucherDate.getTime());

        let openingQty = 0;
        let openingAmount = 0;
        let receiptQty = 0;
        let receiptAmount = 0;
        let issueQty = 0;
        let issueAmount = 0;
        const movements: StockMovement[] = [];
        let balance = openingQty;
        let balanceAmount = openingAmount;

        // Get product info from first matching line
        let productCode = '';
        let productName = '';
        let unit = '';

        for (const voucher of relevantVouchers) {
          for (const line of voucher.lines) {
            if (line.productId === productId) {
              if (!productCode) {
                productCode = line.productCode;
                productName = line.productName;
                unit = line.unit;
              }

              const isReceipt = voucher.voucherType === 'RECEIPT';
              const rQty = isReceipt ? line.quantity : 0;
              const rAmt = isReceipt ? line.amount : 0;
              const iQty = isReceipt ? 0 : line.quantity;
              const iAmt = isReceipt ? 0 : line.amount;

              if (isReceipt) {
                receiptQty += line.quantity;
                receiptAmount += line.amount;
                balance += line.quantity;
                balanceAmount += line.amount;
              } else {
                issueQty += line.quantity;
                issueAmount += line.amount;
                balance -= line.quantity;
                balanceAmount -= line.amount;
              }

              movements.push({
                date: voucher.voucherDate,
                voucherNo: voucher.voucherNo,
                voucherType: voucher.voucherType,
                description: voucher.description || '',
                receiptQty: rQty,
                receiptAmount: rAmt,
                issueQty: iQty,
                issueAmount: iAmt,
                balanceQty: balance,
                balanceAmount: balanceAmount
              });
            }
          }
        }

        return {
          productId,
          productCode,
          productName,
          unit,
          warehouseCode,
          openingQty,
          openingAmount,
          receiptQty,
          receiptAmount,
          issueQty,
          issueAmount,
          closingQty: balance,
          closingAmount: balanceAmount,
          movements
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private applyFilter(vouchers: WarehouseVoucher[], filter?: WarehouseVoucherFilter): WarehouseVoucher[] {
    if (!filter) return vouchers;

    return vouchers.filter(v => {
      if (filter.voucherType && v.voucherType !== filter.voucherType) return false;
      if (filter.receiptType && v.receiptType !== filter.receiptType) return false;
      if (filter.issueType && v.issueType !== filter.issueType) return false;
      if (filter.status && v.status !== filter.status) return false;
      if (filter.warehouseCode && v.warehouseCode !== filter.warehouseCode) return false;
      if (filter.partnerId && v.partnerId !== filter.partnerId) return false;

      if (filter.fromDate && v.voucherDate < filter.fromDate) return false;
      if (filter.toDate && v.voucherDate > filter.toDate) return false;

      if (filter.productId) {
        const hasProduct = v.lines.some(l => l.productId === filter.productId);
        if (!hasProduct) return false;
      }

      if (filter.searchText) {
        const search = filter.searchText.toLowerCase();
        const matchVoucher = v.voucherNo.toLowerCase().includes(search) ||
          v.partnerName?.toLowerCase().includes(search) ||
          v.description?.toLowerCase().includes(search);
        const matchLine = v.lines.some(l =>
          l.productCode.toLowerCase().includes(search) ||
          l.productName.toLowerCase().includes(search)
        );
        if (!matchVoucher && !matchLine) return false;
      }

      return true;
    });
  }

  private generateId(type: WarehouseVoucherType): string {
    const prefix = type === 'RECEIPT' ? 'WH-R' : 'WH-I';
    return `${prefix}-${Date.now()}`;
  }

  getNextVoucherNo(type: WarehouseVoucherType): string {
    const prefix = type === 'RECEIPT' ? 'PNK' : 'PXK';
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    const vouchers = this.vouchersSubject.value
      .filter(v => v.voucherType === type)
      .filter(v => v.voucherNo.includes(yearMonth));

    const maxNo = vouchers.reduce((max, v) => {
      const match = v.voucherNo.match(/-(\d+)$/);
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);

    return `${prefix}-${yearMonth}-${String(maxNo + 1).padStart(3, '0')}`;
  }

  private setJournalAccounts(voucher: WarehouseVoucher): void {
    if (voucher.voucherType === 'RECEIPT' && voucher.receiptType) {
      const mapping = RECEIPT_JOURNAL_MAPPING[voucher.receiptType];
      voucher.debitAccount = mapping.debit;
      voucher.creditAccount = mapping.credit;
    } else if (voucher.voucherType === 'ISSUE' && voucher.issueType) {
      const mapping = ISSUE_JOURNAL_MAPPING[voucher.issueType];
      voucher.debitAccount = mapping.debit;
      voucher.creditAccount = mapping.credit;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LINE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  addLine(voucherId: string, line: Partial<WarehouseVoucherLine>): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const index = vouchers.findIndex(v => v.id === voucherId);

    if (index === -1) return of(undefined);

    const voucher = vouchers[index];
    if (voucher.status !== 'DRAFT') return of(undefined);

    const newLine: WarehouseVoucherLine = {
      ...line,
      id: `WHL-${Date.now()}`,
      lineNo: voucher.lines.length + 1,
      amount: calculateLineAmount(line.quantity || 0, line.unitPrice || 0)
    } as WarehouseVoucherLine;

    voucher.lines.push(newLine);

    const totals = calculateVoucherTotals(voucher.lines);
    voucher.totalQuantity = totals.totalQuantity;
    voucher.totalAmount = totals.totalAmount;

    vouchers[index] = { ...voucher };
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    return of(voucher);
  }

  updateLine(voucherId: string, lineId: string, updates: Partial<WarehouseVoucherLine>): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const voucherIndex = vouchers.findIndex(v => v.id === voucherId);

    if (voucherIndex === -1) return of(undefined);

    const voucher = vouchers[voucherIndex];
    if (voucher.status !== 'DRAFT') return of(undefined);

    const lineIndex = voucher.lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return of(undefined);

    const updatedLine = { ...voucher.lines[lineIndex], ...updates };
    updatedLine.amount = calculateLineAmount(updatedLine.quantity, updatedLine.unitPrice);
    voucher.lines[lineIndex] = updatedLine;

    const totals = calculateVoucherTotals(voucher.lines);
    voucher.totalQuantity = totals.totalQuantity;
    voucher.totalAmount = totals.totalAmount;

    vouchers[voucherIndex] = { ...voucher };
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    return of(voucher);
  }

  removeLine(voucherId: string, lineId: string): Observable<WarehouseVoucher | undefined> {
    const vouchers = this.vouchersSubject.value;
    const voucherIndex = vouchers.findIndex(v => v.id === voucherId);

    if (voucherIndex === -1) return of(undefined);

    const voucher = vouchers[voucherIndex];
    if (voucher.status !== 'DRAFT') return of(undefined);

    voucher.lines = voucher.lines.filter(l => l.id !== lineId);

    // Renumber lines
    voucher.lines.forEach((l, i) => l.lineNo = i + 1);

    const totals = calculateVoucherTotals(voucher.lines);
    voucher.totalQuantity = totals.totalQuantity;
    voucher.totalAmount = totals.totalAmount;

    vouchers[voucherIndex] = { ...voucher };
    this.vouchersSubject.next([...vouchers]);
    this.saveToStorage();

    return of(voucher);
  }
}
