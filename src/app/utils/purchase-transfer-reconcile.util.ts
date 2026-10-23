/**
 * ĐỐI SOÁT CK — CHUYỂN KHOẢN HĐ ĐẦU VÀO (23/10/2026): HĐ mua vào (thư mục XML hoặc Gmail) ⇄ tiền RA trên sao kê TPBank.
 * Khác HĐ đầu ra (utils/transfer-reconcile.util.ts — mirror BanHang, khớp từng phút): trả NCC có thể trước / sau ngày HĐ nhiều ngày,
 * 1 lần CK có thể trả GỘP nhiều HĐ cùng NCC, 1 HĐ có thể trả nhiều lần. Thuần hàm, không gọi máy chủ.
 *
 * Thứ tự ghép (mỗi HĐ / GD chỉ dùng 1 lần):
 * 1. 1 CK = 1 HĐ: số tiền BẰNG NHAU, ngày CK trong [ngày HĐ − MAX_DAYS_BEFORE, ngày HĐ + MAX_DAYS_AFTER]. Điểm: tên người nhận giống
 *    tên NCC (+50), diễn giải có số HĐ (+50), lệch ngày ít (−0,5 / ngày) → ghép điểm cao trước.
 * 2. 1 CK = nhiều HĐ cùng NCC (tên người nhận giống tên NCC): tổng các HĐ = số tiền CK (2–8 HĐ).
 * 3. 1 HĐ = nhiều CK cùng người nhận (giống tên NCC): tổng các CK = tổng HĐ (2–4 lần).
 * 4. Còn lại: HĐ chưa thấy CK (chỉ tính HĐ trong kỳ) · CK không có HĐ (lương, phí, hàng không HĐ, HĐ ngoài kỳ…).
 * Độ tin cậy: cao = tên người nhận giống NCC hoặc diễn giải có số HĐ; vừa = số tiền chỉ khớp đúng 1 cặp; thấp = còn lại (cần xem).
 */
import type { DebitTxn } from './tpbank-debit.util';

export const MAX_DAYS_BEFORE = 30;    // CK trước ngày HĐ (đặt cọc / trả trước)
export const MAX_DAYS_AFTER = 120;    // CK sau ngày HĐ (công nợ NCC)
const NAME_OK = 0.5;
const GROUP_MAX = 8;
const SPLIT_MAX = 4;
const CAND_MAX = 16;

export interface PurchaseInv {
  key: string;
  no: string;            // số HĐ (bỏ số 0 đầu)
  symbol: string;        // ký hiệu (vd C26TAA)
  date: string;          // yyyy-mm-dd
  sellerMst: string;
  sellerName: string;
  total: number;         // tổng thanh toán
  source: 'xml' | 'gmail';
  gmailThreadId?: string;
}

export type PurchaseMatchKind = 'matched' | 'matched_group' | 'matched_split' | 'invoice_only' | 'bank_only';
export type Confidence = 'cao' | 'vừa' | 'thấp' | '';

export interface PurchaseMatchRow {
  kind: PurchaseMatchKind;
  invoices: PurchaseInv[];
  txns: DebitTxn[];
  amount: number;
  /** ngày CK − ngày HĐ (ngày), null nếu thiếu 1 bên */
  days: number | null;
  confidence: Confidence;
  hint: string;
}

export interface PurchaseReconResult {
  rows: PurchaseMatchRow[];
  counts: Record<PurchaseMatchKind, number>;
  /** HĐ ngoài kỳ không ghép được — không tính "HĐ chưa thấy CK" */
  outsideUnmatched: number;
  invoiceTotal: number;
  paidTotal: number;
  txnTotal: number;
}

export const PURCHASE_KIND_LABEL: Record<PurchaseMatchKind, string> = {
  matched: 'Khớp', matched_group: '1 CK trả nhiều HĐ', matched_split: '1 HĐ trả nhiều lần',
  invoice_only: 'HĐ chưa thấy CK', bank_only: 'CK không có HĐ',
};

const STOP = new Set(['CONG', 'TY', 'CTY', 'TNHH', 'CP', 'CO', 'PHAN', 'MTV', 'MOT', 'THANH', 'VIEN', 'DNTN', 'DOANH', 'NGHIEP', 'TU',
  'NHAN', 'HKD', 'HO', 'KINH', 'VA', 'THUONG', 'MAI', 'DICH', 'VU', 'SAN', 'XUAT', 'CHI', 'NHANH', 'TM', 'DV', 'SX', 'XNK', 'NHAP',
  'KHAU', 'TMDV', 'TMSX', 'LTD', 'COMPANY', 'CORPORATION', 'JSC', 'VIET', 'NAM', 'VN']);

export function stripVn(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').toUpperCase();
}

function tokens(s: string): string[] {
  return stripVn(s).replace(/[^A-Z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !STOP.has(t));
}

/** Tên NCC ⇄ chủ TK nhận: tỉ lệ từ chung / số từ của tên ngắn hơn (bỏ "CÔNG TY", "TNHH"…); 0..1 */
export function nameScore(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / Math.min(A.size, B.size);
}

/** Diễn giải có số HĐ (≥ 3 chữ số, bỏ số 0 đầu) */
export function descHasNo(desc: string, no: string): boolean {
  if (!no || no.length < 3) return false;
  return (desc.match(/\d+/g) || []).some(d => d.replace(/^0+/, '') === no);
}

function dayDiff(txn: DebitTxn, inv: PurchaseInv): number {
  return Math.round((Date.parse(txn.iso.slice(0, 10)) - Date.parse(inv.date)) / 86400000);
}

function inWindow(d: number): boolean {
  return d >= -MAX_DAYS_BEFORE && d <= MAX_DAYS_AFTER;
}

/** Tập con có tổng = target (DFS, cắt nhánh) — tối đa maxSize phần tử; ưu tiên ít phần tử */
function subsetSum<T>(items: T[], value: (x: T) => number, target: number, maxSize: number): T[] | null {
  const xs = [...items].sort((a, b) => value(b) - value(a));
  for (let size = 2; size <= Math.min(maxSize, xs.length); size++) {
    const pick: T[] = [];
    const dfs = (start: number, left: number): boolean => {
      if (pick.length === size) return left === 0;
      for (let i = start; i < xs.length; i++) {
        const v = value(xs[i]);
        if (v > left) continue;
        pick.push(xs[i]);
        if (dfs(i + 1, left - v)) return true;
        pick.pop();
      }
      return false;
    };
    if (dfs(0, target)) return pick;
  }
  return null;
}

export function reconcilePurchaseTransfers(invoices: PurchaseInv[], txns: DebitTxn[], period?: { from: string; to: string }): PurchaseReconResult {
  const usedInv = new Set<PurchaseInv>(), usedTxn = new Set<DebitTxn>();
  const rows: PurchaseMatchRow[] = [];
  const nameOf = new Map<string, number>();
  const ns = (inv: PurchaseInv, t: DebitTxn) => {
    const k = `${inv.sellerName}\u0001${t.counterparty}`;
    let v = nameOf.get(k);
    if (v === undefined) nameOf.set(k, v = nameScore(inv.sellerName, t.counterparty));
    return v;
  };
  const strong = (inv: PurchaseInv, t: DebitTxn) => ns(inv, t) >= NAME_OK || descHasNo(t.desc, inv.no)
    || (!!inv.sellerMst && t.desc.includes(inv.sellerMst));

  // 1. 1 CK = 1 HĐ
  const byAmount = new Map<number, DebitTxn[]>();
  for (const t of txns) byAmount.set(t.amount, [...(byAmount.get(t.amount) || []), t]);
  const invCountByAmount = new Map<number, number>();
  for (const i of invoices) invCountByAmount.set(i.total, (invCountByAmount.get(i.total) || 0) + 1);
  const cands: { inv: PurchaseInv; t: DebitTxn; score: number; d: number }[] = [];
  for (const inv of invoices) {
    for (const t of byAmount.get(inv.total) || []) {
      const d = dayDiff(t, inv);
      if (!inWindow(d)) continue;
      const score = 100 + (ns(inv, t) >= NAME_OK ? 50 : 0) + (descHasNo(t.desc, inv.no) ? 50 : 0) - Math.abs(d) * 0.5;
      cands.push({ inv, t, score, d });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands) {
    if (usedInv.has(c.inv) || usedTxn.has(c.t)) continue;
    usedInv.add(c.inv);
    usedTxn.add(c.t);
    const unique = (byAmount.get(c.inv.total) || []).length === 1 && invCountByAmount.get(c.inv.total) === 1;
    const conf: Confidence = strong(c.inv, c.t) ? 'cao' : unique ? 'vừa' : 'thấp';
    rows.push({ kind: 'matched', invoices: [c.inv], txns: [c.t], amount: c.inv.total, days: c.d, confidence: conf,
      hint: conf === 'cao' ? '' : `Người nhận "${c.t.counterparty}" khác tên NCC — chỉ khớp số tiền, kiểm tra lại` });
  }

  // 2. 1 CK = nhiều HĐ cùng NCC
  for (const t of [...txns].sort((a, b) => b.amount - a.amount)) {
    if (usedTxn.has(t)) continue;
    const pool = invoices.filter(i => !usedInv.has(i) && i.total < t.amount && inWindow(dayDiff(t, i)) && strong(i, t));
    const bySeller = new Map<string, PurchaseInv[]>();
    for (const i of pool) bySeller.set(i.sellerMst || i.sellerName, [...(bySeller.get(i.sellerMst || i.sellerName) || []), i]);
    for (const group of bySeller.values()) {
      const near = group.sort((a, b) => Math.abs(dayDiff(t, a)) - Math.abs(dayDiff(t, b))).slice(0, CAND_MAX);
      const hit = subsetSum(near, i => i.total, t.amount, GROUP_MAX);
      if (!hit) continue;
      hit.forEach(i => usedInv.add(i));
      usedTxn.add(t);
      hit.sort((a, b) => a.date.localeCompare(b.date));
      rows.push({ kind: 'matched_group', invoices: hit, txns: [t], amount: t.amount, days: dayDiff(t, hit[hit.length - 1]),
        confidence: 'cao', hint: `1 lần CK trả ${hit.length} HĐ của cùng NCC` });
      break;
    }
  }

  // 3. 1 HĐ = nhiều CK cùng người nhận
  for (const inv of invoices) {
    if (usedInv.has(inv)) continue;
    const pool = txns.filter(t => !usedTxn.has(t) && t.amount < inv.total && inWindow(dayDiff(t, inv)) && ns(inv, t) >= NAME_OK)
      .sort((a, b) => Math.abs(dayDiff(a, inv)) - Math.abs(dayDiff(b, inv))).slice(0, CAND_MAX);
    const hit = subsetSum(pool, t => t.amount, inv.total, SPLIT_MAX);
    if (!hit) continue;
    hit.forEach(t => usedTxn.add(t));
    usedInv.add(inv);
    hit.sort((a, b) => a.iso.localeCompare(b.iso));
    rows.push({ kind: 'matched_split', invoices: [inv], txns: hit, amount: inv.total, days: dayDiff(hit[hit.length - 1], inv),
      confidence: 'cao', hint: `HĐ trả ${hit.length} lần` });
  }

  // 4. còn lại — gợi ý CK / HĐ cùng NCC lệch số tiền
  const leftTxn = txns.filter(t => !usedTxn.has(t));
  let outsideUnmatched = 0;
  for (const inv of invoices) {
    if (usedInv.has(inv)) continue;
    if (period && (inv.date < period.from || inv.date > period.to)) {
      outsideUnmatched++;
      continue;
    }
    const near = leftTxn.filter(t => ns(inv, t) >= NAME_OK && inWindow(dayDiff(t, inv)))
      .sort((a, b) => Math.abs(a.amount - inv.total) - Math.abs(b.amount - inv.total))[0];
    rows.push({ kind: 'invoice_only', invoices: [inv], txns: [], amount: inv.total, days: null, confidence: '',
      hint: near ? `Có CK cho "${near.counterparty}" ${vnd(near.amount)} ngày ${near.date.slice(0, 10)} (lệch ${vnd(near.amount - inv.total)})` : '' });
  }
  const leftInv = invoices.filter(i => !usedInv.has(i));
  for (const t of leftTxn) {
    const near = leftInv.filter(i => ns(i, t) >= NAME_OK && inWindow(dayDiff(t, i)))
      .sort((a, b) => Math.abs(a.total - t.amount) - Math.abs(b.total - t.amount))[0];
    const known = !near && invoices.some(i => ns(i, t) >= NAME_OK);
    rows.push({ kind: 'bank_only', invoices: [], txns: [t], amount: t.amount, days: null, confidence: '',
      hint: near ? `Có HĐ ${near.symbol}-${near.no} của NCC này ${vnd(near.total)} (lệch ${vnd(t.amount - near.total)})`
        : known ? 'Người nhận là NCC có HĐ — có thể trả HĐ ngoài kỳ / chưa có HĐ' : '' });
  }

  const order: Record<PurchaseMatchKind, number> = { invoice_only: 0, bank_only: 1, matched_split: 2, matched_group: 3, matched: 4 };
  const conf: Record<string, number> = { 'thấp': 0, 'vừa': 1, 'cao': 2, '': 3 };
  rows.sort((a, b) => order[a.kind] - order[b.kind] || conf[a.confidence] - conf[b.confidence] || b.amount - a.amount);
  const counts = { matched: 0, matched_group: 0, matched_split: 0, invoice_only: 0, bank_only: 0 } as Record<PurchaseMatchKind, number>;
  rows.forEach(r => counts[r.kind]++);
  return {
    rows, counts, outsideUnmatched,
    invoiceTotal: invoices.filter(i => !period || (i.date >= period.from && i.date <= period.to)).reduce((s, i) => s + i.total, 0),
    paidTotal: rows.filter(r => r.kind.startsWith('matched')).reduce((s, r) => s + r.amount, 0),
    txnTotal: txns.reduce((s, t) => s + t.amount, 0),
  };
}

function vnd(n: number): string {
  return `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('vi-VN')}`;
}

/** CSV (dấu ; · UTF-8 BOM do nơi gọi thêm) — 1 dòng / kết quả, nhiều HĐ / nhiều CK nối bằng " | " */
export function buildPurchaseReconCsv(rows: PurchaseMatchRow[]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const j = (xs: (string | number)[]) => xs.join(' | ');
  const head = ['Kết quả', 'Độ tin cậy', 'Số HĐ', 'Ký hiệu', 'Ngày HĐ', 'MST NCC', 'Tên NCC', 'Tổng TT HĐ', 'Nguồn HĐ',
    'Ngày CK', 'Số tiền CK', 'Người nhận', 'Diễn giải', 'Mã GD', 'Lệch ngày', 'Ghi chú'];
  return [head.join(';'), ...rows.map(r => [
    PURCHASE_KIND_LABEL[r.kind], r.confidence, j(r.invoices.map(i => i.no)), j(r.invoices.map(i => i.symbol)), j(r.invoices.map(i => i.date)),
    j([...new Set(r.invoices.map(i => i.sellerMst))]), j([...new Set(r.invoices.map(i => i.sellerName))]), j(r.invoices.map(i => i.total)),
    j([...new Set(r.invoices.map(i => i.source === 'xml' ? 'XML' : 'Gmail'))]),
    j(r.txns.map(t => t.date)), j(r.txns.map(t => t.amount)), j([...new Set(r.txns.map(t => t.counterparty))]), j(r.txns.map(t => t.desc)),
    j(r.txns.map(t => t.code)), r.days ?? '', r.hint,
  ].map(cell).join(';'))].join('\r\n');
}
