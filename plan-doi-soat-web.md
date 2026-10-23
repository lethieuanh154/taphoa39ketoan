# Plan — Đối soát hóa đơn XML + tờ khai TNCN trên web TapHoa39KeToan

> Trạng thái: **chưa làm** — bắt đầu ở session khác (yêu cầu của user ngày 21/10/2026).
> Đây là plan chi tiết của **bước 1** trong plan tổng `plan-ketoan-flow.md` (tái cấu trúc KeToan theo flow kế toán) —
> đọc plan tổng trước. Route / tên page ở mục 5 dưới đây sẽ theo bố cục mới của plan tổng.
> Bản tham chiếu (logic đã chạy và đối chiếu với số liệu thật): `tools/doi-soat-hoa-don/doi_soat.py` + `tools/doi-soat-hoa-don/README.md`.
> Thay cho hướng "extension tải XML từ cổng thuế" của `plan-gdt-extension.md` (đã hủy, xem mục 0).

## 0. Quyết định của user (21/10/2026)

1. Đưa chức năng đối soát của script `doi_soat.py` vào web TapHoa39KeToan.
2. **Bỏ** các file tờ khai xuất ra: `TK_GTGT_*.xlsx`, `TK_GTGT_*_BAN_NHAP.pdf`, `TK_TNCN_*.xlsx`, `TK_TNCN_*_BAN_NHAP.pdf`. **Bỏ** `ton_dau_ky.xlsx`.
3. Các file Excel còn lại → **mỗi file là 1 page, mỗi sheet là 1 tab**.
4. **Không làm** tải XML từ trang cổng thuế (CQT). Thay bằng **chọn 1 thư mục trên máy** và đọc các file XML hóa đơn đầu vào / đầu ra trong đó.
5. Có chức năng **đọc file bảng lương** (`LUONG SM 2026.xlsx`) và **hiển thị tờ khai TNCN 05/KK-TNCN**.

Bổ sung cùng ngày (xem `plan-ketoan-flow.md` mục 0):
6. KeToan **thay Vietda** → kết quả đối soát (mã master, SL quy đổi) đi thẳng vào kho / hạch toán của KeToan.
7. Thư mục XML do **app FDI** tải hàng loạt; kế toán import **nhiều lần** trong kỳ (ngày / tuần / tháng / quý).
8. Tờ khai: **không xuất file**, chỉ hiện **con số để copy / paste** vào HTKK.

Bổ sung 22/10/2026:
9. Là **chức năng trong mục Tiện ích** của KeToan (`plan-ketoan-flow.md` mục 1). Thao tác: **chọn thư mục XML** đầu vào / đầu
   ra → bấm **Đối soát** → hiện **tất cả các bảng** như các file Excel script đang tạo (file → page / tab, mục 1).

Giữ nguyên từ script: **không sửa file XML gốc**; số liệu tờ khai là bản nháp để đối chiếu, nộp chính thức vẫn qua HTKK / eTax.

## 1. Script → web: file nào thành page nào

| Script tạo ra | Trên web | Ghi chú |
|---|---|---|
| `doi_soat_<ngày>.xlsx` (18 sheet) | Page **Nhập HĐ vào/ra (đối soát)**, 16 tab: Tổng quan · Danh sách sản phẩm · Đối soát theo master · Ngoại lệ · HĐ thay thế - điều chỉnh · Dòng hàng quy đổi · Truy vết HĐ vào · Truy vết chi tiết · Bán dưới giá vốn · Thiếu HĐ vào · Lệch số học HĐ · Thuế theo thuế suất · HĐ đầu vào · HĐ đầu ra · HĐ bỏ qua · File lỗi | Sheet "Huong dan" → khung trợ giúp của từng tab (nội dung lấy từ `REPORT_GUIDE` trong script). Sheet "XML quy doi" bỏ |
| `anh_xa_hang_hoa.xlsx` (Huong dan, Dau vao, Dau ra) | Page **Ánh xạ hàng hóa**, tab Đầu vào / Đầu ra | Bảng **sửa được** 3 cột: Mã master, Hệ số quy đổi, Đã kiểm. Lọc "Cần xem" lên đầu. Sửa xong bấm chạy lại đối soát |
| `BK_MUAVAO_BANRA_<kỳ>.xlsx` (BANRA, MUAVAO) | Page **Bảng kê mua vào / bán ra**, tab BANRA / MUAVAO | **Giả định giữ** (là bảng kê, không phải tờ khai) — xác nhận ở 9a |
| `TK_TNCN_<kỳ>.xlsx` (4 sheet) | File bỏ; **số liệu** hiện ở page **Tờ khai TNCN** (nút copy từng số), tab: Tờ khai 05/KK-TNCN · Theo người · Theo tháng · So sánh tờ khai đã nộp | Đọc từ bảng lương, không cần hóa đơn |
| `TK_GTGT_*.xlsx` / `.pdf` | File bỏ; **số liệu** [21]–[43] + phụ lục 142 hiện ở page **Số liệu khai thuế GTGT** (nút copy), kèm tab so sánh với XML đã nộp | `plan-ketoan-flow.md` mục 2 "Số liệu khai thuế" |
| `ton_dau_ky.xlsx` | **Bỏ** — tồn đầu kỳ lấy từ sổ kho của KeToan (lần đầu: số dư chuyển từ Vietda) | |
| `XML to khai (ban nhap)\*.xml` (định dạng HTKK) | **Bỏ** — kế toán nhập tay vào HTKK | |
| `Dau vao (quy doi)\`, `Dau ra (quy doi)\` (bản sao XML đã quy đổi ĐVT) | **Bỏ** (chỉ dùng để nhập Vietda) — tab "XML quy đổi" cũng bỏ; số quy đổi nằm trong dữ liệu kho | Xác nhận nhẹ với user khi bắt đầu |
| Dòng tiến trình trên console | Thanh tiến trình trên page | Đọc file → phân tích → ghép mã → FIFO → tạo bảng |

## 2. Dữ liệu vào: chọn thư mục trên máy

Thư mục giống thư mục chạy script (xem `tools/doi-soat-hoa-don/README.md` mục 3):

```
<thư mục kế toán chọn>\
├── bang_quy_doi_kiotviet_YYYYMMDD.json   ← bảng quy đổi ĐVT (xuất từ BanHang, nút "Xuất bảng quy đổi"); nhiều file → lấy mới nhất. Web: không bắt buộc — KeToanBackEnd tự lấy từ KiotViet (mục 9i)
├── LUONG SM 2026.xlsx                    ← bảng lương (tên chứa "luong")
├── Dau vao\ ...  Dau ra\ ...             ← XML / ZIP hóa đơn, lồng nhiều tầng được; chiều vào/ra nhận theo MST, không theo tên thư mục
└── (tùy chọn) XML tờ khai HTKK đã nộp    ← 01/GTGT (maTKhai 842), 05/KK-TNCN (maTKhai 864): để so sánh, lấy [22] kỳ trước
```

- Kế toán bấm nút **"Chọn thư mục"** → hiện **cửa sổ chọn thư mục của Windows** → chọn đường dẫn bất kỳ (vd thư mục tháng
  của app FDI) → web đọc mọi XML / ZIP bên trong. Kỹ thuật: `window.showDirectoryPicker()` (Chrome / Edge máy tính) — đọc
  được cả cây thư mục, lưu "handle" vào IndexedDB để lần sau mở lại nhanh (trình duyệt hỏi lại quyền). Dự phòng:
  `<input type="file" webkitdirectory multiple>` (cũng mở cửa sổ chọn thư mục, chỉ đọc).
- Phân loại file như `iter_sources` + `main` bước 1 của script: XML hóa đơn (`HDon`/`DLHDon`), XML tờ khai (`HSoThueDTu` + `maTKhai`), ZIP (giải nén trong trình duyệt, lồng tối đa 3 tầng), còn lại bỏ qua. Bỏ qua các thư mục script tự tạo (`SKIP_DIRS`).
- Thư mục do **app FDI** tải hàng loạt, trên máy kế toán (user xác nhận 22/10/2026):
  `D:\D\TAI HOA DON HANG LOAT\0402318272\T9\0402318272\purchase\xml` (HĐ **mua vào**) và
  `D:\D\TAI HOA DON HANG LOAT\0402318272\T9\0402318272\sold\xml` (HĐ **bán ra**) → cấu trúc
  `<thư mục gốc>\<MST công ty>\T<tháng>\<MST công ty>\{purchase|sold}\xml` (MST lặp 2 lần). Kế toán có thể chọn thư mục gốc
  / MST / tháng — đọc đệ quy; chiều vào/ra **nhận theo MST** trong XML, tên thư mục `purchase` / `sold` chỉ dùng để kiểm tra
  chéo (lệch thì báo). File XML thật để thử: `C:\Users\Hello\Downloads\doi-soat-mau\` (mục 7).
- Import **nhiều lần** trong kỳ: chỉ thêm HĐ mới (khóa `MST người bán | ký hiệu | số`), HĐ đã có thì bỏ qua (báo nếu nội
  dung khác), HĐ thay thế / điều chỉnh mới đến cập nhật trạng thái HĐ liên quan. Bảng quy đổi / bảng lương lấy file mới nhất.
- Khối lượng thật: ~600 HĐ vào + ~20.000 HĐ ra mỗi quý. Script Python xử lý 20.600 file trong ~26 giây. Theo phương án B
  (mục 3): trình duyệt chỉ đọc thư mục, **nén ZIP** (trong Web Worker) và **upload** có thanh tiến trình; KeToanBackEnd phân
  tích. Kiểm đủ file: số file BE nhận phải bằng số file trình duyệt gửi.

## 3. Kiến trúc — **ĐÃ CHỌN B: chạy ở KeToanBackEnd, dùng lại `doi_soat.py`** (user 22/10/2026, mục 9f)

| | A. Trong trình duyệt (bỏ) | B. Gửi lên TapHoa39KeToanBackEnd (Python) — **chọn** |
|---|---|---|
| Cách làm | Chuyển logic Python sang TypeScript thuần (không phụ thuộc Angular), chạy trong Web Worker | Dùng lại hàm của `doi_soat.py` trong FastAPI |
| Dữ liệu hóa đơn | Ở lại trên máy kế toán | Upload hàng trăm MB mỗi quý lên VPS |
| Điều kiện trước | Không | Phải xong M0 (auth BE) trước |
| Rủi ro | Viết lại ~2.000 dòng → phải kiểm bằng "đáp án" của script (mục 7) | Tải VPS, thời gian upload |

Đã chọn **B** (22/10/2026). Lý do: backend KeToan chỉ FastAPI; test bằng dữ liệu 2026 với script làm đáp án → chạy **cùng 1
bản code** là chắc nhất; sửa logic 1 chỗ. Điều kiện: làm sau Pha 0 (đăng nhập + xác thực API, `plan-ketoan-flow.md` mục 2).

Luồng: FE chọn thư mục (`<input webkitdirectory>`, mọi trình duyệt) → nén ZIP + upload kèm bảng lương (nếu có); bảng quy
đổi ĐVT do BE tự lấy từ KiotViet (mục 9i, JSON trong thư mục là dự phòng) → bấm **Đối soát** → BE chạy nền, trả tiến trình → kết quả lưu **tạm trên VPS theo lần chạy** (không đưa > 100.000
dòng vào Firestore) → API trả từng tab có phân trang / lọc → nút xuất Excel dùng lại hàm ghi xlsx của script. File XML upload
**xóa sau khi phân tích** (không lưu XML thô lâu dài). Về sau dữ liệu đã phân tích mới đẩy vào kho / hạch toán
(`plan-ketoan-flow.md` mục 3–4).

Thư viện:
- BE: chỉ cần `openpyxl` (script đã dùng; đọc được cả công thức lẫn giá trị của bảng lương).
- FE: nén ZIP (`fflate`, chạy trong Web Worker). Bảng lớn: BE phân trang → không bắt buộc `@angular/cdk` (KeToan chưa có).

## 4. Tách `doi_soat.py` thành module dùng chung (script CLI + KeToanBackEnd)

Không viết lại sang TypeScript (phương án A đã bỏ). Tách phần tính toán khỏi phần ghi file: 1 hàm kiểu
`run(data_dir, cfg) → kết quả (các bảng)` dùng cho cả CLI lẫn BE; CLI vẫn ghi xlsx như cũ (dự phòng, mục 9h). Bảng dưới là
danh sách hàm cần giữ / đưa ra ngoài (đã viết cho phương án A, vẫn dùng làm bản đồ hàm):

| Module | Hàm trong `doi_soat.py` | Ghi chú quan trọng |
|---|---|---|
| Đọc số / thuế suất / ngày | `parse_num`, `parse_rate`, `parse_date`, `round_half_up`, `norm_text`, `norm_unit`, `norm_code` | `parse_num` giữ dấu âm (parser của BE `TaxInvoiceXMLParser._parse_amount` làm mất dấu — không dùng) |
| Đọc XML hóa đơn | `parse_invoices`, `_parse_dl` | Ngoại tệ nhân tỷ giá; `TTHDLQuan` (TCHDon 1 = thay thế, 2 = điều chỉnh) |
| Đọc XML tờ khai đã nộp | `parse_submitted_gtgt`, `parse_submitted_tncn` | 842 / 864; đếm dòng phụ lục 142 |
| Kiểm số học | `check_arithmetic` | Lệch ≤ \|SL\|×0,5+0,5 do làm tròn đơn giá → **không** tính lỗi |
| Bảng quy đổi KiotViet | `Catalog`, `raw_kiotviet_to_products`, `find_catalog` | Schema `taphoa39-unit-conversion/1`; bỏ hàng xóa / ngừng KD / clone |
| Ghép mã + ĐVT | `unit_keyword`, `kw_same`, `match_unit`, `suggest`, `item_key`, `build_mapping` | Đầu ra ghép theo mã vạch; đầu vào theo tên + ĐVT ("Lốc" ↔ `lốc (4h)`, "Thùng" ↔ `thùng (48h)`, "Kiện 24 bịch" ↔ `24 bịch`). Giữ dòng kế toán đã sửa / đã kiểm khi chạy lại |
| Kỳ + HĐ thay thế / điều chỉnh | `main` bước 3, `resolve_period` | Quy tắc kế toán ở mục 8 |
| Quy đổi + giá vốn + ngoại lệ | `main` bước 5–7 | **Giá vốn = bình quân gia quyền, tính lại sau mỗi lần nhập** (user 21–22/10/2026; hệ quả ở `plan-ketoan-flow.md` mục 2 bước 3), KHÁC script (FIFO) — vì dùng chung code, thêm tùy chọn cách tính giá vốn (bình quân cho web, FIFO giữ cho CLI cũ khi cần so) → tab Đối soát theo master / Bán dưới giá vốn / Lãi gộp tính theo bình quân để khớp sổ sách; phần phân bổ FIFO của script chỉ còn dùng để truy vết "HĐ vào nào đã bán qua HĐ ra nào" (giữ hay bỏ 2 tab Truy vết: hỏi user). Tồn đầu kỳ lấy từ sổ kho KeToan |
| Thuế + bảng kê | `invoice_rate_parts`, `rate_group`, `RA_GROUPS`, `VAO_GROUPS`, `compute_tax`, `pl_nq204_rows`, phần tạo dòng của `write_bk` | Tiền / thuế mỗi HĐ lấy theo bảng tổng hợp thuế suất in trên HĐ (`THTTLTSuat`) |
| Bảng lương + TNCN | `load_payroll`, `_payroll_columns`, `compute_tncn`, `_tncn_how`, phần so sánh trong `export_tncn` | Mục 6 |
| ~~Bản sao XML quy đổi~~, ~~XML tờ khai HTKK~~ | `_convert_xml_bytes`, `write_tk_xml` | **Không chuyển** (bỏ theo quyết định 21/10) |

## 5. Page, route, lưu trữ

Bố cục menu theo `plan-ketoan-flow.md` mục 1: page đối soát nằm trong **Tiện ích** (user 22/10/2026); vị trí page Lương /
Số liệu khai thuế chốt khi làm.
Route theo kiểu đang dùng trong `app.routes.ts` (`*-page`); tên đề xuất, chốt khi làm:

| Route | Page | Tab |
|---|---|---|
| `invoice-reconciliation-page` | Nhập HĐ vào/ra (đối soát) — nút chọn thư mục, import, tiến trình | 16 tab ở mục 1 |
| `item-mapping-page` | Ánh xạ hàng hóa (sửa được) | Đầu vào · Đầu ra |
| `purchase-sales-listing-page` | Bảng kê mua vào / bán ra | BANRA · MUAVAO |
| `vat-figures-page` | Số liệu khai thuế GTGT (copy / paste vào HTKK) | Tờ khai 01/GTGT · Phụ lục 142 · So sánh XML đã nộp |
| `pit-declaration-page` | Số liệu tờ khai TNCN từ bảng lương (copy / paste) | Tờ khai · Theo người · Theo tháng · So sánh |

- Sidebar (`layouts/main-layout`): mục **Tiện ích** → "Đối soát hóa đơn XML".
- `pit-page` + `PITService` đang có dùng mức giảm trừ **cũ** (11.000.000 / 4.400.000). Năm 2026 bảng lương dùng 15.500.000 / 6.200.000 (cột "Giảm trừ gia cảnh"). Page TNCN mới lấy số từ bảng lương, **không** dùng hằng số trong `PITService`.
- Lưu: **bảng ánh xạ kế toán đã sửa** → server (Firestore project kế toán, lâu dài, dùng lại cho các lần chạy sau); kết quả
  mỗi lần đối soát → lưu tạm trên VPS theo lần chạy (mục 3). Không lưu XML thô.
- Mỗi tab (bắt buộc, user 21/10/2026): bảng **phân trang**, lọc, sắp xếp, tìm kiếm + nút **xuất Excel / CSV theo bộ lọc
  đang chọn** (lọc / phân trang / xuất làm ở BE; Excel dùng `openpyxl`).

## 6. Tờ khai TNCN từ bảng lương (đã chạy đúng trong script)

- File: mỗi tháng 1 khối, có dòng `Tháng MM/YYYY`, ngay dưới là dòng tiêu đề (`Họ và tên`, `Tổng lương thực tế`, nhóm `Bảo hiểm NLĐ` → cột `Cộng`, `Thưởng`, `Giảm trừ gia cảnh`, `Thu nhập tính thuế`, `Thuế TNCN`, `Tạm ứng`, `Thực lĩnh`). Tìm cột **theo tên tiêu đề**, không theo chữ cột. Tên công ty / MST / địa chỉ lấy ở đầu sheet.
- **[21] = [22]** = Σ các tháng (Tổng lương thực tế + Thưởng − BH bắt buộc phần NLĐ). Thưởng chỉ cộng thêm khi công thức ô "Tổng lương thực tế" **chưa** gồm cột Thưởng (tháng 04/2026: 2 × 2.500.000 nằm ngoài tổng). Ô không có công thức → so tổng các cột thành phần.
- **[16]**: người có lương > 0. Q2 đã nộp đếm **cả quý** (8), Q3 đã nộp đếm **tháng cuối quý** (12; cả quý là 14) → để lựa chọn trên page, mặc định "cả quý". **[17]** = [16] trừ người không ký HĐLĐ ≥ 3 tháng (danh sách kế toán chọn).
- **[18]/[19]** số người có Thuế TNCN > 0; **[26]/[27]** thu nhập chịu thuế của các tháng đó; **[29]/[30]** Σ Thuế TNCN; các chỉ tiêu không cư trú / bảo hiểm nhân thọ / dầu khí = 0.
- Kỳ: quý của dữ liệu hóa đơn nếu bảng lương có; không thì quý gần nhất có lương; cho kế toán chọn quý.
- Có XML 05/KK-TNCN đã nộp cùng kỳ → tab So sánh (khớp / lệch làm tròn ≤ 5 / LỆCH; chỉ tiêu số người so chính xác).
- Hiện ghi chú cho kế toán: [21] đang trừ BH bắt buộc (theo luật đó là khoản giảm trừ khi tính thu nhập *tính* thuế); người lương khoán không ký HĐLĐ ≥ 3 tháng mà nhận từ 2.000.000 đ/lần → khấu trừ 10% (trừ khi có cam kết 08/CK-TNCN).

## 7. Kiểm chứng (bắt buộc trước khi giao)

- Dùng `doi_soat.py` làm **đáp án**: chạy script và web trên cùng 1 thư mục, so từng tab với sheet tương ứng (số HĐ, tổng tiền, số dòng, từng chỉ tiêu). Ngoại lệ: các số liên quan giá vốn (script FIFO, web bình quân) — kiểm bằng tính tay trên vài mã. Nên thêm vào script 1 cờ xuất JSON kết quả để viết unit test tự động cho các module ở mục 4.
- Phương án B (dùng chung code): việc kiểm chính là **(1)** tách module xong thì CLI vẫn ra file xlsx **giống hệt** bản trước khi tách; **(2)** upload đủ file (số file / tổng dung lượng khớp); **(3)** phần giá vốn bình quân mới.
- Bộ dữ liệu có sẵn (KHÔNG đưa vào repo — dữ liệu thật, repo public):
  - `C:\Users\Hello\Downloads\doi-soat-mau\`: bảng quy đổi KiotViet thật (9.056 mã), 2 HĐ ra thật có chữ ký số, 61 HĐ ra + 1 HĐ vào giả lập dùng ĐVT thật, kỳ Q4/2026.
  - `C:\Users\Hello\Downloads\LUONG SM 2026.xlsx` (tháng 1–9) + XML tờ khai đã nộp Q3/2026: `0402318272000-01_GTGT_TT80-Q32026-L00.xml`, `0402318272000-05_KK_TNCN_TT80-Q32026-L00.xml`; PDF TNCN Q2, Q3.
- Số phải ra (TNCN): Q2 đếm cả quý → [16] = 8, [21] = 138.225.000; Q3 đếm tháng cuối → [16] = 12, [21] = 162.946.540; Q3 đếm cả quý → [16] = 14.
- Số GTGT Q3/2026 đã nộp (kiểm khi có đủ XML thật của quý): [22] 30.542.593 · [23] 2.889.413.001 · [24] 257.132.330 · [30]/[31] 6.997.174 / 349.826 · [32]/[33] 2.105.145.275 / 179.257.424 · [32a] 2.180.000 · [34]/[35] 2.114.322.449 / 179.607.250 · [36] −77.525.080 · [41] = [43] 108.067.673 · PL142 I 1.538.600.494 / 123.328.294 (1.622 dòng) · II 1.562.844.748 / 31.256.903 (2.369 dòng) · [09] −92.071.391.

## 8. Quy tắc nghiệp vụ của kế toán (giữ nguyên khi chuyển)

- Không có dòng thuế suất 8% trên tờ khai: hàng giảm 10% → 8% kê ở [32]/[33] (thuế tính 8%), chi tiết ở phụ lục 142 (NQ 204/2025/QH15). Thuế suất bình thường chỉ 10 / 5 / 0 / KCT / KKKNT.
- HĐ **thay thế** tính vào kỳ của HĐ **gốc**: lập kỳ này thay HĐ kỳ trước → TRỪ; lập kỳ sau thay HĐ kỳ này → CỘNG. HĐ bị thay thế không tính.
- HĐ **điều chỉnh** tính vào kỳ lập, cộng/trừ theo dấu. (Còn chờ kế toán xác nhận: đầu vào có áp dụng y hệt không.)
- [22] = [43] tờ khai kỳ trước (lấy từ XML kỳ trước nếu có).
- HĐ đã hủy không nhận ra được từ XML → kế toán bỏ file khỏi thư mục.

## 9. Quyết định còn mở (hỏi user khi bắt đầu)

Đã có câu trả lời (21/10/2026, xem `plan-ketoan-flow.md` mục 0):
- ~~b~~ Tờ khai GTGT: không xuất file, **hiện số liệu để copy / paste** (page `vat-figures-page`).
- ~~c~~ XML tờ khai HTKK: **bỏ**. Bản sao XML quy đổi: **bỏ** (suy ra từ "thay Vietda" — xác nhận nhẹ khi bắt đầu).
- ~~d~~ Tồn đầu kỳ: lấy từ **sổ kho của KeToan** (lần đầu = số dư chuyển từ Vietda).
- ~~e~~ Lưu: **server** (dữ liệu kế toán lâu dài) + IndexedDB làm bộ nhớ đệm.
- ~~a~~ Bảng kê mua vào / bán ra, phụ lục 142: **page / tab dạng bảng có phân trang** + xuất Excel / CSV theo bộ lọc; không
  cần file theo mẫu HTKK.

Còn mở:
f. ~~Kiến trúc~~ — **user chọn B 22/10/2026** (mục 3). Phân tích lúc chọn:
   - Quyết định 8 (backend chỉ FastAPI) và 13 (test bằng dữ liệu 2026, số của script / Vietda là đáp án) của
     `plan-ketoan-flow.md` nghiêng về B: KeToanBackEnd gọi thẳng các hàm của `doi_soat.py` (3.384 dòng, chỉ dùng thư viện
     chuẩn + `openpyxl`) → **cùng 1 bản code** với script, không phải viết lại sang TypeScript rồi kiểm lại từng số; nút xuất
     Excel dùng lại hàm ghi xlsx của script.
   - Upload: trình duyệt nén thư mục thành ZIP rồi gửi. HĐ thật có chữ ký số ~5 KB/file → ~20.600 HĐ/quý ≈ 100 MB thô; XML
     nén ZIP thường còn vài chục MB hoặc ít hơn (ước lượng, chưa đo); làm theo tháng thì nhỏ hơn ~3 lần.
   - Điều kiện: xong Pha 0 (đăng nhập + xác thực API) trước, vì dữ liệu HĐ của công ty lên server. Kết quả mỗi lần chạy lưu
     tạm trên VPS (không đưa > 100.000 dòng vào Firestore), API trả từng tab có phân trang.
   - A vẫn hợp nếu muốn dữ liệu HĐ **không rời máy kế toán** — đổi lại phải viết lại logic sang TS và kiểm bằng script (mục 7).
g. ~~Trình duyệt~~ — không cần hỏi nữa: theo B chỉ cần chọn thư mục để upload (`<input webkitdirectory>` chạy trên mọi trình
   duyệt hiện nay).
h. ~~Script còn dùng không~~ — theo B script và BE dùng chung module → script **giữ**, vẫn chạy như cũ làm dự phòng / đáp án.
i. ~~Bảng quy đổi ĐVT~~ — rà BanHang "Xuất bảng quy đổi" 22/10/2026: nút ở `edit-product-page` gọi Flask
   `GET /api/kiotviet/unit-conversion` (`TapHoa39BackEnd/routes/kiotviet_routes.py`), dữ liệu **chỉ lấy từ API KiotViet**
   (`FromKiotViet/get_entire_product.py` `get_all()` → `api-kvsync1.kiotviet.vn/api/resource/fetch`, ~20.000 mã, 30–60 giây;
   `_build_unit_conversion()` bỏ hàng xóa / ngừng KD, tìm master theo `MasterUnitId`, hệ số `ConversionValue`; `isClone` ghi
   cứng `False` — không dùng Firestore của BanHang). → **KeToanBackEnd tự lấy** bằng module KiotViet (quyết định 11
   `plan-ketoan-flow.md`), cùng schema `taphoa39-unit-conversion/1`: cache, nút "Cập nhật bảng quy đổi", nút tải JSON (thay
   "Xuất bảng quy đổi" của BanHang cho kế toán). File JSON để trong thư mục upload chỉ là **dự phòng** (và CLI vẫn đọc như cũ).
j. ~~Mẫu thư mục app FDI~~ — đã có cấu trúc đầy đủ cả đầu vào / đầu ra (mục 2, 22/10/2026).
k. **Nút "Xuất danh mục mẫu Vietda" — TẠM THỜI** (user 22/10/2026; bỏ khi KeToan thay hẳn Vietda): từ bảng quy đổi KiotViet
   (mục 9i) xuất Excel đúng mẫu `QUYDOI.xlsx` (danh mục vật tư - hàng hóa của Vietda) để nhập vào Vietda.
   - Mẫu (rà 22/10/2026): tiêu đề `DANH MỤC VẬT TƯ - HÀNG HÓA` (A3), dòng tiêu đề cột ở dòng 5: STT · Mã hàng · Tên hàng hóa -
     vật tư · ĐVT · ĐVT Quy đổi · Hệ số · Nhóm hàng · Ngành · Lĩnh vực; dòng 6 = ký hiệu A–I; dữ liệu từ dòng 7; cuối có "Ngày …
     / Người lập biểu". 2.890 dòng, mã toàn `HHxxxx` (kế toán tự đặt, **không mã nào trùng mã KiotViet**), Hệ số luôn 1, ĐVT quy
     đổi / Nhóm / Ngành / Lĩnh vực trống → mỗi mã 1 dòng ở **ĐVT nhỏ nhất**.
   - Dữ liệu KiotViet (bảng 21/10/2026): 9.056 dòng ĐVT → **5.576 mã master** (ĐVT nhỏ nhất); 52 tên master trùng nhau (123
     mã, vd cùng sản phẩm 2–3 mã vạch) → phải gộp; 2.121 tên master trùng đúng tên trong Vietda (tên Vietda phần lớn lấy từ
     KiotViet).
   - **Bản mẫu user đã duyệt: `C:\Users\Hello\Downloads\QUYDOI_master_v3.xlsx`** (22/10/2026), tạo bằng script
     `quydoi_master.py` (195 dòng) — **hiện chỉ nằm trong thư mục tạm của 1 phiên Claude**
     (`%TEMP%\claude\e--TapHoa39-Gemini\48b6f407-…\scratchpad\tools\quydoi_master.py`), chưa có trong repo → phải chép vào
     `tools/doi-soat-hoa-don/` trước khi thư mục tạm bị dọn. Chạy: `python quydoi_master.py <doi_soat.py> <QUYDOI.xlsx>
     <bang_quy_doi_kiotviet.json> <file ra.xlsx>`; dùng lại `Catalog`, `norm_text`, `norm_unit`, `match_unit`, `base_name` của
     `doi_soat.py` → hợp với kiến trúc B (module dùng chung).
   - Cách làm của script: **giữ mã HH**, chỉ xử lý danh mục Vietda đang có (không thêm hàng mới của KiotViet). Ghép tên mã HH →
     mã master KiotViet (tên trùng đúng → bỏ nhãn `[..]` → tên gốc bỏ quy cách; các thuộc tính cùng "hàng cùng loại" KiotViet,
     cùng ĐVT nhỏ nhất + hệ số → 1 sản phẩm). Mỗi sản phẩm: giữ mã ở **ĐVT nhỏ nhất**; chưa có thì giữ mã hệ số nhỏ nhất và
     **đổi ĐVT** (sheet `Doi DVT`, ghi "tồn kho × hệ số"); mã ở ĐVT lớn hơn **xóa** (sheet `Da xoa`, ghi "chuyển tồn kho sang mã
     giữ lại × hệ số"); nhiều mã cùng ở ĐVT nhỏ nhất → **giữ hết**, kế toán chọn (sheet `Trung ma DVT master`); tên / ĐVT không
     nhận ra → **giữ nguyên, không đoán** (sheet `Can xem`, có gợi ý gần nhất). Ghi đè lên chính workbook Vietda (giữ bố cục,
     ô đổi ĐVT tô vàng, đánh lại STT).
   - Kết quả v3: 2.890 → **2.866 mã** (xóa 24, đổi ĐVT 48, 29 sản phẩm trùng mã ở ĐVT nhỏ nhất, 456 dòng cần xem).
   - Trên KeToan: kế toán **upload `QUYDOI.xlsx` mới nhất xuất từ Vietda** → KeToanBackEnd chạy logic `quydoi_master` với bảng
     quy đổi tự lấy từ KiotViet (mục 9i) → tải file kết quả. Nút đặt cạnh "Cập nhật bảng quy đổi".
   - **User chốt 22/10/2026:**
     1. **Thêm hàng KiotViet chưa có trong Vietda** (mã master đang kinh doanh, chưa ghép được với mã HH nào; ước lượng
        ~3.200 mã). Mã mới theo kiểu kế toán đặt tay **"HH + số"**: rà `QUYDOI.xlsx` 22/10/2026 — dãy chính liên tục đến
        **HH3211** (3–4 chữ số, không số 0 ở đầu); ngoại lệ `HH20163`, `HH25555` (có thể gõ nhầm), `HHH2301`, 109 mã có số 0 ở
        đầu (`HH00007`, `HH0008`…; `HH007` và `HH00007` là 2 mã khác nhau → so mã theo chuỗi). → Số mới = số lớn nhất của dãy
        chính (mã `HH` + 3–4 chữ số, không số 0 ở đầu) + 1, không đệm số 0 (vd `HH3212`, `HH3213`…); bỏ qua mã ngoại lệ, và
        kiểm mã sinh ra chưa có trong file. Thứ tự cấp: theo Id KiotViet tăng dần (hàng tạo trước cấp trước) → chạy lại cho cùng
        kết quả. Dòng mới: Tên = `fullName` KiotViet bỏ "(ĐVT)" ở cuối, ĐVT = ĐVT master, Hệ số 1; chèn **trước** dòng "Ngày …
        / Người lập biểu", đánh lại STT. Mã HH tính từ file upload → phải upload `QUYDOI.xlsx` mới nhất ngay trước khi xuất, và
        nhập vào Vietda trước khi kế toán tự đặt thêm mã.
        Tránh trùng: hàng KiotViet có tên **gần giống** một mã Vietda chưa ghép được (loại "Can xem" của v3) → **không** tự cấp
        mã, hiện trên màn hình để kế toán xem.
     2. **File kết quả chỉ có sheet danh mục** — bỏ 4 sheet phụ (`Da xoa`, `Doi DVT`, `Trung ma DVT master`, `Can xem`); các
        sheet đó chỉ dùng cho lần ghép đầu (bản v3). Màn hình hiện tóm tắt: số mã giữ / xóa / đổi ĐVT / thêm mới / cần xem.

## 10. Thứ tự làm đề xuất (mỗi bước: build + test; không sửa FE và BE trong cùng 1 bước)

Theo phương án B (22/10/2026). Điều kiện trước: Pha 0 xong (`plan-ketoan-flow.md` mục 2).

| Bước | Nội dung |
|---|---|
| 1 | (Script) Tách `doi_soat.py`: hàm tính trả kết quả, phần ghi file tách riêng. Kiểm: CLI ra xlsx giống hệt bản trước khi tách — **XONG 22/10/2026**: `read_xml` → `reconcile` → `summary_rows` / `report_sheets` (17 sheet = 16 tab + Hướng dẫn) / `write_report`; `tax_figures`, `tncn_figures` (danh sách hàm: `tools/doi-soat-hoa-don/README.md` mục 9b). So 3 lần chạy trên `Downloads\doi-soat-mau` (lần đầu / chạy lại có ánh xạ / có tờ khai đã nộp): mọi file xlsx, xml, pdf + log giống hệt bản trước. Gọi kiểu module không ghi file nào. Vẫn 1 file (CLI bấm đúp trong thư mục dữ liệu) |
| 2 | (BE) Bảng quy đổi ĐVT tự lấy từ KiotViet (mục 9i; cần module KiotViet — `plan-ketoan-flow.md` mục 4). Endpoint upload ZIP + chạy đối soát nền (tiến trình) + lưu kết quả theo lần chạy + API từng tab (phân trang / lọc) + xuất xlsx — **XONG 22/10/2026**: API ở `TapHoa39KeToanBackEnd/docs/RECONCILIATION.md`; `doi_soat.py` chép sang `app/vendor/` (mirror giống hệt). User 22/10: web **bỏ 2 tab Truy vết** (FIFO), **tạm giữ** tab + ZIP "XML quy đổi". Test 37/37 (mọi tab giống từng ô Excel của CLI), KiotViet thật OK |
| 3 | (FE) Page Tiện ích "Đối soát hóa đơn XML": chọn thư mục → nén + upload → **Đối soát** → các tab ở mục 1 (Tổng quan, HĐ đầu vào / ra, Ngoại lệ…) — **XONG 23/10/2026** (code + build; chưa thử trên trình duyệt với đăng nhập thật): `components/invoice-reconciliation-page/`, `services/reconciliation.service.ts`, bảng dùng chung `shared/server-table`; nén bằng `fflate` (đã thử: ZIP fflate → BE đọc đúng tên tiếng Việt, kết quả như CLI). Kỳ = thanh chọn kỳ (hoặc tự nhận quý). Việc nhỏ còn lại (BE): sửa câu cảnh báo của script nhắc "CONFIG" cho hợp web |
| 4 | Page Ánh xạ hàng hóa sửa được (BE lưu Firestore kế toán) → chạy lại đối soát giữ dòng đã sửa — **XONG 23/10/2026**: `item-mapping-page` + BE `PUT /runs/{id}/mapping`, `POST /runs/{id}/rerun` (chạy lại từ dữ liệu đã phân tích, không giữ XML), `GET /catalog/search`; Firestore `reconciliation_item_mappings` (chỉ dòng đã sửa / đã kiểm). Câu cảnh báo nhắc CONFIG đã đổi cho web. Test BE 28/28 + 37/37, E2E Edge 18/18. Còn: nhập hàng loạt `anh_xa_hang_hoa.xlsx` cũ lên máy chủ |
| 5 | Giá vốn bình quân sau mỗi lần nhập (tùy chọn trong module, CLI vẫn chạy FIFO khi cần so); page Bảng kê, Số liệu khai thuế GTGT (copy / paste), Số liệu TNCN từ bảng lương — **XONG 23/10/2026**: `phuong_phap_gia_von` (CLI fifo giống hệt bản cũ, web binh_quan — test tính tay), page `tax-figures-page` (mục cuối Tiện ích), BE tab bảng kê / PL142 + `bang-ke` + `POST /tncn`; TNCN Q3/2026 khớp tờ khai đã nộp |
| Sau | "Đối soát CK" và "Xuất bảng quy đổi" của BanHang lên KeToan — xem `plan-gdt-extension.md` mục 13 |

Mỗi bước: cập nhật `docs/` (ROUTES, COMPONENTS, SERVICES, STATUS) theo quy tắc docs của repo.
