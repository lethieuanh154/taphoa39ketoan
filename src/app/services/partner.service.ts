import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { httpErrorText } from './auth.service';
import {
  NewPartnerInput,
  Partner,
  PartnerFilter,
  PartnerHistoryEntry,
  PartnerImportItem,
  PartnerImportResult,
  PartnerPatch,
  PartnerRole,
  PartnerStatus
} from '../models/partner.models';

const LOG = '[Partner]';
const BASE = `${environment.ledgerUrl}/api/ledger/partners`;

/** Dạng JSON ledger-rs trả về (snake_case) */
interface PartnerDto {
  code: string;
  role: PartnerRole;
  name: string;
  tax_code: string | null;
  address: string;
  phone: string;
  email: string;
  note: string;
  bank_account_no: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

interface HistoryDto {
  id: string;
  at: string;
  user_email: string;
  action: PartnerHistoryEntry['action'];
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  changes: PartnerHistoryEntry['changes'];
}

interface ImportResultDto {
  dry_run: boolean;
  create: { code: string | null; tax_code: string; name: string }[];
  skip: { tax_code: string; name: string; reason: string; code: string | null }[];
}

/** Trường camelCase → tên trường BE */
const FIELD_MAP: Record<keyof PartnerPatch, string> = {
  name: 'name',
  taxCode: 'tax_code',
  address: 'address',
  phone: 'phone',
  email: 'email',
  note: 'note',
  bankAccountNo: 'bank_account_no',
  bankName: 'bank_name',
  bankBranch: 'bank_branch',
  status: 'status'
};

/**
 * SERVICE: DANH MỤC ĐỐI TƯỢNG (khách hàng / nhà cung cấp / nhân viên / ngân hàng)
 *
 * Lưu ở ledger-rs (Postgres) qua `/api/ledger/partners*`. Cấp mã, MST trùng cùng vai, số TK trùng… do BE kiểm;
 * lỗi trả nguyên HttpErrorResponse để component hiện đúng lý do (`httpErrorText(err)`).
 * Log chỉ mã + số lượng — KHÔNG log MST, SĐT, số TK ngân hàng, địa chỉ, từ khóa tìm kiếm.
 */
@Injectable({
  providedIn: 'root'
})
export class PartnerService {
  private http = inject(HttpClient);

  /** Danh sách theo vai / trạng thái / từ khóa (lọc ở BE) */
  getPartners(filter?: PartnerFilter): Observable<Partner[]> {
    let params = new HttpParams();
    if (filter?.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.status) params = params.set('status', filter.status);

    return this.http.get<PartnerDto[]>(BASE, { params }).pipe(
      map(rows => rows.map(toPartner)),
      tap(rows => console.info(
        `${LOG} getPartners: ${rows.length} đối tượng (role=${filter?.role ?? '-'} status=${filter?.status ?? '-'} có search=${!!filter?.search?.trim()})`
      )),
      catchError(err => this.fail('getPartners', err))
    );
  }

  /** 1 đối tượng theo mã (không có → null) */
  getPartner(code: string): Observable<Partner | null> {
    return this.http.get<PartnerDto>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      map(toPartner),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          console.info(`${LOG} getPartner ${code}: không có`);
          return of(null);
        }
        return this.fail(`getPartner ${code}`, err);
      })
    );
  }

  /** Đối tượng đang dùng hợp lệ cho 1 TK (vai = loại đối tượng chi tiết của TK; TK không theo dõi → []) */
  getForAccount(accountCode: string): Observable<Partner[]> {
    return this.http.get<PartnerDto[]>(`${BASE}/for-account/${encodeURIComponent(accountCode)}`).pipe(
      map(rows => rows.map(toPartner)),
      tap(rows => console.info(`${LOG} getForAccount ${accountCode}: ${rows.length} đối tượng`)),
      catchError(err => this.fail(`getForAccount ${accountCode}`, err))
    );
  }

  /** Thêm — mã trống thì BE tự cấp; MST trùng cùng vai → 409 LA211 (detail có mã đang dùng MST) */
  addPartner(input: NewPartnerInput): Observable<Partner> {
    const body: Record<string, string> = { role: input.role, name: input.name };
    if (input.code?.trim()) body['code'] = input.code.trim();
    for (const [k, f] of Object.entries(FIELD_MAP) as [keyof PartnerPatch, string][]) {
      const v = input[k];
      if (k !== 'name' && typeof v === 'string' && v.trim()) body[f] = v;
    }
    return this.http.post<PartnerDto>(BASE, body).pipe(
      map(toPartner),
      tap(p => console.info(`${LOG} addPartner ${p.code} (${p.role}, ${body['code'] ? 'mã gõ tay' : 'mã tự cấp'}) OK`)),
      catchError(err => this.fail(`addPartner ${input.role}`, err))
    );
  }

  /** Sửa — chỉ gửi trường có trong `changes`; chuỗi rỗng = xóa giá trị (BE không nhận mã / vai) */
  updatePartner(code: string, changes: PartnerPatch): Observable<Partner> {
    const body: Record<string, string> = {};
    for (const [k, f] of Object.entries(FIELD_MAP) as [keyof PartnerPatch, string][]) {
      const v = changes[k];
      if (v !== undefined) body[f] = v;
    }
    return this.http.patch<PartnerDto>(`${BASE}/${encodeURIComponent(code)}`, body).pipe(
      map(toPartner),
      tap(() => console.info(`${LOG} updatePartner ${code} [${Object.keys(body).join(',')}] OK`)),
      catchError(err => this.fail(`updatePartner ${code}`, err))
    );
  }

  /** Xóa thật — chỉ khi chưa phát sinh (BE kiểm). Muốn ngừng dùng → updatePartner status INACTIVE. */
  deletePartner(code: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      tap(() => console.info(`${LOG} deletePartner ${code} OK`)),
      catchError(err => this.fail(`deletePartner ${code}`, err))
    );
  }

  /** Lịch sử thêm / sửa / xóa, mới nhất trước (đối tượng đã xóa vẫn xem được) */
  getHistory(code: string): Observable<PartnerHistoryEntry[]> {
    return this.http.get<HistoryDto[]>(`${BASE}/${encodeURIComponent(code)}/history`).pipe(
      map(rows => rows.map(r => ({
        id: r.id,
        at: new Date(r.at),
        userEmail: r.user_email,
        action: r.action,
        old: r.old,
        new: r.new,
        changes: r.changes ?? []
      }))),
      tap(rows => console.info(`${LOG} getHistory ${code}: ${rows.length} dòng`)),
      catchError(err => this.fail(`getHistory ${code}`, err))
    );
  }

  /** Xuất Excel theo vai (file do BE tạo); không truyền vai → tất cả */
  exportExcel(role?: PartnerRole): Observable<Blob> {
    const params = role ? new HttpParams().set('role', role) : undefined;
    return this.http.get(`${BASE}/export`, { params, responseType: 'blob' }).pipe(
      tap(blob => console.info(`${LOG} exportExcel ${role ?? 'tất cả'}: ${blob.size} byte`)),
      catchError(err => this.fail(`exportExcel ${role ?? ''}`, err))
    );
  }

  /**
   * Tạo NCC / KH từ MST trong XML hóa đơn. `dryRun=true` → xem trước (không ghi, không cấp mã);
   * `false` → ghi thật, BE tính lại từ đầu (MST vừa bị thêm giữa 2 lần gọi → vào skip). Tối đa 5000 dòng / lần.
   */
  importXml(role: 'SUPPLIER' | 'CUSTOMER', items: PartnerImportItem[], dryRun: boolean): Observable<PartnerImportResult> {
    const body = {
      role,
      dry_run: dryRun,
      items: items.map(i => ({ tax_code: i.taxCode, name: i.name, address: i.address ?? null }))
    };
    return this.http.post<ImportResultDto>(`${BASE}/import-xml`, body).pipe(
      map(r => ({
        dryRun: r.dry_run,
        create: r.create.map(c => ({ code: c.code ?? undefined, taxCode: c.tax_code, name: c.name })),
        skip: r.skip.map(s => ({ taxCode: s.tax_code, name: s.name, reason: s.reason, code: s.code ?? undefined }))
      })),
      tap(r => console.info(
        `${LOG} importXml ${role} ${dryRun ? '(xem trước)' : '(ghi)'}: gửi ${items.length}, tạo ${r.create.length}, bỏ qua ${r.skip.length}`
      )),
      catchError(err => this.fail(`importXml ${role}`, err))
    );
  }

  /** Log theo mức (4xx = từ chối → warn; 5xx / mất kết nối → error) rồi trả lỗi gốc cho component */
  private fail(op: string, err: unknown): Observable<never> {
    const status = err instanceof HttpErrorResponse ? err.status : -1;
    // detail của BE có thể chứa MST / số TK → chỉ log mã lỗi LA… nếu có
    const code = err instanceof HttpErrorResponse ? (err.error?.code as string | undefined) : undefined;
    const text = code ? `HTTP ${status} — ${code}` : httpErrorText(err);
    if (status >= 400 && status < 500) {
      console.warn(`${LOG} ${op}: BE từ chối — ${text}`);
    } else {
      console.error(`${LOG} ${op}: lỗi ${status === 0 ? 'mất kết nối ledger-rs' : 'hệ thống'} — ${text}`);
    }
    return throwError(() => err);
  }
}

function toPartner(d: PartnerDto): Partner {
  return {
    code: d.code,
    role: d.role,
    name: d.name,
    taxCode: d.tax_code ?? undefined,
    address: d.address,
    phone: d.phone,
    email: d.email,
    note: d.note,
    bankAccountNo: d.bank_account_no ?? undefined,
    bankName: d.bank_name ?? undefined,
    bankBranch: d.bank_branch ?? undefined,
    status: d.status,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    createdBy: d.created_by,
    updatedBy: d.updated_by
  };
}
