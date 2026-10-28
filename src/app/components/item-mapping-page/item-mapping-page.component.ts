import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { httpErrorText } from '../../services/auth.service';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';
import { formatVn } from '../../services/period.service';
import {
  CatalogItem, MappingEdit, ReconciliationRun, ReconciliationService, TabPage, TabQuery
} from '../../services/reconciliation.service';

const LOG = '[ItemMapping]';
const KEY = 'Khóa (không sửa)';

type ColKind = 'text' | 'num' | 'check' | 'master' | 'factor' | 'vietda' | 'vdfactor' | 'qty';
interface Col { header: string; label: string; kind: ColKind; width: number; filter?: boolean; vaoOnly?: boolean; }

/** Cột hiện trên trang (bảng BE có đủ cột MAP_HEADERS của script) */
const COLUMNS: Col[] = [
  { header: 'Đã kiểm (x)', label: 'Đã kiểm', kind: 'check', width: 60 },
  { header: 'Mã hàng (HĐ)', label: 'Mã hàng (HĐ)', kind: 'text', width: 110, filter: true },
  { header: 'Tên hàng (HĐ)', label: 'Tên hàng (HĐ)', kind: 'text', width: 280, filter: true },
  { header: 'ĐVT (HĐ)', label: 'ĐVT', kind: 'text', width: 60 },
  { header: 'Tên người bán', label: 'Người bán', kind: 'text', width: 180, filter: true, vaoOnly: true },
  { header: 'Số dòng', label: 'Số dòng', kind: 'num', width: 60 },
  { header: 'Tổng SL (HĐ)', label: 'Tổng SL', kind: 'num', width: 70 },
  { header: 'Mã master', label: 'Mã master', kind: 'master', width: 150, filter: true },
  { header: 'Tên master', label: 'Tên master', kind: 'text', width: 240 },
  { header: 'ĐVT master', label: 'ĐVT master', kind: 'text', width: 70 },
  { header: 'Hệ số quy đổi', label: 'Hệ số', kind: 'factor', width: 80 },
  { header: 'Tổng SL quy đổi', label: 'SL quy đổi', kind: 'qty', width: 80 },
  { header: 'Mã Vietda', label: 'Mã Vietda', kind: 'vietda', width: 110, filter: true },
  { header: 'Tên Vietda', label: 'Tên Vietda', kind: 'text', width: 200 },
  { header: 'ĐVT Vietda', label: 'ĐVT Vietda', kind: 'text', width: 70 },
  { header: 'Hệ số Vietda', label: 'Hệ số Vietda', kind: 'vdfactor', width: 90 },
  { header: 'Cách ghép', label: 'Cách ghép', kind: 'text', width: 130, filter: true },
  { header: 'Độ tin cậy', label: 'Tin cậy', kind: 'num', width: 60 },
  { header: 'Cần xem', label: 'Cần xem', kind: 'text', width: 300, filter: true },
  { header: 'Gợi ý khác', label: 'Gợi ý khác', kind: 'text', width: 260 },
  { header: 'Đã lưu', label: 'Đã lưu', kind: 'text', width: 60 },
];
/** Lọc nhanh theo nội dung cột "Cần xem" (cờ của script) */
const QUICK = [
  { label: 'Tất cả', value: '' },
  { label: 'Chưa ghép', value: 'chua ghep' },
  { label: 'Thiếu hệ số', value: 'thieu he so' },
  { label: 'Tin cậy thấp', value: 'tin cay thap' },
  { label: 'Lệch ĐVT', value: 'dvt' },
  { label: 'Thiếu hệ số Vietda', value: 'thieu he so vietda' },
];
const QTY_FMT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

/** "1.234,5" (kiểu Việt) hoặc "0.5" / "24" → số; trống → null; sai → NaN */
function parseFactor(text: string): number | null {
  const t = text.includes(',') ? text.trim().replace(/\./g, '').replace(',', '.') : text.trim();
  return t === '' ? null : (/^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN);
}

function sameFactor(a: number | null, b: number | null, tol: number): boolean {
  return a === b || (a !== null && b !== null && Math.abs(a - b) < tol);
}

const isBadFactor = (f: number | null) => f !== null && !(f > 0);

/**
 * TIỆN ÍCH — ÁNH XẠ HÀNG HÓA (plan-doi-soat-web.md bước 4)
 * Sửa Mã master / Hệ số / Mã Vietda / Đã kiểm của mặt hàng trên HĐ → lưu máy chủ → Chạy lại đối soát (không tải lại XML).
 */
@Component({
  selector: 'app-item-mapping-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TableLoadingComponent],
  templateUrl: './item-mapping-page.component.html',
  styleUrl: './item-mapping-page.component.css',
})
export class ItemMappingPageComponent implements OnInit {
  private service = inject(ReconciliationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly quick = QUICK;
  readonly pageSizes = [20, 50, 100, 200];

  runs: ReconciliationRun[] = [];
  run: ReconciliationRun | null = null;
  activeTab = 'anh-xa-dau-vao';
  page: TabPage | null = null;
  query: TabQuery = this.emptyQuery();
  filters: { [header: string]: string } = {};
  quickValue = '';
  col: { [header: string]: number } = {};

  /** khóa dòng → giá trị đang sửa (chưa lưu) */
  edits = new Map<string, MappingEdit>();
  factorText = new Map<string, string>();
  vdFactorText = new Map<string, string>();

  loading = false;
  saving = false;
  rerunning = false;
  error = '';
  message = '';

  searchKey: string | null = null;
  searchQ = '';
  searchItems: CatalogItem[] = [];
  searching = false;
  searchError = '';

  private reload$ = new Subject<void>();
  private loadSub?: Subscription;

  ngOnInit(): void {
    this.reload$.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.query.page = 1;
      this.load();
    });
    this.service.listRuns().subscribe({
      next: r => {
        this.runs = r.runs.filter(x => x.status === 'done');
        if (!this.route.snapshot.queryParamMap.get('run') && this.runs.length) {
          this.router.navigate([], { relativeTo: this.route, queryParams: { run: this.runs[0].id }, replaceUrl: true });
        }
      },
      error: e => this.error = `Không lấy được danh sách lần đối soát: ${httpErrorText(e)}`
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('run');
      if (id && id !== this.run?.id) this.openRun(id);
    });
    this.destroyRef.onDestroy(() => this.loadSub?.unsubscribe());
  }

  // ───────────────────────────── chuyển trang khi còn thay đổi chưa lưu

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.edits.size) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /** canDeactivate của route */
  canLeave(): boolean {
    return !this.edits.size || confirm(`Còn ${this.edits.size} dòng đã sửa CHƯA LƯU. Rời trang và bỏ các thay đổi?`);
  }

  // ───────────────────────────── lần chạy + bảng

  get columns(): Col[] {
    return COLUMNS.filter(c => !c.vaoOnly || this.activeTab === 'anh-xa-dau-vao');
  }

  get pageCount(): number {
    return this.page ? Math.max(1, Math.ceil(this.page.total / this.query.pageSize)) : 1;
  }

  get invalidCount(): number {
    return [...this.edits.values()].filter(e => isBadFactor(e.he_so) || isBadFactor(e.he_so_vietda)).length;
  }

  tabCount(key: string): number {
    return this.run?.mapping_tabs?.find(t => t.key === key)?.count ?? 0;
  }

  formatDate(iso: string): string {
    return iso ? formatVn(iso.slice(0, 10)) + (iso.length > 10 ? ' ' + iso.slice(11, 16) : '') : '';
  }

  selectRun(id: string): void {
    if (id === this.run?.id || !this.canLeave()) return;
    this.edits.clear();
    this.factorText.clear();
    this.vdFactorText.clear();
    this.router.navigate([], { relativeTo: this.route, queryParams: { run: id } });
  }

  private openRun(id: string): void {
    console.info(`${LOG} Mở bảng ánh xạ của lần chạy ${id}`);
    this.error = '';
    this.message = '';
    this.service.getRun(id).subscribe({
      next: run => {
        this.run = run;
        if (run.status !== 'done') {
          this.error = run.status === 'error' ? `Lần đối soát này bị lỗi: ${run.error}` : 'Lần đối soát này chưa chạy xong.';
          this.page = null;
          return;
        }
        if (!run.mapping_tabs?.length) {
          this.error = 'Lần đối soát này chạy trước khi có trang Ánh xạ — đối soát lại rồi mở trang này.';
          this.page = null;
          return;
        }
        this.selectTab(this.activeTab);
      },
      error: e => this.error = `Không mở được lần đối soát: ${httpErrorText(e)}`
    });
  }

  selectTab(key: string): void {
    this.activeTab = key;
    this.query = this.emptyQuery();
    this.filters = {};
    this.quickValue = '';
    this.searchKey = null;
    this.load();
  }

  setQuick(value: string): void {
    this.quickValue = value;
    this.filters['Cần xem'] = value;
    this.queueReload();
  }

  queueReload(): void {
    this.reload$.next();
  }

  toggleSort(c: Col): void {
    const i = this.col[c.header];
    if (i === undefined || c.kind === 'check') return;
    if (this.query.sort !== i) {
      this.query.sort = i;
      this.query.desc = false;
    } else if (!this.query.desc) {
      this.query.desc = true;
    } else {
      this.query.sort = null;
    }
    this.query.page = 1;
    this.load();
  }

  goTo(p: number): void {
    const page = Math.min(Math.max(1, p), this.pageCount);
    if (page !== this.query.page) {
      this.query.page = page;
      this.load();
    }
  }

  changePageSize(size: number): void {
    this.query.pageSize = Number(size);
    this.query.page = 1;
    this.load();
  }

  private load(): void {
    const run = this.run;
    if (!run) return;
    this.loadSub?.unsubscribe();
    this.loading = true;
    const filters: { [col: string]: string } = {};
    // col chỉ có sau lần tải đầu → lần đầu không lọc (filters luôn rỗng lúc đó)
    for (const [header, value] of Object.entries(this.filters)) {
      if (value && this.col[header] !== undefined) filters[String(this.col[header])] = value;
    }
    this.loadSub = this.service.getTab(run.id, this.activeTab, { ...this.query, filters }).subscribe({
      next: page => {
        this.page = page;
        this.col = Object.fromEntries(page.headers.map((h, i) => [h, i]));
        this.loading = false;
      },
      error: e => {
        this.loading = false;
        this.error = `Không tải được bảng ánh xạ: ${httpErrorText(e)}`;
      }
    });
  }

  private emptyQuery(): TabQuery {
    return { page: 1, pageSize: 50, q: '', sort: null, desc: false, filters: {} };
  }

  // ───────────────────────────── giá trị ô + sửa

  key(row: any[]): string {
    return row[this.col[KEY]];
  }

  raw(row: any[], header: string): any {
    return row[this.col[header]];
  }

  /** Giá trị hiển thị (đã tính phần đang sửa) */
  text(row: any[], c: Col): string {
    const e = this.edits.get(this.key(row));
    if (c.kind === 'qty') {
      const factor = e ? e.he_so : this.raw(row, 'Hệ số quy đổi');
      const total = this.raw(row, 'Tổng SL (HĐ)');
      const v = e ? (factor && factor > 0 && typeof total === 'number' ? total * factor : null) : this.raw(row, c.header);
      return v === null || v === undefined || v === '' ? '' : QTY_FMT.format(v);
    }
    if (e && (c.header === 'Tên master' || c.header === 'ĐVT master') && e.ma_master !== (this.raw(row, 'Mã master') || '')) {
      return c.header === 'Tên master' ? '(lưu rồi chạy lại để cập nhật)' : '';
    }
    const v = this.raw(row, c.header);
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return c.header === 'Độ tin cậy' ? v.toFixed(2) : QTY_FMT.format(v);
    return String(v);
  }

  current(row: any[]): MappingEdit {
    return this.edits.get(this.key(row)) ?? this.fromRow(row);
  }

  /** Giá trị đang lưu của dòng (chưa tính phần đang sửa) */
  private fromRow(row: any[]): MappingEdit {
    const num = (v: any) => typeof v === 'number' ? v : (v ? Number(v) : null);
    return {
      key: this.key(row),
      ma_master: this.raw(row, 'Mã master') || '',
      he_so: num(this.raw(row, 'Hệ số quy đổi')),
      ma_vietda: this.raw(row, 'Mã Vietda') || '',
      he_so_vietda: num(this.raw(row, 'Hệ số Vietda')),
      da_kiem: String(this.raw(row, 'Đã kiểm (x)') || '').trim().toLowerCase() === 'x',
    };
  }

  isEdited(row: any[]): boolean {
    return this.edits.has(this.key(row));
  }

  factorValue(row: any[]): string {
    const k = this.key(row);
    if (this.factorText.has(k)) return this.factorText.get(k)!;
    const f = this.current(row).he_so;
    return f === null || f === undefined ? '' : String(f).replace('.', ',');
  }

  isFactorInvalid(row: any[]): boolean {
    const e = this.edits.get(this.key(row));
    return !!e && isBadFactor(e.he_so);
  }

  /** Hệ số Vietda máy gợi ý có thể là 1/48 → hiện tối đa 6 số lẻ */
  vdFactorValue(row: any[]): string {
    const k = this.key(row);
    if (this.vdFactorText.has(k)) return this.vdFactorText.get(k)!;
    const f = this.current(row).he_so_vietda;
    return f === null || f === undefined ? '' : String(Number(f.toFixed(6))).replace('.', ',');
  }

  isVdFactorInvalid(row: any[]): boolean {
    const e = this.edits.get(this.key(row));
    return !!e && isBadFactor(e.he_so_vietda);
  }

  setVdFactor(row: any[], text: string): void {
    this.vdFactorText.set(this.key(row), text);
    this.update(row, { he_so_vietda: parseFactor(text) });
  }

  setMaster(row: any[], value: string): void {
    this.update(row, { ma_master: value.trim() });
  }

  setVietda(row: any[], value: string): void {
    this.update(row, { ma_vietda: value.trim() });
  }

  setChecked(row: any[], value: boolean): void {
    this.update(row, { da_kiem: value });
  }

  setFactor(row: any[], text: string): void {
    this.factorText.set(this.key(row), text);
    this.update(row, { he_so: parseFactor(text) });
  }

  private update(row: any[], patch: Partial<MappingEdit>): void {
    const k = this.key(row);
    const next: MappingEdit = { ...this.current(row), ...patch };
    const orig = this.fromRow(row);
    // Hệ số Vietda hiện 6 số lẻ (1/48 = 0,020833) → sai số hiển thị không tính là sửa
    const same = next.ma_master === orig.ma_master && next.ma_vietda === orig.ma_vietda && next.da_kiem === orig.da_kiem
      && sameFactor(next.he_so, orig.he_so, 1e-9) && sameFactor(next.he_so_vietda, orig.he_so_vietda, 1e-6);
    if (same) {
      this.edits.delete(k);
      this.factorText.delete(k);
      this.vdFactorText.delete(k);
    } else {
      this.edits.set(k, next);
    }
    this.message = '';
  }

  /** Hoàn tác 1 dòng về giá trị đang lưu */
  revert(row: any[]): void {
    const k = this.key(row);
    this.edits.delete(k);
    this.factorText.delete(k);
    this.vdFactorText.delete(k);
  }

  discard(): void {
    if (this.edits.size && !confirm(`Bỏ ${this.edits.size} dòng đã sửa chưa lưu?`)) return;
    console.info(`${LOG} Bỏ ${this.edits.size} thay đổi chưa lưu`);
    this.edits.clear();
    this.factorText.clear();
    this.vdFactorText.clear();
  }

  save(): void {
    const run = this.run;
    if (!run || !this.edits.size || this.saving) return;
    if (this.invalidCount) {
      this.error = `Có ${this.invalidCount} dòng Hệ số / Hệ số Vietda không hợp lệ (phải là số > 0, để trống = chưa ánh xạ).`;
      console.warn(`${LOG} Không lưu: ${this.invalidCount} hệ số không hợp lệ`);
      return;
    }
    this.saving = true;
    this.error = '';
    const edits = [...this.edits.values()];
    this.service.saveMapping(run.id, edits).subscribe({
      next: r => {
        this.saving = false;
        this.edits.clear();
        this.factorText.clear();
        this.vdFactorText.clear();
        this.message = `Đã lưu ${edits.length} dòng (${r.saved} dòng giữ lại cho lần sau${r.removed ? `, ${r.removed} dòng trở về gợi ý của máy` : ''}). `
          + 'Bấm "Chạy lại đối soát" để cập nhật kết quả.';
        this.load();
      },
      error: e => {
        this.saving = false;
        this.error = `Không lưu được: ${httpErrorText(e)}`;
      }
    });
  }

  rerun(): void {
    const run = this.run;
    if (!run || this.rerunning) return;
    if (this.edits.size) {
      this.error = `Còn ${this.edits.size} dòng đã sửa chưa lưu — bấm Lưu trước khi chạy lại.`;
      return;
    }
    this.rerunning = true;
    this.service.rerun(run.id).subscribe({
      next: id => {
        this.rerunning = false;
        this.router.navigate(['/invoice-reconciliation-page'], { queryParams: { run: id } });
      },
      error: e => {
        this.rerunning = false;
        this.error = `Không chạy lại được: ${httpErrorText(e)}`;
      }
    });
  }

  // ───────────────────────────── tìm mã master

  openSearch(row: any[]): void {
    const k = this.key(row);
    if (this.searchKey === k) {
      this.searchKey = null;
      return;
    }
    this.searchKey = k;
    this.searchQ = String(this.raw(row, 'Tên hàng (HĐ)') || '');
    this.searchItems = [];
    this.runSearch();
  }

  runSearch(): void {
    const q = this.searchQ.trim();
    if (q.length < 2) return;
    this.searching = true;
    this.searchError = '';
    this.service.searchCatalog(q).subscribe({
      next: items => {
        this.searching = false;
        this.searchItems = items;
      },
      error: e => {
        this.searching = false;
        this.searchError = httpErrorText(e);
      }
    });
  }

  /** Chọn mã master (+ hệ số của ĐVT được chọn nếu bấm vào ĐVT) */
  pick(row: any[], item: CatalogItem, conversion?: number): void {
    const patch: Partial<MappingEdit> = { ma_master: item.code };
    if (conversion !== undefined) {
      patch.he_so = conversion;
      this.factorText.delete(this.key(row));
    }
    this.update(row, patch);
    this.searchKey = null;
  }
}
