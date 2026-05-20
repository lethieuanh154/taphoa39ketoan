# TapHoa39KeToan

Ke toan ho kinh doanh, chuan TT 133/2016 + TT 78/2021. Angular 19, FastAPI backend (port 8000).

## Routes (14 active / 40 total)
dashboard, journal, ledger, trial-balance, balance-sheet (B01-DNN), income-statement (B02-DNN, 15 chi tieu), cash-flow (B03-DNN), chart-of-accounts (70 TK), cash-vouchers, invoices, period-lock, audit-trail + 26 placeholder

## Critical Rules
- 70 tai khoan TT 133/2016, 7 loai so S1-S7 HKD
- Cash voucher: DRAFT → POSTED → CANCELLED (chi sua/xoa khi DRAFT)
- Period lock: khoa xong khong sua but toan

## Docs
`docs/`: OVERVIEW, COMPONENTS, SERVICES, MODELS, ROUTES, STATUS
