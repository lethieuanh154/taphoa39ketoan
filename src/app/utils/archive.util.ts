import { unzipSync } from 'fflate';

/**
 * GIẢI NÉN ZIP / RAR TRÊN TRÌNH DUYỆT (30/10/2026) — các trang chọn thư mục XML nay chọn được cả file .zip / .rar. Không tải file lên máy
 * chủ để giải nén. ZIP: fflate. RAR: node-unrar-js (WASM `unrar/unrar.wasm` copy từ node_modules lúc build — angular.json `assets`),
 * chỉ tải thư viện + WASM khi gặp file .rar đầu tiên. File nén lồng nhau giải tiếp tối đa MAX_DEPTH cấp. RAR có mật khẩu / chia nhiều
 * phần (.part1.rar) → báo lỗi file đó, không dừng cả lượt.
 */
const LOG = '[Archive]';
const MAX_DEPTH = 3;
export const ARCHIVE_RE = /\.(zip|rar)$/i;

export interface ExpandResult {
  files: File[];        // file thường giữ nguyên + file lấy ra từ file nén
  nArchives: number;    // số file nén đã giải (kể cả lồng nhau)
  errors: string[];     // file nén lỗi (tối đa 50)
}

type Entry = [path: string, data: Uint8Array];

let wasm: Promise<ArrayBuffer> | null = null;

function unrarWasm(): Promise<ArrayBuffer> {
  if (!wasm) {
    const url = new URL('unrar/unrar.wasm', document.baseURI).href;
    wasm = fetch(url).then(r => {
      if (!r.ok) throw new Error(`tải bộ giải nén RAR lỗi (HTTP ${r.status})`);
      return r.arrayBuffer();
    });
    wasm.catch(() => wasm = null);   // lỗi mạng → lần sau tải lại
  }
  return wasm;
}

const RAR_REASON: Record<string, string> = {
  ERAR_MISSING_PASSWORD: 'RAR có mật khẩu', ERAR_BAD_PASSWORD: 'RAR có mật khẩu', ERAR_BAD_DATA: 'RAR hỏng',
  ERAR_BAD_ARCHIVE: 'không phải file RAR / RAR hỏng', ERAR_UNKNOWN_FORMAT: 'không phải file RAR', ERAR_EOPEN: 'RAR chia nhiều phần — nén lại thành 1 file',
};

async function unrarEntries(data: Uint8Array, wanted: (name: string) => boolean): Promise<Entry[]> {
  const { createExtractorFromData } = await import('node-unrar-js');
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  try {
    const extractor = await createExtractorFromData({ wasmBinary: await unrarWasm(), data: buf });
    const { files } = extractor.extract({ files: h => !h.flags.directory && wanted(h.name.replace(/\\/g, '/')) });
    const out: Entry[] = [];
    for (const f of files) {   // generator — phải duyệt hết thì mới giải nén
      if (f.extraction) out.push([f.fileHeader.name.replace(/\\/g, '/'), f.extraction]);
    }
    return out;
  } catch (e: any) {
    throw new Error(RAR_REASON[e?.reason] || e?.message || String(e));
  }
}

function unzipEntries(data: Uint8Array, wanted: (name: string) => boolean): Entry[] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, { filter: f => !f.name.endsWith('/') && wanted(f.name) });
  } catch (e: any) {
    throw new Error(`ZIP lỗi (${e?.message || e})`);
  }
  return Object.entries(entries);
}

/** File có đường dẫn tương đối (như chọn thư mục) — code đọc file dùng `webkitRelativePath || name` */
export function fileAt(path: string, data: Uint8Array, lastModified?: number): File {
  const f = new File([data as BlobPart], path.split('/').pop() || path, { lastModified: lastModified ?? Date.now() });
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
}

/** Bỏ 1 cấp thư mục chung (nén cả thư mục "T10/..." → các file nằm thẳng dưới tên file nén, như chọn thư mục T10) */
function stripCommonDir(entries: Entry[]): Entry[] {
  const first = entries[0]?.[0].split('/')[0];
  if (!first || !entries.every(([p]) => p.includes('/') && p.split('/')[0] === first)) return entries;
  return entries.map(([p, d]) => [p.slice(first.length + 1), d]);
}

/**
 * File .zip / .rar → các file bên trong, `webkitRelativePath` = `<tên file nén bỏ đuôi>/<đường dẫn trong file nén>`; file khác giữ nguyên.
 * `keep(tên)` = giữ file nào (file nén lồng nhau luôn được giải tiếp). `onProgress(đã xử lý, tổng)` theo file đầu vào.
 */
export async function expandArchives(input: File[], keep: (name: string) => boolean,
                                     onProgress?: (done: number, total: number) => void): Promise<ExpandResult> {
  const res: ExpandResult = { files: [], nArchives: 0, errors: [] };
  const err = (m: string) => { if (res.errors.length < 50) res.errors.push(m); };
  const wanted = (n: string) => ARCHIVE_RE.test(n) || keep(n);
  const walk = async (name: string, data: Uint8Array, depth: number): Promise<Entry[]> => {
    res.nArchives++;
    const entries = /\.rar$/i.test(name) ? await unrarEntries(data, wanted) : unzipEntries(data, wanted);
    const out: Entry[] = [];
    for (const [p, bytes] of entries) {
      if (!ARCHIVE_RE.test(p)) {
        if (keep(p)) out.push([p, bytes]);
      } else if (depth >= MAX_DEPTH) {
        err(`${name}/${p}: file nén lồng quá ${MAX_DEPTH} cấp — bỏ qua`);
      } else {
        try {
          for (const [q, b] of await walk(p, bytes, depth + 1)) out.push([`${p}/${q}`, b]);
        } catch (e: any) {
          err(`${name}/${p}: ${e?.message || e}`);
        }
      }
    }
    return out;
  };
  for (let i = 0; i < input.length; i++) {
    const f = input[i];
    if (!ARCHIVE_RE.test(f.name)) {
      res.files.push(f);
      continue;
    }
    const rel: string = (f as any).webkitRelativePath || f.name;
    const t0 = performance.now();
    try {
      const entries = stripCommonDir(await walk(f.name, new Uint8Array(await f.arrayBuffer()), 1));
      const base = rel.replace(ARCHIVE_RE, '');
      for (const [p, d] of entries) res.files.push(fileAt(`${base}/${p}`, d, f.lastModified));
      console.info(`${LOG} Giải nén "${rel}" (${(f.size / 1048576).toFixed(1)} MB): ${entries.length} file (${Math.round(performance.now() - t0)} ms)`);
    } catch (e: any) {
      console.warn(`${LOG} Giải nén "${rel}" lỗi: ${e?.message || e}`);
      err(`${rel}: ${e?.message || e}`);
    }
    onProgress?.(i + 1, input.length);
    await new Promise(r => setTimeout(r));
  }
  return res;
}
