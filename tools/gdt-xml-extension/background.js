const LOG = '[GDT-XML]';

// Content script báo trước tên file → file kế tiếp do trang GDT tải sẽ được đổi tên / xếp thư mục
let expected = null;
// Có listener onDeterminingFilename thì Chrome bỏ qua `filename` của chính downloads.download → phải suggest lại
let ownNext = null;

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId === chrome.runtime.id) {
    const filename = ownNext;
    ownNext = null;
    suggest(filename ? { filename, conflictAction: 'overwrite' } : undefined);
    return;
  }
  const fromGdt = /hoadondientu\.gdt\.gov\.vn/.test(`${item.url} ${item.finalUrl || ''} ${item.referrer || ''}`);
  if (!fromGdt || !expected || Date.now() - expected.at > 10 * 60e3) {
    suggest();
    return;
  }
  const ext = (item.filename.match(/\.[^./\\]+$/) || ['.zip'])[0].toLowerCase();
  const filename = `${expected.base}${ext}`;
  const { tabId } = expected;
  expected = null;
  suggest({ filename, conflictAction: 'overwrite' });
  console.info(LOG, `Đổi tên ${item.filename} → ${filename}`);
  chrome.tabs.sendMessage(tabId, { type: 'downloadCaptured', id: item.id, original: item.filename, filename }).catch(() => {});
});

// Bỏ file ZIP gốc sau khi đã lưu XML: đang tải thì hủy, tải xong thì xóa file; xóa luôn khỏi lịch sử tải
async function discardDownload(id) {
  const [item] = await chrome.downloads.search({ id });
  if (!item) return;
  if (item.state === 'in_progress') await chrome.downloads.cancel(id);
  else if (item.state === 'complete' && item.exists) await chrome.downloads.removeFile(id);
  await chrome.downloads.erase({ id });
}

async function waitComplete(id, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const [item] = await chrome.downloads.search({ id });
    if (item?.state === 'complete') return item;
    if (!item || item.state === 'interrupted') throw new Error(`Tải XML bị ngắt (${item?.error || 'không thấy'})`);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Lưu XML quá lâu');
}

async function saveXml({ filename, base64, discardId }) {
  ownNext = filename;
  const id = await chrome.downloads.download({ url: `data:application/xml;base64,${base64}`, filename, conflictAction: 'overwrite', saveAs: false });
  const item = await waitComplete(id);
  // Chỉ bỏ ZIP khi XML đã nằm đúng chỗ
  if (!item.filename.replace(/\\/g, '/').endsWith(filename)) throw new Error(`XML lưu sai tên: ${item.filename}`);
  try {
    await discardDownload(discardId);
  } catch (e) {
    console.warn(LOG, `Không xóa được ZIP #${discardId}: ${e.message}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'expectDownload') {
    expected = msg.base ? { base: msg.base, tabId: sender.tab.id, at: Date.now() } : null;
    sendResponse({ ok: true });
  }
  if (msg.type === 'saveXml') {
    saveXml(msg).then(() => sendResponse({ ok: true })).catch((e) => {
      console.error(LOG, `Lưu XML lỗi ${msg.filename}: ${e.message}`);
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }
});
