import { inject, Injectable } from '@angular/core';
import { IndexedDBService } from './indexed-db.service';

/**
 * CACHE INDEXEDDB CHO CÁC TRANG TIỆN ÍCH (23/10/2026) — giữ dữ liệu đã tải để mở lại trang / quay lại không phải tải lại:
 * XML đã đọc từ thư mục (Kiểm tra số lượng HĐ), HĐĐT KiotViet, link Gmail, HĐ CK theo ngày đã chốt, kết quả kiểm HĐ / số liệu
 * khai thuế của lần chạy đã xong (không đổi nữa).
 * Mọi lỗi IndexedDB chỉ log cảnh báo → trang vẫn chạy như không có cache. Đăng xuất xóa hết (AuthService.logout).
 *
 * Khóa (prefix):
 * - `xml-in` / `xml-out`       XML đã đọc ở trang Kiểm tra số lượng HĐ đầu vào / đầu ra
 * - `einvoice-bills:<from>:<to>` HĐĐT KiotViet theo khoảng ngày
 * - `gmail-links:<from>:<to>`  link HĐ gốc trong Gmail theo khoảng ngày
 * - `ck-range:<from>:<to>`    HĐ CK của khoảng ngày đã chốt (kết thúc trước hôm nay > 8 ngày — máy chủ không tự lấy lại nữa)
 * - `check-run:<id>`           kết quả 1 lần Kiểm tra HĐ đã xong
 * - `figures:<id>`             số liệu khai thuế của 1 lần đối soát
 * Mục lưu quá MAX_AGE_DAYS ngày tự xóa (lần mở DB đầu tiên mỗi phiên).
 */
const LOG = '[TienIchCache]';
const DB_NAME = 'ketoan_tien_ich_cache';
const DB_VERSION = 1;
const STORE = 'entries';
const MAX_AGE_DAYS = 45;

export interface CacheEntry<T> { key: string; data: T; savedAt: number; }

@Injectable({ providedIn: 'root' })
export class TienIchCacheService {
  private idb = inject(IndexedDBService);
  private pruned = false;

  private async db() {
    const db = await this.idb.getDB(DB_NAME, DB_VERSION, d => {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' });
    });
    if (!this.pruned) {
      this.pruned = true;
      void this.prune(db);
    }
    return db;
  }

  private async prune(db: Awaited<ReturnType<IndexedDBService['getDB']>>): Promise<void> {
    try {
      const limit = Date.now() - MAX_AGE_DAYS * 86400000;
      const tx = db.transaction(STORE, 'readwrite');
      let n = 0;
      for (let c = await tx.store.openCursor(); c; c = await c.continue()) {
        if ((c.value as CacheEntry<unknown>).savedAt < limit) {
          await c.delete();
          n++;
        }
      }
      await tx.done;
      if (n) console.info(`${LOG} Xóa ${n} mục lưu quá ${MAX_AGE_DAYS} ngày`);
    } catch (err) {
      console.warn(`${LOG} Dọn mục cũ lỗi:`, err);
    }
  }

  /** `maxAgeMs` có → bản cũ hơn coi như không có */
  async get<T>(key: string, maxAgeMs?: number): Promise<CacheEntry<T> | null> {
    try {
      const e = (await (await this.db()).get(STORE, key)) as CacheEntry<T> | undefined;
      if (!e) return null;
      if (maxAgeMs !== undefined && Date.now() - e.savedAt > maxAgeMs) {
        console.debug(`${LOG} ${key}: bản lưu đã cũ (${Math.round((Date.now() - e.savedAt) / 60000)} phút) → bỏ qua`);
        return null;
      }
      return e;
    } catch (err) {
      console.warn(`${LOG} Đọc ${key} lỗi → coi như chưa có:`, err);
      return null;
    }
  }

  async getMany<T>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
    const out = new Map<string, CacheEntry<T>>();
    if (!keys.length) return out;
    try {
      const tx = (await this.db()).transaction(STORE, 'readonly');
      const rows = await Promise.all(keys.map(k => tx.store.get(k)));
      await tx.done;
      rows.forEach(r => r && out.set(r.key, r as CacheEntry<T>));
    } catch (err) {
      console.warn(`${LOG} Đọc ${keys.length} khóa lỗi → coi như chưa có:`, err);
    }
    return out;
  }

  async set<T>(key: string, data: T): Promise<void> {
    await this.setMany([[key, data]]);
  }

  async setMany<T>(items: [string, T][]): Promise<void> {
    if (!items.length) return;
    try {
      const tx = (await this.db()).transaction(STORE, 'readwrite');
      const savedAt = Date.now();
      await Promise.all(items.map(([key, data]) => tx.store.put({ key, data, savedAt })));
      await tx.done;
      console.debug(`${LOG} Lưu ${items.length} mục (${items.slice(0, 3).map(i => i[0]).join(', ')}${items.length > 3 ? ', …' : ''})`);
    } catch (err) {
      console.warn(`${LOG} Lưu ${items.length} mục lỗi (trang vẫn chạy, lần sau tải lại):`, err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await (await this.db()).delete(STORE, key);
    } catch (err) {
      console.warn(`${LOG} Xóa ${key} lỗi:`, err);
    }
  }

  /** Đăng xuất → xóa hết (cache có tên người mua / NCC trong XML) */
  async clearAll(): Promise<void> {
    try {
      await (await this.db()).clear(STORE);
      console.info(`${LOG} Đã xóa toàn bộ cache Tiện ích`);
    } catch (err) {
      console.warn(`${LOG} Xóa cache lỗi:`, err);
    }
  }
}
