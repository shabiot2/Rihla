/* theme.js — themes (all original artwork), car profile for any make/model, occasions
   (Saudi National Day / Founding Day), welcome screen. Loaded right after core.js. */
(function () {
  'use strict';

  // ---------- SVG background patterns (original geometric motifs) ----------
  function svgUrl(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27') + '")'; }
  var PAT = {
    carbon: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='3' height='3' fill='#fff' fill-opacity='.022'/><rect x='3' y='3' width='3' height='3' fill='#fff' fill-opacity='.022'/></svg>"),
    stripes: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><path d='M-14 70 70 -14' stroke='#fff' stroke-opacity='.045' stroke-width='16'/><path d='M14 70 70 14' stroke='#fff' stroke-opacity='.02' stroke-width='3'/></svg>"),
    pitch: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='90' height='180' fill='#fff' fill-opacity='.028'/></svg>"),
    pitchLines: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 620'><g fill='none' stroke='#fff' stroke-opacity='.07' stroke-width='3'><rect x='30' y='30' width='940' height='560'/><path d='M500 30v560'/><circle cx='500' cy='310' r='92'/><rect x='30' y='170' width='150' height='280'/><rect x='820' y='170' width='150' height='280'/><rect x='30' y='245' width='55' height='130'/><rect x='915' y='245' width='55' height='130'/></g><circle cx='500' cy='310' r='5' fill='#fff' fill-opacity='.08'/></svg>"),
    najdi: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><path d='M0 64 16 50 32 64ZM32 64 48 50 64 64Z' fill='#fff' fill-opacity='.05'/><path d='M32 10 41 19 32 28 23 19Z' fill='none' stroke='#fff' stroke-opacity='.06' stroke-width='1.5'/><circle cx='32' cy='19' r='2' fill='#fff' fill-opacity='.06'/></svg>"),
    sadu: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='84' height='48'><path d='M0 24 10.5 14 21 24 31.5 14 42 24 52.5 14 63 24 73.5 14 84 24' fill='none' stroke='#e3b866' stroke-opacity='.11' stroke-width='2.2'/><path d='M42 2 48 8 42 14 36 8ZM0 34 6 40 0 46ZM84 34 78 40 84 46Z' fill='#e3b866' fill-opacity='.09'/><path d='M21 36 25 40 21 44 17 40ZM63 36 67 40 63 44 59 40Z' fill='#2f8f5c' fill-opacity='.12'/></svg>")
  };
  var SILVER = ['#ffffff', '#d3d9de', '#7f8891', '#e2e6e9', '#8a939b'];
  var GOLD = ['#fff7e0', '#ead08c', '#8a6a33', '#f3dca6', '#9c7a3f'];

  var BASE = {
    bg0: '#1b232c', bg1: '#0b0f13', bg2: '#07090c', pattern: PAT.carbon, patternSize: '6px 6px', patternOp: '1',
    cardA: '#18202a', cardB: '#10151c', cardC: '#0d1116', card: '#121820',
    sheet: 'rgba(10,13,17,.965)', glass: 'rgba(17,22,28,.9)',
    line: 'rgba(255,255,255,.075)', line2: 'rgba(255,255,255,.14)',
    text: '#eaeef2', muted: '#8d99a6', dim: '#5b6670',
    accent: '#56c8f5', accentRgb: '86,200,245', accentD: '#1f8fd6', accentL: '#7fe0ff', onAccent: '#ffffff',
    chrome: 'linear-gradient(180deg,#ffffff 0%,#dfe4e8 35%,#9ba4ac 52%,#e6eaed 100%)',
    chromeH: 'linear-gradient(90deg,#8e979f 0%,#eef1f3 30%,#b9c0c6 55%,#f7f9fa 80%,#9aa3ab 100%)',
    btnA: '#232d38', btnB: '#19212a', dockA: '#1a222b', dockB: '#11161c', actA: '#17323f', actB: '#10202a',
    field: '#161d25', chip: '#222c36', seg: '#1a222b', tabOn: '#24303c', off: '#2a333d', press: '#1b2530',
    navcA: '#1d6fb0', navcB: '#134b7a', priA: '#2a9be0', priB: '#1b72b3',
    gaugeA: '#1f8fd6', gaugeB: '#7fe0ff', halo: '#38b6ef', faceA: '#1e2731', faceB: '#0d1217', faceC: '#07090c',
    route: '#3db4f2', routeCase: '#0b4f86'
  };
  function T(name, sub, over, extra) {
    var v = {}, k;
    for (k in BASE) v[k] = BASE[k];
    for (k in over) v[k] = over[k];
    var t = { name: name, sub: sub, v: v, bezel: SILVER };
    for (k in extra || {}) t[k] = extra[k];
    return t;
  }

  var THEMES = {
    silver: T('فضي كلاسيك', 'معدني أنيق', {}),
    royal: T('الأزرق الملكي', 'روح المدرّجات الزرقاء', {
      bg0: '#1546a8', bg1: '#0a2160', bg2: '#040c26', pattern: PAT.stripes, patternSize: '56px 56px',
      cardA: '#163a86', cardB: '#0d2459', cardC: '#081a40', card: '#0f2655',
      sheet: 'rgba(6,18,48,.97)', glass: 'rgba(9,26,66,.92)', line: 'rgba(255,255,255,.1)', line2: 'rgba(255,255,255,.2)',
      text: '#ffffff', muted: '#a9bfe6', dim: '#6683b8',
      accent: '#ffffff', accentRgb: '255,255,255', accentD: '#2d6cf0', accentL: '#dfe9ff',
      btnA: '#1d4294', btnB: '#12306f', dockA: '#173a85', dockB: '#0d2459', actA: '#2d6cf0', actB: '#1b48b8',
      field: '#0d2459', chip: '#173a85', seg: '#12306f', tabOn: '#2456c4', off: '#22407e', press: '#1b3f8f',
      navcA: '#2d6cf0', navcB: '#163a86', priA: '#3f7cff', priB: '#1f55d6',
      gaugeA: '#2d6cf0', gaugeB: '#ffffff', halo: '#7fa8ff', faceA: '#173a85', faceB: '#0b1f4d', faceC: '#05112b',
      route: '#ffffff', routeCase: '#1f55d6'
    }),
    match: T('ليلة المباراة', 'عشب الملعب وأضواء كاشفة', {
      bg0: '#1f5a36', bg1: '#0b2617', bg2: '#04110a', pattern: PAT.pitch + ',' + PAT.pitchLines,
      patternSize: '180px 180px, 100% 100%', patternOp: '1',
      cardA: '#163a27', cardB: '#0e2619', cardC: '#091b11', card: '#0f271a',
      sheet: 'rgba(6,20,12,.97)', glass: 'rgba(10,30,19,.92)', line: 'rgba(255,255,255,.09)', line2: 'rgba(255,255,255,.17)',
      text: '#f4f8f2', muted: '#9fc0aa', dim: '#5f806b',
      accent: '#5dfc8d', accentRgb: '93,252,141', accentD: '#1fa152', accentL: '#c4ffd6',
      btnA: '#1d4a31', btnB: '#123220', dockA: '#18402a', dockB: '#0e2619', actA: '#23693f', actB: '#16452a',
      field: '#0e2619', chip: '#1b4530', seg: '#133322', tabOn: '#23603b', off: '#234a33', press: '#1d4a31',
      navcA: '#1fa152', navcB: '#126b36', priA: '#2fbf6a', priB: '#1a8a4a',
      gaugeA: '#1fa152', gaugeB: '#e9ffe9', halo: '#5dfc8d', faceA: '#173d29', faceB: '#0b2216', faceC: '#05130b',
      route: '#5dfc8d', routeCase: '#0d4a26'
    }),
    national: T('اليوم الوطني', 'أخضر وأبيض بنقوش نجدية', {
      bg0: '#1e7a4d', bg1: '#0d3b25', bg2: '#052014', pattern: PAT.najdi, patternSize: '64px 64px',
      cardA: '#176142', cardB: '#0f412b', cardC: '#0a2d1d', card: '#0f3a26',
      sheet: 'rgba(5,30,19,.97)', glass: 'rgba(8,42,26,.92)', line: 'rgba(255,255,255,.1)', line2: 'rgba(255,255,255,.2)',
      text: '#ffffff', muted: '#b3dcc4', dim: '#6f9c82',
      accent: '#ffffff', accentRgb: '255,255,255', accentD: '#1f8a55', accentL: '#e8fff1',
      btnA: '#1d6d48', btnB: '#134d33', dockA: '#18603f', dockB: '#0f412b', actA: '#2a9a63', actB: '#1d6d48',
      field: '#0f412b', chip: '#1a5c3d', seg: '#134d33', tabOn: '#24845a', off: '#256446', press: '#1d6d48',
      navcA: '#24945e', navcB: '#14603c', priA: '#2fb070', priB: '#1f8a55',
      gaugeA: '#1f9e5f', gaugeB: '#ffffff', halo: '#9ff2c5', faceA: '#176142', faceB: '#0b3220', faceC: '#052014',
      route: '#ffffff', routeCase: '#14603c'
    }, { occasion: 'national' }),
    founding: T('يوم التأسيس', 'ذهبي نجدي بنقوش السدو', {
      bg0: '#6b4527', bg1: '#33200f', bg2: '#170e05', pattern: PAT.sadu, patternSize: '84px 48px',
      cardA: '#4d321d', cardB: '#362313', cardC: '#25170c', card: '#2f1f11',
      sheet: 'rgba(25,15,6,.97)', glass: 'rgba(38,24,11,.93)', line: 'rgba(255,233,190,.1)', line2: 'rgba(255,233,190,.2)',
      text: '#fbf1dc', muted: '#cfb68a', dim: '#8d7553',
      accent: '#e7bd68', accentRgb: '231,189,104', accentD: '#b0823a', accentL: '#ffe3a3', onAccent: '#1d1405',
      chrome: 'linear-gradient(180deg,#fff7e0 0%,#ead08c 38%,#a07a3c 54%,#f3dca6 100%)',
      chromeH: 'linear-gradient(90deg,#9c7a3f 0%,#fff1c9 30%,#c9a35c 55%,#fff7e0 80%,#a8854a 100%)',
      btnA: '#5a3b22', btnB: '#3e2815', dockA: '#4d321d', dockB: '#2e1d10', actA: '#7d5429', actB: '#56381d',
      field: '#2e1d10', chip: '#4a301b', seg: '#3e2815', tabOn: '#6e4a26', off: '#5a3f26', press: '#5a3b22',
      navcA: '#9b6f30', navcB: '#5e3f1c', priA: '#ecc271', priB: '#c0913f',
      gaugeA: '#b0823a', gaugeB: '#ffe9b3', halo: '#e7bd68', faceA: '#4a301c', faceB: '#26180c', faceC: '#140c05',
      route: '#ffd37a', routeCase: '#6b4527'
    }, { bezel: GOLD, occasion: 'founding' }),
    black: T('أسود ليلي', 'مريح للعين في القيادة الليلية', {
      bg0: '#0a0a0a', bg1: '#030303', bg2: '#000000', pattern: 'none',
      cardA: '#0d0d0d', cardB: '#080808', cardC: '#050505', card: '#0a0a0a',
      sheet: 'rgba(0,0,0,.97)', glass: 'rgba(10,10,10,.92)', line: 'rgba(255,255,255,.06)', line2: 'rgba(255,255,255,.12)',
      text: '#e6e6e6', muted: '#8a8a8a', dim: '#555555',
      accent: '#ffad42', accentRgb: '255,173,66', accentD: '#d97a00', accentL: '#ffd59a',
      btnA: '#161616', btnB: '#0d0d0d', dockA: '#111111', dockB: '#070707', actA: '#2a1a05', actB: '#160d02',
      field: '#0d0d0d', chip: '#161616', seg: '#111111', tabOn: '#222222', off: '#2a2a2a', press: '#1c1c1c',
      navcA: '#8a4f00', navcB: '#4d2c00', priA: '#e08a1a', priB: '#b56a0a',
      gaugeA: '#d97a00', gaugeB: '#ffd59a', halo: '#ff9a1f', faceA: '#121212', faceB: '#070707', faceC: '#000000',
      route: '#ffad42', routeCase: '#5c3300'
    }),
    custom: T('مخصص', 'اختر لونك المفضّل', {})
  };
  var ORDER = ['silver', 'royal', 'match', 'national', 'founding', 'black', 'custom'];
  var CUSTOM_COLORS = ['#56c8f5', '#2d6cf0', '#7c5cff', '#d64bff', '#ff4fa3', '#ff4b4f', '#ff8a2b', '#ffc93c',
    '#d4af37', '#5dfc8d', '#16b8a6', '#c0c7cd'];

  // ---------- colour helpers ----------
  function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgb2hex(c) { return '#' + c.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(h) { var c = hex2rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  App.color = { mix: mix, lum: lum, hex2rgb: hex2rgb };

  function customTheme(acc) {
    var t = T('مخصص', 'لونك المفضّل', {}), v = t.v, dark = '#0b0f13';
    v.accent = acc; v.accentRgb = hex2rgb(acc).join(','); v.accentD = mix(acc, '#000000', 0.35); v.accentL = mix(acc, '#ffffff', 0.45);
    v.onAccent = lum(acc) > 0.62 ? '#111111' : '#ffffff';
    v.bg0 = mix(acc, dark, 0.78); v.bg1 = mix(acc, '#07090c', 0.93);
    v.cardA = mix(acc, '#18202a', 0.86); v.card = mix(acc, '#121820', 0.92);
    v.actA = mix(acc, '#10151c', 0.68); v.actB = mix(acc, '#0b0f13', 0.82);
    v.tabOn = mix(acc, '#1b232c', 0.72); v.chip = mix(acc, '#1d2630', 0.85);
    v.navcA = mix(acc, '#000000', 0.25); v.navcB = mix(acc, '#000000', 0.55);
    v.priA = mix(acc, '#000000', 0.05); v.priB = mix(acc, '#000000', 0.3);
    v.gaugeA = v.accentD; v.gaugeB = v.accentL; v.halo = acc; v.route = acc; v.routeCase = mix(acc, '#000000', 0.6);
    return t;
  }

  // ---------- car profile ----------
  var BRANDS = ['تويوتا', 'لكزس', 'هيونداي', 'كيا', 'نيسان', 'إنفينيتي', 'شيفروليه', 'جي إم سي', 'كاديلاك', 'فورد',
    'لينكون', 'دودج', 'جيب', 'رام', 'كرايسلر', 'هوندا', 'مازدا', 'ميتسوبيشي', 'سوزوكي', 'إيسوزو', 'سوبارو',
    'مرسيدس', 'بي إم دبليو', 'أودي', 'فولكس فاجن', 'بورشه', 'لاند روفر', 'جاكوار', 'فولفو', 'بيجو', 'رينو',
    'جيلي', 'شانجان', 'هافال', 'شيري', 'جيتور', 'إم جي', 'بي واي دي', 'هونشي', 'جي إيه سي', 'تانك', 'تسلا', 'لوسد', 'أخرى'];
  var COLORS = [
    ['silver', 'فضي', '#c3cad0'], ['white', 'أبيض لؤلؤي', '#f3f3ef'], ['black', 'أسود', '#25272b'],
    ['gray', 'رمادي', '#6e757c'], ['red', 'أحمر', '#b8232d'], ['maroon', 'عنابي', '#62202c'],
    ['blue', 'أزرق', '#2556b8'], ['navy', 'كحلي', '#1c2c52'], ['beige', 'بيج ذهبي', '#cbb48a'],
    ['brown', 'بني', '#6c4a33'], ['green', 'أخضر', '#2f5f45'], ['orange', 'برتقالي', '#d9732b']
  ];
  var BODIES = [['sedan', 'سيدان'], ['suv', 'عائلي SUV'], ['pickup', 'غمارة / بيك أب'], ['hatch', 'هاتشباك'],
    ['van', 'فان'], ['coupe', 'كوبيه']];
  var C = App.car = {};
  C.defaults = { brand: 'تويوتا', model: 'كامري', year: '', body: 'sedan', color: 'silver', driver: '' };
  C.get = function () {
    var c = App.settings.car || {}, o = {}, k;
    for (k in C.defaults) o[k] = c[k] == null ? C.defaults[k] : c[k];
    return o;
  };
  C.colorHex = function (key) { var c = COLORS.filter(function (x) { return x[0] === key; })[0]; return c ? c[2] : '#c3cad0'; };
  C.colorName = function (key) { var c = COLORS.filter(function (x) { return x[0] === key; })[0]; return c ? c[1] : ''; };
  C.title = function () { var c = C.get(); return (c.model || c.brand || 'سيارتي'); };
  C.subtitle = function () { var c = C.get(); return [c.model ? c.brand : '', c.year, C.colorName(c.color)].filter(Boolean).join(' • '); };
  // ---------- car logo: the owner's own image (picked from the device) or the app emblem ----------
  C.logo = function () { return App.store.get('carLogo', null); };          // {d: PNG data URL, a: shaped by transparency}
  C.logoMode = function () {
    var l = C.logo(), m = App.settings.logoMode;
    if (!l) return 'none';
    if (!l.a) return 'orig';
    return m === 'orig' || m === 'white' || m === 'accent' || m === 'chrome' ? m : 'chrome';
  };
  C.applyLogo = function () {
    var l = C.logo();
    document.documentElement.style.setProperty('--logo', l ? 'url("' + l.d + '")' : 'none');
  };
  var eid = 0;
  function emblem() {     // original steering-wheel emblem in the theme's metal
    var id = 'em' + (++eid);
    return '<svg class="bl-emblem" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:var(--bezel-0)"/><stop offset=".4" style="stop-color:var(--bezel-1)"/>' +
      '<stop offset=".6" style="stop-color:var(--bezel-2)"/><stop offset="1" style="stop-color:var(--bezel-3)"/></linearGradient></defs>' +
      '<circle cx="50" cy="50" r="33" fill="none" stroke="url(#' + id + ')" stroke-width="8"/>' +
      '<path d="M18 54 37 49 39 56 19 61ZM82 54 63 49 61 56 81 61ZM45 63h10l2 20H43Z" fill="url(#' + id + ')"/>' +
      '<circle cx="50" cy="52" r="13" style="fill:var(--card-c)" stroke="url(#' + id + ')" stroke-width="3"/>' +
      '<path d="M50 43 57 59 50 55 43 59Z" style="fill:var(--accent)"/></svg>';
  }
  C.badge = function (cls) {
    var m = C.logoMode();
    var inner = m === 'none' ? emblem() : m === 'orig' ? '<i class="bl-img"></i>' : '<i class="bl-mask ' + m + '"></i>';
    return '<span class="badge-logo ' + (cls || '') + '">' + inner + '</span>';
  };

  // read the picked image, clear a plain (e.g. white) background, trim the margins, store a 256 px PNG
  function processLogo(file, done) {
    var fr = new FileReader();
    fr.onerror = function () { done(null); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { done(null); };
      img.onload = function () {
        try {
          var S = 320, c = document.createElement('canvas');
          c.width = c.height = S;
          var x = c.getContext('2d');
          var k = Math.min(S / img.width, S / img.height);
          var w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
          var ox = Math.round((S - w) / 2), oy = Math.round((S - h) / 2);
          x.drawImage(img, ox, oy, w, h);
          var id = x.getImageData(0, 0, S, S), p = id.data;
          var at = function (i, j) { return (j * S + i) * 4; };
          var cs = [at(ox, oy), at(ox + w - 1, oy), at(ox, oy + h - 1), at(ox + w - 1, oy + h - 1)];
          var bg = [p[cs[0]], p[cs[0] + 1], p[cs[0] + 2]];
          var diff = function (q) { return Math.abs(p[q] - bg[0]) + Math.abs(p[q + 1] - bg[1]) + Math.abs(p[q + 2] - bg[2]); };
          var plain = cs.every(function (q) { return p[q + 3] > 250 && diff(q) <= 60; });
          if (plain) {
            var seen = new Uint8Array(S * S), st = [], i, j;
            for (i = ox; i < ox + w; i++) st.push(i, oy, i, oy + h - 1);
            for (j = oy; j < oy + h; j++) st.push(ox, j, ox + w - 1, j);
            while (st.length) {
              var yy = st.pop(), xx = st.pop();
              if (xx < ox || yy < oy || xx >= ox + w || yy >= oy + h) continue;
              var n = yy * S + xx;
              if (seen[n]) continue;
              seen[n] = 1;
              var q = n * 4, dd = diff(q);
              if (dd > 70) continue;
              p[q + 3] = dd <= 35 ? 0 : Math.round(p[q + 3] * (dd - 35) / 35);   // soft edge
              st.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
            }
            x.putImageData(id, 0, 0);
          }
          var minx = S, miny = S, maxx = -1, maxy = -1, tp = 0, yy2, xx2;
          for (yy2 = 0; yy2 < S; yy2++) {
            for (xx2 = 0; xx2 < S; xx2++) {
              var a = p[(yy2 * S + xx2) * 4 + 3];
              if (a < 128 && xx2 >= ox && xx2 < ox + w && yy2 >= oy && yy2 < oy + h) tp++;
              if (a > 24) {
                if (xx2 < minx) minx = xx2;
                if (xx2 > maxx) maxx = xx2;
                if (yy2 < miny) miny = yy2;
                if (yy2 > maxy) maxy = yy2;
              }
            }
          }
          if (maxx < 0) { done(null); return; }
          var bw = maxx - minx + 1, bh = maxy - miny + 1, F = 256, out = document.createElement('canvas');
          out.width = out.height = F;
          var k2 = Math.min(F / bw, F / bh), w2 = bw * k2, h2 = bh * k2;
          out.getContext('2d').drawImage(c, minx, miny, bw, bh, (F - w2) / 2, (F - h2) / 2, w2, h2);
          done({ d: out.toDataURL('image/png'), a: tp / (w * h) > 0.08 });
        } catch (e) { done(null); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  C.processLogo = processLogo;

  C.renderChip = function () {
    App.$('carSil').innerHTML = C.badge('bl-chip');
    App.$('carName').textContent = C.title();
    App.$('carSub').textContent = C.subtitle();
  };
  C.BRANDS = BRANDS; C.COLORS = COLORS; C.BODIES = BODIES;

  // ---------- brand credit: أبو دانة للبرمجة ----------
  App.brand = function (cls) {
    return '<span class="brand ' + (cls || '') + '"><b>أبو دانة</b><small>للبرمجة</small></span>';
  };
  App.BRAND = 'أبو دانة للبرمجة';
  App.APP_NAME = 'رحلة';

  // ---------- occasions ----------
  App.occasion = function (now) {
    now = now || new Date();
    var m = now.getMonth() + 1, d = now.getDate(), y = now.getFullYear();
    if (m === 9 && d >= 16 && d <= 30) {
      return { theme: 'national', today: d === 23, label: 'اليوم الوطني السعودي ' + App.d(y - 1930), greet: 'كل عام والوطن بخير 💚' };
    }
    if (m === 2 && d >= 15 && d <= 28) {
      return { theme: 'founding', today: d === 22, label: 'يوم التأسيس — منذ ' + App.d(1727) + 'م', greet: 'يوم بدينا 🤍' };
    }
    return null;
  };

  function occKey(occ) { return occ ? occ.theme + new Date().getFullYear() : false; }
  function lockIfOccasion() { App.settings.themeLocked = occKey(App.occasion()); }

  // ---------- apply ----------
  var TH = App.theme = { cur: null, key: null };
  function kebab(k) { return '--' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
  TH.effectiveKey = function () {
    var s = App.settings, occ = App.occasion();
    if (s.autoOccasion !== false && occ && s.themeLocked !== occKey(occ)) return occ.theme;
    return THEMES[s.theme] ? s.theme : 'silver';
  };
  TH.get = function (key) {
    if (key === 'custom') return customTheme(App.settings.customAccent || '#56c8f5');
    return THEMES[key] || THEMES.silver;
  };
  TH.apply = function () {
    var key = TH.effectiveKey(), t = TH.get(key), st = document.documentElement.style, k;
    for (k in t.v) st.setProperty(kebab(k), t.v[k]);
    t.bezel.forEach(function (c, i) { st.setProperty('--bezel-' + i, c); });
    TH.cur = t; TH.key = key;
    document.body.setAttribute('data-theme', key);
    if (App.map && App.map.invalidate) App.map.invalidate();
    var occ = App.occasion(), chip = App.$('occChip');
    if (chip) {
      chip.classList.toggle('hidden', !occ);
      if (occ) chip.textContent = occ.label;
    }
  };
  TH.list = function () { return ORDER.map(function (k) { return { key: k, t: TH.get(k) }; }); };

  // theme cards: a miniature of the dashboard in each theme
  TH.cards = function (sel) {
    return '<div class="theme-grid">' + TH.list().map(function (x) {
      var v = x.t.v;
      return '<button class="theme-card' + (x.key === sel ? ' on' : '') + '" data-theme="' + x.key + '">' +
        '<span class="tc-prev" style="background:radial-gradient(120% 90% at 85% -10%,' + v.bg0 + ' 0%,' + v.bg1 + ' 55%,' + v.bg2 + ' 100%)">' +
        '<span class="tc-pat" style="background-image:' + v.pattern.replace(/"/g, "'") + ';background-size:' + v.patternSize + '"></span>' +
        '<span class="tc-gauge" style="border-color:' + v.gaugeA + ';box-shadow:0 0 10px ' + v.halo + '"></span>' +
        '<span class="tc-map" style="background:' + v.cardB + ';border-color:' + v.line2 + '"><i style="background:' + v.route + '"></i></span>' +
        '<span class="tc-dock">' + [0, 1, 2, 3].map(function (i) {
          return '<i style="background:' + (i === 1 ? v.actA : v.dockA) + ';border-color:' + (i === 1 ? v.accent : v.line) + '"></i>';
        }).join('') + '</span></span>' +
        '<b>' + x.t.name + '</b><small>' + x.t.sub + '</small></button>';
    }).join('') + '</div>';
  };
  TH.bindCards = function (root, onPick) {
    root.querySelectorAll('[data-theme]').forEach(function (b) {
      b.onclick = function () {
        App.settings.theme = b.dataset.theme;
        lockIfOccasion();                                   // a manual pick during an occasion wins (that year)
        App.saveSettings();
        TH.apply();
        root.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (onPick) onPick(b.dataset.theme);
      };
    });
  };
  TH.customRow = function () {
    var cur = App.settings.customAccent || '#56c8f5';
    return '<div class="swatches" id="tCustom">' + CUSTOM_COLORS.map(function (c) {
      return '<button class="sw' + (c === cur ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
    }).join('') + '</div>';
  };
  TH.bindCustom = function (root, after) {
    var box = root.querySelector('#tCustom');
    if (!box) return;
    box.querySelectorAll('[data-c]').forEach(function (b) {
      b.onclick = function () {
        App.settings.customAccent = b.dataset.c;
        App.settings.theme = 'custom';
        lockIfOccasion();
        App.saveSettings();
        TH.apply();
        box.querySelectorAll('.sw').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (after) after();
      };
    });
  };

  // ---------- car editor (used by the welcome screen and the car panel) ----------
  C.editor = function () {
    var c = C.get(), l = C.logo(), m = C.logoMode();
    return '<div class="logo-stage"><span id="cStage">' + C.badge('bl-stage') + '</span><div class="ls-side"><b>شعار السيارة</b>' +
      '<small>اختر صورة الشعار من جهازك — الأفضل PNG بخلفية شفافة، والخلفية البيضاء أنظّفها تلقائياً.</small>' +
      '<div class="btn-row"><button class="btn primary" id="cPick">' + App.icon('plus') + (l ? 'تغيير الصورة' : 'اختيار صورة الشعار') + '</button>' +
      (l ? '<button class="btn" id="cDel">' + App.icon('trash') + 'إزالة</button>' : '') + '</div>' +
      '<input type="file" accept="image/*" id="cFile" class="hidden"></div></div>' +
      (l ? '<div class="set-row"><div class="txt"><b>طريقة عرض الشعار</b><small>' + (l.a ? 'المعدني يتلوّن مع الثيم (فضي، ذهبي…)' :
        'الصورة بخلفية كاملة — تُعرض بألوانها الأصلية') + '</small></div><div class="seg" id="cMode">' +
        [['chrome', 'معدني'], ['orig', 'الأصلي'], ['white', 'أبيض'], ['accent', 'لون الثيم']].map(function (o) {
          return '<button data-m="' + o[0] + '"' + (o[0] === m ? ' class="on"' : '') + (!l.a && o[0] !== 'orig' ? ' disabled' : '') + '>' + o[1] + '</button>';
        }).join('') + '</div></div>' : '') +
      '<div class="sec-title">لون السيارة <small class="note">— يتلوّن به سهم موقعك على الخريطة</small></div><div class="swatches" id="cColor">' + COLORS.map(function (x) {
        return '<button class="sw car' + (x[0] === c.color ? ' on' : '') + '" data-c="' + x[0] + '" style="background:linear-gradient(160deg,' +
          mix(x[2], '#ffffff', 0.35) + ',' + x[2] + ' 55%,' + mix(x[2], '#000000', 0.35) + ')"><span' +
          (lum(x[2]) > 0.6 ? ' style="color:#1a1d21;text-shadow:none"' : '') + '>' + x[1] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="set-row"><div class="txt"><b>الشركة المصنّعة</b></div><select class="field" id="cBrand">' + BRANDS.map(function (b) {
        return '<option' + (b === c.brand ? ' selected' : '') + '>' + b + '</option>';
      }).join('') + '</select></div>' +
      '<div class="set-row"><div class="txt"><b>الموديل</b><small>مثل: كامري، النترا، يوكن، أكورد…</small></div>' +
      '<input class="field" id="cModel" maxlength="24" value="' + App.esc(c.model) + '" placeholder="اسم الموديل"></div>' +
      '<div class="set-row"><div class="txt"><b>سنة الصنع</b></div><select class="field" id="cYear"><option value="">—</option>' +
      (function () { var o = '', y = new Date().getFullYear() + 1; for (; y >= 1990; y--) o += '<option' + (String(y) === String(c.year) ? ' selected' : '') + '>' + y + '</option>'; return o; })() +
      '</select></div>' +
      '<div class="set-row"><div class="txt"><b>اسم السائق</b><small>اختياري — للترحيب في الملخص اليومي</small></div>' +
      '<input class="field" id="cDriver" maxlength="20" value="' + App.esc(c.driver) + '" placeholder="الاسم"></div>';
  };
  C.bindEditor = function (root) {
    function save(k, v) {
      var c = C.get();
      c[k] = v;
      App.settings.car = c;
      App.saveSettings();
      C.renderChip();
      if (App.map) App.map.invalidate();
    }
    function redraw() {
      var sc = root.scrollTop;
      root.innerHTML = C.editor();
      C.bindEditor(root);
      root.scrollTop = sc;
    }
    var file = root.querySelector('#cFile');
    root.querySelector('#cPick').onclick = function () { file.value = ''; file.click(); };
    file.onchange = function () {
      var f = file.files && file.files[0];
      if (!f) return;
      App.toast('جارٍ تجهيز الشعار…');
      processLogo(f, function (r) {
        if (!r) { App.toast('تعذّرت قراءة الصورة — جرّب صورة PNG أو JPG'); return; }
        App.store.set('carLogo', r);
        if (!C.logo()) { App.toast('الصورة كبيرة جداً — جرّب صورة أصغر'); return; }
        App.settings.logoMode = r.a ? 'chrome' : 'orig';
        App.saveSettings();
        C.applyLogo();
        C.renderChip();
        redraw();
        App.toast('تم وضع الشعار ✓');
      });
    };
    if (root.querySelector('#cDel')) root.querySelector('#cDel').onclick = function () {
      App.store.set('carLogo', null);
      App.settings.logoMode = null;
      App.saveSettings();
      C.applyLogo();
      C.renderChip();
      redraw();
    };
    root.querySelectorAll('#cMode [data-m]').forEach(function (b) {
      b.onclick = function () {
        if (b.disabled) return;
        App.settings.logoMode = b.dataset.m;
        App.saveSettings();
        root.querySelector('#cStage').innerHTML = C.badge('bl-stage');
        C.renderChip();
        root.querySelectorAll('#cMode [data-m]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    root.querySelectorAll('#cColor [data-c]').forEach(function (b) {
      b.onclick = function () {
        save('color', b.dataset.c);
        root.querySelectorAll('#cColor [data-c]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    root.querySelector('#cBrand').onchange = function () { save('brand', this.value); };
    root.querySelector('#cYear').onchange = function () { save('year', this.value); };
    root.querySelector('#cModel').onchange = function () { save('model', this.value.trim()); };
    root.querySelector('#cDriver').onchange = function () { save('driver', this.value.trim()); };
  };

  // ---------- welcome screen (first run of this version) ----------
  TH.welcome = function () {
    var w = document.createElement('div');
    w.id = 'welcome';
    w.className = 'welcome';
    document.body.appendChild(w);
    function step1() {
      w.innerHTML = '<div class="wl-card"><div class="wl-head"><span class="wl-logo">' + App.icon('wheel') + '</span>' +
        '<div><h1>أهلاً بك في <span class="silver-text">رحلة</span></h1><p>واجهة قيادة ذكية تناسب أي سيارة — اختر سيارتك وثيمك المفضّل' +
        '<span class="wl-dev">' + App.icon('cube') + App.esc(App.android.name) + (App.android.model ? ' • ' + App.esc(App.android.model) : '') + '</span></p></div></div>' +
        '<div class="wl-body" id="wlEd">' + C.editor() + '</div>' +
        '<div class="wl-foot"><span class="wl-dots"><i class="on"></i><i></i></span><span class="wl-copy">' + App.brand() + '<small>© ' + App.d('2026') + '</small></span>' +
        '<button class="btn primary" id="wNext">التالي ' + App.icon('back') + '</button></div></div>';
      C.bindEditor(App.$('wlEd'));
      App.$('wNext').onclick = step2;
    }
    function step2() {
      w.innerHTML = '<div class="wl-card"><div class="wl-head"><span class="wl-logo">' + App.icon('palette') + '</span>' +
        '<div><h1>اختر الثيم</h1><p>تقدر تغيّره أي وقت من الإعدادات. ثيمات اليوم الوطني ويوم التأسيس تتفعّل تلقائياً في موسمها.</p></div></div>' +
        '<div class="wl-body">' + TH.cards(TH.effectiveKey()) + '<div class="sec-title" style="margin-top:1.4vmin">لون الثيم المخصص</div>' + TH.customRow() + '</div>' +
        '<div class="wl-foot"><span class="wl-dots"><i></i><i class="on"></i></span><span class="wl-copy">' + App.brand() + '<small>© ' + App.d('2026') + '</small></span>' +
        '<button class="btn primary" id="wDone">ابدأ القيادة ' + App.icon('car') + '</button></div></div>';
      TH.bindCards(w);
      TH.bindCustom(w, function () { w.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('on', x.dataset.theme === 'custom'); }); });
      App.$('wDone').onclick = function () {
        App.settings.onboarded = 2;
        App.saveSettings();
        w.classList.add('out');
        setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); App.emit('welcomeDone'); }, 350);
      };
    }
    step1();
  };

  // ---------- celebration (on the national / founding day itself, once) ----------
  TH.celebrate = function (force) {
    var occ = App.occasion();
    if (!occ || (!occ.today && !force)) return;
    var key = 'celebrated' + new Date().toDateString();
    if (!force && App.store.get(key, false)) return;
    App.store.set(key, true);
    var cols = occ.theme === 'national' ? ['#ffffff', '#1f9e5f', '#9ff2c5', '#0d5a35'] : ['#e7bd68', '#ffe3a3', '#6b4527', '#2f8f5c'];
    var box = document.createElement('div');
    box.className = 'confetti';
    for (var i = 0; i < 46; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 1.2) + 's';
      p.style.animationDuration = (2.6 + Math.random() * 1.8) + 's';
      p.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
      box.appendChild(p);
    }
    var msg = document.createElement('div');
    msg.className = 'occ-hero';
    msg.innerHTML = '<b>' + occ.label + '</b><span>' + occ.greet + '</span>';
    box.appendChild(msg);
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 6500);
  };

  // ---------- start-up intro (car drives in, name fades up) ----------
  TH.intro = function () {
    var el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = '<div class="in-brand"><img src="img/splash.jpg" alt="أبو دانة للبرمجة"><i class="in-shine"></i></div>' +
      '<div class="in-side"><div class="in-name">رحلة</div><div class="in-sub">' + App.esc(C.title()) + ' • ' + App.esc(TH.cur ? TH.cur.name : '') + ' • ' + App.esc(App.android.name) + '</div>' +
      '<div class="in-by">' + App.brand() + '<span>جميع الحقوق محفوظة © ' + App.d('2026') + ' أبو دانة للبرمجة</span></div></div>';
    document.body.appendChild(el);
    el.onclick = function () { el.classList.add('out'); };
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  };

  TH.init = function () {
    TH.apply();
    C.applyLogo();
    C.renderChip();
    App.$('carChip').onclick = function () { App.panels.open('car'); };
    App.on('settings', function () { C.renderChip(); });
    // re-check occasions at midnight-ish
    setInterval(function () { if (TH.effectiveKey() !== TH.key) TH.apply(); }, 60000);
    if ((App.settings.onboarded || 0) < 2) setTimeout(TH.welcome, 400);
    else {
      if (!window.__noIntro) TH.intro();
      setTimeout(function () { TH.celebrate(false); }, 2500);
    }
  };
})();
