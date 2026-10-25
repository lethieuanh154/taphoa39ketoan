/**
 * ĐẾM NHANH (25/10/2026) — Kiểm tra số lượng HĐ đầu vào: số EMAIL nhận trong kỳ ⇄ số HĐ trong thư mục XML (kể cả HĐ thay thế /
 * điều chỉnh — mỗi HĐ 1 email). Bằng nhau → khớp; lệch → so THEO NGÀY (ngày lập HĐ ⇄ ngày Gmail nhận) để chỉ ra ngày thừa / thiếu.
 * Thuần hàm. Ngày HĐ XML chỉ có ngày (không giờ) nên so theo ngày; NCC gửi trễ 1 ngày → ngày này +1, ngày kế −1 (ghi gợi ý).
 */
export interface CountEmail { id: string; thread_id: string; at: string; from_name: string; from_email: string; subject: string; }
export interface CountInvoice { date: string; no: string; symbol: string; seller: string; sellerMst: string; }

export interface CountDay {
  date: string;              // yyyy-mm-dd
  xml: number;
  email: number;
  diff: number;              // email − xml (> 0: thừa email, < 0: thiếu email)
  invoices: CountInvoice[];
  emails: CountEmail[];
  hint: string;
}

export interface CountResult { xml: number; email: number; diff: number; ok: boolean; days: CountDay[]; }

export function compareCounts(invoices: CountInvoice[], emails: CountEmail[], from: string, to: string): CountResult {
  const map = new Map<string, CountDay>();
  const day = (d: string) => {
    let x = map.get(d);
    if (!x) map.set(d, x = { date: d, xml: 0, email: 0, diff: 0, invoices: [], emails: [], hint: '' });
    return x;
  };
  for (const i of invoices) {
    if (i.date < from || i.date > to) continue;
    const d = day(i.date);
    d.xml++;
    d.invoices.push(i);
  }
  for (const e of emails) {
    const d = day(e.at.slice(0, 10));      // `at` là giờ VN (ISO +07:00) → 10 ký tự đầu = ngày VN
    d.email++;
    d.emails.push(e);
  }
  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) d.diff = d.email - d.xml;
  // NCC gửi email trễ / sớm 1 ngày: ngày này thiếu, ngày kế thừa (hoặc ngược lại) cùng số lượng
  for (let k = 0; k < days.length; k++) {
    const d = days[k], n = days[k + 1];
    if (!d.diff || !n || !n.diff || d.diff !== -n.diff) continue;
    if ((Date.parse(n.date) - Date.parse(d.date)) / 86400000 !== 1) continue;
    const msg = d.diff < 0 ? `có thể ${-d.diff} email gửi trễ sang ${vi(n.date)}` : `có thể ${d.diff} email của HĐ ngày ${vi(n.date)} gửi sớm`;
    d.hint = msg;
    n.hint = d.diff < 0 ? `có thể ${n.diff} email của HĐ ngày ${vi(d.date)}` : `có thể thiếu ${-n.diff} email (gửi sớm từ ${vi(d.date)})`;
  }
  const xml = days.reduce((s, d) => s + d.xml, 0), email = days.reduce((s, d) => s + d.email, 0);
  return { xml, email, diff: email - xml, ok: xml === email, days };   // tổng bằng nhau = khớp (user 25/10/2026); lệch theo ngày chỉ để xem
}

function vi(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
