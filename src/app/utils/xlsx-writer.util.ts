/**
 * Ghi file .xlsx nhiều sheet ngay trên trình duyệt (06/11/2026 — Đối soát CK xuất 1 file Excel thay nhiều CSV).
 * Không thêm thư viện: .xlsx = ZIP các file XML (OOXML), nén bằng fflate (đã có sẵn cho đọc ZIP / RAR).
 * Ô chữ ghi dạng inlineStr (không cần sharedStrings), ô số ghi số thật (Excel cộng / lọc được). Dòng 1 = tiêu đề in đậm, cố định
 * khi cuộn, có nút lọc. Không hỗ trợ công thức / ngày kiểu Date — ngày giờ ghi chữ đúng định dạng sao kê TPBank (dd/mm/yyyy HH:mm:ss).
 */
import { strToU8, zipSync } from 'fflate';

export type XlsxCell = string | number | null | undefined;

export interface XlsxSheet {
  name: string;          // ≤ 31 ký tự, không chứa : \ / ? * [ ] (tự thay)
  header: string[];
  rows: XlsxCell[][];
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

function cellXml(ref: string, v: XlsxCell, style: number): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style || 2}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function sheetXml(sh: XlsxSheet): string {
  const all = [sh.header, ...sh.rows];
  const nCol = Math.max(1, ...all.map(r => r.length));
  // độ rộng cột theo nội dung dài nhất (tối đa 60 ký tự)
  const widths = Array.from({ length: nCol }, (_, c) =>
    Math.min(60, Math.max(8, ...all.slice(0, 2000).map(r => String(r[c] ?? '').length + 2))));
  const cols = widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = all.map((r, i) => {
    const cells = r.map((v, c) => cellXml(`${colName(c)}${i + 1}`, v, i === 0 ? 1 : 0)).join('');
    return `<row r="${i + 1}">${cells}</row>`;
  }).join('');
  const last = `${colName(nCol - 1)}${all.length}`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${cols}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
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
      + '</sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>'),
    // style 0 = thường, 1 = tiêu đề đậm nền xám, 2 = số #,##0
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      + '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>'),
  };
  sheets.forEach((sh, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sh)); });
  return zipSync(files, { level: 6 });
}
