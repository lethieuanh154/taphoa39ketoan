import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, from, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { HddtInvoice } from '../../services/hddt.service';
import { HddtCacheService } from '../../services/hddt-cache.service';
import { CashVoucherService } from '../../services/cash-voucher.service';
import { CashVoucher } from '../../models/cash-voucher.models';

/**
 * Dòng chi tiết công nợ phải trả
 */
interface PayableLine {
  date: Date;
  voucherNo: string;
  voucherType: 'INVOICE' | 'PAYMENT' | 'RETURN' | 'OTHER';
  description: string;
  debitAmount: number;  // Phát sinh Nợ (giảm công nợ - trả tiền)
  creditAmount: number; // Phát sinh Có (tăng công nợ - mua hàng)
  balance: number;
}

/**
 * Công nợ theo từng NCC
 */
interface SupplierPayable {
  supplierId: string;       // MST làm ID
  supplierCode: string;     // MST
  supplierName: string;
  supplierAddress: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: PayableLine[];
}

/**
 * Tổng hợp công nợ
 */
interface PayableSummary {
  totalSuppliers: number;
  totalOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalClosingBalance: number;
}

/**
 * SỔ CHI TIẾT TÀI KHOẢN 331 - PHẢI TRẢ NHÀ CUNG CẤP
 *
 * Nguồn dữ liệu:
 * - Hóa đơn mua vào (từ HDDT/IndexedDB): Ghi Có TK331 (tăng công nợ)
 * - Phiếu chi (từ Backend API): Ghi Nợ TK331 (giảm công nợ)
 *
 * Công thức: Dư cuối kỳ = Dư đầu kỳ + PS Có - PS Nợ
 * (TK331 có số dư bên Có = số tiền còn nợ NCC)
 */
@Component({
  selector: 'app-payable-ledger-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payable-ledger-page.component.html',
  styleUrl: './payable-ledger-page.component.css'
})
export class PayableLedgerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Services
  private hddtCacheService = inject(HddtCacheService);
  private cashVoucherService = inject(CashVoucherService);

  // Raw data (loaded once from IndexedDB/API)
  private allPurchaseInvoices: HddtInvoice[] = [];
  private allPaymentVouchers: CashVoucher[] = [];

  // Processed data
  supplierPayables = signal<SupplierPayable[]>([]);
  selectedSupplierData = signal<SupplierPayable | null>(null);

  // Filter
  selectedSupplierId = signal('');
  fromDate = signal<Date>(new Date(new Date().getFullYear(), 0, 1)); // Đầu năm
  toDate = signal<Date>(new Date()); // Hôm nay

  // Summary
  summary = signal<PayableSummary>({
    totalSuppliers: 0,
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

  // Computed: Danh sách NCC từ dữ liệu
  suppliers = computed(() => {
    return this.supplierPayables().map(s => ({
      id: s.supplierId,
      code: s.supplierCode,
      name: s.supplierName
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

    // Load song song: Hóa đơn mua vào từ IndexedDB + Phiếu chi từ API
    forkJoin({
      purchaseInvoices: from(this.hddtCacheService.getAllInvoices()).pipe(
        catchError(err => {
          console.error('Lỗi load hóa đơn từ IndexedDB:', err);
          return of([] as HddtInvoice[]);
        })
      ),
      paymentVouchers: this.cashVoucherService.getVouchers({ voucherType: 'PAYMENT' }).pipe(
        catchError(err => {
          console.error('Lỗi load phiếu chi từ API:', err);
          return of([] as CashVoucher[]);
        })
      )
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ purchaseInvoices, paymentVouchers }) => {
        // Store raw data
        this.allPurchaseInvoices = purchaseInvoices;
        this.allPaymentVouchers = paymentVouchers;

        // Update counts
        this.invoiceCount.set(purchaseInvoices.length);
        this.voucherCount.set(paymentVouchers.length);

        console.log('=== SỔ CÔNG NỢ 331 ===');
        console.log('Tổng số hóa đơn mua vào trong IndexedDB:', purchaseInvoices.length);
        console.log('Tổng số phiếu chi trong Firebase:', paymentVouchers.length);

        // Process with current filter
        this.processData();
        this.dataLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu sổ công nợ 331:', err);
        this.errorMessage.set('Lỗi tải dữ liệu. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Xử lý dữ liệu: Filter và gom nhóm theo NCC (MST)
   * Gọi khi thay đổi date range - KHÔNG load lại từ DB
   */
  processData(): void {
    const fromD = new Date(this.fromDate());
    fromD.setHours(0, 0, 0, 0);

    const toD = new Date(this.toDate());
    toD.setHours(23, 59, 59, 999);

    console.log('Filter khoảng thời gian:', fromD.toLocaleDateString('vi-VN'), '-', toD.toLocaleDateString('vi-VN'));

    // Map theo MST nhà cung cấp
    const supplierMap = new Map<string, SupplierPayable>();

    // 1. Xử lý hóa đơn mua vào -> Ghi Có TK331 (tăng công nợ)
    const filteredInvoices = this.allPurchaseInvoices.filter(inv => {
      const invDate = new Date(inv.tdlap);
      const inRange = invDate >= fromD && invDate <= toD;
      const isActive = inv.tthai === 1; // Chỉ lấy HĐ hoạt động
      return inRange && isActive;
    });

    console.log('Số hóa đơn trong kỳ:', filteredInvoices.length);

    filteredInvoices.forEach(inv => {
      const mst = inv.nbmst; // MST người bán
      if (!mst) return;

      if (!supplierMap.has(mst)) {
        supplierMap.set(mst, {
          supplierId: mst,
          supplierCode: mst,
          supplierName: inv.nbten,
          supplierAddress: inv.nbdchi || '',
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          lines: []
        });
      }

      const supplier = supplierMap.get(mst)!;
      const invoiceSymbol = `${inv.khmshdon}${inv.khhdon}`;

      supplier.lines.push({
        date: new Date(inv.tdlap),
        voucherNo: `${invoiceSymbol}-${inv.shdon}`,
        voucherType: 'INVOICE',
        description: `Mua hàng - HĐ ${invoiceSymbol} số ${inv.shdon}`,
        debitAmount: 0,
        creditAmount: inv.tgtttbso, // Tổng thanh toán (bao gồm thuế)
        balance: 0
      });

      supplier.totalCredit += inv.tgtttbso;
    });

    // 2. Xử lý phiếu chi -> Ghi Nợ TK331 (giảm công nợ)
    const filteredPayments = this.allPaymentVouchers.filter(pmt => {
      const pmtDate = new Date(pmt.voucherDate);
      return pmtDate >= fromD && pmtDate <= toD &&
        pmt.status !== 'CANCELLED' &&
        pmt.relatedObjectType === 'SUPPLIER';
    });

    console.log('Số phiếu chi trong kỳ (cho NCC):', filteredPayments.length);

    filteredPayments.forEach(pmt => {
      const mst = pmt.relatedObjectCode; // MST NCC
      if (!mst) return;

      if (!supplierMap.has(mst)) {
        supplierMap.set(mst, {
          supplierId: mst,
          supplierCode: mst,
          supplierName: pmt.relatedObjectName,
          supplierAddress: pmt.address || '',
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          closingBalance: 0,
          lines: []
        });
      }

      const supplier = supplierMap.get(mst)!;

      supplier.lines.push({
        date: new Date(pmt.voucherDate),
        voucherNo: pmt.voucherNo,
        voucherType: 'PAYMENT',
        description: pmt.reason || `Thanh toán cho ${pmt.relatedObjectName}`,
        debitAmount: pmt.grandTotal,
        creditAmount: 0,
        balance: 0
      });

      supplier.totalDebit += pmt.grandTotal;
    });

    // 3. Tính số dư và sắp xếp
    const payables: SupplierPayable[] = [];

    supplierMap.forEach(supplier => {
      // Sắp xếp lines theo ngày
      supplier.lines.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Tính số dư lũy kế
      let balance = supplier.openingBalance;
      supplier.lines.forEach(line => {
        balance = balance + line.creditAmount - line.debitAmount;
        line.balance = balance;
      });

      supplier.closingBalance = balance;
      payables.push(supplier);
    });

    // Sắp xếp theo tên NCC
    payables.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

    this.supplierPayables.set(payables);
    this.calculateSummary();

    // Cập nhật selected supplier nếu đang xem detail
    if (this.selectedSupplierId()) {
      const selected = payables.find(s => s.supplierId === this.selectedSupplierId());
      this.selectedSupplierData.set(selected || null);
    }
  }

  private calculateSummary(): void {
    const payables = this.supplierPayables();
    this.summary.set({
      totalSuppliers: payables.length,
      totalOpeningBalance: payables.reduce((sum, s) => sum + s.openingBalance, 0),
      totalDebit: payables.reduce((sum, s) => sum + s.totalDebit, 0),
      totalCredit: payables.reduce((sum, s) => sum + s.totalCredit, 0),
      totalClosingBalance: payables.reduce((sum, s) => sum + s.closingBalance, 0)
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VIEW
  // ═══════════════════════════════════════════════════════════════════

  showSummary(): void {
    this.viewMode.set('summary');
    this.selectedSupplierId.set('');
    this.selectedSupplierData.set(null);
  }

  showDetail(supplierId: string): void {
    this.selectedSupplierId.set(supplierId);
    const supplier = this.supplierPayables().find(s => s.supplierId === supplierId);
    this.selectedSupplierData.set(supplier || null);
    this.viewMode.set('detail');
  }

  onSupplierChange(): void {
    const id = this.selectedSupplierId();
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
      const headers = ['STT', 'Mã NCC', 'Tên nhà cung cấp', 'Dư đầu kỳ', 'PS Nợ', 'PS Có', 'Dư cuối kỳ'];
      const rows = this.supplierPayables().map((s, i) => [
        i + 1, s.supplierCode, s.supplierName, s.openingBalance, s.totalDebit, s.totalCredit, s.closingBalance
      ]);
      const sum = this.summary();

      csvContent = [
        'SỔ CHI TIẾT TÀI KHOẢN 331 - PHẢI TRẢ NHÀ CUNG CẤP',
        `Kỳ: ${this.formatDate(this.fromDate())} - ${this.formatDate(this.toDate())}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(',')),
        '',
        `Tổng cộng,,,${sum.totalOpeningBalance},${sum.totalDebit},${sum.totalCredit},${sum.totalClosingBalance}`
      ].join('\n');
    } else {
      const s = this.selectedSupplierData()!;
      const headers = ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'PS Nợ', 'PS Có', 'Số dư'];
      const rows = s.lines.map(l => [
        this.formatDate(l.date), l.voucherNo, this.getVoucherTypeLabel(l.voucherType),
        `"${l.description}"`, l.debitAmount || '', l.creditAmount || '', l.balance
      ]);

      csvContent = [
        `SỔ CHI TIẾT TK 331 - ${s.supplierCode} - ${s.supplierName}`,
        `Kỳ: ${this.formatDate(this.fromDate())} - ${this.formatDate(this.toDate())}`,
        '',
        headers.join(','),
        `${this.formatDate(this.fromDate())},,,"Dư đầu kỳ",,,"${s.openingBalance}"`,
        ...rows.map(r => r.join(',')),
        `${this.formatDate(this.toDate())},,,"Dư cuối kỳ",,,"${s.closingBalance}"`
      ].join('\n');
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoCongNo331_${this.formatDateForFile(new Date())}.csv`;
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
      'PAYMENT': 'Phiếu chi',
      'RETURN': 'Trả hàng',
      'OTHER': 'Khác'
    };
    return labels[type] || type;
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-credit';
    if (balance < 0) return 'balance-debit';
    return '';
  }
}
