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
  function isTpms(a) { return /^\s*tpms\s*$/i.test(String(a.l)) || /(^|[.\s_-])tpms/i.test(a.p); }
  var TPMS_WORDS = /tpms|tyre|tire|ضغط|إطار|اطار|كفر/i;
  function tpmsIcons() {                // launcher icons (package + screen) that show the tyres, even inside a bigger app
    if (!App.Native.has) return [];
    App.system.apps();
    return (App.system.launchers || []).filter(function (a) { return a.c && TPMS_WORDS.test(String(a.l)); });
  }
  T.sensorApps = function () {
    if (!App.Native.has) return [];
    return App.system.apps().filter(function (a) { return TP.test(a.p) || TP.test(String(a.l)); });
  };
  T.openSensors = function (choose) {
    if (!App.Native.has) { App.toast('صفحة الحساسات تفتح من شاشة السيارة نفسها', 3200); return; }
    var icon = tpmsIcons()[0];
    if (icon && !choose && !App.settings.tpmsApp && App.Native.call('start', icon.p + '/' + icon.c) === '1') return;
    var s = App.settings.tpmsApp, list = T.sensorApps(), exact = list.filter(isTpms);
    if (!choose && exact.length === 1 && s !== exact[0].p) { s = App.settings.tpmsApp = exact[0].p; App.saveSettings(); }
    if (s && !choose && App.Native.call('launch', s) === '1') return;
    if (exact.length === 1) list = exact.concat(list.filter(function (a) { return !isTpms(a); }));
    if ((exact.length === 1 || list.length === 1) && !choose) { App.settings.tpmsApp = list[0].p; App.saveSettings(); App.system.launch(list[0].p, list[0].l); return; }
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

  // ---------- «فحص الحساس»: how does the screen's TPMS app get its numbers? (USB device, its components, settings keys) ----------
  function hex4(n) { n = (+n || 0).toString(16); return ('0000' + n).slice(-4); }
  // which apps to examine: the screen's «TPMS» first, then the chosen one, then anything about cars / tyres
  // the apps behind the car's data on this kind of unit (reglink/yunovo): CarFun shows TPMS, Car Setup talks to the car, AC
  var CAR_PKGS = ['com.reglink.services', 'com.reglink.apps.settings', 'com.reglink.vehicleinfo', 'com.reglink.apps.serviceui'];
  var NOT_CAR = /carplay|zlink|autokit|android\.auto|androidauto|aasink|projection|mirror|cleaning/i;
  // every installed package, the hidden and protected system ones too: the tyre program may have no icon at all
  var pkgCache = null;
  function packages() { if (!pkgCache) pkgCache = App.Native.json('pkgs') || []; return pkgCache; }
  function hiddenCar() {
    var rank = function (a) {
      var t = a.p + ' ' + (a.l || '');
      return TPMS_WORDS.test(t) ? 0 : /canbus|canbox|\bcan\b|\.can|can\.|mcu|obd|decod/i.test(t) ? 1 : /vehicle|carinfo|carservice|reglink|yunovo/i.test(t) ? 2 : 9;
    };
    return packages().filter(function (a) { return a.p && a.p !== 'com.carnav.camry' && rank(a) < 9 && !NOT_CAR.test(a.p + ' ' + (a.l || '')); })
      .sort(function (a, b) { return rank(a) - rank(b); }).map(function (a) { return { p: a.p, l: a.l || a.p }; });
  }
  function probeApps() {
    var all = App.system.apps(true), saved = App.settings.tpmsApp, out = [], seen = {};
    function add(a) { if (a && !seen[a.p] && out.length < 6 && !NOT_CAR.test(a.p + ' ' + a.l)) { seen[a.p] = 1; out.push(a); } }
    tpmsIcons().forEach(function (i) { add(all.filter(function (a) { return a.p === i.p; })[0] || { p: i.p, l: i.l }); });
    hiddenCar().filter(function (a) { return TPMS_WORDS.test(a.p + ' ' + a.l); }).forEach(add);
    if (saved) add(all.filter(function (a) { return a.p === saved; })[0] || { p: saved, l: saved });
    CAR_PKGS.forEach(function (p) { add(all.filter(function (a) { return a.p === p; })[0]); });
    all.filter(isTpms).forEach(add);
    all.filter(function (a) { return TP.test(a.p) || TP.test(String(a.l)); }).forEach(add);
    hiddenCar().forEach(add);
    all.filter(function (a) { return /car|vehicle/i.test(a.p + ' ' + a.l); }).forEach(add);
    return out;
  }
  // a precompiled system app keeps its code next to the APK: oat/<arch>/<name>.vdex|.odex
  function codeFiles(src) {
    var m = /^(.*)\/([^\/]+)\.apk$/.exec(src || '');
    if (!m) return [src];
    var out = [src];
    ['arm', 'arm64'].forEach(function (arch) { ['vdex', 'odex'].forEach(function (x) { out.push(m[1] + '/oat/' + arch + '/' + m[2] + '.' + x); }); });
    return out;
  }
  var CARWORDS = /tpms|tire|tyre|pressure|fuel|consum|oil|mileage|odometer|canbus|canbox|mcu|vehicle|carinfo|car_info|reglink|yunovo|serial|uart|tty|baud|protocol|decod/i;
  function sysx() {                     // system properties, binder services and /dev entries that may lead to the car's data
    var props = String(App.Native.call('props') || '').split('\n'), devs = String(App.Native.call('devs') || '').split('\n');
    return {
      props: props.filter(function (l) { return CARWORDS.test(l) || /^\[(persist|ro\.(product|board|hardware|vendor|build\.(display|version\.release|fingerprint)))/.test(l); }).slice(0, 400),
      services: String(App.Native.call('services') || '').split('\n').filter(Boolean).slice(0, 400),
      devs: devs.filter(function (l) { return /tty|can|mcu|spi|uart|serial|i2c|acm|hidraw|vehicle|car|gs\d/i.test(l); }).slice(0, 300)
    };
  }
  function pickForProbe() {
    App.panels.push('اختر تطبيق الحساسات', function (body) {
      var all = App.system.apps(true);
      body.innerHTML = '<div class="note">اختر التطبيق اللي يطلع فيه ضغط الكفرات (مثل TPMS). الفحص يبدأ فيه.</div>' +
        '<div class="search-input">' + App.icon('search') + '<input id="ppFilter" placeholder="ابحث…"></div>' +
        all.map(function (a) {
          return '<button class="row" data-p="' + App.esc(a.p) + '" data-l="' + App.esc(String(a.l).toLowerCase()) + '"><span data-icon="' + App.esc(a.p) + '" class="lead-ic"><span class="ph">' +
            App.esc(String(a.l).charAt(0)) + '</span></span><span class="txt"><b>' + App.esc(a.l) + '</b><small>' + App.esc(a.p) + '</small></span></button>';
        }).join('');
      body.querySelectorAll('[data-p]').forEach(function (b) {
        b.onclick = function () { App.settings.tpmsApp = b.dataset.p; App.saveSettings(); App.panels.back(); App.panels.refresh(); };
      });
      App.$('ppFilter').oninput = function () {
        var q = this.value.trim().toLowerCase();
        body.querySelectorAll('[data-p]').forEach(function (x) { x.style.display = !q || x.dataset.l.indexOf(q) >= 0 || x.dataset.p.indexOf(q) >= 0 ? '' : 'none'; });
      };
      App.system.lazyIcons(body);
    });
  }
  T.probe = function () {
    App.panels.push('فحص حساس الإطارات', function (body) {
      if (!App.Native.has) { body.innerHTML = '<div class="note">الفحص يشتغل على شاشة السيارة نفسها.</div>'; return; }
      var cands = probeApps();
      var res = cands.length ? cands.map(function (a) { return { a: a, r: App.Native.json('probe', a.p) || {} }; }) : [{ a: null, r: App.Native.json('probe', '') || {} }];
      var first = res[0].r, usb = first.usb || [], set = first.set || [];
      last = { probe: res.map(function (x) { return { l: x.a && x.a.l, p: x.a && x.a.p, r: x.r }; }), scan: null };
      function list(t, arr) { return arr && arr.length ? '<div class="pb-k">' + t + ' (' + arr.length + ')</div><div class="pb-v">' + arr.map(App.esc).join('<br>') + '</div>' : ''; }
      body.innerHTML = '<div class="big-status on">' + App.icon('tire') + '<div class="txt"><b>افتح صفحة ضغط الإطارات في الشاشة دقيقة، وارجع اضغط «إرسال الفحص بالنت»</b><small>' +
        'الفحص يبيّن من وين يجيب تطبيق الحساسات أرقامه عشان رحلة تقرأها مباشرة. ما فيه نت؟ صوّر الصفحة بدال الإرسال.</small></div></div>' +
        '<div class="pb-apps"><span>التطبيقات المفحوصة: <b>' + (cands.length ? cands.map(function (a) { return App.esc(a.l); }).join(' · ') : '—') + '</b></span>' +
        '<button class="chip" id="pbPick">' + App.icon('apps') + 'اختر تطبيق ثاني</button></div>' +
        '<div class="pb-send"><button class="btn primary" id="pbSend">' + App.icon('globe') + 'إرسال الفحص بالنت</button>' +
        '<span id="pbCode">يرفع النتيجة كنص على صفحة مؤقتة ويعطيك رمز قصير ترسله في المحادثة — بدون صور أو موقع</span></div>' +
        '<div id="pbDeep"></div>' +
        '<div class="sec-title">أجهزة USB الموصولة (' + App.d(usb.length) + ')</div><div class="pb" dir="ltr">' +
        (usb.length ? usb.map(function (d) {
          return '<div class="pb-row"><b>' + hex4(d.v) + ':' + hex4(d.p) + '</b> class ' + d.c + '/' + (d.ic == null ? '-' : d.ic) + ' · if ' + d.i +
            ' · ' + App.esc((d.m || '') + ' ' + (d.pr || '')) + ' <span class="pb-dim">' + App.esc(d.n || '') + '</span></div>';
        }).join('') : '<div class="pb-row pb-dim">none</div>') + '</div>' +
        res.map(function (x) {
          var k = x.r.pk; if (!x.a) return '';
          return '<div class="sec-title">' + App.esc(x.a.l) + '</div><div class="pb" dir="ltr">' + (k ?
            '<div class="pb-row"><b>' + App.esc(k.p) + '</b> v' + App.esc(k.ver || '?') + ' <span class="pb-dim">' + App.esc(k.src || '') + '</span></div>' +
            list('services', k.svc) + list('receivers', k.rcv) + list('providers', k.prv) +
            list('permissions', (k.perm || []).map(function (q) { return q.replace(/^android\.permission\./, ''); })) :
            '<div class="pb-row pb-dim">' + App.esc(x.a.p) + ' — no details</div>') + '</div>';
        }).join('') +
        '<div class="sec-title">إعدادات النظام عن الإطارات (' + App.d(set.length) + ')</div><div class="pb" dir="ltr">' +
        (set.length ? set.map(function (q) { return '<div class="pb-row">' + App.esc(q) + '</div>'; }).join('') : '<div class="pb-row pb-dim">none</div>') + '</div>';
      App.$('pbPick').onclick = pickForProbe;
      App.$('pbSend').onclick = sendReport;
      // deep check: what each app's own code mentions, and every broadcast those names carry while this page is open
      var srcs = res.filter(function (x) { return x.a && x.r.pk && x.r.pk.src; }).map(function (x) { return { l: x.a.l, src: x.r.pk.src }; });
      var files = [];
      srcs.forEach(function (x) { codeFiles(x.src).forEach(function (f) { files.push({ l: x.l, f: f }); }); });
      last.sysx = sysx();
      var box = App.$('pbDeep');
      if (!srcs.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="sec-title">الفحص المتقدم</div><div class="pb"><div class="pb-row pb-dim">جاري قراءة ' + srcs.map(function (x) { return App.esc(x.l); }).join(' و ') + '…</div></div>';
      var raw = [], k = 0;
      (function next() {
        if (k >= files.length) { deep(box, raw, srcs, files); return; }
        var f = files[k++], got = App.Native.json('dexscan', f.f) || [];
        f.n = got.length; raw = raw.concat(got);
        setTimeout(next, 30);
      })();
    });
  };
  var caught = [], last = null, savedAt = 0;
  // the strings that can lead to the car's data first: car words, then dotted names (actions, interfaces), then the rest
  function ranked(strs) {
    function rank(q) { return CARWORDS.test(q) ? 0 : /^[\w$]+(\.[\w$]+){2,}$/.test(q) ? 1 : 2; }
    return strs.map(function (q, i) { return [rank(q), i, q]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).map(function (x) { return x[2]; });
  }
  // upload the whole check as plain text (paste.rs, then dpaste.com) and show the short code to send in the chat
  function sendReport() {
    var out = App.$('pbCode'), btn = App.$('pbSend');
    if (!navigator.onLine) { out.textContent = 'ما فيه نت — شغّل نت الجوال على الشاشة وجرّب'; return; }
    btn.disabled = true;
    // kept small (one compact line of JSON, only what can lead to the car's data) so it goes up quickly on a phone's hotspot
    var all = packages(), carPkg = /reglink|yunovo|tpms|tire|tyre|can|mcu|car|vehicle|obd|serviceui|commonui|mediatek|mtk/i;
    var rep = { app: 'Rihla ' + App.VERSION, at: new Date().toISOString(), sys: App.Native.json('sys'),
      launchers: (App.system.launchers || []).map(function (a) { return a.p + '/' + (a.c || '?') + ' | ' + a.l; }),
      packages: { total: all.length, car: all.filter(function (a) { return carPkg.test(a.p + ' ' + (a.l || '')); }).slice(0, 200)
        .map(function (a) { return a.p + ' | ' + (a.l || '') + ' | ' + (a.f & 1 ? 'sys' : 'user') + (a.e === false ? ' off' : '') + ' | ' + (a.s || ''); }) },
      check: last && last.probe, caught: caught, system: last && last.sysx,
      scan: last && last.scan && { apps: last.scan.apps, files: last.scan.files, listen: last.scan.listen,
        strings: ranked((last.scan.strings || []).filter(function (q) { return CARWORDS.test(q) || /^[\w$]+(\.[\w$]+){2,}$/.test(q); })).slice(0, 3000) } };
    var text = JSON.stringify(rep);
    out.textContent = 'جاري الإرسال… (' + App.d(Math.ceil(text.length / 1024)) + ' KB)';
    function done(url) {
      btn.disabled = false;
      var code = String(url || '').trim().replace(/^https?:\/\//, '');
      if (!/^[\w.-]+\/\w+/.test(code)) { fail(); return; }
      out.innerHTML = 'أرسل هالرمز في المحادثة: <b class="pb-codev" dir="ltr">' + App.esc(code) + '</b>';
      App.store.set('lastReport', code);
    }
    function fail() { btn.disabled = false; out.textContent = 'تعذّر الإرسال — تأكد من النت وجرّب مرة ثانية'; }
    function post(url, opts) {
      var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 40000);
      opts.signal = c.signal;
      return fetch(url, opts).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.text(); });
    }
    function pasteRs(again) {                // paste.rs is the one the chat can open: try it twice before the other site
      return post('https://paste.rs/', { method: 'POST', body: text }).catch(function (e) {
        if (!again) throw e;
        return new Promise(function (r) { setTimeout(r, 5000); }).then(function () { return pasteRs(false); });
      });
    }
    pasteRs(true)
      .then(done)
      .catch(function () {
        return post('https://dpaste.com/api/v2/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'content=' + encodeURIComponent(text) + '&expiry_days=30' }).then(done);
      })
      .catch(fail);
  }
  function deep(box, raw, srcs, files) {
    var seen = {};
    var strs = raw.map(function (q) { return q.charCodeAt(0) === q.length - 1 ? q.slice(1) : q; }).filter(function (q) { return !seen[q] && (seen[q] = 1); });
    var tire = strs.filter(function (q) { return /tpms|tire|tyre|pressure/i.test(q); });
    var acts = strs.filter(function (q) {
      return (/^[A-Za-z_][\w$]*(\.[\w$]+){2,}$/.test(q) && !/^(java|javax|android|androidx|kotlin|kotlinx|dalvik|org|com\.google|com\.android)\./.test(q)) ||
        (/^[\w$]+(\.[\w$]+)+$/.test(q) && /tpms|tire|tyre/i.test(q));
    });
    var devs = strs.filter(function (q) { return /\/dev\//.test(q); });
    if (acts.length) App.store.set('carActs', acts.slice(0, 600));
    var n = acts.length ? App.Native.call('listen', JSON.stringify(acts.slice(0, 600))) : '0';
    if (last) last.scan = { apps: srcs, files: (files || []).filter(function (f) { return f.n; }).map(function (f) { return f.f + ' (' + f.n + ')'; }), listen: n, strings: strs };
    var sx = (last && last.sysx) || { props: [], services: [], devs: [] };
    function grid(t, arr, max) {
      return arr.length ? '<div class="pb-k">' + t + ' (' + arr.length + ')</div><div class="pb-grid">' + arr.slice(0, max).map(function (q) { return '<span>' + App.esc(q) + '</span>'; }).join('') + '</div>' : '';
    }
    box.innerHTML = '<div class="sec-title">البث الملتقط — أستمع لـ ' + App.esc(n) + ' نوع</div>' +
      '<div class="pb" dir="ltr" id="pbCaught"><div class="pb-row pb-dim">' + (caught.length ? '' : 'ما وصل شي للحين — افتح صفحة ضغط الإطارات دقيقة وارجع هنا') + '</div></div>' +
      '<div class="sec-title">داخل ' + srcs.map(function (x) { return App.esc(x.l); }).join(' و ') + ' (' + App.d(strs.length) + ')</div><div class="pb" dir="ltr">' +
      (strs.length ? grid('tyres', tire, 90) + grid('actions', acts, 70) + grid('devices', devs, 20) : '<div class="pb-row pb-dim">unreadable</div>') + '</div>' +
      '<div class="sec-title">النظام — خدمات ' + App.d(sx.services.length) + ' · خصائص ' + App.d(sx.props.length) + ' · منافذ ' + App.d(sx.devs.length) + '</div>' +
      '<div class="pb" dir="ltr">' + grid('services', sx.services.filter(function (l) { return CARWORDS.test(l); }), 40) +
      grid('properties', sx.props.filter(function (l) { return CARWORDS.test(l); }), 40) + grid('ports', sx.devs, 30) + '</div>';
    paintCaught();
  }
  function paintCaught() {
    var el = App.$('pbCaught'); if (!el || !caught.length) return;
    el.innerHTML = caught.map(function (o) {
      return '<div class="pb-row"><b>' + App.esc(o.a || '?') + '</b> ' + App.esc(JSON.stringify(o.x || {})).slice(0, 600) + (o.err ? ' <span class="pb-dim">' + App.esc(o.err) + '</span>' : '') + '</div>';
    }).join('');
  }
  window.onBcast = function (o) {
    if (!o) return;
    caught = caught.filter(function (c) { return c.a !== o.a; });
    caught.unshift(o); if (caught.length > 12) caught.pop();
    if (Date.now() - savedAt > 5000) { savedAt = Date.now(); try { App.store.set('bcast', caught); } catch (e) { /* storage full or unavailable */ } }
    paintCaught();
    if (App.cdata) App.cdata.ingest(o);
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
        '<div class="btn-row"><button class="btn ty-app" id="tyApp">' + App.icon('car') + 'صفحة الحساسات' + (App.settings.tpmsApp ? '<small>' + App.esc(App.system.label(App.settings.tpmsApp)) + '</small>' : '') + '</button>' +
        (App.Native.has ? '<button class="btn" id="tyProbe2">' + App.icon('search') + 'فحص الحساس</button>' : '') + '</div>' +
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
      if (App.$('tyProbe2')) App.$('tyProbe2').onclick = T.probe;
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
        '<div class="set-row"><div class="txt"><b>فحص الحساس</b><small>لو تطبيق الحساسات في الشاشة يعرض الضغط: صوّر نتيجة الفحص وأرسلها عشان رحلة تقرأه مباشرة</small></div>' +
          '<button class="btn" id="tyProbe">' + App.icon('search') + 'فحص</button></div>' +
        '<div class="set-row"><div class="txt"><b>سجل القراءات</b><small>' + App.d(data().log.length) + ' قراءة محفوظة في الشاشة</small></div>' +
          '<button class="btn" id="tyClear">' + App.icon('trash') + 'مسح</button></div>';
      body.querySelectorAll('#tyUnit [data-v]').forEach(function (b) {
        b.onclick = function () { s.tireUnit = b.dataset.v; App.saveSettings(); App.panels.refresh(); bar(); };
      });
      body.querySelectorAll('.ty-step.big [data-d]').forEach(function (b) {
        b.onclick = function () { s.tireRec = Math.max(20, Math.min(60, T.rec() + (+b.dataset.d))); App.saveSettings(); App.$('tyRecV').textContent = T.num(T.rec()); bar(); };
      });
      App.$('tyPick').onclick = function () { T.openSensors(true); };
      App.$('tyProbe').onclick = T.probe;
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
    App.on('panel', function (n) {
      if (n !== 'tires') edit = null;
      if (!n && App.Native.has) { if (App.cdata) App.cdata.listen(); }
    });
    caught = App.store.get('bcast', []) || [];
    setInterval(bar, 3600e3);
  };
})();
