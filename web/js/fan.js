/* fan.js — screen cooling: live temperature from the head unit's thermal sensors, history graph,
   overheating alert, and one-tap launch of the unit's own fan app (control stays with the vendor app). */
(function () {
  'use strict';
  var F = App.fan = { hist: App.store.get('fanHist', []), last: null };
  var PKG_HINT = /fan|cool|thermal|风扇|散热|مروح|تبريد/i;

  // millidegrees / decidegrees / degrees -> degrees C
  function norm(v) {
    v = parseFloat(v);
    if (!isFinite(v)) return null;
    if (Math.abs(v) >= 1000) v /= 1000; else if (Math.abs(v) >= 200) v /= 10;
    return v > 5 && v < 130 ? v : null;
  }
  F.read = function () {
    var j = App.Native.json('temp');
    if (!j) return null;
    var zones = (j.z || []).map(function (z) { return { t: String(z.t || 'zone'), v: norm(z.v) }; }).filter(function (z) { return z.v != null; });
    var cpu = zones.filter(function (z) { return /cpu|soc|tsens|mtktscpu|ap_|core|big|little|cluster|thermal/i.test(z.t) && !/batt|charger|pa_|rf|modem|xo/i.test(z.t); });
    var pool = cpu.length ? cpu : zones.filter(function (z) { return !/batt|charger/i.test(z.t); });
    var t = null, src = '';
    pool.forEach(function (z) { if (t == null || z.v > t) { t = z.v; src = z.t; } });
    var bat = j.b > 0 ? j.b / 10 : null;
    if (t == null && bat != null && bat > 5 && bat < 90) { t = bat; src = 'battery'; }
    return { t: t, src: src, zones: zones, bat: bat, status: j.s == null ? -1 : j.s };
  };
  F.level = function (t, s) {
    if (t == null && s < 0) return { k: 'na', n: 'غير متاح' };
    if (s >= 4 || t >= 85) return { k: 'hot', n: 'حار جداً' };
    if (s >= 3 || t >= (App.settings.fanLimit || 75)) return { k: 'hot', n: 'مرتفع' };
    if (s >= 2 || t >= 62) return { k: 'warm', n: 'دافئ' };
    return { k: 'ok', n: t != null && t < 45 ? 'بارد' : 'طبيعي' };
  };

  var lastAlert = 0;
  function sample() {
    var r = F.read();
    F.last = r;
    var lbl = App.$('fanLbl'), dk = document.querySelector('.dk[data-panel="fan"]'), st = App.$('stFan');
    if (!r || r.t == null) {
      if (lbl) lbl.textContent = 'المروحة';
      if (st) st.setAttribute('class', 'ic st');
      return;
    }
    F.hist.push([Date.now(), Math.round(r.t * 10) / 10]);
    if (F.hist.length > 90) F.hist.splice(0, F.hist.length - 90);
    if (F.hist.length % 6 === 0) App.store.set('fanHist', F.hist);
    var lv = F.level(r.t, r.status);
    if (lbl) lbl.textContent = 'المروحة \u200E' + App.d(Math.round(r.t)) + '°\u200E';
    if (dk) dk.classList.toggle('hot', lv.k === 'hot');
    if (st) st.setAttribute('class', 'ic st ' + (lv.k === 'hot' ? 'hot blink' : lv.k === 'warm' ? 'acc' : 'ok'));
    if (App.panels.current === 'fan') update();
    if (lv.k === 'hot' && App.settings.fanAlert && Date.now() - lastAlert > 10 * 60000) {
      lastAlert = Date.now();
      App.reminder.show({
        kind: 'حرارة الشاشة', icon: 'thermo', title: 'حرارة الشاشة \u200E' + App.d(Math.round(r.t)) + '°\u200E — ' + lv.n,
        sub: 'شغّل المروحة أو خفّف السطوع، وتجنّب ترك السيارة تحت الشمس والشاشة تعمل',
        buttons: [['fan', 'تشغيل المروحة', 'fan'], ['panel', 'التفاصيل', 'thermo'], ['close', 'إغلاق', 'close']],
        onButton: function (b) { if (b === 'fan') F.openApp(false); if (b === 'panel') App.panels.open('fan'); }
      });
    }
  }

  // ---------- the vendor fan app ----------
  function candidates() {
    return App.system.apps().filter(function (a) { return PKG_HINT.test(a.p) || PKG_HINT.test(a.l); });
  }
  F.openApp = function (choose) {
    var N = App.Native;
    if (!N.has) { App.toast('هذه الميزة تعمل داخل شاشة السيارة'); return; }
    if (App.settings.fanApp && !choose && N.call('launch', App.settings.fanApp) === '1') return;
    var c = candidates();
    if (c.length === 1 && !choose) { App.settings.fanApp = c[0].p; App.saveSettings(); F.openApp(false); return; }
    App.panels.push('اختر تطبيق المروحة', function (body) {
      var list = c.length ? c : App.system.apps();
      body.innerHTML = '<div class="note" style="margin-bottom:1.2vmin">' + (c.length ? 'وجدت هذه التطبيقات المرتبطة بالتبريد — اختر تطبيق المروحة في شاشتك:' :
        'ما لقيت تطبيق مروحة باسم واضح — اختره من القائمة (عادةً اسمه Fan أو مروحة أو تبريد). سيُحفظ اختيارك.') + '</div>' +
        list.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '">' + App.icon('fan', 'lead') + '<span class="txt"><b>' + App.esc(a.l) +
            '</b><small>' + App.esc(a.p) + '</small></span></button>';
        }).join('');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () { App.settings.fanApp = b.dataset.p; App.saveSettings(); App.panels.back(); F.openApp(false); };
      });
    });
  };

  // ---------- panel ----------
  function spark() {
    var h = F.hist.slice(-60);
    if (h.length < 2) return '<svg class="spark" viewBox="0 0 300 60"><text x="150" y="34" text-anchor="middle" fill="var(--muted)" font-size="11">يتجمّع سجل الحرارة خلال الدقائق القادمة…</text></svg>';
    var lo = 30, hi = 95, n = h.length;
    var pts = h.map(function (p, i) { return (300 - i * 300 / (n - 1)).toFixed(1) + ',' + (56 - (Math.min(hi, Math.max(lo, p[1])) - lo) / (hi - lo) * 52).toFixed(1); });
    var lim = App.settings.fanLimit || 75, ly = (56 - (lim - lo) / (hi - lo) * 52).toFixed(1);
    return '<svg class="spark" viewBox="0 0 300 60" preserveAspectRatio="none"><path d="M0 ' + ly + 'H300" stroke="var(--danger)" stroke-opacity=".5" stroke-dasharray="4 4"/>' +
      '<polyline points="' + pts.join(' ') + ' 0,60 300,60" fill="rgba(var(--accent-rgb),.12)" stroke="none"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  function blades() {
    return '<svg class="blades" viewBox="0 0 100 100"><g fill="var(--accent)" fill-opacity=".85">' + [0, 72, 144, 216, 288].map(function (a) {
      return '<path transform="rotate(' + a + ' 50 50)" d="M50 50C46 38 44 24 50 10c9 4 13 16 9 30z"/>';
    }).join('') + '</g><circle cx="50" cy="50" r="9" fill="var(--text)"/><circle cx="50" cy="50" r="4" fill="var(--card-c)"/></svg>';
  }
  function update() {
    var r = F.last, el = App.$('fanRead');
    if (!el) return;
    var lv = F.level(r && r.t, r ? r.status : -1);
    el.innerHTML = r && r.t != null ?
      '<div class="t num">' + App.d(Math.round(r.t)) + '<small>°</small></div><span class="s ' + (lv.k === 'ok' ? '' : lv.k) + '">' + lv.n + '</span>' +
      '<span class="src">' + (r.src === 'battery' ? 'حساس البطارية' : 'أعلى حساس: ' + App.esc(r.src)) + '</span>' :
      '<div class="t" style="font-size:4vmin">—</div><span class="s">لا تتوفر قراءة حرارة</span><span class="src">بعض الشاشات تمنع قراءة الحساسات</span>';
    var spin = App.$('fanSpin');
    if (spin && r && r.t != null) {
      spin.classList.remove('idle');
      spin.style.setProperty('--fan-speed', Math.max(0.35, 2.6 - (r.t - 35) / 25) + 's');
    }
    var sp = App.$('fanSpark');
    if (sp) sp.innerHTML = spark();
  }
  function render(body) {
    var r = F.last || F.read();
    F.last = r;
    var zones = r && r.zones && r.zones.length ? r.zones : [];
    body.innerHTML = '<div class="fan-hero"><div class="fan-spin idle" id="fanSpin"><span class="ring"></span>' + blades() + '</div>' +
      '<div class="fan-read" id="fanRead"></div></div>' +
      '<div class="btn-row" style="margin-bottom:1.4vmin"><button class="btn primary" id="fOpen">' + App.icon('fan') + 'تشغيل المروحة</button>' +
      '<button class="btn" id="fPick">' + App.icon('apps') + 'اختيار تطبيق المروحة</button>' +
      '<button class="btn" id="fDisp">' + App.icon('sun') + 'السطوع والعرض</button></div>' +
      '<div class="sec"><div class="sec-title">سجل الحرارة (آخر ١٠ دقائق)</div><div id="fanSpark"></div></div>' +
      '<div class="set-row"><div class="txt"><b>تنبيه الحرارة المرتفعة</b><small>ينبّهك ويقترح تشغيل المروحة</small></div>' +
      '<div class="stepper" style="margin-left:1.2vw"><button class="round small" data-l="-5">' + App.icon('minus') + '</button><b class="num" id="fLim">' +
      App.d(App.settings.fanLimit || 75) + '°</b><button class="round small" data-l="5">' + App.icon('plus') + '</button></div>' +
      '<button class="switch' + (App.settings.fanAlert ? ' on' : '') + '" id="fAlert"></button></div>' +
      (zones.length ? '<div class="sec"><div class="sec-title">الحساسات</div><div class="zones">' + zones.slice(0, 12).map(function (z) {
        return '<div><span>' + App.esc(z.t) + '</span><b class="num">\u200E' + App.d(Math.round(z.v)) + '°\u200E</b></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="note">' + App.icon('fan') + ' التحكم الفعلي بالمروحة يتم من تطبيق المروحة الخاص بشاشتك — «تشغيل المروحة» يفتحه مباشرة، ويتذكّر اختيارك.</div>';
    update();
    App.$('fOpen').onclick = function () { F.openApp(false); };
    App.$('fPick').onclick = function () { F.openApp(true); };
    App.$('fDisp').onclick = function () { App.system.intent('android.settings.DISPLAY_SETTINGS'); };
    App.$('fAlert').onclick = function () {
      App.settings.fanAlert = !App.settings.fanAlert;
      this.classList.toggle('on', App.settings.fanAlert);
      App.saveSettings();
    };
    body.querySelectorAll('[data-l]').forEach(function (b) {
      b.onclick = function () {
        App.settings.fanLimit = Math.max(55, Math.min(95, (App.settings.fanLimit || 75) + (+b.dataset.l)));
        App.$('fLim').textContent = App.d(App.settings.fanLimit) + '°';
        App.saveSettings();
        update();
      };
    });
  }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.fan = { title: 'المروحة وتبريد الشاشة', render: render };

  F.init = function () {
    if (!App.Native.has) return;
    sample();
    setInterval(sample, 10000);
  };
})();
