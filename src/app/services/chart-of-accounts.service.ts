import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { httpErrorText } from './auth.service';
import {
  Account,
  AccountFilter,
  AccountGroup,
  AccountHistoryEntry,
  AccountNature,
  AccountStatus,
  AccountType,
  DetailType,
  getAccountTypeName
} from '../models/chart-of-accounts.models';

const LOG = '[ChartOfAccounts]';
const BASE = `${environment.ledgerUrl}/api/ledger/accounts`;

/** Dạng JSON ledger-rs trả về (snake_case) */
interface AccountDto {
  code: string;
  name: string;
  parent_code: string | null;
  level: number;
  account_type: AccountType;
  nature: AccountNature;
  detail_type: DetailType;
  note: string;
  status: AccountStatus;
  is_system: boolean;
  is_leaf: boolean;
  postable: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

interface HistoryDto {
  id: string;
  at: string;
  user_email: string;
  action: AccountHistoryEntry['action'];
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  changes: AccountHistoryEntry['changes'];
}

/** Dữ liệu tạo TK — nature/detailType bỏ trống thì BE lấy theo TK cha */
export type NewAccountInput = Pick<Account, 'code' | 'name'> &
  Partial<Pick<Account, 'parentCode' | 'nature' | 'detailType' | 'note' | 'description'>>;

/**
 * SERVICE: HỆ THỐNG TÀI KHOẢN KẾ TOÁN
 *
 * Danh mục TK theo TT133/2016/TT-BTC, lưu ở ledger-rs (Postgres) qua `/api/ledger/accounts*`.
 * Ràng buộc (TK hệ thống, TK cha, đã phát sinh…) do BE kiểm; lỗi trả nguyên HttpErrorResponse
 * để component hiển thị đúng lý do (`httpErrorText(err)`, phân biệt 401/403/409/422/mất kết nối).
 */
@Injectable({
  providedIn: 'root'
})
export class ChartOfAccountsService {
  private http = inject(HttpClient);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy tài khoản. search/type/status/postable lọc ở BE; level/isParent/parentCode lọc tại FE.
   */
  getAccounts(filter?: AccountFilter): Observable<Account[]> {
    let params = new HttpParams();
    if (filter?.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.postable) params = params.set('postable', 'true');

    return this.http.get<AccountDto[]>(BASE, { params }).pipe(
      map(rows => rows.map(toAccount).filter(a =>
        (filter?.level === undefined || a.level === filter.level) &&
        (filter?.isParent === undefined || a.isParent === filter.isParent) &&
        (!filter?.parentCode || a.parentCode === filter.parentCode)
      )),
      tap(accounts => console.info(`${LOG} getAccounts: ${accounts.length} TK`, filter ?? {})),
      catchError(err => this.fail('getAccounts', err))
    );
  }

  /**
   * Lấy tài khoản theo mã (không có → null)
   */
  getAccountByCode(code: string): Observable<Account | null> {
    return this.http.get<AccountDto>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      map(toAccount),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          console.info(`${LOG} getAccountByCode ${code}: không có`);
          return of(null);
        }
        return this.fail(`getAccountByCode ${code}`, err);
      })
    );
  }

  /**
   * Lấy các TK con trực tiếp
   */
  getChildAccounts(parentCode: string): Observable<Account[]> {
    return this.getAccounts({ parentCode });
  }

  /**
   * Lấy tài khoản theo nhóm (Loại 1–9)
   */
  getAccountGroups(): Observable<AccountGroup[]> {
    const types: AccountType[] = [
      'ASSET_SHORT', 'ASSET_LONG', 'LIABILITY', 'EQUITY', 'REVENUE',
      'EXPENSE_PROD', 'INCOME_OTHER', 'EXPENSE_OTHER', 'RESULT'
    ];
    return this.getAccounts().pipe(
      map(accounts => types.map((type, i) => {
        const list = accounts.filter(a => a.type === type);
        return { code: String(i + 1), name: getAccountTypeName(type), type, accounts: list, total: list.length };
      }))
    );
  }

  /**
   * TK được hạch toán (TK lá đang dùng)
   */
  getLeafAccounts(): Observable<Account[]> {
    return this.getAccounts({ postable: true });
  }

  /**
   * Thêm tài khoản mới (TK tự mở, is_system=false)
   */
  addAccount(account: NewAccountInput): Observable<Account> {
    const body: Record<string, string> = { code: account.code.trim(), name: account.name };
    if (account.parentCode) body['parent_code'] = account.parentCode;
    if (account.nature) body['nature'] = account.nature;
    if (account.detailType) body['detail_type'] = account.detailType;
    const note = account.note ?? account.description;
    if (note) body['note'] = note;

    return this.http.post<AccountDto>(BASE, body).pipe(
      map(toAccount),
      tap(a => console.info(`${LOG} addAccount ${a.code} (cha ${a.parentCode ?? '-'}) OK`)),
      catchError(err => this.fail(`addAccount ${account.code}`, err))
    );
  }

  /**
   * Cập nhật tài khoản — chỉ gửi tên, ghi chú, tính chất, đối tượng, trạng thái (BE không nhận mã / TK cha)
   */
  updateAccount(code: string, updates: Partial<Account>): Observable<Account> {
    const body: Record<string, string> = {};
    if (updates.name !== undefined) body['name'] = updates.name;
    const note = updates.note ?? updates.description;
    if (note !== undefined) body['note'] = note;
    if (updates.nature) body['nature'] = updates.nature;
    if (updates.detailType) body['detail_type'] = updates.detailType;
    if (updates.status) body['status'] = updates.status;

    return this.http.patch<AccountDto>(`${BASE}/${encodeURIComponent(code)}`, body).pipe(
      map(toAccount),
      tap(() => console.info(`${LOG} updateAccount ${code} [${Object.keys(body).join(',')}] OK`)),
      catchError(err => this.fail(`updateAccount ${code}`, err))
    );
  }

  /**
   * Xóa tài khoản — chỉ TK tự mở, chưa phát sinh, không còn TK con (BE kiểm). Muốn ngừng dùng → updateAccount status INACTIVE.
   */
  deleteAccount(code: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      tap(() => console.info(`${LOG} deleteAccount ${code} OK`)),
      catchError(err => this.fail(`deleteAccount ${code}`, err))
    );
  }

  /**
   * Kiểm tra mã TK đã tồn tại chưa
   */
  isCodeExists(code: string): Observable<boolean> {
    return this.getAccountByCode(code).pipe(map(a => a !== null));
  }

  /**
   * Lịch sử thêm/sửa/xóa 1 TK, mới nhất trước (TK đã xóa vẫn xem được)
   */
  getHistory(code: string): Observable<AccountHistoryEntry[]> {
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

  /**
   * Xuất danh mục TK ra Excel (file do BE tạo)
   */
  exportExcel(): Observable<Blob> {
    return this.http.get(`${BASE}/export`, { responseType: 'blob' }).pipe(
      tap(blob => console.info(`${LOG} exportExcel: ${blob.size} byte`)),
      catchError(err => this.fail('exportExcel', err))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Log theo mức (4xx = từ chối → warn; 5xx / mất kết nối → error) rồi trả lỗi gốc cho component */
  private fail(op: string, err: unknown): Observable<never> {
    const status = err instanceof HttpErrorResponse ? err.status : -1;
    const text = httpErrorText(err);
    if (status >= 400 && status < 500) {
      console.warn(`${LOG} ${op}: BE từ chối — ${text}`);
    } else {
      console.error(`${LOG} ${op}: lỗi ${status === 0 ? 'mất kết nối ledger-rs' : 'hệ thống'} — ${text}`);
    }
    return throwError(() => err);
  }
}

function toAccount(d: AccountDto): Account {
  return {
    code: d.code,
    name: d.name,
    parentCode: d.parent_code ?? undefined,
    type: d.account_type,
    nature: d.nature,
    level: d.level,
    isParent: !d.is_leaf,
    isLeaf: d.is_leaf,
    postable: d.postable,
    isDetailRequired: d.detail_type !== 'NONE',
    detailType: d.detail_type,
    note: d.note,
    status: d.status,
    isSystemAccount: d.is_system,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    createdBy: d.created_by,
    updatedBy: d.updated_by
  };
}
