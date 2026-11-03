# vietda-bank-import — tự tạo phiếu thu/chi tiền gửi từ sao kê (03/11/2026)

`vietda-bank-import.ps1` / double-click **`Nhap-SaoKe-vao-VietDA.bat`**. Mỗi giao dịch sao kê TPBank → 1 phiếu:

| Sao kê | Phiếu VietDA | Đối tượng | Lý do |
|---|---|---|---|
| Ghi có | Phiếu thu tiền gửi (báo có) | `SMMM` (Song Minh, đổi bằng `-ReceiptObject`) | `Thu tiền bán hàng theo HD <số HĐĐT>` — số HĐĐT lấy từ CSV **Đối soát CK** (`doi-soat-ck_*.csv`) theo Mã GD |
| Ghi nợ | Phiếu chi tiền gửi (báo nợ) | người bán trong XML HĐ đầu vào | `Chuyển trả tiền hàng theo HD <số HĐ>` — số lấy từ "HD <số>" trong diễn giải sao kê, khớp với XML |

Ngày phiếu = ngày giao dịch. Số tiền = số tiền sao kê (VietDA tự điền Diễn giải + TK 1121/131, 331/1121).

## Cách dùng

1. Mở VietDA, đăng nhập đúng file dữ liệu. Không để hộp thoại nào mở. Tool **tự mở** menu Thu chi > Phiếu thu/chi tiền gửi.
2. Double-click `Nhap-SaoKe-vao-VietDA.bat` → chọn sao kê `.xlsx` → CSV đối soát → thư mục XML đầu vào → xem danh sách → gõ `Y`.
3. **Không đụng chuột/bàn phím tới khi xong**: grid "Chi tiết thu chi" chỉ nhận bàn phím nên tool chiếm focus VietDA, click + gõ như người. Bấm chỗ khác → tool tự dừng.

Lần đầu nên chạy thử:
```
powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -Statement sk.xlsx -Recon doi-soat-ck.csv -XmlFolder D:\HoaDonXML\MuaVao -DryRun
powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 ... -Limit 1
```

| Tham số | Ý nghĩa |
|---|---|
| `-Mode Thu` / `-Mode Chi` | chỉ làm 1 loại phiếu (mặc định cả 2: thu trước, chi sau) |
| `-DryRun` | chỉ liệt kê phiếu sẽ tạo (vẫn mở phiếu + list Đối tượng để đọc danh mục, không nhập gì) |
| `-NoSave` | điền phiếu đầu tiên rồi dừng, KHÔNG Lưu (kiểm tra cách điền) |
| `-Limit N` | mỗi loại phiếu chỉ làm N phiếu đầu |
| `-Yes` | không hỏi Y |
| `-Force` | làm lại cả GD đã ghi trong sổ |
| `-ReceiptObject` | mã Đối tượng phiếu thu (mặc định `SMMM`) |
| `-AmountCell x,y` | vị trí ô Số tiền dòng 1 tính từ góc grid (mặc định `280,46`) |
| `-StepDelayMs` | nghỉ sau mỗi thao tác (mặc định 250) |

## Mỗi phiếu

Phiếu đang mở phải trống → Ngày → Đối tượng (gõ mã + Tab, kiểm ô tên) → Lý do → click ô Số tiền dòng 1 + gõ → kiểm **Tổng thanh toán** = số tiền → **Lưu** → **Thêm**. Ô chữ điền bằng `WM_SETTEXT` (không qua Unikey), không được mới gõ phím.

Hành vi VietDA đã thử thật (03/11/2026): **Lưu** không hiện gì, phiếu giữ nguyên dữ liệu. **Thêm** sau khi đã lưu → phiếu mới (số CT +1, giữ Ngày). **Thêm** khi phiếu CHƯA lưu → hỏi "Bạn có muốn lưu dữ liệu không?" (Yes/No; No = bỏ phiếu nhưng số CT vẫn nhảy). Vì vậy tool xác nhận đã lưu bằng cách bấm Thêm: không bị hỏi + ra phiếu mới mới ghi sổ; bị hỏi → **DỪNG**, để nguyên hộp thoại. Thông báo lạ sau Lưu / câu hỏi khác → cũng DỪNG.

Tốc độ đo được: ~4,3 giây điền + Lưu, ~1 giây Thêm → **~5–6 giây/phiếu** (~600–700 phiếu/giờ). Đọc danh mục Đối tượng (OCR) ~4 giây/lượt.

## Đối tượng phiếu chi (người bán XML → mã VietDA)

List Đối tượng là list tự vẽ (mã | tên | địa chỉ | MST), chỉ đọc được mã. Tool click mở list, cuộn từng trang, **OCR cột MST** (Windows OCR có sẵn), rồi chọn từng mã để đọc tên. Kết quả ghi `_vietda-doi-tuong.csv` (`Mã;MST(OCR);Tên`) để kiểm.
Thứ tự khớp: `_vietda-map-mst.csv` (tự ghi tay, mỗi dòng `MST;Mã`) → MST OCR / mã = MST → tên trùng (bỏ dấu, hoa/thường). OCR đọc sai chỉ làm "không khớp", không khớp nhầm. Không khớp được → GD bị bỏ qua kèm lý do trong log.

## Bỏ qua / chống trùng

- Ghi có không có trong CSV đối soát (GD thừa, khác kỳ) hoặc HĐ chưa có số HĐĐT → bỏ qua.
- Ghi nợ không có "HD <số>" → thử khớp XML cùng số tiền trong 120 ngày trước (phải duy nhất). Tổng HĐ ≠ số tiền CK → vẫn tạo, log ghi `LỆCH`.
- Sổ `_vietda-ck-da-nhap.txt` (cạnh script, khóa `Thu|Chi + Mã GD`) chỉ ghi sau khi Lưu xong → chạy lại không tạo trùng. Log: `_vietda-ck-import.log`.
- Exit code: `0` xong, `1` lỗi đầu vào, `2` dừng giữa chừng.
