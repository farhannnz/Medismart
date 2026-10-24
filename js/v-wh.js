/* Stock request, receive stock, warehouse stock, warehouse requests & dispatch */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;

function band(t) { return '<div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>' + esc(t || 'PharmaDesk') + '</b></div>'; }
function field(label, inner, cls) { return '<div class="pf ' + (cls || '') + '"><label>' + label + '</label>' + inner + '</div>'; }
function badge(s) { var c = { Pending: 'warn', Approved: 'ok', 'Partly approved': 'info', Rejected: 'bad', Cancelled: '', Received: 'ok', 'Received (short)': 'warn', 'In transit': 'info' }[s] || ''; return '<span class="badge ' + c + '">' + esc(s) + '</span>'; }
function download(name, obj) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function pickFile(cb) { var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = function () { var f = i.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { cb(JSON.parse(rd.result)); } catch (e) { PD.err(e.message ? e : new Error('Not a valid file')); } }; rd.readAsText(f); }; i.click(); }
function itemByName(n) { n = (n || '').toLowerCase(); return PD.DB.items.find(function (i) { return i.name.toLowerCase() === n; }); }
function unitName(l) { var it = svc.item(l.itemId); return l.unit === 'purchase' ? (it.punit || 'Box') : (it.unit || 'Strip'); }

/* ================= SHOP: new stock request ================= */
PD.views.request = { render: function (host, arg) {
  var D = PD.DB, grid;
  host.innerHTML = '<div class="msw pw">' + band() + '<div class="subtab"><span>Stock Request to ' + esc(D.settings.whName) + '</span></div>' +
    '<div class="phead"><fieldset><legend>Request Details</legend>' + field('Request No :', '<input class="in" readonly value="RQ-' + ('000000' + ((D.counters.RQ || 0) + 1)).slice(-6) + '">') + field('Date :', '<input class="in" readonly value="' + PD.fmtDate(PD.today()) + '">') + field('Requested by :', '<input class="in" readonly value="' + esc(PD.user.name) + '">') + '</fieldset>' +
    '<fieldset class="sd"><legend>Warehouse</legend>' + field('To :', '<input class="in" readonly value="' + esc(D.settings.whName) + '">', 'wide') + field('Remarks :', '<input class="in" id="rn" placeholder="e.g. weekly refill / urgent">', 'wide') + '<div class="pf wide"><span class="hint">The warehouse approves the request and dispatches the stock. Your stock increases only when you receive it (Purchase → Receive Stock).</span></div></fieldset></div>' +
    '<div class="pgrid" id="gr"></div>' +
    '<div class="msbot"><div class="mspanel"><div class="subtabs"><span class="on">&nbsp;&nbsp;.&nbsp;&nbsp;</span></div><div class="mspb"><div class="r3"><label>Item count :</label><b id="ic">0</b></div><div class="r3"><span class="hint">Quantity can be asked in box or strip. Use Auto Fill to add everything at or below reorder level.</span></div></div></div><div class="mstot"><div class="net"><span>Items :</span><b id="nl">0</b></div></div></div>' +
    '<div class="msbtns"><button class="mb" id="af">Auto Fill</button><button class="mb" id="del">✕ Delete</button><button class="mb" id="lst">Request List</button><span class="sp"></span><button class="mb" id="nw">New</button><button class="mb" id="sv">📨 Send Request</button></div></div>';
  grid = PD.grid($('#gr', host), { id: 'rq-grid', newLine: function () { return { itemId: '', unit: 'purchase', qty: '' }; },
    cols: [{ k: 'item', label: 'Item Name', type: 'item', always: true }, { k: 'unit', label: 'Unit', type: 'select', options: function (l) { var it = l.itemId && svc.item(l.itemId); return it ? [['purchase', it.punit || 'Box'], ['sale', it.unit || 'Strip']] : [['purchase', 'Box'], ['sale', 'Strip']]; } }, { k: 'qty', label: 'Qty', type: 'number', align: 'r', w: 70 },
      { k: 'shop', label: 'In shop', type: 'calc', align: 'r', calc: function (l) { return l.itemId ? PD.qty(svc.stockOf(l.itemId)) : ''; } }, { k: 'whs', label: 'At warehouse', type: 'calc', align: 'r', calc: function (l) { return l.itemId ? PD.qty(svc.whStockOf(l.itemId)) : ''; } }, { k: 'del', type: 'del', always: true }],
    onItem: function (l, it) { l.unit = 'purchase'; l.qty = 1; },
    hint: function (l) { if (!l.itemId) return ''; var it = svc.item(l.itemId), sold = svc.salesQty(PD.addDays(PD.today(), -30), PD.today())[it.id] || 0, whs = svc.whStockOf(it.id); return 'Shop stock <b>' + PD.qty(svc.stockOf(it.id)) + '</b> ' + esc(it.unit) + ' • sold last 30 days <b>' + PD.qty(sold) + '</b> • reorder level ' + it.reorder + ' • warehouse has <b>' + PD.qty(whs) + '</b>' + (whs <= 0 ? ' <span class="badge bad">not available</span>' : ''); },
    onChange: function (ls) { var n = ls.filter(function (l) { return l.itemId; }).length; var a = $('#ic', host), b = $('#nl', host); if (a) a.textContent = n; if (b) b.textContent = n; } });
  grid.addLine(false);
  $('#af', host).onclick = function () {
    var rows = svc.suggestPO({ mode: 'reorder', days: 30, cover: 15 }); if (!rows.length) { PD.toast('Nothing is below reorder level right now'); return; }
    grid.setLines(rows.map(function (s) { var it = svc.item(s.itemId); return { itemId: s.itemId, unit: 'purchase', qty: Math.max(1, Math.ceil(s.need / (it.conv || 1))) }; })); PD.toast(rows.length + ' items added', 'ok');
  };
  $('#nw', host).onclick = $('#del', host).onclick = function () { PD.views.request.render(host); };
  $('#lst', host).onclick = function () { PD.go('reqlist'); };
  $('#sv', host).onclick = function () { try { var r = svc.newRequest({ note: $('#rn', host).value, lines: grid.lines() }); PD.toast('Request ' + r.no + ' sent to ' + D.settings.whName, 'ok'); PD.go('reqlist'); } catch (e) { PD.err(e); } };
  if (arg && arg.auto) $('#af', host).click();
} };

/* ================= SHOP: request list ================= */
function reqHTML(r) {
  var d = r.dispatchId && PD.DB.dispatches.find(function (x) { return x.id === r.dispatchId; });
  return '<div class="row sp"><div><b>' + esc(r.no) + '</b> • ' + PD.fmtDate(r.date) + ' ' + esc(r.time || '') + ' • by ' + esc(r.by) + '<br><span class="mut">' + esc(r.note || '') + '</span></div><div>' + badge(r.status) + '</div></div>' +
    (r.decision ? '<p class="hint">Warehouse: ' + esc(r.decision.by) + ' on ' + PD.fmtDate(r.decision.date) + (r.decision.note ? ' — ' + esc(r.decision.note) : '') + '</p>' : '') +
    '<div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>Item</th><th class="r">Requested</th><th class="r">Dispatched</th></tr></thead><tbody>' + r.lines.map(function (l, i) { var got = d ? d.lines.filter(function (x) { return x.reqIdx === i; }).reduce(function (a, x) { return a + x.qty; }, 0) : 0; return '<tr><td>' + esc(svc.itemName(l.itemId)) + '</td><td class="r">' + PD.qty(l.qty) + ' ' + esc(unitName(l)) + '</td><td class="r">' + (d ? PD.qty(got) + ' ' + esc(svc.item(l.itemId).unit) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    (d ? '<p class="hint">Dispatch <b>' + esc(d.no) + '</b> • ' + badge(d.status) + ' • value ' + PD.money(d.total) + '</p>' : '');
}
PD.views.reqlist = { render: function (host) {
  var D = PD.DB; host.innerHTML = '<div id="rl"></div>';
  PD.report($('#rl', host), { id: 'rq-list', title: 'Stock requests to warehouse', filters: [{ k: 'st', label: 'Status', type: 'select', options: [['', 'All'], 'Pending', 'Approved', 'Partly approved', 'Rejected', 'Received', 'Received (short)', 'Cancelled'] }],
    load: function (f) { return { cols: [{ k: 'no', label: 'Request' }, { k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'by', label: 'By' }, { k: 'n', label: 'Items', align: 'r' }, { k: 'note', label: 'Remarks' }, { k: 'status', label: 'Status', fmt: badge }, { k: 'disp', label: 'Dispatch' }],
      rows: D.requests.filter(function (r) { return !f.st || r.status === f.st; }).slice().reverse().map(function (r) { var d = D.dispatches.find(function (x) { return x.id === r.dispatchId; }); return { id: r.id, no: r.no, date: r.date, by: r.by, n: r.lines.length, note: r.note, status: r.status, disp: d ? d.no + ' (' + d.status + ')' : '' }; }), note: 'Click a request to see details.' }; },
    drill: function (row) {
      var r = D.requests.find(function (x) { return x.id === row.id; }), d = r.dispatchId && D.dispatches.find(function (x) { return x.id === r.dispatchId; });
      var foot = [{ label: 'Close' }, { label: 'Export request file', fn: function () { download(r.no + '.request.json', { type: 'request', shop: D.shop.name, no: r.no, date: r.date, note: r.note, lines: r.lines.map(function (l) { return { name: svc.itemName(l.itemId), qty: l.qty, unit: l.unit }; }) }); return false; } }];
      if (r.status === 'Pending') foot.push({ label: 'Cancel request', cls: 'd', fn: function () { try { svc.cancelRequest(r.id); PD.toast('Cancelled'); PD.views.reqlist.render(host); } catch (e) { PD.err(e); return false; } } });
      if (d && d.status === 'In transit') foot.push({ label: 'Receive stock', cls: 'p', fn: function () { PD.go('receive', { dispatchId: d.id }); } });
      PD.modal({ title: 'Request ' + r.no, size: 'lg', body: reqHTML(r), foot: foot });
    } });
  $('#r-act', host) && $('#r-act', host).insertAdjacentHTML('afterbegin', '<button class="btn sm p" id="nrq">+ New request</button>');
  var b = $('#nrq', host); if (b) b.onclick = function () { PD.go('request'); };
} };

/* ================= SHOP: receive stock ================= */
PD.views.receive = { render: function (host, arg) {
  var D = PD.DB, cur = (arg && arg.dispatchId) || '', recv = {};
  var open = D.dispatches.filter(function (d) { return d.status === 'In transit'; });
  if (!cur && open.length) cur = open[0].id;
  var d = cur && D.dispatches.find(function (x) { return x.id === cur; });
  host.innerHTML = '<div class="msw pw">' + band() + '<div class="subtab"><span>Receive Stock</span></div>' +
    '<div class="phead"><fieldset><legend>Dispatch Details</legend>' + field('Dispatch :', '<select class="in" id="ds"><option value="">— none in transit —</option>' + open.map(function (x) { return '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.no + ' • ' + PD.fmtDate(x.date)) + '</option>'; }).join('') + '</select>') + field('Request :', '<input class="in" readonly value="' + esc(d ? d.requestNo : '') + '">') + field('Sent by :', '<input class="in" readonly value="' + esc(d ? d.by : '') + '">') + '</fieldset>' +
    '<fieldset class="sd"><legend>Warehouse</legend>' + field('From :', '<input class="in" readonly value="' + esc(D.settings.whName) + '">', 'wide') + field('Note :', '<input class="in" readonly value="' + esc(d ? d.note : '') + '">', 'wide') + '<div class="pf wide"><label>&nbsp;</label><label class="chk"><input type="checkbox" id="cashp"> Cash paid on receipt</label></div></fieldset></div>' +
    '<div class="pgrid"><table class="t"><thead><tr><th>#</th><th>Item</th><th>Batch</th><th>Exp</th><th class="r">Sent</th><th class="r">Received</th><th class="r">Rate</th><th class="r">MRP</th><th class="r">GST%</th><th class="r">Amount</th></tr></thead><tbody id="rb"></tbody></table>' + (d ? '' : '<div class="empty">No dispatch is waiting. Raise a request (Order → Stock Request) or import a dispatch file from the warehouse.</div>') + '</div>' +
    '<div class="msbot"><div class="mspanel"><div class="subtabs"><span class="on">&nbsp;&nbsp;.&nbsp;&nbsp;</span></div><div class="mspb"><div class="r3"><span class="hint">Check the boxes against the goods. Enter the quantity you actually received — any shortage goes back to the warehouse. Stock, GST input and the amount payable to the warehouse are posted when you click Receive.</span></div></div></div><div class="mstot"><div class="tl"><label>Total :</label><input class="in" id="t1" readonly value="0.00"></div><div class="tl"><label>Tax :</label><input class="in" id="t2" readonly value="0.00"></div><div class="net"><span>Net Total :</span><b id="t3">0.00</b></div></div></div>' +
    '<div class="msbtns"><button class="mb" id="imp">Import dispatch file</button><button class="mb" id="rl">Request List</button><span class="sp"></span><button class="mb" id="rcv"' + (d ? '' : ' disabled') + '>✔ Receive</button></div></div>';
  function totals() { var t = 0, x = 0; if (d) d.lines.forEach(function (l, i) { var q = recv[i] != null ? recv[i] : l.qty, a = q * l.rate; t += a; x += a * l.tax / 100; }); $('#t1', host).value = PD.n2(t); $('#t2', host).value = PD.n2(x); $('#t3', host).textContent = PD.n2(t + x); if (d) PD.$$('[data-am]', host).forEach(function (c) { var l = d.lines[+c.dataset.am], q = recv[+c.dataset.am] != null ? recv[+c.dataset.am] : l.qty; c.textContent = PD.n2(q * l.rate * (1 + l.tax / 100)); }); }
  if (d) { $('#rb', host).innerHTML = d.lines.map(function (l, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(svc.itemName(l.itemId)) + '</td><td>' + esc(l.batchNo) + '</td><td>' + PD.fmtExp(l.expiry) + '</td><td class="r">' + PD.qty(l.qty) + '</td><td class="r"><input class="in sm" type="number" step="any" min="0" max="' + l.qty + '" data-q="' + i + '" value="' + l.qty + '" style="width:70px"></td><td class="r">' + PD.n2(l.rate) + '</td><td class="r">' + PD.n2(l.mrp) + '</td><td class="r">' + l.tax + '</td><td class="r" data-am="' + i + '"></td></tr>'; }).join(''); }
  PD.on(host, 'input', '[data-q]', function (e, t) { recv[+t.dataset.q] = PD.num(t.value); totals(); });
  totals();
  $('#ds', host).onchange = function () { PD.views.receive.render(host, { dispatchId: this.value }); };
  $('#rl', host).onclick = function () { PD.go('reqlist'); };
  $('#rcv', host).onclick = function () { try { var inv = svc.receiveDispatch(d.id, recv, { payMode: $('#cashp', host).checked ? 'cash' : 'credit' }); PD.toast('Stock received • ' + inv.no + ' • ' + PD.money(inv.total), 'ok'); PD.views.receive.render(host); } catch (e) { PD.err(e); } };
  $('#imp', host).onclick = function () {
    pickFile(function (f) {
      if (f.type !== 'dispatch') throw new Error('This is not a dispatch file');
      if (D.dispatches.some(function (x) { return x.no === f.no; })) throw new Error('Dispatch ' + f.no + ' is already imported');
      var lines = f.lines.map(function (l) { var it = itemByName(l.name); if (!it) throw new Error('Item "' + l.name + '" is not in your item list. Create it first (Create → Item).'); return { itemId: it.id, reqIdx: l.reqIdx, batchNo: l.batchNo, expiry: l.expiry, mrp: l.mrp, rate: l.rate, qty: l.qty, tax: l.tax }; });
      var r = D.requests.find(function (x) { return x.no === f.requestNo; }), nd = { id: PD.uid('dc'), no: f.no, date: f.date, requestId: r ? r.id : '', requestNo: f.requestNo, lines: lines, status: 'In transit', by: f.by, note: f.note || '', external: true };
      var v = svc.dispatchValue(nd); nd.taxable = v.taxable; nd.tax = v.tax; nd.total = v.total; D.dispatches.push(nd); if (r) { r.dispatchId = nd.id; r.status = 'Approved'; } PD.save(); PD.toast('Dispatch ' + nd.no + ' imported', 'ok'); PD.views.receive.render(host, { dispatchId: nd.id });
    });
  };
} };

/* ================= WAREHOUSE: stock ================= */
PD.views.whstock = { render: function (host, arg) {
  var D = PD.DB, grid;
  host.innerHTML = '<div class="card"><div class="hd"><h3 style="padding:0;border:0">Add stock to ' + esc(D.settings.whName) + '</h3><span class="sp"></span><span class="hint">Goods the warehouse has received. Batch-wise, so dispatch can follow first-expiry-first-out.</span></div><div class="bd" id="wg"></div><div class="bd row sp"><b id="wt">Total: ₹0.00</b><button class="btn p" id="wsv">Save to warehouse stock</button></div></div><div id="wl" style="margin-top:12px"></div>';
  grid = PD.grid($('#wg', host), { id: 'wh-grid', newLine: function () { return { itemId: '', batchNo: '', expiry: '', unit: 'purchase', qty: '', rate: '', mrp: '' }; },
    cols: [{ k: 'item', label: 'Item', type: 'item', always: true }, { k: 'batchNo', label: 'Batch', w: 90 }, { k: 'expiry', label: 'Expiry', type: 'month', w: 120 }, { k: 'unit', label: 'Unit', type: 'select', options: function (l) { var it = l.itemId && svc.item(l.itemId); return it ? [['purchase', it.punit || 'Box'], ['sale', it.unit || 'Strip']] : [['purchase', 'Box'], ['sale', 'Strip']]; } }, { k: 'qty', label: 'Qty', type: 'number', align: 'r', w: 70 }, { k: 'rate', label: 'Transfer rate / unit (sale unit)', type: 'number', align: 'r', w: 100 }, { k: 'mrp', label: 'MRP / unit', type: 'number', align: 'r', w: 80 }, { k: 'del', type: 'del', always: true }],
    onItem: function (l, it) { l.mrp = it.mrp; l.rate = PD.r2(it.mrp * 0.72); }, onChange: function (ls) { var t = 0; ls.forEach(function (l) { if (l.itemId) { var it = svc.item(l.itemId); t += PD.num(l.qty) * (l.unit === 'purchase' ? it.conv || 1 : 1) * PD.num(l.rate); } }); var o = $('#wt', host); if (o) o.textContent = 'Total: ' + PD.money(t); } });
  grid.addLine(false);
  $('#wsv', host).onclick = function () { try { var n = svc.whAddStock(grid.lines()); PD.toast(n + ' lines added to warehouse stock', 'ok'); PD.views.whstock.render(host); } catch (e) { PD.err(e); } };
  PD.report($('#wl', host), { id: 'wh-stock', title: 'Warehouse stock (item-wise)', filters: [{ k: 'only', label: 'Show', type: 'select', options: [['', 'All'], ['in', 'In stock'], ['out', 'Out of stock']] }],
    load: function (f) { var m = {}, nb = {}, val = {}; D.whBatches.forEach(function (b) { m[b.itemId] = (m[b.itemId] || 0) + b.qty; if (b.qty > 0) { nb[b.itemId] = (nb[b.itemId] || 0) + 1; val[b.itemId] = (val[b.itemId] || 0) + b.qty * b.rate; } });
      return { cols: [{ k: 'name', label: 'Item', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'mfr', label: 'Manufacturer' }, { k: 'nb', label: 'Batches', align: 'r' }, { k: 'qty', label: 'Stock', align: 'r', sum: true, fmt: function (v, r) { return '<span class="badge ' + (v <= 0 ? 'bad' : 'ok') + '">' + PD.qty(v) + ' ' + esc(r.unit) + '</span>'; }, raw: function (r) { return r.qty; } }, { k: 'val', label: 'Value (transfer rate)', align: 'r', sum: true, fmt: PD.n2 }],
        rows: D.items.map(function (i) { return { id: i.id, name: i.name, mfr: svc.mfrName(i.mfrId), nb: nb[i.id] || 0, qty: PD.r2(m[i.id] || 0), unit: i.unit, val: PD.r2(val[i.id] || 0) }; }).filter(function (r) { return !f.only || (f.only === 'in' ? r.qty > 0 : r.qty <= 0); }) }; } });
} };

/* ================= WAREHOUSE: requests & dispatch ================= */
function challanHTML(d) {
  var D = PD.DB, v = svc.dispatchValue(d);
  return '<h2>' + esc(D.settings.whName) + '</h2><h3>Delivery challan ' + esc(d.no) + '</h3><div>Date ' + PD.fmtDate(d.date) + ' • Against request ' + esc(d.requestNo) + ' • To: <b>' + esc(D.shop.name) + '</b></div><br><table><thead><tr><th>#</th><th>Item</th><th>Batch</th><th>Exp</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST%</th><th class="r">Amount</th></tr></thead><tbody>' + d.lines.map(function (l, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(svc.itemName(l.itemId)) + '</td><td>' + esc(l.batchNo) + '</td><td>' + PD.fmtExp(l.expiry) + '</td><td class="r">' + PD.qty(l.qty) + '</td><td class="r">' + PD.n2(l.rate) + '</td><td class="r">' + l.tax + '</td><td class="r">' + PD.n2(l.qty * l.rate) + '</td></tr>'; }).join('') + '</tbody><tfoot><tr><td colspan="7" class="r">Taxable ' + PD.n2(v.taxable) + ' + GST ' + PD.n2(v.tax) + '</td><td class="r b">' + PD.n2(v.total) + '</td></tr></tfoot></table>';
}
PD.views.whreq = { render: function (host, arg) {
  var D = PD.DB, tab = (arg && arg.tab) || 'req', sel = (arg && arg.reqId) || '';
  host.innerHTML = '<div class="msw whw">' + band('Warehouse') + '<div class="subtabs bigtabs"><span data-t="req" class="' + (tab === 'req' ? 'on' : '') + '">Incoming Requests</span><span data-t="hist" class="' + (tab === 'hist' ? 'on' : '') + '">Dispatches</span></div><div id="wb" style="padding:8px 10px"></div></div>';
  PD.on(host, 'click', '[data-t]', function (e, t) { PD.views.whreq.render(host, { tab: t.dataset.t }); });
  var b = $('#wb', host);
  if (tab === 'hist') {
    b.innerHTML = '<div class="msgrid" style="margin:0;max-height:62vh;background:#fff"><table class="t"><thead><tr><th>Dispatch</th><th>Date</th><th>Request</th><th class="r">Lines</th><th class="r">Value</th><th>Status</th><th></th></tr></thead><tbody>' + (D.dispatches.slice().reverse().map(function (d) { return '<tr><td><b>' + esc(d.no) + '</b></td><td>' + PD.fmtDate(d.date) + '</td><td>' + esc(d.requestNo) + '</td><td class="r">' + d.lines.length + '</td><td class="r">' + PD.n2(d.total) + '</td><td>' + badge(d.status) + '</td><td class="r nw"><button class="btn sm" data-pr="' + d.id + '">Print challan</button> <button class="btn sm" data-ex="' + d.id + '">Export file</button></td></tr>'; }).join('') || '<tr><td colspan="7"><div class="empty">Nothing dispatched yet.</div></td></tr>') + '</tbody></table></div>';
    PD.on(b, 'click', '[data-pr]', function (e, t) { PD.printHTML(challanHTML(D.dispatches.find(function (x) { return x.id === t.dataset.pr; }))); });
    PD.on(b, 'click', '[data-ex]', function (e, t) { var d = D.dispatches.find(function (x) { return x.id === t.dataset.ex; }); download(d.no + '.dispatch.json', { type: 'dispatch', warehouse: D.settings.whName, no: d.no, date: d.date, requestNo: d.requestNo, by: d.by, note: d.note, lines: d.lines.map(function (l) { return { name: svc.itemName(l.itemId), reqIdx: l.reqIdx, batchNo: l.batchNo, expiry: l.expiry, mrp: l.mrp, rate: l.rate, qty: l.qty, tax: l.tax }; }) }); });
    return;
  }
  var pend = D.requests.filter(function (r) { return r.status === 'Pending'; });
  if (!sel && pend.length) sel = pend[0].id;
  var r = sel && D.requests.find(function (x) { return x.id === sel; });
  b.innerHTML = '<div class="whg"><div class="whl"><div class="row sp" style="margin-bottom:6px"><b>Pending (' + pend.length + ')</b><button class="btn sm" id="imr">Import request file</button></div>' + (pend.map(function (x) { return '<div class="whi ' + (x.id === sel ? 'on' : '') + '" data-q="' + x.id + '"><b>' + esc(x.no) + '</b> <small>' + PD.fmtDate(x.date) + ' ' + esc(x.time || '') + '</small><br><small>' + esc(x.by) + ' • ' + x.lines.length + ' items' + (x.note ? ' • ' + esc(x.note) : '') + '</small></div>'; }).join('') || '<div class="empty">No pending requests.</div>') + '</div>' +
    '<div class="whd">' + (r ? '<div class="row sp"><b style="font-size:15px">' + esc(r.no) + ' — ' + esc(D.shop.name) + '</b>' + badge(r.status) + '</div><div class="msgrid" style="margin:6px 0;background:#fff"><table class="t"><thead><tr><th>Item</th><th class="r">Requested</th><th class="r">Warehouse stock</th><th class="r">Approve qty (strip)</th><th class="r">Rate / strip</th></tr></thead><tbody>' + r.lines.map(function (l, i) { var it = svc.item(l.itemId), av = svc.whStockOf(l.itemId), bs = svc.whBatchesOf(l.itemId), rate = bs.length ? bs[0].rate : PD.r2(it.mrp * 0.72); return '<tr><td><b>' + esc(it.name) + '</b><br><small class="mut">' + esc(it.generic) + '</small></td><td class="r">' + PD.qty(l.qty) + ' ' + esc(unitName(l)) + '<br><small class="mut">= ' + PD.qty(l.qtyS) + ' ' + esc(it.unit) + '</small></td><td class="r">' + (av > 0 ? PD.qty(av) : '<span class="badge bad">out</span>') + '</td><td class="r"><input class="in sm" type="number" step="any" min="0" max="' + av + '" data-a="' + i + '" value="' + Math.min(l.qtyS, av) + '" style="width:80px"></td><td class="r"><input class="in sm" type="number" step="any" min="0" data-r="' + i + '" value="' + rate + '" style="width:80px"></td></tr>'; }).join('') + '</tbody></table></div><div class="row"><input class="in" id="dn" placeholder="Note for the shop (optional)" style="flex:1"><button class="btn p" id="ap">✔ Approve &amp; Dispatch</button><button class="btn d" id="rj">Reject</button></div><p class="hint">Batches are picked first-expiry-first-out. The shop receives a delivery challan; its stock increases only when it confirms receipt.</p>' : '<div class="empty">Select a request on the left.</div>') + '</div></div>';
  PD.on(b, 'click', '[data-q]', function (e, t) { PD.views.whreq.render(host, { reqId: t.dataset.q }); });
  $('#imr', b).onclick = function () {
    pickFile(function (f) {
      if (f.type !== 'request') throw new Error('This is not a request file');
      if (D.requests.some(function (x) { return x.extNo === f.no && x.by === f.shop; })) throw new Error('Request ' + f.no + ' is already imported');
      var lines = f.lines.map(function (l) { var it = itemByName(l.name); if (!it) throw new Error('Item "' + l.name + '" is not in the item list'); var conv = l.unit === 'purchase' ? it.conv || 1 : 1; return { itemId: it.id, qty: l.qty, unit: l.unit, qtyS: PD.r2(l.qty * conv) }; });
      var nr = { id: PD.uid('rq'), no: f.no, extNo: f.no, date: f.date, time: '', by: f.shop, note: f.note || '', lines: lines, status: 'Pending', dispatchId: '', decision: null }; D.requests.push(nr); PD.save(); PD.toast('Request ' + nr.no + ' imported', 'ok'); PD.views.whreq.render(host, { reqId: nr.id });
    });
  };
  if (r) {
    $('#ap', b).onclick = function () {
      try {
        var ap = r.lines.map(function (l, i) { return { idx: i, qtyS: PD.num($('[data-a="' + i + '"]', b).value), rate: PD.num($('[data-r="' + i + '"]', b).value) }; });
        var d = svc.approveRequest(r.id, ap, $('#dn', b).value); PD.toast('Dispatched ' + d.no + ' • ' + PD.money(d.total), 'ok');
        PD.confirm('Print the delivery challan?', 'Print').then(function (ok) { if (ok) PD.printHTML(challanHTML(d)); }); PD.views.whreq.render(host);
      } catch (e) { PD.err(e); }
    };
    $('#rj', b).onclick = function () { PD.prompt('Reject request ' + r.no, 'Reason (the shop will see this)').then(function (v) { if (v == null) return; try { svc.rejectRequest(r.id, v); PD.toast('Request rejected'); PD.views.whreq.render(host); } catch (e) { PD.err(e); } }); };
  }
} };
})();
