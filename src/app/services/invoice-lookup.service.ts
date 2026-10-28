import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { LocalXmlInvoice } from '../utils/invoice-xml.util';
import { GDT_LOOKUP_URL, LookupPortal } from '../utils/invoice-lookup.util';

/**
 * LINK HĐ GỐC (28/10/2026) — KeToanBackEnd /api/invoice-lookups (Firestore `invoice_lookups`): mã / link tra cứu lấy từ XML (đầu vào)
 * hoặc HĐĐT KiotViet (đầu ra, `verify_code`) → lưu máy chủ để kế toán ở máy khác xem lại link HĐ gốc không phải chọn lại thư mục.
 * Máy chủ ghi merge: trường rỗng không đè mã đã lưu.
 * 28/10/2026: link tra cứu kế toán gán tay (`/portals`, theo NCC HĐĐT hoặc người bán) + link riêng 1 HĐ (`manual_url`).
 */
const LOG = '[InvoiceLookup]';
const BASE = `${environment.ketoanBackendUrl}/api/invoice-lookups`;
const CHUNK = 2000;

export type LookupDir = 'in' | 'out';

export interface SavedLookup {
  id: string; dir: LookupDir; date: string;
  seller_mst: string; seller_name?: string; buyer_mst?: string; template?: string; series?: string; number: number | string;
  total_before_vat?: number; vat?: number; total?: number; mccqt?: string;
  tcgp?: string; provider?: string; code?: string; code_field?: string; url?: string; direct?: boolean;
  einvoice_id?: string; kv_code?: string; manual_url?: string; updated_at?: string; updated_by?: string;
}

export type LookupItem = Omit<SavedLookup, 'id' | 'dir' | 'manual_url' | 'updated_at' | 'updated_by'>;

/** Khóa so 1 HĐ giữa XML ⇄ bản lưu (giống doc id phía máy chủ, không có chiều) */
export function lookupKey(sellerMst: string, template: string, series: string, no: number | string): string {
  return `${sellerMst}|${template || ''}${(series || '').toUpperCase()}|${Number(no)}`;
}

/** HĐ XML → bản gửi lưu (chỉ số liệu nhận diện + tổng tiền + mã tra cứu; không gửi tên người mua) */
export function fromXml(i: LocalXmlInvoice): LookupItem {
  const l = i.lookup;
  return {
    date: i.tdlap, seller_mst: i.nbmst, seller_name: i.nbten, buyer_mst: i.nmmst, template: i.khmshdon, series: i.khhdon,
    number: i.shdon, total_before_vat: i.tgtcthue, vat: i.tgtthue, total: i.tgtttbso, mccqt: i.mccqt || '',
    tcgp: l?.tcgp || '', provider: l?.provider || '', code: l?.code || '', code_field: l?.codeField || '', url: l?.url || '',
    direct: l ? l.direct : undefined,
  };
}

/** Thông tin để tra cứu ở cổng CQT (HĐ không có mã tra cứu) — chép vào clipboard */
export function gdtLookupText(x: { seller_mst: string; template?: string; series?: string; number: number | string; vat?: number; total?: number }): string {
  return `MST bán ${x.seller_mst} · Ký hiệu ${x.template || ''}${x.series || ''} · Số ${x.number} · Tiền thuế ${Math.round(x.vat || 0)}`
    + ` · Tổng thanh toán ${Math.round(x.total || 0)}`;
}

export { GDT_LOOKUP_URL };
export type { LookupPortal };

@Injectable({ providedIn: 'root' })
export class InvoiceLookupService {
  private http = inject(HttpClient);

  async list(dir: LookupDir, from: string, to: string): Promise<SavedLookup[]> {
    const params = new HttpParams().set('direction', dir).set('from', from).set('to', to);
    const r = await firstValueFrom(this.http.get<{ items: SavedLookup[] }>(BASE, { params }));
    console.info(`${LOG} Đọc link HĐ gốc ${dir} ${from} → ${to}: ${r.items.length} HĐ`);
    return r.items || [];
  }

  /** Gửi theo từng gói CHUNK HĐ. Trả tổng {saved, skipped}. */
  async save(dir: LookupDir, items: LookupItem[]): Promise<{ saved: number; skipped: number }> {
    let saved = 0, skipped = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const r = await firstValueFrom(this.http.post<{ saved: number; skipped: number }>(`${BASE}/batch`,
        { direction: dir, items: items.slice(i, i + CHUNK) }));
      saved += r.saved;
      skipped += r.skipped;
    }
    console.info(`${LOG} Lưu link HĐ gốc ${dir}: ${saved} HĐ (${items.filter(x => x.code).length} có mã), bỏ ${skipped}`);
    return { saved, skipped };
  }

  async listPortals(): Promise<LookupPortal[]> {
    const r = await firstValueFrom(this.http.get<{ items: LookupPortal[] }>(`${BASE}/portals`));
    console.info(`${LOG} Đọc ${r.items?.length || 0} link tra cứu gán tay`);
    return r.items || [];
  }

  async savePortal(scope: LookupPortal['scope'], mst: string, name: string, url: string): Promise<LookupPortal> {
    const r = await firstValueFrom(this.http.put<{ item: LookupPortal }>(`${BASE}/portals`, { scope, mst, name, url }));
    console.info(`${LOG} Gán link tra cứu ${r.item.id} (${url.includes('{code}') ? 'mở thẳng bằng mã' : 'trang tra cứu'})`);
    return r.item;
  }

  async deletePortal(scope: LookupPortal['scope'], mst: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${BASE}/portals/${scope}/${encodeURIComponent(mst)}`));
    console.info(`${LOG} Xóa link tra cứu ${scope}-${mst}`);
  }

  /** Link riêng 1 HĐ đã lưu (url '' = xóa) */
  async setManualUrl(dir: LookupDir, x: { seller_mst: string; template: string; series: string; number: number }, url: string): Promise<void> {
    await firstValueFrom(this.http.put(`${BASE}/manual-url`, { direction: dir, ...x, url }));
    console.info(`${LOG} ${url ? 'Gán' : 'Xóa'} link riêng HĐ ${x.seller_mst} ${x.template}${x.series}-${x.number}`);
  }
}
