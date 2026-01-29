import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HddtService, HddtInvoice } from '../../../services/hddt.service';

@Component({
  selector: 'app-purchase-invoice-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-invoice-page.component.html',
  styleUrl: './purchase-invoice-page.component.css'
})
export class PurchaseInvoicePageComponent implements OnInit {
  // State
  invoices = signal<HddtInvoice[]>([]);
  allInvoices = signal<HddtInvoice[]>([]); // Lưu tất cả hóa đơn để search
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

  constructor(private hddtService: HddtService) {}

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

    this.hddtService.getPurchaseInvoicesInRange(from, to, forceRefresh).subscribe({
      next: (data) => {
        this.allInvoices.set(data);
        this.invoices.set(data);
        this.loading.set(false);
        this.loadCacheInfo();
      },
      error: (err) => {
        console.error('Error loading invoices:', err);
        this.error.set(err.status === 401
          ? 'Token hết hạn. Vui lòng đăng nhập lại hoadondientu.gdt.gov.vn và cập nhật token.'
          : 'Không thể tải dữ liệu hóa đơn. Vui lòng thử lại.');
        this.loading.set(false);
      }
    });
  }

  loadCacheInfo(): void {
    this.hddtService.getCacheInfo().subscribe({
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
      // Reset về danh sách gốc
      this.invoices.set(this.allInvoices());
      return;
    }

    // Tìm kiếm trong cache
    this.hddtService.searchInvoicesInCache(query).subscribe({
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

  getInvoiceSymbol(invoice: HddtInvoice): string {
    return this.hddtService.getInvoiceSymbol(invoice);
  }

  getStatusClass(invoice: HddtInvoice): string {
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

  getStatusText(invoice: HddtInvoice): string {
    return this.hddtService.getInvoiceStatus(invoice);
  }

  getNatureText(invoice: HddtInvoice): string {
    return this.hddtService.getInvoiceNature(invoice);
  }

  refreshToken(): void {
    window.open('https://hoadondientu.gdt.gov.vn/', '_blank');
  }
}
