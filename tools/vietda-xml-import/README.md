# vietda-xml-import

Nạp lần lượt **mọi file XML hóa đơn trong 1 thư mục** vào phiếu đang mở trên VietDA Accounting, thay cho việc bấm **"Thêm từ file XML"** + chọn từng file tay (hộp thoại VietDA chỉ cho chọn 1 file/lần).

## Cách dùng

1. Mở VietDA, mở phiếu cần nạp (vd *Thu chi > Phiếu thu tiền mặt*), để phiếu đó ở **tab đang chọn**. Không để hộp thoại nào đang mở.
2. Chạy thử (không bấm gì trên VietDA, chỉ liệt kê file sẽ nạp):
   ```
   powershell -ExecutionPolicy Bypass -File "E:\TapHoa39\Gemini\TapHoa39KeToan\tools\vietda-xml-import\vietda-xml-import.ps1" -Folder "C:\Users\Hello\Downloads\HoaDonXML\BanRa\2026-11" -DryRun
   ```
3. Chạy thật: bỏ `-DryRun`. Không truyền `-Folder` thì tool mở hộp chọn thư mục.
4. Xong: kiểm tra tổng tiền trên phiếu rồi **tự bấm Lưu** trên VietDA (tool không bấm Lưu).

| Tham số | Ý nghĩa |
|---|---|
| `-Folder` | Thư mục chứa `.xml` (không quét thư mục con), nạp theo thứ tự tên file |
| `-DryRun` | Chỉ kiểm tra + liệt kê, không bấm |
| `-Force` | Nạp cả file đã ghi trong sổ đã nạp |
| `-TimeoutSec` | Thời gian tối đa cho 1 file (mặc định 120) |

## Không ảnh hưởng người dùng

- Không dùng chuột/bàn phím, không giành focus: bấm nút qua MSAA (`accDoDefaultAction`), điền đường dẫn bằng `WM_SETTEXT`, đóng hộp thoại bằng `WM_COMMAND`. Hộp thoại VietDA bật lên được đẩy ra ngoài màn hình ngay.
- VietDA phải đang mở (cửa sổ có thể nằm dưới cửa sổ khác). **Không thao tác trên VietDA** khi tool đang chạy.

## Hộp thoại

- *"Dữ liệu trong chứng từ đã có! ... hội nhập thêm từ file XML không?"* → tự bấm **OK**.
- Thông báo 1 nút sau khi nạp → tự đóng, file được đánh dấu **cần kiểm tra** (không ghi sổ đã nạp).
- Câu hỏi lạ (nhiều nút) hoặc quá thời gian → **DỪNG cả lượt**, để nguyên hộp thoại cho người dùng xử lý.

## Chống nạp trùng

VietDA không chặn trùng (nạp lại là cộng thêm dòng). Tool tự chặn theo khóa `MST người bán | mẫu+ký hiệu | số HĐ` đọc từ XML (XML lỗi → hash file):
- Trùng giữa các file trong cùng thư mục → chỉ nạp 1.
- Đã nạp ở lần chạy trước → bỏ qua. Sổ: `_vietda-da-nhap.txt` trong thư mục XML. Nếu đã bỏ phiếu không Lưu và muốn nạp lại → `-Force` (hoặc xóa sổ).

Log từng lần chạy: `_vietda-import.log` trong thư mục XML. Exit code: `0` xong, `1` lỗi kiểm tra đầu vào, `2` dừng giữa chừng.
