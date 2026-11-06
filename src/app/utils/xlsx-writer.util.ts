/**
 * Ghi file .xlsx nhiều sheet ngay trên trình duyệt (06/11/2026 — Đối soát CK xuất 1 file Excel thay nhiều CSV).
 * Không thêm thư viện: .xlsx = ZIP các file XML (OOXML), nén bằng fflate (đã có sẵn cho đọc ZIP / RAR).
 * Ô chữ ghi dạng inlineStr (không cần sharedStrings), ô số ghi số thật (Excel cộng / lọc được). Dòng 1 = tiêu đề in đậm nền xanh
 * đậm chữ trắng, cố định khi cuộn, có nút lọc. Mỗi dòng tô màu theo `tones` (ok = xanh lá, warn = vàng, bad = đỏ); cột trong
 * `emphasisCols` (vd cột Kết quả) chữ đậm cùng màu. Không hỗ trợ công thức / ngày kiểu Date — ngày giờ ghi chữ (dd/mm/yyyy HH:mm:ss).
 */
import { strToU8, zipSync } from 'fflate';

export type XlsxCell = string | number | null | undefined;
export type XlsxTone = 'ok' | 'warn' | 'bad' | '' | undefined;

export interface XlsxSheet {
  name: string;          // ≤ 31 ký tự, không chứa : \ / ? * [ ] (tự thay)
  header: string[];
  rows: XlsxCell[][];
  /** màu từng dòng dữ liệu (cùng chỉ số với rows) */
  tones?: XlsxTone[];
  /** chỉ số cột (0-based) in đậm cùng màu dòng — cột kết quả */
  emphasisCols?: number[];
}

const esc = (s: string) => s
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 0 → A, 25 → Z, 26 → AA */
function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetName(name: string, used: Set<string>): string {
  let base = (name.replace(/[:\\/?*[\]]/g, '-').trim() || 'Sheet').slice(0, 31);
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 31 - String(i).length - 1)}~${i}`;
  used.add(n.toLowerCase());
  return n;
}

// ===== Style (cellXfs): 0 = mặc định, 1 = tiêu đề, 2.. = tone × (chữ | số | chữ đậm màu) =====
const TONES = ['', 'ok', 'warn', 'bad'] as const;
//              chữ màu đậm      nền nhạt (cả dòng)
const TONE_FONT = ['FF000000', 'FF006100', 'FF9C5700', 'FF9C0006'];
const TONE_FILL = ['', 'FFE2F0D9', 'FFFFF2CC', 'FFFDE2E2'];
const STYLE_HEADER = 1;
const KIND_TEXT = 0, KIND_NUM = 1, KIND_EMPH = 2;
const styleOf = (tone: XlsxTone, kind: number) => 2 + Math.max(0, TONES.indexOf(tone || '')) * 3 + kind;

function stylesXml(): string {
  // font: 0 thường · 1 tiêu đề (đậm trắng) · 2+t = đậm màu tone t
  const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    ...TONE_FONT.map(c => `<font><b/><sz val="11"/><color rgb="${c}"/><name val="Calibri"/></font>`)];
  // fill: 0 none · 1 gray125 (bắt buộc) · 2 tiêu đề · 3+t = nền tone t (t ≥ 1)
  const solid = (c: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    solid('FF1F4E79'), ...TONE_FILL.slice(1).map(solid)];
  const side = (s: string) => `<${s} style="thin"><color rgb="FFD0D7DE"/></${s}>`;
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
    `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
      + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'];
  TONES.forEach((_, t) => {
    const fill = t ? 2 + t : 0;
    const base = `fillId="${fill}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"`;
    xfs.push(`<xf numFmtId="0" fontId="0" ${base}><alignment vertical="center"/></xf>`);                       // chữ
    xfs.push(`<xf numFmtId="3" fontId="0" ${base} applyNumberFormat="1"><alignment vertical="center"/></xf>`); // số #,##0
    xfs.push(`<xf numFmtId="0" fontId="${2 + t}" ${base} applyFont="1"><alignment vertical="center"/></xf>`);  // chữ đậm màu
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

function cellXml(ref: string, v: XlsxCell, style: number, numStyle: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`; // ô trống vẫn có viền / nền dòng
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${numStyle}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function sheetXml(sh: XlsxSheet): string {
  const all = [sh.header, ...sh.rows];
  const nCol = Math.max(1, ...all.map(r => r.length));
  const emph = new Set(sh.emphasisCols ?? []);
  // độ rộng cột theo nội dung dài nhất (dòng dữ liệu tối đa 50 ký tự; tiêu đề xuống dòng nên chỉ tính tới 24)
  const widths = Array.from({ length: nCol }, (_, c) => Math.min(50, Math.max(8,
    Math.min(24, String(sh.header[c] ?? '').length) + 3,
    ...sh.rows.slice(0, 2000).map(r => {
      const v = r[c];
      return (typeof v === 'number' ? v.toLocaleString('vi-VN') : String(v ?? '')).length + 2;
    }))));
  const cols = widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('');
  const head = `<row r="1" ht="32" customHeight="1">${Array.from({ length: nCol }, (_, c) =>
    cellXml(`${colName(c)}1`, sh.header[c], STYLE_HEADER, STYLE_HEADER)).join('')}</row>`;
  const rows = sh.rows.map((r, i) => {
    const tone = sh.tones?.[i];
    const cells = Array.from({ length: nCol }, (_, c) => cellXml(`${colName(c)}${i + 2}`, r[c],
      styleOf(tone, emph.has(c) ? KIND_EMPH : KIND_TEXT), styleOf(tone, KIND_NUM))).join('');
    return `<row r="${i + 2}">${cells}</row>`;
  }).join('');
  const last = `${colName(nCol - 1)}${all.length}`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="18" customHeight="1"/>'
    + `<cols>${cols}</cols><sheetData>${head}${rows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}

/** Dựng file .xlsx (bytes) từ các sheet theo thứ tự. */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const used = new Set<string>();
  const names = sheets.map(s => sheetName(s.name, used));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
      + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
      + '</sheets>'
      // autoFilter cần tên ẩn _FilterDatabase để Excel nhận nút lọc ở mọi sheet
      + '<definedNames>' + sheets.map((sh, i) => {
        const nCol = Math.max(1, sh.header.length, ...sh.rows.map(r => r.length));
        return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i])}'!$A$1:$${colName(nCol - 1)}$${sh.rows.length + 1}</definedName>`;
      }).join('') + '</definedNames>'
      + '</workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>'),
    'xl/styles.xml': strToU8(stylesXml()),
  };
  sheets.forEach((sh, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sh)); });
  return zipSync(files, { level: 6 });
}
