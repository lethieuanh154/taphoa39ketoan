import { Injectable, computed, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * KỲ KẾ TOÁN DÙNG CHUNG (thanh chọn kỳ ở MainLayout — plan-ketoan-flow.md mục 1)
 * Hôm nay · Tuần này · Tháng · Quý · Năm · Từ ngày – đến ngày.
 * Ngày lưu dạng 'YYYY-MM-DD' theo giờ máy (VN), `to` là ngày cuối kỳ (tính cả ngày đó).
 */
export type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface AccountingPeriod {
  type: PeriodType;
  from: string;
  to: string;
}

const LOG = '[Period]';
const STORAGE_KEY = 'ketoan_period';
const TYPES: PeriodType[] = ['today', 'week', 'month', 'quarter', 'year', 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly state = signal<AccountingPeriod>(this.load());

  readonly period = this.state.asReadonly();
  readonly period$ = toObservable(this.state);
  readonly label = computed(() => periodLabel(this.state()));

  /** Hôm nay / Tuần này: luôn tính theo ngày hiện tại. Tháng / Quý / Năm: theo ngày đầu kỳ đang chọn. */
  selectPreset(type: PeriodType): void {
    if (type === 'custom') {
      const { from, to } = this.state();
      this.set({ type, from, to });
      return;
    }
    const anchor = type === 'today' || type === 'week' ? new Date() : parseIso(this.state().from);
    this.set(buildPeriod(type, anchor));
  }

  setMonth(year: number, month: number): void {
    this.set(buildPeriod('month', new Date(year, month - 1, 1)));
  }

  setQuarter(year: number, quarter: number): void {
    this.set(buildPeriod('quarter', new Date(year, (quarter - 1) * 3, 1)));
  }

  setYear(year: number): void {
    this.set(buildPeriod('year', new Date(year, 0, 1)));
  }

  /** Trả về lý do lỗi (để hiện cho người dùng) hoặc null nếu đã áp dụng. */
  setCustom(from: string, to: string): string | null {
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      console.warn(`${LOG} Từ ngày – đến ngày không hợp lệ: "${from}" – "${to}"`);
      return 'Chọn đủ Từ ngày và Đến ngày';
    }
    if (from > to) {
      console.warn(`${LOG} Từ ngày ${from} sau Đến ngày ${to} → không áp dụng`);
      return 'Từ ngày phải trước hoặc bằng Đến ngày';
    }
    this.set({ type: 'custom', from, to });
    return null;
  }

  /** Kỳ trước (-1) / kỳ sau (+1), giữ nguyên loại kỳ. */
  shift(step: 1 | -1): void {
    const { type, from, to } = this.state();
    const start = parseIso(from);
    switch (type) {
      case 'today':
        start.setDate(start.getDate() + step);
        break;
      case 'week':
        start.setDate(start.getDate() + 7 * step);
        break;
      case 'month':
        start.setMonth(start.getMonth() + step);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() + 3 * step);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() + step);
        break;
      case 'custom': {
        const days = dayDiff(from, to) + 1;
        const end = parseIso(to);
        start.setDate(start.getDate() + days * step);
        end.setDate(end.getDate() + days * step);
        this.set({ type, from: toIso(start), to: toIso(end) });
        return;
      }
    }
    this.set(buildPeriod(type, start));
  }

  /** Ngày (Date hoặc chuỗi bắt đầu bằng 'YYYY-MM-DD') có nằm trong kỳ đang chọn không. */
  contains(date: Date | string | null | undefined): boolean {
    if (!date) return false;
    const iso = typeof date === 'string' ? date.slice(0, 10) : toIso(date);
    const { from, to } = this.state();
    return iso >= from && iso <= to;
  }

  private set(next: AccountingPeriod): void {
    const prev = this.state();
    if (prev.type === next.type && prev.from === next.from && prev.to === next.to) return;
    this.state.set(next);
    console.info(`${LOG} Đổi kỳ: ${periodLabel(next)} (${next.from} → ${next.to})`);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn(`${LOG} Không lưu được kỳ vào localStorage:`, e);
    }
  }

  private load(): AccountingPeriod {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (TYPES.includes(data?.type) && ISO_DATE.test(data?.from) && ISO_DATE.test(data?.to) && data.from <= data.to) {
          return { type: data.type, from: data.from, to: data.to };
        }
        console.warn(`${LOG} Kỳ đã lưu không hợp lệ → dùng tháng hiện tại`, data);
      }
    } catch (e) {
      console.warn(`${LOG} Không đọc được kỳ đã lưu → dùng tháng hiện tại:`, e);
    }
    return buildPeriod('month', new Date());
  }
}

export function buildPeriod(type: Exclude<PeriodType, 'custom'>, anchor: Date): AccountingPeriod {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  switch (type) {
    case 'today':
      return { type, from: toIso(anchor), to: toIso(anchor) };
    case 'week': {
      // Tuần bắt đầu thứ Hai
      const start = new Date(y, m, anchor.getDate() - ((anchor.getDay() + 6) % 7));
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { type, from: toIso(start), to: toIso(end) };
    }
    case 'month':
      return { type, from: toIso(new Date(y, m, 1)), to: toIso(new Date(y, m + 1, 0)) };
    case 'quarter': {
      const q = Math.floor(m / 3);
      return { type, from: toIso(new Date(y, q * 3, 1)), to: toIso(new Date(y, q * 3 + 3, 0)) };
    }
    case 'year':
      return { type, from: toIso(new Date(y, 0, 1)), to: toIso(new Date(y, 11, 31)) };
  }
}

export function periodLabel(p: AccountingPeriod): string {
  const start = parseIso(p.from);
  const y = start.getFullYear();
  switch (p.type) {
    case 'today':
      return p.from === toIso(new Date()) ? `Hôm nay ${formatVn(p.from)}` : `Ngày ${formatVn(p.from)}`;
    case 'week':
      return `Tuần ${formatVn(p.from, false)} – ${formatVn(p.to)}`;
    case 'month':
      return `Tháng ${start.getMonth() + 1}/${y}`;
    case 'quarter':
      return `Quý ${Math.floor(start.getMonth() / 3) + 1}/${y}`;
    case 'year':
      return `Năm ${y}`;
    case 'custom':
      return `${formatVn(p.from)} – ${formatVn(p.to)}`;
  }
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (hoặc 'DD/MM' khi withYear = false). */
export function formatVn(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}
