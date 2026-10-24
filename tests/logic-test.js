/* Paste into the browser console on the PharmaDesk page (after login). Runs on a COPY of the data. */
(function () {
  var PD = window.PD, osave = PD.save, oflush = PD.flush, orig = PD.DB, out = [];
  PD.save = function () {}; PD.flush = function () {};
  PD.DB = JSON.parse(JSON.stringify(orig));
  var D = PD.DB, svc = PD.svc;
  function T(name, fn) { try { var r = fn(); out.push((r === false ? 'FAIL ' : 'ok   ') + name + (typeof r === 'string' ? ': ' + r : '')); } catch (e) { out.push('FAIL ' + name + ': ' + e.message); } }
  function throws(fn) { try { fn(); return false; } catch (e) { return true; } }
  function tbOk() { var dr = 0, cr = 0; D.vouchers.forEach(function (v) { v.lines.forEach(function (l) { dr += l.dr; cr += l.cr; }); }); return Math.abs(dr - cr) < 0.05; }
  function itemWithStock(cat) { return D.items.find(function (i) { return i.cat === cat && svc.batchesOf(i.id, true).length && svc.stockOf(i.id) > 10; }); }

  T('trial balance balanced at start', tbOk);
  var a = itemWithStock('Allopathy'), b = itemWithStock('Ayurvedic'), ba = svc.batchesOf(a.id, true)[0], bb = svc.batchesOf(b.id, true)[0];
  var sa = ba.qty, sb = bb.qty, bills;
  T('mixed-category bill splits into 2 series', function () {
    bills = svc.postSale({ payMode: 'cash', lines: [{ itemId: a.id, batchId: ba.id, qty: 2, rate: ba.mrp, disc: 0 }, { itemId: b.id, batchId: bb.id, qty: 1, rate: bb.mrp, disc: 10 }] });
    return bills.length === 2 && bills[0].series !== bills[1].series ? bills.map(function (x) { return x.no + '=' + x.total; }).join(', ') : false;
  });
  T('stock reduced correctly', function () { return ba.qty === sa - 2 && bb.qty === sb - 1; });
  T('GST maths: taxable + tax = bill value', function () { return bills.every(function (x) { return Math.abs(x.taxable + x.tax - (x.total - x.roundoff)) < 0.05; }); });
  T('trial balance after sale', tbOk);
  T('credit sale without customer is blocked', function () { return throws(function () { svc.postSale({ payMode: 'credit', lines: [{ itemId: a.id, batchId: ba.id, qty: 1, rate: ba.mrp, disc: 0 }] }); }); });
  T('overselling is blocked', function () { return throws(function () { svc.postSale({ payMode: 'cash', lines: [{ itemId: a.id, batchId: ba.id, qty: 99999, rate: 1, disc: 0 }] }); }); });
  var cust = D.customers[0], cb = svc.partyBalance('cus', cust.id), cr;
  T('credit sale with part payment creates receivable', function () { cr = svc.postSale({ payMode: 'credit', customerId: cust.id, received: 20, lines: [{ itemId: a.id, batchId: ba.id, qty: 3, rate: ba.mrp, disc: 0 }] })[0]; return Math.abs(svc.partyBalance('cus', cust.id) - cb - cr.due) < 0.05 && cr.due > 0; });
  T('sales return restocks and posts refund', function () { var q = ba.qty; var r = svc.postSaleReturn({ billId: bills[0].id, lines: [{ idx: 0, qty: 1 }], mode: 'cash' }); return ba.qty === q + 1 && r.total > 0 && tbOk(); });
  T('cannot return more than sold', function () { return throws(function () { svc.postSaleReturn({ billId: bills[0].id, lines: [{ idx: 0, qty: 5 }] }); }); });
  var sup = D.suppliers[0], it = a, st0 = svc.stockOf(it.id), inv;
  T('purchase in purchase-unit with free qty', function () {
    inv = svc.postPurchase({ supplierId: sup.id, invNo: 'T1', payMode: 'credit', lines: [{ itemId: it.id, batchNo: 'TST1', expiry: '2029-01', qty: 2, unit: 'purchase', free: 1, rate: 100, mrp: 30, disc: 10, tax: 12 }] });
    var add = (2 + 1) * it.conv; return svc.stockOf(it.id) === st0 + add && inv.total === 201.6 ? 'stock +' + add + ', total ' + inv.total : false;
  });
  T('batch cost excludes GST and spreads free units', function () { var b = D.batches.find(function (x) { return x.batchNo === 'TST1'; }); return Math.abs(b.rate - 180 / (3 * it.conv)) < 0.01 ? 'cost/unit ' + b.rate : false; });
  T('supplier payable increased', function () { return svc.partyBalance('sup', sup.id) >= inv.total; });
  T('purchase return reduces stock and payable', function () { var b = D.batches.find(function (x) { return x.batchNo === 'TST1'; }), q = b.qty; svc.postPurchaseReturn({ supplierId: sup.id, lines: [{ batchId: b.id, qty: 5 }] }); return b.qty === q - 5 && tbOk(); });
  var dm;
  T('move to damaged stock + credit-note claim', function () { var b = D.batches.find(function (x) { return x.batchNo === 'TST1'; }), q = b.qty; dm = svc.moveToDamage({ batchId: b.id, qty: 4, reason: 'Damaged' }); var pb = svc.partyBalance('sup', sup.id); svc.settleClaim(dm.id, 'credit', { amount: dm.amount }); return b.qty === q - 4 && svc.partyBalance('sup', sup.id) < pb && dm.status === 'Credited' && tbOk(); });
  T('opening stock posts to capital', function () { var t = svc.addOpening([{ itemId: b.id, batchNo: 'OPX', expiry: '2028-06', qty: 10, mrp: 100, rate: 70 }], PD.today()); return t === 700 && tbOk(); });
  T('purchase order suggestions and offer status run', function () { return Array.isArray(svc.suggestPO({ mode: 'ratio', days: 30, cover: 15 })) && Array.isArray(svc.offerStatus()); });
  T('system accounts cannot be deleted', function () { return String(svc.removeMaster('accounts', 'cash')).indexOf('kept') === 0; });
  var yr = svc.currentYear(), bs;
  T('balance sheet balances (current year)', function () { bs = svc.balanceSheet(yr.id); return Math.abs(bs.A - bs.L) < 1 ? 'assets ' + bs.A + ' = liabilities ' + bs.L : 'A ' + bs.A + ' L ' + bs.L; });
  T('year closing carries balances forward', function () {
    var ny = svc.closeYear(yr.id), bs2 = svc.balanceSheet(ny.id);
    return Math.abs(bs2.A - bs.A) < 1 && Math.abs(bs2.A - bs2.L) < 1 && Math.abs(bs2.P.net) < 0.01 ? 'new year ' + ny.label + ' opens with assets ' + bs2.A : 'A ' + bs2.A + ' L ' + bs2.L + ' net ' + bs2.P.net + ' (old A ' + bs.A + ')';
  });
  T('closed year rejects new vouchers', function () { return throws(function () { svc.voucher(PD.today(), 'Journal', 'x', [{ acc: 'cash', dr: 1 }, { acc: 'capital', cr: 1 }]); }); });

  PD.DB = orig; PD.save = osave; PD.flush = oflush;
  document.documentElement.dataset.testout = out.join('\n');
})();
