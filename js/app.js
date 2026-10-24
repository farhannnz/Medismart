/* PharmaDesk shell: boot, login, navigation, shortcuts, command palette */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$, $$ = PD.$$;

var NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'dash', 'F1']]],
  ['Sales', [['billing', 'Sales Billing', 'bill', 'F2'], ['salesret', 'Sales Returns', 'ret', '']]],
  ['Purchase', [['purchase', 'Purchase Invoice', 'cart', 'F4'], ['orders', 'Orders & Delivery', 'order', '']]],
  ['Inventory', [['stock', 'Stock & Batches', 'box', 'F5'], ['expiry', 'Expiry & Claims', 'clock', ''], ['explore', 'Product Explorer', 'explore', 'F6']]],
  ['Insights', [['reports', 'Reports', 'report', 'F7'], ['accounts', 'Accounts', 'book', 'F8']]],
  ['Setup', [['masters', 'Masters', 'users', ''], ['settings', 'Settings & Users', 'gear', '']]]
];
var TITLES = {}; NAV.forEach(function (g) { g[1].forEach(function (i) { TITLES[i[0]] = i[1]; }); });

function can(right) { var u = PD.user; if (!u) return false; if (right === 'attendance') return true; right = (typeof RIGHT !== 'undefined' && RIGHT[right]) || right; if (u.role === 'Admin') return true; return !!(u.rights && u.rights[right]); }
PD.can = can;
var RIGHT_OF = { settings: 'settings' };

/* ---------- theme ---------- */
PD.applyTheme = function () {
  var S = PD.DB.settings; document.documentElement.setAttribute('data-theme', S.theme || 'light'); document.documentElement.setAttribute('data-density', S.density || 'cozy');
  var a = S.accent || '#0e9f8e'; document.documentElement.style.setProperty('--brand', a);
  document.documentElement.style.setProperty('--brand-d', 'color-mix(in srgb, ' + a + ' 78%, #000)');
  document.documentElement.style.setProperty('--brand-l', 'color-mix(in srgb, ' + a + ' 16%, var(--card))');
};

/* ---------- boot ---------- */
function boot() {
  PD.load().then(function (db) {
    if (db && db.v) { PD.DB = db; migrate(); }
    else { PD.DB = PD.blank(); try { PD.seed(); } catch (e) { console.error('seed', e); } migrate(); PD.flush(); }
    PD.applyTheme();
    var uid = sessionStorage.getItem('pd_user');
    PD.user = uid ? PD.DB.users.find(function (u) { return u.id === uid && u.active !== false; }) : null;
    if (PD.user) { shell(); landing(false); } else loginScreen();
  });
}
function migrate() {
  var B = PD.blank(), D = PD.DB;
  Object.keys(B).forEach(function (k) { if (D[k] === undefined) D[k] = B[k]; });
  Object.keys(B.settings).forEach(function (k) { if (D.settings[k] === undefined) D.settings[k] = B.settings[k]; });
  svc.currentYear(); svc.warehouse(); svc.seedWarehouse();
  /* roles: exactly one Admin (the shop owner) + staff */
  D.users = D.users.filter(function (u) { return u.role !== 'Warehouse'; });
  if (D.demo && !D.users.some(function (u) { return u.username === 'staff'; })) D.users.push({ id: 'u_st', name: 'Counter Staff', username: 'staff', pass: PD.hash('staff'), role: 'Staff', rights: { dashboard: true, billing: true, salesret: true, explore: true, requests: true, expiry: true }, active: true });
}

/* ---------- login ---------- */
function loginScreen() {
  var demo = PD.DB.demo && PD.DB.users.length === 1 && PD.DB.users[0].pass === PD.hash('admin');
  document.body.innerHTML = '<div class="login"><div class="card box"><div class="brand" style="padding:0;color:var(--ink)"><span class="lg">' + PD.icon('pill') + '</span><b>PharmaDesk</b></div><h1>Welcome back</h1><p class="mut">Sign in to your pharmacy workspace.</p><br>' +
    '<div class="fld"><label>Username</label><input class="in" id="lu" autocomplete="username" autofocus></div><div class="fld" style="margin-top:12px"><label>Password</label><input class="in" id="lp" type="password" autocomplete="current-password"></div>' +
    '<p id="le" style="color:var(--bad);min-height:20px;margin:8px 0 0"></p><button class="btn p lg" id="lb" style="width:100%;margin-top:6px">Sign in</button>' +
    (demo ? '<p class="hint" style="margin-top:14px">Demo data is loaded. Sign in with <b>admin</b> / <b>admin</b>, then change the password in Settings.</p>' : '') + '</div></div>';
  function go() {
    var u = PD.DB.users.find(function (x) { return x.username.toLowerCase() === $('#lu').value.trim().toLowerCase() && x.active !== false; });
    if (!u || u.pass !== PD.hash($('#lp').value)) { $('#le').textContent = 'Wrong username or password.'; return; }
    PD.user = u; sessionStorage.setItem('pd_user', u.id); PD.log('Signed in'); if (PD.DB.settings.autoPunch) svc.punchIn(u); PD.save(); shell(); landing(true);
  }
  $('#lb').onclick = go; $('#lp').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); $('#lu').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#lp').focus(); });
}
PD.logout = function () { if (PD.user && PD.DB.settings.autoPunch) svc.punchOut(PD.user); PD.log('Signed out'); PD.save(); sessionStorage.removeItem('pd_user'); PD.user = null; loginScreen(); };

/* ---------- shell: classic MDI desktop (menu bar, toolbar, window tabs, docked lists, status bar) ---------- */
var MENUS = [
  ['File', [
    ['New Sale Bill', 'billing', { fresh: 1 }, 'F2'], ['New Purchase Invoice', 'purchase', { tab: 'new' }, 'F4'], '-',
    ['Accounting Year', 'accounts', { tab: 'year' }], ['Backup && Restore', 'settings', { tab: 'data' }], ['Activity Log', 'settings', { tab: 'log' }], '-', ['Attendance (Punch In / Out)', 'attendance'], '-',
    ['Change User', 'logout'], ['Exit', 'logout']]],
  ['Create', [
    ['Item', 'itemdlg'], ['Manufacturer', 'masters', { tab: 'mfrs' }], ['Supplier', 'masters', { tab: 'suppliers' }], ['Customer', 'masters', { tab: 'customers' }], ['Doctor', 'masters', { tab: 'doctors' }], '-',
    ['Account Details', 'acctdlg'], ['Manufacturer Offer', 'masters', { tab: 'offers' }], '-',
    ['Receipt Voucher', 'accounts', { tab: 'ledger', voucher: 'receipt' }], ['Payment Voucher', 'accounts', { tab: 'ledger', voucher: 'payment' }], ['Journal Voucher', 'accounts', { tab: 'ledger', voucher: 'journal' }]]],
  ['List', [
    ['Item List', 'masters', { tab: 'items' }], ['Manufacturer List', 'masters', { tab: 'mfrs' }], ['Suppliers List', 'masters', { tab: 'suppliers' }], ['Customer List', 'masters', { tab: 'customers' }], ['Doctor List', 'masters', { tab: 'doctors' }], ['Account List', 'accounts', { tab: 'heads' }], '-',
    ['Invoice List', 'purchase', { tab: 'list' }], ['Sales Register', 'reports', { report: 'sales-reg' }]]],
  ['Order', [
    ['Stock Request to Warehouse', 'request', null, 'F3'], ['Auto Fill Request (reorder)', 'request', { auto: 1 }], ['Request Status / List', 'reqlist'], '-',
    ['Reorder List', 'reports', { report: 'reorder' }], ['Manufacturer Offers', 'masters', { tab: 'offers' }], '-',
    ['Purchase Order (direct supplier)', 'orders', { tab: 'po' }, '', 'direct'], ['Auto Create Order (direct supplier)', 'orders', { tab: 'auto' }, '', 'direct']]],
  ['Purchase', [
    ['Receive Stock from Warehouse', 'receive', null, 'F4'], ['Purchase Return (to Warehouse)', 'purchase', { tab: 'ret' }], ['Warehouse Account (what we owe)', 'accounts', { tab: 'ledger', acc: 'sup_wh' }], '-',
    ['Purchase Invoice (direct supplier)', 'purchase', { tab: 'new' }, '', 'direct'], ['Delivery Note (direct supplier)', 'dnote', null, '', 'direct'], '-',
    ['Purchase Report - Invoice wise', 'reports', { report: 'pur-reg' }], ['Purchase Report - Item wise', 'reports', { report: 'pur-item' }], ['Purchase Tax Report', 'reports', { report: 'pur-tax' }], ['Warehouse wise Purchases', 'reports', { report: 'pur-sup' }]]],
  ['Sale', [
    ['Sales Bill', 'billing', { fresh: 1 }, 'F2'], ['Sales Return', 'salesret'], ['Customer History', 'custhist'], '-',
    ['Sales e-file', 'reports', { report: 'sales-reg' }], ['Items Sold', 'reports', { report: 'sales-item' }], ['Sales Tax Report', 'reports', { report: 'sales-tax' }], ['Daily Sales Voucher', 'reports', { report: 'sales-day' }],
    ['Doctor wise Sales', 'reports', { report: 'sales-doc' }], ['Customer wise Sales', 'reports', { report: 'sales-cus' }], ['Schedule H/H1/X Register', 'reports', { report: 'sched-reg' }]]],
  ['Stock', [
    ['Current Stock', 'stock', { tab: 'list' }, 'F5'], ['Opening Stock', 'stock', { tab: 'open' }], ['Batch Edit', 'batchedit'], ['Stock Statement', 'stock', { tab: 'flow' }], '-',
    ['Expiry Watch', 'expiry', { tab: 'watch' }], ['Expiry Transfer', 'expiry', { tab: 'dmg' }], ['Expiry Claim', 'expclaim'], ['Supplier Claims (list)', 'expiry', { tab: 'claims' }], ['Expiry Report', 'reports', { report: 'expiry-rep' }], '-',
    ['Fast && Slow Moving', 'reports', { report: 'moving' }], ['Item Stock Flow', 'reports', { report: 'flow-item' }]]],
  ['Accounts', [
    ['Ledger', 'accounts', { tab: 'ledger' }, 'F8'], ['Day Book', 'accounts', { tab: 'daybook' }], ['Trial Balance', 'accounts', { tab: 'tb' }], ['Profit && Loss / Balance Sheet', 'accounts', { tab: 'pnl' }], ['Receivables && Payables', 'accounts', { tab: 'dues' }], '-',
    ['Account Heads', 'accounts', { tab: 'heads' }], ['New Accounting Year', 'accounts', { tab: 'year' }], '-',
    ['Customer Outstanding', 'reports', { report: 'recv' }], ['Supplier Outstanding', 'reports', { report: 'pay' }], ['Profit Report (month)', 'reports', { report: 'profit-month' }]]],
  ['View', [
    ['Dashboard', 'dashboard', null, 'F1'], ['Explorer View', 'explore', null, 'F6'], '-',
    ['Item List Panel', 'dock:items'], ['Manufacturer List Panel', 'dock:mfrs'], ['Suppliers List Panel', 'dock:sups'], ['Messages Panel', 'dock:msg'], '-',
    ['Toolbar', 'toggle:toolbar'], ['Status Bar', 'toggle:status'], ['Dark Mode', 'toggle:dark']]],
  ['Navigate', [
    ['Home', 'home'], ['Previous Window', 'nav:-1', null, 'Ctrl+←'], ['Next Window', 'nav:1', null, 'Ctrl+→'], ['Close Window', 'closecur', null, 'Ctrl+W'], '-', ['Find Anything...', 'palette', null, 'Ctrl+I']]],
  ['Tools', [
    ['Reports', 'reports', null, 'F7'], ['Attendance Register', 'attendance'], ['Options', 'settings', { tab: 'shop' }], ['Appearance', 'settings', { tab: 'look' }], ['Users && Rights', 'settings', { tab: 'users' }], ['Backup && Data', 'settings', { tab: 'data' }]]],
  ['Window', [['Close All Windows', 'closeall'], ['Close Other Windows', 'closeother'], '-', ['%wins']]],
  ['Help', [['Help && Shortcuts', 'settings', { tab: 'help' }], ['Find Anything...', 'palette'], '-', ['About PharmaDesk', 'about']]]
];
/* toolbar: [title, icon, action, colour] */
var TOOLS = [
  ['Save (Ctrl+S)', 'check', 'save', '#2f6fb3'], ['Clear', 'x', 'clear', '#e0a100'], ['Close window', 'x', 'closecur', '#c62828'], ['Lock / Log out', 'lock', 'logout', '#7a8a2e'], '|',
  ['Sales bill (F2)', 'bill', 'billing', '#2e8b57'], ['Sales return', 'ret', 'salesret', '#c77d00'], ['Receive stock (F4)', 'cart', 'receive', '#7b5ea7'], ['Stock request (F3)', 'order', 'request', '#1e88a8'], ['Stock (F5)', 'box', 'stock', '#8a5a2b'],
  ['Expiry & claims', 'clock', 'expiry', '#d9534f'], '|',
  ['Item master', 'pill', 'itemdlg', '#2f6fb3'], ['Supplier master', 'users', 'masters:suppliers', '#2e8b57'], ['Customer master', 'users', 'masters:customers', '#c77d00'], ['Account details', 'book', 'acctdlg', '#7b5ea7'], '|',
  ['Reports (F7)', 'report', 'reports', '#1e88a8'], ['Day book', 'book', 'accounts:daybook', '#8a5a2b'], ['Ledger (F8)', 'book', 'accounts:ledger', '#2f6fb3'], ['Explorer view (F6)', 'explore', 'explore', '#2e8b57'], ['Attendance', 'users', 'attendance', '#2e8b57'], ['Settings', 'gear', 'settings', '#666']
];
var TITLES = {}; NAV.forEach(function (g) { g[1].forEach(function (i) { TITLES[i[0]] = i[1]; }); }); TITLES.home = 'PharmaDesk'; TITLES.dnote = 'Delivery Note'; TITLES.batchedit = 'Batch Edit'; TITLES.expclaim = 'ExpiryClaim'; TITLES.itemdlg = 'Item'; TITLES.acctdlg = 'Account Details'; TITLES.request = 'Stock Request'; TITLES.reqlist = 'Request List'; TITLES.receive = 'Receive Stock'; TITLES.attendance = 'Attendance'; TITLES.custhist = 'Customer History';
var RIGHT = { dnote: 'orders', batchedit: 'stock', expclaim: 'expiry', itemdlg: 'masters', acctdlg: 'accounts', request: 'requests', reqlist: 'requests', receive: 'requests', custhist: 'billing' };
var wins = [], cur = 'home', docks = { items: true, mfrs: false, sups: false, msg: true }, ui = { toolbar: true, status: true };
PD.go = function (route, arg) { openWin(route, arg); };

function wkey(route, arg) { return route + ':' + ((arg && (arg.tab || arg.report)) || ''); }
function wtitle(route, arg) {
  var name = (arg && arg.title) || null;
  if (!name) MENUS.forEach(function (m) { m[1].forEach(function (it) { if (it !== '-' && it[1] === route && it[2] && arg && ((it[2].tab && it[2].tab === arg.tab) || (it[2].report && it[2].report === arg.report))) name = name || it[0].replace(/&&/g, '&'); }); });
  return name || TITLES[route] || route;
}
function openWin(route, arg) {
  if (route === 'logout') return PD.logout();
  if (route === 'home') { cur = 'home'; return renderWin(); }
  if (!PD.views[route]) route = 'dashboard';
  if (!can(RIGHT[route] || route)) { PD.toast && PD.toast('You do not have access to ' + (TITLES[route] || route), 'err'); return; }
  var key = wkey(route, arg), w = wins.find(function (x) { return x.key === key; });
  if (!w) { w = { key: key, route: route, arg: arg || null, title: wtitle(route, arg) }; wins.push(w); } else if (arg) w.arg = arg;
  cur = key; renderWin();
}
function closeWin(key) {
  var i = wins.findIndex(function (x) { return x.key === key; }); if (i < 0) return;
  wins.splice(i, 1);
  if (cur === key) cur = wins.length ? wins[Math.min(i, wins.length - 1)].key : 'home';
  renderWin();
}
function act(a) {
  if (!a) return;
  var m;
  if (a === 'palette') return palette();
  if (a === 'closecur') return cur === 'home' ? 0 : closeWin(cur);
  if (a === 'closeall') { wins = []; cur = 'home'; return renderWin(); }
  if (a === 'closeother') { wins = wins.filter(function (w) { return w.key === cur; }); return renderWin(); }
  if (a === 'about') return PD.modal({ title: 'About PharmaDesk', size: 'sm', body: '<p><b>PharmaDesk</b> - pharmacy billing, stock keeping &amp; accounting.</p><p class="mut">Data is stored in this browser. Use File → Backup &amp; Restore regularly.</p>', foot: [{ label: 'OK', cls: 'p' }] });
  if (a === 'save') { var b = $('#view .btn.p:not(:disabled)'); return b && b.click(); }
  if (a === 'clear') { var w = wins.find(function (x) { return x.key === cur; }); if (w) { w.arg = { fresh: 1, tab: w.arg && w.arg.tab }; renderWin(); } return; }
  if ((m = /^nav:(-?1)$/.exec(a))) { var ks = ['home'].concat(wins.map(function (w) { return w.key; })), i = ks.indexOf(cur); cur = ks[(i + (+m[1]) + ks.length) % ks.length]; return renderWin(); }
  if ((m = /^dock:(\w+)$/.exec(a))) { docks[m[1]] = !docks[m[1]]; return drawDocks(); }
  if ((m = /^toggle:(\w+)$/.exec(a))) {
    if (m[1] === 'dark') { PD.DB.settings.theme = PD.DB.settings.theme === 'dark' ? 'light' : 'dark'; PD.applyTheme(); PD.save(); return; }
    ui[m[1]] = !ui[m[1]]; document.body.classList.toggle('no-' + m[1], !ui[m[1]]); return;
  }
  var p = a.split(':'); openWin(p[0], p[1] ? { tab: p[1] } : null);
}
function shell() {
  var tb = TOOLS.filter(function (t) { return t === '|' || can(t[2].split(':')[0]) || ACTION_RX.test(t[2]) || t[2] === 'save' || t[2] === 'clear'; }).map(function (t) { return t === '|' ? '<i class="tsep"></i>' : '<button class="tbtn" title="' + esc(t[0]) + '" data-a="' + t[2] + '" style="color:' + t[3] + '">' + PD.icon(t[1]) + '</button>'; }).join('');
  document.body.className = 'mdi';
  document.body.innerHTML = '<div class="win"><div class="titlebar"><span class="ico">' + PD.icon('pill') + '</span><b>' + esc(PD.DB.shop.name) + '</b><span>Software Registered to ' + esc(PD.DB.shop.name) + '</span><span id="dbt"></span><span class="sp"></span><span class="wc">—&nbsp;&nbsp;▢&nbsp;&nbsp;✕</span></div>' +
    '<div class="menubar" id="mbar"></div><div class="toolbar" id="tbar">' + tb + '<span class="sp"></span><div class="msearch">' + PD.icon('search') + '<input id="gsr" placeholder="Search (Ctrl+I)" readonly></div></div>' +
    '<div class="mdi-body"><div class="lstrip" id="lstrip"><button data-a="explore">ExplorerView</button><button data-a="stock:batch">Batch</button></div>' +
    '<div class="mdi-main"><div class="wtabs" id="wtabs"></div><main class="view" id="view"></main></div><div class="docks" id="docks"></div></div>' +
    '<div class="statusbar" id="sbar"><span id="rc"></span><span class="sp"></span><span id="bell" class="bell" title="Alerts"></span><span class="usr">' + PD.icon('users') + esc(PD.user.name) + '</span><b class="plog">Pharma<em>Desk</em></b><span id="clk"></span></div></div>';
  var yr = svc.currentYear();
  $('#dbt').textContent = 'DB:Account Accounting Year:' + PD.fmtDate(yr.start).replace(/-/g, '/') + ' - ' + PD.fmtDate(yr.end).replace(/-/g, '/');
  drawMenus(); drawDocks();
  $('#gsr').onclick = palette;
  PD.on($('#tbar'), 'click', '[data-a]', function (e, t) { act(t.dataset.a); });
  PD.on($('#lstrip'), 'click', '[data-a]', function (e, t) { act(t.dataset.a); });
  PD.on($('#wtabs'), 'click', '[data-k]', function (e, t) { if (e.target.closest('[data-x]')) { closeWin(t.dataset.k); return; } cur = t.dataset.k; renderWin(); });
  $('#bell').onclick = function () { docks.msg = true; drawDocks(); }; tick(); if (!PD.clock) PD.clock = setInterval(tick, 20000);
  renderWin();
}
function landing(fresh) {
  wins = []; cur = 'home';
  if (fresh) { var a = PD.alerts().filter(function (x) { return x.lvl !== 'info'; }); if (a.length && PD.toast) PD.toast('🔔 ' + a.length + ' alert' + (a.length > 1 ? 's' : '') + ': ' + a[0].text + (a.length > 1 ? ' …see Messages panel' : ''), a[0].lvl === 'bad' ? 'err' : ''); }
}
PD.refreshAlerts = function () { var n = PD.alerts(), b = $('#bell'); if (b) { var hot = n.filter(function (x) { return x.lvl !== 'info'; }).length; b.textContent = '🔔 ' + n.length; b.className = 'bell' + (hot ? ' hot' : ''); } if (docks.msg) fillDock('msg', ''); };
function tick() { var c = $('#clk'); if (c) { var d = new Date(); c.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US'); } }
var ACTION_RX = /^(dock|toggle|nav|closecur|closeall|closeother|palette|about|home|logout)/;
function okItem(it) { if (it === '-' || it[0] === '%wins') return true; if (it[4] === 'direct' && !PD.DB.settings.allowDirect) return false; if (ACTION_RX.test(it[1])) return true; return can(it[1]); }
function menuItems(i) { var a = MENUS[i][1].map(function (it, n) { return { it: it, n: n }; }).filter(function (x) { return okItem(x.it); }), out = []; a.forEach(function (x) { if (x.it === '-' && (!out.length || out[out.length - 1].it === '-')) return; out.push(x); }); while (out.length && out[out.length - 1].it === '-') out.pop(); return out; }
function drawMenus() {
  var bar = $('#mbar'), openI = -1;
  bar.innerHTML = MENUS.map(function (m, i) { return menuItems(i).some(function (x) { return x.it !== '-'; }) ? '<div class="mi" data-i="' + i + '"><span>' + m[0].replace(/^(.)/, '<u>$1</u>') + '</span><div class="mdd"></div></div>' : ''; }).join('');
  function fill(i) {
    var dd = bar.querySelector('.mi[data-i="' + i + '"] .mdd'), h = '';
    menuItems(i).forEach(function (x) { var it = x.it, n = x.n;
      if (it === '-') { h += '<hr>'; return; }
      if (it[0] === '%wins') { h += wins.length ? wins.map(function (w, k) { return '<a data-w="' + w.key + '">' + (k + 1) + ' ' + esc(w.title) + (w.key === cur ? ' ✓' : '') + '</a>'; }).join('') : '<a class="dis">(no open windows)</a>'; return; }
      h += '<a data-n="' + n + '">' + esc(it[0].replace(/&&/g, '&')) + (it[3] ? '<kbd>' + it[3] + '</kbd>' : '') + '</a>';
    });
    dd.innerHTML = h;
  }
  function show(i) { openI = i; $$('.mi', bar).forEach(function (el) { el.classList.toggle('on', +el.dataset.i === i); }); if (i >= 0) fill(i); }
  bar.addEventListener('mousedown', function (e) { var mi = e.target.closest('.mi'); if (!mi) return; var a = e.target.closest('a'); if (a && !a.classList.contains('dis')) { e.preventDefault(); var i = +mi.dataset.i; if (a.dataset.w) { cur = a.dataset.w; renderWin(); } else runItem(MENUS[i][1][+a.dataset.n]); show(-1); return; } show(openI === +mi.dataset.i ? -1 : +mi.dataset.i); });
  bar.addEventListener('mouseover', function (e) { var mi = e.target.closest('.mi'); if (mi && openI >= 0 && +mi.dataset.i !== openI) show(+mi.dataset.i); });
  document.addEventListener('mousedown', function (e) { if (!e.target.closest || !e.target.closest('#mbar')) show(-1); });
}
function runItem(it) { if (/^(dock|toggle|nav|closecur|closeall|closeother|palette|about)/.test(it[1])) act(it[1]); else openWin(it[1], it[2] || null); }
function drawDocks() {
  var host = $('#docks'); if (!host) return;
  var D = PD.DB, order = ['items', 'mfrs', 'sups', 'msg'].filter(function (k) { return docks[k]; });
  host.classList.toggle('hide', !order.length);
  host.innerHTML = order.map(function (k) {
    var t = { items: 'Item List', mfrs: 'Manufacturer List', sups: 'Suppliers List', msg: 'Messages' }[k];
    return '<section class="dock" data-d="' + k + '"><div class="dh"><b>' + t + '</b><button data-x title="Close">✕</button></div><div class="dtool">' + (k === 'msg' ? '' : '<input class="dq" placeholder="search" data-q="' + k + '">') + '</div><div class="dbody" data-b="' + k + '"></div></section>';
  }).join('');
  order.forEach(function (k) { fillDock(k, ''); });
  PD.on(host, 'click', '[data-x]', function (e, t) { docks[t.closest('.dock').dataset.d] = false; drawDocks(); });
  PD.on(host, 'input', '[data-q]', function (e, t) { fillDock(t.dataset.q, t.value); });
  PD.on(host, 'click', '[data-item]', function (e, t) { openWin('explore', { itemId: t.dataset.item, title: 'Explorer View' }); });
  PD.on(host, 'dblclick', '[data-item]', function (e, t) { openWin('billing', { itemId: t.dataset.item, title: 'Sales Bill' }); });
  PD.on(host, 'click', '[data-al]', function (e, t) { var x = fillDock.alerts[+t.dataset.al]; if (x && x.go) openWin(x.go[0], x.go[1] || null); });
  PD.on(host, 'click', '[data-m]', function (e, t) { openWin('masters', { tab: t.dataset.m }); });
}
function fillDock(k, q) {
  var el = $('[data-b="' + k + '"]'); if (!el) return; q = q.toLowerCase(); var D = PD.DB, h;
  if (k === 'items') {
    var sm = svc.stockMap(), rows = D.items.filter(function (i) { return !q || (i.name + ' ' + i.generic).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 300);
    h = '<table class="gt"><thead><tr><th style="width:38px">ID</th><th>Item Name</th></tr></thead><tbody>' + rows.map(function (i) { return '<tr data-item="' + i.id + '" class="' + (sm[i.id] > 0 ? '' : 'nostock') + '"><td>' + PD.itemNo(i.id) + '</td><td>' + (sm[i.id] > 0 ? '' : '# ') + esc(i.name) + '</td></tr>'; }).join('') + '</tbody></table>';
  } else if (k === 'mfrs') {
    h = '<table class="gt"><thead><tr><th>Manufacturer</th><th style="width:44px">Abbre.</th></tr></thead><tbody>' + D.mfrs.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0; }).map(function (m) { return '<tr data-m="mfrs"><td>' + esc(m.name) + '</td><td>' + esc(m.short || m.name.slice(0, 3)) + '</td></tr>'; }).join('') + '</tbody></table>';
  } else if (k === 'sups') {
    h = '<table class="gt"><thead><tr><th>Supplier Name</th></tr></thead><tbody>' + D.suppliers.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0; }).map(function (m) { return '<tr data-m="suppliers"><td>' + esc(m.name) + '</td></tr>'; }).join('') + '</tbody></table>';
  } else {
    var al = PD.alerts(); h = '<div class="msgp"><div class="msgh">Hello, ' + esc(PD.user.name) + '</div>' + (al.length ? al.map(function (x, i) { return '<div class="al ' + x.lvl + '" data-al="' + i + '">' + PD.icon(x.icon || 'alert') + '<span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="al ok">✔ All clear. No alerts.</div>') + '</div>'; fillDock.alerts = al;
  }
  el.innerHTML = h;
}
function renderWin() {
  var host = $('#view'); if (!host) return;
  var fresh = host.cloneNode(false); host.parentNode.replaceChild(fresh, host); host = fresh;
  $('#wtabs').innerHTML = '<div class="wt ' + (cur === 'home' ? 'on' : '') + '" data-k="home"><span class="wi">' + PD.icon('pill') + '</span>' + esc((PD.DB.shop.name || 'home').split(' ')[0]) + '</div>' +
    wins.map(function (w) { return '<div class="wt ' + (w.key === cur ? 'on' : '') + '" data-k="' + esc(w.key) + '"><span class="wi">' + PD.icon('report') + '</span>' + esc(w.title) + '<i data-x>✕</i></div>'; }).join('');
  var w = wins.find(function (x) { return x.key === cur; });
  $$('#lstrip button').forEach(function (b) { b.classList.remove('on'); });
  if (!w) {
    host.innerHTML = '<div class="homebg"><div class="wm"><div class="wm1">' + PD.icon('pill') + 'Pharma<em>Desk</em></div><div class="wm2">' + esc(PD.DB.shop.name) + '</div><div class="wm3">pharmacy billing • stock keeping • accounting</div></div></div>';
    var rc = $('#rc'); if (rc) rc.textContent = ''; return;
  }
  host.innerHTML = '';
  var arg = w.arg; w.arg = arg && arg.fresh ? Object.assign({}, arg, { fresh: 0 }) : arg;
  try { PD.views[w.route].render(host, arg); } catch (e) { console.error(e); host.innerHTML = '<div class="card"><div class="bd"><h3>Something went wrong</h3><p class="mut">' + esc(e.message) + '</p></div></div>'; }
  var tr = host.querySelectorAll('table.t tbody tr').length, rc2 = $('#rc'); if (rc2) rc2.textContent = tr ? 'Row count : ' + tr : '';
  host.scrollTop = 0; if (PD.refreshAlerts) PD.refreshAlerts();
}
function render() { renderWin(); }

/* ---------- keyboard ---------- */
var FKEYS = { F1: 'dashboard', F2: 'billing', F3: 'request', F4: 'receive', F5: 'stock', F6: 'explore', F7: 'reports', F8: 'accounts' };
addEventListener('keydown', function (e) {
  if (!PD.user) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); palette(); return; }
  if (e.ctrlKey && e.key === 'ArrowRight') { act('nav:1'); return; } if (e.ctrlKey && e.key === 'ArrowLeft') { act('nav:-1'); return; }
  if (FKEYS[e.key] && !e.ctrlKey && !e.altKey) { e.preventDefault(); PD.go(FKEYS[e.key]); }
  if (PD.hotkeys && PD.hotkeys[e.key] && !PD.$('.ov')) { var f = PD.hotkeys[e.key]; if (document.body.contains(f.el)) { e.preventDefault(); f.fn(e); } }
});

/* ---------- command palette ---------- */
function palette() {
  if ($('.pal')) return;
  var cmds = [];
  NAV.forEach(function (g) { g[1].forEach(function (i) { if (can(i[0])) cmds.push({ t: 'Go to ' + i[1], icon: i[2], fn: function () { PD.go(i[0]); }, k: i[1] }); }); });
  cmds.push({ t: 'New sale bill', icon: 'bill', fn: function () { PD.go('billing', { fresh: 1 }); }, k: 'new sale bill billing' });
  cmds.push({ t: 'New purchase invoice', icon: 'cart', fn: function () { PD.go('purchase', { fresh: 1 }); }, k: 'new purchase invoice' });
  cmds.push({ t: 'Toggle dark mode', icon: 'moon', fn: function () { act('toggle:dark'); }, k: 'dark light theme mode' });
  PD.DB.items.forEach(function (it) { cmds.push({ t: it.name + ' — ' + it.generic, icon: 'pill', fn: function () { PD.go('explore', { itemId: it.id }); }, k: (it.name + ' ' + it.generic).toLowerCase(), sub: 'Product' }); });
  var ov = PD.el('<div class="ov" style="align-items:start;padding-top:12vh"><div class="pal"><input placeholder="Type a command, page or medicine..." autofocus><ul></ul></div></div>'), inp = $('input', ov), ul = $('ul', ov), idx = 0, list = [];
  function draw() {
    var q = inp.value.trim().toLowerCase(); list = cmds.filter(function (c) { return !q || (c.t + ' ' + c.k).toLowerCase().indexOf(q) >= 0 || q.split(/\s+/).every(function (w) { return (c.t + ' ' + c.k).toLowerCase().indexOf(w) >= 0; }); }).slice(0, 14);
    ul.innerHTML = list.map(function (c, i) { return '<li class="' + (i === idx ? 'on' : '') + '" data-i="' + i + '">' + PD.icon(c.icon) + '<span>' + esc(c.t) + '</span>' + (c.sub ? '<span class="badge" style="margin-left:auto">' + c.sub + '</span>' : '') + '</li>'; }).join('') || '<li class="mut">No matches</li>';
  }
  function close() { ov.remove(); }
  inp.addEventListener('input', function () { idx = 0; draw(); });
  inp.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, list.length - 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); } else if (e.key === 'Enter' && list[idx]) { close(); list[idx].fn(); } else if (e.key === 'Escape') close(); });
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
  ul.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) { var c = list[+li.dataset.i]; close(); c.fn(); } });
  document.body.appendChild(ov); draw(); inp.focus();
}
PD.palette = palette;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
