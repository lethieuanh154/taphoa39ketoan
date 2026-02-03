import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HddtService, HddtSoldInvoice, HddtInvoiceDetail } from '../../../services/hddt.service';
import { InvoiceDetailModalComponent, VoucherActionType } from '../../shared/invoice-detail-modal/invoice-detail-modal.component';
import { CreateVoucherFromInvoiceModalComponent, VoucherCreationType } from '../../shared/create-voucher-from-invoice-modal/create-voucher-from-invoice-modal.component';
import { InvoiceVoucherConverterService, CashVoucherFromInvoice, WarehouseVoucherFromInvoice } from '../../../services/invoice-voucher-converter.service';
import { CashVoucherService } from '../../../services/cash-voucher.service';
import { WarehouseService } from '../../../services/warehouse.service';
import { CreateVoucherDTO } from '../../../models/cash-voucher.models';

@Component({
  selector: 'app-sales-invoice-page',
  standalone: true,
  imports: [CommonModule, FormsModule, InvoiceDetailModalComponent, CreateVoucherFromInvoiceModalComponent],
  templateUrl: './sales-invoice-page.component.html',
  styleUrl: './sales-invoice-page.component.css'
})
export class SalesInvoicePageComponent implements OnInit {
  // State
  invoices = signal<HddtSoldInvoice[]>([]);
  allInvoices = signal<HddtSoldInvoice[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filter state
  fromDate = signal<string>(this.getDefaultFromDate());
  toDate = signal<string>(this.getDefaultToDate());
  searchQuery = signal<string>('');

  // Pagination state
  currentPage = signal(1);
  pageSize = signal(15);
  pageSizeOptions = [15, 50, 100];

  // Cache info
  cacheInfo = signal<{ count: number; lastUpdated: number | null }>({ count: 0, lastUpdated: null });

  // Modal state
  showDetailModal = signal(false);
  selectedInvoiceDetail = signal<HddtInvoiceDetail | null>(null);
  selectedInvoice = signal<HddtSoldInvoice | null>(null);
  detailLoading = signal(false);
  detailError = signal<string | null>(null);

  // Create voucher modal state
  showCreateVoucherModal = signal(false);
  createVoucherType = signal<VoucherCreationType>('RECEIPT');
  savingVoucher = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal<string | null>(null);

  // Services
  private cashVoucherService = inject(CashVoucherService);
  private warehouseService = inject(WarehouseService);

  // Computed - Pagination
  totalInvoices = computed(() => this.invoices().length);
  totalPages = computed(() => Math.ceil(this.invoices().length / this.pageSize()));
  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.invoices().length));
  paginatedInvoices = computed(() => {
    const start = this.startIndex();
    const end = this.endIndex();
    return this.invoices().slice(start, end);
  });
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });
  totalAmount = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.tgtttbso || 0), 0)
  );
  totalVat = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.tgtthue || 0), 0)
  );
  totalBeforeVat = computed(() =>
    this.invoices().reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0)
  );
  cacheLastUpdatedText = computed(() => {
    const lastUpdated = this.cacheInfo().lastUpdated;
    if (!lastUpdated) return '';
    const date = new Date(lastUpdated);
    return `Cập nhật lúc ${date.toLocaleTimeString('vi-VN')} ${date.toLocaleDateString('vi-VN')}`;
  });

  constructor(
    private hddtService: HddtService,
    private converterService: InvoiceVoucherConverterService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
    this.loadCacheInfo();
  }

  private getDefaultFromDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return this.formatDateForInput(date);
  }

  private getDefaultToDate(): string {
    return this.formatDateForInput(new Date());
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  loadInvoices(forceRefresh = false): void {
    if (!this.hddtService.hasToken()) {
      this.error.set('Vui lòng nhập HDDT Token để tiếp tục');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const from = new Date(this.fromDate());
    const to = new Date(this.toDate());

    this.hddtService.getSoldInvoicesInRange(from, to, forceRefresh).subscribe({
      next: (data) => {
        this.allInvoices.set(data);
        this.invoices.set(data);
        this.loading.set(false);
        this.loadCacheInfo();
      },
      error: (err) => {
        console.error('Error loading sold invoices:', err);
        this.error.set(err.status === 401
          ? 'Token hết hạn. Vui lòng đăng nhập lại hoadondientu.gdt.gov.vn và cập nhật token.'
          : 'Không thể tải dữ liệu hóa đơn. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  loadCacheInfo(): void {
    this.hddtService.getSoldCacheInfo().subscribe({
      next: (info) => this.cacheInfo.set(info)
    });
  }

  onFilterChange(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.loadInvoices();
  }

  onSearch(): void {
    const query = this.searchQuery().trim();
    this.currentPage.set(1);

    if (!query) {
      this.invoices.set(this.allInvoices());
      return;
    }

    this.hddtService.searchSoldInvoicesInCache(query).subscribe({
      next: (results) => {
        this.invoices.set(results);
      }
    });
  }

  onRefresh(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.loadInvoices(true);
  }

  // Pagination methods
  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString('vi-VN');
  }

  formatCurrency(amount: number): string {
    if (amount == null) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  getInvoiceSymbol(invoice: HddtSoldInvoice): string {
    return `${invoice.khmshdon}${invoice.khhdon}`;
  }

  // Lấy tên người mua (ưu tiên nmten, fallback nmtnmua)
  getBuyerName(invoice: HddtSoldInvoice): string {
    return invoice.nmten || invoice.nmtnmua || 'Khách lẻ';
  }

  // Lấy MST người mua
  getBuyerTaxCode(invoice: HddtSoldInvoice): string {
    return invoice.nmmst || '-';
  }

  getStatusClass(invoice: HddtSoldInvoice): string {
    switch (invoice.tthai) {
      case 1: return 'status-new';
      case 2: return 'status-replaced';
      case 3: return 'status-adjusted';
      case 4: return 'status-was-replaced';
      case 5: return 'status-was-adjusted';
      case 6: return 'status-cancelled';
      default: return '';
    }
  }

  getStatusText(invoice: HddtSoldInvoice): string {
    return this.hddtService.getInvoiceStatus(invoice as any);
  }

  refreshToken(): void {
    window.open('https://hoadondientu.gdt.gov.vn/', '_blank');
  }

  // Modal methods
  onInvoiceClick(invoice: HddtSoldInvoice): void {
    this.selectedInvoice.set(invoice);
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedInvoiceDetail.set(null);

    this.hddtService.getSoldInvoiceDetail(invoice).subscribe({
      next: (detail) => {
        this.selectedInvoiceDetail.set(detail);
        this.detailLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading sold invoice detail:', err);
        this.detailError.set(err.status === 401
          ? 'Token hết hạn. Vui lòng đăng nhập lại.'
          : 'Không thể tải chi tiết hóa đơn. Vui lòng thử lại.');
        this.detailLoading.set(false);
      }
    });
  }

  onCloseModal(): void {
    this.showDetailModal.set(false);
    this.selectedInvoiceDetail.set(null);
    this.selectedInvoice.set(null);
    this.detailError.set(null);
  }

  // Create voucher from invoice
  onCreateVoucher(type: VoucherActionType): void {
    this.createVoucherType.set(type as VoucherCreationType);
    this.showCreateVoucherModal.set(true);
  }

  onCloseCreateVoucherModal(): void {
    this.showCreateVoucherModal.set(false);
  }

  onVoucherCreated(voucher: CashVoucherFromInvoice | WarehouseVoucherFromInvoice): void {
    const voucherType = this.createVoucherType();
    this.savingVoucher.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    if (voucherType === 'RECEIPT') {
      const cashVoucher = voucher as CashVoucherFromInvoice;
      const dto: CreateVoucherDTO = {
        voucherType: cashVoucher.voucherType,
        voucherDate: cashVoucher.voucherDate,
        relatedObjectType: cashVoucher.relatedObjectType,
        relatedObjectCode: cashVoucher.relatedObjectCode,
        relatedObjectName: cashVoucher.relatedObjectName,
        address: cashVoucher.address,
        reason: cashVoucher.reason,
        description: cashVoucher.description,
        paymentMethod: cashVoucher.paymentMethod,
        cashAccountCode: cashVoucher.cashAccountCode,
        originalVoucherNo: cashVoucher.originalVoucherNo,
        originalVoucherDate: cashVoucher.originalVoucherDate,
        lines: cashVoucher.lines
      };

      this.cashVoucherService.createVoucher(dto).subscribe({
        next: (created) => {
          this.savingVoucher.set(false);
          this.saveSuccess.set(`Đã tạo phiếu thu ${created.voucherNo} thành công!`);
          this.showCreateVoucherModal.set(false);
          this.showDetailModal.set(false);
          setTimeout(() => this.saveSuccess.set(null), 3000);
        },
        error: (err) => {
          this.savingVoucher.set(false);
          this.saveError.set(err.message || 'Lỗi tạo phiếu thu');
        }
      });
    } else if (voucherType === 'WAREHOUSE_ISSUE') {
      const whVoucher = voucher as WarehouseVoucherFromInvoice;
      this.warehouseService.createVoucher({
        voucherType: whVoucher.voucherType,
        issueType: whVoucher.issueType,
        voucherDate: whVoucher.voucherDate,
        warehouseCode: whVoucher.warehouseCode,
        warehouseName: whVoucher.warehouseName,
        partnerCode: whVoucher.partnerCode,
        partnerName: whVoucher.partnerName,
        refVoucherNo: whVoucher.refVoucherNo,
        refVoucherDate: whVoucher.refVoucherDate,
        refVoucherType: whVoucher.refVoucherType,
        debitAccount: whVoucher.debitAccount,
        creditAccount: whVoucher.creditAccount,
        description: whVoucher.description,
        lines: whVoucher.lines.map((line, idx) => ({
          ...line,
          id: `line-${idx}`
        }))
      }).subscribe({
        next: (created) => {
          this.savingVoucher.set(false);
          this.saveSuccess.set(`Đã tạo phiếu xuất kho ${created.voucherNo} thành công!`);
          this.showCreateVoucherModal.set(false);
          this.showDetailModal.set(false);
          setTimeout(() => this.saveSuccess.set(null), 3000);
        },
        error: (err) => {
          this.savingVoucher.set(false);
          this.saveError.set(err.message || 'Lỗi tạo phiếu xuất kho');
        }
      });
    }
  }
}
