import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { httpErrorText } from '../../services/auth.service';
import { PeriodService, formatVn } from '../../services/period.service';
import { CompanyService } from '../../services/company.service';
import {
  CatalogStatus, FolderScan, ReconciliationRun, ReconciliationService, RunTab
} from '../../services/reconciliation.service';
import { ServerTableComponent, ServerTableSource } from '../shared/server-table/server-table.component';
import { expandArchives } from '../../utils/archive.util';

const LOG = '[InvoiceReconciliation]';

/** Tên tab tiếng Việt có dấu (tên sheet của script không dấu) */
const TAB_LABELS: { [key: string]: string } = {
  'tong-quan': 'Tổng quan',
  'danh-sach-san-pham': 'Danh sách sản phẩm',
  'doi-soat-theo-master': 'Đối soát theo master',
  'ngoai-le': 'Ngoại lệ',
  'hd-thay-the-dieu-chinh': 'HĐ thay thế - điều chỉnh',
  'dong-hang-quy-doi': 'Dòng hàng quy đổi',
  'xml-quy-doi': 'XML quy đổi',
  'ban-duoi-gia-von': 'Bán dưới giá vốn',
  'thieu-hd-vao': 'Thiếu HĐ vào',
  'lech-so-hoc-hd': 'Lệch số học HĐ',
  'thue-theo-thue-suat': 'Thuế theo thuế suất',
  'hd-dau-vao': 'HĐ đầu vào',
  'hd-dau-ra': 'HĐ đầu ra',
  'hd-bo-qua': 'HĐ bỏ qua',
  'file-loi': 'File lỗi',
};
const GUIDE_KEY = 'huong-dan';

interface GuideRow { purpose: string; howToRead: string; action: string; }

/**
 * TIỆN ÍCH — ĐỐI SOÁT HÓA ĐƠN XML (plan-doi-soat-web.md, Pha 1 bước 3)
 * Chọn thư mục XML (app FDI) → nén ZIP + upload → KeToanBackEnd chạy doi_soat.py → các tab như file Excel của script.
 */
@Component({
  selector: 'app-invoice-reconciliation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ServerTableComponent],
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

  scan: FolderScan | null = null;
  /** đang giải nén file ZIP / RAR người dùng chọn (30/10/2026) */
  expanding = false;
  expandProgress = '';
  periodMode: 'period' | 'auto' = 'period';
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
  activeTab = '';
  tableSource: ServerTableSource | null = null;
  guide: { [title: string]: GuideRow } = {};
  showGuide = true;
  showWarnings = false;
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

  get visibleTabs(): RunTab[] {
    return (this.run?.tabs || []).filter(t => t.key !== GUIDE_KEY);
  }

  get activeGuide(): GuideRow | null {
    const tab = this.run?.tabs?.find(t => t.key === this.activeTab);
    return tab ? this.guide[tab.title] || null : null;
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

  tabLabel(tab: RunTab): string {
    return TAB_LABELS[tab.key] || tab.title;
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
        this.catalogError = `Không cập nhật được từ KiotViet: ${httpErrorText(e)}`;
      }
    });
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
      : { mst: this.mst.trim(), tuNgay: '', denNgay: '' };
    console.info(`${LOG} Bắt đầu đối soát "${scan.folderName}" — kỳ ${opts.tuNgay || 'tự nhận'} → ${opts.denNgay || ''}`);
    this.startError = '';
    this.run = null;
    this.tableSource = null;
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
    this.tableSource = null;
    this.guide = {};
    this.pollSub = timer(0, 1000).pipe(switchMap(() => this.service.getRun(id))).subscribe({
      next: run => {
        const wasRunning = this.run?.id === id && (this.run.status === 'queued' || this.run.status === 'running');
        this.run = run;
        if (run.status === 'done' || run.status === 'error') {
          this.pollSub?.unsubscribe();
          if (wasRunning) {
            console.info(`${LOG} Lần chạy ${id}: ${run.status}${run.error ? ' — ' + run.error : ''}`);
            this.loadRuns();
          }
          if (run.status === 'done') {
            this.loadGuide(run);
            this.selectTab(this.activeTab && run.tabs?.some(t => t.key === this.activeTab) ? this.activeTab : 'tong-quan');
          }
        }
      },
      error: e => {
        this.pollSub?.unsubscribe();
        this.runError = `Không mở được lần đối soát: ${httpErrorText(e)}`;
      }
    });
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
          this.tableSource = null;
          this.router.navigate([], { relativeTo: this.route, queryParams: { run: null }, queryParamsHandling: 'merge' });
        }
        this.loadRuns();
      },
      error: e => this.runsError = `Không xóa được: ${httpErrorText(e)}`
    });
  }

  selectTab(key: string): void {
    const run = this.run;
    const tab = run?.tabs?.find(t => t.key === key);
    if (!run || !tab) return;
    this.activeTab = key;
    this.tableSource = {
      id: `${run.id}/${key}`,
      load: query => this.service.getTab(run.id, key, query),
      export: (format, query) => this.service.exportTab(run.id, key, tab.title, format, query),
    };
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

  /** Tab "Huong dan" của script → khung trợ giúp của từng tab */
  private loadGuide(run: ReconciliationRun): void {
    if (!run.tabs?.some(t => t.key === GUIDE_KEY)) return;
    this.service.getTab(run.id, GUIDE_KEY, { page: 1, pageSize: 100, q: '', sort: null, desc: false, filters: {} }).subscribe({
      next: page => {
        this.guide = Object.fromEntries(page.rows.map(r => [r[0], { purpose: r[1] || '', howToRead: r[2] || '', action: r[3] || '' }]));
      },
      error: () => console.warn(`${LOG} Không tải được hướng dẫn các tab — bỏ qua khung trợ giúp`)
    });
  }
}
