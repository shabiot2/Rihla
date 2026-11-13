/* radio.js — car FM app launcher, internet radio (Quran + Saudi stations), media keys, volume */
(function () {
  'use strict';
  var R = App.radio = { cur: null, playing: false };
  var audio, retry = 0, tab = App.store.get('radioTab', 'quran');
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
    R.cur = st;
    retry = 0;
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
    var mp = App.$('miniPlayer');
    var sheetOpen = App.panels && App.panels.current === 'radio';
    mp.classList.toggle('hidden', !R.cur || sheetOpen);
    App.$('mpName').textContent = R.cur ? R.cur.n : '';
    App.$('mpToggle').innerHTML = App.icon(R.playing ? 'pause' : 'play');
    var dk = document.querySelector('.dk[data-panel="radio"]');
    if (dk) dk.classList.toggle('live', R.playing);
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

  // ---------- car apps ----------
  function candidates() {
    var apps = App.system.apps();
    return apps.filter(function (a) {
      return RADIO_PKGS.indexOf(a.p) >= 0 || /radio|راديو|مذياع|إذاعة|اذاعة|\bfm\b/i.test(a.l) || /radio|fmradio/i.test(a.p);
    });
  }
  R.openCarRadio = function (choose) {
    if (!App.Native.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    var saved = App.settings.radioApp;
    if (saved && !choose && App.Native.call('launch', saved) === '1') { if (R.playing) audio.pause(); return; }
    var c = candidates();
    if (c.length === 1 && !choose) { App.settings.radioApp = c[0].p; App.saveSettings(); R.openCarRadio(); return; }
    App.panels.push('اختر تطبيق الراديو', function (body) {
      var list = c.length ? c : App.system.apps();
      body.innerHTML = '<div class="note" style="margin-bottom:1.2vmin">' + (c.length ? 'اختر تطبيق راديو السيارة (FM) — سيُحفظ اختيارك.' :
        'لم يُعثر على تطبيق راديو تلقائياً، اختره من القائمة:') + '</div>' +
        list.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '">' + App.icon('radio', 'lead') + '<span class="txt"><b>' +
            App.esc(a.l) + '</b><small>' + App.esc(a.p) + '</small></span></button>';
        }).join('');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () { App.settings.radioApp = b.dataset.p; App.saveSettings(); App.panels.close(); R.openCarRadio(); };
      });
    });
  };
  function mediaKey(code) {
    if (!App.Native.has) return;
    App.Native.call('key', code);
  }

  // ---------- panel ----------
  function render(body) {
    body.innerHTML =
      '<div id="rNow" class="now-playing hidden">' +
      '<button id="rNowBtn" class="round"></button>' +
      '<div class="meta"><b id="rNowName"></b><small id="rNowSub"></small></div>' +
      '<button id="rStop" class="round small">' + App.icon('stop') + '</button></div>' +
      '<div class="sec"><div class="grid2">' +
      '<button class="row" id="rCar">' + App.icon('radio', 'lead') + '<span class="txt"><b>راديو السيارة FM</b><small>' +
      (App.settings.radioApp ? 'فتح تطبيق الراديو' : 'يتعرف على تطبيق الراديو تلقائياً') + '</small></span></button>' +
      '<button class="row" id="rBt">' + App.icon('music', 'lead') + '<span class="txt"><b>موسيقى البلوتوث</b><small>تطبيق البلوتوث / المشغل</small></span></button>' +
      '</div></div>' +
      '<div class="sec"><div class="sec-title">التحكم بالصوت والموسيقى</div><div class="btn-row">' +
      '<button class="btn" data-key="88">' + App.icon('prev') + 'السابق</button>' +
      '<button class="btn" data-key="85">' + App.icon('play') + 'تشغيل/إيقاف</button>' +
      '<button class="btn" data-key="87">' + App.icon('next') + 'التالي</button>' +
      '<button class="btn" data-vol="down">' + App.icon('vol-down') + '</button>' +
      '<button class="btn" data-vol="up">' + App.icon('vol-up') + '</button></div></div>' +
      '<div class="tabs" id="rTabs"><button data-t="quran">القرآن الكريم</button><button data-t="sa">إذاعات سعودية</button><button data-t="mine">إذاعاتي</button></div>' +
      '<div id="rList"></div>';
    App.$('rNowBtn').onclick = R.toggle;
    App.$('rStop').onclick = R.stop;
    App.$('rCar').onclick = function () { R.openCarRadio(false); };
    App.$('rCar').oncontextmenu = function (e) { e.preventDefault(); R.openCarRadio(true); };
    App.$('rBt').onclick = function () { App.system.openBtApp(); };
    body.querySelectorAll('[data-key]').forEach(function (b) { b.onclick = function () { mediaKey(b.dataset.key); }; });
    body.querySelectorAll('[data-vol]').forEach(function (b) {
      b.onclick = function () {
        if (App.Native.has) App.Native.call('vol', b.dataset.vol);
        else audio.volume = Math.max(0, Math.min(1, audio.volume + (b.dataset.vol === 'up' ? 0.1 : -0.1)));
      };
    });
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
      if (R.cur && retry < 2) {
        retry++;
        setTimeout(function () { if (R.cur) { audio.src = R.cur.u; audio.play().catch(function () { }); } }, 2500);
      } else if (R.cur) { App.toast('تعذّر تشغيل الإذاعة'); }
      ui();
    });
    App.$('mpToggle').onclick = R.toggle;
    App.$('mpName').onclick = function () { App.panels.open('radio'); };
    ui();
  };
})();
