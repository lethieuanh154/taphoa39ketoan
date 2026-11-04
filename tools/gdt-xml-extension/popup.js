const $ = (id) => document.getElementById(id);
let tabId = null;

function renderStatus(status) {
  if (!status) return;
  const at = new Date(status.at).toLocaleString('vi-VN');
  $('status').textContent = `${status.text}\n(${at})`;
  $('status').style.background = { done: '#dcfce7', running: '#dbeafe', waiting: '#fef0c7', stopped: '#f3f4f6' }[status.state] || '#fee2e2';
  $('stop').disabled = !tabId || !['running', 'waiting'].includes(status.state);
}

async function saveSettings() {
  const settings = {
    enabled: $('enabled').checked,
    force: $('force').checked,
    excel: $('excel').checked,
    rootFolder: $('rootFolder').value.trim() || DEFAULT_SETTINGS.rootFolder,
  };
  await chrome.storage.local.set({ settings });
  console.info(LOG, 'Đã lưu cài đặt', settings);
}

async function init() {
  const settings = await loadSettings();
  $('enabled').checked = settings.enabled;
  $('force').checked = settings.force;
  $('excel').checked = settings.excel;
  $('rootFolder').value = settings.rootFolder;

  const [tab] = await chrome.tabs.query({ url: 'https://hoadondientu.gdt.gov.vn/*' });
  const ping = tab ? await chrome.tabs.sendMessage(tab.id, { type: 'ping' }).catch(() => null) : null;
  if (!tab || !ping) {
    $('page').hidden = false;
    $('page').textContent = tab ? 'Trang GDT chưa sẵn sàng — tải lại trang (F5)' : 'Chưa mở trang hoadondientu.gdt.gov.vn';
  } else {
    tabId = tab.id;
  }
  const { status } = await chrome.storage.local.get('status');
  renderStatus(status);
  $('stop').disabled = !ping?.running;
}

for (const id of ['enabled', 'force', 'excel']) $(id).onchange = saveSettings;
$('rootFolder').onchange = saveSettings;

$('stop').onclick = () => {
  console.info(LOG, 'Popup yêu cầu dừng');
  chrome.tabs.sendMessage(tabId, { type: 'stop' }).catch((e) => console.error(LOG, `Gửi lệnh dừng lỗi: ${e.message}`));
};

chrome.storage.onChanged.addListener((changes) => {
  if (changes.status) renderStatus(changes.status.newValue);
});

init();
