// Chạy trong trang hoadondientu.gdt.gov.vn.
// Kế toán tự chọn tab + ngày, bấm Tìm kiếm, nhập captcha → extension tự chọn từng dòng trong kết quả và bấm nút tải XML.
// Mọi request do chính code GDT gửi. KHÔNG gọi thẳng API GDT (bị chặn 403 chống bot, user chốt 01/11/2026 không giả header),
// KHÔNG đăng nhập, KHÔNG giải captcha (gặp captcha thì dừng chờ người nhập).

const STEP_DELAY = 1200;
const LOAD_TIMEOUT = 30000;
const DOWNLOAD_TIMEOUT = 30000;
const CAPTCHA_TIMEOUT = 5 * 60e3;

class StopError extends Error {}
class UiError extends Error {
  constructor(message, fatal = false) {
    super(message);
    this.fatal = fatal;
  }
}

let running = false;
let stopRequested = false;
let captchaCancelled = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function checkStop() {
  if (stopRequested) throw new StopError('Đã dừng theo yêu cầu');
}

async function pause(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    checkStop();
    await sleep(Math.min(200, end - Date.now()));
  }
}

async function waitUntil(fn, ms, step = 200) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    checkStop();
    if (fn()) return true;
    await sleep(step);
  }
  return false;
}

// ==================== DOM ====================

// Antd giữ cả tab đang ẩn trong DOM → chỉ lấy phần tử mà mọi tabpane cha đều đang active
function inActivePanes(el) {
  for (let p = el.closest('.ant-tabs-tabpane'); p; p = p.parentElement?.closest('.ant-tabs-tabpane')) {
    if (!p.classList.contains('ant-tabs-tabpane-active')) return false;
  }
  return true;
}

const $$ = (sel) => [...document.querySelectorAll(sel)].filter(inActivePanes);
const spinning = () => $$('.ant-spin-spinning').length > 0;

async function waitIdle(minMs = 800) {
  await pause(minMs);
  if (!(await waitUntil(() => !spinning(), LOAD_TIMEOUT, 300))) throw new UiError('Trang GDT tải quá lâu');
}

const captchaModal = () => [...document.querySelectorAll('.ant-modal-wrap')]
  .find((w) => w.getClientRects().length > 0 && getComputedStyle(w).display !== 'none' && /captcha/i.test(w.textContent));

// Gặp captcha → chờ kế toán nhập. Bấm Hủy / X → dừng.
async function passCaptcha() {
  while (captchaModal()) {
    captchaCancelled = false;
    console.info(LOG, 'Chờ nhập captcha');
    await report('waiting', 'Nhập mã captcha trên trang rồi Enter để tiếp tục…');
    captchaModal()?.querySelector('#cvalue')?.focus();
    if (!(await waitUntil(() => !captchaModal(), CAPTCHA_TIMEOUT, 300))) throw new UiError('Chờ captcha quá 5 phút', true);
    if (captchaCancelled) throw new StopError('Đã hủy captcha');
    await pause(800);
  }
  await waitIdle(300);
}

function activeContext() {
  const tabs = $$('.ant-tabs-tab-active').map((t) => t.textContent.trim().toLowerCase());
  const dir = tabs.some((t) => t.includes('bán ra')) ? 'out' : tabs.some((t) => t.includes('mua vào')) ? 'in' : null;
  const mtt = tabs.some((t) => t.includes('máy tính tiền'));
  return { dir, label: `${dir === 'out' ? 'Bán ra' : 'Mua vào'}${mtt ? ' MTT' : ''}` };
}

const currentRows = () => $$('tr.ant-table-row[data-row-key]');

function parseRow(tr) {
  const rowKey = tr.dataset.rowKey;
  const date = [...tr.cells].map((c) => c.textContent.trim()).find((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t));
  const ymd = date ? date.split('/').reverse().join('-') : todayVN();
  // data-row-key = <id>_<MST người bán>_<mẫu số>_<ký hiệu>_<số HĐ>
  const parts = rowKey.split('_');
  if (parts.length < 5) return { rowKey, ymd };
  const [nbmst, khmshdon, khhdon, shdon] = parts.slice(-4);
  return { rowKey, ymd, nbmst, khmshdon, khhdon, shdon };
}

function invoiceKey(dir, inv) {
  return inv.shdon ? `${dir}|${inv.nbmst}|${inv.khmshdon}${inv.khhdon}|${inv.shdon}` : `${dir}|${inv.rowKey}`;
}

function invoiceBase(settings, dir, inv) {
  const safe = (s) => String(s ?? '').replace(/[^\w-]/g, '');
  const root = settings.rootFolder.replace(/[\\/:*?"<>|]/g, '').trim() || DEFAULT_SETTINGS.rootFolder;
  const name = inv.shdon ? `${safe(inv.nbmst)}_${safe(inv.khmshdon)}${safe(inv.khhdon)}_${safe(inv.shdon)}` : safe(inv.rowKey);
  return `${root}/${dir === 'in' ? 'MuaVao' : 'BanRa'}/${inv.ymd.slice(0, 7)}/${inv.ymd}_${name}`;
}

// Nút icon trên thanh công cụ của bảng: Xem / In / Xuất hóa đơn / Xuất XML
// (bỏ nút phân trang, nút tròn ở header, nút làm mới captcha trong modal — modal vẫn nằm trong DOM sau khi đóng)
const toolbarButtons = () => $$('button.ant-btn-icon-only')
  .filter((b) => !b.classList.contains('ant-btn-circle') && !b.querySelector('.anticon-left, .anticon-right') && !b.closest('.ant-modal-root, .ant-modal-wrap'));

async function tooltipOf(btn) {
  btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  btn.dispatchEvent(new MouseEvent('mouseenter'));
  await pause(500);
  const tip = [...document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner')].pop();
  const text = tip?.textContent.trim() || '';
  btn.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
  btn.dispatchEvent(new MouseEvent('mouseleave'));
  await pause(200);
  return text;
}

const xmlBtnIndex = {};

// Tìm nút tải XML theo tooltip (không có title trong DOM), nhớ vị trí cho các dòng sau.
// Nút XML là nút cuối → thử nút cuối trước, chỉ dò các nút khác khi GDT đổi thứ tự.
async function xmlButton(dir) {
  const btns = toolbarButtons();
  if (xmlBtnIndex[dir] != null && btns[xmlBtnIndex[dir]]) return btns[xmlBtnIndex[dir]];
  const order = btns.map((_, i) => i).reverse();
  const tips = [];
  for (const i of order) {
    const b = btns[i];
    if (b.disabled) { tips.push(`#${i + 1}: (khóa)`); continue; }
    const t = await tooltipOf(b);
    tips.push(`#${i + 1}: ${t || '(không tooltip)'}`);
    if (/xml/i.test(t)) {
      xmlBtnIndex[dir] = i;
      console.info(LOG, `Nút tải XML = nút thứ ${i + 1} (${t})`);
      return b;
    }
  }
  console.warn(LOG, 'Các nút công cụ:', tips.join(' | '));
  throw new UiError(`Không tìm thấy nút tải XML — ${tips.join(' | ')}`, true);
}

// ==================== ZIP → XML ====================

// File GDT là ZIP (invoice.xml + file phụ). Đọc ZIP tối giản, không cần thư viện.
async function extractXml(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4) throw new Error('File rỗng');
  if (dv.getUint32(0, true) !== 0x04034b50) {
    const head = new TextDecoder().decode(bytes.subarray(0, 64)).replace(/^﻿/, '').trimStart();
    if (head.startsWith('<')) return bytes;
    throw new Error('File không phải ZIP/XML');
  }
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP hỏng');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP hỏng (central dir)');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!/\.xml$/i.test(name)) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) return raw;
    if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error(`ZIP nén kiểu ${method} chưa hỗ trợ`);
  }
  throw new Error('ZIP không có file .xml');
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

let downloadWaiter = null;
let blobWaiter = null;

// page-hook.js (MAIN world) gửi bản sao Blob file trang vừa tải
window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.__gdtXml === 'blob' && e.data.blob instanceof Blob) blobWaiter?.(e.data.blob);
});

const armBlob = (ms) => window.postMessage({ __gdtXml: 'arm', ms }, location.origin);

// Giải nén lấy XML, lưu XML rồi bỏ file ZIP. Lỗi gì cũng giữ nguyên ZIP để không mất file.
async function keepXmlOnly(blob, base, zipInfo) {
  if (!blob) {
    console.warn(LOG, `Không bắt được dữ liệu file → giữ ZIP ${zipInfo.filename}`);
    return zipInfo.filename;
  }
  let xml;
  try {
    xml = await extractXml(new Uint8Array(await blob.arrayBuffer()));
  } catch (e) {
    console.warn(LOG, `Không giải nén được (${e.message}) → giữ ZIP ${zipInfo.filename}`);
    return zipInfo.filename;
  }
  const res = await chrome.runtime.sendMessage({ type: 'saveXml', filename: `${base}.xml`, base64: toBase64(xml), discardId: zipInfo.id });
  if (!res?.ok) {
    console.warn(LOG, `Lưu XML lỗi (${res?.error}) → giữ ZIP ${zipInfo.filename}`);
    return zipInfo.filename;
  }
  return `${base}.xml`;
}

async function downloadRow(dir, tr, base) {
  tr.cells[1].click();
  await pause(500);
  await passCaptcha();
  const btn = await xmlButton(dir);
  if (!(await waitUntil(() => !btn.disabled, 5000))) throw new UiError('Chọn dòng nhưng nút tải XML vẫn khóa');
  await chrome.runtime.sendMessage({ type: 'expectDownload', base });
  const got = new Promise((resolve) => { downloadWaiter = resolve; });
  const gotBlob = new Promise((resolve) => { blobWaiter = resolve; });
  armBlob(CAPTCHA_TIMEOUT + DOWNLOAD_TIMEOUT);
  try {
    btn.click();
    await pause(800);
    await passCaptcha();
    const info = await Promise.race([got, pause(DOWNLOAD_TIMEOUT).then(() => null)]);
    if (!info) throw new UiError(`Không thấy file tải về sau ${DOWNLOAD_TIMEOUT / 1000} giây`);
    const blob = await Promise.race([gotBlob, pause(2000).then(() => null)]);
    const saved = await keepXmlOnly(blob, base, info);
    console.info(LOG, `Đã lưu ${saved} (GDT đặt tên ${info.original})`);
  } finally {
    downloadWaiter = null;
    blobWaiter = null;
    armBlob(0);
  }
}

// GDT mặc định 15 HĐ/trang, mỗi lần sang trang lại đòi captcha → chọn số dòng lớn nhất (50) để giảm số lần nhập
async function maximizePageSize() {
  const current = $$('.ant-select-selection-selected-value').find((el) => /^\d+$/.test(el.textContent.trim()));
  if (!current) {
    console.warn(LOG, 'Không thấy ô chọn số dòng/trang');
    return;
  }
  const size = Number(current.textContent.trim());
  const selection = current.closest('.ant-select-selection');
  for (const type of ['mousedown', 'mouseup', 'click']) selection.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  await pause(400);
  const items = [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) li.ant-select-dropdown-menu-item')]
    .filter((li) => /^\d+$/.test(li.textContent.trim()));
  const best = items.sort((a, b) => Number(b.textContent) - Number(a.textContent))[0];
  if (!best || Number(best.textContent) <= size) {
    console.info(LOG, `Số dòng/trang giữ ${size} (tối đa ${best?.textContent || '?'})`);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return;
  }
  const firstKey = currentRows()[0]?.dataset.rowKey;
  console.info(LOG, `Đổi số dòng/trang ${size} → ${best.textContent.trim()}`);
  best.click();
  await waitUntil(() => captchaModal() || spinning() || currentRows().length > 15 || currentRows()[0]?.dataset.rowKey !== firstKey, 10000);
  await passCaptcha();
}

// ==================== STATUS ====================

let box = null;

function showBox(text, state) {
  if (!box) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;max-width:380px;padding:10px 14px;'
      + 'border-radius:8px;font:13px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.25);white-space:pre-line';
    box.innerHTML = '<div></div><button type="button" style="margin-top:8px;padding:4px 14px;border:0;border-radius:4px;'
      + 'background:#fff;color:#b42318;font-weight:600;cursor:pointer">Dừng</button>';
    box.querySelector('button').onclick = requestStop;
    document.body.appendChild(box);
  }
  const busy = state === 'running' || state === 'waiting';
  box.style.background = state === 'error' ? '#b42318' : state === 'done' ? '#067647' : state === 'waiting' ? '#b54708' : state === 'stopped' ? '#475467' : '#1d4ed8';
  box.firstChild.textContent = `Tải XML HĐĐT${state === 'running' ? ' — đừng thao tác trên trang' : ''}\n${text}`;
  box.querySelector('button').style.display = busy ? 'inline-block' : 'none';
  box.style.display = 'block';
  clearTimeout(showBox.timer);
  if (!busy) showBox.timer = setTimeout(() => { box.style.display = 'none'; }, 20000);
}

async function report(state, text, extra = {}) {
  showBox(text, state);
  await chrome.storage.local.set({ status: { state, text, at: Date.now(), ...extra } });
}

function requestStop() {
  if (!running) return;
  stopRequested = true;
  console.info(LOG, 'Yêu cầu dừng');
  showBox('Đang dừng…', 'running');
}

// ==================== RUN ====================

async function processPages(ctx, settings, downloaded, stats) {
  for (let page = 1; page <= 200; page++) {
    const keys = currentRows().map((r) => r.dataset.rowKey);
    console.info(LOG, `${ctx.label} trang ${page}: ${keys.length} dòng`);
    for (const [i, k] of keys.entries()) {
      checkStop();
      const tr = currentRows().find((r) => r.dataset.rowKey === k);
      if (!tr) continue;
      const inv = parseRow(tr);
      const key = invoiceKey(ctx.dir, inv);
      stats.found++;
      if (!settings.force && downloaded[key]) { stats.skipped++; continue; }
      await report('running', `${ctx.label} trang ${page}: ${i + 1}/${keys.length} — HĐ ${inv.khhdon || ''}-${inv.shdon || k}`, { stats });
      try {
        await downloadRow(ctx.dir, tr, invoiceBase(settings, ctx.dir, inv));
        downloaded[key] = inv.ymd;
        stats.saved++;
        if (stats.saved % 10 === 0) await chrome.storage.local.set({ downloaded });
      } catch (e) {
        if (e instanceof StopError || e.fatal) throw e;
        stats.failed++;
        stats.lastError ||= e.message;
        console.error(LOG, `Tải lỗi ${key}: ${e.message}`);
      }
      await pause(STEP_DELAY);
    }
    const next = $$('button').find((b) => b.querySelector('.anticon-right'));
    if (!next || next.disabled) return;
    next.click();
    // Sang trang GDT đòi captcha → chờ captcha hiện hoặc bảng đổi, rồi mới xét bảng
    const pageChanged = () => currentRows()[0]?.dataset.rowKey !== keys[0];
    await waitUntil(() => captchaModal() || pageChanged(), 10000);
    await passCaptcha();
    if (!(await waitUntil(pageChanged, LOAD_TIMEOUT))) throw new UiError(`Không sang được trang ${page + 1}`, true);
  }
}

async function onSearch() {
  const settings = await loadSettings();
  if (!settings.enabled || running) return;
  running = true;
  stopRequested = false;
  const stats = { found: 0, saved: 0, skipped: 0, failed: 0 };
  const { downloaded = {} } = await chrome.storage.local.get('downloaded');
  let ctx = activeContext();

  try {
    if (!ctx.dir) throw new UiError('Không xác định được tab mua vào / bán ra', true);
    console.info(LOG, `Bắt đầu sau Tìm kiếm: ${ctx.label}`);
    await report('running', `${ctx.label}: chờ kết quả tìm kiếm…`, { stats });
    await waitUntil(() => captchaModal() || spinning(), 3000);
    await passCaptcha();
    ctx = activeContext();
    const next = $$('button').find((b) => b.querySelector('.anticon-right'));
    if (next && !next.disabled) {
      await report('running', `${ctx.label}: đổi sang số dòng/trang lớn nhất…`, { stats });
      await maximizePageSize();
    }
    await processPages(ctx, settings, downloaded, stats);

    const ok = stats.failed === 0;
    const text = `${ctx.label}: tải mới ${stats.saved}, đã có ${stats.skipped}, lỗi ${stats.failed} / ${stats.found} HĐ`
      + (stats.lastError ? `\nLỗi đầu tiên: ${stats.lastError}` : '');
    console.info(LOG, 'Xong:', text);
    await report(ok ? 'done' : 'error', text, { stats });
  } catch (e) {
    const stopped = e instanceof StopError;
    const text = `${ctx.label}: ${stopped ? e.message : `Lỗi: ${e.message}`} — đã tải mới ${stats.saved}, đã có ${stats.skipped}`;
    if (stopped) console.info(LOG, text);
    else console.error(LOG, `Dừng: ${e.constructor.name}: ${e.message}`);
    await report(stopped ? 'stopped' : 'error', text, { stats });
  } finally {
    // Bỏ khóa cũ > 400 ngày cho storage gọn
    const cutoff = addDays(todayVN(), -400);
    for (const k of Object.keys(downloaded)) if (downloaded[k] < cutoff) delete downloaded[k];
    await chrome.storage.local.set({ downloaded });
    chrome.runtime.sendMessage({ type: 'expectDownload', base: null }).catch(() => {});
    downloadWaiter = null;
    running = false;
  }
}

// Bấm Tìm kiếm (chuột hoặc Enter) → form submit; chỉ nhận thao tác thật của người dùng
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!e.isTrusted || !(form instanceof HTMLFormElement) || !inActivePanes(form)) return;
  if (![...form.querySelectorAll('button[type=submit]')].some((b) => b.textContent.trim() === 'Tìm kiếm')) return;
  onSearch().catch((err) => console.error(LOG, `onSearch lỗi: ${err.message}`));
}, true);

// Bấm Hủy / X trên hộp captcha → dừng. Nút Tìm kiếm không nằm trong <form> → bắt click thay cho submit
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('button');
  if (!btn || !e.isTrusted) return;
  if (!btn.form && btn.textContent.trim() === 'Tìm kiếm' && inActivePanes(btn)) {
    onSearch().catch((err) => console.error(LOG, `onSearch lỗi: ${err.message}`));
  }
  const wrap = btn.closest('.ant-modal-wrap');
  if (wrap && /captcha/i.test(wrap.textContent) && (btn.textContent.trim() === 'Hủy' || btn.classList.contains('ant-modal-close'))) {
    captchaCancelled = true;
  }
}, true);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ping') sendResponse({ running });
  if (msg.type === 'stop') {
    requestStop();
    sendResponse({ ok: true });
  }
  if (msg.type === 'downloadCaptured') downloadWaiter?.(msg);
});

console.info(LOG, 'content script sẵn sàng');
