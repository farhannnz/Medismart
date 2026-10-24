/* Warehouse supply chain: shop stock comes only from the warehouse.
   Shop raises a stock REQUEST -> warehouse APPROVES + DISPATCHES (FEFO batches) -> shop RECEIVES, which posts a purchase
   from the warehouse account (stock in, GST input, payable). Also: attendance helpers. */
(function () {
'use strict';
var PD = window.PD, svc = PD.svc;
function D() { return PD.DB; }
var WH = 'wh';

/* ---------- warehouse as the single supplier ---------- */
svc.warehouse = function () {
  var s = svc.supplier(WH);
  if (!s) s = svc.saveMaster('suppliers', { id: WH, name: D().settings.whName || 'Main Warehouse', phone: '', terms: 'Warehouse transfer', active: true, links: { mfrs: [], items: [] }, sys: true });
  return s;
};
svc.whStockOf = function (itemId) { return PD.r2(D().whBatches.reduce(function (a, b) { return b.itemId === itemId ? a + b.qty : a; }, 0)); };
svc.whBatchesOf = function (itemId) { return D().whBatches.filter(function (b) { return b.itemId === itemId && b.qty > 0; }).sort(function (a, b) { return (a.expiry || '9999').localeCompare(b.expiry || '9999'); }); };
svc.whStockMap = function () { var m = {}; D().whBatches.forEach(function (b) { m[b.itemId] = (m[b.itemId] || 0) + b.qty; }); return m; };
function whAdd(itemId, batchNo, expiry, mrp, rate, qty) {
  var b = D().whBatches.find(function (x) { return x.itemId === itemId && x.batchNo === batchNo && x.expiry === expiry && Math.abs(x.rate - rate) < 0.005; });
  if (b) { b.qty = PD.r2(b.qty + qty); if (mrp) b.mrp = mrp; return b; }
  b = { id: PD.uid('wb'), itemId: itemId, batchNo: batchNo, expiry: expiry, mrp: mrp, rate: rate, qty: PD.r2(qty) }; D().whBatches.push(b); return b;
}
svc.whAddStock = function (lines) {
  var n = 0;
  lines.forEach(function (l) {
    if (!l.itemId || !(PD.num(l.qty) > 0)) return;
    var it = svc.item(l.itemId); if (it.batch !== false && (!l.batchNo || !l.expiry)) throw new Error('Batch and expiry are required for ' + it.name);
    var conv = l.unit === 'purchase' ? (it.conv || 1) : 1;
    whAdd(l.itemId, it.batch === false ? 'NA' : l.batchNo, it.batch === false ? '' : l.expiry, PD.num(l.mrp) || it.mrp, PD.num(l.rate) || PD.r2((PD.num(l.mrp) || it.mrp) * 0.72), PD.num(l.qty) * conv); n++;
  });
  if (!n) throw new Error('Add at least one item with quantity');
  PD.log('Warehouse stock added', n + ' lines'); PD.save(); return n;
};

/* ---------- requests ---------- */
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
/* approve: [{ idx, qtyS, rate }] ; allocates FEFO batches from warehouse stock and creates the dispatch (challan) */
svc.approveRequest = function (id, approve, note) {
  var r = D().requests.find(function (x) { return x.id === id; }); if (!r) throw new Error('Request not found');
  if (r.status !== 'Pending') throw new Error('This request is already ' + r.status.toLowerCase());
  var lines = [], full = true, any = false;
  r.lines.forEach(function (l, i) {
    var a = approve.find(function (x) { return x.idx === i; }), want = a ? PD.num(a.qtyS) : 0; if (want < 0) throw new Error('Quantity cannot be negative');
    if (want > svc.whStockOf(l.itemId) + 1e-9) throw new Error('Only ' + PD.qty(svc.whStockOf(l.itemId)) + ' of ' + svc.itemName(l.itemId) + ' is in the warehouse');
    if (want < l.qtyS) full = false; if (want <= 0) return; any = true;
    var it = svc.item(l.itemId), left = want;
    svc.whBatchesOf(l.itemId).forEach(function (b) {
      if (left <= 0) return; var take = Math.min(left, b.qty); b.qty = PD.r2(b.qty - take); left = PD.r2(left - take);
      lines.push({ itemId: l.itemId, reqIdx: i, batchNo: b.batchNo, expiry: b.expiry, mrp: b.mrp, rate: a && a.rate > 0 ? PD.num(a.rate) : b.rate, qty: take, tax: it.tax || 0 });
    });
  });
  if (!any) throw new Error('Approve a quantity for at least one item (or reject the request)');
  var d = { id: PD.uid('dc'), no: svc.docNo('DC-', 'DC'), date: PD.today(), requestId: r.id, requestNo: r.no, lines: lines, status: 'In transit', by: PD.user ? PD.user.name : '', note: note || '' };
  var v = svc.dispatchValue(d); d.taxable = v.taxable; d.tax = v.tax; d.total = v.total;
  D().dispatches.push(d); r.dispatchId = d.id; r.status = full ? 'Approved' : 'Partly approved'; r.decision = { by: d.by, date: d.date, note: note || '' };
  PD.log('Dispatched ' + d.no, r.no + ' ' + PD.n2(d.total)); PD.save(); return d;
};
svc.rejectRequest = function (id, reason) {
  var r = D().requests.find(function (x) { return x.id === id; }); if (!r) throw new Error('Request not found');
  if (r.status !== 'Pending') throw new Error('This request is already ' + r.status.toLowerCase());
  if (!reason || !reason.trim()) throw new Error('Give a reason for rejecting');
  r.status = 'Rejected'; r.decision = { by: PD.user ? PD.user.name : '', date: PD.today(), note: reason.trim() }; PD.log('Request rejected', r.no); PD.save();
};
svc.dispatchValue = function (d) {
  var tx = 0, t = 0; d.lines.forEach(function (l) { var a = PD.num(l.qty) * PD.num(l.rate); t += a; tx += a * PD.num(l.tax) / 100; });
  return { taxable: PD.r2(t), tax: PD.r2(tx), total: PD.r2(t + tx) };
};
/* receive: recv = { lineIndex: qtyReceived }; short quantity goes back to the warehouse */
svc.receiveDispatch = function (id, recv, opts) {
  opts = opts || {};
  var d = D().dispatches.find(function (x) { return x.id === id; }); if (!d) throw new Error('Dispatch not found');
  if (d.status !== 'In transit') throw new Error('This dispatch is already ' + d.status.toLowerCase());
  var lines = [], short = [];
  d.lines.forEach(function (l, i) {
    var q = recv && recv[i] != null ? PD.num(recv[i]) : l.qty; if (q < 0 || q > l.qty + 1e-9) throw new Error('Received quantity for ' + svc.itemName(l.itemId) + ' must be between 0 and ' + PD.qty(l.qty));
    if (q > 0) lines.push({ itemId: l.itemId, batchNo: l.batchNo, expiry: l.expiry, unit: 'sale', qty: q, free: 0, rate: l.rate, mrp: l.mrp, disc: 0, tax: l.tax });
    if (q < l.qty) short.push({ line: l, qty: PD.r2(l.qty - q) });
  });
  if (!lines.length) throw new Error('Nothing received. Use Reject if the whole dispatch is refused.');
  var inv = svc.postPurchase({ supplierId: svc.warehouse().id, invNo: d.no, date: PD.today(), payMode: opts.payMode === 'cash' ? 'cash' : 'credit', lines: lines });
  short.forEach(function (s) { whAdd(s.line.itemId, s.line.batchNo, s.line.expiry, s.line.mrp, s.line.rate, s.qty); });
  d.status = short.length ? 'Received (short)' : 'Received'; d.invId = inv.id; d.receivedOn = PD.today(); d.receivedBy = PD.user ? PD.user.name : ''; d.short = short.map(function (s) { return { itemId: s.line.itemId, batchNo: s.line.batchNo, qty: s.qty }; });
  var r = D().requests.find(function (x) { return x.id === d.requestId; }); if (r) r.status = short.length ? 'Received (short)' : 'Received';
  PD.log('Received ' + d.no, inv.no + ' ' + PD.n2(inv.total)); PD.save(); return inv;
};
/* returns to the warehouse go back onto warehouse shelves */
var origPR = svc.postPurchaseReturn;
svc.postPurchaseReturn = function (r) {
  var rec = origPR(r);
  if (r.supplierId === WH) rec.lines.forEach(function (l) { var b = svc.batch(l.batchId); whAdd(l.itemId, l.batchNo, l.expiry, b ? b.mrp : 0, l.rate, l.qty); });
  PD.save(); return rec;
};

/* ---------- demo warehouse stock + sample requests (once) ---------- */
svc.seedWarehouse = function () {
  var d = D(); if (d.whSeeded) return; d.whSeeded = true; svc.warehouse();
  if (!d.demo) { PD.save(); return; }
  var m = new Date(); m.setMonth(m.getMonth() + 22); var exp = m.getFullYear() + '-' + ('0' + (m.getMonth() + 1)).slice(-2);
  d.items.forEach(function (it, i) { whAdd(it.id, 'WH' + (100 + i), exp, it.mrp, PD.r2(it.mrp * 0.72), (it.conv || 1) * (20 + (i * 7) % 60)); });
  var low = d.items.slice(0, 3);
  var r1 = svc.newRequest({ note: 'Weekly refill', lines: low.map(function (it) { return { itemId: it.id, qty: 2, unit: 'purchase' }; }) });
  var r2 = svc.newRequest({ note: 'Urgent - fast moving', lines: d.items.slice(3, 5).map(function (it) { return { itemId: it.id, qty: 1, unit: 'purchase' }; }) });
  var u = PD.user; PD.user = { name: 'Warehouse team', username: 'warehouse' };
  try { svc.approveRequest(r2.id, r2.lines.map(function (l, i) { return { idx: i, qtyS: l.qtyS }; }), 'Dispatched by van'); } catch (e) {}
  PD.user = u; PD.save();
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
