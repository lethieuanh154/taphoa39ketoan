# Plan — Đồng bộ hóa đơn GDT qua Extension → Firestore → KeToan → Hạch toán & Khai thuế

> **21/10/2026 — ĐÃ HỦY phần lấy XML từ cổng thuế (extension, mục 1–5, pha P1–P5).** User quyết định không làm tải XML
> từ trang CQT; thay bằng đọc XML hóa đơn từ **thư mục trên máy** → xem **`plan-doi-soat-web.md`** (plan đang dùng).
> Mục 6–8 (hạch toán, quyết toán, AI) chỉ còn là ý tưởng tham khảo; mục 13 cập nhật bên dưới.
>
> Lập ngày 2026-10-15. Trạng thái: **KẾ HOẠCH, CHƯA CODE.**
> Liên quan: `TapHoa39KeToanBackEnd/docs/INVOICE-EMAIL-PIPELINE.md` (pipeline hóa đơn email, M0 bảo mật);
> `plan.md` (02/06/2026 — "Hóa Đơn Đầu Vào End-to-End"). Plan này **thay thế** phần "KeToan login HDDT Portal (captcha) → fetch GDT → `tax_invoices`" trong `plan.md` (A.3, D.2, PHẦN C) vì GDT đã chặn cách đó; phần Gmail/AI/`internal_invoices` của `plan.md` giữ nguyên.

---

## 0. Bối cảnh & nguyên tắc bắt buộc

**Vì sao cần plan này:** từ 10/2026 cổng `hoadondientu.gdt.gov.vn` chặn mọi request không phát sinh từ chính giao diện web của họ
(403 `"Hệ thống phát hiện hành vi không hợp lệ. Yêu cầu đã bị chặn."`, chặn **trước** khi kiểm tra token).
Toàn bộ proxy `/api/hddt/*` của KeToan BE (login, purchase, sold, detail) không dùng được nữa, kể cả với token dán tay.

**Cách đã chốt — "Cách B: extension chỉ NGHE":**

| Extension LÀM | Extension KHÔNG BAO GIỜ làm |
|---|---|
| Đọc (read-only) phản hồi mà trang thuế **tự tải** khi user bấm Tìm kiếm / lật trang / xem chi tiết / Xuất XML | Tự gọi API GDT, tự bấm, tự lật trang, tự điền form trên trang thuế |
| Gom, lọc trùng, kiểm tra đủ/thiếu, chuyển sang KeToan | Đọc token/cookie đăng nhập GDT, sửa header/request, giải captcha |
| Chỉ có quyền trên domain thuế + domain KeToan | Gọi bất kỳ server nào khác (không analytics, không banner, không CDN) |

Lý do: mọi request tới GDT đều là thao tác thật của user → không vượt cơ chế chống tự động của GDT, không rủi ro khóa tài khoản MST.

**Điều chỉnh so với yêu cầu ban đầu (và lý do):**

| Yêu cầu | Thực hiện trong plan | Lý do |
|---|---|---|
| Chọn loại HĐ + khoảng ngày trong extension rồi "load" | Popup extension = **phiên thu thập**: user chọn chiều (đầu vào/đầu ra), loại HĐ, khoảng ngày → extension hiển thị **checklist các lượt tìm cần làm trên trang thuế** và theo dõi đã đủ chưa. User vẫn tự bấm Tìm kiếm trên trang thuế. | Extension tự query = Cách A (đã loại) |
| Định dạng JSON (mặc định) | JSON = dữ liệu thu được từ phản hồi danh sách + chi tiết | Không đổi |
| Định dạng XML | Thu được khi user bấm **"Xuất XML"** trên trang thuế (extension nghe phản hồi đó) | Tải XML hàng loạt = gọi API tự động |
| Định dạng Excel | Extension xuất file Excel **từ dữ liệu đã thu** (cục bộ, không gọi GDT) | Không cần gọi GDT |
| Định dạng PDF | **KeToan** in PDF (bảng kê, tờ khai, chứng từ) từ dữ liệu đã lưu | GDT không có PDF chính thức, chỉ có trang xem HTML; PDF tự dựng ≠ chứng từ gốc |
| Extension lưu Firestore → gửi API BE → FE | Extension → **tab KeToan** → FE gọi BE (có xác thực) → **BE ghi Firestore** → FE ghi IndexedDB | Extension không được giữ credential Firebase/BE; mọi ghi dữ liệu kế toán phải qua BE có auth |

---

## 1. Luồng dữ liệu đích

```
 hoadondientu.gdt.gov.vn (user tự đăng nhập, tự tìm)
        │  phản hồi XHR/fetch của chính trang thuế
        ▼
 [Extension] gdt-hook (MAIN, read-only) → gdt-relay → background
        │  gom + lọc trùng + kiểm tra đủ/thiếu (chrome.storage.local)
        │  popup: "Gửi sang KeToan"
        ▼
 [Extension] ketoan-relay (content script trên ketoan.songminhcr.com)
        │  window.postMessage (kiểm tra origin + marker + schema)
        ▼
 [KeToan FE] trang /gdt-sync: xem trước, so khác biệt → bấm "Lưu"
        │  POST /api/gdt-invoices/batch  (header X-Id-Token — M0)
        ▼
 [KeToan BE] validate (Pydantic) → upsert Firestore `gdt_invoices` + `gdt_sync_batches`
        │  trả summary {created, updated, unchanged, needsReview}
        ▼
 [KeToan FE] GET /api/gdt-invoices?updatedSince=… → IndexedDB `TapHoa39HddtDB`
        ▼
 Trang đối chiếu (ledger-8/9), HĐ đầu vào/đầu ra, hạch toán, tờ khai, quyết toán
```

Nguồn sự thật (source of truth) = **Firestore**. IndexedDB chỉ là cache trên trình duyệt.

---

## 2. Mô hình dữ liệu (Firestore project `songminhketoan-15041989`, ghi bằng Admin SDK ở BE)

### 2.0 Hiện trạng `tax_invoices` và lý do tách collection riêng
Hiện có `tax_invoices` (project `taphoa39-supplies-invoices`, dùng chung với BanHang), ghi qua `POST /api/v2/invoices/batch` (`source=TAX_PORTAL`, `invoice_service.batch_import_invoices`). Bộ đối chiếu `/api/v2/invoices/reconciliation/*` đọc `tax_invoices` ↔ `internal_invoices`.

| Hạn chế của `tax_invoices` | Ảnh hưởng |
|---|---|
| Chỉ **tạo mới**, trùng `invoiceKey` → bỏ qua | HĐ về sau bị thay thế/điều chỉnh/hủy (`tthai` đổi) **không được cập nhật** → sai khi hạch toán, khai thuế |
| Chỉ HĐ mua vào (`sellerTaxCode`) | Không có HĐ bán ra cho tờ khai GTGT |
| Ít trường, không giữ JSON gốc, không có kỳ (`period`), không có trạng thái kế toán | Không đủ cho hạch toán/quyết toán |
| Nằm ở project chung với BanHang | Dữ liệu kế toán nên thuộc project kế toán |

→ Tạo collection riêng `gdt_invoices` ở project kế toán (theo yêu cầu). **Chuyển tiếp:**
1. P3: BE ghi `gdt_invoices`; `tax_invoices` thôi nhận dữ liệu mới (giữ đọc).
2. P4: bộ đối chiếu chuyển nguồn HĐ thuế từ `tax_invoices` sang `gdt_invoices` (`direction = in`); `internal_invoices` giữ nguyên.
3. Script 1 lần: chép `tax_invoices` cũ sang `gdt_invoices` (`sources: ['legacy_tax_invoices']`, thiếu `raw` → chờ lần thu kế tiếp bổ sung). Chạy ổn → gỡ `TAX_PORTAL` khỏi `/api/v2/invoices/batch`.

### 2.1 `gdt_invoices/{docId}`
`docId = {dir}_{nbmst}_{khmshdon}{khhdon}_{shdon}` — vd `in_0402114198_1C26TAN_74`
(`dir` = `in` đầu vào | `out` đầu ra). Trùng khóa chống trùng của pipeline email (MST người bán + ký hiệu + số) → nối được 2 nguồn.

| Nhóm | Trường | Ghi chú |
|---|---|---|
| Định danh | `direction`, `khmshdon`, `khhdon`, `symbolFull`, `shdon`, `gdtId` | `gdtId` = trường `id` GDT trả về |
| Bên bán/mua | `nbmst`, `nbten`, `nmmst`, `nmten` | |
| Thời gian | `tdlap` (ISO gốc), `invoiceDate` (yyyy-MM-dd, giờ VN), `period: {year, quarter, month}` | `period` để truy vấn theo kỳ khai |
| Tiền | `tgtcthue`, `tgtthue`, `tgtttbso`, `dvtte`, `vatBreakdown[]` (từ `thttltsuat`: thuế suất, tiền chưa thuế, tiền thuế) | |
| Trạng thái GDT | `tthai`, `tchat`, `ttxly`, `category` | `category` suy từ `tthai`: 1 `goc`, 2 `thay_the`, 3 `dieu_chinh`, 4 `bi_thay_the`, 5 `bi_dieu_chinh`, 6 `huy` |
| Liên kết | `refOriginal` (HĐ gốc của HĐ thay thế/điều chỉnh) | **Tên trường GDT cần xác nhận** bằng mẫu dữ liệu chi tiết (P1) |
| Nguồn | `sources[]` ∈ `gdt_list`, `gdt_detail`, `gdt_xml`, `email_xml`; `hasDetail`, `hasXml` | |
| Gốc | `raw.list`, `raw.detail` | Giữ nguyên JSON GDT để parse lại khi đổi logic |
| Theo dõi | `firstCapturedAt`, `lastCapturedAt`, `captureBatchIds[]`, `contentHash`, `statusHistory[]` | `statusHistory` ghi mỗi lần `tthai` đổi (vd 1 → 4 khi về sau bị thay thế) |
| Kế toán | `accounting: {status, voucherIds[], postedAt, postedPeriod}` | `status`: `NEW` → `REVIEWED` → `POSTED` / `EXCLUDED` |
| Mở rộng | `ext: {}` | Chỗ cho tự động/AI (mục 8), không phá schema |

**Quy tắc upsert ở BE:**
- Không bao giờ xóa; dữ liệu mới **bổ sung**, không làm mất `detail`/`xml`/`accounting` đã có.
- `tthai` đổi trên HĐ đã `POSTED` → đặt `accounting.status = NEEDS_REVIEW` + ghi `statusHistory` (HĐ đã hạch toán vừa bị thay thế/điều chỉnh/hủy).
- `contentHash` không đổi → `unchanged`, không ghi (tiết kiệm write Firestore).

### 2.2 `gdt_sync_batches/{batchId}`
Ai gửi, lúc nào, chiều, khoảng ngày, các lượt tìm đã thu (biến thể `ttxly`), `gdtTotal` vs `captured`, kết quả upsert, phiên bản extension.

### 2.3 `gdt_invoice_xml/{docId}`
XML gốc (khi user bấm Xuất XML trên trang thuế) + kết quả parse bằng `TaxInvoiceXMLParser` (BE đã có). Tách collection để doc chính nhẹ.
**Quyết định mở:** XML > ~900KB → Firebase Storage thay vì Firestore.

---

## 3. Extension — `TapHoa39KeToan/extension/` (Manifest V3, cài "Load unpacked", KHÔNG đưa lên Web Store)

### 3.1 Thành phần
| File | Vai trò |
|---|---|
| `manifest.json` | `permissions: ["storage", "downloads"]`; `host_permissions`: `https://hoadondientu.gdt.gov.vn/*`, `https://ketoan.songminhcr.com/*`, `http://localhost:4200/*` (dev). Không host nào khác. |
| `gdt-hook.js` | Content script `world: "MAIN"`, `run_at: document_start`. Bọc `XMLHttpRequest`/`fetch` **chỉ để đọc phản hồi** của: `/api/query/invoices/{purchase,sold,detail}`, `/api/sco-query/invoices/{purchase,sold,detail}`, phản hồi Xuất XML. Không sửa request/header, không đọc `Authorization`/cookie. |
| `gdt-relay.js` | Content script (ISOLATED) trên trang thuế: nhận `window.postMessage` từ hook (kiểm tra `source === window` + marker) → `chrome.runtime.sendMessage`. |
| `background.js` | Service worker: quản lý phiên, gom dữ liệu vào `chrome.storage.local`, lọc trùng theo `docId`, tính đủ/thiếu. |
| `popup.html/js` | Giao diện phiên thu thập (3.2). |
| `ketoan-relay.js` | Content script trên domain KeToan: chuyển payload vào trang bằng `window.postMessage(…, location.origin)`, nhận xác nhận đã lưu. |
| `lib/xlsx.full.min.js` | SheetJS đóng gói sẵn (không tải CDN) — chỉ để xuất Excel cục bộ. |

### 3.2 Popup — phiên thu thập
1. **Chiều:** Đầu vào (mua vào) / Đầu ra (bán ra).
2. **Loại HĐ:** Tất cả (mặc định, khuyến nghị cho kế toán) / Gốc / Thay thế / Điều chỉnh / Bị thay thế / Bị điều chỉnh / Hủy — lọc theo `tthai` trên dữ liệu đã thu.
3. **Khoảng ngày:** từ – đến (giống trang thuế). Kỳ dài (quý/năm) → extension chia thành nhiều lượt tìm nếu GDT giới hạn khoảng ngày mỗi lần (**giới hạn cần xác nhận ở P1**).
4. **Checklist lượt tìm cần làm trên trang thuế**, mỗi dòng: biến thể (vd đầu vào: `ttxly==5` đã cấp mã, `ttxly==6`, `ttxly==8` máy tính tiền — **danh sách biến thể xác nhận ở P1**) × khoảng ngày → trạng thái ✅ đủ / ⚠️ thiếu trang (`đã nhận 120/134`) / ⬜ chưa tìm.
   Extension biết user đã tìm gì nhờ parse tham số `search` của request (vd `tdlap=ge=…;tdlap=le=…;ttxly==5`) và `total` trong phản hồi.
5. **Định dạng:** JSON (mặc định, luôn có) · Excel (xuất từ dữ liệu đã thu) · XML (chỉ những HĐ user đã bấm Xuất XML; hiển thị số lượng).
6. Nút: **Gửi sang KeToan** · **Tải file** (JSON/Excel) · **Xóa phiên**.
7. Sau khi KeToan xác nhận lưu thành công → hỏi xóa dữ liệu tạm trong extension (dữ liệu thuế không nằm lâu trong trình duyệt).

### 3.3 Thao tác của user (một kỳ)
1. Đăng nhập trang thuế (tự giải captcha).
2. Mở popup → chọn phiên (vd Đầu vào, Tất cả, 01/07–30/09/2026).
3. Trên trang thuế làm lần lượt các lượt tìm trong checklist, lật hết trang (chọn số dòng/trang lớn nhất để ít lần bấm).
4. (Tùy chọn) mở chi tiết / Xuất XML các HĐ cần dòng hàng.
5. Checklist toàn ✅ → **Gửi sang KeToan**.

---

## 4. Backend — `TapHoa39KeToanBackEnd` (FastAPI)

**Điều kiện tiên quyết: M0 (auth) phải xong trước khi mở endpoint ghi** — xem `INVOICE-EMAIL-PIPELINE.md` §8. Endpoint ghi dữ liệu kế toán không được chạy khi chưa xác thực.

Router mới `app/routes/gdt_invoice_routes.py`, prefix `/api/gdt-invoices`, dependency `get_current_user` (M0):

| Endpoint | Mô tả |
|---|---|
| `POST /batch` | `{batch: {...meta}, invoices: [...]}` ≤ 500 HĐ/request → upsert `gdt_invoices`, ghi `gdt_sync_batches`, trả summary |
| `POST /details` | Gắn dữ liệu chi tiết (dòng hàng) vào HĐ đã có |
| `POST /xml` | Nhận XML (base64) → lưu `gdt_invoice_xml` + parse `TaxInvoiceXMLParser` → đánh dấu `hasXml` |
| `GET ` | `?direction&from&to&category&updatedSince&pageToken` — FE đồng bộ IndexedDB |
| `GET /stats` | `?year&quarter` — tổng số, tổng tiền, thuế theo thuế suất, theo `category` |
| `GET /batches` | Lịch sử đồng bộ |

- Pydantic model cho payload; giới hạn kích thước; **không log nội dung hóa đơn** (quy tắc pipeline doc).
- Firestore composite index: `(direction, invoiceDate)`, `(direction, period.year, period.quarter)`, `(updatedAt)`.
- Sau khi FE chuyển xong (P4): đánh dấu deprecated rồi gỡ proxy `/api/hddt/*` (bước BE riêng).

---

## 5. Frontend — `TapHoa39KeToan` (Angular 19)

| Hạng mục | Nội dung |
|---|---|
| `services/gdt-bridge.service.ts` | Nghe `window.message`: chỉ nhận khi `event.source === window`, `event.origin === location.origin`, có marker `TAPHOA39_GDT_BRIDGE`, schema hợp lệ, giới hạn kích thước. |
| `services/gdt-invoice-api.service.ts` | Gọi `/api/gdt-invoices/*` (chia lô 500), đồng bộ BE → IndexedDB theo `updatedSince`. |
| Trang mới `accountant-pages/gdt-sync` | Nhận payload → bảng xem trước (mới / đã có / thay đổi trạng thái / cần xem lại) → **Lưu** → kết quả + lịch sử batch. |
| `hddt-cache.service.ts` | Tái dùng `TapHoa39HddtDB` (`purchase_invoices`, `sold_invoices`, `*_details`) với đúng shape GDT → `ledger-8/9`, trang HĐ đầu vào/ra chạy tiếp không sửa nhiều. Thêm metadata `lastSyncedAt` mỗi chiều. |
| `hddt.service.ts` | **Ngừng gọi proxy `/api/hddt/*`.** Cache trống → hiện "Chưa có dữ liệu — dùng extension để đồng bộ"; "Làm mới" = kéo từ BE (Firestore), không phải từ GDT. |
| `hddt-token-dialog` | Bỏ tab đăng nhập/dán token GDT (giữ phần kết nối Gmail). |
| Docs | Cập nhật `docs/SERVICES.md`, `ROUTES.md`, `COMPONENTS.md`; thêm `docs/GDT-EXTENSION.md` (cài đặt + thao tác). |

---

## 6. Hạch toán từ hóa đơn (dùng dữ liệu `gdt_invoices`)

Tái dùng `invoice-voucher-converter.service.ts` (đã có: HĐ mua → phiếu chi + phiếu nhập kho; HĐ bán → phiếu thu + phiếu xuất kho) và mở rộng:

| Trường hợp | Bút toán đề xuất (TT 133) — **kế toán xác nhận trước khi code** |
|---|---|
| Mua vào, chưa thanh toán | Nợ 156/152/153/642… · Nợ 1331 / Có 331 |
| Mua vào, đã thanh toán | như trên, Có 111/112 (hoặc phiếu chi trả 331 sau) |
| Bán ra | Nợ 131/111/112 / Có 511 · Có 33311 |
| HĐ thay thế (`tthai=2`) | Đảo bút toán HĐ bị thay thế (`tthai=4`) + hạch toán HĐ mới |
| HĐ điều chỉnh (`tthai=3`) | Hạch toán phần chênh lệch (+/−) vào kỳ phát sinh HĐ điều chỉnh |
| HĐ bị hủy (`tthai=6`) | Không hạch toán / đảo nếu đã ghi sổ |

- Bảng ánh xạ **NCC / mặt hàng → tài khoản** (quy tắc, lưu Firestore) để tự gợi ý TK; user duyệt (`REVIEWED`) rồi mới ghi sổ (`POSTED`).
- Tôn trọng **khóa sổ kỳ** (`period-lock.service.ts`): HĐ thuộc kỳ đã khóa → không ghi, báo cần mở khóa/điều chỉnh kỳ sau.
- Dòng hàng (nhập kho) cần chi tiết HĐ: lấy từ `raw.detail` hoặc XML (email/GDT). Thiếu → chỉ hạch toán tổng, đánh dấu cần bổ sung.

## 7. Quyết toán theo quý/năm & bản kê khai

| Kỳ | Đầu ra | Trang/Service sẵn có |
|---|---|---|
| Quý (hoặc tháng) | **Tờ khai thuế GTGT 01/GTGT**: tổng hợp từ `gdt_invoices` theo `period` + `vatBreakdown` (0%, 5%, 8%, 10%, KCT, KKKNT) | `vat-declaration-page`, `vat-declaration.service.ts` |
| Quý | Bảng kê HĐ mua vào / bán ra để **đối chiếu nội bộ** (theo TT 80/2021 không còn bắt buộc nộp kèm tờ khai — kế toán xác nhận) | mới |
| Năm | Quyết toán TNDN (03/TNDN), BCTC (B01-DNN, B02-DNN, B03-DNN), sổ sách | `cit-page`, `balance-sheet-page`, `income-statement-page`, `cash-flow-page` |

- Xuất: **PDF** để in/lưu (qua `export.service.ts`) và về sau **XML theo định dạng HTKK** để user tự nộp qua eTax. KeToan **không** tự nộp lên cổng thuế.
- Đối chiếu trước khi chốt kỳ: tổng `gdt_invoices` theo kỳ ↔ sổ sách đã ghi ↔ HĐ email (`purchase_invoices` — pipeline). HĐ có trên GDT nhưng chưa hạch toán / đã hạch toán nhưng bị thay thế, điều chỉnh, hủy → danh sách cảnh báo.
- **Mẫu biểu phải xác nhận theo quy định hiện hành** (TT 80/2021 và các văn bản sửa đổi sau Luật thuế GTGT 2024 có hiệu lực 01/07/2025) trước khi làm P7.

## 8. Mở rộng tự động / AI (sau này)

Thiết kế từ đầu để không phải đổi schema:
- `ext` trong `gdt_invoices`, `accounting.status`, `statusHistory`, `gdt_sync_batches` → đủ "sự kiện" cho xử lý nền.
- Ý tưởng: gợi ý TK theo NCC/mặt hàng (quy tắc → AI); phát hiện bất thường (HĐ trên GDT không có email, chuỗi thay thế/điều chỉnh, NCC mới, thuế suất lạ); đối chiếu với giao dịch ngân hàng; nhắc hạn nộp tờ khai; trích xuất PDF bằng AI cho HĐ không có XML (pipeline M1/M2).
- Nguyên tắc giữ nguyên từ pipeline doc: **AI chỉ gợi ý, không tự hạch toán**; dữ liệu từ AI luôn `NEEDS_REVIEW`; email/hóa đơn là dữ liệu không tin cậy.

---

## 9. Các pha triển khai (mỗi pha: build + test + báo cáo; không sửa FE và BE trong cùng một bước)

| Pha | Nội dung | Phụ thuộc |
|---|---|---|
| **P0** | M0 bảo mật (auth FE + `get_current_user` BE) — theo `INVOICE-EMAIL-PIPELINE.md` | — |
| **P1** | Thu mẫu dữ liệu: extension bản tối thiểu chỉ ghi lại phản hồi → user xuất 1 file mẫu cho mỗi loại (list mua vào, bán ra, máy tính tiền, chi tiết, Xuất XML). Xác nhận: tên trường HĐ gốc, biến thể `ttxly`, giới hạn khoảng ngày, phân trang (`state`). | — |
| **P2** | Extension đầy đủ (mục 3): phiên, checklist, lọc trùng, xuất JSON/Excel, gửi sang KeToan | P1 |
| **P3** | BE `/api/gdt-invoices/*` + Firestore + index (mục 4) | P0, P1 |
| **P4** | FE trang `gdt-sync`, bridge, đồng bộ IndexedDB, ngừng gọi proxy (mục 5) | P2, P3 |
| **P4b** | BE: bộ đối chiếu đọc `gdt_invoices` thay `tax_invoices`; script chép dữ liệu `tax_invoices` cũ (mục 2.0) | P3 |
| **P5** | XML: nghe Xuất XML → `POST /xml` → parse; nối với HĐ email (`GDT_VERIFIED` của pipeline) | P4 |
| **P6** | Hạch toán (mục 6) — viết plan chi tiết riêng khi tới | P4 |
| **P7** | Tờ khai quý, quyết toán năm, in/xuất (mục 7) — plan chi tiết riêng | P6 |
| **P8** | Tự động / AI (mục 8) | P6 |
| Dọn dẹp | Gỡ proxy `/api/hddt/*` (BE) + tab login GDT (FE) | P4 |

**Thay đổi với `INVOICE-EMAIL-PIPELINE.md`:** M4 "đối chiếu GDT định kỳ (cron)" **bỏ** — thay bằng P2–P5 của plan này; trạng thái `GDT_VERIFIED` được đặt khi HĐ email khớp `gdt_invoices` theo khóa chung.

---

## 10. Bảo mật & dữ liệu

- Extension: không lên Web Store (không tự cập nhật), không host ngoài, không đọc token/cookie, không sửa request. Mã nằm trong repo, review được.
- `postMessage`: kiểm tra origin chính xác ở cả 2 chiều + marker + schema; KeToan bỏ qua mọi message lạ.
- BE: bắt buộc auth (M0), validate Pydantic, giới hạn lô, không log nội dung HĐ, Firestore chỉ ghi qua Admin SDK.
- Dữ liệu thuế: backup Firestore định kỳ (theo kế hoạch VPS). Xóa dữ liệu tạm trong extension sau khi lưu thành công.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| GDT đổi URL/định dạng phản hồi → hook không nhận | Giữ `raw`, parser có version; popup báo "phản hồi không nhận dạng được" thay vì im lặng |
| User quên biến thể / trang → thiếu HĐ | Checklist + so `total` GDT với số đã nhận; KeToan chặn chốt kỳ khi phiên chưa đủ |
| HĐ đã hạch toán về sau bị thay thế/điều chỉnh/hủy | Upsert phát hiện `tthai` đổi → `NEEDS_REVIEW` + cảnh báo trước khi chốt kỳ |
| Quota Firestore free (20k write/ngày) | `contentHash` bỏ qua bản ghi không đổi; vài trăm HĐ/tháng là dư |
| Sai mẫu biểu/nghiệp vụ | P6/P7 có plan riêng, kế toán duyệt quy tắc trước khi code |

## 12. Quyết định còn mở

1. **Loại hình doanh nghiệp:** `CLAUDE.md` của TapHoa39KeToan ghi "kế toán hộ kinh doanh", còn `app.routes.ts` / BE ghi "Công ty TNHH 1 thành viên — TT 133". Quyết định mẫu tờ khai (01/GTGT vs mẫu của hộ kinh doanh) và sổ sách.
2. **Kỳ khai GTGT:** theo quý hay theo tháng.
3. Tên collection: `gdt_invoices`, `gdt_sync_batches`, `gdt_invoice_xml` — giữ hay đổi; và xác nhận **tách khỏi `tax_invoices`** (mục 2.0) thay vì nâng cấp `tax_invoices` tại chỗ.
4. Lưu XML: Firestore (đơn giản) hay Firebase Storage (file lớn).
5. Xuất Excel từ extension có cần ngay ở P2 không, hay để KeToan xuất.

## 13. Đưa công cụ đang ở BanHang / script vào web KeToan (yêu cầu 21/10/2026 — làm sau)

| Chức năng | Hiện ở đâu | Hướng làm trên KeToan |
|---|---|---|
| **Xuất bảng quy đổi** (ĐVT master + hệ số KiotViet, bỏ hàng xóa/ngừng KD/clone) | BanHang `edit-product-page` → nút "Xuất bảng quy đổi" → `GET /api/kiotviet/unit-conversion` (TapHoa39BackEnd, sau cổng admin-auth `X-Id-Token`) → file `bang_quy_doi_kiotviet_YYYYMMDD.json` (schema `taphoa39-unit-conversion/1`) | KeToanBackEnd lấy dữ liệu từ TapHoa39BackEnd **server-to-server** (token dịch vụ riêng) — KHÔNG thêm bản sao credential KiotViet thứ 5 (xem bộ nhớ `kiotviet-credentials-4-files`). FE: nút tải JSON + bảng xem/tìm theo mã |
| **Đối soát CK** (HĐ KiotViet trả chuyển khoản ↔ sao kê TPBank; tab CK nhiều lần; xuất CSV) | BanHang `bank-reconciliation-page` + `utils/transfer-reconcile.util.ts` (+ spec) + `utils/tpbank-statement.util.ts`; HĐ lấy qua `KiotvietService` | Chép 2 util (logic thuần, không phụ thuộc Angular) → thành **vùng mirror mới** BanHang ⇄ KeToan (ghi vào `CLAUDE.md` gốc). HĐ KiotViet lấy qua cùng đường server-to-server ở trên. Trang mới trong nhóm "Tiền" |
| **Đối soát hóa đơn + bảng kê + tờ khai TNCN** | Script `tools/doi-soat-hoa-don/doi_soat.py` chạy trên máy kế toán | **Đã có plan riêng: `plan-doi-soat-web.md`** (21/10/2026 — đọc XML từ thư mục local, file → page, sheet → tab, bỏ file tờ khai xlsx/pdf và `ton_dau_ky.xlsx`) |

> **22/10/2026 — đã thay:** cả 2 dòng đầu làm ở **KeToanBackEnd với module KiotViet riêng** (`plan-ketoan-flow.md` quyết định
> 11: credential bản sao thứ 5, không gọi Flask). Bảng quy đổi ĐVT: `plan-doi-soat-web.md` mục 9i. Đoạn dưới chỉ còn để tham khảo.

Quyết định cần chốt trước khi làm 2 dòng đầu: `handoff.md` quy định KeToan **không gọi** Flask BE (2 nền tảng chỉ dùng chung Firebase) → hoặc đổi quy tắc đó (KeToanBackEnd gọi TapHoa39BackEnd server-to-server, token dịch vụ / IP nội bộ), hoặc KeToan chỉ đọc file JSON bảng quy đổi do BanHang xuất (như `plan-doi-soat-web.md` đang làm). Thêm: KeToan có cần ngân hàng khác TPBank không.
Thứ tự: làm `plan-doi-soat-web.md` trước → Xuất bảng quy đổi → Đối soát CK. Mỗi bước tách BE / FE.
