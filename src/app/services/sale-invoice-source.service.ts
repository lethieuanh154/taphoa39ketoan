import { inject, Injectable } from '@angular/core';
import { BackgroundJobService, BgJob } from './background-job.service';
import { TienIchCacheService, CacheEntry } from './tien-ich-cache.service';
import { CachedXml } from './purchase-invoice-source.service';
import { LocalXmlInvoice, XmlReadResult, detectCompanyMst, readInvoiceFiles } from '../utils/invoice-xml.util';
import { ReconInvoice } from '../utils/transfer-reconcile.util';

/**
 * NGUỒN HĐ ĐẦU RA CHO ĐỐI SOÁT CK (13/11/2026 — kế toán đối soát theo XML, không lấy từ einvoiceapp như BanHang).
 * Thư mục XML (app FDI, `…\sold`): đọc trên trình duyệt, chạy nền, lưu IndexedDB khóa `xml-out` — CÙNG khóa với trang
 * "Kiểm tra số lượng HĐ đầu ra" (ledger-9) nên đọc ở trang nào cũng dùng được ở trang kia.
 * XML chỉ có NGÀY lập (NLap = ngày phát hành), không có giờ bán / mã HĐ KiotViet / ghi chú → khớp theo số tiền + ngày.
 */
const LOG = '[SaleSource]';
export const XML_OUT_KEY = 'xml-out';

export type SalePayment = 'CK' | 'TM' | 'TMCK' | '';

@Injectable({ providedIn: 'root' })
export class SaleInvoiceSourceService {
  private jobs = inject(BackgroundJobService);
  private cache = inject(TienIchCacheService);

  startXml(files: File[], folder: string): BgJob<CachedXml> {
    return this.jobs.run<CachedXml>(XML_OUT_KEY, `Đọc thư mục XML đầu ra "${folder}"`, { folder }, async j => {
      const result = await readInvoiceFiles(files, (d, t) => j.progress = `${d}/${t} file`);
      await this.cache.set<CachedXml>(XML_OUT_KEY, { folder, result });
      console.log(`${LOG} Đọc "${folder}": ${result.invoices.length} HĐ, ${result.nFiles} file XML, ${result.errors.length} lỗi`);
      return { folder, result };
    });
  }

  runningXml(): BgJob<CachedXml> | undefined {
    return this.jobs.get<CachedXml>(XML_OUT_KEY);
  }

  cachedXml(): Promise<CacheEntry<CachedXml> | null> {
    return this.cache.get<CachedXml>(XML_OUT_KEY);
  }

  /** HĐ đầu ra của công ty (bên bán = MST công ty; chưa nhập MST → bên bán gặp nhiều nhất) */
  xmlSales(r: XmlReadResult, companyMst: string): { mst: string; detected: string; invoices: LocalXmlInvoice[] } {
    const detected = detectCompanyMst(r.invoices, 'seller');
    const mst = companyMst || detected;
    return { mst, detected, invoices: r.invoices.filter(i => !mst || i.nbmst === mst) };
  }

  /** "Chuyển khoản" → CK · "Tiền mặt" → TM · "TM/CK", "Tiền mặt/Chuyển khoản" → TMCK · khác / trống → '' (coi như có thể CK) */
  static payment(httt: string | undefined): SalePayment {
    const s = (httt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    const ck = /chuyen\s*khoan|\bck\b/.test(s);
    const tm = /tien\s*mat|\btm\b/.test(s);
    return ck && tm ? 'TMCK' : ck ? 'CK' : tm ? 'TM' : '';
  }

  /** HĐ XML → HĐ đối soát (transfer-reconcile.util). `time` = NGÀY lập 'dd/mm/yyyy' (00:00) — khớp theo ngày. */
  static toRecon(i: LocalXmlInvoice): ReconInvoice {
    const [y, m, d] = i.tdlap.split('-');
    return {
      id: `x|${i.khhdon}|${i.shdon}`, code: `HĐĐT ${i.shdon}`, total: Math.round(i.tgtttbso || 0), time: `${d}/${m}/${y}`, note: '',
      einvoiceSerial: i.khhdon, einvoiceNumber: String(i.shdon), einvoiceStatus: i.mccqt ? 'CQT cấp mã' : '',
      paymentMethod: SaleInvoiceSourceService.payment(i.httt), einvoiceIssue: '', einvoiceLate: '',
    };
  }
}
