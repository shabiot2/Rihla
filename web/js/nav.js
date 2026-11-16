/* nav.js — places, not maps: search (built-in Kingdom index + Nominatim/Photon), nearby places (Overpass),
   saved places, and the hand-off to the driver's navigation app (Google Maps / Waze / any geo: app). */
(function () {
  'use strict';
  var N = App.nav = { active: null };
  var OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  var CATS = [
    { k: 'fuel', n: 'محطة وقود', ic: 'fuel', q: '["amenity"="fuel"]' },
    { k: 'mosque', n: 'مسجد', ic: 'mosque', q: '["amenity"="place_of_worship"]["religion"="muslim"]' },
    { k: 'atm', n: 'صراف', ic: 'cash', q: '["amenity"~"^(atm|bank)$"]' },
    { k: 'food', n: 'مطعم', ic: 'food', q: '["amenity"~"^(restaurant|fast_food)$"]' },
    { k: 'cafe', n: 'قهوة', ic: 'cafe', q: '["amenity"="cafe"]' },
    { k: 'pharmacy', n: 'صيدلية', ic: 'hospital', q: '["amenity"="pharmacy"]' },
    { k: 'hospital', n: 'مستشفى', ic: 'hospital', q: '["amenity"~"^(hospital|clinic)$"]' }
  ];
  var EXTRA = [
    { k: 'grocery', n: 'بقالة', ic: 'cart', q: '["shop"~"^(supermarket|convenience|grocery|greengrocer)$"]' },
    { k: 'bakery', n: 'مخبز', ic: 'bread', q: '["shop"~"^(bakery|pastry)$"]' },
    { k: 'carwash', n: 'مغسلة سيارات', ic: 'wash', q: '["amenity"="car_wash"]' },
    { k: 'laundry', n: 'مغسلة ملابس', ic: 'shirt', q: '["shop"~"^(laundry|dry_cleaning)$"]' },
    { k: 'school', n: 'مدرسة', ic: 'school', q: '["amenity"~"^(school|kindergarten)$"]' },
    { k: 'post', n: 'بريد وشحن', ic: 'box', q: '["amenity"~"^(post_office|parcel_locker)$"]' },
    { k: 'repair', n: 'ورشة وإطارات', ic: 'wrench', q: '["shop"~"^(car_repair|tyres|car_parts)$"]' }
  ];
  N.cats = CATS.concat(EXTRA);
  N.cat = function (k) { return N.cats.filter(function (c) { return c.k === k; })[0]; };

  // where we are: the live GPS fix when there is one, else the prayer-times city (manual or last known)
  function here() {
    var f = App.loc && App.loc.fix;
    if (f) return { lat: f.lat, lon: f.lon };
    return { lat: App.prayer.loc.lat, lon: App.prayer.loc.lon };
  }
  function distFromHere(lat, lon) { var h = here(); return App.geo.dist(h.lat, h.lon, lat, lon); }
  N.here = here;
  N.distFromHere = distFromHere;

  // ---------- voice ----------
  function spoken(m) {
    if (m < 1000) return Math.round(m / 50) * 50 + ' متر';
    var km = m / 1000;
    return (km < 10 ? km.toFixed(1).replace('.0', '') : Math.round(km)) + ' كيلو';
  }
  N.say = function (text) { if (App.settings.voice && App.Native.has) App.Native.call('tts', text); };
  N.spoken = spoken;

  // ---------- the navigation app ----------
  N.pref = function () {
    var p = App.settings.navApp;
    if (p && p !== 'auto') return p;
    var apps = App.Native.has ? App.system.apps() : [];
    var has = function (x) { return apps.some(function (a) { return a.p === x; }); };
    return has('com.google.android.apps.maps') ? 'google' : has('com.waze') ? 'waze' : 'geo';
  };
  N.openExternal = function (app, d) {
    var ll = d.lat.toFixed(6) + ',' + d.lon.toFixed(6), label = encodeURIComponent(d.name || 'الوجهة');
    if (!App.Native.has) { window.open('https://www.google.com/maps/dir/?api=1&destination=' + ll); return; }
    var geo = 'geo:' + ll + '?q=' + ll + '(' + label + ')';
    if (app === 'geo') { if (App.Native.call('view', geo) !== '1') App.toast('لا يوجد تطبيق خرائط مثبت'); return; }
    var uri = app === 'waze' ? 'waze://?ll=' + ll + '&navigate=yes' : 'google.navigation:q=' + ll;
    if (App.Native.call('view', uri) !== '1' && App.Native.call('view', geo) !== '1') {
      App.toast(app === 'waze' ? 'تطبيق ويز غير مثبت' : 'خرائط قوقل غير مثبتة');
    }
  };
  N.start = function (dest) {
    App.panels.close();
    addRecent(dest);
    N.openExternal(N.pref(), dest);
  };
  N.stop = function () { };

  // ---------- saved / recent ----------
  function addRecent(d) {
    var r = (App.settings.recents || []).filter(function (x) { return App.geo.dist(x.lat, x.lon, d.lat, d.lon) > 50; });
    r.unshift({ lat: d.lat, lon: d.lon, name: d.name || 'موقع', sub: d.sub || '' });
    App.settings.recents = r.slice(0, 8);
    App.saveSettings();
  }
  function savePlace(kind, d) {
    App.settings[kind] = { lat: d.lat, lon: d.lon, name: d.name || '', sub: d.sub || '' };
    App.saveSettings();
    App.toast(kind === 'home' ? 'تم حفظ موقع المنزل' : 'تم حفظ موقع العمل');
  }

  // ---------- search ----------
  function nominatim(q) {
    var h = here(), vb = [h.lon - 1.5, h.lat + 1.5, h.lon + 1.5, h.lat - 1.5].map(function (x) { return x.toFixed(3); }).join(',');
    return App.fetchJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=12&accept-language=ar&viewbox=' +
      vb + '&q=' + encodeURIComponent(q), 12000).then(function (arr) {
        return arr.map(function (r) {
          var parts = (r.display_name || '').split('،').join(',').split(',');
          return { lat: +r.lat, lon: +r.lon, name: r.name || parts[0], sub: parts.slice(1, 4).join('،').trim() };
        });
      });
  }
  function photon(q) {
    var h = here();
    return App.fetchJSON('https://photon.komoot.io/api/?limit=12&lat=' + h.lat + '&lon=' + h.lon + '&q=' + encodeURIComponent(q), 12000)
      .then(function (j) {
        return (j.features || []).map(function (f) {
          var p = f.properties || {};
          return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: p.name || p.street || q,
            sub: [p.street, p.district, p.city, p.state].filter(Boolean).join('، ') };
        });
      });
  }
  function overpass(cat, radius, i) {
    var h = here(); i = i || 0;
    var qq = '[out:json][timeout:20];(node' + cat.q + '(around:' + radius + ',' + h.lat + ',' + h.lon + ');way' + cat.q +
      '(around:' + radius + ',' + h.lat + ',' + h.lon + '););out center 60;';
    return App.fetchJSON(OVERPASS[i] + '?data=' + encodeURIComponent(qq), 25000).then(function (j) {
      return (j.elements || []).map(function (e) {
        var t = e.tags || {}, lat = e.lat || (e.center && e.center.lat), lon = e.lon || (e.center && e.center.lon);
        return { lat: lat, lon: lon, name: t['name:ar'] || t.name || t.brand || cat.n,
          sub: [t['addr:street'], t['addr:city']].filter(Boolean).join('، ') || cat.n };
      }).filter(function (r) { return r.lat && r.lon; });
    }).catch(function (e) { if (i + 1 < OVERPASS.length) return overpass(cat, radius, i + 1); throw e; });
  }
  N.nearby = function (k, radius) {
    var cat = N.cat(k), h = here();
    if (!cat) return Promise.reject(new Error('unknown category'));
    radius = radius || 4000;
    var key = 'near.' + k + '.' + h.lat.toFixed(2) + ',' + h.lon.toFixed(2), c = App.store.get(key, null);
    var sorted = function (r) {
      r.forEach(function (p) { p.d = distFromHere(p.lat, p.lon); });
      return r.sort(function (a, b) { return a.d - b.d; });
    };
    if (c && c.r.length && (App.offline || Date.now() - c.t < 6 * 3600000)) return Promise.resolve(sorted(c.r));
    if (App.offline) return Promise.reject(new Error('offline'));
    return overpass(cat, radius).then(function (r) { return r.length >= 2 ? r : overpass(cat, radius * 4); })
      .then(function (r) {
        r = sorted(r).slice(0, 25);
        App.store.set(key, { t: Date.now(), r: r });
        return r;
      });
  };
  function offMsg() {
    return App.offline ? 'بدون نت — ما عندي نتائج محفوظة لهذا المكان' : 'تعذّر البحث — تحقق من الاتصال بالإنترنت';
  }
  N.offMsg = offMsg;

  // ---------- lists & place sheet ----------
  function placeRow(p, ic) {
    var d = distFromHere(p.lat, p.lon);
    return '<button class="row" data-lat="' + p.lat + '" data-lon="' + p.lon + '" data-name="' + App.esc(p.name) +
      '" data-sub="' + App.esc(p.sub || '') + '">' + App.icon(ic || 'pin', 'lead') +
      '<span class="txt"><b>' + App.esc(p.name) + '</b><small>' + App.esc(p.sub || '') + '</small></span>' +
      '<span class="side num">' + App.fmtDist(d) + '</span></button>';
  }
  function bindRows(el) {
    el.querySelectorAll('.row[data-lat]').forEach(function (b) {
      b.onclick = function () { showPlace({ lat: +b.dataset.lat, lon: +b.dataset.lon, name: b.dataset.name, sub: b.dataset.sub }); };
    });
  }
  function showResults(body, list, ic) {
    if (!list.length) { body.innerHTML = '<div class="empty">لا توجد نتائج</div>'; return; }
    list.sort(function (a, b) { return distFromHere(a.lat, a.lon) - distFromHere(b.lat, b.lon); });
    body.innerHTML = list.slice(0, 30).map(function (p) { return placeRow(p, ic); }).join('');
    bindRows(body);
  }
  N.listPanel = function (title, k) {
    var cat = N.cat(k);
    App.panels.push(title, function (body) {
      body.innerHTML = '<div class="spinner"></div>';
      N.nearby(k).then(function (r) {
        if (!document.body.contains(body)) return;
        showResults(body, r, cat ? cat.ic : 'pin');
      }).catch(function () { body.innerHTML = '<div class="empty">' + offMsg() + '</div>'; });
    });
  };
  function appName(k) { return k === 'waze' ? 'ويز' : k === 'google' ? 'خرائط قوقل' : 'تطبيق الخرائط'; }
  function showPlace(p) {
    App.panels.push(p.name || 'موقع', function (body) {
      var d = distFromHere(p.lat, p.lon), pref = N.pref();
      body.innerHTML =
        '<div class="big-status on">' + App.icon('flag') + '<div class="txt"><b>' + App.esc(p.name || 'موقع') +
        '</b><small>' + App.esc(p.sub || App.ll(p.lat, p.lon)) + ' • ' + App.fmtDist(d) + '</small></div></div>' +
        '<div class="btn-row">' +
        '<button class="btn primary" id="pStart">' + App.icon('route') + 'انطلق في ' + appName(pref) + '</button>' +
        (pref !== 'google' ? '<button class="btn" id="pGoogle">' + App.icon('map') + 'خرائط قوقل</button>' : '') +
        (pref !== 'waze' ? '<button class="btn" id="pWaze">' + App.icon('car') + 'ويز</button>' : '') +
        '<button class="btn" id="pGeo">' + App.icon('apps') + 'تطبيق آخر</button></div>' +
        '<div class="btn-row">' +
        '<button class="btn" id="pHome">' + App.icon('home') + 'حفظ كمنزل</button>' +
        '<button class="btn" id="pWork">' + App.icon('work') + 'حفظ كعمل</button>' +
        '<button class="btn" id="pTask">' + App.icon('tasks') + 'أضف كمهمة</button></div>';
      App.$('pStart').onclick = function () { N.start(p); };
      if (App.$('pGoogle')) App.$('pGoogle').onclick = function () { N.openExternal('google', p); };
      if (App.$('pWaze')) App.$('pWaze').onclick = function () { N.openExternal('waze', p); };
      App.$('pGeo').onclick = function () { N.openExternal('geo', p); };
      App.$('pHome').onclick = function () { savePlace('home', p); };
      App.$('pWork').onclick = function () { savePlace('work', p); };
      App.$('pTask').onclick = function () {
        App.tasks.add(p.name || 'مشوار', null, null, { lat: p.lat, lon: p.lon, name: p.name || 'موقع' });
        App.toast('أُضيفت للمهام');
      };
    });
  }
  N.showPlace = showPlace;

  // ---------- «وجهة» panel: search a place and send it to the navigation app ----------
  function renderMain(body) {
    var s = App.settings;
    var saved = [['home', 'المنزل', 'home'], ['work', 'العمل', 'work']].map(function (x) {
      var p = s[x[0]];
      return '<button class="row" data-saved="' + x[0] + '">' + App.icon(x[2], 'lead') + '<span class="txt"><b>' + x[1] +
        '</b><small>' + (p ? App.esc(p.name || p.sub || 'موقع محفوظ') : 'غير محدد — ابحث عن المكان واضغط «حفظ»') + '</small></span>' +
        (p ? '<span class="side num">' + App.fmtDist(distFromHere(p.lat, p.lon)) + '</span>' : '') + '</button>';
    }).join('');
    body.innerHTML =
      '<form class="search-input" id="sForm">' + App.icon('search') +
      '<input id="sInput" type="search" placeholder="وين تبي تروح؟ مكان، حي، أو مدينة…" autocomplete="off" enterkeyhint="search">' +
      '<button class="chip on" type="submit">بحث</button></form>' +
      '<div class="cats">' + CATS.map(function (c) { return '<button class="chip" data-cat="' + c.k + '">' + App.icon(c.ic) + c.n + '</button>'; }).join('') + '</div>' +
      '<div id="sResults"></div>' +
      '<div id="sHome"><div class="sec"><div class="grid2">' + saved + '</div></div>' +
      (s.recents && s.recents.length ? '<div class="sec"><div class="sec-title">الوجهات الأخيرة</div><div id="sRecent">' +
        s.recents.map(function (p) { return placeRow(p, 'flag'); }).join('') + '</div></div>' : '') + '</div>';
    var res = App.$('sResults'), home = App.$('sHome');
    function busy() { home.classList.add('hidden'); res.innerHTML = '<div class="spinner"></div>'; }
    function showLocal(list, final) {
      res.innerHTML = '<div class="sec-title"><span>المدن والأحياء' + (final ? '' : ' — جارٍ البحث أونلاين…') + '</span></div>' +
        list.map(function (p) { return placeRow(p, p.kind === 'dis' ? 'home' : 'flag'); }).join('');
      bindRows(res);
    }
    App.$('sForm').onsubmit = function (e) {
      e.preventDefault();
      var q = App.$('sInput').value.trim();
      if (!q) return;
      App.$('sInput').blur();
      var m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,،\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) { showPlace({ lat: +m[1], lon: +m[2], name: 'إحداثيات', sub: q }); return; }
      var local = App.base && App.base.ready ? App.base.search(q, here()) : [];
      if (App.offline) {
        home.classList.add('hidden');
        if (local.length) showLocal(local, true); else res.innerHTML = '<div class="empty">بدون نت — ما لقيت مدينة أو حي بهذا الاسم</div>';
        return;
      }
      busy();
      if (local.length) showLocal(local, false);
      nominatim(q).then(function (r) { return r.length ? r : photon(q); })
        .catch(function () { return photon(q); })
        .then(function (r) { showResults(res, r.concat(local), 'pin'); })
        .catch(function () { if (local.length) showLocal(local, true); else res.innerHTML = '<div class="empty">' + offMsg() + '</div>'; });
    };
    body.querySelectorAll('[data-cat]').forEach(function (b) {
      b.onclick = function () {
        var cat = N.cat(b.dataset.cat);
        busy();
        N.nearby(cat.k, 5000).then(function (r) { showResults(res, r, cat.ic); })
          .catch(function () { res.innerHTML = '<div class="empty">' + offMsg() + '</div>'; });
      };
    });
    body.querySelectorAll('[data-saved]').forEach(function (b) {
      b.onclick = function () {
        var p = App.settings[b.dataset.saved];
        if (p) showPlace({ lat: p.lat, lon: p.lon, name: b.dataset.saved === 'home' ? 'المنزل' : 'العمل', sub: p.name || p.sub });
        else App.$('sInput').focus();
      };
    });
    if (App.$('sRecent')) bindRows(App.$('sRecent'));
  }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.nav = { title: 'وجهة', render: renderMain };

  N.init = function () { };
})();
