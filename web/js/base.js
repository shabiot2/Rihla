/* base.js — the built-in offline map of Saudi Arabia (data/ksa.js): drawing under/instead of street tiles,
   offline search of regions, cities and districts (Arabic + English), and "which district am I in". */
(function () {
  'use strict';
  var B = App.base = { ready: false, loading: false };
  var Q = 1 << 17, D = null, labelCache = {};

  // ---------- loading / decoding ----------
  function dec(arr) {                    // delta-encoded -> absolute Int32Array + bbox
    var n = arr.length, out = new Int32Array(n), x = 0, y = 0;
    var x0 = 2147483647, y0 = 2147483647, x1 = -2147483648, y1 = -2147483648;
    for (var i = 0; i < n; i += 2) {
      x += arr[i]; y += arr[i + 1];
      out[i] = x; out[i + 1] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { p: out, b: [x0, y0, x1, y1] };
  }
  function bboxOf(list) {
    var b = [2147483647, 2147483647, -2147483648, -2147483648];
    list.forEach(function (r) {
      if (r.b[0] < b[0]) b[0] = r.b[0]; if (r.b[1] < b[1]) b[1] = r.b[1];
      if (r.b[2] > b[2]) b[2] = r.b[2]; if (r.b[3] > b[3]) b[3] = r.b[3];
    });
    return b;
  }
  function decode(raw) {
    var d = {};
    d.land = raw.land.map(function (poly) { var rings = poly.map(dec); return { rings: rings, b: bboxOf(rings) }; });
    d.brd = raw.brd.map(dec);
    d.ksa = raw.ksa.map(dec);
    d.roads = raw.roads.map(function (r) { var o = dec(r[2]); o.kind = r[0]; o.rank = r[1]; return o; });
    d.roads.sort(function (a, b) { return b.kind - a.kind; });          // draw minor first, highways on top
    d.rail = raw.rail.map(dec);
    d.air = raw.air.map(function (a) { return { n: a[0], x: a[1], y: a[2], c: a[3] }; });
    d.reg = raw.reg.map(function (r) {
      var rings = r[5].map(dec);
      return { id: r[0], n: r[1], en: r[2], x: r[3], y: r[4], rings: rings, b: bboxOf(rings) };
    });
    var regById = {};
    d.reg.forEach(function (r) { regById[r.id] = r; });
    d.cit = raw.cit.map(function (c) {
      return { id: c[0], n: c[1], en: c[2], x: c[3], y: c[4], rank: c[5], reg: regById[c[6]] };
    });
    var cityById = {};
    d.cit.forEach(function (c) { cityById[c.id] = c; });
    d.dis = raw.dis.map(function (r) {
      var rings = r[5].map(dec);
      return { city: cityById[r[0]], n: r[1], en: r[2], x: r[3], y: r[4], rings: rings, b: bboxOf(rings) };
    });
    d.cityById = cityById;
    return d;
  }
  B.load = function () {
    if (B.ready || B.loading) return;
    B.loading = true;
    var s = document.createElement('script');
    s.src = 'data/ksa.js';
    s.onload = function () {
      setTimeout(function () {
        try {
          D = decode(App.ksaData);
          App.ksaData = null;
          B.ready = true;
          buildIndex();
          if (App.map) App.map.invalidate();
          App.emit('baseReady');
        } catch (e) { B.loading = false; }
      }, 30);
    };
    s.onerror = function () { B.loading = false; };
    document.head.appendChild(s);
  };

  // ---------- drawing ----------
  var PAL = {
    light: { sea: '#b4d4e4', land: '#f2eee6', ksa: '#7b5aa6', brd: '#a395b4', reg: '#b9a6cb', dis: '#d9cfbf',
      hw: '#f0a050', hwc: '#c98238', rd: '#ffffff', rdc: '#cdc4b6', mn: '#e5dccd', rail: '#8f8f8f',
      txt: '#22272c', halo: 'rgba(255,255,255,.92)', txt2: '#6d675e', reg_t: '#7b5aa6', air: '#4a6fa5' },
    dark: { sea: '#0c1822', land: '#1a1f25', ksa: '#8ea3bb', brd: '#4f5964', reg: '#584e6e', dis: '#2a3239',
      hw: '#a8743a', hwc: '#4e3518', rd: '#56616c', rdc: '#262c32', mn: '#353d45', rail: '#5d6975',
      txt: '#e8ecef', halo: 'rgba(8,11,14,.9)', txt2: '#8d98a2', reg_t: '#a99bc4', air: '#7fa7dc' }
  };
  B.pal = function (dark) { return dark ? PAL.dark : PAL.light; };
  B.counts = function () { return D ? { reg: D.reg.length, cit: D.cit.length, dis: D.dis.length, air: D.air.length } : null; };

  function vis(b, v) { return !(b[2] < v[0] || b[0] > v[2] || b[3] < v[1] || b[1] > v[3]); }
  function path(ctx, p, ox, oy, k, close) {
    ctx.moveTo((p[0] - ox) * k, (p[1] - oy) * k);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo((p[i] - ox) * k, (p[i + 1] - oy) * k);
    if (close) ctx.closePath();
  }
  // v: view box in world px [x0,y0,x1,y1]; ctx already translated to the anchor and rotated
  B.draw = function (ctx, cx, cy, z, v, dark) {
    if (!B.ready) return;
    var c = dark ? PAL.dark : PAL.light, s = Math.pow(2, z), k = s / Q, ox = cx * Q, oy = cy * Q;
    var vq = [v[0] * Q, v[1] * Q, v[2] * Q, v[3] * Q], i, j, f;
    var R = Math.hypot(v[2] - v[0], v[3] - v[1]) * s;
    ctx.fillStyle = c.sea;
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
    // land
    ctx.fillStyle = c.land;
    ctx.beginPath();
    for (i = 0; i < D.land.length; i++) {
      f = D.land[i];
      if (!vis(f.b, vq)) continue;
      for (j = 0; j < f.rings.length; j++) path(ctx, f.rings[j].p, ox, oy, k, true);
    }
    ctx.fill('evenodd');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // districts
    if (z >= 10.5) {
      ctx.strokeStyle = c.dis;
      ctx.lineWidth = z >= 13 ? 1.6 : 1;
      ctx.beginPath();
      for (i = 0; i < D.dis.length; i++) {
        f = D.dis[i];
        if (!vis(f.b, vq)) continue;
        for (j = 0; j < f.rings.length; j++) path(ctx, f.rings[j].p, ox, oy, k, true);
      }
      ctx.stroke();
    }
    // region borders
    if (z <= 12.5) {
      ctx.strokeStyle = c.reg;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      for (i = 0; i < D.reg.length; i++) {
        f = D.reg[i];
        if (!vis(f.b, vq)) continue;
        for (j = 0; j < f.rings.length; j++) path(ctx, f.rings[j].p, ox, oy, k, true);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // railways
    if (z >= 6) {
      ctx.strokeStyle = c.rail;
      ctx.lineWidth = z >= 10 ? 2 : 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (i = 0; i < D.rail.length; i++) if (vis(D.rail[i].b, vq)) path(ctx, D.rail[i].p, ox, oy, k, false);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // roads: casing then fill, per class
    var hwW = z < 6 ? 1.4 : z < 9 ? 2.4 : z < 12 ? 3.6 : 5.2;
    var cls = [
      { kind: 2, show: z >= 7, w: hwW * 0.55, fill: c.mn, cas: null, maxRank: z >= 9 ? 10 : 8 },
      { kind: 1, show: z >= 5.5, w: hwW * 0.75, fill: c.rd, cas: c.rdc, maxRank: z >= 7 ? 10 : 5 },
      { kind: 0, show: true, w: hwW, fill: c.hw, cas: c.hwc, maxRank: 10 }
    ];
    cls.forEach(function (cl) {
      if (!cl.show) return;
      var list = D.roads.filter(function (r) { return r.kind === cl.kind && r.rank <= cl.maxRank && vis(r.b, vq); });
      if (!list.length) return;
      ctx.beginPath();
      list.forEach(function (r) { path(ctx, r.p, ox, oy, k, false); });
      if (cl.cas && z >= 6) { ctx.strokeStyle = cl.cas; ctx.lineWidth = cl.w + 2; ctx.stroke(); }
      ctx.strokeStyle = cl.fill; ctx.lineWidth = cl.w; ctx.stroke();
    });
    // country borders, the Kingdom's on top
    ctx.strokeStyle = c.brd; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (i = 0; i < D.brd.length; i++) if (vis(D.brd[i].b, vq)) path(ctx, D.brd[i].p, ox, oy, k, false);
    ctx.stroke();
    ctx.strokeStyle = c.ksa; ctx.lineWidth = z < 8 ? 2 : 2.6;
    ctx.beginPath();
    for (i = 0; i < D.ksa.length; i++) if (vis(D.ksa[i].b, vq)) path(ctx, D.ksa[i].p, ox, oy, k, false);
    ctx.stroke();
  };

  // labels in screen space (upright while the map rotates), simple collision avoidance
  B.labels = function (ctx, toScreen, W, H, z, dark, v) {
    if (!B.ready) return;
    var c = dark ? PAL.dark : PAL.light, placed = [], vq = [v[0] * Q, v[1] * Q, v[2] * Q, v[3] * Q];
    function inView(x, y) { return x >= vq[0] && x <= vq[2] && y >= vq[1] && y <= vq[3]; }
    function put(text, wx, wy, font, color, dot, pri) {
      var p = toScreen(wx / Q, wy / Q);
      if (p[0] < -40 || p[1] < -20 || p[0] > W + 40 || p[1] > H + 20) return;
      ctx.font = font;
      var key = font + text, w = labelCache[key] || (labelCache[key] = ctx.measureText(text).width);
      var h = parseInt(font.match(/(\d+)px/)[1], 10), x0 = p[0] - w / 2 - 3, y0 = p[1] - h - (dot ? 6 : 0) - 2;
      var r = [x0, y0, x0 + w + 6, y0 + h + 6];
      for (var i = 0; i < placed.length; i++) {
        var q = placed[i];
        if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return;
      }
      placed.push(r);
      if (dot) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p[0], p[1], dot, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = c.halo; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.lineWidth = 3.5; ctx.strokeStyle = c.halo; ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var ty = p[1] - (dot ? dot + 4 : -h / 2 + 2);
      ctx.strokeText(text, p[0], ty);
      ctx.fillText(text, p[0], ty);
    }
    ctx.save();
    ctx.setTransform(App.map.dpr || 1, 0, 0, App.map.dpr || 1, 0, 0);
    ctx.direction = 'rtl';
    ctx.lineJoin = 'round';
    var F = '"Tajawal","Noto Sans Arabic",sans-serif', i, f;
    // big cities first, then region names, then towns/villages and districts (collisions drop the later ones)
    var maxRank = z >= 10.5 ? 2 : z >= 8 ? 1 : 0;
    for (var rank = 0; rank <= maxRank; rank++) {
      if (rank === 1 && z < 7.5) D.reg.forEach(function (r) { if (inView(r.x, r.y)) put(r.n, r.x, r.y, '700 13px ' + F, c.reg_t, 0); });
      for (i = 0; i < D.cit.length; i++) {
        f = D.cit[i];
        if (f.rank !== rank || !inView(f.x, f.y)) continue;
        put(f.n, f.x, f.y, (rank === 0 ? '800 15px ' : rank === 1 ? '700 13px ' : '600 12px ') + F, c.txt,
          rank === 0 ? 4 : rank === 1 ? 3 : 2.2);
      }
    }
    if (maxRank === 0 && z < 7.5) D.reg.forEach(function (r) { if (inView(r.x, r.y)) put(r.n, r.x, r.y, '700 13px ' + F, c.reg_t, 0); });
    if (z >= 11) {
      for (i = 0; i < D.dis.length; i++) {
        f = D.dis[i];
        if (!inView(f.x, f.y)) continue;
        put(f.n, f.x, f.y, (z >= 14 ? '600 13.5px ' : z >= 12.5 ? '600 12px ' : '600 11px ') + F, c.txt2, 0);
      }
    }
    if (z >= 7) D.air.forEach(function (a) { if (inView(a.x, a.y)) put('✈ ' + a.n, a.x, a.y, '700 12px ' + F, c.air, 0); });
    ctx.restore();
  };

  // ---------- search ----------
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/^(حي|منطقه|محافظه|مدينه)\s+/, '').replace(/\b(dist\.?|district|al[- ]|el[- ])/g, ' ')
      .replace(/[^؀-ۿa-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  B.norm = norm;
  var IDX = [];
  function buildIndex() {
    IDX = [];
    D.reg.forEach(function (r) { IDX.push({ k: norm(r.n) + ' ' + norm(r.en), f: r, t: 'reg' }); });
    D.cit.forEach(function (c) { IDX.push({ k: norm(c.n) + ' ' + norm(c.en), f: c, t: 'cit' }); });
    D.dis.forEach(function (d) { IDX.push({ k: norm(d.n) + ' ' + norm(d.en) + ' ' + norm(d.city ? d.city.n : ''), f: d, t: 'dis' }); });
  }
  function ll(f) {
    var x = f.x / Q, y = f.y / Q, n = Math.PI - 2 * Math.PI * y / 256;
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon: x / 256 * 360 - 180 };
  }
  B.ll = ll;
  B.search = function (q, near) {
    if (!B.ready) return [];
    var nq = norm(q);
    if (!nq) return [];
    var toks = nq.split(' ').filter(Boolean), out = [];
    for (var i = 0; i < IDX.length; i++) {
      var e = IDX[i], ok = true;
      for (var t = 0; t < toks.length; t++) if (e.k.indexOf(toks[t]) < 0) { ok = false; break; }
      if (!ok) continue;
      var nm = norm(e.f.n), score = nm === nq ? 0 : nm.indexOf(nq) === 0 ? 1 : 2;
      score += e.t === 'reg' ? 0 : e.t === 'cit' ? (e.f.rank * 0.3) : 0.5;
      out.push({ e: e, score: score });
    }
    var here = near || null;
    out.forEach(function (o) {
      var p = ll(o.e.f);
      o.p = p;
      if (here) o.score += Math.min(2, App.geo.dist(here.lat, here.lon, p.lat, p.lon) / 300000);
    });
    out.sort(function (a, b) { return a.score - b.score; });
    return out.slice(0, 30).map(function (o) {
      var f = o.e.f, t = o.e.t;
      return { lat: o.p.lat, lon: o.p.lon, name: f.n, offline: true, kind: t,
        sub: t === 'dis' ? 'حي — ' + (f.city ? f.city.n : '') : t === 'cit' ? (f.reg ? f.reg.n : 'مدينة') : 'منطقة إدارية' };
    });
  };

  // ---------- reverse lookup: district / city / region of a point ----------
  function inRing(p, x, y) {
    var inside = false;
    for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      var xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inside(f, x, y) {
    if (x < f.b[0] || x > f.b[2] || y < f.b[1] || y > f.b[3]) return false;
    var n = 0;
    for (var i = 0; i < f.rings.length; i++) if (inRing(f.rings[i].p, x, y)) n++;
    return n % 2 === 1;
  }
  var lastWhere = null;
  B.where = function (lat, lon) {
    if (!B.ready) return null;
    if (lastWhere && App.geo.dist(lastWhere.lat, lastWhere.lon, lat, lon) < 60) return lastWhere.r;
    var x = (lon + 180) / 360 * 256 * Q, s = Math.sin(lat * Math.PI / 180);
    var y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Q;
    var r = { district: null, city: null, region: null };
    for (var i = 0; i < D.dis.length; i++) if (inside(D.dis[i], x, y)) { r.district = D.dis[i].n; r.city = D.dis[i].city; break; }
    for (i = 0; i < D.reg.length; i++) if (inside(D.reg[i], x, y)) { r.region = D.reg[i].n; break; }
    if (!r.city) {                      // nearest town within ~15 km
      var best = null, bd = 15000;
      D.cit.forEach(function (c) {
        if (Math.abs(c.x - x) > 0.12 * Q || Math.abs(c.y - y) > 0.12 * Q) return;
        var p = ll(c), d = App.geo.dist(lat, lon, p.lat, p.lon);
        if (d < bd) { bd = d; best = c; }
      });
      r.city = best;
      r.near = !!best;
    }
    r.cityName = r.city ? r.city.n : null;
    lastWhere = { lat: lat, lon: lon, r: r };
    return r;
  };
  B.whereText = function (lat, lon) {
    var w = B.where(lat, lon);
    if (!w) return '';
    var parts = [];
    if (w.district) parts.push(w.district);
    if (w.cityName) parts.push((w.near && !w.district ? 'قرب ' : '') + w.cityName);
    else if (w.region) parts.push(w.region);
    return parts.join('، ');
  };
})();
