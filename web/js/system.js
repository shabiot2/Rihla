/* system.js — sheet/panel manager, apps drawer + favourites, Wi-Fi, Bluetooth, settings */
(function () {
  'use strict';
  var N = App.Native;

  // ---------- panel manager ----------
  var P = App.panels = { current: null, stack: [] };
  function show(title, render, sub) {
    App.$('scrim').classList.remove('hidden');
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
    P.current = name;
    P.stack = [];
    show(def.title, def.render, false);
    markDock();
    App.emit('panel', name);
  };
  P.push = function (title, render) {
    if (!P.current) { P.current = 'sub'; markDock(); }
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
    App.$('scrim').classList.add('hidden');
    App.$('sheetBody').innerHTML = '';
    P.current = null;
    P.stack = [];
    markDock();
    App.emit('panel', null);
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

  S.lazyIcons = lazyIcons;
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
  function renderApps(body) {
    if (!N.has) { body.innerHTML = '<div class="empty">قائمة التطبيقات تظهر عند تشغيل الواجهة على شاشة السيارة</div>'; return; }
    var list = S.apps(true);
    body.innerHTML = '<div class="search-input">' + App.icon('search') + '<input id="aFilter" placeholder="بحث في التطبيقات…"></div>' +
      '<div class="note" style="margin-bottom:1rem">اضغط ★ لإضافة التطبيق إلى اختصاراتك في الصفحة الرئيسية (حتى ' + App.d(8) + ').</div>' +
      '<div class="apps-grid" id="aGrid">' + list.map(function (a) {
        var on = App.home.shortcuts().indexOf(a.p) >= 0;
        return '<button class="app" data-p="' + App.esc(a.p) + '" data-l="' + App.esc(String(a.l).toLowerCase()) + '">' +
          '<svg class="ic pin' + (on ? ' on' : '') + '" data-pin="1"><use href="#i-star"/></svg>' +
          '<span data-icon="' + App.esc(a.p) + '">' + placeholder(a.l) + '</span><span>' + App.esc(a.l) + '</span></button>';
      }).join('') + '</div>';
    var grid = App.$('aGrid');
    grid.onclick = function (e) {
      var b = e.target.closest('.app');
      if (!b) return;
      if (e.target.closest('[data-pin]')) {
        App.home.toggleShortcut(b.dataset.p);
        var f = App.home.shortcuts();
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
      'البحث عن الأماكن والإذاعات تحتاج إنترنت؛ أما مواقيت الصلاة والراديو والقصص المحفوظة فتعمل بدونه.</div>';
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
    var s = App.settings, cp = s.carplayApp ? S.label(s.carplayApp) : '';
    var sd = App.stories ? App.stories.dirText() : '';
    body.innerHTML =
      '<div class="sec"><div class="sec-title">الثيمات — كل ثيم عالم مختلف</div>' + App.theme.cards(App.theme.key) + '</div>' +
      '<div class="sec"><div class="sec-title">المظهر</div>' +
      row('حركة الخلفية', 'الغيوم والنجوم والأضواء المتحركة — أطفها إذا تبي هدوء أكثر', sw('sMotion', !s.calm)) +
      row('ثيم الجمعة تلقائياً', 'أخضر وذهبي بالمحراب والفوانيس — من مغرب الخميس إلى آخر يوم الجمعة', sw('sFri', s.autoFriday)) +
      row('ثيمات المناسبات تلقائياً', 'اليوم الوطني في سبتمبر ويوم التأسيس في فبراير', sw('sOcc', s.autoOccasion)) +
      row('صور بناتي', 'الصور اللي تظهر في ثيمي «بناتي» و«زجاج» — محفوظة على الشاشة فقط', '<button class="btn" id="sPhotos">' + App.icon('image') + 'الصور</button>') +
      row('سيارتي', App.esc(App.car.title() + (App.car.subtitle() ? ' — ' + App.car.subtitle() : '')),
        '<button class="btn" id="sCar">' + App.icon('car') + 'تعديل</button>') +
      row('شاشة الترحيب', 'إعادة خطوات اختيار السيارة والثيم', '<button class="btn" id="sWelcome">' + App.icon('sparkle') + 'عرض</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">CarPlay</div>' +
      row('تطبيق CarPlay', cp ? 'بطاقة CarPlay تفتح «' + App.esc(cp) + '»' : 'اختر تطبيق الشاشة اللي يشغّل CarPlay (ZLink أو AutoKit أو TLink…)',
        '<button class="btn" id="sCarplay">' + App.icon('carplay') + (cp ? 'تغيير' : 'اختيار') + '</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">القصص والمحاضرات</div>' +
      row('مكان ملفات القصص', sd || 'ضع ملفات الصوت في فلاش USB أو ذاكرة الشاشة — داخل مجلد اسمه «قصص»',
        '<button class="btn" id="sStories">' + App.icon('folder') + 'المكتبة</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">الصوت — ElevenLabs</div>' +
      row('صوت ElevenLabs', 'صوت طبيعي بدل صوت الشاشة — يحتاج نت وقت أول مرة بس، وبعدها الجمل المتكررة تشتغل بدون نت', sw('sElOn', s.elOn !== false)) +
      row('مفتاح API', 'يُحفظ داخل الشاشة فقط ولا يُرفع لأي مكان', '<input class="field" id="sElKey" type="password" dir="ltr" placeholder="sk_…" value="' + App.esc(s.elKey || '') + '">') +
      row('الصوت', '<span id="sElVoiceName">' + App.esc(s.elVoiceName || 'الافتراضي') + '</span>', '<button class="btn" id="sElVoices">' + App.icon('vol-up') + 'اختيار الصوت</button>') +
      row('تجربة', '<span id="sElMsg">اضغط للتجربة وتأكد إن المفتاح شغّال</span>', '<button class="btn" id="sElTest">' + App.icon('play') + 'تجربة الصوت</button>') +
      row('الأصوات المخزّنة', '<span id="sElCache">—</span>', '<button class="btn" id="sElClear">مسح</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">الوجهات</div>' +
      row('تطبيق الملاحة', 'للمساجد والأماكن والمهام', seg('sNavApp', [['auto', 'تلقائي'], ['google', 'خرائط قوقل'], ['waze', 'ويز'], ['geo', 'أسأل كل مرة']], s.navApp || 'auto')) +
      row('التنبيهات الصوتية', 'الصلاة والجمعة والقصص — يتطلب محرك نطق عربي في الشاشة', sw('sVoice', s.voice)) + '</div>' +
      '<div class="sec"><div class="sec-title">مواقيت الصلاة — تقويم أم القرى</div>' +
      row('المدينة', App.esc(App.prayer.loc.city || '—') + ' • ' + (s.prayManual ? 'مختارة يدوياً' : 'تلقائية من الـGPS'),
        '<button class="btn" id="sCity">' + App.icon('pin') + 'اختيار المدينة</button>') +
      row('تنبيه دخول الوقت', 'نغمة قصيرة مع أقرب مسجد', sw('sChime', s.adhanChime)) +
      row('تذكير قبل الصلاة', 'مع اقتراح أقرب مسجد', seg('sPre', [['0', 'إيقاف'], ['5', '٥ د'], ['10', '١٠ د'], ['15', '١٥ د'], ['20', '٢٠ د']], s.prePrayer || 0)) +
      row('تذكير الأذكار', 'أذكار الصباح بعد الفجر والمساء بعد العصر', sw('sAdh', s.adhkarRemind)) +
      row('تذكيرات يوم الجمعة', 'سورة الكهف، التبكير للجمعة، ساعة الإجابة، والصلاة على النبي ﷺ', sw('sFriRem', s.fridayRemind)) +
      '<div class="grid3">' + PN.map(function (n, i) {
        return '<div class="set-row" style="margin:0"><div class="txt"><b>' + n + '</b><small>تعديل بالدقائق</small></div>' +
          '<div class="stepper"><button class="round small" data-off="' + i + '" data-d="-1">' + App.icon('minus') + '</button><b class="num" id="sOff' + i + '">' +
          App.d((s.offsets[i] > 0 ? '+' : '') + (s.offsets[i] || 0)) + '</b><button class="round small" data-off="' + i + '" data-d="1">' + App.icon('plus') + '</button></div></div>';
      }).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-title">العرض</div>' +
      row('الأرقام', '', seg('sDig', [['latn', '123'], ['arab', '١٢٣']], s.digits)) +
      row('نظام الساعة', '', seg('sClk', [['12', '١٢ ساعة'], ['24', '٢٤ ساعة']], s.clock24 ? 24 : 12)) +
      row('ملء الشاشة', 'إخفاء شريط النظام', sw('sFull', s.full)) +
      row('الملخص اليومي', 'بطاقة المساعد عند أول تشغيل في اليوم', sw('sBrief', s.briefing)) +
      row('نغمة الترحيب', 'مع شعار أبو دانة عند تشغيل التطبيق', sw('sIntroS', s.introSound) + '<button class="btn" id="sIntro" style="margin-right:.8rem">' + App.icon('play') + 'شاهد</button>') + '</div>' +
      '<div class="sec"><div class="sec-title">النظام</div>' +
      row('الـGPS', App.esc(App.loc.status()), '<button class="btn" id="sGps">' + App.icon('gps') + 'إعدادات الموقع</button>') +
      '<div class="btn-row">' +
      '<button class="btn" id="sRadioApp">' + App.icon('radio') + 'تطبيق الراديو</button>' +
      '<button class="btn" id="sBtApp">' + App.icon('bt') + 'تطبيق البلوتوث</button>' +
      '<button class="btn" id="sAndroid">' + App.icon('settings') + 'إعدادات أندرويد</button>' +
      '<button class="btn" id="sFanApp">' + App.icon('fan') + 'تطبيق المروحة</button></div></div>' +
      '<div class="sec"><div class="sec-title">الجهاز</div><div class="set-row"><div class="txt"><b>' + App.esc(App.android.name) +
      (App.android.sdk ? ' <small class="num">(API ' + App.d(App.android.sdk) + ')</small>' : '') + '</b><small>' +
      App.esc([App.android.maker, App.android.model, App.android.board].filter(Boolean).join(' • ') || 'شاشة أندرويد') +
      ' • ' + App.d(screen.width) + '×' + App.d(screen.height) + '</small></div>' +
      '<span class="chip ' + (App.android.supported ? 'on' : 'danger') + '">' + App.icon(App.android.supported ? 'check' : 'close') +
      (App.android.supported ? 'متوافق' : 'نسخة قديمة') + '</span></div></div>' +
      '<div class="sec"><div class="sec-title">حول التطبيق</div><div class="about">' + App.brand('lg') +
      '<div class="ab-txt"><b>رحلة — الإصدار ' + App.d('3.2.4') + '</b><span>جميع الحقوق محفوظة © ' + App.d('2026') + ' أبو دانة للبرمجة</span>' +
      '<small>تصميم وتطوير أبو دانة للبرمجة • بيانات المدن والأحياء: Natural Earth و homaily/Saudi-Arabia-Regions-Cities-and-Districts (GPL-2.0) • الأماكن © OpenStreetMap • ' +
      'الإذاعات mp3quran.net و radio-browser.info • الطقس Open-Meteo • الخطوط: Readex Pro و Alexandria و Changa و Orbitron و El Messiri و IBM Plex Sans Arabic و Baloo Bhaijaan 2 و Aref Ruqaa و Amiri (SIL OFL)</small></div></div></div>';

    function bindSw(id, key, after) {
      App.$(id).onclick = function () {
        s[key] = !s[key];
        this.classList.toggle('on', s[key]);
        App.saveSettings();
        if (after) after();
      };
    }
    App.$('sMotion').onclick = function () { s.calm = !s.calm; this.classList.toggle('on', !s.calm); App.saveSettings(); };
    bindSw('sVoice', 'voice', function () { if (s.voice) App.voice.stop(); });
    bindSw('sElOn', 'elOn');
    App.$('sElKey').onchange = function () { s.elKey = this.value.trim(); App.saveSettings(); App.$('sElMsg').textContent = 'تم الحفظ — اضغط «تجربة الصوت»'; };
    function elCache() { App.voice.cacheCount(function (n) { var e = App.$('sElCache'); if (e) e.textContent = App.d(n) + ' مقطع'; }); }
    elCache();
    App.$('sElClear').onclick = function () { App.voice.clearCache(elCache); };
    App.$('sElTest').onclick = function () {
      s.elKey = App.$('sElKey').value.trim(); App.saveSettings();
      App.$('sElMsg').textContent = 'جاري الاتصال…';
      App.voice.test(function (m) { App.$('sElMsg').textContent = m; elCache(); });
    };
    App.$('sElVoices').onclick = function () {
      s.elKey = App.$('sElKey').value.trim(); App.saveSettings();
      App.$('sElMsg').textContent = 'جاري جلب الأصوات…';
      App.voice.voices(function (list, err) {
        if (!list) { App.$('sElMsg').textContent = err; return; }
        App.$('sElMsg').textContent = 'اختر صوتاً — اضغط عليه لسماعه ثم «اعتماد»';
        App.panels.push('اختيار الصوت', function (body) {
          body.innerHTML = '<div class="st-grid">' + list.map(function (v, i) {
            var lb = v.labels || {};
            return '<div class="st-card" data-i="' + i + '"><b>' + App.esc(v.name) + '</b><small>' + App.esc([lb.gender, lb.accent, lb.descriptive].filter(Boolean).join(' • ')) + '</small>' +
              '<div class="st-acts"><button class="btn" data-p="' + i + '">سماع</button><button class="btn primary" data-s="' + i + '">اعتماد</button></div></div>';
          }).join('') + '</div>';
          body.onclick = function (e) {
            var t = e.target.closest('button'); if (!t) return;
            if (t.dataset.p != null) { var u = list[+t.dataset.p].preview_url; if (u) App.voice.preview(u); else App.toast('ما فيه مقطع تجريبي لهذا الصوت'); }
            if (t.dataset.s != null) { var v = list[+t.dataset.s]; s.elVoice = v.voice_id; s.elVoiceName = v.name; App.saveSettings(); App.toast('تم اعتماد ' + v.name); App.panels.back(); var n = App.$('sElVoiceName'); if (n) n.textContent = v.name; }
          };
        });
      });
    };
    bindSw('sChime', 'adhanChime');
    bindSw('sFull', 'full', function () { N.call('full', s.full ? '1' : '0'); });
    bindSw('sOcc', 'autoOccasion', function () { s.themeLocked = false; App.saveSettings(); App.theme.apply(true); P.refresh(); });
    bindSw('sAdh', 'adhkarRemind');
    bindSw('sFri', 'autoFriday', function () { s.themeLocked = false; App.saveSettings(); App.theme.apply(true); P.refresh(); });
    bindSw('sFriRem', 'fridayRemind');
    bindSw('sBrief', 'briefing');
    bindSw('sIntroS', 'introSound');
    App.$('sIntro').onclick = function () { App.panels.close(); App.intro.play(); };
    App.theme.bindCards(body);
    App.$('sCar').onclick = function () { App.panels.open('car'); };
    App.$('sPhotos').onclick = function () { App.home.managePhotos(); };
    App.$('sWelcome').onclick = function () { P.close(); App.theme.welcome(); };
    App.$('sCarplay').onclick = function () { App.home.openCarplay(true); };
    App.$('sStories').onclick = function () { App.panels.open('stories'); };
    App.$('sCity').onclick = function () { App.prayer.cityPanel(); };
    App.$('sFanApp').onclick = function () { App.fan.openApp(true); };
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
    bindSeg('sNavApp', function (v) { s.navApp = v; });
    bindSeg('sDig', function (v) { s.digits = v; });
    bindSeg('sClk', function (v) { s.clock24 = v === '24'; });
    bindSeg('sPre', function (v) { s.prePrayer = +v; });
    App.$('sRadioApp').onclick = function () { App.radio.pick(); };
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
    document.querySelectorAll('.dk, .st-b[data-panel]').forEach(function (b) { b.onclick = function () { P.open(b.dataset.panel); }; });
    if (N.has) S.apps();
    App.$('scrim').onclick = P.close;
    S.status();
    setInterval(S.status, 15000);
    window.addEventListener('online', S.status);
    window.addEventListener('offline', S.status);
  };
})();
