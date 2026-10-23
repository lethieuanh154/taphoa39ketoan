# Đối soát + quy đổi đơn vị hóa đơn đầu vào – đầu ra (file XML)

Script 1 `doi_soat.py` chạy **trên máy kế toán**, không gửi dữ liệu đi đâu, **không sửa file XML gốc**.
Đọc toàn bộ XML hóa đơn (đầu vào + đầu ra, kể cả .zip) → ghép từng mặt hàng với **mã master KiotViet**
→ quy đổi số lượng 2 bên về **ĐVT nhỏ nhất (master)** → đối soát nhập–xuất → xuất file Excel.

Ví dụ: vào 1 thùng sữa chua (48 hộp); ra bán theo hộp / lốc (4) / nửa thùng (24) / thùng (48) → tất cả quy về **hộp**.

Script 2 (xuất file nhập liệu Vietda): **hủy** (21/10/2026) — TapHoa39KeToan sẽ thay Vietda; chức năng của script này
sẽ chuyển vào web KeToan (`TapHoa39KeToan/plan-ketoan-flow.md`, `plan-doi-soat-web.md`). Script vẫn dùng được đến khi web xong.

## 1. Cài Python (1 lần)

1. https://www.python.org/downloads/ → **Download Python 3.x** (Windows).
2. Chạy file cài, **tích "Add python.exe to PATH"** → **Install Now**.
3. Lần chạy đầu cần mạng (script tự cài thư viện Excel `openpyxl`).

## 2. Lấy bảng quy đổi từ TapHoa39BanHang (mỗi kỳ 1 lần, hoặc khi có hàng mới)

TapHoa39BanHang → **Quản lý hàng hóa** → nút **"Xuất bảng quy đổi"** (lấy thẳng từ KiotViet qua BE, ~1 phút)
→ tải về `bang_quy_doi_kiotviet_YYYYMMDD.json`. File chứa mọi mã hàng **đang kinh doanh** + ĐVT master + hệ số (`ConversionValue`).
Không cần mở file này. Script cũng đọc được file dữ liệu gốc KiotViet `kiotvietproducts*.json` (từ `/api/kiotviet/items/all`)
— tự bỏ hàng ngừng kinh doanh. Có nhiều file thì script lấy file **mới nhất**.

## 3. Chuẩn bị thư mục

```
D:\DoiSoat Q3-2026\                    ← thư mục gốc (tên tùy ý)
├── doi_soat.py
├── bang_quy_doi_kiotviet_20261020.json ← từ bước 2 (có nhiều file thì lấy file mới nhất)
├── LUONG SM 2026.xlsx                 ← (tùy chọn) bảng lương → tờ khai TNCN (mục 8b)
├── QUYDOI.xlsx                        ← (tùy chọn) danh mục vật tư - hàng hóa xuất từ Vietda → mã hàng kế toán (mục 7b)
├── Dau vao\                           ← XML / ZIP hóa đơn mua vào
├── Dau ra\                            ← XML / ZIP hóa đơn bán ra
└── To khai\                           ← (tùy chọn) XML tờ khai HTKK đã nộp, để kiểm chứng: GTGT kỳ trước / cùng kỳ, TNCN cùng kỳ
```

- Tên thư mục con tùy ý, có thể lồng nhiều tầng, để nguyên file .zip. Script tự biết vào/ra theo MST công ty.
- **Bỏ XML của hóa đơn đã bị HỦY** ra khỏi thư mục (XML không ghi trạng thái hủy).

## 4. Chạy

Bấm đúp `doi_soat.py`. Kết quả nằm ngay trong thư mục gốc:

| File | Dùng để |
|---|---|
| `doi_soat_<ngày_giờ>.xlsx` | **Báo cáo** — mỗi lần chạy 1 file mới |
| `anh_xa_hang_hoa.xlsx` | Kế toán kiểm các dòng "Cần xem" (mục 5) |
| `ton_dau_ky.xlsx` | (Tùy chọn) tồn đầu kỳ theo mã master |
| `Dau vao (quy doi)\`, `Dau ra (quy doi)\` | **Bản sao XML hóa đơn đã quy đổi ĐVT** về ĐVT master (mục 7b) — thư mục `Dau vao`/`Dau ra` gốc giữ nguyên |

## 5. Cách máy ghép mặt hàng — kế toán chỉ xem dòng "Cần xem"

| Chiều | Cách ghép | Hệ số |
|---|---|---|
| **Đầu ra** | Mã hàng trên HĐ (mã vạch) = mã KiotViet → **chính xác** | `ConversionValue` của mã đó (hộp 1, lốc 4, thùng 48…) |
| **Đầu vào** | Tên hàng NCC ↔ tên KiotViet (bỏ phần quy cách), rồi chọn ĐVT trên HĐ trong các ĐVT KiotViet của mặt hàng | ① trùng tên ĐVT; ② cùng từ khóa — "Lốc" ↔ `lốc (4h)`, "Thùng" ↔ `thùng (48h)` (ưu tiên ĐVT không có số đứng trước); ③ số trong tên hàng ("kiện 24 bịch") trùng hệ số 1 ĐVT KiotViet (`24 bịch`) → gắn cờ; không có → đọc số trong tên, gắn cờ |

File `anh_xa_hang_hoa.xlsx` (sheet `Dau vao`, `Dau ra`) — sửa **các cột tô vàng**:
- **Mã master**: mã KiotViet của ĐVT nhỏ nhất. Hàng không có trên KiotViet → tự đặt mã (vd `NB-KHANGIAY`).
- **Hệ số quy đổi**: 1 ĐVT trên HĐ = bao nhiêu ĐVT master.
- **Mã Vietda** (khi có `QUYDOI.xlsx`): mã hàng kế toán tự đặt trong Vietda — dùng cho bản sao XML (mục 7b).
- **Đã kiểm**: đánh `x` = kế toán xác nhận dòng này đúng.

Cột **Bản sao XML** (máy điền, không sửa) cho biết dòng hàng đó sẽ được sửa thế nào trong bản sao XML (mục 7b).
File ánh xạ của bản script cũ (ít cột hơn) vẫn dùng được — các cột mới được thêm, phần đã sửa giữ nguyên.

Dòng **Cần xem** nằm trên cùng. Sửa xong → đóng Excel → chạy lại. Dòng đã sửa tay (hoặc đánh `x` cột "Đã kiểm")
được giữ ở các lần chạy sau; dòng máy tự ghép được cập nhật lại nếu bảng quy đổi mới hơn.

## 6. Tồn đầu kỳ (nên điền)

Không có tồn đầu kỳ thì hàng bán đầu quý (nhập từ quý trước) bị báo "bán vượt". `ton_dau_ky.xlsx`: điền
**SL tồn đầu kỳ (theo ĐVT master)** và **đơn giá vốn chưa thuế** cho mã có tồn. Để trống = 0.

## 7. Đọc báo cáo

Sheet đầu tiên **`Huong dan`** trong file báo cáo giải thích mục đích, cách đọc cột và việc cần làm của từng sheet + thuật ngữ.

| Sheet | Nội dung |
|---|---|
| `Huong dan` | Giải thích từng sheet, thứ tự nên xem, thuật ngữ (ĐVT master, hệ số, FIFO…) |
| `Tong quan` | Số file, HĐ, số mặt hàng theo cách ghép, tổng ngoại lệ |
| `Danh sach san pham` | **Danh sách mặt hàng vào + ra đã ghép mã master, hệ số, tổng SL quy đổi** |
| `Doi soat theo master` | Mỗi mã master: nhập vs xuất (ĐVT master), giá nhập/bán BQ, giá vốn FIFO, lãi, tồn, bán vượt |
| `Ngoai le` | **Xem đầu tiên** — mọi vấn đề, Cao → Thấp |
| `HD thay the - dieu chinh` | HĐ thay thế / điều chỉnh / bị thay thế: ngày HĐ gốc, ngày tính kỳ, có tính vào kỳ này không (TRỪ/CỘNG) |
| `Dong hang quy doi` | Từng dòng của từng HĐ + SL/đơn giá quy về ĐVT master (nguồn để lọc / Pivot) |
| `XML quy doi` | Nhật ký bản sao XML đã quy đổi (mục 7b): từng dòng hàng đã sửa, cũ → mới; dòng chưa sửa được + lý do |
| `Truy vet HD vao` / `Truy vet chi tiet` | Mỗi dòng mua vào → bán qua những HĐ ra nào |
| `Ban duoi gia von`, `Thieu HD vao` | Chi tiết bán dưới giá vốn / bán khi chưa đủ HĐ vào |
| `Lech so hoc HD` | Sai số học thật (thuế ≠ tiền × thuế suất, tổng ≠ cộng dòng, **bắt cả lệch 1đ**) |
| `Thue theo thue suat` | Tổng chưa thuế / thuế theo thuế suất, vào và ra — đối chiếu tờ khai |
| `HD dau vao`, `HD dau ra`, `HD bo qua`, `File loi` | Danh sách HĐ, HĐ không liên quan, file trùng/lỗi |

- **Lệch do làm tròn đơn giá** (đơn giá in trên HĐ đã làm tròn, thành tiền tính từ giá chưa làm tròn — vd 2 × 31.481 = 62.962
  nhưng HĐ ghi 62.963) **không tính là lỗi**, chỉ đếm ở `Tong quan` và cột "Dòng làm tròn ĐG".
- Giá vốn FIFO, tiền chưa thuế, đã trừ chiết khấu thương mại; HĐ thay thế bỏ HĐ bị thay thế; hàng khuyến mại vẫn tính SL.

## 7b. Bản sao XML đã quy đổi ĐVT (thay việc sửa tay XML)

Mỗi lần chạy, script tạo lại 2 thư mục **`Dau vao (quy doi)`** và **`Dau ra (quy doi)`** chứa bản sao của MỌI file XML hóa
đơn vào/ra (file trong ZIP được lấy ra thành file riêng, tên `<tên zip>__<tên file>.xml`). Thư mục và file gốc **không đổi
1 byte**. Console hiện tiến trình: `Sửa XML quy đổi [#####-----] 5.000/20.600 (24%) · đã sửa 1.400 file · <tên file>`.

Trong bản sao, mỗi dòng hàng (hàng hóa / khuyến mại) được sửa theo dòng tương ứng trong `anh_xa_hang_hoa.xlsx`:

| Thẻ | Sửa thành | Ví dụ: 2 Thùng × 300.000 (hệ số 48) |
|---|---|---|
| `SLuong` | SL × hệ số | 96 |
| `DGia` | Đơn giá ÷ hệ số (tối đa 6 số lẻ) | 6250 |
| `DVTinh` | ĐVT master | hộp |
| `MHHDVu` | **Mã Vietda**; chưa có → Mã master (tắt: `xml_quy_doi_doi_ma = False`) | HH2056 |
| `THHDVu` | Tên Vietda / Tên master (tắt: `xml_quy_doi_doi_ten = False`) | [SCA Vinamilk] Sữa chua Nha đam Vinamilk 100g |

**Chỉ sửa dòng có ánh xạ CHẮC CHẮN** (`xml_quy_doi_chi_khi_chac_chan = True`) — cột **Bản sao XML** trong file ánh xạ:

| Bản sao XML | Khi nào |
|---|---|
| `Đổi ĐVT + mã Vietda` / `Đổi ĐVT + mã master` | Mã master ghép **đúng theo mã vạch** (HĐ ra) không có cờ, hoặc kế toán đã sửa / đánh `x` |
| `Chỉ đổi mã Vietda` (… quy đổi ĐVT chờ xác nhận) | Mã Vietda chắc chắn nhưng Mã master / Hệ số mới là gợi ý theo tên → chưa đổi SL / ĐG / ĐVT |
| `Giữ nguyên — kiểm rồi đánh x` | Chỉ có gợi ý theo tên gần giống / có cờ "Cần xem" → dòng giữ nguyên trong bản sao |

Mã Vietda **chắc chắn** khi: tên trên HĐ **trùng đúng** tên trong `QUYDOI.xlsx` (1 mã duy nhất); hoặc **theo mã master** (mã
Vietda mà các dòng cùng mã master có tên trùng đúng đang dùng, hay tên KiotViet của mã master trùng tên Vietda) khi chính
Mã master của dòng đã chắc chắn; hoặc kế toán sửa / đánh `x`. Gợi ý theo tên gần giống, tên trùng nhiều mã Vietda, ĐVT
Vietda khác ĐVT sau quy đổi → cờ "Cần xem", chưa đổi. Kế toán kiểm 1 lần + đánh `x` → các lần chạy sau tự đổi.

- **Không đổi**: thành tiền, chiết khấu, thuế suất, tiền thuế, tổng tiền, thông tin người bán/mua, chữ ký… — script chỉ thay
  đúng các thẻ trên trong dòng hàng, phần còn lại của file giữ nguyên từng ký tự.
- Dòng đã ở **mã + ĐVT master** (hệ số 1) giữ nguyên; HĐ không có dòng nào cần sửa → bản sao **giống hệt** file gốc.
- File có sửa được ghi thêm 1 dòng chú thích `<!-- Bản QUY ĐỔI ĐVT … KHÔNG phải hóa đơn gốc … -->` ngay đầu file.
  Chữ ký số của người bán không còn khớp nội dung → bản sao **chỉ dùng tổng hợp nội bộ**, không gửi đi như hóa đơn.
- Dòng giữ nguyên (chưa có ánh xạ / chưa chắc chắn) đều ghi ở sheet `XML quy doi` kèm lý do.
- Nhật ký từng dòng đã sửa (cũ → mới): sheet **`XML quy doi`** trong `doi_soat_*.xlsx`.
- Bản sao của lần chạy trước bị **xóa và tạo lại** → đừng sửa tay trong 2 thư mục này. Script không đọc 2 thư mục này
  khi đối soát. HĐ trùng (cùng số HĐ ở 2 file) và HĐ không liên quan MST công ty không được sao.

## 8. Bảng kê mua vào/bán ra + tờ khai GTGT (bản nháp đối chiếu)

Mỗi lần chạy xuất thêm vào thư mục gốc (ghi đè bản cũ cùng kỳ):

| File | Nội dung |
|---|---|
| `BK_MUAVAO_BANRA_Q3-2026.xlsx` | Sheet **BANRA** (mẫu 01-1/GTGT): 1 dòng = 1 HĐ ra × 1 thuế suất, 11 nhóm (KCT, KKKNT, 0%, 5%, 5% giảm 30%, 7%, 8%, 10%, 10% giảm 30%, 20%, khác) + tổng nhóm (công thức SUM) + tổng chung. Sheet **MUAVAO** (mẫu 01-1/HT): 1 dòng = 1 HĐ vào × 1 thuế suất (HĐ nhiều thuế suất được TÁCH dòng), cuối sheet có [22] và thuế phải nộp |
| `TK_GTGT_Q3-2026.xlsx` | Sheet **To khai 01-GTGT** (chỉ tiêu [21]–[43] + ghi chú TRỪ/CỘNG HĐ thay thế) + sheet **PL142 NQ204** (I. mua vào 8%, II. bán ra được giảm, III. [09]=[08]−[06]) + sheet **So sanh to khai da nop** (khi có XML tờ khai cùng kỳ) |
| `TK_GTGT_Q3-2026_BAN_NHAP.pdf` | Tờ khai + phụ lục dạng in, có chữ chìm **BẢN NHÁP** — để đối chiếu với HTKK, KHÔNG dùng để nộp |
| `XML to khai (ban nhap)\0402318272000-01_GTGT_TT80-Q32026-L00.xml` | Tờ khai 01/GTGT + phụ lục 142 dạng **XML theo định dạng HTKK** (xem mục 8c) |

**Kỳ tính thuế & HĐ thay thế / điều chỉnh** (theo hướng dẫn kế toán):
- Kỳ = quý có nhiều HĐ nhất (hoặc `tu_ngay`/`den_ngay`). HĐ ngoài kỳ không tính → có thể chép cả XML đầu kỳ sau vào thư mục.
- **HĐ THAY THẾ tính vào kỳ của HĐ GỐC** (ngày HĐ gốc lấy từ XML, thẻ `NLHDCLQuan`):
  lập trong kỳ này để thay HĐ kỳ trước → **TRỪ** khỏi kỳ này; lập ở kỳ sau để thay HĐ kỳ này → **CỘNG** vào kỳ này
  (nhớ chép XML HĐ thay thế lập đầu kỳ sau vào thư mục). HĐ bị thay thế không tính.
- **HĐ ĐIỀU CHỈNH** tính vào kỳ lập HĐ điều chỉnh, cộng/trừ theo dấu số tiền trên XML.
- Danh sách kiểm: sheet **`HD thay the - dieu chinh`** (file doi_soat_*.xlsx); tổng TRỪ/CỘNG ghi dưới tờ khai.

**Không có dòng thuế suất 8%** trên tờ khai: hàng được giảm 10% → 8% kê ở [32]/[33] (thuế tính theo 8%), chi tiết ở
**phụ lục 142** (XML HTKK: `PL_NQ142_GTGT`, nay theo NQ 204/2025/QH15). Sắc thuế bình thường chỉ có 10 / 5 / 0 / KCT / KKKNT.

**Tự lấy [22] và so với tờ khai đã nộp**: chép file XML tờ khai HTKK (vd `0402318272000-01_GTGT_TT80-Q22026-L00.xml`)
vào thư mục (thư mục con tùy ý):
- XML tờ khai **kỳ trước** → [22] = [43] kỳ trước (nếu CONFIG để 0).
- XML tờ khai **cùng kỳ** đã nộp → sheet **`So sanh to khai da nop`** trong TK_GTGT_*.xlsx: từng chỉ tiêu [22]–[43] + tổng/số dòng phụ lục 142,
  "Khớp" / "Lệch làm tròn" / "LỆCH".

Cách tính:
- Tiền/thuế từng HĐ theo **bảng tổng hợp thuế suất in trên HĐ** (`THTTLTSuat`) — đúng số người bán đã khai.
- [23]/[24] = mọi HĐ vào được tính (kể cả dòng KCT/KKKNT); [25] = [24] (coi toàn bộ thuế đầu vào được khấu trừ).
- [26] KCT · [29] 0% · [30]/[31] 5% · **[32]/[33] = 10% + 8%** (hàng giảm thuế kê ở dòng 10%, chi tiết ở phụ lục) · [32a] KKKNT.
- [36]=[35]−[25]; [40a]/[41]/[43] theo công thức trên mẫu; [37] [38] [39a] [40b] [42] = 0 (điều chỉnh tay nếu có).
- Phụ lục: cộng dòng hàng thuế suất 8% theo `Mã hàng - Tên hàng`; thuế mục I = giá trị × 8%, mục II = giá trị × 2% (làm tròn từng dòng).
Cần làm trước khi chạy: [22] — chép XML tờ khai kỳ trước vào thư mục, hoặc điền **`thue_con_khau_tru_ky_truoc_22`**
(Q3/2026 là `30542593`); điền `nguoi_ky` ở CONFIG.

Khác với bảng kê kế toán làm tay: cột "Ghi chú" để trống (số chứng từ NH…/XH… nằm trong phần mềm kế toán); MUAVAO mặc định
mọi HĐ thuộc nhóm "dùng riêng" (chuyển nhóm tay nếu cần); HĐ đã HỦY phải bỏ file XML trước khi chạy.

**Kiểm chứng**: chạy trên XML của kỳ đã khai → so với tờ khai/bảng kê đã nộp; lệch vài đồng do làm tròn là bình thường.

## 8b. Tờ khai TNCN 05/KK-TNCN (bản nháp, từ bảng lương)

Tờ khai TNCN không lấy được từ hóa đơn — script đọc **file bảng lương Excel** đặt ở thư mục gốc (tên có chữ `luong`,
vd `LUONG SM 2026.xlsx`; không có file này thì bỏ qua bước TNCN). **Chỉ cần file bảng lương** là xuất được tờ khai TNCN —
không có hóa đơn / bảng quy đổi thì script bỏ qua phần GTGT, vẫn xuất TNCN.

Kỳ TNCN: cùng quý với tờ khai GTGT nếu bảng lương có tháng của quý đó; nếu chưa có (vd HĐ quý 4 nhưng lương mới tới tháng 9)
→ lấy **quý gần nhất có lương** (in cảnh báo). Kỳ đặt cứng bằng `tu_ngay`/`den_ngay` thì không tự đổi.

| File | Nội dung |
|---|---|
| `TK_TNCN_Q3-2026.xlsx` | Sheet **To khai 05-KK-TNCN** (chỉ tiêu [16]–[32] + cột "Cách tính" + ghi chú) · **Theo nguoi** (mỗi NV: các tháng có lương, có tính vào [16]/[17] không, tổng lương, BH NLĐ, thu nhập chịu thuế, thuế TNCN) · **Theo thang** (từng dòng NV-tháng, kèm ô gốc `sheet!dòng`) · **So sanh to khai da nop** (khi có XML tờ khai TNCN cùng kỳ) |
| `TK_TNCN_Q3-2026_BAN_NHAP.pdf` | Tờ khai dạng in theo mẫu 05/KK-TNCN, chữ chìm **BẢN NHÁP** — KHÔNG dùng để nộp |
| `XML to khai (ban nhap)\0402318272000-05_KK_TNCN_TT80-Q32026-L00.xml` | Tờ khai 05/KK-TNCN dạng **XML theo định dạng HTKK** (xem mục 8c) |

Bảng lương cần: mỗi tháng 1 khối có dòng **`Tháng MM/YYYY`**, ngay dưới là dòng tiêu đề có **`Họ và tên`**,
**`Tổng lương thực tế`**, nhóm **`Bảo hiểm NLĐ`** (cột `Cộng`), **`Thưởng`**, **`Thuế TNCN`** (script tìm theo tên cột,
không theo chữ cột A/B/C). Các khối có thể nằm chung 1 sheet hay mỗi tháng 1 sheet.

Cách tính (giống tờ khai đã nộp Q2 và Q3/2026):
- **[21] = [22]** = Σ 3 tháng (**Tổng lương thực tế + Thưởng − BH bắt buộc phần NLĐ**). Thưởng chỉ cộng thêm khi công thức
  ô "Tổng lương thực tế" chưa gồm cột Thưởng (vd tháng 04/2026 thưởng 2 × 2.500.000 nằm ngoài tổng).
- **[16]** số người có lương (người lương = 0, vd GĐ chỉ đóng BH, không tính). Q2 đã khai = số người **cả quý** (8),
  Q3 đã khai = số người **tháng 9** (12; cả quý là 14) → chọn ở `tncn_dem_so_nguoi`. Mặc định `ca_quy`.
- **[17]** = [16] trừ người ghi ở `tncn_khong_hdld` (không ký HĐLĐ từ 3 tháng trở lên).
- **[18]/[19]** số người có Thuế TNCN > 0; **[26]/[27]** thu nhập chịu thuế của các tháng đó; **[29]/[30]** = Σ Thuế TNCN.
- Không cư trú, bảo hiểm nhân thọ, dầu khí ([20] [23] [24] [25] [25.1] [28] [31] [32]) = 0.

Lưu ý cho kế toán:
- Theo luật, BH bắt buộc là khoản **giảm trừ** khi tính thu nhập *tính thuế*; nếu muốn [21] là thu nhập chịu thuế trước giảm
  trừ thì đặt `tncn_tru_bh_nld = False`.
- NV lương khoán theo ngày không ký HĐLĐ từ 3 tháng trở lên: khoản trả từ **2.000.000 đ/lần** phải khấu trừ 10%
  (trừ khi có cam kết 08/CK-TNCN).
- **XML tờ khai TNCN đã nộp là TÙY CHỌN** (không cần để xuất tờ khai): chỉ dùng để **kiểm chứng** — đặt XML của quý đã khai
  (`…-05_KK_TNCN_TT80-Q32026-L00.xml`, ở thư mục gốc hay thư mục con đều được) → sheet so sánh từng chỉ tiêu; điện thoại,
  email, người ký trên bản nháp cũng lấy từ XML này (không có XML thì lấy tên/MST/địa chỉ ở đầu bảng lương).

## 8c. XML tờ khai (định dạng HTKK)

Script ghi XML 01/GTGT (mã 842, kèm phụ lục 142) và 05/KK-TNCN (mã 864) vào thư mục con **`XML to khai (ban nhap)`**,
tên file theo kiểu HTKK (`<MST>000-01_GTGT_TT80-Q32026-L00.xml`). Script **không đọc lại** thư mục này (không nhầm với
tờ khai đã nộp ở lần chạy sau).

- Khung thẻ, thứ tự thẻ, BOM, xuống dòng giống hệt XML do HTKK 5.8.1 xuất (01/GTGT bản 2.8.3, 05/KK-TNCN bản 2.9.3).
- Mã CQT nơi nộp, ngành nghề, thông tin NNT, người ký lấy từ **XML tờ khai cùng loại đã nộp** có trong thư mục (kỳ nào
  cũng được). Không có → để trống các thẻ đó (script in cảnh báo) — nên luôn để XML tờ khai kỳ trước trong thư mục.
- Khác file HTKK: thẻ `ttinNhaCCapDVu` để TRỐNG (mã HTKK tự sinh cho từng file, script không tạo được); `ngayLapTKhai`,
  `ngayKy` = ngày chạy script; `loaiTKhai` = C (chính thức), lần 0.
- Số liệu là **bản nháp script tính** — kế toán kiểm trước khi ký/nộp. Chưa kiểm chứng việc HTKK / eTax có nhận file này
  hay không: thử 1 lần trước khi dùng thật.
- Chỉ xuất khi kỳ là 1 quý trọn vẹn.

## 9. Thông số (đầu file `doi_soat.py`, mục CẤU HÌNH)

| Thông số | Mặc định | Ý nghĩa |
|---|---|---|
| `mst_cong_ty` | tự nhận | Ghi MST nếu tự nhận sai |
| `tu_ngay`, `den_ngay` | trống | Chỉ tính HĐ trong khoảng ngày (`"2026-07-01"`) |
| `sai_so_tien` | 0.5 | Lệch tiền lớn hơn mức này thì báo |
| `nguong_tin_cay_goi_y` | 0.6 | Ghép theo tên đạt mức này thì tự điền mã master |
| `so_ngay_hd_vao_lap_sau` | 0 | Cho phép HĐ vào lập sau ngày bán bao nhiêu ngày |
| `nguong_duoi_gia_von_phan_tram` | 0 | Bán thấp hơn giá vốn quá bao nhiêu % thì báo |
| `phuong_phap_gia_von` | `fifo` | `fifo` = nhập trước xuất trước (2 sheet Truy vết); `binh_quan` = bình quân gia quyền tính lại sau MỖI lần nhập (KeToan web dùng — không có truy vết lô). Không ảnh hưởng số thuế |
| `xuat_bang_ke_to_khai` / `xuat_pdf_ban_nhap` | True | Bật/tắt xuất bảng kê + tờ khai / file PDF |
| `thue_con_khau_tru_ky_truoc_22` | 0 | Chỉ tiêu [22] = [43] tờ khai kỳ trước |
| `ky_tinh_thue` | tự nhận | Vd `"Quý 3 năm 2026"` |
| `nguoi_ky` | trống | Họ tên in ở chữ ký bảng kê / tờ khai (TNCN: trống thì lấy người ký trong XML đã nộp) |
| `xuat_to_khai_tncn` | True | Bật/tắt tờ khai TNCN |
| `file_bang_luong` | `["*luong*.xlsx"]` | Tên file bảng lương (nhiều file thì lấy file mới nhất có tháng thuộc kỳ) |
| `tncn_dem_so_nguoi` | `"ca_quy"` | [16]: `"ca_quy"` = mọi người có lương trong quý; `"thang_cuoi"` = chỉ người có lương tháng cuối quý |
| `tncn_tru_bh_nld` | True | [21] trừ BH bắt buộc phần NLĐ |
| `tncn_khong_hdld` | `[]` | Họ tên NV không ký HĐLĐ ≥ 3 tháng, vd `["Nguyễn Quý Nhất"]` → không tính vào [17] |
| `xuat_xml_to_khai` | True | Bật/tắt xuất XML tờ khai GTGT + TNCN (mục 8c) |
| `xuat_xml_quy_doi` | True | Bật/tắt tạo bản sao XML đã quy đổi ĐVT (mục 7b) |
| `xml_quy_doi_doi_ma` / `xml_quy_doi_doi_ten` | True | Trong bản sao, đổi mã / tên hàng sang mã / tên Vietda (không có thì master) |
| `xml_quy_doi_chi_khi_chac_chan` | True | Chỉ sửa dòng có ánh xạ chắc chắn (cột "Bản sao XML"); False = sửa cả dòng gợi ý chưa kiểm |
| `file_danh_muc_vietda` | `["QUYDOI*.xlsx"]` | Danh mục vật tư - hàng hóa xuất từ Vietda (cột Mã hàng, Tên hàng, ĐVT) |

Lần đầu xuất PDF script tự cài thư viện `reportlab` (cần mạng); PDF dùng font Times New Roman có sẵn trong Windows.

## 9b. Dùng như module (cho lập trình — KeToanBackEnd)

Từ 22/10/2026 phần tính tách khỏi phần ghi file; `main()` (CLI) chỉ ghép các hàm dưới đây và ghi file như trước (đã so: kết
quả xlsx / xml / pdf + log **giống hệt** bản trước khi tách, 3 lần chạy trên `Downloads\doi-soat-mau`). Các hàm tính **không
ghi file**:

| Hàm | Vào → ra |
|---|---|
| `read_xml(sources)` | các cặp `(tên, bytes)` (vd `iter_sources(thư_mục)`) → `{invoices, read_errors, skipped, n_files, submitted_gtgt, submitted_tncn}` |
| `reconcile(invoices, cat, cfg, company="", existing=None, opening=None, vd=None)` | bước 2–7 (chiều, trùng / thay thế / kỳ, số học, ghép mã, quy đổi + FIFO, ngoại lệ) → dict các bảng (`mapping`, `nxt_rows`, `exceptions`, `period`…). `existing` = ánh xạ đã sửa (dạng `load_mapping`), `opening` = tồn đầu kỳ, `vd` = `VietdaCatalog` |
| `summary_rows(res, read, cfg, data_dir, cat_label, clone_stats)` | dòng sheet "Tong quan" |
| `report_sheets(res, read, summary, clone_rows=None)` | danh sách `Sheet(title, headers, rows, widths, formats, wrap)` đúng thứ tự file `doi_soat_*.xlsx` — web dùng làm các tab; `clone_rows=None` bỏ sheet "XML quy doi" |
| `write_report(path, sheets)` | ghi xlsx |
| `tax_figures(active, cfg, d_from, submitted_gtgt)` | số liệu 01/GTGT + PL 142 + so sánh tờ khai đã nộp (`export_tax_files` ghi file từ đây) |
| `tncn_figures(paths, cfg, period, company, submitted_tncn)` | số liệu 05/KK-TNCN từ bảng lương, hoặc `None` (`export_tncn` ghi file từ đây) |

Sửa logic đối soát: sửa trong các hàm trên (dùng chung CLI + web), không sửa riêng `main()`.

## 10. Lỗi thường gặp

- **"Thiếu bảng quy đổi"**: chưa chép file `bang_quy_doi_kiotviet_*.json` vào thư mục gốc (mục 2).
- **"… là bản cũ (khác cột)"**: file ánh xạ / tồn đầu kỳ của script bản 1 → xóa đi, chạy lại.
- **"Không ghi được … đóng file Excel"**: đang mở file đó → đóng, chạy lại.
- **Cảnh báo .xlsm / ~$cache1**: máy có thể nhiễm virus macro Excel — đừng bật macro, báo người hỗ trợ.
- **"Bảng lương … không có tháng nào thuộc kỳ"**: thiếu dòng `Tháng MM/YYYY` trên mỗi khối lương, hoặc sai năm/quý.
- **"mọi ô Tổng lương thực tế đều trống"**: file lương được tạo bằng công cụ khác Excel → mở bằng Excel, bấm Lưu, chạy lại.
