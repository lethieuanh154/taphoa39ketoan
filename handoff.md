# HANDOFF: Phase 3 Complete — TapHoa39KeToan + TapHoa39KeToanBackEnd

## Architecture (FINAL)

```
TapHoa39BanHang  ←→  TapHoa39BackEnd (Flask, port 5000)
                              ↕ Firestore: taphoa39-supplies-invoices
TapHoa39KeToan   ←→  TapHoa39KeToanBackEnd (FastAPI, port 5001)
```

**Rule**: The two platforms are fully independent. They only share Firebase data.
- KeToan FE NEVER calls Flask BE.
- All KeToan FE API calls go to `ketoanBackendUrl` (port 5001 in dev).

---

## Phase 1 + 2 (already done — TapHoa39BanHang side)

TapHoa39BanHang → TapHoa39BackEnd (Flask) → saves to `internal_invoices` with new fields:
- `portalUrl`, `portalPdfUrl`, `invoiceProvider`, `portalCredentials`
- `sourceTab`, `gmailMessageId`, `gmailFrom`, `gmailDate`
- `processingMethod`, `attachmentType`

---

## Phase 3 (COMPLETE) — TapHoa39KeToan reads internal_invoices

### Files modified / created

#### TapHoa39KeToanBackEnd (FastAPI)

| File | Action | Notes |
|------|--------|-------|
| `app/config/settings.py` | Modified | Added `firebase_service_account_supplies_invoices`, port = 5001 |
| `app/config/firebase.py` | Modified | Added `initialize_supplies_firebase()`, `get_supplies_db()` |
| `app/config/__init__.py` | Modified | Exports for new firebase functions |
| `app/services/invoice_service.py` | **NEW** | Full InvoiceService (CRUD + reconciliation) using `get_supplies_db()` |
| `app/services/invoice_parsers.py` | **NEW** | TaxInvoiceXMLParser (copy from Flask BE) |
| `app/routes/invoice_routes.py` | Modified (rewritten) | Full v2 + legacy routes |
| `app/routes/__init__.py` | Modified | Exports `invoice_router` + `invoice_legacy_router` |
| `main.py` | Modified | Registers both routers, calls `initialize_supplies_firebase()` |

#### TapHoa39KeToan (Angular)

| File | Action | Notes |
|------|--------|-------|
| `src/environments/environment.ts` | Modified | All URLs → port 5001 (ketoanBackendUrl) |
| `src/environments/environment.prod.ts` | Modified | `ketoanBackendUrl` = Render URL |
| `src/app/components/accountant-pages/invoice.service.v2.ts` | Modified | `apiUrl` and `ketoanApiUrl` both → KeToanBackEnd |
| `ledger-8-dong-bo-hoa-don-v2.component.ts` | Modified | Provider filter, portal URL button, `loadAiInvoices()` → KeToanBackEnd |
| `ledger-8-dong-bo-hoa-don-v2.component.html` | Modified | Provider badge column, source tab column, HĐ gốc button |
| `ledger-8-dong-bo-hoa-don-v2.component.css` | Modified | Badge styles for 11 providers |

---

## API Contract (KeToanBackEnd)

### /api/v2/invoices (full v2 with InvoiceService)

```
GET    /api/v2/invoices                — query with filter + pagination
GET    /api/v2/invoices/default        — last 30 days, 50 records
GET    /api/v2/invoices/suppliers      — unique suppliers from both collections
GET    /api/v2/invoices/providers      — unique invoice providers
GET    /api/v2/invoices/reconciliation/summary   — counts: matched/unmatched/mismatch
POST   /api/v2/invoices/reconciliation/run       — run auto reconciliation
GET    /api/v2/invoices/reconciliation/results   — reconciliation detail list
DELETE /api/v2/invoices/reconciliation/results/{id}
DELETE /api/v2/invoices/clear          — ?source=TAX_PORTAL|AI_PDF
DELETE /api/v2/invoices/clear-all
POST   /api/v2/invoices                — create single invoice
POST   /api/v2/invoices/batch          — batch import JSON
POST   /api/v2/invoices/import-xml     — XML upload (from GDT)
GET    /api/v2/invoices/{doc_id}       — invoice detail
```

Query params for `GET /api/v2/invoices`:
- `source`: TAX_PORTAL | AI_PDF
- `year`, `monthKey` (YYYY-MM), `fromDate`, `toDate` (YYYY-MM-DD)
- `supplierTaxCode`, `reconcileStatus`
- `pageSize` (1-100), `cursor` (doc ID), `direction` (next|prev)

### /api/invoices (legacy read-only)

```
GET  /api/invoices/internal            — read internal_invoices (AI_PDF source)
GET  /api/invoices/internal/{doc_id}
GET  /api/invoices/suppliers
GET  /api/invoices/providers
```

---

## Firestore Collections (taphoa39-supplies-invoices project)

### internal_invoices
```
invoiceNo, invoiceSymbol, invoiceDate, invoiceKey
supplier: { name, taxCode, address }
supplierTaxCode, supplierName   ← denormalized for query compat
buyer: { name, taxCode, address }
items: [{ name, unit, quantity, unitPrice, amount }]
totalBeforeVat, vatRate, vatAmount, totalAmount
source: 'ai_pdf'
aiModel, confidence, createdAt

# Portal/Email fields (Phase 1-2):
sourceTab: 'upload'|'pdf'|'email'|'clone_image'
gmailMessageId, gmailFrom, gmailDate
portalUrl, portalPdfUrl
invoiceProvider: 'VIETTEL'|'VNPT'|'MISA'|'EINVOICE'|...
portalCredentials: { taxCode, secretCode, ... }
processingMethod: 'flash'|'pro'|'xml_parse'
attachmentType: 'xml'|'zip_xml'|'pdf'
```

### tax_invoices
```
invoiceNo, invoiceSymbol, invoiceDate, invoiceKey
supplier: { name, taxCode, address }
buyer: { name, taxCode, address }
items: [...]
totalBeforeVat, vatRate, vatAmount, totalAmount
source: 'gdt'
createdAt
```

### invoice_reconciliation
```
invoiceKey (display key: symbol_no|taxCode)
matchKey (no symbol: invoiceNo|taxCode)
taxInvoiceId, internalInvoiceId
status: 'MATCH'|'MISMATCH'|'MISSING_INTERNAL'|'MISSING_TAX'
fieldDiffs: [{field, fieldLabel, taxValue, internalValue, diff, diffType}]
taxData, internalData
periodKey: YYYY-MM | 'all'
checkedAt
```

---

## InvoiceService Key Logic

### Source → Collection mapping
```python
TAX_PORTAL → tax_invoices
AI_PDF     → internal_invoices
```

### invoiceKey format
```python
# With symbol:    "1C24TAA_00000123|0301234567"
# Without symbol: "00000123|0301234567"
```

### Date format detection
Service auto-detects invoiceDate format in collection:
- `YYYY-MM-DD` → server-side Firestore filter
- `DD/MM/YYYY` → client-side filter after fetch
- `TIMESTAMP` → converted to datetime for Firestore filter

### Reconciliation algorithm
1. Fetch all `tax_invoices` + `internal_invoices`
2. Build match_key = `invoiceNo|taxCode` (no symbol, backward compat)
3. Compare: MATCH / MISMATCH (with fieldDiffs) / MISSING_INTERNAL / MISSING_TAX
4. Save to `invoice_reconciliation` collection
5. Update `reconcileStatus` on original invoice documents

---

## Environment Config

### Dev (environment.ts)
```typescript
domainUrl: 'http://127.0.0.1:5001'       // FastAPI KeToanBackEnd
apiUrl: 'http://127.0.0.1:5001'           // FastAPI KeToanBackEnd
ketoanBackendUrl: 'http://127.0.0.1:5001' // FastAPI KeToanBackEnd
```

### Prod (environment.prod.ts)
```typescript
domainUrl: 'https://songminhketoanbackend.onrender.com'
apiUrl: 'https://api.taphoa39.com/api'
ketoanBackendUrl: 'https://songminhketoanbackend.onrender.com'
```

### InvoiceServiceV2 (Angular)
```typescript
// Both point to KeToanBackEnd only:
private readonly apiUrl = `${environment.ketoanBackendUrl}/api/v2/invoices`;
private readonly ketoanApiUrl = `${environment.ketoanBackendUrl}/api/invoices`;
```

---

## KeToanBackEnd Service Files

### app/services/invoice_service.py
- `InvoiceService` class — all Firestore CRUD
- Singleton: `invoice_service = InvoiceService()`
- `get_supplies_db()` → `taphoa39-supplies-invoices` project

### app/services/invoice_parsers.py
- `TaxInvoiceXMLParser` — parse GDT XML files (copied from Flask BE)

---

## Firebase Setup (KeToanBackEnd)

Two Firebase apps:
1. `[DEFAULT]` → `songminhketoan-15041989` (ketoan data)
2. `supplies-invoices` → `taphoa39-supplies-invoices` (shared with BanHang)

Service account for supplies-invoices:
- Env var: `FIREBASE_SERVICE_ACCOUNT_SUPPLIES_INVOICES` (JSON string)
- Or file: `./firebase-supplies-invoices-service-account.json`

---

## Ledger 8 — Dong Bo Hoa Don V2 UI

Tab "HĐ AI (Email/PDF)":
- Provider badge column: color-coded by provider (11 providers)
- Nguồn column: sourceTab badge
- HĐ gốc column: button → opens `portalUrl` in new tab
- Provider filter dropdown

Data flow:
```
Ledger8 Component
  → invoice.service.v2.getInternalInvoices() [uses /api/invoices/internal]
  → KeToanBackEnd /api/invoices/internal
  → invoice_service.get_invoices(source='AI_PDF')
  → get_supplies_db() → internal_invoices collection
```

---

## Phase 4 — COMPLETE: Portal Links — Đọc trực tiếp từ Gmail

### Problem
Portal Links tab đọc từ Firestore `internal_invoices` — chỉ có ~8 hóa đơn (đã lưu qua TapHoa39BanHang).
Gmail có >100 email hóa đơn nhưng chưa được process + save.

### Solution
Portal Links tab đọc trực tiếp từ Gmail API. Không cần lưu Firestore trước.

### Architecture
```
Portal Links Tab
  → KeToanBackEnd GET /api/gmail/portal-links?label_id=X&days_back=30&page_size=50
    → Gmail API: list_messages() + get_message_full() (concurrent, semaphore=8)
    → EmailBodyParser: extract portalUrl/provider/credentials từ email HTML
    → Response: {portalLinks: [...], total}
```

### Files Modified/Created

#### TapHoa39KeToanBackEnd (FastAPI)

| File | Action | Notes |
|------|--------|-------|
| `app/services/email_body_parser.py` | **NEW** | Copy từ TapHoa39BackEnd — 11 providers, 3 groups (A/B/C) |
| `app/services/gmail_service.py` | Modified | Added `list_messages()`, `get_message_full()`, `_extract_body_html()`, helpers |
| `app/routes/gmail_routes.py` | Modified | Added `GET /api/gmail/portal-links` endpoint with concurrent fetch |

#### TapHoa39KeToan (Angular)

| File | Action | Notes |
|------|--------|-------|
| `invoice.service.v2.ts` | Modified | Added `PortalLink`, `PortalLinksResponse` interfaces + `getPortalLinksFromGmail()` |
| `ledger-8-dong-bo-hoa-don-v2.component.ts` | Modified | `loadPortalLinks()` calls Gmail endpoint, maps `PortalLink[]` → `Invoice[]` |
| `ledger-8-dong-bo-hoa-don-v2.component.html` | Modified | NCC dropdown → Gmail labels, "Nguồn" → "Email gửi" (gmailFrom) |

### API Contract (new endpoint)

```
GET /api/gmail/portal-links
  ?uid=            — Firebase user UID (optional, fallback to GMAIL_UID in .env)
  &label_id=       — Gmail label ID (from /api/gmail/labels)
  &label_name=     — Gmail label name (resolved to ID server-side)
  &days_back=30    — How far back to search (1-365)
  &page_size=30    — Max emails to fetch (1-100)

Response:
{
  "success": true,
  "portalLinks": [{
    "gmailId": "abc123",
    "invoiceNo": "1C26TAA-53931",
    "supplierName": "CÔNG TY ABC",
    "supplierTaxCode": "",
    "issueDate": "2026-05-12T10:30:00+07:00",
    "invoiceProvider": "VNPT",
    "portalUrl": "https://xxx.vnpt-invoice.com.vn/Email/EmailInvoiceView?token=...",
    "portalPdfUrl": "https://xxx.vnpt-invoice.com.vn/Email/PdfDownload?token=...",
    "portalCredentials": {"secretCode": "ABC123"},
    "gmailFrom": "hoadon@ncc.vn",
    "gmailSubject": "Hóa đơn điện tử số ...",
    "attachments": ["invoice.xml"]
  }],
  "total": 42,
  "fetchedFromGmail": 42,
  "parseErrors": 0
}
```

### Key Details

- **EmailBodyParser**: 11 providers across 3 groups:
  - Group A (direct URL): VIN_HOADON, MISA, VNPT, ASIAINVOICE, KIOTVIET, EHOADON
  - Group B (URL + credentials): MOBIFONE, VIETTEL, MINVOICE, EINVOICE
  - Group C (awstrack wrapper): WININVOICE
- **Concurrent fetch**: `asyncio.gather` + `ThreadPoolExecutor(10)` + `Semaphore(8)` for parallel Gmail API calls
- **No Firestore caching**: Data fetched fresh from Gmail on each request
- **Invoice number extraction**: Regex patterns try to extract from email subject (e.g., `1C26TAA-53931`)
- **Token auto-refresh**: If Gmail access token refreshed during API calls, saved back to Firestore

---

## Ledger 8 — Data Flow Summary

### Tab "Đối chiếu" (Reconcile)
```
Tax Panel  → KeToanBackEnd /api/v2/invoices?source=TAX_PORTAL → Firestore tax_invoices
AI Panel   → KeToanBackEnd /api/invoices/internal             → Firestore internal_invoices
```

### Tab "Links HĐ Gốc" (Portal Links)
```
Portal Links → KeToanBackEnd /api/gmail/portal-links → Gmail API (direct, no Firestore)
```

---

## Next Steps (Phase 5 ideas)

1. **Batch process Gmail → Firestore**: Auto-process all Gmail emails and save to internal_invoices (eliminates manual TapHoa39BanHang workflow)
2. **Tax portal import**: Upload XML files from GDT to `tax_invoices` via `/api/v2/invoices/import-xml`
3. **Reconciliation UI improvements**: Confidence warnings, source column
4. **Supplier analytics**: Chart by provider, by month
5. **Export**: Excel/PDF export of reconciliation results
6. **Playwright download**: Auto-download XML/PDF from portal NCC (Phase F in plan.md)
