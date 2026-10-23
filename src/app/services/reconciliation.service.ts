import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Zip, ZipDeflate } from 'fflate';
import { environment } from '../../environments/environment';
import { AuthService, httpErrorText } from './auth.service';
import { TienIchCacheService } from './tien-ich-cache.service';

/**
 * ĐỐI SOÁT HÓA ĐƠN XML (Tiện ích) — API KeToanBackEnd /api/reconciliation/* (TapHoa39KeToanBackEnd/docs/RECONCILIATION.md).
 * Trình duyệt chọn thư mục → lọc file script đọc được → nén ZIP → upload (XHR để có tiến trình) → BE chạy doi_soat.py nền.
 */
const LOG = '[Reconciliation]';
const BASE = `${environment.ketoanBackendUrl}/api/reconciliation`;
/** Thư mục script tự tạo — script không đọc lại (doi_soat.py SKIP_DIRS) */
const SKIP_DIRS = ['XML to khai (ban nhap)', 'Dau vao (quy doi)', 'Dau ra (quy doi)'];
const KEEP_EXTS = ['.xml', '.zip', '.json', '.xlsx'];

export type RunStatus = 'queued' | 'running' | 'done' | 'error';

export interface RunProgress { stage: string; label: string; done: number; total: number; percent: number; }

export interface RunSummary {
  company: string; period: string; from: string; to: string; n_files: number;
  n_invoices_in: number; n_invoices_out: number; n_items: number; n_review: number; n_saved_mappings?: number;
  exceptions: { [severity: string]: number }; catalog: string; has_tncn: boolean;
}

export interface RunTab { key: string; title: string; count: number; }

export interface ReconciliationRun {
  id: string; status: RunStatus; created_at: string; created_by: string; folder_name: string;
  progress: RunProgress; summary: RunSummary | null; error: string; duration_s: number | null;
  warnings?: string[]; logs?: string[]; tabs?: RunTab[]; has_report?: boolean;
  /** Bảng ánh xạ sửa được (anh-xa-dau-vao / anh-xa-dau-ra) — đọc bằng getTab */
  mapping_tabs?: RunTab[]; has_clone_zip?: boolean; source_run?: string;
  /** Tab Số liệu khai thuế (bảng kê, PL142) + file bảng kê Excel — bước 5 */
  tax_tabs?: RunTab[]; has_bang_ke?: boolean;
  options?: { mst: string; tu_ngay: string; den_ngay: string; file_count: number };
  upload_bytes?: number;
}

export type ColumnType = 'date' | 'number' | 'text';

export interface TabQuery { page: number; pageSize: number; q: string; sort: number | null; desc: boolean; filters: { [col: string]: string }; }

export interface TabPage {
  key: string; title: string; headers: string[]; types: ColumnType[]; formats: { [col: string]: string };
  widths: number[]; wrap: boolean; total: number; count: number; page: number; page_size: number; rows: any[][];
}

export interface CatalogStatus { exists: boolean; exportedAt?: string; count?: number; ageHours?: number | null; }

/** Kết quả tìm mã master trong bảng quy đổi KiotViet */
export interface CatalogItem { code: string; name: string; unit: string; score: number; units: { unit: string; conversion: number }[]; }

/** Giá trị hiện tại của 1 dòng ánh xạ kế toán đã đổi (gửi đủ 4 cột sửa được) */
export interface MappingEdit { key: string; ma_master: string; he_so: number | null; ma_vietda: string; da_kiem: boolean; }

/** 1 dòng so với tờ khai đã nộp: [chỉ tiêu, đã nộp, tính ra, chênh, kết luận] */
export type CompareRow = [string, number | null, number | null, number, string];

/** Định nghĩa dòng 01/GTGT (doi_soat.TK_ROWS): [STT, chỉ tiêu, mã giá trị, mã thuế, in đậm] */
export type TkRow = [string, string, string | null, string | null, boolean];
/** Định nghĩa dòng 05/KK-TNCN (doi_soat.TNCN_ROWS): [STT, chỉ tiêu, mã, đơn vị, in đậm] */
export type TncnRow = [string, string, string, string, boolean];

export interface TncnFigures {
  period: { from: string; to: string; label: string; short: string };
  tk: { [code: string]: number }; persons: any[]; q_rows: any[]; info: any; compare: CompareRow[] | null;
  same_file: string; src_name: string; warnings?: string[]; tncn_rows?: TncnRow[];
}

export interface TaxFigures {
  tax: {
    v22: number; tk: { [code: string]: number };
    pl1: [string, number, number][]; pl2: [string, number, number][]; pl3: { [code: string]: number };
    compare: CompareRow[] | null; same_file: string; prev_file: string; repl_adj: { [k: string]: [number, number, number] };
  } | null;
  tncn: TncnFigures | null;
  tax_tabs: RunTab[]; tk_rows: TkRow[]; tncn_rows: TncnRow[]; ra_groups: [string, string][]; has_bang_ke: boolean;
}

/** Kết quả quét thư mục kế toán chọn */
export interface FolderScan {
  folderName: string;
  files: { path: string; file: File }[];
  nXml: number; nZip: number; nSkipped: number; totalBytes: number;
  payroll: string[]; vietda: string[]; mapping: string[]; catalogs: string[];
  suspicious: string[];
}

export interface StartOptions { mst: string; tuNgay: string; denNgay: string; }

@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private cache = inject(TienIchCacheService);

  /** Lọc file như doi_soat.py đọc: XML / ZIP hóa đơn + bảng lương / danh mục Vietda / ánh xạ / bảng quy đổi ở thư mục gốc. */
  scanFolder(list: FileList | File[]): FolderScan {
    const all = Array.from(list);
    const folderName = (all[0] as any)?.webkitRelativePath?.split('/')[0] || '';
    const scan: FolderScan = { folderName, files: [], nXml: 0, nZip: 0, nSkipped: 0, totalBytes: 0,
      payroll: [], vietda: [], mapping: [], catalogs: [], suspicious: [] };
    for (const file of all) {
      const rel: string = (file as any).webkitRelativePath || file.name;
      const parts = rel.split('/');
      const path = parts.length > 1 ? parts.slice(1).join('/') : rel;   // bỏ tên thư mục được chọn
      const name = parts[parts.length - 1];
      const low = name.toLowerCase();
      if (low.endsWith('.xlsm') || low === '~$cache1') {
        scan.suspicious.push(path);
      }
      const inSkipDir = parts.slice(1, -1).some(p => SKIP_DIRS.includes(p));
      if (inSkipDir || low.startsWith('~$') || !KEEP_EXTS.some(ext => low.endsWith(ext))) {
        scan.nSkipped++;
        continue;
      }
      const atRoot = parts.length <= 2;
      if (low.endsWith('.xml')) scan.nXml++;
      else if (low.endsWith('.zip')) scan.nZip++;
      else if (atRoot && low.endsWith('.xlsx') && low.includes('luong')) scan.payroll.push(name);
      else if (atRoot && low.endsWith('.xlsx') && low.startsWith('quydoi')) scan.vietda.push(name);
      else if (atRoot && low === 'anh_xa_hang_hoa.xlsx') scan.mapping.push(name);
      else if (atRoot && low.endsWith('.json') && (low.startsWith('bang_quy_doi_kiotviet') || low.startsWith('kiotvietproducts'))) scan.catalogs.push(name);
      else { scan.nSkipped++; continue; }   // xlsx / json khác ở thư mục gốc hoặc thư mục con — script không đọc
      scan.files.push({ path, file });
      scan.totalBytes += file.size;
    }
    console.info(`${LOG} Quét thư mục "${folderName}": ${all.length} file → gửi ${scan.files.length} (XML ${scan.nXml}, ZIP ${scan.nZip}), bỏ qua ${scan.nSkipped}`);
    if (scan.suspicious.length) {
      console.warn(`${LOG} Thấy ${scan.suspicious.length} file .xlsm / ~$cache1 — có thể nhiễm virus macro Excel`);
    }
    return scan;
  }

  /** Nén ZIP trên trình duyệt (nhả luồng mỗi 200 file để trang không bị treo); giữ giờ sửa file (BE chọn file mới nhất). */
  async zipFiles(scan: FolderScan, onProgress: (done: number, total: number) => void): Promise<Blob> {
    const t0 = performance.now();
    const chunks: Uint8Array[] = [];
    let failed: unknown = null;
    const zip = new Zip((err, data) => {
      if (err) { failed = err; return; }
      chunks.push(data);
    });
    const total = scan.files.length;
    for (let i = 0; i < total; i++) {
      const { path, file } = scan.files[i];
      const entry = new ZipDeflate(path, { level: 6 });
      entry.mtime = file.lastModified ? new Date(Math.max(file.lastModified, Date.UTC(1980, 0, 2))) : new Date();
      zip.add(entry);
      entry.push(new Uint8Array(await file.arrayBuffer()), true);
      if (failed) break;
      if (i % 200 === 199) {
        onProgress(i + 1, total);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    zip.end();
    if (failed) {
      console.error(`${LOG} Nén ZIP lỗi:`, failed);
      throw new Error(`Nén ZIP lỗi: ${failed}`);
    }
    onProgress(total, total);
    const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' });
    console.info(`${LOG} Nén ${total} file: ${(scan.totalBytes / 1048576).toFixed(1)} MB → ${(blob.size / 1048576).toFixed(1)} MB (${Math.round(performance.now() - t0)} ms)`);
    return blob;
  }

  /** Upload bằng XHR (HttpClient withFetch không báo tiến trình upload) — tự gắn X-Id-Token. → mã lần chạy. */
  async upload(zip: Blob, scan: FolderScan, opts: StartOptions, onProgress: (loaded: number, total: number) => void): Promise<string> {
    const token = await this.auth.getIdToken();
    if (!token) {
      console.warn(`${LOG} Upload: chưa có ID token — BE sẽ từ chối nếu bật ENFORCE_AUTH`);
    }
    const form = new FormData();
    form.append('file', zip, `${scan.folderName || 'thu-muc'}.zip`);
    form.append('mst', opts.mst || '');
    form.append('tu_ngay', opts.tuNgay || '');
    form.append('den_ngay', opts.denNgay || '');
    form.append('file_count', String(scan.files.length));
    form.append('folder_name', scan.folderName);
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/runs`);
      if (token) xhr.setRequestHeader('X-Id-Token', token);
      xhr.upload.onprogress = e => onProgress(e.loaded, e.lengthComputable ? e.total : zip.size);
      xhr.onload = () => {
        let body: any = null;
        try { body = JSON.parse(xhr.responseText); } catch { /* không phải JSON */ }
        if (xhr.status === 202 && body?.id) {
          console.info(`${LOG} Upload xong (${(zip.size / 1048576).toFixed(1)} MB) → lần chạy ${body.id}`);
          resolve(body.id);
        } else {
          const text = httpErrorText({ status: xhr.status, error: body });
          console.warn(`${LOG} Upload bị từ chối: ${text}`);
          reject(new Error(text));
        }
      };
      xhr.onerror = () => {
        console.error(`${LOG} Upload lỗi mạng (máy chủ không phản hồi / nginx chặn file quá lớn?)`);
        reject(new Error('Không gửi được file lên máy chủ (mất kết nối hoặc file quá lớn)'));
      };
      xhr.send(form);
    });
  }

  listRuns(): Observable<{ busy: boolean; runs: ReconciliationRun[] }> {
    return this.http.get<any>(`${BASE}/runs`).pipe(
      map(r => ({ busy: !!r.busy, runs: r.runs as ReconciliationRun[] })),
      tap({ error: e => console.warn(`${LOG} Lấy danh sách lần chạy lỗi: ${httpErrorText(e)}`) })
    );
  }

  getRun(id: string): Observable<ReconciliationRun> {
    return this.http.get<any>(`${BASE}/runs/${id}`).pipe(
      map(r => r.run as ReconciliationRun),
      tap({ error: e => console.warn(`${LOG} Lấy lần chạy ${id} lỗi: ${httpErrorText(e)}`) })
    );
  }

  deleteRun(id: string): Observable<void> {
    return this.http.delete<any>(`${BASE}/runs/${id}`).pipe(
      map(() => undefined),
      tap({
        next: () => {
          console.info(`${LOG} Đã xóa lần chạy ${id}`);
          void this.cache.remove(`figures:${id}`);
        },
        error: e => console.warn(`${LOG} Xóa lần chạy ${id} lỗi: ${httpErrorText(e)}`)
      })
    );
  }

  /** Chạy lại với ánh xạ mới nhất (BE dùng dữ liệu đã phân tích, không cần tải thư mục lên lại) → mã lần chạy mới */
  rerun(id: string): Observable<string> {
    console.info(`${LOG} Chạy lại lần ${id}`);
    return this.http.post<any>(`${BASE}/runs/${id}/rerun`, {}).pipe(
      map(r => r.id as string),
      tap({
        next: newId => console.info(`${LOG} Chạy lại ${id} → lần chạy ${newId}`),
        error: e => console.warn(`${LOG} Chạy lại ${id} lỗi: ${httpErrorText(e)}`)
      })
    );
  }

  saveMapping(id: string, edits: MappingEdit[]): Observable<{ saved: number; removed: number; skipped: number }> {
    console.info(`${LOG} Lưu ${edits.length} dòng ánh xạ (lần ${id})`);
    return this.http.put<any>(`${BASE}/runs/${id}/mapping`, { edits }).pipe(
      map(r => ({ saved: r.saved, removed: r.removed, skipped: r.skipped })),
      tap({
        next: r => console.info(`${LOG} Đã lưu ánh xạ: ghi ${r.saved}, bỏ ${r.removed}, không khớp ${r.skipped}`),
        error: e => console.warn(`${LOG} Lưu ánh xạ lỗi: ${httpErrorText(e)}`)
      })
    );
  }

  searchCatalog(q: string): Observable<CatalogItem[]> {
    return this.http.get<any>(`${BASE}/catalog/search`, { params: { q } }).pipe(
      map(r => r.items as CatalogItem[]),
      tap({ error: e => console.warn(`${LOG} Tìm mã master lỗi: ${httpErrorText(e)}`) })
    );
  }

  getTab(id: string, key: string, query: TabQuery): Observable<TabPage> {
    return this.http.get<any>(`${BASE}/runs/${id}/tabs/${key}`, { params: this.tabParams(query) }).pipe(
      map(r => r as TabPage),
      tap({ error: e => console.warn(`${LOG} Lấy tab ${key} (${id}) lỗi: ${httpErrorText(e)}`) })
    );
  }

  async exportTab(id: string, key: string, title: string, format: 'xlsx' | 'csv', query: TabQuery): Promise<void> {
    const params = this.tabParams(query).set('format', format);
    await this.download(`${BASE}/runs/${id}/tabs/${key}/export`, `${title.replace(/ /g, '_')}_${id}.${format}`, params);
  }

  downloadReport(id: string): Promise<void> {
    return this.download(`${BASE}/runs/${id}/report`, `doi_soat_${id}.xlsx`);
  }

  downloadCloneZip(id: string): Promise<void> {
    return this.download(`${BASE}/runs/${id}/xml-quy-doi`, `xml_quy_doi_${id}.zip`);
  }

  catalogStatus(): Observable<CatalogStatus> {
    return this.http.get<any>(`${environment.ketoanBackendUrl}/api/kiotviet/unit-conversion/status`).pipe(
      map(r => r as CatalogStatus),
      tap({ error: e => console.warn(`${LOG} Trạng thái bảng quy đổi lỗi: ${httpErrorText(e)}`) })
    );
  }

  refreshCatalog(): Observable<CatalogStatus> {
    console.info(`${LOG} Cập nhật bảng quy đổi từ KiotViet...`);
    return this.http.post<any>(`${environment.ketoanBackendUrl}/api/kiotviet/unit-conversion/refresh`, {}).pipe(
      map(r => r as CatalogStatus),
      tap({
        next: st => console.info(`${LOG} Bảng quy đổi: ${st.count} dòng ĐVT (${st.exportedAt})`),
        error: e => console.warn(`${LOG} Cập nhật bảng quy đổi lỗi: ${httpErrorText(e)}`)
      })
    );
  }

  downloadCatalog(): Promise<void> {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return this.download(`${environment.ketoanBackendUrl}/api/kiotviet/unit-conversion/download`, `bang_quy_doi_kiotviet_${stamp}.json`);
  }

  private tabParams(query: TabQuery): HttpParams {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.sort !== null) params = params.set('sort', query.sort).set('desc', query.desc);
    const filters = Object.fromEntries(Object.entries(query.filters).filter(([, v]) => v && v.trim()));
    if (Object.keys(filters).length) params = params.set('filters', JSON.stringify(filters));
    return params;
  }

  /** Tải file qua HttpClient (interceptor gắn token) rồi lưu bằng link tạm. */
  // ===== Số liệu khai thuế (bước 5, 23/10/2026) =====

  /** Số liệu 01/GTGT + PL142 + 05/KK-TNCN của 1 lần đối soát + định nghĩa dòng theo thứ tự HTKK */
  /** Số liệu của 1 lần chạy không đổi nữa → lưu IndexedDB, mở lại trang Số liệu khai thuế không gọi máy chủ */
  async getFigures(id: string): Promise<TaxFigures> {
    const key = `figures:${id}`;
    const hit = await this.cache.get<TaxFigures>(key);
    if (hit) {
      console.log(`${LOG} Số liệu lần ${id}: dùng bản lưu trên máy`);
      return hit.data;
    }
    const fg = await firstValueFrom(this.http.get<TaxFigures>(`${BASE}/runs/${id}/figures`));
    await this.cache.set(key, fg);
    return fg;
  }

  /** Bảng kê 01-1 mua vào / bán ra (Excel theo mẫu) */
  downloadBangKe(id: string): Promise<void> {
    return this.download(`${BASE}/runs/${id}/bang-ke`, `bang_ke_${id}.xlsx`);
  }

  /** 05/KK-TNCN từ file bảng lương (không cần đối soát XML); toKhai = XML tờ khai TNCN đã nộp để so (tùy chọn) */
  tncnFromPayroll(file: File, from: string, to: string, toKhai: File[]): Promise<TncnFigures> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('tu_ngay', from);
    fd.append('den_ngay', to);
    for (const f of toKhai) fd.append('to_khai', f, f.name);
    return firstValueFrom(this.http.post<TncnFigures>(`${BASE}/tncn`, fd));
  }

  private async download(url: string, filename: string, params?: HttpParams): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(url, { params, responseType: 'blob' }));
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      console.info(`${LOG} Tải ${filename} (${(blob.size / 1024).toFixed(0)} KB)`);
    } catch (e: any) {
      // lỗi responseType blob: detail nằm trong Blob JSON
      let detail = '';
      try { detail = JSON.parse(await (e?.error as Blob).text())?.detail || ''; } catch { /* không đọc được */ }
      const text = `HTTP ${e?.status ?? '?'}${detail ? ' — ' + detail : ''}`;
      console.warn(`${LOG} Tải ${filename} lỗi: ${text}`);
      throw new Error(text);
    }
  }
}
