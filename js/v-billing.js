/* Sales billing (POS), held bills, receipts, sales returns */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;

/* ---------- receipt ---------- */
PD.billHTML = function (b) {
  var S = PD.DB.shop, cus = b.customerId ? svc.cusName(b.customerId) : 'Walk-in', gst = {};
  b.lines.forEach(function (l) { var g = gst[l.tax] = gst[l.tax] || { tx: 0, t: 0 }; g.tx += l.taxable; g.t += l.taxAmt; });
  return '<div class="c"><h2>' + esc(S.name) + '</h2>' + (S.address ? '<div>' + esc(S.address) + '</div>' : '') + (S.phone ? '<div>Ph: ' + esc(S.phone) + '</div>' : '') + (S.gstin ? '<div>GSTIN: ' + esc(S.gstin) + '</div>' : '') + (S.dl ? '<div>DL: ' + esc(S.dl) + '</div>' : '') + '</div><hr>' +
    '<div>Bill: <b>' + esc(b.no) + '</b> &nbsp; ' + PD.fmtDate(b.date) + ' ' + esc(b.time || '') + '</div><div>Customer: ' + esc(cus) + '</div>' + (b.doctor ? '<div>Doctor: ' + esc(b.doctor) + '</div>' : '') + '<hr>' +
    '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">MRP</th><th class="r">Amt</th></tr></thead><tbody>' + b.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '<br><small>B:' + esc(l.batchNo) + ' Exp:' + esc(PD.fmtExp(l.expiry)) + (l.schedule ? ' Sch ' + esc(l.schedule) : '') + '</small></td><td class="r">' + PD.qty(l.qty) + '</td><td class="r">' + PD.n2(l.rate) + '</td><td class="r">' + PD.n2(l.amount) + '</td></tr>'; }).join('') + '</tbody></table><hr>' +
    '<table><tr><td>Gross</td><td class="r">' + PD.n2(b.gross) + '</td></tr>' + (b.disc ? '<tr><td>Discount</td><td class="r">-' + PD.n2(b.disc) + '</td></tr>' : '') + (b.roundoff ? '<tr><td>Round off</td><td class="r">' + PD.n2(b.roundoff) + '</td></tr>' : '') + '<tr class="b"><td>NET PAYABLE</td><td class="r b">' + PD.money(b.total) + '</td></tr>' + '<tr><td>Paid (' + esc(b.payMode) + ')</td><td class="r">' + PD.n2(b.paid) + '</td></tr>' + (b.due ? '<tr><td>Balance due</td><td class="r b">' + PD.n2(b.due) + '</td></tr>' : '') + '</table><hr>' +
    '<div><small>GST included: ' + Object.keys(gst).map(function (k) { return k + '% → ' + PD.n2(gst[k].t) + ' (taxable ' + PD.n2(gst[k].tx) + ')'; }).join(' | ') + '</small></div><hr><div class="c">' + esc(S.footer || '') + '</div>';
};
PD.printBill = function (b) { PD.printHTML(PD.billHTML(b), 'Bill ' + b.no, PD.DB.settings.printWidth || '80mm'); };
PD.showBill = function (b, onDone) {
  PD.modal({ title: 'Bill ' + b.no, size: 'md', body: '<div style="font:13px/1.45 monospace">' + PD.billHTML(b).replace(/<h2>/g, '<h3>').replace(/<\/h2>/g, '</h3>') + '</div><p class="hint">Profit on this bill: ' + PD.money(b.profit) + ' • Entered by ' + esc(b.user) + '</p>', foot: [{ label: 'Close' }, { label: 'Sales return', fn: function () { PD.go('salesret', { billNo: b.no }); } }, { label: 'Print', cls: 'p', icon: 'print', fn: function () { PD.printBill(b); return false; } }] });
};

/* ---------- billing screen (MediSmart "Sale / Billing" window layout) ---------- */
PD.itemNo = function (id) { var m = PD.itemNo.map; if (!m || m.n !== PD.DB.items.length) { m = PD.itemNo.map = { n: PD.DB.items.length }; PD.DB.items.forEach(function (x, i) { m[x.id] = i + 1; }); } return m[id] || ''; };
function numId(id) { return PD.itemNo(id); }
function rxc(it) { return it.schedule === 'H1' || it.schedule === 'X' ? 'rx2' : it.schedule === 'H' ? 'rx' : ''; }
function expc(e) { if (!e) return ''; var d = PD.daysToExp(e); return d < 0 ? 'expd' : d <= (PD.DB.settings.expiryDays || 90) ? 'expw' : ''; }
PD.views.billing = { render: function (host, arg) {
  PD.hotkeys = {};
  var D = PD.DB, S = D.settings, cart = [], meta = { customerId: '', doctor: '', payMode: 'cash', received: '', discPct: '', discAmt: '', remarks: '' }, sel = -1, idx = 0, results = [], browse = -1;
  if (arg && arg.recalled) { cart = arg.recalled.cart; meta = Object.assign(meta, arg.recalled.meta); }
  host.innerHTML = '<div class="msw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>PharmaDesk</b></div>' +
    '<div class="mshead"><div class="msbadge"><span class="rx">Rx</span><div><b>Sale</b><br><small>Billing</small></div></div>' +
    '<div class="msfld"><label>Date :</label><input class="in" id="bdate" value="' + PD.fmtDate(PD.today()) + '" readonly style="width:110px"><label style="margin-left:14px">Invoice No :</label><span class="g">A</span><input class="in" id="bno" readonly value="" style="width:80px;font-weight:700"></div>' +
    '<div class="msfld wide"><label>Patient\'s Name :</label><input class="in" id="cus" placeholder="Walk-in (type to search)" autocomplete="off"><button class="btn sm" id="ncus" title="New customer">+</button> <span class="hint" id="cinfo"></span></div>' +
    '<div class="msfld wide"><label>Doctor\'s Name :</label><input class="in" id="doc" list="docs" placeholder="Doctor name (required for H1 / X)"><datalist id="docs">' + D.doctors.map(function (d) { return '<option value="' + esc(d.name) + '">'; }).join('') + '</datalist></div></div>' +
    '<div class="subtab"><span>Invoice - 1</span></div>' +
    '<div class="msgrid"><table class="t" id="cart"></table></div>' +
    '<div class="msentry"><div class="ehead"><span style="width:62px">Item ID</span><span style="flex:1">Item Name</span><span style="width:90px">Batch</span><span style="width:62px">Exp.Date</span><span style="width:52px">Qty</span><span style="width:62px">MRP</span><span style="width:52px">Disc</span><span style="width:70px">Rate</span><span style="width:72px">Amount</span><span style="width:46px">Tax%</span></div>' +
    '<div class="erow"><input class="in" id="eid" readonly style="width:62px"><div style="flex:1;position:relative"><input class="in" id="q" placeholder="*  (type name / generic, F3)" autocomplete="off"><div class="sres" id="res"></div></div><input class="in" id="eb" readonly style="width:90px"><input class="in" id="ee" readonly style="width:62px"><input class="in" id="eq" readonly style="width:52px"><input class="in" id="em" readonly style="width:62px"><input class="in" id="ed" readonly style="width:52px"><input class="in" id="er" readonly style="width:70px"><input class="in" id="ea" readonly style="width:72px"><input class="in" id="et" readonly style="width:46px"></div></div>' +
    '<div class="msbot"><div class="mspanel"><div class="subtabs"><span class="on">&nbsp;&nbsp;.&nbsp;&nbsp;</span><span>Allocation</span><span>On A/c</span><span>Last Bills</span></div><div class="mspb">' +
    '<div class="r3"><label>No of Items :</label><input class="in" id="ni" readonly><label>Qty :</label><input class="in" id="nq" readonly><label>Received :</label><input class="in" id="rc" type="number" step="any"><label>Disc :</label><input class="in" id="dpv" type="number" step="any" placeholder="%"></div>' +
    '<div class="r3"><label>Pharmacist :</label><input class="in" id="ph" readonly value="' + esc(PD.user.name) + '" style="flex:1"><label>Remarks :</label><input class="in" id="rem" style="flex:1.4"></div></div></div>' +
    '<div class="mstot" id="tot"></div></div>' +
    '<div class="msbtns"><button class="mb" id="hold">⏸ Stand by</button><button class="mb" id="prev">◀ Previous</button><button class="mb" id="disp">Display</button><button class="mb" id="next">Next ▶</button><span class="sp"></span><button class="mb" id="savep">🖶 Print</button><button class="mb" id="clr">✕ Delete</button><button class="mb" id="cancel">Cancel</button><button class="mb" id="save">💾 Save</button><button class="mb" id="holds">Held (<span id="hn">0</span>)</button></div></div>';
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
    $('#cart', host).innerHTML = '<thead><tr><th style="width:62px">Item ID</th><th>Item Name</th><th style="width:110px">Batch</th><th style="width:56px">Exp</th><th class="r" style="width:60px">Qty</th><th class="r" style="width:70px">MRP</th><th class="r" style="width:58px">Disc</th><th class="r" style="width:76px">Rate</th><th class="r" style="width:80px">Amount</th><th class="r" style="width:50px">Tax%</th><th class="r" style="width:60px">Tax</th></tr></thead><tbody>' +
      cart.map(function (l, i) {
        var it = svc.item(l.itemId), bt = svc.batch(l.batchId), bs = svc.batchesOf(l.itemId, true), tx = PD.num(it.tax || 0), amt = lineAmt(l);
        return '<tr class="cartrow ' + (i === sel ? 'sel' : '') + '" data-r="' + i + '"><td>' + numId(it.id) + '</td><td class="' + rxc(it) + '">' + esc(it.name) + ' ' + PD.schedBadge(it.schedule) + (rxc(it) ? ' <small>Rx</small>' : '') + '</td><td><select class="in sm" data-b="' + i + '">' + bs.map(function (b) { return '<option value="' + b.id + '"' + (b.id === l.batchId ? ' selected' : '') + '>' + esc(b.batchNo) + ' (' + PD.qty(b.qty) + ')</option>'; }).join('') + '</select></td><td class="' + expc(bt.expiry) + '">' + PD.fmtExp(bt.expiry) + '</td>' +
          '<td class="r"><input class="in sm qn" data-q="' + i + '" type="number" min="0" step="any" value="' + l.qty + '"></td><td class="r">' + PD.n2(bt.mrp || it.mrp) + '</td><td class="r"><input class="in sm" data-d="' + i + '" type="number" min="0" max="100" step="any" value="' + (l.disc || '') + '"></td><td class="r"><input class="in sm" data-rt="' + i + '" type="number" step="any" value="' + l.rate + '"></td><td class="r"><b data-am="' + i + '">' + PD.n2(amt) + '</b></td><td class="r">' + tx.toFixed(1) + '</td><td class="r" data-tx="' + i + '">' + PD.n2(amt - amt / (1 + tx / 100)) + '</td></tr>';
      }).join('') + '</tbody>';
    totals(); showEntry();
  }
  function calc() { return svc.calcBill(cart.map(function (l) { return { qty: l.qty, rate: l.rate, disc: l.disc, tax: svc.item(l.itemId).tax || 0 }; }), meta.discPct, meta.discAmt); }
  var PAYS = [['cash', 'CASH'], ['upi', 'UPI'], ['card', 'CARD'], ['credit', 'CREDIT']];
  function totals() {
    var c = calc(), exact = c.total, grand = S.rounding ? Math.round(exact) : exact, ro = PD.r2(grand - exact), series = {};
    cart.forEach(function (l, i) { var a = $('[data-am="' + i + '"]', host); if (a) a.textContent = PD.n2(lineAmt(l)); var t = $('[data-tx="' + i + '"]', host); if (t) { var tx = PD.num(svc.item(l.itemId).tax || 0); t.textContent = PD.n2(lineAmt(l) - lineAmt(l) / (1 + tx / 100)); } series[svc.seriesOf(svc.item(l.itemId))] = 1; });
    var rec = meta.received === '' ? (meta.payMode === 'credit' ? 0 : grand) : PD.num(meta.received), nSer = Object.keys(series).length;
    $('#ni', host).value = cart.length; $('#nq', host).value = PD.qty(cart.reduce(function (a, l) { return a + PD.num(l.qty); }, 0));
    var rcI = $('#rc', host); if (document.activeElement !== rcI) rcI.value = meta.received === '' ? '' : meta.received; rcI.placeholder = PD.n2(grand);
    $('#tot', host).innerHTML = '<div class="tl"><label>Total :</label><input class="in" readonly value="' + PD.n2(c.gross) + '"><label>Disc :</label><input class="in" id="dp" type="number" placeholder="%" value="' + esc(meta.discPct) + '" style="width:46px"><input class="in" id="da" type="number" placeholder="amt" value="' + esc(meta.discAmt) + '" style="width:70px"></div>' +
      '<div class="tl"><label>Tax :</label><input class="in" readonly value="' + PD.n2(c.tax) + '"><label>' + (ro ? 'R.off ' + PD.n2(ro) : '') + '</label></div><div class="tl"><label>Cess :</label><input class="in" readonly value="0%" style="width:40px"><input class="in" readonly value="0.00"></div>' +
      '<div class="net"><span>Net Total :</span><b>' + PD.n2(grand) + '</b></div>' +
      '<div class="paybar" id="pay">' + PAYS.map(function (p) { return '<button data-p="' + p[0] + '" class="' + (meta.payMode === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      (nSer > 1 && S.multiSeries ? '<div class="hint">Saves as <b>' + nSer + ' bills</b> (' + Object.keys(series).join(', ') + ')</div>' : '') +
      (meta.payMode === 'credit' ? '<div class="hint">Balance due: <b style="color:#c00">' + PD.n2(Math.max(0, grand - rec)) + '</b></div>' : (rec - grand >= 0 ? '<div class="hint">Change: <b>' + PD.n2(rec - grand) + '</b></div>' : '<div class="hint" style="color:#c00">Short by ' + PD.n2(grand - rec) + '</div>'));
    var ser = cart.length ? svc.seriesOf(svc.item(cart[0].itemId)) : 'A'; $('#bno', host).value = (D.counters['S-' + ser] || 0) + 1; $('.msfld .g', host).textContent = ser;
    $('#hn', host).textContent = D.holds.length;
    totals.grand = grand; totals.rec = rec;
  }
  PD.on($('#cart', host), 'input', '[data-q],[data-rt],[data-d]', function (e, t) {
    var i = +(t.dataset.q || t.dataset.rt || t.dataset.d), l = cart[i]; sel = i;
    if (t.dataset.q != null) { l.qty = PD.num(t.value); var b = svc.batch(l.batchId); if (l.qty > b.qty) t.classList.add('bad'); else t.classList.remove('bad'); }
    else if (t.dataset.rt != null) l.rate = PD.num(t.value); else l.disc = PD.num(t.value);
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
  $('#dpv', host).oninput = function () { meta.discPct = this.value; if (this.value) meta.discAmt = ''; totals(); };
  $('#rem', host).oninput = function () { meta.remarks = this.value; };
  PD.on($('#tot', host), 'click', '[data-p]', function (e, t) { meta.payMode = t.dataset.p; meta.received = ''; totals(); if (t.dataset.p === 'credit' && !meta.customerId) { PD.toast('Choose a customer (patient) for credit billing'); $('#cus', host).focus(); } });

  /* customer (patient) + doctor */
  var cus = $('#cus', host);
  function cinfo() { var c = meta.customerId ? svc.customer(meta.customerId) : null, last = c && D.sales.filter(function (s) { return s.customerId === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); }), n = last ? last.length : 0; $('#cinfo', host).innerHTML = c ? esc(c.type) + ' • ' + n + ' visit' + (n === 1 ? '' : 's') + (n ? ' • last ' + PD.fmtDate(last[0].date) : ' • first visit') + ' • Outstanding <b>' + PD.n2(svc.partyBalance('cus', c.id)) + '</b> <a href="#" id="chl">history</a>' : ''; var h = $('#chl', host); if (h) h.onclick = function (e) { e.preventDefault(); PD.go('custhist', { customerId: c.id }); }; }
  PD.combo(cus, { source: function (qv) { qv = qv.toLowerCase(); return D.customers.filter(function (c) { return c.active !== false && (!qv || (c.name + ' ' + (c.phone || '')).toLowerCase().indexOf(qv) >= 0); }).map(function (c) { return { id: c.id, label: '<b>' + esc(c.name) + '</b>', sub: esc(c.phone || ''), right: esc(c.type) }; }); }, onPick: function (x) { meta.customerId = x.id; cus.value = svc.cusName(x.id); cinfo(); } });
  cus.addEventListener('input', function () { if (!cus.value.trim()) { meta.customerId = ''; cinfo(); } });
  $('#ncus', host).onclick = function () {
    var f = [{ k: 'name', label: 'Name', req: true, full: true }, { k: 'phone', label: 'Phone' }, { k: 'type', label: 'Type', type: 'select', options: ['Regular', 'Special'] }];
    PD.modal({ title: 'New customer', size: 'sm', body: PD.formHTML(f, { type: 'Regular' }), foot: [{ label: 'Cancel' }, { label: 'Save', cls: 'p', fn: function (api) { try { var v = PD.readForm(api.body, f); v.active = true; v.limit = 5000; var r = svc.saveMaster('customers', v); meta.customerId = r.id; cus.value = r.name; cinfo(); } catch (e) { PD.err(e); return false; } } }] });
  };
  $('#doc', host).value = meta.doctor; $('#doc', host).oninput = function () { meta.doctor = this.value; };
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

  /* save */
  function save(print) {
    try {
      if (!cart.length) throw new Error('Add at least one item');
      var needDoc = cart.some(function (l) { var s = svc.item(l.itemId).schedule; return s === 'H1' || s === 'X'; });
      if (needDoc && !meta.doctor.trim()) { $('#doc', host).focus(); throw new Error('Doctor name is required for Schedule H1 / X medicines'); }
      var c = meta.customerId ? svc.customer(meta.customerId) : null;
      var go = function () {
        var bills = svc.postSale({ customerId: meta.customerId, doctor: meta.doctor, payMode: meta.payMode, received: meta.received === '' ? (meta.payMode === 'credit' ? 0 : totals.grand) : meta.received, discPct: meta.discPct, discAmt: meta.discAmt, lines: cart.map(function (l) { return { itemId: l.itemId, batchId: l.batchId, qty: l.qty, rate: l.rate, disc: l.disc }; }) });
        PD.lastBills = bills; PD.toast('Saved ' + bills.map(function (b) { return b.no; }).join(' + ') + ' • ' + PD.money(bills.reduce(function (a, b) { return a + b.total; }, 0)), 'ok');
        if (print) bills.forEach(PD.printBill);
        PD.views.billing.render(host, null);
      };
      if (meta.payMode === 'credit' && c && c.type !== 'Special') {
        var out = svc.partyBalance('cus', c.id) + Math.max(0, totals.grand - PD.num(meta.received));
        if (c.limit && out > c.limit) { PD.confirm('Credit limit of ' + PD.n2(c.limit) + ' will be exceeded for <b>' + esc(c.name) + '</b> (outstanding would be ' + PD.n2(out) + '). Continue?', 'Continue').then(function (ok) { if (ok) try { go(); } catch (e) { PD.err(e); } }); return; }
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
