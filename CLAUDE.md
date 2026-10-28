# TapHoa39KeToan

Ke toan ho kinh doanh, chuan TT 133/2016 + TT 78/2021. Angular 19, FastAPI backend (port 8000).

## Routes (14 active / 40 total)
dashboard, journal, ledger, trial-balance, balance-sheet (B01-DNN), income-statement (B02-DNN, 15 chi tieu), cash-flow (B03-DNN), chart-of-accounts (70 TK), cash-vouchers, invoices, period-lock, audit-trail + 26 placeholder

## Logging — BAT BUOC cho moi code moi / code sua (user 22/10/2026)
- `console.info` buoc chinh + ket qua; `console.warn` tu choi / loi co xu ly (kem ly do); `console.error` loi khong mong doi; `console.debug` log moi request. Prefix `[TenService/Component]`: `[Auth]`, `[AuthGuard]`, `[AuthInterceptor]`, `[Login]`, `[MainLayout]`…
- Loi HTTP tu BE: log bang `httpErrorText(err)` (`services/auth.service.ts` → "HTTP 403 — <detail cua BE>"); thong bao cho nguoi dung phai noi dung ly do (401 khac 403 khac mat ket noi), khong gop chung.
- Moi `catch` / `error:` callback phai log, khong nuot loi im lang.
- KHONG log: ID token, access token Gmail, mat khau, du lieu ke toan chi tiet. Duoc log: email, uid, URL API, ma trang thai, so luong.

## Critical Rules
- Dang nhap (22/10/2026): Google qua Firebase Auth project `quanlysongminh` (`services/auth.service.ts`, SDK `firebase` thuan); `/login` + `authGuard` cho moi route; `authInterceptor` gan `X-Id-Token` cho request HttpClient len KeToanBackEnd (whitelist o BE `KETOAN_ALLOWED_EMAILS`). Request dung `fetch()` truc tiep KHONG duoc gan token. Gmail luon la hop thu hoa don cua BE, khong gui `uid`. 28/10/2026: Gmail CHI con dung cho Dem nhanh (ledger-8, `message-count` + `labels`); da go portal-links / scrape / doi chieu Gmail. Link mo Gmail dung `?authuser=<email>`, KHONG `/mail/u/<email>/` (404).
- Link HD goc (28/10/2026): ma tra cuu doc tu XML theo `MSTTCGP` (`utils/invoice-lookup.util.ts` `PROVIDERS` — NCC HDDT moi thi them vao day) → `InvoiceLookupService` → BE `/api/invoice-lookups` (Firestore `invoice_lookups`). HD dau ra: ma = `verify_code` HDDT KiotViet (XML may tinh tien khong co ma). NCC HDDT chua biet / nguoi ban co trang tra cuu rieng (VNPT, BKAV) → ke toan GAN TAY o ledger-8 (`/api/invoice-lookups/portals`, Firestore `invoice_lookup_portals`; link chua ma → link mau `{code}`), khong can sua `PROVIDERS`.
- Menu (22/10/2026): sua `layouts/main-layout/menu.config.ts` (Tien ich / Ke toan chi tiet / Thiet lap), khong sua HTML sidebar.
- Ky dung chung: page moi doc ky tu `PeriodService` (`period()` / `period$`), KHONG tu lam bo loc thang/nam rieng; trang khong theo ky → route data `noPeriodBar: true`.
- Event binding KHONG duoc tra ve `false` (vd `(click)="flag = false"`): Angular goi `preventDefault()` → chan mo hop thoai chon file, tick checkbox / radio. Goi ham tra void (loi 23/10/2026 o `main-layout` lam nut "Chon thu muc" khong mo).
- Bang nhieu dong: dung `components/shared/server-table` (phan trang / loc / sap xep / xuat Excel-CSV lam o BE) — quy uoc chung moi bang.
- `src/app/utils/transfer-reconcile.util.ts` (+ spec), `utils/tpbank-statement.util.ts` = MIRROR giong het TapHoa39BanHang (Doi soat CK, 23/10/2026) — sua 1 ben phai sua ben kia (CLAUDE.md goc).
- App bat `eventCoalescing` → DOM cap nhat tre 1 khung hinh sau click; test E2E phai cho (wait) sau cu bam chi doi giao dien.
- 70 tai khoan TT 133/2016, 7 loai so S1-S7 HKD
- Cash voucher: DRAFT → POSTED → CANCELLED (chi sua/xoa khi DRAFT)
- Period lock: khoa xong khong sua but toan

## Docs
`docs/`: OVERVIEW, COMPONENTS, SERVICES, MODELS, ROUTES, STATUS

## Plan dang lam (21/10/2026) — doc theo thu tu
1. `plan-ketoan-flow.md` — PLAN TONG: KeToan THAY VIETDA (lam day du ke toan); menu 3 muc Tien ich / Ke toan chi tiet / Thiet lap (22/10); import thu muc XML tu app FDI → doi chieu sao ke (Doi soat CK, TPBank) → hach toan thu/chi; job tu dong kiem HD dau ra truoc phat hanh; to khai: chi hien so de copy/paste vao HTKK. Backend KeToan CHI FastAPI (khong Flask). Pha 0 = M0 bao mat + trang dang nhap Google kiem Gmail. Muc 5 = cau hoi phai hoi user truoc khi code. Job KiotViet (Doi soat CK + kiem HD dau ra) chay o KeToanBackEnd, tu dang nhap KiotViet (credential ban sao thu 5 — quyet dinh 11, 22/10). Trang thai that tung page: `docs/STATUS.md` muc "Trang thai thuc te" (22/10: 0/39 page hoan chinh du lieu).
2. `plan-doi-soat-web.md` — chi tiet buoc 1: doi soat hoa don XML (doc tu thu muc local, KHONG tai tu cong thue) + to khai TNCN tu bang luong; ban tham chieu: `tools/doi-soat-hoa-don/doi_soat.py`.
`plan-gdt-extension.md`: phan extension/tai XML tu CQT DA HUY. `plan.md` (Gmail/AI/GDT portal): HET HIEU LUC.
`TapHoa39KeToanBackEnd/docs/INVOICE-EMAIL-PIPELINE.md`: chi con M0 bao mat (lam DAU TIEN — BE chua co auth, /api/gmail/* mo, Gmail van dung → khoa bang xac thuc, khong go) + quy tac kiem tra HD; M1–M5 bo.
