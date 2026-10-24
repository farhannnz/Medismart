/* Dashboard + charts */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc;

/* SVG chart: series [{name,color,type:'bar'|'line',data:[]}] */
PD.chart = function (host, o) {
  var W = 760, H = 250, pl = 54, pr = 14, pt = 14, pb = 34, labels = o.labels, n = labels.length, series = o.series;
  var max = 0; series.forEach(function (s) { s.data.forEach(function (v) { if (v > max) max = v; }); }); if (max <= 0) max = 1;
  var step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step; if (nice / step < 3) nice = Math.ceil(max / (step / 2)) * (step / 2);
  var iw = W - pl - pr, ih = H - pt - pb, gw = iw / Math.max(n, 1), bars = series.filter(function (s) { return s.type !== 'line'; }), bw = Math.min(26, gw * 0.7 / Math.max(bars.length, 1));
  function x(i) { return pl + gw * i + gw / 2; } function y(v) { return pt + ih - v / nice * ih; }
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img">';
  for (var g = 0; g <= 4; g++) { var gv = nice / 4 * g, gy = y(gv); s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--line)"/><text x="' + (pl - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10.5" fill="var(--mut)">' + (gv >= 1e5 ? (gv / 1e5).toFixed(gv % 1e5 ? 1 : 0) + 'L' : gv >= 1e3 ? (gv / 1e3) + 'k' : gv) + '</text>'; }
  var every = Math.ceil(n / 12);
  labels.forEach(function (l, i) { if (i % every === 0) s += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10.5" fill="var(--mut)">' + esc(l) + '</text>'; });
  bars.forEach(function (sr, bi) {
    sr.data.forEach(function (v, i) { var bx = x(i) - bw * bars.length / 2 + bi * bw, by = y(v); s += '<rect x="' + bx + '" y="' + by + '" width="' + (bw - 2) + '" height="' + Math.max(0, pt + ih - by) + '" rx="4" fill="' + sr.color + '"><title>' + esc(sr.name + ' • ' + labels[i] + ': ' + PD.money(v)) + '</title></rect>'; });
  });
  series.filter(function (q) { return q.type === 'line'; }).forEach(function (sr) {
    var d = sr.data.map(function (v, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(v); }).join(' ');
    s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="2.5" stroke-linejoin="round"/>' + sr.data.map(function (v, i) { return '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.4" fill="var(--card)" stroke="' + sr.color + '" stroke-width="2"><title>' + esc(sr.name + ' • ' + labels[i] + ': ' + PD.money(v)) + '</title></circle>'; }).join('');
  });
  s += '</svg><div class="legend" style="margin-top:6px">' + series.map(function (q) { return '<span><i class="dotc" style="background:' + q.color + '"></i>' + esc(q.name) + '</span>'; }).join('') + '</div>';
  host.innerHTML = s;
};
/* daily/weekly/monthly sales + purchase totals */
PD.periodTotals = function (from, to, group) {
  var D = PD.DB, buckets = [], map = {};
  function key(d) { if (group === 'month') return d.slice(0, 7); if (group === 'week') { var dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset()); return dt.toISOString().slice(0, 10); } return d; }
  var cur = from;
  while (cur <= to) { var k = key(cur); if (!map[k]) { map[k] = { k: k, sales: 0, purchase: 0, profit: 0, bills: 0 }; buckets.push(map[k]); } cur = PD.addDays(cur, 1); }
  D.sales.forEach(function (s) { if (s.date >= from && s.date <= to) { var b = map[key(s.date)]; if (b) { b.sales += s.total; b.profit += s.profit; b.bills++; } } });
  D.sreturns.forEach(function (s) { if (s.date >= from && s.date <= to) { var b = map[key(s.date)]; if (b) b.sales -= s.total; } });
  D.purchases.forEach(function (p) { if (p.date >= from && p.date <= to) { var b = map[key(p.date)]; if (b) b.purchase += p.total; } });
  buckets.forEach(function (b) { var p = b.k.split('-'); b.label = group === 'month' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1] + " '" + p[0].slice(2) : +p[2] + '/' + +p[1]; });
  return buckets;
};

PD.views.dashboard = { render: function (host) {
  var D = PD.DB, today = PD.today(), mStart = today.slice(0, 8) + '01', sMap = svc.stockMap();
  var tSales = 0, tBills = 0, tProfit = 0, mSales = 0;
  D.sales.forEach(function (s) { if (s.date === today) { tSales += s.total; tBills++; tProfit += s.profit; } if (s.date >= mStart) mSales += s.total; });
  D.sreturns.forEach(function (s) { if (s.date === today) tSales -= s.total; if (s.date >= mStart) mSales -= s.total; });
  var rec = 0, pay = 0; D.customers.forEach(function (c) { rec += Math.max(0, svc.partyBalance('cus', c.id)); }); D.suppliers.forEach(function (c) { pay += Math.max(0, svc.partyBalance('sup', c.id)); });
  var low = D.items.filter(function (i) { return i.active !== false && i.reorder > 0 && (sMap[i.id] || 0) <= i.reorder; });
  var near = D.batches.filter(function (b) { return b.qty > 0 && b.expiry && PD.daysToExp(b.expiry) <= D.settings.expiryDays; }).sort(function (a, b) { return a.expiry.localeCompare(b.expiry); });
  var expired = near.filter(function (b) { return PD.daysToExp(b.expiry) < 0; });
  function kpi(l, v, s, ic, cls) { return '<div class="card kpi ' + (cls || '') + '"><span class="ic">' + PD.icon(ic) + '</span><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
  host.innerHTML = '<div class="row sp" style="margin-bottom:16px"><div><h2 style="font-size:22px">Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening') + ', ' + esc(PD.user.name.split(' ')[0]) + '</h2><span class="mut">' + esc(D.shop.name) + ' • ' + PD.fmtDate(today) + '</span></div><div class="row"><button class="btn p lg" data-go="billing">' + PD.icon('bill') + 'New sale <small style="opacity:.7">F2</small></button><button class="btn lg" data-go="purchase">' + PD.icon('cart') + 'New purchase</button></div></div>' +
    '<div class="grid g4">' + kpi('Today\'s sales', PD.money(tSales), tBills + ' bills' + (D.settings.showProfit || true ? ' • profit ' + PD.money(tProfit) : ''), 'rupee') + kpi('This month', PD.money(mSales), 'Month to date', 'report', 'info') + kpi('Receivables', PD.money(rec), 'from customers', 'users', 'warn') + kpi('Payables', PD.money(pay), 'to suppliers', 'truck', 'bad') + '</div>' +
    '<div class="grid g4" style="margin-top:16px">' + kpi('Stock value', PD.money(svc.stockValue()), 'at purchase cost', 'box') + kpi('Low stock', low.length, 'items at / below reorder level', 'alert', low.length ? 'warn' : '') + kpi('Near expiry', near.length - expired.length, 'within ' + D.settings.expiryDays + ' days', 'clock', 'warn') + kpi('Expired in stock', expired.length, 'batches to move out', 'alert', expired.length ? 'bad' : '') + '</div>' +
    '<div class="grid gdash" style="margin-top:16px"><div class="card"><div class="hd"><h3 style="padding:0;border:0">Purchase vs sales</h3><span class="sp"></span><div class="tabs" id="rng"><button data-d="7">7D</button><button data-d="14" class="on">14D</button><button data-d="30">30D</button><button data-d="90">90D</button></div><div class="tabs" id="grp"><button data-g="day" class="on">Day</button><button data-g="week">Week</button><button data-g="month">Month</button></div></div><div class="bd" id="chart"></div></div>' +
    '<div class="card"><div class="hd"><h3 style="padding:0;border:0">Top selling (30 days)</h3></div><div class="bd" id="top"></div></div></div>' +
    '<div class="grid g3" style="margin-top:16px"><div class="card"><div class="hd"><h3 style="padding:0;border:0">Expiring soon</h3><span class="sp"></span><a data-go="expiry" style="cursor:pointer">View all</a></div><div class="tw" id="exp"></div></div><div class="card"><div class="hd"><h3 style="padding:0;border:0">Reorder list</h3><span class="sp"></span><a data-go="orders" style="cursor:pointer">Create PO</a></div><div class="tw" id="low"></div></div><div class="card"><div class="hd"><h3 style="padding:0;border:0">Recent bills</h3><span class="sp"></span><a data-go="reports" style="cursor:pointer">Reports</a></div><div class="tw" id="rec"></div></div></div>';
  var days = 14, grp = 'day';
  function chart() {
    var to = today, from = PD.addDays(to, -days + 1), b = PD.periodTotals(from, to, grp);
    PD.chart(PD.$('#chart', host), { labels: b.map(function (x) { return x.label; }), series: [{ name: 'Sales', color: 'var(--brand)', data: b.map(function (x) { return PD.r2(x.sales); }) }, { name: 'Purchase', color: '#8b8bf0', data: b.map(function (x) { return PD.r2(x.purchase); }) }, { name: 'Profit', color: '#f59e0b', type: 'line', data: b.map(function (x) { return PD.r2(x.profit); }) }] });
  }
  chart();
  PD.on(PD.$('#rng', host), 'click', 'button', function (e, t) { days = +t.dataset.d; PD.$$('#rng button', host).forEach(function (x) { x.classList.toggle('on', x === t); }); chart(); });
  PD.on(PD.$('#grp', host), 'click', 'button', function (e, t) { grp = t.dataset.g; PD.$$('#grp button', host).forEach(function (x) { x.classList.toggle('on', x === t); }); chart(); });
  var sold = svc.salesQty(PD.addDays(today, -30), today), tops = Object.keys(sold).map(function (k) { return [k, sold[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6), mx = tops.length ? tops[0][1] : 1;
  PD.$('#top', host).innerHTML = tops.length ? tops.map(function (t) { return '<div style="margin-bottom:11px"><div class="row sp"><b>' + esc(svc.itemName(t[0])) + '</b><span class="mut">' + PD.qty(t[1]) + ' sold</span></div><div class="bar"><i style="width:' + (t[1] / mx * 100) + '%"></i></div></div>'; }).join('') : '<div class="empty">No sales yet.</div>';
  PD.$('#exp', host).innerHTML = near.length ? '<table class="t"><tbody>' + near.slice(0, 7).map(function (b) { return '<tr><td><b>' + esc(svc.itemName(b.itemId)) + '</b><br><small class="mut">Batch ' + esc(b.batchNo) + ' • qty ' + PD.qty(b.qty) + '</small></td><td class="r">' + PD.expBadge(b.expiry) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">Nothing expiring soon \u{1F389}</div>';
  PD.$('#low', host).innerHTML = low.length ? '<table class="t"><tbody>' + low.slice(0, 7).map(function (i) { return '<tr><td><b>' + esc(i.name) + '</b><br><small class="mut">Reorder at ' + i.reorder + '</small></td><td class="r"><span class="badge ' + ((sMap[i.id] || 0) === 0 ? 'bad' : 'warn') + '">' + PD.qty(sMap[i.id] || 0) + ' left</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">All items are above reorder level.</div>';
  var recent = D.sales.slice(-7).reverse();
  PD.$('#rec', host).innerHTML = recent.length ? '<table class="t"><tbody>' + recent.map(function (s) { return '<tr><td><b>' + esc(s.no) + '</b><br><small class="mut">' + esc(svc.cusName(s.customerId)) + ' • ' + PD.fmtDate(s.date) + '</small></td><td class="r"><b>' + PD.money(s.total) + '</b><br><span class="badge ' + (s.payMode === 'credit' ? 'warn' : 'ok') + '">' + esc(s.payMode) + '</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No bills yet. Press F2 to start billing.</div>';
  PD.on(host, 'click', '[data-go]', function (e, t) { PD.go(t.dataset.go, t.dataset.go === 'billing' || t.dataset.go === 'purchase' ? { fresh: 1 } : null); });
} };
})();
