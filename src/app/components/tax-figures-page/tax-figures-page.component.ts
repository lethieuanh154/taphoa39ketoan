import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { httpErrorText } from '../../services/auth.service';
import { PeriodService } from '../../services/period.service';
import {
  CompareRow, ReconciliationRun, ReconciliationService, TaxFigures, TkRow, TncnFigures, TncnRow
} from '../../services/reconciliation.service';
import { ServerTableComponent, ServerTableSource } from '../shared/server-table/server-table.component';

/**
 * SỐ LIỆU KHAI THUẾ (Tiện ích, mục cuối — bước 5, 23/10/2026): chỉ hiện con số để copy / paste vào HTKK, không xuất tờ khai.
 * - 01/GTGT ([21]–[43]) + PL 142, bảng kê 01-1 mua vào / bán ra: từ 1 lần Đối soát hóa đơn XML (doi_soat.tax_figures).
 * - 05/KK-TNCN: từ bảng lương trong thư mục đối soát, hoặc tải file bảng lương lên (theo kỳ đang chọn).
 * Nút copy = số thuần (không dấu chấm). [22] sửa được → tính lại [40a] [40] [41] [43] ngay trên trang.
 */
const LOG = '[TaxFigures]';
const V22_KEY = 'ketoan_v22_';

type View = 'gtgt' | 'pl142' | 'bk-ra' | 'bk-vao' | 'tncn';

@Component({
  selector: 'app-tax-figures-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ServerTableComponent],
  templateUrl: './tax-figures-page.component.html',
  styleUrls: ['./tax-figures-page.component.css']
})
export class TaxFiguresPageComponent implements OnInit {
  private service = inject(ReconciliationService);
  private periodService = inject(PeriodService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly period = this.periodService.period;
  readonly periodLabel = this.periodService.label;

  runs: ReconciliationRun[] = [];
  runId = '';
  fig: TaxFigures | null = null;
  loading = false;
  error = '';
  msg = '';
  view: View = 'gtgt';

  // [22] sửa được
  v22 = 0;
  tk: { [code: string]: number } = {};

  // PL142 / bảng kê
  plView: 'pl1' | 'pl2' = 'pl1';
  tableSource: ServerTableSource | null = null;

  // TNCN tải file
  payrollFile: File | null = null;
  tncnXml: File[] = [];
  tncnUploaded: TncnFigures | null = null;
  tncnBusy = false;

  ngOnInit(): void {
    this.loadRuns();
  }

  async loadRuns(): Promise<void> {
    try {
      const r = await firstValueFrom(this.service.listRuns());
      this.runs = r.runs.filter(x => x.status === 'done');
      const want = this.route.snapshot.queryParamMap.get('run');
      const id = (want && this.runs.some(x => x.id === want)) ? want : this.runs[0]?.id;
      console.log(`${LOG} ${this.runs.length} lần đối soát xong${id ? `, mở ${id}` : ''}`);
      if (id) await this.openRun(id);
    } catch (e: any) {
      console.error(`${LOG} Không tải được danh sách lần đối soát: ${httpErrorText(e)}`);
      this.error = `Không tải được danh sách lần đối soát: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  async openRun(id: string): Promise<void> {
    this.runId = id;
    this.loading = true;
    this.error = '';
    this.msg = '';
    try {
      this.fig = await this.service.getFigures(id);
      const saved = Number(this.readLocal(V22_KEY + id));
      this.v22 = Number.isFinite(saved) && this.readLocal(V22_KEY + id) !== null ? saved : (this.fig.tax?.v22 ?? 0);
      this.recalc();
      this.router.navigate([], { queryParams: { run: id }, replaceUrl: true });
      this.setView(this.view);
      console.log(`${LOG} ${id}: [22] ${this.v22}, [40] ${this.tk['40']}, [43] ${this.tk['43']}, TNCN ${this.fig.tncn ? 'có' : 'không'}`);
    } catch (e: any) {
      console.error(`${LOG} Không đọc được số liệu ${id}: ${httpErrorText(e)}`);
      this.error = `Không đọc được số liệu: ${e?.error?.detail || httpErrorText(e)}`;
      this.fig = null;
    } finally {
      this.loading = false;
    }
  }

  get run(): ReconciliationRun | undefined {
    return this.runs.find(r => r.id === this.runId);
  }

  runLabel(r: ReconciliationRun): string {
    const s = r.summary;
    const t = new Date(r.created_at);
    const when = isNaN(t.getTime()) ? r.created_at : `${t.toLocaleDateString('vi-VN')} ${t.toTimeString().slice(0, 5)}`;
    return `${s?.period || '?'} — đối soát lúc ${when}${r.folder_name ? ' · ' + r.folder_name : ''}${r.source_run ? ' (chạy lại)' : ''}`;
  }

  /** Kỳ của lần đối soát khác kỳ đang chọn trên thanh chọn kỳ → nhắc */
  get periodMismatch(): boolean {
    const s = this.run?.summary;
    const p = this.period();
    return !!s && (s.from !== p.from || s.to !== p.to);
  }

  setView(v: View): void {
    this.view = v;
    const key = v === 'bk-ra' ? 'bang-ke-ban-ra' : v === 'bk-vao' ? 'bang-ke-mua-vao'
      : v === 'pl142' ? (this.plView === 'pl1' ? 'pl142-mua-vao' : 'pl142-ban-ra') : '';
    const tab = this.fig?.tax_tabs.find(t => t.key === key);
    const id = this.runId;
    this.tableSource = tab ? {
      id: `${id}/${key}`,
      load: q => this.service.getTab(id, key, q),
      export: (format, q) => this.service.exportTab(id, key, tab.title, format, q),
    } : null;
  }

  setPl(v: 'pl1' | 'pl2'): void {
    this.plView = v;
    this.setView('pl142');
  }

  // ===== 01/GTGT: [22] → [40a] [40] [41] [43] (doi_soat.compute_tax) =====
  recalc(): void {
    const base = { ...(this.fig?.tax?.tk || {}) };
    const n = (c: string) => Number(base[c] || 0);
    base['22'] = Math.round(this.v22 || 0);
    const x = n('36') - base['22'] + n('37') - n('38') - n('39a');
    base['40a'] = x > 0 ? x : 0;
    base['40'] = base['40a'] - n('40b');
    base['41'] = x < 0 ? -x : 0;
    base['43'] = base['41'] - n('42');
    this.tk = base;
  }

  onV22(): void {
    this.recalc();
    this.writeLocal(V22_KEY + this.runId, String(this.v22 || 0));
    console.log(`${LOG} [22] = ${this.v22} → [40] ${this.tk['40']}, [43] ${this.tk['43']}`);
  }

  resetV22(): void {
    this.v22 = this.fig?.tax?.v22 ?? 0;
    this.removeLocal(V22_KEY + this.runId);
    this.recalc();
  }

  get v22Source(): string {
    const t = this.fig?.tax;
    if (!t) return '';
    if (this.readLocal(V22_KEY + this.runId) !== null) return 'kế toán nhập trên trang này';
    if (t.prev_file && t.v22) return `[43] tờ khai kỳ trước (${t.prev_file})`;
    if (t.same_file && t.v22) return `tờ khai cùng kỳ đã nộp (${t.same_file})`;
    return 'chưa có — nhập [43] của tờ khai kỳ trước, hoặc để XML tờ khai kỳ trước trong thư mục đối soát';
  }

  /** So với tờ khai đã nộp, theo mã (đã tính lại theo [22] đang nhập) */
  compareOf(code: string | null): { paid: number | null; verdict: string; ok: boolean } | null {
    const rows = this.fig?.tax?.compare;
    if (!code || !rows) return null;
    const r = rows.find(x => x[0] === `[${code}]`);
    if (!r) return null;
    const paid = r[1];
    const mine = this.tk[code] ?? 0;
    const diff = mine - (paid || 0);
    const verdict = Math.abs(diff) < 0.5 ? 'Khớp' : Math.abs(diff) <= 5 ? `Lệch làm tròn (${this.vnd(diff)})` : `LỆCH ${this.vnd(diff)}`;
    return { paid, verdict, ok: Math.abs(diff) < 0.5 };
  }

  get otherCompare(): CompareRow[] {
    return (this.fig?.tax?.compare || []).filter(r => !r[0].startsWith('['));
  }

  get replAdj(): { label: string; n: number; base: number; tax: number }[] {
    const a = this.fig?.tax?.repl_adj || {};
    const name: { [k: string]: string } = {
      VAO_tru: 'HĐ vào thay thế khác kỳ — TRỪ', VAO_cong: 'HĐ vào thay thế khác kỳ — CỘNG',
      RA_tru: 'HĐ ra thay thế khác kỳ — TRỪ', RA_cong: 'HĐ ra thay thế khác kỳ — CỘNG'
    };
    return Object.entries(a).map(([k, v]) => ({ label: name[k] || k, n: v[0], base: v[1], tax: v[2] }));
  }

  // ===== TNCN =====
  get tncn(): TncnFigures | null {
    return this.tncnUploaded || this.fig?.tncn || null;
  }

  get tncnRows(): TncnRow[] {
    return this.tncnUploaded?.tncn_rows || this.fig?.tncn_rows || [];
  }

  tncnCompare(code: string): CompareRow | undefined {
    const label = code === '25_1' ? '[25.1]' : `[${code}]`;
    return this.tncn?.compare?.find(r => r[0] === label);
  }

  onPayroll(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.payrollFile = input.files?.[0] || null;
    input.value = '';
  }

  onTncnXml(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.tncnXml = Array.from(input.files || []);
    input.value = '';
  }

  async calcTncn(): Promise<void> {
    if (!this.payrollFile) return;
    const p = this.period();
    console.log(`${LOG} Tính TNCN ${p.from} → ${p.to}: bảng lương ${this.payrollFile.name} (${this.payrollFile.size} byte), ${this.tncnXml.length} XML tờ khai (${this.tncnXml.map(f => f.size).join(', ')} byte)`);
    this.tncnBusy = true;
    this.error = '';
    try {
      this.tncnUploaded = await this.service.tncnFromPayroll(this.payrollFile, p.from, p.to, this.tncnXml);
      console.log(`${LOG} TNCN ${this.tncnUploaded.period.label} từ ${this.payrollFile.name}: [16] ${this.tncnUploaded.tk['16']}, [21] ${this.tncnUploaded.tk['21']}`);
    } catch (e: any) {
      console.error(`${LOG} Tính TNCN lỗi: ${httpErrorText(e)}`);
      this.error = `Không tính được TNCN: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.tncnBusy = false;
    }
  }

  // ===== copy / tải =====
  async copy(v: number | null | undefined, code: string): Promise<void> {
    const text = String(Math.round(Number(v || 0)));
    try {
      await navigator.clipboard.writeText(text);
      this.msg = `Đã copy [${code}] = ${text}`;
    } catch (e: any) {
      console.warn(`${LOG} Không copy được [${code}]: ${e?.message || e}`);
      this.msg = `Không copy được — chọn số và Ctrl+C: ${text}`;
    }
  }

  async downloadBangKe(): Promise<void> {
    try {
      await this.service.downloadBangKe(this.runId);
    } catch (e: any) {
      this.error = `Không tải được bảng kê: ${e?.message || e}`;
    }
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN');
  }

  isCount(unit: string): boolean {
    return (unit || '').toLowerCase().startsWith('người');
  }

  private readLocal(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  }

  private writeLocal(k: string, v: string): void {
    try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ }
  }

  private removeLocal(k: string): void {
    try { localStorage.removeItem(k); } catch { /* chế độ riêng tư */ }
  }
}
