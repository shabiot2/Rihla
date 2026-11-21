/* home.js — the home screen: clock & greeting, each skin's drawing of the prayer day (ring, sun path,
   neon road, watch dial, rainbow, mihrab), the background scenes, the dune sky that follows the real sun,
   the CarPlay launcher, shortcuts, the smart card and the photo frame of «بناتي». */
(function () {
  'use strict';
  var H = App.home = {};
  function $(id) { return App.$(id); }
  function f1(x) { return Math.round(x * 10) / 10; }
  function mins(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function REM() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 14; }
  function rnd(seed) {                       // small deterministic random, so a scene looks the same every time
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function debounce(fn, ms) { var h; return function () { clearTimeout(h); h = setTimeout(fn, ms); }; }

  // =====================================================================================================
  // clock, dates, greeting
  // =====================================================================================================
  var lastMin = -1, dayKey = '';
  function greeting(now) {
    var h = now.getHours(), k = App.theme.key, name = String(App.car.get().driver || '').trim(), g;
    if (k === 'girls') g = h < 12 ? 'صباح الورد' : h < 18 ? 'مساء الفل' : 'تصبحون على خير';
    else if (k === 'friday') g = 'جمعة مباركة';
    else if (k === 'national') g = 'دام عزّك يا وطن';
    else if (k === 'founding') g = 'يوم بدينا';
    else g = h < 4 ? 'ليلة هادئة' : h < 12 ? 'صباح الخير' : h < 16 ? 'يومك سعيد' : h < 19 ? 'مساء النور' : 'مساء الخير';
    return name && k !== 'national' && k !== 'founding' ? g + ' يا ' + name : g;
  }
  function tick() {
    var now = new Date(), ap = App.ampm(now);
    var html = App.hm(now) + (ap ? '<small>' + ap + '</small>' : '');
    var c = $('clock');
    if (c._h !== html) { c._h = html; c.innerHTML = html; }
    var dk = now.toDateString() + App.settings.digits;
    if (dk !== dayKey) {
      dayKey = dk;
      $('dateHijri').textContent = App.hijriText(now);
      var g;
      try {
        g = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-' + (App.settings.digits === 'arab' ? 'arab' : 'latn'),
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      } catch (e) { g = now.toLocaleDateString(); }
      $('dateGreg').textContent = g;
    }
    var gr = greeting(now), ge = $('hGreet');
    if (ge.textContent !== gr) ge.textContent = gr;
    App.prayer.tick(now);
    if (watch) watch(now);
    if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); minute(now); }
  }
  function minute(now) { drawViz(); sky(now); smart(); }
  H.refresh = function () { dayKey = ''; lastMin = -1; tick(); };

  // =====================================================================================================
  // the prayer day, drawn per skin
  // =====================================================================================================
  var watch = null;
  function day(now) {
    var P = App.prayer, t = P.today, nx = P.next(now);
    return { t: t, nx: nx, name: function (i, d) { return P.name(i, d || t[i]); } };
  }
  function label(x, y, anchor, name, time, cls, vpos) {
    var r = REM(), n = r * .98, tt = r * .84, y1, y2;
    if (vpos === 'above') { y1 = y - tt * 1.35 - 3; y2 = y - 3; }
    else if (vpos === 'below') { y1 = y + n + 1; y2 = y + n + tt * 1.3 + 1; }
    else { y1 = y - 2; y2 = y + tt * 1.25; }
    return '<text class="vl ' + (cls || '') + '" text-anchor="' + anchor + '">' +
      '<tspan class="vn" x="' + f1(x) + '" y="' + f1(y1) + '" style="font-size:' + f1(n) + 'px">' + App.esc(name) + '</tspan>' +
      (time ? '<tspan class="vt" x="' + f1(x) + '" y="' + f1(y2) + '" style="font-size:' + f1(tt) + 'px">' + App.esc(time) + '</tspan>' : '') + '</text>';
  }
  function svg(w, h, inner) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="direction:ltr" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  function cls(i, d, now) { return i === d.nx.i ? 'next' : (!d.nx.tomorrow && d.t[i] < now ? 'past' : ''); }
  var VIZ = {};

  // ---------- مدار: a 24-hour ring around the clock (midnight at the bottom, noon at the top) ----------
  VIZ.ring = function (w, h, now) {
    var d = day(now), t = d.t, cx = w / 2, cy = h / 2, S = Math.min(w, h), rem = REM();
    var R = S / 2 - Math.max(rem * 2.6, S * .1);
    function ang(date) { return mins(date) / 1440 * 2 * Math.PI; }
    function pt(a, r) { return [cx - Math.sin(a) * r, cy + Math.cos(a) * r]; }
    function arc(a1, a2, r) {
      var da = a2 - a1;
      while (da < 0) da += 2 * Math.PI;
      if (da < .002) return '';
      if (da > 2 * Math.PI - .002) da = 2 * Math.PI - .002;
      var p1 = pt(a1, r), p2 = pt(a1 + da, r);
      return 'M' + f1(p1[0]) + ' ' + f1(p1[1]) + 'A' + f1(r) + ' ' + f1(r) + ' 0 ' + (da > Math.PI ? 1 : 0) + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    var o = '<defs><linearGradient id="rgD" gradientUnits="userSpaceOnUse" x1="' + f1(cx - R) + '" y1="0" x2="' + f1(cx + R) + '" y2="0">' +
      '<stop offset="0" style="stop-color:var(--viz-day)"/><stop offset="1" style="stop-color:var(--viz-day2)"/></linearGradient></defs>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f1(R) + '" fill="none" style="stroke:var(--viz-track)" stroke-width="1.5"/>';
    for (var k = 0; k < 24; k++) {
      var a = k / 24 * 2 * Math.PI, big = k % 6 === 0, p1 = pt(a, R - 4), p2 = pt(a, R - (big ? 13 : 8));
      o += '<path d="M' + f1(p1[0]) + ' ' + f1(p1[1]) + 'L' + f1(p2[0]) + ' ' + f1(p2[1]) + '" style="stroke:var(--viz-track)" stroke-width="' + (big ? 2 : 1.2) + '" stroke-linecap="round"/>';
    }
    // a sun at noon and a crescent at midnight, inside the ring
    var sn = pt(Math.PI, R - 26), mn = pt(0, R - 26), sr = rem * .5;
    o += '<g style="stroke:var(--viz-day2)" stroke-width="1.6" stroke-linecap="round" fill="none"><circle cx="' + f1(sn[0]) + '" cy="' + f1(sn[1]) + '" r="' + f1(sr) + '"/>';
    for (k = 0; k < 8; k++) {
      var ra = k * Math.PI / 4, q1 = [sn[0] + Math.cos(ra) * sr * 1.6, sn[1] + Math.sin(ra) * sr * 1.6], q2 = [sn[0] + Math.cos(ra) * sr * 2.2, sn[1] + Math.sin(ra) * sr * 2.2];
      o += '<path d="M' + f1(q1[0]) + ' ' + f1(q1[1]) + 'L' + f1(q2[0]) + ' ' + f1(q2[1]) + '"/>';
    }
    o += '</g><path d="M' + f1(mn[0] + sr * .4) + ' ' + f1(mn[1] - sr * 1.3) + 'a' + f1(sr * 1.3) + ' ' + f1(sr * 1.3) + ' 0 1 0 0 ' + f1(sr * 2.6) +
      'a' + f1(sr * 1.6) + ' ' + f1(sr * 1.6) + ' 0 0 1 0 ' + f1(-sr * 2.6) + 'z" style="fill:var(--viz-night)" opacity=".9"/>';
    // night and day
    o += '<path d="' + arc(ang(t[4]), ang(t[1]) + 2 * Math.PI, R) + '" fill="none" style="stroke:var(--viz-night)" stroke-width="3" opacity=".75" stroke-linecap="round"/>';
    o += '<path d="' + arc(ang(t[1]), ang(t[4]), R) + '" fill="none" stroke="url(#rgD)" stroke-width="5" stroke-linecap="round"/>';
    // what is left until the next prayer
    var cd = arc(ang(now), ang(d.nx.t), R);
    o += '<path d="' + cd + '" fill="none" style="stroke:var(--accent)" stroke-width="12" opacity=".18" stroke-linecap="round"/>' +
      '<path d="' + cd + '" fill="none" style="stroke:var(--accent)" stroke-width="3.2" stroke-linecap="round"/>';
    // the prayers
    for (var i = 0; i < 6; i++) {
      var ai = ang(t[i]), p = pt(ai, R), nx = i === d.nx.i, lp = pt(ai, R + rem * 1.25);
      o += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (nx ? 7.5 : i === 1 ? 4 : 5.5) + '" style="fill:' + (nx ? 'var(--accent)' : 'var(--bg2)') +
        ';stroke:' + (i === 1 ? 'var(--viz-day2)' : 'var(--accent)') + '" stroke-width="2.2"/>';
      var anchor = lp[0] < cx - 12 ? 'end' : lp[0] > cx + 12 ? 'start' : 'middle';
      var vpos = lp[1] < cy - R * .82 ? 'above' : lp[1] > cy + R * .82 ? 'below' : 'mid';
      o += label(lp[0], lp[1], anchor, d.name(i), App.hm(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]), cls(i, d, now) + (i === 1 ? ' sun' : ''), vpos);
    }
    var pn = pt(ang(now), R);
    o += '<circle cx="' + f1(pn[0]) + '" cy="' + f1(pn[1]) + '" r="12" style="fill:var(--text)" opacity=".16"/>' +
      '<circle cx="' + f1(pn[0]) + '" cy="' + f1(pn[1]) + '" r="5.5" style="fill:var(--text)"/>';
    return svg(w, h, o);
  };

  // ---------- كثبان: the sun's path from sunrise (right) to sunset (left); the moon's at night ----------
  VIZ.sun = function (w, h, now) {
    var d = day(now), t = d.t, rem = REM(), P = App.prayer;
    var padX = Math.max(rem * 4.4, w * .08), horizon = h - Math.max(rem * 2.7, h * .21), top = Math.max(rem * .9, h * .1);
    var xR = w - padX, xL = padX, isDay = now >= t[1] && now < t[4], a0, a1, marks;
    var DAY = 864e5;
    if (isDay) { a0 = t[1]; a1 = t[4]; marks = [[1, t[1]], [2, t[2]], [3, t[3]], [4, t[4]]]; }
    else if (now >= t[4]) {
      a0 = t[4]; a1 = new Date(t[1].getTime() + DAY);
      marks = [[4, t[4]], [5, t[5]], [0, P.tomorrow[0]], [1, a1]];
    } else {
      a0 = new Date(t[4].getTime() - DAY); a1 = t[1];
      marks = [[4, a0], [5, new Date(t[5].getTime() - DAY)], [0, t[0]], [1, t[1]]];
    }
    function pos(date) {
      var p = Math.max(0, Math.min(1, (date - a0) / (a1 - a0)));
      return [xR - p * (xR - xL), horizon - (horizon - top) * Math.sin(Math.PI * p), p];
    }
    function path(p0, p1) {
      var s = '', n = 48;
      for (var k = 0; k <= n; k++) {
        var p = p0 + (p1 - p0) * k / n, x = xR - p * (xR - xL), y = horizon - (horizon - top) * Math.sin(Math.PI * p);
        s += (k ? 'L' : 'M') + f1(x) + ' ' + f1(y);
      }
      return s;
    }
    var pn = pos(now);
    var o = '<defs><radialGradient id="sunG"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset=".45" style="stop-color:var(--viz-sun)" stop-opacity=".55"/>' +
      '<stop offset="1" style="stop-color:var(--viz-sun)" stop-opacity="0"/></radialGradient>' +
      '<mask id="moonM"><circle cx="0" cy="0" r="11" fill="#fff"/><circle cx="5" cy="-4" r="9.5" fill="#000"/></mask></defs>';
    o += '<path d="M0 ' + f1(horizon) + 'H' + w + '" style="stroke:var(--viz-track)" stroke-width="1.5"/>';
    o += '<path d="' + path(0, 1) + '" fill="none" style="stroke:var(--text)" stroke-opacity=".32" stroke-width="2" stroke-dasharray="1.5 7" stroke-linecap="round"/>';
    o += '<path d="' + path(0, pn[2]) + '" fill="none" style="stroke:' + (isDay ? 'var(--accent)' : 'var(--muted)') + '" stroke-width="3.2" stroke-linecap="round"/>';
    marks.forEach(function (m, k) {
      var p = pos(m[1]), end = k === 0 || k === marks.length - 1, i = m[0];
      var c = i === d.nx.i ? 'next' : (m[1] < now ? 'past' : '');
      o += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (c === 'next' ? 6.5 : 4.5) + '" style="fill:' + (c === 'next' ? 'var(--accent)' : c === 'past' ? 'var(--text)' : 'var(--sky-b, var(--bg2))') +
        ';stroke:' + (c === 'next' ? 'var(--accent)' : 'var(--text)') + '" stroke-opacity=".7" stroke-width="2"/>';
      o += label(p[0], end ? horizon + 4 : p[1] - 8, 'middle', d.name(i, m[1]), App.hm(m[1]), c, end ? 'below' : 'above');
    });
    if (isDay) {
      o += '<circle cx="' + f1(pn[0]) + '" cy="' + f1(pn[1]) + '" r="' + f1(rem * 2.4) + '" fill="url(#sunG)"/>' +
        '<circle cx="' + f1(pn[0]) + '" cy="' + f1(pn[1]) + '" r="' + f1(rem * .85) + '" style="fill:var(--viz-sun)"/>';
    } else {
      o += '<g transform="translate(' + f1(pn[0]) + ' ' + f1(pn[1]) + ')"><circle r="' + f1(rem * 1.9) + '" fill="#fff3d6" opacity=".12"/>' +
        '<circle r="11" fill="#fff3d6" mask="url(#moonM)"/></g>';
    }
    return svg(w, h, o);
  };

  // ---------- نيون: the whole day as one lit road, midnight on the right ----------
  VIZ.line = function (w, h, now) {
    var d = day(now), t = d.t, rem = REM(), padX = Math.max(rem * 2.4, w * .035), y = Math.round(h * .5);
    function x(date) { return w - padX - mins(date) / 1440 * (w - 2 * padX); }
    var xn = x(now), o = '';
    o += '<path d="M' + f1(padX) + ' ' + y + 'H' + f1(w - padX) + '" stroke="#00f0ff" stroke-width="9" stroke-opacity=".1" stroke-linecap="round"/>' +
      '<path d="M' + f1(padX) + ' ' + y + 'H' + f1(w - padX) + '" stroke="#00f0ff" stroke-width="2" stroke-opacity=".55" stroke-linecap="round"/>' +
      '<path d="M' + f1(w - padX) + ' ' + y + 'H' + f1(xn) + '" stroke="#ff2bd6" stroke-width="12" stroke-opacity=".22" stroke-linecap="round"/>' +
      '<path d="M' + f1(w - padX) + ' ' + y + 'H' + f1(xn) + '" stroke="#ff7be8" stroke-width="3" stroke-linecap="round"/>';
    var showHours = h > rem * 7.2;
    for (var k = 0; k <= 24; k++) {
      var xx = w - padX - k / 24 * (w - 2 * padX), big = k % 3 === 0;
      o += '<path d="M' + f1(xx) + ' ' + (y + 5) + 'v' + (big ? 7 : 4) + '" stroke="#00f0ff" stroke-opacity="' + (big ? .6 : .3) + '" stroke-width="1.4"/>';
      if (showHours && big && k < 24) o += '<text x="' + f1(xx) + '" y="' + f1(h - 3) + '" text-anchor="middle" style="font-family:var(--f-clock);font-size:' + f1(rem * .62) +
        'px;fill:#b48bd6">' + App.d(App.pad(k)) + '</text>';
    }
    for (var i = 0; i < 6; i++) {
      var xi = x(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]), c = cls(i, d, now), nx = c === 'next', s = nx ? 8 : 5.5;
      if (nx) o += '<circle class="vpulse" cx="' + f1(xi) + '" cy="' + y + '" r="9" fill="none" stroke="#ff2bd6" stroke-width="2"/>';
      o += '<rect x="' + f1(xi - s) + '" y="' + f1(y - s) + '" width="' + f1(2 * s) + '" height="' + f1(2 * s) + '" transform="rotate(45 ' + f1(xi) + ' ' + y + ')" fill="' +
        (nx ? '#ff2bd6' : c === 'past' ? '#7a2a83' : '#0b0221') + '" stroke="' + (i === 1 ? '#ffd319' : nx ? '#fff' : '#00f0ff') + '" stroke-width="1.6"/>';
      o += '<text text-anchor="middle" class="vl ' + c + '"><tspan class="vn" x="' + f1(xi) + '" y="' + f1(y - s - 7) + '" style="font-size:' + f1(rem * (nx ? 1.08 : .92)) + 'px">' +
        App.esc(d.name(i)) + '</tspan><tspan class="vt" x="' + f1(xi) + '" y="' + f1(y + s + rem * 1.25) + '" style="font-family:var(--f-clock);font-size:' + f1(rem * .78) + 'px">' +
        App.hm(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]) + '</tspan></text>';
    }
    o += '<path d="M' + f1(xn) + ' ' + (y - 16) + 'V' + (y + 16) + '" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="' + f1(xn) + '" cy="' + y + '" r="10" fill="#ff2bd6" opacity=".35"/><circle cx="' + f1(xn) + '" cy="' + y + '" r="4.5" fill="#fff"/>';
    return svg(w, h, o);
  };

  // ---------- فخامة: a watch — gold bezel, the time to the next prayer as an arc on the bezel ----------
  VIZ.watch = function (w, h, now) {
    var d = day(now), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 3, o = '';
    function pt(deg, r) { var a = (deg - 90) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    function deg12(date) { return ((date.getHours() % 12) + date.getMinutes() / 60) * 30; }
    o += '<defs><radialGradient id="wDial" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#24201a"/><stop offset=".7" stop-color="#14110d"/><stop offset="1" stop-color="#0c0a08"/></radialGradient>' +
      '<linearGradient id="wGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7e0"/><stop offset=".38" stop-color="#ead08c"/><stop offset=".55" stop-color="#8a6a33"/><stop offset="1" stop-color="#f3dca6"/></linearGradient>' +
      '<linearGradient id="wGold2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7ae"/><stop offset=".5" stop-color="#c9a45c"/><stop offset="1" stop-color="#f6dc9c"/></linearGradient></defs>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f1(R * .975) + '" fill="#0b0907" stroke="url(#wGold)" stroke-width="' + f1(R * .05) + '"/>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f1(R * .9) + '" fill="url(#wDial)" stroke="#e3be6a" stroke-opacity=".35" stroke-width="1"/>';
    // minute track + hour indices
    for (var k = 0; k < 60; k++) {
      var hr = k % 5 === 0, a1 = pt(k * 6, R * .87), a2 = pt(k * 6, R * (hr ? .74 : .835));
      if (hr) {
        var two = k === 0;
        [-1, 1].slice(0, two ? 2 : 1).forEach(function (sgn) {
          var off = two ? sgn * 1.6 : 0, b1 = pt(k * 6 + off, R * .87), b2 = pt(k * 6 + off, R * .74);
          o += '<path d="M' + f1(b1[0]) + ' ' + f1(b1[1]) + 'L' + f1(b2[0]) + ' ' + f1(b2[1]) + '" stroke="url(#wGold2)" stroke-width="' + f1(R * .028) + '" stroke-linecap="square"/>';
        });
      } else o += '<path d="M' + f1(a1[0]) + ' ' + f1(a1[1]) + 'L' + f1(a2[0]) + ' ' + f1(a2[1]) + '" stroke="#e3be6a" stroke-opacity=".5" stroke-width="1"/>';
    }
    // numerals 12 · 6 · 9 and a date window at 3
    var fs = R * .13;
    [[0, '12'], [270, '9']].forEach(function (n) {
      var p = pt(n[0], R * .6);
      o += '<text x="' + f1(p[0]) + '" y="' + f1(p[1] + fs * .36) + '" text-anchor="middle" style="font-family:var(--f-clock);font-size:' + f1(fs) + 'px" fill="#ead08c">' + App.d(n[1]) + '</text>';
    });
    var dw = R * .2, dh = R * .14, dx = cx + R * .5;
    o += '<rect x="' + f1(dx) + '" y="' + f1(cy - dh / 2) + '" width="' + f1(dw) + '" height="' + f1(dh) + '" rx="2" fill="#f4ead0" stroke="url(#wGold)" stroke-width="2"/>' +
      '<text x="' + f1(dx + dw / 2) + '" y="' + f1(cy + dh * .3) + '" text-anchor="middle" style="font-family:var(--f-clock);font-weight:700;font-size:' + f1(dh * .78) + 'px" fill="#241806">' + App.d(now.getDate()) + '</text>';
    o += '<text x="' + cx + '" y="' + f1(cy - R * .3) + '" text-anchor="middle" style="font-family:var(--f-disp);font-size:' + f1(R * .1) + 'px;letter-spacing:.05em" fill="#e3be6a">رحلة</text>';
    // the next prayer: a sub-dial line and the arc on the bezel
    var nxName = d.name(d.nx.i, d.nx.t);
    o += '<text x="' + cx + '" y="' + f1(cy + R * .4) + '" text-anchor="middle" style="font-family:var(--f-disp);font-weight:700;font-size:' + f1(R * .12) + 'px" fill="#ffe7ae">' + App.esc(nxName) + '</text>' +
      '<text x="' + cx + '" y="' + f1(cy + R * .53) + '" text-anchor="middle" style="font-family:var(--f-clock);font-size:' + f1(R * .085) + 'px" fill="#b19f78">' + App.hmFull(d.nx.t) + '</text>';
    var left = d.nx.t - now;
    if (left > 0 && left < 12 * 3600e3) {
      var s0 = deg12(now), s1 = s0 + left / 3600e3 * 30, rr = R * .935;
      var p0 = pt(s0, rr), p1 = pt(s1, rr);
      o += '<path d="M' + f1(p0[0]) + ' ' + f1(p0[1]) + 'A' + f1(rr) + ' ' + f1(rr) + ' 0 ' + (s1 - s0 > 180 ? 1 : 0) + ' 1 ' + f1(p1[0]) + ' ' + f1(p1[1]) +
        '" fill="none" stroke="#ffe7ae" stroke-width="' + f1(R * .03) + '" stroke-linecap="round"/>';
    }
    for (var i = 0; i < 6; i++) {
      var ti = i === 0 && d.nx.tomorrow ? d.nx.t : d.t[i], dt = ti - now;
      if (dt < 0 || dt > 12 * 3600e3) continue;
      var pm = pt(deg12(ti), R * .935), s = i === d.nx.i ? R * .03 : R * .02;
      o += '<rect x="' + f1(pm[0] - s) + '" y="' + f1(pm[1] - s) + '" width="' + f1(2 * s) + '" height="' + f1(2 * s) + '" transform="rotate(45 ' + f1(pm[0]) + ' ' + f1(pm[1]) + ')" fill="' +
        (i === d.nx.i ? '#fff7e0' : '#c9a45c') + '"/>';
    }
    // hands
    function hand(id, len, wid, tail, fill) {
      return '<path id="' + id + '" d="M' + f1(cx - wid) + ' ' + f1(cy + tail) + 'L' + f1(cx - wid * .55) + ' ' + f1(cy - len * .82) + 'L' + cx + ' ' + f1(cy - len) +
        'L' + f1(cx + wid * .55) + ' ' + f1(cy - len * .82) + 'L' + f1(cx + wid) + ' ' + f1(cy + tail) + 'Z" fill="' + fill + '" stroke="#5a4520" stroke-width=".6"/>';
    }
    o += hand('wH', R * .5, R * .04, R * .1, 'url(#wGold)') + hand('wM', R * .76, R * .028, R * .12, 'url(#wGold)');
    o += '<g id="wS"><path d="M' + cx + ' ' + f1(cy + R * .18) + 'V' + f1(cy - R * .82) + '" stroke="#e8c77d" stroke-width="' + f1(Math.max(1.2, R * .008)) + '"/>' +
      '<circle cx="' + cx + '" cy="' + f1(cy + R * .13) + '" r="' + f1(R * .03) + '" fill="#e8c77d"/></g>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f1(R * .035) + '" fill="url(#wGold)"/><circle cx="' + cx + '" cy="' + cy + '" r="' + f1(R * .012) + '" fill="#241806"/>';
    return svg(w, h, o);
  };
  function bindWatch(box, w, h) {
    var cx = w / 2, cy = h / 2, hH = box.querySelector('#wH'), hM = box.querySelector('#wM'), hS = box.querySelector('#wS');
    watch = function (now) {
      var s = now.getSeconds(), m = now.getMinutes() + s / 60, hr = (now.getHours() % 12) + m / 60;
      hH.setAttribute('transform', 'rotate(' + f1(hr * 30) + ' ' + cx + ' ' + cy + ')');
      hM.setAttribute('transform', 'rotate(' + f1(m * 6) + ' ' + cx + ' ' + cy + ')');
      hS.setAttribute('transform', 'rotate(' + (s * 6) + ' ' + cx + ' ' + cy + ')');
    };
    watch(new Date());
  }

  // ---------- بناتي: a rainbow from Fajr (right) to Isha (left) with a little sun travelling on it ----------
  VIZ.rainbow = function (w, h, now) {
    var d = day(now), t = d.t, rem = REM(), cx = w / 2, cy = h - rem * 1.2;
    var band = Math.max(8, Math.min(w, h) * .032), Ro = Math.min(w / 2 - rem * 4.4, cy - rem * 2.6);
    var cols = ['#ffb3cb', '#ffd3a1', '#fff09a', '#aef0c8', '#a6dcff', '#cbb8ff'], o = '';
    cols.forEach(function (c, k) {
      var r = Ro - k * band;
      o += '<path d="M' + f1(cx - r) + ' ' + f1(cy) + 'A' + f1(r) + ' ' + f1(r) + ' 0 0 1 ' + f1(cx + r) + ' ' + f1(cy) + '" fill="none" stroke="' + c + '" stroke-width="' + f1(band + .6) + '"/>';
    });
    function cloud(x, y, s) {
      return '<g fill="#fff"><ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(s * 1.6) + '" ry="' + f1(s * .7) + '"/><circle cx="' + f1(x - s * .55) + '" cy="' + f1(y - s * .35) + '" r="' + f1(s * .62) + '"/>' +
        '<circle cx="' + f1(x + s * .35) + '" cy="' + f1(y - s * .5) + '" r="' + f1(s * .78) + '"/></g>';
    }
    var mid = Ro - band * 2.5;
    o += cloud(cx - mid, cy - 2, band * 2.1) + cloud(cx + mid, cy - 2, band * 2.1);
    var a0 = t[0], a1 = t[5], rr = Ro + band / 2 + 5;
    function pt(date) {
      var p = Math.max(0, Math.min(1, (date - a0) / (a1 - a0))), th = p * Math.PI;
      return [cx + Math.cos(th) * rr, cy - Math.sin(th) * rr, th];
    }
    for (var i = 0; i < 6; i++) {
      var p = pt(t[i]), c = cls(i, d, now), lr = rr + rem * 1.1, lx = cx + Math.cos(p[2]) * lr, ly = cy - Math.sin(p[2]) * lr;
      o += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (c === 'next' ? 7 : 5) + '" fill="' + (c === 'next' ? '#ff6b9a' : '#fff') + '" stroke="#ff8fb1" stroke-width="2.4"/>';
      var anchor = lx < cx - 14 ? 'end' : lx > cx + 14 ? 'start' : 'middle';
      o += label(lx, ly, anchor, d.name(i), App.hm(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]), c, ly < cy - rr * .8 ? 'above' : 'mid');
    }
    var day0 = now >= a0 && now <= a1, q = pt(day0 ? now : (now < a0 ? a0 : a1)), sx = q[0], sy = q[1], s = rem * .95;
    if (day0) {
      o += '<g transform="translate(' + f1(sx) + ' ' + f1(sy) + ')"><circle r="' + f1(s * 2.2) + '" fill="#fff4b0" opacity=".45"/>';
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
        o += '<path d="M' + f1(Math.cos(a) * s * 1.25) + ' ' + f1(Math.sin(a) * s * 1.25) + 'L' + f1(Math.cos(a) * s * 1.7) + ' ' + f1(Math.sin(a) * s * 1.7) + '" stroke="#ffb02e" stroke-width="2.4" stroke-linecap="round"/>';
      }
      o += '<circle r="' + f1(s) + '" fill="#ffd23f" stroke="#ffb02e" stroke-width="1.6"/><circle cx="' + f1(-s * .33) + '" cy="' + f1(-s * .12) + '" r="' + f1(s * .11) + '" fill="#7a3d52"/>' +
        '<circle cx="' + f1(s * .33) + '" cy="' + f1(-s * .12) + '" r="' + f1(s * .11) + '" fill="#7a3d52"/><path d="M' + f1(-s * .35) + ' ' + f1(s * .22) + 'Q0 ' + f1(s * .55) + ' ' + f1(s * .35) + ' ' + f1(s * .22) +
        '" fill="none" stroke="#7a3d52" stroke-width="1.6" stroke-linecap="round"/><circle cx="' + f1(-s * .62) + '" cy="' + f1(s * .2) + '" r="' + f1(s * .16) + '" fill="#ff8fb1" opacity=".7"/>' +
        '<circle cx="' + f1(s * .62) + '" cy="' + f1(s * .2) + '" r="' + f1(s * .16) + '" fill="#ff8fb1" opacity=".7"/></g>';
    } else {
      o += '<g transform="translate(' + f1(sx) + ' ' + f1(sy - s * 1.6) + ')"><path d="M' + f1(s * .3) + ' ' + f1(-s) + 'a' + f1(s) + ' ' + f1(s) + ' 0 1 0 0 ' + f1(2 * s) +
        'a' + f1(s * 1.25) + ' ' + f1(s * 1.25) + ' 0 0 1 0 ' + f1(-2 * s) + 'z" fill="#fff09a" stroke="#f2c94c" stroke-width="1.4"/>' +
        '<text x="' + f1(s * 1.2) + '" y="' + f1(-s * .8) + '" style="font-size:' + f1(s * .9) + 'px;font-weight:800" fill="#b9a6ff">z</text></g>';
    }
    return svg(w, h, o);
  };

  // ---------- الجمعة: a mihrab with a lamp; the five prayers as medallions along its base ----------
  VIZ.arch = function (w, h, now) {
    var d = day(now), t = d.t, rem = REM(), cx = w / 2;
    var aw = Math.min(w * .94, h * .9), L = (w - aw) / 2, Rr = L + aw, base = h - 2, top = 4, ah = base - top;
    var spring = base - ah * .5;
    function arch(ins) {
      var l = L + ins, r = Rr - ins, tp = top + ins * 1.4;
      return 'M' + f1(l) + ' ' + base + 'V' + f1(spring) + 'C' + f1(l) + ' ' + f1(spring - ah * .27) + ' ' + f1(cx - aw * .09) + ' ' + f1(tp + ah * .1) + ' ' + cx + ' ' + f1(tp) +
        'C' + f1(cx + aw * .09) + ' ' + f1(tp + ah * .1) + ' ' + f1(r) + ' ' + f1(spring - ah * .27) + ' ' + f1(r) + ' ' + f1(spring) + 'V' + base;
    }
    var o = '<defs><linearGradient id="aF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a" stop-opacity=".16"/><stop offset=".55" stop-color="#0b3d2e" stop-opacity=".15"/>' +
      '<stop offset="1" stop-color="#03140e" stop-opacity=".45"/></linearGradient><radialGradient id="aL"><stop offset="0" stop-color="#fff2b8"/><stop offset=".4" stop-color="#ffcc5c" stop-opacity=".5"/>' +
      '<stop offset="1" stop-color="#ffb030" stop-opacity="0"/></radialGradient></defs>';
    o += '<path d="' + arch(9) + 'Z" fill="url(#aF)"/>';
    o += '<path d="' + arch(0) + '" fill="none" stroke="#e3be6a" stroke-width="2.4"/><path d="' + arch(9) + '" fill="none" stroke="#e3be6a" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<path d="' + arch(15) + '" fill="none" stroke="#e3be6a" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray=".1 7" stroke-linecap="round"/>';
    // the lamp hanging from the apex
    var ly = top + ah * .2;
    o += '<path d="M' + cx + ' ' + f1(top + 18) + 'V' + f1(ly - 8) + '" stroke="#c9a04e" stroke-width="1.2"/><circle cx="' + cx + '" cy="' + f1(ly + 6) + '" r="' + f1(rem * 2.6) + '" fill="url(#aL)" opacity=".7"/>' +
      '<path d="M' + f1(cx - 6) + ' ' + f1(ly - 8) + 'h12l3 5h-18z" fill="#e3be6a"/><path d="M' + f1(cx - 9) + ' ' + f1(ly - 3) + 'h18l-3 16h-12z" fill="#ffd27a" fill-opacity=".35" stroke="#e3be6a" stroke-width="1.3"/>' +
      '<ellipse cx="' + cx + '" cy="' + f1(ly + 5) + '" rx="2.6" ry="4.4" fill="#fff4c2"/><path d="M' + f1(cx - 4) + ' ' + f1(ly + 13) + 'h8l-2 4h-4z" fill="#e3be6a"/>';
    // medallions
    var five = [0, 2, 3, 4, 5], inner = aw - 34, mw = inner / 5, my = base - rem * 2.3;
    five.forEach(function (i, k) {
      var x = L + 17 + inner - mw * (k + .5), c = cls(i, d, now), on = c === 'next';
      o += '<rect x="' + f1(x - mw * .44) + '" y="' + f1(my - rem * .95) + '" width="' + f1(mw * .88) + '" height="' + f1(rem * 1.9) + '" rx="' + f1(rem * .95) + '" fill="' +
        (on ? '#e3be6a' : 'rgba(5,32,24,.85)') + '" stroke="#e3be6a" stroke-opacity="' + (c === 'past' ? .3 : .8) + '" stroke-width="1.2"/>' +
        '<text x="' + f1(x) + '" y="' + f1(my + rem * .33) + '" text-anchor="middle" style="font-family:var(--f-ui);font-weight:700;font-size:' + f1(rem * .82) + 'px" fill="' +
        (on ? '#1d1606' : c === 'past' ? '#7f8a6f' : '#fbf4e2') + '">' + App.esc(d.name(i)) + '</text>' +
        '<text x="' + f1(x) + '" y="' + f1(my + rem * 1.95) + '" text-anchor="middle" style="font-size:' + f1(rem * .76) + 'px" fill="' + (on ? '#ffe6a8' : '#c9bf9b') + '">' +
        App.hm(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]) + '</text>';
    });
    return svg(w, h, o);
  };

  // ---------- زجاج: one glass arc of light from Fajr to Isha, beads for the prayers, a glowing orb for now ----------
  VIZ.halo = function (w, h, now) {
    var d = day(now), t = d.t, rem = REM(), cx = w / 2, cy = h - rem * 1.2, o = '';
    var band = Math.max(5, Math.min(w, h) * .022), Ro = Math.min(w / 2 - rem * 4.4, cy - rem * 2.6);
    o += '<defs><linearGradient id="hGl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/>' +
      '<stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient>' +
      '<radialGradient id="hOrb" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".85"/>' +
      '<stop offset="1" style="stop-color:var(--accent)" stop-opacity=".95"/></radialGradient></defs>';
    [[0, .16, 0], [1, .28, 1], [2, .1, 2]].forEach(function (k) {   // the glass band: two soft rims and a bright core
      var r = Ro - k[2] * band * .9;
      o += '<path d="M' + f1(cx - r) + ' ' + f1(cy) + 'A' + f1(r) + ' ' + f1(r) + ' 0 0 1 ' + f1(cx + r) + ' ' + f1(cy) + '" fill="none" stroke="#fff" stroke-opacity="' + k[1] +
        '" stroke-width="' + f1(band * (k[0] === 1 ? 1 : 1.4)) + '" stroke-linecap="round"/>';
    });
    o += '<path d="M' + f1(cx - Ro) + ' ' + f1(cy) + 'A' + f1(Ro) + ' ' + f1(Ro) + ' 0 0 1 ' + f1(cx + Ro) + ' ' + f1(cy) + '" fill="none" stroke="url(#hGl)" stroke-width="1.6" stroke-linecap="round"/>';
    var a0 = t[0], a1 = t[5], rr = Ro;
    function pt(date) {
      var p = Math.max(0, Math.min(1, (date - a0) / (a1 - a0))), th = p * Math.PI;
      return [cx + Math.cos(th) * rr, cy - Math.sin(th) * rr, th];
    }
    var day0 = now >= a0 && now <= a1;
    if (day0) {   // the part of the day already travelled glows in the accent colour
      var q0 = pt(now);
      o += '<path d="M' + f1(cx + Ro) + ' ' + f1(cy) + 'A' + f1(Ro) + ' ' + f1(Ro) + ' 0 0 0 ' + f1(q0[0]) + ' ' + f1(q0[1]) + '" fill="none" style="stroke:var(--accent)" stroke-width="' + f1(band * .8) + '" stroke-linecap="round" opacity=".9"/>';
    }
    for (var i = 0; i < 6; i++) {
      var p = pt(t[i]), c = cls(i, d, now), nx = c === 'next', lr = rr + rem * 1.3, lx = cx + Math.cos(p[2]) * lr, ly = cy - Math.sin(p[2]) * lr;
      o += (nx ? '<circle class="vpulse" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="10" fill="none" style="stroke:var(--accent)" stroke-width="2"/>' : '') +
        '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (nx ? 8 : 5.5) + '" fill="' + (nx ? 'url(#hOrb)' : 'rgba(255,255,255,.28)') + '" stroke="#fff" stroke-opacity="' + (c === 'past' ? .45 : .95) + '" stroke-width="1.6"/>';
      var anchor = lx < cx - 14 ? 'end' : lx > cx + 14 ? 'start' : 'middle';
      o += label(lx, ly, anchor, d.name(i), App.hm(i === 0 && d.nx.tomorrow ? d.nx.t : t[i]), c, ly < cy - rr * .8 ? 'above' : 'mid');
    }
    var q = pt(day0 ? now : (now < a0 ? a0 : a1)), s = rem * .8;
    o += '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + f1(s * 2.1) + '" style="fill:var(--accent)" opacity=".28"/>' +
      '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + f1(s) + '" fill="url(#hOrb)" stroke="#fff" stroke-opacity=".9" stroke-width="1.4"/>' +
      '<ellipse cx="' + f1(q[0] - s * .3) + '" cy="' + f1(q[1] - s * .38) + '" rx="' + f1(s * .34) + '" ry="' + f1(s * .2) + '" fill="#fff" opacity=".9"/>';
    return svg(w, h, o);
  };

  function drawViz() {
    var box = $('wViz'), kind = App.theme.cur ? App.theme.cur.viz : 'none';
    watch = null;
    if (!App.prayer.today || kind === 'none' || !VIZ[kind]) { box.innerHTML = ''; return; }
    var r = box.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 40 || h < 40) return;
    try {
      box.innerHTML = VIZ[kind](w, h, new Date());
      if (kind === 'watch') bindWatch(box, w, h);
    } catch (e) { box.innerHTML = ''; }
  }
  H.drawViz = drawViz;

  // =====================================================================================================
  // background scenes (only the active skin's exists)
  // =====================================================================================================
  function stars(n, maxY, seed) {
    var r = rnd(seed || 7), W = window.innerWidth, Hh = window.innerHeight * (maxY || 1), sh = [];
    for (var i = 0; i < n; i++) {
      var a = (.3 + r() * .7).toFixed(2), s = r() < .14 ? 1 : 0;
      sh.push(Math.round(r() * W) + 'px ' + Math.round(r() * Hh) + 'px 0 ' + s + 'px rgba(255,255,255,' + a + ')');
    }
    return '<i class="stars" style="box-shadow:' + sh.join(',') + '"></i>';
  }
  function dunes() {
    return '<svg class="dunes" viewBox="0 0 1200 400" preserveAspectRatio="none">' +
      '<path class="d1" d="M0 200C150 150 300 165 460 196S760 128 940 160 1130 205 1200 186V400H0Z"/>' +
      '<path class="d2" d="M0 262C190 220 380 236 560 272S900 226 1060 240 1170 262 1200 256V400H0Z"/>' +
      '<path class="d3" d="M0 330C230 296 430 312 650 342S1010 300 1200 322V400H0Z"/></svg>';
  }
  function mountains() {
    return '<svg class="nmtn" viewBox="0 0 1200 160" preserveAspectRatio="none"><path d="M0 160V118L70 92 130 112 210 60 280 104 340 84 420 120 480 98 540 112 600 70 660 108 720 92 790 116 860 56 930 100 1000 86 1060 110 1130 74 1200 104V160Z" ' +
      'fill="#12032a" stroke="#ff2bd6" stroke-opacity=".75" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  }
  function lantern(c) {
    return '<i class="lantern ' + c + '"><svg viewBox="0 0 44 140"><defs><radialGradient id="lg' + c + '"><stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/>' +
      '<stop offset=".5" stop-color="#ffcc5c" stop-opacity=".45"/><stop offset="1" stop-color="#ffb030" stop-opacity="0"/></radialGradient></defs>' +
      '<path d="M22 0V60" stroke="#c9a04e" stroke-width="1.1"/><circle cx="22" cy="91" r="34" fill="url(#lg' + c + ')" opacity=".6"/>' +
      '<circle cx="22" cy="58" r="3" fill="none" stroke="#e3be6a" stroke-width="1.4"/><path d="M15 67h14l-3-6h-8z" fill="#e3be6a"/>' +
      '<path d="M14 69h16l5 14-5 29H14L9 83z" fill="#ffd27a" fill-opacity=".22" stroke="#e3be6a" stroke-width="1.5"/>' +
      '<path d="M22 69v43M9 83h26M11.5 98h21" stroke="#e3be6a" stroke-opacity=".55" stroke-width="1"/><ellipse cx="22" cy="91" rx="3.4" ry="6" fill="#fff3bf"/>' +
      '<path d="M15 112h14l-3 6h-8z" fill="#e3be6a"/><path d="M22 118v7" stroke="#e3be6a" stroke-width="1.4"/><circle cx="22" cy="128" r="2.4" fill="#e3be6a"/></svg></i>';
  }
  function girlsScene() {
    var r = rnd(11), o = '<i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i><i class="cloud c4"></i>';
    var star = '<svg viewBox="0 0 24 24"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z" fill="FILL"/></svg>';
    for (var i = 0; i < 12; i++) {
      o += '<i class="twk" style="top:' + (4 + r() * 88).toFixed(1) + '%;left:' + (2 + r() * 95).toFixed(1) + '%;animation-delay:-' + (r() * 3.2).toFixed(2) + 's;' +
        'width:' + (.8 + r() * .9).toFixed(2) + 'rem;height:' + (.8 + r() * .9).toFixed(2) + 'rem">' + star.replace('FILL', ['#ffd86b', '#ff9fc0', '#c9b6ff', '#ffffff'][i % 4]) + '</i>';
    }
    var heart = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 6-8 11-8 11z" fill="#ff8fb1"/></svg>';
    [12, 48, 83].forEach(function (x, k) { o += '<i class="hrt" style="left:' + x + '%;animation-delay:-' + (k * 7.3) + 's">' + heart + '</i>'; });
    return o;
  }
  var SCENES = {
    orbit: function () { return '<i class="aur a1"></i><i class="aur a2"></i><i class="aur a3"></i>' + stars(110, 1, 7); },
    national: function () { return '<i class="fx-pat"></i><i class="sweep"></i>'; },
    dune: function () { return '<i class="sky"></i>' + stars(90, .6, 3) + dunes(); },
    founding: function () { return '<i class="sky"></i>' + stars(70, .55, 5) + dunes(); },
    neon: function () { return stars(90, .6, 9) + '<i class="nsun-glow"></i><i class="nsun"></i><i class="nhaze"></i>' + mountains() + '<div class="nfloor"><i class="ngrid"></i></div>'; },
    luxe: function () { return '<i class="lsheen"></i>'; },
    pure: function () { return ''; },
    girls: girlsScene,
    glass: function () { return '<i class="gbg" id="gbg"></i><i class="gshade"></i><i class="gorb o1"></i><i class="gorb o2"></i><i class="gorb o3"></i><i class="gsheen"></i>'; },
    friday: function () { return '<i class="fx-pat"></i><i class="fglow"></i>' + lantern('l1') + lantern('l2'); }
  };
  function scene() {
    var k = App.theme.key, fx = $('fx');
    fx.innerHTML = SCENES[k] ? SCENES[k]() : '';
    fx.setAttribute('data-for', k);
  }

  // ---------- the dune sky follows the real sun ----------
  var PAL = {   // sky top, sky middle, horizon, three dune layers (back → front), stars
    night: ['#0b1030', '#2a2350', '#4a3560', '#3a2c3e', '#2c2032', '#1f1626', 1],
    dawn: ['#1c2350', '#6a4f7d', '#c9806a', '#6e4a4a', '#533845', '#3a2735', .45],
    rise: ['#6fa6d8', '#f6c48f', '#f5a26b', '#e3a86a', '#c98a4f', '#a96a35', 0],
    day: ['#7cbcf0', '#d6ebf6', '#f3dcb4', '#f0c48a', '#e2a865', '#c98a47', 0],
    gold: ['#6b8fd0', '#f7c98b', '#f39a5a', '#e9a55f', '#cf8645', '#ad6631', 0],
    set: ['#3a3f7a', '#d9756a', '#f0a15c', '#9c5f45', '#7a4636', '#5a3128', .15]
  };
  var SKYV = ['--sky-a', '--sky-b', '--sky-c', '--dune-1', '--dune-2', '--dune-3'];
  function sky(now) {
    var b = document.body, st = b.style;
    if (App.theme.key !== 'dune' || !App.prayer.today) {
      SKYV.concat(['--star-o']).forEach(function (v) { st.removeProperty(v); });
      b.classList.remove('sky-night');
      return;
    }
    var t = App.prayer.today, M = 60000, K = [
      [t[0].getTime() - 60 * M, PAL.night], [t[0].getTime(), PAL.dawn], [t[1].getTime(), PAL.rise], [t[1].getTime() + 100 * M, PAL.day],
      [t[4].getTime() - 70 * M, PAL.day], [t[4].getTime() - 20 * M, PAL.gold], [t[4].getTime(), PAL.set], [t[5].getTime(), PAL.night]];
    var x = now.getTime(), pal;
    if (x <= K[0][0] || x >= K[K.length - 1][0]) pal = PAL.night;
    else for (var i = 0; i < K.length - 1; i++) {
      if (x >= K[i][0] && x < K[i + 1][0]) {
        var f = (x - K[i][0]) / (K[i + 1][0] - K[i][0]), a = K[i][1], c = K[i + 1][1];
        pal = a.slice(0, 6).map(function (h, j) { return App.color.mix(h, c[j], f); }).concat([a[6] + (c[6] - a[6]) * f]);
        break;
      }
    }
    SKYV.forEach(function (v, j) { st.setProperty(v, pal[j]); });
    st.setProperty('--star-o', String(Math.round(pal[6] * 100) / 100));
    b.classList.toggle('sky-night', x < t[1].getTime() - 15 * M || x > t[4].getTime() + 20 * M);
  }

  // =====================================================================================================
  // CarPlay — launches the head unit's own CarPlay app (ZLink, AutoKit, TLink…)
  // =====================================================================================================
  var CP = /carplay|car ?play|zlink|z-link|autokit|auto ?kit|carlinkit|tlink|carbit|phonelink|phone ?link|easyconn|easy ?conn|zjinnova|autolink|smartlink|cplay|carlife|hicar|كار ?بلاي/i;
  H.carplayApps = function () {
    if (!App.Native.has) return [];
    return App.system.apps().filter(function (a) { return CP.test(a.p) || CP.test(String(a.l)); });
  };
  function cpLabel() {
    var s = App.settings.carplayApp, sub = $('cpSub');
    if (s) sub.textContent = 'يفتح «' + App.system.label(s) + '» — اضغط مطوّلاً للتغيير';
    else {
      var l = H.carplayApps();
      sub.textContent = l.length === 1 ? 'يفتح «' + l[0].l + '»' : l.length ? 'اختر تطبيق CarPlay مرة وحدة' : 'شغّل آيفونك على الشاشة';
    }
  }
  H.cpLabel = cpLabel;
  H.openCarplay = function (choose) {
    if (!App.Native.has) { App.toast('CarPlay يشتغل من تطبيق الشاشة نفسها — جرّبه على شاشة السيارة', 3500); return; }
    var s = App.settings.carplayApp, list = H.carplayApps();
    if (s && !choose && App.Native.call('launch', s) === '1') return;
    if (list.length === 1 && !choose) {
      App.settings.carplayApp = list[0].p; App.saveSettings(); cpLabel();
      App.system.launch(list[0].p, list[0].l);
      return;
    }
    App.panels.push('تطبيق CarPlay', function (body) {
      var all = App.system.apps(), show = list.length ? list : all;
      body.innerHTML = '<div class="big-status on">' + App.icon('carplay') + '<div class="txt"><b>' +
        (list.length ? 'لقيت ' + App.d(list.length) + ' تطبيق CarPlay على الشاشة' : 'ما لقيت تطبيق CarPlay باسم معروف') + '</b><small>' +
        'CarPlay نفسه يشتغل من تطبيق الشاشة (مثل ZLink أو AutoKit أو TLink). اختره مرة وحدة وبعدها البطاقة تفتحه مباشرة.</small></div></div>' +
        (list.length ? '' : '<div class="search-input">' + App.icon('search') + '<input id="cpFilter" placeholder="ابحث في تطبيقات الشاشة…"></div>') +
        '<div id="cpList">' + show.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '" data-l="' + App.esc(String(a.l).toLowerCase()) + '"><span data-icon="' + App.esc(a.p) + '" class="lead-ic"><span class="ph">' +
            App.esc(String(a.l).charAt(0)) + '</span></span><span class="txt"><b>' + App.esc(a.l) + '</b><small>' + App.esc(a.p) + '</small></span>' +
            (a.p === s ? '<span class="side">' + App.icon('check') + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        (list.length ? '<div class="btn-row" style="margin-top:1rem"><button class="btn" id="cpAll">' + App.icon('apps') + 'اختر من كل التطبيقات</button></div>' : '');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () {
          App.settings.carplayApp = b.dataset.p; App.saveSettings(); cpLabel(); App.panels.close();
          App.system.launch(b.dataset.p, App.system.label(b.dataset.p));
        };
      });
      var f = App.$('cpFilter');
      if (f) f.oninput = function () {
        var q = this.value.trim().toLowerCase();
        body.querySelectorAll('[data-p]').forEach(function (x) { x.style.display = !q || x.dataset.l.indexOf(q) >= 0 || x.dataset.p.indexOf(q) >= 0 ? '' : 'none'; });
      };
      if (App.$('cpAll')) App.$('cpAll').onclick = function () { list = []; App.panels.refresh(); };
      App.system.lazyIcons(body);
    });
  };

  // =====================================================================================================
  // shortcuts
  // =====================================================================================================
  var KNOWN = ['com.google.android.apps.maps', 'com.waze', 'com.google.android.youtube', 'com.google.android.apps.youtube.music',
    'com.spotify.music', 'com.anghami', 'com.quran.labs.androidquran', 'com.whatsapp', 'com.android.chrome'];
  var BUILTIN = {
    'rihla:radio': { l: 'راديو السيارة', ic: 'radio', go: function () { App.radio.openCarRadio(false); } },
    'rihla:stories': { l: 'القصص', ic: 'stories', go: function () { App.panels.open('stories'); } },
    'rihla:carplay': { l: 'CarPlay', ic: 'carplay', go: function () { H.openCarplay(false); } },
    'rihla:bt': { l: 'البلوتوث', ic: 'bt', go: function () { App.system.openBtApp(); } },
    'rihla:adhkar': { l: 'الأذكار', ic: 'book', go: function () { App.panels.open('adhkar'); } },
    'rihla:ask': { l: 'اسأل رحلة', ic: 'ask', go: function () { if (App.stories) App.stories.openAsk(); } },
    'rihla:apps': { l: 'الكل', ic: 'apps', go: function () { App.panels.open('apps'); } }
  };
  function installed() { return App.Native.has ? App.system.apps() : []; }
  function defaults() {
    var apps = installed(), has = function (p) { return apps.some(function (a) { return a.p === p; }); };
    var list = ['rihla:radio'].concat(KNOWN.filter(has));
    (App.settings.favs || []).forEach(function (p) { if (list.indexOf(p) < 0 && has(p)) list.push(p); });
    ['rihla:stories', 'rihla:bt', 'rihla:adhkar', 'rihla:ask'].forEach(function (b) { if (list.length < 8) list.push(b); });
    return list.slice(0, 8);
  }
  H.shortcuts = function () { return (App.settings.shortcuts || defaults()).slice(0, 8); };
  H.toggleShortcut = function (p) {
    var list = H.shortcuts().slice(), i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= 8) { App.toast('الحد ' + App.d(8) + ' اختصارات — شيل واحد أول'); return false; }
    else list.push(p);
    App.settings.shortcuts = list;
    App.saveSettings();
    renderShortcuts();
    return true;
  };
  function tile(id) {
    var b = BUILTIN[id];
    if (b) return '<button class="ac-tile" data-s="' + id + '">' + App.icon(b.ic) + '<span>' + b.l + '</span></button>';
    var l = App.system.label(id);
    return '<button class="ac-tile" data-s="' + App.esc(id) + '"><span data-icon="' + App.esc(id) + '"><span class="ph">' +
      App.esc(String(l || '?').trim().charAt(0)) + '</span></span><span>' + App.esc(l) + '</span></button>';
  }
  function renderShortcuts() {
    var g = $('acGrid');
    g.innerHTML = H.shortcuts().concat(['rihla:apps']).map(tile).join('');
    g.querySelectorAll('.ac-tile').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.s;
        if (BUILTIN[id]) BUILTIN[id].go(); else App.system.launch(id, App.system.label(id));
      };
    });
    App.system.lazyIcons(g);
  }
  H.renderShortcuts = renderShortcuts;
  function editShortcuts() {
    App.panels.push('اختصاراتك', function (body) {
      var sel = H.shortcuts(), apps = installed();
      var items = Object.keys(BUILTIN).filter(function (k) { return k !== 'rihla:apps'; }).map(function (k) { return { p: k, l: BUILTIN[k].l, b: 1 }; })
        .concat(apps.filter(function (a) { return a.p !== 'com.carnav.camry'; }));
      body.innerHTML = '<div class="note" style="margin-bottom:1rem">اختر حتى ' + App.d(8) + ' اختصارات تظهر في الصفحة الرئيسية — بالترتيب اللي تختاره.</div>' +
        '<div class="apps-grid" id="scGrid">' + items.map(function (a) {
          var i = sel.indexOf(a.p);
          return '<button class="app' + (i >= 0 ? ' picked' : '') + '" data-p="' + App.esc(a.p) + '">' +
            (i >= 0 ? '<b class="sc-n num">' + App.d(i + 1) + '</b>' : '') +
            (a.b ? App.icon(BUILTIN[a.p].ic, 'bi') : '<span data-icon="' + App.esc(a.p) + '"><span class="ph">' + App.esc(String(a.l).charAt(0)) + '</span></span>') +
            '<span>' + App.esc(a.l) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:1rem"><button class="btn" id="scReset">' + App.icon('reset') + 'الاختيار التلقائي</button></div>';
      App.$('scGrid').onclick = function (e) {
        var b = e.target.closest('.app');
        if (b && H.toggleShortcut(b.dataset.p)) App.panels.refresh();
      };
      App.$('scReset').onclick = function () { App.settings.shortcuts = null; App.saveSettings(); renderShortcuts(); App.panels.refresh(); };
      App.system.lazyIcons(body);
    });
  }

  // =====================================================================================================
  // the smart card: one useful thing at a time
  // =====================================================================================================
  var BOOT = Date.now(), rideDone = false;
  var RIDE = 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَىٰ رَبِّنَا لَمُنقَلِبُونَ';
  var WISE = [
    ['مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ', 'رواه الترمذي'],
    ['إِنَّ الرِّفْقَ لَا يَكُونُ فِي شَيْءٍ إِلَّا زَانَهُ', 'رواه مسلم'],
    ['الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ', 'متفق عليه'],
    ['وَتَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ', 'رواه الترمذي'],
    ['أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', 'متفق عليه'],
    ['لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ', 'متفق عليه']
  ];
  function pick(now) {
    var P = App.prayer, t = P.today, A = App.adhkar, ST = App.stories, k;
    if (t) {
      var nx = P.next(now), left = nx.t - now;
      if (nx.i !== 1 && left > 0 && left <= 15 * 60000) {
        return { ic: 'mosque', k: 'الصلاة القادمة', t: P.name(nx.i, nx.t) + ' بعد ' + App.countdown(left), s: 'الأذان ' + App.hmFull(nx.t) + ' — الحق على الصلاة',
          b: [['المساجد القريبة', 'mosque', function () { App.panels.open('prayer'); }]] };
      }
      for (k = 5; k >= 0; k--) {
        if (k === 1) continue;
        var since = now - t[k];
        if (since >= 0 && since < 20 * 60000) return { ic: 'mosque', k: 'حان وقت الصلاة', t: 'صلاة ' + P.name(k, t[k]) + ' — ' + App.hmFull(t[k]), s: 'أقم صلاتك، والطريق يستناك',
          b: [['أقرب مسجد', 'route', function () { App.panels.open('prayer'); }]] };
      }
    }
    var TS = App.tires && App.tires.state();
    if (TS && (TS.k === 'vlow' || TS.k === 'low') && TS.days < 10) {
      return { ic: 'tire', k: 'ضغط الإطارات', t: TS.msg, s: 'آخر قراءة ' + App.tires.ago(TS.last.t) + ' — المطلوب ' + App.tires.fmt(App.tires.rec()) + ' والكفرات باردة',
        b: [['التفاصيل', 'tire', function () { App.tires.open(); }], ['عبّيتها', 'check', function () { App.tires.fillAll(); smart(); }]] };
    }
    if (!rideDone && Date.now() - BOOT < 10 * 60000) {
      return { ic: 'car', k: 'دعاء الركوب', t: RIDE, q: 1, b: [['اسمعه', 'speak', function () { App.nav.say(RIDE); }], ['تم', 'check', function () { rideDone = true; smart(); }]] };
    }
    if (App.fridayPhase && App.fridayPhase() && App.fridayKey) {
      var fs = App.store.get('fri.' + App.fridayKey(), null) || {}, done = ['g', 'e', 'k', 's', 'd'].filter(function (x) { return fs[x]; }).length;
      if (!fs.k) return { ic: 'book', k: 'يوم الجمعة', t: 'سورة الكهف', s: 'من قرأها يوم الجمعة أضاء له من النور ما بين الجمعتين',
        b: [['استمع لها', 'play', function () { A.playKahf(); }], ['سنن الجمعة', 'mosque', function () { A.open('f'); }]] };
      if (done < 5) return { ic: 'mosque', k: 'سنن الجمعة', t: 'أنجزت ' + App.d(done) + ' من ' + App.d(5), s: 'أكثروا من الصلاة على النبي ﷺ في يوم الجمعة',
        b: [['افتح', 'book', function () { A.open('f'); }]] };
    }
    if (ST && ST.resumeInfo) {
      var ri = ST.resumeInfo();
      if (ri) return { ic: 'stories', k: 'أكمل الاستماع', t: ri.title, s: ri.sub, b: [['كمّل', 'play', ri.go], ['المكتبة', 'stories', function () { App.panels.open('stories'); }]] };
    }
    if (t && App.settings.adhkarRemind !== false && A) {
      var mode = null;
      if (now >= t[0] && now < t[2]) mode = 'm';
      else if (now >= t[3] && now < new Date(t[5].getTime() + 3600e3)) mode = 'e';
      if (mode) {
        var pr = A.progress(mode);
        if (pr.done < pr.total) return { ic: mode === 'm' ? 'sun' : 'moon', k: mode === 'm' ? 'أذكار الصباح' : 'أذكار المساء',
          t: pr.done ? 'أنجزت ' + App.d(pr.done) + ' من ' + App.d(pr.total) : 'ابدأ أذكارك — ' + App.d(pr.total) + ' ذكر',
          s: 'وَاذْكُر رَّبَّكَ كَثِيرًا وَسَبِّحْ بِالْعَشِيِّ وَالْإِبْكَارِ', b: [['افتح الأذكار', 'book', function () { A.open(mode); }]] };
      }
    }
    var TN = App.tires && App.tires.nag();
    if (TN) return { ic: 'tire', k: 'ضغط الإطارات', t: TN.k === 'none' ? 'سجّل ضغط كفراتك' : TN.msg,
      s: 'المطلوب للكامري ' + App.tires.fmt(App.tires.rec()) + ' — وأنبهك إذا كفر ناقص',
      b: [['سجّل', 'edit', function () { App.tires.open(true); }], ['لاحقاً', 'clock', function () { App.tires.snooze(); smart(); }]] };
    if (App.theme.key === 'girls' && ST && ST.quiz) {
      return { ic: 'quiz', k: 'سؤال للبنات', t: 'مين النبي اللي ابتلعه الحوت؟', s: 'مسابقة صوتية عن الأنبياء والصحابة',
        b: [['العبوا', 'play', function () { ST.quiz(); }]] };
    }
    if (ST && ST.fact) {
      var f = ST.fact(now);
      if (f) return { ic: 'sparkle', k: 'هل تعلم؟', t: f.t, s: f.s, b: [['اسأل رحلة', 'ask', function () { ST.openAsk(); }], ['اسمعها', 'speak', function () { App.nav.say(f.t); }]] };
    }
    var w = WISE[Math.floor(now / 3600e3) % WISE.length];
    return { ic: 'sparkle', k: 'حديث اليوم', t: w[0], q: 1, s: w[1] };
  }
  var cur = null;
  function smart() {
    var box = $('wSmart'), c = pick(new Date());
    cur = c;
    var html = '<div class="sm-k">' + App.icon(c.ic) + '<span>' + c.k + '</span></div>' +
      '<div class="sm-t' + (c.q ? ' q' : '') + '">' + c.t + '</div>' + (c.s ? '<div class="sm-s">' + c.s + '</div>' : '') +
      (c.b && c.b.length ? '<div class="sm-act">' + c.b.map(function (b, i) { return '<button data-i="' + i + '">' + App.icon(b[1]) + b[0] + '</button>'; }).join('') + '</div>' : '');
    if (box._h !== html) { box._h = html; box.innerHTML = html; }
  }
  H.smart = smart;

  // =====================================================================================================
  // the photo frame (بناتي) — the pictures stay on this screen only
  // =====================================================================================================
  var PH_MAX = 6, phIdx = 0, phT = null;
  function photos() { return App.store.get('photos', []) || []; }
  function savePhotos(list) {
    try { localStorage.setItem('cn.photos', JSON.stringify(list)); return true; }
    catch (e) { App.toast('المساحة ما تكفي — احذف صورة وجرّب'); return false; }
  }
  function shrink(file, done) {
    var fr = new FileReader();
    fr.onerror = function () { done(null); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { done(null); };
      img.onload = function () {
        try {
          var M = 760, k = Math.min(1, M / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          done(c.toDataURL('image/jpeg', .82));
        } catch (e) { done(null); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function addPhotos(files, after) {
    var list = photos(), arr = Array.prototype.slice.call(files || []).slice(0, PH_MAX), n = 0;
    if (!arr.length) return;
    App.toast('جارٍ تجهيز الصور…');
    (function next() {
      if (!arr.length) {
        if (savePhotos(list.slice(-PH_MAX))) { phIdx = Math.max(0, Math.min(list.length, PH_MAX) - 1); App.toast(n ? 'تمت إضافة ' + App.d(n) + ' صورة' : 'تعذّر قراءة الصورة'); }
        renderPhoto(); if (after) after();
        return;
      }
      shrink(arr.shift(), function (d) { if (d) { list.push(d); n++; } next(); });
    })();
  }
  // «زجاج»: the picture itself becomes the blurred world — a 72 px copy scaled up (smooth, no CSS filter, light on the A53)
  // and the theme's light takes its colour from the picture
  function hsl2rgb(h, s, l) {
    h /= 360; var a = s * Math.min(l, 1 - l), f = function (n) { var k = (n + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  }
  var GL_VARS = ['--accent', '--accent-rgb', '--accent-d', '--accent-l', '--accent2-rgb', '--pri-a', '--pri-b'];
  function glassClear() { GL_VARS.forEach(function (v) { document.body.style.removeProperty(v); }); }
  function glassTint(url) {
    if (App.theme.key !== 'glass') return;
    var bg = App.$('gbg'), st = document.body.style;
    if (!url) { glassClear(); if (bg) bg.style.backgroundImage = 'none'; return; }
    var im = new Image();
    im.onload = function () {
      if (App.theme.key !== 'glass') return;
      try {
        var k = 72 / Math.max(im.width, im.height), c = document.createElement('canvas');
        c.width = Math.max(2, Math.round(im.width * k)); c.height = Math.max(2, Math.round(im.height * k));
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
        if (bg) bg.style.backgroundImage = 'url("' + c.toDataURL('image/jpeg', .7) + '")';
        var px = x.getImageData(0, 0, c.width, c.height).data, sx = 0, sy = 0, tw = 0;
        for (var i = 0; i < px.length; i += 4) {   // the hue of the picture, weighted by how vivid each pixel is
          var r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
          if (d < .08 || mx < .2) continue;
          var hh = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4, w = (d / mx) * mx, a = hh * Math.PI / 3;
          sx += Math.cos(a) * w; sy += Math.sin(a) * w; tw += w;
        }
        var hue = tw > 3 ? ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360 : 336;
        function P(hh, s, l) { return hsl2rgb((hh + 360) % 360, s, l); }
        var a = P(hue, .85, .74), ad = P(hue, .62, .52), al = P(hue, .95, .88), a2 = P(hue + 42, .8, .66), p1 = P(hue, .9, .8), p2 = P(hue, .72, .6);
        st.setProperty('--accent', 'rgb(' + a + ')'); st.setProperty('--accent-rgb', a.join(', '));
        st.setProperty('--accent-d', 'rgb(' + ad + ')'); st.setProperty('--accent-l', 'rgb(' + al + ')');
        st.setProperty('--accent2-rgb', a2.join(', '));
        st.setProperty('--pri-a', 'rgb(' + p1 + ')'); st.setProperty('--pri-b', 'rgb(' + p2 + ')');
      } catch (e) { glassClear(); }
    };
    im.src = url;
  }
  function showPhoto(fade) {
    var list = photos(), im = App.$('phImg');
    if (!im || !list.length) { if (!list.length) glassTint(null); return; }
    phIdx = (phIdx + list.length) % list.length;
    im.style.backgroundImage = 'url("' + list[phIdx] + '")';
    glassTint(list[phIdx]);
    if (fade) { im.classList.remove('fade'); void im.offsetWidth; im.classList.add('fade'); }
    im.querySelectorAll('.ph-dots i').forEach(function (d, i) { d.classList.toggle('on', i === phIdx); });
  }
  function renderPhoto() {
    var box = $('wPhoto'), list = photos();
    clearInterval(phT);
    if (App.theme.key !== 'girls' && App.theme.key !== 'glass') { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="ph-card"><div class="ph-img" id="phImg">' +
      (list.length ? '' : '<div class="ph-empty">' + App.icon('image') + '<span>اضغط واختر صور بناتك</span><small>تبقى على هذي الشاشة فقط</small></div>') +
      (list.length > 1 ? '<div class="ph-dots">' + list.map(function () { return '<i></i>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="ph-cap">' + App.icon('heart') + '<span>' + App.esc(App.settings.photoCap || 'بناتي') + '</span>' + App.icon('heart') + '</div></div>' +
      '<input type="file" accept="image/*" multiple id="phFile" class="hidden">';
    var file = App.$('phFile'), card = box.querySelector('.ph-card'), lp = null, long = false;
    file.onchange = function () { addPhotos(file.files); file.value = ''; };
    card.onpointerdown = function () { long = false; clearTimeout(lp); lp = setTimeout(function () { long = true; managePhotos(); }, 650); };
    card.onpointerup = card.onpointerleave = card.onpointercancel = function () { clearTimeout(lp); };
    card.onclick = function () {
      if (long) return;
      if (!photos().length) file.click(); else { phIdx++; showPhoto(true); }
    };
    showPhoto(false);
    if (list.length > 1) phT = setInterval(function () { phIdx++; showPhoto(true); }, 15000);
  }
  function managePhotos() {
    App.panels.push('صور بناتي', function (body) {
      var list = photos();
      body.innerHTML = '<div class="note" style="margin-bottom:1rem">' + App.icon('shield') + ' الصور تُحفظ داخل هذي الشاشة فقط — ما تنرفع لأي مكان ولا تدخل في التحديثات.</div>' +
        '<div class="ph-grid">' + list.map(function (d, i) {
          return '<div class="ph-th" style="background-image:url(\'' + d + '\')"><button class="round small" data-del="' + i + '" aria-label="حذف">' + App.icon('trash') + '</button></div>';
        }).join('') + (list.length < PH_MAX ? '<button class="ph-th add" id="phAdd">' + App.icon('plus') + '<span>إضافة صور</span></button>' : '') + '</div>' +
        '<div class="set-row" style="margin-top:1rem"><div class="txt"><b>الكلام تحت الصورة</b><small>مثلاً: بناتي، دانة وأختها، قلبي</small></div>' +
        '<input id="phCap" class="txt-in" maxlength="24" value="' + App.esc(App.settings.photoCap || 'بناتي') + '"></div>' +
        '<input type="file" accept="image/*" multiple id="phFile2" class="hidden">';
      var f2 = App.$('phFile2');
      f2.onchange = function () { addPhotos(f2.files, function () { App.panels.refresh(); }); f2.value = ''; };
      if (App.$('phAdd')) App.$('phAdd').onclick = function () { f2.click(); };
      body.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () { var l = photos(); l.splice(+b.dataset.del, 1); savePhotos(l); renderPhoto(); App.panels.refresh(); };
      });
      App.$('phCap').onchange = function () { App.settings.photoCap = this.value.trim() || 'بناتي'; App.saveSettings(); renderPhoto(); };
    });
  }
  H.managePhotos = managePhotos;

  // =====================================================================================================
  H.init = function () {
    var rs = document.documentElement.style;
    rs.setProperty('--pat-islamic', App.patterns.islamic);
    rs.setProperty('--pat-najdi', App.patterns.najdi);
    rs.setProperty('--pat-sadu', App.patterns.sadu);
    document.body.classList.toggle('calm', !!App.settings.calm);
    var cp = $('wCarplay'), lp = null, long = false;
    cp.onpointerdown = function () { long = false; clearTimeout(lp); lp = setTimeout(function () { long = true; H.openCarplay(true); }, 700); };
    cp.onpointerup = cp.onpointerleave = cp.onpointercancel = function () { clearTimeout(lp); };
    cp.onclick = function () { if (!long) H.openCarplay(false); };
    $('acEdit').onclick = editShortcuts;
    $('wSmart').onclick = function (e) {
      var b = e.target.closest('[data-i]');
      if (b && cur && cur.b) cur.b[+b.dataset.i][2]();
    };
    renderShortcuts();
    cpLabel();
    scene();
    renderPhoto();
    tick();
    setInterval(tick, 1000);
    setInterval(smart, 20000);
    App.on('skin', function (k) { if (k !== 'glass') glassClear(); scene(); renderPhoto(); setTimeout(function () { H.refresh(); }, 40); });
    App.on('settings', function () { document.body.classList.toggle('calm', !!App.settings.calm); H.refresh(); });
    App.on('stories', smart);
    App.on('tires', smart);
    window.addEventListener('resize', debounce(function () { scene(); drawViz(); }, 250));
  };
})();
