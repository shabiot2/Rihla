/* ضغط الإطارات — the four tyres of the Camry.
   The car's own TPMS reaches the head unit only through its CAN box, and FYT-type screens do not share it with
   other apps, so readings are recorded here in two taps (from the cluster or from the screen's own car-info page,
   which «صفحة الحساسات» opens directly). Values are stored in PSI («بوند»). */
(function () {
  'use strict';
  var T = App.tires = {};
  var SHORT = ['أمامي يسار', 'أمامي يمين', 'خلفي يسار', 'خلفي يمين'];
  var FULL = ['الأمامي اليسار', 'الأمامي اليمين', 'الخلفي اليسار', 'الخلفي اليمين'];
  var CLS = ['fl', 'fr', 'rl', 'rr'];
  var UNITS = {
    psi: { n: 'بوند', k: 1, step: 1, dec: 0 },
    bar: { n: 'بار', k: 0.0689476, step: 0.05, dec: 2 },
    kpa: { n: 'كيلوباسكال', k: 6.89476, step: 5, dec: 0 }
  };
  var MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var RANK = { unk: 0, ok: 0, high: 1, low: 2, vlow: 3 };
  var TP = /tpms|tyre|tire|canbus|can ?bus|carinfo|car ?info|vehicle|car ?data|carset|معلومات السيارة|السيارة|ضغط|إطار|كفر|胎压|车/i;
  var DAY = 864e5;

  function data() { var d = App.store.get('tires', null); return d && d.log ? d : { log: [] }; }
  function save(d) { if (d.log.length > 40) d.log = d.log.slice(-40); App.store.set('tires', d); App.emit('tires'); }
  function u() { return UNITS[T.unit()]; }

  T.unit = function () { return UNITS[App.settings.tireUnit] ? App.settings.tireUnit : 'psi'; };
  T.rec = function () { var r = +App.settings.tireRec; return r >= 20 && r <= 60 ? r : 35; };
  T.num = function (psi) { var x = u(), p = Math.pow(10, x.dec); return App.d((Math.round(psi * x.k * p) / p).toFixed(x.dec)); };
  T.uName = function () { return u().n; };
  T.fmt = function (psi) { return T.num(psi) + ' ' + T.uName(); };
  T.level = function (psi) {
    if (psi == null || !isFinite(psi)) return 'unk';
    var r = T.rec();
    if (psi < r - 6) return 'vlow';
    if (psi < r - 2) return 'low';
    if (psi > r + 5) return 'high';
    return 'ok';
  };
  T.last = function () { var l = data().log; return l.length ? l[l.length - 1] : null; };

  function day0(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function daysSince(t) { return Math.round((day0(Date.now()) - day0(t)) / DAY); }
  T.ago = function (t) {
    var n = daysSince(t);
    if (n <= 0) return 'اليوم ' + App.hmFull(new Date(t));
    if (n === 1) return 'أمس';
    if (n === 2) return 'قبل يومين';
    return 'قبل ' + App.d(n) + (n <= 10 ? ' أيام' : ' يوم');
  };
  function dateLbl(t) { var d = new Date(t); return App.d(d.getDate()) + ' ' + MON[d.getMonth()]; }

  // one summary used by the status bar, the smart card and «سيارتي»
  T.state = function () {
    var L = T.last();
    if (!L) return { k: 'none', msg: 'ما فيه قراءة مسجّلة' };
    var worst = -1, wl = 'ok', low = 0;
    L.v.forEach(function (p, i) {
      var l = T.level(p);
      if (l === 'low' || l === 'vlow') low++;
      if (RANK[l] > RANK[wl]) { wl = l; worst = i; }
    });
    var n = daysSince(L.t), st = { k: wl, worst: worst, last: L, days: n, min: Math.min.apply(null, L.v), low: low };
    if (wl === 'ok' && n > 30) st.k = 'due';
    if (low >= 2) st.msg = low === 4 ? 'الكفرات الأربعة ناقصة هوا' : low === 3 ? 'ثلاث كفرات ناقصة هوا' : 'كفرين ناقصين هوا';
    else if (wl === 'vlow' || wl === 'low') st.msg = 'الكفر ' + FULL[worst] + ' ' + (wl === 'vlow' ? 'ناقص كثير' : 'ناقص') + ' — ' + T.fmt(L.v[worst]);
    else if (wl === 'high') st.msg = 'الكفر ' + FULL[worst] + ' ضغطه زايد — ' + T.fmt(L.v[worst]);
    else st.msg = n > 30 ? 'صار لك ' + App.d(n) + ' يوم ما فحصت الكفرات' : 'الكفرات الأربعة سليمة';
    return st;
  };

  // ---------- status bar ----------
  function bar() {
    var ic = App.$('stTire'), lb = App.$('tireLbl');
    if (!ic) return;
    var s = T.state();
    ic.setAttribute('class', 'ic st' + ({ ok: ' ok', due: ' acc', high: ' warn', low: ' warn', vlow: ' hot blink', none: ' acc' })[s.k]);
    lb.textContent = s.k === 'none' ? 'الإطارات' : 'الإطارات ' + T.num(s.min);
  }
  T.bar = bar;

  // ---------- the screen's own sensor page ----------
  T.sensorApps = function () {
    if (!App.Native.has) return [];
    return App.system.apps().filter(function (a) { return TP.test(a.p) || TP.test(String(a.l)); });
  };
  T.openSensors = function (choose) {
    if (!App.Native.has) { App.toast('صفحة الحساسات تفتح من شاشة السيارة نفسها', 3200); return; }
    var s = App.settings.tpmsApp, list = T.sensorApps();
    if (s && !choose && App.Native.call('launch', s) === '1') return;
    if (list.length === 1 && !choose) { App.settings.tpmsApp = list[0].p; App.saveSettings(); App.system.launch(list[0].p, list[0].l); return; }
    App.panels.push('صفحة الحساسات', function (body) {
      var show = list.length ? list : App.system.apps();
      body.innerHTML = '<div class="big-status on">' + App.icon('tire') + '<div class="txt"><b>' +
        (list.length ? 'لقيت ' + App.d(list.length) + ' تطبيق لبيانات السيارة' : 'اختر التطبيق اللي يعرض ضغط الكفرات') + '</b><small>' +
        'حساسات الكامري توصل للشاشة عن طريق صندوق الكان باص، وتظهر في تطبيق الشاشة (CANBUS أو معلومات السيارة). اختره مرة وحدة وبعدها الزر يفتحه مباشرة.</small></div></div>' +
        '<div class="search-input">' + App.icon('search') + '<input id="tpFilter" placeholder="ابحث في تطبيقات الشاشة…"></div>' +
        '<div id="tpList">' + show.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '" data-l="' + App.esc(String(a.l).toLowerCase()) + '"><span data-icon="' + App.esc(a.p) + '" class="lead-ic"><span class="ph">' +
            App.esc(String(a.l).charAt(0)) + '</span></span><span class="txt"><b>' + App.esc(a.l) + '</b><small>' + App.esc(a.p) + '</small></span>' +
            (a.p === s ? '<span class="side">' + App.icon('check') + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        (list.length ? '<div class="btn-row" style="margin-top:1rem"><button class="btn" id="tpAll">' + App.icon('apps') + 'اختر من كل التطبيقات</button></div>' : '');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () {
          App.settings.tpmsApp = b.dataset.p; App.saveSettings(); App.panels.back();
          App.system.launch(b.dataset.p, App.system.label(b.dataset.p));
        };
      });
      App.$('tpFilter').oninput = function () {
        var q = this.value.trim().toLowerCase();
        body.querySelectorAll('[data-p]').forEach(function (x) { x.style.display = !q || x.dataset.l.indexOf(q) >= 0 || x.dataset.p.indexOf(q) >= 0 ? '' : 'none'; });
      };
      if (App.$('tpAll')) App.$('tpAll').onclick = function () { list = []; App.panels.refresh(); };
      App.system.lazyIcons(body);
    });
  };

  // ---------- recording ----------
  T.record = function (v, quiet) {
    var d = data();
    d.log.push({ t: Date.now(), v: v.map(function (x) { return Math.round(x * 10) / 10; }) });
    save(d);
    App.settings.tireSnooze = 0; App.saveSettings();
    var s = T.state();
    if (!quiet) App.toast(s.k === 'ok' ? 'تم حفظ القراءة ✓ — الكفرات سليمة' : 'تم الحفظ — ' + s.msg, 3500);
    if (s.k === 'vlow' || s.k === 'low') App.nav.say('انتبه. ' + s.msg.split(' — ')[0]);
    return s;
  };
  T.fillAll = function () { var r = T.rec(); return T.record([r, r, r, r]); };
  T.snooze = function () { App.settings.tireSnooze = Date.now() + 3 * DAY; App.saveSettings(); };
  T.nag = function () {   // a gentle «check your tyres» for the smart card
    var s = T.state();
    if (s.k !== 'none' && s.k !== 'due') return null;
    if ((App.settings.tireSnooze || 0) > Date.now()) return null;
    return s;
  };

  // ---------- the panel ----------
  var edit = null;   // four values (psi) while recording

  function car() {
    return '<svg class="ty-car" viewBox="0 0 220 400" aria-hidden="true">' +
      CLS.map(function (c, i) {
        return '<rect class="w ' + c + '" x="' + (i % 2 ? 174 : 24) + '" y="' + (i < 2 ? 70 : 280) + '" width="22" height="58" rx="8"/>';
      }).join('') +
      '<ellipse class="b" cx="31" cy="140" rx="10" ry="6.5"/><ellipse class="b" cx="189" cy="140" rx="10" ry="6.5"/>' +
      '<path class="b" d="M110 16C152 16 172 28 177 58L182 118C185 170 185 240 182 292L178 350C173 380 152 390 110 390C68 390 47 380 42 350L38 292C35 240 35 170 38 118L43 58C48 28 68 16 110 16Z"/>' +
      '<path class="g" d="M62 124C82 110 138 110 158 124L150 170C130 162 90 162 70 170Z"/>' +
      '<rect class="r" x="70" y="178" width="80" height="100" rx="16"/>' +
      '<path class="g" d="M70 286C90 293 130 293 150 286L156 322C136 332 84 332 64 322Z"/>' +
      '<path class="l" d="M54 46Q70 32 92 33M166 46Q150 32 128 33M62 372Q80 381 96 380M158 372Q140 381 124 380"/>' +
      '</svg>';
  }
  function tireHtml(i, psi) {
    var lv = T.level(psi), c = 'ty-t ' + CLS[i] + ' lv-' + lv;
    if (edit) {
      return '<div class="' + c + ' edit"><small>' + SHORT[i] + '</small><div class="ty-step"><button data-t="' + i + '" data-d="-1" aria-label="أقل">−</button>' +
        '<b class="num">' + T.num(psi) + '</b><button data-t="' + i + '" data-d="1" aria-label="أكثر">+</button></div><span>' + T.uName() + '</span></div>';
    }
    return '<button class="' + c + '" data-open="' + i + '"><small>' + SHORT[i] + '</small><b class="num">' + (psi == null ? '—' : T.num(psi)) + '</b><span>' +
      (psi == null ? 'ما سجّلت' : T.uName()) + '</span></button>';
  }
  function stageHtml(v) {
    return '<div class="ty-stage"><span class="ty-front"><svg class="ic" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>الأمام</span>' + car() + v.map(function (p, i) { return tireHtml(i, p); }).join('') + '</div>';
  }
  function paint(stage, v) {
    CLS.forEach(function (c, i) {
      var w = stage.querySelector('.w.' + c);
      if (w) w.setAttribute('class', 'w ' + c + ' lv-' + T.level(v[i]));
    });
  }

  function render(body) {
    var L = T.last(), s = T.state(), r = T.rec(), d = data();
    var v = edit || (L ? L.v : [null, null, null, null]);
    var side;
    if (edit) {
      side = '<div class="ty-sum edit">' + App.icon('edit') + '<div class="txt"><b>سجّل ضغط كل كفر</b><small>اقرأ الأرقام من شاشة العداد أو من صفحة الحساسات، وعدّلها بـ + و −</small></div></div>' +
        '<div class="btn-row"><button class="btn primary" id="tySave">' + App.icon('check') + 'حفظ القراءة</button><button class="btn" id="tyCancel">إلغاء</button></div>' +
        '<div class="btn-row"><button class="btn" id="tyRec">' + App.icon('reset') + 'كلها ' + T.num(r) + '</button><button class="btn" id="tyApp">' + App.icon('car') + 'صفحة الحساسات</button></div>';
    } else {
      var hist = d.log.slice(-5).reverse();
      side = '<div class="ty-sum lv-' + (s.k === 'none' || s.k === 'due' ? 'unk' : s.k) + '">' + App.icon(s.k === 'ok' ? 'check' : s.k === 'none' ? 'tire' : 'bell') +
        '<div class="txt"><b>' + App.esc(s.k === 'none' ? 'سجّل ضغط كفراتك' : s.msg) + '</b><small>' +
        (L ? 'آخر قراءة ' + T.ago(L.t) : 'سجّلها مرة وحدة، وأنا أذكّرك كل شهر وأنبهك إذا كفر ناقص') + '</small></div></div>' +
        '<div class="ty-rec"><span class="txt">الضغط المطلوب للكامري<small>والكفرات باردة — مكتوب على ملصق باب السائق</small></span><b class="num">' + T.num(r) + '</b><span class="u">' + T.uName() + '</span>' +
        '<button class="chip" id="tySet">' + App.icon('settings') + 'تعديل</button></div>' +
        '<div class="btn-row"><button class="btn primary" id="tyLog">' + App.icon('edit') + 'تسجيل قراءة</button>' +
        '<button class="btn" id="tyFill">' + App.icon('check') + 'عبّيتها كلها ' + T.num(r) + '</button></div>' +
        '<button class="btn ty-app" id="tyApp">' + App.icon('car') + 'صفحة الحساسات في الشاشة' + (App.settings.tpmsApp ? '<small>' + App.esc(App.system.label(App.settings.tpmsApp)) + '</small>' : '') + '</button>' +
        (hist.length ? '<div class="sec-title">آخر القراءات</div><div class="ty-hist">' + hist.map(function (h) {
          return '<div class="ty-h"><span class="d">' + dateLbl(h.t) + '</span><span class="q">' + h.v.map(function (p) {
            return '<i class="lv-' + T.level(p) + '">' + T.num(p) + '</i>';
          }).join('') + '</span></div>';
        }).join('') + '</div>' : '') +
        '<div class="note">' + App.icon('sun') + 'حرارة الجو والمشوار ترفع القراءة ٢–٤ بوند — قِس قبل ما تمشي أو بعد وقوف ٣ ساعات، ولا تنفّس الكفر وهو حار.</div>';
    }
    body.innerHTML = '<div class="ty' + (edit ? ' editing' : '') + '">' + stageHtml(v) + '<div class="ty-side">' + side + '</div></div>';
    var stage = body.querySelector('.ty-stage');
    paint(stage, v);

    if (edit) {
      stage.onclick = function (e) {
        var b = e.target.closest('[data-d]');
        if (!b) return;
        var i = +b.dataset.t, x = u(), cur = edit[i] * x.k;
        cur = Math.round((cur + (+b.dataset.d) * x.step) / x.step) * x.step;
        edit[i] = Math.max(10, Math.min(60, cur / x.k));
        var t = b.parentNode.querySelector('b'); t.textContent = T.num(edit[i]);
        b.closest('.ty-t').className = 'ty-t ' + CLS[i] + ' edit lv-' + T.level(edit[i]);
        paint(stage, edit);
      };
      App.$('tySave').onclick = function () { var vv = edit; edit = null; T.record(vv); App.panels.refresh(); };
      App.$('tyCancel').onclick = function () { edit = null; App.panels.refresh(); };
      App.$('tyRec').onclick = function () { edit = [r, r, r, r]; App.panels.refresh(); };
    } else {
      stage.onclick = function (e) { if (e.target.closest('[data-open]')) start(); };
      App.$('tyLog').onclick = start;
      App.$('tyFill').onclick = function () { T.fillAll(); App.panels.refresh(); };
      App.$('tySet').onclick = settings;
    }
    App.$('tyApp').onclick = function () { T.openSensors(false); };
  }
  function start() { var L = T.last(), r = T.rec(); edit = L ? L.v.slice() : [r, r, r, r]; App.panels.refresh(); }

  function settings() {
    App.panels.push('إعدادات ضغط الإطارات', function (body) {
      var s = App.settings, un = T.unit();
      body.innerHTML =
        '<div class="set-row"><div class="txt"><b>الوحدة</b><small>محطات البنزين عندنا غالباً بالبوند (PSI)</small></div><div class="seg" id="tyUnit">' +
          [['psi', 'بوند'], ['bar', 'بار'], ['kpa', 'كيلوباسكال']].map(function (o) { return '<button data-v="' + o[0] + '" class="' + (o[0] === un ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="set-row"><div class="txt"><b>الضغط المطلوب</b><small>للكامري ٢٠١٨ وما بعد: ٣٥ بوند (٢٫٤ بار) أمامي وخلفي — تأكد من ملصق باب السائق</small></div>' +
          '<div class="ty-step big"><button data-d="-1">−</button><b class="num" id="tyRecV">' + T.num(T.rec()) + '</b><button data-d="1">+</button></div></div>' +
        '<div class="set-row"><div class="txt"><b>صفحة الحساسات</b><small>' + (s.tpmsApp ? 'تفتح «' + App.esc(App.system.label(s.tpmsApp)) + '»' : 'ما اخترت تطبيق للحين') + '</small></div>' +
          '<button class="btn" id="tyPick">' + App.icon('apps') + 'اختيار</button></div>' +
        '<div class="set-row"><div class="txt"><b>سجل القراءات</b><small>' + App.d(data().log.length) + ' قراءة محفوظة في الشاشة</small></div>' +
          '<button class="btn" id="tyClear">' + App.icon('trash') + 'مسح</button></div>';
      body.querySelectorAll('#tyUnit [data-v]').forEach(function (b) {
        b.onclick = function () { s.tireUnit = b.dataset.v; App.saveSettings(); App.panels.refresh(); bar(); };
      });
      body.querySelectorAll('.ty-step.big [data-d]').forEach(function (b) {
        b.onclick = function () { s.tireRec = Math.max(20, Math.min(60, T.rec() + (+b.dataset.d))); App.saveSettings(); App.$('tyRecV').textContent = T.num(T.rec()); bar(); };
      });
      App.$('tyPick').onclick = function () { T.openSensors(true); };
      App.$('tyClear').onclick = function () { save({ log: [] }); App.toast('تم مسح السجل'); App.panels.refresh(); };
    });
  }

  App.panelDefs = App.panelDefs || {};
  App.panelDefs.tires = { title: 'ضغط الإطارات', render: render };
  T.open = function (rec) { edit = null; App.panels.open('tires'); if (rec) start(); };

  T.init = function () {
    bar();
    App.on('tires', bar);
    App.on('settings', bar);
    App.on('panel', function (n) { if (n !== 'tires') edit = null; });
    setInterval(bar, 3600e3);
  };
})();
