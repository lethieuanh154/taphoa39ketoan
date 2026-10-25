import { Injectable, signal } from '@angular/core';

/**
 * VIỆC CHẠY NỀN CỦA CÁC TRANG TIỆN ÍCH (23/10/2026) — chuyển sang trang khác KHÔNG làm dừng việc đang chạy (đọc thư mục XML, lấy
 * HĐĐT KiotViet, lấy Gmail + scrape). Việc giữ ở service (sống suốt phiên), không ở component (bị hủy khi đổi trang); kết quả ghi
 * IndexedDB (TienIchCacheService) ngay trong việc → quay lại trang: còn chạy thì chờ tiếp + hiện tiến độ, xong rồi thì đọc bản lưu.
 * Cùng khóa đang chạy → dùng lại, không chạy trùng.
 */
const LOG = '[BgJob]';

export interface BgJob<T = unknown> {
  key: string;
  label: string;
  startedAt: number;
  /** tiến độ hiện tại (vd "120/450 file") */
  progress: string;
  /** nhật ký từng bước (trang Gmail hiện ra khung log) */
  log: string[];
  /** dữ liệu kèm theo để trang dựng lại kết quả khi quay lại (kỳ, nhãn...) */
  meta: Record<string, any>;
  promise: Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class BackgroundJobService {
  private jobs = new Map<string, BgJob<any>>();
  /** Việc đang chạy (cho khung "Đang chạy nền" ở MainLayout — thấy được ở mọi trang, 25/10/2026) */
  readonly active = signal<BgJob<any>[]>([]);

  run<T>(key: string, label: string, meta: Record<string, any>, fn: (job: BgJob<T>) => Promise<T>): BgJob<T> {
    const running = this.jobs.get(key) as BgJob<T> | undefined;
    if (running) {
      console.log(`${LOG} ${label}: đang chạy từ ${new Date(running.startedAt).toLocaleTimeString('vi-VN')} → dùng lại`);
      return running;
    }
    const job = { key, label, startedAt: Date.now(), progress: '', log: [], meta } as unknown as BgJob<T>;
    console.log(`${LOG} Bắt đầu: ${label}`);
    job.promise = fn(job).then(
      r => {
        console.log(`${LOG} Xong: ${label} (${((Date.now() - job.startedAt) / 1000).toFixed(1)} giây)`);
        return r;
      },
      e => {
        console.warn(`${LOG} Lỗi: ${label} — ${e?.message || e?.status || e}`);
        throw e;
      }
    ).finally(() => {
      this.jobs.delete(key);
      this.active.set([...this.jobs.values()]);
    });
    this.jobs.set(key, job);
    this.active.set([...this.jobs.values()]);
    return job;
  }

  get<T>(key: string): BgJob<T> | undefined {
    return this.jobs.get(key) as BgJob<T> | undefined;
  }

  /** Việc đang chạy có khóa bắt đầu bằng `prefix` (mới nhất trước) */
  find<T>(prefix: string): BgJob<T> | undefined {
    return [...this.jobs.values()].filter(j => j.key.startsWith(prefix)).sort((a, b) => b.startedAt - a.startedAt)[0] as BgJob<T> | undefined;
  }
}
