# Medismart (PharmaDesk) – kaise use karein

**Logins (demo data ke saath):**
| Kaun | Username | Password | Kya dikhta hai |
|---|---|---|---|
| Shop Admin (owner, sirf ek) | `admin` | `admin` | sab kuch |
| Counter Staff | `staff` | `staff` | billing, request, receive (jo rights diye) |
| Warehouse Manager | `warehouse` | `warehouse` | sirf Warehouse menu (requests approve + dispatch) |

Pehle login ke baad Tools → Users && Rights me passwords badal do. Naya staff: wahin "Add user" (role Staff ya Warehouse, rights tick). **Admin sirf ek hota hai** – doosra Admin banane ya Admin ko disable karne se software rok deta hai.

Software browser me chalta hai. Folder me `index.html` double-click karo, ya Vercel/GitHub Pages pe host karo. Data usi browser me save hota hai (IndexedDB), isliye roz **File → Backup && Restore** se backup lo.

## Screen ka layout
- **Menu bar:** File, Create, List, Order, Purchase, Sale, Stock, Accounts, View, Navigate, Tools, Window, Help.
- **Toolbar:** shortcut icons (Sales bill, Purchase, Stock, Reports, Day book...). Mouse rakhne par naam dikhta hai.
- **Tabs:** har kholi hui window ek tab me. Red naam = active. `x` se band karo. Ctrl+←/→ se tab badlo.
- **Right panel:** Item List (search karo; double-click = bill me add, single-click = Explorer). `#` wale item ka stock 0 hai. View menu se Manufacturer / Suppliers panel on-off.
- **Shortcuts:** F2 Sale, F4 Purchase, F5 Stock, F6 Explorer, F7 Reports, F8 Ledger, Ctrl+I search.

## Pehli baar setup (sirf ek baar)
1. **Tools → Options (Shop & billing):** shop ka naam, address, GSTIN, DL no., bill footer, rounding.
2. **Create → Manufacturer** (company list), **Create → Supplier** (supplier + unke manufacturers link), **Create → Customer / Doctor**.
3. **Create → Item:** Name, Generic, Pack, P.Tax % (GST), Purchase Unit (Box), Sales Unit (Strip), Ratio (1 box me kitni strip), Type, Schedule, Manufacturer, Rack, Reorder Qty, Unit Rate (MRP) → **Save**. Purane item ko dhundh ke badalna ho to naam type karke find karo → **Update**.
4. **Create → Account Details:** expense/income/bank jaise naye account head. Opening balance yahin se do.
5. **Stock → Opening Stock:** jo maal shelf pe pada hai uska item, batch, expiry, qty, cost, MRP daalo.

## Roz ka kaam
### Sale (customer ko bill)
1. **Sale → Sales Bill** (F2).
2. Patient name (khali = walk-in) aur Doctor (H1/X dawa me doctor zaroori).
3. Neeche entry row me item ka naam type karo, ↑↓ se chuno, **Enter** → grid me line aa jaati hai (batch FEFO se, jaldi expire hone wala pehle).
4. Grid me Qty / Disc / Rate badal sakte ho, batch dropdown se badal sakte ho. Line hatane ko row chuno → **Delete**.
5. Bill discount `Disc` me, payment mode (CASH / UPI / CARD / CREDIT) chuno. Credit ke liye patient chuna hona chahiye.
6. **Save** (ya **Print** = save + print). Alag schedule/category ho to bill alag series me ban jaata hai (A, H, AY, O, V).
7. Customer ruka ho to **Stand by**; baad me **Held** se recall. **Previous / Display / Next** purane bills dikhate hain.
8. Wapsi: **Sale → Sales Return**.

### Stock kahan se aata hai – Warehouse flow (sabse zaroori)
Shop ka stock **sirf warehouse se** aata hai (direct supplier purchase band hai; chahiye to Tools → Options → "Also allow direct supplier purchase" tick karo).

1. **Shop:** Order → **Stock Request to Warehouse** (F3). Item chuno, box/strip me qty likho (ya **Auto Fill** = jo reorder level se neeche hai woh sab). Dikhta hai: shop me kitna hai, warehouse me kitna hai. **Send Request**.
2. **Warehouse:** `warehouse` se login → **Incoming Requests**. Request chuno, har item ki approve qty aur transfer rate dekho/badlo → **Approve & Dispatch** (ya **Reject** with reason). Batch apne aap first-expiry-first-out se uthte hain, challan print hota hai. Is waqt shop ka stock **nahi** badhta.
3. **Shop:** Purchase → **Receive Stock from Warehouse** (F4). Dispatch chuno, maal gino, **Received** me asli qty likho (kam aaya to kam likho – kami warehouse ko wapas chali jaati hai) → **Receive**. Ab shop ka stock badhta hai, GST input aur warehouse ka payable account me chadh jaata hai.
4. **Paise:** Purchase → **Warehouse Account (what we owe)** me hisaab; Accounts → Ledger me **Pay** voucher se payment karo. Maal wapas: Purchase → Purchase Return (warehouse ke paas wapas chala jaata hai).
5. **Warehouse ka apna stock:** Warehouse → **Add Warehouse Stock** (batch + expiry + transfer rate) / **Warehouse Stock** (item-wise).
6. Warehouse aur shop **alag computer** pe hon to: shop request ko "Export request file" karke bheje, warehouse "Import request file" kare; dispatch ko "Export file" karke bheje, shop "Import dispatch file" kare. Dono taraf item ke naam same hone chahiye. (Live sync ke liye baad me warehouse management/server banayenge.)

### Stock
- **Stock → Current Stock** (value ke saath), **Stock Statement** (opening/purchase/sale/closing).
- **Stock → Batch Edit:** item chuno → batch no, expiry, qty, rate, MRP theek karo → **Update**.
- **Expiry:** **Stock → Expiry Watch** me dekho kya expire hone wala hai. **Stock → Expiry Claim:** supplier chuno, Expired/30/60/90 din chuno, **Display** → row pe double-click se claim list me → **Update** (stock se nikal ke claim ban jaata hai) → Print. Baad me **Supplier Claims (list)** me credit note / replacement settle karo.
- Item ki poori history: **View → Explorer View** (F6).

### Accounts
- **Accounts → Day Book** (rozana cash), **Ledger** (kisi bhi party/account ka hisaab), **Trial Balance**, **Profit && Loss / Balance Sheet**, **Receivables && Payables**.
- Payment/Receipt/Journal voucher: Ledger window ke upar ke buttons (Receive, Pay, Expense, Income, Journal).
- **Saal band:** Accounts → New Accounting Year → "Close year & carry forward" (pehle backup lo). Balance aage naye saal me chale jaate hain.

### Reports (Tools → Reports, F7)
Sales register, item-wise sales, GST report, Schedule H/H1/X register, doctor/customer-wise, purchase reports, reorder list, fast/slow moving, expiry report, customer/supplier outstanding, month-wise profit. Har report ko CSV / Print kar sakte ho.

## Attendance (staff)
- Staff login karte hi **Punch In** ho jaata hai (late ho to orange "late"). Logout/Exit pe **Punch Out**.
- File → **Attendance** ya toolbar ke icon se apni attendance, ghante aur mahine ka register dekho; kabhi bhi manually Punch In/Out.
- **Admin** sabka register dekhta hai (P/A/L/H), kisi bhi din ka cell click karke Present/Absent/Leave/Half-day, time aur note edit kar sakta hai, CSV nikal sakta hai. Shift time aur grace Tools → Options me.

## Alerts / notifications
- Right side **Messages** panel aur status bar ka 🔔 count: expire ho chuka maal (red), 90 din me expire hone wala, reorder se kam stock, warehouse se aaya dispatch jo receive karna hai, rejected request, udhaar baaki, warehouse ko dena, aaj attendance nahi lagi. Click karo to seedha wahi window khulti hai. Login pe bhi toast aata hai.
- Bill me **dawa jo bina prescription nahi** (Schedule H = laal text + Rx, H1/X = laal highlight + doctor ka naam zaroori). Expire hone wala batch Exp cell me peela (90 din), expired laal.
- **Customer History** (Sale → Customer History, ya bill me customer ke saamne "history"): kitni baar aaya, kya kya kharida (kitni baar), doctor, udhaar, saare bills.

## Roz ka routine (short)
Subah: Expiry Watch + Reorder List → Din bhar: Sales Bill → Stock kam: Stock Request → Maal aaye: Receive Stock → Sham: Day Book check → Hafte me: Backup.
