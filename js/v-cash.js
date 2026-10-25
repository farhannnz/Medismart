/* Shifts and cash register: who logged in when, cash at the start and end, cash in/out, differences */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;
function D() { return PD.DB; }
function nowKey() { return PD.today() + ' ' + PD.nowTime(); }

svc.shiftOpen = function (userId) { return D().shifts.find(function (s) { return s.userId === userId && s.status === 'open'; }); };
svc.shiftFigures = function (sh) {
  var from = sh.startKey, to = sh.endKey || '9999-99-99 99:99', d = D(), f = { cashSales: 0, refunds: 0, cin: 0, cout: 0, hand: 0, bills: 0 };
  d.sales.forEach(function (s) { if (s.user === sh.username && s.payMode === 'cash') { var k = s.date + ' ' + (s.time || '00:00'); if (k >= from && k <= to) { f.cashSales += s.total; f.bills++; } } });
  d.sreturns.forEach(function (r) { if (r.user === sh.username && r.cash) { var k = r.date + ' ' + (r.time || '00:00'); if (k >= from && k <= to) f.refunds += r.total; } });
  d.cashmoves.forEach(function (m) { if (m.shiftId === sh.id) { if (m.kind === 'in') f.cin += m.amount; else if (m.kind === 'hand') f.hand += m.amount; else f.cout += m.amount; } });
  Object.keys(f).forEach(function (k) { f[k] = PD.r2(f[k]); });
  f.expected = PD.r2(sh.openCash + f.cashSales - f.refunds + f.cin - f.cout - f.hand); return f;
};
svc.lastClosingCash = function (userId) { var l = D().shifts.filter(function (s) { return s.status === 'closed'; }); return l.length ? l[l.length - 1].closeCash : 0; };
/* the drawer carries on from where the last shift ended - nothing to type at the start */
svc.drawerBalance = function () { var open = D().shifts.filter(function (s) { return s.status === 'open'; }); return open.length ? svc.shiftFigures(open[open.length - 1]).expected : svc.lastClosingCash(); };
svc.shiftStart = function (user, openCash) {
  if (svc.shiftOpen(user.id)) throw new Error('A shift is already open for ' + user.name);
  openCash = PD.num(openCash); if (openCash < 0) throw new Error('Cash cannot be negative');
  var sh = { id: PD.uid('sf'), userId: user.id, username: user.username, name: user.name, date: PD.today(), startKey: nowKey(), startAt: PD.nowTime(), openCash: openCash, status: 'open', endAt: '', endKey: '', closeCash: null, expected: 0, diff: 0, note: '' };
  D().shifts.push(sh); PD.log('Shift started', user.username + ' opening cash ' + PD.n2(openCash)); PD.save(); return sh;
};
svc.shiftClose = function (sh, closeCash, note) {
  if (sh.status !== 'open') throw new Error('This shift is already closed');
  closeCash = PD.num(closeCash); if (closeCash < 0) throw new Error('Cash cannot be negative');
  sh.endKey = nowKey(); sh.endAt = PD.nowTime(); var f = svc.shiftFigures(sh); sh.fig = f; sh.expected = f.expected; sh.closeCash = closeCash; sh.diff = PD.r2(closeCash - f.expected); sh.note = note || ''; sh.status = 'closed';
  PD.log('Shift closed', sh.username + ' counted ' + PD.n2(closeCash) + ' expected ' + PD.n2(f.expected) + ' diff ' + PD.n2(sh.diff)); PD.save(); return sh;
};
var KINDS = { 'in': 'Cash in (owner adds money)', exp: 'Cash out: expense paid from drawer', bank: 'Cash out: deposited in bank', own: 'Cash out: owner withdrawal', hand: 'Handed over to admin' };
svc.cashMove = function (o) {
  if (!PD.user || PD.user.role !== 'Admin') throw new Error('Only the admin can record cash in / out');
  var sh = D().shifts.find(function (s) { return s.id === o.shiftId; }); if (!sh || sh.status !== 'open') throw new Error('Choose an open drawer (shift)');
  var amt = PD.num(o.amount); if (!(amt > 0)) throw new Error('Enter the amount'); if (!KINDS[o.kind]) throw new Error('Choose the type');
  if (o.kind !== 'in' && amt > svc.shiftFigures(sh).expected + 0.005) throw new Error('The drawer only has ' + PD.n2(svc.shiftFigures(sh).expected) + ' right now');
  var vid = '', date = PD.today(), nm = o.reason || KINDS[o.kind];
  if (o.kind === 'in') vid = svc.voucher(date, 'Journal', 'Cash in: ' + nm, [{ acc: 'cash', dr: amt }, { acc: 'capital', cr: amt }], { kind: 'cashmove' }).id;
  else if (o.kind === 'exp') vid = svc.voucher(date, 'Journal', 'Cash expense: ' + nm, [{ acc: 'expense', dr: amt }, { acc: 'cash', cr: amt }], { kind: 'cashmove' }).id;
  else if (o.kind === 'bank') vid = svc.voucher(date, 'Journal', 'Cash deposited in bank', [{ acc: 'bank', dr: amt }, { acc: 'cash', cr: amt }], { kind: 'cashmove' }).id;
  else if (o.kind === 'own') vid = svc.voucher(date, 'Journal', 'Owner withdrawal: ' + nm, [{ acc: 'capital', dr: amt }, { acc: 'cash', cr: amt }], { kind: 'cashmove' }).id;
  var m = { id: PD.uid('cm'), shiftId: sh.id, kind: o.kind, amount: amt, reason: o.reason || '', at: nowKey(), by: PD.user.username, voucherId: vid };
  D().cashmoves.push(m); PD.log('Cash ' + o.kind, PD.n2(amt) + ' ' + (o.reason || '') + ' (' + sh.username + ')'); PD.save(); return m;
};

/* ---------- modals ---------- */
PD.shiftAuto = function (user) {
  user = user || PD.user; if (!user || svc.shiftOpen(user.id)) return null;
  var sh = svc.shiftStart(user, svc.drawerBalance()); PD.toast('Shift started. Drawer opens with ₹' + PD.n2(sh.openCash) + ' (carried over automatically)', 'ok'); if (PD.refreshAlerts) PD.refreshAlerts(); return sh;
};
PD.shiftCloseModal = function (done, forLogout) {
  var sh = svc.shiftOpen(PD.user.id); if (!sh) { if (done) done(); return; }
  var f = svc.shiftFigures(sh);
  var m = PD.modal({ title: 'Close your shift - ' + sh.name, size: 'md', sticky: true, body: '<table class="t" style="max-width:420px"><tbody><tr><td>Opening cash</td><td class="r">' + PD.n2(sh.openCash) + '</td></tr><tr><td>Cash sales (' + f.bills + ' bills)</td><td class="r">+ ' + PD.n2(f.cashSales) + '</td></tr><tr><td>Cash refunds (sales returns)</td><td class="r">- ' + PD.n2(f.refunds) + '</td></tr><tr><td>Cash in / out by admin</td><td class="r">+ ' + PD.n2(f.cin) + ' / - ' + PD.n2(f.cout + f.hand) + '</td></tr><tr><td><b>Cash that should be in the drawer</b></td><td class="r"><b>' + PD.n2(f.expected) + '</b></td></tr></tbody></table><div class="fld" style="margin-top:10px"><label>Cash in the drawer (₹) - calculated for you. If you counted and it is different, change it.</label><input class="in" id="cc" type="number" step="any" min="0" value="' + f.expected + '" autofocus></div><div id="df" style="margin:6px 0;font-weight:700"><span style="color:#2e8b57">Matches ✔</span></div><div class="fld"><label>Note (if there is a difference)</label><input class="in" id="cn"></div>',
    foot: [{ label: 'Stay logged in' }, { label: forLogout ? 'Close shift & log out' : 'Close shift', cls: 'p', fn: function (api) { try { var v = PD.$('#cc', api.body).value; if (v === '') throw new Error('Enter the cash in the drawer'); var s2 = svc.shiftClose(sh, v, PD.$('#cn', api.body).value); if (s2.diff !== 0 && !PD.$('#cn', api.body).value.trim()) { /* allowed, but flagged */ } PD.toast('Shift closed' + (s2.diff ? ' - difference ' + PD.n2(s2.diff) : ' - cash matches'), s2.diff ? 'err' : 'ok'); if (done) done(); } catch (e) { PD.err(e); return false; } } }] });
  var cc = PD.$('#cc', m.el); cc.oninput = function () { var d = PD.num(cc.value) - f.expected; PD.$('#df', m.el).innerHTML = cc.value === '' ? '' : (Math.abs(d) < 0.005 ? '<span style="color:#2e8b57">Matches ✔</span>' : '<span style="color:#c62828">' + (d > 0 ? 'Excess ' : 'Short ') + PD.n2(Math.abs(d)) + '</span>'); };
};
PD.shiftEnsure = function () {
  var u = PD.user; if (!u) return;
  var sh = svc.shiftOpen(u.id);
  if (sh && sh.date !== PD.today()) { PD.toast('Your earlier shift of ' + PD.fmtDate(sh.date) + ' was left open. Please close it first.', 'err'); PD.shiftCloseModal(function () { PD.shiftEnsure(); }); return; }
  if (!sh) PD.shiftAuto(u);
};

/* ---------- cash register screen ---------- */
PD.views.cashreg = { render: function (host, arg) {
  var d = D(), me = PD.user, admin = me.role === 'Admin', mine = svc.shiftOpen(me.id);
  function card(sh, title) {
    var f = svc.shiftFigures(sh);
    return '<div class="card" style="margin-bottom:8px"><div class="hd"><h3 style="padding:0;border:0">' + esc(title) + ' - ' + esc(sh.name) + ' (since ' + esc(sh.startAt) + ', ' + PD.fmtDate(sh.date) + ')</h3></div><div class="bd"><div class="grid g4"><div><div class="mut">Opening cash</div><b>' + PD.n2(sh.openCash) + '</b></div><div><div class="mut">Cash sales (' + f.bills + ')</div><b>' + PD.n2(f.cashSales) + '</b></div><div><div class="mut">Refunds</div><b>' + PD.n2(f.refunds) + '</b></div><div><div class="mut">Cash in / out</div><b>' + PD.n2(f.cin) + ' / ' + PD.n2(f.cout + f.hand) + '</b></div></div><div style="margin-top:8px;font-size:15px">Should be in drawer: <b>' + PD.n2(f.expected) + '</b></div></div></div>';
  }
  var open = d.shifts.filter(function (s) { return s.status === 'open' && (admin || s.userId === me.id); });
  host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Cash Register &amp; Shifts</b></div><div style="padding:8px 12px"><div class="drawerbig">Cash in drawer now (automatic): <b>₹' + PD.n2(svc.drawerBalance()) + '</b><small>opening + cash sales - refunds + cash in - cash out. Updates with every bill.</small></div>' +
    (open.length ? open.map(function (s) { return card(s, s.userId === me.id ? 'Your open shift' : 'Open drawer'); }).join('') : '<div class="card" style="margin-bottom:8px"><div class="bd">No shift is open. ' + (me ? '<button class="btn p" id="st">Start my shift</button> <span class="hint">The drawer carries on automatically from the last shift.</span>' : '') + '</div></div>') +
    '<div class="row" style="margin-bottom:8px">' + (mine ? '<button class="btn p" id="cl">Close my shift</button>' : '') + (admin ? '<button class="btn" id="mv">Cash in / out / handover (admin)</button>' : '') + '</div><div id="sl"></div></div></div>';
  var st = $('#st', host); if (st) st.onclick = function () { PD.shiftAuto(); PD.views.cashreg.render(host); };
  var cl = $('#cl', host); if (cl) cl.onclick = function () { PD.shiftCloseModal(function () { PD.views.cashreg.render(host); }); };
  var mv = $('#mv', host); if (mv && arg && arg.mv) setTimeout(function () { mv.click(); }, 50); if (mv) mv.onclick = function () {
    if (!open.length) { PD.toast('No drawer is open. Start a shift first.', 'err'); return; }
    var f = [{ k: 'shiftId', label: 'Drawer', type: 'select', options: open.map(function (s) { return [s.id, s.name + ' (since ' + s.startAt + ')']; }) }, { k: 'kind', label: 'Type', type: 'select', options: Object.keys(KINDS).map(function (k) { return [k, KINDS[k]]; }) }, { k: 'amount', label: 'Amount (₹)', type: 'number' }, { k: 'reason', label: 'Reason / note', full: true }];
    PD.modal({ title: 'Cash in / out', size: 'md', body: PD.formHTML(f, { kind: 'hand' }), foot: [{ label: 'Cancel' }, { label: 'Save', cls: 'p', fn: function (api) { try { svc.cashMove(PD.readForm(api.body, f)); PD.toast('Saved', 'ok'); PD.views.cashreg.render(host); } catch (e) { PD.err(e); return false; } } }] });
  };
  PD.report($('#sl', host), { id: 'cash-shifts', title: admin ? 'All shifts (who logged in, cash at start and end)' : 'My shifts',
    filters: [{ k: 'from', label: 'From', type: 'date', val: function () { return PD.addDays(PD.today(), -30); } }, { k: 'to', label: 'To', type: 'date', val: PD.today }].concat(admin ? [{ k: 'u', label: 'Staff', type: 'select', options: function () { return [['', 'Everyone']].concat(d.users.map(function (u) { return [u.id, u.name]; })); } }] : []),
    load: function (f) {
      var rows = d.shifts.filter(function (s) { return s.date >= f.from && s.date <= f.to && (admin ? (!f.u || s.userId === f.u) : s.userId === me.id); }).slice().reverse().map(function (s) { var fg = s.status === 'closed' ? s.fig : svc.shiftFigures(s); return { id: s.id, date: s.date, name: s.name, inAt: s.startAt, outAt: s.endAt || '(open)', open: s.openCash, sales: fg.cashSales, ref: fg.refunds, mv: PD.r2(fg.cin - fg.cout - fg.hand), exp: s.status === 'closed' ? s.expected : fg.expected, close: s.closeCash, diff: s.status === 'closed' ? s.diff : null, note: s.note }; });
      return { cols: [{ k: 'date', label: 'Date', fmt: PD.fmtDate }, { k: 'name', label: 'User', fmt: function (v) { return '<b>' + esc(v) + '</b>'; } }, { k: 'inAt', label: 'Login' }, { k: 'outAt', label: 'Logout' }, { k: 'open', label: 'Cash at start', align: 'r', fmt: PD.n2 }, { k: 'sales', label: 'Cash sales', align: 'r', sum: true, fmt: PD.n2 }, { k: 'ref', label: 'Refunds', align: 'r', sum: true, fmt: PD.n2 }, { k: 'mv', label: 'In / out', align: 'r', fmt: PD.n2 }, { k: 'exp', label: 'Should be', align: 'r', fmt: PD.n2 }, { k: 'close', label: 'Cash at end', align: 'r', fmt: function (v) { return v == null ? '—' : PD.n2(v); }, raw: function (r) { return r.close == null ? '' : r.close; } },
        { k: 'diff', label: 'Difference', align: 'r', sum: true, fmt: function (v) { return v == null ? '' : v === 0 ? '<span class="badge ok">OK</span>' : '<b style="color:#c62828">' + (v > 0 ? '+' : '') + PD.n2(v) + '</b>'; }, raw: function (r) { return r.diff == null ? '' : r.diff; } }, { k: 'note', label: 'Note' }], rows: rows, note: admin ? 'Click a row to see the cash moves or add your remark.' : '' };
    },
    drill: admin ? function (row) {
      var s = d.shifts.find(function (x) { return x.id === row.id; }), mv = d.cashmoves.filter(function (m) { return m.shiftId === s.id; });
      PD.modal({ title: s.name + ' • ' + PD.fmtDate(s.date), size: 'md', body: '<p>Login ' + esc(s.startAt) + ' • Logout ' + esc(s.endAt || 'still open') + '</p><table class="t"><thead><tr><th>Time</th><th>What</th><th class="r">Amount</th><th>By</th></tr></thead><tbody>' + (mv.map(function (m) { return '<tr><td>' + esc(m.at) + '</td><td>' + esc(KINDS[m.kind]) + (m.reason ? '<br><small>' + esc(m.reason) + '</small>' : '') + '</td><td class="r">' + PD.n2(m.amount) + '</td><td>' + esc(m.by) + '</td></tr>'; }).join('') || '<tr><td colspan="4"><div class="empty">No cash in/out in this shift.</div></td></tr>') + '</tbody></table><div class="fld" style="margin-top:10px"><label>Admin remark</label><input class="in" id="ar" value="' + esc(s.note || '') + '"></div>', foot: [{ label: 'Close' }, { label: 'Save remark', cls: 'p', fn: function (api) { s.note = PD.$('#ar', api.body).value; PD.log('Shift remark', s.username + ' ' + s.date); PD.save(); PD.views.cashreg.render(host); } }] });
    } : null });
} };
})();
