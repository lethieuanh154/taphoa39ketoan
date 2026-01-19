/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INVOICE SERVICE - HÓA ĐƠN MUA VÀO / BÁN RA
 * Quản lý hóa đơn GTGT theo Thông tư 78/2021/TT-BTC và Nghị định 123/2020/NĐ-CP
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay, map } from 'rxjs';
import {
  Invoice,
  InvoiceLine,
  InvoiceType,
  InvoiceStatus,
  InvoiceFilter,
  VATRate,
  VAT_RATES,
  calculateLineTotal,
  calculateInvoiceTotals,
  generateJournalFromInvoice,
  REVENUE_ACCOUNTS,
  EXPENSE_ACCOUNTS
} from './invoice.models';

/**
 * Summary cho dashboard
 */
export interface InvoiceSummary {
  totalInvoices: number;
  totalAmount: number;
  totalVAT: number;
  totalPaid: number;
  totalUnpaid: number;
  byStatus: Record<InvoiceStatus, { count: number; amount: number }>;
  byPaymentStatus: Record<'UNPAID' | 'PARTIAL' | 'PAID', { count: number; amount: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  public invoices$ = this.invoicesSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const now = new Date();
    const demoInvoices: Invoice[] = [
      // Hóa đơn bán ra (OUTPUT)
      {
        id: 'INV-OUT-001',
        invoiceType: 'OUTPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000001',
        invoiceSeries: '1C25TTT',
        invoiceDate: new Date('2025-01-05'),
        partnerId: 'KH001',
        partnerCode: 'KH001',
        partnerName: 'Công ty TNHH ABC',
        partnerTaxCode: '0123456789',
        partnerAddress: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
        lines: [
          {
            id: 'LINE-001',
            lineNo: 1,
            productCode: 'SP001',
            productName: 'Gạo ST25 túi 5kg',
            unit: 'Túi',
            quantity: 100,
            unitPrice: 120000,
            amount: 12000000,
            vatRate: 5,
            vatAmount: 600000,
            totalAmount: 12600000,
            accountCode: '5111'
          },
          {
            id: 'LINE-002',
            lineNo: 2,
            productCode: 'SP002',
            productName: 'Dầu ăn Neptune 1L',
            unit: 'Chai',
            quantity: 50,
            unitPrice: 45000,
            amount: 2250000,
            vatRate: 8,
            vatAmount: 180000,
            totalAmount: 2430000,
            accountCode: '5111'
          }
        ],
        totalQuantity: 150,
        subTotal: 14250000,
        totalDiscount: 0,
        totalVAT: 780000,
        grandTotal: 15030000,
        paymentMethod: 'BANK',
        paymentStatus: 'PAID',
        paidAmount: 15030000,
        dueDate: new Date('2025-01-20'),
        status: 'POSTED',
        taxAuthCode: 'M1-25-E-123456789',
        note: 'Đơn hàng tháng 1/2025',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-05T09:00:00'),
        approvedBy: 'ketoan',
        approvedAt: new Date('2025-01-05T10:00:00'),
        postedBy: 'ketoan',
        postedAt: new Date('2025-01-05T10:30:00'),
        createdAt: new Date('2025-01-05T09:00:00'),
        updatedAt: new Date('2025-01-05T10:30:00'),
        createdBy: 'admin'
      },
      {
        id: 'INV-OUT-002',
        invoiceType: 'OUTPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000002',
        invoiceSeries: '1C25TTT',
        invoiceDate: new Date('2025-01-08'),
        partnerId: 'KH002',
        partnerCode: 'KH002',
        partnerName: 'Siêu thị Big C',
        partnerTaxCode: '0312345678',
        partnerAddress: '456 Lê Văn Việt, Q.9, TP.HCM',
        lines: [
          {
            id: 'LINE-003',
            lineNo: 1,
            productCode: 'SP003',
            productName: 'Nước mắm Phú Quốc 500ml',
            unit: 'Chai',
            quantity: 200,
            unitPrice: 35000,
            amount: 7000000,
            vatRate: 8,
            vatAmount: 560000,
            totalAmount: 7560000,
            accountCode: '5111'
          }
        ],
        totalQuantity: 200,
        subTotal: 7000000,
        totalDiscount: 0,
        totalVAT: 560000,
        grandTotal: 7560000,
        paymentMethod: 'CREDIT',
        paymentStatus: 'PARTIAL',
        paidAmount: 4000000,
        dueDate: new Date('2025-02-08'),
        status: 'POSTED',
        note: '',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-08T14:00:00'),
        approvedBy: 'ketoan',
        approvedAt: new Date('2025-01-08T15:00:00'),
        postedBy: 'ketoan',
        postedAt: new Date('2025-01-08T15:30:00'),
        createdAt: new Date('2025-01-08T14:00:00'),
        updatedAt: new Date('2025-01-08T15:30:00'),
        createdBy: 'admin'
      },
      {
        id: 'INV-OUT-003',
        invoiceType: 'OUTPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000003',
        invoiceSeries: '1C25TTT',
        invoiceDate: new Date('2025-01-10'),
        partnerId: 'KH003',
        partnerCode: 'KH003',
        partnerName: 'Cửa hàng Bách Hóa Xanh',
        partnerTaxCode: '0398765432',
        partnerAddress: '789 Võ Văn Ngân, Thủ Đức, TP.HCM',
        lines: [
          {
            id: 'LINE-004',
            lineNo: 1,
            productCode: 'DV001',
            productName: 'Dịch vụ vận chuyển hàng hóa',
            unit: 'Chuyến',
            quantity: 5,
            unitPrice: 500000,
            amount: 2500000,
            vatRate: 8,
            vatAmount: 200000,
            totalAmount: 2700000,
            accountCode: '5113'
          }
        ],
        totalQuantity: 5,
        subTotal: 2500000,
        totalDiscount: 0,
        totalVAT: 200000,
        grandTotal: 2700000,
        paymentMethod: 'CASH',
        paymentStatus: 'UNPAID',
        paidAmount: 0,
        dueDate: new Date('2025-01-25'),
        status: 'DRAFT',
        note: 'Chờ xác nhận',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-10T08:00:00'),
        createdAt: new Date('2025-01-10T08:00:00'),
        updatedAt: new Date('2025-01-10T08:00:00'),
        createdBy: 'admin'
      },

      // Hóa đơn mua vào (INPUT)
      {
        id: 'INV-IN-001',
        invoiceType: 'INPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000521',
        invoiceSeries: '1C25AAA',
        invoiceDate: new Date('2025-01-03'),
        partnerId: 'NCC001',
        partnerCode: 'NCC001',
        partnerName: 'Công ty CP Lương Thực Miền Nam',
        partnerTaxCode: '0301234567',
        partnerAddress: '100 Điện Biên Phủ, Q.1, TP.HCM',
        lines: [
          {
            id: 'LINE-005',
            lineNo: 1,
            productCode: 'NL001',
            productName: 'Gạo ST25 nguyên liệu',
            unit: 'Tấn',
            quantity: 5,
            unitPrice: 18000000,
            amount: 90000000,
            vatRate: 5,
            vatAmount: 4500000,
            totalAmount: 94500000,
            accountCode: '1561'
          }
        ],
        totalQuantity: 5,
        subTotal: 90000000,
        totalDiscount: 0,
        totalVAT: 4500000,
        grandTotal: 94500000,
        paymentMethod: 'BANK',
        paymentStatus: 'PAID',
        paidAmount: 94500000,
        dueDate: new Date('2025-01-18'),
        status: 'POSTED',
        taxAuthCode: 'M1-25-E-987654321',
        note: 'Nhập hàng đợt 1/2025',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-03T10:00:00'),
        approvedBy: 'ketoan',
        approvedAt: new Date('2025-01-03T11:00:00'),
        postedBy: 'ketoan',
        postedAt: new Date('2025-01-03T11:30:00'),
        createdAt: new Date('2025-01-03T10:00:00'),
        updatedAt: new Date('2025-01-03T11:30:00'),
        createdBy: 'admin'
      },
      {
        id: 'INV-IN-002',
        invoiceType: 'INPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000089',
        invoiceSeries: '1C25BBB',
        invoiceDate: new Date('2025-01-06'),
        partnerId: 'NCC002',
        partnerCode: 'NCC002',
        partnerName: 'Công ty TNHH Dầu Thực Vật',
        partnerTaxCode: '0312456789',
        partnerAddress: '55 Trường Chinh, Tân Bình, TP.HCM',
        lines: [
          {
            id: 'LINE-006',
            lineNo: 1,
            productCode: 'NL002',
            productName: 'Dầu ăn Neptune 1L (thùng 12 chai)',
            unit: 'Thùng',
            quantity: 100,
            unitPrice: 480000,
            amount: 48000000,
            vatRate: 8,
            vatAmount: 3840000,
            totalAmount: 51840000,
            accountCode: '1561'
          },
          {
            id: 'LINE-007',
            lineNo: 2,
            productCode: 'NL003',
            productName: 'Chi phí vận chuyển',
            unit: 'Chuyến',
            quantity: 1,
            unitPrice: 2000000,
            amount: 2000000,
            vatRate: 8,
            vatAmount: 160000,
            totalAmount: 2160000,
            accountCode: '6427'
          }
        ],
        totalQuantity: 101,
        subTotal: 50000000,
        totalDiscount: 0,
        totalVAT: 4000000,
        grandTotal: 54000000,
        paymentMethod: 'CREDIT',
        paymentStatus: 'UNPAID',
        paidAmount: 0,
        dueDate: new Date('2025-02-06'),
        status: 'POSTED',
        note: '',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-06T09:00:00'),
        approvedBy: 'ketoan',
        approvedAt: new Date('2025-01-06T10:00:00'),
        postedBy: 'ketoan',
        postedAt: new Date('2025-01-06T10:30:00'),
        createdAt: new Date('2025-01-06T09:00:00'),
        updatedAt: new Date('2025-01-06T10:30:00'),
        createdBy: 'admin'
      },
      {
        id: 'INV-IN-003',
        invoiceType: 'INPUT',
        vatInvoiceType: 'HDON',
        invoiceNo: '00000234',
        invoiceSeries: '1C25CCC',
        invoiceDate: new Date('2025-01-09'),
        partnerId: 'NCC003',
        partnerCode: 'NCC003',
        partnerName: 'Công ty Điện Lực TP.HCM',
        partnerTaxCode: '0300123456',
        partnerAddress: '35 Tôn Đức Thắng, Q.1, TP.HCM',
        lines: [
          {
            id: 'LINE-008',
            lineNo: 1,
            productCode: 'DV-DIEN',
            productName: 'Tiền điện tháng 12/2024',
            unit: 'kWh',
            quantity: 5000,
            unitPrice: 2500,
            amount: 12500000,
            vatRate: 8,
            vatAmount: 1000000,
            totalAmount: 13500000,
            accountCode: '6427'
          }
        ],
        totalQuantity: 5000,
        subTotal: 12500000,
        totalDiscount: 0,
        totalVAT: 1000000,
        grandTotal: 13500000,
        paymentMethod: 'BANK',
        paymentStatus: 'PAID',
        paidAmount: 13500000,
        status: 'POSTED',
        note: 'Chi phí điện kỳ trước',
        preparedBy: 'admin',
        preparedAt: new Date('2025-01-09T08:00:00'),
        approvedBy: 'ketoan',
        approvedAt: new Date('2025-01-09T09:00:00'),
        postedBy: 'ketoan',
        postedAt: new Date('2025-01-09T09:30:00'),
        createdAt: new Date('2025-01-09T08:00:00'),
        updatedAt: new Date('2025-01-09T09:30:00'),
        createdBy: 'admin'
      }
    ];

    this.invoicesSubject.next(demoInvoices);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách hóa đơn theo bộ lọc
   */
  getInvoices(filter?: InvoiceFilter): Observable<Invoice[]> {
    return this.invoices$.pipe(
      map(invoices => {
        if (!filter) return invoices;

        return invoices.filter(inv => {
          // Filter by type
          if (filter.invoiceType && inv.invoiceType !== filter.invoiceType) {
            return false;
          }

          // Filter by status
          if (filter.status && inv.status !== filter.status) {
            return false;
          }

          // Filter by date range
          if (filter.fromDate) {
            const fromDate = new Date(filter.fromDate);
            fromDate.setHours(0, 0, 0, 0);
            if (inv.invoiceDate < fromDate) return false;
          }
          if (filter.toDate) {
            const toDate = new Date(filter.toDate);
            toDate.setHours(23, 59, 59, 999);
            if (inv.invoiceDate > toDate) return false;
          }

          // Filter by payment status
          if (filter.paymentStatus && inv.paymentStatus !== filter.paymentStatus) {
            return false;
          }

          // Search keyword
          if (filter.search) {
            const keyword = filter.search.toLowerCase();
            const searchFields = [
              inv.invoiceNo,
              inv.invoiceSeries,
              inv.partnerName || '',
              inv.partnerTaxCode || '',
              inv.note || ''
            ].join(' ').toLowerCase();
            if (!searchFields.includes(keyword)) return false;
          }

          return true;
        });
      })
    );
  }

  /**
   * Lấy chi tiết một hóa đơn
   */
  getInvoiceById(id: string): Observable<Invoice | undefined> {
    return this.invoices$.pipe(
      map(invoices => invoices.find(inv => inv.id === id))
    );
  }

  /**
   * Tạo hóa đơn mới
   */
  createInvoice(invoice: Partial<Invoice>): Observable<Invoice> {
    this.loadingSubject.next(true);

    const invoices = this.invoicesSubject.value;
    const invoiceType = invoice.invoiceType || 'OUTPUT';

    // Generate ID and number
    const prefix = invoiceType === 'OUTPUT' ? 'INV-OUT' : 'INV-IN';
    const count = invoices.filter(i => i.invoiceType === invoiceType).length + 1;
    const id = `${prefix}-${String(count).padStart(3, '0')}`;
    const invoiceNo = String(count).padStart(8, '0');

    const now = new Date();
    const newInvoice: Invoice = {
      id,
      invoiceType,
      vatInvoiceType: invoice.vatInvoiceType || 'HDON',
      invoiceNo,
      invoiceSeries: invoice.invoiceSeries || '1C25TTT',
      invoiceDate: invoice.invoiceDate || now,
      partnerId: invoice.partnerId,
      partnerCode: invoice.partnerCode,
      partnerName: invoice.partnerName || '',
      partnerTaxCode: invoice.partnerTaxCode,
      partnerAddress: invoice.partnerAddress,
      lines: invoice.lines || [],
      totalQuantity: 0,
      subTotal: 0,
      totalDiscount: 0,
      totalVAT: 0,
      grandTotal: 0,
      paymentMethod: invoice.paymentMethod || 'CASH',
      paymentStatus: 'UNPAID',
      paidAmount: 0,
      dueDate: invoice.dueDate,
      status: 'DRAFT',
      note: invoice.note,
      preparedBy: 'admin',
      preparedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin'
    };

    // Calculate totals
    const totals = calculateInvoiceTotals(newInvoice.lines);
    newInvoice.totalQuantity = totals.totalQuantity;
    newInvoice.subTotal = totals.subTotal;
    newInvoice.totalDiscount = totals.totalDiscount;
    newInvoice.totalVAT = totals.totalVAT;
    newInvoice.grandTotal = totals.grandTotal;

    this.invoicesSubject.next([...invoices, newInvoice]);
    this.loadingSubject.next(false);

    return of(newInvoice).pipe(delay(300));
  }

  /**
   * Cập nhật hóa đơn
   */
  updateInvoice(id: string, updates: Partial<Invoice>): Observable<Invoice> {
    this.loadingSubject.next(true);

    const invoices = this.invoicesSubject.value;
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      this.loadingSubject.next(false);
      throw new Error('Không tìm thấy hóa đơn');
    }

    const invoice = invoices[index];
    if (invoice.status !== 'DRAFT') {
      this.loadingSubject.next(false);
      throw new Error('Chỉ được sửa hóa đơn ở trạng thái Nháp');
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      ...updates,
      updatedAt: new Date()
    };

    // Recalculate totals
    const totals = calculateInvoiceTotals(updatedInvoice.lines);
    updatedInvoice.totalQuantity = totals.totalQuantity;
    updatedInvoice.subTotal = totals.subTotal;
    updatedInvoice.totalDiscount = totals.totalDiscount;
    updatedInvoice.totalVAT = totals.totalVAT;
    updatedInvoice.grandTotal = totals.grandTotal;

    invoices[index] = updatedInvoice;
    this.invoicesSubject.next([...invoices]);
    this.loadingSubject.next(false);

    return of(updatedInvoice).pipe(delay(300));
  }

  /**
   * Xóa hóa đơn (chỉ ở trạng thái DRAFT)
   */
  deleteInvoice(id: string): Observable<boolean> {
    const invoices = this.invoicesSubject.value;
    const invoice = invoices.find(inv => inv.id === id);

    if (!invoice) {
      throw new Error('Không tìm thấy hóa đơn');
    }

    if (invoice.status !== 'DRAFT') {
      throw new Error('Chỉ được xóa hóa đơn ở trạng thái Nháp');
    }

    this.invoicesSubject.next(invoices.filter(inv => inv.id !== id));
    return of(true).pipe(delay(300));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ghi sổ hóa đơn - tạo bút toán
   */
  postInvoice(id: string): Observable<Invoice> {
    this.loadingSubject.next(true);

    const invoices = this.invoicesSubject.value;
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      this.loadingSubject.next(false);
      throw new Error('Không tìm thấy hóa đơn');
    }

    const invoice = invoices[index];
    if (invoice.status !== 'DRAFT') {
      this.loadingSubject.next(false);
      throw new Error('Chỉ được ghi sổ hóa đơn ở trạng thái Nháp');
    }

    // Generate journal entry
    const journalEntries = generateJournalFromInvoice(invoice);
    const taxCode = `M1-25-E-${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`;

    const updatedInvoice: Invoice = {
      ...invoice,
      status: 'POSTED',
      taxAuthCode: taxCode,
      postedBy: 'ketoan',
      postedAt: new Date(),
      updatedAt: new Date()
    };

    invoices[index] = updatedInvoice;
    this.invoicesSubject.next([...invoices]);
    this.loadingSubject.next(false);

    console.log('Generated journal entries:', journalEntries);

    return of(updatedInvoice).pipe(delay(300));
  }

  /**
   * Hủy hóa đơn
   */
  cancelInvoice(id: string, reason: string): Observable<Invoice> {
    this.loadingSubject.next(true);

    const invoices = this.invoicesSubject.value;
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      this.loadingSubject.next(false);
      throw new Error('Không tìm thấy hóa đơn');
    }

    const invoice = invoices[index];
    if (invoice.status === 'CANCELLED') {
      this.loadingSubject.next(false);
      throw new Error('Hóa đơn đã bị hủy');
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledBy: 'admin',
      cancelledAt: new Date(),
      updatedAt: new Date()
    };

    invoices[index] = updatedInvoice;
    this.invoicesSubject.next([...invoices]);
    this.loadingSubject.next(false);

    return of(updatedInvoice).pipe(delay(300));
  }

  /**
   * Cập nhật thanh toán
   */
  updatePayment(id: string, amount: number, paidDate: Date): Observable<Invoice> {
    this.loadingSubject.next(true);

    const invoices = this.invoicesSubject.value;
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      this.loadingSubject.next(false);
      throw new Error('Không tìm thấy hóa đơn');
    }

    const invoice = invoices[index];
    const newPaidAmount = (invoice.paidAmount || 0) + amount;

    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
    if (newPaidAmount >= invoice.grandTotal) {
      paymentStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'PARTIAL';
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmount: newPaidAmount,
      paymentStatus,
      updatedAt: new Date()
    };

    invoices[index] = updatedInvoice;
    this.invoicesSubject.next([...invoices]);
    this.loadingSubject.next(false);

    return of(updatedInvoice).pipe(delay(300));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY & STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy tổng hợp theo loại hóa đơn
   */
  getSummary(invoiceType: InvoiceType, filter?: InvoiceFilter): Observable<InvoiceSummary> {
    return this.getInvoices({ ...filter, invoiceType }).pipe(
      map(invoices => {
        const summary: InvoiceSummary = {
          totalInvoices: invoices.length,
          totalAmount: 0,
          totalVAT: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          byStatus: {
            DRAFT: { count: 0, amount: 0 },
            POSTED: { count: 0, amount: 0 },
            CANCELLED: { count: 0, amount: 0 },
            ADJUSTED: { count: 0, amount: 0 }
          },
          byPaymentStatus: {
            UNPAID: { count: 0, amount: 0 },
            PARTIAL: { count: 0, amount: 0 },
            PAID: { count: 0, amount: 0 }
          }
        };

        invoices.forEach(inv => {
          if (inv.status !== 'CANCELLED') {
            summary.totalAmount += inv.grandTotal;
            summary.totalVAT += inv.totalVAT;
            summary.totalPaid += inv.paidAmount || 0;
            summary.totalUnpaid += inv.grandTotal - (inv.paidAmount || 0);
          }

          // By status
          summary.byStatus[inv.status].count++;
          summary.byStatus[inv.status].amount += inv.grandTotal;

          // By payment status
          if (inv.paymentStatus) {
            summary.byPaymentStatus[inv.paymentStatus].count++;
            summary.byPaymentStatus[inv.paymentStatus].amount += inv.grandTotal;
          }
        });

        return summary;
      })
    );
  }

  /**
   * Lấy hóa đơn sắp đến hạn thanh toán
   */
  getDueInvoices(daysAhead: number = 7): Observable<Invoice[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.invoices$.pipe(
      map(invoices => invoices.filter(inv => {
        if (inv.status === 'CANCELLED' || inv.paymentStatus === 'PAID') {
          return false;
        }
        if (!inv.dueDate) return false;

        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate >= today && dueDate <= futureDate;
      }))
    );
  }

  /**
   * Lấy hóa đơn quá hạn
   */
  getOverdueInvoices(): Observable<Invoice[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.invoices$.pipe(
      map(invoices => invoices.filter(inv => {
        if (inv.status === 'CANCELLED' || inv.paymentStatus === 'PAID') {
          return false;
        }
        if (!inv.dueDate) return false;

        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate < today;
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy số hóa đơn tiếp theo
   */
  getNextInvoiceNumber(invoiceType: InvoiceType): Observable<string> {
    return this.invoices$.pipe(
      map(invoices => {
        const typeInvoices = invoices.filter(i => i.invoiceType === invoiceType);
        const maxNo = typeInvoices.reduce((max, inv) => {
          const num = parseInt(inv.invoiceNo, 10);
          return num > max ? num : max;
        }, 0);
        return String(maxNo + 1).padStart(8, '0');
      })
    );
  }

  /**
   * Lấy danh sách VAT rates
   */
  getVATRates(): { value: VATRate; label: string }[] {
    return VAT_RATES;
  }

  /**
   * Lấy danh sách tài khoản doanh thu
   */
  getRevenueAccounts(): { code: string; name: string }[] {
    return REVENUE_ACCOUNTS;
  }

  /**
   * Lấy danh sách tài khoản chi phí/mua hàng
   */
  getExpenseAccounts(): { code: string; name: string }[] {
    return EXPENSE_ACCOUNTS;
  }
}
