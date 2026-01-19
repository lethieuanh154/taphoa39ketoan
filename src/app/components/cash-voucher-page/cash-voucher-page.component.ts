import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CashVoucherService } from '../../services/cash-voucher.service';
import {
  CashVoucher,
  VoucherLine,
  VoucherType,
  VoucherStatus,
  VoucherFilter,
  CreateVoucherDTO,
  RelatedObjectType,
  VOUCHER_PREFIX,
  CASH_ACCOUNTS,
  RECEIPT_REASONS,
  PAYMENT_REASONS,
  RECEIPT_CONTRA_ACCOUNTS,
  PAYMENT_CONTRA_ACCOUNTS,
  numberToWords,
  JournalEntryLine
} from '../../models/cash-voucher.models';

/**
 * PHIẾU THU / PHIẾU CHI - CASH VOUCHER PAGE
 *
 * Chứng từ kế toán gốc
 */
@Component({
  selector: 'app-cash-voucher-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-voucher-page.component.html',
  styleUrl: './cash-voucher-page.component.css'
})
export class CashVoucherPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // === TAB STATE ===
  activeTab: VoucherType = 'RECEIPT';

  // === DATA STATE ===
  vouchers: CashVoucher[] = [];
  selectedVoucher: CashVoucher | null = null;
  journalEntries: JournalEntryLine[] = [];

  // === FILTER STATE ===
  filter: VoucherFilter = {};
  searchText: string = '';
  statusFilter: VoucherStatus | '' = '';
  fromDate: string = '';
  toDate: string = '';

  // === STATISTICS ===
  stats = {
    totalReceipts: 0,
    totalPayments: 0,
    receiptAmount: 0,
    paymentAmount: 0,
    netCashFlow: 0
  };

  // === UI STATE ===
  isLoading: boolean = false;
  errorMessage: string = '';

  // === MODAL STATE ===
  showCreateModal: boolean = false;
  showDetailModal: boolean = false;
  showJournalModal: boolean = false;
  showCancelModal: boolean = false;

  // === FORM STATE ===
  newVoucher: Partial<CreateVoucherDTO> = {};
  newLines: Partial<VoucherLine>[] = [];
  cancelReason: string = '';
  formErrors: string[] = [];

  // === OPTIONS ===
  cashAccounts = CASH_ACCOUNTS;
  receiptReasons = RECEIPT_REASONS;
  paymentReasons = PAYMENT_REASONS;
  receiptContraAccounts = RECEIPT_CONTRA_ACCOUNTS;
  paymentContraAccounts = PAYMENT_CONTRA_ACCOUNTS;

  objectTypes: { value: RelatedObjectType; label: string }[] = [
    { value: 'CUSTOMER', label: 'Khách hàng' },
    { value: 'SUPPLIER', label: 'Nhà cung cấp' },
    { value: 'EMPLOYEE', label: 'Nhân viên' },
    { value: 'OTHER', label: 'Khác' }
  ];

  constructor(private voucherService: CashVoucherService) { }

  ngOnInit(): void {
    this.loadVouchers();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  loadVouchers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const filter: VoucherFilter = {
      voucherType: this.activeTab,
      ...this.buildFilter()
    };

    this.voucherService.getVouchers(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vouchers) => {
          this.vouchers = vouchers;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Lỗi tải danh sách phiếu:', err);
          this.errorMessage = 'Lỗi tải danh sách phiếu';
          this.isLoading = false;
        }
      });
  }

  loadStatistics(): void {
    this.voucherService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB & FILTER
  // ═══════════════════════════════════════════════════════════════════════════

  setActiveTab(tab: VoucherType): void {
    this.activeTab = tab;
    this.loadVouchers();
  }

  buildFilter(): VoucherFilter {
    const filter: VoucherFilter = {};

    if (this.searchText) {
      filter.search = this.searchText;
    }

    if (this.statusFilter) {
      filter.status = this.statusFilter as VoucherStatus;
    }

    if (this.fromDate) {
      filter.fromDate = new Date(this.fromDate);
    }

    if (this.toDate) {
      filter.toDate = new Date(this.toDate);
    }

    return filter;
  }

  onFilterChange(): void {
    this.loadVouchers();
  }

  clearFilters(): void {
    this.searchText = '';
    this.statusFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.loadVouchers();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.newVoucher = {
      voucherType: this.activeTab,
      voucherDate: new Date(),
      relatedObjectType: this.activeTab === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER',
      relatedObjectName: '',
      reason: '',
      paymentMethod: 'CASH',
      cashAccountCode: '1111'
    };
    this.newLines = [this.createEmptyLine()];
    this.formErrors = [];
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.newVoucher = {};
    this.newLines = [];
    this.formErrors = [];
  }

  createEmptyLine(): Partial<VoucherLine> {
    return {
      lineNo: this.newLines.length + 1,
      description: '',
      accountCode: '',
      amount: 0
    };
  }

  addLine(): void {
    this.newLines.push(this.createEmptyLine());
  }

  removeLine(index: number): void {
    if (this.newLines.length > 1) {
      this.newLines.splice(index, 1);
      // Renumber
      this.newLines.forEach((line, idx) => line.lineNo = idx + 1);
    }
  }

  get newTotalAmount(): number {
    return this.newLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  }

  get newAmountInWords(): string {
    return numberToWords(this.newTotalAmount);
  }

  saveNewVoucher(): void {
    this.formErrors = [];

    // Validate
    if (!this.newVoucher.relatedObjectName) {
      this.formErrors.push('Tên đối tượng là bắt buộc');
    }
    if (!this.newVoucher.reason) {
      this.formErrors.push('Lý do thu/chi là bắt buộc');
    }
    if (this.newLines.length === 0 || !this.newLines.some(l => l.amount && l.amount > 0)) {
      this.formErrors.push('Phải có ít nhất một dòng chi tiết với số tiền > 0');
    }
    this.newLines.forEach((line, idx) => {
      if (!line.accountCode) {
        this.formErrors.push(`Dòng ${idx + 1}: Tài khoản đối ứng là bắt buộc`);
      }
    });

    if (this.formErrors.length > 0) return;

    const dto: CreateVoucherDTO = {
      voucherType: this.activeTab,
      voucherDate: new Date(this.newVoucher.voucherDate!),
      relatedObjectType: this.newVoucher.relatedObjectType!,
      relatedObjectId: this.newVoucher.relatedObjectId,
      relatedObjectCode: this.newVoucher.relatedObjectCode,
      relatedObjectName: this.newVoucher.relatedObjectName!,
      address: this.newVoucher.address,
      reason: this.newVoucher.reason!,
      description: this.newVoucher.description,
      paymentMethod: this.newVoucher.paymentMethod!,
      cashAccountCode: this.newVoucher.cashAccountCode!,
      lines: this.newLines.filter(l => l.amount && l.amount > 0).map(l => ({
        lineNo: l.lineNo!,
        description: l.description || this.newVoucher.reason!,
        accountCode: l.accountCode!,
        amount: l.amount!
      })),
      receiverName: this.newVoucher.receiverName,
      receiverId: this.newVoucher.receiverId
    };

    this.voucherService.createVoucher(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (voucher) => {
          this.closeCreateModal();
          this.loadVouchers();
          this.loadStatistics();
        },
        error: (err) => {
          this.formErrors.push(err.message || 'Lỗi tạo phiếu');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  openDetailModal(voucher: CashVoucher): void {
    this.selectedVoucher = voucher;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedVoucher = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  openJournalModal(voucher: CashVoucher): void {
    this.selectedVoucher = voucher;

    this.voucherService.getJournalEntry(voucher.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entries) => {
          this.journalEntries = entries;
          this.showJournalModal = true;
        },
        error: (err) => {
          alert('Lỗi lấy bút toán: ' + err.message);
        }
      });
  }

  closeJournalModal(): void {
    this.showJournalModal = false;
    this.journalEntries = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  postVoucher(voucher: CashVoucher): void {
    if (!confirm('Bạn có chắc muốn ghi sổ phiếu này?')) return;

    this.voucherService.postVoucher(voucher.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadVouchers();
          this.loadStatistics();
          if (this.showDetailModal) {
            this.closeDetailModal();
          }
        },
        error: (err) => {
          alert('Lỗi ghi sổ: ' + err.message);
        }
      });
  }

  openCancelModal(voucher: CashVoucher): void {
    this.selectedVoucher = voucher;
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelReason = '';
  }

  confirmCancel(): void {
    if (!this.cancelReason || this.cancelReason.length < 10) {
      alert('Lý do hủy phải >= 10 ký tự');
      return;
    }

    this.voucherService.cancelVoucher(this.selectedVoucher!.id, this.cancelReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeCancelModal();
          this.loadVouchers();
          this.loadStatistics();
          if (this.showDetailModal) {
            this.closeDetailModal();
          }
        },
        error: (err) => {
          alert('Lỗi hủy phiếu: ' + err.message);
        }
      });
  }

  printVoucher(voucher: CashVoucher): void {
    this.voucherService.printVoucher(voucher.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        },
        error: () => {
          alert('Lỗi in phiếu');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatDateTime(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('vi-VN');
  }

  getStatusLabel(status: VoucherStatus): string {
    const labels: Record<VoucherStatus, string> = {
      'DRAFT': 'Nháp',
      'POSTED': 'Đã ghi sổ',
      'CANCELLED': 'Đã hủy'
    };
    return labels[status];
  }

  getStatusClass(status: VoucherStatus): string {
    const classes: Record<VoucherStatus, string> = {
      'DRAFT': 'status-draft',
      'POSTED': 'status-posted',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status];
  }

  getObjectTypeLabel(type: RelatedObjectType): string {
    const labels: Record<RelatedObjectType, string> = {
      'CUSTOMER': 'Khách hàng',
      'SUPPLIER': 'Nhà cung cấp',
      'EMPLOYEE': 'Nhân viên',
      'OTHER': 'Khác'
    };
    return labels[type];
  }

  get tabLabel(): string {
    return this.activeTab === 'RECEIPT' ? 'Phiếu thu' : 'Phiếu chi';
  }

  get tabIcon(): string {
    return this.activeTab === 'RECEIPT' ? 'fa-arrow-down' : 'fa-arrow-up';
  }

  get contraAccounts() {
    return this.activeTab === 'RECEIPT' ? this.receiptContraAccounts : this.paymentContraAccounts;
  }

  get reasons() {
    return this.activeTab === 'RECEIPT' ? this.receiptReasons : this.paymentReasons;
  }

  get filteredVouchers(): CashVoucher[] {
    return this.vouchers;
  }
}
