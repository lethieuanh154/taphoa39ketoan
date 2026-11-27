import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { httpErrorText } from '../../services/auth.service';
import { ItemService } from '../../services/item.service';
import { PeriodService, formatVn } from '../../services/period.service';
import { CompanyService } from '../../services/company.service';
import {
  CatalogStatus, FolderScan, HhHint, HhMissingRow, ReconciliationRun, ReconciliationService, ReviewItem
} from '../../services/reconciliation.service';
import { expandArchives } from '../../utils/archive.util';

const LOG = '[InvoiceReconciliation]';

/** Kết quả gán 1 mã master → mặt hàng ledger (factor = 1 ĐVT Vietda = factor ĐVT KiotViet; null = cùng ĐVT) */
interface SavedCode { hh: string; factor: number | null; vdUnit: string; kvUnit: string; already?: boolean; }

/** chữ thường, bỏ dấu — lọc tên hàng không cần gõ dấu */
function plainText(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

/**
 * TIỆN ÍCH — ĐỐI SOÁT HÓA ĐƠN XML (plan-doi-soat-web.md, Pha 1 bước 3)
 * Chọn thư mục XML (app FDI) → nén ZIP + upload → KeToanBackEnd chạy doi_soat.py.
 * 02/11/2026: trang chỉ còn chức năng QUY ĐỔI — ghép hàng HĐ vào ⇄ HĐ ra theo mã master KiotViet, về ĐVT nhỏ nhất, mã hàng =
 * mã HH máy tự cấp (lưu Firestore + IndexedDB) → tải XML quy đổi nhập Vietda. Bỏ các tab Tổng quan / Danh sách SP...
 * 16/11/2026: máy KHÔNG tự cấp mã nữa — chỉ mã trong Danh mục Vietda; mã master chưa có mã → bảng "Hàng chưa có mã HH" (gán tay,
 * 1 mã HH cho nhiều mã master, xuất Excel cho kế toán thêm vào Vietda) và máy chủ chặn tải XML quy đổi.
 * 26/11/2026 (spec 004-doi-soat-ma-hang-ledger): mã hàng lấy từ danh mục hàng hóa LEDGER. Bỏ "Tải danh mục Vietda" + khung "Rà mã
 * HH" (Mã cũ chưa ghép / Mã HH đã ghép) — làm ở trang Hàng hóa. Gán mã ở "Hàng chưa có mã HH": hhHint (ĐVT / hệ số gợi ý) →
 * hỏi hệ số nếu ĐVT lệch → ItemService.addMaster (ghi thẳng ledger, audit đúng người). run.ledger_error → báo, không có XML.
 */
@Component({
  selector: 'app-invoice-reconciliation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './invoice-reconciliation-page.component.html',
  styleUrl: './invoice-reconciliation-page.component.css',
})
export class InvoiceReconciliationPageComponent implements OnInit {
  private service = inject(ReconciliationService);
  private periodService = inject(PeriodService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private companyService = inject(CompanyService);
  private items = inject(ItemService);

  readonly period = this.periodService.period;
  readonly periodLabel = this.periodService.label;

  catalog: CatalogStatus | null = null;
  catalogBusy = false;
  catalogError = '';

  /** số dòng hiện tối đa của bảng "Hàng chưa có mã HH" (lọc để tìm thêm) */
  readonly unmatchedShow = 100;

  /** Mã master của lần đối soát đang mở chưa có mã HH (16/11/2026) */
  hhMissing: HhMissingRow[] | null = null;
  hhMissingRunId = '';
  hhMissingTotal = 0;
  hhMissingLoading = false;
  hhMissingError = '';
  hhMissingFilter = '';
  /** mã HH gõ tay cho từng mã master */
  manualHh: { [master: string]: string } = {};
  /** mã master đã tick → gán chung 1 mã HH (vd mọi vị Mỳ Hảo Hảo = 1 mã Vietda) */
  hhSelected = new Set<string>();
  bulkHh = '';
  hhAssigning = '';
  hhAssignMsg = '';

  scan: FolderScan | null = null;
  /** đang giải nén file ZIP / RAR người dùng chọn (30/10/2026) */
  expanding = false;
  expandProgress = '';
  periodMode: 'all' | 'period' | 'auto' = 'all';
  /** mặc định = MST công ty (popup ở MainLayout), sửa tay được cho lần chạy này; để trống = máy chủ tự nhận */
  mst = '';
  private readonly mstSync = effect(() => {
    this.mst = this.companyService.mst();
  });

  /** Bước phía trình duyệt (nén / upload); bước phía máy chủ lấy từ run.progress */
  clientStage: '' | 'zipping' | 'uploading' = '';
  clientPercent = 0;
  clientLabel = '';
  startError = '';

  runs: ReconciliationRun[] = [];
  serverBusy = false;
  runsError = '';

  run: ReconciliationRun | null = null;
  runError = '';
  showWarnings = false;

  /** Bảng duy nhất: mặt hàng cần xem + lý do (02/11/2026) */
  review: ReviewItem[] = [];
  reviewRunId = '';
  reviewLoading = false;
  reviewError = '';
  downloading = '';

  private pollSub?: Subscription;

  ngOnInit(): void {
    this.loadCatalog();
    this.loadRuns();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('run');
      if (id && id !== this.run?.id) {
        this.openRun(id);
      }
    });
    this.destroyRef.onDestroy(() => this.pollSub?.unsubscribe());
  }

  get running(): boolean {
    return !!this.clientStage || this.run?.status === 'queued' || this.run?.status === 'running';
  }

  get canStart(): boolean {
    return !!this.scan && (this.scan.nXml + this.scan.nZip) > 0 && !this.running && !this.serverBusy && !this.expanding;
  }

  /** Số mặt hàng theo cách quy đổi (cột 'Bản sao XML'), nhiều nhất lên đầu */
  get xmlPlans(): { plan: string; count: number }[] {
    return Object.entries(this.run?.summary?.xml_plans || {})
      .map(([plan, count]) => ({ plan: plan || '(trống)', count }))
      .sort((a, b) => b.count - a.count);
  }

  get progressPercent(): number {
    return this.clientStage ? this.clientPercent : this.run?.progress?.percent ?? 0;
  }

  get progressLabel(): string {
    if (this.clientStage) return this.clientLabel;
    const p = this.run?.progress;
    if (!p) return '';
    if (this.run?.status === 'queued') return 'Đang chờ máy chủ...';
    return p.total ? `${p.label}: ${p.done.toLocaleString('vi-VN')} / ${p.total.toLocaleString('vi-VN')}` : `${p.label}...`;
  }

  formatDate(iso: string): string {
    return iso ? formatVn(iso.slice(0, 10)) + (iso.length > 10 ? ' ' + iso.slice(11, 16) : '') : '';
  }

  formatMb(bytes: number): string {
    return (bytes / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' MB';
  }

  // ───────────────────────────── Bảng quy đổi ĐVT KiotViet

  loadCatalog(): void {
    this.service.catalogStatus().subscribe({
      next: st => this.catalog = st,
      error: e => this.catalogError = `Không lấy được trạng thái bảng quy đổi: ${httpErrorText(e)}`
    });
  }

  refreshCatalog(): void {
    this.catalogBusy = true;
    this.catalogError = '';
    this.service.refreshCatalog().subscribe({
      next: st => {
        this.catalog = st;
        this.catalogBusy = false;
      },
      error: e => {
        this.catalogBusy = false;
        this.catalogError = `Không cập nhật được bảng quy đổi: ${httpErrorText(e)}`;
      }
    });
  }

  // ───────────────────────────── Gán mã master → mặt hàng ledger (26/11/2026, spec 004)

  /** Gán mã master KiotViet cho mặt hàng ledger `hh`: hhHint kiểm ĐVT / mã đang gán → ĐVT lệch thì hỏi hệ số (1 ĐVT Vietda = N
   *  ĐVT KiotViet) → ItemService.addMaster. cache: Gán chung — mỗi cặp ĐVT chỉ hỏi 1 lần. → null nếu người dùng hủy hỏi hệ số. */
  private async saveCode(master: string, hh: string, cache?: Map<string, number>): Promise<SavedCode | null> {
    const h = await firstValueFrom(this.service.hhHint(master, hh));
    if (h.current_hh === h.hh) {
      console.info(`${LOG} Gán ${h.hh} → ${h.master_code}: đã gán từ trước`);
      return { hh: h.hh, factor: null, vdUnit: h.vd_unit, kvUnit: h.kv_unit, already: true };
    }
    if (h.current_hh) {
      console.warn(`${LOG} Gán ${h.hh} → ${h.master_code}: mã master đang thuộc ${h.current_hh}`);
      throw { status: 409, message: `Mã master ${h.master_code} đang thuộc mặt hàng ${h.current_hh} — bỏ gán ở trang Hàng hóa trước` };
    }
    let factor: number | null = null;
    if (!h.unit_ok) {
      const key = `${h.vd_unit}|${h.kv_unit}`.toLowerCase();
      factor = cache?.get(key) ?? this.askFactor(h);
      if (factor === null) {
        console.info(`${LOG} Gán ${h.hh} → ${h.master_code}: người dùng hủy nhập hệ số ĐVT`);
        return null;
      }
      cache?.set(key, factor);
    }
    await firstValueFrom(this.items.addMaster(h.hh, {
      masterCode: h.master_code, masterId: h.master_id ?? undefined, kvUnit: h.kv_unit, factor: factor ?? 1
    }));
    console.info(`${LOG} Đã gán ${h.hh} ← ${h.master_code} trên ledger` + (factor ? ` (1 ${h.vd_unit} = ${factor} ${h.kv_unit})` : ''));
    return { hh: h.hh, factor, vdUnit: h.vd_unit, kvUnit: h.kv_unit };
  }

  /** Hỏi hệ số: "N" → 1 ĐVT Vietda = N ĐVT KiotViet; "/N" → 1 ĐVT KiotViet = N ĐVT Vietda (vd 1 lốc (4h) = 4 hộp). */
  private askFactor(d: Pick<HhHint, 'hh' | 'master_code' | 'vd_unit' | 'kv_unit' | 'suggested' | 'kv_units'>): number | null {
    const fmt = (x: number) => String(Number(x.toFixed(4)));
    const sug = d.suggested;
    const def = sug ? (sug >= 1 ? fmt(sug) : '/' + fmt(1 / sug)) : '';
    const msg = `${d.hh} → ${d.master_code}: ĐVT Vietda "${d.vd_unit}" khác ĐVT nhỏ nhất KiotViet "${d.kv_unit}".`
      + (d.kv_units ? `
KiotViet có: ${d.kv_units}` : '')
      + `

Nhập hệ số:
• N   → 1 ${d.vd_unit} = N ${d.kv_unit}
• /N  → 1 ${d.kv_unit} = N ${d.vd_unit}`
      + `
Cùng số lượng, chỉ khác tên ĐVT → 1` + (def ? `
Gợi ý: ${def}` : '');
    for (;;) {
      const ans = prompt(msg, def);
      if (ans === null) return null;
      const m = ans.trim().replace(',', '.').match(/^(\/)?\s*(\d+(?:\.\d+)?)$/);
      const n = m ? parseFloat(m[2]) : NaN;
      if (m && n > 0) {
        const f = m[1] ? 1 / n : n;
        console.info(`${LOG} Hệ số ${d.hh} → ${d.master_code}: '${ans}' = 1 ${d.vd_unit} = ${f} ${d.kv_unit}`);
        return f;
      }
      console.warn(`${LOG} Hệ số '${ans}' không hợp lệ`);
      alert('Hệ số không hợp lệ — nhập số > 0, vd 4 hoặc /6');
    }
  }

  private factorNote(r: SavedCode): string {
    return r.factor ? ` — 1 ${r.vdUnit} = ${Number(r.factor.toFixed(4))} ${r.kvUnit}` : '';
  }

  // ───────────────────────────── Hàng chưa có mã HH của lần đối soát (16/11/2026)

  get hhMissingFiltered(): HhMissingRow[] {
    const q = plainText(this.hhMissingFilter.trim());
    const rows = this.hhMissing || [];
    if (!q) return rows;
    return rows.filter(r => plainText(`${r.master_code} ${r.name} ${r.suggestions.map(s => s.hh + ' ' + s.name).join(' ')}`).includes(q));
  }

  get hhVisible(): HhMissingRow[] {
    return this.hhMissingFiltered.slice(0, this.unmatchedShow);
  }

  get allVisibleSelected(): boolean {
    const v = this.hhVisible;
    return v.length > 0 && v.every(r => this.hhSelected.has(r.master_code));
  }

  loadHhMissing(id: string): void {
    this.hhMissingRunId = id;
    this.hhMissingLoading = true;
    this.hhMissingError = '';
    this.hhAssignMsg = '';
    this.service.hhMissing(id).subscribe({
      next: r => {
        if (this.hhMissingRunId !== id) return;
        this.hhMissingLoading = false;
        this.hhMissing = r.items;
        this.hhMissingTotal = r.total;
        this.hhSelected.clear();
      },
      error: e => {
        if (this.hhMissingRunId !== id) return;
        this.hhMissingLoading = false;
        this.hhMissing = null;
        this.hhMissingError = `Không lấy được danh sách hàng chưa có mã HH: ${httpErrorText(e)}`;
      }
    });
  }

  toggleHhSelected(row: HhMissingRow, on: boolean): void {
    if (on) this.hhSelected.add(row.master_code);
    else this.hhSelected.delete(row.master_code);
  }

  toggleAllVisible(on: boolean): void {
    for (const r of this.hhVisible) this.toggleHhSelected(r, on);
  }

  /** Gán mã HH (gợi ý hoặc gõ tay) cho 1 mã master */
  async assignHh(row: HhMissingRow, hh: string): Promise<void> {
    const code = hh.trim().toUpperCase();
    if (!code) {
      console.warn(`${LOG} Gán mã HH cho ${row.master_code}: chưa nhập mã`);
      this.hhAssignMsg = `Nhập mã HH / KM Vietda cho ${row.master_code}.`;
      return;
    }
    this.hhAssigning = row.master_code;
    this.hhAssignMsg = '';
    try {
      const r = await this.saveCode(row.master_code, code);
      if (!r) {
        this.hhAssignMsg = `Chưa gán ${code} → ${row.master_code}: chưa nhập hệ số ĐVT.`;
        return;
      }
      this.hhAssignMsg = `Đã gán ${r.hh} cho ${row.master_code} ${row.name}${this.factorNote(r)}`
        + (r.already ? ' (đã gán từ trước).' : ' — lưu vào danh mục hàng hóa.');
      this.removeHhRow(row.master_code);
    } catch (e) {
      this.hhAssignMsg = `Gán ${code} → ${row.master_code} lỗi: ${httpErrorText(e)}`;
    } finally {
      this.hhAssigning = '';
    }
  }

  /** 1 mã HH cho mọi mã master đã tick (gán lần lượt, dòng lỗi giữ lại) */
  async assignSelected(): Promise<void> {
    const code = this.bulkHh.trim().toUpperCase();
    const rows = (this.hhMissing || []).filter(r => this.hhSelected.has(r.master_code));
    if (!code || !rows.length) {
      console.warn(`${LOG} Gán chung: thiếu mã (${code || 'trống'}) hoặc chưa tick dòng (${rows.length})`);
      this.hhAssignMsg = !rows.length ? 'Tick các mã master cần gán chung 1 mã HH.' : 'Nhập mã HH / KM Vietda để gán chung.';
      return;
    }
    const list = rows.slice(0, 15).map(r => `• ${r.master_code} ${r.name} (${r.unit})`).join('\n');
    if (!confirm(`Gán mã ${code} cho ${rows.length} mã master:\n${list}${rows.length > 15 ? '\n…' : ''}`)) {
      console.info(`${LOG} Gán chung ${code}: người dùng hủy`);
      return;
    }
    console.info(`${LOG} Gán chung ${code} cho ${rows.length} mã master`);
    this.hhAssigning = '*';
    this.hhAssignMsg = '';
    let ok = 0;
    const errors: string[] = [];
    const factors = new Map<string, number>();   // mỗi cặp ĐVT Vietda ↔ KiotViet chỉ hỏi hệ số 1 lần
    for (const r of rows) {
      try {
        const res = await this.saveCode(r.master_code, code, factors);
        if (!res) {
          errors.push(`${r.master_code}: chưa nhập hệ số ĐVT`);
          continue;
        }
        ok++;
        this.removeHhRow(r.master_code);
      } catch (e) {
        console.warn(`${LOG} Gán chung ${code} → ${r.master_code} lỗi: ${httpErrorText(e)}`);
        errors.push(`${r.master_code}: ${httpErrorText(e)}`);
      }
    }
    this.hhAssigning = '';
    this.hhAssignMsg = `Đã gán ${code} cho ${ok}/${rows.length} mã master.` + (errors.length ? ` Lỗi: ${errors.join(' · ')}` : '');
    console.info(`${LOG} Gán chung ${code}: ${ok}/${rows.length} OK, ${errors.length} lỗi`);
  }

  private removeHhRow(master: string): void {
    this.hhMissing = (this.hhMissing || []).filter(x => x.master_code !== master);
    this.hhSelected.delete(master);
  }

  ledgerErrorText(kind: string): string {
    return kind === 'auth' ? 'Danh mục hàng hóa (ledger) từ chối đọc — phiên đăng nhập hết hạn, đăng nhập lại.'
      : kind === 'unreachable' ? 'Không kết nối được danh mục hàng hóa (ledger).' : 'Danh mục hàng hóa (ledger) báo lỗi.';
  }

  async downloadHhMissing(): Promise<void> {
    const id = this.run?.id;
    if (id) await this.runDownload('hh-missing', () => this.service.downloadHhMissing(id));
  }

  async downloadCatalog(): Promise<void> {
    await this.runDownload('catalog', () => this.service.downloadCatalog());
  }

  // ───────────────────────────── Chọn thư mục + chạy

  async onFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';   // chọn lại đúng thư mục đó vẫn nhận
    if (!files.length) {
      console.info(`${LOG} Không chọn thư mục nào`);
      return;
    }
    // máy chủ không đọc được RAR → RAR trong thư mục giải nén trên máy; ZIP giữ nguyên gửi lên như trước
    const rars = files.filter(f => /\.rar$/i.test(f.name));
    await this.expandAndScan(files.filter(f => !rars.includes(f)), rars);
  }

  /** Chọn file ZIP / RAR (nén cả thư mục) → giải nén trên máy rồi quét như chọn thư mục (bảng lương / danh mục ở gốc file nén vẫn nhận) */
  async onArchiveSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) {
      console.info(`${LOG} Không chọn file nén nào`);
      return;
    }
    await this.expandAndScan([], files);
  }

  private async expandAndScan(plain: File[], archives: File[]): Promise<void> {
    this.startError = '';
    this.scan = null;
    if (!archives.length) {
      this.scan = this.service.scanFolder(plain);
      return;
    }
    this.expanding = true;
    this.expandProgress = '';
    try {
      const ex = await expandArchives(archives, () => true, (d, t) => this.expandProgress = `${d}/${t}`);
      console.info(`${LOG} Giải nén ${archives.length} file nén → ${ex.files.length} file (${ex.nArchives} file nén kể cả lồng nhau), lỗi ${ex.errors.length}`);
      if (ex.errors.length) {
        this.startError = `Không giải nén được: ${ex.errors.slice(0, 3).join(' · ')}${ex.errors.length > 3 ? ` · … (${ex.errors.length} lỗi)` : ''}`;
      }
      const all = [...plain, ...ex.files];
      if (all.length) this.scan = this.service.scanFolder(all);
    } catch (e: any) {
      console.error(`${LOG} Giải nén lỗi:`, e);
      this.startError = `Không giải nén được: ${e?.message || e}`;
    } finally {
      this.expanding = false;
    }
  }

  async start(): Promise<void> {
    const scan = this.scan;
    if (!scan || !this.canStart) return;
    const p = this.period();
    const opts = this.periodMode === 'period'
      ? { mst: this.mst.trim(), tuNgay: p.from, denNgay: p.to }
      : { mst: this.mst.trim(), tuNgay: '', denNgay: '', toanBo: this.periodMode === 'all' };
    console.info(`${LOG} Bắt đầu đối soát "${scan.folderName}" — kỳ ${opts.toanBo ? 'toàn bộ HĐ' : opts.tuNgay || 'tự nhận'} → ${opts.denNgay || ''}`);
    this.startError = '';
    this.run = null;
    try {
      this.clientStage = 'zipping';
      this.clientLabel = 'Đang nén file trên máy...';
      this.clientPercent = 0;
      const zip = await this.service.zipFiles(scan, (done, total) => {
        this.clientPercent = Math.round(done / total * 20);
        this.clientLabel = `Đang nén file trên máy: ${done.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')}`;
      });
      this.clientStage = 'uploading';
      this.clientLabel = `Đang gửi lên máy chủ (${this.formatMb(zip.size)})...`;
      const id = await this.service.upload(zip, scan, opts, (loaded, total) => {
        this.clientPercent = 20 + Math.round(loaded / Math.max(total, 1) * 30);
        this.clientLabel = `Đang gửi lên máy chủ: ${this.formatMb(loaded)} / ${this.formatMb(total)}`;
      });
      this.clientStage = '';
      this.router.navigate([], { relativeTo: this.route, queryParams: { run: id }, queryParamsHandling: 'merge' });
    } catch (e: any) {
      this.clientStage = '';
      this.startError = e?.message || String(e);
      console.warn(`${LOG} Không bắt đầu được đối soát: ${this.startError}`);
      this.loadRuns();
    }
  }

  // ───────────────────────────── Lần chạy

  loadRuns(): void {
    this.service.listRuns().subscribe({
      next: r => {
        this.runs = r.runs;
        this.serverBusy = r.busy;
        this.runsError = '';
      },
      error: e => this.runsError = `Không lấy được danh sách lần đối soát: ${httpErrorText(e)}`
    });
  }

  openRun(id: string): void {
    console.info(`${LOG} Mở lần chạy ${id}`);
    this.pollSub?.unsubscribe();
    this.runError = '';
    this.pollSub = timer(0, 1000).pipe(switchMap(() => this.service.getRun(id))).subscribe({
      next: run => {
        const wasRunning = this.run?.id === id && (this.run.status === 'queued' || this.run.status === 'running');
        this.run = run;
        if (run.status === 'done' && this.reviewRunId !== run.id) this.loadReview(run.id);
        if (run.status === 'done' && run.hh_missing !== undefined && this.hhMissingRunId !== run.id) {
          if (run.hh_missing) {
            this.loadHhMissing(run.id);
          } else {
            this.hhMissingRunId = run.id;
            this.hhMissing = null;
            this.hhMissingError = '';
          }
        }
        if (run.status === 'done' || run.status === 'error') {
          this.pollSub?.unsubscribe();
          if (wasRunning) {
            console.info(`${LOG} Lần chạy ${id}: ${run.status}${run.error ? ' — ' + run.error : ''}`);
            this.loadRuns();
          }
        }
      },
      error: e => {
        this.pollSub?.unsubscribe();
        this.runError = `Không mở được lần đối soát: ${httpErrorText(e)}`;
      }
    });
  }

  async loadReview(id: string): Promise<void> {
    this.reviewRunId = id;
    this.review = [];
    this.reviewError = '';
    this.reviewLoading = true;
    try {
      const items = await this.service.reviewItems(id);
      if (this.reviewRunId === id) this.review = items;
    } catch (e) {
      console.warn(`${LOG} Lấy mặt hàng cần xem của ${id} lỗi: ${httpErrorText(e)}`);
      if (this.reviewRunId === id) this.reviewError = `Không lấy được danh sách cần xem: ${httpErrorText(e)}`;
    } finally {
      if (this.reviewRunId === id) this.reviewLoading = false;
    }
  }

  reasons(item: ReviewItem): string[] {
    return (item.ly_do || '').split('; ').filter(Boolean);
  }

  view(run: ReconciliationRun): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { run: run.id }, queryParamsHandling: 'merge' });
  }

  deleteRun(run: ReconciliationRun): void {
    if (!confirm(`Xóa kết quả đối soát lúc ${this.formatDate(run.created_at)} (${run.folder_name || run.id})?`)) {
      return;
    }
    this.service.deleteRun(run.id).subscribe({
      next: () => {
        if (this.run?.id === run.id) {
          this.run = null;
          this.router.navigate([], { relativeTo: this.route, queryParams: { run: null }, queryParamsHandling: 'merge' });
        }
        this.loadRuns();
      },
      error: e => this.runsError = `Không xóa được: ${httpErrorText(e)}`
    });
  }

  async downloadReport(): Promise<void> {
    const id = this.run?.id;
    if (id) await this.runDownload('report', () => this.service.downloadReport(id));
  }

  async downloadCloneZip(): Promise<void> {
    const id = this.run?.id;
    if (id) await this.runDownload('clone', () => this.service.downloadCloneZip(id));
  }

  private async runDownload(what: string, fn: () => Promise<void>): Promise<void> {
    this.downloading = what;
    try {
      await fn();
    } catch (e: any) {
      alert(`Không tải được file: ${e?.message || e}`);
    } finally {
      this.downloading = '';
    }
  }
}
