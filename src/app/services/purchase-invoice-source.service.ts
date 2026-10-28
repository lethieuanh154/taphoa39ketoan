import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { BackgroundJobService, BgJob } from './background-job.service';
import { TienIchCacheService, CacheEntry } from './tien-ich-cache.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst, readInvoiceFiles } from '../utils/invoice-xml.util';
import { PurchaseInv } from '../utils/purchase-transfer-reconcile.util';
import { CountEmail } from '../utils/invoice-count.util';

/**
 * NGUỒN HĐ ĐẦU VÀO DÙNG CHUNG (23/10/2026) — Kiểm tra số lượng HĐ đầu vào (ledger-8) + Đối soát CK → Chuyển khoản HĐ đầu vào.
 * - Thư mục XML (app FDI, `…\purchase`): đọc trên trình duyệt, chạy nền, lưu IndexedDB khóa `xml-in` → đọc ở trang nào cũng dùng được
 *   ở trang kia.
 * - Gmail: chỉ còn Đếm nhanh (/api/gmail/message-count, khóa `gmail-count:<nhãn>:<từ>:<đến>`). 28/10/2026 bỏ nguồn portal-links
 *   (đọc email + scrape cổng NCC) — link HĐ gốc lấy từ mã tra cứu trong XML (InvoiceLookupService).
 */
const LOG = '[PurchaseSource]';
export const XML_IN_KEY = 'xml-in';

/** Đếm nhanh: email nhận trong kỳ (chỉ người gửi / tiêu đề / giờ) — /api/gmail/message-count */
export interface GmailCount { count: number; listed: number; truncated: boolean; emails: CountEmail[]; }

export interface CachedXml { folder: string; result: XmlReadResult; }

export interface GmailParams { label: string; labelId?: string; from: string; to: string; }

@Injectable({ providedIn: 'root' })
export class PurchaseInvoiceSourceService {
  private jobs = inject(BackgroundJobService);
  private cache = inject(TienIchCacheService);
  private http = inject(HttpClient);

  // ===== XML =====
  /** Đọc thư mục XML (chạy nền; đang đọc thì dùng lại việc đang chạy) */
  startXml(files: File[], folder: string): BgJob<CachedXml> {
    return this.jobs.run<CachedXml>(XML_IN_KEY, `Đọc thư mục XML đầu vào "${folder}"`, { folder }, async j => {
      const result = await readInvoiceFiles(files, (d, t) => j.progress = `${d}/${t} file`);
      await this.cache.set<CachedXml>(XML_IN_KEY, { folder, result });
      return { folder, result };
    });
  }

  runningXml(): BgJob<CachedXml> | undefined {
    return this.jobs.get<CachedXml>(XML_IN_KEY);
  }

  cachedXml(): Promise<CacheEntry<CachedXml> | null> {
    return this.cache.get<CachedXml>(XML_IN_KEY);
  }

  /** HĐ đầu vào của công ty (bên mua = MST công ty; chưa nhập MST → bên mua gặp nhiều nhất) */
  xmlPurchases(r: XmlReadResult, companyMst: string): { mst: string; detected: string; invoices: LocalXmlInvoice[] } {
    const detected = detectCompanyMst(r.invoices, 'buyer');
    const mst = companyMst || detected;
    return { mst, detected, invoices: r.invoices.filter(i => !mst || i.nmmst === mst) };
  }

  static fromXml(i: LocalXmlInvoice): PurchaseInv {
    return { key: `x|${i.nbmst}|${i.khhdon}|${i.shdon}`, no: String(i.shdon), symbol: i.khhdon, date: i.tdlap, sellerMst: i.nbmst,
      sellerName: i.nbten, total: Math.round(i.tgtttbso || 0), source: 'xml' };
  }

  // ===== Đếm nhanh (25/10/2026) =====
  gmailCountKey(label: string, from: string, to: string): string {
    return `gmail-count:${label || '*'}:${from}:${to}`;
  }

  cachedGmailCount(p: GmailParams): Promise<CacheEntry<GmailCount> | null> {
    return this.cache.get<GmailCount>(this.gmailCountKey(p.label, p.from, p.to));
  }

  runningGmailCount(): BgJob<GmailCount> | undefined {
    return this.jobs.find<GmailCount>('gmail-count:');
  }

  /** Đếm email nhận trong [from, to] (giờ VN) — chỉ header, không nội dung / đính kèm; chạy nền, lưu IndexedDB */
  startGmailCount(p: GmailParams): BgJob<GmailCount> {
    const key = this.gmailCountKey(p.label, p.from, p.to);
    return this.jobs.run<GmailCount>(key, `Đếm email Gmail ${p.from} → ${p.to}`, { from: p.from, to: p.to, label: p.label }, async () => {
      let params = new HttpParams().set('from', p.from).set('to', p.to);
      if (p.labelId) params = params.set('label_id', p.labelId);
      const t0 = performance.now();
      const r = await firstValueFrom(this.http.get<GmailCount>(`${environment.ketoanBackendUrl}/api/gmail/message-count`, { params }));
      const data: GmailCount = { count: r.count, listed: r.listed, truncated: r.truncated, emails: r.emails || [] };
      await this.cache.set<GmailCount>(key, data);
      console.log(`${LOG} Đếm email ${p.from} → ${p.to}: ${data.count} email (${((performance.now() - t0) / 1000).toFixed(1)} giây)`
        + (data.truncated ? ' — CHẠM GIỚI HẠN, chia kỳ nhỏ hơn' : ''));
      return data;
    });
  }
}
