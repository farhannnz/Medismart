# Medismart (PharmaDesk)

Simple medical-shop software (billing, stock, shelves, accounts, staff + attendance) in a classic desktop layout. Stock comes only from the warehouse (separate software): shop requests → warehouse dispatches → shop receives and assigns shelves. **Login: admin / admin** (also staff/staff). See [Medismart-User-Guide.pdf](Medismart-User-Guide.pdf) and [USAGE.md](USAGE.md).

Modern pharmacy billing, inventory and accounts software that runs in the browser (no install, works offline).

## Run it
- Double-click `index.html` (works from the file system), or serve the folder with any static host (Vercel, Netlify, GitHub Pages).
- Local preview: `python -m http.server 8761` inside this folder, then open http://localhost:8761
- First run loads demo data. Sign in with **admin / admin**, then change the password in Settings.

## Tech
- Plain HTML + CSS + JavaScript (no framework, no build step)
- Data: browser IndexedDB (falls back to localStorage); backup/restore as a JSON file from Settings
- Charts: hand-built inline SVG
- Printing: browser print (thermal 58/80 mm receipts and A4 reports)

## Modules
Dashboard, Sales billing (multi-series, hold bills, profit view, change calculator, doctor memory, schedule H1/X check),
Sales returns, Purchase invoice (movable columns, free qty and offer hints), Purchase orders (manual + automatic),
Delivery notes, Opening stock, Batch edit, Expiry / damaged stock / supplier claims, Product explorer (linked windows),
Reports (sales, GST, schedule register, purchase, stock flow, outstanding...), Accounts (ledger, day book, trial balance,
P&L, balance sheet, vouchers, year closing), Users with per-section rights, Activity log, Backup.

## Tests
`tests/logic-test.js`: paste into the browser console after signing in. It runs 21 checks (billing, GST, returns, purchase,
claims, balance sheet, year closing) on a copy of the data and never touches your real records.
