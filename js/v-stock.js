/* Stock, opening stock, batch edit, expiry / damage / claims, product explorer */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;

function tabsView(host, tabs, cur, fns) {
  host.innerHTML = '<div class="tabs" id="tb" style="margin-bottom:16px">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (t[0] === cur ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="tc"></div>';
  function show(t) { PD.$$('#tb button', host).forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); }); var c = $('#tc', host); c.innerHTML = ''; fns[t](c, show); }
  PD.on($('#tb', host), 'click', 'button', function (e, b) { show(b.dataset.t); });
  show(cur);
}
function batchModal(b, done) {
  var f = [{ k: 'batchNo', label: 'Batch number' }, { k: 'expiry', label: 'Expiry', type: 'month' }, { k: 'mrp', label: 'MRP', type: 'number' }, { k: 'rate', label: 'Cost rate (per unit)', type: 'number' }, { k: 'qty', label: 'Quantity in stock', type: 'number' }, { k: 'why', label: 'Reason for change', full: true }];
  PD.modal({ title: 'Edit batch — ' + svc.itemName(b.itemId), size: 'md', body: PD.formHTML(f, { batchNo: b.batchNo, expiry: b.expiry, mrp: b.mrp, rate: b.rate, qty: b.qty, why: '' }), foot: [{ label: 'Cancel' }, { label: 'Save', cls: 'p', fn: function (api) { try { var v = PD.readForm(api.body, f); svc.adjustBatch(b.id, v, v.why || 'Batch edit'); PD.toast('Batch updated', 'ok'); if (done) done(); } catch (e) { PD.err(e); return false; } } }] });
}

PD.views.stock = { render: function (host, arg) {
  var D = PD.DB;
  tabsView(host, [['list', 'Current stock'], ['open', 'Opening stock'], ['batch', 'Batch edit'], ['flow', 'Stock statement']], (arg && arg.tab) || 'list', {
    list: function (el) {
      PD.report(el, { id: 'stock-list', title: 'Current stock', filters: [{ k: 'cat', label: 'Category', type: 'select', options: [['', 'All']].concat(PD.CATS) }, { k: 'only', label: 'Show', type: 'select', options: [['', 'All items'], ['instock', 'In stock'], ['out', 'Out of stock'], ['low', 'Low stock']] }],
        load: function (f) {
          var st = svc.stockMap(), val = {}, mrpv = {}, nb = {}; D.batches.forEach(function (b) { if (b.qty > 0) { val[b.itemId] = (val[b.itemId] || 0) + b.qty * b.rate; mrpv[b.itemId] = (mrpv[b.itemId] || 0) + b.qty * b.mrp; nb[b.itemId] = (nb[b.itemId] || 0) + 1; } });
          var rows = D.items.filter(function (i) { if (i.active === false) return false; var s = st[i.id] || 0; return (!f.cat || i.cat === f.cat) && (f.only !== 'instock' || s > 0) && (f.only !== 'out' || s <= 0) && (f.only !== 'low' || (i.reorder > 0 && s <= i.reorder)); }).map(function (i) { return { id: i.id, name: i.name, generic: i.generic, cat: i.cat, sched: i.schedule, mfr: svc.mfrName(i.mfrId), rack: i.rack, stock: st[i.id] || 0, unit: i.unit, nb: nb[i.id] || 0, reorder: i.reorder, cost: PD.r2(val[i.id] || 0), mrpv: PD.r2(mrpv[i.id] || 0) }; });
          return { cols: [{ k: 'name', label: 'Item', fmt: function (v, r) { return '<i class="dotc" style="background:' + svc.catColor(r.cat) + '"></i><b>' + esc(v) + '</b> ' + PD.schedBadge(r.sched) + '<br><small class="mut">' + esc(r.generic) + '</small>'; }, raw: function (r) { return r.name + ' ' + r.generic; } }, { k: 'cat', label: 'Category' }, { k: 'mfr', label: 'Manufacturer' }, { k: 'rack', label: 'Rack' }, { k: 'nb', label: 'Batches', align: 'r' },
            { k: 'stock', label: 'Stock', align: 'r', fmt: function (v, r) { return '<span class="badge ' + (v <= 0 ? 'bad' : v <= r.reorder ? 'warn' : 'ok') + '">' + PD.qty(v) + ' ' + esc(r.unit) + '</span>'; }, raw: function (r) { return r.stock; } }, { k: 'reorder', label: 'Reorder', align: 'r' }, { k: 'cost', label: 'Value (cost)', align: 'r', sum: true, fmt: PD.n2 }, { k: 'mrpv', label: 'Value (MRP)', align: 'r', sum: true, fmt: PD.n2 }], rows: rows, note: 'Click a row to see its batches.' };
        }, drill: function (r) { PD.go('explore', { itemId: r.id }); } });
    },
    open: function (el, show) {
      el.innerHTML = '<div class="card"><div class="hd"><h3 style="padding:0;border:0">Add opening stock</h3><span class="sp"></span><span class="hint">Records stock already on your shelves (posts Dr Opening Stock / Cr Capital)</span></div><div class="bd"><div class="form" style="grid-template-columns:200px">' + PD.field({ k: 'date', label: 'As on date', type: 'date' }, PD.today()) + '</div></div><div class="bd" id="og"></div><div class="bd row" style="justify-content:space-between"><b id="ot">Total: ₹0.00</b><button class="btn p" id="osv">' + PD.icon('check') + 'Save opening stock</button></div></div><div id="ol" style="margin-top:16px"></div>';
      var grid = PD.grid($('#og', el), { id: 'os-grid', newLine: function () { return { itemId: '', batchNo: '', expiry: '', qty: '', rate: '', mrp: '' }; },
        cols: [{ k: 'item', label: 'Item', type: 'item', always: true }, { k: 'batchNo', label: 'Batch no.', w: 100 }, { k: 'expiry', label: 'Expiry', type: 'month', w: 130 }, { k: 'qty', label: 'Qty (sale units)', type: 'number', align: 'r' }, { k: 'rate', label: 'Cost / unit', type: 'number', align: 'r' }, { k: 'mrp', label: 'MRP / unit', type: 'number', align: 'r' }, { k: 'amt', label: 'Value', type: 'calc', align: 'r', calc: function (l) { return PD.n2(PD.num(l.qty) * PD.num(l.rate)); } }, { k: 'del', type: 'del', always: true }],
        onItem: function (l, it) { l.mrp = it.mrp; l.rate = PD.r2(it.mrp * 0.7); }, onChange: function (ls) { var t = 0; ls.forEach(function (l) { t += PD.num(l.qty) * PD.num(l.rate); }); var o = $('#ot', el); if (o) o.textContent = 'Total: ' + PD.money(t); } });
      grid.addLine(false);
      $('#osv', el).onclick = function () {
        try { var ls = grid.lines().filter(function (l) { return l.itemId && PD.num(l.qty) > 0; }); if (!ls.length) throw new Error('Add at least one item with quantity');
          ls.forEach(function (l) { var it = svc.item(l.itemId); if (it.batch !== false && (!l.batchNo || !l.expiry)) throw new Error('Batch and expiry are required for ' + it.name); });
          var t = svc.addOpening(ls, $('[data-k=date]', el).value); PD.toast('Opening stock saved (' + PD.money(t) + ')', 'ok'); show('open'); } catch (e) { PD.err(e); }
      };
      PD.report($('#ol', el), { id: 'os-hist', title: 'Opening stock entries', load: function () { return { cols: [{ k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'lines', label: 'Lines', align: 'r' }, { k: 'total', label: 'Value', align: 'r', sum: true, fmt: PD.n2 }], rows: D.openings.slice().reverse() }; } });
    },
    batch: function (el, show) {
      PD.report(el, { id: 'batch-edit', title: 'All batches (edit batch number, expiry, MRP, cost and quantity)', filters: [{ k: 'zero', label: 'Show', type: 'select', options: [['', 'In stock only'], ['all', 'Include zero stock']] }],
        load: function (f) { return { cols: [{ k: 'item', label: 'Item', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'batchNo', label: 'Batch' }, { k: 'expiry', label: 'Expiry', fmt: PD.expBadge, raw: function (r) { return r.expiry; } }, { k: 'mrp', label: 'MRP', align: 'r', fmt: PD.n2 }, { k: 'rate', label: 'Cost', align: 'r', fmt: PD.n2 }, { k: 'qty', label: 'Qty', align: 'r', sum: true, fmt: PD.qty }, { k: 'sup', label: 'Supplier' }, { k: '_e', label: '', raw: function () { return ''; }, fmt: function (v, r) { return '<button class="btn sm" data-eb="' + r.id + '">' + PD.icon('edit') + 'Edit</button>'; } }],
          rows: D.batches.filter(function (b) { return f.zero === 'all' || b.qty > 0; }).map(function (b) { return { id: b.id, item: svc.itemName(b.itemId), batchNo: b.batchNo, expiry: b.expiry, mrp: b.mrp, rate: b.rate, qty: b.qty, sup: svc.supName(b.supplierId) }; }) }; } });
      PD.on(el, 'click', '[data-eb]', function (e, t) { batchModal(svc.batch(t.dataset.eb), function () { show('batch'); }); });
    },
    flow: function (el) {
      PD.report(el, { id: 'stock-stmt', title: 'Item stock & sales statement (opening, purchases, sales, returns, damage, closing)',
        filters: [{ k: 'from', label: 'From', type: 'date', val: PD.monthStart }, { k: 'to', label: 'To', type: 'date', val: PD.today() }],
        load: function (f) {
          var by = {}; D.items.forEach(function (i) { by[i.id] = { o: 0, p: 0, pr: 0, s: 0, sr: 0, d: 0, a: 0 }; });
          D.moves.forEach(function (m) { var r = by[m.itemId]; if (!r) return; if (m.date < f.from) { r.o += m.qty; return; } if (m.date > f.to) return;
            if (m.type === 'PUR' || m.type === 'OPEN') r.p += m.qty; else if (m.type === 'PRET') r.pr += -m.qty; else if (m.type === 'SALE') r.s += -m.qty; else if (m.type === 'SRET') r.sr += m.qty; else if (m.type === 'DMG') r.d += -m.qty; else r.a += m.qty; });
          return { cols: [{ k: 'name', label: 'Item' }, { k: 'o', label: 'Opening', align: 'r', sum: true, fmt: PD.qty }, { k: 'p', label: 'Purchases', align: 'r', sum: true, fmt: PD.qty }, { k: 'pr', label: 'Purchase ret.', align: 'r', sum: true, fmt: PD.qty }, { k: 's', label: 'Sales', align: 'r', sum: true, fmt: PD.qty }, { k: 'sr', label: 'Sales ret.', align: 'r', sum: true, fmt: PD.qty }, { k: 'd', label: 'Damage / expiry', align: 'r', sum: true, fmt: PD.qty }, { k: 'a', label: 'Adjust / claim', align: 'r', sum: true, fmt: PD.qty }, { k: 'c', label: 'Closing', align: 'r', sum: true, fmt: function (v) { return '<b>' + PD.qty(v) + '</b>'; } }],
            rows: D.items.map(function (i) { var r = by[i.id]; return { id: i.id, name: i.name, o: r.o, p: r.p, pr: r.pr, s: r.s, sr: r.sr, d: r.d, a: r.a, c: PD.r2(r.o + r.p - r.pr - r.s + r.sr - r.d + r.a) }; }).filter(function (r) { return r.o || r.p || r.pr || r.s || r.sr || r.d || r.a || r.c; }) };
        }, drill: function (r) { PD.go('explore', { itemId: r.id }); } });
    }
  });
} };

/* ---------- expiry, damage, claims ---------- */
PD.views.expiry = { render: function (host, arg) {
  var D = PD.DB;
  tabsView(host, [['watch', 'Expiry watch'], ['dmg', 'Damaged & expired stock'], ['claims', 'Supplier claims']], (arg && arg.tab) || 'watch', {
    watch: function (el, show) {
      var rep = PD.report(el, { id: 'exp-watch', title: 'Batches by expiry',
        filters: [{ k: 'win', label: 'Show', type: 'select', options: [['0', 'Already expired'], ['30', 'Expiring in 30 days'], ['60', 'Within 60 days'], ['90', 'Within 90 days'], ['180', 'Within 180 days']], val: '90' }, { k: 'sup', label: 'Supplier', type: 'select', options: function () { return [['', 'All suppliers']].concat(D.suppliers.map(function (s) { return [s.id, s.name]; })); } }, { k: 'mfr', label: 'Manufacturer', type: 'select', options: function () { return [['', 'All manufacturers']].concat(D.mfrs.map(function (s) { return [s.id, s.name]; })); } }],
        load: function (f) {
          var w = +f.win, rows = D.batches.filter(function (b) { if (!(b.qty > 0) || !b.expiry) return false; var d = PD.daysToExp(b.expiry); if (w === 0 ? d >= 0 : d > w) return false; var it = svc.item(b.itemId); return (!f.sup || b.supplierId === f.sup) && (!f.mfr || (it && it.mfrId === f.mfr)); }).sort(function (a, b) { return a.expiry.localeCompare(b.expiry); });
          return { cols: [{ k: 'sel', label: '', raw: function () { return ''; }, fmt: function (v, r) { return '<input type="checkbox" data-sel="' + r.id + '">'; } }, { k: 'item', label: 'Item', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'batchNo', label: 'Batch' }, { k: 'expiry', label: 'Expiry', fmt: PD.expBadge, raw: function (r) { return r.expiry; } }, { k: 'days', label: 'Days left', align: 'r' }, { k: 'qty', label: 'Qty', align: 'r', sum: true, fmt: PD.qty }, { k: 'value', label: 'Cost value', align: 'r', sum: true, fmt: PD.n2 }, { k: 'sup', label: 'Supplier' }, { k: 'mfr', label: 'Manufacturer' }],
            rows: rows.map(function (b) { var it = svc.item(b.itemId); return { id: b.id, item: svc.itemName(b.itemId), batchNo: b.batchNo, expiry: b.expiry, days: PD.daysToExp(b.expiry), qty: b.qty, value: PD.r2(b.qty * b.rate), sup: svc.supName(b.supplierId), mfr: it ? svc.mfrName(it.mfrId) : '' }; }), note: 'Tick batches and move them out of saleable stock into the expired/damaged stock register.' };
        } });
      PD.$('#r-act', el).insertAdjacentHTML('afterbegin', '<button class="btn sm d" id="mv">' + PD.icon('alert') + 'Move selected to expired / damaged</button>');
      PD.$('#mv', el).onclick = function () {
        var ids = PD.$$('[data-sel]:checked', el).map(function (c) { return c.dataset.sel; }); if (!ids.length) { PD.toast('Tick one or more batches first', 'err'); return; }
        var f = [{ k: 'reason', label: 'Reason', type: 'select', options: ['Expired', 'Damaged', 'Near expiry (return)'] }, { k: 'note', label: 'Note' }];
        PD.modal({ title: 'Move ' + ids.length + ' batch(es) out of stock', size: 'sm', body: PD.formHTML(f, { reason: 'Expired' }, '') + '<p class="hint">The full quantity of each ticked batch will move to the separate expired/damaged stock and can be claimed from the supplier.</p>', foot: [{ label: 'Cancel' }, { label: 'Move', cls: 'd', fn: function (api) { try { var v = PD.readForm(api.body, f); ids.forEach(function (id) { var b = svc.batch(id); svc.moveToDamage({ batchId: id, qty: b.qty, reason: v.reason, note: v.note }); }); PD.toast(ids.length + ' batch(es) moved', 'ok'); rep.reload(); } catch (e) { PD.err(e); return false; } } }] });
      };
    },
    dmg: function (el) {
      PD.report(el, { id: 'dmg-reg', title: 'Damaged & expired stock register', filters: [{ k: 'from', label: 'From', type: 'date', val: function () { return PD.addDays(PD.today(), -180); } }, { k: 'to', label: 'To', type: 'date', val: PD.today() }, { k: 'sup', label: 'Supplier', type: 'select', options: function () { return [['', 'All']].concat(D.suppliers.map(function (s) { return [s.id, s.name]; })); } }, { k: 'reason', label: 'Reason', type: 'select', options: [['', 'All'], 'Expired', 'Damaged', 'Near expiry (return)'] }],
        load: function (f) { return { cols: [{ k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'item', label: 'Item', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'batchNo', label: 'Batch' }, { k: 'expiry', label: 'Expiry', fmt: PD.fmtExp }, { k: 'qty', label: 'Qty', align: 'r', sum: true, fmt: PD.qty }, { k: 'amount', label: 'Cost value', align: 'r', sum: true, fmt: PD.n2 }, { k: 'reason', label: 'Reason' }, { k: 'sup', label: 'Supplier' }, { k: 'status', label: 'Claim', fmt: claimBadge }],
          rows: D.damage.filter(function (d) { return d.date >= f.from && d.date <= f.to && (!f.sup || d.supplierId === f.sup) && (!f.reason || d.reason === f.reason); }).slice().reverse().map(function (d) { return { id: d.id, date: d.date, item: svc.itemName(d.itemId), batchNo: d.batchNo, expiry: d.expiry, qty: d.qty, amount: d.amount, reason: d.reason, sup: svc.supName(d.supplierId), status: d.status }; }) }; } });
    },
    claims: function (el, show) {
      var cnt = {}; D.damage.forEach(function (d) { cnt[d.status] = (cnt[d.status] || 0) + 1; });
      el.innerHTML = '<div class="grid g4" style="margin-bottom:14px">' + ['Pending', 'Claimed', 'Credited', 'Replaced'].map(function (s) { var amt = 0; D.damage.forEach(function (d) { if (d.status === s) amt += d.amount; }); return '<div class="card kpi"><div class="l">' + s + '</div><div class="v">' + (cnt[s] || 0) + '</div><div class="s">' + PD.money(amt) + '</div></div>'; }).join('') + '</div><div id="cl"></div>';
      var rep = PD.report($('#cl', el), { id: 'claims', title: 'Supplier-wise claim list', filters: [{ k: 'sup', label: 'Supplier', type: 'select', options: function () { return [['', 'All suppliers']].concat(D.suppliers.map(function (s) { return [s.id, s.name]; })); } }, { k: 'st', label: 'Status', type: 'select', options: [['', 'All'], 'Pending', 'Claimed', 'Credited', 'Replaced', 'Rejected'], val: 'Pending' }],
        load: function (f) { return { cols: [{ k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'sup', label: 'Supplier' }, { k: 'item', label: 'Item', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'batchNo', label: 'Batch' }, { k: 'qty', label: 'Qty', align: 'r', sum: true, fmt: PD.qty }, { k: 'rate', label: 'Cost', align: 'r', fmt: PD.n2 }, { k: 'amount', label: 'Claim value', align: 'r', sum: true, fmt: PD.n2 }, { k: 'pur', label: 'Purchase inv.' }, { k: 'reason', label: 'Reason' }, { k: 'status', label: 'Status', fmt: claimBadge }, { k: '_a', label: '', raw: function () { return ''; }, fmt: function (v, r) { return r.status === 'Pending' || r.status === 'Claimed' ? '<button class="btn sm" data-set="' + r.id + '">Settle</button>' : ''; } }],
          rows: D.damage.filter(function (d) { return (!f.sup || d.supplierId === f.sup) && (!f.st || d.status === f.st); }).slice().reverse().map(function (d) { var p = D.purchases.find(function (x) { return x.id === d.purId; }); return { id: d.id, date: d.date, sup: svc.supName(d.supplierId), item: svc.itemName(d.itemId), batchNo: d.batchNo, qty: d.qty, rate: d.rate, amount: d.amount, pur: p ? p.no + (p.invNo ? ' / ' + p.invNo : '') : '', reason: d.reason, status: d.status, supId: d.supplierId }; }) }; } });
      PD.$('#r-act', el).insertAdjacentHTML('afterbegin', '<button class="btn sm p" id="cs">' + PD.icon('print') + 'Claim statement</button>');
      PD.$('#cs', el).onclick = function () {
        var sid = PD.$('[data-f=sup]', el).value; if (!sid) { PD.toast('Select a supplier in the filter first', 'err'); return; }
        var rows = D.damage.filter(function (d) { return d.supplierId === sid && (d.status === 'Pending' || d.status === 'Claimed'); }), tot = 0;
        PD.printHTML('<h2>' + esc(D.shop.name) + '</h2><h3>Expiry / damage claim statement</h3><div>To: <b>' + esc(svc.supName(sid)) + '</b> • Date ' + PD.fmtDate(PD.today()) + '</div><br><table><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Reason</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Value</th><th>Purchase</th></tr></thead><tbody>' + rows.map(function (d) { tot += d.amount; var p = D.purchases.find(function (x) { return x.id === d.purId; }); return '<tr><td>' + esc(svc.itemName(d.itemId)) + '</td><td>' + esc(d.batchNo) + '</td><td>' + PD.fmtExp(d.expiry) + '</td><td>' + esc(d.reason) + '</td><td class="r">' + PD.qty(d.qty) + '</td><td class="r">' + PD.n2(d.rate) + '</td><td class="r">' + PD.n2(d.amount) + '</td><td>' + esc(p ? (p.invNo || p.no) + ' ' + PD.fmtDate(p.date) : '') + '</td></tr>'; }).join('') + '</tbody><tfoot><tr><td colspan="6" class="r b">Total claim</td><td class="r b">' + PD.n2(tot) + '</td><td></td></tr></tfoot></table>');
        rows.forEach(function (d) { if (d.status === 'Pending') d.status = 'Claimed'; }); PD.save(); rep.reload();
      };
      PD.on(el, 'click', '[data-set]', function (e, t) {
        var d = D.damage.find(function (x) { return x.id === t.dataset.set; }), f = [{ k: 'outcome', label: 'Outcome', type: 'select', options: [['credit', 'Credit note received'], ['replace', 'Replacement received'], ['reject', 'Claim rejected (write off)']] }, { k: 'amount', label: 'Credit amount', type: 'number' }, { k: 'batchNo', label: 'New batch no. (replacement)' }, { k: 'expiry', label: 'New expiry (replacement)', type: 'month' }];
        PD.modal({ title: 'Settle claim — ' + svc.itemName(d.itemId), size: 'md', body: PD.formHTML(f, { outcome: 'credit', amount: d.amount }), foot: [{ label: 'Cancel' }, { label: 'Save', cls: 'p', fn: function (api) { try { var v = PD.readForm(api.body, f); svc.settleClaim(d.id, v.outcome, { amount: v.amount, batchNo: v.batchNo, expiry: v.expiry }); PD.toast('Claim settled', 'ok'); show('claims'); } catch (e) { PD.err(e); return false; } } }] });
      });
    }
  });
  function claimBadge(v) { return '<span class="badge ' + ({ Pending: 'warn', Claimed: 'info', Credited: 'ok', Replaced: 'ok', Rejected: 'bad' }[v] || '') + '">' + esc(v) + '</span>'; }
} };

/* ---------- product explorer ---------- */
PD.views.explore = { render: function (host, arg) {
  var D = PD.DB, groupBy = 'cat', sel = (arg && arg.itemId) || '', q = '', open = {};
  host.innerHTML = '<div class="split" style="grid-template-columns:320px minmax(260px,1fr) 2fr"><div class="card"><div class="bd"><div class="fld"><label>Group products by</label><select class="in sm" id="gb"><option value="cat">Category</option><option value="generic">Generic name</option><option value="schedule">Schedule</option><option value="mfr">Manufacturer</option><option value="division">Division / type</option></select></div><input class="in sm" id="eq" placeholder="Filter products..." style="margin-top:8px"></div><div id="tree" style="max-height:68vh;overflow:auto"></div></div><div class="card"><div class="hd"><h3 style="padding:0;border:0">Products</h3><span class="sp"></span><span class="hint">↑ ↓ move • Space opens linked windows</span></div><div id="plist" style="max-height:72vh;overflow:auto" tabindex="0"></div></div><div id="linked"></div></div>';
  function key(it) { return groupBy === 'cat' ? it.cat : groupBy === 'generic' ? (it.generic || '—') : groupBy === 'schedule' ? (it.schedule || 'No schedule') : groupBy === 'mfr' ? (svc.mfrName(it.mfrId) || '—') : (it.division || '—'); }
  var group = '';
  function items() { var ql = q.toLowerCase(); return D.items.filter(function (it) { return it.active !== false && (!ql || (it.name + ' ' + it.generic).toLowerCase().indexOf(ql) >= 0); }); }
  function tree() {
    var g = {}; items().forEach(function (it) { var k = key(it); (g[k] = g[k] || []).push(it); });
    var keys = Object.keys(g).sort(); if (!group || !g[group]) group = keys[0] || '';
    $('#tree', host).innerHTML = keys.map(function (k) { return '<div class="it" data-g="' + esc(k) + '" style="padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;border-bottom:1px solid var(--line);' + (k === group ? 'background:var(--brand-l);font-weight:700' : '') + '"><span>' + (groupBy === 'cat' ? '<i class="dotc" style="background:' + svc.catColor(k) + '"></i>' : '') + esc(k) + '</span><span class="badge">' + g[k].length + '</span></div>'; }).join('') || '<div class="empty">No products</div>';
    list(g[group] || []);
  }
  function list(arr) {
    var st = svc.stockMap();
    if (!sel || !arr.some(function (i) { return i.id === sel; })) sel = arr[0] ? arr[0].id : '';
    $('#plist', host).innerHTML = arr.map(function (it) { var s = st[it.id] || 0; return '<div class="it" data-i="' + it.id + '" style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;' + (it.id === sel ? 'background:var(--brand-l)' : '') + '"><span><i class="dotc" style="background:' + svc.catColor(it.cat) + '"></i><b style="' + (it.schedule === 'H1' || it.schedule === 'X' ? 'color:var(--bad)' : '') + '">' + esc(it.name) + '</b> ' + PD.schedBadge(it.schedule) + '<br><small class="mut">' + esc(it.generic) + '</small></span><span class="badge ' + (s <= 0 ? 'bad' : s <= it.reorder ? 'warn' : 'ok') + '" style="align-self:center">' + PD.qty(s) + '</span></div>'; }).join('') || '<div class="empty">No products</div>';
    linked();
  }
  function linked() {
    var el = $('#linked', host); if (!sel) { el.innerHTML = '<div class="card"><div class="empty">Select a product.</div></div>'; return; }
    var it = svc.item(sel), bs = D.batches.filter(function (b) { return b.itemId === sel && b.qty > 0; }).sort(function (a, b) { return (a.expiry || '9').localeCompare(b.expiry || '9'); }), mv = svc.itemFlow(sel).slice(-12).reverse(),
      sales = []; D.sales.slice().reverse().some(function (s) { s.lines.forEach(function (l) { if (l.itemId === sel) sales.push([s, l]); }); return sales.length >= 8; });
    var pur = []; D.purchases.slice().reverse().some(function (p) { p.lines.forEach(function (l) { if (l.itemId === sel) pur.push([p, l]); }); return pur.length >= 8; });
    var offs = D.offers.filter(function (o) { return (o.itemId === sel) || (!o.itemId && o.mfrId === it.mfrId); });
    function box(t, b) { return '<div class="card"><div class="hd"><h3 style="padding:0;border:0">' + t + '</h3></div><div class="tw" style="max-height:260px">' + b + '</div></div>'; }
    el.innerHTML = '<div class="card" style="margin-bottom:14px"><div class="bd row sp"><div><h2 style="font-size:20px">' + esc(it.name) + ' ' + PD.schedBadge(it.schedule) + '</h2><span class="mut">' + esc(it.generic) + ' • ' + esc(svc.mfrName(it.mfrId)) + ' • ' + esc(it.cat) + ' • Rack ' + esc(it.rack || '-') + ' • GST ' + it.tax + '% • MRP ' + PD.n2(it.mrp) + '</span></div><div class="row"><span class="badge brand">Stock ' + PD.qty(svc.stockOf(sel)) + ' ' + esc(it.unit) + '</span><button class="btn sm" data-sale="' + sel + '">' + PD.icon('bill') + 'Bill this</button></div></div></div><div class="grid g2">' +
      box('Batches', bs.length ? '<table class="t"><thead><tr><th>Batch</th><th>Expiry</th><th class="r">MRP</th><th class="r">Cost</th><th class="r">Qty</th></tr></thead><tbody>' + bs.map(function (b) { return '<tr><td>' + esc(b.batchNo) + '</td><td>' + PD.expBadge(b.expiry) + '</td><td class="r">' + PD.n2(b.mrp) + '</td><td class="r">' + PD.n2(b.rate) + '</td><td class="r">' + PD.qty(b.qty) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No stock</div>') +
      box('Stock flow (latest 12)', mv.length ? '<table class="t"><tbody>' + mv.map(function (m) { return '<tr><td>' + PD.fmtDate(m.date) + '</td><td><span class="badge">' + m.type + '</span></td><td>' + esc(m.ref || '') + '</td><td class="r"><b style="color:' + (m.qty < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + (m.qty > 0 ? '+' : '') + PD.qty(m.qty) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No movements</div>') +
      box('Recent sales', sales.length ? '<table class="t"><tbody>' + sales.map(function (x) { return '<tr><td>' + PD.fmtDate(x[0].date) + '</td><td>' + esc(x[0].no) + '</td><td>' + esc(svc.cusName(x[0].customerId)) + '</td><td class="r">' + PD.qty(x[1].qty) + ' × ' + PD.n2(x[1].rate) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No sales yet</div>') +
      box('Recent purchases', pur.length ? '<table class="t"><tbody>' + pur.map(function (x) { return '<tr><td>' + PD.fmtDate(x[0].date) + '</td><td>' + esc(svc.supName(x[0].supplierId)) + '</td><td class="r">' + PD.qty(x[1].qty) + (x[1].free ? ' + ' + PD.qty(x[1].free) + ' free' : '') + '</td><td class="r">' + PD.n2(x[1].rate) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No purchases yet</div>') + '</div>' +
      (offs.length ? '<div class="card" style="margin-top:14px"><div class="bd">' + offs.map(function (o) { return '<span class="badge brand" style="margin-right:6px">' + esc(o.desc) + ' • till ' + PD.fmtDate(o.to) + '</span>'; }).join('') + '</div></div>' : '');
  }
  $('#gb', host).onchange = function () { groupBy = this.value; group = ''; tree(); };
  $('#eq', host).oninput = function () { q = this.value; tree(); };
  PD.on($('#tree', host), 'click', '[data-g]', function (e, t) { group = t.dataset.g; tree(); });
  PD.on($('#plist', host), 'click', '[data-i]', function (e, t) { sel = t.dataset.i; PD.$$('#plist [data-i]', host).forEach(function (x) { x.style.background = x === t ? 'var(--brand-l)' : ''; }); linked(); });
  PD.on(host, 'click', '[data-sale]', function (e, t) { PD.go('billing', { itemId: t.dataset.sale }); });
  $('#plist', host).addEventListener('keydown', function (e) {
    var rows = PD.$$('#plist [data-i]', host), i = rows.findIndex(function (r) { return r.dataset.i === sel; });
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; if (n) { n.click(); n.scrollIntoView({ block: 'nearest' }); } }
    else if (e.key === ' ') { e.preventDefault(); $('#linked', host).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  if (sel) { var s = svc.item(sel); if (s) { group = key(s); } }
  tree();
} };
})();
