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
    if (!App.settings.maps) return;
    if (on) { if (!D.isBig()) { D.autoBig = true; setBig(true, false); } }
    else if (D.autoBig) { D.autoBig = false; setBig(!!App.settings.mapBig, false); }
  };

  // ---------- map on / off (off by default: the dashboard shows app shortcuts, routes open in Google Maps / Waze) ----------
  D.applyMaps = function () {
    var on = !!App.settings.maps;
    document.body.classList.toggle('no-map', !on);
    if (App.map) { App.map.off = !on; if (on) { App.map.resize(); App.map.invalidate(); } }
    if (!on && D.isBig()) setBig(false, false);
    renderShortcuts();
  };

  // ---------- app shortcuts ----------
  var KNOWN = ['com.google.android.apps.maps', 'com.waze', 'com.google.android.apps.youtube.music', 'com.spotify.music',
    'com.anghami', 'com.google.android.youtube', 'com.quran.labs.androidquran', 'com.whatsapp', 'com.android.chrome'];
  var BUILTIN = {
    'rihla:radio': { l: 'راديو السيارة', ic: 'radio', go: function () { App.radio.openCarRadio(false); } },
    'rihla:bt': { l: 'موسيقى البلوتوث', ic: 'bt', go: function () { App.system.openBtApp(); } },
    'rihla:adhkar': { l: 'الأذكار', ic: 'book', go: function () { App.panels.open('adhkar'); } },
    'rihla:apps': { l: 'كل التطبيقات', ic: 'apps', go: function () { App.panels.open('apps'); } }
  };
  function installed() { return App.Native.has ? App.system.apps() : []; }
  function defaults() {
    var apps = installed(), has = function (p) { return apps.some(function (a) { return a.p === p; }); };
    var list = ['rihla:radio'].concat(KNOWN.filter(has));
    (App.settings.favs || []).forEach(function (p) { if (list.indexOf(p) < 0 && has(p)) list.push(p); });
    if (list.length < 8) list.push('rihla:bt');
    if (list.length < 8) list.push('rihla:adhkar');
    return list.slice(0, 8);
  }
  D.shortcuts = function () { return (App.settings.shortcuts || defaults()).slice(0, 8); };
  function tile(id) {
    var b = BUILTIN[id];
    if (b) return '<button class="ac-tile" data-s="' + id + '">' + App.icon(b.ic) + '<span>' + b.l + '</span></button>';
    var l = App.system.label(id);
    return '<button class="ac-tile" data-s="' + App.esc(id) + '"><span data-icon="' + App.esc(id) + '"><span class="ph">' +
      App.esc(String(l || '?').trim().charAt(0)) + '</span></span><span>' + App.esc(l) + '</span></button>';
  }
  function renderShortcuts() {
    var g = App.$('acGrid');
    if (!g || App.settings.maps) return;
    g.innerHTML = D.shortcuts().concat(['rihla:apps']).map(tile).join('');
    g.querySelectorAll('.ac-tile').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.s;
        if (BUILTIN[id]) BUILTIN[id].go(); else App.system.launch(id, App.system.label(id));
      };
    });
    App.system.lazyIcons(g);
  }
  D.renderShortcuts = renderShortcuts;
  function editShortcuts() {
    App.panels.push('اختصارات الداش بورد', function (body) {
      var sel = D.shortcuts(), apps = installed();
      var items = Object.keys(BUILTIN).filter(function (k) { return k !== 'rihla:apps'; }).map(function (k) { return { p: k, l: BUILTIN[k].l, b: 1 }; })
        .concat(apps.filter(function (a) { return a.p !== 'com.carnav.camry'; }));
      body.innerHTML = '<div class="note" style="margin-bottom:1.2vmin">اختر حتى ' + App.d(8) + ' اختصارات تظهر في الداش بورد — بالترتيب اللي تختاره.</div>' +
        '<div class="apps-grid" id="scGrid">' + items.map(function (a) {
          var i = sel.indexOf(a.p);
          return '<button class="app' + (i >= 0 ? ' picked' : '') + '" data-p="' + App.esc(a.p) + '">' +
            (i >= 0 ? '<b class="sc-n num">' + App.d(i + 1) + '</b>' : '') +
            (a.b ? App.icon(BUILTIN[a.p].ic, 'bi') : '<span data-icon="' + App.esc(a.p) + '"><span class="ph">' + App.esc(String(a.l).charAt(0)) + '</span></span>') +
            '<span>' + App.esc(a.l) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:1.4vmin"><button class="btn" id="scReset">' + App.icon('reset') + 'الاختيار التلقائي</button></div>';
      App.$('scGrid').onclick = function (e) {
        var b = e.target.closest('.app');
        if (!b) return;
        var list = D.shortcuts().slice(), i = list.indexOf(b.dataset.p);
        if (i >= 0) list.splice(i, 1);
        else if (list.length >= 8) { App.toast('الحد ' + App.d(8) + ' اختصارات — شيل واحد أول'); return; }
        else list.push(b.dataset.p);
        App.settings.shortcuts = list;
        App.saveSettings();
        renderShortcuts();
        App.panels.refresh();
      };
      App.$('scReset').onclick = function () { App.settings.shortcuts = null; App.saveSettings(); renderShortcuts(); App.panels.refresh(); };
      App.system.lazyIcons(body);
    });
  }

  // ---------- «موقعك» details (when the map is off) ----------
  function wherePanel() {
    App.panels.push('موقعك', function (body) {
      var f = App.loc.fix, w = f && App.base && App.base.ready ? App.base.where(f.lat, f.lon) : null, sat = App.loc.sats;
      if (!f) { body.innerHTML = '<div class="empty">جارٍ تحديد الموقع… تأكد إن هوائي GPS موصول بالشاشة</div>'; return; }
      var ll = f.lat.toFixed(6) + ',' + f.lon.toFixed(6), name = w ? (w.district || w.cityName || w.region || '') : '';
      body.innerHTML = '<div class="big-status on">' + App.icon('pin') + '<div class="txt"><b>' + App.esc(name || 'موقعك الحالي') + '</b><small>' +
        App.esc(w ? [w.district ? w.cityName : null, w.region].filter(Boolean).join(' • ') : '') + '</small></div></div>' +
        '<div class="sec"><div class="set-row"><div class="txt"><b class="num" style="direction:ltr;text-align:right">' + ll + '</b>' +
        '<small>الإحداثيات' + (f.src === 'last' ? ' — آخر موقع معروف' : '') + '</small></div></div>' +
        '<div class="set-row"><div class="txt"><b>' + App.d(Math.round(f.speed || 0)) + ' كم/س • ' + (f.heading != null ? App.geo.dir8(f.heading) : '—') +
        ' • ' + (f.alt != null && isFinite(f.alt) ? App.d(Math.round(f.alt)) + ' م ارتفاع' : '—') + '</b><small>' +
        (sat ? App.d(sat.used) + ' من ' + App.d(sat.total) + ' قمر' : 'الأقمار —') + ' • الدقة ±' + App.d(Math.round(f.acc || 0)) + ' م</small></div></div></div>' +
        '<div class="btn-row"><button class="btn primary" id="wGeo">' + App.icon('map') + 'اعرض في تطبيق الخرائط</button>' +
        '<button class="btn" id="wWaze">' + App.icon('car') + 'ويز</button>' +
        '<button class="btn" id="wMosq">' + App.icon('mosque') + 'المساجد القريبة</button></div>';
      App.$('wGeo').onclick = function () { if (App.Native.call('view', 'geo:' + ll + '?q=' + ll) !== '1') App.toast('لا يوجد تطبيق خرائط مثبت'); };
      App.$('wWaze').onclick = function () { if (App.Native.call('view', 'waze://?ll=' + ll) !== '1') App.toast('تطبيق ويز غير مثبت'); };
      App.$('wMosq').onclick = function () { App.panels.open('prayer'); };
    });
  }

  function txt(id, v) { var el = App.$(id); if (el && el._v !== v) { el._v = v; el.textContent = v; } }
  function info() {
    var f = App.loc.fix, now = Date.now(), fresh = f && f.src !== 'last' && now - f.t < 15000;
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
      sub = App.base && App.base.ready ? 'خارج المملكة' : 'جارٍ تحديد الحي…';
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
    App.$('infoCard').onclick = function () { if (App.settings.maps) App.net.open(); else wherePanel(); };
    App.$('acEdit').onclick = editShortcuts;
    D.applyMaps();
    App.$('gLim').onclick = function () { App.panels.open('settings'); };
    info();
    setInterval(info, 2000);
    App.on('net', info);
    App.on('baseReady', info);
  };
})();
