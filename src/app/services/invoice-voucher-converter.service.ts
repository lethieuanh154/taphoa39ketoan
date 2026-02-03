/**
 * INVOICE TO VOUCHER CONVERTER SERVICE
 *
 * Chuyển đổi hóa đơn điện tử (HDDT) sang phiếu kế toán:
 * - Hóa đơn mua vào -> Phiếu chi + Phiếu nhập kho
 * - Hóa đơn bán ra -> Phiếu thu + Phiếu xuất kho
 */
import { Injectable } from '@angular/core';
import { HddtInvoice, HddtSoldInvoice, HddtInvoiceDetail, HddtInvoiceItem } from './hddt.service';
import {
  CreateVoucherDTO,
  VoucherLine,
  VoucherType
} from '../models/cash-voucher.models';
import {
  WarehouseVoucher,
  WarehouseVoucherLine,
  WarehouseVoucherType,
  createEmptyWarehouseVoucher,
  createEmptyVoucherLine
} from '../models/warehouse.models';

/**
 * Interface cho phiếu chi/thu tạo từ hóa đơn
 */
export interface CashVoucherFromInvoice {
  voucherType: VoucherType;
  voucherDate: Date;
  relatedObjectType: 'SUPPLIER' | 'CUSTOMER';
  relatedObjectName: string;
  relatedObjectCode: string;
  address: string;
  reason: string;
  description: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  cashAccountCode: string;
  originalVoucherNo: string;
  originalVoucherDate: Date;
  lines: Omit<VoucherLine, 'id'>[];
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  invoiceSymbol: string;
  invoiceNo: number;
}

/**
 * Interface cho phiếu kho tạo từ hóa đơn
 */
export interface WarehouseVoucherFromInvoice {
  voucherType: WarehouseVoucherType;
  voucherDate: Date;
  partnerCode: string;
  partnerName: string;
  refVoucherNo: string;
  refVoucherDate: Date;
  refVoucherType: 'INVOICE';
  warehouseCode: string;
  warehouseName: string;
  description: string;
  receiptType?: 'PURCHASE';
  issueType?: 'SALE';
  debitAccount: string;
  creditAccount: string;
  lines: Omit<WarehouseVoucherLine, 'id'>[];
  totalQuantity: number;
  totalAmount: number;
  invoiceSymbol: string;
  invoiceNo: number;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceVoucherConverterService {

  constructor() { }

  /**
   * Chuyển đổi hóa đơn mua vào thành phiếu chi
   * Phiếu chi: Nợ 331 (Phải trả NCC) / Có 111 (Tiền mặt)
   */
  convertPurchaseToPaymentVoucher(
    invoice: HddtInvoice,
    detail?: HddtInvoiceDetail
  ): CashVoucherFromInvoice {
    const invoiceDate = new Date(invoice.tdlap);
    const invoiceSymbol = `${invoice.khmshdon}${invoice.khhdon}`;

    // Tạo lines từ chi tiết hóa đơn
    const lines: Omit<VoucherLine, 'id'>[] = [];

    if (detail?.hdhhdvu && detail.hdhhdvu.length > 0) {
      // Có chi tiết hàng hóa
      detail.hdhhdvu.forEach((item, idx) => {
        lines.push({
          lineNo: idx + 1,
          description: item.ten,
          accountCode: '331', // Phải trả người bán
          accountName: 'Phải trả người bán',
          amount: item.thtien || 0,
          taxRate: item.tsuat || 0,
          taxAmount: item.tthue || 0
        });
      });
    } else {
      // Không có chi tiết, tạo 1 dòng tổng
      lines.push({
        lineNo: 1,
        description: `Thanh toán HĐ ${invoiceSymbol}-${invoice.shdon}`,
        accountCode: '331',
        accountName: 'Phải trả người bán',
        amount: invoice.tgtcthue,
        taxRate: invoice.tgtthue > 0 ? Math.round((invoice.tgtthue / invoice.tgtcthue) * 100) : 0,
        taxAmount: invoice.tgtthue
      });
    }

    return {
      voucherType: 'PAYMENT',
      voucherDate: invoiceDate,
      relatedObjectType: 'SUPPLIER',
      relatedObjectName: invoice.nbten,
      relatedObjectCode: invoice.nbmst,
      address: invoice.nbdchi || '',
      reason: 'Chi trả nợ nhà cung cấp',
      description: `Thanh toán HĐ ${invoiceSymbol} số ${invoice.shdon} ngày ${this.formatDate(invoiceDate)}`,
      paymentMethod: 'CASH',
      cashAccountCode: '1111',
      originalVoucherNo: `${invoiceSymbol}-${invoice.shdon}`,
      originalVoucherDate: invoiceDate,
      lines,
      totalAmount: invoice.tgtcthue,
      taxAmount: invoice.tgtthue,
      grandTotal: invoice.tgtttbso,
      invoiceSymbol,
      invoiceNo: invoice.shdon
    };
  }

  /**
   * Chuyển đổi hóa đơn mua vào thành phiếu nhập kho
   * Nhập kho: Nợ 156 (Hàng hóa) / Có 331 (Phải trả NCC)
   */
  convertPurchaseToWarehouseReceipt(
    invoice: HddtInvoice,
    detail?: HddtInvoiceDetail
  ): WarehouseVoucherFromInvoice {
    const invoiceDate = new Date(invoice.tdlap);
    const invoiceSymbol = `${invoice.khmshdon}${invoice.khhdon}`;

    const lines: Omit<WarehouseVoucherLine, 'id'>[] = [];

    if (detail?.hdhhdvu && detail.hdhhdvu.length > 0) {
      detail.hdhhdvu.forEach((item, idx) => {
        lines.push({
          lineNo: idx + 1,
          productId: '',
          productCode: `SP${(idx + 1).toString().padStart(3, '0')}`,
          productName: item.ten,
          unit: item.dvtinh || 'Cái',
          quantity: item.sluong || 1,
          unitPrice: item.dgia || item.thtien,
          amount: item.thtien || 0,
          inventoryAccount: '156'
        });
      });
    } else {
      // Không có chi tiết, tạo 1 dòng tổng
      lines.push({
        lineNo: 1,
        productId: '',
        productCode: 'SP001',
        productName: `Hàng hóa theo HĐ ${invoiceSymbol}-${invoice.shdon}`,
        unit: 'Cái',
        quantity: 1,
        unitPrice: invoice.tgtcthue,
        amount: invoice.tgtcthue,
        inventoryAccount: '156'
      });
    }

    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

    return {
      voucherType: 'RECEIPT',
      voucherDate: invoiceDate,
      partnerCode: invoice.nbmst,
      partnerName: invoice.nbten,
      refVoucherNo: `${invoiceSymbol}-${invoice.shdon}`,
      refVoucherDate: invoiceDate,
      refVoucherType: 'INVOICE',
      warehouseCode: 'KHO1',
      warehouseName: 'Kho chính',
      description: `Nhập kho theo HĐ ${invoiceSymbol} số ${invoice.shdon}`,
      receiptType: 'PURCHASE',
      debitAccount: '156',
      creditAccount: '331',
      lines,
      totalQuantity,
      totalAmount,
      invoiceSymbol,
      invoiceNo: invoice.shdon
    };
  }

  /**
   * Chuyển đổi hóa đơn bán ra thành phiếu thu
   * Phiếu thu: Nợ 111 (Tiền mặt) / Có 131 (Phải thu KH)
   */
  convertSaleToReceiptVoucher(
    invoice: HddtSoldInvoice,
    detail?: HddtInvoiceDetail
  ): CashVoucherFromInvoice {
    const invoiceDate = new Date(invoice.tdlap);
    const invoiceSymbol = `${invoice.khmshdon}${invoice.khhdon}`;

    // Lấy tên và MST người mua (có thể null với khách lẻ)
    const buyerName = invoice.nmten || invoice.nmtnmua || 'Khách lẻ';
    const buyerTaxCode = invoice.nmmst || '';

    const lines: Omit<VoucherLine, 'id'>[] = [];

    if (detail?.hdhhdvu && detail.hdhhdvu.length > 0) {
      detail.hdhhdvu.forEach((item, idx) => {
        lines.push({
          lineNo: idx + 1,
          description: item.ten,
          accountCode: '131',
          accountName: 'Phải thu khách hàng',
          amount: item.thtien || 0,
          taxRate: item.tsuat || 0,
          taxAmount: item.tthue || 0
        });
      });
    } else {
      lines.push({
        lineNo: 1,
        description: `Thu tiền HĐ ${invoiceSymbol}-${invoice.shdon}`,
        accountCode: '131',
        accountName: 'Phải thu khách hàng',
        amount: invoice.tgtcthue,
        taxRate: invoice.tgtthue > 0 ? Math.round((invoice.tgtthue / invoice.tgtcthue) * 100) : 0,
        taxAmount: invoice.tgtthue
      });
    }

    return {
      voucherType: 'RECEIPT',
      voucherDate: invoiceDate,
      relatedObjectType: 'CUSTOMER',
      relatedObjectName: buyerName,
      relatedObjectCode: buyerTaxCode,
      address: invoice.nmdchi || '',
      reason: 'Thu tiền bán hàng',
      description: `Thu tiền HĐ ${invoiceSymbol} số ${invoice.shdon} ngày ${this.formatDate(invoiceDate)}`,
      paymentMethod: 'CASH',
      cashAccountCode: '1111',
      originalVoucherNo: `${invoiceSymbol}-${invoice.shdon}`,
      originalVoucherDate: invoiceDate,
      lines,
      totalAmount: invoice.tgtcthue,
      taxAmount: invoice.tgtthue,
      grandTotal: invoice.tgtttbso,
      invoiceSymbol,
      invoiceNo: invoice.shdon
    };
  }

  /**
   * Chuyển đổi hóa đơn bán ra thành phiếu xuất kho
   * Xuất kho: Nợ 632 (Giá vốn) / Có 156 (Hàng hóa)
   */
  convertSaleToWarehouseIssue(
    invoice: HddtSoldInvoice,
    detail?: HddtInvoiceDetail
  ): WarehouseVoucherFromInvoice {
    const invoiceDate = new Date(invoice.tdlap);
    const invoiceSymbol = `${invoice.khmshdon}${invoice.khhdon}`;

    const buyerName = invoice.nmten || invoice.nmtnmua || 'Khách lẻ';
    const buyerTaxCode = invoice.nmmst || '';

    const lines: Omit<WarehouseVoucherLine, 'id'>[] = [];

    if (detail?.hdhhdvu && detail.hdhhdvu.length > 0) {
      detail.hdhhdvu.forEach((item, idx) => {
        lines.push({
          lineNo: idx + 1,
          productId: '',
          productCode: `SP${(idx + 1).toString().padStart(3, '0')}`,
          productName: item.ten,
          unit: item.dvtinh || 'Cái',
          quantity: item.sluong || 1,
          unitPrice: item.dgia || item.thtien,
          amount: item.thtien || 0,
          inventoryAccount: '156',
          expenseAccount: '632'
        });
      });
    } else {
      lines.push({
        lineNo: 1,
        productId: '',
        productCode: 'SP001',
        productName: `Hàng hóa theo HĐ ${invoiceSymbol}-${invoice.shdon}`,
        unit: 'Cái',
        quantity: 1,
        unitPrice: invoice.tgtcthue,
        amount: invoice.tgtcthue,
        inventoryAccount: '156',
        expenseAccount: '632'
      });
    }

    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

    return {
      voucherType: 'ISSUE',
      voucherDate: invoiceDate,
      partnerCode: buyerTaxCode,
      partnerName: buyerName,
      refVoucherNo: `${invoiceSymbol}-${invoice.shdon}`,
      refVoucherDate: invoiceDate,
      refVoucherType: 'INVOICE',
      warehouseCode: 'KHO1',
      warehouseName: 'Kho chính',
      description: `Xuất kho theo HĐ ${invoiceSymbol} số ${invoice.shdon}`,
      issueType: 'SALE',
      debitAccount: '632',
      creditAccount: '156',
      lines,
      totalQuantity,
      totalAmount,
      invoiceSymbol,
      invoiceNo: invoice.shdon
    };
  }

  /**
   * Format ngày theo định dạng Việt Nam
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('vi-VN');
  }

  /**
   * Tính tổng tiền từ danh sách items
   */
  private calculateTotalFromItems(items: HddtInvoiceItem[]): {
    totalAmount: number;
    taxAmount: number;
  } {
    let totalAmount = 0;
    let taxAmount = 0;

    items.forEach(item => {
      totalAmount += item.thtien || 0;
      taxAmount += item.tthue || 0;
    });

    return { totalAmount, taxAmount };
  }
}
