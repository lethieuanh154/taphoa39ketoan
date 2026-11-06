import { strFromU8, unzipSync } from 'fflate';
import { EXPORT_SCHEMA, VIETDA_HEADER, buildBankReconWorkbook, vietdaRows, BankReconExportInput } from './bank-recon-export.util';
import { expandInvoiceItems, reconcileByAmount, ReconInvoice } from './transfer-reconcile.util';
import { PurchaseMatchRow } from './purchase-transfer-reconcile.util';
import { DebitTxn } from './tpbank-debit.util';

const inv = (code: string, total: number, time: string, o: Partial<ReconInvoice> = {}): ReconInvoice =>
  ({ id: code, code, total, time, note: 'chuyển khoản', einvoiceSerial: 'C26MSM', einvoiceNumber: '33427',
    einvoiceStatus: 'CQT chấp nhận', einvoiceIssue: '', ...o });
const debit = (code: string, amount: number, iso: string): DebitTxn => ({
  code, amount, iso, date: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11)}`, desc: 'TT HD 123',
  counterparty: 'CONG TY ABC', account: '0011',
});

function input(): BankReconExportInput {
  const salePairs = reconcileByAmount(expandInvoiceItems([
    inv('HD1', 50000, '04/11/2026 10:00:00'),
    inv('HD2', 70000, '04/11/2026 11:00:00', { einvoiceNumber: '', einvoiceStatus: 'Nháp (chưa phát hành)', einvoiceIssue: 'HĐĐT chưa phát hành (nháp)' }),
  ]), [
    { code: 'T1', credit: 50000, date: '04/11/2026 09:58:00', counterparty: 'MBBANK IBFT', desc: 'LE VAN A chuyen tien', account: '0905' },
    { code: 'T2', credit: 70000, date: '04/11/2026 10:59:00', counterparty: 'B', desc: 'B chuyen tien' },
    { code: 'T3', credit: 99000, date: '04/11/2026 08:00:00', counterparty: 'C', desc: 'C chuyen tien' },
  ]);
  const purchaseRows: PurchaseMatchRow[] = [
    { kind: 'matched_group', invoices: [
      { key: 'a', no: '123', symbol: 'C26TAA', date: '2026-11-01', sellerMst: '0401', sellerName: 'CONG TY ABC', total: 300000, source: 'xml' },
      { key: 'b', no: '124', symbol: 'C26TAA', date: '2026-11-02', sellerMst: '0401', sellerName: 'CONG TY ABC', total: 200000, source: 'xml' },
    ], txns: [debit('D1', 500000, '2026-11-04 09:00:00')], amount: 500000, days: 2, confidence: 'cao', hint: '' },
    { kind: 'bank_only', invoices: [], txns: [debit('D2', 1000000, '2026-11-04 12:00:00')], amount: 1000000, days: null, confidence: '', hint: '' },
  ];
  return { from: '2026-11-04', to: '2026-11-04', statementFiles: ['sk.xlsx'], salePairs, saleWithBank: true, purchaseRows, debitTxns: [] };
}

describe('bank-recon-export.util', () => {
  it('Nhap-VietDA: Thu + Chi cùng cột, sắp theo giờ GD, lý do không lập phiếu', () => {
    const rows = vietdaRows(input());
    expect(rows.map(r => r['Mã GD'])).toEqual(['T3', 'D1', 'T1', 'T2', 'D2']);
    const by = (c: string) => rows.find(r => r['Mã GD'] === c)!;
    expect(by('T1')).toEqual(jasmine.objectContaining({ 'Loại': 'Thu', 'Số tiền': 50000, 'Lập phiếu theo HĐ': 'Có', 'Số HĐ': '33427',
      'Ký hiệu HĐ': 'C26MSM', 'Ngày HĐ': '04/11/2026', 'Người chuyển / nhận': 'LE VAN A', 'TK đối ứng': '0905', 'Ngày GD': '2026-11-04' }));
    expect(by('T2')['Lý do không lập']).toBe('HĐĐT chưa phát hành (nháp)');
    expect(by('T3')['Lý do không lập']).toBe('GD thừa — không có HĐĐT');
    expect(by('D1')).toEqual(jasmine.objectContaining({ 'Loại': 'Chi', 'Lập phiếu theo HĐ': 'Có', 'Số HĐ': '123, 124',
      'Ngày HĐ': '01/11/2026, 02/11/2026', 'Tổng HĐ': 500000, 'MST đối tác': '0401', 'Tên đối tác': 'CONG TY ABC' }));
    expect(by('D2')['Lập phiếu theo HĐ']).toBe('Không');
  });

  it('chưa chọn XML mua vào: GD tiền ra vẫn có ở Nhap-VietDA, ghi "Chưa đối soát"', () => {
    const rows = vietdaRows({ ...input(), purchaseRows: null, debitTxns: [debit('D9', 20000, '2026-11-04 13:00:00')] });
    expect(rows.find(r => r['Mã GD'] === 'D9')!['Kết quả khớp']).toBe('Chưa đối soát');
  });

  it('file .xlsx: đủ sheet theo thứ tự, ô số là số, tiêu đề đúng VIETDA_HEADER', () => {
    const { bytes } = buildBankReconWorkbook(input());
    const files = unzipSync(bytes);
    const wb = strFromU8(files['xl/workbook.xml']);
    const names = [...wb.matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1]);
    expect(names).toEqual(['Nhap-VietDA', 'Ban-ra_Doi-soat', 'Ban-ra_CK-nhieu-lan', 'Ban-ra_CK-du', 'Mua-vao', 'Thong-tin']);
    const s1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    for (const h of VIETDA_HEADER) expect(s1).toContain(`<t xml:space="preserve">${h}</t>`);
    expect(s1).toMatch(/<c r="E2" s="2"><v>99000<\/v><\/c>/);
    expect(strFromU8(files['xl/worksheets/sheet6.xml'])).toContain(EXPORT_SCHEMA);
  });
});
