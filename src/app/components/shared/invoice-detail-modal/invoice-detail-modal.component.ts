import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HddtInvoiceDetail, HddtInvoiceItem, VatRateInfo } from '../../../services/hddt.service';

@Component({
  selector: 'app-invoice-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-detail-modal.component.html',
  styleUrl: './invoice-detail-modal.component.css'
})
export class InvoiceDetailModalComponent {
  @Input() set invoice(value: HddtInvoiceDetail | null) {
    this._invoice.set(value);
  }
  @Input() loading = false;
  @Input() error: string | null = null;
  @Output() closeModal = new EventEmitter<void>();

  private _invoice = signal<HddtInvoiceDetail | null>(null);

  invoiceData = computed(() => this._invoice());
  items = computed(() => this._invoice()?.hdhhdvu || []);
  vatRates = computed(() => this._invoice()?.thttltsuat || []);

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString('vi-VN');
  }

  formatDateTime(isoDate: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return `${date.toLocaleTimeString('vi-VN')} ${date.toLocaleDateString('vi-VN')}`;
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDecimal(num: number | null | undefined): string {
    if (num == null) return '0';
    // Hiển thị tối đa 2 số thập phân, bỏ số 0 thừa
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  }

  getInvoiceSymbol(): string {
    const inv = this._invoice();
    if (!inv) return '';
    return `${inv.khmshdon}${inv.khhdon}`;
  }

  getStatusText(): string {
    const inv = this._invoice();
    if (!inv) return '';
    switch (inv.tthai) {
      case 1: return 'Hóa đơn mới';
      case 2: return 'Hóa đơn thay thế';
      case 3: return 'Hóa đơn điều chỉnh';
      case 4: return 'Đã bị thay thế';
      case 5: return 'Đã bị điều chỉnh';
      case 6: return 'Đã bị hủy';
      default: return 'Không xác định';
    }
  }

  getStatusClass(): string {
    const inv = this._invoice();
    if (!inv) return '';
    switch (inv.tthai) {
      case 1: return 'status-new';
      case 2: return 'status-replaced';
      case 3: return 'status-adjusted';
      case 4: return 'status-was-replaced';
      case 5: return 'status-was-adjusted';
      case 6: return 'status-cancelled';
      default: return '';
    }
  }

  getPaymentStatus(): string {
    const inv = this._invoice();
    if (!inv?.ttkhac) return '';
    const paymentInfo = inv.ttkhac.find(t => t.ttruong === 'Trạng thái thanh toán');
    return paymentInfo?.dlieu || '';
  }

  getItemTotalWithVat(item: HddtInvoiceItem): number {
    // Lấy từ ttkhac nếu có
    const totalInfo = item.ttkhac?.find(t => t.ttruong === 'Thành tiền thanh toán của hàng hóa');
    if (totalInfo?.dlieu) {
      return parseFloat(totalInfo.dlieu);
    }
    // Tính toán nếu không có
    return item.thtien + (item.tthue || 0);
  }

  getItemVat(item: HddtInvoiceItem): number {
    // Lấy từ ttkhac nếu có
    const vatInfo = item.ttkhac?.find(t => t.ttruong === 'Tiền thuế dòng (Tiền thuế GTGT)');
    if (vatInfo?.dlieu) {
      return parseFloat(vatInfo.dlieu);
    }
    return item.tthue || 0;
  }
}
