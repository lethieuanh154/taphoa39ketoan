import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TienIchCacheService } from './tien-ich-cache.service';

/**
 * KIỂM TRA HĐ TỰ ĐỘNG (Tiện ích) — KeToanBackEnd /api/einvoice-check/* (plan-ketoan-flow.md bước 4).
 * BE đọc HĐ nháp trên HĐĐT KiotViet (chỉ đọc) theo lịch hằng ngày + nút "Kiểm tra ngay" → kiểm số học + thuế suất theo mã
 * master → lưu Firestore; page chỉ xem kết quả và đặt "thuế suất đúng" cho mã master.
 */
const BASE = `${environment.ketoanBackendUrl}/api/einvoice-check`;
const LOG = '[EinvoiceCheck]';

export type IssueLevel = 'error' | 'warn' | 'info';
export type BillLevel = IssueLevel | 'ok';
export type CheckScope = 'draft' | 'accepted';

export interface CheckIssue {
  level: IssueLevel; kind: string; message: string;
  line?: number; code?: string; name?: string;
  current?: string; expected?: string; source?: 'manual' | 'output' | 'input' | ''; master?: string; master_name?: string;
}

export interface CheckBill {
  id: string; code: string; series: string; number: string; date: string; payment: string;
  amount: number; amount_vat: number; total: number; n_lines: number; level: BillLevel; issues: CheckIssue[];
  /** Tổng HĐ bán KiotViet cùng mã (đã so) */
  kv_total?: number;
}

export interface UnknownMaster { master_code: string; master_name: string; name: string; codes: string[]; rates: { [rate: string]: number }; lines: number; }
export interface UnmappedCode { code: string; name: string; rates: { [rate: string]: number }; lines: number; }

export interface CheckCounts {
  bills?: number; checked?: number; read_errors?: number; lines?: number; bills_error?: number; bills_warn?: number; bills_ok?: number;
  issues?: number; kinds?: { [kind: string]: number }; unknown_masters?: number; unmapped_codes?: number;
  catalog_refreshed?: boolean; rate_masters?: number; rate_manual?: number; kv_compared?: number | null;
  /** Kiểm PDF lúc phát hành (30/10/2026): null = BE tắt; pdf_single = HĐ không khớp PDF gộp phải đọc riêng */
  pdf_checked?: number | null; pdf_errors?: number; pdf_single?: number;
}

export interface CheckRun {
  id: string; trigger: 'schedule' | 'manual'; scope: CheckScope; scope_label: string; from: string; to: string;
  created_by: string; started_at: string; finished_at: string | null; status: 'running' | 'done' | 'error'; error: string;
  warnings: string[]; counts: CheckCounts; duration_s: number | null;
  progress?: { done: number; total: number; label: string };
  bills?: CheckBill[]; unknown?: UnknownMaster[]; unmapped?: UnmappedCode[]; truncated?: boolean;
}

/** 1 HĐĐT trong danh sách einvoice (không có thông tin người mua). status: GHI_TAM = nháp, DA_TIEP_NHAN = CQT đã chấp nhận */
export interface EinvoiceBill {
  id: string; code: string; template: string; series: string; number: number | null; date: string; status: string;
  status_display: string; payment: string; amount: number; amount_vat: number; total: number;
  verify_code?: string; cqt_code?: string;   // mã tra cứu + mã CQT (chỉ HĐ đã phát hành; bản lưu IndexedDB trước 28/10/2026 không có)
}

export interface SchedulerJob { name: string; label: string; time: string; next_at: string; last_result: string; }

export interface RunList {
  busy: string; check_time: string; einvoice_url: string; runs: CheckRun[];
  scheduler: { enabled: boolean; jobs: SchedulerJob[] };
}

export interface TaxRate {
  master_code: string; master_name: string; rate: string; source: 'manual' | 'output' | 'input' | ''; source_text: string;
  input: { rate: string; date: string; ky_hieu: string; so: string; seller_name: string; line_name: string } | null;
  manual: { rate: string; note: string; by: string; at: string } | null;
}

@Injectable({ providedIn: 'root' })
export class EinvoiceCheckService {
  private http = inject(HttpClient);
  private cache = inject(TienIchCacheService);

  listRuns(): Promise<RunList> {
    return firstValueFrom(this.http.get<RunList>(`${BASE}/runs`));
  }

  start(scope: CheckScope, from = '', to = ''): Promise<string> {
    return firstValueFrom(this.http.post<{ id: string }>(`${BASE}/runs`, { scope, from, to })).then(r => r.id);
  }

  /** Lần kiểm đã xong không đổi nữa → lưu IndexedDB (TienIchCacheService), xem lại không gọi máy chủ */
  async getRun(id: string): Promise<CheckRun & { einvoice_url: string }> {
    const key = `check-run:${id}`;
    const hit = await this.cache.get<CheckRun & { einvoice_url: string }>(key);
    if (hit) {
      console.log(`${LOG} Lần kiểm ${id}: dùng bản lưu trên máy`);
      return hit.data;
    }
    const run = await firstValueFrom(this.http.get<CheckRun & { einvoice_url: string }>(`${BASE}/runs/${encodeURIComponent(id)}`));
    if (run.status === 'done' || run.status === 'error') await this.cache.set(key, run);
    return run;
  }

  /** Xóa lần kiểm (cả thủ công lẫn lịch tự động) trên máy chủ + bản lưu trên máy; lần đang chạy máy chủ bỏ qua (`skipped`) */
  async deleteRuns(ids: string[]): Promise<{ deleted: string[]; skipped: string[] }> {
    const res = await firstValueFrom(this.http.post<{ deleted: string[]; skipped: string[] }>(`${BASE}/runs/delete`, { ids }));
    await Promise.all(res.deleted.map(id => this.cache.remove(`check-run:${id}`)));
    console.log(`${LOG} Đã xóa ${res.deleted.length} lần kiểm${res.skipped.length ? `, bỏ qua ${res.skipped.length} lần đang chạy` : ''}`);
    return res;
  }

  /** HĐĐT KiotViet mọi trạng thái [from, to] (≤ 92 ngày) — Kiểm tra số lượng HĐ đầu ra */
  listBills(from: string, to: string): Promise<{ count: number; einvoice_url: string; bills: EinvoiceBill[] }> {
    return firstValueFrom(this.http.get<{ count: number; einvoice_url: string; bills: EinvoiceBill[] }>(`${BASE}/bills`, { params: { from, to } }));
  }

  taxRates(): Promise<{ rates: TaxRate[]; valid: string[] }> {
    return firstValueFrom(this.http.get<{ rates: TaxRate[]; valid: string[] }>(`${BASE}/tax-rates`));
  }

  /** Kế toán xác nhận hàng loạt (≤ 5000 mã master) */
  setTaxRatesBulk(items: { master_code: string; master_name: string; rate: string }[]): Promise<{ saved: number; skipped: number }> {
    return firstValueFrom(this.http.put<{ saved: number; skipped: number }>(`${BASE}/tax-rates/bulk`, { items }));
  }

  /** rate rỗng = bỏ thuế suất kế toán đặt (về nguồn HĐ vào) */
  setTaxRate(master_code: string, master_name: string, rate: string, note = ''): Promise<{ rate: string; source: string; source_text: string }> {
    return firstValueFrom(this.http.put<{ rate: string; source: string; source_text: string }>(`${BASE}/tax-rates`,
      { master_code, master_name, rate, note }));
  }
}
