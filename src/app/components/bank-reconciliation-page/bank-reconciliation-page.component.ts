import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { httpErrorText } from '../../services/auth.service';
import { TableLoadingComponent } from '../shared/table-loading/table-loading.component';
import { BankReconciliationService, TransferRange } from '../../services/bank-reconciliation.service';
import { PeriodService } from '../../services/period.service';
import { parseTpBankStatement, BankStatementResult } from '../../utils/tpbank-statement.util';
import {
  ReconInvoice, ReconPair, ReconKind, expandInvoiceItems, reconcileByAmount, multiTransferPairs, excessTransferPairs,
  buildReconCsv, buildMultiTransferCsv, buildExcessTransferCsv, edgeHintLabel, formatDeltaMinutes, NOTE_STATUS_LABEL,
  RECON_KIND_LABEL, readKvEInvoice
} from '../../utils/transfer-reconcile.util';

/**
 * ĐỐI SOÁT CK (Tiện ích) — HĐ KiotViet trả chuyển khoản ⇄ sao kê TPBank (plan-ketoan-flow.md bước 2).
 * Port từ BanHang bank-reconciliation-page: logic khớp dùng y utils/transfer-reconcile.util.ts + tpbank-statement.util.ts
 * (vùng mirror, chép nguyên file); khác BanHang: HĐ đọc qua KeToanBackEnd (BankReconciliationService), khoảng ngày theo
 * thanh chọn kỳ, bảng khớp phân trang (KeToan chưa có @angular/cdk), bỏ nút "đánh sao" (thao tác ghi lên KiotViet).
 */
const LOG = '[BankRecon]';

interface InvoiceRow {
  code: string;
  total: number;      // số tiền của KHOẢN (HĐ nhiều lần đã tách)
  time: string;       // giờ HĐ (dd/mm/yyyy HH:mm:ss)
  partLabel: string;  // "Khoản 1/2" | ''
}

interface BankRow {
  date: string;
  desc: string;
  counterparty: string;
  code: string;
  credit: number;
}

// 1 dòng canh hàng theo số tiền: 2 bên khớp nằm cùng dòng; dòng dư 1 bên thì bên kia null (để trống)
interface AlignedRow {
  amount: number;
  kind: ReconKind;
  left: InvoiceRow | null;  // HĐ KiotViet
  right: BankRow | null;    // GD TPBank
  note: string;             // "lệch giờ −13h 25'" | "Có thể thuộc kỳ trước" | ''
}

// 1 dòng của tab "CK nhiều lần" (mỗi khoản 1 dòng)
interface MultiRow {
  first: boolean;
  code: string;
  /** Số HĐĐT (CQT đã chấp nhận) — '' khi chưa có (23/10/2026) */
  einvoiceNo: string;
  einvoiceStatus: string;
  time: string;
  total: number;
  note: string;
  noteStatus: string;
  noteOk: boolean;
  part: string;
  amount: number | null;
  kind: ReconKind;
  kindLabel: string;
  txnText: string;
  hint: string;
}

// 1 dòng của tab "CK dư" (mỗi HĐ 1 dòng): khách chuyển dư, đã trả lại tiền mặt
interface ExcessRow {
  code: string;
  einvoiceNo: string;
  einvoiceStatus: string;
  time: string;
  total: number;
  note: string;
  noteStatus: string;
  noteOk: boolean;
  transferred: number | null;
  refund: number | null;
  kind: ReconKind;
  kindLabel: string;
  txnText: string;
  hint: string;
}

@Component({
  selector: 'app-bank-reconciliation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TableLoadingComponent],
  templateUrl: './bank-reconciliation-page.component.html',
  styleUrls: ['./bank-reconciliation-page.component.css']
})
export class BankReconciliationPageComponent {
  private service = inject(BankReconciliationService);
  private periodService = inject(PeriodService);
  readonly periodLabel = this.periodService.label;

  // Khoảng ngày lấy HĐ CK (yyyy-mm-dd): theo thanh chọn kỳ; import sao kê → theo ngày GD thực tế trong file
  fromDate = '';
  toDate = '';
  /** Khoảng ngày của bộ HĐ đang hiển thị (khác fromDate/toDate → nhắc bấm lấy lại) */
  loadedFrom = '';
  loadedTo = '';

  // Kết quả gộp từ 1 hoặc nhiều file Bảng kê ngân hàng (đã loại trùng theo Mã GD)
  bank: BankStatementResult | null = null;
  bankFileName = '';

  private invoices: ReconInvoice[] = [];
  kvLoaded = false;
  loadProgress = '';
  /** Tình trạng dữ liệu HĐ trên máy chủ cho khoảng đã lấy */
  range: TransferRange | null = null;
  syncNote = '';

  private pairs: ReconPair[] = [];

  activeTab: 'all' | 'multi' | 'excess' = 'all';

  alignedRows: AlignedRow[] = [];
  sortMode: 'unmatched' | 'amountDesc' | 'amountAsc' = 'unmatched';
  viewFilter: 'all' | 'issues' | 'late' = 'all';
  page = 1;
  pageSize = 200;
  readonly pageSizes = [100, 200, 500, 1000];

  multiRows: MultiRow[] = [];
  excessRows: ExcessRow[] = [];

  dateNote = '';

  parsingFile = false;
  loadingKv = false;
  error = '';

  constructor() {
    // Theo thanh chọn kỳ khi chưa import sao kê (đã import → khoảng ngày theo sao kê, như BanHang)
    effect(() => {
      const p = this.periodService.period();
      if (this.bank) return;
      this.fromDate = p.from;
      this.toDate = p.to;
    });
  }

  /** Chọn 1 hoặc nhiều file Bảng kê (vd 3 tháng của 1 quý) — thay toàn bộ dữ liệu ngân hàng cũ. */
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    this.error = '';
    this.parsingFile = true;
    this.bankFileName = files.length === 1 ? files[0].name : `${files.length} file: ${files.map(f => f.name).join(', ')}`;
    try {
      const results: BankStatementResult[] = [];
      for (const f of files) results.push(await parseTpBankStatement(f));
      this.bank = this.mergeStatements(results);
      console.log(`${LOG} Sao kê: ${files.length} file, ${this.bank.count} GD ghi có, tổng ${this.bank.totalCredit.toLocaleString('vi-VN')} ₫ (${this.bank.fromDate} → ${this.bank.toDate})`);
      this.applyBankDateRange();
      if (this.kvLoaded) this.activeTab = 'all';
      this.computeRows();
    } catch (e: any) {
      console.warn(`${LOG} Không đọc được sao kê (${files.map(f => f.name).join(', ')}): ${e?.message || e}`);
      this.bank = null;
      this.dateNote = '';
      this.error = e?.message || 'Không đọc được file Bảng kê.';
      this.computeRows();
    } finally {
      this.parsingFile = false;
      input.value = ''; // cho phép chọn lại cùng file
    }
  }

  /** Bỏ sao kê đang import → khoảng ngày về theo thanh chọn kỳ. */
  clearBank(): void {
    this.bank = null;
    this.bankFileName = '';
    this.dateNote = '';
    const p = this.periodService.period();
    this.fromDate = p.from;
    this.toDate = p.to;
    if (this.activeTab === 'all') this.activeTab = 'multi';
    this.computeRows();
  }

  /** Gộp nhiều bảng kê, loại GD trùng (các file chồng ngày nhau) theo Mã GD. */
  private mergeStatements(list: BankStatementResult[]): BankStatementResult {
    if (list.length === 1) return list[0];
    const seen = new Set<string>();
    const transactions = list.flatMap(r => r.transactions).filter(t => {
      const key = t.code || `${t.date}|${t.credit}|${t.desc}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const pick = (vals: string[], dir: 1 | -1) =>
      vals.filter(Boolean).sort((a, b) => a.localeCompare(b) * dir)[0] || '';
    return {
      transactions,
      totalCredit: transactions.reduce((s, t) => s + t.credit, 0),
      count: transactions.length,
      fromDate: pick(list.map(r => r.fromDate), 1),
      toDate: pick(list.map(r => r.toDate), -1),
      firstTxnAt: pick(list.map(r => r.firstTxnAt), 1),
      lastTxnAt: pick(list.map(r => r.lastTxnAt), -1),
      periodFrom: pick(list.map(r => r.periodFrom), 1),
      periodTo: pick(list.map(r => r.periodTo), -1),
    };
  }

  /**
   * HĐ CK đã lưu trên máy chủ; ngày chưa lấy / lấy khi chưa hết ngày → máy chủ lấy từ KiotViet (≤ 7 ngày / lần).
   * `force` = lấy lại mọi ngày (cập nhật trạng thái HĐĐT, HĐ sửa / hủy).
   */
  async loadKiotViet(force = false) {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) {
      console.warn(`${LOG} Khoảng ngày không hợp lệ: ${this.fromDate} → ${this.toDate}`);
      this.error = 'Vui lòng chọn khoảng ngày hợp lệ.';
      return;
    }
    this.error = '';
    this.loadingKv = true;
    this.loadProgress = '';
    try {
      const { data, syncedDays, cachedAt } = await this.service.load(this.fromDate, this.toDate, force,
        (i, n) => this.loadProgress = `lấy từ KiotViet ${i}/${n}`);
      // Dùng TotalPayment (số tiền khách thực trả/chuyển khoản) thay vì Total (Total có thể > tiền trả khi có giảm giá)
      this.invoices = data.invoices.map(inv => ({
        id: inv.Id, code: inv.Code, total: (inv.TotalPayment ?? inv.Total) || 0,
        time: this.formatInvoiceTime(inv.PurchaseDate), note: inv.Description || '',
        ...readKvEInvoice(inv)  // số HĐĐT chỉ khi CQT đã chấp nhận
      }));
      this.range = data;
      this.loadedFrom = this.fromDate;
      this.loadedTo = this.toDate;
      this.syncNote = syncedDays ? `vừa lấy ${syncedDays} ngày từ KiotViet`
        : cachedAt ? `bản lưu trên máy này lúc ${new Date(cachedAt).toLocaleString('vi-VN')}` : 'dữ liệu đã lưu trên máy chủ';
      this.kvLoaded = true;
      console.log(`${LOG} ${this.fromDate} → ${this.toDate}: ${this.invoices.length} HĐ CK (${this.syncNote})`);
      if (!this.bank) this.activeTab = 'multi';
      this.computeRows();
    } catch (e: any) {
      console.error(`${LOG} Lấy HĐ CK ${this.fromDate} → ${this.toDate} lỗi: ${httpErrorText(e)}`);
      this.error = `Không lấy được hóa đơn CK: ${e?.error?.detail || e?.message || httpErrorText(e)}`;
    } finally {
      this.loadingKv = false;
      this.loadProgress = '';
    }
  }

  /**
   * Khoảng ngày lấy HĐ KiotViet bám theo NGÀY GIAO DỊCH thực tế trong file.
   * TPBank lọc bảng kê theo NGÀY GIÁ TRỊ: GD Chủ Nhật có ngày giá trị = Thứ 2 nên nằm trong bảng kê kỳ Thứ 2.
   * Cột A vẫn giữ ngày giờ thật của GD ⇒ lấy min/max cột A là ra đúng khoảng cần đối soát.
   */
  private applyBankDateRange(): void {
    this.dateNote = '';
    const from = this.bank?.fromDate;
    const to = this.bank?.toDate;
    if (!from || !to) return;

    this.fromDate = from;
    this.toDate = to;

    const b = this.bank!;
    const period = b.periodFrom && b.periodTo
      ? `Kỳ sao kê ${this.viDate(b.periodFrom)} → ${this.viDate(b.periodTo)} (lọc theo Ngày giá trị) · ` : '';
    const span = from === to
      ? `GD thực tế ngày ${this.viDate(from)}`
      : `GD thực tế ${this.viStamp(b.firstTxnAt)} → ${this.viStamp(b.lastTxnAt)}`;
    this.dateNote = `${period}${span} · đã đặt khoảng lấy HĐ KiotViet ${this.viDate(from)} → ${this.viDate(to)}.`;
  }

  viDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private viStamp(stamp: string): string {
    return `${this.viDate(stamp.slice(0, 10))} ${stamp.slice(11, 16)}`;
  }

  /** ISO UTC → "dd/mm HH:mm" giờ máy */
  viSync(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  get rangeChanged(): boolean {
    return this.kvLoaded && (this.fromDate !== this.loadedFrom || this.toDate !== this.loadedTo);
  }

  /** Khớp theo số tiền (xem transfer-reconcile.util.ts), dựng dữ liệu cho 3 tab. */
  private computeRows() {
    const items = expandInvoiceItems(this.invoices);
    this.pairs = reconcileByAmount(items, this.bank?.transactions ?? [], {
      periodFrom: this.loadedFrom || this.fromDate, periodTo: this.loadedTo || this.toDate
    });
    this.buildMultiRows();
    this.buildExcessRows();
    this.computeStats();
    this.buildAlignedRows();
    this.logCompare();
  }

  private buildAlignedRows(): void {
    const rows: AlignedRow[] = this.pairs.map(p => ({
      amount: p.amount,
      kind: p.kind,
      left: p.item ? {
        code: p.item.invoice.code,
        total: p.item.amount,
        time: p.item.invoice.time,
        partLabel: p.item.partCount > 1 ? `Khoản ${p.item.partIndex}/${p.item.partCount}`
          : p.item.excess?.refund ? `CK dư, trả lại ${this.formatVnd(p.item.excess.refund)}` : ''
      } : null,
      right: p.txn ? {
        date: p.txn.date, desc: p.txn.desc, counterparty: p.txn.counterparty, code: p.txn.code, credit: p.txn.credit
      } : null,
      note: p.kind === 'matched_late' ? `lệch giờ ${formatDeltaMinutes(p.deltaMinutes)}` : edgeHintLabel(p.edgeHint)
    }));

    const rank: Record<ReconKind, number> = { invoice_only: 0, bank_only: 0, matched_late: 1, matched: 2 };
    if (this.sortMode === 'unmatched') {
      rows.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (b.amount - a.amount));
    } else {
      const dir = this.sortMode === 'amountAsc' ? 1 : -1;
      rows.sort((a, b) => (a.amount - b.amount) * dir);
    }
    this.alignedRows = this.viewFilter === 'all' ? rows
      : rows.filter(r => this.viewFilter === 'late' ? r.kind === 'matched_late' : rank[r.kind] === 0);
    this.page = 1;
  }

  // ===== Phân trang bảng khớp (cả quý ~25k cặp) =====
  get pageCount(): number { return Math.max(1, Math.ceil(this.alignedRows.length / this.pageSize)); }
  get pageRows(): AlignedRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.alignedRows.slice(start, start + this.pageSize);
  }
  goPage(p: number): void { this.page = Math.min(Math.max(1, p), this.pageCount); }
  onPageSize(): void { this.page = 1; }

  setViewFilter(f: 'all' | 'issues' | 'late'): void {
    this.viewFilter = f;
    this.buildAlignedRows();
  }

  private buildMultiRows(): void {
    let prev = '';
    this.multiRows = multiTransferPairs(this.pairs).map(p => {
      const it = p.item!;
      const first = it.invoice.code !== prev;
      prev = it.invoice.code;
      return {
        first,
        code: it.invoice.code,
        einvoiceNo: it.invoice.einvoiceNumber || '',
        einvoiceStatus: it.invoice.einvoiceStatus || '',
        time: it.invoice.time,
        total: it.invoice.total,
        note: it.invoice.note,
        noteStatus: it.note ? NOTE_STATUS_LABEL[it.note.status] : '',
        noteOk: it.note?.status === 'ok',
        part: it.partCount > 1 ? `${it.partIndex}/${it.partCount}` : '—',
        amount: it.partCount > 1 ? it.amount : null,
        kind: p.kind,
        kindLabel: RECON_KIND_LABEL[p.kind],
        txnText: p.txn ? [p.txn.counterparty || p.txn.desc, p.txn.date, p.txn.code].filter(Boolean).join(' · ') : '',
        hint: p.kind === 'matched_late' ? `lệch giờ ${formatDeltaMinutes(p.deltaMinutes)}` : edgeHintLabel(p.edgeHint)
      };
    });
  }

  private buildExcessRows(): void {
    this.excessRows = excessTransferPairs(this.pairs).map(p => {
      const it = p.item!;
      const ex = it.excess!;
      return {
        code: it.invoice.code,
        einvoiceNo: it.invoice.einvoiceNumber || '',
        einvoiceStatus: it.invoice.einvoiceStatus || '',
        time: it.invoice.time,
        total: it.invoice.total,
        note: it.invoice.note,
        noteStatus: NOTE_STATUS_LABEL[ex.status],
        noteOk: ex.status === 'ok',
        transferred: ex.transferred || null,
        refund: ex.refund,
        kind: p.kind,
        kindLabel: RECON_KIND_LABEL[p.kind],
        txnText: p.txn ? [p.txn.counterparty || p.txn.desc, p.txn.date, p.txn.code].filter(Boolean).join(' · ') : '',
        hint: p.kind === 'matched_late' ? `lệch giờ ${formatDeltaMinutes(p.deltaMinutes)}` : edgeHintLabel(p.edgeHint)
      };
    });
  }

  /** Xoay vòng: Lệch lên đầu → Số tiền giảm → Số tiền tăng → Lệch lên đầu */
  toggleSort(): void {
    this.sortMode = this.sortMode === 'unmatched' ? 'amountDesc'
      : this.sortMode === 'amountDesc' ? 'amountAsc' : 'unmatched';
    this.buildAlignedRows();
  }

  get sortIcon(): string {
    return this.sortMode === 'unmatched' ? 'fa-triangle-exclamation'
      : this.sortMode === 'amountAsc' ? 'fa-caret-up' : 'fa-caret-down';
  }

  get sortLabel(): string {
    return this.sortMode === 'unmatched' ? 'Lệch lên đầu' : 'Số tiền';
  }

  /** Log các mệnh giá lệch số lượng giữa 2 bên. */
  private logCompare(): void {
    if (!this.canCompare) return;
    const diff = new Map<number, { kv: number; bank: number }>();
    for (const p of this.pairs) {
      if (p.kind !== 'invoice_only' && p.kind !== 'bank_only') continue;
      const d = diff.get(p.amount) || { kv: 0, bank: 0 };
      if (p.kind === 'invoice_only') d.kv++; else d.bank++;
      diff.set(p.amount, d);
    }
    const table = [...diff.entries()]
      .map(([a, d]) => ({ 'Số tiền': a.toLocaleString('vi-VN'), 'HĐ dư': d.kv, 'GD dư': d.bank }))
      .sort((a, b) => (b['HĐ dư'] + b['GD dư']) - (a['HĐ dư'] + a['GD dư']));

    console.group(`${LOG} Kết quả đối soát`);
    console.log(`HĐ KiotViet: ${this.invoices.length} HĐ (${this.itemCount} khoản), tổng ${this.kvTotal.toLocaleString('vi-VN')} ₫`);
    console.log(`GD TPBank (Ghi có): ${this.bankCount} GD, tổng ${this.bankTotal.toLocaleString('vi-VN')} ₫`);
    console.log(`Khớp lệch giờ: ${this.lateCount} | HĐ dư: ${this.invoiceUnmatched} | GD dư: ${this.bankUnmatched}`);
    if (table.length > 0) console.table(table.slice(0, 50));
    console.groupEnd();
  }

  // ===== Xuất CSV =====
  exportCsv(): void {
    this.download(buildReconCsv(this.pairs), `doi-soat-ck_${this.loadedFrom}_${this.loadedTo}.csv`);
  }

  /** Xuất được cả khi CHƯA import sao kê (chỉ danh sách HĐ nhiều lần, không có cột khớp GD). */
  exportMultiCsv(): void {
    this.download(buildMultiTransferCsv(this.pairs, { withBank: !!this.bank }), `ck-nhieu-lan_${this.loadedFrom}_${this.loadedTo}.csv`);
  }

  exportExcessCsv(): void {
    this.download(buildExcessTransferCsv(this.pairs, { withBank: !!this.bank }), `ck-du_${this.loadedFrom}_${this.loadedTo}.csv`);
  }

  exportActiveCsv(): void {
    if (this.activeTab === 'all') this.exportCsv();
    else if (this.activeTab === 'multi') this.exportMultiCsv();
    else this.exportExcessCsv();
  }

  get csvDisabled(): boolean {
    return this.activeTab === 'all' ? !this.canCompare
      : this.activeTab === 'multi' ? !this.multiRows.length : !this.excessRows.length;
  }

  private download(content: string, fileName: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`${LOG} Xuất ${fileName}`);
  }

  // ===== Tổng hợp (tính 1 lần trong computeRows) =====
  get bankTotal(): number { return this.bank?.totalCredit ?? 0; }
  get bankCount(): number { return this.bank?.transactions.length ?? 0; }
  get invoiceCount(): number { return this.invoices.length; }
  kvTotal = 0;
  itemCount = 0;
  lateCount = 0;
  invoiceUnmatched = 0;
  bankUnmatched = 0;
  multiInvoiceCount = 0;
  multiIssueCount = 0;
  multiUnmatchedCount = 0;
  excessIssueCount = 0;
  excessUnmatchedCount = 0;
  excessExtraTotal = 0;   // Σ (khách chuyển − tổng HĐ) của HĐ CK dư = tiền vào NH nhiều hơn HĐ, đã trả lại khách

  private computeStats(): void {
    this.kvTotal = this.invoices.reduce((s, r) => s + r.total, 0);
    this.itemCount = this.lateCount = this.invoiceUnmatched = this.bankUnmatched = this.excessExtraTotal = 0;
    for (const p of this.pairs) {
      if (p.item) this.itemCount++;
      if (p.item?.excess) this.excessExtraTotal += p.item.amount - p.item.invoice.total;
      if (p.kind === 'matched_late') this.lateCount++;
      else if (p.kind === 'invoice_only') this.invoiceUnmatched++;
      else if (p.kind === 'bank_only') this.bankUnmatched++;
    }
    this.multiInvoiceCount = this.multiRows.filter(r => r.first).length;
    this.multiIssueCount = this.multiRows.filter(r => r.first && !r.noteOk).length;
    this.multiUnmatchedCount = this.multiRows.filter(r => r.kind === 'invoice_only').length;
    this.excessIssueCount = this.excessRows.filter(r => !r.noteOk).length;
    this.excessUnmatchedCount = this.excessRows.filter(r => r.kind === 'invoice_only').length;
  }

  // Trừ phần CK dư đã trả lại khách: GD NH lớn hơn HĐ nhưng không phải chênh lệch thật
  get difference(): number { return this.bankTotal - this.kvTotal - this.excessExtraTotal; }
  get canCompare(): boolean { return !!this.bank && this.kvLoaded; }
  get isBalanced(): boolean { return this.canCompare && this.invoiceUnmatched === 0 && this.bankUnmatched === 0; }

  /** "2026-07-01T23:12:11.917+07:00" -> "01/07/2026 23:12:11" (giữ nguyên giờ trong chuỗi, không đổi timezone) */
  private formatInvoiceTime(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : '';
  }

  formatVnd(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('vi-VN') + ' ₫';
  }
}
