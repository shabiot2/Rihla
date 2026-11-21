/* radio.js — the car's own FM/AM radio (works without internet: launch + station keys + volume),
   internet radio (Quran + Saudi stations), media keys, volume */
(function () {
  'use strict';
  var R = App.radio = { cur: null, playing: false, car: false };
  var SELF = 'com.carnav.camry';
  var audio, retry = 0, tab = App.store.get('radioTab', 'quran'), lastList = null;
  var RADIO_PKGS = ['com.syu.radio', 'com.android.fmradio', 'com.microntek.radio', 'com.ts.radio', 'com.fyt.radio',
    'com.hzbhd.radio', 'com.yf.radio', 'com.autochips.radio', 'com.mediatek.fmradio', 'com.caf.fmradio',
    'com.android.car.radio', 'com.tw.radio', 'com.nwd.radio', 'com.zjinnova.radio', 'com.sprd.fmradio',
    'com.syu.carradio', 'com.android.radio', 'com.qualcomm.fmradio', 'com.ts.MainUI'];
  var QB = 'https://backup.qurango.net/radio/';
  var QURAN_DEFAULT = [
    { n: 'إذاعة القرآن الكريم - السعودية', u: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
    { n: 'العامة - متنوعة لمختلف القراء', u: QB + 'mix' },
    { n: 'تلاوات خاشعة', u: QB + 'salma' },
    { n: 'عبدالرحمن السديس', u: QB + 'abdulrahman_alsudaes' },
    { n: 'سعود الشريم', u: QB + 'saud_alshuraim' },
    { n: 'ماهر المعيقلي', u: QB + 'maher' },
    { n: 'ياسر الدوسري', u: QB + 'yasser_aldosari' },
    { n: 'مشاري العفاسي', u: QB + 'mishary_alafasi' },
    { n: 'سعد الغامدي', u: QB + 'saad_alghamdi' },
    { n: 'عبدالباسط عبدالصمد', u: QB + 'abdulbasit_abdulsamad' },
    { n: 'محمد صديق المنشاوي', u: QB + 'mohammed_siddiq_alminshawi' },
    { n: 'علي الحذيفي', u: QB + 'ali_alhuthaifi' },
    { n: 'تفسير القرآن الكريم', u: QB + 'tafseer' },
    { n: 'الرقية الشرعية', u: QB + 'roqiah' },
    { n: 'أذكار الصباح', u: QB + 'athkar_sabah' },
    { n: 'أذكار المساء', u: QB + 'athkar_masa' }
  ];
  var RB = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info',
    'https://fi1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];

  function cached(key, maxAgeH, loader) {
    var c = App.store.get(key, null);
    if (c && Date.now() - c.t < maxAgeH * 3600e3 && c.list && c.list.length) return Promise.resolve(c.list);
    return loader().then(function (list) {
      if (list && list.length) App.store.set(key, { t: Date.now(), list: list });
      return list;
    }).catch(function () { return c ? c.list : []; });
  }
  function quranList() {
    return cached('quranRadios', 24 * 7, function () {
      return App.fetchJSON('https://mp3quran.net/api/v3/radios?language=ar', 12000).then(function (j) {
        return (j.radios || []).map(function (r) { return { n: r.name, u: r.url }; });
      });
    }).then(function (list) {
      var seen = {}, out = [];
      QURAN_DEFAULT.concat(list || []).forEach(function (s) {
        var k = s.u.replace(/^https?:/, '');
        if (!seen[k]) { seen[k] = 1; out.push(s); }
      });
      return out;
    });
  }
  function saudiList() {
    return cached('saStations', 24, function () {
      function tryAt(i) {
        return App.fetchJSON(RB[i] + '/json/stations/search?countrycode=SA&hidebroken=true&order=clickcount&reverse=true&limit=80', 12000)
          .catch(function (e) { if (i + 1 < RB.length) return tryAt(i + 1); throw e; });
      }
      return tryAt(0).then(function (arr) {
        var seen = {};
        return arr.filter(function (s) {
          var k = (s.name || '').trim().toLowerCase();
          if (!s.url_resolved || seen[k]) return false;
          seen[k] = 1;
          return true;
        }).map(function (s) {
          return { n: s.name.trim(), u: s.url_resolved, sub: [s.codec, s.bitrate ? s.bitrate + 'kbps' : ''].filter(Boolean).join(' • ') };
        });
      });
    });
  }

  // ---------- playback ----------
  R.play = function (st) {
    if (!st || !st.u) return;
    if (App.offline) { App.toast('بدون نت — الإذاعات الأونلاين ما تشتغل. استخدم راديو السيارة FM'); return; }
    R.cur = st;
    R.car = false;
    retry = 0;
    if (App.stories) App.stories.pause(true);
    audio.src = st.u;
    var p = audio.play();
    if (p && p.catch) p.catch(function () { });
    App.settings.lastStation = st;
    App.saveSettings();
    ui();
    App.toast('جارٍ تشغيل: ' + st.n);
  };
  R.toggle = function () {
    if (!R.cur) { if (App.settings.lastStation) R.play(App.settings.lastStation); return; }
    if (audio.paused) { audio.play(); } else audio.pause();
  };
  R.stop = function () { audio.pause(); audio.removeAttribute('src'); audio.load(); R.cur = null; R.playing = false; ui(); };

  function ui() {
    var car = R.car && !R.cur;
    var dk = document.querySelector('.dk[data-panel="radio"]');
    if (dk) dk.classList.toggle('live', R.playing || car);
    dashCard();
    var np = App.$('rNow');
    if (np) {
      np.classList.toggle('hidden', !R.cur);
      if (R.cur) {
        App.$('rNowName').textContent = R.cur.n;
        App.$('rNowSub').innerHTML = R.playing ? '<span class="eq"><i></i><i></i><i></i></span> يعمل الآن' : (audio.paused ? 'متوقف مؤقتاً' : 'جارٍ الاتصال…');
        App.$('rNowBtn').innerHTML = App.icon(R.playing ? 'pause' : 'play');
      }
      document.querySelectorAll('#rList .row').forEach(function (r) {
        r.classList.toggle('playing', !!R.cur && r.dataset.u === R.cur.u);
      });
    }
  }
  R.ui = ui;

  // ---------- the audio card on the dashboard ----------
  function setHtml(id, html) { var el = App.$(id); if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }
  function dashCard() {
    var mc = App.$('mediaCard');
    if (!mc) return;
    if (App.stories && App.stories.ownsCard()) { App.stories.card(); return; }
    setHtml('mcHead', 'الصوت');
    App.$('mcProg').classList.add('hidden');
    var name, sub, tag, ok = true, go, goIc;
    if (R.cur) {
      name = R.cur.n;
      sub = R.playing ? '<span class="eq"><i></i><i></i><i></i></span>أونلاين — يعمل الآن' :
        audio.paused ? 'أونلاين — متوقف مؤقتاً' : 'جارٍ الاتصال…';
      tag = 'إنترنت'; ok = false; go = 'إيقاف'; goIc = 'stop';
    } else if (R.car) {
      name = 'راديو السيارة';
      sub = 'شغّال' + (R.carName ? ' من «' + App.esc(R.carName) + '»' : '') + ' — بدون نت';
      tag = 'FM بدون نت'; go = 'افتح'; goIc = 'expand';
    } else {
      name = 'راديو السيارة FM / AM';
      sub = 'موجات الراديو — بدون نت';
      tag = 'FM بدون نت'; go = 'شغّل'; goIc = 'radio';
    }
    setHtml('mcName', App.esc(name));
    setHtml('mcSub', sub);
    var t = App.$('mcTag');
    t.textContent = tag;
    t.className = 'w-tag' + (ok ? ' ok' : '');
    setHtml('mcGo', App.icon(goIc) + '<span>' + go + '</span>');
    setHtml('mcPlay', App.icon(R.cur ? (R.playing ? 'pause' : 'play') : 'playpause'));
    mc.classList.toggle('live', R.cur ? R.playing : R.car);
  }
  function vol(dir) {
    if (App.Native.has) App.Native.call('vol', dir);
    else audio.volume = Math.max(0, Math.min(1, audio.volume + (dir === 'up' ? 0.1 : -0.1)));
  }
  // next / previous internet station from the list it was picked from
  R.step = function (d) {
    var L = lastList && lastList.length ? lastList : QURAN_DEFAULT, i = -1;
    for (var k = 0; k < L.length; k++) if (R.cur && L[k].u === R.cur.u) { i = k; break; }
    R.play(L[((i + d) % L.length + L.length) % L.length]);
  };

  // ---------- car apps ----------
  function candidates() {
    var apps = App.system.apps();
    return apps.filter(function (a) {
      return RADIO_PKGS.indexOf(a.p) >= 0 || /radio|راديو|مذياع|إذاعة|اذاعة|\bfm\b/i.test(a.l) || /radio|fmradio/i.test(a.p);
    });
  }
  // the saved radio is a package ("com.x.radio") or an activity ("com.x/com.x.RadioActivity")
  function launchRadio(saved) {
    return App.Native.call(saved.indexOf('/') > 0 ? 'start' : 'launch', saved) === '1';
  }
  function radioLabel(saved) {
    if (saved.indexOf('/') > 0) return App.settings.radioLabel || 'الراديو';
    return appName(saved);
  }
  // back: return to Rihla after a moment — only when the user turned it on (some radios stop in the background)
  R.openCarRadio = function (choose, back) {
    if (!App.Native.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    if (back == null) back = App.settings.radioBack === true;
    var saved = App.settings.radioApp;
    if (saved && !choose && launchRadio(saved)) {
      if (R.playing) audio.pause();
      R.cur = null;
      R.car = true;
      if (!R.carName || R.carApp !== saved) { R.carApp = saved; R.carName = radioLabel(saved); }
      ui();
      if (back) {
        setTimeout(function () { App.Native.call('launch', SELF); }, 4000);
        App.toast('جارٍ تشغيل راديو السيارة… ونرجع لرحلة', 3000);
      }
      return;
    }
    if (saved && !choose) App.toast('ما انفتح تطبيق الراديو المحفوظ — اختره من جديد');
    var c = candidates();
    if (c.length === 1 && !choose && !saved) { App.settings.radioApp = c[0].p; App.saveSettings(); R.openCarRadio(false, back); return; }
    R.pick(back);
  };
  // choose the radio: likely apps first, a deep search for radio screens inside other apps, then every app
  R.pick = function (back) {
    App.panels.push('اختر راديو الشاشة', function (body) {
      var c = candidates(), all = App.system.apps(), cp = c.map(function (a) { return a.p; });
      var rest = all.filter(function (a) { return cp.indexOf(a.p) < 0; });
      function rows(list, kind) {
        return list.map(function (a) {
          var v = kind === 'act' ? a.p + '/' + a.c : a.p, cur = App.settings.radioApp === v;
          return '<button class="row' + (cur ? ' on' : '') + '" data-v="' + App.esc(v) + '" data-l="' + App.esc(a.l) + '">' +
            '<span class="lead-icon" data-icon="' + App.esc(a.p) + '">' + App.icon('radio', 'lead') + '</span><span class="txt"><b>' + App.esc(a.l) +
            (cur ? ' ✓' : '') + '</b><small>' + App.esc(kind === 'act' ? a.c : a.p) + '</small></span></button>';
        }).join('');
      }
      body.innerHTML = '<div class="note" style="margin-bottom:1.2vmin">اختر التطبيق اللي يفتح راديو FM حق الشاشة — يتحفظ اختيارك. ' +
        'إذا ما لقيته، اضغط «ابحث عن الراديو داخل الشاشة».</div>' +
        (c.length ? '<div class="sec-title">غالباً واحد من هذي</div>' + rows(c) : '') +
        '<button class="btn primary" id="rDeep" style="width:100%;margin:1vmin 0 1.4vmin">' + App.icon('search') + 'ابحث عن الراديو داخل الشاشة</button>' +
        '<div id="rDeepRes"></div>' +
        '<div class="sec-title">كل التطبيقات</div>' + rows(rest);
      function bind(root) {
        root.querySelectorAll('[data-v]').forEach(function (b) {
          b.onclick = function () {
            App.settings.radioApp = b.dataset.v;
            App.settings.radioLabel = b.dataset.l;
            App.saveSettings();
            R.carName = null;
            App.panels.close();
            R.openCarRadio(false, back);
          };
        });
      }
      bind(body);
      App.system.lazyIcons(body);
      App.$('rDeep').onclick = function () {
        var out = App.$('rDeepRes');
        out.innerHTML = '<div class="empty">جارٍ البحث في تطبيقات الشاشة…</div>';
        setTimeout(function () {                                     // let the message paint: the scan takes a moment
          var r = App.Native.json('radios', '') || [];
          out.innerHTML = r.length ? '<div class="sec-title">شاشات راديو موجودة داخل التطبيقات</div>' + rows(r, 'act') :
            '<div class="empty">ما لقيت شاشة راديو مخفية — اختر من القائمة تحت</div>';
          bind(out);
          App.system.lazyIcons(out);
        }, 60);
      };
    });
  };
  function mediaKey(code) {
    if (!App.Native.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    App.Native.call('key', code);
  }
  R.key = mediaKey;
  function appName(p) {
    var a = (App.Native.has ? App.system.apps() : []).filter(function (x) { return x.p === p; })[0];
    return a ? a.l : p;
  }

  // ---------- panel ----------
  function render(body) {
    var ra = App.settings.radioApp;
    body.innerHTML =
      '<div class="car-radio">' +
      '<div class="cr-head">' + App.icon('radio') + '<div class="txt"><b>راديو السيارة FM / AM</b>' +
      '<small>' + (ra ? App.esc(appName(ra)) + ' • ' : '') + 'من موجات الراديو مباشرة — ما يحتاج إنترنت</small></div>' +
      '<span class="cr-badge">' + App.icon('check') + 'يشتغل بدون نت</span></div>' +
      '<div class="cr-ctl">' +
      '<button class="btn" data-key="88">' + App.icon('prev') + 'المحطة السابقة</button>' +
      '<button class="btn primary" id="rCarGo">' + App.icon('radio') + 'شغّل الراديو</button>' +
      '<button class="btn" data-key="87">' + App.icon('next') + 'المحطة التالية</button></div>' +
      '<div class="btn-row">' +
      '<button class="btn" data-key="85">' + App.icon('playpause') + 'تشغيل/إيقاف</button>' +
      '<button class="btn" data-vol="down">' + App.icon('vol-down') + 'خفض</button>' +
      '<button class="btn" data-vol="up">' + App.icon('vol-up') + 'رفع</button>' +
      '<button class="btn" id="rCar">' + App.icon('expand') + 'شاشة الراديو</button>' +
      '<button class="btn" id="rPick">' + App.icon('edit') + (ra ? 'تغيير التطبيق' : 'اختيار التطبيق') + '</button></div>' +
      '<div class="set-row" style="margin-top:.9vmin"><div class="txt"><b>ارجع لرحلة بعد تشغيل الراديو</b>' +
      '<small>فعّله فقط إذا كان راديو شاشتك يكمل شغّال بالخلفية</small></div>' +
      '<button class="switch' + (App.settings.radioBack ? ' on' : '') + '" id="rBack"></button></div>' +
      '<div class="note" style="margin-top:.6vmin">أزرار المحطات ترسل نفس أوامر أزرار الطارة — لو ما استجاب تطبيق الراديو، اختر المحطة من «شاشة الراديو».</div></div>' +
      '<div id="rNow" class="now-playing hidden">' +
      '<button id="rNowBtn" class="round"></button>' +
      '<div class="meta"><b id="rNowName"></b><small id="rNowSub"></small></div>' +
      '<button id="rStop" class="round small">' + App.icon('stop') + '</button></div>' +
      '<div class="sec"><button class="row" id="rBt">' + App.icon('music', 'lead') + '<span class="txt"><b>موسيقى البلوتوث</b><small>من جوالك عبر بلوتوث السيارة — بدون نت</small></span></button></div>' +
      '<div class="sec-title"><span>إذاعات أونلاين</span><small>' + App.icon('globe') + 'تحتاج إنترنت</small></div>' +
      (App.offline ? '<div class="drive-note">' + App.icon('nonet') + 'بدون نت الحين — الإذاعات الأونلاين بترجع إذا رجع الاتصال. راديو السيارة فوق شغّال.</div>' : '') +
      '<div class="tabs" id="rTabs"><button data-t="quran">القرآن الكريم</button><button data-t="sa">إذاعات سعودية</button><button data-t="mine">إذاعاتي</button></div>' +
      '<div id="rList"></div>';
    App.$('rNowBtn').onclick = R.toggle;
    App.$('rStop').onclick = R.stop;
    App.$('rCarGo').onclick = function () { R.openCarRadio(false); };
    App.$('rCar').onclick = function () { R.openCarRadio(false, false); };
    App.$('rPick').onclick = function () { R.pick(); };
    App.$('rBack').onclick = function () {
      App.settings.radioBack = !App.settings.radioBack;
      App.saveSettings();
      App.panels.refresh();
    };
    App.$('rBt').onclick = function () { App.system.openBtApp(); };
    body.querySelectorAll('[data-key]').forEach(function (b) { b.onclick = function () { mediaKey(b.dataset.key); }; });
    body.querySelectorAll('[data-vol]').forEach(function (b) { b.onclick = function () { vol(b.dataset.vol); }; });
    body.querySelectorAll('#rTabs button').forEach(function (b) {
      b.onclick = function () { tab = b.dataset.t; App.store.set('radioTab', tab); showTab(); };
    });
    showTab();
    ui();
  }
  function rows(list, mine) {
    if (!list.length) return '<div class="empty">لا توجد إذاعات</div>';
    return list.map(function (s, i) {
      return '<button class="row" data-u="' + App.esc(s.u) + '" data-n="' + App.esc(s.n) + '">' + App.icon('radio', 'lead') +
        '<span class="txt"><b>' + App.esc(s.n) + '</b>' + (s.sub ? '<small>' + App.esc(s.sub) + '</small>' : '') + '</span>' +
        (mine ? '<span class="chip danger" data-del="' + i + '">حذف</span>' : '') + '</button>';
    }).join('');
  }
  function showTab() {
    var el = App.$('rList');
    if (!el) return;
    document.querySelectorAll('#rTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    function bind() {
      el.querySelectorAll('.row[data-u]').forEach(function (r) {
        r.onclick = function (e) {
          var del = e.target.closest('[data-del]');
          if (del) {
            e.stopPropagation();
            App.settings.stations.splice(+del.dataset.del, 1);
            App.saveSettings();
            showTab();
            return;
          }
          if (R.cur && R.cur.u === r.dataset.u) R.toggle(); else R.play({ n: r.dataset.n, u: r.dataset.u });
        };
      });
      ui();
    }
    if (tab === 'mine') {
      lastList = App.settings.stations || [];
      el.innerHTML = '<form class="search-input" id="rAdd"><input id="rAddN" placeholder="اسم الإذاعة"><input id="rAddU" placeholder="رابط البث http…" style="direction:ltr">' +
        '<button class="chip on" type="submit">إضافة</button></form>' + rows(App.settings.stations || [], true);
      App.$('rAdd').onsubmit = function (e) {
        e.preventDefault();
        var n = App.$('rAddN').value.trim(), u = App.$('rAddU').value.trim();
        if (!/^https?:\/\//i.test(u)) { App.toast('أدخل رابط بث صحيح يبدأ بـ http'); return; }
        App.settings.stations.push({ n: n || u, u: u });
        App.saveSettings();
        showTab();
      };
      bind();
      return;
    }
    el.innerHTML = '<div class="spinner"></div>';
    (tab === 'quran' ? quranList() : saudiList()).then(function (list) {
      if (App.$('rList') !== el) return;
      if (list.length) lastList = list;
      el.innerHTML = list.length ? rows(list) : '<div class="empty">تعذّر تحميل القائمة — تحقق من الاتصال بالإنترنت</div>';
      bind();
    });
  }

  App.panelDefs = App.panelDefs || {};
  App.panelDefs.radio = { title: 'المذياع', render: render };

  R.init = function () {
    audio = App.$('radioAudio');
    audio.addEventListener('playing', function () { R.playing = true; retry = 0; ui(); });
    audio.addEventListener('pause', function () { R.playing = false; ui(); });
    audio.addEventListener('waiting', ui);
    audio.addEventListener('error', function () {
      R.playing = false;
      if (R.cur && R.cur.alt && R.cur.alt.length) {             // another mirror of the same recording
        R.cur.u = R.cur.alt.shift();
        audio.src = R.cur.u;
        audio.play().catch(function () { });
        ui();
        return;
      }
      if (R.cur && retry < 2) {
        retry++;
        setTimeout(function () { if (R.cur) { audio.src = R.cur.u; audio.play().catch(function () { }); } }, 2500);
      } else if (R.cur) { App.toast('تعذّر تشغيل الإذاعة'); }
      ui();
    });
    function st() { return App.stories && App.stories.ownsCard() ? App.stories : null; }
    App.$('mcGo').onclick = function () { var S = st(); if (S) return S.cardGo(); if (R.cur) R.stop(); else R.openCarRadio(false); };
    App.$('mcPlay').onclick = function () { var S = st(); if (S) return S.toggle(); if (R.cur) R.toggle(); else mediaKey('85'); };
    App.$('mcPrev').onclick = function () { var S = st(); if (S) return S.seek(-30); if (R.cur) R.step(-1); else mediaKey('88'); };
    App.$('mcNext').onclick = function () { var S = st(); if (S) return S.seek(30); if (R.cur) R.step(1); else mediaKey('87'); };
    App.$('mcVolDn').onclick = function () { vol('down'); };
    App.$('mcVolUp').onclick = function () { vol('up'); };
    App.$('mcInfo').onclick = function () { App.panels.open(st() ? 'stories' : 'radio'); };
    App.on('net', function () { if (App.panels.current === 'radio') App.panels.refresh(); });
    ui();
  };
})();
