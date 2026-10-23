import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { httpErrorText } from '../../../services/auth.service';
import { ColumnType, TabPage, TabQuery } from '../../../services/reconciliation.service';
import { TableLoadingComponent } from '../table-loading/table-loading.component';

/** Nguồn dữ liệu của bảng: phân trang / tìm / sắp xếp / lọc / xuất đều làm ở BE (quy ước chung, plan-ketoan-flow mục 1). */
export interface ServerTableSource {
  /** Đổi id → bảng tự về trang 1, xóa bộ lọc */
  id: string;
  load(query: TabQuery): Observable<TabPage>;
  export?(format: 'xlsx' | 'csv', query: TabQuery): Promise<void>;
}

const LOG = '[ServerTable]';
const PAGE_SIZES = [20, 50, 100, 200, 500];
const NUMBER_FORMATS: { [fmt: string]: Intl.NumberFormat } = {};

@Component({
  selector: 'app-server-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './server-table.component.html',
  styleUrl: './server-table.component.css',
})
export class ServerTableComponent implements OnDestroy {
  readonly pageSizes = PAGE_SIZES;

  page: TabPage | null = null;
  loading = false;
  exporting = false;
  error = '';

  query: TabQuery = this.emptyQuery();
  filters: string[] = [];

  private _source: ServerTableSource | null = null;
  private reload$ = new Subject<void>();
  private loadSub?: Subscription;
  private reloadSub = this.reload$.pipe(debounceTime(400)).subscribe(() => {
    this.query.page = 1;
    this.load();
  });

  @Input() set source(value: ServerTableSource | null) {
    if (value?.id === this._source?.id) {
      return;
    }
    this._source = value;
    this.query = this.emptyQuery();
    this.filters = [];
    this.page = null;
    this.load();
  }

  get source(): ServerTableSource | null {
    return this._source;
  }

  get pageCount(): number {
    return this.page ? Math.max(1, Math.ceil(this.page.total / this.query.pageSize)) : 1;
  }

  ngOnDestroy(): void {
    this.reloadSub.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  /** Tìm kiếm / lọc: chờ ngừng gõ 0,4 giây rồi mới gọi BE */
  queueReload(): void {
    this.query.filters = Object.fromEntries(this.filters.map((v, i) => [String(i), v]).filter(([, v]) => v));
    this.reload$.next();
  }

  toggleSort(col: number): void {
    if (this.query.sort !== col) {
      this.query.sort = col;
      this.query.desc = false;
    } else if (!this.query.desc) {
      this.query.desc = true;
    } else {
      this.query.sort = null;
      this.query.desc = false;
    }
    this.query.page = 1;
    this.load();
  }

  goTo(page: number): void {
    const p = Math.min(Math.max(1, page), this.pageCount);
    if (p !== this.query.page) {
      this.query.page = p;
      this.load();
    }
  }

  changePageSize(size: number): void {
    this.query.pageSize = Number(size);
    this.query.page = 1;
    this.load();
  }

  async export(format: 'xlsx' | 'csv'): Promise<void> {
    if (!this._source?.export || this.exporting) return;
    this.exporting = true;
    this.error = '';
    try {
      await this._source.export(format, { ...this.query });
    } catch (e: any) {
      this.error = `Không xuất được file: ${e?.message || e}`;
      console.warn(`${LOG} ${this._source.id}: xuất ${format} lỗi — ${e?.message || e}`);
    } finally {
      this.exporting = false;
    }
  }

  width(i: number): number {
    const w = this.page?.widths?.[i] || 12;
    return Math.min(420, Math.round(w * 7 + 12));
  }

  type(i: number): ColumnType {
    return this.page?.types?.[i] || 'text';
  }

  /** Định dạng giống Excel của script: mã định dạng số theo cột, ngày dd/mm/yyyy */
  cell(row: any[], i: number): string {
    const v = row[i];
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(v)) {
      const [y, m, d] = v.slice(0, 10).split('-');
      return `${d}/${m}/${y}${v.length > 10 ? ' ' + v.slice(11, 16) : ''}`;
    }
    if (typeof v === 'number') {
      const fmt = this.page?.formats?.[String(i)];
      return fmt ? numberFormat(fmt).format(v) : String(v);
    }
    return String(v);
  }

  private load(): void {
    const source = this._source;
    if (!source) return;
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = '';
    const query = { ...this.query, filters: { ...this.query.filters } };
    this.loadSub = source.load(query).subscribe({
      next: page => {
        this.page = page;
        this.loading = false;
        if (this.filters.length !== page.headers.length) {
          this.filters = page.headers.map((_, i) => this.filters[i] || '');
        }
        console.debug(`${LOG} ${source.id}: trang ${page.page}, ${page.rows.length}/${page.total} dòng`);
      },
      error: e => {
        this.loading = false;
        this.error = `Không tải được dữ liệu: ${httpErrorText(e)}`;
        console.warn(`${LOG} ${source.id}: tải lỗi — ${httpErrorText(e)}`);
      }
    });
  }

  private emptyQuery(): TabQuery {
    return { page: 1, pageSize: 50, q: '', sort: null, desc: false, filters: {} };
  }
}

function numberFormat(fmt: string): Intl.NumberFormat {
  if (!NUMBER_FORMATS[fmt]) {
    const percent = fmt.endsWith('%');
    const decimals = (fmt.split('.')[1] || '').replace('%', '');
    const fixed = decimals.replace(/#/g, '').length;
    NUMBER_FORMATS[fmt] = new Intl.NumberFormat('vi-VN', {
      style: percent ? 'percent' : 'decimal',
      minimumFractionDigits: fixed,
      maximumFractionDigits: decimals.length,
      useGrouping: fmt.includes(','),
    });
  }
  return NUMBER_FORMATS[fmt];
}
