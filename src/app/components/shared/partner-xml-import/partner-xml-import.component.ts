import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../../../services/company.service';
import { PartnerService } from '../../../services/partner.service';
import { httpErrorText } from '../../../services/auth.service';
import { LocalXmlInvoice, readInvoiceFiles } from '../../../utils/invoice-xml.util';
import { PartnerImportItem, PartnerImportResult, normalizeTaxCode } from '../../../models/partner.models';

const LOG = '[PartnerXmlImport]';
const MAX_ITEMS = 5000;

interface Candidate extends PartnerImportItem {
  invoices: number;   // số HĐ có MST này
}

/**
 * TẠO NCC / KH TỪ XML HÓA ĐƠN (spec 002, R11) — dùng ở trang Nhà cung cấp (role SUPPLIER) và Khách hàng (role CUSTOMER).
 * Đọc thư mục / ZIP / RAR trên trình duyệt (`readInvoiceFiles`), tách HĐ vào / ra theo MST công ty (KHÔNG theo trang đang mở):
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
export class PartnerXmlImportComponent {
  @Input({ required: true }) role!: 'SUPPLIER' | 'CUSTOMER';
  /** số đối tượng vừa tạo */
  @Output() imported = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  private company = inject(CompanyService);
  private partners = inject(PartnerService);

  busy = false;
  progress = '';
  error = '';
  success = '';

  folder = '';
  nFiles = 0;
  nReadErrors = 0;
  nMatched = 0;       // HĐ đúng chiều
  nWrongDir = 0;      // HĐ sai chiều (đầu ra ở trang NCC / đầu vào ở trang KH)
  nOther = 0;         // HĐ không liên quan MST công ty
  nNoMst = 0;         // HĐ đúng chiều nhưng đối tác không có MST
  candidates: Candidate[] = [];
  preview: PartnerImportResult | null = null;

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

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.reset();
    const mst = this.companyMst;
    if (!mst) {
      this.error = 'Chưa nhập MST công ty — bấm "MST" ở góc dưới thanh menu để nhập, rồi chọn lại thư mục.';
      console.warn(`${LOG} ${this.role}: chưa có MST công ty → không tách được HĐ vào / ra`);
      return;
    }
    this.folder = (files[0] as any).webkitRelativePath?.split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} file`);
    this.busy = true;
    try {
      console.info(`${LOG} ${this.role}: đọc ${files.length} file`);
      const r = await readInvoiceFiles(files, (d, t) => this.progress = `${d}/${t} file`);
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
    if (!this.preview?.create.length || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await firstValueFrom(this.partners.importXml(this.role, this.candidates, false));
      this.preview = r;
      this.success = `Đã tạo ${r.create.length} ${this.roleLabel}` + (r.skip.length ? `, bỏ qua ${r.skip.length} MST.` : '.');
      console.info(`${LOG} ${this.role}: đã tạo ${r.create.length}, bỏ qua ${r.skip.length}`);
      this.imported.emit(r.create.length);
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
