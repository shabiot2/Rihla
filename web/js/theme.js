/* theme.js — the skins. Each one is its own world: layout, type, background, motion and the way the prayer
   day is drawn (a 24-hour ring, a sun path over the dunes, a neon timeline, a watch dial, a mihrab, a rainbow).
   Also: the car profile, occasions (Friday, National Day, Founding Day) and the welcome screen. */
(function () {
  'use strict';

  // ---------- original geometric patterns (used by the Friday / National / Founding backgrounds) ----------
  function svgUrl(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27') + '")'; }
  function star8(cx, cy, R) {
    var a = R / Math.SQRT2, f = function (x) { return Math.round(x * 100) / 100; };
    return 'M' + f(cx) + ' ' + f(cy - R) + 'L' + f(cx + R) + ' ' + f(cy) + 'L' + f(cx) + ' ' + f(cy + R) + 'L' + f(cx - R) + ' ' + f(cy) + 'Z' +
      'M' + f(cx - a) + ' ' + f(cy - a) + 'H' + f(cx + a) + 'V' + f(cy + a) + 'H' + f(cx - a) + 'Z';
  }
  var STARS = [[36, 36], [0, 0], [72, 0], [0, 72], [72, 72]];
  var PAT = App.patterns = {
    islamic: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>" +
      "<path d='" + STARS.map(function (c) { return star8(c[0], c[1], 25.46); }).join('') + "' fill='none' stroke='#e3be6a' stroke-opacity='.13' stroke-width='1.3'/>" +
      "<path d='" + STARS.map(function (c) { return star8(c[0], c[1], 11); }).join('') + "' fill='none' stroke='#e3be6a' stroke-opacity='.08' stroke-width='1'/>" +
      STARS.map(function (c) { return "<circle cx='" + c[0] + "' cy='" + c[1] + "' r='2.6' fill='#e3be6a' fill-opacity='.12'/>"; }).join('') + "</svg>"),
    najdi: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><path d='M0 64 16 50 32 64ZM32 64 48 50 64 64Z' fill='#fff' fill-opacity='.06'/>" +
      "<path d='M32 10 41 19 32 28 23 19Z' fill='none' stroke='#fff' stroke-opacity='.08' stroke-width='1.5'/><circle cx='32' cy='19' r='2' fill='#fff' fill-opacity='.08'/></svg>"),
    sadu: svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='84' height='48'><rect width='84' height='48' fill='#7c1e22'/>" +
      "<path d='M0 24 10.5 14 21 24 31.5 14 42 24 52.5 14 63 24 73.5 14 84 24' fill='none' stroke='#f3dca6' stroke-width='3'/>" +
      "<path d='M42 2 48 8 42 14 36 8ZM0 34 6 40 0 46ZM84 34 78 40 84 46Z' fill='#f3dca6'/><path d='M21 36 25 40 21 44 17 40ZM63 36 67 40 63 44 59 40Z' fill='#1d1208'/>" +
      "<rect y='0' width='84' height='3' fill='#1d1208'/><rect y='45' width='84' height='3' fill='#1d1208'/></svg>")
  };
  App.star8 = star8;

  // ---------- the skins ----------
  // layout: how the home grid is arranged (CSS), viz: how home.js draws the prayer day, metal: the logo bezel
  var SKINS = {
    orbit: { name: 'مدار', sub: 'حلقة يومك حول الساعة تحت أضواء الشفق', layout: 'orbit', viz: 'ring', metal: 'silver',
      font: '"Readex Pro"', bg: '#050817', fg: '#eef2ff' },
    dune: { name: 'كثبان', sub: 'سماء تتلوّن مع الشمس فوق الرمال', layout: 'dune', viz: 'sun', metal: 'gold',
      font: '"Alexandria"', bg: '#f3d9ac', fg: '#3a2414' },
    neon: { name: 'نيون', sub: 'طريق الليل بأضواء الثمانينات', layout: 'neon', viz: 'line', metal: 'silver',
      font: '"Changa"', bg: '#0b0221', fg: '#ffe6f6' },
    luxe: { name: 'فخامة', sub: 'ساعة ذهبية على ألياف الكربون', layout: 'luxe', viz: 'watch', metal: 'gold',
      font: '"El Messiri"', bg: '#0d0b09', fg: '#f2e2b6' },
    pure: { name: 'صافي', sub: 'فاتح بألوان زاهية، واضح تحت الشمس', layout: 'pure', viz: 'none', metal: 'silver',
      font: '"IBM Plex Sans Arabic"', bg: '#eef1f7', fg: '#11142a' },
    girls: { name: 'بناتي', sub: 'وردي ناعم بالغيوم والنجوم وصوركم', layout: 'girls', viz: 'rainbow', metal: 'rose',
      font: '"Baloo Bhaijaan 2"', bg: '#ffe4ea', fg: '#7a3d52' },
    live: { name: 'حيّ', sub: 'خلفيات متحركة تختار منها، واستهلاك البنزين من السيارة', layout: 'live', viz: 'none', metal: 'silver',
      font: '"Alexandria"', bg: '#05060d', fg: '#f3f5ff' },
    glass: { name: 'زجاج', sub: 'زجاج مغبّش بصورة بناتك — وألوانه من ألوانها', layout: 'glass', viz: 'halo', metal: 'silver',
      font: '"Alexandria"', bg: '#1b0f2e', fg: '#fff0f7' },
    friday: { name: 'الجمعة', sub: 'محراب وزخارف ذهبية — تلقائي كل جمعة', layout: 'friday', viz: 'arch', metal: 'gold', occasion: 'friday',
      font: '"Amiri"', bg: '#0b3d2e', fg: '#fbf4e2' },
    national: { name: 'اليوم الوطني', sub: 'أخضر وأبيض بنقوش نجدية — في موسمه', layout: 'orbit', viz: 'ring', metal: 'silver', occasion: 'national',
      font: '"Cairo"', bg: '#00361b', fg: '#ffffff' },
    founding: { name: 'يوم التأسيس', sub: 'طين نجدي ونقش السدو — في موسمه', layout: 'dune', viz: 'sun', metal: 'gold', occasion: 'founding',
      font: '"Aref Ruqaa"', bg: '#3b2414', fg: '#fbf1dc' }
  };
  var ORDER = ['orbit', 'live', 'dune', 'neon', 'luxe', 'pure', 'girls', 'glass', 'friday', 'national', 'founding'];
  var LEGACY = { silver: 'orbit', royal: 'orbit', match: 'pure', black: 'luxe', custom: 'orbit' };   // skins of v2.x
  var METAL = {
    silver: ['#ffffff', '#d3d9de', '#7f8891', '#e2e6e9', '#8a939b'],
    gold: ['#fff7e0', '#ead08c', '#8a6a33', '#f3dca6', '#9c7a3f'],
    rose: ['#fff4f6', '#f6c9d2', '#a8636b', '#fadde3', '#b9737c']
  };

  // ---------- colour helpers ----------
  function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgb2hex(c) { return '#' + c.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(h) { var c = hex2rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  App.color = { mix: mix, lum: lum, hex2rgb: hex2rgb };

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
  // 'day' on Friday, 'eve' on Thursday after Maghrib (ليلة الجمعة), otherwise null
  App.fridayPhase = function (now) {
    now = now || new Date();
    var dow = now.getDay();
    if (dow === 5) return 'day';
    if (dow !== 4) return null;
    var t = App.prayer && App.prayer.today, mg = t && t[4];
    if (!mg || mg.toDateString() !== now.toDateString()) mg = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 45);
    return now >= mg ? 'eve' : null;
  };
  App.fridayKey = function (now) {
    now = now || new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getDay() === 4 ? 1 : 0)).toDateString();
  };
  App.occasion = function (now, noFriday) {
    now = now || new Date();
    var m = now.getMonth() + 1, d = now.getDate(), y = now.getFullYear(), occ = null;
    if (m === 9 && d >= 16 && d <= 30) {
      occ = { theme: 'national', today: d === 23, label: 'اليوم الوطني السعودي ' + App.d(y - 1930), greet: 'كل عام والوطن بخير 💚' };
    } else if (m === 2 && d >= 15 && d <= 28) {
      occ = { theme: 'founding', today: d === 22, label: 'يوم التأسيس — منذ ' + App.d(1727) + 'م', greet: 'يوم بدينا 🤍' };
    }
    var fr = noFriday ? null : App.fridayPhase(now);
    if (fr && !(occ && occ.today)) {            // the national / founding day itself still wins
      return { theme: 'friday', weekly: true, today: fr === 'day', key: 'friday' + App.fridayKey(now),
        label: fr === 'day' ? 'جمعة مباركة' : 'ليلة الجمعة', greet: 'اللهم صلِّ وسلِّم على نبينا محمد' };
    }
    return occ;
  };

  function occKey(occ) { return occ ? (occ.key || occ.theme + new Date().getFullYear()) : false; }
  function lockIfOccasion() { App.settings.themeLocked = occKey(App.occasion()); }

  function occKey(occ) { return occ ? (occ.key || occ.theme + new Date().getFullYear()) : false; }
  function lockIfOccasion() { App.settings.themeLocked = occKey(App.occasion()); }

  // ---------- apply ----------
  var TH = App.theme = { cur: null, key: null, SKINS: SKINS, ORDER: ORDER };
  TH.effectiveKey = function () {
    var s = App.settings, occ = App.occasion();
    if (occ && occ.weekly && s.autoFriday === false) occ = App.occasion(null, true);
    if (occ && (occ.weekly || s.autoOccasion !== false) && s.themeLocked !== occKey(occ)) return occ.theme;
    var k = LEGACY[s.theme] || s.theme;
    return SKINS[k] ? k : 'orbit';
  };
  TH.get = function (key) { return SKINS[key] || SKINS.orbit; };
  function swap(key) {
    var s = SKINS[key], b = document.body, st = document.documentElement.style;
    b.setAttribute('data-skin', key);
    b.setAttribute('data-layout', s.layout);
    METAL[s.metal].forEach(function (c, i) { st.setProperty('--bezel-' + i, c); });
    TH.cur = s; TH.key = key;
    var occ = App.occasion(), chip = App.$('occChip');
    if (chip) {
      chip.classList.toggle('hidden', !occ);
      if (occ) chip.textContent = occ.label;
    }
    App.emit('skin', key);
  }
  // a short title card in the new skin's own type and colours, then the swap underneath it
  function curtain(key, done) {
    var s = SKINS[key], el = document.createElement('div');
    el.className = 'curtain';
    el.style.background = s.bg;
    el.style.color = s.fg;
    el.innerHTML = '<b style="font-family:' + s.font.replace(/"/g, "'") + '">' + s.name + '</b><small>' + s.sub + '</small>';
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(function () {
      done();
      setTimeout(function () {
        el.classList.remove('on');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
      }, 520);
    }, 330);
  }
  TH.apply = function (fade) {
    var key = TH.effectiveKey();
    if (fade && TH.key && TH.key !== key && !window.__noCurtain) curtain(key, function () { swap(key); });
    else swap(key);
  };
  TH.list = function () { return ORDER.map(function (k) { return { key: k, t: SKINS[k] }; }); };

  // skin cards: a miniature of each world, its name set in its own typeface
  TH.cards = function (sel) {
    return '<div class="skin-grid">' + ORDER.map(function (k) {
      var s = SKINS[k];
      return '<button class="skin-card' + (k === sel ? ' on' : '') + '" data-theme="' + k + '">' +
        '<span class="sk-prev p-' + k + '"><i></i><i></i><i></i></span>' +
        '<b style="font-family:' + s.font.replace(/"/g, "'") + '">' + s.name + '</b><small>' + s.sub + '</small></button>';
    }).join('') + '</div>';
  };
  TH.bindCards = function (root, onPick) {
    root.querySelectorAll('[data-theme]').forEach(function (b) {
      b.onclick = function () {
        App.settings.theme = b.dataset.theme;
        lockIfOccasion();                                   // a manual pick during an occasion wins (that year)
        App.saveSettings();
        TH.apply(true);
        root.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (onPick) onPick(b.dataset.theme);
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
      '<div class="sec-title">لون السيارة</div><div class="swatches" id="cColor">' + COLORS.map(function (x) {
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
        '<div><h1>أهلاً بك في <span class="silver-text">رحلة</span></h1><p>واجهة قيادة تناسب أي سيارة — اختر سيارتك ثم العالم اللي يعجبك' +
        '<span class="wl-dev">' + App.icon('cube') + App.esc(App.android.name) + (App.android.model ? ' • ' + App.esc(App.android.model) : '') + '</span></p></div></div>' +
        '<div class="wl-body" id="wlEd">' + C.editor() + '</div>' +
        '<div class="wl-foot"><span class="wl-dots"><i class="on"></i><i></i></span><span class="wl-copy">' + App.brand() + '<small>© ' + App.d('2026') + '</small></span>' +
        '<button class="btn primary" id="wNext">التالي ' + App.icon('back') + '</button></div></div>';
      C.bindEditor(App.$('wlEd'));
      App.$('wNext').onclick = step2;
    }
    function step2() {
      w.innerHTML = '<div class="wl-card"><div class="wl-head"><span class="wl-logo">' + App.icon('palette') + '</span>' +
        '<div><h1>اختر عالمك</h1><p>كل ثيم شكل مختلف بالكامل: الترتيب والخط والخلفية والحركة. ثيم الجمعة والمناسبات الوطنية تتفعّل تلقائياً في وقتها.</p></div></div>' +
        '<div class="wl-body">' + TH.cards(TH.effectiveKey()) + '</div>' +
        '<div class="wl-foot"><span class="wl-dots"><i></i><i class="on"></i></span><span class="wl-copy">' + App.brand() + '<small>© ' + App.d('2026') + '</small></span>' +
        '<button class="btn primary" id="wDone">ابدأ القيادة ' + App.icon('car') + '</button></div></div>';
      TH.bindCards(w);
      App.$('wDone').onclick = function () {
        App.settings.onboarded = 3;
        App.saveSettings();
        w.classList.add('out');
        setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); App.emit('welcomeDone'); }, 350);
      };
    }
    step1();
  };

  // ---------- celebration (on the national / founding day itself, once) ----------
  function fridayHero(occ, force) {
    var k = 'friHero.' + occ.key + (occ.today ? 'd' : 'e');      // once on Thursday night, once on Friday
    if (!force && (window.__noHero || App.store.get(k, false))) return;     // __noHero: UI test harness
    App.store.set(k, true);
    var el = document.createElement('div');
    el.className = 'fri-hero';
    el.innerHTML = '<div class="fh-box"><svg class="fh-star" viewBox="-30 -30 60 60"><path d="' + star8(0, 0, 26) + '"/><circle r="6"/></svg>' +
      '<b>' + occ.label + '</b><span>اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّد</span>' +
      '<small>«فأكثِروا عليَّ من الصلاة فيه» — رواه أبو داود</small></div>';
    document.body.appendChild(el);
    el.onclick = function () { el.classList.add('out'); };
    setTimeout(function () { el.classList.add('out'); }, 6000);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6800);
  }
  TH.celebrate = function (force) {
    var occ = App.occasion();
    if (occ && occ.weekly) { if (TH.key === 'friday' || force) fridayHero(occ, force); return; }
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

  // ---------- start-up welcome (js/intro.js): the Abu Dana logo assembles itself ----------
  TH.intro = function () { if (App.intro) App.intro.play(); };

  TH.init = function () {
    TH.apply(false);
    C.applyLogo();
    C.renderChip();
    App.$('carChip').onclick = function () { App.panels.open('car'); };
    App.on('settings', function () { C.renderChip(); });
    // occasions start and end on their own (Thursday's Maghrib, midnight, the season)
    setInterval(function () { if (TH.effectiveKey() !== TH.key) { TH.apply(true); TH.celebrate(false); } }, 60000);
    if ((App.settings.onboarded || 0) < 3) setTimeout(TH.welcome, 400);
    else {
      if (!window.__noIntro) TH.intro();
      setTimeout(function () { TH.celebrate(false); }, 2500);
    }
  };
})();
