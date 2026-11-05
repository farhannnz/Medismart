/* Shop: automatic suggestions. The app prepares them, the owner only approves.
   1. Near-expiry / expired stock  -> return to the warehouse
   2. Low stock                    -> stock request to the warehouse */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;
function D() { return PD.DB; }

/* low-stock limit: the item's own "reorder" number if it has one, else 10 for strips / tablets, 2 for bottles, 3 for everything else */
svc.lowLimit = function (it) {
  var r = PD.num(it.reorder); if (r > 0) return r;
  var u = String(it.unit || '').toLowerCase();
  if (/bottle|btl|syrup|susp|drop/.test(u)) return 2;
  if (/strip|tab|cap|pc|piece/.test(u)) return 10;
  return 3;
};
svc.autoDays = function () { return PD.num(D().settings.expRetDays) || 30; };

function pendingOf(kind) { return (D().autoprops || []).find(function (p) { return p.kind === kind && p.status === 'Pending'; }); }
function openProp(kind) {
  var p = pendingOf(kind); if (p) return p;
  p = { id: PD.uid('ap'), no: svc.docNo('AP-', 'AUTOPROP'), kind: kind, date: PD.today(), status: 'Pending', lines: [] };
  (D().autoprops = D().autoprops || []).push(p); return p;
}
svc.autoScan = function () {
  var d = D(); if (!d || !d.items || !d.batches) return 0;
  var P = d.autoprops = d.autoprops || [], added = 0, today = PD.today(), recent = PD.addDays(today, -7);
  /* 1. expiry */
  var seenB = {}; P.forEach(function (p) { if (p.kind === 'expret') p.lines.forEach(function (l) { seenB[l.batchId] = 1; }); });
  var days = svc.autoDays();
  d.batches.forEach(function (b) {
    if (!(b.qty > 0) || !b.expiry || seenB[b.id]) return;
    var left = PD.daysToExp(b.expiry); if (left > days) return;
    var p = openProp('expret'); p.lines.push({ batchId: b.id, itemId: b.itemId, batchNo: b.batchNo, expiry: b.expiry, qty: b.qty, left: left, on: true, reason: left < 0 ? 'Expired' : 'Near expiry' }); added++;
  });
  /* 2. low stock */
  var stock = svc.stockMap(), covered = {}, stocked = {};
  d.requests.forEach(function (r) { if (r.status === 'Pending' || r.status === 'Partly dispatched') r.lines.forEach(function (l) { covered[l.itemId] = 1; }); });
  P.forEach(function (p) { if (p.kind !== 'lowreq') return; if (p.status === 'Pending' || (p.decided && p.decided >= recent)) p.lines.forEach(function (l) { covered[l.itemId] = 1; }); });
  d.batches.forEach(function (b) { stocked[b.itemId] = 1; });
  d.items.forEach(function (it) {
    if (it.active === false || !stocked[it.id] || covered[it.id]) return;
    var lim = svc.lowLimit(it), st = stock[it.id] || 0; if (!(st < lim)) return;
    var p = openProp('lowreq'); if (p.lines.length >= 80) return;
    p.lines.push({ itemId: it.id, stock: st, limit: lim, qty: Math.max(lim * 2 - st, lim), on: true }); added++;
  });
  P.forEach(function (p) { if (p.status === 'Pending' && !p.lines.length) p.status = 'Empty'; });
  d.autoprops = P.filter(function (p) { return p.status !== 'Empty'; });
  if (added) { PD.log('Auto suggestions', added + ' line(s) prepared for approval'); PD.save(); }
  return added;
};
svc.autoPending = function () { return (D().autoprops || []).filter(function (p) { return p.status === 'Pending'; }); };
svc.autoApprove = function (p) {
  var ls = p.lines.filter(function (l) { return l.on !== false && PD.num(l.qty) > 0; }); if (!ls.length) throw new Error('Tick at least one line');
  var r;
  if (p.kind === 'expret') {
    ls = ls.filter(function (l) { var b = svc.batch(l.batchId); return b && b.qty > 0; });
    if (!ls.length) throw new Error('That stock is no longer in the shop');
    r = svc.sendReturn({ note: 'Auto: ' + p.no, lines: ls.map(function (l) { var b = svc.batch(l.batchId); return { batchId: l.batchId, qty: Math.min(PD.num(l.qty), b.qty), reason: l.reason || 'Near expiry' }; }) });
  } else {
    r = svc.newRequest({ note: 'Auto low stock: ' + p.no, lines: ls.map(function (l) { return { itemId: l.itemId, qty: PD.num(l.qty), unit: 'sale' }; }) });
  }
  p.status = 'Approved'; p.ref = r.no; p.decided = PD.today(); p.by = PD.user ? PD.user.name : ''; PD.log('Auto suggestion approved ' + p.no, r.no); PD.save(); return r;
};
svc.autoReject = function (p) { p.status = 'Rejected'; p.decided = PD.today(); p.by = PD.user ? PD.user.name : ''; PD.log('Auto suggestion rejected ' + p.no, ''); PD.save(); };

var oAlerts = PD.alerts;
PD.alerts = function () {
  var out = oAlerts ? oAlerts() : [], n = svc.autoPending ? svc.autoPending().length : 0;
  if (n && (!PD.can || PD.can('requests'))) out.unshift({ lvl: 'bad', text: n + ' automatic return / stock request(s) waiting for your approval', go: ['autoprop'], icon: 'order' });
  return out;
};

PD.views.autoprop = { render: function (host) {
  function draw() {
    var all = (D().autoprops || []).slice().reverse(), pend = all.filter(function (p) { return p.status === 'Pending'; }), done = all.filter(function (p) { return p.status !== 'Pending'; }).slice(0, 25);
    host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Automatic Returns &amp; Stock Requests (approve)</b></div><div style="padding:8px 12px">' +
      '<p class="hint" style="margin-bottom:10px">The shop checks itself: stock with <b>' + svc.autoDays() + ' days or less</b> to expiry is prepared as a <b>return to the warehouse</b>, and medicines running low (10 strips / tablets, 2 bottles, 3 for other units, or the item\'s own reorder number) are prepared as a <b>stock request to the warehouse</b>. Untick or change a quantity, then Approve. The warehouse only has to approve on its side.</p>' +
      (pend.length ? pend.map(function (p) {
        var ex = p.kind === 'expret';
        return '<div class="card" style="margin-bottom:10px"><div class="hd"><h3 style="padding:0;border:0">' + (ex ? 'Return to warehouse: near-expiry / expired stock' : 'Stock request to warehouse: low stock') + ' &bull; ' + esc(p.no) + '</h3><span class="sp"></span><span class="badge warn">Waiting for approval</span></div><div class="bd"><div class="tw"><table class="t"><thead><tr><th></th><th>Medicine</th>' + (ex ? '<th>Batch</th><th>Expiry</th>' : '<th class="r">In shop</th><th class="r">Limit</th>') + '<th class="r">' + (ex ? 'Return qty' : 'Request qty') + '</th></tr></thead><tbody>' +
          p.lines.map(function (l, i) { return '<tr><td><input type="checkbox" data-on="' + p.id + ',' + i + '"' + (l.on !== false ? ' checked' : '') + '></td><td><b>' + esc(svc.itemName(l.itemId)) + '</b></td>' + (ex ? '<td>' + esc(l.batchNo) + '</td><td>' + PD.expBadge(l.expiry) + '</td>' : '<td class="r">' + PD.qty(l.stock) + '</td><td class="r">' + l.limit + '</td>') + '<td class="r"><input class="in sm" type="number" min="0" step="any" data-q="' + p.id + ',' + i + '" value="' + l.qty + '" style="width:80px"></td></tr>'; }).join('') +
          '</tbody></table></div><div class="row" style="margin-top:8px;gap:8px"><button class="btn p" data-ap="' + p.id + '">Approve &amp; send to warehouse</button><button class="btn d" data-rj="' + p.id + '">Reject</button></div></div></div>';
      }).join('') : '<div class="card"><div class="bd"><div class="empty">Nothing is waiting for approval. The shop checks stock and expiry automatically.</div></div></div>') +
      (done.length ? '<div class="card" style="margin-top:12px"><div class="hd"><h3 style="padding:0;border:0">Earlier</h3></div><div class="bd"><div class="tw"><table class="t"><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Lines</th><th>Status</th><th>Created</th></tr></thead><tbody>' + done.map(function (p) { return '<tr><td>' + esc(p.no) + '</td><td>' + PD.fmtDate(p.decided || p.date) + '</td><td>' + (p.kind === 'expret' ? 'Return' : 'Request') + '</td><td>' + p.lines.length + '</td><td><span class="badge ' + (p.status === 'Approved' ? 'ok' : 'bad') + '">' + esc(p.status) + '</span></td><td>' + esc(p.ref || '') + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>' : '') + '</div></div>';
  }
  function find(id) { return (D().autoprops || []).find(function (x) { return x.id === id; }); }
  PD.on(host, 'change', '[data-on]', function (e, t) { var a = t.dataset.on.split(','), p = find(a[0]); if (p) p.lines[+a[1]].on = t.checked; });
  PD.on(host, 'change', '[data-q]', function (e, t) { var a = t.dataset.q.split(','), p = find(a[0]); if (p) p.lines[+a[1]].qty = PD.num(t.value); PD.save(); });
  PD.on(host, 'click', '[data-ap]', function (e, t) {
    try { var r = svc.autoApprove(find(t.dataset.ap)); PD.toast((r.no || '') + ' created and sent to the warehouse', 'ok'); if (PD.refreshAlerts) PD.refreshAlerts(); draw(); } catch (er) { PD.err(er); }
  });
  PD.on(host, 'click', '[data-rj]', function (e, t) { var p = find(t.dataset.rj); if (p) { svc.autoReject(p); if (PD.refreshAlerts) PD.refreshAlerts(); draw(); } });
  svc.autoScan(); draw();
} };

/* keep scanning in the background (after login, and every minute) */
setInterval(function () { try { if (PD.user && PD.DB && PD.refreshAlerts) PD.refreshAlerts(); } catch (e) {} }, 60000);
})();
