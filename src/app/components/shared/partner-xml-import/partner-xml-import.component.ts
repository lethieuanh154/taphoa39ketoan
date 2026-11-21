import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../../../services/company.service';
import { PartnerService } from '../../../services/partner.service';
import { httpErrorText } from '../../../services/auth.service';
import { CachedXml, PurchaseInvoiceSourceService } from '../../../services/purchase-invoice-source.service';
import { SaleInvoiceSourceService } from '../../../services/sale-invoice-source.service';
import { BgJob } from '../../../services/background-job.service';
import { LocalXmlInvoice, XmlReadResult } from '../../../utils/invoice-xml.util';
import { PartnerImportItem, PartnerImportResult, normalizeTaxCode } from '../../../models/partner.models';

const LOG = '[PartnerXmlImport]';
const MAX_ITEMS = 5000;

interface Candidate extends PartnerImportItem {
  invoices: number;   // số HĐ có MST này
}

/**
 * TẠO NCC / KH TỪ XML HÓA ĐƠN (spec 002, R11) — dùng ở trang Nhà cung cấp (role SUPPLIER) và Khách hàng (role CUSTOMER).
 * Nguồn XML = cache IndexedDB DÙNG CHUNG với Tiện ích (18/11/2026, chỉ đọc XML 1 lần): NCC ← `xml-in` (PurchaseInvoiceSourceService —
 * Kiểm tra số lượng HĐ đầu vào, Đối soát CK HĐ vào), KH ← `xml-out` (SaleInvoiceSourceService — HĐ đầu ra, Đối soát CK bán ra).
 * Đã có → dùng ngay; chọn thư mục mới trong hộp → đọc qua `startXml()` (chạy nền, ghi luôn vào cache cho các trang kia).
 * Tách HĐ vào / ra theo MST công ty (KHÔNG theo trang đang mở):
 *  - SUPPLIER: HĐ đầu vào (bên mua = công ty) → MST / tên / địa chỉ người bán.
 *  - CUSTOMER: HĐ đầu ra (bên bán = công ty) → người mua CÓ MST.
 * HĐ sai chiều bị bỏ qua và báo số lượng (AC12). Chỉ gửi MST / tên / địa chỉ đã gộp theo MST lên BE, không gửi nội dung HĐ.
 * Xem trước (`dry_run`) → Xác nhận (ghi, BE tính lại từ đầu) → emit `imported`.
 */
@Component({
  selector: 'app-partner-xml-import',
  standalone: true,
  templateUrl: './partner-xml-import.component.html',
  styleUrls: ['./partner-xml-import.component.css']
})
export class PartnerXmlImportComponent implements OnInit {
  @Input({ required: true }) role!: 'SUPPLIER' | 'CUSTOMER';
  /** số đối tượng vừa tạo */
  @Output() imported = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  private company = inject(CompanyService);
  private partners = inject(PartnerService);
  private purchaseSource = inject(PurchaseInvoiceSourceService);
  private saleSource = inject(SaleInvoiceSourceService);

  busy = false;
  progress = '';
  error = '';
  success = '';
  /** việc đọc XML chạy nền đang theo dõi (tiến độ lấy trực tiếp từ job) */
  job: BgJob<CachedXml> | null = null;

  /** XML đã đọc sẵn trong cache dùng chung (null = chưa có) */
  cached: { folder: string; invoices: number; savedAt: number; data: CachedXml } | null = null;
  /** cache đọc trước 17/11/2026 (chưa có trường địa chỉ) */
  noAddress = false;

  folder = '';
  nFiles = 0;
  nReadErrors = 0;
  nMatched = 0;       // HĐ đúng chiều
  nWrongDir = 0;      // HĐ sai chiều (đầu ra ở trang NCC / đầu vào ở trang KH)
  nOther = 0;         // HĐ không liên quan MST công ty
  nNoMst = 0;         // HĐ đúng chiều nhưng đối tác không có MST
  candidates: Candidate[] = [];
  preview: PartnerImportResult | null = null;
  /** mã ở nhóm "Khác thông tin" kế toán tick để cập nhật theo XML (mặc định không tick dòng nào) */
  selectedUpdates = new Set<string>();

  get canConfirm(): boolean {
    return !!this.preview?.dryRun && (this.preview.create.length > 0 || this.selectedUpdates.size > 0);
  }

  get allUpdatesSelected(): boolean {
    const u = this.preview?.update ?? [];
    return u.length > 0 && u.every(x => this.selectedUpdates.has(x.code));
  }

  toggleUpdate(code: string): void {
    if (this.selectedUpdates.has(code)) this.selectedUpdates.delete(code);
    else this.selectedUpdates.add(code);
  }

  toggleAllUpdates(): void {
    const all = this.allUpdatesSelected;
    this.selectedUpdates = new Set(all ? [] : (this.preview?.update ?? []).map(u => u.code));
  }

  get companyMst(): string {
    return this.company.mst();
  }

  get isSupplier(): boolean {
    return this.role === 'SUPPLIER';
  }

  get roleLabel(): string {
    return this.isSupplier ? 'nhà cung cấp' : 'khách hàng';
  }

  get dirLabel(): string {
    return this.isSupplier ? 'HĐ đầu vào' : 'HĐ đầu ra';
  }

  get wrongDirLabel(): string {
    return this.isSupplier ? 'HĐ đầu ra' : 'HĐ đầu vào';
  }

  invoicesOf(taxCode: string): number {
    return this.candidates.find(c => c.taxCode === taxCode)?.invoices ?? 0;
  }

  /** Nguồn XML dùng chung theo vai: NCC = HĐ đầu vào (`xml-in`), KH = HĐ đầu ra (`xml-out`) */
  private get source(): PurchaseInvoiceSourceService | SaleInvoiceSourceService {
    return this.isSupplier ? this.purchaseSource : this.saleSource;
  }

  get sourceLabel(): string {
    return this.isSupplier ? '"Kiểm tra số lượng HĐ đầu vào" / Đối soát CK HĐ vào' : '"Kiểm tra số lượng HĐ đầu ra" / Đối soát CK bán ra';
  }

  get progressText(): string {
    return this.job?.progress || this.progress;
  }

  get cachedAtText(): string {
    return this.cached ? new Date(this.cached.savedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  }

  async ngOnInit(): Promise<void> {
    // Đang có việc đọc XML chạy nền (vd vừa chọn ở trang Tiện ích) → chờ xong rồi dùng
    const running = this.source.runningXml();
    if (running) {
      console.info(`${LOG} ${this.role}: đang có việc đọc XML chạy nền "${running.meta['folder'] ?? ''}" → chờ`);
      this.busy = true;
      this.job = running;
      try {
        await running.promise;
      } catch (e) {
        console.warn(`${LOG} ${this.role}: việc đọc XML chạy nền lỗi`, e);
      } finally {
        this.busy = false;
        this.job = null;
      }
    }
    await this.loadCached();
  }

  private async loadCached(): Promise<void> {
    try {
      const c = await this.source.cachedXml();
      if (!c?.data?.result) {
        this.cached = null;
        console.info(`${LOG} ${this.role}: chưa có XML đọc sẵn trong cache`);
        return;
      }
      this.cached = { folder: c.data.folder, invoices: c.data.result.invoices.length, savedAt: c.savedAt, data: c.data };
      console.info(`${LOG} ${this.role}: có XML đọc sẵn "${c.data.folder}" — ${this.cached.invoices} HĐ`);
    } catch (e) {
      this.cached = null;
      console.warn(`${LOG} ${this.role}: đọc cache XML lỗi (bỏ qua, chọn thư mục để đọc mới)`, e);
    }
  }

  /** Dùng XML đã đọc sẵn (không chọn lại thư mục) */
  async useCached(): Promise<void> {
    if (!this.cached || this.busy) return;
    console.info(`${LOG} ${this.role}: dùng XML đọc sẵn "${this.cached.folder}"`);
    this.reset();
    await this.process(this.cached.data.result, this.cached.data.folder);
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.reset();
    if (!this.companyMst) {
      this.error = 'Chưa nhập MST công ty — bấm "MST" ở góc dưới thanh menu để nhập, rồi chọn lại thư mục.';
      console.warn(`${LOG} ${this.role}: chưa có MST công ty → không tách được HĐ vào / ra`);
      return;
    }
    const folder = (files[0] as any).webkitRelativePath?.split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} file`);
    this.busy = true;
    let data: CachedXml;
    try {
      console.info(`${LOG} ${this.role}: đọc mới ${files.length} file → ghi cache dùng chung`);
      // chạy nền + ghi IndexedDB (xml-in / xml-out) → các trang Tiện ích dùng lại được
      this.job = this.source.startXml(files, folder);
      data = await this.job.promise;
    } catch (e) {
      this.error = this.reasonText(e, 'Đọc XML');
      console.error(`${LOG} ${this.role}: đọc XML lỗi`, e);
      this.busy = false;
      return;
    } finally {
      this.job = null;
    }
    this.busy = false;
    await this.loadCached();
    await this.process(data.result, data.folder);
  }

  /** Tách đúng chiều theo MST công ty → gộp theo MST → xem trước (dry_run) */
  private async process(r: XmlReadResult, folder: string): Promise<void> {
    const mst = this.companyMst;
    if (!mst) {
      this.error = 'Chưa nhập MST công ty — bấm "MST" ở góc dưới thanh menu để nhập.';
      console.warn(`${LOG} ${this.role}: chưa có MST công ty → không tách được HĐ vào / ra`);
      return;
    }
    this.folder = folder;
    // cache đọc trước 17/11/2026 không có nbdchi / nmdchi (trường địa chỉ thêm ở T06)
    this.noAddress = r.invoices.length > 0 && !r.invoices.some(i => 'nbdchi' in i || 'nmdchi' in i);
    if (this.noAddress) console.warn(`${LOG} ${this.role}: XML trong cache đọc từ trước 17/11/2026 — không có địa chỉ`);
    this.busy = true;
    try {
      this.nFiles = r.nFiles;
      this.nReadErrors = r.errors.length;
      if (r.errors.length) console.warn(`${LOG} ${r.errors.length} file XML lỗi`, r.errors.slice(0, 5));
      this.collect(r.invoices, mst);
      console.info(`${LOG} ${this.role}: ${r.invoices.length} HĐ → đúng chiều ${this.nMatched}, sai chiều ${this.nWrongDir}, ` +
        `khác ${this.nOther}, không MST ${this.nNoMst} → ${this.candidates.length} MST`);
      if (!this.candidates.length) {
        this.error = this.nMatched
          ? `Các ${this.dirLabel} không có MST ${this.isSupplier ? 'người bán' : 'người mua'} nào.`
          : `Không có ${this.dirLabel} nào của MST công ty ${mst} trong thư mục đã chọn.`;
        return;
      }
      if (this.candidates.length > MAX_ITEMS) {
        this.error = `Có ${this.candidates.length} MST, tối đa ${MAX_ITEMS} mỗi lần — chọn thư mục nhỏ hơn (vd theo quý).`;
        console.warn(`${LOG} ${this.role}: ${this.candidates.length} MST > ${MAX_ITEMS}`);
        return;
      }
      this.progress = 'xem trước';
      this.preview = await firstValueFrom(this.partners.importXml(this.role, this.candidates, true));
    } catch (e) {
      this.error = this.reasonText(e, 'Đọc XML / xem trước');
      if (!(e instanceof HttpErrorResponse)) console.error(`${LOG} ${this.role}: đọc XML lỗi`, e);
    } finally {
      this.busy = false;
      this.progress = '';
    }
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm || this.busy) return;
    this.busy = true;
    this.error = '';
    const ticked = [...this.selectedUpdates];
    try {
      const r = await firstValueFrom(this.partners.importXml(this.role, this.candidates, false, ticked));
      this.preview = r;
      const applied = r.update.filter(u => u.applied).length;
      this.success = `Đã tạo ${r.create.length} ${this.roleLabel}` + (applied ? `, cập nhật ${applied} theo XML` : '')
        + (r.skip.length ? `, bỏ qua ${r.skip.length} MST.` : '.');
      if (applied < ticked.length) {
        console.warn(`${LOG} ${this.role}: tick ${ticked.length} nhưng chỉ cập nhật ${applied} (thông tin đã giống / lỗi — xem nhóm Bỏ qua)`);
      }
      console.info(`${LOG} ${this.role}: đã tạo ${r.create.length}, cập nhật ${applied}, bỏ qua ${r.skip.length}`);
      this.imported.emit(r.create.length + applied);
    } catch (e) {
      this.error = this.reasonText(e, 'Tạo ' + this.roleLabel);
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  /** Lọc HĐ đúng chiều theo MST công ty, gộp đối tác theo MST (tên / địa chỉ: lấy giá trị khác rỗng đầu tiên) */
  private collect(invoices: LocalXmlInvoice[], mst: string): void {
    const byTax = new Map<string, Candidate>();
    for (const inv of invoices) {
      const isIn = inv.nmmst === mst;    // công ty là bên mua
      const isOut = inv.nbmst === mst;   // công ty là bên bán
      const match = this.isSupplier ? isIn && !isOut : isOut && !isIn;
      if (!match) {
        if ((this.isSupplier && isOut) || (!this.isSupplier && isIn)) this.nWrongDir++;
        else this.nOther++;
        continue;
      }
      this.nMatched++;
      const tax = normalizeTaxCode(this.isSupplier ? inv.nbmst : inv.nmmst);
      const name = ((this.isSupplier ? inv.nbten : inv.nmten) || '').trim();
      const address = ((this.isSupplier ? inv.nbdchi : inv.nmdchi) || '').trim();
      if (!tax) {
        this.nNoMst++;
        continue;
      }
      const c = byTax.get(tax);
      if (c) {
        c.invoices++;
        if (!c.name && name) c.name = name;
        if (!c.address && address) c.address = address;
      } else {
        byTax.set(tax, { taxCode: tax, name, address, invoices: 1 });
      }
    }
    this.candidates = [...byTax.values()].sort((a, b) => b.invoices - a.invoices);
  }

  private reset(): void {
    this.error = '';
    this.success = '';
    this.folder = '';
    this.nFiles = this.nReadErrors = this.nMatched = this.nWrongDir = this.nOther = this.nNoMst = 0;
    this.candidates = [];
    this.preview = null;
    this.selectedUpdates = new Set();
    this.noAddress = false;
  }

  private reasonText(err: unknown, action: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return `${action}: không kết nối được máy chủ ledger — kiểm tra mạng / ledger-rs.`;
      if (err.status === 401) return `${action}: phiên đăng nhập hết hạn — đăng nhập lại.`;
      if (err.status === 403) return `${action}: email này không có quyền dùng kế toán chi tiết.`;
      if (err.status >= 500) return `${action}: lỗi máy chủ, thử lại sau.`;
      return `${action}: ${err.error?.detail || httpErrorText(err)}`;
    }
    return `${action}: ${(err as Error)?.message || err}`;
  }
}
