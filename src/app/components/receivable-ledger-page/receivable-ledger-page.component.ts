import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, from, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { HddtSoldInvoice } from '../../services/hddt.service';
import { HddtCacheService } from '../../services/hddt-cache.service';
import { CashVoucherService } from '../../services/cash-voucher.service';
import { CashVoucher } from '../../models/cash-voucher.models';

/**
 * Dòng chi tiết công nợ phải thu
 */
interface ReceivableLine {
  date: Date;
  voucherNo: string;
  voucherType: 'INVOICE' | 'RECEIPT' | 'RETURN' | 'OTHER';
  description: string;
  debitAmount: number;  // Phát sinh Nợ (tăng công nợ - bán hàng)
  creditAmount: number; // Phát sinh Có (giảm công nợ - thu tiền)
  balance: number;
}

/**
 * Công nợ theo từng Khách hàng
 */
interface CustomerReceivable {
  customerId: string;       // MST làm ID (hoặc tên nếu không có MST)
  customerCode: string;     // MST
  customerName: string;
  customerAddress: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: ReceivableLine[];
}

/**
 * Tổng hợp công nợ
 */
interface ReceivableSummary {
  totalCustomers: number;
  totalOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalClosingBalance: number;
}

/**
 * SỔ CHI TIẾT TÀI KHOẢN 131 - PHẢI THU KHÁCH HÀNG
 *
 * Nguồn dữ liệu:
 * - Hóa đơn bán ra (từ HDDT/IndexedDB): Ghi Nợ TK131 (tăng công nợ)
 * - Phiếu thu (từ Backend API): Ghi Có TK131 (giảm công nợ)
 *
 * Công thức: Dư cuối kỳ = Dư đầu kỳ + PS Nợ - PS Có
 * (TK131 có số dư bên Nợ = số tiền còn phải thu KH)
 */
@Component({
  selector: 'app-receivable-ledger-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receivable-ledger-page.component.html',
  styleUrl: './receivable-ledger-page.component.css'
})
export class ReceivableLedgerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Services
  private hddtCacheService = inject(HddtCacheService);
  private cashVoucherService = inject(CashVoucherService);

  // Raw data (loaded once from IndexedDB/API)
  private allSalesInvoices: HddtSoldInvoice[] = [];
  private allReceiptVouchers: CashVoucher[] = [];

  // Processed data
  customerReceivables = signal<CustomerReceivable[]>([]);
  selectedCustomerData = signal<CustomerReceivable | null>(null);

  // Filter
  selectedCustomerId = signal('');
  fromDate = signal<Date>(new Date(new Date().getFullYear(), 0, 1)); // Đầu năm
  toDate = signal<Date>(new Date()); // Hôm nay

  // Summary
  summary = signal<ReceivableSummary>({
    totalCustomers: 0,
    totalOpeningBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalClosingBalance: 0
  });

  // View mode
  viewMode = signal<'summary' | 'detail'>('summary');

  // Loading
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  dataLoaded = signal(false);

  // Cache info
  invoiceCount = signal(0);
  voucherCount = signal(0);

  // Computed: Danh sách KH từ dữ liệu
  customers = computed(() => {
    return this.customerReceivables().map(c => ({
      id: c.customerId,
      code: c.customerCode,
      name: c.customerName
    }));
  });

  ngOnInit(): void {
    this.loadAllData();
  }

  /**
   * Tải lại dữ liệu (gọi từ template)
   */
  loadData(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING - Load once from IndexedDB/API
  // ═══════════════════════════════════════════════════════════════════

  loadAllData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Load song song: Hóa đơn bán ra từ IndexedDB + Phiếu thu từ API
    forkJoin({
      salesInvoices: from(this.hddtCacheService.getAllSoldInvoices()).pipe(
        catchError(err => {
          console.error('Lỗi load hóa đơn bán ra từ IndexedDB:', err);
          return of([] as HddtSoldInvoice[]);
        })
      ),
      receiptVouchers: this.cashVoucherService.getVouchers({ voucherType: 'RECEIPT' }).pipe(
        catchError(err => {
          console.error('Lỗi load phiếu thu từ API:', err);
          return of([] as CashVoucher[]);
        })
      )
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ salesInvoices, receiptVouchers }) => {
        // Store raw data
        this.allSalesInvoices = salesInvoices;
        this.allReceiptVouchers = receiptVouchers;

        // Update counts
        this.invoiceCount.set(salesInvoices.length);
        this.voucherCount.set(receiptVouchers.length);

        console.log('=== SỔ CÔNG NỢ 131 ===');
        console.log('Tổng số hóa đơn bán ra trong IndexedDB:', salesInvoices.length);
        console.log('Tổng số phiếu thu trong Firebase:', receiptVouchers.length);

        // Process with current filter
        this.processData();
        this.dataLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu sổ công nợ 131:', err);
        this.errorMessage.set('Lỗi tải dữ liệu. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Xử lý dữ liệu: Filter và gom nhóm theo Khách hàng (MST hoặc tên)
   * Gọi khi thay đổi date range - KHÔNG load lại từ DB
   */
  processData(): void {
    const fromD = new Date(this.fromDate());
    fromD.setHours(0, 0, 0, 0);

    const toD = new Date(this.toDate());
    toD.setHours(23, 59, 59, 999);

    console.log('Filter khoảng thời gian:', fromD.toLocaleDateString('vi-VN'), '-', toD.toLocaleDateString('vi-VN'));

    // Map theo ID khách hàng (MST hoặc tên nếu không có MST)
    const customerMap = new Map<string, CustomerReceivable>();

    // 1. Xử lý hóa đơn bán ra -> Ghi Nợ TK131 (tăng công nợ)
    const filteredInvoices = this.allSalesInvoices.filter(inv => {
      const invDate = new Date(inv.tdlap);
      const inRange = invDate >= fromD && invDate <= toD;
      const isActive = inv.tthai === 1;
      return inRange && isActive;
    });

    console.log('Số hóa đơn bán ra trong kỳ:', filteredInvoices.length);

    filteredInvoices.forEach(inv => {
      // ID khách hàng: ưu tiên MST, nếu không có thì dùng tên
      const customerId = inv.nmmst || inv.nmten || inv.nmtnmua || 'KHACH_LE';
      const customerName = inv.nmten || inv.nmtnmua || 'Khách lẻ';
      const customerCode = inv.nmmst || '';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerCode,
          customerName,
          customerAddress: inv.nmdchi || '',
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          lines: []
        });
      }

      const customer = customerMap.get(customerId)!;
      const invoiceSymbol = `${inv.khmshdon}${inv.khhdon}`;

      customer.lines.push({
        date: new Date(inv.tdlap),
        voucherNo: `${invoiceSymbol}-${inv.shdon}`,
        voucherType: 'INVOICE',
        description: `Bán hàng - HĐ ${invoiceSymbol} số ${inv.shdon}`,
        debitAmount: inv.tgtttbso, // Tổng thanh toán (bao gồm thuế)
        creditAmount: 0,
        balance: 0
      });

      customer.totalDebit += inv.tgtttbso;
    });

    // 2. Xử lý phiếu thu -> Ghi Có TK131 (giảm công nợ)
    const filteredReceipts = this.allReceiptVouchers.filter(rcpt => {
      const rcptDate = new Date(rcpt.voucherDate);
      return rcptDate >= fromD && rcptDate <= toD &&
        rcpt.status !== 'CANCELLED' &&
        rcpt.relatedObjectType === 'CUSTOMER';
    });

    console.log('Số phiếu thu trong kỳ (từ KH):', filteredReceipts.length);

    filteredReceipts.forEach(rcpt => {
      // ID khách hàng: ưu tiên MST, nếu không có thì dùng tên
      const customerId = rcpt.relatedObjectCode || rcpt.relatedObjectName || 'KHACH_LE';
      const customerName = rcpt.relatedObjectName || 'Khách lẻ';
      const customerCode = rcpt.relatedObjectCode || '';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerCode,
          customerName,
          customerAddress: rcpt.address || '',
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          lines: []
        });
      }

      const customer = customerMap.get(customerId)!;

      customer.lines.push({
        date: new Date(rcpt.voucherDate),
        voucherNo: rcpt.voucherNo,
        voucherType: 'RECEIPT',
        description: rcpt.reason || `Thu tiền từ ${rcpt.relatedObjectName}`,
        debitAmount: 0,
        creditAmount: rcpt.grandTotal,
        balance: 0
      });

      customer.totalCredit += rcpt.grandTotal;
    });

    // 3. Tính số dư và sắp xếp
    const receivables: CustomerReceivable[] = [];

    customerMap.forEach(customer => {
      // Sắp xếp lines theo ngày
      customer.lines.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Tính số dư lũy kế (TK131: Nợ tăng, Có giảm)
      let balance = customer.openingBalance;
      customer.lines.forEach(line => {
        balance = balance + line.debitAmount - line.creditAmount;
        line.balance = balance;
      });

      customer.closingBalance = balance;
      receivables.push(customer);
    });

    // Sắp xếp theo tên KH
    receivables.sort((a, b) => a.customerName.localeCompare(b.customerName));

    this.customerReceivables.set(receivables);
    this.calculateSummary();

    // Cập nhật selected customer nếu đang xem detail
    if (this.selectedCustomerId()) {
      const selected = receivables.find(c => c.customerId === this.selectedCustomerId());
      this.selectedCustomerData.set(selected || null);
    }
  }

  private calculateSummary(): void {
    const receivables = this.customerReceivables();
    this.summary.set({
      totalCustomers: receivables.length,
      totalOpeningBalance: receivables.reduce((sum, c) => sum + c.openingBalance, 0),
      totalDebit: receivables.reduce((sum, c) => sum + c.totalDebit, 0),
      totalCredit: receivables.reduce((sum, c) => sum + c.totalCredit, 0),
      totalClosingBalance: receivables.reduce((sum, c) => sum + c.closingBalance, 0)
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VIEW
  // ═══════════════════════════════════════════════════════════════════

  showSummary(): void {
    this.viewMode.set('summary');
    this.selectedCustomerId.set('');
    this.selectedCustomerData.set(null);
  }

  showDetail(customerId: string): void {
    this.selectedCustomerId.set(customerId);
    const customer = this.customerReceivables().find(c => c.customerId === customerId);
    this.selectedCustomerData.set(customer || null);
    this.viewMode.set('detail');
  }

  onCustomerChange(): void {
    const id = this.selectedCustomerId();
    if (id) {
      this.showDetail(id);
    } else {
      this.showSummary();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATE RANGE - Filter on client, no API call
  // ═══════════════════════════════════════════════════════════════════

  setDateRange(range: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear'): void {
    const now = new Date();

    switch (range) {
      case 'thisMonth':
        this.fromDate.set(new Date(now.getFullYear(), now.getMonth(), 1));
        this.toDate.set(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'lastMonth':
        this.fromDate.set(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        this.toDate.set(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        this.fromDate.set(new Date(now.getFullYear(), quarter * 3, 1));
        this.toDate.set(new Date(now.getFullYear(), quarter * 3 + 3, 0));
        break;
      case 'thisYear':
        this.fromDate.set(new Date(now.getFullYear(), 0, 1));
        this.toDate.set(new Date(now.getFullYear(), 11, 31));
        break;
    }

    // Re-process with new filter (no API call)
    this.processData();
  }

  onFromDateChange(dateString: string): void {
    this.fromDate.set(new Date(dateString));
    this.processData(); // Filter on client
  }

  onToDateChange(dateString: string): void {
    this.toDate.set(new Date(dateString));
    this.processData(); // Filter on client
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════

  exportToExcel(): void {
    let csvContent: string;

    if (this.viewMode() === 'summary') {
      const headers = ['STT', 'Mã KH', 'Tên khách hàng', 'Dư đầu kỳ', 'PS Nợ', 'PS Có', 'Dư Nợ', 'Dư Có'];
      const rows = this.customerReceivables().map((c, i) => [
        i + 1, c.customerCode, c.customerName, c.openingBalance, c.totalDebit, c.totalCredit,
        this.getDebitBalance(c.closingBalance) || '', this.getCreditBalance(c.closingBalance) || ''
      ]);
      const sum = this.summary();

      csvContent = [
        'SỔ CHI TIẾT TÀI KHOẢN 131 - PHẢI THU KHÁCH HÀNG',
        `Kỳ: ${this.formatDate(this.fromDate())} - ${this.formatDate(this.toDate())}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(',')),
        '',
        `Tổng cộng,,,${sum.totalOpeningBalance},${sum.totalDebit},${sum.totalCredit},${this.getDebitBalance(sum.totalClosingBalance) || ''},${this.getCreditBalance(sum.totalClosingBalance) || ''}`
      ].join('\n');
    } else {
      const c = this.selectedCustomerData()!;
      const headers = ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'PS Nợ', 'PS Có', 'Dư Nợ', 'Dư Có'];
      const rows = c.lines.map(l => [
        this.formatDate(l.date), l.voucherNo, this.getVoucherTypeLabel(l.voucherType),
        `"${l.description}"`, l.debitAmount || '', l.creditAmount || '',
        l.balance > 0 ? l.balance : '', l.balance < 0 ? -l.balance : ''
      ]);

      csvContent = [
        `SỔ CHI TIẾT TK 131 - ${c.customerCode} - ${c.customerName}`,
        `Kỳ: ${this.formatDate(this.fromDate())} - ${this.formatDate(this.toDate())}`,
        '',
        headers.join(','),
        `${this.formatDate(this.fromDate())},,,"Dư đầu kỳ",,,,${c.openingBalance > 0 ? c.openingBalance : ''},${c.openingBalance < 0 ? -c.openingBalance : ''}`,
        ...rows.map(r => r.join(',')),
        `${this.formatDate(this.toDate())},,,"Dư cuối kỳ",,,,${c.closingBalance > 0 ? c.closingBalance : ''},${c.closingBalance < 0 ? -c.closingBalance : ''}`
      ].join('\n');
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoCongNo131_${this.formatDateForFile(new Date())}.csv`;
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
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDateForFile(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  getVoucherTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'INVOICE': 'Hóa đơn',
      'RECEIPT': 'Phiếu thu',
      'RETURN': 'Trả hàng',
      'OTHER': 'Khác'
    };
    return labels[type] || type;
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-debit';
    if (balance < 0) return 'balance-credit';
    return '';
  }

  /** Trả về giá trị Dư Nợ (balance > 0), ngược lại 0 */
  getDebitBalance(balance: number): number {
    return balance > 0 ? balance : 0;
  }

  /** Trả về giá trị Dư Có (balance < 0, đổi dấu), ngược lại 0 */
  getCreditBalance(balance: number): number {
    return balance < 0 ? -balance : 0;
  }
}
