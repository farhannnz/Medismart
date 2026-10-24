/* Warehouse supply chain: shop stock comes only from the warehouse.
   Shop raises a stock REQUEST -> warehouse APPROVES + DISPATCHES (FEFO batches) -> shop RECEIVES, which posts a purchase
   from the warehouse account (stock in, GST input, payable). Also: attendance helpers. */
(function () {
'use strict';
var PD = window.PD, svc = PD.svc;
function D() { return PD.DB; }
var WH = 'wh';

/* ---------- the warehouse is an external party (separate software) and the shop's only supplier ---------- */
svc.warehouse = function () {
  var s = svc.supplier(WH);
  if (!s) s = svc.saveMaster('suppliers', { id: WH, name: D().settings.whName || 'Main Warehouse', phone: '', terms: 'Warehouse transfer', active: true, links: { mfrs: [], items: [] }, sys: true });
  return s;
};

/* ---------- requests (shop -> warehouse) ---------- */
svc.newRequest = function (o) {
  var lines = (o.lines || []).filter(function (l) { return l.itemId && PD.num(l.qty) > 0; }).map(function (l) {
    var it = svc.item(l.itemId), conv = l.unit === 'purchase' ? (it.conv || 1) : 1;
    return { itemId: l.itemId, qty: PD.num(l.qty), unit: l.unit === 'purchase' ? 'purchase' : 'sale', qtyS: PD.r2(PD.num(l.qty) * conv) };
  });
  if (!lines.length) throw new Error('Add at least one item with quantity');
  var r = { id: PD.uid('rq'), no: svc.docNo('RQ-', 'RQ'), date: PD.today(), time: PD.nowTime(), by: PD.user ? PD.user.name : '', note: o.note || '', lines: lines, status: 'Pending', dispatchId: '', decision: null };
  D().requests.push(r); PD.log('Stock request ' + r.no, lines.length + ' items'); PD.save(); return r;
};
svc.cancelRequest = function (id) {
  var r = D().requests.find(function (x) { return x.id === id; }); if (!r) throw new Error('Request not found');
  if (r.status !== 'Pending') throw new Error('Only a pending request can be cancelled'); r.status = 'Cancelled'; PD.log('Request cancelled', r.no); PD.save();
};
svc.dispatchValue = function (d) {
  var tx = 0, t = 0; d.lines.forEach(function (l) { var a = PD.num(l.qty) * PD.num(l.rate); t += a; tx += a * PD.num(l.tax) / 100; });
  return { taxable: PD.r2(t), tax: PD.r2(tx), total: PD.r2(t + tx) };
};
/* a dispatch file coming from the warehouse software (format in USAGE.md). Items are matched by name. */
svc.importDispatch = function (f) {
  if (!f || f.type !== 'dispatch') throw new Error('This is not a dispatch file');
  if (D().dispatches.some(function (x) { return x.no === f.no; })) throw new Error('Dispatch ' + f.no + ' is already imported');
  var lines = (f.lines || []).map(function (l) {
    var it = D().items.find(function (i) { return i.name.toLowerCase() === String(l.name || '').toLowerCase(); });
    if (!it) throw new Error('Item "' + l.name + '" is not in your item list. Create it first (Create → Item).');
    if (!(PD.num(l.qty) > 0)) throw new Error('Bad quantity for ' + l.name);
    return { itemId: it.id, reqIdx: l.reqIdx, batchNo: l.batchNo || 'NA', expiry: l.expiry || '', mrp: PD.num(l.mrp) || it.mrp, rate: PD.num(l.rate), qty: PD.num(l.qty), tax: l.tax != null ? PD.num(l.tax) : (it.tax || 0) };
  });
  if (!lines.length) throw new Error('The dispatch file has no items');
  var r = D().requests.find(function (x) { return x.no === f.requestNo; });
  var d = { id: PD.uid('dc'), no: f.no, date: f.date || PD.today(), requestId: r ? r.id : '', requestNo: f.requestNo || '', lines: lines, status: 'In transit', by: f.by || f.warehouse || 'Warehouse', note: f.note || '', external: true };
  var v = svc.dispatchValue(d); d.taxable = v.taxable; d.tax = v.tax; d.total = v.total;
  D().dispatches.push(d); if (r) { r.dispatchId = d.id; r.status = 'Approved'; r.decision = { by: d.by, date: d.date, note: d.note }; }
  PD.log('Dispatch imported ' + d.no, d.requestNo); PD.save(); return d;
};
/* DEMO ONLY: stands in for the warehouse software so the receive flow can be tried */
svc.demoDispatch = function (reqId) {
  var r = D().requests.find(function (x) { return x.id === reqId; }); if (!r || r.status !== 'Pending') throw new Error('Pick a pending request');
  var m = new Date(); m.setMonth(m.getMonth() + 22); var exp = m.getFullYear() + '-' + ('0' + (m.getMonth() + 1)).slice(-2);
  var lines = r.lines.map(function (l, i) { var it = svc.item(l.itemId); return { itemId: l.itemId, reqIdx: i, batchNo: 'WH' + (200 + i) + 'D', expiry: exp, mrp: it.mrp, rate: PD.r2(it.mrp * 0.72), qty: l.qtyS, tax: it.tax || 0 }; });
  var d = { id: PD.uid('dc'), no: svc.docNo('DC-', 'DC'), date: PD.today(), requestId: r.id, requestNo: r.no, lines: lines, status: 'In transit', by: 'Warehouse (demo)', note: 'Demo dispatch', external: true };
  var v = svc.dispatchValue(d); d.taxable = v.taxable; d.tax = v.tax; d.total = v.total;
  D().dispatches.push(d); r.dispatchId = d.id; r.status = 'Approved'; r.decision = { by: d.by, date: d.date, note: d.note }; PD.save(); return d;
};
/* receive: recv = { lineIndex: qtyReceived }; any shortage is recorded on the dispatch */
svc.receiveDispatch = function (id, recv, opts) {
  opts = opts || {};
  var d = D().dispatches.find(function (x) { return x.id === id; }); if (!d) throw new Error('Dispatch not found');
  if (d.status !== 'In transit') throw new Error('This dispatch is already ' + d.status.toLowerCase());
  var lines = [], short = [];
  d.lines.forEach(function (l, i) {
    var q = recv && recv[i] != null ? PD.num(recv[i]) : l.qty; if (q < 0 || q > l.qty + 1e-9) throw new Error('Received quantity for ' + svc.itemName(l.itemId) + ' must be between 0 and ' + PD.qty(l.qty));
    if (q > 0) lines.push({ itemId: l.itemId, batchNo: l.batchNo, expiry: l.expiry, unit: 'sale', qty: q, free: 0, rate: l.rate, mrp: l.mrp, disc: 0, tax: l.tax });
    if (q < l.qty) short.push({ itemId: l.itemId, batchNo: l.batchNo, qty: PD.r2(l.qty - q) });
  });
  if (!lines.length) throw new Error('Nothing received.');
  var inv = svc.postPurchase({ supplierId: svc.warehouse().id, invNo: d.no, date: PD.today(), payMode: opts.payMode === 'cash' ? 'cash' : 'credit', lines: lines });
  d.status = short.length ? 'Received (short)' : 'Received'; d.invId = inv.id; d.receivedOn = PD.today(); d.receivedBy = PD.user ? PD.user.name : ''; d.short = short;
  var r = D().requests.find(function (x) { return x.id === d.requestId; }); if (r) r.status = short.length ? 'Received (short)' : 'Received';
  PD.log('Received ' + d.no, inv.no + ' ' + PD.n2(inv.total) + (short.length ? ' (short)' : '')); PD.save(); return inv;
};
/* first run of demo data: one request waiting + one demo dispatch to receive */
svc.seedWarehouse = function () {
  var d = D(); if (d.whSeeded) return; d.whSeeded = true; svc.warehouse();
  if (!d.demo || !d.items.length) { PD.save(); return; }
  svc.newRequest({ note: 'Weekly refill', lines: d.items.slice(0, 3).map(function (it) { return { itemId: it.id, qty: 2, unit: 'purchase' }; }) });
  var r2 = svc.newRequest({ note: 'Urgent - fast moving', lines: d.items.slice(3, 5).map(function (it) { return { itemId: it.id, qty: 1, unit: 'purchase' }; }) });
  svc.demoDispatch(r2.id);
};

/* ---------- attendance ---------- */
function mins(t) { var p = (t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
svc.attOf = function (userId, date) { return D().attendance.find(function (a) { return a.userId === userId && a.date === date; }); };
svc.punchIn = function (user) {
  var date = PD.today(), a = svc.attOf(user.id, date);
  if (a && a.in) return a;
  var t = PD.nowTime(), late = mins(t) > mins(D().settings.shiftStart || '09:00') + (D().settings.graceMin || 0);
  if (!a) { a = { id: PD.uid('at'), userId: user.id, date: date, status: 'P', in: t, out: '', late: late, note: '', by: user.username }; D().attendance.push(a); } else { a.in = t; a.status = 'P'; a.late = late; }
  PD.log('Punch in', user.username + ' ' + t); PD.save(); return a;
};
svc.punchOut = function (user) {
  var a = svc.attOf(user.id, PD.today()); if (!a || !a.in || a.out) return a;
  a.out = PD.nowTime(); PD.log('Punch out', user.username + ' ' + a.out); PD.save(); return a;
};
svc.attHours = function (a) { if (!a || !a.in || !a.out) return 0; var h = (mins(a.out) - mins(a.in)) / 60; return h > 0 ? PD.r2(h) : 0; };
})();
