/* system.js — sheet/panel manager, apps drawer + favourites, Wi-Fi, Bluetooth, settings */
(function () {
  'use strict';
  var N = App.Native;

  // ---------- panel manager ----------
  var P = App.panels = { current: null, stack: [] };
  function show(title, render, sub) {
    App.$('sheet').classList.remove('hidden');
    App.$('sheetTitle').textContent = title;
    App.$('sheetBack').classList.toggle('hidden', !sub);
    var body = App.$('sheetBody');
    body.innerHTML = '';
    body.scrollTop = 0;
    render(body);
  }
  function markDock() {
    document.querySelectorAll('.dk').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === P.current); });
  }
  P.open = function (name) {
    var def = App.panelDefs[name];
    if (!def) return;
    if (P.current === name && !P.stack.length) { P.close(); return; }
    App.$('ctxMenu').classList.add('hidden');
    P.current = name;
    P.stack = [];
    App.map.paused = true;
    show(def.title, def.render, false);
    markDock();
    App.radio.ui();
  };
  P.push = function (title, render) {
    if (!P.current) { P.current = 'sub'; App.map.paused = true; markDock(); }
    P.stack.push({ title: title, render: render });
    show(title, render, true);
  };
  P.back = function () {
    P.stack.pop();
    if (P.stack.length) { var t = P.stack[P.stack.length - 1]; show(t.title, t.render, true); return; }
    var def = App.panelDefs[P.current];
    if (def) show(def.title, def.render, false); else P.close();
  };
  P.refresh = function () {
    if (!P.current) return;
    if (P.stack.length) { var t = P.stack[P.stack.length - 1]; show(t.title, t.render, true); }
    else if (App.panelDefs[P.current]) show(App.panelDefs[P.current].title, App.panelDefs[P.current].render, false);
  };
  P.close = function () {
    App.$('sheet').classList.add('hidden');
    App.$('sheetBody').innerHTML = '';
    P.current = null;
    P.stack = [];
    App.map.paused = false;
    App.map.invalidate();
    markDock();
    App.radio.ui();
  };

  // ---------- apps ----------
  var S = App.system = { list: null };
  var icons = App.store.get('icons', {});
  var saveIconsT = null;
  S.apps = function (refresh) {
    if (S.list && !refresh) return S.list;
    var arr = N.json('apps') || [], seen = {};
    S.list = arr.filter(function (a) {
      if (!a.p || a.p === 'com.carnav.camry' || seen[a.p]) return false;
      seen[a.p] = 1;
      return true;
    }).sort(function (a, b) { return String(a.l).localeCompare(String(b.l), 'ar'); });
    return S.list;
  };
  S.label = function (p) {
    var a = (S.list || []).filter(function (x) { return x.p === p; })[0];
    return a ? a.l : p;
  };
  S.icon = function (p) {
    if (icons[p]) return icons[p];
    var r = N.call('icon', p);
    if (r && r !== 'ERR' && r.length > 50) {
      icons[p] = 'data:image/png;base64,' + r;
      clearTimeout(saveIconsT);
      saveIconsT = setTimeout(function () { App.store.set('icons', icons); }, 3000);
      return icons[p];
    }
    return null;
  };
  S.launch = function (p, label) {
    if (!N.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return false; }
    if (N.call('launch', p) === '1') return true;
    App.toast((label || 'التطبيق') + ' غير مثبت على الشاشة');
    return false;
  };
  S.intent = function (action) {
    if (!N.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    if (N.call('intent', action) !== '1') App.toast('تعذّر فتح الإعدادات');
  };
  function placeholder(l) { return '<span class="ph">' + App.esc(String(l || '?').trim().charAt(0)) + '</span>'; }

  function lazyIcons(root) {
    var q = Array.prototype.slice.call(root.querySelectorAll('[data-icon]'));
    (function step() {
      var t0 = Date.now();
      while (q.length && Date.now() - t0 < 30) {
        var el = q.shift(), src = S.icon(el.dataset.icon);
        if (src) el.outerHTML = '<img src="' + src + '" alt="">';
      }
      if (q.length && document.body.contains(root)) setTimeout(step, 16);
    })();
  }
  S.renderFavs = function () {
    var box = App.$('favs'), favs = (App.settings.favs || []).slice(0, 3);
    box.innerHTML = favs.map(function (p) {
      return '<button class="fav" data-p="' + App.esc(p) + '"><span data-icon="' + App.esc(p) + '">' + placeholder(S.label(p)) +
        '</span><span>' + App.esc(S.label(p)) + '</span></button>';
    }).join('');
    box.querySelectorAll('.fav').forEach(function (b) { b.onclick = function () { S.launch(b.dataset.p, S.label(b.dataset.p)); }; });
    lazyIcons(box);
  };
  function renderApps(body) {
    if (!N.has) { body.innerHTML = '<div class="empty">قائمة التطبيقات تظهر عند تشغيل الواجهة على شاشة السيارة</div>'; return; }
    var list = S.apps(true);
    body.innerHTML = '<div class="search-input">' + App.icon('search') + '<input id="aFilter" placeholder="بحث في التطبيقات…"></div>' +
      '<div class="note" style="margin-bottom:1.2vmin">اضغط ★ لإضافة التطبيق إلى الشريط السفلي (حتى ٣ تطبيقات).</div>' +
      '<div class="apps-grid" id="aGrid">' + list.map(function (a) {
        var on = App.settings.favs.indexOf(a.p) >= 0;
        return '<button class="app" data-p="' + App.esc(a.p) + '" data-l="' + App.esc(String(a.l).toLowerCase()) + '">' +
          '<svg class="ic pin' + (on ? ' on' : '') + '" data-pin="1"><use href="#i-star"/></svg>' +
          '<span data-icon="' + App.esc(a.p) + '">' + placeholder(a.l) + '</span><span>' + App.esc(a.l) + '</span></button>';
      }).join('') + '</div>';
    var grid = App.$('aGrid');
    grid.onclick = function (e) {
      var b = e.target.closest('.app');
      if (!b) return;
      if (e.target.closest('[data-pin]')) {
        var f = App.settings.favs, i = f.indexOf(b.dataset.p);
        if (i >= 0) f.splice(i, 1); else { f.unshift(b.dataset.p); if (f.length > 3) f.pop(); }
        App.saveSettings();
        S.renderFavs();
        grid.querySelectorAll('.app').forEach(function (x) {
          x.querySelector('.pin').setAttribute('class', 'ic pin' + (f.indexOf(x.dataset.p) >= 0 ? ' on' : ''));
        });
        return;
      }
      S.launch(b.dataset.p, S.label(b.dataset.p));
    };
    App.$('aFilter').oninput = function () {
      var q = this.value.trim().toLowerCase();
      grid.querySelectorAll('.app').forEach(function (x) {
        x.style.display = !q || x.dataset.l.indexOf(q) >= 0 || x.dataset.p.indexOf(q) >= 0 ? '' : 'none';
      });
    };
    lazyIcons(grid);
  }

  // ---------- Wi-Fi ----------
  S.wifi = function (cmd) { return N.json('wifi', cmd || ''); };
  function renderWifi(body) {
    var w = S.wifi();
    var on = w && w.on, ssid = w && w.ssid && w.ssid !== '<unknown ssid>' ? w.ssid.replace(/^"|"$/g, '') : '';
    var bars = w && w.rssi ? (w.rssi > -55 ? 'ممتازة' : w.rssi > -67 ? 'جيدة' : w.rssi > -78 ? 'متوسطة' : 'ضعيفة') : '';
    body.innerHTML =
      '<div class="big-status' + (on ? ' on' : '') + '">' + App.icon('wifi') + '<div class="txt"><b>' +
      (!w ? 'الواي فاي' : on ? (ssid ? 'متصل بـ ' + App.esc(ssid) : 'مفعّل — غير متصل') : 'الواي فاي متوقف') +
      '</b><small>' + (ssid && bars ? 'قوة الإشارة: ' + bars : navigator.onLine ? 'الإنترنت متاح' : 'لا يوجد اتصال بالإنترنت') + '</small></div>' +
      (w ? '<button class="switch' + (on ? ' on' : '') + '" id="wSw"></button>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn primary" id="wNets">' + App.icon('wifi') + 'اختيار شبكة واي فاي</button>' +
      '<button class="btn" id="wMore">' + App.icon('settings') + 'إعدادات الشبكة</button></div>' +
      '<div class="note" style="margin-top:1.6vmin">💡 لتشغيل الإنترنت في السيارة: فعّل «نقطة الاتصال الشخصية» في جوالك، ثم اختر شبكتها من «اختيار شبكة واي فاي». ' +
      'الخرائط والبحث والإذاعات تحتاج إنترنت؛ أما السرعة ومواقيت الصلاة فتعمل بدونه.</div>';
    if (App.$('wSw')) App.$('wSw').onclick = function () {
      var want = !this.classList.contains('on');
      this.classList.toggle('on', want);
      S.wifi(want ? 'on' : 'off');
      App.toast(want ? 'جارٍ تشغيل الواي فاي…' : 'تم إيقاف الواي فاي');
      setTimeout(function () { if (P.current === 'wifi') P.refresh(); S.status(); }, 2500);
    };
    App.$('wNets').onclick = function () { S.intent('android.settings.WIFI_SETTINGS'); };
    App.$('wMore').onclick = function () { S.intent('android.settings.WIRELESS_SETTINGS'); };
  }

  // ---------- Bluetooth ----------
  var BT_PKGS = ['com.syu.bt', 'com.microntek.bluetooth', 'com.ts.bt', 'com.fyt.bt', 'com.hzbhd.bt', 'com.syu.btphone',
    'com.zjinnova.bt', 'com.tw.bt', 'com.nwd.bt', 'com.autochips.bluetooth', 'com.android.bluetooth.phone', 'com.ts.MainUI'];
  S.bt = function (cmd) { return N.json('bt', cmd || ''); };
  S.openBtApp = function (choose) {
    if (!N.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    if (App.settings.btApp && !choose && N.call('launch', App.settings.btApp) === '1') return;
    var c = S.apps().filter(function (a) {
      return BT_PKGS.indexOf(a.p) >= 0 || /bluetooth|blue tooth|بلوتوث|بلوتوت|bt ?phone|bt ?music/i.test(a.l) || /bluetooth|\.bt(\.|$)|btphone|btmusic/i.test(a.p);
    });
    if (c.length === 1 && !choose) { App.settings.btApp = c[0].p; App.saveSettings(); S.openBtApp(); return; }
    if (!c.length && !choose) { S.intent('android.settings.BLUETOOTH_SETTINGS'); return; }
    P.push('اختر تطبيق البلوتوث', function (body) {
      var list = c.length ? c : S.apps();
      body.innerHTML = '<div class="note" style="margin-bottom:1.2vmin">اختر تطبيق البلوتوث/الهاتف الخاص بالشاشة — سيُحفظ اختيارك.</div>' +
        list.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '">' + App.icon('bt', 'lead') + '<span class="txt"><b>' + App.esc(a.l) +
            '</b><small>' + App.esc(a.p) + '</small></span></button>';
        }).join('');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () { App.settings.btApp = b.dataset.p; App.saveSettings(); P.close(); S.openBtApp(); };
      });
    });
  };
  function renderBt(body) {
    var b = S.bt();
    var on = b && b.on, conn = b && (b.a2dp === 2 || b.hfp === 2);
    var what = b && [b.a2dp === 2 ? 'صوت الوسائط' : '', b.hfp === 2 ? 'المكالمات' : ''].filter(Boolean).join(' + ');
    body.innerHTML =
      '<div class="big-status' + (on ? ' on' : '') + '">' + App.icon('bt') + '<div class="txt"><b>' +
      (!b ? 'البلوتوث' : b.none ? 'لا يوجد بلوتوث' : on ? (conn ? 'متصل — ' + what : 'مفعّل — غير متصل') : 'البلوتوث متوقف') +
      '</b><small>' + (on ? 'الأجهزة المقترنة: ' + App.d((b.dev || []).length) : 'شغّل البلوتوث لربط جوالك') + '</small></div>' +
      (b && !b.none ? '<button class="switch' + (on ? ' on' : '') + '" id="bSw"></button>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn primary" id="bApp">' + App.icon('phone') + 'تطبيق البلوتوث والهاتف</button>' +
      '<button class="btn" id="bSet">' + App.icon('bt') + 'ربط جهاز جديد</button></div>' +
      (b && b.dev && b.dev.length ? '<div class="sec" style="margin-top:1.6vmin"><div class="sec-title">الأجهزة المقترنة</div>' +
        b.dev.map(function (n) {
          return '<div class="row">' + App.icon('phone', 'lead') + '<span class="txt"><b>' + App.esc(n) + '</b></span></div>';
        }).join('') + '</div>' : '') +
      '<div class="note" style="margin-top:1.4vmin">لربط الجوال أول مرة: «ربط جهاز جديد» ثم اختر الشاشة من بلوتوث جوالك. بعد الاقتران يتصل تلقائياً عند تشغيل السيارة.</div>';
    if (App.$('bSw')) App.$('bSw').onclick = function () {
      var want = !this.classList.contains('on');
      this.classList.toggle('on', want);
      S.bt(want ? 'on' : 'off');
      App.toast(want ? 'جارٍ تشغيل البلوتوث…' : 'تم إيقاف البلوتوث');
      setTimeout(function () { if (P.current === 'bt') P.refresh(); S.status(); }, 2500);
    };
    App.$('bApp').onclick = function () { S.openBtApp(false); };
    App.$('bApp').oncontextmenu = function (e) { e.preventDefault(); S.openBtApp(true); };
    App.$('bSet').onclick = function () { S.intent('android.settings.BLUETOOTH_SETTINGS'); };
  }

  // ---------- status icons ----------
  S.status = function () {
    App.$('stNet').setAttribute('class', 'ic st' + (App.offline ? ' acc' : navigator.onLine !== false ? ' ok' : ''));
    if (!N.has) return;
    var w = S.wifi(), b = S.bt();
    App.$('stWifi').setAttribute('class', 'ic st' + (w && w.on ? (w.ssid && w.ssid !== '<unknown ssid>' && w.rssi > -127 ? ' ok' : ' on') : ''));
    App.$('stBt').setAttribute('class', 'ic st' + (b && b.on ? (b.a2dp === 2 || b.hfp === 2 ? ' acc' : ' on') : ''));
  };

  // ---------- settings ----------
  function seg(id, opts, cur) {
    return '<div class="seg" id="' + id + '">' + opts.map(function (o) {
      return '<button data-v="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' class="on"' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function sw(id, on) { return '<button class="switch' + (on ? ' on' : '') + '" id="' + id + '"></button>'; }
  function row(title, sub, ctrl) {
    return '<div class="set-row"><div class="txt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + ctrl + '</div>';
  }
  var PN = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
  function renderSettings(body) {
    var s = App.settings;
    body.innerHTML =
      '<div class="sec"><div class="sec-title">المظهر والثيمات</div>' + App.theme.cards(App.theme.key) +
      '<div class="sec-title" style="margin-top:.6vmin">لون الثيم «مخصص»</div>' + App.theme.customRow() +
      row('ثيمات المناسبات تلقائياً', 'اليوم الوطني في سبتمبر ويوم التأسيس في فبراير', sw('sOcc', s.autoOccasion)) +
      row('سيارتي', App.esc(App.car.title() + (App.car.subtitle() ? ' — ' + App.car.subtitle() : '')),
        '<button class="btn" id="sCar">' + App.icon('car') + 'تعديل</button>') +
      row('شاشة الترحيب', 'إعادة خطوات اختيار السيارة والثيم', '<button class="btn" id="sWelcome">' + App.icon('sparkle') + 'عرض</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">السرعة</div>' +
      row('تنبيه تجاوز السرعة', 'تنبيه صوتي ومرئي عند تجاوز الحد', sw('sAlert', s.speedAlert)) +
      row('حد السرعة', 'كم/س', '<div class="stepper"><button class="round small" data-lim="-10">' + App.icon('minus') +
        '</button><b class="num" id="sLim">' + App.d(s.speedLimit) + '</b><button class="round small" data-lim="10">' + App.icon('plus') + '</button></div>') +
      row('عداد الرحلة', 'أو اضغط مطولاً على العدّاد', '<button class="btn" id="sTrip">تصفير</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">الخريطة والملاحة</div>' +
      row('نمط الخريطة', '', seg('sStyle', [['auto', 'تلقائي'], ['light', 'نهاري'], ['dark', 'ليلي'], ['sat', 'قمر صناعي'], ['ksa', 'بدون نت']], s.mapStyle)) +
      row('الخرائط بدون نت', 'خريطة المملكة المدمجة والشوارع المحفوظة', '<button class="btn" id="sOffline">' + App.icon('map') + 'فتح</button>') +
      row('الخريطة باتجاه السير', 'عند الإيقاف يكون الشمال للأعلى', sw('sHead', s.headingUp)) +
      row('التوجيه الصوتي', 'يتطلب محرك نطق عربي في الشاشة', sw('sVoice', s.voice)) + '</div>' +
      '<div class="sec"><div class="sec-title">مواقيت الصلاة — تقويم أم القرى</div>' +
      row('تنبيه دخول الوقت', 'نغمة قصيرة مع أقرب مسجد', sw('sChime', s.adhanChime)) +
      row('تذكير قبل الصلاة', 'مع اقتراح أقرب مسجد', seg('sPre', [['0', 'إيقاف'], ['5', '٥ د'], ['10', '١٠ د'], ['15', '١٥ د'], ['20', '٢٠ د']], s.prePrayer || 0)) +
      row('تذكير الأذكار', 'أذكار الصباح بعد الفجر والمساء بعد العصر', sw('sAdh', s.adhkarRemind)) +
      row('الموقع', App.esc(App.prayer.loc.city || '') + ' ' + App.ll(App.prayer.loc.lat, App.prayer.loc.lon, 3),
        '<button class="btn" id="sLoc">تحديث من GPS</button>') +
      '<div class="grid3">' + PN.map(function (n, i) {
        return '<div class="set-row" style="margin:0"><div class="txt"><b>' + n + '</b><small>تعديل بالدقائق</small></div>' +
          '<div class="stepper"><button class="round small" data-off="' + i + '" data-d="-1">' + App.icon('minus') + '</button><b class="num" id="sOff' + i + '">' +
          App.d((s.offsets[i] > 0 ? '+' : '') + (s.offsets[i] || 0)) + '</b><button class="round small" data-off="' + i + '" data-d="1">' + App.icon('plus') + '</button></div></div>';
      }).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-title">العرض</div>' +
      row('الأرقام', '', seg('sDig', [['latn', '123'], ['arab', '١٢٣']], s.digits)) +
      row('نظام الساعة', '', seg('sClk', [['12', '١٢ ساعة'], ['24', '٢٤ ساعة']], s.clock24 ? 24 : 12)) +
      row('ملء الشاشة', 'إخفاء شريط النظام', sw('sFull', s.full)) +
      row('الملخص اليومي', 'بطاقة المساعد عند أول تشغيل في اليوم', sw('sBrief', s.briefing)) + '</div>' +
      '<div class="sec"><div class="sec-title">النظام</div><div class="btn-row">' +
      '<button class="btn" id="sRadioApp">' + App.icon('radio') + 'تطبيق الراديو</button>' +
      '<button class="btn" id="sBtApp">' + App.icon('bt') + 'تطبيق البلوتوث</button>' +
      '<button class="btn" id="sGps">' + App.icon('gps') + 'إعدادات الموقع</button>' +
      '<button class="btn" id="sAndroid">' + App.icon('settings') + 'إعدادات أندرويد</button>' +
      '<button class="btn" id="sFanApp">' + App.icon('fan') + 'تطبيق المروحة</button></div></div>' +
      '<div class="sec"><div class="sec-title">الجهاز</div><div class="set-row"><div class="txt"><b>' + App.esc(App.android.name) +
      (App.android.sdk ? ' <small class="num">(API ' + App.d(App.android.sdk) + ')</small>' : '') + '</b><small>' +
      App.esc([App.android.maker, App.android.model, App.android.board].filter(Boolean).join(' • ') || 'شاشة أندرويد') +
      ' • ' + App.d(screen.width) + '×' + App.d(screen.height) + '</small></div>' +
      '<span class="chip ' + (App.android.supported ? 'on' : 'danger') + '">' + App.icon(App.android.supported ? 'check' : 'close') +
      (App.android.supported ? 'متوافق' : 'نسخة قديمة') + '</span></div></div>' +
      '<div class="sec"><div class="sec-title">حول التطبيق</div><div class="about">' + App.brand('lg') +
      '<div class="ab-txt"><b>رحلة — الإصدار ' + App.d('2.3') + '</b><span>جميع الحقوق محفوظة © ' + App.d('2026') + ' أبو دانة للبرمجة</span>' +
      '<small>تصميم وتطوير أبو دانة للبرمجة • بيانات الخرائط © OpenStreetMap • خريطة المملكة المدمجة: Natural Earth وبيانات الأحياء من homaily/Saudi-Arabia-Regions-Cities-and-Districts (GPL-2.0) • الملاحة OSRM • الإذاعات mp3quran.net و radio-browser.info • الطقس Open-Meteo</small></div></div></div>';

    function bindSw(id, key, after) {
      App.$(id).onclick = function () {
        s[key] = !s[key];
        this.classList.toggle('on', s[key]);
        App.saveSettings();
        if (after) after();
      };
    }
    bindSw('sAlert', 'speedAlert');
    bindSw('sHead', 'headingUp');
    bindSw('sVoice', 'voice', function () { if (s.voice) N.call('tts', ''); });
    bindSw('sChime', 'adhanChime');
    bindSw('sFull', 'full', function () { N.call('full', s.full ? '1' : '0'); });
    bindSw('sOcc', 'autoOccasion', function () { s.themeLocked = false; App.saveSettings(); App.theme.apply(); P.refresh(); });
    bindSw('sAdh', 'adhkarRemind');
    bindSw('sBrief', 'briefing');
    App.theme.bindCards(body);
    App.theme.bindCustom(body, function () { body.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('on', x.dataset.theme === 'custom'); }); });
    App.$('sCar').onclick = function () { App.panels.open('car'); };
    App.$('sWelcome').onclick = function () { P.close(); App.theme.welcome(); };
    App.$('sFanApp').onclick = function () { App.fan.openApp(true); };
    body.querySelectorAll('[data-lim]').forEach(function (b) {
      b.onclick = function () {
        s.speedLimit = Math.max(40, Math.min(220, s.speedLimit + (+b.dataset.lim)));
        App.$('sLim').textContent = App.d(s.speedLimit);
        App.saveSettings();
      };
    });
    body.querySelectorAll('[data-off]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.off, v = Math.max(-30, Math.min(30, (s.offsets[i] || 0) + (+b.dataset.d)));
        s.offsets[i] = v;
        App.$('sOff' + i).textContent = App.d((v > 0 ? '+' : '') + v);
        App.saveSettings();
      };
    });
    function bindSeg(id, fn) {
      App.$(id).querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { fn(b.dataset.v); App.saveSettings(); P.refresh(); };
      });
    }
    bindSeg('sStyle', function (v) { s.mapStyle = v; });
    App.$('sOffline').onclick = App.net.open;
    bindSeg('sDig', function (v) { s.digits = v; });
    bindSeg('sClk', function (v) { s.clock24 = v === '24'; });
    bindSeg('sPre', function (v) { s.prePrayer = +v; });
    App.$('sTrip').onclick = function () { App.loc.resetTrip(); };
    App.$('sLoc').onclick = function () {
      var f = App.loc.fix;
      if (!f) { App.toast('لا توجد إشارة GPS بعد'); return; }
      App.prayer.setLocation(f.lat, f.lon, true);
      App.toast('تم تحديث موقع حساب المواقيت');
      setTimeout(P.refresh, 300);
    };
    App.$('sRadioApp').onclick = function () { App.radio.openCarRadio(true); };
    App.$('sBtApp').onclick = function () { S.openBtApp(true); };
    App.$('sGps').onclick = function () { S.intent('android.settings.LOCATION_SOURCE_SETTINGS'); };
    App.$('sAndroid').onclick = function () { S.intent('android.settings.SETTINGS'); };
  }

  App.panelDefs = App.panelDefs || {};
  App.panelDefs.apps = { title: 'التطبيقات', render: renderApps };
  App.panelDefs.wifi = { title: 'الواي فاي والإنترنت', render: renderWifi };
  App.panelDefs.bt = { title: 'البلوتوث', render: renderBt };
  App.panelDefs.settings = { title: 'الإعدادات', render: renderSettings };

  S.init = function () {
    App.$('sheetClose').onclick = P.close;
    App.$('sheetBack').onclick = P.back;
    document.querySelectorAll('.dk').forEach(function (b) { b.onclick = function () { P.open(b.dataset.panel); }; });
    if (N.has) { S.apps(); S.renderFavs(); }
    S.status();
    setInterval(S.status, 15000);
    window.addEventListener('online', S.status);
    window.addEventListener('offline', S.status);
  };
})();
