# Plan tổng — TapHoa39KeToan thay Vietda

> Trạng thái: **chưa làm** — bắt đầu ở session khác. Yêu cầu + trả lời của user ngày 21–22/10/2026.
> Plan chi tiết bước 1: `plan-doi-soat-web.md`. Phần tải XML từ cổng thuế (`plan-gdt-extension.md`) đã hủy.
> Bản tham chiếu logic đối soát / thuế / TNCN (đã đối chiếu số thật): `tools/doi-soat-hoa-don/doi_soat.py`.

## 0. Quyết định đã chốt (21/10/2026)

1. **KeToan thay thế Vietda** → làm **đầy đủ** phần mềm kế toán (chứng từ, kho, công nợ, quỹ / ngân hàng, lương, sổ sách,
   BCTC, số liệu quyết toán). "Script 2" (xuất file nhập Vietda) **hủy**.
2. ~~UI + menu theo flow công việc~~ → **thay bởi menu 3 mục (quyết định 9)**. Các việc của flow vẫn giữ: tải HĐ vào/ra →
   đối chiếu HĐ với sao kê → hạch toán thu/chi → kiểm tra HĐ đầu ra trước khi phát hành trên KiotViet einvoice app.
3. HĐ vào/ra: kế toán **tự import thư mục XML** (tải hàng loạt sẵn bằng **app FDI**). Không tải từ cổng thuế.
4. Bước 1–3 làm được theo **ngày / tuần / tháng / quý** → kỳ = khoảng ngày tùy chọn, import nhiều lần trong kỳ.
5. Bước 4: **dùng API tự động kiểm tra hằng ngày**, thay việc kế toán xem tay trên
   `https://einvoiceapp.kiotviet.vn/man/system/bills-invoice-vat`.
6. **Không xuất tờ khai** (xlsx / pdf / XML HTKK): kế toán nhập tay vào app "Hỗ trợ kê khai thuế" (HTKK) → KeToan chỉ cần
   **hiện các con số để copy / paste**, đúng thứ tự chỉ tiêu trên HTKK.

**Bổ sung 22/10/2026:**

7. **Đăng nhập:** bỏ popup `components/shared/hddt-token-dialog` → **trang đăng nhập Google** như BanHang / Management, **kiêm
   luôn Gmail** (scope `gmail.readonly`) — Gmail vẫn dùng, nên API Gmail phải được bảo vệ (mục 3b, pha 0), không gỡ.
8. **Mọi phần backend của KeToan viết trong TapHoa39KeToanBackEnd (FastAPI), KHÔNG dùng Flask** (kể cả verify-email / login).
9. **Menu 3 mục cấp 1** (thay menu "theo flow" của quyết định 2) — mục 1.
10. **Đối soát CK:** nguồn HĐ = **phương án C** (job ghi các HĐ KiotViet trả chuyển khoản vào Firestore → KeToan đọc). Chỉ TPBank.
11. **Job KiotViet chạy ở TapHoa39KeToanBackEnd, tự đăng nhập KiotViet** (mục 5 câu 10, chọn b) — dùng cho Đối soát CK
    (bước 2) và kiểm HĐ đầu ra (bước 4). Credential KiotViet thành **bản sao thứ 5** (env VPS KeToan) → đổi mật khẩu
    KiotViet phải sửa thêm chỗ này. Không dùng Flask.
12. **Gmail khi đăng nhập:** theo cách BanHang + TapHoa39BackEnd đang làm (2 lớp token) — thiết kế ở mục 2 "Pha 0".
13. **Không chuyển hẳn khỏi Vietda** (user 22/10/2026): KeToan còn đang phát triển, **Vietda vẫn là phần mềm chính**. Dùng
    **dữ liệu năm 2026 để test** KeToan; sang năm (2027) nếu app ổn thì **chuyển dần**. Chi tiết mục 3.

## 1. Menu mới — 3 mục cấp 1 (quyết định 22/10/2026)

| Mục cấp 1 | Gồm | Ghi chú |
|---|---|---|
| **Tiện ích** | Kiểm tra HĐ tự động (bước 4), Đối soát CK (bước 2), nhóm **Kiểm tra số lượng hóa đơn** (ledger-8/9 — user chuyển sang đây 22/10/2026 tối, đổi tên 23/10: đầu vào = XML máy ⇄ Gmail, đầu ra = XML máy ⇄ HĐĐT KiotViet; bỏ GDT), **Đối soát hóa đơn XML** (bước 1 — user 22/10/2026: chọn thư mục XML đầu vào / đầu ra → bấm Đối soát → hiện tất cả các bảng như file Excel của script), … | Vị trí của Số liệu khai thuế, Lương/TNCN: **chốt khi làm** (Tiện ích hay nhóm tương ứng trong Kế toán chi tiết) |
| **Kế toán chi tiết** | Nhóm 1–11: Danh mục, Chứng từ, Bán hàng, Mua hàng, Kho, Lương, Tiền, Thuế, Sổ tổng hợp, Báo cáo, **11. Khóa sổ & Kiểm toán** (Khóa sổ + Dấu vết kiểm toán, chuyển từ nhóm Hệ thống) | ledger-8/9 lúc đầu xếp ở đây, user đổi sang **Tiện ích** 22/10/2026 tối. Nhiều page trong nhóm này đang là demo — mục 3 và `docs/STATUS.md` |
| **Thiết lập** | `system-settings-page`, `user-roles-page` | |

Giữ từ bản trước: thanh **chọn kỳ** dùng chung (Hôm nay · Tuần này · Tháng · Quý · Năm · Từ ngày – đến ngày); trang chủ có thể
hiện tiến độ kỳ (vd "20.600 HĐ · 18.000 đã khớp sao kê · 1.200 chưa hạch toán · 3 HĐ nháp lỗi hôm nay").

**Quy ước chung cho mọi bảng** (user 21/10/2026): file Excel của script → page, sheet → tab; bảng có **phân trang**, lọc,
sắp xếp, tìm kiếm, và nút **xuất Excel / CSV theo bộ lọc đang chọn**.

## 2. Từng bước

### Pha 0 — Đăng nhập Google + Gmail (quyết định 7, 8, 12; rà code BanHang / TapHoa39BackEnd / KeToanBackEnd 22/10/2026)

Yêu cầu bảo mật chung (verify ID token cho mọi API, uid lấy từ token, bỏ `GMAIL_UID`, escape callback, state có TTL,
chế độ *Testing* làm refresh token hết hạn ~7 ngày): `TapHoa39KeToanBackEnd/docs/INVOICE-EMAIL-PIPELINE.md` §1, §3.

**BanHang + TapHoa39BackEnd đang làm (2 lớp token):**
1. Đăng nhập: `AuthService.signInWithGoogle()` — Firebase Auth project `quanlysongminh`, `signInWithPopup` + scope
   `gmail.readonly` → `/api/auth/verify-email` (whitelist `ALLOWED_EMAILS`) → `/api/auth/login`. Access token Gmail lấy từ
   popup (~1 giờ, **không có refresh token**) gửi `POST /api/gmail/auth/save` → merge vào `users/{uid}.gmailTokens.accessToken`,
   **không ghi đè** `refreshToken` đã có.
2. Refresh token (dùng lâu dài): `GmailService.checkAuthStatus()` → `GET /api/gmail/auth/status` → `hasRefreshToken`. Nếu
   `false` → nút "Kết nối Gmail" → `connectGmail()` → `GET /api/gmail/auth/url?uid&login_hint` → popup Google
   (`access_type=offline`, `prompt=consent`, PKCE `code_verifier` lưu lại cho callback) → `/auth/callback` đổi code → lưu
   `users/{uid}.gmailTokens {accessToken, refreshToken}` → `postMessage GMAIL_AUTH_SUCCESS`.
3. Gọi Gmail: `services/gmail_service.py` dựng `Credentials(refresh_token, client_id, client_secret)` → tự làm mới access
   token, ghi lại Firestore; làm mới lỗi (`RefreshError`) → 401 `TOKEN_EXPIRED` → FE báo "kết nối lại Gmail" (không tự mở
   popup khi đang poll — `invoice-email-listener.service.ts`).

**KeToanBackEnd hiện có** (`app/routes/gmail_routes.py`): dùng **cùng OAuth client** với Flask (`GOOGLE_CLIENT_ID` trùng —
so `.env` máy dev 22/10/2026) và **cùng collection `users`** của `quanlysongminh` (`get_gmail_db()`) → refresh token dùng chung
được với BanHang. Lỗi phải sửa ở pha 0 (ngoài các lỗi đã ghi ở pipeline §3.1):
- **Không có PKCE:** (sửa 22/10/2026 khi code — nhận định cũ "mặc định tự sinh verifier → lỗi Missing code verifier" là SAI)
  `Flow.from_client_config` của `google-auth-oauthlib==1.2.1` truyền `autogenerate_code_verifier=None` → không có PKCE. Đã
  bật PKCE rõ ràng + lưu verifier theo `state` (cùng chỗ lưu state có hạn).
- `state` được tạo nhưng callback **không kiểm**.
- Callback tìm user theo **email** (`where('email', '==', …)`), không theo uid → có thể tạo doc `users` id ngẫu nhiên, lệch
  uid Firebase của người đăng nhập.

**Tiến độ 22/10/2026:** BE + FE đăng nhập **đã code** (FE: `services/auth.service.ts`, `guards/auth.guard.ts`,
`interceptors/auth.interceptor.ts`, `components/login-page/`; bỏ `shared/hddt-token-dialog`; build OK). Chưa test đăng nhập
Google thật. Bật `ENFORCE_AUTH=true` ở BE sau khi FE đã deploy. Còn lại của Pha 0: menu 3 mục, chọn kỳ.
**Cập nhật 22/10/2026 (tối):** user đăng nhập Google thành công. Menu 3 mục (`layouts/main-layout/menu.config.ts`) + thanh chọn
kỳ (`services/period.service.ts`, `components/shared/period-selector/`) **đã code**, build OK. 3 trang Tiện ích có route
(`invoice-check-page`, `bank-reconciliation-page`, `invoice-reconciliation-page`) nhưng đang là placeholder. Page cũ chưa đọc
kỳ dùng chung (nối khi viết lại từng page). Chưa làm: lưu trữ server.

**Thiết kế cho KeToan:**
1. FE: Firebase Auth project **`quanlysongminh`** (environment đã có `firebaseGmail`), `signInWithPopup` + `gmail.readonly`
   → uid **trùng uid BanHang** nếu cùng email → tài khoản đã kết nối Gmail ở BanHang thì `refreshToken` có sẵn, **không cần
   bước OAuth thêm**. Thêm domain KeToan vào *Authorized domains* của Firebase Auth.
2. BE (FastAPI) — **ĐÃ CODE 22/10/2026** (`TapHoa39KeToanBackEnd/CLAUDE.md` mục "Dang nhap"; thay `POST verify-email` bằng
   **`GET /api/auth/me`** kiểm ID token + whitelist, tránh endpoint công khai dò được email nào trong whitelist): whitelist
   `KETOAN_ALLOWED_EMAILS` (hiện chỉ `songminhcr.dn@gmail.com`, mục 5 câu 7), cờ `ENFORCE_AUTH`; dependency `get_current_user`
   verify ID token bằng app `gmail-app` (đã khởi tạo cho `quanlysongminh`). Không cần "app token" như Flask `/api/auth/login`
   — dùng thẳng Firebase ID token. Header: đề xuất `X-Id-Token` như Management (pipeline §3.3 ghi `Authorization: Bearer` —
   chốt 1 khi làm). Thêm `POST /api/gmail/auth/save` (merge access token, giữ refresh token) + `GET /api/gmail/auth/status`.
3. Sau đăng nhập: FE gọi `auth/status` (của hộp thư hóa đơn — mục 6); `hasRefreshToken = false` → mở popup `auth/url`
   **một lần** (`login_hint` = hộp thư hóa đơn, `state` ↔ uid người bấm lấy từ ID token, không từ query) → callback lưu vào
   doc `users` của **hộp thư hóa đơn**. Các lần sau chỉ bấm đăng nhập Google.
4. 401 `TOKEN_EXPIRED` → hiện nút "Kết nối lại Gmail", không tự mở popup.
5. Vận hành: thêm redirect URI `https://<domain KeToanBackEnd>/api/gmail/auth/callback` vào OAuth client trên Google Cloud
   Console; OAuth consent screen để **In production** (pipeline §1).
6. **Hộp thư hóa đơn cố định = `songminhcr.dn@gmail.com`** (hộp thư nhận HĐ đầu vào — user 22/10/2026; pipeline §1).
   API Gmail **luôn đọc bằng token của hộp thư này** (cấu hình phía server, vd `GMAIL_INVOICE_ACCOUNT`; không nhận từ client),
   không phụ thuộc ai đang đăng nhập. ID token chỉ dùng để kiểm quyền (whitelist) và ghi dấu vết. Thay cho fallback `GMAIL_UID`
   hiện nay (khác ở chỗ: bắt buộc đã đăng nhập).
   - Đăng nhập bằng `songminhcr.dn@gmail.com`: lưu access token từ popup (`auth/save`); thiếu refresh token → bước 3.
   - Đăng nhập bằng email khác (có trong whitelist): **không** lưu token Gmail của email đó. Hộp thư hóa đơn chưa có refresh
     token → báo "cần kết nối Gmail songminhcr.dn@gmail.com" (bước 3).
   - Callback: email Google trả về **phải** đúng hộp thư hóa đơn, khác thì từ chối (tránh gắn nhầm hộp thư).

### Bước 1 — Nhập HĐ vào / ra (chi tiết: `plan-doi-soat-web.md`)
- Kế toán chọn thư mục do app FDI tải về (cần mẫu cấu trúc thư mục FDI — mục 5). Import **nhiều lần** trong kỳ: chỉ thêm
  HĐ mới; trùng khóa `MST người bán | ký hiệu | số` thì bỏ qua; HĐ thay thế / điều chỉnh cập nhật trạng thái HĐ liên quan
  (HĐ đã hạch toán → "cần xem lại").
- Ghép mã master + quy đổi ĐVT (bảng quy đổi KeToanBackEnd **tự lấy từ KiotViet**, cùng schema file JSON BanHang xuất —
  `plan-doi-soat-web.md` mục 9i) → số lượng nhập / xuất **đi thẳng vào kho** theo ĐVT master
  → không cần bản sao XML quy đổi nữa.
- Ngoại lệ: lệch số học (tách lệch do làm tròn đơn giá), bán vượt tồn, bán dưới giá vốn, HĐ thay thế khác kỳ…

### Bước 2 — Đối chiếu HĐ với sao kê (= "Đối soát CK" trong mục Tiện ích)
- **Chỉ TPBank** (22/10/2026). Nguồn HĐ bán chuyển khoản = **phương án C**: job ghi các HĐ KiotViet trả CK vào Firestore →
  KeToan đọc (không gọi KiotViet / Flask từ KeToan FE). Job chạy ở **KeToanBackEnd** (quyết định 11, module KiotViet mục 4).
- Job (theo lịch + nút "lấy ngay"): `POST https://api-man1.kiotviet.vn/api/invoices/list?format=json&Includes=InvoiceExtraData&Includes=EInvoice`
  với payload y như BanHang `KiotvietService.getTransferInvoices()` (`PaymentMethods ["Transfer"]`, `InvoiceStatus [1,2]`,
  `BranchIds [878979]`, `UsingCod 0`, lọc `PurchaseDate` theo kỳ) → lưu HĐ (mã, `TotalPayment`, giờ, ghi chú
  `Description`, trạng thái HĐĐT theo `readKvEInvoice()`) vào Firestore project kế toán (tên collection chốt khi làm) → FE
  đọc qua API KeToanBackEnd. **Không** chép nút "đánh sao" (`backfillTransferFavourites` — thao tác ghi lên KiotViet).
- Phần chép từ BanHang `components/bank-reconciliation-page` (~820 dòng ts/html/css) phải viết lại nguồn dữ liệu; page dùng
  `@angular/cdk/scrolling` mà KeToan **chưa có `@angular/cdk`**.
- Tải file sao kê (Excel internet banking). Khớp HĐ ra ↔ tiền vào, HĐ vào ↔ tiền trả NCC. Kết quả mỗi HĐ: đã thanh toán qua
  ngân hàng (giao dịch nào) / tiền mặt / chưa thanh toán; giao dịch ngân hàng không khớp HĐ nào.
- Dùng lại logic BanHang `utils/transfer-reconcile.util.ts` (+ spec), `utils/tpbank-statement.util.ts` (đang so HĐ
  KiotViet ↔ sao kê TPBank, có tab "CK nhiều lần") → chép sang thì thành **vùng mirror mới** (ghi vào `CLAUDE.md` gốc).
  KeToan có sẵn `bank.service.ts`, `bank-transaction.service.ts`.

### Bước 3 — Hạch toán (đầy đủ, vì thay Vietda)
- Tự sinh chứng từ từ HĐ + kết quả bước 2 ở trạng thái **nháp** → kế toán duyệt → ghi sổ (mẫu DRAFT → POSTED của phiếu
  thu/chi đã có), theo bảng quy tắc định khoản dưới đây.

**Quy tắc định khoản của kế toán** (user 22/10/2026: `DINH KHOAN.xlsx` = "Danh mục chứng từ, nghiệp vụ" của Vietda; file gốc
trên máy dev `C:\Users\Hello\Downloads\DINH KHOAN.xlsx`). Mỗi mã nghiệp vụ có 5 cặp Nợ / Có: chính · VAT · giá vốn / kho ·
chiết khấu · chi phí. Đề xuất KeToan **dùng lại mã nghiệp vụ của Vietda** (XH1, NH1…) để so số với Vietda khi chạy song song;
bảng lưu phía server, sửa được ở Danh mục.

| Mã | Nghiệp vụ | Chính (Nợ / Có) | VAT | Giá vốn / kho |
|---|---|---|---|---|
| XH1 · XH2 | Xuất bán hàng · bán NVL | 131 / 5111 | 131 / 33311 | 6321 / 1561 · 632 / 152 |
| NH1 · NH2 · NH3 | Nhập mua hàng · NVL · CCDC | | 1331 / 331 | 1561 · 152 · 153 / 331 |
| (5) | HĐ nhập - xuất không qua kho | 154 / 331 | 1331 / 331 | |
| (6) | HĐ cung ứng dịch vụ | 131 / 5112 | 131 / 33311 | |
| (7) | HĐ dịch vụ mua vào | 642 / 331 | 1331 / 331 | |
| (13) · (14) | Phiếu thu tiền gửi · tiền mặt | 1121 / 131 · 1111 / 131 | | |
| (8) · (9) | Phiếu chi tiền gửi · tiền mặt | 331 / 1121 · 331 / 1111 | | |
| NT1 · NT2 · NT3 | Hàng bán bị trả lại (hàng · NVL · CCDC) | 5111 / 131 | 33311 / 131 | 156 · 152 · 153 / 632 |
| XT1 · XT2 · XT3 | Xuất trả NCC | | 331 / 1331 | 331 / 156 · 152 · 153 |
| XK1 · XK2 | Xuất NVL cho SX · xuất dùng nội bộ | 154 / 152 · 154 / 156 | | 154 / 152 · 154 / 156 |
| NK1–NK4 | Phiếu nhập kho (hàng · thành phẩm · NVL · CCDC) | | | 156 · 155 · 152 · 153 / 331 |
| CK1–CK3 | Chuyển kho (hàng · NVL · thành phẩm) | | | 156 / 156 · 152 / 152 · 153 / 153 |
| (2) | Giấy thanh toán tạm ứng | 154 / 141 | | |

Hệ quả cho flow: **HĐ bán luôn ghi Nợ 131** (kể cả khách trả tiền mặt / CK); tiền thu là chứng từ riêng xóa 131 → HĐ khớp
sao kê ở bước 2 sinh **phiếu thu tiền gửi** Nợ 1121 / Có 131, còn lại (tiền mặt) sinh **phiếu thu tiền mặt** Nợ 1111 / Có 131.
HĐ mua: Nợ 1561, 1331 / Có 331 → trả NCC: phiếu chi Nợ 331 / Có 1121 hoặc 1111.

Cần kế toán xác nhận (bảng chưa có hoặc chưa khớp):
- Cột **chiết khấu** và **chi phí** trống ở mọi dòng → chưa có quy tắc cho chiết khấu thương mại trên HĐ, hàng khuyến mại /
  tặng kèm (giá 0), phí ngân hàng, HĐ điều chỉnh / thay thế.
- Dòng (6) dịch vụ ghi Có **5112**, nhưng theo TT 133 (và hệ thống TK của KeToan) 5112 = doanh thu thành phẩm, dịch vụ = **5113**.
- Bán hàng ghi giá vốn Nợ **6321**, hàng trả lại ghi Có **632**; hệ thống TK của KeToan **chưa có 6321** → thêm TK chi tiết
  hoặc thống nhất dùng 1 TK.
- XK2 "xuất dùng nội bộ" ghi Nợ **154** (chi phí SXKD dở dang) — DN thương mại thường ghi 642; CK3 "chuyển kho thành phẩm"
  ghi 153 / 153 (thành phẩm là 155) — có thể gõ nhầm.
- Dùng lại: `services/invoice-voucher-converter.service.ts` (HĐ mua → phiếu chi + nhập kho; HĐ bán → phiếu thu + xuất
  kho), `shared/create-voucher-from-invoice-modal`, service phiếu thu/chi, kho, nhật ký, sổ cái.
- Kho theo ĐVT master; giá vốn **bình quân gia quyền tính lại sau mỗi lần nhập** (bình quân di động — user 22/10/2026: hết
  hàng mới nhập, không nhập định kỳ theo tháng). Giá BQ mới = (giá trị tồn + giá trị nhập) / (SL tồn + SL nhập), áp cho các
  lần xuất sau đó. Hệ quả phải xử lý:
  - HĐ nhập đến trễ (import FDI nhiều lần, HĐ lập trước ngày đã xuất) → **tính lại giá vốn** các lần xuất từ ngày HĐ đó.
  - Bán khi tồn âm (HĐ nhập chưa về) → đề xuất tạm lấy giá BQ gần nhất, tính lại khi HĐ nhập về; kỳ đã khóa sổ thì không
    tính lại (báo điều chỉnh kỳ sau).

### Bước 4 — Kiểm tra HĐ đầu ra trước khi phát hành (tự động hằng ngày)

Lỗi kế toán hay gặp (user, 21/10/2026): **nhầm thuế suất** (10 / 5 / 0 / KCT / KKKNT, gồm cả 8% theo NQ 204) và **sai số
tiền tổng** (tổng tiền chưa thuế, tổng tiền thuế).

**API của trang `einvoiceapp.kiotviet.vn/man/system/bills-invoice-vat`** (phân tích 2 HAR ngày 21/10/2026; header gửi kèm:
`authorization: Bearer <token einvoice>`, `taxcode`, `x-new-ui-mode`):
- `GET https://api.einvoice.kiotviet.vn/v3/bills?useAdvancedSearch=true&invoiceType=01GTKT&startDate=YYYY-MM-DD 00:00:00.000&endDate=YYYY-MM-DD 23:59:59.998&statusTab=GHI_TAM&prioritizeDraft=false&skip=0&take=10&sortBy=billDate-`
  → `data.items[]` (`id`, `invoice_code` = mã HĐ KiotViet vd `HD443753`, `bill_series`, `bill_date`, `amount`,
  `amount_vat`, `total_payment`, `status` = `GHI_TAM` (nháp), `buyer_tax_code`, `payment_method_code`, `cqt_situation`,
  `error_content`…), `data.total_count`, `data.has_more` → phân trang bằng `skip` / `take`.
- `GET /v3/bills/{id}` → chi tiết: `bill_products[]` (`product_code` = mã KiotViet, `unit_code`, `quantity`, `price`,
  `amount`, `amount_vat`, `amount_after_vat`, **`vat`**, `is_promotion`, `amount_discount`), `bill_vats[]` (tổng hợp theo
  thuế suất: `vat`, `amount`, `amount_vat`, `amount_after_vat`), tổng `amount` / `amount_vat` / `amount_after_vat` /
  `total_payment`, `has_original_decimal_mismatch`, `status`.
- `GET /api/v3/cqt-issues/bill/{id}` (vấn đề phía CQT), `GET /v3/bills/summary-status` (đếm theo trạng thái),
  `GET /api/v2/lists/vat-rates`: mã thuế suất `0`, `5`, `8`, `10`, **`-1` = KCT**, **`-2` = KKKNT**, `-3` = KHAC.
- **Xác thực** (sửa lại kết luận cũ "chỉ dùng cookie" — HAR đầu tiên bị Chrome lọc mất header `authorization`):
  - Trang KiotViet `songminhcr.kiotviet.vn` gọi `api-man1.kiotviet.vn` bằng **token KiotViet** (JWT RS256, `iss = kvssjwt`,
    hạn 28 ngày) — cùng loại token TapHoa39BackEnd đang dùng.
  - einvoiceapp gọi `api.einvoice.kiotviet.vn` bằng **token einvoice riêng** (JWT RS256, `iss = https://iam.kv-einvoice.com`,
    hạn 24 giờ; claim có `kvexternal`, `merchantcode`, `taxcodes`, `kvrid`, `kvuid`…).
  - Kế toán vào einvoiceapp bằng cách bấm "Thuế & Kế toán" → "Hóa đơn điện tử" trên trang KiotViet (không đăng nhập riêng)
    → có bước **đổi token KiotViet lấy token einvoice** (SSO). Thu được bằng `chrome://net-export` (21/10/2026):
    1. Tab mới `GET https://einvoiceapp.kiotviet.vn/redirect` (initiator `songminhcr.kiotviet.vn`, URL không có tham số,
       có gửi cookie của miền `kiotviet.vn`).
    2. **`POST https://api.einvoice.kiotviet.vn/api/v2/auth/retail/token`** (xác nhận bằng HAR 21/10/2026):
       body JSON `{"token": "<token KiotViet, JWT iss kvssjwt>", "tax_code": "<MST 10 số>"}`, `content-type: application/json`
       (+ header `authorization`, `taxcode` theo net-export — HAR lọc mất giá trị; khi thử gửi `Authorization: Bearer <token
       KiotViet>` + `taxcode: <MST>` giống trình duyệt) → response `{status, code, data: {access_token: <JWT iss
       https://iam.kv-einvoice.com, 24h>, expires_in}, message}`. Gọi API trực tiếp, không qua trang đăng nhập IAM.
    3. Sau đó `GET /v2/merchant/info`, `GET /api/v2/user-info`, rồi các API danh sách / chi tiết ở trên với
       `Authorization: Bearer <access_token>` + `taxcode: <MST>`.
    - Token KiotViet của **TapHoa39BackEnd** cùng loại: `FromKiotViet/get_authorization.py` đăng nhập
      `api-man1.kiotviet.vn/api/account/login` (`IsManageSide: true`, như trang web quản lý) → `get_token()` trả
      `"Bearer <token>"` → bỏ tiền tố `Bearer ` khi đưa vào body. einvoiceapp giữ token einvoice 24 giờ rồi mới đổi lại → BE
      làm tương tự (cache, đổi lại khi còn < 1 giờ hoặc khi API trả 401).
  - CORS chỉ chặn trình duyệt ở origin khác; gọi từ server thì không bị CORS.

> ✅ **Đã chốt 22/10/2026 (quyết định 11):** job chạy ở **KeToanBackEnd (FastAPI)**, tự đăng nhập KiotViet bằng credential
> riêng (bản sao thứ 5) — không dùng Flask. Phần kỹ thuật (đổi token, API, cách kiểm) giữ nguyên.

**Cách làm đề xuất (A) — job trong KeToanBackEnd, không cần extension:** module KiotViet của KeToanBackEnd (mục 4) đăng nhập
lấy token KiotViet → đổi lấy token einvoice qua đúng bước SSO trên (giữ trong bộ nhớ, tự đổi lại khi hết 24 giờ) → hằng ngày (giờ cấu
hình) + nút "kiểm tra ngay" gọi `/v3/bills` (nháp `GHI_TAM` của ngày / khoảng ngày, phân trang) rồi `/v3/bills/{id}` từng HĐ,
có giãn cách (~200 HĐ ra / ngày) → kiểm → ghi **kết quả** vào Firestore → KeToan hiển thị (đúng quy tắc `handoff.md`). Không
lưu cookie / mật khẩu của người dùng, không sửa / phát hành HĐ.
- **ĐÃ THỬ THẬT 21/10/2026 — cách A chạy được** (thử bằng Flask; KeToanBackEnd gọi cùng các API nên kết quả vẫn đúng.
  Script thử chỉ đọc, dùng `get_authen()` của BE, header tối thiểu
  `Authorization` + `taxcode` + `Accept`, không giả Origin/Referer): đăng nhập KiotViet OK → đổi token einvoice HTTP 200
  (`expires_in` 86399) → `/v3/bills` GHI_TAM 01–21/10: 48 HĐ nháp (39 CK, 9 TM) → đọc chi tiết 47 HĐ: 190 dòng 8%, 23 dòng
  10%, **0 lệch số học** (thuế từng dòng, `bill_vats`, tổng HĐ). 23 dòng 10% là bia Larue, Pocari, Sting, Mirinda, trà bí
  đao / nước me Wonderfarm, C2, Kirin Latte, nước chanh dây… → đúng loại dòng kế toán cần soát thuế suất (8% hay 10%) —
  việc kiểm này cần danh mục thuế suất đúng theo mã master (bước 1). Không log token; không gọi API ghi / phát hành.
- Nếu bước đổi token chỉ chạy được trong trình duyệt (vd cần cookie của trang đăng nhập IAM) → **(B) dự phòng: extension
  Chrome** trên máy kế toán: mỗi ngày mở tab nền einvoiceapp (đi từ trang KiotViet như kế toán vẫn làm), content script lấy
  token einvoice mà trang đã có rồi gọi cùng các API trên, gửi kết quả về KeToan; chỉ chạy khi máy đó bật + Chrome mở.

**Kiểm gì:**
1. **Thuế suất từng dòng**: `vat` của dòng so với thuế suất ĐÚNG của mặt hàng. Nguồn "thuế suất đúng": danh mục hàng hóa
   của KeToan theo mã master (bước 1 ghép `product_code` → mã master qua bảng quy đổi), gợi ý từ thuế suất trên HĐ **đầu
   vào** gần nhất của cùng mã master (hàng được giảm 10% → 8% theo NQ 204 thì NCC cũng xuất 8%), kế toán sửa / khóa được.
   Mã chưa có thuế suất đúng → báo "chưa xác định".
2. **Số tiền**: từng dòng `amount_vat` = làm tròn(`amount` × `vat`%) (KCT / KKKNT = 0), `amount + amount_vat =
   amount_after_vat`; Σ dòng theo từng thuế suất = `bill_vats`; Σ `bill_vats` = `amount` / `amount_vat` /
   `amount_after_vat` của HĐ; `total_payment` khớp; cờ `has_original_decimal_mismatch`. Phân biệt lệch do làm tròn đơn giá
   (như `check_arithmetic` của script) với lệch thật.
3. (Bổ sung — job KeToanBackEnd tự lấy HĐ KiotViet) so `total_payment` với tổng HĐ KiotViet cùng `invoice_code`; HĐ đã bán nhưng chưa chuyển
   sang nháp sau X giờ; lỗi chuyển (Firestore `einvoice_transfers`); HĐ đã phát hành bị CQT từ chối (KiotViet `EInvoices[]`:
   `TaxStatus 2 + ErrorCode 0` = được chấp nhận).

**Hiển thị ở KeToan:** page "Kiểm tra HĐ đầu ra" — danh sách HĐ nháp có lỗi (mã HĐ, ngày, lỗi, dòng sai, thuế suất đang có →
nên là), link mở đúng HĐ trên einvoiceapp để sửa; lịch sử các lần kiểm. Phát hành vẫn làm tay (ký bằng agent trên máy).

### Lương
- Đọc `LUONG SM 2026.xlsx` (logic `load_payroll` / `compute_tncn` của script, `plan-doi-soat-web.md` mục 6) → bút toán
  lương, BH (334, 338, 642…) → số liệu TNCN.

### Số liệu khai thuế (copy / paste vào HTKK)
- Mỗi tờ khai 1 page: chỉ tiêu theo **đúng thứ tự trên HTKK**, mỗi số 1 nút copy (copy ra số thuần, không dấu chấm).
  01/GTGT ([21]–[43]) + phụ lục 142 (I, II, III); 05/KK-TNCN ([16]–[32]); năm: quyết toán TNCN, TNDN, BCTC.
- Phụ lục 142 (hàng nghìn dòng; Q3/2026: 1.622 + 2.369) và bảng kê mua vào / bán ra: **page / tab dạng bảng có phân trang**
  + nút **xuất Excel / CSV theo bộ lọc đang chọn** (user 21/10/2026: không cần file theo mẫu HTKK).
- Giữ so sánh với XML tờ khai đã nộp (để kiểm chứng), nhưng không xuất file tờ khai.
- Quy tắc tính của kế toán: `plan-doi-soat-web.md` mục 8.

## 3. Thay Vietda — việc bắt buộc

- **Số dư đầu kỳ** lấy từ Vietda: số dư từng tài khoản, công nợ chi tiết KH / NCC, tồn kho từng mã (SL + giá trị), TSCĐ /
  CCDC đang phân bổ, lương còn phải trả. Tồn kho này thay cho `ton_dau_ky.xlsx` của script. Test bằng dữ liệu 2026
  (quyết định 13) → cần số dư **01/01/2026** (hoặc ngày đầu kỳ test); khi chuyển dần năm 2027 → số dư tại ngày bắt đầu dùng thật.
- **Mã hàng kế toán = mã Vietda** (danh mục `QUYDOI.xlsx` xuất từ Vietda: ~2.890 mã `HHxxxx` kế toán tự đặt, cột Mã hàng /
  Tên / ĐVT; không có hệ số quy đổi) → danh mục hàng hóa của KeToan dùng mã này (tồn kho chuyển từ Vietda theo mã này),
  kèm liên kết mã master KiotViet ↔ mã Vietda. Cách ghép đã làm trong script (`VietdaCatalog`, `suggest_vietda`,
  `_apply_vietda`): tên HĐ trùng đúng tên Vietda (77% dòng HĐ vào thật) → theo mã master chắc chắn → tên gần giống (chờ
  xác nhận); chỉ áp dụng tự động khi chắc chắn.
- **Chạy song song, chuyển dần** (quyết định 13): năm 2026 = **test** — Vietda vẫn là sổ chính, số liệu Vietda 2026 (sổ cái,
  cân đối, BCTC, tờ khai đã nộp) làm "đáp án" để so. Năm 2027 nếu ổn thì chuyển dần từng phần, không chuyển hẳn. Phần
  **Tiện ích** (Kiểm tra HĐ tự động, Đối soát CK) không phụ thuộc sổ sách Vietda → dùng thật được sớm nhất.
- **Lưu trữ thật**: các page hiện tại phần lớn dùng localStorage / dữ liệu demo → phải chuyển sang lưu phía server
  (Firestore / KeToanBackEnd) + sao lưu định kỳ; đăng nhập + phân quyền (M0 bảo mật của KeToanBackEnd).
- **Hiện trạng thật (kiểm tra 22/10/2026):** chỉ **phiếu thu / chi** và **phiếu nhập / xuất kho** được lưu thật (qua
  KeToanBackEnd). HĐ mua / bán và sổ chi tiết 131 / 331 phụ thuộc nguồn GDT (đã chết). Phần còn lại là demo / in-memory;
  Nhật ký chung, Sổ cái, Cân đối tài khoản, BCTC **tự sinh dữ liệu demo**, không nối với chứng từ. `/thue/mon-bai` có trong
  menu nhưng không có route. → "Dùng lại" chủ yếu là UI; tầng dữ liệu và phần tính sổ phải làm lại, nối với chứng từ thật.
- `pit-page` / `PITService` đang dùng mức giảm trừ cũ (11.000.000 / 4.400.000; năm 2026 là 15.500.000 / 6.200.000).
- Xác nhận chế độ kế toán áp dụng (TT 133/2016 hay văn bản thay thế) và mẫu BCTC trước khi làm phần BCTC.

## 3b. Tài liệu cũ — phần nào còn hiệu lực (rà ngày 22/10/2026)

| Tài liệu | Còn dùng | Bỏ / đã thay |
|---|---|---|
| `TapHoa39KeToanBackEnd/docs/INVOICE-EMAIL-PIPELINE.md` | **§3 + M0 bảo mật = Pha 0 bắt buộc** (mục 6): trang đăng nhập Google + whitelist ở FE (quyết định 7, kiêm Gmail `gmail.readonly`), `get_current_user` verify ID token cho **toàn bộ** API FastAPI, **lấy uid từ token**, bỏ `uid`/fallback `GMAIL_UID` từ client, escape HTML callback, OAuth state lưu Firestore có TTL. Kiểm tra 22/10/2026: code **chưa có xác thực nào**, `/api/gmail/*` vẫn fallback `GMAIL_UID`, BE đã chạy trên VPS → Gmail vẫn dùng nên **không gỡ** `gmail_router`, mà phải khóa bằng xác thực. Việc vận hành tạm (không sửa code, user quyết định): xóa `GMAIL_UID` khỏi `.env` trên VPS — đổi lại các màn đang dựa vào fallback (ledger-8 portal links) ngừng chạy đến khi có đăng nhập. §4 bước 3 (quy tắc kiểm tra HĐ) + §10 (không log nội dung HĐ, email là dữ liệu không tin cậy) → dùng cho bước 1 | M1–M5 (email → AI đọc PDF → `purchase_invoices` → đối chiếu GDT): **thay bằng import thư mục XML của app FDI** (XML đủ mọi HĐ vào/ra). §5 quota AI: không cần. §6 review `ai_extractor`: thuộc "hóa đơn AI" của BanHang, không thuộc KeToan. §7 hạ tầng: đã làm (VPS ketoan.songminhcr.com) |
| `plan.md` (02/06/2026 — HĐ đầu vào Gmail/AI/GDT portal) | Chỉ còn là mô tả code đang có (ledger-8/9, `/api/gmail/portal-links`, `internal_invoices`) — dọn ở pha 6 | Toàn bộ hướng Gmail → AI → `internal_invoices` → đối chiếu GDT, Playwright tải cổng NCC, đăng nhập GDT captcha |
| `plan-gdt-extension.md` | Mục 13 (Đối soát CK, Xuất bảng quy đổi) | Extension / tải XML từ cổng thuế |
| `handoff.md` | Quy tắc "KeToan FE không gọi Flask BE" (22/10/2026 mở rộng: **mọi backend của KeToan chỉ ở FastAPI**); mô tả kiến trúc hiện tại | Các bước Gmail / portal-links (theo `plan.md`) |

## 4. Dữ liệu & ràng buộc kỹ thuật

- Bản ghi HĐ đi qua các bước, khóa `MST người bán | ký hiệu | số`, trạng thái: `ĐÃ NHẬP → (ngoại lệ) → ĐÃ KHỚP SAO KÊ /
  TIỀN MẶT / CHƯA THANH TOÁN → ĐÃ HẠCH TOÁN`; HĐ bị thay thế / điều chỉnh / hủy → "cần xem lại".
- XML được nén ZIP và upload lên **KeToanBackEnd để phân tích** bằng code của `doi_soat.py` (kiến trúc B, user 22/10/2026 —
  `plan-doi-soat-web.md` mục 3); file XML xóa sau khi phân tích, chỉ giữ dữ liệu đã phân tích; không sửa XML gốc.
- `handoff.md`: KeToan FE **không gọi** Flask BE; 2 nền tảng chỉ dùng chung Firebase. 22/10/2026: mọi backend của KeToan
  (kể cả đăng nhập / verify email) viết trong TapHoa39KeToanBackEnd (FastAPI), không thêm vào Flask.
- `services/kiotviet.service.ts` của KeToan gọi `/api/kiotviet/*` trên TapHoa39KeToanBackEnd nhưng BE này **không có**
  route KiotViet nào → code chết (chép từ BanHang), dọn khi làm.
- **Module KiotViet ở KeToanBackEnd (quyết định 11):** port `TapHoa39BackEnd/FromKiotViet/get_authorization.py` (đăng nhập
  `api-man1.kiotviet.vn/api/account/login`, `IsManageSide: true`) sang FastAPI (`httpx`). Credential (`User` / `Password` /
  `LatestBranchId` / `retailer`) là **bản sao thứ 5**, đặt trong env VPS KeToan, không đưa vào repo. Cache token (hạn 28
  ngày), đăng nhập lại khi 401; login trả 200 mà token rỗng = sai credential → log cảnh báo rõ (lỗi đã gặp 02/09/2026). Job
  chỉ **đọc** KiotViet / einvoice: không ghi, không đánh sao, không phát hành. Module dùng cho 3 việc: HĐ chuyển khoản (bước 2),
  HĐ nháp einvoice (bước 4), **bảng quy đổi ĐVT** (bước 1 — port `FromKiotViet/get_entire_product.py` `get_all()` +
  `routes/kiotviet_routes.py` `_build_unit_conversion()`). Logic bảng quy đổi chép từ Flask → **vùng mirror mới giữa 2
  backend** (ghi vào `CLAUDE.md` gốc khi code). Scheduler chỉ chạy ở **1 tiến trình** (uvicorn
  1 worker hoặc có khóa) để job không chạy trùng.
- Không sửa FE và BE trong cùng 1 bước; mỗi bước build + test; cập nhật `docs/` theo quy tắc repo.

## 5. Câu hỏi còn lại cho user

1. ~~**Mẫu thư mục FDI**~~ — đã trả lời 22/10/2026: sau khi tải từ FDI, trên máy kế toán là
   `D:\D\TAI HOA DON HANG LOAT\0402318272\T9\0402318272\purchase\xml` (HĐ **đầu vào**) và `…\T9\0402318272\sold\xml` (HĐ
   **đầu ra**) → cấu trúc `<gốc>\<MST>\T<tháng>\<MST>\{purchase|sold}\xml` (MST lặp 2 lần). Chi tiết: `plan-doi-soat-web.md`
   mục 2. File XML thật để thử đã có ở `C:\Users\Hello\Downloads\doi-soat-mau\`.
2. ~~**Bước 4**~~ — đã trả lời 22/10/2026: job chạy tự động trên VPS (KeToanBackEnd, câu 10) **lúc 24h (00:00) hằng ngày**
   (giờ để trong cấu hình, sửa được) + nút "Kiểm tra ngay"; kết quả **chỉ xem trên page** "Kiểm tra HĐ tự động", không gửi
   thông báo. Lưu ý khi code: (1) lịch chạy theo giờ **Asia/Ho_Chi_Minh**, không theo giờ hệ thống VPS (có thể là UTC);
   (2) lúc 00:00 đã sang ngày mới → kiểm **mọi HĐ nháp `GHI_TAM` còn tồn** (ít nhất từ ngày hôm trước trở về trước), không
   lọc theo "hôm nay".
3. ~~Phụ lục 142, bảng kê~~ — đã trả lời: page / tab bảng có phân trang + xuất Excel / CSV theo bộ lọc.
4. ~~Giá vốn~~ — đã trả lời: **giá trung bình (bình quân gia quyền)**, tính từ HĐ đầu vào (giá chưa thuế, theo ĐVT master),
   **tính lại sau mỗi lần nhập** (22/10/2026 — hết hàng mới nhập). Hệ quả: mục 2 bước 3. Script đang dùng FIFO, web phải đổi.
5. ~~**Chuyển đổi khỏi Vietda**~~ — đã trả lời 22/10/2026: **không chuyển hẳn**; test bằng dữ liệu 2026, 2027 nếu ổn thì
   chuyển dần (quyết định 13, mục 3). Còn hỏi khi bắt đầu test sổ sách: Vietda xuất được số dư **01/01/2026** (TK / công nợ /
   tồn kho SL + giá trị) và sổ nhật ký chung 2026 ra Excel không?
6. ~~**Sao kê**: ngân hàng nào ngoài TPBank~~ — đã trả lời 22/10/2026: **chỉ TPBank** (định dạng: file `.xlsx` "Bảng kê
   giao dịch" mà `tpbank-statement.util.ts` của BanHang đang đọc).
7. ~~**Người dùng**~~ — đã trả lời 22/10/2026: **nhiều kế toán dùng chung**, hiện whitelist chỉ 1 email
   `songminhcr.dn@gmail.com`; **sau này có phân quyền** (`user-roles-page`). Hệ quả: khi dùng chung 1 tài khoản, Dấu vết kiểm
   toán chưa phân biệt được người làm → schema người dùng / vai trò làm sẵn để thêm email + phân quyền sau.
8. ~~**Quy tắc định khoản**~~ — đã có 22/10/2026: `DINH KHOAN.xlsx` (bảng ở mục 2 bước 3). Còn 4 điểm kế toán xác nhận
   (cuối bảng đó: chiết khấu / khuyến mại / phí NH / HĐ điều chỉnh; 5112 hay 5113; 6321; XK2, CK3) — hỏi khi làm bước 3.
9. Câu hỏi riêng bước 1: `plan-doi-soat-web.md` mục 9 — 22/10/2026: kiến trúc **B** (chạy ở KeToanBackEnd, dùng lại
   `doi_soat.py`), trình duyệt + script đã giải quyết theo B; câu i: bảng quy đổi ĐVT KeToanBackEnd tự lấy từ KiotViet.
10. ~~**Token KiotViet cho job**~~ — đã trả lời 22/10/2026: **(b)** job chạy ở KeToanBackEnd với credential KiotViet riêng
    (bản sao thứ 5) — quyết định 11. Các phương án bị loại: (a) chạy ở Flask (trái quyết định 8); (c) Flask chia sẻ token
    qua Firestore (vẫn phụ thuộc Flask).
11. ~~**Tài khoản đăng nhập kiêm Gmail**~~ — đã trả lời 22/10/2026: `songminhcr.dn@gmail.com` là hộp thư chứa HĐ đầu vào →
    Gmail luôn đọc hộp thư này, ai đăng nhập cũng vậy (Pha 0 mục 6). Ai được đăng nhập: theo whitelist (câu 7).

## 6. Thứ tự làm đề xuất

| Pha | Nội dung | Phía |
|---|---|---|
| 0 | **Bảo mật trước** (M0, mục 3b): (BE) `get_current_user` verify Firebase ID token cho **mọi** API FastAPI, uid lấy từ token, bỏ fallback `GMAIL_UID`, escape callback, OAuth state vào Firestore; (FE) **trang đăng nhập Google** thay `hddt-token-dialog`, kiêm Gmail `gmail.readonly`, guard + interceptor. Sau đó: **menu 3 mục** (Tiện ích / Kế toán chi tiết / Thiết lập) + chọn kỳ; lưu trữ server | BE trước, rồi FE (tách bước) |
| 1 | Bước 1: page Tiện ích "Đối soát hóa đơn XML" — chọn thư mục FDI → upload → đối soát (`plan-doi-soat-web.md` mục 10); nối vào kho / hạch toán làm sau. 22/10/2026: (Script) tách module **xong**; (BE) API + module KiotViet **xong** (`TapHoa39KeToanBackEnd/docs/RECONCILIATION.md`); 23/10: (FE) page **xong**; bước 4 Ánh xạ hàng hóa **xong** | (Script) tách module → (BE) endpoint → (FE) page |
| 4 | Bước 4 (đổi token đã thử OK 21/10/2026): job kiểm HĐ nháp hằng ngày → Firestore → page "Kiểm tra HĐ tự động" (Tiện ích). Kiểm số học làm được ngay; kiểm thuế suất cần danh mục thuế suất đúng theo mã master (bước 1). **XONG 23/10/2026** (`TapHoa39KeToanBackEnd/docs/TIEN-ICH-JOBS.md`): thuế suất đúng = kế toán đặt > HĐ vào gần nhất (mỗi lần đối soát XML tự cập nhật); lệch 1–2đ do KiotViet làm tròn từng dòng không báo lỗi. 23/10: so tổng tiền với HĐ bán KiotViet (Kiểm gì #3 một phần) + link mở đúng HĐ. Chưa làm: HĐ bán chưa chuyển nháp, lỗi chuyển, HĐ bị CQT từ chối | (BE) module KiotViet + scheduler + job ở KeToanBackEnd → Firestore → (FE) KeToan |
| 2 | Bước 2: Đối soát CK (TPBank, HĐ CK qua phương án C). **XONG 23/10/2026**: Firestore `kiotviet_transfer_days` (theo ngày, job 00:20 + page tự lấy ngày thiếu); page port BanHang, utils mirror. Menu Đối soát CK = 2 mục con: "Chuyển khoản HĐ đầu ra" (xong) + "Chuyển khoản HĐ đầu vào" (HĐ vào ↔ tiền trả NCC — chờ, user 23/10). Chưa làm: sinh phiếu thu | (BE) job lấy HĐ CK ở KeToanBackEnd → Firestore → (FE) page chép từ BanHang |
| 3 | Bước 3: hạch toán + sổ sách (sau khi duyệt quy tắc định khoản) | FE + BE |
| 5 | Lương; số liệu khai thuế (copy / paste); cuối kỳ, khóa sổ; BCTC | FE |
| 6 | Chuyển dần khỏi Vietda (2027, nếu ổn — quyết định 13): nhập số dư tại ngày dùng thật, từng phần một; dọn page / code cũ | |
