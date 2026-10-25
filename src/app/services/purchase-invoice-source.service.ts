import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { InvoiceServiceV2, PortalLink } from '../components/accountant-pages/invoice.service.v2';
import { BackgroundJobService, BgJob } from './background-job.service';
import { TienIchCacheService, CacheEntry } from './tien-ich-cache.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst, readInvoiceFiles } from '../utils/invoice-xml.util';
import { PurchaseInv } from '../utils/purchase-transfer-reconcile.util';
import { CountEmail } from '../utils/invoice-count.util';

/**
 * NGUỒN HĐ ĐẦU VÀO DÙNG CHUNG (23/10/2026) — Kiểm tra số lượng HĐ đầu vào (ledger-8) + Đối soát CK → Chuyển khoản HĐ đầu vào.
 * - Thư mục XML (app FDI, `…\purchase`): đọc trên trình duyệt, chạy nền, lưu IndexedDB khóa `xml-in` → đọc ở trang nào cũng dùng được
 *   ở trang kia.
 * - Gmail: /api/gmail/portal-links (+ scrape link cổng NCC chưa có số tiền), chạy nền, lưu khóa `gmail-links:<nhãn>:<từ>:<đến>`.
 */
const LOG = '[PurchaseSource]';
export const XML_IN_KEY = 'xml-in';

/** Đếm nhanh: email nhận trong kỳ (chỉ người gửi / tiêu đề / giờ) — /api/gmail/message-count */
export interface GmailCount { count: number; listed: number; truncated: boolean; emails: CountEmail[]; }

export interface CachedXml { folder: string; result: XmlReadResult; }

export interface GmailParams { label: string; labelId?: string; from: string; to: string; }

@Injectable({ providedIn: 'root' })
export class PurchaseInvoiceSourceService {
  private invoiceService = inject(InvoiceServiceV2);
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

  // ===== Gmail =====
  gmailKey(label: string, from: string, to: string): string {
    return `gmail-links:${label || '*'}:${from || ''}:${to || ''}`;
  }

  cachedGmail(p: GmailParams): Promise<CacheEntry<PortalLink[]> | null> {
    return this.cache.get<PortalLink[]>(this.gmailKey(p.label, p.from, p.to));
  }

  runningGmail(): BgJob<PortalLink[]> | undefined {
    return this.jobs.find<PortalLink[]>('gmail-links:');
  }

  /** Lấy Gmail của kỳ (chạy nền): email tới hết ngày `to`, từ ngày `from`; scrape link cổng NCC chưa có số tiền; ghi IndexedDB */
  startGmail(p: GmailParams): BgJob<PortalLink[]> {
    const key = this.gmailKey(p.label, p.from, p.to);
    const daysBack = p.from ? Math.max(1, Math.ceil((Date.now() - new Date(p.from).getTime()) / 86400000) + 1) : 30;
    return this.jobs.run<PortalLink[]>(key, `Lấy Gmail ${p.from} → ${p.to}`, { from: p.from, to: p.to, label: p.label }, async job => {
      const addLog = (msg: string) => job.log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      addLog(`Đang tải Gmail (daysBack=${daysBack})...`);
      const gmail = await firstValueFrom(this.invoiceService.getPortalLinksFromGmail({
        uid: localStorage.getItem('gmail_uid') || '', labelId: p.labelId, daysBack, pageSize: 500, parseAttachments: true,
        beforeDate: p.to || undefined,
      }));
      let links = gmail.portalLinks || [];
      addLog(`Gmail: ${links.length} portal links`);
      const toScrape = links.filter(pl => !pl.hasAmounts && !!pl.portalUrl)
        .map(pl => ({ gmailId: pl.gmailId, portalUrl: pl.portalUrl, provider: pl.invoiceProvider || '', credentials: pl.portalCredentials || {} }));
      if (!toScrape.length) {
        addLog('Không có portal nào cần scrape XML');
      } else {
        addLog(`Đang scrape XML từ ${toScrape.length} portal...`);
        try {
          const res = await firstValueFrom(this.invoiceService.scrapePortalXml(toScrape));
          const scraped = new Map((res.results || []).filter(r => r.success && r.amounts).map(r => [r.gmailId, r.amounts!]));
          addLog(`Scrape xong: ${scraped.size}/${toScrape.length} OK`);
          links = links.map(pl => scraped.has(pl.gmailId) ? { ...pl, ...scraped.get(pl.gmailId) } : pl);
        } catch (err: any) {
          addLog(`Scrape lỗi: ${err?.message || err}`);
        }
      }
      await this.cache.set<PortalLink[]>(key, links);
      console.log(`${LOG} Gmail ${p.from} → ${p.to}: ${links.length} email, ${links.filter(l => l.hasAmounts).length} có số tiền`);
      return links;
    });
  }

  /**
   * Email → HĐ dùng để đối soát tiền: chỉ email có số HĐ + số tiền; bỏ email trùng (cùng số + ký hiệu + MST NCC).
   * → { invoices, noAmount: email có số HĐ mà chưa có số tiền, noNumber: email không đọc được số HĐ }
   */
  static fromGmail(links: PortalLink[], from: string, to: string): { invoices: PurchaseInv[]; noAmount: number; noNumber: number } {
    const seen = new Set<string>();
    const invoices: PurchaseInv[] = [];
    let noAmount = 0, noNumber = 0;
    for (const pl of links) {
      const date = (pl.invoiceDate || pl.issueDate || '').slice(0, 10);
      if ((from && date < from) || (to && date > to)) continue;
      const digits = (pl.invoiceNo || '').split('-').pop()!.replace(/\D/g, '').replace(/^0+/, '');
      if (!digits) { noNumber++; continue; }
      if (!pl.hasAmounts || !pl.totalAmount) { noAmount++; continue; }
      const mst = (pl.supplierTaxCode || '').replace(/-\d+$/, '').trim();
      const symbol = (pl.invoiceSymbol || '').toUpperCase().replace(/^\d/, '');
      const key = `g|${mst}|${symbol}|${digits}`;
      if (seen.has(key)) continue;
      seen.add(key);
      invoices.push({ key, no: digits, symbol, date, sellerMst: mst, sellerName: pl.supplierName || pl.gmailFrom || '',
        total: Math.round(pl.totalAmount), source: 'gmail', gmailThreadId: pl.gmailThreadId || pl.gmailId });
    }
    return { invoices, noAmount, noNumber };
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
