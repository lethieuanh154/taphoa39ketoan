import {
  parseMultiTransferNote, parseExcessTransferNote, expandInvoiceItems, reconcileByAmount, buildReconCsv,
  buildMultiTransferCsv, buildExcessTransferCsv, viStampToMinutes, readKvEInvoice, payerKey, ReconInvoice, ReconBankTxn,
  readEInvoiceBills, reconcileWithFallback, reconPairHint, EInvoiceBill, EINVOICE_AMOUNT_TOLERANCE
} from './transfer-reconcile.util';

const inv = (code: string, total: number, time: string, note = 'chuyển khoản'): ReconInvoice =>
  ({ id: 0, code, total, time, note });
const txn = (code: string, credit: number, date: string, counterparty = 'KHACH'): ReconBankTxn =>
  ({ code, credit, date, counterparty, desc: `${counterparty} chuyen tien` });

describe('transfer-reconcile.util', () => {
  describe('parseMultiTransferNote', () => {
    it('mẫu thật KiotViet (đơn vị nghìn)', () => {
      expect(parseMultiTransferNote('chuyển khoản 2 lần 45 + 12', 57000))
        .toEqual({ times: 2, parts: [45000, 12000], status: 'ok' });
      expect(parseMultiTransferNote('chuyển khoản 2 lần 241 + 50', 291000))
        .toEqual({ times: 2, parts: [241000, 50000], status: 'ok' });
      expect(parseMultiTransferNote('chuyển khoản 2 lần 536 + 734', 1270000))
        .toEqual({ times: 2, parts: [536000, 734000], status: 'ok' });
    });

    it('chấp nhận k / dấu chấm / viết tắt ck / không dấu', () => {
      expect(parseMultiTransferNote('ck 2 lan 45k+12k', 57000)?.parts).toEqual([45000, 12000]);
      expect(parseMultiTransferNote('Chuyen khoan 3 lan 10.000 + 20.000 + 5', 35000))
        .toEqual({ times: 3, parts: [10000, 20000, 5000], status: 'ok' });
      expect(parseMultiTransferNote('chuyển khoản 2 lần 1.270 + 30', 1300000)?.parts).toEqual([1270000, 30000]);
    });

    it('số lẻ nghìn "16.2" / "16,2" (mẫu thật HD445766 03/11)', () => {
      expect(parseMultiTransferNote('chuyển khoản 2 lần 16.2 + 146.8', 163000))
        .toEqual({ times: 2, parts: [16200, 146800], status: 'ok' });
      expect(parseMultiTransferNote('chuyển khoản 2 lần 16,2 + 146,8', 163000)?.parts).toEqual([16200, 146800]);
      expect(parseMultiTransferNote('ck 2 lan 16.25k + 3.', 19250)?.parts).toEqual([16250, 3000]);
    });

    it('báo lệch / không tách được', () => {
      expect(parseMultiTransferNote('chuyển khoản 3 lần 45 + 12', 57000)?.status).toBe('count_mismatch');
      expect(parseMultiTransferNote('chuyển khoản 2 lần 45 + 10', 57000)?.status).toBe('sum_mismatch');
      expect(parseMultiTransferNote('chuyển khoản 2 lần', 57000)?.status).toBe('unparsed');
    });

    it('ghi chú thường → null', () => {
      expect(parseMultiTransferNote('chuyển khoản', 57000)).toBeNull();
      expect(parseMultiTransferNote('', 57000)).toBeNull();
    });
  });

  describe('parseExcessTransferNote', () => {
    it('mẫu thật: chuyển khoản dư 990, trả lại khách 891 (HĐ 99.000)', () => {
      expect(parseExcessTransferNote('chuyển khoản dư 990, trả lại khách 891', 99000))
        .toEqual({ transferred: 990000, refund: 891000, status: 'ok' });
    });

    it('chấp nhận k / ck / thừa / không dấu / số lớn', () => {
      expect(parseExcessTransferNote('ck dư 500k trả khách 380k', 120000)?.status).toBe('ok');
      expect(parseExcessTransferNote('Chuyen khoan thua 1.000 tra lai khach 850', 150000))
        .toEqual({ transferred: 1000000, refund: 850000, status: 'ok' });
      expect(parseExcessTransferNote('chuyển khoản dư 200.000, trả lại khách 50.000', 150000)?.status).toBe('ok');
    });

    it('báo lệch / không tách được', () => {
      expect(parseExcessTransferNote('chuyển khoản dư 990, trả lại khách 800', 99000)?.status).toBe('sum_mismatch');
      expect(parseExcessTransferNote('chuyển khoản dư 990', 99000))
        .toEqual({ transferred: 990000, refund: null, status: 'unparsed' });
      expect(parseExcessTransferNote('chuyển khoản dư', 99000)?.status).toBe('unparsed');
    });

    it('không có chữ "dư" nhưng đúng cấu trúc "chuyển khoản X, trả lại khách Y"', () => {
      expect(parseExcessTransferNote('chuyển khoản 990, trả lại khách 891', 99000))
        .toEqual({ transferred: 990000, refund: 891000, status: 'ok' });
      // KiotViet tự thêm "chuyển khoản" phía trước ghi chú user gõ "ck 990 trả lại 891"
      expect(parseExcessTransferNote('chuyển khoản ck 990 trả lại 891', 99000)?.status).toBe('ok');
      expect(parseExcessTransferNote('chuyển khoản 990, trả lại khách 800', 99000)?.status).toBe('sum_mismatch');
    });

    it('ghi chú khác → null', () => {
      expect(parseExcessTransferNote('chuyển khoản', 99000)).toBeNull();
      expect(parseExcessTransferNote('chuyển khoản 2 lần 45 + 12', 57000)).toBeNull();
      expect(parseExcessTransferNote('chuyển khoản 99', 99000)).toBeNull();
      expect(parseExcessTransferNote('chuyển khoản 990, trả lại khách', 99000)).toBeNull();
    });
  });

  it('HĐ chuyển dư: khoản cần khớp = số khách chuyển, khớp được GD 990.000', () => {
    const items = expandInvoiceItems([inv('HD1', 99000, '17/10/2026 13:25:00', 'chuyển khoản dư 990, trả lại khách 891')]);
    expect(items.map(i => [i.amount, i.excess?.refund])).toEqual([[990000, 891000]]);
    const pairs = reconcileByAmount(items, [txn('T1', 990000, '17/10/2026 13:20:00')]);
    expect(pairs.map(p => p.kind)).toEqual(['matched']);

    const csv = buildExcessTransferCsv(pairs).split('\r\n');
    expect(csv.length).toBe(2);
    expect(csv[0]).toContain('Tổng thanh toán;Ghi chú;Khách chuyển;Trả lại khách;Chênh lệch;Tình trạng ghi chú;Trạng thái khớp');
    expect(csv[1]).toContain('99000;chuyển khoản dư 990, trả lại khách 891;990000;891000;0;Đủ;Khớp');
    expect(buildExcessTransferCsv(pairs, { withBank: false }).split('\r\n')[0]).not.toContain('Trạng thái khớp');
  });

  it('expandInvoiceItems: HĐ nhiều lần tách thành N khoản; không tách được → 1 khoản = tổng', () => {
    const items = expandInvoiceItems([
      inv('HD1', 57000, '17/10/2026 13:25:00', 'chuyển khoản 2 lần 45 + 12'),
      inv('HD2', 30000, '17/10/2026 13:30:00', 'chuyển khoản 2 lần'),
      inv('HD3', 20000, '17/10/2026 13:40:00'),
    ]);
    expect(items.map(i => [i.invoice.code, i.amount, i.partIndex, i.partCount])).toEqual([
      ['HD1', 45000, 1, 2], ['HD1', 12000, 2, 2], ['HD2', 30000, 1, 1], ['HD3', 20000, 1, 1],
    ]);
  });

  describe('reconcileByAmount', () => {
    it('khách chuyển trước, HĐ xuất cuối ngày (trong 24h) vẫn khớp trong khung', () => {
      const items = expandInvoiceItems([inv('HD1', 57000, '17/10/2026 22:35:00', 'chuyển khoản 2 lần 45 + 12')]);
      const pairs = reconcileByAmount(items, [
        txn('T1', 45000, '17/10/2026 09:10:00'), txn('T2', 12000, '17/10/2026 09:12:00'),
      ]);
      expect(pairs.every(p => p.kind === 'matched')).toBeTrue();
      expect(pairs.find(p => p.amount === 45000)!.deltaMinutes).toBe(-(13 * 60 + 25));
    });

    it('cùng số tiền: ưu tiên GD trong khung, phần còn lại vẫn khớp (lệch giờ)', () => {
      const items = expandInvoiceItems([
        inv('HD1', 100000, '10/10/2026 10:00:00'),
        inv('HD2', 100000, '12/10/2026 10:00:00'),
      ]);
      const pairs = reconcileByAmount(items, [
        txn('T_OLD', 100000, '01/10/2026 08:00:00'),  // quá 24h trước HD1
        txn('T_NEW', 100000, '12/10/2026 09:50:00'),  // trong khung của HD2
      ]);
      const hd2 = pairs.find(p => p.item?.invoice.code === 'HD2')!;
      expect(hd2.kind).toBe('matched');
      expect(hd2.txn!.code).toBe('T_NEW');
      expect(pairs.find(p => p.item?.invoice.code === 'HD1')!.kind).toBe('matched_late');
    });

    it('lấy GD sớm nhất trong khung để không cướp GD của HĐ sau', () => {
      const items = expandInvoiceItems([
        inv('HD1', 50000, '10/10/2026 10:00:00'),
        inv('HD2', 50000, '10/10/2026 20:00:00'),
      ]);
      const pairs = reconcileByAmount(items, [
        txn('T1', 50000, '10/10/2026 09:00:00'),
        txn('T2', 50000, '10/10/2026 19:55:00'),
      ]);
      expect(pairs.every(p => p.kind === 'matched')).toBeTrue();
      expect(pairs.find(p => p.item?.invoice.code === 'HD1')!.txn!.code).toBe('T1');
    });

    it('CK nhiều lần: khớp theo cùng người chuyển, không lấy GD cùng số tiền của khách khác (mẫu thật 30/10)', () => {
      const items = expandInvoiceItems([
        inv('HD445222', 98000, '30/10/2026 21:09:48', 'chuyển khoản 2 lần 68 + 30'),
        inv('HD_KHAC', 30000, '30/10/2026 17:35:00'),
      ]);
      const pairs = reconcileByAmount(items, [
        txn('T_THINH', 30000, '30/10/2026 17:34:08', 'HO PHUOC THINH '),
        txn('T_68', 68000, '30/10/2026 17:39:37', 'NGUYEN THI LE THANH'),
        txn('T_30', 30000, '30/10/2026 17:43:51', 'NGUYEN THI LE THANH'),
      ]);
      const code = (c: string, part = 1) =>
        pairs.find(p => p.item?.invoice.code === c && p.item.partIndex === part)!.txn!.code;
      expect(code('HD445222', 1)).toBe('T_68');
      expect(code('HD445222', 2)).toBe('T_30');
      expect(code('HD_KHAC')).toBe('T_THINH');
      expect(pairs.every(p => p.kind === 'matched')).toBeTrue();
    });

    it('payerKey: cột Chủ TK đối ứng, thiếu thì đọc từ diễn giải', () => {
      expect(payerKey({ counterparty: 'HO PHUOC THINH ', desc: '' })).toBe('ho phuoc thinh');
      expect(payerKey({ counterparty: '', desc: 'TPB;69586928888;NGUYEN THI LE THANH chuyen tien' })).toBe('nguyen thi le thanh');
      expect(payerKey({ counterparty: '', desc: 'IBFT NGUYEN THI LE THANH chuyen tien' })).toBe('nguyen thi le thanh');
      expect(payerKey({ counterparty: '', desc: 'Thanh toan QR' })).toBe('');
    });

    it('phần dư + gợi ý biên kỳ', () => {
      const items = expandInvoiceItems([
        inv('HD_START', 70000, '01/09/2026 07:30:00'),
        inv('HD_MID', 80000, '15/09/2026 12:00:00'),
      ]);
      const pairs = reconcileByAmount(items, [
        txn('T_END', 90000, '30/09/2026 21:00:00'),
      ], { periodFrom: '2026-09-01', periodTo: '2026-09-30' });
      const by = (code: string) => pairs.find(p => p.item?.invoice.code === code || p.txn?.code === code)!;
      expect(by('HD_START').kind).toBe('invoice_only');
      expect(by('HD_START').edgeHint).toBe('prev');
      expect(by('HD_MID').edgeHint).toBeNull();
      expect(by('T_END').kind).toBe('bank_only');
      expect(by('T_END').edgeHint).toBe('next');
    });
  });

  it('viStampToMinutes: so sánh được giữa giờ KiotViet và giờ ngân hàng', () => {
    expect(viStampToMinutes('17/10/2026 10:00:00') - viStampToMinutes('16/10/2026 10:00:00')).toBe(1440);
    expect(viStampToMinutes('sai')).toBeNaN();
  });

  describe('HĐĐT einvoice (03/11/2026)', () => {
    const bill = (o: Partial<EInvoiceBill>): EInvoiceBill => ({
      id: 'B1', invoice_code: 'HD1', bill_series: 'C26MSM', bill_number: 27852, bill_date: '2026-09-30 23:59:58.623',
      total_payment: 44000, payment_method_code: 'CK', status: 'DA_TIEP_NHAN', adjustment_type: 1, origin_id: null,
      note: 'chuyển khoản', ...o
    });

    it('readEInvoiceBills: tách CK / TM, TM ghi chú "chuyển khoản" vẫn là CK, bỏ HĐ bị thay thế', () => {
      const { primary, fallback } = readEInvoiceBills([
        bill({}),
        bill({ id: 'B2', invoice_code: null, bill_number: 1400, payment_method_code: 'TM', note: '' }),
        bill({ id: 'B3', payment_method_code: 'TM', note: 'chuyển khoản 2 lần 30 + 14' }),
        bill({ id: 'OLD', adjustment_type: 2 }),
        bill({ id: 'NEW', invoice_code: null, adjustment_type: 3, origin_id: 'OLD' }),
        bill({ id: 'B4', status: 'GHI_TAM', total_payment: 0 }),
      ]);
      expect(primary.map(i => i.id)).toEqual(['B1', 'B3', 'NEW']);
      expect(fallback.map(i => i.code)).toEqual(['HĐĐT 1400']);
      expect(primary[0]).toEqual({ id: 'B1', code: 'HD1', total: 44000, time: '30/09/2026 23:59:58', note: 'chuyển khoản',
        einvoiceSerial: 'C26MSM', einvoiceNumber: '27852', einvoiceStatus: 'CQT chấp nhận', paymentMethod: 'CK' });
    });

    it('readEInvoiceBills: nháp → không điền số HĐĐT', () => {
      const [r] = readEInvoiceBills([bill({ status: 'GHI_TAM' })]).primary;
      expect(r.einvoiceNumber).toBe('');
      expect(r.einvoiceStatus).toBe('Nháp (chưa phát hành)');
    });

    it('amountTolerance: HĐ lập tay lệch 1 ₫ vẫn khớp trong khung giờ (mẫu thật 31/03/2026)', () => {
      const items = expandInvoiceItems([inv('HĐĐT 1400', 450999, '31/03/2026 21:36:09', '')]);
      const t = [txn('T1', 451000, '31/03/2026 20:32:08')];
      expect(reconcileByAmount(items, t).map(p => p.kind).sort()).toEqual(['bank_only', 'invoice_only']);
      const pairs = reconcileByAmount(items, t, { amountTolerance: EINVOICE_AMOUNT_TOLERANCE });
      expect(pairs.length).toBe(1);
      expect(pairs[0]).toEqual(jasmine.objectContaining({ kind: 'matched', amountDiff: -1, deltaMinutes: -64 }));
      expect(reconPairHint(pairs[0])).toBe('lệch tiền lẻ −1 ₫');
      // ngoài khung giờ → không ghép
      const far = reconcileByAmount(items, [txn('T2', 451000, '29/03/2026 20:00:00')], { amountTolerance: 10 });
      expect(far.some(p => p.kind === 'matched')).toBeFalse();
    });

    it('reconcileWithFallback: GD dư khớp HĐĐT ghi TM trong khung giờ; HĐ TM không khớp thì bỏ', () => {
      const ck = expandInvoiceItems([inv('HD1', 44000, '17/10/2026 10:00:00')]);
      const tm = expandInvoiceItems([
        { ...inv('HD2', 62000, '17/10/2026 11:00:00', ''), paymentMethod: 'TM' },
        { ...inv('HD3', 99000, '17/10/2026 12:00:00', ''), paymentMethod: 'TM' },
        { ...inv('HD4', 15000, '20/10/2026 12:00:00', ''), paymentMethod: 'TM' },
      ]);
      const pairs = reconcileWithFallback(ck, tm, [
        txn('T1', 44000, '17/10/2026 09:55:00'), txn('T2', 62000, '17/10/2026 10:50:00'), txn('T3', 15000, '17/10/2026 09:00:00'),
      ]);
      const by = (code: string) => pairs.find(p => p.txn?.code === code)!;
      expect(by('T1').item?.invoice.code).toBe('HD1');
      expect(by('T2').item?.invoice.code).toBe('HD2');
      expect(reconPairHint(by('T2'))).toBe('HĐĐT ghi Tiền mặt');
      expect(by('T3').kind).toBe('bank_only');   // HD4 cùng tiền nhưng ngoài khung giờ → không nhận
      expect(pairs.some(p => p.item?.invoice.code === 'HD3')).toBeFalse();
      expect(pairs.length).toBe(3);
    });
  });

  describe('readKvEInvoice', () => {
    // Mẫu thật HD443273: einvoiceapp "CQT chấp nhận" (DA_TIEP_NHAN) số 30625
    const ACCEPTED = { PartnerType: 4, Status: 2, TaxStatus: 2, ErrorCode: 0, EInvoiceNumber: '30625',
      Serial: 'C26MSM', TaxErrors: '', PublishedDate: '2026-10-17T22:44:34.2930000+07:00' };

    it('CQT chấp nhận → có ký hiệu + số HĐĐT', () => {
      expect(readKvEInvoice({ InvoiceExtraData: { EInvoiceRegistedDatePartner4: 'x' }, EInvoices: [ACCEPTED] }))
        .toEqual({ einvoiceSerial: 'C26MSM', einvoiceNumber: '30625', einvoiceStatus: 'CQT chấp nhận' });
    });

    it('đã phát hành nhưng CQT chưa chấp nhận → KHÔNG điền số, kèm lỗi thuế', () => {
      const r = readKvEInvoice({ EInvoices: [{ ...ACCEPTED, TaxStatus: 1, TaxErrors: 'MST sai' }] });
      expect(r.einvoiceNumber).toBe('');
      expect(r.einvoiceStatus).toBe('Đã phát hành, CQT chưa chấp nhận: MST sai');
    });

    it('nháp / chưa chuyển', () => {
      expect(readKvEInvoice({ InvoiceExtraData: { EInvoiceRegistedDatePartner4: 'x' } }).einvoiceStatus).toBe('Nháp (chưa phát hành)');
      expect(readKvEInvoice({ InvoiceExtraData: null, EInvoices: undefined }).einvoiceStatus).toBe('Chưa chuyển HĐĐT');
      expect(readKvEInvoice(null).einvoiceNumber).toBe('');
    });

    it('nhiều bản HĐĐT (HĐ thay thế) → lấy bản CQT chấp nhận mới nhất', () => {
      const r = readKvEInvoice({ EInvoices: [ACCEPTED, { ...ACCEPTED, EInvoiceNumber: '30900', PublishedDate: '2026-10-20T08:00:00+07:00' }] });
      expect(r.einvoiceNumber).toBe('30900');
    });
  });

  it('CSV: BOM, dấu ;, bọc ô có ; và chặn công thức', () => {
    const items = expandInvoiceItems([{
      ...inv('HD1', 57000, '17/10/2026 13:25:00', 'chuyển khoản 2 lần 45 + 12'),
      einvoiceSerial: 'C26MSM', einvoiceNumber: '30519', einvoiceStatus: 'CQT chấp nhận'
    }]);
    const pairs = reconcileByAmount(items, [txn('T1', 45000, '17/10/2026 13:00:00', '=HACK;X')]);
    const csv = buildReconCsv(pairs).split('\r\n');
    expect(csv[0].charCodeAt(0)).toBe(0xFEFF);
    expect(csv[0]).toContain('Mã HĐ;Giờ HĐ;Ký hiệu HĐĐT;Số HĐĐT;Trạng thái HĐĐT;Khoản');
    expect(csv.join('\n')).toContain(`"'=HACK;X"`);
    const matched = csv.find(l => l.startsWith('Khớp;45000'))!;
    expect(matched).toContain('HD1;17/10/2026 13:25:00;C26MSM;30519;CQT chấp nhận;1/2');
    const multi = buildMultiTransferCsv(pairs).split('\r\n');
    expect(multi.length).toBe(3); // header + 2 khoản
    expect(multi[1]).toContain('HD1;17/10/2026 13:25:00;C26MSM;30519;CQT chấp nhận;57000;chuyển khoản 2 lần 45 + 12;2;1;45000;57000;0;Đủ;Khớp');
  });

  it('CSV CK nhiều lần khi CHƯA có sao kê: bỏ cột khớp GD, vẫn đủ danh sách HĐ', () => {
    const items = expandInvoiceItems([
      inv('HD1', 57000, '17/10/2026 13:25:00', 'chuyển khoản 2 lần 45 + 12'),
      inv('HD2', 20000, '17/10/2026 14:00:00'),
    ]);
    const lines = buildMultiTransferCsv(reconcileByAmount(items, []), { withBank: false }).split('\r\n');
    expect(lines[0]).not.toContain('Trạng thái khớp');
    expect(lines[0]).not.toContain('Mã GD');
    expect(lines[0].endsWith('Tình trạng ghi chú')).toBeTrue();
    expect(lines.length).toBe(3); // header + 2 khoản của HD1 (HD2 không phải HĐ nhiều lần)
    expect(lines[1]).not.toContain('HĐ thiếu GD');
  });
});
