/**
 * ĐẾM NHANH (25/10/2026) — Kiểm tra số lượng HĐ đầu vào: mọi HĐ đầu vào trên cổng thuế (thư mục XML FDI) đều phải có email NCC gửi
 * về Gmail. Thuần hàm.
 * 28/10/2026 (user): NCC hay gửi email TRỄ (HĐ lập 27/10, Gmail nhận 28/10; cuối kỳ HĐ 31/10 → email 01/11 ngoài kỳ) → bỏ so theo
 * ngày, GHÉP từng email với 1 HĐ:
 * 1. Theo KHÓA HĐ máy chủ nhận diện (`inv` — BE email_invoice_key.py: XML đính kèm / tên file / tiêu đề), mạnh trước yếu sau:
 *    MST + ký hiệu + số → ký hiệu + số → chỉ số (HĐ lập trong [ngày nhận − NO_ONLY_LAG, ngày nhận + 1]). Khóa không có trong XML →
 *    "email không khớp HĐ XML" (HĐ có email mà thư mục XML / cổng thuế không có). 2 email cùng 1 HĐ → "gửi trùng" (không tính).
 * 2. Email KHÔNG có khóa → ghép theo ngày: HĐ còn lại lập trong [ngày nhận − LAG_DAYS, ngày nhận], ưu tiên tiêu đề / người gửi có số
 *    HĐ, MST, tên NCC. Email không phải HĐ (quảng cáo…) vẫn có thể ghép nhầm ở bước này.
 * Email lấy tới `countFetchTo(to)` = cuối kỳ + LAG_DAYS; email nhận sau kỳ không ghép HĐ trong kỳ → không tính; email ghép HĐ lập
 * trước kỳ → không tính (`prevPeriod`).
 * Tổng email HĐ (ghép HĐ trong kỳ + email không khớp nhận trong kỳ) = tổng HĐ XML trong kỳ và không còn dòng lệch → KHỚP.
 */
export interface EmailInv { mst: string; tpl: string; series: string; no: number; date?: string; total?: number | null; source: 'xml' | 'filename' | 'subject'; }
export interface CountEmail {
  id: string; thread_id: string; at: string; from_name: string; from_email: string; subject: string;
  inv?: EmailInv | null;   // khóa HĐ máy chủ nhận diện (bản lưu trên máy trước 28/10/2026 không có)
  att?: string[];          // loại đính kèm: xml / pdf / zip
}
export interface CountInvoice { date: string; no: string; symbol: string; seller: string; sellerMst: string; total?: number; }

export const LAG_DAYS = 3;
const NO_ONLY_LAG = 7;

export interface CountPair { invoice: CountInvoice; email: CountEmail; lag: number; reason: string; byKey: boolean; }
export interface EmailMiss { email: CountEmail; reason: string; }

export interface CountResult {
  xml: number;                 // HĐ XML lập trong kỳ
  email: number;               // email HĐ tính cho kỳ = ghép HĐ trong kỳ + không khớp nhận trong kỳ (không tính gửi trùng)
  ok: boolean;
  pairs: CountPair[];          // HĐ trong kỳ đã có email
  xmlOnly: CountInvoice[];     // HĐ trong kỳ CHƯA thấy email
  emailOnly: EmailMiss[];      // email nhận trong kỳ không khớp HĐ XML nào (+ lý do)
  duplicates: CountPair[];     // email gửi lại cùng HĐ đã có email (không tính)
  byKey: number;               // cặp ghép theo khóa HĐ (chắc chắn)
  late: number;                // cặp email nhận sau ngày lập (≥ 1 ngày)
  afterPeriod: number;         // email nhận sau kỳ đã ghép HĐ cuối kỳ (đã tính)
  prevPeriod: number;          // email ghép HĐ lập trước kỳ (không tính)
  noKey: number;               // email không nhận diện được HĐ (chỉ ghép được theo ngày)
}

const day = (iso: string) => iso.slice(0, 10);   // `at` là giờ VN (ISO +07:00) → 10 ký tự đầu = ngày VN
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mstOf = (m: string) => (m || '').trim().replace(/-\d+$/, '');
const seriesOf = (s: string) => (s || '').toUpperCase().replace(/^\d/, '');

/** Ngày nhận email lấy rộng thêm để bắt email gửi trễ của HĐ cuối kỳ (không vượt hôm nay) */
export function countFetchTo(to: string, today = new Date().toISOString().slice(0, 10)): string {
  const d = addDays(to, LAG_DAYS);
  return d < today ? d : (to > today ? to : today);
}

const GENERIC = new Set(['cong', 'ty', 'tnhh', 'cp', 'co', 'phan', 'mtv', 'mot', 'thanh', 'vien', 'thuong', 'mai', 'dich', 'vu', 'san',
  'xuat', 'tong', 'hop', 'chi', 'nhanh', 'tai', 'va', 'dau', 'tu', 'phat', 'trien', 'hoa', 'don', 'dien', 'hddt', 'invoice', 'einvoice',
  'thong', 'bao', 'gui', 'quy', 'khach', 'cua', 'so', 'ngay', 'no', 'reply', 'noreply', 'tm', 'dv', 'ltd', 'jsc', 'company', 'vn', 'viet', 'nam']);

function words(s: string): string[] {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .split(/[^a-z0-9]+/).filter(w => w.length > 1 && !GENERIC.has(w) && !/^\d+$/.test(w));
}

/** Điểm giống nhau HĐ ⇄ email (0 = chỉ theo ngày) + lý do để hiện cho người xem */
function score(i: CountInvoice, e: CountEmail): [number, string] {
  const text = `${e.subject} ${e.from_name} ${e.from_email}`;
  const nums = new Set((text.match(/\d+/g) || []).map(n => n.replace(/^0+/, '')));
  const no = String(Number(i.no));
  let s = 0;
  const why: string[] = [];
  if (no.length >= 2 && nums.has(no)) { s += 4; why.push('số HĐ trong tiêu đề'); }
  if (i.sellerMst && text.includes(i.sellerMst)) { s += 4; why.push('MST bán'); }
  const sw = new Set(words(i.seller));
  const n = new Set(words(`${e.from_name} ${e.subject} ${e.from_email.split('@')[0]}`).filter(w => sw.has(w))).size;
  if (n) { s += Math.min(n, 3); why.push('tên NCC'); }
  return [s, why.join(' + ')];
}

const SOURCE_LABEL: Record<EmailInv['source'], string> = { xml: 'XML đính kèm', filename: 'tên file đính kèm', subject: 'tiêu đề' };

/** Lý do 1 email không khớp HĐ XML nào */
function missReason(e: CountEmail): string {
  const k = e.inv;
  if (k) {
    const sym = k.series ? `${k.tpl || ''}${k.series}-` : 'số ';
    return `HĐ ${sym}${k.no}${k.mst ? ` (MST ${k.mst})` : ''} — đọc từ ${SOURCE_LABEL[k.source]} — KHÔNG có trong thư mục XML`;
  }
  const att = e.att || [];
  if (e.att === undefined) return 'Chưa nhận diện HĐ (bản đếm cũ) — bấm "Đếm lại email"';
  if (!att.length) return 'Không có đính kèm, tiêu đề không có số HĐ — có thể không phải email HĐ';
  if (att.every(a => a === 'pdf')) return 'Chỉ có PDF, tiêu đề / tên file không có số HĐ';
  return 'Không đọc được số HĐ từ đính kèm / tiêu đề';
}

export function compareCounts(invoices: CountInvoice[], emails: CountEmail[], from: string, to: string): CountResult {
  const minInv = addDays(from, -LAG_DAYS);
  const mails = emails.filter(e => day(e.at) >= from);
  const assigned = new Map<number, CountPair>();     // chỉ số HĐ → cặp
  const mailDone = new Set<number>();
  const duplicates: CountPair[] = [];
  const keyMiss: number[] = [];

  // ===== 1. theo khóa HĐ =====
  const byFull = new Map<string, number[]>(), bySeriesNo = new Map<string, number[]>(), byNo = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, i: number) => m.set(k, [...(m.get(k) || []), i]);
  invoices.forEach((inv, i) => {
    const no = String(Number(inv.no)), s = seriesOf(inv.symbol);
    push(byFull, `${mstOf(inv.sellerMst)}|${s}|${no}`, i);
    push(bySeriesNo, `${s}|${no}`, i);
    push(byNo, no, i);
  });
  const level = (k: EmailInv) => (k.mst && k.series ? 0 : k.series ? 1 : 2);
  const keyed = mails.map((e, m) => ({ e, m })).filter(x => x.e.inv && x.e.inv.no)
    .sort((a, b) => level(a.e.inv!) - level(b.e.inv!) || a.e.at.localeCompare(b.e.at));
  for (const { e, m } of keyed) {
    const k = e.inv!, no = String(Number(k.no)), got = day(e.at);
    let cands: number[];
    if (k.mst && k.series) cands = byFull.get(`${mstOf(k.mst)}|${seriesOf(k.series)}|${no}`) || [];
    else if (k.series) cands = bySeriesNo.get(`${seriesOf(k.series)}|${no}`) || [];
    else cands = (byNo.get(no) || []).filter(i => { const l = diffDays(invoices[i].date, got); return l >= -1 && l <= NO_ONLY_LAG; });
    if (!cands.length) {
      keyMiss.push(m);
      continue;
    }
    // nhiều HĐ cùng khóa (thiếu MST / chỉ có số): HĐ chưa có email trước, rồi giống tên NCC, rồi gần ngày nhận
    const rank = cands.map(i => ({ i, used: assigned.has(i) ? 1 : 0, s: score(invoices[i], e)[0], l: Math.abs(diffDays(invoices[i].date, got)) }))
      .sort((a, b) => a.used - b.used || b.s - a.s || a.l - b.l);
    const i = rank[0].i;
    const pair: CountPair = { invoice: invoices[i], email: e, lag: diffDays(invoices[i].date, got), byKey: true,
      reason: `khóa HĐ (${level(k) === 0 ? 'MST + ký hiệu + số' : level(k) === 1 ? 'ký hiệu + số' : 'số HĐ + ngày'}) từ ${SOURCE_LABEL[k.source]}` };
    mailDone.add(m);
    if (assigned.has(i)) duplicates.push(pair);
    else assigned.set(i, pair);
  }

  // ===== 2. email không có khóa → theo ngày =====
  const free = mails.map((e, m) => ({ e, m })).filter(x => !x.e.inv?.no && !mailDone.has(x.m));
  const byDay = new Map<string, number[]>();
  for (const { e, m } of free) push(byDay, day(e.at), m);
  const cands: { i: number; m: number; lag: number; s: number; why: string }[] = [];
  invoices.forEach((inv, i) => {
    if (assigned.has(i) || inv.date < minInv || inv.date > to) return;
    for (let lag = 0; lag <= LAG_DAYS; lag++) {
      for (const m of byDay.get(addDays(inv.date, lag)) || []) {
        const [s, why] = score(inv, mails[m]);
        cands.push({ i, m, lag, s, why });
      }
    }
  });
  cands.sort((a, b) => b.s - a.s || a.lag - b.lag || a.i - b.i || a.m - b.m);
  for (const c of cands) {
    if (assigned.has(c.i) || mailDone.has(c.m)) continue;
    assigned.set(c.i, { invoice: invoices[c.i], email: mails[c.m], lag: c.lag, byKey: false,
      reason: `theo ngày${c.why ? ' + ' + c.why : ''} (email không có khóa HĐ)` });
    mailDone.add(c.m);
  }

  // ===== kết quả kỳ =====
  const pairs: CountPair[] = [];
  const xmlOnly: CountInvoice[] = [];
  let prevPeriod = 0;
  invoices.forEach((inv, i) => {
    const p = assigned.get(i);
    if (inv.date < from) {
      if (p) prevPeriod++;
    } else if (inv.date <= to) {
      if (p) pairs.push(p);
      else xmlOnly.push(inv);
    }
  });
  const missSet = new Set(keyMiss);
  const emailOnly: EmailMiss[] = mails
    .map((e, m) => ({ e, m }))
    .filter(x => (!mailDone.has(x.m) || missSet.has(x.m)) && day(x.e.at) <= to)
    .map(x => ({ email: x.e, reason: missReason(x.e) }));
  const inDups = duplicates.filter(d => d.invoice.date >= from && d.invoice.date <= to);
  const cmp = (a: string, b: string) => a.localeCompare(b);
  xmlOnly.sort((a, b) => cmp(a.date, b.date) || a.seller.localeCompare(b.seller));
  emailOnly.sort((a, b) => cmp(a.email.at, b.email.at));
  pairs.sort((a, b) => cmp(a.invoice.date, b.invoice.date) || a.invoice.seller.localeCompare(b.invoice.seller));
  return {
    xml: pairs.length + xmlOnly.length, email: pairs.length + emailOnly.length, ok: !xmlOnly.length && !emailOnly.length,
    pairs, xmlOnly, emailOnly, duplicates: inDups, byKey: pairs.filter(p => p.byKey).length,
    late: pairs.filter(p => p.lag > 0).length, afterPeriod: pairs.filter(p => day(p.email.at) > to).length, prevPeriod,
    noKey: mails.filter(e => day(e.at) <= to && !e.inv?.no).length,
  };
}
