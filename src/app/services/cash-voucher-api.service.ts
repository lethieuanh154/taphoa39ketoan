/**
 * Cash Voucher API Service
 * Gọi Backend API cho Phiếu Thu/Chi
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  CashVoucher,
  VoucherType,
  VoucherStatus,
  CreateVoucherDTO
} from '../models/cash-voucher.models';

export interface CashVoucherFilter {
  voucher_type?: VoucherType;
  status?: VoucherStatus;
  from_date?: string;
  to_date?: string;
  limit?: number;
}

export interface CashVoucherStatistics {
  total_vouchers: number;
  receipt_count: number;
  payment_count: number;
  total_receipt_amount: number;
  total_payment_amount: number;
  net_cash_flow: number;
  by_status: {
    draft: number;
    posted: number;
    cancelled: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CashVoucherApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/cash-vouchers`;

  /**
   * Tạo phiếu thu/chi mới
   */
  create(data: CreateVoucherDTO): Observable<CashVoucher> {
    const payload = this.transformToApiFormat(data);
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Lấy danh sách phiếu
   */
  getAll(filter?: CashVoucherFilter): Observable<CashVoucher[]> {
    let params = new HttpParams();

    if (filter) {
      if (filter.voucher_type) params = params.set('voucher_type', filter.voucher_type);
      if (filter.status) params = params.set('status', filter.status);
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
  getById(id: string): Observable<CashVoucher> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Cập nhật phiếu
   */
  update(id: string, data: Partial<CreateVoucherDTO>): Observable<CashVoucher> {
    const payload = this.transformToApiFormat(data as CreateVoucherDTO);
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Ghi sổ phiếu
   */
  post(id: string): Observable<CashVoucher> {
    return this.http.post<any>(`${this.baseUrl}/${id}/post`, {}).pipe(
      map(response => this.transformFromApiFormat(response))
    );
  }

  /**
   * Hủy phiếu
   */
  cancel(id: string, reason: string): Observable<CashVoucher> {
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
  getStatistics(fromDate?: string, toDate?: string): Observable<CashVoucherStatistics> {
    let params = new HttpParams();
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);

    return this.http.get<CashVoucherStatistics>(`${this.baseUrl}/statistics`, { params });
  }

  /**
   * Transform từ Frontend format sang API format
   */
  private transformToApiFormat(data: CreateVoucherDTO): any {
    return {
      voucher_type: data.voucherType,
      voucher_date: data.voucherDate instanceof Date
        ? data.voucherDate.toISOString()
        : data.voucherDate,
      related_object_type: data.relatedObjectType,
      related_object_id: data.relatedObjectId,
      related_object_code: data.relatedObjectCode,
      related_object_name: data.relatedObjectName,
      address: data.address,
      reason: data.reason,
      description: data.description,
      payment_method: data.paymentMethod,
      cash_account_code: data.cashAccountCode,
      receiver_name: data.receiverName,
      receiver_id: data.receiverId,
      original_voucher_no: data.originalVoucherNo,
      original_voucher_date: data.originalVoucherDate instanceof Date
        ? data.originalVoucherDate.toISOString()
        : data.originalVoucherDate,
      lines: data.lines.map((line, idx) => ({
        line_no: idx + 1,
        description: line.description,
        account_code: line.accountCode,
        account_name: line.accountName,
        amount: line.amount,
        tax_code: line.taxCode,
        tax_rate: line.taxRate,
        tax_amount: line.taxAmount
      }))
    };
  }

  /**
   * Transform từ API format sang Frontend format
   */
  private transformFromApiFormat(data: any): CashVoucher {
    return {
      id: data.id,
      voucherType: data.voucher_type,
      voucherNo: data.voucher_no,
      voucherDate: new Date(data.voucher_date),
      postingDate: data.posting_date ? new Date(data.posting_date) : undefined,
      relatedObjectType: data.related_object_type,
      relatedObjectId: data.related_object_id,
      relatedObjectCode: data.related_object_code,
      relatedObjectName: data.related_object_name,
      address: data.address,
      reason: data.reason,
      description: data.description,
      paymentMethod: data.payment_method,
      cashAccountCode: data.cash_account_code,
      lines: (data.lines || []).map((line: any) => ({
        id: line.id || `line-${line.line_no}`,
        lineNo: line.line_no,
        description: line.description,
        accountCode: line.account_code,
        accountName: line.account_name,
        amount: line.amount,
        taxCode: line.tax_code,
        taxRate: line.tax_rate,
        taxAmount: line.tax_amount
      })),
      totalAmount: data.total_amount,
      totalTaxAmount: data.total_tax_amount,
      grandTotal: data.grand_total,
      amountInWords: data.amount_in_words,
      status: data.status,
      receiverName: data.receiver_name,
      receiverId: data.receiver_id,
      originalVoucherNo: data.original_voucher_no,
      originalVoucherDate: data.original_voucher_date ? new Date(data.original_voucher_date) : undefined,
      preparedBy: data.prepared_by,
      preparedAt: new Date(data.prepared_at),
      approvedBy: data.approved_by,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      postedBy: data.posted_by,
      postedAt: data.posted_at ? new Date(data.posted_at) : undefined,
      cancelledBy: data.cancelled_by,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : undefined,
      cancelReason: data.cancel_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }
}
