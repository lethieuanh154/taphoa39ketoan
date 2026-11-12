/**
 * ĐỐI SOÁT CK → "CK nhiều lần / CK dư (BanHang)" (13/11/2026, user: "BanHang tự lưu 2 tab lên Firestore, KeToan có page con để tìm /
 * load"). Chỉ ĐỌC bản lưu do BanHang ghi (CkSnapshotService). Khoảng ngày theo thanh chọn kỳ (PeriodService).
 * Ít dòng (vài chục / ngày) nên lọc / tìm ngay trên trình duyệt, không qua server-table.
 */
import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { httpErrorText } from '../../services/auth.service';
import { PeriodService } from '../../services/period.service';
import { CkSnapshotDay, CkSnapshotService } from '../../services/ck-snapshot.service';
import { RECON_KIND_LABEL, ReconSnapshotRow } from '../../utils/transfer-reconcile.util';
import { XlsxCell, XlsxTone, buildXlsx } from '../../utils/xlsx-writer.util';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';

const LOG = '[CkSnapshotPage]';
type Tab = 'multi' | 'excess';
type Filter = '' | 'bad' | 'note';

interface ViewRow extends ReconSnapshotRow {
  day: string;
  first: boolean;      // dòng đầu của HĐ (CK nhiều lần) → hiện thông tin HĐ
  tone: 'ok' | 'warn' | 'bad';
}

@Component({
  selector: 'app-ck-snapshot-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './ck-snapshot-page.component.html',
  styleUrl: './ck-snapshot-page.component.css'
})
export class CkSnapshotPageComponent {
  private periodService = inject(PeriodService);
  private service = inject(CkSnapshotService);
  readonly periodLabel = this.periodService.label;
  readonly kindLabel = RECON_KIND_LABEL;

  from = '';
  to = '';
  loading = false;
  error = '';
  loaded = false;
  days: CkSnapshotDay[] = [];
  missing: string[] = [];

  tab: Tab = 'multi';
  filter: Filter = '';
  q = '';
  private multi: ViewRow[] = [];
  private excess: ViewRow[] = [];
  view: ViewRow[] = [];

  constructor() {
    effect(() => {
      const p = this.periodService.period();
      this.from = p.from;
      this.to = p.to;
      void this.load();
    });
  }

  async load(): Promise<void> {
    if (!this.from || !this.to || this.from > this.to) {
      console.warn(`${LOG} Khoảng ngày không hợp lệ: ${this.from} → ${this.to}`);
      this.error = 'Khoảng ngày không hợp lệ.';
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      const r = await this.service.load(this.from, this.to);
      this.days = r.days;
      this.missing = r.missing;
      this.multi = this.toRows(r.days, 'multi');
      this.excess = this.toRows(r.days, 'excess');
      this.loaded = true;
      this.rebuild();
    } catch (e: any) {
      console.error(`${LOG} Tải ${this.from} → ${this.to} lỗi: ${httpErrorText(e)}`);
      this.error = `Không tải được bản lưu: ${e?.error?.detail || httpErrorText(e)}`;
    } finally {
      this.loading = false;
    }
  }

  private toRows(days: CkSnapshotDay[], key: Tab): ViewRow[] {
    let prev = '';
    return days.flatMap(d => (d[key] || []).map(r => {
      const first = key === 'excess' || `${d.day}|${r.code}` !== prev;
      prev = `${d.day}|${r.code}`;
      const tone = r.kind === 'invoice_only' || r.kind === 'bank_only' || !r.noteOk ? 'bad' : r.kind === 'matched_late' ? 'warn' : 'ok';
      return { ...r, day: d.day, first, tone } as ViewRow;
    }));
  }

  setTab(t: Tab): void {
    this.tab = t;
    this.rebuild();
  }

  setFilter(f: Filter): void {
    this.filter = f;
    this.rebuild();
  }

  rebuild(): void {
    const q = this.q.trim().toLowerCase();
    let rows = this.tab === 'multi' ? this.multi : this.excess;
    if (this.filter === 'bad') rows = rows.filter(r => r.tone === 'bad');
    else if (this.filter === 'note') rows = rows.filter(r => !r.noteOk);
    if (q) {
      // HĐ nhiều lần: khớp 1 khoản thì hiện cả HĐ
      const hit = new Set(rows.filter(r => [r.code, r.einvoiceNo, r.note, r.txnPayer, r.txnCode, r.txnDate, r.total, r.amount, r.hint]
        .join(' ').toLowerCase().includes(q)).map(r => `${r.day}|${r.code}`));
      rows = rows.filter(r => hit.has(`${r.day}|${r.code}`));
    }
    // dòng đầu mỗi HĐ (sau lọc) mới hiện thông tin HĐ
    let prev = '';
    this.view = rows.map(r => {
      const k = `${r.day}|${r.code}`;
      const first = this.tab === 'excess' || k !== prev;
      prev = k;
      return first === r.first ? r : { ...r, first };
    });
  }

  countOf(tab: Tab): number {
    const rows = tab === 'multi' ? this.multi : this.excess;
    return new Set(rows.map(r => `${r.day}|${r.code}`)).size;
  }
  get badCount(): number { return (this.tab === 'multi' ? this.multi : this.excess).filter(r => r.tone === 'bad').length; }
  get noteCount(): number { return (this.tab === 'multi' ? this.multi : this.excess).filter(r => !r.noteOk).length; }

  get savedRange(): string {
    const at = this.days.map(d => d.savedAt).sort();
    return at.length ? `${this.viStamp(at[0])} → ${this.viStamp(at[at.length - 1])}` : '';
  }
  get missingText(): string {
    const m = this.missing.map(d => this.viDate(d).slice(0, 5));
    return m.length > 12 ? `${m.slice(0, 12).join(', ')} … (+${m.length - 12})` : m.join(', ');
  }

  /** 1 file Excel 2 sheet (cùng cột bảng), màu dòng như trên trang */
  exportExcel(): void {
    const name = `ck-nhieu-lan-ck-du_${this.from}_${this.to}.xlsx`;
    const sheet = (title: string, rows: ViewRow[], multi: boolean) => {
      const header = ['Ngày bán', 'Mã HĐ', 'Ký hiệu', 'Số HĐĐT', 'Giờ HĐ', 'Tổng HĐ', 'Ghi chú', 'Tình trạng ghi chú',
        ...(multi ? ['Khoản', 'Số tiền khoản'] : ['Khách chuyển', 'Trả lại khách']),
        'Trạng thái khớp', 'Giờ GD', 'Người chuyển', 'Mã GD', 'Gợi ý'];
      return {
        name: title, header, emphasisCols: [header.indexOf('Trạng thái khớp'), header.indexOf('Tình trạng ghi chú')],
        tones: rows.map(r => r.tone as XlsxTone),
        rows: rows.map(r => [this.viDate(r.day), r.code, r.einvoiceSerial, r.einvoiceNo, r.time, r.total, r.note, r.noteStatus,
          ...(multi ? [r.part, r.amount] : [r.amount || '', r.refund ?? '']),
          RECON_KIND_LABEL[r.kind], r.txnDate, r.txnPayer, r.txnCode, r.hint] as XlsxCell[]),
      };
    };
    const bytes = buildXlsx([sheet('CK-nhieu-lan', this.multi, true), sheet('CK-du', this.excess, false)]);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    console.info(`${LOG} Xuất ${name}: ${this.multi.length} dòng CK nhiều lần, ${this.excess.length} dòng CK dư`);
  }

  vnd(n: number | null | undefined): string {
    return n === null || n === undefined ? '' : Math.round(n).toLocaleString('vi-VN') + ' ₫';
  }
  viDate(iso: string): string {
    const [y, m, d] = (iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }
  private viStamp(s: string): string { return `${this.viDate(s.slice(0, 10)).slice(0, 5)} ${s.slice(11, 16)}`; }
}
