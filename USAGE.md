# Medismart (PharmaDesk) – kaise use karein

**Login:** username `admin`  |  password `admin`  (pehle login ke baad Tools → Users && Rights me password badal lo)

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

### Purchase (supplier se maal)
1. Maal pehle aaya, bill baad me: **Purchase → Delivery Note** me supplier, batch, expiry, qty daalo → Save.
2. Bill aane par **Purchase → Purchase Invoice** (F4): Date, Invoice No, Supplier chuno. Delivery Note box se note chuno → **Import**.
3. Grid me rate, MRP, disc, GST bharo. Qty box ya strip dono me de sakte ho; free qty alag column me. **Cash purchase** tick karo agar nakad diya.
4. **Save** → stock badh jaata hai, supplier ka payable account me chadh jaata hai.
5. Order dena ho: **Order → Purchase Order** ya **Auto Create Order** (reorder / sales ratio se suggest).
6. Maal wapas: **Purchase → Purchase Return**.

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

## Roz ka routine (short)
Subah: Expiry Watch + Reorder List → Din bhar: Sales Bill → Maal aaye: Delivery Note → Bill aaye: Purchase Invoice → Sham: Day Book check → Hafte me: Backup.
