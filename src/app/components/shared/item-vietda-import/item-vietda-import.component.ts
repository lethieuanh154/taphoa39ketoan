import { Component, EventEmitter, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ItemService } from '../../../services/item.service';
import { ReconciliationService } from '../../../services/reconciliation.service';
import { httpErrorText } from '../../../services/auth.service';
import { MasterImportResult, MasterImportRow, VietdaImportResult } from '../../../models/item.models';

const LOG = '[ItemVietdaImport]';
const SHOW_MAX = 200;

/** Dòng bảng ghép Firestore (`GET /api/vietda-codes`) — `HhCode` của ReconciliationService không khai các trường này */
interface HhRow {
  hh: string;
  master_code: string;
  source?: string;
  he_so?: number | null;
  kv_unit?: string;
  master_id?: number | null;
}

/**
 * NẠP DANH MỤC HÀNG HÓA TỪ VIETDA (spec 003, R10) — nhúng ở trang Hàng hóa.
 * Bước 1: file DM Vietda (VAT TU HH.xlsx) → ledger-rs đọc → xem trước (tạo / khác thông tin — tick mới cập nhật / bỏ qua) → Xác nhận.
 * Bước 2: bảng ghép mã master đang có ở Firestore (FastAPI `/api/vietda-codes`, source vietda / manual) → xem trước (gán / bổ sung
 * masterId / xung đột / bỏ qua) → Xác nhận. Chạy lại an toàn (nạp bổ sung phần ghép làm thêm ở Đối soát XML khi còn 2 nơi).
 */
@Component({
  selector: 'app-item-vietda-import',
  standalone: true,
  templateUrl: './item-vietda-import.component.html',
  styleUrls: ['./item-vietda-import.component.css']
})
export class ItemVietdaImportComponent {
  /** số mặt hàng tạo + cập nhật + mã master gán */
  @Output() imported = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  private items = inject(ItemService);
  private recon = inject(ReconciliationService);

  readonly showMax = SHOW_MAX;
  busy = false;
  error = '';
  success = '';

  // Bước 1
  file: File | null = null;
  vd: VietdaImportResult | null = null;
  selectedUpdates = new Set<string>();

  // Bước 2
  masterRows: MasterImportRow[] = [];
  masterSourceInfo = '';
  mi: MasterImportResult | null = null;

  get selectableUpdates(): string[] {
    return (this.vd?.update ?? []).filter(u => !(u.unitLocked && u.fields.length === 1)).map(u => u.code);
  }

  get allUpdatesSelected(): boolean {
    const s = this.selectableUpdates;
    return s.length > 0 && s.every(c => this.selectedUpdates.has(c));
  }

  toggleUpdate(code: string): void {
    if (this.selectedUpdates.has(code)) this.selectedUpdates.delete(code);
    else this.selectedUpdates.add(code);
  }

  toggleAllUpdates(): void {
    this.selectedUpdates = new Set(this.allUpdatesSelected ? [] : this.selectableUpdates);
  }

  get canConfirmVd(): boolean {
    return !!this.vd?.dryRun && (this.vd.create.length > 0 || this.selectedUpdates.size > 0);
  }

  // ─── Bước 1: file DM Vietda ─────────────────────────────────────────────────

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.file = f;
    this.vd = null;
    this.selectedUpdates = new Set();
    this.error = '';
    this.success = '';
    console.info(`${LOG} chọn file DM Vietda ${f.size} byte`);
    await this.previewVd();
  }

  private async previewVd(): Promise<void> {
    if (!this.file) return;
    this.busy = true;
    try {
      this.vd = await firstValueFrom(this.items.importVietda(this.file, true));
    } catch (e) {
      this.error = this.reasonText(e, 'Đọc file danh mục Vietda');
    } finally {
      this.busy = false;
    }
  }

  async confirmVd(): Promise<void> {
    if (!this.file || !this.canConfirmVd || this.busy) return;
    this.busy = true;
    this.error = '';
    const ticked = [...this.selectedUpdates];
    try {
      const r = await firstValueFrom(this.items.importVietda(this.file, false, ticked));
      this.vd = r;
      const applied = r.update.filter(u => u.applied).length;
      this.success = `Đã tạo ${r.create.length} mặt hàng` + (applied ? `, cập nhật ${applied} theo file` : '') + '.';
      console.info(`${LOG} DM Vietda: tạo ${r.create.length}, cập nhật ${applied} (tick ${ticked.length})`);
      this.imported.emit(r.create.length + applied);
    } catch (e) {
      this.error = this.reasonText(e, 'Nạp danh mục Vietda');
    } finally {
      this.busy = false;
    }
  }

  // ─── Bước 2: ghép mã master từ Firestore ────────────────────────────────────

  async loadMasters(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    this.mi = null;
    try {
      const status = await firstValueFrom(this.recon.hhStatus());
      const rows = (await this.recon.hhCodes(status)) as unknown as HhRow[];
      const own = rows.filter(r => (r.source === 'vietda' || r.source === 'manual') && !!r.hh && !!r.master_code);
      this.masterRows = own.map(r => ({
        masterCode: r.master_code,
        masterId: r.master_id ?? undefined,
        hh: r.hh,
        kvUnit: r.kv_unit || undefined,
        heSo: r.he_so ?? null
      }));
      this.masterSourceInfo = `${own.length} / ${rows.length} dòng có mã HH / KM (version ${status.version})`;
      console.info(`${LOG} bảng ghép Firestore: ${rows.length} dòng → ${own.length} có mã (vietda / manual)`);
      if (!own.length) {
        this.error = 'Bảng ghép mã master ở Đối soát XML chưa có dòng nào có mã HH / KM.';
        return;
      }
      this.mi = await firstValueFrom(this.items.importMasters(this.masterRows, true));
    } catch (e) {
      this.error = this.reasonText(e, 'Lấy / xem trước bảng ghép mã master');
    } finally {
      this.busy = false;
    }
  }

  get canConfirmMi(): boolean {
    return !!this.mi?.dryRun && (this.mi.link.length > 0 || this.mi.filledId > 0);
  }

  async confirmMi(): Promise<void> {
    if (!this.canConfirmMi || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await firstValueFrom(this.items.importMasters(this.masterRows, false));
      this.mi = r;
      this.success = `Đã gán ${r.link.length} mã master` + (r.filledId ? `, bổ sung masterId ${r.filledId}` : '') +
        (r.conflict.length ? `, ${r.conflict.length} xung đột (xem bảng).` : '.');
      console.info(`${LOG} ghép mã master: gán ${r.link.length}, bổ sung id ${r.filledId}, xung đột ${r.conflict.length}`);
      this.imported.emit(r.link.length);
    } catch (e) {
      this.error = this.reasonText(e, 'Nạp ghép mã master');
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  private reasonText(err: unknown, action: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return `${action}: không kết nối được máy chủ — kiểm tra mạng / ledger-rs / FastAPI.`;
      if (err.status === 401) return `${action}: phiên đăng nhập hết hạn — đăng nhập lại.`;
      if (err.status === 403) return `${action}: email này không có quyền.`;
      if (err.status === 413) return `${action}: file quá lớn (tối đa 10 MB).`;
      if (err.status >= 500) return `${action}: lỗi máy chủ, thử lại sau.`;
      return `${action}: ${err.error?.detail || httpErrorText(err)}`;
    }
    console.error(`${LOG} ${action}: lỗi không mong đợi`, err);
    return `${action}: ${(err as Error)?.message || err}`;
  }
}
