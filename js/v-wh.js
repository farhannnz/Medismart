/* Shop side of the warehouse hand-off: stock request, request list, receive stock (the warehouse itself is separate software) */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;

function band(t) { return '<div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>' + esc(t || 'Medismart') + '</b></div>'; }
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
    '<fieldset class="sd"><legend>Warehouse</legend>' + field('To :', '<input class="in" readonly value="' + esc(D.settings.whName) + '">', 'wide') + field('Remarks :', '<input class="in" id="rn" placeholder="e.g. weekly refill / urgent">', 'wide') + '<div class="pf wide"><span class="hint">Click Send: the request reaches the warehouse instantly. When the warehouse sends the goods, they appear in Receive Stock (F4). Your stock increases only when you receive them.</span></div></fieldset></div>' +
    '<div class="pgrid" id="gr"></div>' +
    '<div class="msbot"><div class="mspanel"><div class="subtabs"><span class="on">&nbsp;&nbsp;.&nbsp;&nbsp;</span></div><div class="mspb"><div class="r3"><label>Item count :</label><b id="ic">0</b></div><div class="r3"><span class="hint">Quantity can be asked in box or strip. Use Auto Fill to add everything at or below reorder level.</span></div></div></div><div class="mstot"><div class="net"><span>Items :</span><b id="nl">0</b></div></div></div>' +
    '<div class="msbtns"><button class="mb" id="af">Auto Fill</button><button class="mb" id="del">✕ Delete</button><button class="mb" id="lst">Request List</button><span class="sp"></span><button class="mb" id="nw">New</button><button class="mb" id="sv">📨 Send Request</button></div></div>';
  grid = PD.grid($('#gr', host), { id: 'rq-grid', newLine: function () { return { itemId: '', unit: 'purchase', qty: '' }; },
    cols: [{ k: 'item', label: 'Item Name', type: 'item', always: true }, { k: 'unit', label: 'Unit', type: 'select', options: function (l) { var it = l.itemId && svc.item(l.itemId); return it ? [['purchase', it.punit || 'Box'], ['sale', it.unit || 'Strip']] : [['purchase', 'Box'], ['sale', 'Strip']]; } }, { k: 'qty', label: 'Qty', type: 'number', align: 'r', w: 70 },
      { k: 'shop', label: 'In shop', type: 'calc', align: 'r', calc: function (l) { return l.itemId ? PD.qty(svc.stockOf(l.itemId)) : ''; } }, { k: 'del', type: 'del', always: true }],
    onItem: function (l, it) { l.unit = 'purchase'; l.qty = 1; },
    hint: function (l) { if (!l.itemId) return ''; var it = svc.item(l.itemId), sold = svc.salesQty(PD.addDays(PD.today(), -30), PD.today())[it.id] || 0; return 'Shop stock <b>' + PD.qty(svc.stockOf(it.id)) + '</b> ' + esc(it.unit) + ' • sold last 30 days <b>' + PD.qty(sold) + '</b> • reorder level ' + it.reorder + ''; },
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
      var foot = [{ label: 'Close' }];
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
    '<fieldset class="sd"><legend>Warehouse</legend>' + field('From :', '<input class="in" readonly value="' + esc(D.settings.whName) + '">', 'wide') + field('Note :', '<input class="in" readonly value="' + esc(d ? d.note : '') + '">', 'wide') + '<div class="pf wide"><label>&nbsp;</label><label class="chk mut">' + (d && d.bill ? 'Bill from the warehouse (no GST): added to what we owe the warehouse' : 'Stock transfer at warehouse cost (no payment)') + '</label></div></fieldset></div>' +
    '<div class="scanbox"><label>Scan strips to count (optional):</label><input class="in" id="scn" autocomplete="off" placeholder="scan each strip barcode with the scanner" style="max-width:340px"><span id="fb" class="fb"></span></div><datalist id="shelfs">' + svc.shelfList().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="pgrid"><table class="t"><thead><tr><th>#</th><th>Item</th><th>Batch</th><th>Exp</th><th>Shelf</th><th class="r">Sent</th><th class="r">Received</th><th class="r">Rate</th><th class="r">MRP</th><th class="r">GST%</th><th class="r">Amount</th></tr></thead><tbody id="rb"></tbody></table>' + (d ? '' : '<div class="empty">Nothing is on the way right now. Send a Stock Request (F3); when the warehouse dispatches it, it shows up here automatically.</div>') + '</div>' +
    '<div class="msbot"><div class="mspanel"><div class="subtabs"><span class="on">&nbsp;&nbsp;.&nbsp;&nbsp;</span></div><div class="mspb"><div class="r3"><span class="hint">Count the goods and enter the quantity actually received. Decide the shelf: a medicine already in your shop shows its shelf, keep it there; a new medicine needs a shelf before you can receive it. Stock, GST input and the amount payable to the warehouse are posted when you click Receive.</span></div></div></div><div class="mstot"><div class="tl"><label>Total :</label><input class="in" id="t1" readonly value="0.00"></div><div class="tl"><label>Tax :</label><input class="in" id="t2" readonly value="0.00"></div><div class="net"><span>Net Total :</span><b id="t3">0.00</b></div></div></div>' +
    '<div class="msbtns"><button class="mb" id="rl">Request List</button><span class="sp"></span><button class="mb" id="rcv"' + (d ? '' : ' disabled') + '>✔ Receive</button></div></div>';
  function shelfCell(l, i) {
    var it = svc.item(l.itemId), has = !!it.rack, st = svc.stockOf(l.itemId);
    return '<input class="in sm shelf ' + (has ? '' : 'need') + '" data-sh="' + i + '" list="shelfs" value="' + esc(it.rack || '') + '" placeholder="Assign shelf *" style="width:92px">' + (has ? '<br><small class="mut">' + (st > 0 ? 'already in shop → keep here' : 'your shelf') + '</small>' : '<br><small style="color:#c62828">new medicine</small>');
  }
  function totals() { var t = 0, x = 0; if (d) d.lines.forEach(function (l, i) { var q = recv[i] != null ? recv[i] : l.qty, a = q * l.rate; t += a; x += a * l.tax / 100; }); $('#t1', host).value = PD.n2(t); $('#t2', host).value = PD.n2(x); $('#t3', host).textContent = PD.n2(t + x); if (d) PD.$$('[data-am]', host).forEach(function (c) { var l = d.lines[+c.dataset.am], q = recv[+c.dataset.am] != null ? recv[+c.dataset.am] : l.qty; c.textContent = PD.n2(q * l.rate * (1 + l.tax / 100)); }); }
  if (d) { $('#rb', host).innerHTML = d.lines.map(function (l, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(svc.itemName(l.itemId)) + '</td><td>' + esc(l.batchNo) + '</td><td>' + PD.fmtExp(l.expiry) + '</td><td>' + shelfCell(l, i) + '</td><td class="r">' + PD.qty(l.qty) + ' ' + esc(svc.item(l.itemId).unit || '') + (l.per > 1 ? '<br><small class="mut">' + l.strips + ' strips × ' + l.per + '</small>' : '') + '</td><td class="r"><input class="in sm" type="number" step="any" min="0" max="' + l.qty + '" data-q="' + i + '" value="' + l.qty + '" style="width:70px"></td><td class="r">' + PD.n2(l.rate) + '</td><td class="r">' + PD.n2(l.mrp) + '</td><td class="r">' + l.tax + '</td><td class="r" data-am="' + i + '"></td></tr>'; }).join(''); }
  PD.on(host, 'input', '[data-q]', function (e, t) { recv[+t.dataset.q] = PD.num(t.value); totals(); });
  var seen = {}, scanMode = false;
  var scn = $('#scn', host);
  if (scn) scn.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; e.preventDefault(); var txt = scn.value; scn.value = ''; var fb = $('#fb', host); if (!txt.trim() || !d) return;
    function say(ok, m) { fb.innerHTML = '<span style="color:' + (ok ? '#2e8b57' : '#c62828') + '">' + (ok ? '✔ ' : '✖ ') + esc(m) + '</span>'; }
    var st = svc.parseStrip(txt); if (!st) { say(false, 'Not a Medismart strip barcode'); return; }
    var idx = st.unknown ? d.lines.findIndex(function (l) { return l.serials && l.serials.indexOf(st.serial) >= 0; }) : d.lines.findIndex(function (l) { var it = svc.item(l.itemId); return it.name.toLowerCase() === String(st.name).toLowerCase() && l.batchNo === st.batchNo; });
    if (idx < 0) { say(false, st.serial + ' is not in this dispatch'); return; }
    st.name = svc.itemName(d.lines[idx].itemId); st.batchNo = d.lines[idx].batchNo;
    var l = d.lines[idx]; if (l.serials && l.serials.length && l.serials.indexOf(st.serial) < 0) { say(false, st.serial + ' was not sent in this dispatch'); return; }
    if (seen[st.serial]) { say(false, st.serial + ' already scanned'); return; }
    if (!scanMode) { scanMode = true; d.lines.forEach(function (x, i) { recv[i] = 0; }); PD.$$('[data-q]', host).forEach(function (x) { x.value = 0; }); }
    var step = l.per || 1, un = svc.item(l.itemId).unit || '';
    if ((recv[idx] || 0) + step > l.qty + 1e-9) { say(false, 'Already counted all ' + l.qty + ' ' + un + ' of ' + st.name); return; }
    seen[st.serial] = 1; recv[idx] = (recv[idx] || 0) + step; var inp = $('[data-q="' + idx + '"]', host); if (inp) inp.value = recv[idx]; totals();
    say(true, st.name + ' • ' + recv[idx] + ' / ' + l.qty + ' ' + un + (step > 1 ? ' (' + Math.round(recv[idx] / step) + ' strips)' : ''));
  });
  totals();
  $('#ds', host).onchange = function () { PD.views.receive.render(host, { dispatchId: this.value }); };
  $('#rl', host).onclick = function () { PD.go('reqlist'); };
  $('#rcv', host).onclick = function () { try { var sh = {}; PD.$$('[data-sh]', host).forEach(function (x) { sh[+x.dataset.sh] = x.value; }); var inv = svc.receiveDispatch(d.id, recv, { shelves: sh }); PD.toast('Stock received • ' + inv.no + ' • ' + PD.money(inv.total), 'ok'); PD.views.receive.render(host); } catch (e) { PD.err(e); } };
} };


/* ================= import the item list sent by the warehouse ================= */
PD.views.itemsimport = { render: function (host) {
  host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Import Item List from Warehouse</b></div><div style="padding:14px 16px"><p>Medicines are created by the warehouse, not by the shop. Ask the warehouse for its <b>item list file</b> and import it here. New medicines are added, existing ones are updated. Your shelves are never changed.</p><p class="hint">You do not have to do this before the first dispatch: a medicine that arrives in a dispatch file is added automatically.</p><div class="row" style="margin:14px 0"><button class="btn p lg" id="pick">Choose item list file…</button></div><div id="res"></div></div></div>';
  $('#pick', host).onclick = function () { pickFile(function (f) { var r = svc.importItems(f); $('#res', host).innerHTML = '<div class="card"><div class="bd"><b>Done.</b> ' + r.added + ' new medicine(s) added, ' + r.updated + ' updated. Total medicines: ' + PD.DB.items.length + '.</div></div>'; PD.toast('Item list imported', 'ok'); }); };
} };

/* ================= SHELVES ================= */
PD.views.shelves = { render: function (host, arg) {
  var D = PD.DB, f = (arg && arg.f) || 'all', q = (arg && arg.q) || '';
  var st = svc.stockMap(), shelves = svc.shelfList();
  host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Shelves</b></div><div style="padding:8px 12px"><p class="hint" style="margin-bottom:8px">Every medicine has one shelf. A new medicine gets its shelf when you receive it. Here you can see where everything is kept and move a medicine to another shelf.</p>' +
    '<div class="row" style="margin-bottom:8px"><select class="in sm" id="sf" style="width:auto"><option value="all">All medicines in stock</option><option value="none">Without a shelf</option>' + shelves.map(function (x) { return '<option value="' + esc(x) + '">Shelf ' + esc(x) + '</option>'; }).join('') + '</select><input class="in sm" id="sq" placeholder="Search medicine" value="' + esc(q) + '" style="max-width:240px"><span class="sp"></span><span class="hint" id="sc"></span></div>' +
    '<datalist id="shelfs">' + shelves.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist><div class="msgrid" style="margin:0;background:#fff;max-height:62vh"><table class="t"><thead><tr><th>Shelf</th><th>Medicine</th><th class="r">In stock</th><th>Nearest expiry</th><th></th></tr></thead><tbody id="sb"></tbody></table></div></div></div>';
  $('#sf', host).value = f;
  function rows() {
    var ql = $('#sq', host).value.toLowerCase(), fv = $('#sf', host).value;
    var list = D.items.filter(function (i) { return i.active !== false && (st[i.id] > 0 || (fv === 'none' && !i.rack)) && (!ql || (i.name + ' ' + i.generic).toLowerCase().indexOf(ql) >= 0) && (fv === 'all' || (fv === 'none' ? !i.rack : i.rack === fv)); })
      .sort(function (a, b) { return (a.rack || '~').localeCompare(b.rack || '~') || a.name.localeCompare(b.name); });
    $('#sc', host).textContent = list.length + ' medicines';
    $('#sb', host).innerHTML = list.map(function (i) {
      var bs = svc.batchesOf(i.id, true).filter(function (b) { return b.expiry; }).sort(function (a, b) { return a.expiry.localeCompare(b.expiry); });
      return '<tr><td><input class="in sm sh" data-i="' + i.id + '" list="shelfs" value="' + esc(i.rack || '') + '" placeholder="no shelf" style="width:110px;' + (i.rack ? '' : 'border-color:#c62828') + '"></td><td><b>' + esc(i.name) + '</b><br><small class="mut">' + esc(i.generic) + '</small></td><td class="r">' + PD.qty(st[i.id] || 0) + ' ' + esc(i.unit) + '</td><td>' + (bs[0] ? PD.expBadge(bs[0].expiry) : '') + '</td><td class="r"><button class="btn sm" data-sv="' + i.id + '">Save shelf</button></td></tr>';
    }).join('') || '<tr><td colspan="5"><div class="empty">Nothing to show.</div></td></tr>';
  }
  rows();
  $('#sf', host).onchange = rows; $('#sq', host).oninput = rows;
  PD.on($('#sb', host), 'click', '[data-sv]', function (e, t) { var inp = $('[data-i="' + t.dataset.sv + '"]', host); try { svc.setShelf(t.dataset.sv, inp.value); PD.toast('Shelf saved', 'ok'); PD.views.shelves.render(host, { f: $('#sf', host).value, q: $('#sq', host).value }); } catch (er) { PD.err(er); } });
} };

/* ================= RETURN STOCK TO THE WAREHOUSE (scan strips, reason per row) ================= */
PD.views.whreturn = { render: function (host) {
  var d = PD.DB, rows = [], REASONS = ['Expired', 'Near expiry', 'Damaged', 'Wrong item received', 'Excess stock', 'Other'];
  host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Return Stock to Warehouse</b></div><div style="padding:8px 12px">' +
    '<div class="scanbox"><label>Scan strip:</label><input class="in" id="scn" autocomplete="off" placeholder="click here, then scan the barcode on each strip you are returning" style="font-size:15px"><span id="fb" class="fb">Put the strips on the table and scan them one by one. Choose a reason for each row.</span></div>' +
    '<div class="row" style="margin:6px 0"><b>Or add without a label:</b><input class="in sm" id="mi" placeholder="medicine name" autocomplete="off" style="max-width:240px"><select class="in sm" id="mb" style="width:auto"></select><input class="in sm" id="mq" type="number" min="1" value="1" style="width:70px"><button class="btn sm" id="ma">Add</button></div>' +
    '<div class="msgrid" style="margin:4px 0;background:#fff;min-height:120px"><table class="t"><thead><tr><th>Medicine</th><th>Batch</th><th>Exp</th><th class="r">In shop</th><th class="r">Return qty (tablets)</th><th>Reason *</th><th>Note</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>' +
    '<div class="row" style="margin:6px 0"><input class="in" id="rn" placeholder="Note for the warehouse (optional)" style="flex:1"><button class="btn p" id="sn">Send return request</button></div><div id="hist"></div></div></div>';
  var scn = $('#scn', host), mi = $('#mi', host), mb = $('#mb', host), pickedItem = '';
  function draw() {
    $('#rb', host).innerHTML = rows.map(function (r, i) { var b = svc.batch(r.batchId); return '<tr><td><b>' + esc(svc.itemName(b.itemId)) + '</b></td><td>' + esc(b.batchNo) + '</td><td>' + PD.expBadge(b.expiry) + '</td><td class="r">' + PD.qty(b.qty) + '</td><td class="r"><input class="in sm" data-q="' + i + '" type="number" min="0" max="' + b.qty + '" value="' + r.qty + '" style="width:70px"></td><td><select class="in sm" data-r="' + i + '"><option value="">— choose —</option>' + REASONS.map(function (x) { return '<option' + (x === r.reason ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td><td><input class="in sm" data-n="' + i + '" value="' + esc(r.note || '') + '"></td><td><button class="btn sm" data-x="' + i + '">✕</button></td></tr>'; }).join('') || '<tr><td colspan="8"><div class="empty">Nothing scanned yet.</div></td></tr>';
    $('#sn', host).textContent = 'Send return request' + (rows.length ? ' (' + rows.reduce(function (a, r) { return a + PD.num(r.qty); }, 0) + ' strips)' : '');
  }
  function addBatch(b, serial, n) {
    var r = rows.find(function (x) { return x.batchId === b.id; }), it = svc.item(b.itemId), step = n || (serial && it.punit === 'Strip' && it.conv > 1 ? it.conv : 1);
    if (!r) { var dd = PD.daysToExp(b.expiry); r = { batchId: b.id, qty: 0, reason: dd < 0 ? 'Expired' : dd <= 90 ? 'Near expiry' : '', note: '', serials: [] }; rows.push(r); }
    if (r.qty + step > b.qty + 1e-9) return false; r.qty += step; if (serial) r.serials.push(serial); return true;
  }
  scn.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; e.preventDefault(); var txt = scn.value; scn.value = ''; if (!txt.trim()) return; var fb = $('#fb', host);
    function say(ok, m) { fb.innerHTML = '<span style="color:' + (ok ? '#2e8b57' : '#c62828') + '">' + (ok ? '✔ ' : '✖ ') + esc(m) + '</span>'; }
    var st = svc.parseStrip(txt); if (!st) { say(false, 'Not a Medismart strip barcode'); return; }
    if (st.unknown) { say(false, st.serial + ' was not found in any dispatch received here. Use "add without a label" below.'); return; }
    if (d.returnedSerials[st.serial]) { say(false, st.serial + ' was already returned (' + d.returnedSerials[st.serial] + ')'); return; }
    if (rows.some(function (r) { return r.serials.indexOf(st.serial) >= 0; })) { say(false, st.serial + ' already scanned'); return; }
    var b = svc.findBatchFor(st); if (!b) { say(false, st.name + ' (batch ' + st.batchNo + ') is not in your stock'); return; }
    if (!addBatch(b, st.serial)) { say(false, 'Only ' + PD.qty(b.qty) + ' of this batch is in your shop'); return; }
    say(true, st.name + ' • batch ' + st.batchNo + ' • exp ' + PD.fmtExp(b.expiry)); draw(); scn.focus();
  });
  PD.combo(mi, { source: PD.itemSource({}), onPick: function (x) { pickedItem = x.id; mb.innerHTML = svc.batchesOf(x.id, false).filter(function (b) { return b.qty > 0; }).map(function (b) { return '<option value="' + b.id + '">' + esc(b.batchNo) + ' • exp ' + PD.fmtExp(b.expiry) + ' • ' + PD.qty(b.qty) + '</option>'; }).join('') || '<option value="">no stock</option>'; } });
  $('#ma', host).onclick = function () { var b = mb.value && svc.batch(mb.value); if (!b) { PD.toast('Pick a medicine and a batch', 'err'); return; } var q = Math.max(1, Math.floor(PD.num($('#mq', host).value))); var ok = addBatch(b, null, q); if (!ok) PD.toast('Only ' + PD.qty(b.qty) + ' ' + esc(svc.item(b.itemId).unit) + ' in this batch', 'err'); mi.value = ''; mb.innerHTML = ''; draw(); };
  PD.on(host, 'input', '[data-q]', function (e, t) { rows[+t.dataset.q].qty = PD.num(t.value); });
  PD.on(host, 'change', '[data-r]', function (e, t) { rows[+t.dataset.r].reason = t.value; });
  PD.on(host, 'input', '[data-n]', function (e, t) { rows[+t.dataset.n].note = t.value; });
  PD.on(host, 'click', '[data-x]', function (e, t) { rows.splice(+t.dataset.x, 1); draw(); });
  $('#sn', host).onclick = function () {
    try { var rec = svc.sendReturn({ lines: rows, note: $('#rn', host).value }); PD.toast('Return ' + rec.no + ' sent to the warehouse.', 'ok'); PD.views.whreturn.render(host); } catch (e) { PD.err(e); }
  };
  var h = d.wreturns.slice().reverse().slice(0, 15);
  $('#hist', host).innerHTML = h.length ? '<h4 style="margin:12px 0 4px">Earlier return requests</h4><div class="msgrid" style="margin:0;background:#fff"><table class="t"><thead><tr><th>Return</th><th>Date</th><th class="r">Lines</th><th class="r">Strips</th><th class="r">Value</th></tr></thead><tbody>' + h.map(function (r) { return '<tr><td><b>' + esc(r.no) + '</b></td><td>' + PD.fmtDate(r.date) + '</td><td class="r">' + r.lines.length + '</td><td class="r">' + r.lines.reduce(function (a, l) { return a + l.qty; }, 0) + '</td><td class="r">' + PD.n2(r.value) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
  draw(); scn.focus();
} };
})();
