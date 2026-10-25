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


/* ---------- items arrive from the warehouse; the shop never creates them by hand ---------- */
function mfrId(name) {
  name = (name || '').trim(); if (!name) return '';
  var m = D().mfrs.find(function (x) { return x.name.toLowerCase() === name.toLowerCase(); });
  return m ? m.id : svc.saveMaster('mfrs', { name: name, city: '', active: true }).id;
}
function findItem(name) { name = String(name || '').trim().toLowerCase(); return D().items.find(function (i) { return i.name.toLowerCase() === name; }); }
svc.upsertItem = function (l, forceNew) {
  if (!l || !String(l.name || '').trim()) throw new Error('An item has no name');
  var it = findItem(l.name), fresh = !it;
  var v = { generic: l.generic, cat: l.cat, schedule: l.schedule, tax: l.tax, mrp: l.mrp, unit: l.unit, punit: l.punit, conv: l.conv, hsn: l.hsn, division: l.division, reorder: l.reorder };
  if (l.mfr) v.mfrId = mfrId(l.mfr);
  if (fresh) {
    it = { name: String(l.name).trim(), generic: '', cat: PD.CATS[0], schedule: '', tax: D().settings.defaultTax, mrp: 0, unit: 'Strip', punit: 'Box', conv: 1, reorder: 10, margin: 20, rack: '', batch: true, active: true, fromWarehouse: true };
  }
  Object.keys(v).forEach(function (k) { if (v[k] !== undefined && v[k] !== null && v[k] !== '') it[k] = (k === 'tax' || k === 'mrp' || k === 'conv' || k === 'reorder') ? PD.num(v[k]) : v[k]; });
  if (!(it.conv >= 1)) it.conv = 1;
  if (fresh) { it = svc.saveMaster('items', it); }
  return { item: it, fresh: fresh };
};
svc.importItems = function (f) {
  if (!f || f.type !== 'items' || !Array.isArray(f.items)) throw new Error('This is not an item list file from the warehouse');
  var a = 0, u = 0; f.items.forEach(function (x) { var r = svc.upsertItem(x); if (r.fresh) a++; else u++; });
  PD.log('Item list imported', a + ' new, ' + u + ' updated'); PD.save(); return { added: a, updated: u };
};
svc.shelfList = function () { var m = {}; D().items.forEach(function (i) { if (i.rack) m[i.rack] = 1; }); return Object.keys(m).sort(); };
svc.setShelf = function (itemId, shelf) { var it = svc.item(itemId); if (!it) throw new Error('Item not found'); it.rack = String(shelf || '').trim(); PD.log('Shelf set', it.name + ' → ' + (it.rack || 'none')); PD.save(); };

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
    if (!(PD.num(l.qty) > 0)) throw new Error('Bad quantity for ' + l.name);
    var it = findItem(l.name); if (!it) it = svc.upsertItem(Object.assign({ mrp: l.mrp, tax: l.tax }, l)).item;
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
  var lines = [], short = [], shelves = opts.shelves || {};
  d.lines.forEach(function (l, i) {
    var q = recv && recv[i] != null ? PD.num(recv[i]) : l.qty; if (q < 0 || q > l.qty + 1e-9) throw new Error('Received quantity for ' + svc.itemName(l.itemId) + ' must be between 0 and ' + PD.qty(l.qty));
    if (q > 0) lines.push({ itemId: l.itemId, batchNo: l.batchNo, expiry: l.expiry, unit: 'sale', qty: q, free: 0, rate: l.rate, mrp: l.mrp, disc: 0, tax: l.tax });
    if (q < l.qty) short.push({ itemId: l.itemId, batchNo: l.batchNo, qty: PD.r2(l.qty - q) });
  });
  if (!lines.length) throw new Error('Nothing received.');
  var place = {};
  d.lines.forEach(function (l, i) {
    var q = recv && recv[i] != null ? PD.num(recv[i]) : l.qty; if (!(q > 0)) return;
    var it = svc.item(l.itemId), sh = String(shelves[i] != null ? shelves[i] : '').trim() || it.rack;
    if (!sh) throw new Error('Assign a shelf for ' + it.name + ' before receiving (new medicine).');
    place[l.itemId] = sh;
  });
  Object.keys(place).forEach(function (id) { svc.item(id).rack = place[id]; });
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

/* demo: a dispatch that brings one brand-new medicine (needs a shelf) plus one already on the shelves */
svc.seedNewMedDemo = function () {
  var d = D(); if (d.newMedDemo || !d.demo || !d.items.length) return; d.newMedDemo = true;
  var n = svc.upsertItem({ name: 'Vitamin D3 60K Cap', generic: 'Cholecalciferol 60000 IU', cat: 'Allopathy', schedule: 'OTC', tax: 12, mrp: 120, unit: 'Strip', punit: 'Box', conv: 4, mfr: 'Corvia Pharma', reorder: 8 }).item;
  var old = d.items.find(function (i) { return i.rack && i.id !== n.id; }) || d.items[0];
  var m = new Date(); m.setMonth(m.getMonth() + 20); var exp = m.getFullYear() + '-' + ('0' + (m.getMonth() + 1)).slice(-2);
  var lines = [{ itemId: n.id, batchNo: 'VD3-26A', expiry: exp, mrp: 120, rate: 86.4, qty: 40, tax: 12 }, { itemId: old.id, batchNo: 'WH-RF1', expiry: exp, mrp: old.mrp, rate: PD.r2(old.mrp * 0.72), qty: (old.conv || 1) * 2, tax: old.tax || 0 }];
  var dc = { id: PD.uid('dc'), no: svc.docNo('DC-', 'DC'), date: PD.today(), requestId: '', requestNo: '', lines: lines, status: 'In transit', by: 'Warehouse (demo)', note: 'Demo: one new medicine + one refill', external: true };
  var v = svc.dispatchValue(dc); dc.taxable = v.taxable; dc.tax = v.tax; dc.total = v.total; d.dispatches.push(dc); PD.save();
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
