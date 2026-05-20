# PLAN: Hóa Đơn Đầu Vào — End-to-End Flow

## Tổng quan

**Full Flow:**
```
Gmail nhận email HĐ từ NCC (78 nhà cung cấp, 11 portal providers)
    ↓
TapHoa39BanHang (FE): User đọc Gmail trực tiếp / download PDF-XML files
    → Tab Email: chọn label NCC → list emails → click email → processEmail()
    → Tab XML: drag-drop XML file
    → Tab PDF: drag-drop PDF/JPG/PNG → Gemini AI đọc
    ↓
TapHoa39BackEnd (BE):
    → Parse XML (TaxInvoiceXMLParser) / AI đọc PDF (Gemini Flash+Pro)
    → Extract portal URL từ nội dung email (EmailBodyParser)
      Ví dụ: email Viettel có link "tại đây" → https://vinvoice.viettel.vn/tracuu?tax-code=...&secret-code=...
    ↓
TapHoa39BanHang (FE): invoice-processing-page
    → Hiển thị nội dung HĐ đã parse → user review + fuzzy match sản phẩm
    → User click "Cập nhật giá" → localStorage
    → User click "Lưu Firestore" → saveAiInvoice()
    ↓
Firebase (taphoa39-supplies-invoices):
    → internal_invoices: nội dung HĐ (parsed data) + portalUrl + email metadata
    ↓
TapHoa39KeToan (FE): Load từ internal_invoices → hiển thị + đối chiếu
    → Button "Xem HĐ gốc" → window.open(portalUrl) mở portal NCC
    ↓
TapHoa39KeToanBackEnd (BE): Đối chiếu HDDT Portal (trang thuế) vs internal_invoices (Gmail/AI data)
```

**3 Projects liên quan:**

| Project | Role | Stack | Status |
|---------|------|-------|--------|
| TapHoa39BanHang + BackEnd | Thu thập HĐ từ Gmail/file | Angular + Flask | ~60% done |
| TapHoa39KeToan + BackEnd | Đối chiếu + kế toán | Angular + FastAPI | ~30% done |
| Firebase | Lưu trữ chung | Firestore + Storage | Shared |

---

## PHẦN A: HIỆN TRẠNG — Code đã có (~60%)

### A.1 TapHoa39BanHang — Frontend (Angular)

#### invoice-processing-page.component.ts — ĐÃ CÓ
- **4 tabs:** upload XML, PDF (AI), Email (Gmail), Clone Image
- Tab XML: drag-drop XML → gọi `/v1/parse-xml` → populate form
- Tab PDF: drag-drop PDF/JPG/PNG → gọi `/v1/process-invoice` (Gemini Flash/Pro) → populate form
- Tab Email: list Gmail labels → list emails → process attachment (XML/ZIP/PDF)
- Tab Clone: upload ảnh → gọi `/v1/process-image` → match clone products
- Fuzzy matching: match invoice items → IndexedDB products (KM vs non-KM pools)
- Checkbox selection: chọn items để cập nhật giá
- Session cache: `sessionStorage` persist data across dialog open/close
- Tab state isolation: mỗi tab có state riêng (processingResult, matchedProducts)

#### invoice-price-update.service.ts — ĐÃ CÓ
- `updatePricesFromInvoice()` — cập nhật giá sản phẩm gốc (non-clone)
- `updateClonePricesFromInvoice()` — cập nhật giá clone products
- Unit matching: 3 fallback levels (exact → word-by-word → price-inferred → largest unit)
- Promotional item handling: KM items chỉ cập nhật tồn kho, không đổi giá
- Duplicate master detection + promo quantity accumulation
- Save to `localStorage` → product-row component reads + recalculates

#### recent-invoices-dialog.component.ts — ĐÃ CÓ
- Dialog hiển thị HĐ đã xử lý trong 24h
- Load từ `InvoiceServiceV2.getRecentAiInvoices()`
- Click chọn → load lại data vào form

#### gmail.service.ts — ĐÃ CÓ
- `listLabels()` → `GET /api/gmail/labels`
- `listEmails(labelId, daysBack)` → `GET /api/gmail/emails`
- `processEmail(emailId)` → `POST /api/gmail/emails/{id}/process`
- `connectGmail()` → OAuth popup flow
- `checkAuthStatus()` → `GET /api/gmail/auth/status`
- Static helpers: `hasXml()`, `hasPdf()`, `hasZip()`, `getAttachmentBadge()`

#### invoice.service.v2.ts — ĐÃ CÓ
- `saveAiInvoice(data)` → `POST /api/invoices/save-ai-invoice`
- `getRecentAiInvoices(days)` → `GET /api/invoices/recent-ai-invoices`
- `batchImport(invoices, source)` → `POST /api/v2/invoices/batch`
- `importXml(files)` → `POST /api/v2/invoices/import-xml`
- `getInvoices(filter)` → `GET /api/v2/invoices`
- `runReconciliation()` → `POST /api/v2/invoices/reconciliation/run`
- Interfaces: `AiInvoiceData`, `RecentAiInvoice`, `Invoice`, `ReconciliationResult`

### A.2 TapHoa39BackEnd — Backend (Flask)

#### routes/invoice_processing.py — ĐÃ CÓ
- `POST /v1/process-invoice` — PDF/image → Gemini Flash → validate → Pro recheck
- `POST /v1/process-image` — Clone image → Gemini Flash (ignore handwriting) → Pro recheck
- `POST /v1/parse-xml` — XML file → `TaxInvoiceXMLParser.parse()`

#### routes/gmail_routes.py — ĐÃ CÓ
- `GET /api/gmail/auth/url` — OAuth2 authorization URL
- `GET /api/gmail/auth/callback` — OAuth2 callback, save tokens to Firestore
- `POST /api/gmail/auth/save` — Save Gmail tokens
- `GET /api/gmail/auth/status` — Check auth status (hasTokens, hasRefreshToken)
- `GET /api/gmail/labels` — List Gmail labels
- `GET /api/gmail/emails` — List emails with metadata
- `POST /api/gmail/emails/{id}/process` — Process attachment:
  - XML → parse with TaxInvoiceXMLParser
  - ZIP → extract XML → parse | extract PDF → return base64
  - PDF → return base64 for frontend Gemini processing
  - None → return type='none'

#### routes/invoice_routes_v2.py — ĐÃ CÓ
- `GET /api/v2/invoices` — Query với filter & pagination (cursor-based)
- `POST /api/v2/invoices` — Create invoice
- `POST /api/v2/invoices/batch` — Batch import
- `POST /api/v2/invoices/import-xml` — Import XML files
- `GET /api/v2/invoices/suppliers` — Supplier list
- Reconciliation: summary, run, results, delete
- Clear: by source, all

#### routes/supplies_invoice_routes.py — ĐÃ CÓ
- `POST /api/invoices/save-ai-invoice` — Save AI-parsed invoice to Firestore
- `GET /api/invoices/recent-ai-invoices` — Get recent AI invoices
- Saves to `internal_invoices` collection in `taphoa39-supplies-invoices` project
- Duplicate prevention: `invoiceKey = "{invoiceNo}|{supplierTaxCode}"`

#### services/ai_extractor.py — ĐÃ CÓ
- `AIExtractor` class with Gemini Flash + Pro
- `extract_from_pdf_with_markitdown()` — MarkItDown → text → Gemini Flash
- `extract_from_image_with_flash()` — Vision-based extraction
- `recheck_with_pro()` — Pro recheck for low confidence
- Confidence scoring + low_confidence_fields detection

#### services/invoice_parsers.py — ĐÃ CÓ
- `TaxInvoiceXMLParser` — Full XML parser:
  - 3 XML structures: `<HDon><DLHDon>`, `<HoaDonDienTu>`, container
  - Sections: TTChung, NBan, NMua, TToan, NDHDon
  - TTKhac parsing (VATAmount, Amount per item)
  - Per-item tax amount + amount_after_tax
- `TaxInvoiceExcelParser` — Excel from tax portal
- `LocalInvoiceJSONParser` — JSON from OCR

#### services/zip_extractor.py — ĐÃ CÓ
- `extract_xml_from_zip()` — First XML from ZIP
- `extract_pdf_from_zip()` — First PDF from ZIP
- `list_zip_contents()` — List files in ZIP

### A.3 Firebase — Hiện tại

**Firestore Collections:**

| Collection | Project | Content |
|-----------|---------|---------|
| `tax_invoices` | taphoa39-supplies-invoices | HĐ từ HDDT Portal (trang thuế) |
| `internal_invoices` | taphoa39-supplies-invoices | HĐ parse từ AI/XML (TapHoa39BanHang save) |
| `invoice_reconciliation` | taphoa39-supplies-invoices | Kết quả đối chiếu |
| `users` | quanlysongminh | Gmail OAuth tokens |

### A.4 TapHoa39KeToan — Frontend (Angular) — Hiện tại

#### ledger-8-dong-bo-hoa-don-v2 — ĐÃ CÓ
- Dual-table: TAX_PORTAL vs AI_PDF
- Cursor-based pagination (25/page)
- Filters: date, month, year, supplier, reconcile status
- IndexedDB caching (`TapHoa39KeToanDB`)
- XML import (manual upload)
- Reconciliation engine with field-level diff
- Side-by-side comparison modal

#### invoice.service.v2.ts (KeToan version) — ĐÃ CÓ
- Same interfaces as BanHang version
- Calls same `/api/v2/invoices` endpoints
- Additional: `ReconciliationResult`, `FieldDiff` interfaces

#### hddt.service.ts — ĐÃ CÓ
- Integration with hoadondientu.gdt.gov.vn
- SVG captcha solving
- Token management
- Multi-page invoice fetching

### A.5 TapHoa39KeToanBackEnd — Backend (FastAPI) — Hiện tại

#### routes/hddt_proxy_routes.py — ĐÃ CÓ
- Proxy cho GDT API (tránh CORS)
- SVG captcha solver with pattern matching
- Login, fetch purchase invoices

#### routes/invoice_routes.py — ĐÃ CÓ (Phase 3 complete)
- `GET /api/v2/invoices` — query với filter + pagination
- `GET /api/v2/invoices/default` — last 30 days
- `GET /api/v2/invoices/suppliers` — unique suppliers
- `GET /api/v2/invoices/providers` — unique providers
- Reconciliation: summary, run, results, delete
- Clear: by source, all
- Legacy: `GET /api/invoices/internal`, `GET /api/invoices/suppliers`, `GET /api/invoices/providers`

#### services/invoice_service.py — ĐÃ CÓ (Phase 3 complete)
- `InvoiceService` — full Firestore CRUD cho `taphoa39-supplies-invoices`
- Source → collection: TAX_PORTAL → `tax_invoices`, AI_PDF → `internal_invoices`
- Cursor-based pagination, date format auto-detection
- Reconciliation engine: MATCH/MISMATCH/MISSING_INTERNAL/MISSING_TAX

#### services/invoice_parsers.py — ĐÃ CÓ (Phase 3 complete)
- `TaxInvoiceXMLParser` — parse XML từ GDT (copy từ Flask BE)

#### Existing services — ĐÃ CÓ
- Cash voucher CRUD
- Warehouse voucher CRUD
- Firebase config (dual project: ketoan + supplies-invoices)

---

## PHẦN B: CẦN LÀM — Hoàn thiện End-to-End

### B.1 TapHoa39BanHang — THIẾU gì?

#### B.1.1 Extract portal URL từ email body — CHƯA CÓ

**Hiện tại:** Chỉ lưu parsed data (JSON) vào Firestore `internal_invoices`. Không lưu link tra cứu HĐ gốc.

**Thay đổi:** KHÔNG upload file lên Firebase Storage. Thay vào đó, parse email body (HTML) để extract URL link tra cứu/download HĐ từ portal NCC.

**Ví dụ email body từ Viettel (thực tế):**
```
Quý khách có thể tra cứu lại hóa đơn điện tử tại
<a href="https://vinvoice.viettel.vn/utilities/invoice-search">
    https://vinvoice.viettel.vn/utilities/invoice-search
</a> theo mã số bí mật 2B7FIETJ3HEFMD9
```
→ Extract: portalUrl = `https://vinvoice.viettel.vn/utilities/invoice-search`
→ Extract: credentials = `{ secretCode: "2B7FIETJ3HEFMD9" }`
→ Provider: VIETTEL (nhóm B — URL không params, cần credentials)

**Thêm service mới:** `TapHoa39BackEnd/services/email_body_parser.py`

```python
class EmailBodyParser:
    """Parse email HTML body để extract portal URL cho HĐ"""

    # ══════════════════════════════════════════════════════════════
    # 11 PROVIDERS — Extracted từ email mẫu thực tế (13/05/2026)
    # ══════════════════════════════════════════════════════════════
    #
    # NHÓM A — Direct URL (href chứa đủ params, extract trực tiếp):
    #   1. VIN_HOADON   — tracuu.vin-hoadon.com/tracuuhoadon/thongtinchung?mstdoanhnghiep=...&masobimat=...
    #   2. MISA         — www.meinvoice.vn/tra-cuu/?sc=...&m=...
    #   3. VNPT         — {subdomain}.vnpt-invoice.com.vn/Email/EmailInvoiceView?token=...
    #   4. ASIAINVOICE  — tt78.asiainvoice.vn/EinvoiceView?token=...
    #   5. KIOTVIET     — tracuuhoadon.kiotviet.vn/?shd=...&mtc=...
    #   6. EHOADON      — tracuu.ehoadon.vn/{MA_TRA_CUU}
    #
    # NHÓM B — URL + Credentials (URL không params, cần extract text credentials):
    #   7. MOBIFONE     — tracuuhoadon.mobifoneinvoice.vn/ + Mã đơn vị + Mã bảo mật
    #   8. VIETTEL      — vinvoice.viettel.vn/utilities/invoice-search + mã số bí mật
    #   9. MINVOICE     — tracuuhoadon.minvoice.vn/ + MST bên bán + Mã tra cứu
    #  10. EINVOICE     — einvoice.vn/tra-cuu + Mã tra cứu hóa đơn
    #
    # NHÓM C — AWS Tracking Wrapper (cần unwrap awstrack.me → actual URL):
    #  11. WININVOICE   — awstrack.me wraps tracuu.wininvoice.vn/?mst=...&code=...
    #      (EINVOICE cũng dùng awstrack.me nhưng URL không có params → vẫn nhóm B)

    PROVIDER_PATTERNS = {
        # ── NHÓM A: Direct URL extract ──────────────────────────
        'VIN_HOADON': {
            'group': 'A',
            'url_contains': ['vin-hoadon.com'],
            'href_pattern': r'https?://tracuu\.vin-hoadon\.com/tracuuhoadon/thongtinchung\?[^"]+',
            # Sample: https://tracuu.vin-hoadon.com/tracuuhoadon/thongtinchung?mstdoanhnghiep=0402114198&masobimat=2D2QYQPGRGSC&loaitracuu=1
            # Bonus PDF: https://tracuu.vin-hoadon.com/File/TaiPdfLinkTraCuu?mstdoanhnghiep=...&masobimat=...
            'pdf_href_pattern': r'https?://tracuu\.vin-hoadon\.com/File/TaiPdfLinkTraCuu\?[^"]+',
        },
        'MISA': {
            'group': 'A',
            'url_contains': ['meinvoice.vn'],
            'href_pattern': r'https?://www\.meinvoice\.vn/tra-cuu/\?sc=[^"]+',
            # Sample: https://www.meinvoice.vn/tra-cuu/?sc=9GF2C925494L&m=songminhcr.dn@gmail.com&n=...&c=&b=&d=0&t=1&r=1
            # Chú ý: email có 2 link meinvoice — lấy link có "?sc=" (có params)
        },
        'VNPT': {
            'group': 'A',
            'url_contains': ['vnpt-invoice.com.vn'],
            'href_pattern': r'https?://[a-z0-9-]+\.vnpt-invoice\.com\.vn/Email/EmailInvoiceView\?token=[^"]+',
            # Sample: https://betagen-tt78.vnpt-invoice.com.vn/Email/EmailInvoiceView?token=0EgSPZw521s%2fEyeYtUM20Ij1pjy9VZE9P7gqyVD2Cqg%3d
            # Subdomain thay đổi theo NCC (betagen-tt78, ...)
            # Bonus PDF: https://{subdomain}.vnpt-invoice.com.vn/Email/PdfDownload?token=...
            'pdf_href_pattern': r'https?://[a-z0-9-]+\.vnpt-invoice\.com\.vn/Email/PdfDownload\?token=[^"]+',
        },
        'ASIAINVOICE': {
            'group': 'A',
            'url_contains': ['asiainvoice.vn'],
            'href_pattern': r'https?://[a-z0-9]+\.asiainvoice\.vn/EinvoiceView\?token=[^"]+',
            # Sample: https://tt78.asiainvoice.vn/EinvoiceView?token=NjIyd1NPMzAwMDAwMzUzNTAxNTk7NjIy
            # Email cũng chứa text "mã tra cứu: {TOKEN}" nhưng URL đã đủ
        },
        'KIOTVIET': {
            'group': 'A',
            'url_contains': ['kiotviet.vn'],
            'href_pattern': r'https?://tracuuhoadon\.kiotviet\.vn/\?shd=[^"]+',
            # Sample: https://tracuuhoadon.kiotviet.vn/?shd=158&mtc=AYAHS4HIAS26158
        },
        'EHOADON': {
            'group': 'A',
            'url_contains': ['ehoadon.vn'],
            'href_pattern': r'https?://tracuu\.ehoadon\.vn/[A-Z0-9]+',
            # Sample: http://tracuu.ehoadon.vn/WQ8OATOBZS3
            # Mã tra cứu nằm ngay trong URL path
        },

        # ── NHÓM B: URL + Credentials extract ──────────────────
        'MOBIFONE': {
            'group': 'B',
            'url_contains': ['mobifoneinvoice.vn'],
            'href_pattern': r'https?://tracuuhoadon\.mobifoneinvoice\.vn/?',
            'portal_url': 'http://tracuuhoadon.mobifoneinvoice.vn/',
            # Credentials trong email body (HTML <li> tags):
            #   <li>Mã đơn vị: <strong>0401554196</strong></li>
            #   <li>Mã bảo mật:<strong> e9a6323</strong></li>
            'credential_patterns': {
                'taxCode': r'Mã đơn vị[:\s]*<strong>([^<]+)</strong>',
                'secretCode': r'Mã bảo mật[:\s]*<strong>\s*([^<]+)</strong>',
            },
        },
        'VIETTEL': {
            'group': 'B',
            'url_contains': ['vinvoice.viettel.vn'],
            'href_pattern': r'https?://vinvoice\.viettel\.vn/utilities/invoice-search',
            'portal_url': 'https://vinvoice.viettel.vn/utilities/invoice-search',
            # Credentials trong email body (inline text):
            #   "...theo mã số bí mật 2B7FIETJ3HEFMD9"
            #   MST bên bán: extract từ email subject hoặc context
            'credential_patterns': {
                'secretCode': r'mã\s*số\s*bí\s*mật\s+([A-Z0-9]+)',
                # taxCode: lấy từ email metadata (subject/from) hoặc parsed invoice data
            },
        },
        'MINVOICE': {
            'group': 'B',
            'url_contains': ['minvoice.vn', 'minvoice.com.vn'],
            'href_pattern': r'https?://tracuuhoadon\.minvoice\.(?:vn|com\.vn)/?',
            'portal_url': 'http://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don',
            # Credentials trong email body (HTML <li> Bước 2, Bước 3):
            #   <li>Bước 2: ...MST... <strong>2301353595</strong></li>
            #   <li>Bước 3: ...Mã tra cứu: <strong>DC8EC4A9</strong></li>
            'credential_patterns': {
                'taxCode': r'Bước 2[^<]*<strong>(\d{10,13})</strong>',
                'secretCode': r'Bước 3[^<]*<strong>\s*([A-Z0-9]+)</strong>',
            },
        },
        'EINVOICE': {
            'group': 'B',
            'url_contains': ['einvoice.vn'],
            'href_pattern': r'https?://(?:[^/]*\.)?einvoice\.vn/tra-cuu',
            'portal_url': 'https://einvoice.vn/tra-cuu',
            # Chú ý: URL trong email wrapped qua awstrack.me — cần unwrap hoặc dùng portal_url cố định
            # Credentials trong email body:
            #   "Mã tra cứu hóa đơn:" → dòng tiếp theo: <strong>F7DEEGSU5BE</strong>
            'credential_patterns': {
                'lookupCode': r'Mã tra cứu hóa đơn[:\s]*</?\w*>\s*([A-Z0-9]+)',
            },
            # AWS tracking wrapper pattern (nếu cần unwrap):
            'awstrack_pattern': r'https?://[^/]+\.awstrack\.me/L0/https?:%2F%2F(?:[^/]*\.)?einvoice\.vn%2Ftra-cuu[^"]*',
        },

        # ── NHÓM C: AWS Tracking Wrapper (unwrap) ──────────────
        'WININVOICE': {
            'group': 'C',
            'url_contains': ['wininvoice.vn'],
            # URL trong email wrapped qua awstrack.me:
            # https://{id}.r.{region}.awstrack.me/L0/https:%2F%2Ftracuu.wininvoice.vn:443%2F%3Fmst=...%26code=...%26cs_mst=...%26rec_email=...
            # Cần URL-decode phần sau "L0/" để lấy actual URL
            'awstrack_pattern': r'https?://[^/]+\.awstrack\.me/L0/(https?:%2F%2Ftracuu\.wininvoice\.vn[^"]*)/\d+/',
            # Actual URL sau khi decode:
            # https://tracuu.wininvoice.vn/?mst=0401972570&cmpn=0401972570&code=ICPWNRDRJP&cs_mst=0402318272&rec_email=songminhcr.dn%40gmail.com
            # Cũng có variant: .../bill/view_inv?token=... (link xem trực tiếp)
            'href_pattern': r'https?://tracuu\.wininvoice\.vn[^"]*',
        },
    }

    def extract_portal_url(self, email_html: str) -> dict:
        """
        Parse HTML → extract portal URL

        Return: {
            'portalUrl': 'https://tracuu.vin-hoadon.com/tracuuhoadon/thongtinchung?...',
            'provider': 'VIN_HOADON',
            'portalPdfUrl': '...',            # Nếu có (VIN_HOADON, VNPT)
            'credentials': {                   # Chỉ cho nhóm B
                'taxCode': '0402156494',
                'secretCode': '2B7FIETJ3HEFMD9',
                'lookupCode': 'F7DEEGSU5BE',  # Chỉ EINVOICE
            }
        }

        Logic:
        1. Scan tất cả <a href="..."> trong HTML
        2. Match href với url_contains của từng provider
        3. Nhóm A: lấy href có params (match href_pattern) → done
        4. Nhóm B: lấy portal_url cố định + extract credentials từ text
        5. Nhóm C: tìm awstrack.me URL → URL-decode phần L0/ → actual URL
        6. Nếu có awstrack wrapper → unwrap trước khi return
        """

    def extract_credentials(self, email_html: str, provider: str) -> dict:
        """Extract MST + mã bí mật từ email body (cho nhóm B providers)

        Dùng credential_patterns regex từ PROVIDER_PATTERNS[provider]
        """

    def detect_provider(self, email_html: str, from_address: str) -> str:
        """Detect invoice provider từ email content + sender domain

        Logic:
        1. Scan href URLs → match url_contains
        2. Fallback: check from_address domain
        """

    def _unwrap_awstrack(self, awstrack_url: str) -> str:
        """URL-decode awstrack.me wrapper → actual portal URL

        Input:  https://{id}.r.{region}.awstrack.me/L0/https:%2F%2Ftracuu.wininvoice.vn:443%2F%3Fmst=...
        Output: https://tracuu.wininvoice.vn/?mst=...&code=...
        """
```

**Sửa route:** `TapHoa39BackEnd/routes/gmail_routes.py` → `processEmail()`

```python
# Hiện tại: chỉ download attachment (XML/ZIP/PDF)
# THÊM: Parse email body HTML để extract portal URL
# Trả về thêm field 'portalUrl' trong response

@bp.route('/api/gmail/emails/<email_id>/process', methods=['POST'])
def process_email(email_id):
    # ... existing attachment processing ...

    # THÊM: Extract portal URL từ email body
    email_body_html = get_email_body(email_id)  # Gmail API get full message
    parser = EmailBodyParser()
    portal_info = parser.extract_portal_url(email_body_html)

    result['portalUrl'] = portal_info.get('portalUrl', '')
    result['invoiceProvider'] = portal_info.get('provider', '')
    result['portalCredentials'] = portal_info.get('credentials', {})
    return jsonify(result)
```

#### B.1.2 Sửa saveToFirestore() để lưu thêm thông tin — SỬA

**Sửa file:** `invoice-processing-page.component.ts` → `saveToFirestore()`

**Hiện tại** chỉ save `AiInvoiceData`. Cần thêm:

```typescript
const aiInvoiceData: AiInvoiceData = {
    // ... existing fields ...

    // THÊM MỚI:
    sourceTab: this.activeTab,           // 'upload' | 'pdf' | 'email' | 'clone_image'
    gmailMessageId: this.currentEmailId, // ID email Gmail (nếu từ tab email)
    gmailFrom: this.currentEmailFrom,    // Email NCC gửi
    portalUrl: this.currentPortalUrl,    // URL tra cứu HĐ trên portal NCC
    invoiceProvider: this.currentInvoiceProvider, // 'VIETTEL' | 'VNPT' | 'MISA' | ...
    processingMethod: this.processingResult?.processing_method, // 'flash' | 'pro'
};
```

**Sửa BE:** `supplies_invoice_service.py` → `create_ai_invoice()` thêm fields mới vào document.

#### B.1.3 Lưu portal URL khi processEmail thành công — SỬA

**Sửa file:** `invoice-processing-page.component.ts` → `selectEmail()`

Sau khi `processEmail` trả về kết quả:
1. Parse XML/PDF → populate form (đã có)
2. **THÊM:** Lưu `portalUrl` từ response vào state

```typescript
// Trong selectEmail() → sau khi processEmail trả về:
if (result.portalUrl) {
    this.currentPortalUrl = result.portalUrl;
    this.currentInvoiceProvider = result.invoiceProvider || '';
}
```

#### B.1.4 Lưu trữ email metadata khi process từ Gmail — THÊM MỚI

**Sửa file:** `invoice-processing-page.component.ts`

Khi user chọn email từ tab Email, cần lưu lại metadata:
```typescript
private currentEmailId: string = '';
private currentEmailFrom: string = '';
private currentEmailDate: string = '';
private currentPortalUrl: string = '';          // URL tra cứu HĐ trên portal NCC
private currentInvoiceProvider: string = '';     // 'VIETTEL' | 'VNPT' | 'MISA' | ...
```

Update trong `selectEmail()`:
```typescript
this.currentEmailId = email.gmail_id;
this.currentEmailFrom = email.from_address;
this.currentEmailDate = email.date;
// portalUrl được lưu trong B.1.3 sau khi processEmail trả về
```

### B.2 TapHoa39BackEnd — THIẾU gì?

#### B.2.1 EmailBodyParser service — THÊM MỚI

Xem B.1.1 ở trên. File: `TapHoa39BackEnd/services/email_body_parser.py`

#### B.2.2 Sửa processEmail để extract portal URL — SỬA

**Sửa file:** `TapHoa39BackEnd/routes/gmail_routes.py` → `process_email()`

Hiện tại chỉ download attachment. Thêm: parse email body HTML → extract portal URL.

Cần thêm helper để lấy email body HTML từ Gmail API (hiện tại chỉ lấy attachment).

#### B.2.3 Sửa save-ai-invoice để lưu thêm fields — SỬA

**Sửa file:** `firebase/firebase_supplies_invoices/supplies_invoice_service.py`

Thêm fields vào document khi save:
```python
doc = {
    # ... existing fields ...

    # THÊM MỚI:
    'sourceTab': data.get('sourceTab', 'pdf'),
    'gmailMessageId': data.get('gmailMessageId', ''),
    'gmailFrom': data.get('gmailFrom', ''),
    'portalUrl': data.get('portalUrl', ''),              # URL tra cứu HĐ trên portal NCC
    'invoiceProvider': data.get('invoiceProvider', ''),   # 'VIETTEL' | 'VNPT' | 'MISA' | ...
    'processingMethod': data.get('processingMethod', ''),
}
```

#### B.2.4 Dependencies mới cho TapHoa39BackEnd

```
beautifulsoup4==4.12.3    # Parse email HTML body để extract URLs
```

### B.3 TapHoa39KeToan — ĐÃ HOÀN THÀNH (Phase 3 complete)

#### B.3.1 Load data từ Firebase (internal_invoices) — ✅ DONE
- KeToanBackEnd có `invoice_routes.py` với `InvoiceService` direct Firestore access
- `GET /api/invoices/internal` → `internal_invoices` collection
- `GET /api/v2/invoices?source=AI_PDF` → `internal_invoices` collection
- Firebase dual-app config: ketoan + supplies-invoices

#### B.3.2 Mở portal URL tra cứu HĐ gốc — ✅ DONE
- `openPortalUrl(invoice)` → `window.open(portalUrl, '_blank')`
- Provider badge column (11 providers, color-coded)
- "HĐ gốc" button column

#### B.3.3 Reconciliation columns — ✅ DONE
- `sourceTab` badge: upload/pdf/email/clone_image
- `gmailFrom` display
- `processingMethod` badge

#### B.3.4 Firebase project access — ✅ DONE
- Option B implemented: direct Firestore access
- `FIREBASE_SERVICE_ACCOUNT_SUPPLIES_INVOICES` env var

### B.3 Phase 4 — CẦN LÀM

#### B.4.1 Ledger 8 filter simplification — SỬA
- Bộ lọc chỉ giữ date range (fromDate/toDate) + nhà cung cấp + pageSize
- Nhà cung cấp: dùng Gmail labels từ `/api/gmail/labels` (TapHoa39BackEnd)
- Date picker: `<input type="date">` thay vì text dd/mm/yyyy
- Bên HĐ thuế: KHÔNG tự động load từ GDT — chỉ load khi bấm "Tải từ GDT"

#### B.4.2 KeToan environment.ts — SỬA
- Thêm `banHangBackendUrl` để gọi TapHoa39BackEnd (Flask) lấy Gmail labels
- KeToanBackEnd: port 5000, BanHangBackEnd: port 5001 (hoặc ngược lại)

---

## PHẦN C: FLOW CHI TIẾT — Từ Gmail đến Kế Toán

### C.1 Flow 1: User upload XML trực tiếp (Tab XML)

```
User drag-drop XML file
    ↓
FE: POST /v1/parse-xml (FormData)
    ↓
BE: TaxInvoiceXMLParser.parse(xml_bytes)
    ↓
FE: populateFormFromXmlInvoice() → hiển thị form
    ↓
FE: matchInvoiceItemsToProducts() → fuzzy match IndexedDB
    ↓
User chọn items → click "Cập nhật giá"
    ↓
FE: updatePricesFromInvoice() → localStorage
    ↓
User click "Lưu Firestore"
    ↓
FE: saveAiInvoice(data) → POST /api/invoices/save-ai-invoice
    ↓
BE: Save to internal_invoices collection
    ↓
TapHoa39KeToan: GET /api/invoices/internal → load + hiển thị
    (Tab XML không có email body → không có portalUrl)
```

### C.2 Flow 2: User upload PDF/Image (Tab PDF)

```
User drag-drop PDF/JPG/PNG
    ↓
FE: POST /v1/process-invoice (FormData)
    ↓
BE: MarkItDown → Gemini Flash → validate → [Pro recheck]
    ↓
FE: populateForm(result.invoice) → hiển thị
    ↓
FE: matchInvoiceItemsToProducts() → fuzzy match
    ↓
User review + chọn items → "Cập nhật giá"
    ↓
FE: saveAiInvoice(data) → Firestore
    ↓
TapHoa39KeToan: Load + hiển thị
    (Tab PDF không có email body → không có portalUrl)
```

### C.3 Flow 3: User đọc từ Gmail (Tab Email) — FLOW CHÍNH

```
Gmail nhận email HĐ từ NCC (ví dụ: cnphuoctai@gmail.com gửi HĐ Viettel)
    ↓
User connect Gmail (OAuth2) — đã có
    ↓
FE: listLabels() → hiển thị labels NCC (mỗi NCC 1 label)
    ↓
User chọn label → listEmails(labelId, 7) → danh sách email
    ↓
FE: hiển thị danh sách email + badge (XML/ZIP/PDF/LINK)
    ↓
User click email → processEmail(emailId)
    ↓
BE xử lý 2 việc SONG SONG:
    │
    ├── 1. Download attachment → classify + parse:
    │   ├── XML: TaxInvoiceXMLParser.parse() → return invoices[]
    │   ├── ZIP: extract → XML found? parse : PDF found? return base64
    │   ├── PDF: return base64 (FE gọi Gemini AI đọc)
    │   └── None: return type='none'
    │
    └── 2. [THÊM MỚI] Parse nội dung email (HTML body) → extract portal URL:
        Ví dụ email Viettel:
        "...truy cập nhanh <a href="https://vinvoice.viettel.vn/tracuu?
         tax-code=4000456840-001&secret-code=EE73307FE8F59671166B47034C434001">tại đây</a>..."
        → EmailBodyParser extract: portalUrl + invoiceProvider + credentials
    ↓
FE nhận response: { parsed data, portalUrl, invoiceProvider, attachmentType }
    ↓
FE: populateFormFromXmlInvoice() hoặc processPdfFile() — hiển thị nội dung HĐ
    ↓
FE: Lưu vào state: email metadata (gmailMessageId, from, date) + portalUrl + invoiceProvider
    ↓
FE: matchInvoiceItemsToProducts() → fuzzy match sản phẩm trong IndexedDB
    ↓
User review → click "Cập nhật giá" → localStorage
    ↓
User click "Lưu Firestore" → saveAiInvoice()
    ↓
BE: Save to taphoa39-supplies-invoices / internal_invoices:
    { ...parsed data, portalUrl, invoiceProvider, gmailMessageId, gmailFrom, sourceTab: 'email' }
    ↓
TapHoa39KeToan: Load internal_invoices → hiển thị
    → Button "Xem HĐ gốc" → window.open(portalUrl) mở portal NCC để xem/tải HĐ gốc
```

### C.4 Flow 4: TapHoa39KeToan đối chiếu

```
KeToan FE: Login HDDT Portal (captcha solver)
    ↓
KeToan FE: Fetch purchase invoices từ GDT → save to tax_invoices
    ↓
KeToan FE: Load internal_invoices (data từ TapHoa39BanHang)
    ↓
KeToan FE: Hiển thị dual-table: TAX_PORTAL | INTERNAL (AI/XML/Gmail)
    ↓
User click "Đối chiếu"
    ↓
KeToan BE: Match by invoiceKey → compare fields → save results
    ↓
KeToan FE: Hiển thị kết quả: MATCH | MISMATCH | MISSING
    ↓
User click HĐ → xem chi tiết + field diffs
    ↓
[THÊM MỚI] User click "Xem HĐ gốc" → window.open(portalUrl) mở portal NCC
```

---

## PHẦN D: FIRESTORE SCHEMA — Hoàn chỉnh

### D.1 internal_invoices (ĐÃ CÓ + THÊM FIELDS)

```
internal_invoices/{docId}/
├── invoiceNo: string                  # ĐÃ CÓ
├── invoiceSymbol: string              # ĐÃ CÓ
├── invoiceDate: string                # ĐÃ CÓ
├── invoiceKey: string                 # ĐÃ CÓ — "{invoiceNo}|{supplierTaxCode}"
├── supplier: {                        # ĐÃ CÓ
│   name, taxCode, address
│ }
├── supplierTaxCode: string            # ĐÃ CÓ (denormalized)
├── supplierName: string               # ĐÃ CÓ (denormalized)
├── buyer: { name, taxCode, address }  # ĐÃ CÓ
├── items: [{                          # ĐÃ CÓ
│   name, unit, quantity, unitPrice, amount
│ }]
├── totalBeforeVat: number             # ĐÃ CÓ
├── vatRate: number                    # ĐÃ CÓ
├── vatAmount: number                  # ĐÃ CÓ
├── totalAmount: number                # ĐÃ CÓ
├── source: 'ai_pdf'                   # ĐÃ CÓ
├── aiModel: string                    # ĐÃ CÓ
├── confidence: number                 # ĐÃ CÓ
├── createdAt: timestamp               # ĐÃ CÓ
│
├── sourceTab: string                  # THÊM MỚI — 'upload'|'pdf'|'email'|'clone_image'
├── gmailMessageId: string             # THÊM MỚI — Gmail message ID
├── gmailFrom: string                  # THÊM MỚI — Email NCC gửi
├── gmailDate: string                  # THÊM MỚI — Ngày gửi email
├── portalUrl: string                  # THÊM MỚI — URL tra cứu HĐ trên portal NCC
├── invoiceProvider: string            # THÊM MỚI — 'VIETTEL'|'VNPT'|'MISA'|'VIN_HOADON'|...
├── processingMethod: string           # THÊM MỚI — 'flash'|'pro'|'xml_parse'
└── attachmentType: string             # THÊM MỚI — 'xml'|'zip_xml'|'pdf'|'clone_image'
```

### D.2 tax_invoices (ĐÃ CÓ — không đổi)

```
tax_invoices/{docId}/
├── invoiceNo, invoiceDate, invoiceKey
├── sellerTaxCode, sellerName
├── totalAmount, vatAmount
├── source: 'gdt'
└── ...
```

### D.3 Portal URL (THÊM MỚI — thay thế Firebase Storage)

Không lưu file gốc. Lưu URL tra cứu HĐ trên portal NCC, extract từ email body HTML.

```
Ví dụ portalUrl theo provider (extracted từ email mẫu thực tế):

NHÓM A — Direct URL (lưu nguyên href):
├── VIN_HOADON:   https://tracuu.vin-hoadon.com/tracuuhoadon/thongtinchung?mstdoanhnghiep=0402114198&masobimat=2D2QYQPGRGSC&loaitracuu=1
├── MISA:         https://www.meinvoice.vn/tra-cuu/?sc=9GF2C925494L&m=songminhcr.dn@gmail.com&n=...&c=&b=&d=0&t=1&r=1
├── VNPT:         https://betagen-tt78.vnpt-invoice.com.vn/Email/EmailInvoiceView?token=0EgSPZw521s%2fEyeYtUM20Ij1pjy9VZE9P7gqyVD2Cqg%3d
├── ASIAINVOICE:  https://tt78.asiainvoice.vn/EinvoiceView?token=NjIyd1NPMzAwMDAwMzUzNTAxNTk7NjIy
├── KIOTVIET:     https://tracuuhoadon.kiotviet.vn/?shd=158&mtc=AYAHS4HIAS26158
└── EHOADON:      http://tracuu.ehoadon.vn/WQ8OATOBZS3

NHÓM B — URL cố định + credentials:
├── MOBIFONE:     http://tracuuhoadon.mobifoneinvoice.vn/          + {taxCode: "0401554196", secretCode: "e9a6323"}
├── VIETTEL:      https://vinvoice.viettel.vn/utilities/invoice-search + {secretCode: "2B7FIETJ3HEFMD9"}
├── MINVOICE:     http://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don + {taxCode: "2301353595", secretCode: "DC8EC4A9"}
└── EINVOICE:     https://einvoice.vn/tra-cuu                     + {lookupCode: "F7DEEGSU5BE"}

NHÓM C — Unwrap awstrack.me:
└── WININVOICE:   https://tracuu.wininvoice.vn/?mst=0401972570&cmpn=0401972570&code=ICPWNRDRJP&cs_mst=0402318272&rec_email=songminhcr.dn%40gmail.com
                  (wrapped: https://{id}.r.{region}.awstrack.me/L0/https:%2F%2Ftracuu.wininvoice.vn:443%2F%3Fmst=...%26code=...)
```

---

## PHẦN E: THỨ TỰ THỰC HIỆN

### Phase 1: EmailBodyParser + Portal URL extraction (TapHoa39BackEnd)

```
Bước 1.1: Tạo EmailBodyParser service
    File: TapHoa39BackEnd/services/email_body_parser.py
    - extract_portal_url(email_html) → { portalUrl, provider, credentials }
    - detect_provider(email_html, from_address) → provider string
    - extract_credentials(email_html, provider) → { taxCode, secretCode }
    - PROVIDER_PATTERNS cho 11 providers (anchor text + URL patterns)

Bước 1.2: Sửa processEmail endpoint để extract portal URL
    File: TapHoa39BackEnd/routes/gmail_routes.py
    - Thêm: lấy email body HTML từ Gmail API
    - Thêm: gọi EmailBodyParser.extract_portal_url()
    - Return thêm: portalUrl, invoiceProvider, portalCredentials

Bước 1.3: Sửa save-ai-invoice để nhận thêm fields
    File: TapHoa39BackEnd/firebase/firebase_supplies_invoices/supplies_invoice_service.py
    - Thêm: sourceTab, gmailMessageId, gmailFrom, portalUrl, invoiceProvider, processingMethod

Bước 1.4: Thêm dependency
    - beautifulsoup4 vào requirements.txt
```

### Phase 2: FE lưu portal URL (TapHoa39BanHang)

```
Bước 2.1: Sửa saveToFirestore() trong invoice-processing-page
    - Thêm fields: sourceTab, gmailMessageId, gmailFrom, portalUrl, invoiceProvider, processingMethod

Bước 2.2: Sửa selectEmail() để lưu email metadata + portal URL
    - Track currentEmailId, currentEmailFrom, currentEmailDate
    - Track currentPortalUrl, currentInvoiceProvider (từ processEmail response)

Bước 2.3: Sửa GmailService interface
    - processEmail response thêm: portalUrl, invoiceProvider, portalCredentials
```

### Phase 3: TapHoa39KeToan đọc data — ✅ COMPLETE

```
✅ Bước 3.1: Firebase access — direct Firestore (Option B)
✅ Bước 3.2: invoice_routes.py trong KeToanBackEnd
✅ Bước 3.3: Ledger 8 component — provider badge, source tab, portal URL button
```

### Phase 4: Portal Links — Đọc trực tiếp từ Gmail — ✅ COMPLETE

```
✅ Bước 4.1: KeToanBackEnd — copy EmailBodyParser (11 providers, 3 groups A/B/C)
    - File mới: app/services/email_body_parser.py (copy từ TapHoa39BackEnd)

✅ Bước 4.2: KeToanBackEnd — mở rộng GmailService
    - list_messages(), get_message_full(), _extract_body_html(), helpers
    - get_message_full() = 1 API call trả metadata + bodyHtml (thay vì 2 calls riêng)

✅ Bước 4.3: KeToanBackEnd — endpoint GET /api/gmail/portal-links
    - Params: uid, label_id, label_name, days_back (default 30), page_size (default 30, max 100)
    - asyncio.gather + ThreadPoolExecutor (semaphore=8) để fetch song song
    - Parse body bằng EmailBodyParser.extract_portal_url()
    - Response: {portalLinks: [{gmailId, invoiceNo, supplierName, issueDate, portalUrl, invoiceProvider, portalCredentials, gmailFrom, gmailSubject, attachments}], total}

✅ Bước 4.4: KeToan FE — invoice.service.v2.ts
    - Interface: PortalLink, PortalLinksResponse
    - Method: getPortalLinksFromGmail({uid, labelId, labelName, daysBack, pageSize})

✅ Bước 4.5: KeToan FE — Ledger 8 component
    - loadPortalLinks() gọi Gmail endpoint thay vì Firestore
    - Map PortalLink[] → Invoice[] cho template compatibility
    - NCC dropdown dùng gmailLabels (label.id) thay supplierTaxCode
    - Cột "Nguồn" → "Email gửi" hiển thị gmailFrom
    - Không cần pagination (batch fetch, hasNext/hasPrev = false)
```

**Kiến trúc mới (Phase 4):**
```
Portal Links Tab → KeToanBackEnd /api/gmail/portal-links
    → Gmail API: list_messages() + get_message_full() (concurrent)
    → EmailBodyParser: extract portalUrl/provider/credentials từ email HTML
    → Trả về danh sách trực tiếp (KHÔNG lưu Firestore)
```

### Phase 5: Reconciliation cải tiến

```
Bước 4.1: Sửa reconciliation logic
    - Thêm fields vào comparison: sourceTab, confidence, processingMethod
    - Hiển thị warning nếu confidence < 0.8

Bước 4.2: Sửa reconciliation results display
    - Thêm column "Nguồn" (XML/PDF AI/Gmail/Clone)
    - Thêm link đến email Gmail gốc
    - Highlight low-confidence items
```

---

## PHẦN F: GMAIL → KETOAN — Playwright Download (Mở rộng tương lai)

> **NOTE:** Phần này là mở rộng cho TapHoa39KeToan — tự động download XML/PDF từ portal NCC.
> Priority THẤP hơn Phase 1-4. Chỉ làm sau khi flow cơ bản hoạt động.

### F.1 Supplier Config — 78 NCC

**Firestore:** `suppliers/{taxCode}`

```python
{
    'tax_code': '0316XXXXXX',
    'name': 'CÔNG TY TNHH TÂM BẢO PHƯƠNG',
    'gmail_label': 'NCC/TamBaoPhuong',
    'email_patterns': ['hoadon@tambao.vn'],
    'domains': ['tambao.vn'],
    'invoice_provider': 'VNPT',     # 11 providers, 3 nhóm A/B/C
    'is_active': True
}
```

### F.2 Portal Providers — 11 nhà cung cấp HĐĐT (verified từ email mẫu)

```
NHÓM A — Direct URL có params (extract href trực tiếp từ <a>):
  VIN_HOADON, MISA, VNPT, ASIAINVOICE, KIOTVIET, EHOADON    (6 providers)

NHÓM B — URL không params + credentials trong email text:
  MOBIFONE, VIETTEL, MINVOICE, EINVOICE                       (4 providers)

NHÓM C — URL wrapped qua awstrack.me (cần URL-decode):
  WININVOICE                                                   (1 provider)
  (EINVOICE cũng dùng awstrack nhưng URL không params → vẫn nhóm B)
```

### F.3 Playwright Download Service

```python
class PlaywrightDownloadService:
    async def download_group_a(url, provider_key, need_xml, need_pdf)
    async def download_group_b(provider_key, credentials, need_xml, need_pdf)
    async def download_group_c(download_links, provider_key)
    async def download(provider_key, email_html, portal_url, need_xml, need_pdf)
```

### F.4 Email Body Parser — Credential Extraction Patterns (verified)

```python
# MOBIFONE — HTML <li> tags:
#   <li>Mã đơn vị: <strong>0401554196</strong></li>
#   <li>Mã bảo mật:<strong> e9a6323</strong></li>
'taxCode': r'Mã đơn vị[:\s]*<strong>([^<]+)</strong>'
'secretCode': r'Mã bảo mật[:\s]*<strong>\s*([^<]+)</strong>'

# VIETTEL — Inline text:
#   "...theo mã số bí mật 2B7FIETJ3HEFMD9"
'secretCode': r'mã\s*số\s*bí\s*mật\s+([A-Z0-9]+)'

# MINVOICE — HTML <li> Bước 2/3:
#   <li>Bước 2: ...MST... <strong>2301353595</strong></li>
#   <li>Bước 3: ...Mã tra cứu: <strong>DC8EC4A9</strong></li>
'taxCode': r'Bước 2[^<]*<strong>(\d{10,13})</strong>'
'secretCode': r'Bước 3[^<]*<strong>\s*([A-Z0-9]+)</strong>'

# EINVOICE — Text + next line:
#   "Mã tra cứu hóa đơn:" → <strong>F7DEEGSU5BE</strong>
'lookupCode': r'Mã tra cứu hóa đơn[:\s]*</?\w*>\s*([A-Z0-9]+)'

# VIN_HOADON — Bonus PDF download link:
#   https://tracuu.vin-hoadon.com/File/TaiPdfLinkTraCuu?mstdoanhnghiep=...&masobimat=...

# VNPT — Bonus PDF download link:
#   https://{subdomain}.vnpt-invoice.com.vn/Email/PdfDownload?token=...

# WININVOICE — Unwrap awstrack.me:
#   Input:  https://{id}.r.{region}.awstrack.me/L0/https:%2F%2Ftracuu.wininvoice.vn:443%2F%3Fmst=...
#   Decode: urllib.parse.unquote(url_after_L0_slash)
#   Output: https://tracuu.wininvoice.vn/?mst=0401972570&cmpn=0401972570&code=ICPWNRDRJP&cs_mst=0402318272&rec_email=songminhcr.dn%40gmail.com
```

### F.5 Captcha Solver

```python
def solve_svg_captcha(svg_content) → str      # 4 providers
def solve_scroll_captcha(page) → bool          # Viettel only (khó auto)
```

### F.6 Dependencies cho Playwright

```
playwright==1.49.0
beautifulsoup4==4.12.3
# VPS: playwright install chromium --with-deps (~150MB)
```

---

## Lưu ý quan trọng

1. **Firebase project:** `taphoa39-supplies-invoices` là shared giữa BanHang và KeToan
2. **Gmail OAuth:** tokens lưu ở project `quanlysongminh` (users collection)
3. **invoiceKey** = `"{invoiceNo}|{supplierTaxCode}"` — composite key cho dedup + matching
4. **Không lưu file gốc** — lưu `portalUrl` (link tra cứu HĐ trên portal NCC) thay vì upload PDF/XML lên Firebase Storage
5. **Portal URL** extract từ email body HTML bằng `EmailBodyParser` — mỗi NCC có provider riêng (11 providers)
6. **Không duplicate code:** KeToan đọc data từ same Firestore collection mà BanHang đã save
7. **Phase 1-4 là core** — Playwright download (Phase F) là nice-to-have, làm sau
8. **Existing Gmail flow** trong BanHang đã hoạt động — chỉ cần thêm portal URL extraction
9. **Existing reconciliation** trong KeToan đã hoạt động — chỉ cần thêm columns + portal link
