import { zipSync, strToU8 } from 'fflate';
import { expandArchives, fileAt } from './archive.util';
import { readInvoiceFiles } from './invoice-xml.util';

/** T10.rar (WinRAR, XML giả lập): T10/1.xml, T10/luong.xlsx, T10/sub/2.xml, T10/sub/in.zip (3.xml + note.txt) */
const RAR_T10 = 'UmFyIRoHAQDz4YLrCwEFBwAGAQGAgIAA5LTy4CUCAwvtAQSMAyCTZPm9gAMACVQxMC8xLnhtbAoDAtFGPmoxaN0BxnbqIFQ0MvZQVflUvvW7uvTfCtRdoqCtEHXwfSi0WgtqKVH/5a5uzba/MXwuzeTJkw36SdBkhkyEmBnA4HPloMnvt1uepfHmaifG4e6Zy5LPxo5TT88bm9Wd19zJDBpiF0f4tbeVKT0pF8UatOzcQjwPW1rKXKUYVZcrLDTWo1qo9cneFBgg6czqMQOQIAwW/aNsJgU6L94+Aws2DFNu8jirYZpGRcTmGNKV310MaBnXzN+P968xqMeymRq9KuHyIGtfELRU/hVBabmqrDZlE/DuvBZ1YcqHyJ/DVm3ULSrMXVk9Jk9ZNPV+rPFw/mPJfSoCAwuHAASHACARzW72gAAADlQxMC9sdW9uZy54bHN4CgMC0UY+ajFo3QFQSyBmYWtl8x0sVikCAwvvAQSMAyB830/HgAMADVQxMC9zdWIvMi54bWwKAwLRRj5qMWjdAcB27CBUNDL2UFX5VL71u7r03wrUXaKgrRB18H0otFoLailR/+Wubs22vzF8LJOZJklv0k6DJDJkJMDOBwOfLQZPfbrc9S+PM1E+Nw90zlyWfjRymn543N6s7r7mSGDTEFR7i1tipSelIXEmrTs3EI8D1s6ylFKMKsuViDTNVQAV3UeuTuKjCw6czqMQOQIAwW/aNsJgU6L94+AwRsGJbd5HFWwzSM5cdzDGlK11yMaBnXzN8P968xtmPZTI2/Srh8iBrXxxaKn8KoLTc1VYbMo+iHdeCylhykfIn8NWbdQu1WYqWd6TJ6ztPV/1nigAdcAwmioCAwuEAwSpAyD1TTLjgAMADlQxMC9zdWIvaW4uemlwCgMC0UY+ajFo3QHKEYABKHRQQi9YBG1l1KGnkiFcKFB43BkG2IRiIJYJoKGSUVo0p4IywUtJBJEo3+FNKGCIZ43KGCEkIrgkVpaTERESJItEFTFBRC0lBKUluyUUJfE/ePHvew9meDPkmGBgZh+MD+/c/3xi2SEyhgAAChARrLpX1pKRPzEauSQ9AkXPnWa++TZlquFPUbeZZwa510sV5d6k7nwMRtYcgogZZaHgjIxmkt9o3vBn3OJJ7SciXH9l/lGxWkYrtJOwu6TR7tvDd+GHBRU/Gh5VJ1xtzXDboorKTA6kqgLLyQ8r0uHqB/mimjBsSE5D1oUfzFpqt3nHglJUFUEb7/GCbNaDJHK3jx9usZK7RKIv2NORr4QhooG23QhrKIwpdJ/qjVnq8QzJTtzgPwnFegWcQMCt2RHhyxbnCypqq6Kh1eH0+5RLjIkNQe5y8jIx9+q/rCamYrkn8RKcDNML9isOsWbHUHyH6kqD3/9o/IxiQH23p4ueXzd8v14HMBK/QtARK0i9TOVAcXC1EiECAwsABQAQAAAAAIAAAAdUMTAvc3ViCgMC0UY+ajFo3QG40btKHQIDCwAFABAAAAAAgAAAA1QxMAoDAtFGPmoxaN0BHXdWUQMFBAA=';
/** locked.rar: 1.xml, mã hóa cả tên file (mật khẩu) */
const RAR_LOCKED = 'UmFyIRoHAQDOtMaJIQQAAAEPZ8N3cd7tq52dlUkd0TSCTDaN9WqWIxKqqlmSA+vcuHf4yruhoe+ggNzzQiQh1fP6XmlKa8Fa7XPVpBmW/DMXwL5SO/mO2mhHR0A+eLWt2c9r0mjEyk3rgbf0uEP9Txl4vhzRUoFAJELFwK0LSF6XTc0fwWkuVlRphYTQ6CqPAZktL6fP0uf2ItxmnfLPyCNATd7PrVAEwe0+UFRZkijaSmtnnhTG4Lh1Tb/ghb5GdcEHHqZLM7EB7XZNj3oUieLyHA8sCYb7Ky42rl34XdP3c+BrO4/uFM8P20QjcymwarGkitsJ3hK8Ld1FkN338hsb3/YXFWScUk6yEiwZfZ0DpUXqpCcrryVkV/FAEfV2IiIQ4I6jERL48hD/uJrqXf70BdaUB1sraW8yvSWwyIhn20mtfX0y0YsMg//eH8T/lcuGJH6vJDn2xi2CwhFqn6qmd2TccapZ0UU0ikfPPrakE0kpLvjJU92akz6pKTMfQFiKtjUMeye1eg0DFMT68FLL5c/ikwrqd+tQqta/5Fhts0NvYCMPhRiuSSR13jGIfdP4CGCNc+Gnfhi4eWKhWCfxsmB0sZbnQgw9xfnS';

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const file = (name: string, data: Uint8Array) => new File([data as BlobPart], name);
const rel = (f: File) => (f as any).webkitRelativePath as string;
const xml = (no: number) => `<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TAA</KHHDon>`
  + `<SHDon>${no}</SHDon><NLap>2026-10-27</NLap></TTChung><NDHDon><NBan><Ten>NCC</Ten><MST>0400000001</MST></NBan><NMua><Ten>CTY</Ten>`
  + `<MST>0402318272</MST></NMua><TToan><TgTTTBSo>108</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;

describe('archive.util', () => {
  it('ZIP lồng ZIP → file bên trong, bỏ 1 cấp thư mục chung, file thường giữ nguyên', async () => {
    const inner = zipSync({ '3.xml': strToU8(xml(3)) });
    const outer = zipSync({ 'T10/1.xml': strToU8(xml(1)), 'T10/sub/in.zip': inner, 'T10/a.txt': strToU8('x') });
    const plain = file('4.xml', strToU8(xml(4)));
    const r = await expandArchives([file('T10.zip', outer), plain], n => /\.xml$/i.test(n));
    expect(r.errors).toEqual([]);
    expect(r.nArchives).toBe(2);
    expect(r.files.map(f => rel(f) || f.name).sort()).toEqual(['4.xml', 'T10/1.xml', 'T10/sub/in.zip/3.xml']);
  });

  it('RAR (WASM) → mọi file, kể cả ZIP lồng trong RAR', async () => {
    const r = await expandArchives([file('T10.rar', bytes(RAR_T10))], () => true);
    expect(r.errors).toEqual([]);
    expect(r.files.map(rel).sort()).toEqual(['T10/1.xml', 'T10/luong.xlsx', 'T10/sub/2.xml', 'T10/sub/in.zip/3.xml', 'T10/sub/in.zip/note.txt']);
    expect(await r.files.find(f => rel(f) === 'T10/sub/2.xml')!.text()).toContain('<SHDon>2</SHDon>');
  });

  it('RAR có mật khẩu / file hỏng → báo lỗi file đó, các file khác vẫn đọc', async () => {
    const r = await expandArchives([file('locked.rar', bytes(RAR_LOCKED)), file('hong.zip', strToU8('not zip')),
      fileAt('X/5.xml', strToU8(xml(5)))], () => true);
    expect(r.errors.length).toBe(2);
    expect(r.errors[0]).toContain('locked.rar');
    expect(r.files.map(rel)).toEqual(['X/5.xml']);
  });

  it('readInvoiceFiles đọc thẳng file RAR', async () => {
    const r = await readInvoiceFiles([file('T10.rar', bytes(RAR_T10))]);
    expect(r.invoices.map(i => i.shdon).sort()).toEqual([1, 2, 3]);
    expect(r.errors).toEqual([]);
  });
});
