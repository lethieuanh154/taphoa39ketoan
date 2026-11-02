// Chạy trong MAIN world của trang GDT: khi content script "arm", Blob kế tiếp trang tạo bằng URL.createObjectURL
// (chính là file ZIP trang tải về) được gửi bản sao sang content script để giải nén lấy XML.
// Không đổi hành vi trang: file gốc vẫn tải bình thường.
(() => {
  let armedUntil = 0;
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.__gdtXml === 'arm') armedUntil = Date.now() + e.data.ms;
  });
  const original = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = original.apply(this, arguments);
    if (obj instanceof Blob && Date.now() < armedUntil) {
      armedUntil = 0;
      window.postMessage({ __gdtXml: 'blob', blob: obj }, location.origin);
    }
    return url;
  };
})();
