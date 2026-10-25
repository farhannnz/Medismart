# Medismart – kaise use karein

Poora step-by-step guide screenshots ke saath: **Medismart-User-Guide.pdf** (isi folder me).

**Demo login:** `admin` / `admin` (shop owner, sirf ek) • `staff` / `staff` (counter staff). Pehle login ke baad Tools → Staff && Rights me passwords badal do.

Software browser me chalta hai: `index.html` double-click karo (ya Vercel pe host karo). Data usi browser me save hota hai, isliye File → Backup && Restore se backup lete raho.

## Idea
Shop ka maal **sirf warehouse se** aata hai. Shop dawai ya supplier nahi banata. Warehouse ka software alag hai; abhi dono files se baat karte hain.

`Stock Request` → (file) warehouse → `Dispatch file` → `Receive Stock` (shelf tay) → stock + hisaab apne aap.

## Menus
File • Sale • Stock • Warehouse • Accounts • Tools • View • Window • Help

## Roz ka kaam
- **Bill:** Sale → Sales Bill (F2). Dawai ka naam likho, Enter. Batch FEFO se. Payment CASH/UPI/CARD/CREDIT. Save/Print. Schedule H = laal Rx, H1/X = doctor ka naam zaroori. Expiry wala batch peela/laal.
- **Customer History:** Sale → Customer History (ya bill me customer ke saamne "history").
- **Maal kam:** Warehouse → Stock Request (F3) → Auto Fill → Send. Request List me request kholo → Export request file → warehouse ko do.
- **Maal aaya:** Warehouse → Receive Stock (F4) → Import dispatch file → asli quantity likho → **shelf** (neeche) → Receive.
- **Shelves:** Stock → Shelves. Har dawai ki ek shelf; yahin badal sakte ho.
- **Expiry:** Stock → Expiry Watch; expire maal wapas: Stock → Return Expired Stock to Warehouse.
- **Hisaab:** Accounts → Day Book, Ledger (F8, Pay voucher se warehouse ko payment), Profit && Loss / Balance Sheet. Warehouse → Warehouse Account = kitna dena hai.

## Shelf rule
- **Nayi dawai** (shop me pehli baar): shelf ka naam likhna zaroori. Bina shelf ke Receive nahi hota.
- **Pehle se shop me hai:** uski shelf pehle se dikhti hai ("already in shop → keep here"); naya maal wahi rakho.

## Staff aur attendance
- Admin sirf ek. Staff banana: Tools → Staff && Rights → Add user → rights tick karo.
- Login par punch in apne aap, logout par punch out. File → Attendance. Admin sabka register dekhta hai aur edit/CSV kar sakta hai. Shift time: Tools → Options.

## Alerts
Messages panel + 🔔: expired/near-expiry, kam stock, dispatch receive karna hai, rejected request, udhaar, warehouse ko dena, attendance.

## Files (warehouse software ke liye)
Items sale-unit (strip) me hote hain; item ka naam shop ki list se exactly match hona chahiye (nayi dawai ke liye dispatch line me item details do, wo apne aap judd jaati hai).

- **Request file** (shop → warehouse): `{ "type":"request", "shop":"<shop>", "no":"RQ-000001", "date":"YYYY-MM-DD", "note":"", "lines":[{ "name":"<item>", "qty":2, "unit":"purchase|sale" }] }`
- **Dispatch file** (warehouse → shop): `{ "type":"dispatch", "warehouse":"<naam>", "no":"DC-000001", "date":"YYYY-MM-DD", "requestNo":"RQ-000001", "by":"", "note":"", "lines":[{ "name":"<item>", "reqIdx":0, "batchNo":"B1", "expiry":"YYYY-MM", "mrp":50, "rate":36, "qty":20, "tax":12, "generic":"", "schedule":"H", "mfr":"", "unit":"Strip", "punit":"Box", "conv":10 }] }` — `generic…conv` sirf nayi dawai ke liye; `qty` aur `rate` sale unit ke hisaab se.
- **Item list file** (warehouse → shop): `{ "type":"items", "items":[{ "name":"", "generic":"", "cat":"Allopathy", "schedule":"", "mfr":"", "tax":12, "mrp":0, "unit":"Strip", "punit":"Box", "conv":10, "reorder":10 }] }` — Warehouse → Import Item List. Shelf kabhi nahi badalti.
- Demo me bina warehouse software ke: Request List me pending request kholo → **Demo: simulate warehouse dispatch**.

## Shortcuts
F1 Dashboard • F2 Sales Bill • F3 Stock Request • F4 Receive Stock • F5 Stock • F7 Reports • F8 Ledger • Ctrl+I Search • Ctrl+←/→ tabs
