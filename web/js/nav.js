/* nav.js — search (Nominatim/Photon/Overpass), routing (OSRM), Arabic turn-by-turn guidance, saved places */
(function () {
  'use strict';
  var N = App.nav = { active: null };
  var ROUTERS = ['https://routing.openstreetmap.de/routed-car/route/v1/driving/',
    'https://router.project-osrm.org/route/v1/driving/'];
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
  var ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

  function here() {
    var f = App.loc.fix;
    if (f) return { lat: f.lat, lon: f.lon };
    var p = App.store.get('lastPos', null);
    return p || { lat: App.prayer.loc.lat, lon: App.prayer.loc.lon };
  }
  function distFromHere(lat, lon) { var h = here(); return App.geo.dist(h.lat, h.lon, lat, lon); }

  // ---------- instructions ----------
  function side(m) { return m.indexOf('left') >= 0 ? ' يساراً' : m.indexOf('right') >= 0 ? ' يميناً' : ''; }
  function instr(st) {
    var t = st.type, m = st.mod || '', to = st.name ? ' إلى ' + st.name : '', on = st.name ? ' على ' + st.name : '';
    var turns = {
      'uturn': 'استدر للخلف', 'sharp right': 'انعطف بحدة يميناً', 'right': 'انعطف يميناً',
      'slight right': 'انحرف قليلاً يميناً', 'straight': 'استمر للأمام', 'slight left': 'انحرف قليلاً يساراً',
      'left': 'انعطف يساراً', 'sharp left': 'انعطف بحدة يساراً'
    };
    switch (t) {
      case 'depart': return 'انطلق' + on;
      case 'arrive': return 'الوصول إلى الوجهة';
      case 'roundabout': case 'rotary': return 'عند الدوار اسلك المخرج ' + (ORD[st.exit] || st.exit || '') + to;
      case 'exit roundabout': case 'exit rotary': return 'اخرج من الدوار' + to;
      case 'merge': return 'اندمج' + side(m) + to;
      case 'on ramp': return 'ادخل المنحدر' + side(m) + to;
      case 'off ramp': return 'اسلك المخرج' + side(m) + to;
      case 'fork': return 'عند التفرع الزم ' + (m.indexOf('left') >= 0 ? 'اليسار' : 'اليمين') + to;
      case 'end of road': return 'في نهاية الطريق ' + (m.indexOf('left') >= 0 ? 'انعطف يساراً' : 'انعطف يميناً') + to;
      case 'continue': case 'new name': return (m === 'uturn' ? 'استدر للخلف' : 'استمر') + on;
      default: return (turns[m] || 'استمر') + to;
    }
  }
  var ARROWS = {
    'straight': 'M32 58V10M19 23 32 10l13 13',
    'right': 'M22 58V36q0-12 12-12h18M42 13l11 11-11 11',
    'left': 'M42 58V36q0-12-12-12H12M22 13 11 24l11 11',
    'slight right': 'M24 58V40l20-24M33 14h12v12',
    'slight left': 'M40 58V40L20 16M31 14H19v12',
    'sharp right': 'M22 58V20l24 26M47 32v15H32',
    'sharp left': 'M42 58V20L18 46M17 32v15h15',
    'uturn': 'M42 58V26a10 10 0 0 0-20 0v20M12 36l10 11 10-11',
    'roundabout': 'M32 58V40M32 18a10 10 0 1 1-.1 0M40 12l-8 6 8 6',
    'arrive': 'M18 58V8M18 9h26l-6 9 6 9H18'
  };
  function arrow(st) {
    var k = st.type === 'arrive' ? 'arrive' : (st.type === 'roundabout' || st.type === 'rotary') ? 'roundabout' :
      (st.type === 'fork' || st.type === 'merge' || st.type.indexOf('ramp') >= 0) ? (st.mod && st.mod.indexOf('left') >= 0 ? 'slight left' : 'slight right') :
        (ARROWS[st.mod] ? st.mod : 'straight');
    return '<svg viewBox="0 0 64 64" style="stroke-width:5.5"><path d="' + ARROWS[k] + '"/></svg>';
  }

  // ---------- routing ----------
  function fetchRoute(from, to, i) {
    i = i || 0;
    var url = ROUTERS[i] + from.lon.toFixed(6) + ',' + from.lat.toFixed(6) + ';' + to.lon.toFixed(6) + ',' + to.lat.toFixed(6) +
      '?overview=full&geometries=geojson&steps=true&alternatives=false' + (from.bearing != null ? '&bearings=' + Math.round(from.bearing) + ',60;' : '');
    return App.fetchJSON(url, 15000).then(function (j) {
      if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error(j.code || 'no route');
      return j.routes[0];
    }).catch(function (e) {
      if (i + 1 < ROUTERS.length) return fetchRoute(from, to, i + 1);
      throw e;
    });
  }
  function prepare(route, dest) {
    var co = route.geometry.coordinates, cum = [0];
    for (var i = 1; i < co.length; i++) cum.push(cum[i - 1] + App.geo.dist(co[i - 1][1], co[i - 1][0], co[i][1], co[i][0]));
    var steps = [], from = 0;
    (route.legs || []).forEach(function (leg) {
      leg.steps.forEach(function (s) {
        var loc = s.maneuver.location, best = from, bd = 1e12;
        for (var k = from; k < Math.min(co.length, from + 4000); k++) {
          var d = Math.abs(co[k][0] - loc[0]) + Math.abs(co[k][1] - loc[1]);
          if (d < bd) { bd = d; best = k; }
          if (d === 0) break;
        }
        from = best;
        var st = { idx: best, type: s.maneuver.type, mod: s.maneuver.modifier || '', exit: s.maneuver.exit,
          name: s.name || s.ref || '' };
        st.text = instr(st);
        steps.push(st);
      });
    });
    return { dest: dest, coords: co, cum: cum, steps: steps, total: cum[cum.length - 1], duration: route.duration,
      i: 0, spoken: {}, off: 0, lastReroute: Date.now() };
  }

  N.start = function (dest) {
    var f = App.loc.fix, from = f ? { lat: f.lat, lon: f.lon, bearing: f.speed > 10 ? f.heading : null } : null;
    if (!from) { App.toast('لا توجد إشارة GPS بعد — لا يمكن حساب المسار'); return; }
    App.panels.close();
    App.toast('جارٍ حساب المسار…', 4000);
    fetchRoute(from, dest).then(function (route) {
      var a = prepare(route, dest);
      N.active = a;
      App.map.setRoute(a.coords);
      App.map.setDest(dest.lat, dest.lon);
      App.map.fit(a.coords);
      setTimeout(function () { if (N.active === a) App.map.recenter(); }, 3500);
      addRecent(dest);
      App.$('navCard').classList.remove('hidden');
      App.$('navBottom').classList.remove('hidden');
      App.$('searchBar').classList.add('hidden');
      voiceBtn();
      update(App.loc.fix);
      say('بدأت الملاحة إلى ' + (dest.name || 'الوجهة') + '. المسافة ' + spoken(a.total));
    }).catch(function () { App.toast('تعذّر حساب المسار — تحقق من الاتصال بالإنترنت'); });
  };
  N.stop = function (arrived) {
    var dest = N.active && N.active.dest;
    N.active = null;
    App.map.setPois(null);
    App.map.setRoute(null);
    App.map.setDest(null);
    App.map.navZoom = null;
    App.$('navCard').classList.add('hidden');
    App.$('navBottom').classList.add('hidden');
    App.$('searchBar').classList.remove('hidden');
    if (arrived) { App.toast('لقد وصلت إلى وجهتك', 5000); say('لقد وصلت إلى وجهتك'); }
    App.emit('navStop', { arrived: !!arrived, dest: dest });
  };
  function reroute() {
    var a = N.active, f = App.loc.fix;
    if (!a || !f) return;
    a.lastReroute = Date.now();
    App.toast('إعادة حساب المسار…');
    fetchRoute({ lat: f.lat, lon: f.lon, bearing: f.speed > 10 ? f.heading : null }, a.dest).then(function (route) {
      if (N.active !== a) return;
      var b = prepare(route, a.dest);
      N.active = b;
      App.map.setRoute(b.coords);
      say('تم تحديث المسار');
    }).catch(function () { });
  }

  function spoken(m) {
    if (m < 1000) return Math.round(m / 50) * 50 + ' متر';
    var km = m / 1000;
    return (km < 10 ? km.toFixed(1).replace('.0', '') : Math.round(km)) + ' كيلو';
  }
  function say(text) {
    if (!App.settings.voice) return;
    if (App.Native.has) App.Native.call('tts', text);
  }
  function voiceBtn() {
    var b = App.$('nbVoice');
    b.innerHTML = App.icon(App.settings.voice ? 'vol-up' : 'vol-down') + (App.settings.voice ? 'صوت' : 'صامت');
    b.className = 'chip' + (App.settings.voice ? ' on' : '');
  }

  function update(f) {
    var a = N.active;
    if (!a || !f) return;
    var co = a.coords, best = -1, bd = 1e12, bt = 0;
    var ref = f.lat, P = App.geo.xy(f.lat, f.lon, ref);
    var startI = Math.max(0, (a.seg || 0) - 5), endI = Math.min(co.length - 1, (a.seg || 0) + 120);
    for (var i = startI; i < endI; i++) {
      var A = App.geo.xy(co[i][1], co[i][0], ref), B = App.geo.xy(co[i + 1][1], co[i + 1][0], ref);
      var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
      var t = L2 ? Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / L2)) : 0;
      var ex = A.x + t * dx - P.x, ey = A.y + t * dy - P.y, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = i; bt = t; }
    }
    if (best < 0) return;
    var offDist = Math.sqrt(bd);
    a.seg = best;
    var along = a.cum[best] + bt * (a.cum[best + 1] - a.cum[best]);
    App.map.progressIdx = best;
    var left = Math.max(0, a.total - along);
    if (left < 30 || App.geo.dist(f.lat, f.lon, a.dest.lat, a.dest.lon) < 30) { N.stop(true); return; }
    if (offDist > Math.max(45, (f.acc || 0) + 25)) {
      if (!a.off) a.off = Date.now();
      if (Date.now() - a.off > 6000 && Date.now() - a.lastReroute > 20000) reroute();
    } else a.off = 0;

    var st = null, k;
    for (k = 1; k < a.steps.length; k++) if (a.cum[a.steps[k].idx] > along + 8) { st = a.steps[k]; break; }
    if (!st) st = a.steps[a.steps.length - 1];
    var toNext = Math.max(0, a.cum[st.idx] - along);
    App.$('ncIcon').innerHTML = arrow(st);
    App.$('ncDist').textContent = App.fmtDist(toNext);
    App.$('ncInstr').textContent = st.text;
    var ratio = a.total ? left / a.total : 0, secs = a.duration * ratio;
    App.$('nbEta').textContent = App.hmFull(new Date(Date.now() + secs * 1000));
    App.$('nbLeft').textContent = App.fmtDist(left);
    App.$('nbTime').textContent = App.fmtDur(secs);
    App.map.navZoom = toNext < 250 ? 17.6 : null;

    var fast = f.speed > 80, key = k + ':';
    var marks = fast ? [1500, 500, 150] : [600, 200, 40];
    if (toNext <= marks[0] && toNext > marks[1] && !a.spoken[key + 0] && toNext > 300) {
      a.spoken[key + 0] = 1; say('بعد ' + spoken(Math.round(toNext / 100) * 100) + '، ' + st.text);
    } else if (toNext <= marks[1] && toNext > marks[2] && !a.spoken[key + 1]) {
      a.spoken[key + 1] = 1; say('بعد ' + spoken(toNext) + '، ' + st.text);
    } else if (toNext <= marks[2] && !a.spoken[key + 2]) {
      a.spoken[key + 2] = 1; a.spoken[key + 1] = 1; a.spoken[key + 0] = 1;
      say(st.type === 'arrive' ? 'وجهتك أمامك' : st.text + ' الآن');
    }
  }
  App.on('loc', update);

  // ---------- external apps ----------
  N.openExternal = function (app, d) {
    var ll = d.lat.toFixed(6) + ',' + d.lon.toFixed(6);
    if (!App.Native.has) { window.open('https://www.google.com/maps/dir/?api=1&destination=' + ll); return; }
    var uri = app === 'waze' ? 'waze://?ll=' + ll + '&navigate=yes' : 'google.navigation:q=' + ll;
    var r = App.Native.call('view', uri);
    if (r !== '1') {
      r = App.Native.call('view', 'geo:' + ll + '?q=' + ll + '(' + encodeURIComponent(d.name || 'الوجهة') + ')');
      if (r !== '1') App.toast(app === 'waze' ? 'تطبيق ويز غير مثبت' : 'خرائط قوقل غير مثبتة');
    }
  };

  // ---------- saved / recent ----------
  function addRecent(d) {
    var r = (App.settings.recents || []).filter(function (x) { return App.geo.dist(x.lat, x.lon, d.lat, d.lon) > 50; });
    r.unshift({ lat: d.lat, lon: d.lon, name: d.name || 'موقع على الخريطة', sub: d.sub || '' });
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

  // ---------- shared "nearest place" helper (prayer times, driver tasks) ----------
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
  N.here = here;
  N.distFromHere = distFromHere;
  N.nearby = function (k, radius) {
    var cat = N.cat(k), h = here();
    if (!cat) return Promise.reject(new Error('unknown category'));
    radius = radius || 4000;
    var key = 'near.' + k + '.' + h.lat.toFixed(2) + ',' + h.lon.toFixed(2), c = App.store.get(key, null);
    var sorted = function (r) {
      r.forEach(function (p) { p.d = distFromHere(p.lat, p.lon); });
      return r.sort(function (a, b) { return a.d - b.d; });
    };
    if (c && Date.now() - c.t < 6 * 3600000 && c.r.length) return Promise.resolve(sorted(c.r));
    return overpass(cat, radius).then(function (r) { return r.length >= 2 ? r : overpass(cat, radius * 4); })
      .then(function (r) {
        r = sorted(r).slice(0, 25);
        App.store.set(key, { t: Date.now(), r: r });
        return r;
      });
  };
  N.listPanel = function (title, k) {
    var cat = N.cat(k);
    App.panels.push(title, function (body) {
      body.innerHTML = '<div class="spinner"></div>';
      N.nearby(k).then(function (r) {
        if (!document.body.contains(body)) return;
        showResults(body, r, cat ? cat.ic : 'gps');
      }).catch(function () { body.innerHTML = '<div class="empty">تعذّر البحث — تحقق من الاتصال بالإنترنت</div>'; });
    });
  };
  N.say = function (t) { say(t); };
  N.spoken = function (m) { return spoken(m); };

  function placeRow(p, ic) {
    var d = distFromHere(p.lat, p.lon);
    return '<button class="row" data-lat="' + p.lat + '" data-lon="' + p.lon + '" data-name="' + App.esc(p.name) +
      '" data-sub="' + App.esc(p.sub || '') + '">' + App.icon(ic || 'gps', 'lead') +
      '<span class="txt"><b>' + App.esc(p.name) + '</b><small>' + App.esc(p.sub || '') + '</small></span>' +
      '<span class="side num">' + App.fmtDist(d) + '</span></button>';
  }
  function bindRows(el, ic) {
    el.querySelectorAll('.row[data-lat]').forEach(function (b) {
      b.onclick = function () {
        showPlace({ lat: +b.dataset.lat, lon: +b.dataset.lon, name: b.dataset.name, sub: b.dataset.sub });
      };
    });
  }
  function showResults(body, list, ic) {
    if (!list.length) { body.innerHTML = '<div class="empty">لا توجد نتائج</div>'; return; }
    list.sort(function (a, b) { return distFromHere(a.lat, a.lon) - distFromHere(b.lat, b.lon); });
    body.innerHTML = list.slice(0, 30).map(function (p) { return placeRow(p, ic); }).join('');
    bindRows(body, ic);
  }

  function showPlace(p) {
    App.panels.push(p.name || 'موقع', function (body) {
      var d = distFromHere(p.lat, p.lon);
      body.innerHTML =
        '<div class="big-status on">' + App.icon('flag') + '<div class="txt"><b>' + App.esc(p.name || 'موقع على الخريطة') +
        '</b><small>' + App.esc(p.sub || App.ll(p.lat, p.lon)) + ' • ' + App.fmtDist(d) + '</small></div></div>' +
        '<div class="btn-row">' +
        '<button class="btn primary" id="pStart">' + App.icon('route') + 'ابدأ الملاحة</button>' +
        '<button class="btn" id="pGoogle">' + App.icon('map') + 'خرائط قوقل</button>' +
        '<button class="btn" id="pWaze">' + App.icon('car') + 'ويز</button></div>' +
        '<div class="btn-row">' +
        '<button class="btn" id="pShow">' + App.icon('locate') + 'عرض على الخريطة</button>' +
        '<button class="btn" id="pHome">' + App.icon('home') + 'حفظ كمنزل</button>' +
        '<button class="btn" id="pWork">' + App.icon('work') + 'حفظ كعمل</button>' +
        '<button class="btn" id="pTask">' + App.icon('tasks') + 'أضف كمهمة</button></div>';
      App.$('pStart').onclick = function () { N.start(p); };
      App.$('pGoogle').onclick = function () { N.openExternal('google', p); };
      App.$('pWaze').onclick = function () { N.openExternal('waze', p); };
      App.$('pShow').onclick = function () { App.panels.close(); App.map.setDest(p.lat, p.lon); App.map.lookAt(p.lat, p.lon, 16); };
      App.$('pHome').onclick = function () { savePlace('home', p); };
      App.$('pWork').onclick = function () { savePlace('work', p); };
      App.$('pTask').onclick = function () {
        App.tasks.add(p.name || 'مشوار', null, null, { lat: p.lat, lon: p.lon, name: p.name || 'موقع على الخريطة' });
        App.toast('أُضيفت للمهام — بذكّرك إذا قربت منها');
      };
    });
  }
  N.showPlace = showPlace;

  function renderMain(body) {
    var s = App.settings;
    var saved = [['home', 'المنزل', 'home'], ['work', 'العمل', 'work']].map(function (x) {
      var p = s[x[0]];
      return '<button class="row" data-saved="' + x[0] + '">' + App.icon(x[2], 'lead') + '<span class="txt"><b>' + x[1] +
        '</b><small>' + (p ? App.esc(p.name || p.sub || 'موقع محفوظ') : 'غير محدد — اضغط مطولاً على الخريطة لحفظه') + '</small></span>' +
        (p ? '<span class="side num">' + App.fmtDist(distFromHere(p.lat, p.lon)) + '</span>' : '') + '</button>';
    }).join('');
    body.innerHTML =
      '<form class="search-input" id="sForm">' + App.icon('search') +
      '<input id="sInput" type="search" placeholder="ابحث عن مكان أو عنوان…" autocomplete="off" enterkeyhint="search">' +
      '<button class="chip on" type="submit">بحث</button></form>' +
      '<div class="cats">' + CATS.map(function (c) { return '<button class="chip" data-cat="' + c.k + '">' + App.icon(c.ic) + c.n + '</button>'; }).join('') + '</div>' +
      '<div id="sResults"></div>' +
      '<div id="sHome"><div class="sec"><div class="grid2">' + saved + '</div></div>' +
      '<div class="sec"><div class="sec-title">تطبيقات الخرائط</div><div class="btn-row">' +
      '<button class="btn" id="aGoogle">' + App.icon('map') + 'خرائط قوقل</button>' +
      '<button class="btn" id="aWaze">' + App.icon('car') + 'ويز</button></div></div>' +
      (s.recents && s.recents.length ? '<div class="sec"><div class="sec-title">الوجهات الأخيرة</div><div id="sRecent">' +
        s.recents.map(function (p) { return placeRow(p, 'flag'); }).join('') + '</div></div>' : '') + '</div>';
    var res = App.$('sResults'), home = App.$('sHome');
    function busy() { home.classList.add('hidden'); res.innerHTML = '<div class="spinner"></div>'; }
    App.$('sForm').onsubmit = function (e) {
      e.preventDefault();
      var q = App.$('sInput').value.trim();
      if (!q) return;
      App.$('sInput').blur();
      var m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,،\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) { showPlace({ lat: +m[1], lon: +m[2], name: 'إحداثيات', sub: q }); return; }
      busy();
      nominatim(q).then(function (r) { return r.length ? r : photon(q); })
        .catch(function () { return photon(q); })
        .then(function (r) { showResults(res, r, 'gps'); })
        .catch(function () { res.innerHTML = '<div class="empty">تعذّر البحث — تحقق من الاتصال بالإنترنت</div>'; });
    };
    body.querySelectorAll('[data-cat]').forEach(function (b) {
      b.onclick = function () {
        var cat = CATS.filter(function (c) { return c.k === b.dataset.cat; })[0];
        busy();
        overpass(cat, 5000).then(function (r) { return r.length >= 3 ? r : overpass(cat, 20000); })
          .then(function (r) { showResults(res, r, cat.ic); })
          .catch(function () { res.innerHTML = '<div class="empty">تعذّر البحث — تحقق من الاتصال بالإنترنت</div>'; });
      };
    });
    body.querySelectorAll('[data-saved]').forEach(function (b) {
      b.onclick = function () {
        var p = App.settings[b.dataset.saved];
        if (p) showPlace({ lat: p.lat, lon: p.lon, name: b.dataset.saved === 'home' ? 'المنزل' : 'العمل', sub: p.name || p.sub });
        else App.toast('اضغط مطولاً على أي نقطة في الخريطة لحفظها');
      };
    });
    App.$('aGoogle').onclick = function () { App.system.launch('com.google.android.apps.maps', 'خرائط قوقل'); };
    App.$('aWaze').onclick = function () { App.system.launch('com.waze', 'ويز'); };
    if (App.$('sRecent')) bindRows(App.$('sRecent'), 'flag');
  }

  App.panelDefs = App.panelDefs || {};
  App.panelDefs.nav = { title: 'الخرائط والملاحة', render: renderMain };

  N.init = function () {
    App.$('searchBar').onclick = function () { App.panels.open('nav'); setTimeout(function () { var i = App.$('sInput'); if (i) i.focus(); }, 250); };
    App.$('nbStop').onclick = function () { N.stop(false); App.toast('تم إنهاء الملاحة'); };
    App.$('nbVoice').onclick = function () {
      App.settings.voice = !App.settings.voice;
      App.saveSettings();
      voiceBtn();
      if (App.settings.voice) App.Native.call('tts', '');
    };
    App.map.onLongPress = function (lat, lon, x, y) {
      var m = App.$('ctxMenu'), p = { lat: lat, lon: lon, name: 'موقع على الخريطة', sub: App.ll(lat, lon) };
      m.innerHTML = '<button data-a="go">' + App.icon('route') + 'توجّه إلى هنا</button>' +
        '<button data-a="ext">' + App.icon('map') + 'افتح في خرائط قوقل</button>' +
        '<button data-a="home">' + App.icon('home') + 'حفظ كمنزل</button>' +
        '<button data-a="work">' + App.icon('work') + 'حفظ كعمل</button>' +
        '<button data-a="task">' + App.icon('tasks') + 'أضف مهمة هنا</button>';
      var wrap = App.$('mapWrap').getBoundingClientRect();
      m.style.left = Math.min(x, wrap.width - 230) + 'px';
      m.style.top = Math.min(y, wrap.height - 280) + 'px';
      m.classList.remove('hidden');
      App.map.setDest(lat, lon);
      m.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        m.classList.add('hidden');
        var a = b.dataset.a;
        if (a === 'go') N.start(p);
        else if (a === 'ext') N.openExternal('google', p);
        else if (a === 'task') { App.tasks.add('مشوار إلى موقع محدد', null, null, p); App.toast('أُضيفت للمهام — بذكّرك إذا قربت منها'); }
        else savePlace(a, p);
        if (a !== 'go' && !N.active) App.map.setDest(null);
      };
    };
    App.on('mapTouch', function () {
      var m = App.$('ctxMenu');
      if (!m.classList.contains('hidden')) { m.classList.add('hidden'); if (!N.active) App.map.setDest(null); }
    });
  };
})();
