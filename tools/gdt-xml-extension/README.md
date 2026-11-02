# Extension Chrome — Tải XML HĐĐT

Kế toán tự đăng nhập, chọn tab và ngày, bấm **Tìm kiếm**, nhập captcha trên https://hoadondientu.gdt.gov.vn. Sau đó extension **tự tải XML mọi hóa đơn trong kết quả** (qua hết các trang).

Extension **không** đăng nhập hộ, **không** giải captcha, **không** gọi thẳng API GDT. Nó chỉ tự bấm giao diện của trang (chọn từng dòng, bấm nút tải XML, sang trang sau), giống người làm tay. Mọi request do chính code của GDT gửi.

> - Vì sao không gọi API: GDT chặn request không do web của họ gửi (403 "Hệ thống phát hiện hành vi không hợp lệ"). Ngày 01/11/2026 đã chốt không giả header để lách chặn.
> - Vì sao không tự chạy hằng ngày: mỗi lần Tìm kiếm GDT đều hiện captcha, nên phải có người bấm.

## Cài đặt (Chrome / Edge / Cốc Cốc)
1. Chép cả thư mục `gdt-xml-extension` sang máy kế toán.
2. Mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục này.
3. Trong cài đặt Chrome → Tải xuống: **tắt** "Hỏi vị trí lưu tệp trước khi tải xuống", nếu không mỗi HĐ sẽ hỏi 1 lần.
4. Lần đầu tải nhiều file, Chrome có thể hỏi "Cho phép tải nhiều tệp" → chọn Cho phép.

## Dùng
1. Chọn tab **Tra cứu hóa đơn điện tử mua vào / bán ra**, tab con **Hóa đơn điện tử / Hóa đơn có mã khởi tạo từ máy tính tiền**, rồi đặt ngày.
2. Bấm **Tìm kiếm** và nhập captcha. Extension đợi kết quả rồi tự tải.
3. Trong lúc chạy: **không thao tác trên trang**, giữ tab GDT đang hiển thị. Ô trạng thái ở góc dưới bên trái có nút **Dừng** (popup cũng có).
4. GDT mặc định 15 HĐ/trang và mỗi lần sang trang lại hỏi captcha. Vì vậy sau lần Tìm kiếm đầu, nếu còn trang sau, extension tự đổi số dòng/trang sang mức lớn nhất (50), có thể phải nhập thêm 1 captcha. Ví dụ 191 HĐ: còn 4 trang thay vì 13.
5. Giữa chừng GDT hỏi captcha (sang trang, đổi số dòng…) thì extension tạm dừng (ô màu cam) và đặt sẵn con trỏ vào ô captcha: gõ mã rồi Enter là chạy tiếp. Bấm **Hủy** trên captcha thì extension dừng. Extension KHÔNG tự giải captcha.
6. Muốn tải tab con / hướng khác: chuyển tab rồi bấm Tìm kiếm lần nữa.

HĐ đã tải sẽ tự bỏ qua (nhớ theo khóa HĐ). Trong popup có:
- **Tải lại cả HĐ đã tải**: tải đè.
- **Tự tải khi bấm Tìm kiếm**: tắt khi chỉ muốn tra cứu.

## File lưu
`Downloads/HoaDonXML/MuaVao|BanRa/YYYY-MM/<ngày lập>_<MST người bán>_<mẫu số+ký hiệu>_<số HĐ>.xml`
- GDT trả về ZIP (`invoice.xml` + file phụ). Extension giải nén, chỉ lưu `.xml`, rồi xóa ZIP và xóa khỏi lịch sử tải.
- Cách lấy dữ liệu: `page-hook.js` (MAIN world) bọc `URL.createObjectURL`. Khi content script "arm" ngay trước lúc bấm nút tải, Blob kế tiếp trang tạo ra (chính là file ZIP) được gửi bản sao sang `content.js` để giải nén (`DecompressionStream('deflate-raw')`, không cần thư viện). Hành vi trang không đổi.
- Không lấy được dữ liệu / giải nén lỗi / lưu XML lỗi → **giữ nguyên ZIP** (`.zip` cùng tên) để không mất file. Xem Console.

## Cách bấm (`content.js`)
1. Bắt sự kiện `submit` của form có nút "Tìm kiếm" (chỉ thao tác thật, `isTrusted`). Hướng (mua vào / bán ra) lấy từ tab đang active.
2. Có hộp captcha (`.ant-modal-wrap` chứa chữ "captcha") thì chờ đến khi đóng, rồi chờ hết spinner.
3. Mỗi dòng: lấy khóa HĐ từ `data-row-key` (`<id>_<MST bán>_<mẫu số>_<ký hiệu>_<số>`) và ngày lập từ cột ngày. HĐ đã tải thì bỏ qua. Nếu chưa tải thì bấm chọn dòng rồi bấm nút tải XML.
4. Nút tải XML được nhận diện qua tooltip có chữ "XML" (rê chuột giả lên từng nút icon trên thanh công cụ), vị trí được nhớ cho các dòng sau. Không thấy thì báo lỗi kèm tooltip các nút.
5. `background.js` báo trước tên file. File kế tiếp tải từ GDT được đổi tên qua `chrome.downloads.onDeterminingFilename`.
6. Bấm ">" sang trang sau đến hết.

`chrome.storage.local`: `settings` (`enabled`, `force`, `rootFolder`), `downloaded` (khóa HĐ đã tải, tự xóa > 400 ngày), `status`.

## Gỡ lỗi
F12 trên tab GDT → Console, lọc `[GDT-XML]`.
GDT đổi giao diện thì extension sẽ báo "Không …" hoặc "Không tìm thấy nút tải XML — #1: … | #2: …". Gửi dòng đó để sửa.
