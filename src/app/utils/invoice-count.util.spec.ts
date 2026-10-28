import { CountEmail, CountInvoice, EmailInv, compareCounts, countFetchTo } from './invoice-count.util';

let n = 0;
const mail = (at: string, from_name = 'NCC', subject = 'Thông báo hóa đơn'): CountEmail =>
  ({ id: `m${++n}`, thread_id: `t${n}`, at: `${at}T09:00:00+07:00`, from_name, from_email: 'noreply@x.vn', subject });
const keyed = (at: string, k: Partial<EmailInv>, att = ['xml', 'pdf']): CountEmail =>
  ({ ...mail(at), inv: { mst: '', tpl: '', series: '', no: 0, source: 'xml', ...k } as EmailInv, att });
const inv = (date: string, no: string, seller = 'CÔNG TY TNHH A', sellerMst = '0400000001'): CountInvoice =>
  ({ date, no, symbol: '1C26TAA', seller, sellerMst });

describe('invoice-count.util compareCounts', () => {
  it('HĐ 27/10, email 28/10 → khớp, ghi nhận gửi trễ', () => {
    const r = compareCounts([inv('2026-10-27', '2637')], [mail('2026-10-28')], '2026-10-27', '2026-10-28');
    expect(r).toEqual(jasmine.objectContaining({ xml: 1, email: 1, ok: true, late: 1 }));
  });

  it('HĐ cuối kỳ, email sang kỳ sau → vẫn khớp; email kỳ sau không ghép HĐ nào thì không tính', () => {
    const r = compareCounts([inv('2026-10-31', '10')], [mail('2026-11-01'), mail('2026-11-02')], '2026-10-01', '2026-10-31');
    expect(r).toEqual(jasmine.objectContaining({ xml: 1, email: 1, ok: true, afterPeriod: 1 }));
    expect(r.emailOnly.length).toBe(0);
  });

  it('email đầu kỳ của HĐ kỳ trước → không tính', () => {
    const r = compareCounts([inv('2026-09-30', '11'), inv('2026-10-05', '12')], [mail('2026-10-01'), mail('2026-10-05')],
      '2026-10-01', '2026-10-31');
    expect(r).toEqual(jasmine.objectContaining({ xml: 1, email: 1, ok: true, prevPeriod: 1 }));
  });

  it('quá LAG_DAYS ngày → không ghép: HĐ thiếu email + email thừa', () => {
    const r = compareCounts([inv('2026-10-01', '13')], [mail('2026-10-10')], '2026-10-01', '2026-10-31');
    expect(r.ok).toBeFalse();
    expect(r.xmlOnly.length).toBe(1);
    expect(r.emailOnly.length).toBe(1);
  });

  it('ưu tiên email có số HĐ / tên NCC trong tiêu đề', () => {
    const a = inv('2026-10-27', '2637', 'CÔNG TY CP MUỐI MIỀN TRUNG', '0400101891');
    const b = inv('2026-10-27', '88', 'CÔNG TY TNHH SỮA HÒA BÌNH', '0400999999');
    const ma = mail('2026-10-27', 'Muối Miền Trung', 'HĐ số 0002637');
    const mb = mail('2026-10-28', 'Sữa Hòa Bình');
    const r = compareCounts([b, a], [ma, mb], '2026-10-27', '2026-10-28');
    expect(r.ok).toBeTrue();
    expect(r.pairs.find(p => p.invoice === a)!.email).toBe(ma);
    expect(r.pairs.find(p => p.invoice === b)!.email).toBe(mb);
  });

  it('countFetchTo: + 3 ngày, không vượt hôm nay', () => {
    expect(countFetchTo('2026-10-28', '2026-12-01')).toBe('2026-10-31');
    expect(countFetchTo('2026-10-28', '2026-10-29')).toBe('2026-10-29');
    expect(countFetchTo('2026-10-31', '2026-10-28')).toBe('2026-10-31');
  });

  it('khóa HĐ (MST + ký hiệu + số): khớp dù email trễ hơn 3 ngày, không ghép nhầm HĐ khác cùng ngày', () => {
    const a = inv('2026-10-01', '2637', 'A', '0400101891'), b = inv('2026-10-10', '5', 'B', '0400000002');
    const r = compareCounts([a, b], [keyed('2026-10-10', { mst: '0400101891', series: 'C26TAA', no: 2637 })], '2026-10-01', '2026-10-31');
    expect(r.pairs.length).toBe(1);
    expect(r.pairs[0].invoice).toBe(a);
    expect(r.pairs[0].byKey).toBeTrue();
    expect(r.xmlOnly).toEqual([b]);
  });

  it('khóa HĐ không có trong XML → email không khớp, kèm lý do; email gửi lại cùng HĐ → gửi trùng, không tính', () => {
    const a = inv('2026-10-05', '12');
    const r = compareCounts([a], [
      keyed('2026-10-05', { mst: '0400000001', series: 'C26TAA', no: 12 }),
      keyed('2026-10-06', { mst: '0400000001', series: 'C26TAA', no: 12 }),
      keyed('2026-10-07', { mst: '0400000009', series: 'C26TBB', no: 77 }),
    ], '2026-10-01', '2026-10-31');
    expect(r).toEqual(jasmine.objectContaining({ xml: 1, email: 2, ok: false }));
    expect(r.duplicates.length).toBe(1);
    expect(r.emailOnly[0].reason).toContain('KHÔNG có trong thư mục XML');
  });

  it('chỉ có số HĐ (tiêu đề): ghép HĐ cùng số lập gần ngày nhận', () => {
    const old = inv('2026-08-01', '71', 'X', '0400000003'), cur = inv('2026-10-20', '71', 'Y', '0400000004');
    const r = compareCounts([old, cur], [keyed('2026-10-21', { no: 71, source: 'subject' }, [])], '2026-10-01', '2026-10-31');
    expect(r.ok).toBeTrue();
    expect(r.pairs[0].invoice).toBe(cur);
  });

  it('email không khóa, không đính kèm, không ghép được → lý do "có thể không phải email HĐ"', () => {
    const r = compareCounts([], [{ ...mail('2026-10-05'), inv: null, att: [] }], '2026-10-01', '2026-10-31');
    expect(r.emailOnly[0].reason).toContain('không phải email HĐ');
    expect(r.noKey).toBe(1);
  });
});
