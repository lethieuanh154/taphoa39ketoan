import { expandInvoiceItems, reconcileByAmount } from './transfer-reconcile.util';
import { SaleInvoiceSourceService } from '../services/sale-invoice-source.service';
import { LocalXmlInvoice } from './invoice-xml.util';
import { purchaseViewRows, reconViewTable, saleViewRows } from './recon-view.util';

const xml = (shdon: number, total: number, tdlap: string, httt = 'Chuyển khoản'): LocalXmlInvoice => ({
  khmshdon: '1', khhdon: 'C26MSM', shdon, tdlap, nbmst: '0402318272', nbten: 'SONG MINH', nmmst: '', nmten: '',
  tgtcthue: 0, tgtthue: 0, tgtttbso: total, file: `${shdon}.xml`, httt, nmhvten: 'Bán cho người tiêu dùng',
});

describe('recon-view.util + SaleInvoiceSourceService (13/11/2026)', () => {
  it('payment: đọc HTTToan', () => {
    expect(SaleInvoiceSourceService.payment('Chuyển khoản')).toBe('CK');
    expect(SaleInvoiceSourceService.payment('Tiền mặt')).toBe('TM');
    expect(SaleInvoiceSourceService.payment('TM/CK')).toBe('TMCK');
    expect(SaleInvoiceSourceService.payment('Tiền mặt/Chuyển khoản')).toBe('TMCK');
    expect(SaleInvoiceSourceService.payment(undefined)).toBe('');
  });

  it('toRecon: số HĐ / ký hiệu / ngày lập dd/mm/yyyy, mã HĐ dạng "HĐĐT <số>"', () => {
    const r = SaleInvoiceSourceService.toRecon(xml(32432, 111000, '2026-10-30'));
    expect(r).toEqual(jasmine.objectContaining({ code: 'HĐĐT 32432', total: 111000, time: '30/10/2026', einvoiceSerial: 'C26MSM',
      einvoiceNumber: '32432', paymentMethod: 'CK' }));
  });

  it('saleViewRows: màu + ghi chú khác ngày; bảng Excel cùng cột 2 tab', () => {
    const DAY = 1440;
    const invs = [xml(1, 42000, '2026-11-12'), xml(2, 2050000, '2026-11-05'), xml(3, 77000, '2026-11-12')].map(SaleInvoiceSourceService.toRecon);
    const pairs = reconcileByAmount(expandInvoiceItems(invs), [
      { code: 'T1', credit: 42000, date: '12/11/2026 15:40:55', counterparty: 'A', desc: 'A ck' },
      { code: 'T2', credit: 2050000, date: '04/11/2026 16:01:09', counterparty: 'B', desc: 'B ck' },
      { code: 'T9', credit: 5000, date: '12/11/2026 10:00:00', counterparty: 'C', desc: 'C ck' },
    ], { windowBeforeMin: 0, windowAfterMin: DAY - 1, lateWindow: { beforeMin: 3 * DAY, afterMin: 2 * DAY - 1 } });
    const rows = saleViewRows(pairs, () => ({ party: 'Khách lẻ', mst: '', payment: 'Chuyển khoản' }));
    const by = (no: string) => rows.find(r => r.invoices[0]?.no === no)!;
    expect(by('1').tone).toBe('ok');
    // GD 04/11, HĐ lập 05/11 = phát hành trễ → vẫn xanh, chỉ ghi chú
    expect(by('2').tone).toBe('ok');
    expect(by('2').status).toBe('Khớp (phát hành trễ)');
    expect(by('2').tags).toContain('late');
    expect(by('2').days).toBe(-1);
    expect(by('2').hint).toContain('HĐĐT lập sau ngày GD 1 ngày');
    expect(by('3').tone).toBe('bad');
    expect(rows.find(r => r.txns[0]?.code === 'T9')!.status).toBe('GD thừa');

    const p = purchaseViewRows([{ kind: 'matched', invoices: [{ key: 'k', no: '9', symbol: 'C26TAA', date: '2026-11-01', sellerMst: '0401',
      sellerName: 'CONG TY ABC', total: 500000, source: 'xml' }], txns: [], amount: 500000, days: 3, confidence: 'thấp', hint: 'x' }]);
    expect(p[0].tone).toBe('warn');
    expect(p[0].invoices[0].date).toBe('01/11/2026');
    const a = reconViewTable(rows, 'Người mua', 'Người chuyển'), b = reconViewTable(p, 'Nhà cung cấp', 'Người nhận');
    expect(a.header.length).toBe(b.header.length);
    expect(a.tones.length).toBe(rows.length);
  });
});
