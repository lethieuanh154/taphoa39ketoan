import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { httpErrorText } from './auth.service';
import {
  Item,
  ItemFilter,
  ItemHistoryEntry,
  ItemKind,
  ItemPatch,
  ItemStatus,
  MasterImportResult,
  MasterImportRow,
  MasterInput,
  NewItemInput,
  UnitInput,
  VatRate,
  VietdaImportResult
} from '../models/item.models';

const LOG = '[Item]';
const BASE = `${environment.ledgerUrl}/api/ledger/items`;

/** Dạng JSON ledger-rs trả về (snake_case) */
interface ItemDto {
  code: string;
  kind: ItemKind;
  name: string;
  unit: string;
  inventory_account: string;
  vat_rate: VatRate | null;
  note: string;
  status: ItemStatus;
  units: { unit: string; factor: string }[];
  masters: { master_code: string; master_id: number | null; kv_unit: string; factor: string; source: 'import' | 'manual' }[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

interface HistoryDto {
  id: string;
  at: string;
  user_email: string;
  action: ItemHistoryEntry['action'];
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  changes: ItemHistoryEntry['changes'];
}

interface VietdaImportDto {
  dry_run: boolean;
  rows: number;
  create: { code: string; name: string; unit: string }[];
  update: {
    code: string; file_code: string; old_name: string; new_name: string; old_unit: string; new_unit: string;
    fields: ('name' | 'unit')[]; unit_locked: boolean; applied: boolean;
  }[];
  same: number;
  skip_total: number;
  skip: { key: string; reason: string }[];
}

interface MasterImportDto {
  dry_run: boolean;
  link: { master_code: string; item_code: string }[];
  filled_id: number;
  skip_total: number;
  skip: { key: string; reason: string }[];
  conflict: { key: string; reason: string }[];
}

const unitsDto = (u: UnitInput[]) => u.map(x => ({ unit: x.unit, factor: x.factor }));
const mastersDto = (m: MasterInput[]) => m.map(x => ({
  master_code: x.masterCode,
  ...(x.masterId != null ? { master_id: x.masterId } : {}),
  ...(x.kvUnit != null ? { kv_unit: x.kvUnit } : {}),
  ...(x.factor != null ? { factor: x.factor } : {})
}));

/**
 * SERVICE: DANH MỤC HÀNG HÓA (HH / KM) — ledger-rs `/api/ledger/items*`.
 * Cấp mã, mã trùng (HH17 = HH0017), TK kho, đổi ĐVT chính thiếu hệ số (LA224)… do BE kiểm; lỗi trả nguyên HttpErrorResponse
 * để component hiện đúng lý do. Log chỉ mã + số lượng — KHÔNG log tên hàng hàng loạt, từ khóa tìm kiếm.
 */
@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private http = inject(HttpClient);

  /** Danh sách (kèm ĐVT phụ + mã master) — lọc ở BE theo search / kind / status */
  getItems(filter?: ItemFilter): Observable<Item[]> {
    let params = new HttpParams();
    if (filter?.search?.trim()) params = params.set('search', filter.search.trim());
    if (filter?.kind) params = params.set('kind', filter.kind);
    if (filter?.status) params = params.set('status', filter.status);
    return this.http.get<ItemDto[]>(BASE, { params }).pipe(
      map(rows => rows.map(toItem)),
      tap(rows => console.info(
        `${LOG} getItems: ${rows.length} mặt hàng (kind=${filter?.kind ?? '-'} status=${filter?.status ?? '-'} có search=${!!filter?.search?.trim()})`
      )),
      catchError(err => this.fail('getItems', err))
    );
  }

  /** 1 mặt hàng (không có → null) */
  getItem(code: string): Observable<Item | null> {
    return this.http.get<ItemDto>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      map(toItem),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          console.info(`${LOG} getItem ${code}: không có`);
          return of(null);
        }
        return this.fail(`getItem ${code}`, err);
      })
    );
  }

  /** Mặt hàng của 1 mã master KiotViet (ưu tiên masterId — mã vạch đổi vẫn ra đúng); chưa gán → null */
  getByMaster(masterCode: string, masterId?: number): Observable<Item | null> {
    const params = masterId != null ? new HttpParams().set('master_id', String(masterId)) : undefined;
    return this.http.get<ItemDto>(`${BASE}/by-master/${encodeURIComponent(masterCode)}`, { params }).pipe(
      map(toItem),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          console.info(`${LOG} getByMaster ${masterCode}: chưa gán`);
          return of(null);
        }
        return this.fail(`getByMaster ${masterCode}`, err);
      })
    );
  }

  /** Thêm — code trống + kind → BE tự cấp HH / KM (số lớn nhất + 1) */
  addItem(input: NewItemInput): Observable<Item> {
    const body: Record<string, unknown> = { name: input.name, unit: input.unit };
    if (input.code?.trim()) body['code'] = input.code.trim();
    if (input.kind) body['kind'] = input.kind;
    if (input.inventoryAccount?.trim()) body['inventory_account'] = input.inventoryAccount.trim();
    if (input.vatRate) body['vat_rate'] = input.vatRate;
    if (input.note?.trim()) body['note'] = input.note;
    if (input.status) body['status'] = input.status;
    if (input.units?.length) body['units'] = unitsDto(input.units);
    if (input.masters?.length) body['masters'] = mastersDto(input.masters);
    return this.http.post<ItemDto>(BASE, body).pipe(
      map(toItem),
      tap(it => console.info(`${LOG} addItem ${it.code} (${it.kind}, ${body['code'] ? 'mã gõ tay' : 'mã tự cấp'}) OK`)),
      catchError(err => this.fail(`addItem ${input.kind ?? input.code ?? ''}`, err))
    );
  }

  /** Sửa — chỉ gửi trường có trong `changes`; '' = xóa (vatRate, note) */
  updateItem(code: string, changes: ItemPatch): Observable<Item> {
    const body: Record<string, unknown> = {};
    if (changes.name !== undefined) body['name'] = changes.name;
    if (changes.unit !== undefined) body['unit'] = changes.unit;
    if (changes.inventoryAccount !== undefined) body['inventory_account'] = changes.inventoryAccount;
    if (changes.vatRate !== undefined) body['vat_rate'] = changes.vatRate;
    if (changes.note !== undefined) body['note'] = changes.note;
    if (changes.status !== undefined) body['status'] = changes.status;
    if (changes.units !== undefined) body['units'] = unitsDto(changes.units);
    if (changes.masters !== undefined) body['masters'] = mastersDto(changes.masters);
    return this.http.patch<ItemDto>(`${BASE}/${encodeURIComponent(code)}`, body).pipe(
      map(toItem),
      tap(() => console.info(`${LOG} updateItem ${code} [${Object.keys(body).join(',')}] OK`)),
      catchError(err => this.fail(`updateItem ${code}`, err))
    );
  }

  /** Xóa thật (kèm ĐVT phụ + liên kết mã master) — chỉ khi chưa phát sinh. Muốn ngừng dùng → updateItem status INACTIVE. */
  deleteItem(code: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${encodeURIComponent(code)}`).pipe(
      tap(() => console.info(`${LOG} deleteItem ${code} OK`)),
      catchError(err => this.fail(`deleteItem ${code}`, err))
    );
  }

  /** Thay cả danh sách ĐVT phụ */
  setUnits(code: string, units: UnitInput[]): Observable<Item> {
    return this.http.put<ItemDto>(`${BASE}/${encodeURIComponent(code)}/units`, unitsDto(units)).pipe(
      map(toItem),
      tap(it => console.info(`${LOG} setUnits ${code}: ${it.units.length} ĐVT phụ`)),
      catchError(err => this.fail(`setUnits ${code}`, err))
    );
  }

  /** Gán 1 mã master — đã thuộc mặt hàng khác → 409 LA222 (detail có mã đang giữ) */
  addMaster(code: string, master: MasterInput): Observable<Item> {
    const [body] = mastersDto([master]);
    return this.http.post<ItemDto>(`${BASE}/${encodeURIComponent(code)}/masters`, body).pipe(
      map(toItem),
      tap(it => console.info(`${LOG} addMaster ${code} ← ${master.masterCode}: ${it.masters.length} mã master`)),
      catchError(err => this.fail(`addMaster ${code}`, err))
    );
  }

  removeMaster(code: string, masterCode: string): Observable<Item> {
    return this.http.delete<ItemDto>(`${BASE}/${encodeURIComponent(code)}/masters/${encodeURIComponent(masterCode)}`).pipe(
      map(toItem),
      tap(() => console.info(`${LOG} removeMaster ${code} ✕ ${masterCode}`)),
      catchError(err => this.fail(`removeMaster ${code}`, err))
    );
  }

  /** Lịch sử gộp mặt hàng + ĐVT phụ + mã master, mới nhất trước */
  getHistory(code: string): Observable<ItemHistoryEntry[]> {
    return this.http.get<HistoryDto[]>(`${BASE}/${encodeURIComponent(code)}/history`).pipe(
      map(rows => rows.map(r => ({
        id: r.id, at: new Date(r.at), userEmail: r.user_email, action: r.action, old: r.old, new: r.new, changes: r.changes ?? []
      }))),
      tap(rows => console.info(`${LOG} getHistory ${code}: ${rows.length} dòng`)),
      catchError(err => this.fail(`getHistory ${code}`, err))
    );
  }

  exportExcel(): Observable<Blob> {
    return this.http.get(`${BASE}/export`, { responseType: 'blob' }).pipe(
      tap(blob => console.info(`${LOG} exportExcel: ${blob.size} byte`)),
      catchError(err => this.fail('exportExcel', err))
    );
  }

  /** Nạp file DM Vietda (xlsx). dryRun → xem trước; ghi thật chỉ cập nhật mã trong `updateCodes` (nhóm "Khác thông tin") */
  importVietda(file: File, dryRun: boolean, updateCodes: string[] = []): Observable<VietdaImportResult> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('dry_run', String(dryRun));
    if (updateCodes.length) fd.append('update_codes', updateCodes.join(','));
    return this.http.post<VietdaImportDto>(`${BASE}/import-vietda`, fd).pipe(
      map(r => ({
        dryRun: r.dry_run, rows: r.rows, create: r.create, same: r.same, skipTotal: r.skip_total, skip: r.skip,
        update: r.update.map(u => ({
          code: u.code, fileCode: u.file_code, oldName: u.old_name, newName: u.new_name, oldUnit: u.old_unit, newUnit: u.new_unit,
          fields: u.fields, unitLocked: u.unit_locked, applied: u.applied
        }))
      })),
      tap(r => console.info(
        `${LOG} importVietda ${dryRun ? '(xem trước)' : '(ghi)'}: ${file.size} byte, ${r.rows} dòng → tạo ${r.create.length}, ` +
        `khác ${r.update.length} (cập nhật ${r.update.filter(u => u.applied).length}, tick ${updateCodes.length}), giống ${r.same}, bỏ qua ${r.skipTotal}`
      )),
      catchError(err => this.fail('importVietda', err))
    );
  }

  /** Nạp ghép mã master (≤ 10.000 dòng). Chạy lại an toàn: đã gán đúng → bỏ qua, gán mặt hàng khác → conflict (không đè) */
  importMasters(rows: MasterImportRow[], dryRun: boolean): Observable<MasterImportResult> {
    const body = {
      dry_run: dryRun,
      items: rows.map(r => ({
        master_code: r.masterCode, master_id: r.masterId ?? null, hh: r.hh, kv_unit: r.kvUnit ?? null, he_so: r.heSo ?? null
      }))
    };
    return this.http.post<MasterImportDto>(`${BASE}/import-masters`, body).pipe(
      map(r => ({
        dryRun: r.dry_run, filledId: r.filled_id, skipTotal: r.skip_total, skip: r.skip, conflict: r.conflict,
        link: r.link.map(l => ({ masterCode: l.master_code, itemCode: l.item_code }))
      })),
      tap(r => console.info(
        `${LOG} importMasters ${dryRun ? '(xem trước)' : '(ghi)'}: gửi ${rows.length} → gán ${r.link.length}, bổ sung masterId ${r.filledId}, ` +
        `bỏ qua ${r.skipTotal}, xung đột ${r.conflict.length}`
      )),
      catchError(err => this.fail('importMasters', err))
    );
  }

  /** Log theo mức (4xx = từ chối → warn, chỉ mã lỗi LA…; 5xx / mất kết nối → error) rồi trả lỗi gốc cho component */
  private fail(op: string, err: unknown): Observable<never> {
    const status = err instanceof HttpErrorResponse ? err.status : -1;
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

function toItem(d: ItemDto): Item {
  return {
    code: d.code,
    kind: d.kind,
    name: d.name,
    unit: d.unit,
    inventoryAccount: d.inventory_account,
    vatRate: d.vat_rate ?? undefined,
    note: d.note,
    status: d.status,
    units: d.units ?? [],
    masters: (d.masters ?? []).map(m => ({
      masterCode: m.master_code, masterId: m.master_id ?? undefined, kvUnit: m.kv_unit, factor: m.factor, source: m.source
    })),
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    createdBy: d.created_by,
    updatedBy: d.updated_by
  };
}
