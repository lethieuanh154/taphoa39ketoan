/**
 * Đối soát chuyển khoản THEO SỐ TIỀN: hóa đơn ⇄ giao dịch Ghi có TPBank.
 * Nguồn HĐ từ 03/11/2026 = HĐĐT einvoiceapp (readEInvoiceBills), trước đó = HĐ CK KiotViet bán hàng.
 *
 * TS thuần (không import Angular) — sẽ copy nguyên file sang TapHoa39KeToan.
 * Sửa ở đây thì PHẢI sửa bản bên kia (không share package).
 *
 * Quy tắc nghiệp vụ:
 * - Chỉ quan tâm SỐ TIỀN: mệnh giá X có 5 khoản HĐ thì phải có 5 GD X. Mọi cặp cùng số tiền
 *   đều hợp lệ như nhau → không có trạng thái "cần xác nhận".
 * - HĐ ghi chú "chuyển khoản N lần a + b" được tách thành N khoản (a, b đơn vị nghìn).
 * - HĐ ghi chú "chuyển khoản (dư) X, trả lại khách Y" khớp với GD X (khách chuyển dư, trả lại Y tiền mặt).
 * - Thời gian chỉ dùng để GHÉP CẶP cho dễ đọc: ưu tiên GD trong khung [giờ HĐ − 24h, giờ HĐ + 30'].
 *   Khách thường chuyển trước, HĐ xuất sau (thiếu hàng Original → xuất cuối ngày / trong 24h).
 *   Cặp cùng số tiền ngoài khung vẫn tính là KHỚP, chỉ đánh dấu "lệch giờ".
 * - Phần dư sát đầu/cuối kỳ được gợi ý "có thể thuộc kỳ trước/sau" thay vì coi là sai.
 * - HĐĐT (03/11/2026): khớp HĐ CK trước; GD còn dư mới thử HĐĐT ghi Tiền mặt (reconcileWithFallback, chỉ trong khung giờ)
 *   và HĐ lệch tiền lẻ ≤ EINVOICE_AMOUNT_TOLERANCE (HĐ kế toán lập tay, làm tròn thuế: HĐ 353.001 ↔ GD 353.000).
 *   Đo thử: 09/2026 HĐ CK KiotViet 96,1% → HĐĐT 97,9% GD; 03/2026 (KiotViet trả 0 HĐ CK) HĐĐT 90,4%.
 */

export interface ReconInvoice {
  id: number | string;      // HĐ KiotViet: Id số; HĐĐT: id GUID
  code: string;
  total: number;  // TotalPayment — số tiền khách thực trả
  time: string;   // 'dd/mm/yyyy HH:mm:ss' giờ VN (giữ nguyên wall-clock)
  note: string;   // Description KiotViet
  einvoiceSerial?: string;  // Ký hiệu HĐĐT (vd "C26MSM") — chỉ khi CQT đã chấp nhận
  einvoiceNumber?: string;  // Số HĐĐT (bill_number) — chỉ khi CQT đã chấp nhận
  einvoiceStatus?: string;  // Nhãn trạng thái HĐĐT (xem readKvEInvoice)
  paymentMethod?: string;   // HĐĐT: 'CK' | 'TM' | 'TMCK'
  einvoiceIssue?: string;   // HĐĐT chưa có số CQT: nháp / chưa được CQT chấp nhận — '' = ổn (readEInvoiceBills)
  einvoiceLate?: string;    // HĐĐT phát hành sau ngày bán (chỉ ghi chú, KHÔNG phải lỗi — 11/11/2026)
  einvoiceDuplicate?: string; // 1 HĐ KiotViet có ≥ 2 HĐĐT (chuyển trùng, vd HD447316 12/11/2026) — chỉ có khi trùng
}

export interface ReconEInvoiceInfo {
  einvoiceSerial: string;
  einvoiceNumber: string;
  einvoiceStatus: string;
}

/**
 * Đọc trạng thái HĐĐT từ dòng `invoices/list` KiotViet (cần `Includes=InvoiceExtraData&Includes=EInvoice`).
 * Số HĐĐT CHỈ điền khi CQT đã chấp nhận: `EInvoices[].TaxStatus === 2` và `ErrorCode === 0`
 * (đối chiếu 103/103 HĐ với einvoiceapp tab "CQT chấp nhận" = `DA_TIEP_NHAN`, vd HD443273 ↔ số 30625).
 * Các giá trị TaxStatus khác (từ chối...) chưa có mẫu thật → coi là "chưa chấp nhận".
 */
export function readKvEInvoice(row: { InvoiceExtraData?: any; EInvoices?: any[] } | null | undefined): ReconEInvoiceInfo {
  const published = (row?.EInvoices || []).filter(e => e && e.EInvoiceNumber);
  const accepted = published
    .filter(e => Number(e.TaxStatus) === 2 && !Number(e.ErrorCode))
    .sort((a, b) => String(b.PublishedDate || '').localeCompare(String(a.PublishedDate || '')))[0];
  if (accepted) {
    return { einvoiceSerial: String(accepted.Serial || ''), einvoiceNumber: String(accepted.EInvoiceNumber), einvoiceStatus: 'CQT chấp nhận' };
  }
  if (published.length > 0) {
    const err = published.map(e => e.TaxErrors).filter(Boolean).join('; ');
    return { einvoiceSerial: '', einvoiceNumber: '', einvoiceStatus: `Đã phát hành, CQT chưa chấp nhận${err ? ': ' + err : ''}` };
  }
  if (row?.InvoiceExtraData?.EInvoiceRegistedDatePartner4) {
    return { einvoiceSerial: '', einvoiceNumber: '', einvoiceStatus: 'Nháp (chưa phát hành)' };
  }
  return { einvoiceSerial: '', einvoiceNumber: '', einvoiceStatus: 'Chưa chuyển HĐĐT' };
}

/**
 * 1 dòng HĐĐT einvoice `/v3/bills` đã rút gọn ở BE (KeToanBackEnd transfer_invoice_service.BILL_FIELDS
 * = TapHoa39BackEnd FromKiotViet/get_einvoice_bills.BILL_FIELDS). Không có thông tin người mua.
 */
export interface EInvoiceBill {
  id: string;
  invoice_code: string | null;          // mã HĐ KiotViet; null = HĐ kế toán lập tay / HĐ thay thế
  bill_series: string | null;
  bill_number: number | string | null;
  bill_date: string;                    // 'YYYY-MM-DD HH:mm:ss.SSS' giờ VN — nháp: giờ tạo; phát hành: ĐỔI sang giờ phát hành
  created_at?: string | null;           // giờ tạo nháp ≈ giờ bán (BanHang tự chuyển HĐĐT ngay sau thanh toán)
  total_payment: number | null;
  payment_method_code: string | null;   // 'CK' | 'TM' | 'TMCK'
  status: string | null;                // 'DA_TIEP_NHAN' = CQT chấp nhận, 'GHI_TAM' = nháp
  adjustment_type: number | null;       // 1 = gốc, 2 = đã bị thay thế, 3 = HĐ thay thế (origin_id = HĐ bị thay) — mẫu 23–24/10/2026
  origin_id: string | null;
  note: string | null;                  // = Description HĐ KiotViet
}

/**
 * HĐĐT thường phát hành trễ 1–2 ngày sau ngày bán, `bill_date` đổi sang ngày phát hành → lấy HĐĐT dư thêm N ngày sau kỳ
 * rồi lọc theo NGÀY BÁN (readEInvoiceBills `period`). Vd HĐ bán 09/11 phát hành 10/11: đối soát 09/11 vẫn có, 10/11 không có.
 */
export const EINVOICE_PUBLISH_LAG_DAYS = 3;

/** Dung sai tiền lẻ khi khớp HĐĐT (HĐ lập tay lệch 1–2 ₫ do làm tròn thuế, mẫu 03/2026) */
export const EINVOICE_AMOUNT_TOLERANCE = 10;

const EINVOICE_STATUS_LABEL: Record<string, string> = { DA_TIEP_NHAN: 'CQT chấp nhận', GHI_TAM: 'Nháp (chưa phát hành)' };

/**
 * HĐĐT → HĐ đối soát. `primary` = HĐ CK / TMCK, hoặc ghi chú có "chuyển khoản"/"ck" (ghi nhầm TM); `fallback` = HĐ còn lại
 * (Tiền mặt) — chỉ dùng khớp GD còn dư (reconcileWithFallback). Bỏ HĐ đã bị thay thế (có HĐ adjustment_type 3 trỏ origin_id
 * tới nó, cùng số tiền → không bỏ thì dư 1 HĐ) và HĐ tổng tiền ≤ 0. Số HĐĐT chỉ điền khi CQT đã chấp nhận (như readKvEInvoice).
 * `einvoiceIssue`: HĐ nháp / chưa được CQT chấp nhận (chưa có số CQT) — vẫn ghép cặp, BanHang tô vàng (11/11/2026).
 * `einvoiceLate`: phát hành SAU ngày bán (ngày `bill_date` > ngày `created_at`) — chỉ ghi chú.
 * `einvoiceDuplicate` (12/11/2026): ≥ 2 HĐĐT (không bị thay thế) cùng mã HĐ KiotViet — chuyển HĐĐT trùng (vd bấm chuyển lại
 * trên KiotViet khi HĐ vừa chuyển chưa kịp có dấu "đã chuyển"). Ghi vào MỌI bản trùng; bản không khớp GD thành "HĐ thiếu GD".
 * Giờ HĐ = `created_at` (giờ bán; thiếu thì `bill_date`) vì `bill_date` đổi sang giờ phát hành. Mẫu thật HD445996: khách CK
 * 04/11 16:01, bán 04/11 21:24 (nháp), phát hành 05/11 08:28 → bill_date 05/11, created_at vẫn 04/11.
 * `period` ('yyyy-mm-dd'): chỉ giữ HĐ có NGÀY BÁN trong kỳ (gọi BE với khoảng dư EINVOICE_PUBLISH_LAG_DAYS ngày sau kỳ).
 */
export function readEInvoiceBills(
  bills: EInvoiceBill[],
  period?: { from: string; to: string }
): { primary: ReconInvoice[]; fallback: ReconInvoice[] } {
  const replaced = new Set(bills.filter(b => Number(b.adjustment_type) === 3 && b.origin_id).map(b => b.origin_id));
  const primary: ReconInvoice[] = [];
  const fallback: ReconInvoice[] = [];
  let skipped = 0;
  let outOfPeriod = 0;
  const day = (s: string | null | undefined) => (s || '').slice(0, 10);
  for (const b of bills) {
    if (replaced.has(b.id) || !(Number(b.total_payment) > 0)) { skipped++; continue; }
    const soldAt = b.created_at || b.bill_date;
    if (period && (day(soldAt) < period.from || day(soldAt) > period.to)) { outOfPeriod++; continue; }
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(soldAt || '');
    const accepted = b.status === 'DA_TIEP_NHAN';
    const note = b.note || '';
    const inv: ReconInvoice = {
      id: b.id,
      code: b.invoice_code || `HĐĐT ${b.bill_number ?? ''}`.trim(),
      total: Number(b.total_payment),
      time: m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : '',
      note,
      einvoiceSerial: accepted ? String(b.bill_series || '') : '',
      einvoiceNumber: accepted && b.bill_number ? String(b.bill_number) : '',
      einvoiceStatus: EINVOICE_STATUS_LABEL[b.status || ''] || b.status || '',
      paymentMethod: b.payment_method_code || '',
    };
    const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
    inv.einvoiceIssue = b.status === 'GHI_TAM' ? 'HĐĐT chưa phát hành (nháp)'
      : !accepted ? `HĐĐT chưa được CQT chấp nhận (${inv.einvoiceStatus || '?'})`
      : '';
    inv.einvoiceLate = accepted && b.created_at && day(b.created_at) < day(b.bill_date)
      ? `HĐĐT phát hành trễ: bán ${dm(b.created_at)}, phát hành ${dm(b.bill_date)}` : '';
    const saysTransfer = /chuyen\s*khoan|\bck\b/.test(normalizeVi(note));
    (b.payment_method_code !== 'TM' || saysTransfer ? primary : fallback).push(inv);
  }
  const byCode = new Map<string, ReconInvoice[]>();
  for (const i of [...primary, ...fallback]) {
    if (!/^HĐĐT( |$)/.test(i.code)) byCode.set(i.code, [...(byCode.get(i.code) || []), i]);
  }
  for (const [code, dup] of byCode) {
    if (dup.length < 2) continue;
    const label = `HĐĐT trùng: ${code} có ${dup.length} HĐĐT (${dup.map(i => i.einvoiceNumber || 'nháp').sort().join(', ')}) — cần xử lý bản thừa`;
    dup.forEach(i => { i.einvoiceDuplicate = label; });
    console.warn(`[TransferReconcile] ${label}`);
  }
  const issues = primary.filter(i => i.einvoiceIssue).length;
  console.debug(`[TransferReconcile] HĐĐT ${bills.length}: CK ${primary.length} (${issues} chưa có số CQT), TM dự phòng ${fallback.length}, bỏ ${skipped} (bị thay thế / tiền ≤ 0)` +
    (period ? `, bỏ ${outOfPeriod} ngày bán ngoài ${period.from}→${period.to}` : ''));
  return { primary, fallback };
}

export interface ReconBankTxn {
  date: string;   // 'dd/mm/yyyy HH:mm:ss' cột A (Ngày giao dịch)
  desc: string;
  credit: number;
  counterparty: string;
  code: string;   // Mã giao dịch (cột I)
  account?: string;  // TK đối ứng (cột G) — định danh người chuyển cùng tên trong diễn giải (payerKey)
}

export type NoteStatus = 'ok' | 'count_mismatch' | 'sum_mismatch' | 'unparsed';

export interface MultiTransferNote {
  times: number;     // N trong "N lần"
  parts: number[];   // số tiền từng khoản (VND)
  status: NoteStatus;
}

export interface ExcessTransferNote {
  transferred: number;     // số tiền khách chuyển thật (VND) — 0 nếu không đọc được
  refund: number | null;   // số tiền trả lại khách (VND) — null nếu không đọc được
  status: NoteStatus;      // 'ok' | 'sum_mismatch' | 'unparsed'
}

export interface ReconItem {
  invoice: ReconInvoice;
  amount: number;
  partIndex: number;   // 1-based
  partCount: number;   // 1 = HĐ thường
  note: MultiTransferNote | null;
  excess: ExcessTransferNote | null;
}

export type ReconKind = 'matched' | 'matched_late' | 'invoice_only' | 'bank_only';

export interface ReconPair {
  amount: number;
  item: ReconItem | null;
  txn: ReconBankTxn | null;
  kind: ReconKind;
  deltaMinutes: number | null;    // giờ GD − giờ HĐ (âm = khách chuyển trước)
  edgeHint: 'prev' | 'next' | null;
  amountDiff?: number;            // HĐ − GD khi khớp lệch tiền lẻ (amountTolerance)
}

export interface ReconOptions {
  windowBeforeMin: number;  // GD được phép sớm hơn HĐ tối đa (mặc định 24h)
  windowAfterMin: number;   // GD được phép muộn hơn HĐ tối đa (mặc định 30')
  periodFrom?: string;      // 'yyyy-mm-dd' — kỳ đối soát, để gợi ý phần dư sát biên kỳ
  periodTo?: string;
  amountTolerance?: number; // > 0: phần dư lệch ≤ X ₫ trong khung giờ vẫn ghép cặp (HĐĐT: EINVOICE_AMOUNT_TOLERANCE)
  /**
   * Bước 2 chỉ ghép 'matched_late' khi GD nằm trong [HĐ − beforeMin, HĐ + afterMin] (13/11/2026, KeToan HĐ từ XML chỉ có NGÀY lập).
   * Không đặt = ghép mọi phần dư cùng số tiền theo thứ tự thời gian (BanHang).
   */
  lateWindow?: { beforeMin: number; afterMin: number };
}

export const DEFAULT_RECON_OPTIONS: ReconOptions = { windowBeforeMin: 24 * 60, windowAfterMin: 30, amountTolerance: 0 };

// ===== Thời gian =====

/** 'dd/mm/yyyy HH:mm:ss' → phút (wall-clock, không đổi múi giờ). NaN nếu sai định dạng. */
export function viStampToMinutes(stamp: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec((stamp || '').trim());
  if (!m) return NaN;
  const ms = Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return Math.floor(ms / 60000);
}

function isoDateToMinutes(iso: string, endOfDay: boolean): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return NaN;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return Math.floor(ms / 60000);
}

// ===== Ghi chú "chuyển khoản N lần a + b" =====

function normalizeVi(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/**
 * "45" | "45k" | "45.000" | "1.270.000" → { value, hasK } (bỏ dấu phân cách . ,).
 * "16.2" | "146,8" (1–2 chữ số sau dấu) = số lẻ NGHÌN → { value: 16200, vnd: true }.
 */
function readNumber(segment: string): NoteNumber | null {
  const m = /(\d[\d.,]*)\s*(k|nghin|ngan|dong|vnd|d(?![a-z]))?/.exec(segment);
  if (!m) return null;
  const dong = !!m[2] && /^(dong|vnd|d)$/.test(m[2]);
  const raw = m[1].replace(/[.,]+$/, '');
  const dec = /^(\d+)[.,](\d{1,2})$/.exec(raw);
  if (dec) {
    const value = Number(dec[1]) * 1000 + Number(dec[2].padEnd(3, '0'));
    return value > 0 ? { value, hasK: true, vnd: true } : null;
  }
  const value = Number(raw.replace(/[.,]/g, ''));
  return Number.isFinite(value) && value > 0 ? { value, hasK: !!m[2] && !dong, ...(dong ? { dong } : {}) } : null;
}

/** `dong`: số có ghi đơn vị "đồng" / "vnd" / "đ" (vd "dư 400 đồng") — chỉ parseExcessTransferNote dùng (18/11/2026) */
type NoteNumber = { value: number; hasK: boolean; vnd?: boolean; dong?: boolean };
// Số < 1000 (hoặc có "k") = nghìn đồng
const asThousand = (n: NoteNumber) => n.vnd ? n.value : n.hasK || n.value < 1000 ? n.value * 1000 : n.value;
// Dự phòng khi tổng lệch: coi mọi số < 100.000 là nghìn (vd "1.270" → 1.270.000)
const allThousand = (n: NoteNumber) => n.vnd ? n.value : n.value < 100000 ? n.value * 1000 : n.value;

/**
 * Tách ghi chú dạng "chuyển khoản 2 lần 45 + 12" (hoặc "ck 2 lan 45k+12k").
 * Số < 1000 hiểu là nghìn đồng (45 → 45.000); số lẻ "16.2"/"16,2" → 16.200. Nếu tổng vẫn lệch, thử coi MỌI số là nghìn
 * (vd "1.270" → 1.270.000) và chọn cách khớp với tổng hóa đơn.
 * Trả null nếu ghi chú không phải dạng nhiều lần.
 */
export function parseMultiTransferNote(note: string, total: number): MultiTransferNote | null {
  const m = /(?:chuyen\s*khoan|\bck)\D*?(\d+)\s*lan\b(.*)$/.exec(normalizeVi(note));
  if (!m) return null;
  const times = Number(m[1]);
  const nums = m[2].split('+').map(readNumber).filter((x): x is NoteNumber => x !== null);
  if (nums.length === 0) return { times, parts: [], status: 'unparsed' };

  let parts = nums.map(asThousand);
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  if (sum(parts) !== total) {
    const loose = nums.map(allThousand);
    if (sum(loose) === total) parts = loose;
  }

  const status: NoteStatus = parts.length !== times ? 'count_mismatch'
    : sum(parts) !== total ? 'sum_mismatch' : 'ok';
  return { times, parts, status };
}

/**
 * Tách ghi chú "chuyển khoản dư 990, trả lại khách 891" (hoặc "ck dư 990k trả khách 891k", "chuyển khoản thừa ...").
 * Không có chữ "dư" vẫn nhận nếu đúng cấu trúc "chuyển khoản 990, trả lại khách 891": số ngay sau "chuyển khoản"
 * và BẮT BUỘC có "trả ... <số>" (không thì "chuyển khoản 99" bình thường cũng bị coi là chuyển dư).
 * Khách chuyển 990.000, trả lại 891.000 tiền mặt ⇒ HĐ 99.000 nhưng sao kê có GD 990.000.
 * Đơn vị như ghi chú nhiều lần. Hợp lệ khi khách chuyển − trả lại = tổng HĐ.
 * Trả null nếu ghi chú không phải dạng chuyển dư.
 */
export function parseExcessTransferNote(note: string, total: number): ExcessTransferNote | null {
  const text = normalizeVi(note);
  const withKeyword = /(?:chuyen\s*khoan|\bck)\s*(?:du|thua)\b(.*)$/.exec(text);
  const bare = withKeyword ? null : /(?:chuyen\s*khoan|\bck)\s*(\d.*)$/.exec(text);
  const body = (withKeyword || bare)?.[1];
  if (body === undefined) return null;
  const [sentPart, ...rest] = body.split(/\btra\b/);
  const sent = readNumber(sentPart);
  const back = rest.length > 0 ? readNumber(rest.join(' ')) : null;
  if (bare && !back) return null;
  if (!sent) return { transferred: 0, refund: null, status: 'unparsed' };
  if (!back) {
    const n = sent.dong ? sent.value : asThousand(sent);
    // "chuyển khoản dư 400 đồng" (không có "trả"): số NHỎ HƠN tổng HĐ = phần DƯ → khách chuyển = tổng + dư
    // (18/11/2026 HD448312 444.000 ⇄ GD 444.400; trước đọc thành "khách chuyển 400.000" → tìm GD 400.000, lệch cả 2 bên)
    if (withKeyword && n < total) return { transferred: total + n, refund: n, status: 'ok' };
    return { transferred: n, refund: null, status: 'unparsed' };
  }

  let transferred = asThousand(sent);
  let refund = asThousand(back);
  if (transferred - refund !== total && allThousand(sent) - allThousand(back) === total) {
    transferred = allThousand(sent);
    refund = allThousand(back);
  }
  return { transferred, refund, status: transferred - refund === total ? 'ok' : 'sum_mismatch' };
}

/**
 * HĐ → các khoản cần khớp. Ghi chú nhiều lần tách được → N khoản; ghi chú chuyển dư → 1 khoản = số khách chuyển;
 * ngược lại 1 khoản = tổng HĐ.
 */
export function expandInvoiceItems(invoices: ReconInvoice[]): ReconItem[] {
  const items: ReconItem[] = [];
  for (const invoice of invoices) {
    const note = parseMultiTransferNote(invoice.note, invoice.total);
    if (note && note.parts.length > 0) {
      note.parts.forEach((amount, i) =>
        items.push({ invoice, amount, partIndex: i + 1, partCount: note.parts.length, note, excess: null }));
    } else {
      const excess = note ? null : parseExcessTransferNote(invoice.note, invoice.total);
      items.push({ invoice, amount: excess?.transferred || invoice.total, partIndex: 1, partCount: 1, note, excess });
    }
  }
  return items;
}

// ===== Khớp =====

/**
 * Khớp theo số tiền, ghép cặp theo thời gian trong từng mệnh giá.
 * Bước 0: HĐ "N lần" khớp trước theo CÙNG 1 người chuyển (trong khung giờ) — tránh lấy GD cùng số tiền
 *         của khách khác chuyển sát giờ.
 * Bước 1: khung [HĐ − before, HĐ + after]. Các khung cùng độ dài nên duyệt HĐ theo giờ tăng dần
 *         và lấy GD sớm nhất còn trống trong khung là tối ưu (số cặp trong khung lớn nhất).
 * Bước 2: phần còn lại cùng số tiền ghép theo thứ tự thời gian → 'matched_late'.
 * Bước 3: phần dư → 'invoice_only' / 'bank_only', kèm gợi ý biên kỳ.
 * Bước 4 (amountTolerance > 0): phần dư lệch tiền lẻ trong khung giờ → 'matched' kèm amountDiff.
 */
export function reconcileByAmount(
  items: ReconItem[],
  txns: ReconBankTxn[],
  options: Partial<ReconOptions> = {}
): ReconPair[] {
  const opt = { ...DEFAULT_RECON_OPTIONS, ...options };
  type I = { item: ReconItem; t: number };
  type T = { txn: ReconBankTxn; t: number; used: boolean };

  const groups = new Map<number, { inv: I[]; bank: T[] }>();
  const group = (a: number) => {
    let g = groups.get(a);
    if (!g) { g = { inv: [], bank: [] }; groups.set(a, g); }
    return g;
  };
  for (const txn of txns) group(txn.credit).bank.push({ txn, t: viStampToMinutes(txn.date), used: false });

  const pairs: ReconPair[] = [];
  const payerMatched = matchMultiTransferByPayer(items, groups, opt, pairs);
  for (const item of items) {
    if (!payerMatched.has(item)) group(item.amount).inv.push({ item, t: viStampToMinutes(item.invoice.time) });
  }

  const pFrom = isoDateToMinutes(opt.periodFrom || '', false);
  const pTo = isoDateToMinutes(opt.periodTo || '', true);
  const byTime = (a: { t: number }, b: { t: number }) => (a.t || 0) - (b.t || 0);

  for (const [amount, g] of groups) {
    g.inv.sort(byTime);
    g.bank.sort(byTime);
    const leftover: I[] = [];

    // Bước 1: trong khung giờ
    let lo = 0;
    for (const inv of g.inv) {
      const start = inv.t - opt.windowBeforeMin;
      const end = inv.t + opt.windowAfterMin;
      while (lo < g.bank.length && g.bank[lo].t < start) lo++;
      let hit: T | null = null;
      for (let k = lo; k < g.bank.length && g.bank[k].t <= end; k++) {
        if (!g.bank[k].used) { hit = g.bank[k]; break; }
      }
      if (hit && Number.isFinite(inv.t)) {
        hit.used = true;
        pairs.push({ amount, item: inv.item, txn: hit.txn, kind: 'matched', deltaMinutes: hit.t - inv.t, edgeHint: null });
      } else {
        leftover.push(inv);
      }
    }

    // Bước 2: cùng số tiền nhưng ngoài khung giờ (lateWindow: chỉ trong khung rộng hơn, lấy GD sớm nhất còn trống)
    const freeBank = g.bank.filter(b => !b.used);
    const restInv: I[] = [];
    const late = (inv: I, b: T) => {
      b.used = true;
      const delta = b.t - inv.t;
      pairs.push({ amount, item: inv.item, txn: b.txn, kind: 'matched_late',
        deltaMinutes: Number.isFinite(delta) ? delta : null, edgeHint: null });
    };
    if (opt.lateWindow) {
      const { beforeMin, afterMin } = opt.lateWindow;
      for (const inv of leftover) {
        const hit = Number.isFinite(inv.t) ? freeBank.find(b => !b.used && b.t >= inv.t - beforeMin && b.t <= inv.t + afterMin) : undefined;
        if (hit) late(inv, hit); else restInv.push(inv);
      }
    } else {
      const n = Math.min(leftover.length, freeBank.length);
      for (let i = 0; i < n; i++) late(leftover[i], freeBank[i]);
      restInv.push(...leftover.slice(n));
    }
    const restBank = freeBank.filter(b => !b.used);

    // Bước 3: phần dư. HĐ dư: GD có thể nằm trước đầu kỳ (khách chuyển trước ≤ 24h) hoặc sau cuối kỳ (≤ 30').
    // GD dư: HĐ có thể xuất sau cuối kỳ (≤ 24h) hoặc trước đầu kỳ (≤ 30').
    for (const inv of restInv) {
      const edgeHint = inv.t < pFrom + opt.windowBeforeMin ? 'prev'
        : inv.t > pTo - opt.windowAfterMin ? 'next' : null;
      pairs.push({ amount, item: inv.item, txn: null, kind: 'invoice_only', deltaMinutes: null, edgeHint });
    }
    for (const b of restBank) {
      const edgeHint = b.t > pTo - opt.windowBeforeMin ? 'next'
        : b.t < pFrom + opt.windowAfterMin ? 'prev' : null;
      pairs.push({ amount, item: null, txn: b.txn, kind: 'bank_only', deltaMinutes: null, edgeHint });
    }
  }
  return (opt.amountTolerance || 0) > 0 ? matchSmallAmountDiff(pairs, opt) : pairs;
}

/** Bước 4 của reconcileByAmount: HĐ dư (theo giờ HĐ) lấy GD dư lệch ≤ amountTolerance, trong khung giờ, gần giờ HĐ nhất. */
function matchSmallAmountDiff(pairs: ReconPair[], opt: ReconOptions): ReconPair[] {
  const tol = opt.amountTolerance || 0;
  const bank = pairs.filter(p => p.kind === 'bank_only').map(p => ({ p, t: viStampToMinutes(p.txn!.date) }));
  const inv = pairs.filter(p => p.kind === 'invoice_only')
    .map(p => ({ p, t: viStampToMinutes(p.item!.invoice.time) }))
    .filter(x => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  const taken = new Set<ReconPair>();
  for (const x of inv) {
    let best: { p: ReconPair; t: number } | null = null;
    for (const b of bank) {
      const d = b.t - x.t;
      if (taken.has(b.p) || Math.abs(b.p.amount - x.p.amount) > tol || d < -opt.windowBeforeMin || d > opt.windowAfterMin) continue;
      if (!best || Math.abs(d) < Math.abs(best.t - x.t)) best = b;
    }
    if (!best) continue;
    taken.add(best.p);
    x.p.txn = best.p.txn;
    x.p.kind = 'matched';
    x.p.deltaMinutes = best.t - x.t;
    x.p.edgeHint = null;
    x.p.amountDiff = x.p.amount - best.p.amount;
  }
  if (taken.size > 0) console.debug(`[TransferReconcile] Khớp ${taken.size} cặp lệch tiền lẻ (≤ ${tol} ₫)`);
  return taken.size > 0 ? pairs.filter(p => !taken.has(p)) : pairs;
}

/**
 * Khớp `items` (HĐ CK) trước; GD còn dư mới khớp với `fallbackItems` (HĐĐT ghi Tiền mặt) — CHỈ nhận cặp trong khung giờ
 * ('matched'). HĐ dự phòng không khớp thì bỏ (HĐ tiền mặt không cần có GD) → không hiện ở "HĐ thiếu GD".
 */
export function reconcileWithFallback(
  items: ReconItem[],
  fallbackItems: ReconItem[],
  txns: ReconBankTxn[],
  options: Partial<ReconOptions> = {}
): ReconPair[] {
  const pairs = reconcileByAmount(items, txns, options);
  const left = pairs.filter(p => p.kind === 'bank_only').map(p => p.txn!);
  if (fallbackItems.length === 0 || left.length === 0) return pairs;
  const extra = reconcileByAmount(fallbackItems, left, options).filter(p => p.kind === 'matched');
  const used = new Set(extra.map(p => p.txn));
  console.debug(`[TransferReconcile] GD dư ${left.length} → khớp thêm ${extra.length} với HĐĐT ghi Tiền mặt`);
  return [...pairs.filter(p => !(p.kind === 'bank_only' && used.has(p.txn))), ...extra];
}

/**
 * Tên người chuyển đọc từ diễn giải (không dấu, chữ thường) — phần trước "chuyen tien/khoan", bỏ tiền tố ngân hàng / mã / SĐT:
 * "LE MINH TOAN chuyen tien", "QR - MAI THI THU chuyen tien", "TPB;69586928888;LE TAN PHUONG chuyen tien",
 * "MBVCB.168526...6307BFTV....HOANG THI LAN chuyen tien.CT tu ...", "154935256047 0347137106 LUONG THI DIEU NGA chuyen tien qua MoMo",
 * "IBFT NGUYEN VAN A chuyen tien". '' nếu không đọc được (vd "FT26307740128947").
 */
export function payerNameFromDesc(desc: string): string {
  const m = /^(.*?)\s*chuyen\s*(?:tien|khoan)\b/.exec(normalizeVi(desc || ''));
  if (!m) return '';
  const words = (m[1].split(/[.;\-]/).pop() || '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter(w => w && !/\d/.test(w));
  while (words.length && (words[0] === 'qr' || words[0] === 'ibft')) words.shift();
  return words.join(' ');
}

/**
 * Định danh người chuyển để khớp HĐ "N lần": TÊN trong diễn giải; diễn giải không có tên mới dùng TK đối ứng (cột G) + cột
 * "Chủ TK đối ứng". KHÔNG dùng cột H trước (04/11/2026): GD liên ngân hàng ghi chung "MBBANK IBFT", ví MoMo ghi tên công ty
 * (09/2026: 139 + 147 GD) → 2 khách khác nhau bị coi là 1 người (HD445796: lấy nhầm GD 30.000 18:57:05 của người khác thay vì
 * 17:14:00 của LE MINH TOAN). 16/11/2026: có tên trong diễn giải thì KHÔNG ghép TK đối ứng — ví ZaloPay đi qua TK trung gian
 * khác nhau mỗi lần (HD447878: "Nhi dung Zalopay chuyen tien" 32.000 qua TK 212356786 "CONG TY CO PHAN ZION", 30.000 qua TK
 * 0721100912006 "MBBANK IBFT") → 2 khoản của cùng 1 người bị tách, bước 1 lấy nhầm GD sớm nhất của 2 người khác. '' nếu không đọc được.
 */
export function payerKey(txn: Pick<ReconBankTxn, 'counterparty' | 'desc'> & { account?: string }): string {
  const fromDesc = payerNameFromDesc(txn.desc);
  if (fromDesc) return fromDesc;
  const name = normalizeVi(txn.counterparty || '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!name) return '';
  const account = String(txn.account || '').replace(/\D/g, '');
  return account ? `${account}|${name}` : name;
}

/** Tên người chuyển để hiển thị: tên trong diễn giải (cột H có thể chỉ là "MBBANK IBFT"), thiếu thì cột H / diễn giải. */
export function payerLabel(txn: Pick<ReconBankTxn, 'counterparty' | 'desc'>): string {
  return payerNameFromDesc(txn.desc).toUpperCase() || txn.counterparty || txn.desc;
}

type PayerTxn = { txn: ReconBankTxn; t: number; used: boolean };

/**
 * Bước 0 của reconcileByAmount: mỗi HĐ "N lần" (duyệt theo giờ HĐ) chọn 1 người chuyển có GD trống trong khung
 * cho nhiều khoản nhất (≥ 2; hòa → tổng |lệch giờ| nhỏ nhất), mỗi khoản lấy GD gần giờ HĐ nhất của người đó.
 * Khoản không phủ được để lại cho bước 1–3. Trả về các khoản đã khớp.
 */
function matchMultiTransferByPayer(
  items: ReconItem[],
  groups: Map<number, { bank: PayerTxn[] }>,
  opt: ReconOptions,
  pairs: ReconPair[]
): Set<ReconItem> {
  const matched = new Set<ReconItem>();
  const byInvoice = new Map<ReconInvoice, ReconItem[]>();
  for (const item of items) {
    if (item.partCount < 2) continue;
    const list = byInvoice.get(item.invoice) || [];
    list.push(item);
    byInvoice.set(item.invoice, list);
  }
  const invoices = [...byInvoice.entries()]
    .map(([invoice, parts]) => ({ parts, t: viStampToMinutes(invoice.time) }))
    .filter(x => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  for (const { parts, t } of invoices) {
    const inWindow = (b: PayerTxn) => !b.used && b.t >= t - opt.windowBeforeMin && b.t <= t + opt.windowAfterMin;
    const payers = new Set<string>();
    for (const part of parts) {
      for (const b of groups.get(part.amount)?.bank || []) {
        const key = inWindow(b) ? payerKey(b.txn) : '';
        if (key) payers.add(key);
      }
    }

    let best: { picks: [ReconItem, PayerTxn][]; cost: number } | null = null;
    for (const key of payers) {
      const taken = new Set<PayerTxn>();
      const picks: [ReconItem, PayerTxn][] = [];
      let cost = 0;
      for (const part of parts) {
        const hit = (groups.get(part.amount)?.bank || [])
          .filter(b => inWindow(b) && !taken.has(b) && payerKey(b.txn) === key)
          .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
        if (!hit) continue;
        taken.add(hit);
        picks.push([part, hit]);
        cost += Math.abs(hit.t - t);
      }
      if (picks.length < 2) continue;
      if (!best || picks.length > best.picks.length || (picks.length === best.picks.length && cost < best.cost)) {
        best = { picks, cost };
      }
    }
    if (!best) continue;
    for (const [part, hit] of best.picks) {
      hit.used = true;
      matched.add(part);
      pairs.push({ amount: part.amount, item: part, txn: hit.txn, kind: 'matched', deltaMinutes: hit.t - t, edgeHint: null });
    }
  }
  if (matched.size > 0) console.debug(`[TransferReconcile] Khớp ${matched.size} khoản CK nhiều lần theo người chuyển`);
  return matched;
}

// ===== Nhãn hiển thị / CSV =====

export const RECON_KIND_LABEL: Record<ReconKind, string> = {
  matched: 'Khớp',
  matched_late: 'Khớp (lệch giờ)',
  invoice_only: 'HĐ thiếu GD',
  bank_only: 'GD thừa',
};

export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  ok: 'Đủ',
  count_mismatch: 'Lệch số lần',
  sum_mismatch: 'Lệch tổng',
  unparsed: 'Chưa tách được',
};

export function edgeHintLabel(hint: 'prev' | 'next' | null): string {
  return hint === 'prev' ? 'Có thể thuộc kỳ trước hoặc chuyển khoản dư' : hint === 'next' ? 'Có thể thuộc kỳ sau hoặc chuyển khoản dư' : '';
}

/** Ghi chú thêm của cặp: HĐĐT trùng / chưa có số CQT / phát hành trễ, khớp lệch tiền lẻ, khớp với HĐĐT ghi Tiền mặt. */
export function pairFlags(p: ReconPair): string[] {
  const flags: string[] = [];
  if (p.item?.invoice.einvoiceDuplicate) flags.push(p.item.invoice.einvoiceDuplicate);
  if (p.item?.invoice.einvoiceIssue) flags.push(p.item.invoice.einvoiceIssue);
  if (p.item?.invoice.einvoiceLate) flags.push(p.item.invoice.einvoiceLate);
  if (p.amountDiff) flags.push(`lệch tiền lẻ ${p.amountDiff > 0 ? '+' : '−'}${Math.abs(p.amountDiff).toLocaleString('vi-VN')} ₫`);
  if (p.txn && p.item?.invoice.paymentMethod === 'TM') flags.push('HĐĐT ghi Tiền mặt');
  return flags;
}

/** Cặp đã ghép GD nhưng HĐĐT chưa có số CQT (nháp / CQT chưa chấp nhận) — BanHang tô vàng; phát hành trễ KHÔNG tính. */
export function isEInvoiceIssuePair(p: ReconPair): boolean {
  return !!p.txn && !!p.item?.invoice.einvoiceIssue;
}

/** Ghi chú hiển thị 1 cặp: lệch giờ / gợi ý biên kỳ + pairFlags. */
export function reconPairHint(p: ReconPair): string {
  const time = p.kind === 'matched_late' ? `lệch giờ ${formatDeltaMinutes(p.deltaMinutes)}` : edgeHintLabel(p.edgeHint);
  return [time, ...pairFlags(p)].filter(Boolean).join(' · ');
}

// CSV có cột "Lệch giờ (phút)" riêng → Gợi ý chỉ gồm biên kỳ + pairFlags
const csvHint = (p: ReconPair) => [edgeHintLabel(p.edgeHint), ...pairFlags(p)].filter(Boolean).join(' · ');

/** "1d 2h 05'" từ số phút (dấu − = khách chuyển trước HĐ) */
export function formatDeltaMinutes(min: number | null): string {
  if (min === null) return '';
  const sign = min < 0 ? '−' : '+';
  let m = Math.abs(min);
  const d = Math.floor(m / 1440); m -= d * 1440;
  const h = Math.floor(m / 60); m -= h * 60;
  return `${sign}${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m}'`;
}

function csvCell(v: string | number | null | undefined, isText: boolean): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Chặn Excel hiểu ô văn bản là công thức
  if (isText && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 1 cột CSV: tiêu đề + cách lấy giá trị; `text` = ô văn bản (chặn công thức Excel). */
type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined; text?: boolean };

function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [
    columns.map(c => c.header).join(';'),
    ...rows.map(r => columns.map(c => csvCell(c.value(r), !!c.text)).join(';')),
  ];
  return '﻿' + lines.join('\r\n');
}

/** Bảng (tiêu đề + dòng giá trị thô) — cùng cột với CSV; KeToan dùng để xuất 1 file Excel nhiều sheet (06/11/2026). */
export interface ReconTable {
  header: string[];
  rows: (string | number)[][];
}

function toTable<T>(columns: CsvColumn<T>[], rows: T[]): ReconTable {
  return { header: columns.map(c => c.header), rows: rows.map(r => columns.map(c => c.value(r) ?? '')) };
}

// Cột HĐĐT dùng chung 2 file CSV — số HĐĐT chỉ có khi CQT đã chấp nhận
const einvoiceColumns = (inv: (p: ReconPair) => ReconInvoice | undefined): CsvColumn<ReconPair>[] => [
  { header: 'Ký hiệu HĐĐT', value: p => inv(p)?.einvoiceSerial ?? '', text: true },
  { header: 'Số HĐĐT', value: p => inv(p)?.einvoiceNumber ?? '', text: true },
  { header: 'Trạng thái HĐĐT', value: p => inv(p)?.einvoiceStatus ?? '', text: true },
];

/** CSV toàn bộ đối soát — mỗi dòng 1 cặp (giống bảng 2 cột trên màn hình). */
function reconColumns(): CsvColumn<ReconPair>[] {
  const inv = (p: ReconPair) => p.item?.invoice;
  return [
    { header: 'Trạng thái', value: p => RECON_KIND_LABEL[p.kind], text: true },
    { header: 'Số tiền', value: p => p.amount },
    { header: 'Mã HĐ', value: p => inv(p)?.code ?? '', text: true },
    { header: 'Giờ HĐ', value: p => inv(p)?.time ?? '', text: true },
    ...einvoiceColumns(inv),
    { header: 'Khoản', value: p => p.item && p.item.partCount > 1 ? `${p.item.partIndex}/${p.item.partCount}` : '', text: true },
    { header: 'Ghi chú HĐ', value: p => inv(p)?.note ?? '', text: true },
    { header: 'Giờ GD', value: p => p.txn?.date ?? '', text: true },
    { header: 'Người chuyển', value: p => p.txn?.counterparty ?? '', text: true },
    { header: 'Diễn giải', value: p => p.txn?.desc ?? '', text: true },
    { header: 'Mã GD', value: p => p.txn?.code ?? '', text: true },
    { header: 'Lệch giờ (phút)', value: p => p.deltaMinutes },
    { header: 'Gợi ý', value: csvHint, text: true },
  ];
}

export function buildReconCsv(pairs: ReconPair[]): string {
  return toCsv(reconColumns(), pairs);
}

/** Như buildReconCsv, dạng bảng (sheet Excel). */
export function reconTable(pairs: ReconPair[]): ReconTable {
  return toTable(reconColumns(), pairs);
}

// Cột khớp GD dùng chung CSV CK nhiều lần / CK dư. `withBank: false` (chưa import sao kê) → bỏ hết,
// không thì mọi dòng ghi "HĐ thiếu GD", gây hiểu nhầm.
const bankMatchColumns = (withBank: boolean): CsvColumn<ReconPair>[] => withBank ? [
  { header: 'Trạng thái khớp', value: p => RECON_KIND_LABEL[p.kind], text: true },
  { header: 'Giờ GD', value: p => p.txn?.date ?? '', text: true },
  { header: 'Người chuyển', value: p => p.txn?.counterparty ?? '', text: true },
  { header: 'Mã GD', value: p => p.txn?.code ?? '', text: true },
  { header: 'Gợi ý', value: csvHint, text: true },
] : [];

/** CSV HĐ chuyển khoản nhiều lần — mỗi khoản 1 dòng, kèm GD đã khớp. */
function multiTransferColumns(withBank: boolean): CsvColumn<ReconPair>[] {
  const inv = (p: ReconPair) => p.item!.invoice;
  const partsSum = (p: ReconPair) => p.item!.note?.parts.reduce((s, x) => s + x, 0) ?? 0;
  const hasParts = (p: ReconPair) => !!p.item!.note?.parts.length;
  return [
    { header: 'Mã HĐ', value: p => inv(p).code, text: true },
    { header: 'Giờ HĐ', value: p => inv(p).time, text: true },
    ...einvoiceColumns(inv),
    { header: 'Tổng thanh toán', value: p => inv(p).total },
    { header: 'Ghi chú', value: p => inv(p).note, text: true },
    { header: 'Số lần', value: p => p.item!.note?.times ?? '' },
    { header: 'Khoản thứ', value: p => hasParts(p) ? p.item!.partIndex : '' },
    { header: 'Số tiền khoản', value: p => hasParts(p) ? p.item!.amount : '' },
    { header: 'Tổng các khoản', value: partsSum },
    { header: 'Chênh lệch', value: p => inv(p).total - partsSum(p) },
    { header: 'Tình trạng ghi chú', value: p => p.item!.note ? NOTE_STATUS_LABEL[p.item!.note.status] : '', text: true },
    ...bankMatchColumns(withBank),
  ];
}

export function buildMultiTransferCsv(pairs: ReconPair[], options: { withBank?: boolean } = {}): string {
  return toCsv(multiTransferColumns(options.withBank !== false), multiTransferPairs(pairs));
}

/** Như buildMultiTransferCsv, dạng bảng (sheet Excel). */
export function multiTransferTable(pairs: ReconPair[], options: { withBank?: boolean } = {}): ReconTable {
  return toTable(multiTransferColumns(options.withBank !== false), multiTransferPairs(pairs));
}

/** CSV HĐ khách chuyển khoản dư (đã trả lại tiền mặt) — mỗi HĐ 1 dòng, kèm GD đã khớp. */
function excessTransferColumns(withBank: boolean): CsvColumn<ReconPair>[] {
  const inv = (p: ReconPair) => p.item!.invoice;
  const ex = (p: ReconPair) => p.item!.excess!;
  return [
    { header: 'Mã HĐ', value: p => inv(p).code, text: true },
    { header: 'Giờ HĐ', value: p => inv(p).time, text: true },
    ...einvoiceColumns(inv),
    { header: 'Tổng thanh toán', value: p => inv(p).total },
    { header: 'Ghi chú', value: p => inv(p).note, text: true },
    { header: 'Khách chuyển', value: p => ex(p).transferred || '' },
    { header: 'Trả lại khách', value: p => ex(p).refund ?? '' },
    { header: 'Chênh lệch', value: p => ex(p).refund === null ? '' : inv(p).total - (ex(p).transferred - ex(p).refund!) },
    { header: 'Tình trạng ghi chú', value: p => NOTE_STATUS_LABEL[ex(p).status], text: true },
    ...bankMatchColumns(withBank),
  ];
}

export function buildExcessTransferCsv(pairs: ReconPair[], options: { withBank?: boolean } = {}): string {
  return toCsv(excessTransferColumns(options.withBank !== false), excessTransferPairs(pairs));
}

/** Như buildExcessTransferCsv, dạng bảng (sheet Excel). */
export function excessTransferTable(pairs: ReconPair[], options: { withBank?: boolean } = {}): ReconTable {
  return toTable(excessTransferColumns(options.withBank !== false), excessTransferPairs(pairs));
}

/** Các cặp thuộc HĐ có ghi chú "N lần", sắp theo giờ HĐ rồi khoản thứ. */
export function multiTransferPairs(pairs: ReconPair[]): ReconPair[] {
  return pairs
    .filter(p => !!p.item?.note)
    .sort((a, b) =>
      (viStampToMinutes(a.item!.invoice.time) - viStampToMinutes(b.item!.invoice.time)) ||
      a.item!.invoice.code.localeCompare(b.item!.invoice.code) ||
      a.item!.partIndex - b.item!.partIndex);
}

/** Các cặp thuộc HĐ có ghi chú "chuyển khoản dư", sắp theo giờ HĐ. */
export function excessTransferPairs(pairs: ReconPair[]): ReconPair[] {
  return pairs
    .filter(p => !!p.item?.excess)
    .sort((a, b) =>
      (viStampToMinutes(a.item!.invoice.time) - viStampToMinutes(b.item!.invoice.time)) ||
      a.item!.invoice.code.localeCompare(b.item!.invoice.code));
}

// ===== Bản lưu "CK nhiều lần" / "CK dư" (13/11/2026) =====
// BanHang chạy đối soát (có sao kê + HĐĐT) → tự lưu 2 tab này lên Firestore (Flask POST /api/bank-recon-snapshots,
// project taphoa39-supplies-invoices, collection `bank_recon_snapshots`, 1 doc / ngày bán) → KeToan đọc lại qua KeToanBackEnd
// (KeToan đối soát theo XML, không có ghi chú KiotViet nên không tự tách được). Đổi field = tăng RECON_SNAPSHOT_SCHEMA.

export const RECON_SNAPSHOT_SCHEMA = 'taphoa39-ck-snapshot/1';

export interface ReconSnapshotRow {
  code: string;            // mã HĐ KiotViet (HDxxxx) hoặc "HĐĐT <số>"
  einvoiceSerial: string;
  einvoiceNo: string;      // số HĐĐT CQT đã chấp nhận ('' nếu chưa)
  einvoiceStatus: string;
  time: string;            // giờ bán 'dd/mm/yyyy HH:mm:ss'
  total: number;           // tổng HĐ
  note: string;            // ghi chú KiotViet
  noteStatus: string;      // nhãn NOTE_STATUS_LABEL
  noteOk: boolean;
  part: string;            // CK nhiều lần: "1/2"; CK dư: ''
  amount: number;          // CK nhiều lần: số tiền khoản; CK dư: số khách chuyển
  refund: number | null;   // CK dư: số trả lại khách
  kind: ReconKind;
  txnDate: string;         // GD khớp ('' nếu không có)
  txnPayer: string;
  txnCode: string;
  hint: string;
}

export interface ReconSnapshotDay {
  day: string;             // yyyy-mm-dd (ngày bán)
  multi: ReconSnapshotRow[];
  excess: ReconSnapshotRow[];
}

/** Ngày 'dd/mm/yyyy …' → 'yyyy-mm-dd' */
const isoOfVi = (vi: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(vi || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

function snapshotRow(p: ReconPair, excess: boolean): ReconSnapshotRow {
  const it = p.item!;
  const inv = it.invoice;
  const status = excess ? it.excess!.status : it.note?.status;
  return {
    code: inv.code, einvoiceSerial: inv.einvoiceSerial || '', einvoiceNo: inv.einvoiceNumber || '', einvoiceStatus: inv.einvoiceStatus || '',
    time: inv.time, total: inv.total, note: inv.note, noteStatus: status ? NOTE_STATUS_LABEL[status] : '', noteOk: status === 'ok',
    part: !excess && it.partCount > 1 ? `${it.partIndex}/${it.partCount}` : '',
    amount: excess ? it.excess!.transferred : it.amount, refund: excess ? it.excess!.refund : null,
    kind: p.kind, txnDate: p.txn?.date || '', txnPayer: p.txn ? payerLabel(p.txn) : '', txnCode: p.txn?.code || '', hint: reconPairHint(p),
  };
}

/**
 * Tách 2 tab theo NGÀY BÁN của HĐ — mọi ngày trong [from, to] đều có mặt (mảng rỗng = đã chạy, không có HĐ nào) để lần chạy sau
 * ghi đè đúng ngày. HĐ ngoài [from, to] bỏ qua.
 */
export function buildReconSnapshotDays(pairs: ReconPair[], from: string, to: string): ReconSnapshotDay[] {
  const days = new Map<string, ReconSnapshotDay>();
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    days.set(day, { day, multi: [], excess: [] });
  }
  for (const p of multiTransferPairs(pairs)) days.get(isoOfVi(p.item!.invoice.time))?.multi.push(snapshotRow(p, false));
  for (const p of excessTransferPairs(pairs)) days.get(isoOfVi(p.item!.invoice.time))?.excess.push(snapshotRow(p, true));
  return [...days.values()];
}
