/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCT PAGE COMPONENT - DANH MỤC HÀNG HÓA (HH / KM)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Dữ liệu thật ở ledger-rs `/api/ledger/items` (spec 003-danh-muc-hang-hoa). Mã HH / KM theo quy ước Vietda, để trống → BE tự cấp
 * số lớn nhất + 1 (mã mới phải thêm vào Vietda khi còn nhập Vietda). ĐVT chính = ĐVT Vietda; ĐVT phụ + hệ số; mã master KiotViet
 * (1 mặt hàng ↔ nhiều mã master). Đổi ĐVT chính khi đã có ĐVT phụ / mã master → form bắt nhập lại hệ số (BE kiểm LA224).
 * Mở trang = 1 request (tải đủ, lọc loại / trạng thái tại máy, từ khóa mới gọi BE). Log chỉ mã + số lượng.
 */

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, switchMap, takeUntil, catchError, of, tap, distinctUntilChanged, filter } from 'rxjs';

import { ItemService } from '../../services/item.service';
import { ChartOfAccountsService } from '../../services/chart-of-accounts.service';
import { CatalogItem, ReconciliationService } from '../../services/reconciliation.service';
import { httpErrorText } from '../../services/auth.service';
import { Account } from '../../models/chart-of-accounts.models';
import {
  ITEM_CODE_RE,
  ITEM_KINDS,
  Item,
  ItemHistoryEntry,
  ItemKind,
  ItemMaster,
  ItemPatch,
  ItemStatus,
  VAT_RATES,
  VatRate,
  formatFactor,
  getItemKindName,
  masterFactorText,
  unitText
} from '../../models/item.models';
import { ItemVietdaImportComponent } from '../shared/item-vietda-import/item-vietda-import.component';

const LOG = '[ProductPage]';
const PAGE_SIZE = 100;

/** Kết quả tìm KiotViet — `id` (masterId) có khi FastAPI trả thêm (task phát sinh T10) */
type CatalogHit = CatalogItem & { id?: number };

interface ItemForm {
  code: string;
  kind: ItemKind;
  name: string;
  unit: string;
  inventoryAccount: string;
  vatRate: VatRate | '';
  note: string;
  status: ItemStatus;
  units: { unit: string; factor: string }[];
  /** chỉ dùng khi đổi ĐVT chính: hệ số MỚI của từng mã master (1 ĐVT chính mới = N ĐVT KiotViet) */
  masterFactors: { masterCode: string; kvUnit: string; factor: string }[];
}

const FIELD_LABELS: Record<string, string> = {
  code: 'Mã', name: 'Tên', unit: 'ĐVT', inventory_account: 'TK kho', vat_rate: 'Thuế suất', note: 'Ghi chú', status: 'Trạng thái',
  factor: 'Hệ số', kv_unit: 'ĐVT KiotViet', master_id: 'masterId', master_code: 'Mã master', item_code: 'Mặt hàng', source: 'Nguồn'
};

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemVietdaImportComponent],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.css'
})
export class ProductPageComponent implements OnInit, OnDestroy {
  private itemService = inject(ItemService);
  private coaService = inject(ChartOfAccountsService);
  private reconService = inject(ReconciliationService);
  private destroy$ = new Subject<void>();
  /** chỉ phát khi có từ khóa (gọi BE — tìm không dấu); loại / trạng thái lọc tại máy */
  private searchChange$ = new Subject<void>();
  private masterSearch$ = new Subject<string>();
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  readonly kinds = ITEM_KINDS;
  readonly vatRates = VAT_RATES;

  allItems: Item[] = [];
  items: Item[] = [];
  page = 0;
  loading = false;
  saving = false;

  search = '';
  kindFilter: ItemKind | '' = '';
  statusFilter: ItemStatus | '' = '';

  errorMessage = '';
  successMessage = '';
  formError = '';

  selected: Item | null = null;
  showFormModal = false;
  showDetailModal = false;
  showDeleteConfirm = false;
  showImport = false;
  isEditMode = false;
  form: ItemForm = this.emptyForm();

  /** TK kho được chọn (TK lá đang dùng, theo dõi kho) — tải khi mở form lần đầu */
  inventoryAccounts: Account[] = [];
  private accountsLoaded = false;

  history: ItemHistoryEntry[] = [];
  historyLoading = false;
  historyError = '';

  // gán mã master (trong khung chi tiết)
  masterQuery = '';
  masterHits: CatalogHit[] = [];
  masterSearching = false;
  masterSearchError = '';
  pickedHit: CatalogHit | null = null;
  pickedFactor = '1';
  /** ĐVT KiotViet hiện tại của mã master đang gán (để cảnh báo kv_unit lúc gán đã khác) */
  kvUnitNow: Record<string, string> = {};

  get stats() {
    const active = this.allItems.filter(i => i.status === 'ACTIVE').length;
    return {
      total: this.allItems.length,
      active,
      promo: this.allItems.filter(i => i.kind === 'PROMO').length,
      noMaster: this.allItems.filter(i => i.masters.length === 0).length
    };
  }

  get hasFilter(): boolean {
    return !!this.search.trim() || !!this.kindFilter || !!this.statusFilter;
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.items.length / PAGE_SIZE));
  }

  get pagedItems(): Item[] {
    return this.items.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
  }

  /** Đổi ĐVT chính (sửa) khi đã có ĐVT phụ / mã master → phải nhập lại hệ số */
  get unitChanged(): boolean {
    return this.isEditMode && !!this.selected && this.form.unit.trim().toLowerCase() !== this.selected.unit.trim().toLowerCase();
  }

  ngOnInit(): void {
    this.searchChange$.pipe(
      debounceTime(300),
      tap(() => this.loading = true),
      switchMap(() => this.itemService.getItems({
        search: this.search,
        kind: this.kindFilter || undefined,
        status: this.statusFilter || undefined
      }).pipe(catchError(err => {
        this.errorMessage = this.reasonText(err, 'Tìm hàng hóa');
        return of(null);
      }))),
      takeUntil(this.destroy$)
    ).subscribe(rows => {
      this.loading = false;
      if (!rows || !this.search.trim()) return;
      this.items = rows;
      this.page = 0;
      console.info(`${LOG} tìm (gọi BE): ${rows.length} dòng`);
    });

    this.masterSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.trim().length >= 2),
      tap(() => { this.masterSearching = true; this.masterSearchError = ''; }),
      switchMap(q => this.reconService.searchCatalog(q.trim()).pipe(catchError(err => {
        this.masterSearchError = this.reasonText(err, 'Tìm KiotViet');
        return of([] as CatalogItem[]);
      }))),
      takeUntil(this.destroy$)
    ).subscribe(hits => {
      this.masterSearching = false;
      this.masterHits = hits as CatalogHit[];
      console.debug(`${LOG} tìm KiotViet: ${hits.length} kết quả`);
    });

    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  /** Tải toàn bộ 1 lần (thống kê + bảng) rồi áp lại bộ lọc */
  reload(): void {
    this.loading = true;
    this.itemService.getItems().pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        this.allItems = rows;
        this.loading = false;
        this.applyFilter();
        if (this.selected) this.selected = rows.find(r => r.code === this.selected!.code) ?? this.selected;
      },
      error: err => {
        this.loading = false;
        this.errorMessage = this.reasonText(err, 'Tải danh mục hàng hóa');
      }
    });
  }

  private applyFilter(): void {
    if (this.search.trim()) {
      this.searchChange$.next();
      return;
    }
    this.items = this.allItems.filter(i =>
      (!this.kindFilter || i.kind === this.kindFilter) && (!this.statusFilter || i.status === this.statusFilter));
    this.page = 0;
    console.debug(`${LOG} lọc tại máy: ${this.items.length}/${this.allItems.length}`);
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  clearSearch(): void {
    this.search = '';
    this.kindFilter = '';
    this.statusFilter = '';
    this.applyFilter();
  }

  goPage(p: number): void {
    this.page = Math.min(Math.max(0, p), this.pageCount - 1);
  }

  // ─── TK kho ────────────────────────────────────────────────────────────────

  private loadAccounts(): void {
    if (this.accountsLoaded) return;
    this.accountsLoaded = true;
    this.coaService.getLeafAccounts().pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        this.inventoryAccounts = rows.filter(a => a.detailType === 'INVENTORY');
        console.info(`${LOG} TK kho chọn được: ${this.inventoryAccounts.length}`);
      },
      error: err => {
        this.accountsLoaded = false;
        console.warn(`${LOG} tải TK kho lỗi — ${httpErrorText(err)}`);
      }
    });
  }

  // ─── THÊM / SỬA ────────────────────────────────────────────────────────────

  private emptyForm(): ItemForm {
    return { code: '', kind: 'GOODS', name: '', unit: '', inventoryAccount: '1561', vatRate: '', note: '', status: 'ACTIVE',
      units: [], masterFactors: [] };
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selected = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.loadAccounts();
    this.showFormModal = true;
  }

  openEditModal(it: Item): void {
    this.isEditMode = true;
    this.selected = it;
    this.form = {
      code: it.code, kind: it.kind, name: it.name, unit: it.unit, inventoryAccount: it.inventoryAccount, vatRate: it.vatRate ?? '',
      note: it.note, status: it.status,
      units: it.units.map(u => ({ unit: u.unit, factor: formatFactor(u.factor) })),
      masterFactors: it.masters.map(m => ({ masterCode: m.masterCode, kvUnit: m.kvUnit, factor: formatFactor(m.factor) }))
    };
    this.formError = '';
    this.loadAccounts();
    this.showDetailModal = false;
    this.showFormModal = true;
  }

  closeFormModal(): void {
    if (this.saving) return;
    this.showFormModal = false;
    this.formError = '';
  }

  addUnitRow(): void {
    this.form.units = [...this.form.units, { unit: '', factor: '' }];
  }

  removeUnitRow(i: number): void {
    this.form.units = this.form.units.filter((_, k) => k !== i);
  }

  private validate(): string {
    const f = this.form;
    if (!f.name.trim()) return 'Nhập tên hàng hóa.';
    if (!f.unit.trim()) return 'Nhập ĐVT chính.';
    const code = f.code.trim().toUpperCase();
    if (!this.isEditMode && code && !ITEM_CODE_RE.test(code)) return 'Mã gồm HH hoặc KM + 1–6 chữ số (để trống = tự cấp).';
    if (!this.isEditMode && code && !code.startsWith(f.kind === 'PROMO' ? 'KM' : 'HH')) {
      return `Mã ${code} không khớp loại ${getItemKindName(f.kind)}.`;
    }
    const seen = new Set<string>([f.unit.trim().toLowerCase()]);
    for (const u of f.units) {
      const name = u.unit.trim().toLowerCase();
      if (!name) return 'ĐVT phụ không được để trống (xóa dòng nếu không dùng).';
      if (seen.has(name)) return `ĐVT "${u.unit}" bị trùng (với ĐVT chính hoặc ĐVT phụ khác).`;
      seen.add(name);
      if (!(Number(String(u.factor).replace(',', '.')) > 0)) return `Hệ số của ĐVT "${u.unit}" phải > 0.`;
    }
    if (this.unitChanged) {
      for (const m of f.masterFactors) {
        if (!(Number(String(m.factor).replace(',', '.')) > 0)) return `Nhập hệ số mới (> 0) cho mã master ${m.masterCode}.`;
      }
    }
    return '';
  }

  save(): void {
    if (this.saving) return;
    this.formError = this.validate();
    if (this.formError) {
      console.warn(`${LOG} form không hợp lệ: ${this.formError}`);
      return;
    }
    this.saving = true;
    const f = this.form;
    const units = f.units.map(u => ({ unit: u.unit.trim(), factor: String(u.factor).trim() }));
    if (this.isEditMode && this.selected) {
      const before = this.selected;
      const changes: ItemPatch = {};
      if (f.name.trim() !== before.name) changes.name = f.name.trim();
      if (f.inventoryAccount !== before.inventoryAccount) changes.inventoryAccount = f.inventoryAccount;
      if ((f.vatRate || '') !== (before.vatRate ?? '')) changes.vatRate = f.vatRate;
      if (f.note.trim() !== before.note) changes.note = f.note.trim();
      if (f.status !== before.status) changes.status = f.status;
      const unitsBefore = JSON.stringify(before.units.map(u => ({ unit: u.unit, factor: formatFactor(u.factor) })));
      if (this.unitChanged) {
        // đổi ĐVT chính: gửi ĐVT + cả danh sách ĐVT phụ + hệ số mới MỌI mã master trong 1 lần (BE kiểm lúc COMMIT)
        changes.unit = f.unit.trim();
        changes.units = units;
        changes.masters = f.masterFactors.map(m => ({ masterCode: m.masterCode, factor: String(m.factor).trim() }));
      } else if (JSON.stringify(units) !== unitsBefore) {
        changes.units = units;
      }
      if (!Object.keys(changes).length) {
        this.saving = false;
        this.showFormModal = false;
        return;
      }
      this.itemService.updateItem(before.code, changes).pipe(takeUntil(this.destroy$)).subscribe({
        next: it => this.afterSave(`Đã lưu ${it.code}.`),
        error: err => this.failSave(err, `Sửa ${before.code}`)
      });
    } else {
      this.itemService.addItem({
        code: f.code.trim().toUpperCase(), kind: f.kind, name: f.name.trim(), unit: f.unit.trim(),
        inventoryAccount: f.inventoryAccount, vatRate: f.vatRate, note: f.note, status: f.status, units
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: it => this.afterSave(f.code.trim()
          ? `Đã thêm ${it.code}.`
          : `Đã thêm ${it.code} (mã tự cấp) — nhớ thêm mã này vào Vietda nếu còn nhập Vietda.`),
        error: err => this.failSave(err, 'Thêm hàng hóa')
      });
    }
  }

  private afterSave(msg: string): void {
    this.saving = false;
    this.showFormModal = false;
    this.showSuccess(msg);
    this.reload();
  }

  private failSave(err: unknown, action: string): void {
    this.saving = false;
    this.formError = this.reasonText(err, action);
  }

  // ─── NGỪNG DÙNG / XÓA ──────────────────────────────────────────────────────

  toggleStatus(it: Item): void {
    const status: ItemStatus = it.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.itemService.updateItem(it.code, { status }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess(`${it.code}: ${status === 'ACTIVE' ? 'dùng lại' : 'ngừng dùng'}.`);
        this.reload();
      },
      error: err => this.errorMessage = this.reasonText(err, `Đổi trạng thái ${it.code}`)
    });
  }

  confirmDelete(it: Item): void {
    this.selected = it;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  deleteSelected(): void {
    const it = this.selected;
    if (!it || this.saving) return;
    this.saving = true;
    this.itemService.deleteItem(it.code).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.showDeleteConfirm = false;
        this.selected = null;
        this.showSuccess(`Đã xóa ${it.code}.`);
        this.reload();
      },
      error: err => {
        this.saving = false;
        this.showDeleteConfirm = false;
        this.errorMessage = this.reasonText(err, `Xóa ${it.code}`);
      }
    });
  }

  // ─── CHI TIẾT: lịch sử + mã master ────────────────────────────────────────

  viewDetail(it: Item): void {
    this.selected = it;
    this.history = [];
    this.historyError = '';
    this.resetMasterPick();
    this.masterHits = [];
    this.masterQuery = '';
    this.kvUnitNow = {};
    this.showDetailModal = true;
    this.checkKvUnits(it);
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
  }

  /** ĐVT KiotViet hiện tại của các mã master (≤ 10 mã) — khác `kvUnit` lúc gán → cảnh báo xác nhận lại hệ số */
  private checkKvUnits(it: Item): void {
    for (const m of it.masters.slice(0, 10)) {
      this.reconService.searchCatalog(m.masterCode).pipe(takeUntil(this.destroy$)).subscribe({
        next: hits => {
          const hit = hits.find(h => h.code === m.masterCode);
          if (hit) this.kvUnitNow = { ...this.kvUnitNow, [m.masterCode]: hit.unit };
        },
        error: err => console.debug(`${LOG} không kiểm được ĐVT KiotViet ${m.masterCode} — ${httpErrorText(err)}`)
      });
    }
  }

  kvUnitChanged(m: ItemMaster): boolean {
    const now = this.kvUnitNow[m.masterCode];
    return !!now && !!m.kvUnit && now.trim().toLowerCase() !== m.kvUnit.trim().toLowerCase();
  }

  loadHistory(): void {
    const it = this.selected;
    if (!it) return;
    this.historyLoading = true;
    this.historyError = '';
    this.itemService.getHistory(it.code).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => { this.history = rows; this.historyLoading = false; },
      error: err => { this.historyError = this.reasonText(err, 'Tải lịch sử'); this.historyLoading = false; }
    });
  }

  /** Lịch sử gộp: dòng ĐVT phụ / mã master nhận ra theo khóa trong old / new */
  historySubject(h: ItemHistoryEntry): string {
    const row = (h.new ?? h.old ?? {}) as Record<string, unknown>;
    if ('master_code' in row) return `Mã master ${row['master_code']}`;
    if ('unit_key' in row) return `ĐVT phụ ${row['unit']}`;
    return 'Mặt hàng';
  }

  getActionLabel(a: ItemHistoryEntry['action']): string {
    return a === 'INSERT' ? 'Thêm' : a === 'UPDATE' ? 'Sửa' : 'Xóa';
  }

  getFieldLabel(f: string): string {
    return FIELD_LABELS[f] ?? f;
  }

  formatValue(v: unknown): string {
    if (v === null || v === undefined || v === '') return '(trống)';
    return String(v);
  }

  onMasterQuery(): void {
    this.masterSearch$.next(this.masterQuery);
  }

  /** Chọn 1 mã KiotViet → gợi ý hệ số: ĐVT chính trùng 1 ĐVT KiotViet → dùng quy đổi của ĐVT đó, còn lại 1 */
  pickHit(h: CatalogHit): void {
    const it = this.selected;
    if (!it) return;
    this.pickedHit = h;
    const main = it.unit.trim().toLowerCase();
    const same = h.units?.find(u => u.unit.trim().toLowerCase() === main);
    this.pickedFactor = same ? String(same.conversion) : '1';
    console.debug(`${LOG} chọn mã master ${h.code} (gợi ý hệ số ${this.pickedFactor}, có id=${h.id != null})`);
  }

  resetMasterPick(): void {
    this.pickedHit = null;
    this.pickedFactor = '1';
  }

  assignMaster(): void {
    const it = this.selected;
    const h = this.pickedHit;
    if (!it || !h || this.saving) return;
    if (!(Number(String(this.pickedFactor).replace(',', '.')) > 0)) {
      this.masterSearchError = 'Hệ số phải > 0.';
      return;
    }
    this.saving = true;
    this.itemService.addMaster(it.code, { masterCode: h.code, masterId: h.id, kvUnit: h.unit, factor: String(this.pickedFactor).trim() })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: updated => {
          this.saving = false;
          this.selected = updated;
          this.resetMasterPick();
          this.showSuccess(`Đã gán ${h.code} → ${updated.code}.`);
          this.reload();
        },
        error: err => {
          this.saving = false;
          this.masterSearchError = this.reasonText(err, `Gán ${h.code}`);
        }
      });
  }

  removeMaster(m: ItemMaster): void {
    const it = this.selected;
    if (!it || this.saving) return;
    if (!confirm(`Bỏ gán mã master ${m.masterCode} khỏi ${it.code}?`)) return;
    this.saving = true;
    this.itemService.removeMaster(it.code, m.masterCode).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        this.saving = false;
        this.selected = updated;
        this.showSuccess(`Đã bỏ gán ${m.masterCode}.`);
        this.reload();
      },
      error: err => {
        this.saving = false;
        this.errorMessage = this.reasonText(err, `Bỏ gán ${m.masterCode}`);
      }
    });
  }

  // ─── HIỂN THỊ ──────────────────────────────────────────────────────────────

  kindName(k: ItemKind): string {
    return getItemKindName(k);
  }

  unitLabel(it: Item): string {
    return it.units.map(u => unitText(u, it.unit)).join('; ');
  }

  masterLabel(m: ItemMaster, it: Item): string {
    return masterFactorText(m, it.unit);
  }

  vatLabel(v?: VatRate): string {
    return v ? (VAT_RATES.find(x => x.value === v)?.label ?? v) : '-';
  }

  getStatusLabel(s: ItemStatus): string {
    return s === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng';
  }

  getStatusClass(s: ItemStatus): string {
    return s === 'ACTIVE' ? 'status-active' : 'status-inactive';
  }

  // ─── NẠP TỪ VIETDA ─────────────────────────────────────────────────────────

  openImport(): void {
    this.showImport = true;
  }

  closeImport(): void {
    this.showImport = false;
  }

  onImported(n: number): void {
    console.info(`${LOG} nạp từ Vietda: ${n} thay đổi → tải lại`);
    if (n) this.reload();
  }

  // ─── XUẤT EXCEL ────────────────────────────────────────────────────────────

  exportExcel(): void {
    this.itemService.exportExcel().pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hang-hoa-${stamp}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: err => this.errorMessage = this.reasonText(err, 'Xuất Excel')
    });
  }

  // ─── ĐÓNG MODAL KHI BẤM NỀN (chỉ khi mousedown + click đều trên nền) ───────

  private backdropDown = false;

  onBackdropDown(e: MouseEvent): void {
    this.backdropDown = e.target === e.currentTarget;
  }

  onBackdropClick(e: MouseEvent, which: 'form' | 'detail' | 'delete'): void {
    const close = this.backdropDown && e.target === e.currentTarget;
    this.backdropDown = false;
    if (!close) return;
    if (which === 'form') this.closeFormModal();
    else if (which === 'detail') this.closeDetailModal();
    else this.cancelDelete();
  }

  // ─── THÔNG BÁO ─────────────────────────────────────────────────────────────

  dismissError(): void {
    this.errorMessage = '';
  }

  private showSuccess(msg: string): void {
    this.errorMessage = '';
    this.successMessage = msg;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.successMessage = '', 4000);
  }

  private reasonText(err: unknown, action: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return `${action}: không kết nối được máy chủ — kiểm tra mạng / ledger-rs.`;
      if (err.status === 401) return `${action}: phiên đăng nhập hết hạn — đăng nhập lại.`;
      if (err.status === 403) return `${action}: email này không có quyền dùng kế toán chi tiết.`;
      if (err.status >= 500) return `${action}: lỗi máy chủ, thử lại sau.`;
      return `${action}: ${err.error?.detail || httpErrorText(err)}`;
    }
    console.error(`${LOG} ${action}: lỗi không mong đợi`, err);
    return `${action}: ${(err as Error)?.message || err}`;
  }
}
