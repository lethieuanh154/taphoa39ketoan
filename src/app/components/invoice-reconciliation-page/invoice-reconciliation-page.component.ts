import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { httpErrorText } from '../../services/auth.service';
import { PeriodService, formatVn } from '../../services/period.service';
import { CompanyService } from '../../services/company.service';
import {
  AssignedCodeRow, CatalogStatus, FolderScan, HhCode, HhCodeStatus, HhMissingRow, OldCatalogResult, OldCodeSuggestion, OldUnmatchedRow, ReconciliationRun,
  ReconciliationService, ReviewItem
} from '../../services/reconciliation.service';
import { expandArchives } from '../../utils/archive.util';

const LOG = '[InvoiceReconciliation]';

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

  readonly period = this.periodService.period;
  readonly periodLabel = this.periodService.label;

  catalog: CatalogStatus | null = null;
  catalogBusy = false;
  catalogError = '';
  catalogInfo = '';

  /** Mã HH máy tự cấp theo mã master (02/11/2026) — bản IndexedDB */
  hhStatus: HhCodeStatus | null = null;
  hhCodes: HhCode[] = [];

  /** Danh mục Vật tư hàng hóa Vietda (14/11/2026): tải lên → máy chủ dùng lại mã HH / KM cũ, tránh Vietda sinh mã trùng */
  oldBusy = false;
  oldResult: OldCatalogResult | null = null;
  oldError = '';
  /** mã HH cũ chưa ghép → kế toán gán tay */
  unmatched: OldUnmatchedRow[] | null = null;
  unmatchedTotal = 0;
  unmatchedLoading = false;
  unmatchedFilter = '';
  /** mã master gõ tay cho từng mã HH cũ (khi 3 gợi ý không đúng) */
  manualMaster: { [hh: string]: string } = {};
  /** mã master đã gán cho từng mã cũ trong phiên này — 1 mã HH gán được nhiều mã master (vd nhiều vị mì) */
  assignedOld: { [hh: string]: string[] | undefined } = {};
  /** Bảng "Mã HH đã ghép" (17/11/2026) — rà / sửa / bỏ gán mã đã ghép */
  assigned: AssignedCodeRow[] | null = null;
  assignedLoading = false;
  assignedError = '';
  assignedHasCatalog = true;
  assignedFilter = '';
  assignedView: 'flagged' | 'shared' | 'manual' | 'all' = 'flagged';
  /** mã HH mới gõ cho từng mã master */
  editHh: { [master: string]: string } = {};
  assignedBusy = '';
  assignedMsg = '';
  /** mã HH cũ đang gán (khóa nút) */
  assigning = '';
  assignMsg = '';
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
    this.loadHh();
  }

  /** Trạng thái bảng mã HH → danh sách mã (IndexedDB nếu cùng version) */
  loadHh(status?: HhCodeStatus): void {
    const apply = async (st: HhCodeStatus) => {
      this.hhStatus = st;
      try {
        this.hhCodes = st.count ? await this.service.hhCodes(st) : [];
      } catch (e: any) {
        console.warn(`${LOG} Không tải được bảng mã HH: ${httpErrorText(e)}`);
        this.catalogError = `Không tải được bảng mã HH: ${httpErrorText(e)}`;
      }
    };
    if (status) {
      void apply(status);
      return;
    }
    this.service.hhStatus().subscribe({
      next: st => void apply(st),
      error: e => this.catalogError = `Không lấy được trạng thái bảng mã HH: ${httpErrorText(e)}`
    });
  }

  refreshCatalog(): void {
    this.catalogBusy = true;
    this.catalogError = '';
    this.catalogInfo = '';
    this.service.refreshCatalog().subscribe({
      next: st => {
        this.catalog = st;
        this.catalogBusy = false;
        if (st.codes) {
          this.catalogInfo = 'Đã ghép lại mã cũ Vietda cho mã master mới (máy không tự cấp mã HH mới).';
          this.loadHh(st.codes.status);
        }
      },
      error: e => {
        this.catalogBusy = false;
        this.catalogError = `Không cập nhật được bảng quy đổi: ${httpErrorText(e)}`;
      }
    });
  }

  // ───────────────────────────── Danh mục Vật tư hàng hóa Vietda (giữ mã HH cũ — 14/11/2026)

  /** Số mã master đang dùng mã cũ Vietda (ghép tự động + gán tay) */
  get oldUsedCount(): number {
    const s = this.hhStatus?.sources || {};
    return (s['vietda'] || 0) + (s['manual'] || 0);
  }

  get unmatchedFiltered(): OldUnmatchedRow[] {
    const q = this.unmatchedFilter.trim().toLowerCase();
    const rows = this.unmatched || [];
    return q ? rows.filter(r => `${r.hh} ${r.name} ${r.reason}`.toLowerCase().includes(q)) : rows;
  }

  reasonsText(m: { [reason: string]: number } | undefined): string {
    return Object.entries(m || {}).map(([k, v]) => `${k}: ${v.toLocaleString('vi-VN')}`).join(' · ');
  }

  onOldCatalogSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      console.info(`${LOG} Không chọn file danh mục Vietda`);
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      console.warn(`${LOG} Danh mục Vietda '${file.name}' không phải .xlsx`);
      this.oldError = 'Chọn file .xlsx xuất từ Vietda (Hệ thống > Cập nhật danh mục > Vật tư, hàng hóa > Excel).';
      return;
    }
    this.oldBusy = true;
    this.oldError = '';
    this.oldResult = null;
    this.service.uploadOldCatalog(file).subscribe({
      next: r => {
        this.oldBusy = false;
        this.oldResult = r;
        this.loadHh(r.status);
        if (this.unmatched) this.loadUnmatched();
      },
      error: e => {
        this.oldBusy = false;
        this.oldError = `Không tải được danh mục Vietda: ${httpErrorText(e)}`;
      }
    });
  }

  loadUnmatched(): void {
    this.unmatchedLoading = true;
    this.assignMsg = '';
    this.service.oldUnmatched().subscribe({
      next: r => {
        this.unmatchedLoading = false;
        this.unmatched = r.items;
        this.unmatchedTotal = r.total_old;
        this.assignedOld = {};
      },
      error: e => {
        this.unmatchedLoading = false;
        this.oldError = `Không lấy được mã cũ chưa ghép: ${httpErrorText(e)}`;
      }
    });
  }

  /** Gán mã HH cũ `row.hh` cho mã master (gợi ý hoặc gõ tay) */
  assign(row: OldUnmatchedRow, master: string | OldCodeSuggestion): void {
    const code = (typeof master === 'string' ? master : master.master_code).trim();
    if (!code) {
      console.warn(`${LOG} Gán ${row.hh}: chưa nhập mã master`);
      this.assignMsg = `Nhập mã master KiotViet cho ${row.hh}.`;
      return;
    }
    if ((this.assignedOld[row.hh] || []).includes(code)) {
      console.info(`${LOG} Gán ${row.hh} → ${code}: đã gán trước đó, bỏ qua`);
      return;
    }
    if (typeof master !== 'string' && master.current_hh && master.current_source !== 'auto'
      && !confirm(`Mã master ${code} đang dùng ${master.current_hh} (${master.current_source}). Đổi sang ${row.hh}?`)) {
      console.info(`${LOG} Gán ${row.hh} → ${code}: người dùng hủy (đang dùng ${master.current_hh})`);
      return;
    }
    this.assigning = row.hh;
    this.assignMsg = '';
    this.service.setManualCode(code, row.hh).subscribe({
      next: r => {
        this.assigning = '';
        const done = [...(this.assignedOld[row.hh] || []), code];
        this.assignedOld = { ...this.assignedOld, [row.hh]: done };
        this.manualMaster[row.hh] = '';
        this.assignMsg = `Đã gán ${r.item.hh} cho mã master ${code} (${done.length} mã master). Gán thêm vị / mã khác nếu cần, xong bấm "Xong".`;
        console.info(`${LOG} ${row.hh} đã gán ${done.length} mã master: ${done.join(', ')}`);
        this.loadHh(r.status);
      },
      error: e => {
        this.assigning = '';
        this.assignMsg = `Gán ${row.hh} → ${code} lỗi: ${httpErrorText(e)}`;
      }
    });
  }

  /** Ẩn mã cũ khỏi bảng sau khi đã gán đủ mã master */
  finishOld(row: OldUnmatchedRow): void {
    console.info(`${LOG} ${row.hh} xong — ${(this.assignedOld[row.hh] || []).length} mã master`);
    this.unmatched = (this.unmatched || []).filter(x => x.hh !== row.hh);
  }

  // ───────────────────────────── Mã HH đã ghép (17/11/2026)

  assignedCount(view: 'flagged' | 'shared' | 'manual' | 'all'): number {
    return (this.assigned || []).filter(r => this.inView(r, view)).length;
  }

  private inView(r: AssignedCodeRow, view: string): boolean {
    return view === 'all' || (view === 'flagged' && r.flags.length > 0) || (view === 'shared' && r.shared > 1)
      || (view === 'manual' && r.source === 'manual');
  }

  get assignedFiltered(): AssignedCodeRow[] {
    const q = plainText(this.assignedFilter.trim());
    return (this.assigned || []).filter(r => this.inView(r, this.assignedView)
      && (!q || plainText(`${r.master_code} ${r.kv_name} ${r.hh} ${r.vd_name}`).includes(q)));
  }

  get assignedVisible(): AssignedCodeRow[] {
    return this.assignedFiltered.slice(0, this.unmatchedShow);
  }

  loadAssigned(): void {
    this.assignedLoading = true;
    this.assignedError = '';
    this.service.assignedCodes().subscribe({
      next: r => {
        this.assignedLoading = false;
        this.assigned = r.items;
        this.assignedHasCatalog = r.has_catalog;
        if (!r.flagged && this.assignedView === 'flagged' && !this.assignedMsg) this.assignedView = 'all';
      },
      error: e => {
        this.assignedLoading = false;
        this.assignedError = `Không lấy được bảng mã HH đã ghép: ${httpErrorText(e)}`;
      }
    });
  }

  closeAssigned(): void {
    this.assigned = null;
    this.assignedMsg = '';
  }

  /** Đổi mã HH của 1 mã master (hh rỗng = bỏ gán → mã master về "chưa có mã HH") */
  changeAssigned(row: AssignedCodeRow, hh: string): void {
    const code = hh.trim().toUpperCase();
    if (!code) {
      console.warn(`${LOG} Đổi mã HH cho ${row.master_code}: chưa nhập mã`);
      this.assignedMsg = `Nhập mã HH / KM Vietda mới cho ${row.master_code}.`;
      return;
    }
    if (code === row.hh.toUpperCase()) {
      console.info(`${LOG} Đổi mã HH cho ${row.master_code}: trùng mã đang dùng ${row.hh}`);
      this.assignedMsg = `${row.master_code} đang dùng ${row.hh} rồi.`;
      return;
    }
    this.saveAssigned(row, code, `Đã đổi ${row.master_code} từ ${row.hh} sang ${code}.`);
  }

  unassign(row: AssignedCodeRow): void {
    if (!confirm(`Bỏ gán ${row.hh} khỏi ${row.master_code} ${row.kv_name}?
Mã master này sẽ thành "chưa có mã HH" — XML quy đổi `
      + `bị chặn đến khi gán mã khác.`)) {
      console.info(`${LOG} Bỏ gán ${row.hh} → ${row.master_code}: người dùng hủy`);
      return;
    }
    this.saveAssigned(row, '', `Đã bỏ gán ${row.hh} khỏi ${row.master_code} — đối soát lại để thấy ở bảng "Hàng chưa có mã HH".`);
  }

  private saveAssigned(row: AssignedCodeRow, code: string, okMsg: string): void {
    this.assignedBusy = row.master_code;
    this.assignedMsg = '';
    this.service.setManualCode(row.master_code, code).subscribe({
      next: r => {
        this.assignedBusy = '';
        this.assignedMsg = okMsg;
        this.editHh[row.master_code] = '';
        this.loadHh(r.status);
        this.loadAssigned();
      },
      error: e => {
        this.assignedBusy = '';
        this.assignedMsg = `${code ? 'Đổi ' + row.master_code + ' → ' + code : 'Bỏ gán ' + row.master_code} lỗi: ${httpErrorText(e)}`;
      }
    });
  }

  async downloadAssigned(): Promise<void> {
    await this.runDownload('assigned', () => this.service.downloadAssignedCodes());
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
  assignHh(row: HhMissingRow, hh: string): void {
    const code = hh.trim().toUpperCase();
    if (!code) {
      console.warn(`${LOG} Gán mã HH cho ${row.master_code}: chưa nhập mã`);
      this.hhAssignMsg = `Nhập mã HH / KM Vietda cho ${row.master_code}.`;
      return;
    }
    this.hhAssigning = row.master_code;
    this.hhAssignMsg = '';
    this.service.setManualCode(row.master_code, code).subscribe({
      next: r => {
        this.hhAssigning = '';
        this.hhAssignMsg = `Đã gán ${r.item.hh} cho ${row.master_code} ${row.name}.`;
        this.removeHhRow(row.master_code);
        this.loadHh(r.status);
      },
      error: e => {
        this.hhAssigning = '';
        this.hhAssignMsg = `Gán ${code} → ${row.master_code} lỗi: ${httpErrorText(e)}`;
      }
    });
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
    let status: HhCodeStatus | null = null;
    const errors: string[] = [];
    for (const r of rows) {
      try {
        const res = await firstValueFrom(this.service.setManualCode(r.master_code, code));
        status = res.status;
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
    if (status) this.loadHh(status);
  }

  private removeHhRow(master: string): void {
    this.hhMissing = (this.hhMissing || []).filter(x => x.master_code !== master);
    this.hhSelected.delete(master);
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
            if (run.status === 'done') this.loadHh();   // lần chạy có thể đã ghép mã cũ cho mã master mới
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
