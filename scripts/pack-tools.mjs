// Nén mỗi thư mục con của tools/ thành public/tools/<tên>.zip cho trang "Tải công cụ" (Tiện ích).
// Chạy tự động trước `npm run build` / `npm start` (prebuild/prestart). Zip là file sinh ra, không commit.
import { readdirSync, readFileSync, statSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = join(root, 'tools');
const outDir = join(root, 'public', 'tools');

// rác build + file tool tự ghi khi chạy thử (log, sổ đã nạp, danh mục đối tượng của vietda-xml-import)
const EXCLUDE = [/^__pycache__$/, /\.pyc$/, /^\.DS_Store$/, /^Thumbs\.db$/i, /^_vietda-/];

function collect(dir, prefix, files) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.some(re => re.test(name))) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, `${prefix}${name}/`, files);
    else files[`${prefix}${name}`] = [readFileSync(full), { mtime: st.mtime }];
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const tools = readdirSync(toolsDir).filter(name => statSync(join(toolsDir, name)).isDirectory());
for (const name of tools) {
  const files = {};
  // gốc zip = tên thư mục → giải nén ra đúng 1 thư mục
  collect(join(toolsDir, name), `${name}/`, files);
  const count = Object.keys(files).length;
  if (!count) {
    console.warn(`[pack-tools] bỏ qua ${name}: thư mục rỗng`);
    continue;
  }
  const zip = zipSync(files, { level: 9 });
  writeFileSync(join(outDir, `${name}.zip`), zip);
  console.log(`[pack-tools] ${name}.zip — ${count} file, ${(zip.length / 1024).toFixed(1)} KB`);
}
console.log(`[pack-tools] xong: ${tools.length} công cụ → public/tools/`);
