/* map.js — canvas slippy map: tiles, heading-up rotation, smooth car follow, route, gestures */
(function () {
  'use strict';
  var TS = 256, PI = Math.PI;
  var STYLES = {
    light: { name: 'نهاري', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subs: 'abcd', retina: true, max: 18, bg: '#e9e4dc', attr: '© OpenStreetMap contributors © CARTO' },
    dark: { name: 'ليلي', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subs: 'abcd', retina: true, max: 18, bg: '#1b1d22', attr: '© OpenStreetMap contributors © CARTO' },
    sat: { name: 'قمر صناعي', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', subs: '', max: 18, bg: '#10141a', attr: 'Imagery © Esri, Maxar, Earthstar Geographics' }
  };
  var ORDER = ['auto', 'light', 'dark', 'sat'];
  var NAMES = { auto: 'تلقائي (نهار/ليل)' };

  function lon2x(lon) { return (lon + 180) / 360 * TS; }
  function lat2y(lat) {
    var s = Math.max(-0.9999, Math.min(0.9999, Math.sin(lat * PI / 180)));
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * PI)) * TS;
  }
  function x2lon(x) { return x / TS * 360 - 180; }
  function y2lat(y) { var n = PI - 2 * PI * y / TS; return 180 / PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }
  function mpp(lat) { return Math.cos(lat * PI / 180) * 2 * PI * 6378137 / TS; } // metres per z0 pixel

  var M = App.map = {
    cx: lon2x(46.6753), cy: lat2y(24.7136), z: 13, rot: 0,
    follow: true, autoZoom: true, car: null, disp: null, route: null, dest: null,
    paused: false, progressIdx: 0
  };
  var cv, ctx, W = 0, H = 0, dpr = 1, dirty = true, lastDraw = 0, lastFrame = 0;
  var anchorY = 0.5, tiles = new Map(), tileCount = 0;

  function styleKey() {
    var s = App.settings.mapStyle;
    if (s !== 'auto') return s;
    var P = App.prayer && App.prayer.today;
    if (!P) return 'light';
    var now = new Date();
    return (now >= P[4] || now < P[1]) ? 'dark' : 'light';
  }
  M.styleKey = styleKey;

  function tileUrl(st, z, x, y) {
    var r = st.retina && dpr >= 1.5 ? '@2x' : '';
    var s = st.subs ? st.subs[(x + y) % st.subs.length] : '';
    return st.url.replace('{s}', s).replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', r);
  }
  function getTile(key, url, load) {
    var t = tiles.get(key);
    if (t) {
      tiles.delete(key);
      tiles.set(key, t);
      if (t.failed && load && Date.now() - t.failed > 15000) { t.failed = 0; t.img.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now(); }
      return t.img;
    }
    if (!load) return null;
    var img = new Image();
    t = { img: img, failed: 0 };
    img.onload = function () { dirty = true; };
    img.onerror = function () { t.failed = Date.now(); };
    img.src = url;
    tiles.set(key, t);
    if (tiles.size > 360) {
      var it = tiles.keys();
      for (var i = 0; i < 60; i++) tiles.delete(it.next().value);
    }
    return img;
  }
  function ready(img) { return img && img.complete && img.naturalWidth > 0; }

  function drawTile(sk, st, z, x, y, px, py, size) {
    var img = getTile(sk + z + '/' + x + '/' + y, tileUrl(st, z, x, y), true);
    if (ready(img)) { ctx.drawImage(img, px, py, size + 0.7, size + 0.7); return; }
    for (var dz = 1; dz <= 5 && z - dz >= 0; dz++) {
      var f = 1 << dz, qx = Math.floor(x / f), qy = Math.floor(y / f);
      var p = getTile(sk + (z - dz) + '/' + qx + '/' + qy, '', false);
      if (ready(p)) {
        var sw = p.naturalWidth / f;
        ctx.drawImage(p, (x - qx * f) * sw, (y - qy * f) * sw, sw, sw, px, py, size + 0.7, size + 0.7);
        return;
      }
    }
  }

  function toScreen(X, Y) {
    var s = Math.pow(2, M.z), dx = (X - M.cx) * s, dy = (Y - M.cy) * s;
    var c = Math.cos(M.rot), n = Math.sin(M.rot);
    return [W / 2 + dx * c - dy * n, H * anchorY + dx * n + dy * c];
  }
  function toWorld(sx, sy) {
    var s = Math.pow(2, M.z), dx = sx - W / 2, dy = sy - H * anchorY;
    var c = Math.cos(-M.rot), n = Math.sin(-M.rot);
    return [M.cx + (dx * c - dy * n) / s, M.cy + (dx * n + dy * c) / s];
  }
  M.screenToLatLon = function (sx, sy) { var w = toWorld(sx, sy); return { lat: y2lat(w[1]), lon: x2lon(w[0]) }; };
  M.latLonToScreen = function (lat, lon) { return toScreen(lon2x(lon), lat2y(lat)); };

  function draw() {
    var sk = styleKey(), st = STYLES[sk];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, W, H);
    var ax = W / 2, ay = H * anchorY;
    var tz = Math.max(2, Math.min(st.max, Math.round(M.z)));
    var tsz = TS * Math.pow(2, M.z - tz), n = 1 << tz;
    var ccx = M.cx * n / TS, ccy = M.cy * n / TS;
    var rmax = Math.max(Math.hypot(ax, ay), Math.hypot(W - ax, ay), Math.hypot(ax, H - ay), Math.hypot(W - ax, H - ay));
    var r = rmax / tsz + 0.75;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(M.rot);
    var x0 = Math.floor(ccx - r), x1 = Math.floor(ccx + r);
    var y0 = Math.max(0, Math.floor(ccy - r)), y1 = Math.min(n - 1, Math.floor(ccy + r));
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var ddx = tx + 0.5 - ccx, ddy = ty + 0.5 - ccy;
        if (ddx * ddx + ddy * ddy > r * r) continue;
        drawTile(sk, st, tz, ((tx % n) + n) % n, ty, (tx - ccx) * tsz, (ty - ccy) * tsz, tsz);
      }
    }
    var s = Math.pow(2, M.z);
    if (M.route) drawRoute(s);
    if (M.pois && M.pois.length) drawPois(s);
    if (M.dest) drawPin(M.dest[0], M.dest[1], s);
    if (M.disp) drawCar(s);
    ctx.restore();
    var a = App.$('attrib');
    if (a._t !== st.attr) { a._t = st.attr; a.textContent = st.attr + ' • © othio'; }
  }

  function drawRoute(s) {
    var pts = M.route, i, p, lx = 1e9, ly = 1e9;
    function path(from, to) {
      ctx.beginPath();
      lx = 1e9;
      for (i = from; i <= to; i++) {
        p = pts[i];
        var x = (p[0] - M.cx) * s, y = (p[1] - M.cy) * s;
        if (i !== from && i !== to && Math.abs(x - lx) + Math.abs(y - ly) < 2) continue;
        if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        lx = x; ly = y;
      }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    var k = Math.min(M.progressIdx, pts.length - 1);
    if (k > 0) {
      path(0, k);
      ctx.strokeStyle = 'rgba(120,130,140,.7)';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    path(k, pts.length - 1);
    var th = App.theme && App.theme.cur ? App.theme.cur.v : null;
    ctx.strokeStyle = th ? th.routeCase : '#0d4f86';
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.strokeStyle = th ? th.route : '#3db4f2';
    ctx.lineWidth = 7.5;
    ctx.stroke();
  }

  // points of interest (e.g. nearby mosques): round badges, the nearest one labelled
  function drawPois(s) {
    var list = M.pois || [], i;
    ctx.save();
    for (i = list.length - 1; i >= 0; i--) {
      var p = list[i], x = (p.x - M.cx) * s, y = (p.y - M.cy) * s, big = i === 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-M.rot);
      var r = big ? 15 : 11.5;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6;
      ctx.fillStyle = p.color || '#1f9e5f';
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = big ? 3 : 2.2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * PI); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
      // crescent glyph
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-1, 0, r * 0.52, 0, 2 * PI); ctx.fill();
      ctx.fillStyle = p.color || '#1f9e5f';
      ctx.beginPath(); ctx.arc(r * 0.12, -r * 0.1, r * 0.44, 0, 2 * PI); ctx.fill();
      if (big && p.name) {
        ctx.font = '600 13px sans-serif';
        ctx.direction = 'rtl';
        var label = p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name, w = ctx.measureText(label).width + 18;
        ctx.fillStyle = 'rgba(8,12,16,.86)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-w / 2, -r - 30, w, 22, 11); else ctx.rect(-w / 2, -r - 30, w, 22);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, -r - 19);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPin(X, Y, s) {
    var x = (X - M.cx) * s, y = (Y - M.cy) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-M.rot);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.5, 0, 0, 2 * PI); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-4, -12, -14, -18, -14, -30);
    ctx.arc(0, -30, 14, PI, 0);
    ctx.bezierCurveTo(14, -18, 4, -12, 0, 0);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -30, 5, 0, 2 * PI); ctx.fill();
    ctx.restore();
  }

  function drawCar(s) {
    var d = M.disp, x = (d.x - M.cx) * s, y = (d.y - M.cy) * s;
    if (M.car && M.car.acc > 25) {
      var rr = M.car.acc / mpp(M.car.lat) * s;
      if (rr > 14) {
        ctx.fillStyle = 'rgba(61,180,242,.12)';
        ctx.strokeStyle = 'rgba(61,180,242,.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, Math.min(rr, 2000), 0, 2 * PI); ctx.fill(); ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(x, y);
    if (d.h == null) {
      ctx.fillStyle = 'rgba(61,180,242,.25)';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, 2 * PI); ctx.fill();
      ctx.fillStyle = '#3db4f2'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 2 * PI); ctx.fill(); ctx.stroke();
    } else {
      ctx.rotate(d.h * PI / 180);
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 8;
      // the arrow wears the car's own paint colour, outlined in the theme's route colour
      var cc = App.car ? App.car.colorHex(App.car.get().color) : '#c3cad0', mx = App.color.mix;
      var g = ctx.createLinearGradient(-14, 0, 14, 0);
      g.addColorStop(0, mx(cc, '#000000', 0.3)); g.addColorStop(0.45, mx(cc, '#ffffff', 0.55));
      g.addColorStop(0.55, cc); g.addColorStop(1, mx(cc, '#000000', 0.4));
      ctx.fillStyle = g;
      ctx.strokeStyle = App.theme && App.theme.cur ? App.theme.cur.v.route : '#1f8fd6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(15, 16); ctx.lineTo(0, 8); ctx.lineTo(-15, 16); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
    ctx.restore();
  }

  function angDiff(a, b) { return ((b - a + 540) % 360) - 180; }

  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.2, (ts - lastFrame) / 1000 || 0.016);
    lastFrame = ts;
    if (M.paused || !W) return;
    var animating = false;
    // dead-reckon the car between GPS fixes
    if (M.car) {
      var c = M.car, age = Math.min(1.6, (Date.now() - c.t) / 1000);
      var tx = c.x, ty = c.y;
      if (c.speed > 3 && c.heading != null && age > 0) {
        var v = c.speed / 3.6 / mpp(c.lat) * age;
        tx += Math.sin(c.heading * PI / 180) * v;
        ty -= Math.cos(c.heading * PI / 180) * v;
      }
      if (!M.disp) M.disp = { x: tx, y: ty, h: c.heading };
      var k = Math.min(1, dt * 6), d = M.disp;
      var ex = tx - d.x, ey = ty - d.y;
      if (Math.abs(ex) * Math.pow(2, M.z) > 400 || Math.abs(ey) * Math.pow(2, M.z) > 400) { d.x = tx; d.y = ty; }
      else { d.x += ex * k; d.y += ey * k; }
      if (c.heading != null) d.h = d.h == null ? c.heading : (d.h + angDiff(d.h, c.heading) * Math.min(1, dt * 5) + 360) % 360;
      if (Math.abs(ex) + Math.abs(ey) > 1e-9) animating = true;
    }
    // camera
    var wantAnchor = M.follow && M.car && App.settings.headingUp && M.car.speed > 5 ? 0.66 : 0.5;
    if (Math.abs(anchorY - wantAnchor) > 0.002) { anchorY += (wantAnchor - anchorY) * Math.min(1, dt * 3); animating = true; }
    if (M.follow && M.disp) {
      M.cx = M.disp.x; M.cy = M.disp.y;
      var wantRot = 0;
      if (App.settings.headingUp && M.disp.h != null) wantRot = -M.disp.h * PI / 180;
      if (App.settings.headingUp && M.car.speed < 4) wantRot = M.rot;
      var dr = Math.atan2(Math.sin(wantRot - M.rot), Math.cos(wantRot - M.rot));
      if (Math.abs(dr) > 0.002) { M.rot += dr * Math.min(1, dt * 3); animating = true; }
      if (M.autoZoom) {
        var sp = M.car.speed, wz = 17.4 - Math.max(0, Math.min(1, (sp - 20) / 110)) * 2.4;
        if (M.navZoom) wz = Math.max(wz, M.navZoom);
        if (Math.abs(wz - M.z) > 0.01) { M.z += (wz - M.z) * Math.min(1, dt * 1.2); animating = true; }
      }
    } else if (!App.settings.headingUp && Math.abs(M.rot) > 0.002) {
      M.rot += (0 - M.rot) * Math.min(1, dt * 4); animating = true;
    }
    var ic = App.$('compassIc');
    if (ic._r !== Math.round(M.rot * 100)) { ic._r = Math.round(M.rot * 100); ic.style.transform = 'rotate(' + M.rot + 'rad)'; }
    if (dirty || (animating && ts - lastDraw > 33) || ts - lastDraw > 1000) {
      dirty = false;
      lastDraw = ts;
      draw();
    }
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    dirty = true;
  }

  // ---------- public API ----------
  M.invalidate = function () { dirty = true; };
  M.setCar = function (f) {
    M.car = { x: lon2x(f.lon), y: lat2y(f.lat), lat: f.lat, lon: f.lon, heading: f.heading, speed: f.speed, acc: f.acc, t: f.t };
    if (!M.hadFix) { M.hadFix = true; M.cx = M.car.x; M.cy = M.car.y; M.z = 16; }
    dirty = true;
  };
  M.setRoute = function (coords) {
    M.route = coords ? coords.map(function (c) { return [lon2x(c[0]), lat2y(c[1])]; }) : null;
    M.progressIdx = 0;
    dirty = true;
  };
  M.setDest = function (lat, lon) { M.dest = lat == null ? null : [lon2x(lon), lat2y(lat)]; dirty = true; };
  M.setPois = function (list) {
    M.pois = (list || []).map(function (p) { return { x: lon2x(p.lon), y: lat2y(p.lat), lat: p.lat, lon: p.lon, name: p.name, sub: p.sub, color: p.color }; });
    dirty = true;
  };
  M.showAll = function (pts) {           // fit the car and a few places in view
    var c = pts.map(function (p) { return [p.lon, p.lat]; });
    if (M.car) c.push([M.car.lon, M.car.lat]);
    M.fit(c);
  };
  M.lookAt = function (lat, lon, z) {
    M.follow = false;
    M.cx = lon2x(lon); M.cy = lat2y(lat);
    if (z) M.z = z;
    showLocate(); dirty = true;
  };
  M.fit = function (coords) {
    if (!coords || !coords.length) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    coords.forEach(function (c) {
      var x = lon2x(c[0]), y = lat2y(c[1]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
    M.follow = false;
    M.rot = 0;
    anchorY = 0.5;
    M.cx = (x0 + x1) / 2; M.cy = (y0 + y1) / 2;
    var zx = Math.log2((W * 0.8) / Math.max(1e-9, x1 - x0)), zy = Math.log2((H * 0.7) / Math.max(1e-9, y1 - y0));
    M.z = Math.max(3, Math.min(17, Math.min(zx, zy)));
    showLocate(); dirty = true;
  };
  M.recenter = function () {
    M.follow = true; M.autoZoom = true;
    App.$('btnLocate').classList.add('hidden');
    if (!M.car) App.toast('بانتظار إشارة GPS…');
    dirty = true;
  };
  function showLocate() { App.$('btnLocate').classList.remove('hidden'); }
  M.zoomAt = function (dz, sx, sy) {
    if (sx == null) { sx = W / 2; sy = H * anchorY; }
    var before = toWorld(sx, sy);
    M.z = Math.max(3, Math.min(19.5, M.z + dz));
    M.autoZoom = false;
    if (!M.follow) {
      var after = toWorld(sx, sy);
      M.cx += before[0] - after[0]; M.cy += before[1] - after[1];
    }
    dirty = true;
  };
  M.cycleStyle = function () {
    var i = (ORDER.indexOf(App.settings.mapStyle) + 1) % ORDER.length;
    App.settings.mapStyle = ORDER[i];
    App.saveSettings();
    App.toast('نمط الخريطة: ' + (NAMES[ORDER[i]] || STYLES[ORDER[i]].name));
    dirty = true;
  };
  M.toggleHeading = function () {
    App.settings.headingUp = !App.settings.headingUp;
    App.saveSettings();
    App.toast(App.settings.headingUp ? 'الخريطة باتجاه السير' : 'الشمال للأعلى');
    dirty = true;
  };

  // ---------- gestures ----------
  function bindGestures() {
    var pts = {}, start = null, pinch = null, lpTimer = null, lastTap = 0, moved = false;
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      pts[e.pointerId] = local(e);
      App.emit('mapTouch');
      var l = list();
      moved = false;
      if (l.length === 1) {
        start = { p: l[0], cx: M.cx, cy: M.cy };
        clearTimeout(lpTimer);
        lpTimer = setTimeout(function () {
          if (!moved && M.onLongPress) { var ll = M.screenToLatLon(start.p.x, start.p.y); M.onLongPress(ll.lat, ll.lon, start.p.x, start.p.y); }
        }, 650);
      } else if (l.length === 2) {
        clearTimeout(lpTimer);
        pinch = { d: Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y), z: M.z, m: { x: (l[0].x + l[1].x) / 2, y: (l[0].y + l[1].y) / 2 } };
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = local(e);
      var l = list();
      if (l.length === 1 && start) {
        var dx = l[0].x - start.p.x, dy = l[0].y - start.p.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 9) return;
        if (!moved) { moved = true; clearTimeout(lpTimer); M.follow = false; showLocate(); }
        var s = Math.pow(2, M.z), c = Math.cos(-M.rot), n = Math.sin(-M.rot);
        M.cx = start.cx - (dx * c - dy * n) / s;
        M.cy = start.cy - (dx * n + dy * c) / s;
        dirty = true;
      } else if (l.length === 2 && pinch) {
        moved = true;
        var d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
        var target = pinch.z + Math.log2(d / Math.max(10, pinch.d));
        M.zoomAt(target - M.z, pinch.m.x, pinch.m.y);
      }
    });
    function up(e) {
      delete pts[e.pointerId];
      clearTimeout(lpTimer);
      var l = list();
      if (!l.length) {
        if (!moved && M.pois && M.pois.length && M.onPoiTap) {
          var best = null, bd = 30;
          M.pois.forEach(function (p) {
            var q = toScreen(p.x, p.y), dd = Math.hypot(q[0] - start.p.x, q[1] - start.p.y);
            if (dd < bd) { bd = dd; best = p; }
          });
          if (best) { M.onPoiTap(best); start = null; pinch = null; return; }
        }
        if (!moved) {
          var now = Date.now();
          if (now - lastTap < 320) { M.zoomAt(1, start.p.x, start.p.y); lastTap = 0; } else lastTap = now;
        }
        start = null; pinch = null;
      } else if (l.length === 1) {
        start = { p: l[0], cx: M.cx, cy: M.cy }; pinch = null;
      }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e);
      M.zoomAt(e.deltaY < 0 ? 0.5 : -0.5, p.x, p.y);
    }, { passive: false });
  }

  M.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    var last = App.store.get('lastPos', null);
    if (last) { M.cx = lon2x(last.lon); M.cy = lat2y(last.lat); M.z = 15; }
    resize();
    window.addEventListener('resize', resize);
    bindGestures();
    App.$('btnZoomIn').onclick = function () { M.zoomAt(1); };
    App.$('btnZoomOut').onclick = function () { M.zoomAt(-1); };
    App.$('btnCompass').onclick = M.toggleHeading;
    App.$('btnLayers').onclick = M.cycleStyle;
    App.$('btnLocate').onclick = M.recenter;
    App.on('loc', function (f) {
      M.setCar(f);
      if (!M._saved || Date.now() - M._saved > 30000) { M._saved = Date.now(); App.store.set('lastPos', { lat: f.lat, lon: f.lon }); }
    });
    requestAnimationFrame(frame);
  };
  M.lon2x = lon2x; M.lat2y = lat2y;
})();
