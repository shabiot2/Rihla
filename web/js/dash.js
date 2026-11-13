/* dash.js — the home dashboard: the «where am I» location card (works offline from the built-in Kingdom map),
   and the map card size — compact on the dashboard, big on demand or automatically while navigating. */
(function () {
  'use strict';
  var D = App.dash = { autoBig: false };

  function setBig(on, save) {
    document.body.classList.toggle('map-big', !!on);
    var b = App.$('btnBig');
    if (b) b.innerHTML = App.icon(on ? 'shrink' : 'expand');
    if (save) { App.settings.mapBig = !!on; App.saveSettings(); }
    if (App.map && App.map.resize) setTimeout(App.map.resize, 0);
    if (App.radio && App.radio.ui) App.radio.ui();
    var ctx = App.$('ctxMenu');
    if (ctx) ctx.classList.add('hidden');
  }
  D.setBig = setBig;
  D.isBig = function () { return document.body.classList.contains('map-big'); };
  // navigation enlarges the map; when it ends the dashboard comes back (unless the user chose the big map)
  D.navBig = function (on) {
    if (on) { if (!D.isBig()) { D.autoBig = true; setBig(true, false); } }
    else if (D.autoBig) { D.autoBig = false; setBig(!!App.settings.mapBig, false); }
  };

  function txt(id, v) { var el = App.$(id); if (el && el._v !== v) { el._v = v; el.textContent = v; } }
  function info() {
    var f = App.loc.fix, now = Date.now(), fresh = f && now - f.t < 15000;
    var tag = App.$('icNet');
    tag.textContent = App.offline ? 'بدون نت' : 'متصل';
    tag.className = 'w-tag ' + (App.offline ? 'warn' : 'ok');
    var sat = App.loc.sats && now - App.loc.sats.t < 15000 ? App.loc.sats : null;
    txt('icSat', sat ? App.d(sat.used) + '/' + App.d(sat.total) : '—');
    var lim = App.$('gLim');
    lim.textContent = App.settings.speedAlert ? 'تنبيه فوق ' + App.d(App.settings.speedLimit) : 'تنبيه السرعة مطفأ';
    lim.className = 'w-tag' + (App.settings.speedAlert ? ' ok' : '');
    if (!f) {
      txt('icLL', ' ');
      txt('icPlace', 'جارٍ تحديد الموقع…');
      txt('icSub', sat ? 'يرى ' + App.d(sat.total) + ' قمر — ينتظر الإشارة' : 'تأكد إن هوائي GPS موصول بالشاشة');
      txt('icDir', '—'); txt('icAlt', '—'); txt('icAcc', '—');
      return;
    }
    var w = App.base && App.base.ready ? App.base.where(f.lat, f.lon) : null, title, sub;
    if (w && (w.district || w.cityName || w.region)) {
      title = w.district || ((w.near ? 'قرب ' : '') + (w.cityName || w.region));
      sub = [w.district ? w.cityName : null, w.region].filter(Boolean).join(' • ');
    } else {
      title = App.ll(f.lat, f.lon);
      sub = App.base && App.base.ready ? 'خارج خريطة المملكة المدمجة' : 'جارٍ تحميل خريطة المملكة…';
    }
    if (!fresh) sub = 'آخر موقع معروف' + (sub ? ' • ' + sub : '');
    txt('icPlace', title);
    txt('icSub', sub || ' ');
    txt('icLL', Math.abs(f.lat).toFixed(4) + '°' + (f.lat >= 0 ? 'N' : 'S') + '  ' + Math.abs(f.lon).toFixed(4) + '°' + (f.lon >= 0 ? 'E' : 'W'));
    var h = f.speed > 3 && f.heading != null ? f.heading : App.loc.heading;
    txt('icDir', h != null ? App.geo.dir8(h) : '—');
    // compass: the red needle points to north, relative to where the car is heading (car = up)
    var nd = App.$('icNeedle');
    if (nd && h != null) { var r = Math.round(-h); if (nd._r !== r) { nd._r = r; nd.style.transform = 'rotate(' + r + 'deg)'; } }
    txt('icAlt', f.alt != null && isFinite(f.alt) ? App.d(Math.round(f.alt)) + ' م' : '—');
    var acc = f.acc != null && isFinite(f.acc) ? Math.round(f.acc) : null;
    txt('icAcc', acc != null ? '±' + App.d(acc) + ' م' : '—');
    App.$('icAcc').className = 'num' + (acc == null ? '' : acc <= 15 ? ' good' : acc > 50 ? ' weak' : '');
  }
  D.info = info;

  D.init = function () {
    setBig(!!App.settings.mapBig, false);
    App.$('btnBig').onclick = function () { D.autoBig = false; setBig(!D.isBig(), true); };
    App.$('infoCard').onclick = function () { App.net.open(); };
    App.$('gLim').onclick = function () { App.panels.open('settings'); };
    info();
    setInterval(info, 2000);
    App.on('net', info);
    App.on('baseReady', info);
  };
})();
