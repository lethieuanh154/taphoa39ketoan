/**
 * MÃ TRA CỨU HĐ GỐC TỪ XML (28/10/2026) — thuần hàm, không phụ thuộc DOM (invoice-xml.util.ts gom trường rồi gọi `detectLookup`).
 * XML TT78 không có trường chuẩn cho mã tra cứu: mỗi nhà cung cấp HĐĐT (theo `TTChung/MSTTCGP`) ghi vào `TTKhac/TTin` với tên
 * riêng. Khảo sát 144 HĐ đầu vào thật (T6–T10/2026): 110 HĐ (76%) có mã; BKAV, VNPT, MobiFone… không ghi mã vào XML → tra cứu
 * ở cổng CQT (hoadondientu.gdt.gov.vn) bằng MST bán + ký hiệu + số + tiền (mọi HĐ đều có mã CQT).
 * Gặp MSTTCGP chưa có trong PROVIDERS → `provider` = '' (trang hiện "NCC HĐĐT chưa biết") — gửi 1 XML của NCC đó để bổ sung.
 */
export interface InvoiceLookup {
  tcgp: string;        // MST tổ chức cung cấp giải pháp HĐĐT (bỏ đuôi chi nhánh -001)
  provider: string;    // tên NCC HĐĐT ('' = chưa biết)
  code: string;        // mã tra cứu ('' = XML không có)
  codeField: string;   // tên trường lấy mã (để kiểm)
  url: string;         // link mở: thẳng HĐ (direct) / trang tra cứu của NCC / '' (chỉ tra được ở CQT)
  direct: boolean;     // url mở thẳng HĐ, không phải nhập mã
}

interface Provider { name: string; portal?: string; direct?: (code: string) => string; }

export const GDT_LOOKUP_URL = 'https://hoadondientu.gdt.gov.vn/';

/** MSTTCGP → NCC HĐĐT. Chỉ ghi `direct` khi đã biết link mở thẳng bằng mã (MISA: link `?sc=` trong email NCC gửi). */
const PROVIDERS: Record<string, Provider> = {
  '0101243150': { name: 'MISA meInvoice', portal: 'https://www.meinvoice.vn/tra-cuu/',
    direct: c => `https://www.meinvoice.vn/tra-cuu/?sc=${encodeURIComponent(c)}` },
  '0100109106': { name: 'Viettel', portal: 'https://vinvoice.viettel.vn/utilities/invoice-search' },
  '0101300842': { name: 'Thái Sơn E-invoice', portal: 'https://einvoice.vn/tra-cuu' },
  '0106026495': { name: 'M-invoice', portal: 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don' },
  '0105987432': { name: 'EasyInvoice' },
  '0101360697': { name: 'BKAV eHoadon' },
  '0100684378': { name: 'VNPT Invoice' },
  '0100686209': { name: 'MobiFone Invoice', portal: 'http://tracuuhoadon.mobifoneinvoice.vn/' },
};

/** Tên trường (đã chuẩn hóa) chứa mã tra cứu — theo thứ tự ưu tiên. "Mã số" (Viettel, GUID nội bộ) KHÔNG phải mã tra cứu. */
const CODE_FIELDS = ['matc', 'matracuu', 'matracuuhoadon', 'transactionid', 'masobimat', 'sobaomat', 'quanlysobaomat',
  'mabaomat', 'fkey', 'keysearch', 'searchkey', 'lookupcode'];
/** Tên trường chứa link trang tra cứu (giá trị phải là URL / tên miền) */
const URL_FIELDS = ['dctc', 'portallink', 'linktracuunguoiban', 'linktracuu', 'websitetracuu', 'diachitracuu', 'dctracuu'];

export function normField(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function asUrl(v: string): string {
  const s = (v || '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(s)) return `http://${s}`;
  return '';
}

/** `fields` = các cặp (TTruong, DLieu) của TTKhac phần đầu HĐ (không lấy trong dòng hàng DSHHDVu) */
export function detectLookup(tcgpRaw: string, fields: [string, string][]): InvoiceLookup {
  const tcgp = (tcgpRaw || '').trim().replace(/-\d+$/, '');
  const p = PROVIDERS[tcgp];
  const byKey = new Map<string, [string, string]>();
  for (const [k, v] of fields) {
    const n = normField(k);
    if (n && (v || '').trim() && !byKey.has(n)) byKey.set(n, [k, v.trim()]);
  }
  let code = '', codeField = '';
  for (const f of CODE_FIELDS) {
    const hit = byKey.get(f);
    if (hit && /^[A-Za-z0-9+/=_\-.]{4,120}$/.test(hit[1])) {
      [codeField, code] = hit;
      break;
    }
  }
  let xmlUrl = '';
  for (const f of URL_FIELDS) {
    const u = asUrl(byKey.get(f)?.[1] || '');
    if (u) {
      xmlUrl = u;
      break;
    }
  }
  const direct = !!(code && p?.direct);
  const url = direct ? p!.direct!(code) : (xmlUrl || (code ? p?.portal || '' : ''));
  return { tcgp, provider: p?.name || '', code, codeField, url, direct };
}
