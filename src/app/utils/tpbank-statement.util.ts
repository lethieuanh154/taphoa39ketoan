/**
 * Parser Bảng kê giao dịch TPBank (.xlsx) - thuần trình duyệt, KHÔNG dùng thư viện.
 *
 * File .xlsx là 1 ZIP (nén DEFLATE) chứa các XML. Ta tự đọc central directory của ZIP,
 * lấy `xl/worksheets/sheet1.xml`, giải nén bằng DecompressionStream('deflate-raw') (native),
 * rồi bóc dữ liệu giao dịch bằng regex.
 *
 * Layout cột TPBank (sheet SAO KÊ GIAO DỊCH TÀI KHOẢN), data bắt đầu sau dòng tiêu đề:
 *   A = Ngày giao dịch (dd/mm/yyyy hh:mm:ss)   B = Ngày giá trị (dd/mm/yyyy)
 *   C = Diễn giải        D = Ghi nợ (Debit)     E = Ghi có (Credit)   F = Số dư
 *   G = TK đối ứng       H = Chủ TK đối ứng      I = Mã giao dịch
 */

export interface BankTransaction {
  date: string;        // Ngày giao dịch (cột A, giữ nguyên chuỗi)
  desc: string;        // Diễn giải (cột C)
  credit: number;      // Ghi có (cột E) - tiền vào
  counterparty: string;// Chủ TK đối ứng (cột H)
  code: string;        // Mã giao dịch (cột I)
}

export interface BankStatementResult {
  transactions: BankTransaction[]; // chỉ các dòng có Ghi có > 0
  totalCredit: number;             // tổng Ghi có (tiền vào)
  count: number;                   // số giao dịch tiền vào
  fromDate: string;                // yyyy-mm-dd (nhỏ nhất theo Ngày giao dịch) - phục vụ fetch KiotViet
  toDate: string;                  // yyyy-mm-dd (lớn nhất theo Ngày giao dịch)
  firstTxnAt: string;              // 'yyyy-mm-dd HH:mm:ss' - GD sớm nhất
  lastTxnAt: string;               // 'yyyy-mm-dd HH:mm:ss' - GD muộn nhất
  periodFrom: string;              // yyyy-mm-dd - kỳ sao kê ghi ở header (lọc theo Ngày giá trị)
  periodTo: string;                // yyyy-mm-dd - kỳ sao kê ghi ở header
}

/** Giải nén dữ liệu deflate-raw bằng API trình duyệt. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof (globalThis as any).DecompressionStream === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ DecompressionStream. Vui lòng dùng Chrome/Edge mới.');
  }
  const ds = new (globalThis as any).DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/** Trích 1 entry trong ZIP theo tên file, trả về nội dung đã giải nén. */
async function readZipEntry(buffer: ArrayBuffer, entryName: string): Promise<string | null> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Tìm End Of Central Directory (0x06054b50) quét từ cuối
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('File không phải .xlsx hợp lệ (thiếu EOCD).');

  const cdCount = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true); // offset central directory

  for (let k = 0; k < cdCount; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (name === entryName) {
      // Đọc local header để biết nameLen/extraLen thực tế (có thể khác central dir)
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(dataStart, dataStart + compSize);
      const out = method === 0 ? raw : await inflateRaw(raw);
      return new TextDecoder('utf-8').decode(out);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** "01/07/2026 21:04:21" | "01/07/2026" -> "2026-07-01" (rỗng nếu không hợp lệ) */
function toIsoDate(raw: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((raw || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * Kỳ sao kê ở header ("Thời gian (period): 17/08/2026 - 17/08/2026").
 * Ô header dùng sharedStrings (khác data row dùng inline string) nên đọc riêng file này.
 * Kỳ sao kê lọc theo NGÀY GIÁ TRỊ → có thể khác khoảng Ngày giao dịch thực tế.
 */
async function readPeriod(buffer: ArrayBuffer): Promise<[string, string]> {
  try {
    const xml = await readZipEntry(buffer, 'xl/sharedStrings.xml');
    const m = /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/.exec(xml || '');
    return m ? [toIsoDate(m[1]), toIsoDate(m[2])] : ['', ''];
  } catch {
    return ['', ''];
  }
}

/** Đọc & phân tích file Bảng kê TPBank. */
export async function parseTpBankStatement(file: File): Promise<BankStatementResult> {
  const buffer = await file.arrayBuffer();
  const xml = await readZipEntry(buffer, 'xl/worksheets/sheet1.xml');
  if (!xml) throw new Error('Không đọc được sheet dữ liệu trong file .xlsx.');

  const transactions: BankTransaction[] = [];
  const stamps: string[] = []; // 'yyyy-mm-dd HH:mm:ss' (sort được bằng so sánh chuỗi)
  const dtRe = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/; // cột A dòng dữ liệu

  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(xml))) {
    const cells: Record<string, string | number> = {};
    let c: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(row[1]))) {
      const col = c[1];
      const inner = c[2];
      const strM = /<is><t[^>]*>([\s\S]*?)<\/t><\/is>/.exec(inner);
      const numM = /<v>([\s\S]*?)<\/v>/.exec(inner);
      cells[col] = strM ? strM[1] : (numM ? Number(numM[1]) : '');
    }

    // Chỉ nhận dòng dữ liệu (cột A là ngày giờ giao dịch)
    if (typeof cells['A'] !== 'string' || !dtRe.test(cells['A'])) continue;

    // Mốc ngày lấy theo NGÀY GIAO DỊCH (cột A), KHÔNG lấy Ngày giá trị (cột B).
    // TPBank lọc bảng kê theo Ngày giá trị: GD Chủ Nhật có ngày giá trị = Thứ 2 nên
    // bảng kê "kỳ Thứ 2" chứa cả GD Chủ Nhật. Cột A giữ nguyên ngày giờ thật của GD.
    const iso = toIsoDate(String(cells['A']));
    if (iso) stamps.push(`${iso} ${String(cells['A']).slice(11, 19)}`);

    const credit = typeof cells['E'] === 'number' ? cells['E'] : 0;
    if (credit > 0) {
      transactions.push({
        date: String(cells['A']),
        desc: String(cells['C'] || '').trim(),
        credit,
        counterparty: String(cells['H'] || '').trim(),
        code: String(cells['I'] || '').trim(),
      });
    }
  }

  if (transactions.length === 0) {
    throw new Error('Không tìm thấy giao dịch "Ghi có" nào trong file. Kiểm tra lại file Bảng kê TPBank.');
  }

  stamps.sort();
  const first = stamps[0] || '';
  const last = stamps[stamps.length - 1] || '';
  const period = await readPeriod(buffer);
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
  return {
    transactions,
    totalCredit,
    count: transactions.length,
    fromDate: first.slice(0, 10),
    toDate: last.slice(0, 10),
    firstTxnAt: first,
    lastTxnAt: last,
    periodFrom: period[0],
    periodTo: period[1],
  };
}
