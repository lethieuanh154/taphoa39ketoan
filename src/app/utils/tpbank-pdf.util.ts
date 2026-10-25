/**
 * SAO KÊ TPBank dạng PDF (24/10/2026) — Chuyển khoản HĐ đầu vào cho chọn cả PDF (TPBank xuất "SAO KÊ GIAO DỊCH TÀI KHOẢN").
 * KHÔNG phải vùng mirror (chỉ KeToan). Đọc bằng pdfjs-dist ngay trên trình duyệt (không gửi sao kê lên máy chủ); worker nạp như
 * module (globalThis.pdfjsWorker — xem bank-reconciliation-in-page), không cần file asset.
 *
 * Bố cục file TPBank (đo trên T03.pdf 22 trang): trang in XOAY NGANG — mỗi GIAO DỊCH là 1 CỘT DỌC (cùng toạ độ x, dòng chữ dài xuống
 * dòng ở x + 7, x + 14), mỗi THÔNG TIN nằm ở 1 dải độ cao y cố định, giống nhau mọi trang; nhãn cột chỉ in ở trang 1 (x ≈ 201–208):
 *   Ngày giao dịch (y≈38, "dd/mm/yyyy hh:mm:ss") · Ngày giá trị (y≈120) · Nội dung (y≈183…) · Ghi nợ (nhãn y≈392) · Ghi có (nhãn y≈456)
 *   · Số dư + TK đối ứng (chung 1 mảnh "107,831,757 103878024071", y≈524) · Chủ TK đối ứng (y≈647) · Mã giao dịch (y≈726)
 * Ghi CÓ = tiền khách chuyển đến; Ghi NỢ = tiền chuyển đi (trả NCC). Số tiền viết kiểu "1,234,000".
 */
import type { DebitStatement, DebitTxn } from './tpbank-debit.util';

export interface PdfStatementRow {
  date: string; iso: string; valueDate: string; desc: string;
  debit: number; credit: number; balance: number | null; account: string; counterparty: string; code: string;
}

export interface PdfStatement { rows: PdfStatementRow[]; periodFrom: string; periodTo: string; pages: number; }

interface Item { x: number; y: number; s: string; page: number; }

/** Dải y của từng thông tin — đo từ nhãn cột ở trang 1, thiếu nhãn thì dùng số đo trên file mẫu */
interface Bands { debit: number; credit: number; balance: number; owner: number; code: number; }
const DEFAULT_BANDS: Bands = { debit: 392, credit: 456, balance: 516, owner: 647, code: 738 };

const DT_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/;
const D_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const AMOUNT_RE = /^\d{1,3}(,\d{3})*(\.\d+)?$/;

const money = (s: string) => Math.round(Number(s.replace(/,/g, '')) || 0);

/** pdfjs: module `pdfjs-dist` đã nạp (trình duyệt: có worker; Node test: bản legacy) */
export async function parseTpBankPdf(data: Uint8Array, pdfjs: any): Promise<PdfStatement> {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items as any[]) {
      const s = String(it.str || '').trim();
      if (s) items.push({ x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), s, page: p });
    }
    page.cleanup?.();
  }
  await doc.destroy?.();

  const bands = { ...DEFAULT_BANDS };
  const label = (re: RegExp) => items.find(i => i.page === 1 && re.test(i.s))?.y;
  bands.debit = label(/^\(?Debit\)?$|^Ghi nợ/) ?? bands.debit;
  bands.credit = label(/^\(?Credit\)?$|^Ghi có/) ?? bands.credit;
  bands.balance = label(/^\(?Balance\)?$|^Số dư/) ?? bands.balance;
  bands.owner = label(/Counter account owner|^Chủ TK đối ứng/) ?? bands.owner;
  bands.code = label(/Transaction code|^Mã giao dịch/) ?? bands.code;

  const period = items.map(i => /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(i.s)).find(Boolean);

  // mỗi giao dịch = 1 cột: neo theo mảnh "ngày giờ giao dịch" ở đáy trang
  const anchors = items.filter(i => DT_RE.test(i.s) && i.y < bands.debit / 4).sort((a, b) => a.page - b.page || a.x - b.x);
  const rows: PdfStatementRow[] = [];
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k];
    const next = anchors[k + 1];
    const xEnd = next && next.page === a.page ? next.x - 2 : a.x + 24;
    const col = items.filter(i => i.page === a.page && i.x >= a.x - 2 && i.x < xEnd && i !== a);
    const pick = (lo: number, hi: number) => col.filter(i => i.y >= lo && i.y < hi).sort((p, q) => p.x - q.x || q.y - p.y);
    const m = DT_RE.exec(a.s)!;
    const amountIn = (lo: number, hi: number) => pick(lo, hi).map(i => i.s).find(s => AMOUNT_RE.test(s));
    const balItem = pick(bands.balance - 10, bands.owner - 40).map(i => i.s).join(' ').trim();
    const [bal, ...acc] = balItem.split(/\s+/);
    rows.push({
      date: a.s, iso: `${m[3]}-${m[2]}-${m[1]} ${m[4]}`,
      valueDate: col.find(i => D_RE.test(i.s))?.s || '',
      desc: pick(bands.debit / 4, bands.debit - 10).filter(i => !D_RE.test(i.s)).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(),
      debit: money(amountIn(bands.debit - 10, bands.credit - 5) || '0'),
      credit: money(amountIn(bands.credit - 5, bands.balance - 10) || '0'),
      balance: AMOUNT_RE.test(bal || '') ? money(bal) : null,
      account: acc.join(' '),
      counterparty: pick(bands.owner - 40, bands.code - 30).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(),
      code: pick(bands.code - 30, 10000).map(i => i.s).join('').trim(),
    });
  }
  return {
    rows,
    periodFrom: period ? `${period[3]}-${period[2]}-${period[1]}` : '',
    periodTo: period ? `${period[6]}-${period[5]}-${period[4]}` : '',
    pages: doc.numPages,
  };
}

/** PDF → sao kê tiền RA (giống parseTpBankDebits của file .xlsx) */
export function pdfToDebitStatement(st: PdfStatement, fileName: string): DebitStatement {
  const transactions: DebitTxn[] = st.rows.filter(r => r.debit > 0).map(r => ({
    date: r.date, iso: r.iso, desc: r.desc, amount: r.debit, counterparty: r.counterparty, account: r.account, code: r.code, file: fileName,
  }));
  const stamps = st.rows.map(r => r.iso).sort();
  return {
    transactions, total: transactions.reduce((s, t) => s + t.amount, 0),
    fromDate: (stamps[0] || '').slice(0, 10), toDate: (stamps[stamps.length - 1] || '').slice(0, 10),
    periodFrom: st.periodFrom, periodTo: st.periodTo, files: [fileName],
  };
}
