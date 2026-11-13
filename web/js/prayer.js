/* prayer.js — Umm al-Qura prayer times (Fajr 18.5°, Isha 90 min / 120 in Ramadan), Hijri date */
(function () {
  'use strict';
  var DG = Math.PI / 180;
  function sin(d) { return Math.sin(d * DG); }
  function cos(d) { return Math.cos(d * DG); }
  function tan(d) { return Math.tan(d * DG); }
  function asin(x) { return Math.asin(x) / DG; }
  function acos(x) { return Math.acos(x) / DG; }
  function atan2(y, x) { return Math.atan2(y, x) / DG; }
  function acot(x) { return Math.atan(1 / x) / DG; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPos(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  // returns hours (local clock) for fajr, sunrise, dhuhr, asr, maghrib, isha
  function compute(date, lat, lng, ramadan) {
    var tz = -date.getTimezoneOffset() / 60;
    var jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    function midDay(t) { return fix(12 - sunPos(jd + t).eqt, 24); }
    function angleTime(angle, t, ccw) {
      var decl = sunPos(jd + t).decl, noon = midDay(t);
      var x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (x > 1 || x < -1) return NaN;
      var T = acos(x) / 15;
      return noon + (ccw ? -T : T);
    }
    function asr(t) {
      var decl = sunPos(jd + t).decl;
      return angleTime(-acot(1 + tan(Math.abs(lat - decl))), t);
    }
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18 };
    for (var i = 0; i < 2; i++) {
      t = {
        fajr: angleTime(18.5, t.fajr / 24, true),
        sunrise: angleTime(0.833, t.sunrise / 24, true),
        dhuhr: midDay(t.dhuhr / 24),
        asr: asr(t.asr / 24),
        sunset: angleTime(0.833, t.sunset / 24)
      };
    }
    var adj = tz - lng / 15;
    var maghrib = t.sunset + adj;
    return [t.fajr + adj, t.sunrise + adj, t.dhuhr + adj, t.asr + adj, maghrib, maghrib + (ramadan ? 2 : 1.5)];
  }

  // ---------- Hijri (Umm al-Qura via Intl, tabular fallback) ----------
  var HM = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  function tabular(date) {
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    var a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
    var jd = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
    var l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = Math.floor((10985 - l) / 5316) * Math.floor(50 * l / 17719) + Math.floor(l / 5670) * Math.floor(43 * l / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
    var hm = Math.floor(24 * l / 709);
    return { d: l - Math.floor(709 * hm / 24), m: hm, y: 30 * n + j - 30 };
  }
  function hijri(date) {
    try {
      var nf = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
      if (nf.resolvedOptions().calendar === 'islamic-umalqura') {
        var p = nf.formatToParts(date), o = {};
        p.forEach(function (x) { o[x.type] = parseInt(x.value, 10); });
        if (o.day && o.month && o.year) return { d: o.day, m: o.month, y: o.year };
      }
    } catch (e) { /* fall through */ }
    return tabular(date);
  }
  App.hijriText = function (date) {
    var h = hijri(date);
    return App.d(h.d) + ' ' + HM[h.m - 1] + ' ' + App.d(h.y) + ' هـ';
  };

  // ---------- state + UI ----------
  var NAMES = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
  // on Friday the noon prayer is «الجمعة»
  function nm(i, d) { return i === 2 && d && d.getDay() === 5 ? 'الجمعة' : NAMES[i]; }
  var P = App.prayer = {
    loc: App.store.get('prayLoc', { lat: 24.7136, lon: 46.6753, city: 'الرياض' }),
    today: null, tomorrow: null, dayKey: '', alerted: {}
  };

  function times(date) {
    var h = hijri(date), base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var hrs = compute(date, P.loc.lat, P.loc.lon, h.m === 9);
    var off = App.settings.offsets || [];
    return hrs.map(function (x, i) {
      var ms = Math.round((x * 60 + (off[i] || 0)) * 60) * 1000;
      return new Date(base.getTime() + ms);
    });
  }
  P.recalc = function () {
    var now = new Date();
    P.today = times(now);
    P.tomorrow = times(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12));
    P.dayKey = now.toDateString();
    render(now);
  };
  P.setLocation = function (lat, lon, force) {
    var moved = App.geo.dist(lat, lon, P.loc.lat, P.loc.lon);
    if (!force && moved < 5000) return;
    P.loc = { lat: lat, lon: lon, city: moved > 15000 ? '' : P.loc.city };
    App.store.set('prayLoc', P.loc);
    P.recalc();
    if (!P.loc.city) cityLookup(lat, lon);
  };
  function cityLookup(lat, lon) {
    // the built-in Kingdom map answers instantly and without internet; online lookup only outside it
    var w = App.base && App.base.where(lat, lon);
    if (w && (w.cityName || w.region)) {
      P.loc.city = w.cityName || w.region;
      App.store.set('prayLoc', P.loc);
      App.$('pcCity').textContent = P.loc.city;
      return;
    }
    if (App.offline || (App.base && App.base.loading && !App.base.ready)) return;   // retried on baseReady / when back online
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=ar&lat=' +
      lat.toFixed(4) + '&lon=' + lon.toFixed(4);
    App.fetchJSON(url, 10000).then(function (j) {
      var a = j.address || {};
      P.loc.city = a.city || a.town || a.village || a.county || a.state || '';
      App.store.set('prayLoc', P.loc);
      App.$('pcCity').textContent = P.loc.city || 'مواقيت الصلاة';
    }).catch(function () { });
  }

  P.next = function (now) {
    for (var i = 0; i < 6; i++) if (P.today[i] > now) return { i: i, t: P.today[i], tomorrow: false };
    return { i: 0, t: P.tomorrow[0], tomorrow: true };
  };

  var listBuilt = false;
  function render(now) {
    var ul = App.$('prayerList');
    if (!listBuilt) {
      ul.innerHTML = NAMES.map(function (n, i) {
        return '<li' + (i === 1 ? ' class="sun"' : '') + '><span>' + n + '</span><b class="num"></b></li>';
      }).join('');
      listBuilt = true;
    }
    var nx = P.next(now), lis = ul.children;
    for (var i = 0; i < 6; i++) {
      var t = nx.tomorrow && i === 0 ? P.tomorrow[0] : P.today[i];
      lis[i].querySelector('span').textContent = nm(i, t);
      lis[i].querySelector('b').textContent = App.hm(t);
      lis[i].className = (i === 1 ? 'sun ' : '') + (i === nx.i ? 'next' : (!nx.tomorrow && t < now ? 'past' : ''));
    }
    App.$('pcCity').textContent = P.loc.city || 'مواقيت الصلاة';
  }

  // ---------- nearest mosque ----------
  var KAABA = { lat: 21.422487, lon: 39.826206 };
  P.NAMES = NAMES;
  P.name = nm;
  P.nearestMosques = function () { return App.nav.nearby('mosque', 3000); };
  P.goMosque = function (m) {
    if (!m) return;
    App.nav.start({ lat: m.lat, lon: m.lon, name: m.name, sub: m.sub });
  };
  P.showMosquesOnMap = function (list) {
    App.panels.close();
    App.map.setPois(list.slice(0, 12).map(function (m) { return { lat: m.lat, lon: m.lon, name: m.name, sub: m.sub }; }));
    App.map.showAll(list.slice(0, 4));
    App.toast('اضغط على أي مسجد لعرضه أو التوجّه إليه', 3500);
  };
  function mosqueLine(m) {
    return '<b>' + App.esc(m.name) + '</b> — <span class="num">' + App.fmtDist(m.d) + '</span>' +
      '<small>' + App.esc(m.sub && m.sub !== 'مسجد' ? m.sub : 'أقرب مسجد لموقعك الحالي') + '</small>';
  }

  // ---------- alert at the prayer time (with the nearest mosque) ----------
  function alertPrayer(i) {
    var box = App.$('prayerAlert');
    var isPrayer = i !== 1;
    box.innerHTML = App.icon(isPrayer ? 'mosque' : 'sun', 'pa-icon') +
      (isPrayer ? 'حان الآن موعد صلاة' : 'حان الآن وقت') + '<b class="pa-name">' + nm(i, P.today[i]) + '</b>' +
      '<div class="pa-time num">' + App.hmFull(P.today[i]) + '</div>' +
      (isPrayer ? '<div class="pa-mosque" id="paMosque"><span class="spinner small"></span> جارٍ البحث عن أقرب مسجد…</div>' +
        '<div class="btn-row"><button class="btn primary" id="paGo" disabled>' + App.icon('route') + 'انطلق لأقرب مسجد</button>' +
        '<button class="btn" id="paMap">' + App.icon('map') + 'المساجد على الخريطة</button>' +
        '<button class="btn" id="paClose">' + App.icon('close') + 'إغلاق</button></div>' : '');
    box.classList.remove('hidden');
    clearTimeout(box._h);
    box._h = setTimeout(function () { box.classList.add('hidden'); }, isPrayer ? 180000 : 45000);
    box.onclick = isPrayer ? null : function () { box.classList.add('hidden'); };
    if (App.settings.adhanChime && isPrayer) App.beep([[659, 420], [784, 420], [988, 700]], 0.3);
    App.emit('prayerTime', i);
    if (!isPrayer) return;
    var found = [];
    App.$('paClose').onclick = function () { box.classList.add('hidden'); };
    App.$('paGo').onclick = function () { box.classList.add('hidden'); P.goMosque(found[0]); };
    App.$('paMap').onclick = function () { box.classList.add('hidden'); if (found.length) P.showMosquesOnMap(found); else App.panels.open('prayer'); };
    var spoken = 'حان الآن موعد صلاة ' + nm(i, P.today[i]);
    P.nearestMosques().then(function (list) {
      found = list;
      var el = App.$('paMosque');
      if (!el) return;
      if (!list.length) { el.innerHTML = 'لم أجد مساجد مسجّلة قريبة على الخريطة'; return; }
      el.innerHTML = 'أقرب مسجد: ' + mosqueLine(list[0]);
      App.$('paGo').disabled = false;
      App.nav.say(spoken + '. أقرب مسجد على بعد ' + App.nav.spoken(list[0].d));
    }).catch(function () {
      var el = App.$('paMosque');
      if (el) el.innerHTML = App.offline ? 'بدون نت — ما عندي مساجد محفوظة لهذا المكان' : 'تعذّر البحث عن المساجد — تحقق من الإنترنت';
      App.nav.say(spoken);
    });
  }

  // ---------- reminder a few minutes before the prayer ----------
  function preReminder(i, mins) {
    App.reminder.show({
      kind: 'تذكير الصلاة', icon: 'mosque',
      title: 'باقي ' + App.d(mins) + ' دقائق على صلاة ' + nm(i, P.today[i]),
      sub: 'جارٍ البحث عن أقرب مسجد…',
      buttons: [['go', 'انطلق لأقرب مسجد', 'route', true], ['list', 'المساجد القريبة', 'mosque'], ['close', 'إغلاق', 'close']],
      onButton: function (b, ctx) {
        if (b === 'go' && ctx.m) P.goMosque(ctx.m[0]);
        if (b === 'list') { if (ctx.m && ctx.m.length) P.showMosquesOnMap(ctx.m); else App.panels.open('prayer'); }
      },
      onShow: function (ctx, setSub, enable) {
        P.nearestMosques().then(function (list) {
          ctx.m = list;
          if (list.length) { setSub('أقرب مسجد: ' + list[0].name + ' — ' + App.fmtDist(list[0].d)); enable('go'); }
          else setSub('لم أجد مساجد مسجّلة قريبة');
        }).catch(function () { setSub(App.offline ? 'بدون نت — ما عندي مساجد محفوظة لهذا المكان' : 'تعذّر البحث — تحقق من الإنترنت'); });
      }
    });
    App.nav.say('باقي ' + mins + ' دقائق على صلاة ' + nm(i, P.today[i]));
  }

  // ---------- qibla ----------
  P.qibla = function () {
    var f = App.loc.fix || P.loc;
    return { bearing: App.geo.bearing(f.lat, f.lon, KAABA.lat, KAABA.lon), dist: App.geo.dist(f.lat, f.lon, KAABA.lat, KAABA.lon) };
  };
  function relText(rel) {
    var r = (rel + 360) % 360;
    if (r < 20 || r > 340) return 'أمامك مباشرة';
    if (r < 70) return 'أمامك جهة اليمين';
    if (r < 110) return 'على يمينك';
    if (r < 160) return 'خلفك جهة اليمين';
    if (r < 200) return 'خلفك';
    if (r < 250) return 'خلفك جهة اليسار';
    if (r < 290) return 'على يسارك';
    return 'أمامك جهة اليسار';
  }
  function qiblaSvg(rot) {
    var ticks = '';
    for (var a = 0; a < 360; a += 30) ticks += '<path d="M50 6v' + (a % 90 ? 4 : 7) + '" stroke="currentColor" stroke-opacity=".5" stroke-width="1.6" transform="rotate(' + a + ' 50 50)"/>';
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line2)" stroke-width="2"/>' + ticks +
      '<text x="50" y="22" text-anchor="middle" font-size="9" font-weight="700" fill="var(--danger)">N</text>' +
      '<g transform="rotate(' + rot.toFixed(1) + ' 50 50)"><path d="M50 14 57 44H43z" fill="var(--accent)"/><path d="M50 86 55 56H45z" fill="var(--dim)"/>' +
      '<rect x="45" y="7" width="10" height="10" rx="1.5" fill="var(--text)"/><path d="M45 10.5h10" stroke="var(--accent-d)" stroke-width="1.6"/></g>' +
      '<circle cx="50" cy="50" r="5" fill="var(--text)"/></svg>';
  }

  // ---------- prayer panel ----------
  function renderPanel(body) {
    var now = new Date(), nx = P.next(now), q = P.qibla(), f = App.loc.fix;
    var moving = f && f.speed > 8 && f.heading != null;
    var rel = moving ? q.bearing - f.heading : q.bearing;
    body.innerHTML =
      '<div class="pray-hero"><div class="ph-next"><small>الصلاة القادمة' + (P.loc.city ? ' — ' + App.esc(P.loc.city) : '') + '</small>' +
      '<b>' + nm(nx.i, nx.t) + ' <span class="num">' + App.hmFull(nx.t) + '</span></b><span class="cd num" id="ppCd">بعد ' + App.countdown(nx.t - now) + '</span>' +
      '<div class="btn-row" style="margin-top:1.2vmin"><button class="btn" id="ppMorning">' + App.icon('sun') + 'أذكار الصباح</button>' +
      '<button class="btn" id="ppEvening">' + App.icon('moon') + 'أذكار المساء</button></div></div>' +
      '<div class="qibla">' + qiblaSvg(rel) + '<b class="num">القبلة ' + App.d(Math.round(q.bearing)) + '° ' + App.geo.dir8(q.bearing) + '</b>' +
      '<small>' + (moving ? relText(rel) + ' • ' : '') + 'مكة على بعد ' + App.fmtDist(q.dist) + '</small></div></div>' +
      '<div class="ptimes">' + NAMES.map(function (n, i) {
        var t = nx.tomorrow && i === 0 ? P.tomorrow[0] : P.today[i];
        return '<div class="' + (i === nx.i ? 'next' : (!nx.tomorrow && t < now ? 'past' : '')) + '"><span>' + nm(i, t) + '</span><b class="num">' + App.hm(t) + '</b></div>';
      }).join('') + '</div>' +
      '<div class="sec"><div class="sec-title"><span>أقرب المساجد</span><button class="chip" id="ppMap">' + App.icon('map') + 'على الخريطة</button></div>' +
      '<div id="ppList"><div class="spinner"></div></div></div>';
    App.$('ppMorning').onclick = function () { App.adhkar.open('m'); };
    App.$('ppEvening').onclick = function () { App.adhkar.open('e'); };
    var list = [];
    App.$('ppMap').onclick = function () { if (list.length) P.showMosquesOnMap(list); else App.toast('بانتظار نتائج البحث…'); };
    P.nearestMosques().then(function (r) {
      list = r;
      var el = App.$('ppList');
      if (!el) return;
      if (!r.length) { el.innerHTML = '<div class="empty">لا توجد مساجد مسجّلة قريبة على الخريطة</div>'; return; }
      el.innerHTML = r.slice(0, 8).map(function (m, k) {
        return '<button class="row mosque-row" data-k="' + k + '">' + App.icon('mosque', 'lead') + '<span class="txt"><b>' + App.esc(m.name) +
          '</b><small>' + App.esc(m.sub || '') + '</small></span><span class="side num">' + App.fmtDist(m.d) + '</span></button>';
      }).join('');
      el.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { App.nav.showPlace(r[+b.dataset.k]); }; });
    }).catch(function () { var el = App.$('ppList'); if (el) el.innerHTML = '<div class="empty">' + App.nav.offMsg() + '</div>'; });
  }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.prayer = { title: 'الصلاة والقبلة والمساجد', render: renderPanel };

  P.tick = function (now) {
    if (!P.today || now.toDateString() !== P.dayKey) P.recalc();
    var pre = App.settings.prePrayer || 0;
    for (var i = 0; i < 6; i++) {
      var d = now - P.today[i];
      var key = P.dayKey + i;
      if (d >= 0 && d < 60000 && !P.alerted[key]) { P.alerted[key] = 1; alertPrayer(i); render(now); }
      if (pre && i !== 1 && d >= -pre * 60000 && d < -pre * 60000 + 60000 && !P.alerted['pre' + key]) {
        P.alerted['pre' + key] = 1;
        preReminder(i, pre);
      }
    }
    var cd = App.$('ppCd');
    if (cd) { var nn = P.next(now); cd.textContent = 'بعد ' + App.countdown(nn.t - now); }
    var nx = P.next(now), left = nx.t - now;
    var pill = App.$('nextPill');
    pill.querySelector('.np-name').textContent = nm(nx.i, nx.t);
    pill.querySelector('.np-time').textContent = App.hmFull(nx.t);
    pill.querySelector('.np-left').textContent = 'بعد ' + App.countdown(left);
    var justNow = -1;
    for (var k = 0; k < 6; k++) if (now - P.today[k] >= 0 && now - P.today[k] < 10 * 60000 && k !== 1) justNow = k;
    pill.classList.toggle('now', justNow >= 0);
    App.$('pcCountdown').textContent = nm(nx.i, nx.t) + ' بعد ' + App.countdown(left);
    if (Math.abs(left) < 1000 || now.getSeconds() === 0) render(now);
  };

  App.on('settings', function () { P.recalc(); });
  P.alertNow = alertPrayer;            // used by the UI test harness
  P.init = function () {
    function retryCity() { if (!P.loc.city && P.loc.lat != null) cityLookup(P.loc.lat, P.loc.lon); }
    App.on('baseReady', retryCity);
    App.on('net', function (on) { if (on) retryCity(); });
    App.$('prayerCard').onclick = function () { App.panels.open('prayer'); };
    App.$('nextPill').onclick = function () { App.panels.open('prayer'); };
    App.map.onPoiTap = function (p) { App.nav.showPlace({ lat: p.lat, lon: p.lon, name: p.name, sub: p.sub }); };
  };
})();
