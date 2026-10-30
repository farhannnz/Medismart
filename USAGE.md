# Medismart (Shop) – kaise use karein

Poora guide screenshots ke saath: **Medismart-User-Guide.pdf** (isi folder me). Warehouse ka alag software: **Medismart-Warehouse**.

**Demo login:** `admin` / `admin` (shop owner, sirf ek) • `staff` / `staff`. Pehle login ke baad passwords badal do (Tools → Staff && Rights).

`index.html` double-click karo (ya Vercel pe host karo). Data usi browser me save hota hai: File → Backup && Restore se backup lo.

## Idea
Maal **sirf warehouse se**. Shop item/supplier nahi banata. Warehouse alag software hai; abhi files se baat hoti hai.

`Stock Request` →(file)→ warehouse strips **scan** karke bhejta hai →(dispatch file)→ `Receive Stock` (scan + shelf) → stock + hisaab apne aap. Wapsi: `Return to Warehouse` (strips scan, har row ka reason) →(return file)→ warehouse.

## Menus
File • Sale • Stock • Warehouse • Cash • Accounts • Tools • View • Window • Help

## Roz ka kaam
- **Login → Shift:** apne aap shuru. Drawer ka cash **automatic** (pichli shift ka cash + cash sales - refunds + cash in - out); status bar me "Drawer ₹...". Logout par calculated cash dikhta hai, alag ho to badlo.
- **Bill:** Sale → Sales Bill (F2). Schedule H = laal Rx, H1/X = doctor zaroori. Expiry wala batch peela/laal. Cash bill shift me judta hai.
- **Maal kam:** Warehouse → Stock Request (F3) → Auto Fill → Send. Request List → request → Export request file.
- **Maal aaya:** Warehouse → Receive Stock (F4) → Import dispatch file → strips scan karke ginti → shelf → Receive.
- **Shelf rule:** nayi dawai ki shelf likhna zaroori; pehle se shop me ho to shelf dikhti hai ("keep here").
- **Wapsi:** Warehouse → Return Stock to Warehouse (scan) → reason har row → Send (file Downloads me).
- **Shelves:** Stock → Shelves.
- **Cash Register:** Cash → Cash Register && Shifts. Admin: Cash In / Expense / Bank deposit / Owner withdrawal / Handover; sabki shifts aur difference dekhta hai.
- **Hisaab:** Accounts → Day Book, Ledger (F8; Pay se warehouse ko payment), Profit && Loss.
- **Staff + attendance:** Tools → Staff && Rights; login par punch in apne aap.
- **Alerts:** Messages panel + 🔔.

## Files
Har strip par warehouse ka **barcode label** (Code 128, strip ka code jaise `L12-045`). Shop me scan karne par code dispatch file se pehchana jaata hai. Quantities sale unit (strip) me.
- **Request** (shop→warehouse): `{ "type":"request", "shop":"<shop>", "no":"RQ-000001", "date":"YYYY-MM-DD", "note":"", "lines":[{ "name":"<item>", "qty":2, "unit":"purchase|sale" }] }`
- **Dispatch** (warehouse→shop): `{ "type":"dispatch", "v":3, "bill":true, "warehouse":"", "no":"WD-000001", "date":"", "requestNo":"RQ-000001", "by":"", "note":"", "lines":[{ "name":"", "generic":"", "cat":"", "schedule":"", "mfr":"", "unit":"Strip", "punit":"Box", "conv":10, "hsn":"", "tax":12, "batchNo":"", "expiry":"YYYY-MM", "mrp":0, "rate":0, "qty":0, "serials":["L12-001"] }] }` (naya item apne aap bann jaata hai)
- **Return** (shop→warehouse): `{ "type":"return", "v":2, "shop":"", "no":"WR-000001", "date":"", "note":"", "lines":[{ "name":"", "batchNo":"", "expiry":"", "mrp":0, "rate":0, "qty":0, "reason":"Expired", "note":"", "serials":["L12-001"] }] }`
- **Item list** (warehouse→shop): `{ "type":"items", "items":[{ "name":"", "generic":"", "cat":"", "schedule":"", "mfr":"", "tax":12, "mrp":0, "unit":"Strip", "punit":"Box", "conv":10, "reorder":10 }] }`
- `bill: true` = warehouse ka bill (warehouse ke shop price par, GST nahi): Receive karte hi warehouse ka **udhaar** (supplier account) chadhta hai; payment Accounts → Make payment se. Return lines me `credit: true` = billed maal, udhaar kam hota hai. Purane dispatch (bina bill) Head Office me jaate hain.
- Demo (warehouse software ke bina): Request List → pending request → "Demo: simulate warehouse dispatch".

## Shortcuts
F1 Dashboard • F2 Sales Bill • F3 Stock Request • F4 Receive Stock • F5 Stock • F7 Reports • F8 Ledger • Ctrl+I Search • Ctrl+←/→ tabs
