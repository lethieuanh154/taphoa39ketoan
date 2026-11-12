/**
 * BẢNG ĐỐI SOÁT CK dùng chung 2 tab Bán ra / Mua vào (13/11/2026 — "table Mua vào giống Bán ra").
 * Dữ liệu: ReconViewRow (utils/recon-view.util.ts). Chip lọc theo `tags`, ô tìm kiếm, sắp "Lệch lên đầu" / số tiền, phân trang.
 * Màu dòng: tone ok (xanh) / warn (vàng) / bad (đỏ) — giống bảng Đối soát cũ.
 */
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReconChip, ReconViewRow } from '../../../utils/recon-view.util';

type SortMode = 'issues' | 'amountDesc' | 'amountAsc';
const TONE_RANK = { bad: 0, warn: 1, ok: 2 } as const;

@Component({
  selector: 'app-recon-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recon-table.component.html',
  styleUrl: './recon-table.component.css'
})
export class ReconTableComponent implements OnChanges {
  @Input() rows: ReconViewRow[] = [];
  @Input() chips: ReconChip[] = [];
  /** Tiêu đề cột đối tác HĐ: "Người mua" (bán ra) / "NCC" (mua vào) */
  @Input() partyLabel = 'Đối tác';
  @Input() emptyText = 'Không có dữ liệu.';

  filter = '';
  q = '';
  sortMode: SortMode = 'issues';
  page = 1;
  pageSize = 200;
  readonly pageSizes = [100, 200, 500, 1000];

  view: ReconViewRow[] = [];
  private counts = new Map<string, number>();

  ngOnChanges(): void {
    this.counts.clear();
    for (const c of this.chips) this.counts.set(c.key, c.key ? this.rows.filter(r => r.tags.includes(c.key)).length : this.rows.length);
    this.rebuild();
  }

  countOf(key: string): number { return this.counts.get(key) ?? 0; }

  setFilter(key: string): void {
    this.filter = key;
    this.rebuild();
  }

  onSearch(): void { this.rebuild(); }

  toggleSort(): void {
    this.sortMode = this.sortMode === 'issues' ? 'amountDesc' : this.sortMode === 'amountDesc' ? 'amountAsc' : 'issues';
    this.rebuild();
  }

  get sortIcon(): string {
    return this.sortMode === 'issues' ? 'fa-triangle-exclamation' : this.sortMode === 'amountAsc' ? 'fa-caret-up' : 'fa-caret-down';
  }
  get sortLabel(): string { return this.sortMode === 'issues' ? 'Lệch lên đầu' : 'Số tiền'; }

  private rebuild(): void {
    const q = this.q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    let rows = this.filter ? this.rows.filter(r => r.tags.includes(this.filter)) : [...this.rows];
    if (q) rows = rows.filter(r => r.text.includes(q));
    if (this.sortMode === 'issues') rows.sort((a, b) => (TONE_RANK[a.tone] - TONE_RANK[b.tone]) || (b.amount - a.amount));
    else {
      const dir = this.sortMode === 'amountAsc' ? 1 : -1;
      rows.sort((a, b) => (a.amount - b.amount) * dir);
    }
    this.view = rows;
    this.page = 1;
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.view.length / this.pageSize)); }
  get pageRows(): ReconViewRow[] {
    const s = (this.page - 1) * this.pageSize;
    return this.view.slice(s, s + this.pageSize);
  }
  goPage(p: number): void { this.page = Math.min(Math.max(1, p), this.pageCount); }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN') + ' ₫';
  }
  daysText(d: number | null): string { return d === null ? '' : d === 0 ? 'cùng ngày' : `${d > 0 ? '+' : ''}${d} ngày`; }
}
