# vietda-bank-import — tự tạo phiếu thu/chi tiền gửi từ sao kê (03/11/2026)

`vietda-bank-import.ps1` / double-click **`Nhap-SaoKe-vao-VietDA.bat`**. Mỗi giao dịch sao kê TPBank → 1 phiếu:

| Sao kê | Phiếu VietDA | Đối tượng | Lý do |
|---|---|---|---|
| Ghi có | Phiếu thu tiền gửi (báo có) | người mua trong **XML HĐ bán ra** cùng Số HĐĐT: không có MST → **`KH010` "Bán cho người tiêu dùng"** (`-RetailObject`); có MST → mã theo danh mục | `Thu tiền bán hàng theo HD <số HĐĐT> ngày dd/mm/yyyy` (ngày = NLap trong XML bán ra) — Số HĐ + Ký hiệu HĐ lấy từ **Excel Đối soát CK** (`doi-soat-ck_*.xlsx`, sheet `Nhap-VietDA`) theo Mã GD |
| Ghi nợ | Phiếu chi tiền gửi (báo nợ) | **MST đối tác** trong Excel Đối soát CK → mã theo danh mục | `Chuyển trả tiền hàng theo HD <số HĐ> ngày dd/mm/yyyy` (ngày = cột Ngày HĐ của Excel; nhiều HĐ khác ngày → `HD 123 ngày 01/09/2026, 124 ngày 02/09/2026`) — Số HĐ lấy từ Excel (1 CK trả nhiều HĐ → `123, 124`) |

Mỗi GD sao kê đúng 1 phiếu (khách lẻ cũng vậy, không gộp theo ngày).

### Đầu vào (`Input\`) — 06/11/2026

| File | Lấy ở đâu | Bắt buộc |
|---|---|---|
| Sao kê TPBank `.xlsx` | Internet Banking TPBank | có |
| **`doi-soat-ck_<từ>_<đến>.xlsx`** | KeToan > **Đối soát CK** (bán ra + mua vào chung 1 trang) > **Xuất Excel** | có (khi làm phiếu thu) |
| Danh mục Đối tượng (`DANH SACH.xlsx`) | VietDA > xuất danh mục Đối tượng ra Excel | có |
| `doi-soat-ck_*.csv` (định dạng cũ) | trang Đối soát CK cũ / nút "CSV cho tool VietDA (bản cũ)" | không — vẫn đọc một thời gian, log cảnh báo "định dạng cũ" |
| Thư mục XML (mua vào + bán ra) | tool hỏi khi chạy | có (người mua của phiếu thu; phiếu chi chỉ cần khi không có Excel) |

Tool tự nhận file `.xlsx`: có sheet `Nhap-VietDA` → Excel đối soát; có dòng "DANH MỤC ĐỐI TƯỢNG" → danh mục; còn lại → sao kê. Nhiều file Excel đối soát → gộp, trùng Mã GD lấy file đầu (theo tên). Có cả Excel lẫn CSV cũ → Mã GD có trong Excel thì theo Excel.

**Excel Đối soát CK** (code sinh: `src/app/utils/bank-recon-export.util.ts`):
- Sheet `Thong-tin`, dòng **Định dạng** phải = `taphoa39-doi-soat-ck/1`; khác → tool DỪNG báo lỗi (tải tool mới / xuất lại Excel).
- Sheet `Nhap-VietDA` đọc theo **tên cột** dòng 1 (thiếu cột → DỪNG, ghi tên cột thiếu); file đã mở + lưu lại bằng Excel vẫn đọc được. Cột tool dùng: `Loại` (Thu/Chi) · `Mã GD` · `Số tiền` · `Kết quả khớp` · `Lập phiếu theo HĐ` (Có/Không) · `Lý do không lập` · `Độ tin cậy` · `Số HĐ` · `Ký hiệu HĐ` · `Tổng HĐ` · `MST đối tác` · `Tên đối tác`.
- `Lập phiếu theo HĐ` = **Không** (GD thừa, HĐĐT nháp / phát hành trễ, chưa có số HĐĐT, CK không có HĐ, khớp tin cậy thấp, chưa đối soát) → không lập phiếu theo HĐ, ghi `Bỏ qua` + lý do. Các GD này vẫn qua **luật khác** (nộp / rút tiền mặt, lương, chuyển nhầm) trước.
- Kiểm thêm: `Loại` khác chiều sao kê, hoặc `Số tiền` Excel ≠ sao kê → bỏ qua GD đó (Excel của sao kê khác?).
- Phiếu thu: tool vẫn tìm **XML bán ra** cùng Số HĐĐT + ký hiệu để biết người mua (Excel cố ý không có người mua). Phiếu chi: không đoán "HD <số>" trong diễn giải nữa; GD không có dòng Excel → cách cũ (diễn giải + XML mua vào).

Ngày phiếu = ngày giao dịch. Số tiền = số tiền sao kê (VietDA tự điền Diễn giải + TK 1121/131, 331/1121).

## Cách dùng

1. Mở VietDA, đăng nhập đúng file dữ liệu. Không để hộp thoại nào mở. Tool **tự mở** menu Thu chi > Phiếu thu/chi tiền gửi.
2. Copy sao kê TPBank `.xlsx` + **Excel Đối soát CK `doi-soat-ck_*.xlsx`** (trang Đối soát CK > Xuất Excel) + danh mục Đối tượng vào **`Input\`** cạnh script (nhiều file được: tool gộp, GD trùng Mã GD giữa các file chỉ lấy 1). Thiếu file → tool mở thư mục `Input` rồi dừng. `-Statement` / `-Recon` (`.xlsx` hoặc `.csv` cũ) vẫn dùng được khi chạy dòng lệnh.
3. Bỏ XML hóa đơn vào thư mục **`xml\`** cạnh tool (hoặc `Input\xml\`): `xml\sold\` = bán ra, `xml\purchase\` = mua vào (tool quét cả thư mục con, tự tách theo MST công ty). Từ 06/11/2026 tool **không hỏi chọn thư mục** nữa; thiếu thư mục → mở thư mục tool rồi dừng. `-XmlFolder` vẫn dùng được khi chạy dòng lệnh.
4. Double-click `Nhap-SaoKe-vao-VietDA.bat` → xem danh sách → gõ `Y`.
4. **Không đụng chuột/bàn phím tới khi xong**: grid "Chi tiết thu chi" chỉ nhận bàn phím nên tool chiếm focus VietDA, click + gõ như người. Bấm chỗ khác → tool tự dừng.
   Thông báo Chrome / Zalo / Windows hiện đè lên chỗ tool sắp click (nút Thêm, Lưu…) → tool **chờ thông báo tự tắt** (tối đa 30 giây, log `Cửa sổ … đè lên`) rồi mới click, không click nhầm vào thông báo; quá 30 giây → DỪNG, ghi tên app. Hay bị thì tắt thông báo app đó / bật Focus assist (Windows: Settings > System > Notifications).

Lần đầu nên chạy thử:
```
powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -Statement sk.xlsx -Recon doi-soat-ck_2026-09-01_2026-09-30.xlsx -XmlFolder D:\HoaDonXML -DryRun
powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 ... -Limit 1
```

| Tham số | Ý nghĩa |
|---|---|
| `-VerifyOnly` | không tạo phiếu, chỉ xuất bảng kê VietDA + file kết quả (không mở phiếu) |
| `-NoVerify` | không xuất bảng kê VietDA sau khi chạy |
| `-Mode Thu` / `-Mode Chi` | chỉ làm 1 loại phiếu (mặc định cả 2: thu trước, chi sau) |
| `-DryRun` | chỉ liệt kê phiếu sẽ tạo (vẫn mở phiếu + list Đối tượng để đọc danh mục, không nhập gì) |
| `-NoSave` | điền phiếu đầu tiên rồi dừng, KHÔNG Lưu (kiểm tra cách điền) |
| `-Limit N` | mỗi loại phiếu chỉ làm N phiếu đầu |
| `-Yes` | không hỏi Y |
| `-Force` | làm lại cả GD đã ghi trong sổ |
| `-RetailObject` | mã Đối tượng cho HĐ bán ra không có MST người mua (mặc định `KH010` "Bán cho người tiêu dùng"; tên mã đó không phải kiểu khách lẻ → cảnh báo + tự tìm tên "Bán cho người tiêu dùng" / "Khách lẻ…") |
| `-WalkInObject` | mã Khách lẻ cho phiếu "Chuyển trả tiền chuyển nhầm" (mặc định `KH001`) |
| `-CompanyObject` | mã công ty cho nộp/rút tiền mặt, chi lương không rõ nhân viên (mặc định `CTY001`) |
| `-AmountCell x,y` | vị trí ô Số tiền dòng 1 tính từ góc grid. Không truyền → tool OCR dòng tiêu đề grid tìm cột "Số tiền" (đúng cả khi Scale 125%/150%, cột rộng khác); OCR không thấy → `280,46`. |
| `-StepDelayMs` | nghỉ sau mỗi thao tác (mặc định 250) |

## Mỗi phiếu

Phiếu đang mở phải trống → Ngày → Đối tượng (gõ mã + Tab, kiểm ô tên) → Lý do → click ô Số tiền dòng 1 + gõ → kiểm **Tổng thanh toán** = số tiền → **Lưu** → **Thêm**. Ô chữ điền bằng `WM_SETTEXT` (không qua Unikey), không được mới gõ phím.

Hành vi VietDA đã thử thật (03/11/2026): **Lưu** không hiện gì, phiếu giữ nguyên dữ liệu. **Thêm** sau khi đã lưu → phiếu mới (số CT +1, giữ Ngày). **Thêm** khi phiếu CHƯA lưu → hỏi "Bạn có muốn lưu dữ liệu không?" (Yes/No; No = bỏ phiếu nhưng số CT vẫn nhảy). Vì vậy tool xác nhận đã lưu bằng cách bấm Thêm: không bị hỏi + ra phiếu mới mới ghi sổ; bị hỏi → **DỪNG**, để nguyên hộp thoại. Thông báo lạ sau Lưu / câu hỏi khác → cũng DỪNG.

Tốc độ đo được: ~4,3 giây điền + Lưu, ~1 giây Thêm → **~5–6 giây/phiếu** (~600–700 phiếu/giờ).

## Đối tượng (người bán / người mua XML → mã VietDA)

Thư mục XML chọn 1 lần, chứa **cả mua vào + bán ra** (quét thư mục con, vd `HoaDonXML\MuaVao` + `HoaDonXML\BanRa`). Tool tách theo MST công ty (MST có trong nhiều XML nhất): người bán = công ty → bán ra (phiếu thu), còn lại → mua vào (phiếu chi). Phiếu thu không có XML bán ra đúng Số HĐĐT (+ ký hiệu) → **bỏ qua**, ghi lý do.

Trùng MST nhiều mã (1 công ty vừa là khách vừa là NCC) → phiếu thu ưu tiên mã `KH…`, phiếu chi ưu tiên `NCC…`; vẫn không rõ → ghi `MST;Mã;Thu` hoặc `MST;Mã;Chi` vào `_vietda-map-mst.csv` (`MST;Mã` = dùng cho cả 2).

Thứ tự khớp: `_vietda-map-mst.csv` (tự ghi tay, mỗi dòng `MST;Mã[;Thu|Chi]`) → MST trong danh mục / mã = MST → tên trùng (bỏ dấu, hoa/thường). Không khớp được → GD bị bỏ qua kèm lý do.

## Bỏ qua / chống trùng

- GD có `Lập phiếu theo HĐ` = Không trong Excel đối soát, hoặc Ghi có không có trong file đối soát (GD thừa, khác kỳ) → bỏ qua (trừ khi khớp luật khác).
- Phiếu chi theo Excel: tổng HĐ ≠ số tiền CK (1 HĐ trả nhiều lần) → vẫn tạo, ghi chú `tổng HĐ … ≠ số tiền CK`.
- (Cách cũ, GD không có trong Excel) Ghi nợ không có "HD <số>" → thử khớp XML cùng số tiền trong 120 ngày trước (phải duy nhất). Tổng HĐ ≠ số tiền CK → vẫn tạo, log ghi `LỆCH`.
- Sổ `_vietda-ck-da-nhap.txt` (cạnh script, khóa `Thu|Chi + Mã GD`) chỉ ghi sau khi Lưu xong → chạy lại không tạo trùng. Log: `_vietda-ck-import.log`.
- Exit code: `0` xong, `1` lỗi đầu vào, `2` dừng giữa chừng.

## OCR menu / tiêu đề grid — 04/11/2026

- Tool chụp màn hình theo **Scale của Windows** (125%/150%…): tọa độ của tool × `DESKTOPHORZRES/HORZRES`. Thanh menu tìm theo control tên `mainMenu`. Không thấy menu → lỗi ghi chữ OCR đọc được + Scale vào log.
- Ô Số tiền dòng 1: OCR tiêu đề grid tìm cột "Số tiền" (07/11/2026, sửa trên máy kế toán); click 2 lần (lần 1 grid chỉ lấy focus) rồi kiểm focus đã ở grid mới gõ.
- (07/11/2026 bỏ `Chan-Doan-OCR-VietDA.bat` / `chan-doan-ocr.ps1` và ảnh chẩn đoán `_vietda-menu.png` / `_vietda-grid.png`: tool đã chạy ổn trên máy kế toán.)

## Kết quả chạy → `Output\<ngày-giờ>\` (05/11/2026)

Chạy xong (cả khi dừng giữa chừng, cả DRY RUN) tool tự mở thư mục này:

| File | Nội dung |
|---|---|
| `ket-qua-chay.xlsx` | Mỗi GD sao kê 1 dòng (từ 06/11/2026 là `.xlsx` để tô màu: ô **Kết quả chạy** / **Kiểm tra VietDA** xanh lá = `Thành công` / `ĐÚNG` / `Đã tạo ở lần chạy trước` / `Sẽ tạo (DRY RUN)`, đỏ = còn lại; không ghi được `.xlsx` → ghi tạm `ket-qua-chay.csv`): Loại, Mã GD, thời gian, số tiền, diễn giải, đối tượng, lý do, **Kết quả chạy** (`Thành công` / `Lỗi` / `Bỏ qua` + lý do / `Đã tạo ở lần chạy trước` / `Chưa chạy (tool dừng trước)` / `Chưa chạy (-Limit)` / `Sẽ tạo (DRY RUN)`), Số CT, **Nguồn** (`Excel` / `CSV cũ` / `Luật khác` / `Diễn giải + XML (cũ)`), **Lý do không lập** (từ Excel đối soát), **Kiểm tra VietDA** (`ĐÚNG` / `SAI: Ngày, Số tiền, Lý do, Đối tượng` / `KHÔNG THẤY trên VietDA`) + Ngày / Họ tên / Lý do / Số tiền đọc từ bảng kê |
| `tom-tat.txt` | file đầu vào, đếm theo kết quả, ghi chú xuất bảng kê |
| (không lưu file) | Kiểm tra VietDA đọc bảng kê của chính VietDA: Thu chi > **Tìm kiếm chứng từ** (Ngày chứng từ từ/đến = ngày GD đầu/cuối trong sao kê, Loại chứng từ = tiền tố Số CT `TG` / `CG`, các lọc khác VietDA còn nhớ bị xóa) > **Hiển thị** > nút **Excel** → tool đọc file Excel VietDA mở ra (Book1) rồi đóng **không lưu** (từ 06/11/2026 bỏ `VietDA-bang-ke-*.xlsx` khỏi Output) |

- Kiểm tra theo Số CT tool đã tạo (lần này + sổ `_vietda-ck-da-nhap.txt`); không xét phiếu trùng / phiếu tạo tay.
- Tiền tố Số CT mỗi loại phiếu tool nhớ ở `_vietda-loai-ct.txt` (`Thu=TG`, `Chi=CG`) sau lần đầu mở phiếu loại đó; chưa biết → không xuất bảng kê loại đó.
- Lưới VietDA tự vẽ, không đọc được (UIA/MSAA trống) → đọc qua file Excel VietDA xuất (COM, kể cả instance Excel do VietDA tự mở: `EXCEL7` → `OBJID_NATIVEOM`).
- `Input/` (trừ `HUONG-DAN.txt`) và `Output/` không commit, không đóng gói vào zip trang tải (`.gitignore`, `scripts/pack-tools.mjs`).

### Phiếu trống 0 đ (thấy 05/11/2026)

VietDA **ghi ngay 1 bản ghi trống** khi mở phiếu (menu hoặc nút Thêm), mỗi phiếu 1 tab (tab tên = Số CT). Để tab đó lại → bảng kê có phiếu 0 đ không đối tượng (vd TG005/10). **Thoát** phiếu + chọn **No** ("Bạn có muốn lưu dữ liệu không?") → VietDA xóa bản ghi; sau đó hay báo "Chưa có Số cho chứng từ này" (OK).
→ Tool dọn tab trước khi tìm kiếm và cuối mỗi lần chạy: Thoát + No mọi phiếu **trống** đang mở, đóng tab bảng kê; gặp phiếu còn dữ liệu (dừng giữa phiếu) → để nguyên, không xuất bảng kê. Trước khi mở phiếu loại khác cũng Thoát phiếu trống đang mở. VietDA bị thu nhỏ → tool tự khôi phục cửa sổ.

## Danh mục Đối tượng từ file + GD không theo hóa đơn (05/11/2026)

**Danh mục (BẮT BUỘC):** bỏ file VietDA xuất "DANH MỤC ĐỐI TƯỢNG" (vd `DANH SACH.xlsx`: STT | Mã đối tượng | Tên đối tượng | Địa chỉ | Mã số thuế …) vào `Input\` cùng sao kê. Tool nhận file theo dòng tiêu đề, lấy mã + tên + MST chính xác. Thiếu file → tool mở `Input` rồi dừng. (Từ 05/11/2026 bỏ OCR list Đối tượng trên phiếu và file `_vietda-doi-tuong.csv`.) Quy ước mã (data thật SONG MINH): `CTY001` = công ty, `KH001` = Khách lẻ, `KH010` = Bán cho người tiêu dùng (kế toán hay dùng cho HĐ không MST), `KHxxx` khách hàng (phiếu thu), `NCCxxx` nhà cung cấp (phiếu chi), `NVxxx` nhân viên, `BH001` BHXH, `LD001` LĐLĐ.

**GD không qua Đối soát CK / XML** — nhận theo nội dung CK sao kê (bỏ dấu, hoa/thường), lý do chuẩn, tool gõ thêm **TK Nợ / TK Có** vào dòng 1 lưới (sau Số tiền: Tab → TK Nợ → Tab → TK Có; đã thử 05/11/2026 ra đúng 1111/1121):

| Nội dung CK chứa | Phiếu | Đối tượng | Nợ / Có |
|---|---|---|---|
| Nộp tiền mặt vào tài khoản công ty | thu | `CTY001` (`-CompanyObject`) | 1121 / 1111 |
| Rút tiền gửi về nhập quỹ tiền mặt | chi | `CTY001` | 1111 / 1121 |
| Chi lương tháng cho cán bộ nhân viên | chi | `NVxxx` có tên trong nội dung CK / tên người nhận (đúng 1 người), không thấy → `CTY001` | 334 / 1121 |
| Chuyển trả tiền chuyển nhầm | chi | Khách lẻ `KH001` (`-WalkInObject`) | 3388 / 1121 |

BHXH (`BH001`), công đoàn (`LD001`): chưa có luật (1 tháng 1 lần, kế toán làm tay).

Bảng kê VietDA xuất Excel không có cột TK → Kiểm tra VietDA không so TK. Thêm loại GD: sửa bảng `$OtherKinds` trong script.

### Ngày khác tháng của Số CT (thấy trên máy kế toán 05/11/2026)

Số CT VietDA đánh theo tháng (vd `TG006/08`). Nhập Ngày khác tháng (30/10) rồi rời ô → VietDA hỏi "Bạn có muốn điền lại Số chứng từ tự động không?" → tool chọn **Yes** (Số CT theo tháng của ngày GD, vd `TG001/09`) rồi điền tiếp. Hộp khác sau khi nhập Ngày → DỪNG.
Bấm Excel trên bảng kê mà VietDA báo 1 nút (vd bảng kê trống) → OK, coi như 0 phiếu. Quá 120 giây không thấy Excel → lỗi, dừng phần kiểm tra.

---

# Cửa sổ VietDA Tools — `VietDA-Tools.bat` (10/11/2026)

`vietda-tools-ui.ps1`: WinForms trong PowerShell (không cần cài thêm), làm **theo từng bước** — mỗi bước là 1 khung "Bước N — …" có
trạng thái ✔ / ✘ / ⚠ / ○ góc phải; nút chạy chỉ bật khi các bước bắt buộc đã ✔. Chạy 2 tool ở tiến trình powershell riêng, đọc stdout hiện
log có màu + tiến độ; 2 script và các file .bat cũ giữ nguyên. Log cửa sổ: `_vietda-ui.log`; thư mục XML đã chọn nhớ ở `_vietda-ui.json`.

| Tab | Bước | Nút nhập liệu |
|---|---|---|
| Sửa phiếu XH | 1 XML bán ra | chọn **thư mục của tool** (`xml\sold`) hoặc **thư mục khác** (→ `-XmlFolder`); *Thêm file XML…* copy vào `xml\sold`; *Dọn XML cũ…* |
| | 2 Danh mục VTHH (tùy chọn) | *Chọn file danh mục…* → copy vào `Input\danh-muc-vthh\` (file cũ / file đặt nhầm trong `Input\` chuyển vào `_cu\`) |
| | 3 VietDA · 4 Sửa + Lưu | xem bảng dưới |
| Sao kê | 1 Sao kê · 2 Đối soát CK · 3 Danh mục Đối tượng | danh sách file trong `Input\` + *Thêm…* (copy vào `Input\`; đối soát / đối tượng không đúng tên thì thêm tiền tố `doi-soat-ck_` / `DANH SACH_`) + *Bỏ file đã chọn* |
| | 4 XML | thư mục của tool (`xml\sold` + `xml\purchase`, *Thêm XML bán ra / mua vào…*) hoặc thư mục khác |
| | 5 VietDA (loại phiếu, số phiếu) · 6 Chạy | xem bảng dưới |

"Bỏ file" / "Dọn" = **chuyển** vào `<thư mục>\_cu\<ngày-giờ>\`, không xóa. File `.xlsx` giống danh mục VTHH nằm thẳng trong `Input\` → bước
sao kê báo ⚠ và trước khi chạy hỏi chuyển sang `Input\danh-muc-vthh\`.
| Tab | Nút | Chạy |
|---|---|---|
| Sửa phiếu XH | **Sửa + Lưu đầu phiếu** | `vietda-sales-check.ps1 -NoOpen -Fix -Yes [-XmlFolder] [-From -To] [-Limit]` (hộp xác nhận thay cho gõ Y) |
| Sao kê → phiếu thu/chi | Xem trước / Chỉ kiểm tra VietDA / Tạo phiếu | `vietda-bank-import.ps1 [-Mode Thu\|Chi] [-Limit] -DryRun / -VerifyOnly / (tạo)` + `-Yes` |

Tab XH (13/11/2026, user bỏ bước Kiểm tra): kế toán bấm thẳng **Sửa + Lưu đầu phiếu** (bật khi Bước 1 có XML + VietDA đang mở). Tool đọc
từng phiếu, phiếu sai đầu phiếu thì sửa + Lưu + mở lại kiểm; phiếu đúng sẵn không sửa; Thoát mà VietDA hỏi "Bạn có muốn lưu dữ liệu
không ?" → **No**. Kết quả sau khi chạy (đọc `tom-tat.txt` = trạng thái SAU khi Lưu): **ĐẠT** hoặc **CÒN LỖI** — lỗi dòng hàng /
đầu phiếu chưa sửa được / chưa nhập / không có XML → mở **Kết quả**, cột "So với XML". `Kiem-PhieuXH-VietDA.bat` (chỉ đọc) vẫn dùng được ngoài cửa sổ.

Nút **Kết quả** (tab XH) / **Kết quả chạy** (tab sao kê): mở file Excel kết quả **mới nhất** trong `Output\`
(`*_kiem-xh\ket-qua-kiem-xh.xlsx` / `<ngày-giờ>\ket-qua-chay.xlsx`), kể cả của lần chạy trước khi mở cửa sổ; chưa có file → nút xám,
rê chuột xem tên file + giờ. Tool sao kê dùng chuột + bàn phím thật → cửa sổ tự thu nhỏ khi chạy, mở lại khi xong. Nút **Dừng** = taskkill cả cây tiến trình
(cảnh báo nếu đang sửa / tạo phiếu: có thể còn phiếu mở chưa Lưu trên VietDA). Đóng cửa sổ khi đang chạy → hỏi rồi dừng.

---

# vietda-sales-check — kiểm phiếu XH sau Hội nhập XML (09/11/2026)

`vietda-sales-check.ps1` / double-click **`Kiem-PhieuXH-VietDA.bat`**. Sau khi Hội nhập XML hóa đơn bán ra vào VietDA, tool **mở
từng phiếu XH** (Hóa đơn bán và phiếu xuất kho) như kế toán double-click, đọc phiếu rồi so với XML + danh mục Vật tư hàng hóa.
**Chỉ đọc, không sửa phiếu.**

### Đầu vào

| File | Lấy ở đâu | Bắt buộc |
|---|---|---|
| XML bán ra trong `xml\sold\` | **XML quy đổi** (trang Đối soát hóa đơn) — đúng bản đã Hội nhập VietDA | có |
| Danh mục Vật tư hàng hóa `.xlsx` trong **`Input\danh-muc-vthh\`** (để thẳng trong `Input\` thì tool sao kê coi là sao kê; tool XH vẫn đọc được nhưng cảnh báo) | VietDA > Hệ thống > Cập nhật danh mục > Vật tư, hàng hóa > Excel (file có dòng "DANH MỤC VẬT TƯ - HÀNG HÓA") | nên có — thiếu thì không kiểm mã theo danh mục |

XML gốc (chưa quy đổi) vẫn chạy được nhưng chỉ so tiền / thuế; SL, mã khác là chuyện bình thường → chỉ ghi Cảnh báo.
Trùng 1 HĐ có cả XML gốc lẫn quy đổi → dùng bản quy đổi (nhận theo chú thích "Bản QUY ĐỔI ĐVT" đầu file).
Khoảng ngày = ngày HĐ nhỏ nhất → lớn nhất trong XML (`-From` / `-To` dd/MM/yyyy để tự chọn).

### Tool làm gì trên VietDA

1. **Danh sách chứng từ**: tab "Tìm kiếm chứng từ" (Bảng kê chứng từ nhập xuất) **đang mở sẵn** → dùng luôn (đọc MỌI dòng của danh sách
   đó, lọc theo lúc kế toán tìm; không cần chuột). Chưa mở → tool tự vào Nhập xuất > Tìm kiếm chứng từ > Loại `XH`, khoảng ngày XML
   (xóa lọc VietDA còn nhớ) > Hiển thị — bước này dùng chuột ~5 giây. Danh sách mở nhưng nằm sau tab khác → dừng, nhắc bấm tab đó.
2. **Từng dòng**: chọn dòng > **Sửa phiếu** (= double-click) → chờ phiếu nạp xong → đọc → bấm vào lưới → **Thoát** → ↓ dòng kế.
   - Đầu phiếu (ô EDIT/COMBO, đọc bằng WM_GETTEXT theo nhãn bên trái): Số CT, Ngày, Đối tượng, Đơn vị, MST/CC, Lý do, Loại thuế,
     Ký hiệu, Số hóa đơn, Ghi nợ, Ghi có, Phương thức TT, Tiền hàng, Tiền thuế.
   - Ô tick "Hiển thị thuế suất từng mặt hàng", "Hóa đơn": control tự vẽ (BM_GETCHECK luôn 0, UIA tắt) → chụp phiếu bằng PrintWindow,
     đếm điểm tối trong ô vuông (tick ≈ 7, trống = 0).
   - Lưới dòng hàng (tự vẽ, UIA/clipboard không đọc được): mỗi ô F2 → VietDA mở ô sửa (TextBox) → WM_GETTEXT → Esc vào chính ô sửa
     (không lưu). Cột đọc: Mã hàng, Tên, SL, Đơn giá, Tiền hàng, TK Nợ, TK Có, Tiền CK, Tiền vốn, Nợ GV, Có GV, Tiền VAT, Tổng tiền
     (thứ tự cột ở `$GridCols`; Tiền hàng + VAT ≠ Tổng tiền ở mọi dòng → dừng, VietDA đổi cột). ĐVT là ô chọn, F2 không mở → không đọc.
     Phiếu đã tick "Hiển thị thuế suất từng mặt hàng" → VietDA chèn cột **Loại thuế** sau "Giá đích danh" → tool dùng `$GridColsRate`
     (Tiền VAT / Tổng tiền lùi 1 cột) và so Loại thuế từng dòng với TSuat XML.
   - Thoát mà VietDA hỏi **"Bạn có muốn lưu dữ liệu không ?"** → tool chọn **No** (không lưu), ghi vào Ghi chú. Gặp trên máy kế toán
     13/11/2026 với phiếu Hội nhập XML (VietDA tự đổi phiếu lúc mở — "Ngày giờ" hiện ngày hôm nay); trước đó tool dừng hẳn.
   - "Sửa phiếu" nạp bản **đã Lưu** — tick / sửa trên tab đang mở mà chưa Lưu thì tool vẫn thấy bản cũ.
   - **Windows Scale 125% / 150%** (10/11/2026): tool (powershell.exe) và VietDA đều DPI-unaware → tọa độ cửa sổ / message là pixel
     logic, giống 100%. Không còn click tọa độ cố định có rủi ro: danh sách chọn dòng 1 bằng **F5** (không click — lệch thì trúng tiêu đề
     cột = sắp xếp lại); lưới phiếu click cột tiêu đề dòng rồi ←/↑ về ô đầu; ô "Hiển thị thuế suất từng mặt hàng" suy từ **cột Loại thuế**
     trên lưới (đọc cột 18–20, Tiền hàng + c18 = c19 → không có / + c19 = c20 → có); ô "Hóa đơn" dò **hình vuông viền đen** trên ảnh
     PrintWindow quanh vị trí dự kiến, thử tỉ lệ 1 và Scale màn hình (đã thử ảnh ×1 / ×1,25 / ×1,5) — không thấy → "kiểm tay", không đoán.
   - Bấm vào lưới trước khi Thoát: con trỏ còn ở ô Số CT thì lúc đóng VietDA báo "Chưa có Số cho chứng từ này !?" (tool vẫn tự OK).
   - Hết danh sách = ↓ ra lại phiếu vừa đọc → chọn lại từ dòng 1 + ↓ để chắc rồi dừng.
3. Mọi thao tác là **message gửi thẳng vào control** (PostMessage/SendMessage) → VietDA bị che vẫn chạy, dùng app khác được; chỉ
   **không bấm vào VietDA**. VietDA thu nhỏ → tool khôi phục (không lấy focus). Đo 09/11/2026: ~3,5 giây / phiếu 1–6 dòng.
4. Phiếu đã đọc lưu `Output\<ngày-giờ>_kiem-xh\phieu-vietda.json` → so lại không cần VietDA: `-FromForms "<file đó>"`.

### Ghép phiếu ↔ XML

1. Ký hiệu + Số hóa đơn trên phiếu = KHMSHDon+KHHDon + SHDon (ký hiệu lệch → chỉ Số HĐ, ghi "ký hiệu lệch").
2. Cùng ngày + tiền hàng + thuế + số dòng (phiếu chưa có Số HĐ). Nhiều HĐ giống hệt nhau → ghép theo thứ tự.
3. Cùng ngày + tiền hàng (số dòng / thuế lệch → hiện lỗi dòng).
4. Cùng ngày + đúng 1 cặp cùng tên khách (không phải khách lẻ) → tiền lệch.

### Kết quả `ket-qua-kiem-xh.xlsx`

Sheet **Phieu** (mỗi HĐ / phiếu 1 dòng, cột Kết quả): `OK` (xanh) · `Cần sửa đầu phiếu` / `Cảnh báo` (vàng) · `Lỗi dòng` ·
`Chưa nhập VietDA` · `Phiếu không có XML` (đỏ). Cột **So với XML** (10/11/2026, thay 3 cột cũ) — mỗi chỗ lệch 1 dòng trong ô:

```
VietDA: Ký hiệu '1C26MMQ' | XML: Ký hiệu 'C26TMV'
VietDA: Ghi nợ '1111' | Đúng (chuyển khoản): Ghi nợ '131'
Dòng 1 (HH014): VietDA: Mã hàng 'HH014' | XML: Mã hàng 'HH003'
VietDA: MST '0304762338' | XML: MST '0499000002' (cảnh báo)
```

`Đúng:` = ô không có trong XML, so theo quy tắc kế toán (TK). Không lệch gì → `Khớp XML`. Sheet Loi-dong vẫn giữ (lọc theo loại lỗi). Đầu phiếu đúng là:

| Ô | Đúng là |
|---|---|
| Lý do | `Doanh thu bán hàng` |
| Ký hiệu / Số hóa đơn | theo XML — Ký hiệu = KHHDon (`C26MFD`, số mẫu `1` nằm ô Mã\|Mẫu HĐ như ảnh kế toán 10/11/2026); `1C26MFD` cũng tính đúng |
| Phương thức TT | cùng loại với XML (`CK`/`Chuyển khoản`, `TM`/`Tiền mặt`); tool sửa thì chọn đúng chữ XML nếu ô có mục đó |
| Ghi nợ / Ghi có | CK (công nợ) → `131` / `33311`; TM → `1111` (111x đều đúng) / `33311`. Dòng hàng Có `5111` |
| Số hóa đơn dòng hàng | cột "Số hóa đơn" (sau Tổng tiền) mọi dòng = Số HĐ — **chỉ báo, sửa tay** (2 phiếu mẫu kế toán 13/11/2026) |
| Thanh toán / Còn nợ (góc dưới) | tiền mặt: Thanh toán = Tổng hóa đơn, Còn nợ 0 · chuyển khoản: Thanh toán 0, Còn nợ = Tổng — **chỉ báo, sửa tay** |
| Tick | "Hóa đơn" (sửa tay). **Không kiểm** "Hiển thị thuế suất từng mặt hàng": VietDA không lưu ô này theo phiếu (tick tay + Lưu, mở lại vẫn mất — user thử 10/11/2026) |

Loại thuế đầu phiếu để trống — không kiểm. Mẫu không kiểm.

Sheet **Loi-dong** (mỗi lỗi 1 dòng, Mức Lỗi = đỏ / Cảnh báo = vàng):

| Lỗi | Khi nào |
|---|---|
| Dòng 0 đ | Tiền hàng VietDA = 0, XML ≠ 0 |
| Tổng thanh toán (hàng + thuế) lệch | VietDA ≠ TgTTTBSo — gợi ý chỉnh Tiền hàng ±N đ ở 1 dòng |
| Tiền hàng lệch XML | lệch > 10 đ (`$RoundAdjMax`). Quy tắc kế toán 10/11/2026: tổng chẵn thì **chỉnh tiền hàng, không chỉnh thuế** → lệch ≤ 10 đ + tổng thanh toán khớp = OK; tổng chưa khớp → Cảnh báo |
| Thuế suất / tiền thuế sai | Tiền VAT trên lưới lệch > 1 đ so với Tiền hàng XML × TSuat |
| Loại thuế dòng ≠ XML | chỉ khi phiếu đã tick "Hiển thị thuế suất từng mặt hàng" (mới có cột này) |
| Số lượng lệch XML | XML quy đổi: Lỗi; XML gốc: Cảnh báo |
| XML còn mã KiotViet | XML quy đổi mà MHHDVu không phải HH… / KM… |
| Mã hàng VietDA X ≠ XML Y | VietDA nhận sai mã — gợi ý mã + tên theo danh mục |
| Mã … chưa có trong danh mục VietDA | mã trên phiếu không có trong danh mục |
| ĐVT XML ≠ ĐVT danh mục | Cảnh báo — kiểm hệ số quy đổi |
| Hàng khuyến mãi nhưng mã không phải KM | TChat = 2 hoặc thành tiền 0 |
| Thiếu / Thừa dòng | số dòng khác XML (ghép dòng theo mã + tiền) |
| Tổng tiền hàng / Tổng thuế / Chiết khấu lệch | so TgTCThue / TgTThue / TTCKTMai |
| TK Nợ dòng / TK Có dòng / TK giá vốn | Cảnh báo — Nợ theo PTTT (131 / 111x), Có 511x, GV 632 / 156x |
| Giá vốn 0 | Cảnh báo — kiểm tồn kho / nhập kho mã đó |
| Ngày HĐ / MST lệch | Cảnh báo — ngày HĐ trên phiếu ≠ NLap; MST/CC ≠ MST người mua XML |

| Tham số | Ý nghĩa |
|---|---|
| `-From` / `-To` | khoảng ngày dd/MM/yyyy khi tool tự mở danh sách (mặc định theo XML) |
| `-XmlFolder` | thư mục XML khác `xml\sold` |
| `-Catalog` | file danh mục Vật tư hàng hóa khác |
| `-Limit N` | chỉ đọc N phiếu đầu (chạy thử) |
| `-Fix` | **sửa + Lưu** đầu phiếu (xem "Tự sửa đầu phiếu" dưới) — `Sua-PhieuXH-VietDA.bat` = chạy với `-Fix` |
| `-Yes` | với `-Fix`: không hỏi Y (chạy tự động) |
| `-FromForms <phieu-vietda.json>` | so lại từ phiếu đã đọc, không mở VietDA |
| `-FormTimeoutSec` | chờ phiếu mở / nạp / đóng tối đa (mặc định 60 giây) |
| `-NoOpen` | không mở thư mục kết quả |

Log: `_vietda-xh-check.log`. Phần Win32 / OCR menu / xlsx / click-gõ phím **chép nguyên văn** từ `vietda-bank-import.ps1` (ghi số dòng
nguồn trong script) — sửa bên kia thì xem lại bên này. PowerShell 5.1: `@()` lên `List[object]` tạo bằng `New-Object` lỗi
"Argument types do not match" → code mới dùng `[List[object]]::new()`.
Bản đầu (09/11 sáng) đọc bằng nút Excel của bảng kê — bỏ: Excel không có Mã hàng / TK / Phương thức TT / ô tick.

### Tự sửa đầu phiếu `-Fix` / `Sua-PhieuXH-VietDA.bat` (10/11/2026)

Hỏi **Y** trước khi sửa. Mỗi phiếu đang mở để đọc: tìm XML khớp **hẳn** (Ký hiệu + Số HĐ, hoặc ngày + tiền hàng + thuế + số dòng —
ghép yếu hơn thì chỉ báo, không sửa) → điền các ô sai: Lý do, Ký hiệu, Số hóa đơn, Phương thức TT, Ghi nợ, Ghi có (ô chọn có sẵn
mục đúng chữ → chọn mục; không thì gõ chữ WM_SETTEXT) → bấm vào lưới (rời ô) → bấm **Lưu** → phải có "Lưu dữ liệu thành công !" →
Thoát → mở lại đúng dòng đó (Sửa phiếu, không ↓) đọc kiểm. Cột **Tool đã sửa + Lưu** / **Lỗi khi sửa** trong sheet Phieu.

| VietDA hỏi | Tool làm |
|---|---|
| "Bạn có muốn điền tự động cho cột TK Có và Nợ CK không ?" (sau khi đổi Ghi nợ) | **Yes** (user chốt 10/11/2026) — dòng hàng thành Nợ 131 / Có 5111 |
| thông báo 1 nút | ghi lại + OK |
| hỏi khác nhiều nút / không báo "lưu thành công" / điền xong đọc lại khác | **hủy**: Thoát → "Bạn có muốn lưu dữ liệu không ?" → **No** (phiếu giữ nguyên), ghi "Lỗi khi sửa"; 3 phiếu liền lỗi → dừng |

VietDA chỉ Lưu khi giá trị ô khác lúc mở phiếu ("Dữ liệu không thay đổi !" nếu không). Không sửa dòng hàng (mã, tiền làm tròn) —
vẫn làm tay theo Loi-dong. Đã thử trên data test MINH QUY XH1002/03: TM/1111 → Chuyển khoản/131 (Lưu, mở lại đúng) rồi trả về TM/1111.
