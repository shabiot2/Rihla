/* tasks.js — driver assistant: daily tasks with reminders + "nearest place" help, vehicle care with a
   GPS odometer, the "My car" panel, and a short daily briefing (spoken on request). */
(function () {
  'use strict';
  var TK = App.tasks = {};
  var TEMPLATES = [
    ['fuel', 'تعبئة بنزين', 'fuel'], ['pharmacy', 'صيدلية', 'hospital'], ['grocery', 'مقاضي البيت', 'cart'],
    ['atm', 'سحب من الصراف', 'cash'], ['bakery', 'خبز من المخبز', 'bread'], ['carwash', 'غسيل السيارة', 'wash'],
    ['laundry', 'المغسلة', 'shirt'], ['school', 'توصيل المدرسة', 'school'], ['post', 'استلام شحنة', 'box'],
    ['repair', 'الورشة', 'wrench'], ['cafe', 'قهوة', 'cafe']
  ];
  var GUESS = [
    ['fuel', /بنزين|وقود|ديزل|محطة/], ['pharmacy', /صيدل|دواء|علاج/], ['grocery', /بقال|مقاضي|سوبر|ماركت|هايبر|حليب|خضار|تموين/],
    ['atm', /صراف|سحب|بنك|كاش|فلوس/], ['bakery', /خبز|مخبز|فرن|تميس/], ['carwash', /غسيل السيار|مغسلة سيار|تلميع/],
    ['laundry', /مغسلة|كوي|ملابس|ثياب/], ['school', /مدرس|روض|حضان|العيال|الأولاد|البنات/], ['post', /شحن|طرد|بريد|شحنة/],
    ['repair', /ورشة|كفر|إطار|زيت|بنشر|صيانة/], ['mosque', /مسجد|جامع/], ['cafe', /قهوة|كوفي|كافيه/],
    ['food', /مطعم|غدا|عشا|فطور/], ['hospital', /مستشفى|مستوصف|عيادة/]
  ];
  var ICON = {};
  TEMPLATES.forEach(function (t) { ICON[t[0]] = t[2]; });
  ICON.mosque = 'mosque'; ICON.food = 'food'; ICON.hospital = 'hospital';

  // ---------- storage ----------
  TK.list = App.store.get('tasks', []);
  function save() { App.store.set('tasks', TK.list); badge(); }
  function today() { return new Date().toDateString(); }
  function guessCat(t) { for (var i = 0; i < GUESS.length; i++) if (GUESS[i][1].test(t)) return GUESS[i][0]; return null; }
  TK.add = function (title, cat, at, place) {
    title = String(title || '').trim();
    if (!title) return null;
    var t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: title, cat: cat || guessCat(title),
      at: at || null, place: place || null, done: false, rep: false, created: Date.now(), day: today() };
    TK.list.unshift(t);
    save();
    return t;
  };
  function find(id) { return TK.list.filter(function (x) { return x.id === id; })[0]; }
  function pending() { return TK.list.filter(function (x) { return !x.done; }); }

  // ---------- odometer (dashboard reading + GPS distance since) ----------
  var odoMeters = App.store.get('odoMeters', 0), odoDirty = false;
  App.on('moved', function (m) { odoMeters += m; odoDirty = true; });
  setInterval(function () { if (odoDirty) { odoDirty = false; App.store.set('odoMeters', odoMeters); } }, 20000);
  TK.odo = function () {
    var o = App.settings.odo;
    return o && o.base != null ? o.base + (odoMeters - o.at) / 1000 : null;
  };
  TK.setOdo = function (km) { App.settings.odo = { base: km, at: odoMeters }; App.saveSettings(); };
  TK.gpsKm = function () { return odoMeters / 1000; };

  // ---------- vehicle care ----------
  var MAINT = [
    { id: 'oil', n: 'تغيير الزيت', ic: 'drop', type: 'km', every: 5000, opts: [3000, 5000, 7500, 10000, 15000] },
    { id: 'tires', n: 'تدوير الإطارات والترصيص', ic: 'tire', type: 'km', every: 10000, opts: [5000, 10000, 15000, 20000] },
    { id: 'service', n: 'الصيانة الدورية', ic: 'wrench', type: 'km', every: 20000, opts: [10000, 15000, 20000, 30000, 40000] },
    { id: 'wash', n: 'غسيل السيارة', ic: 'wash', type: 'days', every: 7, opts: [3, 5, 7, 10, 14, 30] },
    { id: 'inspection', n: 'الفحص الفني الدوري', ic: 'shield', type: 'date' },
    { id: 'registration', n: 'رخصة سير المركبة (الاستمارة)', ic: 'doc', type: 'date' },
    { id: 'insurance', n: 'تأمين المركبة', ic: 'shield', type: 'date' },
    { id: 'license', n: 'رخصة القيادة', ic: 'id', type: 'date' }
  ];
  function mstate(id) { var m = App.settings.maint || {}; return m[id] || {}; }
  function mset(id, v) {
    var m = App.settings.maint || {};
    m[id] = v;
    App.settings.maint = m;
    App.saveSettings();
    badge();
  }
  function fmtKm(k) { return App.d(Math.round(k).toLocaleString('en-US')) + ' كم'; }
  function daysTo(dateStr) {
    var p = String(dateStr || '').split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date();
    n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((d - n) / 86400000);
  }
  function status(it) {
    var s = mstate(it.id), every = s.every || it.every;
    if (it.type === 'km') {
      var odo = TK.odo();
      if (odo == null || s.last == null) return { st: 'unset', txt: odo == null ? 'سجّل قراءة العدّاد أولاً' : 'اضغط لتسجيل آخر مرة', pct: 0 };
      var left = s.last + every - odo, pct = Math.max(0, Math.min(1, (odo - s.last) / every));
      return { st: left <= 0 ? 'due' : left < Math.max(500, every * 0.1) ? 'soon' : 'ok', pct: pct,
        txt: left <= 0 ? 'مستحق الآن (تجاوز ' + fmtKm(-left) + ')' : 'باقي ' + fmtKm(left) + ' • كل ' + fmtKm(every) };
    }
    if (it.type === 'days') {
      if (!s.last) return { st: 'unset', txt: 'اضغط لتسجيل آخر مرة', pct: 0 };
      var since = (Date.now() - s.last) / 86400000, l = every - since;
      return { st: l <= 0 ? 'due' : l < 2 ? 'soon' : 'ok', pct: Math.min(1, since / every),
        txt: l <= 0 ? 'حان وقتها' : 'باقي ' + App.d(Math.ceil(l)) + ' يوم • كل ' + App.d(every) + ' أيام' };
    }
    var dd = daysTo(s.due);
    if (dd == null) return { st: 'unset', txt: 'اضغط لإدخال تاريخ الانتهاء', pct: 0 };
    return { st: dd < 0 ? 'due' : dd <= 30 ? 'soon' : 'ok', pct: dd < 0 ? 1 : Math.max(0, 1 - dd / 365),
      txt: dd < 0 ? 'منتهية منذ ' + App.d(-dd) + ' يوم' : dd === 0 ? 'تنتهي اليوم' : 'تنتهي بعد ' + App.d(dd) + ' يوم (' + App.d(s.due) + ')' };
  }
  TK.maintDue = function () {
    return MAINT.map(function (it) { return { it: it, s: status(it) }; }).filter(function (x) { return x.s.st === 'due' || x.s.st === 'soon'; });
  };

  function editMaint(it) {
    App.panels.push(it.n, function (body) {
      var s = mstate(it.id), odo = TK.odo(), html = '<div class="big-status on">' + App.icon(it.ic) + '<div class="txt"><b>' + it.n + '</b><small>' + status(it).txt + '</small></div></div>';
      if (it.type === 'km') {
        html += '<div class="set-row"><div class="txt"><b>آخر مرة عند قراءة العدّاد</b><small>بالكيلومتر</small></div><input class="field num" type="number" inputmode="numeric" id="mLast" value="' +
          (s.last != null ? Math.round(s.last) : (odo != null ? Math.round(odo) : '')) + '"></div>' +
          '<div class="set-row"><div class="txt"><b>التكرار</b></div><div class="seg" id="mEvery">' + it.opts.map(function (o) {
            return '<button data-v="' + o + '"' + ((s.every || it.every) === o ? ' class="on"' : '') + '>' + App.d(o / 1000) + ' ألف</button>';
          }).join('') + '</div></div>' +
          '<div class="btn-row"><button class="btn ok" id="mNow">' + App.icon('check') + 'تم الآن' + (odo != null ? ' (' + fmtKm(odo) + ')' : '') + '</button>' +
          '<button class="btn primary" id="mSave">' + App.icon('check') + 'حفظ</button></div>';
      } else if (it.type === 'days') {
        html += '<div class="set-row"><div class="txt"><b>التكرار</b></div><div class="seg" id="mEvery">' + it.opts.map(function (o) {
          return '<button data-v="' + o + '"' + ((s.every || it.every) === o ? ' class="on"' : '') + '>' + App.d(o) + ' أيام</button>';
        }).join('') + '</div></div><div class="btn-row"><button class="btn ok" id="mNow">' + App.icon('check') + 'تمت اليوم</button></div>';
      } else {
        html += '<div class="set-row"><div class="txt"><b>تاريخ الانتهاء</b><small>بالميلادي — سيصلك تنبيه قبل ٣٠ يوماً</small></div><input class="field" type="date" id="mDue" value="' + (s.due || '') + '"></div>' +
          '<div class="btn-row"><button class="btn primary" id="mSave">' + App.icon('check') + 'حفظ</button></div>';
      }
      body.innerHTML = html;
      var every = s.every || it.every;
      body.querySelectorAll('#mEvery [data-v]').forEach(function (b) {
        b.onclick = function () {
          every = +b.dataset.v;
          body.querySelectorAll('#mEvery [data-v]').forEach(function (x) { x.classList.toggle('on', x === b); });
          var cur = mstate(it.id); cur.every = every; mset(it.id, cur);
        };
      });
      if (App.$('mNow')) App.$('mNow').onclick = function () {
        if (it.type === 'km') {
          if (TK.odo() == null) { App.toast('سجّل قراءة عدّاد السيارة أولاً من «سيارتي»'); return; }
          mset(it.id, { last: TK.odo(), every: every });
        } else mset(it.id, { last: Date.now(), every: every });
        App.toast('تم التسجيل ✓');
        App.panels.back();
      };
      if (App.$('mSave')) App.$('mSave').onclick = function () {
        if (it.type === 'km') {
          var v = parseFloat(App.$('mLast').value);
          if (!isFinite(v)) { App.toast('اكتب قراءة العدّاد'); return; }
          mset(it.id, { last: v, every: every });
        } else mset(it.id, { due: App.$('mDue').value });
        App.toast('تم الحفظ ✓');
        App.panels.back();
      };
    });
  }

  function maintHtml() {
    return MAINT.map(function (it) {
      var s = status(it);
      return '<button class="maint ' + s.st + '" data-m="' + it.id + '">' + App.icon(it.ic, 'lead') + '<span class="txt"><b>' + it.n + '</b><small>' + s.txt +
        '</small><span class="bar"><i style="width:' + Math.round(s.pct * 100) + '%"></i></span></span><span class="st">' +
        ({ ok: 'ممتاز', soon: 'قريباً', due: 'مستحق', unset: '' })[s.st] + '</span></button>';
    }).join('');
  }
  function bindMaint(root) {
    root.querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = function () { editMaint(MAINT.filter(function (x) { return x.id === b.dataset.m; })[0]); };
    });
  }

  // ---------- "My car" panel ----------
  function renderCar(body) {
    var C = App.car, odo = TK.odo();
    body.innerHTML = '<div class="car-hero">' + C.badge('bl-hero') + '<div class="txt"><b>' + App.esc(C.title()) + '</b><small>' + App.esc(C.subtitle()) + '</small>' +
      '<span class="odo"><b class="num">' + (odo != null ? pad6(Math.round(odo)) : '------') + '</b><span>كم</span></span>' +
      '<small style="margin-top:.6vmin">' + (odo != null ? 'العدّاد يتحدّث تلقائياً من GPS' : 'قطعت ' + App.d(TK.gpsKm().toFixed(1)) + ' كم منذ التثبيت — سجّل قراءة عدّاد سيارتك') + '</small></div></div>' +
      '<div class="btn-row" style="margin-bottom:1.4vmin"><button class="btn primary" id="cOdo">' + App.icon('gauge') + 'تسجيل قراءة العدّاد</button>' +
      '<button class="btn" id="cEdit">' + App.icon('edit') + 'تعديل بيانات السيارة</button></div>' +
      '<div class="sec"><div class="sec-title">العناية بالسيارة</div>' + maintHtml() + '</div>';
    bindMaint(body);
    App.$('cEdit').onclick = function () {
      App.panels.push('بيانات السيارة', function (b2) { b2.innerHTML = C.editor(); C.bindEditor(b2); });
    };
    App.$('cOdo').onclick = function () {
      App.panels.push('قراءة العدّاد', function (b2) {
        b2.innerHTML = '<div class="note" style="margin-bottom:1.4vmin">اكتب الرقم الظاهر في عدّاد المسافة بطبلون السيارة. بعدها يضيف التطبيق المسافة المقطوعة تلقائياً من GPS ويذكّرك بالزيت والصيانة.</div>' +
          '<div class="set-row"><div class="txt"><b>قراءة العدّاد الحالية</b><small>بالكيلومتر</small></div><input class="field num" type="number" inputmode="numeric" id="oVal" value="' +
          (TK.odo() != null ? Math.round(TK.odo()) : '') + '"></div><div class="btn-row"><button class="btn primary" id="oSave">' + App.icon('check') + 'حفظ</button></div>';
        App.$('oSave').onclick = function () {
          var v = parseFloat(App.$('oVal').value);
          if (!isFinite(v) || v < 0) { App.toast('اكتب رقماً صحيحاً'); return; }
          TK.setOdo(v);
          App.toast('تم حفظ قراءة العدّاد ✓');
          App.panels.back();
        };
      });
    };
  }
  function pad6(n) { var s = String(n); while (s.length < 6) s = '0' + s; return s; }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.car = { title: 'سيارتي', render: renderCar };

  // ---------- tasks panel ----------
  var draft = { at: null, cat: null };
  function whenLabel(ms) {
    var d = new Date(ms), now = new Date(), tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var day = d.toDateString() === now.toDateString() ? 'اليوم' : d.toDateString() === tm.toDateString() ? 'بكرة' : App.d(d.getDate() + '/' + (d.getMonth() + 1));
    return day + ' ' + App.hmFull(d);
  }
  function prayerAt(i, plus) {
    var P = App.prayer, now = Date.now(), t = P.today && P.today[i] ? P.today[i].getTime() + plus * 60000 : null;
    if (t && t < now) t = P.tomorrow && i === 0 ? P.tomorrow[0].getTime() + plus * 60000 : t + 86400000;
    return t;
  }
  function taskRow(t) {
    var meta = [];
    if (t.at) meta.push('<span class="' + (!t.done && t.at < Date.now() ? 'due' : '') + '">' + App.icon('clock') + whenLabel(t.at) + '</span>');
    if (t.cat && App.nav.cat(t.cat)) meta.push('<span>' + App.icon(ICON[t.cat] || 'gps') + App.nav.cat(t.cat).n + '</span>');
    if (t.place) meta.push('<span>' + App.icon('gps') + App.esc(t.place.name || 'موقع') + '</span>');
    if (t.rep) meta.push('<span>' + App.icon('reset') + 'يومياً</span>');
    return '<div class="task' + (t.done ? ' done' : '') + '" data-id="' + t.id + '"><button class="ck" data-a="toggle">' + App.icon('check') + '</button>' +
      '<div class="txt"><b>' + App.esc(t.t) + '</b><small>' + meta.join('') + '</small></div><div class="act">' +
      (!t.done && t.cat ? '<button class="chip" data-a="near">' + App.icon(ICON[t.cat] || 'gps') + 'الأقرب</button>' : '') +
      (!t.done && t.place ? '<button class="chip" data-a="go">' + App.icon('route') + 'انطلق</button>' : '') +
      '<button class="round small" data-a="rep">' + App.icon('reset') + '</button>' +
      '<button class="round small" data-a="del">' + App.icon('trash') + '</button></div></div>';
  }
  TK.briefing = function () {
    var C = App.car, c = C.get(), h = new Date().getHours(), lines = [], speak = [];
    var greet = (h < 12 ? 'صباح الخير' : 'مساء الخير') + (c.driver ? ' يا ' + c.driver : '');
    var w = App.weatherNow;
    if (w) { lines.push(['sun', 'الجو ' + w.t + '° ' + w.desc]); speak.push('الجو ' + w.t + ' درجة، ' + w.desc); }
    var P = App.prayer, nx = P.today ? P.next(new Date()) : null;
    if (nx) {
      var name = P.NAMES[nx.i], left = App.durText(nx.t - new Date());
      lines.push(['mosque', 'الصلاة القادمة ' + name + ' بعد ' + left]);
      speak.push('الصلاة القادمة ' + name + ' بعد ' + left.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }));
    }
    var pend = pending();
    if (pend.length) {
      lines.push(['tasks', 'عندك ' + App.d(pend.length) + (pend.length === 1 ? ' مهمة' : ' مهام') + ': ' + pend.slice(0, 3).map(function (x) { return x.t; }).join('، ')]);
      speak.push('عندك ' + pend.length + ' مهام. أولها ' + pend[0].t);
    } else lines.push(['check', 'لا توجد مهام معلّقة — يومك خفيف']);
    TK.maintDue().slice(0, 2).forEach(function (x) {
      lines.push(['wrench', x.it.n + ': ' + x.s.txt, 'warn']);
      speak.push('تنبيه: ' + x.it.n + '، ' + x.s.txt);
    });
    var occ = App.occasion();
    if (occ) lines.push(['sparkle', occ.label + ' — ' + occ.greet]);
    return { greet: greet, car: C.title(), lines: lines, text: [greet].concat(speak).join('. ') };
  };
  function assistHtml() {
    var b = TK.briefing();
    return '<div class="assist"><span class="av">' + App.icon('sparkle') + '</span><div class="body"><h3>' + App.esc(b.greet) + '</h3><p>' +
      b.lines.map(function (l) { return App.esc(l[1]); }).join(' • ') + '</p><div class="btn-row actions">' +
      '<button class="btn primary" id="tPlan">' + App.icon('route') + 'رتّب مشاويري</button>' +
      '<button class="btn" id="tSpeak">' + App.icon('vol-up') + 'اقرأ لي الملخص</button></div></div></div>';
  }
  function renderTasks(body) {
    var tab = TK.tab || 'today';
    body.innerHTML = '<div class="tabs"><button data-t="today"' + (tab === 'today' ? ' class="on"' : '') + '>' + App.icon('tasks') + ' مهام اليوم</button>' +
      '<button data-t="car"' + (tab === 'car' ? ' class="on"' : '') + '>' + App.icon('car') + ' سيارتي والصيانة</button></div><div id="tBody"></div>';
    body.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { TK.tab = b.dataset.t; App.panels.refresh(); }; });
    var tb = App.$('tBody');
    if (tab === 'car') { renderCar(tb); return; }
    var open = TK.list.filter(function (x) { return !x.done; }), done = TK.list.filter(function (x) { return x.done; });
    tb.innerHTML = assistHtml() +
      '<form class="search-input" id="tForm">' + App.icon('plus') + '<input id="tInput" placeholder="أضف مهمة… مثل: صيدلية، بنزين، توصيل الأولاد" autocomplete="off" enterkeyhint="done">' +
      '<button class="chip on" type="submit">إضافة</button></form>' +
      '<div class="when" id="tWhen"><span class="note" style="margin-left:.8vw">التذكير:</span>' +
      [['', 'بدون'], ['60', 'بعد ساعة'], ['120', 'بعد ساعتين'], ['asr', 'بعد العصر'], ['maghrib', 'بعد المغرب'], ['21', 'الليلة ٩م'], ['tom', 'بكرة الصبح']].map(function (w) {
        return '<button type="button" class="chip' + (w[0] === '' ? ' on' : '') + '" data-w="' + w[0] + '">' + w[1] + '</button>';
      }).join('') + '<input type="time" id="tTime"></div>' +
      '<div class="cats" id="tTpl">' + TEMPLATES.map(function (t) {
        return '<button class="chip" data-k="' + t[0] + '" data-n="' + t[1] + '">' + App.icon(t[2]) + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="tList">' + (open.length ? open.map(taskRow).join('') : '<div class="empty">ما عندك مهام — أضف واحدة أو اختر من الاقتراحات</div>') + '</div>' +
      (done.length ? '<div class="sec"><div class="sec-title"><span>منجزة</span><button class="chip" id="tClear">' + App.icon('trash') + 'مسح المنجزة</button></div>' + done.slice(0, 20).map(taskRow).join('') + '</div>' : '');
    App.$('tSpeak').onclick = function () { speakBriefing(); };
    App.$('tPlan').onclick = planErrands;
    var wsel = '';
    tb.querySelectorAll('[data-w]').forEach(function (b) {
      b.onclick = function () {
        wsel = b.dataset.w;
        App.$('tTime').value = '';
        tb.querySelectorAll('[data-w]').forEach(function (x) { x.classList.toggle('on', x === b); });
      };
    });
    App.$('tTime').onchange = function () { wsel = 'time'; tb.querySelectorAll('[data-w]').forEach(function (x) { x.classList.remove('on'); }); };
    function pickAt() {
      var now = new Date();
      if (wsel === '60' || wsel === '120') return Date.now() + (+wsel) * 60000;
      if (wsel === 'asr') return prayerAt(3, 15);
      if (wsel === 'maghrib') return prayerAt(4, 15);
      if (wsel === '21') { var n = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21); return n < now ? n.getTime() + 86400000 : n.getTime(); }
      if (wsel === 'tom') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8).getTime();
      if (wsel === 'time' && App.$('tTime').value) {
        var p = App.$('tTime').value.split(':'), d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +p[0], +p[1]);
        return d < now ? d.getTime() + 86400000 : d.getTime();
      }
      return null;
    }
    App.$('tForm').onsubmit = function (e) {
      e.preventDefault();
      var v = App.$('tInput').value.trim();
      if (!v) { App.toast('اكتب المهمة أو اختر من الاقتراحات'); return; }
      App.$('tInput').blur();
      TK.add(v, null, pickAt());
      App.toast('تمت إضافة المهمة ✓');
      App.panels.refresh();
    };
    App.$('tTpl').onclick = function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      TK.add(b.dataset.n, b.dataset.k, pickAt());
      App.toast('تمت الإضافة: ' + b.dataset.n);
      App.panels.refresh();
    };
    if (App.$('tClear')) App.$('tClear').onclick = function () {
      TK.list = TK.list.filter(function (x) { return !x.done || x.rep; });
      save(); App.panels.refresh();
    };
    tb.onclick = function (e) {
      var b = e.target.closest('[data-a]'), row = e.target.closest('.task');
      if (!b || !row) return;
      var t = find(row.dataset.id), a = b.dataset.a;
      if (!t) return;
      if (a === 'toggle') { t.done = !t.done; t.doneAt = Date.now(); if (t.done) App.beep([[1046, 90], [1318, 140]], 0.18); }
      else if (a === 'del') TK.list = TK.list.filter(function (x) { return x !== t; });
      else if (a === 'rep') { t.rep = !t.rep; App.toast(t.rep ? 'ستتكرر هذه المهمة يومياً' : 'أُلغي التكرار اليومي'); }
      else if (a === 'near') { var cat = App.nav.cat(t.cat); App.nav.listPanel('الأقرب: ' + (cat ? cat.n : ''), t.cat); return; }
      else if (a === 'go') { App.nav.start(t.place); return; }
      save(); App.panels.refresh();
    };
  }
  App.panelDefs.tasks = { title: 'المهام ومساعد السائق', render: renderTasks };

  // ---------- reminders (time + place) ----------
  function remind(t, why, near) {
    var cat = t.cat && App.nav.cat(t.cat), target = near || t.place, btns = [];
    if (target) btns.push(['go', 'انطلق', 'route']);
    else if (cat) btns.push(['near', 'أقرب ' + cat.n, ICON[t.cat] || 'gps']);
    btns.push(['done', 'تم ✓', 'check']);
    btns.push(['snooze', 'بعد ١٠ دقائق', 'clock']);
    var sub = why === 'near' ? 'أقرب ' + cat.n + ': ' + (near.name || '') + ' — على بعد ' + App.fmtDist(near.d) :
      why === 'place' ? (t.place.name || '') + ' — ' + App.fmtDist(App.nav.distFromHere(t.place.lat, t.place.lon)) : (t.at ? whenLabel(t.at) : '');
    App.reminder.show({
      kind: why === 'near' ? 'فرصة تنجز مهمتك' : why === 'place' ? 'أنت قريب من مكان مهمتك' : 'تذكير بمهمة',
      icon: why === 'time' ? 'bell' : 'gps', title: t.t, sub: sub, buttons: btns,
      onButton: function (b) {
        if (b === 'done') { t.done = true; t.doneAt = Date.now(); save(); }
        if (b === 'near') App.nav.listPanel('الأقرب: ' + cat.n, t.cat);
        if (b === 'go') App.nav.start(target);
        if (b === 'snooze') { t.at = Date.now() + 10 * 60000; t.notified = false; save(); }
        if (App.panels.current === 'tasks') App.panels.refresh();
      }
    });
    App.nav.say(why === 'near' ? 'أنت قريب من ' + cat.n + '. عندك مهمة: ' + t.t : 'تذكير: ' + t.t);
  }
  // while driving: a pending "pharmacy" task + a pharmacy within 300 m = a gentle nudge (once a day per task)
  var lastNear = 0, rr = 0;
  function nearCheck() {
    var f = App.loc.fix, day = today();
    if (!f || f.speed > 80 || Date.now() - lastNear < 120000) return;
    var c = pending().filter(function (t) { return t.cat && !t.place && t.nearDay !== day && App.nav.cat(t.cat); });
    if (!c.length) return;
    lastNear = Date.now();
    var t = c[rr++ % c.length];
    App.nav.nearby(t.cat, 1500).then(function (r) {
      if (!r.length || r[0].d > 300 || t.done || t.nearDay === day) return;
      t.nearDay = day;
      save();
      remind(t, 'near', r[0]);
    }).catch(function () { });
  }

  // ---------- errand plan: nearest place for each task, ordered by shortest next hop ----------
  TK.plan = [];
  function planErrands() {
    var jobs = pending().filter(function (t) { return t.place || (t.cat && App.nav.cat(t.cat)); });
    App.panels.push('خطة المشاوير', function (body) {
      if (!jobs.length) {
        body.innerHTML = '<div class="empty">أضف مهام فيها نوع مكان (صيدلية، بنزين، بقالة…) أو موقع محدد، وأرتّب لك أقصر جولة</div>';
        return;
      }
      body.innerHTML = '<div class="spinner"></div><div class="empty" id="plMsg">جارٍ البحث عن أقرب الأماكن…</div>';
      var found = [], i = 0;
      function nextJob() {
        if (!document.body.contains(body)) return;
        if (i >= jobs.length) { show(); return; }
        var t = jobs[i++];
        if (t.place) { found.push({ t: t, p: t.place }); nextJob(); return; }
        var cat = App.nav.cat(t.cat), msg = App.$('plMsg');
        if (msg) msg.textContent = 'أبحث عن أقرب ' + cat.n + '…';
        App.nav.nearby(t.cat).then(function (r) {
          if (r.length) found.push({ t: t, p: { lat: r[0].lat, lon: r[0].lon, name: r[0].name, sub: r[0].sub } });
        }).catch(function () { }).then(nextJob);
      }
      function show() {
        var cur = App.nav.here(), left = found.slice(), order = [], total = 0;
        while (left.length) {
          var bi = 0, bd = Infinity;
          left.forEach(function (x, k) { var d = App.geo.dist(cur.lat, cur.lon, x.p.lat, x.p.lon); if (d < bd) { bd = d; bi = k; } });
          var x = left.splice(bi, 1)[0];
          x.leg = bd; total += bd; order.push(x); cur = x.p;
        }
        TK.plan = order.map(function (o) { return { id: o.t.id, p: o.p }; });
        if (!order.length) { body.innerHTML = '<div class="empty">ما لقيت أماكن قريبة لمهامك — تحقق من الإنترنت</div>'; return; }
        body.innerHTML = '<div class="assist"><span class="av">' + App.icon('route') + '</span><div class="body"><h3>رتّبت لك ' + App.d(order.length) +
          (order.length === 1 ? ' مشوار' : ' مشاوير') + '</h3><p>أقصر ترتيب تقريبي من موقعك — المسافة الإجمالية نحو ' + App.fmtDist(total) +
          '. أوديك للأول، ولما توصل أسألك وأكمل بك للي بعده.</p></div></div>' +
          order.map(function (o, k) {
            return '<button class="row" data-k="' + k + '"><span class="stepn num">' + App.d(k + 1) + '</span><span class="txt"><b>' + App.esc(o.t.t) +
              '</b><small>' + App.esc(o.p.name || '') + '</small></span><span class="side num">+' + App.fmtDist(o.leg) + '</span></button>';
          }).join('') +
          '<div class="btn-row"><button class="btn primary" id="plGo">' + App.icon('route') + 'ابدأ بالمشوار الأول</button></div>';
        App.$('plGo').onclick = function () { App.panels.close(); App.nav.start(order[0].p); };
        body.querySelectorAll('[data-k]').forEach(function (b) {
          b.onclick = function () { App.nav.showPlace(order[+b.dataset.k].p); };
        });
      }
      nextJob();
    });
  }
  TK.planErrands = planErrands;
  App.on('navStop', function (e) {
    if (!e || !e.arrived || !e.dest || !TK.plan.length) return;
    var st = TK.plan[0];
    if (App.geo.dist(e.dest.lat, e.dest.lon, st.p.lat, st.p.lon) > 200) return;
    var t = find(st.id), nx = TK.plan[1], nt = nx ? find(nx.id) : null;
    App.reminder.show({
      kind: 'وصلت لمشوارك', icon: 'check', title: t ? t.t : (st.p.name || 'المشوار'),
      sub: nx ? 'التالي: ' + (nt ? nt.t : '') + ' — ' + (nx.p.name || '') : 'هذا آخر مشوار في الخطة 👍',
      buttons: nx ? [['next', 'تم — المشوار التالي', 'route'], ['done', 'تم ✓', 'check'], ['later', 'لاحقاً', 'close']] :
        [['done', 'تم ✓', 'check'], ['later', 'لاحقاً', 'close']],
      onButton: function (b) {
        if (b !== 'next' && b !== 'done') return;
        if (t) { t.done = true; t.doneAt = Date.now(); save(); }
        TK.plan.shift();
        if (b === 'next' && TK.plan.length) App.nav.start(TK.plan[0].p);
      }
    });
  });
  function check() {
    var now = Date.now(), day = today(), f = App.loc.fix, changed = false;
    TK.list.forEach(function (t) {
      if (t.rep && t.day !== day) {                  // daily routine: reopen and move the reminder to today
        t.day = day; t.done = false; t.notified = false; t.placeNotified = false; changed = true;
        if (t.at) { var a = new Date(t.at), n = new Date(); t.at = new Date(n.getFullYear(), n.getMonth(), n.getDate(), a.getHours(), a.getMinutes()).getTime(); }
      }
      if (t.done) return;
      if (t.at && t.at <= now && !t.notified) { t.notified = true; changed = true; remind(t, 'time'); }
      if (t.place && f && !t.placeNotified && App.geo.dist(f.lat, f.lon, t.place.lat, t.place.lon) < 400) {
        t.placeNotified = true; changed = true; remind(t, 'place');
      }
    });
    if (changed) save();
  }
  function badge() {
    var n = pending().filter(function (t) { return !t.at || t.at < Date.now() + 12 * 3600000; }).length + TK.maintDue().filter(function (x) { return x.s.st === 'due'; }).length;
    var b = App.$('taskBadge');
    if (!b) return;
    b.textContent = App.d(n);
    b.classList.toggle('hidden', !n);
  }

  // ---------- daily briefing card ----------
  function speakBriefing() {
    var b = TK.briefing();
    if (!App.Native.has) { App.toast('القراءة الصوتية تعمل على شاشة السيارة'); return; }
    App.Native.call('tts', '');
    setTimeout(function () { App.Native.call('tts', b.text); }, 600);
  }
  TK.showBriefing = function () {
    var b = TK.briefing(), el = App.$('briefing');
    el.innerHTML = '<h3>' + App.icon('sparkle') + App.esc(b.greet) + '</h3><ul>' + b.lines.map(function (l) {
      return '<li class="' + (l[2] || '') + '">' + App.icon(l[0]) + App.esc(l[1]) + '</li>';
    }).join('') + '</ul><div class="btn-row"><button class="btn primary" id="bfSpeak">' + App.icon('vol-up') + 'اقرأ لي</button>' +
      '<button class="btn" id="bfTasks">' + App.icon('tasks') + 'المهام</button><button class="btn" id="bfClose">' + App.icon('close') + 'إغلاق</button></div>';
    el.classList.remove('hidden');
    clearTimeout(el._h);
    el._h = setTimeout(function () { el.classList.add('hidden'); }, 25000);
    App.$('bfSpeak').onclick = function () { speakBriefing(); };
    App.$('bfTasks').onclick = function () { el.classList.add('hidden'); App.panels.open('tasks'); };
    App.$('bfClose').onclick = function () { el.classList.add('hidden'); };
  };

  TK.init = function () {
    badge();
    setInterval(function () { check(); badge(); nearCheck(); }, 15000);
    setTimeout(check, 3000);
    function daily() {
      var k = 'brief.' + today();
      if (!App.settings.briefing || App.store.get(k, false) || (App.settings.onboarded || 0) < 2) return;
      App.store.set(k, true);
      var occ = App.occasion();
      setTimeout(TK.showBriefing, occ && occ.today ? 9000 : 3000);
    }
    App.on('welcomeDone', function () { setTimeout(TK.showBriefing, 800); });
    daily();
  };
})();
