/* Sales billing (POS), held bills, receipts, sales returns */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;

/* ---------- receipt ---------- */
PD.billHTML = function (b) {
  var S = PD.DB.shop, cus = b.customerId ? svc.cusName(b.customerId) : 'Walk-in', gst = {};
  b.lines.forEach(function (l) { var g = gst[l.tax] = gst[l.tax] || { tx: 0, t: 0 }; g.tx += l.taxable; g.t += l.taxAmt; });
  return '<div class="c"><h2>' + esc(S.name) + '</h2>' + (S.address ? '<div>' + esc(S.address) + '</div>' : '') + (S.phone ? '<div>Ph: ' + esc(S.phone) + '</div>' : '') + (S.gstin ? '<div>GSTIN: ' + esc(S.gstin) + '</div>' : '') + (S.dl ? '<div>DL: ' + esc(S.dl) + '</div>' : '') + '</div><hr>' +
    '<div>Bill: <b>' + esc(b.no) + '</b> &nbsp; ' + PD.fmtDate(b.date) + ' ' + esc(b.time || '') + '</div><div>Customer: ' + esc(cus) + '</div>' + (b.doctor ? '<div>Doctor: ' + esc(b.doctor) + (b.doctorReg ? ' (Reg ' + esc(b.doctorReg) + ')' : '') + '</div>' : '') + (b.patientAddr ? '<div>Patient address: ' + esc(b.patientAddr) + '</div>' : '') + '<hr>' +
    '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">MRP</th><th class="r">Amt</th></tr></thead><tbody>' + b.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '<br><small>' + (function () { var rk = l.rack || ((svc.item(l.itemId) || {}).rack) || ''; return rk ? '<b>Rack ' + esc(rk) + '</b> ' : ''; })() + 'B:' + esc(l.batchNo) + ' Exp:' + esc(PD.fmtExp(l.expiry)) + (l.schedule ? ' Sch ' + esc(l.schedule) : '') + '</small></td><td class="r">' + PD.qty(l.qty) + '</td><td class="r">' + PD.n2(l.rate) + '</td><td class="r">' + PD.n2(l.amount) + '</td></tr>'; }).join('') + '</tbody></table><hr>' +
    '<table><tr><td>Gross</td><td class="r">' + PD.n2(b.gross) + '</td></tr>' + (b.disc ? '<tr><td>Discount</td><td class="r">-' + PD.n2(b.disc) + '</td></tr>' : '') + (b.roundoff ? '<tr><td>Round off</td><td class="r">' + PD.n2(b.roundoff) + '</td></tr>' : '') + '<tr class="b"><td>NET PAYABLE</td><td class="r b">' + PD.money(b.total) + '</td></tr>' + '<tr><td>Paid (' + esc(b.payMode) + ')</td><td class="r">' + PD.n2(b.paid) + '</td></tr>' + (b.due ? '<tr><td>Balance due</td><td class="r b">' + PD.n2(b.due) + '</td></tr>' : '') + '</table><hr>' +
    '<div><small>GST included: ' + Object.keys(gst).map(function (k) { return k + '% → ' + PD.n2(gst[k].t) + ' (taxable ' + PD.n2(gst[k].tx) + ')'; }).join(' | ') + '</small></div><hr><div class="c">' + esc(S.footer || '') + '</div>';
};
PD.printBill = function (b) { PD.printHTML(PD.billHTML(b), 'Bill ' + b.no, PD.DB.settings.printWidth || '80mm'); };
function cancelModal(b, done) {
  var f = [{ k: 'reason', label: 'Reason for cancelling', req: true, full: true }];
  PD.modal({ title: 'Cancel bill ' + b.no, size: 'sm', body: PD.formHTML(f, {}) + '<p class="hint">Stock goes back, the money entry is reversed and the bill moves to Reports → Cancelled bills. A bill that has returns cannot be cancelled.</p>', foot: [{ label: 'Back' }, { label: 'Cancel this bill', cls: 'd', fn: function (api) { try { svc.cancelSale(b.id, PD.readForm(api.body, f).reason); PD.toast('Bill ' + b.no + ' cancelled', 'ok'); if (PD.refreshAlerts) PD.refreshAlerts(); if (done) done(); } catch (e) { PD.err(e); return false; } } }] });
}
PD.showBill = function (b, onDone) {
  PD.modal({ title: 'Bill ' + b.no, size: 'md', body: '<div style="font:13px/1.45 monospace">' + PD.billHTML(b).replace(/<h2>/g, '<h3>').replace(/<\/h2>/g, '</h3>') + '</div><p class="hint">Profit on this bill: ' + PD.money(b.profit) + ' • Entered by ' + esc(b.user) + '</p>', foot: [{ label: 'Close' }].concat(PD.user && PD.user.role === 'Admin' ? [{ label: 'Cancel bill', cls: 'd', fn: function (api) { cancelModal(b, function () { api.close(); if (onDone) onDone(); }); return false; } }] : []).concat([{ label: 'Sales return', fn: function () { PD.go('salesret', { billNo: b.no }); } }, { label: 'Print', cls: 'p', icon: 'print', fn: function () { PD.printBill(b); return false; } }]) });
};

/* ---------- billing screen (MediSmart "Sale / Billing" window layout) ---------- */
PD.itemNo = function (id) { var m = PD.itemNo.map; if (!m || m.n !== PD.DB.items.length) { m = PD.itemNo.map = { n: PD.DB.items.length }; PD.DB.items.forEach(function (x, i) { m[x.id] = i + 1; }); } return m[id] || ''; };
function numId(id) { return PD.itemNo(id); }
function rxc(it) { return it.schedule === 'H1' || it.schedule === 'X' ? 'rx2' : it.schedule === 'H' ? 'rx' : ''; }
function expc(e) { if (!e) return ''; var d = PD.daysToExp(e); return d < 0 ? 'expd' : d <= (PD.DB.settings.expiryDays || 90) ? 'expw' : ''; }
PD.views.billing = { render: function (host, arg) {
  PD.hotkeys = {};
  var D = PD.DB, S = D.settings, cart = [], meta = { customerId: '', doctor: '', paddr: '', dreg: '', payMode: 'cash', received: '', discPct: '', discAmt: '', remarks: '' }, sel = -1, idx = 0, results = [], browse = -1;
  if (arg && arg.recalled) { cart = arg.recalled.cart; meta = Object.assign(meta, arg.recalled.meta); }
  var shopN = (D.shop && D.shop.name) || 'Medismart', fyA = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  host.innerHTML = '<div class="msw ssw">' +
    '<div class="sband"><b class="sb1">&#10010; Medismart</b><span class="sb2">' + esc(shopN) + '</span><span class="sb3">01/04/' + fyA + ' &nbsp;TO&nbsp; 31/03/' + (fyA + 1) + '</span><span class="sb4">Login &nbsp; ' + esc(PD.user.name) + '</span></div>' +
    '<div class="stitle"><span>SALE</span><span id="ser">A</span><span>Gst</span></div>' +
    '<div class="shead"><label>VrNo:</label><input class="in" id="bno" readonly style="width:130px"><label>Date</label><input class="in" id="bdate" readonly value="' + PD.fmtDate(PD.today()) + '" style="width:130px"><label>BillNo</label><input class="in" id="bno2" readonly style="width:130px"><span class="sp"></span>' +
    '<button class="mb" id="hold">&#9208; Stand by</button><button class="mb" id="holds">Held (<span id="hn">0</span>)</button><button class="mb" id="prev">&#9664;</button><button class="mb" id="disp">Display</button><button class="mb" id="next">&#9654;</button></div>' +
    '<div class="skeys">Del Item Ctrl+D &nbsp; F3 Item Search, Enter Add item &nbsp; Ctrl+Enter Save &nbsp; F9 Stand by &nbsp; F10 Print save</div>' +
    '<div class="msgrid"><table class="t" id="cart"></table></div>' +
    '<div class="msentry"><div class="ehead"><span style="width:62px">Item ID</span><span style="flex:1">Item Name (type name / generic)</span><span style="width:90px">Batch</span><span style="width:62px">Exp.Date</span><span style="width:52px">Qty</span><span style="width:62px">MRP</span><span style="width:52px">Disc</span><span style="width:70px">Rate</span><span style="width:72px">Amount</span><span style="width:46px">Tax%</span></div>' +
    '<div class="erow"><input class="in" id="eid" readonly style="width:62px"><div style="flex:1;position:relative"><input class="in" id="q" placeholder="*  (type name / generic, F3)" autocomplete="off"><div class="sres" id="res"></div></div><input class="in" id="eb" readonly style="width:90px"><input class="in" id="ee" readonly style="width:62px"><input class="in" id="eq" readonly style="width:52px"><input class="in" id="em" readonly style="width:62px"><input class="in" id="ed" readonly style="width:52px"><input class="in" id="er" readonly style="width:70px"><input class="in" id="ea" readonly style="width:72px"><input class="in" id="et" readonly style="width:46px"></div></div>' +
    '<div class="sbot">' +
      '<div class="srec"><div class="skeys">Search (F3), click a bill to open it</div><input class="in sm" id="bsq" placeholder="search bill no / patient" autocomplete="off"><div class="srecw"><table class="t" id="rec"></table></div></div>' +
      '<div class="smid">' +
        '<div class="sf"><label>Pay</label><select class="in" id="paysel"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="credit">Credit</option></select></div>' +
        '<div class="sf"><label>Party</label><input class="in" id="party" readonly value="CASH SALE"></div>' +
        '<div class="sf"><label>Patient</label><input class="in" id="cus" placeholder="Walk-in (type to search)" autocomplete="off"><button class="btn sm" id="ncus" title="New customer">+</button></div>' +
        '<div class="sf"><label>Mobile</label><input class="in" id="mob" readonly></div>' +
        '<div class="sf"><label>Address</label><input class="in" id="paddr" placeholder="required for H1 / X"></div>' +
        '<div class="sf"><label>Doctor</label><input class="in" id="doc" list="docs" placeholder="Doctor name (required for H1 / X)"><datalist id="docs">' + D.doctors.map(function (d) { return '<option value="' + esc(d.name) + '">'; }).join('') + '</datalist></div>' +
        '<div class="sf"><label>PaidAmt</label><input class="in" id="rc" type="number" step="any" style="max-width:130px"><span class="hint" id="cinfo"></span></div>' +
        '<div class="sf"><label>Balance</label><input class="in" id="bal" readonly style="max-width:130px"></div>' +
        '<div class="sf"><label>User</label><input class="in" id="ph" readonly value="' + esc(PD.user.name) + '" style="max-width:150px"><label style="min-width:0;margin-left:10px">BillType</label><input class="in" readonly value="Counter" style="max-width:120px"></div>' +
        '<div class="sf"><label>Narration</label><input class="in" id="rem"></div>' +
      '</div>' +
      '<div class="sright"><div class="sprod"><label>ProDisc</label><input class="in" readonly value="0.00"></div><div id="tot"></div>' +
        '<div class="sf"><label>RegNo</label><input class="in" id="dreg" placeholder="doctor reg. no."></div>' +
        '<div class="snet"><label>Net Amt</label><b id="netv">0</b></div><div class="sti"><label>Total Items</label><b id="ni">0</b><label style="margin-left:8px">Qty</label><b id="nq">0</b></div><div id="thint"></div></div>' +
    '</div>' +
    '<div class="sbtns"><button class="sbtn" id="save"><i>&#128190;</i>Save</button><button class="sbtn" id="savep"><i>&#128438;</i>Print save</button><button class="sbtn" id="edit"><i>&#9998;</i>Edit</button><button class="sbtn wa" id="wa"><i>&#9990;</i>WhatsApp</button><button class="sbtn" id="pdf"><i>&#128196;</i>PDF</button><button class="sbtn" id="cancel"><i>&#10006;</i>Cancel</button><button class="sbtn" id="clr"><i>&#128465;</i>Delete</button></div></div>';
  var q = $('#q', host);

  /* item search (the Item Name box of the entry row) */
  function search() {
    var src = PD.itemSource({});
    results = src(q.value === '*' ? '' : q.value).slice(0, 40); if (idx >= results.length) idx = 0;
    var res = $('#res', host);
    res.innerHTML = results.map(function (r, i) {
      var it = r.item;
      return '<div class="it ' + (i === idx ? 'on' : '') + '" data-i="' + i + '"><span class="nm"><b class="' + rxc(it) + '">' + (r.st > 0 ? '' : '# ') + esc(it.name) + '</b>' + (rxc(it) ? ' <small>(Rx)</small>' : '') + '' + PD.schedBadge(it.schedule) + '<small> ' + esc(it.generic) + ' • ' + esc(svc.mfrName(it.mfrId)) + (it.rack ? ' • Rack ' + esc(it.rack) : '') + '</small></span><span class="pr">' + PD.n2(it.mrp) + '<small>' + (r.st > 0 ? PD.qty(r.st) : 'out') + '</small></span></div>';
    }).join('') || '<div class="empty">No medicines match.</div>';
    res.style.display = document.activeElement === q ? 'block' : 'none';
    var on = $('.on', res); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  q.addEventListener('input', function () { idx = 0; search(); });
  q.addEventListener('focus', function () { if (q.value === '*') q.select(); search(); });
  q.addEventListener('blur', function () { setTimeout(function () { $('#res', host).style.display = 'none'; }, 160); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, results.length - 1); search(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); search(); e.preventDefault(); }
    else if (e.key === 'Enter' && results[idx]) { e.preventDefault(); add(results[idx].id, true); q.value = ''; idx = 0; }
    else if (e.key === 'Escape') $('#res', host).style.display = 'none';
  });
  PD.on($('#res', host), 'mousedown', '[data-i]', function (e, t) { e.preventDefault(); add(results[+t.dataset.i].id, false); q.value = ''; });

  /* grid */
  function add(itemId, focusQty) {
    var it = svc.item(itemId), batches = svc.batchesOf(itemId, true);
    if (!batches.length) { PD.toast(it.name + ' is out of stock (or only expired batches left)', 'err'); return; }
    var ex = cart.find(function (l) { return l.itemId === itemId; });
    if (ex) { var bt = svc.batch(ex.batchId); if (ex.qty + 1 > bt.qty) { PD.toast('Only ' + PD.qty(bt.qty) + ' in this batch', 'err'); } else ex.qty++; }
    else cart.push({ itemId: itemId, batchId: batches[0].id, qty: 1, rate: batches[0].mrp || it.mrp, disc: 0 });
    sel = ex ? cart.indexOf(ex) : cart.length - 1; drawCart();
    if (focusQty) { var f = $('[data-q="' + sel + '"]', host); if (f) { f.focus(); f.select(); } }
  }
  function lineAmt(l) { return PD.num(l.qty) * PD.num(l.rate) * (1 - PD.num(l.disc) / 100); }
  function showEntry() {
    var l = cart[sel], it = l && svc.item(l.itemId), b = l && svc.batch(l.batchId);
    var v = l ? [numId(it.id), b.batchNo, PD.fmtExp(b.expiry), l.qty, PD.n2(b.mrp || it.mrp), l.disc || '', PD.n2(l.rate), PD.n2(lineAmt(l)), it.tax || 0] : ['', '', '', '', '', '', '', '', ''];
    ['eid', 'eb', 'ee', 'eq', 'em', 'ed', 'er', 'ea', 'et'].forEach(function (id, i) { $('#' + id, host).value = v[i]; });
  }
  function drawCart() {
    $('#cart', host).innerHTML = '<thead><tr><th style="width:40px">SN</th><th>ItemName</th><th style="width:56px">Pack</th><th style="width:80px">Cmp</th><th style="width:54px">Shelf</th><th style="width:120px">BatchNo</th><th style="width:76px">Expiry</th><th class="r" style="width:70px">Mrp</th><th class="r" style="width:60px">Qty</th><th class="r" style="width:80px">SaleRate</th><th class="r" style="width:80px">Amount</th><th class="r" style="width:60px">Disc%</th><th class="r" style="width:80px">AdValue</th></tr></thead><tbody>' +
      cart.map(function (l, i) {
        var it = svc.item(l.itemId), bt = svc.batch(l.batchId), bs = svc.batchesOf(l.itemId, true), amt = lineAmt(l);
        return '<tr class="cartrow ' + (i === sel ? 'sel' : '') + '" data-r="' + i + '"><td>' + (i + 1) + '</td><td class="' + rxc(it) + '">' + esc(it.name) + ' ' + PD.schedBadge(it.schedule) + (it.noDisc ? ' <span class="badge warn" title="Discount-exempt medicine">No disc</span>' : '') + '</td><td>' + esc(it.pack || '') + '</td><td>' + esc(String(svc.mfrName(it.mfrId) || '').slice(0, 8)) + '</td><td>' + esc(it.rack || '') + '</td><td><select class="in sm" data-b="' + i + '">' + bs.map(function (b) { return '<option value="' + b.id + '"' + (b.id === l.batchId ? ' selected' : '') + '>' + esc(b.batchNo) + ' (' + PD.qty(b.qty) + ')</option>'; }).join('') + '</select></td><td class="' + expc(bt.expiry) + '">' + PD.fmtExp(bt.expiry) + '</td>' +
          '<td class="r">' + PD.n2(bt.mrp || it.mrp) + '</td><td class="r"><input class="in sm qn" data-q="' + i + '" type="number" min="0" step="any" value="' + l.qty + '"></td><td class="r"><input class="in sm" data-rt="' + i + '" type="number" step="any" value="' + l.rate + '"' + (it.noDisc ? ' readonly title="Discount-exempt: sold at MRP"' : '') + '></td><td class="r" data-gm="' + i + '">' + PD.n2(PD.num(l.qty) * PD.num(l.rate)) + '</td><td class="r"><input class="in sm" data-d="' + i + '" type="number" min="0" max="100" step="any" value="' + (it.noDisc ? '' : (l.disc || '')) + '"' + (it.noDisc ? ' disabled title="Discount-exempt"' : '') + '></td><td class="r"><b data-am="' + i + '">' + PD.n2(amt) + '</b></td></tr>';
      }).join('') + '</tbody>';
    totals(); showEntry();
  }
  function calc() { return svc.calcBill(cart.map(function (l) { return { qty: l.qty, rate: l.rate, disc: l.disc, tax: svc.item(l.itemId).tax || 0, nd: !!svc.item(l.itemId).noDisc }; }), meta.discPct, meta.discAmt); }
  var PAYS = [['cash', 'CASH'], ['upi', 'UPI'], ['card', 'CARD'], ['credit', 'CREDIT']];
  function totals() {
    var c = calc(), exact = c.total, grand = S.rounding ? Math.round(exact) : exact, ro = PD.r2(grand - exact), series = {};
    cart.forEach(function (l, i) { var a = $('[data-am="' + i + '"]', host); if (a) a.textContent = PD.n2(lineAmt(l)); var g = $('[data-gm="' + i + '"]', host); if (g) g.textContent = PD.n2(PD.num(l.qty) * PD.num(l.rate)); series[svc.seriesOf(svc.item(l.itemId))] = 1; });
    var rec = meta.received === '' ? (meta.payMode === 'credit' ? 0 : grand) : PD.num(meta.received), nSer = Object.keys(series).length;
    $('#ni', host).textContent = cart.length; $('#nq', host).textContent = PD.qty(cart.reduce(function (a, l) { return a + PD.num(l.qty); }, 0));
    var rcI = $('#rc', host); if (document.activeElement !== rcI) rcI.value = meta.received === '' ? '' : meta.received; rcI.placeholder = PD.n2(grand);
    $('#paysel', host).value = meta.payMode; $('#party', host).value = meta.payMode === 'credit' ? 'CREDIT SALE' : 'CASH SALE';
    $('#bal', host).value = PD.n2(Math.max(0, grand - rec));
    $('#tot', host).innerHTML = '<div class="sf gr"><label>Gross</label><input class="in" readonly value="' + PD.n2(c.gross) + '"></div>' +
      '<div class="sf"><label>Disc%</label><input class="in" id="dp" type="number" placeholder="%" value="' + esc(meta.discPct) + '" style="width:70px"><input class="in" id="da" type="number" placeholder="amt" value="' + esc(meta.discAmt) + '" style="width:80px"></div>' +
      '<div class="sf fd"><label>Final Discount</label><input class="in" readonly value="' + PD.n2(c.disc) + '"></div>';
    $('#netv', host).textContent = PD.n2(grand);
    var nEx = cart.filter(function (l) { return svc.item(l.itemId).noDisc; }).length;
    $('#thint', host).innerHTML = (nEx ? '<div class="hint" style="color:#b26a00">' + nEx + ' discount-exempt item(s): no discount on them</div>' : '') + '<div class="hint">Tax included: ' + PD.n2(c.tax) + (ro ? ' &bull; R.off ' + PD.n2(ro) : '') + '</div>' +
      (nSer > 1 && S.multiSeries ? '<div class="hint">Saves as <b>' + nSer + ' bills</b> (' + Object.keys(series).join(', ') + ')</div>' : '') +
      (meta.payMode === 'credit' ? '' : (rec - grand >= 0 ? '<div class="hint">Change: <b>' + PD.n2(rec - grand) + '</b></div>' : '<div class="hint" style="color:#c00">Short by ' + PD.n2(grand - rec) + '</div>'));
    var ser = cart.length ? svc.seriesOf(svc.item(cart[0].itemId)) : 'A'; $('#bno', host).value = (D.counters['S-' + ser] || 0) + 1; $('#ser', host).textContent = ser;
    $('#hn', host).textContent = D.holds.length;
    totals.grand = grand; totals.rec = rec;
  }
  PD.on($('#cart', host), 'input', '[data-q],[data-rt],[data-d]', function (e, t) {
    var i = +(t.dataset.q || t.dataset.rt || t.dataset.d), l = cart[i]; sel = i;
    if (t.dataset.q != null) { l.qty = PD.num(t.value); var b = svc.batch(l.batchId); if (l.qty > b.qty) t.classList.add('bad'); else t.classList.remove('bad'); }
    else if (t.dataset.rt != null) { l.rate = PD.num(t.value); var rb = svc.batch(l.batchId), mp = PD.num(rb && rb.mrp) || PD.num(svc.item(l.itemId).mrp); if (!D.settings.allowAboveMrp && mp > 0 && l.rate > mp + 0.005) { t.classList.add('bad'); PD.toast('Rate is above the MRP ' + PD.n2(mp) + ': the bill will not save', 'err'); } else t.classList.remove('bad'); }
    else l.disc = PD.num(t.value);
    totals(); showEntry();
  });
  PD.on($('#cart', host), 'keydown', '[data-q],[data-rt],[data-d]', function (e, t) { if (e.key === 'Enter') { e.preventDefault(); q.focus(); q.select(); } });
  PD.on($('#cart', host), 'change', '[data-b]', function (e, t) { var l = cart[+t.dataset.b], b = svc.batch(t.value); l.batchId = b.id; l.rate = b.mrp; if (l.qty > b.qty) l.qty = b.qty; sel = +t.dataset.b; drawCart(); });
  PD.on($('#cart', host), 'click', '[data-r]', function (e, t) { sel = +t.dataset.r; PD.$$('#cart tr.cartrow', host).forEach(function (r) { r.classList.toggle('sel', r === t); }); showEntry(); });
  $('#clr', host).onclick = function () { if (sel < 0 || !cart[sel]) { PD.toast('Select a row in the grid, then press Delete'); return; } cart.splice(sel, 1); sel = Math.min(sel, cart.length - 1); drawCart(); };
  $('#cancel', host).onclick = function () { if (!cart.length) return; PD.confirm('Clear all items from this bill?', 'Clear', true).then(function (ok) { if (ok) { cart = []; sel = -1; meta.received = ''; meta.discPct = ''; meta.discAmt = ''; drawCart(); } }); };
  PD.on($('#tot', host), 'input', '#dp,#da', function (e, t) {
    var pos = t.selectionStart, id = t.id;
    if (id === 'dp') { meta.discPct = t.value; if (t.value) meta.discAmt = ''; } else { meta.discAmt = t.value; if (t.value) meta.discPct = ''; }
    totals(); var n = $('#' + id, host); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} }
  });
  $('#rc', host).oninput = function () { meta.received = this.value; totals(); };
  $('#rem', host).oninput = function () { meta.remarks = this.value; };
  $('#paysel', host).onchange = function () { meta.payMode = this.value; meta.received = ''; totals(); if (meta.payMode === 'credit' && !meta.customerId) { PD.toast('Choose a customer (patient) for credit billing'); $('#cus', host).focus(); } };

  /* customer (patient) + doctor */
  var cus = $('#cus', host);
  function cinfo() { var c = meta.customerId ? svc.customer(meta.customerId) : null, last = c && D.sales.filter(function (s) { return s.customerId === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); }), n = last ? last.length : 0; $('#mob', host).value = c ? (c.phone || '') : ''; $('#cinfo', host).innerHTML = c ? esc(c.type) + ' • ' + n + ' visit' + (n === 1 ? '' : 's') + (n ? ' • last ' + PD.fmtDate(last[0].date) : ' • first visit') + ' • Outstanding <b>' + PD.n2(svc.partyBalance('cus', c.id)) + '</b> <a href="#" id="chl">history</a>' : ''; var h = $('#chl', host); if (h) h.onclick = function (e) { e.preventDefault(); PD.go('custhist', { customerId: c.id }); }; }
  PD.combo(cus, { source: function (qv) { qv = qv.toLowerCase(); return D.customers.filter(function (c) { return c.active !== false && (!qv || (c.name + ' ' + (c.phone || '')).toLowerCase().indexOf(qv) >= 0); }).map(function (c) { return { id: c.id, label: '<b>' + esc(c.name) + '</b>', sub: esc(c.phone || ''), right: esc(c.type) }; }); }, onPick: function (x) { meta.customerId = x.id; cus.value = svc.cusName(x.id); cinfo(); } });
  cus.addEventListener('input', function () { if (!cus.value.trim()) { meta.customerId = ''; cinfo(); } });
  $('#ncus', host).onclick = function () {
    var f = [{ k: 'name', label: 'Name', req: true, full: true }, { k: 'phone', label: 'Phone' }, { k: 'type', label: 'Type', type: 'select', options: ['Regular', 'Special'] }];
    PD.modal({ title: 'New customer', size: 'sm', body: PD.formHTML(f, { type: 'Regular' }), foot: [{ label: 'Cancel' }, { label: 'Save', cls: 'p', fn: function (api) { try { var v = PD.readForm(api.body, f); v.active = true; v.limit = 5000; var r = svc.saveMaster('customers', v); meta.customerId = r.id; cus.value = r.name; cinfo(); } catch (e) { PD.err(e); return false; } } }] });
  };
  $('#doc', host).value = meta.doctor; $('#dreg', host).value = meta.dreg || ''; $('#paddr', host).value = meta.paddr || '';
  $('#doc', host).oninput = function () { meta.doctor = this.value; var d = D.doctors.find(function (x) { return x.name.toLowerCase() === meta.doctor.trim().toLowerCase(); }); if (d && d.regNo && !meta.dreg) { meta.dreg = d.regNo; $('#dreg', host).value = d.regNo; } };
  $('#dreg', host).oninput = function () { meta.dreg = this.value; }; $('#paddr', host).oninput = function () { meta.paddr = this.value; };
  $('#rem', host).value = meta.remarks || '';
  if (meta.customerId) { cus.value = svc.cusName(meta.customerId); cinfo(); }

  /* stand by (hold) / recall */
  function hold() {
    if (!cart.length) { PD.toast('Nothing to put on stand by'); return; }
    D.holds.push({ id: PD.uid('h'), time: PD.nowTime(), label: meta.customerId ? svc.cusName(meta.customerId) : 'Walk-in', cart: JSON.parse(JSON.stringify(cart)), meta: JSON.parse(JSON.stringify(meta)), total: totals.grand });
    PD.save(); PD.toast('Bill is on stand by. Serve the next customer.', 'ok'); PD.views.billing.render(host, null);
  }
  $('#hold', host).onclick = hold;
  $('#holds', host).onclick = function () {
    var m = PD.modal({ title: 'Stand by bills', size: 'md', body: '<div id="hl"></div>', foot: [{ label: 'Close' }] });
    function list() { PD.$('#hl', m.el).innerHTML = D.holds.length ? '<table class="t"><tbody>' + D.holds.map(function (h) { return '<tr><td><b>' + esc(h.label) + '</b><br><small class="mut">At ' + esc(h.time) + ' • ' + h.cart.length + ' items</small></td><td class="r"><b>' + PD.money(h.total || 0) + '</b></td><td class="r nw"><button class="btn sm p" data-rc="' + h.id + '">Recall</button> <button class="btn sm" data-dl="' + h.id + '">Delete</button></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No bills on stand by.</div>'; }
    list();
    PD.on(m.el, 'click', '[data-rc]', function (e, t) { if (cart.length) { PD.toast('Stand by or cancel the current bill first', 'err'); return; } var h = D.holds.find(function (x) { return x.id === t.dataset.rc; }); D.holds = D.holds.filter(function (x) { return x !== h; }); PD.save(); m.close(); PD.views.billing.render(host, { recalled: h }); });
    PD.on(m.el, 'click', '[data-dl]', function (e, t) { D.holds = D.holds.filter(function (x) { return x.id !== t.dataset.dl; }); PD.save(); list(); $('#hn', host).textContent = D.holds.length; });
  };

  /* previous / display / next: browse saved bills */
  function bills() { return D.sales.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }); }
  function showAt(i) { var all = bills(); if (!all.length) { PD.toast('No saved bills yet'); return; } browse = Math.max(0, Math.min(all.length - 1, i)); PD.showBill(all[browse]); }
  $('#prev', host).onclick = function () { showAt(browse < 0 ? bills().length - 1 : browse - 1); };
  $('#next', host).onclick = function () { showAt(browse < 0 ? bills().length - 1 : browse + 1); };
  $('#disp', host).onclick = function () { showAt(bills().length - 1); };

  /* recent bills list, edit, WhatsApp, PDF */
  function latestBill() { var all = bills(); return (PD.lastBills && PD.lastBills.length ? PD.lastBills[PD.lastBills.length - 1] : all[all.length - 1]); }
  function recList() {
    var qv = ($('#bsq', host).value || '').toLowerCase(), tc = { cash: 'C', upi: 'U', card: 'D', credit: 'R' };
    var rows = D.sales.slice().sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); }).filter(function (b) { return !qv || (String(b.no) + ' ' + (b.customerId ? svc.cusName(b.customerId) : 'cash')).toLowerCase().indexOf(qv) >= 0; }).slice(0, 20);
    $('#rec', host).innerHTML = '<thead><tr><th>BillNo</th><th>BillDate</th><th>T</th><th>Patient Name</th><th class="r">Amount</th></tr></thead><tbody>' + rows.map(function (b) { return '<tr data-bn="' + b.id + '"><td>' + esc(b.no) + '</td><td>' + PD.fmtDate(b.date) + '</td><td>' + (tc[b.payMode] || 'C') + '</td><td>' + esc(b.customerId ? svc.cusName(b.customerId) : 'CASH SALE') + '</td><td class="r">' + PD.n2(b.total) + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#bsq', host).oninput = recList; recList();
  PD.on($('#rec', host), 'click', '[data-bn]', function (e, t) { var b = D.sales.find(function (x) { return x.id === t.dataset.bn; }); if (b) PD.showBill(b, function () { PD.views.billing.render(host, null); }); });
  $('#edit', host).onclick = function () { var b = latestBill(); if (!b) { PD.toast('No saved bills yet'); return; } PD.showBill(b, function () { PD.views.billing.render(host, null); }); };
  $('#pdf', host).onclick = function () { var b = latestBill(); if (!b) { PD.toast('No saved bills yet'); return; } PD.printBill(b); PD.toast('In the print window choose "Save as PDF"'); };
  $('#wa', host).onclick = function () {
    var b = latestBill(); if (!b) { PD.toast('Save a bill first, then press WhatsApp'); return; }
    var c = b.customerId ? svc.customer(b.customerId) : null, ph = String((c && c.phone) || '').replace(/[^0-9]/g, ''); if (ph.length === 10) ph = '91' + ph;
    var txt = (D.shop.name || 'Medismart') + '\nBill ' + b.no + ' (' + PD.fmtDate(b.date) + ')\n' + b.lines.map(function (l) { return l.name + ' x ' + PD.qty(l.qty) + ' = ' + PD.n2(l.amount); }).join('\n') + '\nTotal: ' + PD.n2(b.total) + '\n' + (D.shop.footer || 'Thank you!');
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(txt), '_blank');
  };

  /* save */
  function save(print) {
    try {
      if (!cart.length) throw new Error('Add at least one item');
      var needDoc = cart.some(function (l) { var s = svc.item(l.itemId).schedule; return s === 'H1' || s === 'X'; });
      if (needDoc && !meta.doctor.trim()) { $('#doc', host).focus(); throw new Error('Doctor name is required for Schedule H1 / X medicines'); }
      var docRec = D.doctors.find(function (x) { return x.name.toLowerCase() === meta.doctor.trim().toLowerCase(); }), docReg = String(meta.dreg || (docRec && docRec.regNo) || '').trim(), pAddr = String(meta.paddr || ((meta.customerId && svc.customer(meta.customerId) || {}).address) || '').trim();
      if (needDoc && !meta.customerId) { $('#cus', host).focus(); throw new Error('Choose the patient (customer) for Schedule H1 / X medicines. Use + to add one.'); }
      if (needDoc && !pAddr) { $('#paddr', host).focus(); throw new Error('Patient address is required for Schedule H1 / X medicines'); }
      if (needDoc && !docReg) { $('#dreg', host).focus(); throw new Error('Doctor registration number is required for Schedule H1 / X medicines'); }
      var c = meta.customerId ? svc.customer(meta.customerId) : null;
      var go = function () {
        var bills = svc.postSale({ customerId: meta.customerId, doctor: meta.doctor, doctorReg: docReg, patientAddr: pAddr, payMode: meta.payMode, received: meta.received === '' ? (meta.payMode === 'credit' ? 0 : totals.grand) : meta.received, discPct: meta.discPct, discAmt: meta.discAmt, lines: cart.map(function (l) { return { itemId: l.itemId, batchId: l.batchId, qty: l.qty, rate: l.rate, disc: l.disc }; }) });
        PD.lastBills = bills; PD.toast('Saved ' + bills.map(function (b) { return b.no; }).join(' + ') + ' • ' + PD.money(bills.reduce(function (a, b) { return a + b.total; }, 0)), 'ok');
        if (print) bills.forEach(PD.printBill);
        if (PD.refreshAlerts) PD.refreshAlerts();
        PD.views.billing.render(host, null);
      };
      if (meta.payMode === 'credit' && c && c.type !== 'Special') {
        var out = svc.partyBalance('cus', c.id) + Math.max(0, totals.grand - PD.num(meta.received));
        if (c.limit && out > c.limit) { if (!(PD.user && PD.user.role === 'Admin')) throw new Error('Credit limit of ' + PD.n2(c.limit) + ' is exceeded for ' + c.name + ' (outstanding would be ' + PD.n2(out) + '). Ask the admin.'); PD.confirm('Credit limit of ' + PD.n2(c.limit) + ' will be exceeded for <b>' + esc(c.name) + '</b> (outstanding would be ' + PD.n2(out) + '). Continue?', 'Continue').then(function (ok) { if (ok) try { go(); } catch (e) { PD.err(e); } }); return; }
      }
      go();
    } catch (e) { PD.err(e); }
  }
  $('#save', host).onclick = function () { save(false); }; $('#savep', host).onclick = function () { save(true); };
  PD.hotkeys.F3 = { el: host, fn: function () { q.focus(); q.select(); } }; PD.hotkeys.F9 = { el: host, fn: hold }; PD.hotkeys.F10 = { el: host, fn: function () { save(true); } };
  $('.msw', host).addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(false); } });

  if (arg && arg.itemId) add(arg.itemId, false);
  drawCart(); q.focus();
} };

/* ---------- sales returns ---------- */
PD.views.salesret = { render: function (host, arg) {
  var D = PD.DB;
  host.innerHTML = '<div class="grid" style="grid-template-columns:minmax(320px,420px) 1fr;align-items:start"><div class="card"><div class="hd"><h3 style="padding:0;border:0">Find the bill</h3></div><div class="bd"><div class="fld"><label>Bill number</label><input class="in" id="bn" placeholder="e.g. A-000012" list="bl"><datalist id="bl">' + D.sales.slice(-60).reverse().map(function (s) { return '<option value="' + esc(s.no) + '">' + esc(svc.cusName(s.customerId) + ' ' + s.total); }).join('') + '</datalist></div><button class="btn p" id="fb" style="margin-top:10px;width:100%">Find bill</button><div id="bi" class="hint" style="margin-top:10px"></div></div></div><div id="rb"></div></div><div id="rl" style="margin-top:16px"></div>';
  function findBill(no) {
    var b = D.sales.find(function (s) { return s.no.toLowerCase() === no.trim().toLowerCase(); });
    if (!b) { $('#bi', host).textContent = 'No bill found with that number.'; $('#rb', host).innerHTML = ''; return; }
    $('#bi', host).innerHTML = '<b>' + esc(b.no) + '</b> • ' + PD.fmtDate(b.date) + ' • ' + esc(svc.cusName(b.customerId)) + ' • ' + PD.money(b.total);
    var done = {}; D.sreturns.forEach(function (r) { if (r.billId === b.id) r.lines.forEach(function (l) { done[l.idx] = (done[l.idx] || 0) + l.qty; }); });
    $('#rb', host).innerHTML = '<div class="card"><div class="hd"><h3 style="padding:0;border:0">Select items to return</h3></div><div class="tw"><table class="t"><thead><tr><th>Item</th><th>Batch</th><th class="r">Sold</th><th class="r">Returned</th><th class="r">Return qty</th></tr></thead><tbody>' + b.lines.map(function (l, i) { var left = l.qty - (done[i] || 0); return '<tr><td><b>' + esc(l.name) + '</b></td><td>' + esc(l.batchNo) + '</td><td class="r">' + PD.qty(l.qty) + '</td><td class="r">' + PD.qty(done[i] || 0) + '</td><td class="r"><input class="in sm" data-rq="' + i + '" type="number" min="0" max="' + left + '" step="any" style="width:80px" ' + (left <= 0 ? 'disabled' : '') + ' placeholder="0"></td></tr>'; }).join('') + '</tbody></table></div><div class="bd row"><div class="fld" style="min-width:200px"><label>Refund mode</label><select class="in sm" id="rm"><option value="auto">' + (b.due > 0 ? 'Adjust in customer account' : 'Refund (same as payment)') + '</option><option value="cash">Cash refund</option></select></div><div class="fld" style="flex:1;min-width:200px"><label>Reason</label><input class="in sm" id="rr" placeholder="Wrong item / damaged / doctor changed..."></div><button class="btn p" id="doret" style="align-self:end">' + PD.icon('ret') + 'Save return</button></div></div>';
    $('#doret', host).onclick = function () {
      try {
        var lines = PD.$$('[data-rq]', host).map(function (i) { return { idx: +i.dataset.rq, qty: PD.num(i.value) }; }).filter(function (l) { return l.qty > 0; });
        var r = svc.postSaleReturn({ billId: b.id, lines: lines, mode: $('#rm', host).value === 'cash' ? 'cash' : 'auto', reason: $('#rr', host).value });
        PD.toast('Return ' + r.no + ' saved. Refund ' + PD.money(r.total), 'ok'); findBill(b.no); list();
      } catch (e) { PD.err(e); }
    };
  }
  $('#fb', host).onclick = function () { findBill($('#bn', host).value); };
  $('#bn', host).addEventListener('keydown', function (e) { if (e.key === 'Enter') findBill(this.value); });
  function list() {
    PD.report($('#rl', host), { id: 'sr-list', title: 'Sales returns', load: function () { return { cols: [{ k: 'no', label: 'Return no.' }, { k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'billNo', label: 'Against bill' }, { k: 'cus', label: 'Customer' }, { k: 'n', label: 'Items', align: 'r' }, { k: 'total', label: 'Refund', align: 'r', sum: true, fmt: PD.n2 }, { k: 'reason', label: 'Reason' }], rows: D.sreturns.slice().reverse().map(function (r) { return { no: r.no, date: r.date, billNo: r.billNo, cus: svc.cusName(r.customerId), n: r.lines.length, total: r.total, reason: r.reason }; }) }; } });
  }
  list();
  if (arg && arg.billNo) { $('#bn', host).value = arg.billNo; findBill(arg.billNo); }
} };
})();
