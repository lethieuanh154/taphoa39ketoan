/**
 * ĐỐI SOÁT CK — 1 DẠNG DÒNG cho cả 2 tab Bán ra / Mua vào (13/11/2026, user: "table Mua vào giống Bán ra").
 * Bán ra: cặp HĐ XML đầu ra ⇄ GD Ghi có (transfer-reconcile.util, ReconPair). Mua vào: kết quả purchase-transfer-reconcile.util.
 * Cả 2 đổi về ReconViewRow → cùng bảng (components/shared/recon-table) + cùng sheet Excel (reconViewTable). KeToan only.
 * Màu: ok = khớp (xanh) · warn = khớp nhưng cần xem (vàng: khác ngày / tin cậy thấp) · bad = không khớp (đỏ).
 */
import { ReconPair, edgeHintLabel, pairFlags } from './transfer-reconcile.util';
import { PURCHASE_KIND_LABEL, PurchaseMatchRow } from './purchase-transfer-reconcile.util';
import type { XlsxCell, XlsxTone } from './xlsx-writer.util';

export type ReconTone = 'ok' | 'warn' | 'bad';

export interface ReconViewInv {
  symbol: string;
  no: string;
  date: string;      // dd/mm/yyyy
  party: string;     // người mua (bán ra) / NCC (mua vào)
  mst: string;
  total: number;
  note: string;      // bán ra: hình thức thanh toán trên HĐ
}

export interface ReconViewTxn {
  time: string;      // dd/mm/yyyy HH:mm:ss (sao kê)
  party: string;     // người chuyển (bán ra) / người nhận (mua vào)
  code: string;
  desc: string;
  amount: number;
}

export interface ReconViewRow {
  tone: ReconTone;
  status: string;
  hint: string;
  invoices: ReconViewInv[];
  txns: ReconViewTxn[];
  invoiceTotal: number | null;
  txnTotal: number | null;
  days: number | null;     // ngày GD − ngày HĐ
  tags: string[];          // khóa lọc chip: tone + loại khớp
  amount: number;          // sắp theo số tiền
  text: string;            // tìm kiếm (thường, không dấu)
}

export interface ReconChip { key: string; label: string; }

const plain = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
/** 'dd/mm/yyyy…' | 'yyyy-mm-dd…' → số ngày (UTC) */
function dayNo(s: string): number {
  const vi = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  const ms = vi ? Date.UTC(+vi[3], +vi[2] - 1, +vi[1]) : iso ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) : NaN;
  return Math.round(ms / 86400000);
}
const viDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

function finish(r: Omit<ReconViewRow, 'text' | 'amount'>): ReconViewRow {
  const text = plain([r.status, r.hint, ...r.invoices.map(i => `${i.symbol} ${i.no} ${i.party} ${i.mst} ${i.total}`),
    ...r.txns.map(t => `${t.time} ${t.party} ${t.code} ${t.desc} ${t.amount}`)].join(' '));
  return { ...r, amount: r.invoiceTotal ?? r.txnTotal ?? 0, text };
}

export const SALE_STATUS_LABEL: Record<ReconPair['kind'], string> = {
  matched: 'Khớp', matched_late: 'Khớp (khác ngày)', invoice_only: 'HĐ thiếu GD', bank_only: 'GD thừa',
};

export const SALE_CHIPS: ReconChip[] = [
  { key: '', label: 'Tất cả' }, { key: 'bad', label: 'Lệch' }, { key: 'warn', label: 'GD sau ngày HĐ' },
  { key: 'late', label: 'Phát hành trễ' }, { key: 'ok', label: 'Khớp' },
];

/**
 * Trạng thái 1 cặp bán ra. GD TRƯỚC ngày lập HĐ (khớp khác ngày, days < 0) = HĐĐT phát hành trễ → chỉ ghi chú, vẫn xanh
 * (như einvoiceLate từ 11/11/2026: "không tô màu, không tính Lệch"). GD SAU ngày HĐ → vàng (cần xem).
 */
export function saleStatus(p: ReconPair): { tone: ReconTone; status: string; days: number | null; late: boolean } {
  const inv = p.item?.invoice;
  const days = p.txn && inv ? dayNo(p.txn.date) - dayNo(inv.time) : null;
  const late = p.kind === 'matched_late' && days !== null && days < 0;
  const tone: ReconTone = p.kind === 'invoice_only' || p.kind === 'bank_only' || (p.txn && inv?.einvoiceIssue) ? 'bad'
    : p.kind === 'matched_late' && !late ? 'warn' : 'ok';
  return { tone, status: late ? 'Khớp (phát hành trễ)' : SALE_STATUS_LABEL[p.kind], days, late };
}

export const PURCHASE_CHIPS: ReconChip[] = [
  { key: '', label: 'Tất cả' }, { key: 'bad', label: 'Lệch' }, { key: 'warn', label: 'Khớp — cần xem' }, { key: 'ok', label: 'Khớp' },
  { key: 'matched_group', label: '1 CK trả nhiều HĐ' }, { key: 'matched_split', label: '1 HĐ trả nhiều lần' },
];

/**
 * Bán ra. `info(id)` = thông tin thêm của HĐ XML (người mua, MST, hình thức thanh toán) — ReconInvoice không có các trường này.
 */
export function saleViewRows(pairs: ReconPair[], info: (id: string) => { party: string; mst: string; payment: string } | undefined): ReconViewRow[] {
  return pairs.map(p => {
    const inv = p.item?.invoice;
    const x = inv ? info(String(inv.id)) : undefined;
    const { tone, status, days, late } = saleStatus(p);
    const hint = [
      late ? `HĐĐT lập sau ngày GD ${-days!} ngày` : p.kind === 'matched_late' && days !== null ? `GD sau ngày HĐ ${days} ngày` : '',
      edgeHintLabel(p.edgeHint), ...pairFlags(p),
    ].filter(Boolean).join(' · ');
    return finish({
      tone, status, hint, tags: [tone, p.kind, ...(late ? ['late'] : [])],
      invoices: inv ? [{ symbol: inv.einvoiceSerial || '', no: inv.einvoiceNumber || '', date: inv.time.slice(0, 10),
        party: x?.party || '', mst: x?.mst || '', total: inv.total, note: x?.payment || '' }] : [],
      txns: p.txn ? [{ time: p.txn.date, party: p.txn.counterparty, code: p.txn.code, desc: p.txn.desc, amount: p.txn.credit }] : [],
      invoiceTotal: inv ? inv.total : null, txnTotal: p.txn ? p.txn.credit : null, days,
    });
  });
}

/** Mua vào. Tin cậy "thấp" (chỉ khớp số tiền, tên người nhận khác NCC) → vàng. */
export function purchaseViewRows(rows: PurchaseMatchRow[]): ReconViewRow[] {
  return rows.map(r => {
    const matched = r.kind !== 'invoice_only' && r.kind !== 'bank_only';
    const tone: ReconTone = !matched ? 'bad' : r.confidence === 'thấp' ? 'warn' : 'ok';
    return finish({
      tone, status: PURCHASE_KIND_LABEL[r.kind], tags: [tone, r.kind],
      hint: [r.confidence && r.confidence !== 'cao' ? `tin cậy ${r.confidence}` : '', r.hint].filter(Boolean).join(' · '),
      invoices: r.invoices.map(i => ({ symbol: i.symbol, no: i.no, date: viDay(i.date), party: i.sellerName, mst: i.sellerMst,
        total: i.total, note: '' })),
      txns: r.txns.map(t => ({ time: t.date, party: t.counterparty, code: t.code, desc: t.desc, amount: t.amount })),
      invoiceTotal: r.invoices.length ? sum(r.invoices.map(i => i.total)) : null,
      txnTotal: r.txns.length ? sum(r.txns.map(t => t.amount)) : null, days: r.days,
    });
  });
}

/** Sheet Excel cùng cột cho 2 tab (nhiều HĐ / GD trong 1 dòng nối " | "; 1 giá trị số giữ số). */
export function reconViewTable(rows: ReconViewRow[], partyLabel: string, txnPartyLabel: string):
  { header: string[]; rows: XlsxCell[][]; tones: XlsxTone[] } {
  const j = (xs: (string | number)[]) => xs.length === 1 ? xs[0] : xs.filter(x => x !== '').join(' | ');
  const header = ['Kết quả', 'Ký hiệu', 'Số HĐ', 'Ngày HĐ', partyLabel, `MST ${partyLabel.toLowerCase()}`, 'Tổng HĐ', 'Thời gian GD',
    txnPartyLabel, 'Mã GD', 'Diễn giải', 'Số tiền GD', 'Lệch ngày', 'Ghi chú'];
  return {
    header,
    rows: rows.map(r => [
      r.status, j(r.invoices.map(i => i.symbol)), j(r.invoices.map(i => i.no)), j(r.invoices.map(i => i.date)),
      j(r.invoices.map(i => i.party)), j([...new Set(r.invoices.map(i => i.mst))]), r.invoiceTotal ?? '',
      j(r.txns.map(t => t.time)), j([...new Set(r.txns.map(t => t.party))]), j(r.txns.map(t => t.code)), j(r.txns.map(t => t.desc)),
      r.txnTotal ?? '', r.days ?? '', [r.invoices.map(i => i.note).filter(Boolean)[0], r.hint].filter(Boolean).join(' · '),
    ]),
    tones: rows.map(r => r.tone),
  };
}
