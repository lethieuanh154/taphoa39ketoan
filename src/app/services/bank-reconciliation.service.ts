import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TienIchCacheService } from './tien-ich-cache.service';

/**
 * ĐỐI SOÁT CK (Tiện ích) — nguồn HĐ chuyển khoản KiotViet qua KeToanBackEnd /api/bank-reconciliation/*
 * (phương án C: BE lấy HĐ CK từ KiotViet → Firestore theo ngày; KeToan FE không gọi KiotViet / Flask).
 * HĐ giữ tên trường KiotViet (Id, Code, TotalPayment, PurchaseDate, Description, InvoiceExtraData, EInvoices) để dùng y
 * logic BanHang (utils/transfer-reconcile.util.ts — vùng mirror).
 */
const LOG = '[BankRecon]';
const BASE = `${environment.ketoanBackendUrl}/api/bank-reconciliation`;
/** Mỗi lần nhờ BE lấy từ KiotViet tối đa 7 ngày (như BanHang chia tuần) */
const CHUNK_DAYS = 7;
/**
 * Máy chủ tự lấy lại 7 ngày gần nhất mỗi đêm (TRANSFER_SYNC_DAYS) → khoảng ngày kết thúc trước hôm nay > 8 ngày, đã đủ mọi ngày,
 * chỉ còn đổi khi bấm "Lấy lại từ KiotViet" → lưu IndexedDB (TienIchCacheService), mở lại không gọi máy chủ.
 */
const STABLE_AFTER_DAYS = 8;

export interface TransferInvoice {
  Id: number; Code: string; Total: number | null; TotalPayment: number | null; PurchaseDate: string; Description: string;
  InvoiceExtraData?: { EInvoiceRegistedDatePartner4?: string | null } | null;
  EInvoices?: { Serial?: string; EInvoiceNumber?: string; TaxStatus?: number; ErrorCode?: number; TaxErrors?: string; PublishedDate?: string }[];
}

export interface TransferDay { date: string; count: number; synced_at: string; complete: boolean; }

export interface TransferRange {
  from: string; to: string; invoices: TransferInvoice[]; days: TransferDay[];
  /** chưa lấy lần nào */
  missing: string[];
  /** lấy khi chưa hết ngày → có thể thiếu HĐ */
  incomplete: string[];
  oldest_sync: string | null;
  auto_sync: { enabled: boolean; time: string };
}

export interface LoadResult { data: TransferRange; syncedDays: number; /** có = dùng bản lưu trên máy lấy lúc này */ cachedAt?: number; }

@Injectable({ providedIn: 'root' })
export class BankReconciliationService {
  private http = inject(HttpClient);
  private cache = inject(TienIchCacheService);

  getRange(from: string, to: string): Promise<TransferRange> {
    const params = new HttpParams().set('from', from).set('to', to);
    return firstValueFrom(this.http.get<TransferRange>(`${BASE}/transfer-invoices`, { params }));
  }

  sync(from: string, to: string): Promise<{ days: number; invoices: number; total: number }> {
    return firstValueFrom(this.http.post<{ days: number; invoices: number; total: number }>(`${BASE}/transfer-invoices/sync`, { from, to }));
  }

  /**
   * HĐ CK [from, to]: đọc bản đã lưu; ngày chưa lấy / chưa đủ (hoặc mọi ngày khi `force`) → nhờ BE lấy lại từ KiotViet
   * theo từng đoạn ≤ 7 ngày liền nhau, rồi đọc lại. `onProgress(i, n)` = đoạn đang lấy.
   */
  async load(from: string, to: string, force: boolean, onProgress?: (i: number, n: number) => void): Promise<LoadResult> {
    const cacheKey = `ck-range:${from}:${to}`;
    const stable = to <= this.addDays(this.today(), -STABLE_AFTER_DAYS);
    if (stable && !force) {
      const hit = await this.cache.get<TransferRange>(cacheKey);
      if (hit) {
        console.log(`${LOG} ${from}→${to}: ${hit.data.invoices.length} HĐ — dùng bản lưu trên máy lúc ${new Date(hit.savedAt).toLocaleString('vi-VN')}`);
        return { data: hit.data, syncedDays: 0, cachedAt: hit.savedAt };
      }
    }
    let data = await this.getRange(from, to);
    const need = force ? this.daysBetween(from, to) : [...data.missing, ...data.incomplete].sort();
    if (need.length === 0) {
      console.log(`${LOG} ${from}→${to}: ${data.invoices.length} HĐ đã lưu, đủ mọi ngày`);
      if (stable) await this.cache.set(cacheKey, data);
      return { data, syncedDays: 0 };
    }
    const chunks = this.chunks(need);
    console.log(`${LOG} ${from}→${to}: lấy từ KiotViet ${need.length} ngày (${force ? 'lấy lại tất cả' : `chưa lấy ${data.missing.length}, chưa đủ ${data.incomplete.length}`}) — ${chunks.length} lần`);
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i + 1, chunks.length);
      const r = await this.sync(chunks[i][0], chunks[i][1]);
      console.log(`${LOG} lấy ${chunks[i][0]}→${chunks[i][1]}: ${r.invoices} HĐ`);
    }
    data = await this.getRange(from, to);
    if (stable && !data.missing.length && !data.incomplete.length) await this.cache.set(cacheKey, data);
    return { data, syncedDays: need.length };
  }

  /** Hôm nay 'YYYY-MM-DD' theo giờ máy (VN) */
  private today(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private addDays(d: string, n: number): string {
    return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  }

  /** Ngày liền nhau gom thành đoạn ≤ 7 ngày */
  private chunks(days: string[]): [string, string][] {
    const out: [string, string][] = [];
    let start = days[0], prev = days[0], n = 1;
    for (const d of days.slice(1)) {
      if (this.nextDay(prev) === d && n < CHUNK_DAYS) {
        prev = d;
        n++;
        continue;
      }
      out.push([start, prev]);
      start = prev = d;
      n = 1;
    }
    out.push([start, prev]);
    return out;
  }

  private daysBetween(from: string, to: string): string[] {
    const out: string[] = [];
    for (let d = from; d <= to; d = this.nextDay(d)) out.push(d);
    return out;
  }

  /** 'YYYY-MM-DD' + 1 ngày (tính bằng UTC để không lệch múi giờ) */
  private nextDay(d: string): string {
    return new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
}
