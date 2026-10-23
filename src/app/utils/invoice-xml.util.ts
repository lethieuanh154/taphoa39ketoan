import { unzipSync } from 'fflate';

/**
 * ĐỌC DANH SÁCH HĐĐT TỪ FILE XML TRÊN MÁY (thư mục app FDI tải về: `<MST>\T<tháng>\<MST>\{purchase|sold}\xml`) — chạy trong
 * trình duyệt, không tải XML lên máy chủ. Thay nguồn GDT (cổng thuế chặn tự động hóa) cho trang Kiểm tra số lượng hóa đơn.
 * XML theo TT78: HDon/DLHDon/TTChung (KHMSHDon, KHHDon, SHDon, NLap) + NDHDon/NBan, NMua (Ten, MST) + NDHDon/TToan
 * (TgTCThue, TgTThue, TgTTTBSo). ZIP (kể cả ZIP lồng) được giải nén bằng fflate.
 */
export interface LocalXmlInvoice {
  khmshdon: string;   // ký hiệu mẫu số (1 = GTGT)
  khhdon: string;     // ký hiệu HĐ (vd C26TAA)
  shdon: number;      // số HĐ
  tdlap: string;      // ngày lập YYYY-MM-DD
  nbmst: string; nbten: string;   // người bán
  nmmst: string; nmten: string;   // người mua
  tgtcthue: number; tgtthue: number; tgtttbso: number;
  file: string;       // đường dẫn file (hoặc zip/tên trong zip)
}

export interface XmlReadResult {
  invoices: LocalXmlInvoice[];
  nFiles: number;       // file XML đã đọc (kể cả trong ZIP)
  nNotInvoice: number;  // XML không phải HĐĐT (tờ khai, thông báo...)
  nDuplicates: number;  // trùng khóa MST bán | ký hiệu | số
  errors: string[];     // file lỗi (tối đa 50)
}

const MAX_ZIP_DEPTH = 3;

function first(root: Document | Element, name: string): Element | null {
  return root.getElementsByTagNameNS('*', name)[0] || root.getElementsByTagName(name)[0] || null;
}

function text(root: Element | null, name: string): string {
  if (!root) return '';
  const el = first(root, name);
  return (el?.textContent || '').trim();
}

function num(s: string): number {
  const v = Number((s || '').replace(/,/g, ''));
  return Number.isFinite(v) ? v : 0;
}

/** 1 file XML → HĐ (null nếu không phải HĐĐT). Lỗi cú pháp XML → throw. */
export function parseInvoiceXml(xml: string, file: string): LocalXmlInvoice | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML không hợp lệ');
  const ttc = first(doc, 'TTChung');
  const nd = first(doc, 'NDHDon');
  if (!ttc || !nd) return null;
  const shdon = parseInt(text(ttc, 'SHDon'), 10);
  if (!Number.isFinite(shdon)) return null;
  const nban = first(nd, 'NBan');
  const nmua = first(nd, 'NMua');
  const tt = first(nd, 'TToan');
  return {
    khmshdon: text(ttc, 'KHMSHDon'), khhdon: text(ttc, 'KHHDon'), shdon, tdlap: text(ttc, 'NLap').slice(0, 10),
    nbmst: text(nban, 'MST'), nbten: text(nban, 'Ten'), nmmst: text(nmua, 'MST'), nmten: text(nmua, 'Ten'),
    tgtcthue: num(text(tt, 'TgTCThue')), tgtthue: num(text(tt, 'TgTThue')), tgtttbso: num(text(tt, 'TgTTTBSo')),
    file,
  };
}

/** Khóa trùng: MST bán | ký hiệu | số (như doi_soat.py) */
export function invoiceKey(i: LocalXmlInvoice): string {
  return `${i.nbmst}|${i.khmshdon}${i.khhdon}|${i.shdon}`;
}

/**
 * Đọc nhiều file (.xml / .zip) — chọn bằng `<input webkitdirectory>` hoặc chọn file. Nhả luồng mỗi 100 file để trang không đứng.
 * `onProgress(done, total)` theo số file người dùng chọn.
 */
export async function readInvoiceFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<XmlReadResult> {
  const res: XmlReadResult = { invoices: [], nFiles: 0, nNotInvoice: 0, nDuplicates: 0, errors: [] };
  const seen = new Set<string>();
  const decoder = new TextDecoder('utf-8');
  const take = (xml: string, path: string) => {
    res.nFiles++;
    try {
      const inv = parseInvoiceXml(xml, path);
      if (!inv) { res.nNotInvoice++; return; }
      const k = invoiceKey(inv);
      if (seen.has(k)) { res.nDuplicates++; return; }
      seen.add(k);
      res.invoices.push(inv);
    } catch (e: any) {
      if (res.errors.length < 50) res.errors.push(`${path}: ${e?.message || e}`);
    }
  };
  const walkZip = (data: Uint8Array, path: string, depth: number) => {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(data, { filter: f => /\.(xml|zip)$/i.test(f.name) });
    } catch (e: any) {
      if (res.errors.length < 50) res.errors.push(`${path}: ZIP lỗi (${e?.message || e})`);
      return;
    }
    for (const [name, bytes] of Object.entries(entries)) {
      const p = `${path}/${name}`;
      if (/\.zip$/i.test(name)) {
        if (depth < MAX_ZIP_DEPTH) walkZip(bytes, p, depth + 1);
      } else {
        take(decoder.decode(bytes), p);
      }
    }
  };
  const list = files.filter(f => /\.(xml|zip)$/i.test(f.name));
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const path = (f as any).webkitRelativePath || f.name;
    if (/\.zip$/i.test(f.name)) walkZip(new Uint8Array(await f.arrayBuffer()), path, 1);
    else take(await f.text(), path);
    if (i % 100 === 99) {
      onProgress?.(i + 1, list.length);
      await new Promise(r => setTimeout(r));
    }
  }
  onProgress?.(list.length, list.length);
  return res;
}

/**
 * MST công ty: trang đầu vào → MST BÊN MUA gặp nhiều nhất (HĐ vào đều mua bởi công ty, HĐ ra lẫn vào thì người mua mỗi HĐ một khác);
 * trang đầu ra → MST BÊN BÁN gặp nhiều nhất. Đúng cả khi chọn thư mục gốc có cả purchase lẫn sold.
 */
export function detectCompanyMst(invoices: LocalXmlInvoice[], role: 'buyer' | 'seller'): string {
  const count = new Map<string, number>();
  for (const i of invoices) {
    const m = role === 'buyer' ? i.nmmst : i.nbmst;
    if (m) count.set(m, (count.get(m) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
