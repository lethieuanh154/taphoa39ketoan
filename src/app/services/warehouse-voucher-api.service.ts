/**
 * Warehouse Voucher API Service
 * Gọi Backend API cho Phiếu Nhập/Xuất Kho
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  WarehouseVoucher,
  WarehouseVoucherType,
  WarehouseVoucherStatus,
  ReceiptType,
  IssueType,
  WarehouseVoucherLine
} from '../models/warehouse.models';

export interface WarehouseVoucherFilter {
  voucher_type?: WarehouseVoucherType;
  status?: WarehouseVoucherStatus;
  warehouse_code?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}

export interface WarehouseVoucherStatistics {
  total_vouchers: number;
  receipt_count: number;
  issue_count: number;
  total_receipt_quantity: number;
  total_issue_quantity: number;
  total_receipt_amount: number;
  total_issue_amount: number;
  by_status: {
    draft: number;
    posted: number;
    cancelled: number;
  };
}

export interface CreateWarehouseVoucherDTO {
  voucherType: WarehouseVoucherType;
  receiptType?: ReceiptType;
  issueType?: IssueType;
  voucherDate: Date;
  warehouseCode: string;
  warehouseName: string;
  partnerId?: string;
  partnerCode?: string;
  partnerName?: string;
  refVoucherNo?: string;
  refVoucherDate?: Date;
  refVoucherType?: string;
  keeper?: string;
  receiver?: string;
  debitAccount: string;
  creditAccount: string;
  description?: string;
  note?: string;
  lines: Omit<WarehouseVoucherLine, 'id'>[];
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseVoucherApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/warehouse-vouchers`;

  /**
   * Tạo phiếu nhập/xuất kho mới
   */
  create(data: CreateWarehouseVoucherDTO): Observable<WarehouseVoucher> {
    const payload = this.transformToApiFormat(data);
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Lấy danh sách phiếu
   */
  getAll(filter?: WarehouseVoucherFilter): Observable<WarehouseVoucher[]> {
    let params = new HttpParams();

    if (filter) {
      if (filter.voucher_type) params = params.set('voucher_type', filter.voucher_type);
      if (filter.status) params = params.set('status', filter.status);
      if (filter.warehouse_code) params = params.set('warehouse_code', filter.warehouse_code);
      if (filter.from_date) params = params.set('from_date', filter.from_date);
      if (filter.to_date) params = params.set('to_date', filter.to_date);
      if (filter.limit) params = params.set('limit', filter.limit.toString());
    }

    return this.http.get<any[]>(this.baseUrl, { params }).pipe(
      map(vouchers => vouchers.map(v => this.transformFromApiFormat(v)))
    );
  }

  /**
   * Lấy chi tiết phiếu theo ID
   */
  getById(id: string): Observable<WarehouseVoucher> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Cập nhật phiếu
   */
  update(id: string, data: Partial<CreateWarehouseVoucherDTO>): Observable<WarehouseVoucher> {
    const payload = this.transformToApiFormat(data as CreateWarehouseVoucherDTO);
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Ghi sổ phiếu
   */
  post(id: string): Observable<WarehouseVoucher> {
    return this.http.post<any>(`${this.baseUrl}/${id}/post`, {}).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Hủy phiếu
   */
  cancel(id: string, reason: string): Observable<WarehouseVoucher> {
    return this.http.post<any>(`${this.baseUrl}/${id}/cancel`, null, {
      params: { reason }
    }).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Xóa phiếu
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Lấy thống kê
   */
  getStatistics(voucherType?: WarehouseVoucherType, fromDate?: string, toDate?: string): Observable<WarehouseVoucherStatistics> {
    let params = new HttpParams();
    if (voucherType) params = params.set('voucher_type', voucherType);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);

    return this.http.get<WarehouseVoucherStatistics>(`${this.baseUrl}/statistics`, { params });
  }

  /**
   * Transform từ Frontend format sang API format
   */
  private transformToApiFormat(data: CreateWarehouseVoucherDTO): any {
    return {
      voucher_type: data.voucherType,
      receipt_type: data.receiptType,
      issue_type: data.issueType,
      voucher_date: data.voucherDate instanceof Date
        ? data.voucherDate.toISOString()
        : data.voucherDate,
      warehouse_code: data.warehouseCode,
      warehouse_name: data.warehouseName,
      partner_id: data.partnerId,
      partner_code: data.partnerCode,
      partner_name: data.partnerName,
      ref_voucher_no: data.refVoucherNo,
      ref_voucher_date: data.refVoucherDate instanceof Date
        ? data.refVoucherDate.toISOString()
        : data.refVoucherDate,
      ref_voucher_type: data.refVoucherType,
      keeper: data.keeper,
      receiver: data.receiver,
      debit_account: data.debitAccount,
      credit_account: data.creditAccount,
      description: data.description,
      note: data.note,
      lines: data.lines.map((line, idx) => ({
        line_no: idx + 1,
        product_id: line.productId,
        product_code: line.productCode,
        product_name: line.productName,
        unit: line.unit,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        amount: line.amount,
        inventory_account: line.inventoryAccount,
        expense_account: line.expenseAccount,
        warehouse_code: line.warehouseCode,
        batch_no: line.batchNo,
        expiry_date: line.expiryDate instanceof Date
          ? line.expiryDate.toISOString()
          : line.expiryDate,
        note: line.note
      }))
    };
  }

  /**
   * Transform từ API format sang Frontend format
   */
  private transformFromApiFormat(data: any): WarehouseVoucher {
    return {
      id: data.id,
      voucherNo: data.voucher_no,
      voucherType: data.voucher_type,
      receiptType: data.receipt_type,
      issueType: data.issue_type,
      voucherDate: new Date(data.voucher_date),
      status: data.status,
      partnerId: data.partner_id,
      partnerName: data.partner_name,
      partnerCode: data.partner_code,
      refVoucherNo: data.ref_voucher_no,
      refVoucherDate: data.ref_voucher_date ? new Date(data.ref_voucher_date) : undefined,
      refVoucherType: data.ref_voucher_type,
      warehouseCode: data.warehouse_code,
      warehouseName: data.warehouse_name,
      keeper: data.keeper,
      receiver: data.receiver,
      lines: (data.lines || []).map((line: any) => ({
        id: line.id || `line-${line.line_no}`,
        lineNo: line.line_no,
        productId: line.product_id,
        productCode: line.product_code,
        productName: line.product_name,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        amount: line.amount,
        inventoryAccount: line.inventory_account,
        expenseAccount: line.expense_account,
        warehouseCode: line.warehouse_code,
        batchNo: line.batch_no,
        expiryDate: line.expiry_date ? new Date(line.expiry_date) : undefined,
        note: line.note
      })),
      totalQuantity: data.total_quantity,
      totalAmount: data.total_amount,
      debitAccount: data.debit_account,
      creditAccount: data.credit_account,
      description: data.description,
      note: data.note,
      createdAt: new Date(data.created_at),
      createdBy: data.created_by,
      postedAt: data.posted_at ? new Date(data.posted_at) : undefined,
      postedBy: data.posted_by,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
      cancelledBy: data.cancelled_by,
      cancelReason: data.cancel_reason
    };
  }
}
