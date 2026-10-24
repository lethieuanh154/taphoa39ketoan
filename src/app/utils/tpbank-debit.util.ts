/**
 * SAO KÊ TPBank — đọc giao dịch TIỀN RA (cột D "Ghi nợ") cho Đối soát CK → Chuyển khoản HĐ đầu vào (23/10/2026).
 * KHÔNG phải vùng mirror: `tpbank-statement.util.ts` (giống hệt BanHang) chỉ đọc Ghi có; file này riêng của KeToan để không phải
 * sửa file dùng chung với BanHang. Cùng layout cột: A Ngày GD · B Ngày giá trị · C Diễn giải · D Ghi nợ · E Ghi có · F Số dư ·
 * G TK đối ứng · H Chủ TK đối ứng · I Mã GD. Đọc được ô chuỗi inline (file TPBank thật) lẫn sharedStrings (file Excel lưu lại).
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface DebitTxn {
  date: string;          // 'dd/mm/yyyy HH:mm:ss' (cột A, giữ nguyên)
  iso: string;           // 'yyyy-mm-dd HH:mm:ss' — so sánh / sắp xếp
  desc: string;          // diễn giải
  amount: number;        // Ghi nợ (tiền ra)
  counterparty: string;  // chủ TK nhận
  account: string;       // TK nhận
  code: string;          // mã GD
}

export interface DebitStatement {
  transactions: DebitTxn[];
  total: number;
  fromDate: string;      // yyyy-mm-dd — GD sớm nhất (mọi GD, kể cả tiền vào)
  toDate: string;
  periodFrom: string;    // kỳ ghi ở đầu sao kê (lọc theo ngày giá trị)
  periodTo: string;
  files: string[];
}

const DT_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/;

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
}

/** 1 file Bảng kê TPBank (.xlsx) → giao dịch tiền ra */
export async function parseTpBankDebits(file: File): Promise<DebitStatement> {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: f => f.name === 'xl/worksheets/sheet1.xml' || f.name === 'xl/sharedStrings.xml'
    });
  } catch {
    throw new Error(`${file.name}: không phải file .xlsx hợp lệ`);
  }
  const sheet = zip['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error(`${file.name}: không thấy sheet dữ liệu`);
  const ssXml = zip['xl/sharedStrings.xml'] ? strFromU8(zip['xl/sharedStrings.xml']) : null;
  const ss = sharedStrings(ssXml);
  const xml = strFromU8(sheet);

  const transactions: DebitTxn[] = [];
  const stamps: string[] = [];
  for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string | number> = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner = ''] = c;
      const inline = /<is>([\s\S]*?)<\/is>/.exec(inner);
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (inline) cells[col] = decodeXml([...inline[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''));
      else if (v && /t="s"/.test(attrs)) cells[col] = ss[+v[1]] ?? '';
      else if (v && /t="(str|inlineStr)"/.test(attrs)) cells[col] = decodeXml(v[1]);
      else if (v) cells[col] = Number(v[1]);
    }
    const m = DT_RE.exec(String(cells['A'] ?? '').trim());
    if (!m) continue;
    const iso = `${m[3]}-${m[2]}-${m[1]} ${m[4]}`;
    stamps.push(iso);
    const amount = typeof cells['D'] === 'number' ? cells['D'] : Number(String(cells['D'] ?? '').replace(/[^\d.]/g, '')) || 0;
    if (amount > 0) {
      transactions.push({
        date: String(cells['A']).trim(), iso, amount: Math.round(amount),
        desc: String(cells['C'] ?? '').trim(), account: String(cells['G'] ?? '').trim(),
        counterparty: String(cells['H'] ?? '').trim(), code: String(cells['I'] ?? '').trim(),
      });
    }
  }
  if (!stamps.length) throw new Error(`${file.name}: không thấy dòng giao dịch nào — có đúng file Bảng kê TPBank không?`);
  stamps.sort();
  const period = /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(ssXml || '') || /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(xml);
  return {
    transactions, total: transactions.reduce((s, t) => s + t.amount, 0),
    fromDate: stamps[0].slice(0, 10), toDate: stamps[stamps.length - 1].slice(0, 10),
    periodFrom: period ? `${period[3]}-${period[2]}-${period[1]}` : '', periodTo: period ? `${period[6]}-${period[5]}-${period[4]}` : '',
    files: [file.name],
  };
}

/** Nhiều file (vd sao kê từng tuần) → gộp, bỏ GD trùng (cùng mã GD, hoặc cùng giờ + số tiền + người nhận khi không có mã) */
export async function parseTpBankDebitFiles(files: File[]): Promise<DebitStatement> {
  return mergeDebitStatements(await Promise.all(files.map(parseTpBankDebits)));
}

/** Gộp sao kê đã đọc (xlsx và / hoặc PDF — tpbank-pdf.util.ts), bỏ GD trùng */
export function mergeDebitStatements(list: DebitStatement[]): DebitStatement {
  const seen = new Set<string>();
  const transactions: DebitTxn[] = [];
  for (const st of list) {
    for (const t of st.transactions) {
      const k = t.code || `${t.iso}|${t.amount}|${t.counterparty}`;
      if (seen.has(k)) continue;
      seen.add(k);
      transactions.push(t);
    }
  }
  transactions.sort((a, b) => a.iso.localeCompare(b.iso));
  const pick = (xs: string[], dir: 1 | -1) => xs.filter(Boolean).sort()[dir === 1 ? 0 : xs.filter(Boolean).length - 1] || '';
  return {
    transactions, total: transactions.reduce((s, t) => s + t.amount, 0),
    fromDate: pick(list.map(l => l.fromDate), 1), toDate: pick(list.map(l => l.toDate), -1),
    periodFrom: pick(list.map(l => l.periodFrom), 1), periodTo: pick(list.map(l => l.periodTo), -1),
    files: list.flatMap(l => l.files),
  };
}
