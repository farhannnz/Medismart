/* Fast moving medicines of this shop: last 7 / 15 / 30 days */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;
function D() { return PD.DB; }
PD.views.fastmoving = { render: function (host, arg) {
  var n = (arg && +arg.days) || 7, from = PD.addDays(PD.today(), -(n - 1)), to = PD.today();
  host.innerHTML = '<div class="card"><div class="bd row" style="gap:10px;align-items:flex-end;flex-wrap:wrap"><div class="fld" style="min-width:170px"><label>Last</label><select class="in sm" id="fdays">' +
    [7, 15, 30].map(function (d) { return '<option value="' + d + '"' + (d === n ? ' selected' : '') + '>' + d + ' days</option>'; }).join('') +
    '</select></div><span class="hint">Medicines sold in the last ' + n + ' days (' + PD.fmtDate(from) + ' to ' + PD.fmtDate(to) + '), fastest first, with stock left now. Returns are deducted.</span></div></div><div id="fres" style="margin-top:10px"></div>';
  $('#fdays', host).onchange = function () { PD.views.fastmoving.render(host, { days: +this.value }); };
  var m = {}, byId = {};
  function row(id, name) { return m[id] || (m[id] = { item: name || svc.itemName(id), qty: 0, val: 0, bills: 0 }); }
  D().sales.forEach(function (s) { byId[s.id] = s; if (s.date < from || s.date > to) return; s.lines.forEach(function (l) { if (!l.itemId) return; var r = row(l.itemId, l.name); r.qty += l.qty || 0; r.val += l.amount != null ? l.amount : (l.qty || 0) * (l.rate || 0); r.bills++; }); });
  (D().sreturns || []).forEach(function (r) { if (r.date < from || r.date > to) return; var b = byId[r.billId]; (r.lines || []).forEach(function (l) { var bl = b && b.lines[l.idx]; if (bl && bl.itemId && m[bl.itemId]) { m[bl.itemId].qty -= l.qty || 0; m[bl.itemId].val -= (l.qty || 0) * (bl.rate || 0); } }); });
  var sm = svc.stockMap();
  var rows = Object.keys(m).filter(function (id) { return m[id].qty > 0; }).map(function (id) { var r = m[id]; return { item: r.item, qty: r.qty, bills: r.bills, val: PD.r2(r.val), left: sm[id] || 0 }; })
    .sort(function (a, b) { return b.qty - a.qty; }).map(function (r, i) { r.rank = i + 1; return r; });
  PD.report($('#fres', host), { id: 'fastmoving', title: 'Fast moving medicines (last ' + n + ' days)', load: function () { return { cols: [
    { k: 'rank', label: '#', align: 'r' }, { k: 'item', label: 'Medicine', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'qty', label: 'Qty sold', align: 'r', sum: true, fmt: PD.qty },
    { k: 'bills', label: 'Bills', align: 'r' }, { k: 'val', label: 'Sale value', align: 'r', sum: true, fmt: PD.n2 }, { k: 'left', label: 'In stock now', align: 'r', fmt: PD.qty }], rows: rows }; } });
} };
})();
