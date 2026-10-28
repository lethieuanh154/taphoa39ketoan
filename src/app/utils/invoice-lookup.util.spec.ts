import { LookupPortal, applyPortal, detectLookup, linkTemplate, looksInvoiceSpecific, normField } from './invoice-lookup.util';
import { parseInvoiceXml } from './invoice-xml.util';

const ttin = (k: string, v: string) => `<TTin><TTruong>${k}</TTruong><KDLieu>string</KDLieu><DLieu>${v}</DLieu></TTin>`;
const xml = (tcgp: string, head: string, line = '') => `<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon>`
  + `<KHHDon>C26TAA</KHHDon><SHDon>12</SHDon><NLap>2026-10-27</NLap><MSTTCGP>${tcgp}</MSTTCGP><TTKhac>${head}</TTKhac></TTChung>`
  + `<NDHDon><NBan><Ten>NCC</Ten><MST>0400000001</MST></NBan><NMua><Ten>CTY</Ten><MST>0402318272</MST></NMua>`
  + `<DSHHDVu><HHDVu><STT>1</STT><TTKhac>${line}</TTKhac></HHDVu></DSHHDVu><TToan><TgTCThue>100</TgTCThue><TgTThue>8</TgTThue>`
  + `<TgTTTBSo>108</TgTTTBSo></TToan></NDHDon></DLHDon><MCCQT Id="x">00ABC</MCCQT></HDon>`;

describe('invoice-lookup.util', () => {
  it('chuẩn hóa tên trường (bỏ dấu, khoảng trắng, gạch dưới)', () => {
    expect(normField('Mã số bí mật')).toBe('masobimat');
    expect(normField('QuanLy_SoBaoMat')).toBe('quanlysobaomat');
    expect(normField('DC TC')).toBe('dctc');
  });

  it('MISA: TransactionID → link mở thẳng', () => {
    const l = detectLookup('0101243150', [['TransactionID', 'ABC123XYZ']]);
    expect(l).toEqual(jasmine.objectContaining({ provider: 'MISA meInvoice', code: 'ABC123XYZ', direct: true }));
    expect(l.url).toBe('https://www.meinvoice.vn/tra-cuu/?sc=ABC123XYZ');
  });

  it('Thái Sơn: Mã TC + DC TC (link trong XML)', () => {
    const l = detectLookup('0101300842', [['DC TC', 'http://abc.einvoice.com.vn'], ['Mã TC', '7AAEK4KF']]);
    expect(l).toEqual(jasmine.objectContaining({ code: '7AAEK4KF', url: 'http://abc.einvoice.com.vn', direct: false }));
  });

  it('Viettel: bỏ "Mã số" (GUID), lấy "Mã số bí mật"', () => {
    const l = detectLookup('0100109106', [['Mã số', 'E570CDCB-7DC2-44E0-9D71-DCE355A3490D'], ['Mã số bí mật', 'QQS1E0AU']]);
    expect(l.code).toBe('QQS1E0AU');
    expect(l.codeField).toBe('Mã số bí mật');
  });

  it('MSTTCGP có đuôi chi nhánh, NCC chưa biết, không có mã', () => {
    expect(detectLookup('0106026495-001', [['Mã tra cứu', '569D3F56']]).provider).toBe('M-invoice');
    expect(detectLookup('0999999999', [['MaTraCuu', 'X1Y2Z3']])).toEqual(jasmine.objectContaining({ provider: '', code: 'X1Y2Z3', url: '' }));
    expect(detectLookup('0100684378', [])).toEqual(jasmine.objectContaining({ provider: 'VNPT Invoice', code: '', url: '' }));
  });

  it('parseInvoiceXml: lấy mã ở phần đầu HĐ, bỏ TTKhac trong dòng hàng, có MCCQT', () => {
    const inv = parseInvoiceXml(xml('0101300842', ttin('Mã TC', 'HEAD1234'), ttin('Mã TC', 'LINE9999')), 'a.xml')!;
    expect(inv.lookup?.code).toBe('HEAD1234');
    expect(inv.mccqt).toBe('00ABC');
    const none = parseInvoiceXml(xml('0101300842', '', ttin('Mã TC', 'LINE9999')), 'b.xml')!;
    expect(none.lookup?.code).toBe('');
  });

  it('link gán tay: link mẫu {code} mở thẳng bằng mã; HĐ không mã → trang tra cứu', () => {
    const p: LookupPortal = { id: 'tcgp-0401486901', scope: 'tcgp', mst: '0401486901', url: 'https://tc.x.vn/?ma={code}' };
    expect(applyPortal(p, '2360P64K3YFJ')).toEqual({ url: 'https://tc.x.vn/?ma=2360P64K3YFJ', direct: true });
    expect(applyPortal(p, '')).toEqual({ url: 'https://tc.x.vn/?ma=', direct: false });
    expect(applyPortal({ ...p, url: 'https://0400101891-tt78.vnpt-invoice.com.vn/' }, 'A1')).toEqual(
      { url: 'https://0400101891-tt78.vnpt-invoice.com.vn/', direct: false });
  });

  it('link dán từ email: nhận ra mã → link mẫu; link riêng 1 HĐ không có mã thì cảnh báo', () => {
    expect(linkTemplate('https://tc.x.vn/tra-cuu?ma=4522d028f8&t=1', '4522D028F8')).toBe('https://tc.x.vn/tra-cuu?ma={code}&t=1');
    expect(linkTemplate('https://tc.x.vn/', '4522D028F8')).toBe('');
    expect(linkTemplate('https://tc.x.vn/?k=AQ%2BB', 'AQ+B')).toBe('https://tc.x.vn/?k={code}');
    expect(looksInvoiceSpecific('https://x.vnpt-invoice.com.vn/HomeNoLogin/SearchByFkey?strFkey=AB12CD34EF')).toBeTrue();
    expect(looksInvoiceSpecific('https://x.vnpt-invoice.com.vn/')).toBeFalse();
    expect(looksInvoiceSpecific('http://tracuu.ehoadon.vn/AB12CD34EF5')).toBeTrue();
    expect(looksInvoiceSpecific('https://tracuuhoadon.mobifoneinvoice.vn/tra-cuu')).toBeFalse();
    expect(looksInvoiceSpecific('http://ehoadon.vn/hdpb6a')).toBeFalse();
  });
});
