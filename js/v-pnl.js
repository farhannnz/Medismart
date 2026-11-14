/* Shop Profit & Loss: sales, returns, cost of medicines, expenses, net profit for any dates (day-wise table) */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, $ = PD.$;
PD.views.shoppnl = { render: function (host, arg) {
  var from = (arg && arg.from) || PD.monthStart(), to = (arg && arg.to) || PD.today();
  host.innerHTML = '<div class="card"><div class="bd row" style="gap:10px;align-items:flex-end;flex-wrap:wrap"><div class="fld" style="min-width:150px"><label>From</label><input class="in sm" type="date" id="plf" value="' + from + '"></div><div class="fld" style="min-width:150px"><label>To</label><input class="in sm" type="date" id="plt" value="' + to + '"></div>' +
    '<button class="btn sm" data-q="0">Today</button><button class="btn sm" data-q="6">7 days</button><button class="btn sm" data-q="14">15 days</button><button class="btn sm" data-q="29">30 days</button><button class="btn p sm" id="plg">Show</button>' +
    '<span class="hint">Sales are without GST. Cost = purchase cost of the medicines sold. Net profit = gross profit minus expenses.</span></div></div><div id="plr" style="margin-top:10px"></div>';
  function go(f, t) { PD.views.shoppnl.render(host, { from: f, to: t }); }
  $('#plg', host).onclick = function () { go($('#plf', host).value, $('#plt', host).value); };
  PD.on(host, 'click', '[data-q]', function (e, t) { go(PD.addDays(PD.today(), -(+t.dataset.q)), PD.today()); });
  var all = PD.cloud.daySummaries(PD.DB), days = Object.keys(all).filter(function (d) { return d >= from && d <= to; }).sort().map(function (d) { return all[d]; });
  var T = { bills: 0, total: 0, sales: 0, cost: 0, returns: 0, retCost: 0, expense: 0, profit: 0 };
  days.forEach(function (d) { Object.keys(T).forEach(function (k) { T[k] += d[k] || 0; }); });
  var net = PD.r2(T.sales - T.returns), gross = PD.r2(T.sales - T.returns - (T.cost - T.retCost)), margin = net > 0 ? PD.r2(gross / net * 100) : 0, np = PD.r2(T.profit);
  function kpi(l, v, c) { return '<div class="card" style="flex:1;min-width:150px"><div class="bd"><div class="hint">' + l + '</div><div style="font-size:20px;font-weight:700' + (c ? ';color:' + c : '') + '">' + v + '</div></div></div>'; }
  var out = $('#plr', host);
  out.innerHTML = '<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px">' + kpi('Bills', T.bills) + kpi('Sales (ex GST)', PD.money(T.sales)) + kpi('Returns', PD.money(T.returns)) + kpi('Cost of medicines', PD.money(T.cost - T.retCost)) +
    kpi('Gross profit', PD.money(gross) + ' <small>(' + margin + '%)</small>') + kpi('Expenses', PD.money(T.expense)) + kpi('Net profit', PD.money(np), np < 0 ? '#c62828' : '#2e7d32') + '</div>' +
    '<div class="card"><div class="hd"><h3 style="padding:0;border:0">Day-wise: ' + PD.fmtDate(from) + ' to ' + PD.fmtDate(to) + '</h3></div><div class="tw"><table class="t"><thead><tr><th>Date</th><th class="r">Bills</th><th class="r">Sales</th><th class="r">Returns</th><th class="r">Cost</th><th class="r">Gross profit</th><th class="r">Expenses</th><th class="r">Net profit</th></tr></thead><tbody>' +
    (days.slice().reverse().map(function (d) { var g = d.sales - d.returns - (d.cost - d.retCost); return '<tr><td>' + PD.fmtDate(d.date) + '</td><td class="r">' + d.bills + '</td><td class="r">' + PD.n2(d.sales) + '</td><td class="r">' + PD.n2(d.returns) + '</td><td class="r">' + PD.n2(d.cost - d.retCost) + '</td><td class="r">' + PD.n2(g) + '</td><td class="r">' + PD.n2(d.expense) + '</td><td class="r"><b style="color:' + (d.profit < 0 ? '#c62828' : '#2e7d32') + '">' + PD.n2(d.profit) + '</b></td></tr>'; }).join('') || '<tr><td colspan="8" class="mut">No sales in these dates</td></tr>') +
    '</tbody></table></div></div>';
} };
})();
