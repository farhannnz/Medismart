# MediSmart UI spec (from tutorial-video frames)

## Shell (confirmed)
- Title bar: `<Company>   Software Registered to <name>   DB:Account Accounting Year:01/Apr/2013 - 31/Mar/2014`
- Menu bar (13, in order): File, Create, List, Order, Purchase, Sale, Stock, Accounts, View, Navigate, Tools, Window, Help. Search box top-right "Search (Ctrl+I)".
- Toolbar: ~25 icons — Save, Clear(broom), Close(red x), Lock, then module shortcuts (purchase, sale, Rx, reports, accounts, items, manufacturer…), four yellow circular badges (I, L, D, T).
- MDI tabs under toolbar (first tab = home, then open windows with close x); tab-nav arrows at right.
- Dockable panels on right: Item List (ID, Item Name; search box; `#` prefix = inactive/zero stock), Manufacturer List (Manufacturer, Abbre.), Suppliers List, Account List (AccountName, AliasName), Type List, Messages (green panel). Left collapsed dock: ExplorerView, Batch.
- Status bar: left = "Row count : N", right = user, PC Clerk logo, date-time.
- Home/background: light grey with centered watermark.

## Screens confirmed
- Master dialogs: Item (ID, Name, Generic Name, Pack, P.Tax%, VAT%, Purchase Unit, Sales Unit, Ratio, Type, Schedule, Manufacturer, Division, Reorder Qty, Margin%, Rack, D%1, D%2, Unit Rate, Remarks; Delete/Update/Save), Account Details (Account Name+find, Alias, Group, Sub Group, Balance Limit Cr/Dr, Remarks, Opening Balance Cr/Dr + date; Sleep/Delete/Update/Save) on blue background.
- Sales bill & purchase invoice entry (see earlier notes).
- Delivery Note: Sl.No, Date, D.Note No, D.N.Date, Supplier Name, Remarks, Disc%; grid ID/Item Name/Batch/Exp/Ratio/Qty/Free/Rate/DAmt/Amount/MRP/Tax%/Tax Amt/S.Rate; totals Total/Tax/Cess/Discount/Cr.note/Round off/Net Total; Delete/Save.
- Batch Edit: ID, Name; grid Batch/ExpDate/Qty/P-S Ratio/Cost/S.Rate/D%1-3/Delete; bottom Rate/MRP/P%/D%1-3/D SRate1-3/P%MRP; Cancel/Update.
- Expiry Claim (tabs Claim/Unclaimed): Serial No, Date, Supplier Name, Pricing(By MRP), Selection Type, Expired, Manufacturer, Display; two grids (ID/Name/Exp/ExpQty/PQty/PFQty/Unit/MRP and selected ID/Name/Manu/batch/Exp/Qty/Unit/MRP/Expiry); Remarks, Total Amount, Print/Delete/Update.
- Reports pattern: toolbar (export, print, tick, search) + From/To + filters + Display; grid. Examples: Sales e-file (From, To, by bill prefix), Items Sold (Doctor filter; Item/Qty/Amount), Purchase Report Invoice wise (EntryDate, Inv.No, InvDate, Supplier, Item, Qty, FQty, Unit, Batch, ExpDate, Rate, Disc), Day Book (Date, SlNo, Particulars, Receipt, Payment, Locked, Audited).

## Still needed (not visible in any harvested frame)
- Dropdown items of each of the 13 menus; toolbar icon tooltips; Options dialog tabs; multi-series Bill Number Setting; Stock/Accounts report menus.
