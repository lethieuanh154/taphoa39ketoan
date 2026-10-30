import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { httpErrorText } from '../../services/auth.service';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';
import {
  BillLevel, CheckBill, CheckIssue, CheckRun, EinvoiceCheckService, PdfStatus, RunList, TaxRate, UnknownMaster
} from '../../services/einvoice-check.service';

/**
 * KIỂM TRA HĐ TỰ ĐỘNG (Tiện ích) — kết quả kiểm HĐ đầu ra nháp trên HĐĐT KiotViet trước khi phát hành
 * (plan-ketoan-flow.md bước 4). Máy chủ tự kiểm lúc 00:00 hằng ngày; nút "Kiểm tra ngay"; chỉ xem trên page, không gửi
 * thông báo. Kế toán đặt "thuế suất đúng" cho mã master ngay tại dòng bị báo hoặc ở tab Thuế suất đúng.
 */
const LOG = '[InvoiceCheck]';
const POLL_MS = 1500;

type View = 'issues' | 'all' | 'unknown' | 'unmapped' | 'rates';

@Component({
  selector: 'app-invoice-check-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './invoice-check-page.component.html',
  styleUrls: ['./invoice-check-page.component.css']
})
export class InvoiceCheckPageComponent implements OnInit {
  private service = inject(EinvoiceCheckService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  list: RunList | null = null;
  run: CheckRun | null = null;
  einvoiceUrl = '';
  loadingRun = false;
  /** đang mở lần kiểm KHÁC lần đang xem → phủ vòng xoay lên kết quả cũ */
  switchingRun = false;
  loadingRates = false;
  error = '';
  msg = '';

  // Kiểm tra ngay — chỉ HĐ nháp (23/10/2026: bỏ kiểm HĐ đã phát hành)
  starting = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  // Kết quả
  view: View = 'issues';
  levelFilter: '' | BillLevel = '';
  q = '';
  page = 1;
  readonly pageSize = 100;

  // Thuế suất đúng
  rates: TaxRate[] = [];
  validRates: string[] = ['0%', '5%', '8%', '10%', 'KCT', 'KKKNT', 'KHAC'];
  ratesLoaded = false;
  rateQ = '';
  ratePage = 1;
  /** mã master → thuế suất đang chọn trong ô (chưa lưu) */
  rateDraft: { [master: string]: string | undefined } = {};
  savingRate = '';

  readonly levelLabel: Record<BillLevel, string> = { error: 'Lỗi', warn: 'Cảnh báo', info: 'Lưu ý', ok: 'Không lỗi' };
  readonly levelChips: { value: '' | BillLevel; label: string }[] = [
    { value: '', label: 'Tất cả' }, { value: 'error', label: 'Lỗi' }, { value: 'warn', label: 'Cảnh báo' }, { value: 'ok', label: 'Không lỗi' }];

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPoll());
    this.loadList().then(() => {
      const id = this.route.snapshot.queryParamMap.get('run') || this.list?.busy || this.list?.runs[0]?.id;
      if (id) this.openRun(id);
    });
  }

  async loadList(): Promise<void> {
    try {
      this.list = await this.service.listRuns();
      this.einvoiceUrl = this.list.einvoice_url;
      console.log(`${LOG} ${this.list.runs.length} lần kiểm, lịch tự động ${this.list.scheduler.enabled ? 'BẬT' : 'TẮT'}${this.list.busy ? `, đang kiểm ${this.list.busy}` : ''}`);
    } catch (e: any) {
      console.error(`${LOG} Không tải được danh sách lần kiểm: ${httpErrorText(e)}`);
      this.error = `Không tải được danh sách lần kiểm: ${e?.error?.detail || httpErrorText(e)}`;
    }
  }

  async openRun(id: string): Promise<void> {
    this.stopPoll();
    this.switchingRun = !!this.run && this.run.id !== id;
    this.loadingRun = true;
    this.error = '';
    try {
      const r = await this.service.getRun(id);
      this.run = r;
      this.einvoiceUrl = r.einvoice_url || this.einvoiceUrl;
      this.page = 1;
      this.router.navigate([], { queryParams: { run: id }, replaceUrl: true });
      if (r.status === 'running') {
        this.pollTimer = setTimeout(() => this.openRun(id), POLL_MS);
      } else {
        console.log(`${LOG} Lần kiểm ${id}: ${r.status}, ${r.counts?.bills ?? 0} HĐ, lỗi ${r.counts?.bills_error ?? 0}, cảnh báo ${r.counts?.bills_warn ?? 0}`);
        if (r.status === 'done' && this.view === 'issues' && !this.issueBills.length) this.view = 'all';
        this.loadList();
      }
    } catch (e: any) {
      console.error(`${LOG} Không mở được lần kiểm ${id}: ${httpErrorText(e)}`);
      this.error = `Không mở được lần kiểm: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.loadingRun = false;
      this.switchingRun = false;
    }
  }

  /** Lịch tự kiểm có nhiều giờ (00:00, 12:00, 17:00, 21:00) → lần chạy sắp tới gần nhất */
  get nextCheckJob() {
    return (this.list?.scheduler.jobs || []).filter(j => j.name === 'einvoice_check')
      .sort((a, b) => a.next_at.localeCompare(b.next_at))[0];
  }

  /** Kết quả lần tự kiểm gần nhất (giờ chạy muộn nhất có kết quả) */
  get lastCheckResult(): string {
    return (this.list?.scheduler.jobs || []).filter(j => j.name === 'einvoice_check' && j.last_result)
      .sort((a, b) => b.next_at.localeCompare(a.next_at))[0]?.last_result || '';
  }

  // Xóa lần kiểm (26/10/2026) — tích chọn rồi "Xóa đã chọn", hoặc nút thùng rác từng dòng
  selectedRuns = new Set<string>();
  deletingRuns = false;

  toggleRun(id: string, on: boolean): void {
    if (on) this.selectedRuns.add(id); else this.selectedRuns.delete(id);
  }

  /** all = tất cả trong bảng, schedule = chỉ lịch tự động, manual = chỉ người bấm; lần đang chạy không chọn */
  selectRuns(kind: 'all' | 'schedule' | 'manual' | 'none'): void {
    this.selectedRuns = new Set((this.list?.runs || [])
      .filter(r => r.status !== 'running' && (kind === 'all' || (kind === 'schedule') === (r.trigger === 'schedule')) && kind !== 'none')
      .map(r => r.id));
  }

  get allRunsSelected(): boolean {
    const ids = (this.list?.runs || []).filter(r => r.status !== 'running').map(r => r.id);
    return !!ids.length && ids.every(id => this.selectedRuns.has(id));
  }

  deleteSelectedRuns(): Promise<void> {
    return this.deleteRuns(Array.from(this.selectedRuns));
  }

  async deleteRuns(ids: string[]): Promise<void> {
    if (!ids.length || this.deletingRuns) return;
    if (!confirm(`Xóa ${ids.length} lần kiểm? Kết quả của các lần này sẽ mất, không khôi phục được.`)) return;
    this.deletingRuns = true;
    this.error = '';
    this.msg = '';
    try {
      const res = await this.service.deleteRuns(ids);
      res.deleted.forEach(id => this.selectedRuns.delete(id));
      this.msg = `Đã xóa ${res.deleted.length} lần kiểm` + (res.skipped.length ? ` — bỏ qua ${res.skipped.length} lần đang chạy` : '');
      const wasOpen = !!this.run && res.deleted.includes(this.run.id);
      await this.loadList();
      if (wasOpen) {
        this.stopPoll();
        this.run = null;
        const next = this.list?.runs[0]?.id;
        if (next) await this.openRun(next); else this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    } catch (e: any) {
      console.error(`${LOG} Xóa ${ids.length} lần kiểm lỗi: ${httpErrorText(e)}`);
      this.error = `Không xóa được: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.deletingRuns = false;
    }
  }

  private stopPoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  async startCheck(): Promise<void> {
    this.starting = true;
    this.error = '';
    this.msg = '';
    try {
      const id = await this.service.start('draft');
      console.log(`${LOG} Bắt đầu kiểm ${id} (HĐ nháp)`);
      this.view = 'issues';
      await this.loadList();
      await this.openRun(id);
    } catch (e: any) {
      console.warn(`${LOG} Không bắt đầu kiểm được: ${httpErrorText(e)}`);
      this.error = e?.error?.detail || httpErrorText(e);
      if (e?.status === 409 && e?.error?.id) this.openRun(e.error.id);
    } finally {
      this.starting = false;
    }
  }

  // ===== Kết quả =====
  get issueBills(): CheckBill[] {
    return (this.run?.bills || []).filter(b => b.level === 'error' || b.level === 'warn');
  }

  get filteredBills(): CheckBill[] {
    let rows = this.view === 'issues' ? this.issueBills : (this.run?.bills || []);
    if (this.levelFilter) rows = rows.filter(b => b.level === this.levelFilter);
    const q = this.norm(this.q);
    if (q) rows = rows.filter(b => this.norm(`${b.code} ${b.series} ${b.number} ${b.issues.map(i => `${i.code} ${i.name} ${i.kind}`).join(' ')}`).includes(q));
    return rows;
  }

  get pageBills(): CheckBill[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredBills.slice(start, start + this.pageSize);
  }

  pageCount(n: number): number { return Math.max(1, Math.ceil(n / this.pageSize)); }

  setView(v: View): void {
    this.view = v;
    this.page = 1;
    this.levelFilter = '';
    if (v === 'rates' && !this.ratesLoaded) this.loadRates();
  }

  kindsText(run: CheckRun): string {
    return Object.entries(run.counts?.kinds || {}).map(([k, n]) => `${k}: ${n}`).join(' · ');
  }

  ratesText(r: { [rate: string]: number }): string {
    return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k || '(trống)'}: ${n} dòng`).join(', ');
  }

  /** Link mở đúng HĐ: trang danh sách einvoiceapp đọc ?id=<id HĐ einvoice> → lọc + mở sẵn dòng đó (đọc từ JS einvoiceapp 23/10/2026) */
  billUrl(b: CheckBill): string {
    return `${this.einvoiceUrl}?id=${encodeURIComponent(b.id)}`;
  }

  // ===== PDF lúc phát hành (30/10/2026) — cột PDF + nút xem file =====
  readonly pdfLabel: Record<PdfStatus, string> = { ok: 'Khớp', diff: 'Khác dữ liệu', error: 'Không đọc được' };
  readonly pdfLevel: Record<PdfStatus, BillLevel> = { ok: 'ok', diff: 'error', error: 'warn' };
  /** id HĐ đang tải PDF (einvoice dựng ~5–8 giây) */
  pdfLoading = '';

  /** Mở tab trống NGAY lúc bấm (trình duyệt chặn window.open sau await) rồi gán PDF tải qua HttpClient (có X-Id-Token) */
  async openPdf(b: CheckBill): Promise<void> {
    if (this.pdfLoading) return;
    const win = window.open('', '_blank');
    this.pdfLoading = b.id;
    this.error = '';
    try {
      const blob = await this.service.billPdf(b.id);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      console.log(`${LOG} Xem PDF HĐ ${b.code} (${Math.round(blob.size / 1024)} KB)`);
    } catch (e: any) {
      win?.close();
      let detail = '';
      try {
        detail = e?.error instanceof Blob ? JSON.parse(await e.error.text())?.detail || '' : e?.error?.detail || '';
      } catch { /* phản hồi lỗi không phải JSON → dùng httpErrorText */ }
      console.warn(`${LOG} Không xem được PDF HĐ ${b.code}: ${httpErrorText(e)}${detail ? ` — ${detail}` : ''}`);
      this.error = `Không xem được PDF HĐ ${b.code}: ${detail || httpErrorText(e)}`;
    } finally {
      this.pdfLoading = '';
    }
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.msg = `Đã copy ${text} — dán vào ô tìm kiếm trên trang HĐĐT KiotViet`;
    } catch (e: any) {
      console.warn(`${LOG} Không copy được: ${e?.message || e}`);
    }
  }

  // ===== Thuế suất đúng =====
  async loadRates(): Promise<void> {
    this.loadingRates = true;
    try {
      const r = await this.service.taxRates();
      this.rates = r.rates;
      this.validRates = r.valid;
      this.ratesLoaded = true;
      this.rateDraft = {};
      console.log(`${LOG} ${r.rates.length} mã master có thuế suất đúng (kế toán đặt ${r.rates.filter(x => x.source === 'manual').length})`);
    } catch (e: any) {
      console.error(`${LOG} Không tải được thuế suất đúng: ${httpErrorText(e)}`);
      this.error = `Không tải được thuế suất đúng: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.loadingRates = false;
    }
  }

  get filteredRates(): TaxRate[] {
    const q = this.norm(this.rateQ);
    return q ? this.rates.filter(r => this.norm(`${r.master_code} ${r.master_name} ${r.rate} ${r.source_text}`).includes(q)) : this.rates;
  }

  get pageRates(): TaxRate[] {
    const start = (this.ratePage - 1) * this.pageSize;
    return this.filteredRates.slice(start, start + this.pageSize);
  }

  /** Đặt thuế suất đúng cho mã master (rate rỗng = bỏ thuế suất kế toán đặt). Áp dụng từ lần kiểm sau. */
  async saveRate(master: string, masterName: string, rate: string): Promise<void> {
    if (!master) return;
    this.savingRate = master;
    this.error = '';
    try {
      const r = await this.service.setTaxRate(master, masterName, rate);
      console.log(`${LOG} ${rate ? `Đặt thuế suất ${rate}` : 'Bỏ thuế suất kế toán đặt'} cho mã master ${master}`);
      this.msg = rate
        ? `Đã đặt thuế suất đúng ${rate} cho mã master ${master} — áp dụng từ lần kiểm sau (bấm Kiểm tra ngay để kiểm lại)`
        : `Đã bỏ thuế suất kế toán đặt cho ${master} — ${r.rate ? `dùng ${r.rate} theo ${r.source_text}` : 'chưa xác định'}`;
      delete this.rateDraft[master];
      const row = this.rates.find(x => x.master_code === master);
      if (row) {
        row.rate = r.rate;
        row.source = r.source as TaxRate['source'];
        row.source_text = r.source_text;
      } else if (this.ratesLoaded) {
        this.loadRates();
      }
      this.markIssues(master, rate);
    } catch (e: any) {
      console.warn(`${LOG} Không lưu được thuế suất cho ${master}: ${httpErrorText(e)}`);
      this.error = `Không lưu được thuế suất: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.savingRate = '';
    }
  }

  /** Sau khi đặt: đánh dấu các dòng cùng mã master trong lần kiểm đang xem (chưa kiểm lại) */
  private markIssues(master: string, rate: string): void {
    for (const b of this.run?.bills || []) {
      for (const i of b.issues) {
        if (i.master === master) (i as any).savedRate = rate || '(bỏ)';
      }
    }
    for (const u of this.run?.unknown || []) {
      if (u.master_code === master) (u as any).savedRate = rate || '(bỏ)';
    }
  }

  savedRate(x: CheckIssue | UnknownMaster): string {
    return (x as any).savedRate || '';
  }

  /** Mặt hàng chưa biết thuế suất đúng mà mọi dòng trên HĐ đang kiểm dùng CÙNG 1 thuế suất */
  get singleRateUnknown(): UnknownMaster[] {
    return (this.run?.unknown || []).filter(u => Object.keys(u.rates).length === 1 && !this.savedRate(u) && Object.keys(u.rates)[0]);
  }

  /** User 23/10/2026: thuế suất đang dùng trên HĐ đã được kiểm và xác nhận → lưu hàng loạt làm thuế suất đúng (kế toán đặt) */
  async confirmAllUnknown(): Promise<void> {
    const list = this.singleRateUnknown;
    if (!list.length) return;
    if (!confirm(`Lưu thuế suất ĐANG DÙNG trên HĐ làm thuế suất đúng cho ${list.length} mặt hàng (mặt hàng có nhiều thuế suất không lưu)?`)) return;
    this.savingRate = '*';
    this.error = '';
    try {
      const r = await this.service.setTaxRatesBulk(list.map(u => ({ master_code: u.master_code, master_name: u.master_name, rate: this.topRate(u) })));
      for (const u of list) (u as any).savedRate = this.topRate(u);
      this.msg = `Đã xác nhận thuế suất cho ${r.saved} mặt hàng${r.skipped ? ` (bỏ ${r.skipped} dòng sai)` : ''} — áp dụng từ lần kiểm sau`;
      console.log(`${LOG} Xác nhận hàng loạt ${r.saved} mã master (bỏ ${r.skipped})`);
      this.ratesLoaded = false;
    } catch (e: any) {
      console.error(`${LOG} Xác nhận hàng loạt lỗi: ${httpErrorText(e)}`);
      this.error = `Không lưu được: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.savingRate = '';
    }
  }

  topRate(u: UnknownMaster): string {
    return Object.entries(u.rates).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }

  // ===== Hiển thị =====
  private norm(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim();
  }

  viTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }

  /** "2026-10-21 23:21:24" → "21/10 23:21" */
  billTime(s: string): string {
    return s && s.length >= 16 ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : s;
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN');
  }

  percent(run: CheckRun): number {
    const p = run.progress;
    return p && p.total ? Math.round(p.done * 100 / p.total) : 0;
  }
}
