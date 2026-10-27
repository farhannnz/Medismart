# Medismart (PharmaDesk)

Simple medical-shop software (billing, stock, shelves, accounts, staff + attendance) in a classic desktop layout. Stock comes only from the warehouse (separate software): shop requests → warehouse dispatches → shop receives and assigns shelves. Data is saved online (Firebase) and the shop ↔ warehouse link is live. **Setup: [SETUP.md](SETUP.md).**

Modern pharmacy billing, inventory and accounts software that runs in the browser (no install).

## Run it
- Serve the folder with any static host (Vercel, Netlify) or locally: `python -m http.server 8761` inside this folder, then open http://localhost:8761
- First run: connect the computer with the online password, then set the shop name and admin password (see SETUP.md).

## Tech
- Plain HTML + CSS + JavaScript (no framework, no build step)
- Data: Firebase Firestore (`js/cloud.js`), with a local copy so an internet drop loses nothing; backup/restore as a JSON file from Settings
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
