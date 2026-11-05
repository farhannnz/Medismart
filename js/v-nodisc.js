/* Discount-exempt medicines: no line discount, no share of the bill discount, no selling below MRP */
(function () {
'use strict';
var PD = window.PD, esc = PD.esc, svc = PD.svc, $ = PD.$;
function D() { return PD.DB; }

svc.setNoDisc = function (itemId, on) {
  var it = svc.item(itemId); if (!it) throw new Error('Medicine not found');
  if (PD.user && PD.user.role !== 'Admin' && !(PD.user.rights && PD.user.rights.masters)) throw new Error('Only the admin can change the discount-exempt list');
  if (!!it.noDisc === !!on) return it;
  if (on) it.noDisc = true; else delete it.noDisc;
  PD.log(on ? 'Discount exempt: added' : 'Discount exempt: removed', it.name); PD.save(); return it;
};

PD.views.nodisc = { render: function (host) {
  var d = D();
  host.innerHTML = '<div class="msw whw"><div class="msband"><span class="mslogo">' + PD.icon('pill') + '</span><b>Discount-Exempt Medicines</b></div><div style="padding:8px 12px">' +
    '<p class="hint" style="margin-bottom:8px">Medicines in this list can <b>never be discounted</b> at the counter: no discount on the line, they get no share of the overall bill discount, and they cannot be sold below MRP. Other medicines on the same bill still get the bill discount.</p>' +
    '<div class="row" style="margin-bottom:8px;gap:8px;align-items:center"><b>Add medicine:</b><input class="in" id="nds" placeholder="search any medicine and pick it..." autocomplete="off" style="max-width:380px"><span class="sp"></span><span class="hint" id="ndc"></span></div>' +
    '<div class="msgrid" style="margin:0;background:#fff;max-height:62vh"><table class="t"><thead><tr><th>Medicine</th><th>Manufacturer</th><th class="r">MRP</th><th class="r">In stock</th><th></th></tr></thead><tbody id="ndb"></tbody></table></div></div></div>';
  function list() {
    var sm = svc.stockMap(), rows = d.items.filter(function (i) { return i.noDisc; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    $('#ndb', host).innerHTML = rows.map(function (i) { return '<tr><td><b>' + esc(i.name) + '</b> ' + PD.schedBadge(i.schedule) + '<br><small class="mut">' + esc(i.generic || '') + '</small></td><td>' + esc(svc.mfrName(i.mfrId)) + '</td><td class="r">' + PD.n2(i.mrp) + '</td><td class="r">' + PD.qty(sm[i.id] || 0) + '</td><td class="r"><button class="btn sm d" data-rm="' + i.id + '">Remove</button></td></tr>'; }).join('') || '<tr><td colspan="5"><div class="empty">No medicine is exempt yet. Search above to add one.</div></td></tr>';
    $('#ndc', host).textContent = rows.length + ' medicine(s) exempt';
  }
  PD.combo($('#nds', host), { source: PD.itemSource({ stock: false }), onPick: function (x) { try { svc.setNoDisc(x.id, true); PD.toast(x.item.name + ' added: no discount allowed', 'ok'); } catch (e) { PD.err(e); } $('#nds', host).value = ''; list(); $('#nds', host).focus(); } });
  PD.on(host, 'click', '[data-rm]', function (e, t) { try { svc.setNoDisc(t.dataset.rm, false); list(); } catch (er) { PD.err(er); } });
  list();
} };
})();
