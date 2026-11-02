// Dùng chung cho content / popup
const LOG = '[GDT-XML]';

const DEFAULT_SETTINGS = {
  enabled: true,        // tự tải khi kế toán bấm Tìm kiếm
  force: false,         // tải lại cả HĐ đã tải
  rootFolder: 'HoaDonXML',
};

async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

// Ngày dạng 'YYYY-MM-DD' theo giờ VN (UTC+7)
function todayVN() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
