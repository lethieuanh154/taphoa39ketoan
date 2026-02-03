import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CashVoucherFromInvoice,
  WarehouseVoucherFromInvoice,
  InvoiceVoucherConverterService
} from '../../../services/invoice-voucher-converter.service';
import { HddtInvoice, HddtSoldInvoice, HddtInvoiceDetail } from '../../../services/hddt.service';

export type VoucherCreationType = 'PAYMENT' | 'RECEIPT' | 'WAREHOUSE_RECEIPT' | 'WAREHOUSE_ISSUE';

@Component({
  selector: 'app-create-voucher-from-invoice-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-voucher-from-invoice-modal.component.html',
  styleUrl: './create-voucher-from-invoice-modal.component.css'
})
export class CreateVoucherFromInvoiceModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() voucherType: VoucherCreationType = 'PAYMENT';
  @Input() purchaseInvoice: HddtInvoice | null = null;
  @Input() salesInvoice: HddtSoldInvoice | null = null;
  @Input() invoiceDetail: HddtInvoiceDetail | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() createVoucher = new EventEmitter<CashVoucherFromInvoice | WarehouseVoucherFromInvoice>();

  // Data
  cashVoucher: CashVoucherFromInvoice | null = null;
  warehouseVoucher: WarehouseVoucherFromInvoice | null = null;

  // UI State
  isSaving = false;
  error: string | null = null;

  // Editable fields
  editableVoucherDate: string = '';
  editablePaymentMethod: 'CASH' | 'BANK_TRANSFER' = 'CASH';
  editableWarehouseCode = 'KHO1';

  constructor(private converterService: InvoiceVoucherConverterService) {}

  ngOnInit(): void {
    this.prepareVoucher();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['purchaseInvoice'] || changes['salesInvoice'] || changes['voucherType']) {
      this.prepareVoucher();
    }
  }

  prepareVoucher(): void {
    if (this.voucherType === 'PAYMENT' && this.purchaseInvoice) {
      this.cashVoucher = this.converterService.convertPurchaseToPaymentVoucher(
        this.purchaseInvoice,
        this.invoiceDetail ?? undefined
      );
      this.editableVoucherDate = this.formatDateForInput(this.cashVoucher.voucherDate);
      this.editablePaymentMethod = this.cashVoucher.paymentMethod;
    } else if (this.voucherType === 'RECEIPT' && this.salesInvoice) {
      this.cashVoucher = this.converterService.convertSaleToReceiptVoucher(
        this.salesInvoice,
        this.invoiceDetail ?? undefined
      );
      this.editableVoucherDate = this.formatDateForInput(this.cashVoucher.voucherDate);
      this.editablePaymentMethod = this.cashVoucher.paymentMethod;
    } else if (this.voucherType === 'WAREHOUSE_RECEIPT' && this.purchaseInvoice) {
      this.warehouseVoucher = this.converterService.convertPurchaseToWarehouseReceipt(
        this.purchaseInvoice,
        this.invoiceDetail ?? undefined
      );
      this.editableVoucherDate = this.formatDateForInput(this.warehouseVoucher.voucherDate);
      this.editableWarehouseCode = this.warehouseVoucher.warehouseCode;
    } else if (this.voucherType === 'WAREHOUSE_ISSUE' && this.salesInvoice) {
      this.warehouseVoucher = this.converterService.convertSaleToWarehouseIssue(
        this.salesInvoice,
        this.invoiceDetail ?? undefined
      );
      this.editableVoucherDate = this.formatDateForInput(this.warehouseVoucher.voucherDate);
      this.editableWarehouseCode = this.warehouseVoucher.warehouseCode;
    }
  }

  get isCashVoucher(): boolean {
    return this.voucherType === 'PAYMENT' || this.voucherType === 'RECEIPT';
  }

  get isWarehouseVoucher(): boolean {
    return this.voucherType === 'WAREHOUSE_RECEIPT' || this.voucherType === 'WAREHOUSE_ISSUE';
  }

  get modalTitle(): string {
    switch (this.voucherType) {
      case 'PAYMENT': return 'Tạo Phiếu Chi từ Hóa đơn';
      case 'RECEIPT': return 'Tạo Phiếu Thu từ Hóa đơn';
      case 'WAREHOUSE_RECEIPT': return 'Tạo Phiếu Nhập Kho từ Hóa đơn';
      case 'WAREHOUSE_ISSUE': return 'Tạo Phiếu Xuất Kho từ Hóa đơn';
      default: return 'Tạo Phiếu';
    }
  }

  get voucherIcon(): string {
    switch (this.voucherType) {
      case 'PAYMENT': return '💸';
      case 'RECEIPT': return '💰';
      case 'WAREHOUSE_RECEIPT': return '📦';
      case 'WAREHOUSE_ISSUE': return '📤';
      default: return '📄';
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSave(): void {
    this.error = null;

    // Update voucher with edited values
    if (this.isCashVoucher && this.cashVoucher) {
      this.cashVoucher.voucherDate = new Date(this.editableVoucherDate);
      this.cashVoucher.paymentMethod = this.editablePaymentMethod;
      this.cashVoucher.cashAccountCode = this.editablePaymentMethod === 'CASH' ? '1111' : '1121';
      this.createVoucher.emit(this.cashVoucher);
    } else if (this.isWarehouseVoucher && this.warehouseVoucher) {
      this.warehouseVoucher.voucherDate = new Date(this.editableVoucherDate);
      this.warehouseVoucher.warehouseCode = this.editableWarehouseCode;
      this.warehouseVoucher.warehouseName = this.editableWarehouseCode === 'KHO1' ? 'Kho chính' : 'Kho phụ';
      this.createVoucher.emit(this.warehouseVoucher);
    }
  }

  formatCurrency(value: number): string {
    if (value == null) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
