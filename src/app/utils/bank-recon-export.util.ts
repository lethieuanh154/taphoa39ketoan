/**
 * ĐỐI SOÁT CK — 1 FILE EXCEL cho cả bán ra + mua vào (06/11/2026, user: "tổng hợp tất cả xuất 1 file, cùng 1 format, dành cho
 * tools/vietda-xml-import"). KHÔNG phải vùng mirror (chỉ KeToan).
 *
 * Sheet (thứ tự cố định):
 *   Nhap-VietDA          mỗi GD sao kê 1 dòng — Thu (Ghi có, khớp HĐĐT bán ra) + Chi (Ghi nợ, khớp HĐ mua vào); CÙNG cột (VIETDA_HEADER)
 *   Ban-ra_Doi-soat      = CSV Đối soát cũ (doi-soat-ck_*.csv, buildReconCsv) — mỗi cặp HĐ ⇄ GD
 *   Ban-ra_CK-nhieu-lan  = CSV CK nhiều lần · Ban-ra_CK-du = CSV CK dư
 *   Mua-vao              = CSV Chuyển khoản HĐ đầu vào (buildPurchaseReconCsv)
 *   Thong-tin            định dạng (EXPORT_SCHEMA), kỳ, file sao kê, thời điểm xuất, số dòng
 * Tool đọc sheet Nhap-VietDA theo TÊN CỘT (đổi tên / bỏ cột = tăng EXPORT_SCHEMA). Ngày giờ = chữ đúng định dạng sao kê TPBank.
 */
import {
  RECON_KIND_LABEL, ReconPair, excessTransferPairs, excessTransferTable, isEInvoiceIssuePair, multiTransferPairs, multiTransferTable,
  payerLabel, reconPairHint, reconTable
} from './transfer-reconcile.util';
import { PURCHASE_KIND_LABEL, PurchaseMatchRow, purchaseReconTable } from './purchase-transfer-reconcile.util';
import type { DebitTxn } from './tpbank-debit.util';
import { XlsxCell, XlsxSheet, XlsxTone, buildXlsx } from './xlsx-writer.util';

export const EXPORT_SCHEMA = 'taphoa39-doi-soat-ck/1';

export const VIETDA_HEADER = [
  'Loại', 'Mã GD', 'Thời gian GD', 'Ngày GD', 'Số tiền', 'Diễn giải sao kê', 'Người chuyển / nhận', 'TK đối ứng',
  'Kết quả khớp', 'Lập phiếu theo HĐ', 'Lý do không lập', 'Độ tin cậy',
  'Số HĐ', 'Ký hiệu HĐ', 'Ngày HĐ', 'Tổng HĐ', 'Mã HĐ KiotViet', 'Khoản', 'MST đối tác', 'Tên đối tác', 'Trạng thái HĐĐT', 'Ghi chú',
] as const;

export interface BankReconExportInput {
  from: string;                       // yyyy-mm-dd — kỳ / khoảng ngày đối soát
  to: string;
  statementFiles: string[];
  /** Bán ra: các cặp HĐĐT ⇄ GD Ghi có (null = chưa lấy HĐĐT) */
  salePairs: ReconPair[] | null;
  saleWithBank: boolean;              // đã import sao kê cho bán ra
  /** Mua vào: kết quả ghép (null = chưa chọn thư mục XML) */
  purchaseRows: PurchaseMatchRow[] | null;
  /** GD Ghi nợ trên sao kê — dùng khi chưa có purchaseRows (vẫn liệt kê ở Nhap-VietDA, ghi "chưa đối soát") */
  debitTxns: DebitTxn[];
}

type Row = Record<(typeof VIETDA_HEADER)[number], XlsxCell>;

/** 'dd/mm/yyyy HH:mm:ss' → 'yyyy-mm-dd' */
const isoDay = (vi: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(vi || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
/** 'yyyy-mm-dd' → 'dd/mm/yyyy' */
const viDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const join = (xs: (string | number)[]) => [...new Set(xs.filter(x => x !== '' && x !== null && x !== undefined))].join(', ');

/** Dòng Thu: mọi cặp có GD (khớp + GD thừa). Lập phiếu khi có số HĐĐT CQT đã chấp nhận và HĐĐT không lỗi (nháp / phát hành trễ). */
function saleRows(pairs: ReconPair[]): Row[] {
  return pairs.filter(p => p.txn).map(p => {
    const inv = p.item?.invoice;
    const reason = !inv ? 'GD thừa — không có HĐĐT'
      : inv.einvoiceIssue ? inv.einvoiceIssue
      : !inv.einvoiceNumber ? 'HĐ chưa có số HĐĐT'
      : '';
    return {
      'Loại': 'Thu', 'Mã GD': p.txn!.code, 'Thời gian GD': p.txn!.date, 'Ngày GD': isoDay(p.txn!.date), 'Số tiền': p.txn!.credit,
      'Diễn giải sao kê': p.txn!.desc, 'Người chuyển / nhận': payerLabel(p.txn!), 'TK đối ứng': p.txn!.account || '',
      'Kết quả khớp': RECON_KIND_LABEL[p.kind], 'Lập phiếu theo HĐ': reason ? 'Không' : 'Có', 'Lý do không lập': reason, 'Độ tin cậy': '',
      'Số HĐ': inv?.einvoiceNumber || '', 'Ký hiệu HĐ': inv?.einvoiceSerial || '', 'Ngày HĐ': (inv?.time || '').slice(0, 10),
      'Tổng HĐ': inv ? inv.total : '', 'Mã HĐ KiotViet': inv && !inv.code.startsWith('HĐĐT') ? inv.code : '',
      'Khoản': p.item && p.item.partCount > 1 ? `${p.item.partIndex}/${p.item.partCount}` : '',
      'MST đối tác': '', 'Tên đối tác': '', 'Trạng thái HĐĐT': inv?.einvoiceStatus || '', 'Ghi chú': reconPairHint(p),
    };
  });
}

/** Dòng Chi: mỗi GD tiền ra 1 dòng (1 HĐ trả nhiều lần → lặp HĐ ở từng GD; 1 CK trả nhiều HĐ → số HĐ nối ", "). */
function purchaseRows(rows: PurchaseMatchRow[]): Row[] {
  return rows.flatMap(r => r.txns.map(t => {
    const matched = r.kind !== 'bank_only' && r.kind !== 'invoice_only';
    const reason = !matched ? 'CK không có HĐ (lương, phí, hàng không HĐ, HĐ ngoài kỳ…)'
      : r.confidence === 'thấp' ? 'Khớp tin cậy thấp — cần xem' : '';
    return {
      'Loại': 'Chi', 'Mã GD': t.code, 'Thời gian GD': t.date, 'Ngày GD': t.iso.slice(0, 10), 'Số tiền': t.amount,
      'Diễn giải sao kê': t.desc, 'Người chuyển / nhận': t.counterparty, 'TK đối ứng': t.account || '',
      'Kết quả khớp': PURCHASE_KIND_LABEL[r.kind], 'Lập phiếu theo HĐ': reason ? 'Không' : 'Có', 'Lý do không lập': reason,
      'Độ tin cậy': r.confidence,
      'Số HĐ': join(r.invoices.map(i => i.no)), 'Ký hiệu HĐ': join(r.invoices.map(i => i.symbol)),
      'Ngày HĐ': join(r.invoices.map(i => viDay(i.date))),
      'Tổng HĐ': r.invoices.length ? r.invoices.reduce((s, i) => s + i.total, 0) : '', 'Mã HĐ KiotViet': '', 'Khoản': '',
      'MST đối tác': join(r.invoices.map(i => i.sellerMst)), 'Tên đối tác': join(r.invoices.map(i => i.sellerName)),
      'Trạng thái HĐĐT': '', 'Ghi chú': r.hint,
    };
  }));
}

/** Chưa chọn thư mục XML mua vào: vẫn liệt kê GD tiền ra để tool lập phiếu không theo HĐ (lương, nộp / rút tiền…). */
function unreconciledDebitRows(txns: DebitTxn[]): Row[] {
  return txns.map(t => ({
    'Loại': 'Chi', 'Mã GD': t.code, 'Thời gian GD': t.date, 'Ngày GD': t.iso.slice(0, 10), 'Số tiền': t.amount,
    'Diễn giải sao kê': t.desc, 'Người chuyển / nhận': t.counterparty, 'TK đối ứng': t.account || '',
    'Kết quả khớp': 'Chưa đối soát', 'Lập phiếu theo HĐ': 'Không', 'Lý do không lập': 'Chưa chọn thư mục XML HĐ đầu vào',
    'Độ tin cậy': '', 'Số HĐ': '', 'Ký hiệu HĐ': '', 'Ngày HĐ': '', 'Tổng HĐ': '', 'Mã HĐ KiotViet': '', 'Khoản': '',
    'MST đối tác': '', 'Tên đối tác': '', 'Trạng thái HĐĐT': '', 'Ghi chú': '',
  }));
}

/** Sheet Nhap-VietDA: Thu + Chi, sắp theo thời gian GD (cũ trước), cùng giờ thì Thu trước. */
export function vietdaRows(input: BankReconExportInput): Row[] {
  const thu = input.salePairs && input.saleWithBank ? saleRows(input.salePairs) : [];
  const chi = input.purchaseRows ? purchaseRows(input.purchaseRows) : unreconciledDebitRows(input.debitTxns);
  const key = (r: Row) => `${r['Ngày GD']} ${String(r['Thời gian GD']).slice(11)}`;
  return [...thu, ...chi].sort((a, b) => key(a).localeCompare(key(b)) || String(b['Loại']).localeCompare(String(a['Loại'])));
}

// ===== Màu dòng (06/11/2026): xanh = đúng / lập phiếu được · vàng = khớp nhưng cần xem · đỏ = không khớp / không lập =====

/** Cặp bán ra: giống màu bảng trên trang (khớp xanh, lệch giờ vàng, thiếu / thừa / HĐĐT nháp - phát hành trễ đỏ). */
function saleTone(p: ReconPair): XlsxTone {
  if (isEInvoiceIssuePair(p) || p.kind === 'invoice_only' || p.kind === 'bank_only') return 'bad';
  return p.kind === 'matched_late' ? 'warn' : 'ok';
}

/** CK nhiều lần / CK dư: ghi chú lệch (số lần / tổng / không tách được) → đỏ; còn lại theo trạng thái khớp GD (nếu có sao kê). */
const noteTone = (noteOk: boolean, p: ReconPair, withBank: boolean): XlsxTone => !noteOk ? 'bad' : withBank ? saleTone(p) : 'ok';

function purchaseTone(r: PurchaseMatchRow): XlsxTone {
  if (r.kind === 'bank_only' || r.kind === 'invoice_only') return 'bad';
  return r.confidence === 'thấp' ? 'warn' : 'ok';
}

/** Chỉ số các cột kết quả (in đậm cùng màu dòng) theo tên cột. */
const colsOf = (header: string[], names: string[]) => names.map(n => header.indexOf(n)).filter(i => i >= 0);

/** Dựng file .xlsx (bytes) + tóm tắt để log. */
export function buildBankReconWorkbook(input: BankReconExportInput): { bytes: Uint8Array; summary: string } {
  const rows = vietdaRows(input);
  const count = (loai: string, lap?: string) => rows.filter(r => r['Loại'] === loai && (!lap || r['Lập phiếu theo HĐ'] === lap)).length;
  const header = [...VIETDA_HEADER] as string[];
  // Nhap-VietDA: xanh = tool lập phiếu theo HĐ, đỏ = không lập (xem cột "Lý do không lập")
  const sheets: XlsxSheet[] = [{
    name: 'Nhap-VietDA', header, rows: rows.map(r => VIETDA_HEADER.map(h => r[h])),
    tones: rows.map(r => r['Lập phiếu theo HĐ'] === 'Có' ? 'ok' : 'bad'),
    emphasisCols: colsOf(header, ['Kết quả khớp', 'Lập phiếu theo HĐ', 'Lý do không lập']),
  }];
  const withSheet = (name: string, t: { header: string[]; rows: XlsxCell[][] }, tones: XlsxTone[], emph: string[]) =>
    sheets.push({ name, ...t, tones, emphasisCols: colsOf(t.header, emph) });
  if (input.salePairs) {
    const pairs = input.salePairs, wb = input.saleWithBank;
    if (wb) withSheet('Ban-ra_Doi-soat', reconTable(pairs), pairs.map(saleTone), ['Trạng thái', 'Gợi ý']);
    withSheet('Ban-ra_CK-nhieu-lan', multiTransferTable(pairs, { withBank: wb }),
      multiTransferPairs(pairs).map(p => noteTone(p.item!.note!.status === 'ok', p, wb)), ['Tình trạng ghi chú', 'Trạng thái khớp']);
    withSheet('Ban-ra_CK-du', excessTransferTable(pairs, { withBank: wb }),
      excessTransferPairs(pairs).map(p => noteTone(p.item!.excess!.status === 'ok', p, wb)), ['Tình trạng ghi chú', 'Trạng thái khớp']);
  }
  if (input.purchaseRows) {
    withSheet('Mua-vao', purchaseReconTable(input.purchaseRows), input.purchaseRows.map(purchaseTone), ['Kết quả', 'Độ tin cậy']);
  }
  const summary = `Thu ${count('Thu')} GD (lập phiếu ${count('Thu', 'Có')}) · Chi ${count('Chi')} GD (lập phiếu ${count('Chi', 'Có')})`;
  sheets.push({
    name: 'Thong-tin', header: ['Mục', 'Giá trị'], rows: [
      ['Định dạng', EXPORT_SCHEMA],
      ['Khoảng ngày', `${viDay(input.from)} → ${viDay(input.to)}`],
      ['File sao kê', input.statementFiles.join(', ')],
      ['Xuất lúc', new Date().toLocaleString('vi-VN')],
      ['Bán ra (Thu)', input.salePairs ? (input.saleWithBank ? '' : 'chưa import sao kê') : 'chưa lấy HĐĐT'],
      ['Mua vào (Chi)', input.purchaseRows ? '' : 'chưa chọn thư mục XML HĐ đầu vào'],
      ['Nhap-VietDA', summary],
      ['Màu dòng', 'Xanh = khớp / lập phiếu theo HĐ · Vàng = khớp nhưng cần xem (lệch giờ, tin cậy thấp) · Đỏ = không khớp / không lập phiếu'],
    ],
  });
  return { bytes: buildXlsx(sheets), summary };
}
