/* stories.js — «القصص»: the offline library of the prophets' and companions' stories, and «اسأل رحلة».
   Audio: «رحلة» ships no recordings. The owner copies the lectures he already has (or downloaded inside YouTube
   Premium and exported) to a USB stick or to a folder called «قصص» on the unit's storage; this file scans them,
   groups them by prophet / companion, plays them with the screen off, resumes where he stopped, goes on to the next
   episode, and has a sleep timer. Without any file the same cards open the offline encyclopedia (App.kb).
   «اسأل رحلة» is a small offline question matcher over that encyclopedia, read aloud by the unit's TTS — it is not
   a generative model and says so. Written for «رحلة» by أبو دانة للبرمجة. */
(function () {
  'use strict';
  var S = App.stories = {};
  var $ = App.$, esc = App.esc, KB = App.kb || { prophets: [], companions: [], faq: [] };
  var audio = null, owns = false, cur = null, lib = null, scanning = false, sleepAt = 0, sleepT = null, lastSave = 0, lastTick = 0;
  var AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|wma|amr|3gp|mka)$/i;
  var ROOTS = ['/storage/emulated/0/قصص', '/storage/emulated/0/القصص', '/storage/emulated/0/Stories', '/storage/emulated/0/Rihla', '/sdcard/قصص'];
  var SKIP = /^(\.|android$|lost\.dir$|system volume information$|\$)/i;
  var YT = 'https://www.youtube.com/results?search_query=';

  // ---------- Arabic matching helpers ----------
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^a-z0-9ء-ي ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toks(s) { var n = norm(s); return n ? n.split(' ') : []; }
  function bare(t) { return t.length > 4 && t.indexOf('ال') === 0 ? t.slice(2) : t; }
  function variants(t) {      // a word and the forms it may hide in: وسليمان / لسليمان / بسليمان, الحوت → حوت
    var v = [t], b = bare(t);
    if (b !== t) v.push(b);
    if (t.length > 3 && 'ولبفك'.indexOf(t.charAt(0)) >= 0) { v.push(t.slice(1)); v.push(bare(t.slice(1))); }
    return v;
  }
  var CTX = { 'علي': 1, 'اسماء': 1, 'صالح': 1, 'انس': 1, 'سعد': 1, 'عمر': 1 };      // short words that are also ordinary words: need a cue before them
  var CUE = ['قصه', 'هو', 'عن', 'مين', 'سيره', 'حياه', 'نبي', 'النبي', 'سيدنا', 'صحابي', 'الصحابي', 'بن', 'اخبار', 'قصص', 'حكايه', 'لقب', 'مات', 'وفاه'];
  var ENT = null;
  function entities() {
    if (ENT) return ENT;
    ENT = [];
    [['p', KB.prophets], ['c', KB.companions]].forEach(function (g) {
      (g[1] || []).forEach(function (e) {
        e._k = g[0];
        e._al = (e.a || []).map(function (a) { return toks(a).map(bare); }).filter(function (a) { return a.length; });
        e._nm = toks(e.n).slice(0, 3).map(bare);
        ENT.push(e);
      });
    });
    return ENT;
  }
  function find(text) {       // the best prophet / companion named in a piece of text (a question or a file name)
    var q = toks(text).map(variants), best = null, bs = 0;
    entities().forEach(function (e) {
      e._al.forEach(function (al) {
        for (var i = 0; i + al.length <= q.length; i++) {
          var ok = true;
          for (var k = 0; k < al.length && ok; k++) ok = q[i + k].indexOf(al[k]) >= 0;
          if (!ok) continue;
          if (al.length === 1 && CTX[al[0]]) {
            var cues = al[0] === 'اسماء' ? ['قصه', 'مين', 'عن', 'سيره', 'حياه', 'اخبار'] : CUE;
            if (!(i && q[i - 1].some(function (v) { return cues.indexOf(v) >= 0; }))) continue;
          }
          var sc = al.length * 10 + al.join('').length;
          if (sc > bs) { bs = sc; best = e; }
        }
      });
    });
    return best;
  }
  function kwHit(tokens, kw) {    // does any word of the question carry this keyword
    return kw.some(function (k) {
      k = bare(norm(k));
      return tokens.some(function (t) { return t === k || (t.length >= 4 && k.length >= 4 && (t.indexOf(k) === 0 || k.indexOf(t) === 0)); });
    });
  }
  S.answer = function (q) {
    var tk = toks(q).map(bare), e = find(q), best = null, sc = 0;
    if (!e && /(^| )(النبي|نبينا)( |$)/.test(norm(q)) && !/(الذي|اللي|اي نبي|ايش نبي)/.test(norm(q))) e = KB.prophets.filter(function (x) { return x.id === 'muhammad'; })[0] || null;
    if (e) {
      (e.f || []).forEach(function (f) {
        var n = 0;
        (Array.isArray(f[0]) ? f[0] : [f[0]]).forEach(function (k) { if (kwHit(tk, [k])) n++; });
        if (n > sc) { sc = n; best = f; }
      });
      if (best) return { e: e, t: e.n + ': ' + best[1] + '.' };
      return { e: e, t: e.n + ' — ' + e.t + '. ' + e.s };
    }
    var fa = null;
    (KB.faq || []).forEach(function (f) {
      if (fa) return;
      if (f[0].every(function (g) { return kwHit(tk, g); })) fa = f;
    });
    if (fa) return { t: fa[1] };
    // no name in the question: the best fact among all of them (a distinctive word like «الحوت» or «الناقة» is enough)
    var GENERIC = ['ابن', 'ام', 'اب', 'قوم', 'قومه', 'سنه', 'سنين', 'وفاه', 'توفي', 'زوجه', 'لقب', 'كتاب', 'الكتاب', 'نبي', 'عمر', 'ارسل', 'اول', 'اسم', 'مات', 'ولد', 'علم', 'فتح', 'مكان', 'وين', 'اين', 'صفه', 'ذكر', 'سوره', 'قتل', 'الله'];
    var bf = null, bs = 0, be = null;
    entities().forEach(function (en) {
      (en.f || []).forEach(function (f) {
        var n = 0;
        (Array.isArray(f[0]) ? f[0] : [f[0]]).forEach(function (k) { if (GENERIC.indexOf(norm(k)) < 0 && kwHit(tk, [k])) n++; });
        if (n > bs) { bs = n; bf = f; be = en; }
      });
    });
    if (bf && bs >= 1) return { e: be, t: be.n + ': ' + bf[1] + '.' };
    return null;
  };

  // ---------- the library: scan folders through the native `ls` ----------
  function ls(path) { return App.Native.has ? App.Native.json('ls', path) : null; }
  function natural(a, b) { return a.n.localeCompare(b.n, 'ar', { numeric: true, sensitivity: 'base' }); }
  function roots() {
    var r = (App.settings.storyDirs || []).map(function (p) { return [p, true]; }), vols = ls('/storage') || [];
    ROOTS.forEach(function (p) { r.push([p, true]); });             // dedicated folders: every audio file is a story
    vols.forEach(function (v) {
      if (v.d && v.n !== 'emulated' && v.n !== 'self') r.push(['/storage/' + v.n, false]);   // a USB stick / SD card: only files that name a prophet or companion
    });
    return r;
  }
  function walk(dir, depth, out, budget, all) {
    if (budget.n <= 0) return;
    var items = ls(dir);
    if (!items) return;
    budget.n--;
    items.forEach(function (it) {
      if (SKIP.test(it.n)) return;
      if (it.d) { if (depth < 3) walk(dir + '/' + it.n, depth + 1, out, budget, all); }
      else if (AUDIO.test(it.n) && out.length < 1500 && (all || find(dir.split('/').pop() + ' ' + it.n))) out.push({ p: dir + '/' + it.n, n: it.n.replace(AUDIO, ''), f: dir.split('/').pop(), s: it.s || 0 });
    });
  }
  S.scan = function (done) {
    if (!App.Native.has || scanning) { if (done) done(); return; }
    scanning = true;
    setTimeout(function () {                       // let the "scanning" state paint first
      var files = [], seen = {}, budget = { n: 220 };
      try { roots().forEach(function (r) { walk(r[0], 0, files, budget, r[1]); }); } catch (e) { /* keep what we have */ }
      files = files.filter(function (f) { if (seen[f.p]) return false; seen[f.p] = 1; return true; });
      var groups = {}, order = [];
      files.forEach(function (f) {
        var e = find(f.f + ' ' + f.n) || find(f.n), key = e ? e.id : 'o:' + f.f, g = groups[key];
        if (!g) { g = groups[key] = { id: key, e: e, name: e ? e.n : (f.f || 'مقاطع'), tracks: [] }; order.push(key); }
        g.tracks.push(f);
      });
      order.forEach(function (k) { groups[k].tracks.sort(natural); });
      lib = { groups: groups, order: order, count: files.length, at: Date.now() };
      scanning = false;
      App.emit('stories');
      if (done) done();
    }, 60);
  };
  S.dirText = function () {
    if (!App.Native.has) return 'تعمل من الجهاز نفسه فقط';
    if (!lib) return 'افتح المكتبة وتنفحص تلقائياً';
    return lib.count ? App.d(lib.count) + ' مقطع في ' + App.d(lib.order.length) + ' مجموعة' : 'ما لقيت مقاطع — حطها في فلاش أو مجلد «قصص»';
  };
  function perm() { return App.Native.has ? App.Native.call('perm', '') === '1' : true; }

  // ---------- the player (one <audio> element, kept alive in the background) ----------
  function save(force) {
    if (!cur || !audio) return;
    var t = Date.now();
    if (!force && t - lastSave < 4000) return;
    lastSave = t;
    App.store.set('st.pos', { g: cur.gid, i: cur.i, p: cur.t.p, n: cur.t.n, gn: cur.gn, t: Math.floor(audio.currentTime || 0), d: Math.floor(audio.duration || 0), q: cur.q.map(function (x) { return [x.p, x.n]; }) });
  }
  function src(p) { return 'file://' + p.split('/').map(encodeURIComponent).join('/'); }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60), h = Math.floor(m / 60); m %= 60; s %= 60;
    return App.d((h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s); }
  function load(q, i, gid, gn, at, play) {
    if (!audio) return;
    if (App.radio && App.radio.cur) App.radio.stop();
    cur = { q: q, i: i, t: q[i], gid: gid, gn: gn };
    audio.src = src(q[i].p);
    audio.playbackRate = +App.settings.storySpeed || 1;
    var seek = function () { try { if (at > 1) audio.currentTime = at; } catch (e) { /* not seekable yet */ } audio.removeEventListener('loadedmetadata', seek); };
    if (at > 1) audio.addEventListener('loadedmetadata', seek);
    owns = true;
    if (play) audio.play().catch(function () { });
    save(true);
    ui();
  }
  S.play = function (gid, i) {
    var g = lib && lib.groups[gid];
    if (!g) return;
    load(g.tracks, i || 0, gid, g.name, 0, true);
  };
  S.resume = function () {
    var p = App.store.get('st.pos', null);
    if (!p) return;
    if (!cur) {
      var q = (p.q || []).map(function (x) { return { p: x[0], n: x[1] }; });
      if (!q.length) q = [{ p: p.p, n: p.n }];
      load(q, Math.min(p.i || 0, q.length - 1), p.g, p.gn, p.t || 0, true);
    } else { owns = true; audio.play().catch(function () { }); ui(); }
  };
  S.toggle = function () {
    if (!cur) { S.resume(); return; }
    if (audio.paused) { owns = true; audio.play().catch(function () { }); } else audio.pause();
  };
  S.seek = function (d) { if (audio && cur) { try { audio.currentTime = Math.max(0, Math.min((audio.duration || 1e9) - 1, audio.currentTime + d)); } catch (e) { /* ignore */ } save(true); } };
  S.step = function (d) { if (cur && cur.q[cur.i + d]) load(cur.q, cur.i + d, cur.gid, cur.gn, 0, true); };
  S.pause = function (yield_) {                    // the radio starts: stories step aside and give the dashboard card back
    if (audio && !audio.paused) audio.pause();
    if (yield_) { owns = false; save(true); App.radio && App.radio.ui && App.radio.ui(); ui(); }
  };
  S.stop = function () { if (audio) { audio.pause(); audio.removeAttribute('src'); } save(true); cur = null; owns = false; App.radio && App.radio.ui && App.radio.ui(); ui(); };
  S.ownsCard = function () { return !!(owns && cur); };
  S.resumeInfo = function () {
    var p = App.store.get('st.pos', null);
    if (!p || !p.n || (cur && !audio.paused)) return null;
    return { title: p.n, sub: (p.gn || 'القصص') + (p.t ? ' — وقفت عند ' + fmt(p.t) : ''), go: function () { S.resume(); } };
  };
  S.speed = function () {
    var sp = [1, 1.25, 1.5, 0.85], c = sp.indexOf(+App.settings.storySpeed || 1);
    App.settings.storySpeed = sp[(c + 1) % sp.length]; App.saveSettings();
    if (audio) audio.playbackRate = App.settings.storySpeed;
    ui();
  };
  S.sleep = function (min) {
    clearTimeout(sleepT); sleepAt = 0;
    App.settings.sleepMin = min || 0; App.saveSettings();
    if (min) {
      sleepAt = Date.now() + min * 60000;
      sleepT = setTimeout(function () { sleepAt = 0; if (audio && !audio.paused) { audio.pause(); App.toast('انتهى المؤقّت — تصبح على خير'); } ui(); }, min * 60000);
      App.toast('يتوقف بعد ' + App.d(min) + ' دقيقة');
    } else App.toast('أُلغي المؤقّت');
    ui();
  };

  // ---------- the dashboard card ----------
  function setHtml(id, html) { var el = $(id); if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }
  S.card = function () {
    var mc = $('mediaCard');
    if (!mc || !cur) return;
    var playing = audio && !audio.paused;
    setHtml('mcHead', 'القصص');
    setHtml('mcName', esc(cur.t.n));
    setHtml('mcSub', (playing ? '<span class="eq"><i></i><i></i><i></i></span>' : '') + esc(cur.gn) + (cur.q.length > 1 ? ' — ' + App.d(cur.i + 1) + ' من ' + App.d(cur.q.length) : ''));
    var tg = $('mcTag'); tg.textContent = 'بدون نت'; tg.className = 'w-tag ok';
    setHtml('mcGo', App.icon('stories') + '<span>المكتبة</span>');
    setHtml('mcPlay', App.icon(playing ? 'pause' : 'play'));
    var pr = $('mcProg'); pr.classList.remove('hidden');
    $('mcProgBar').style.width = (audio.duration ? Math.min(100, audio.currentTime / audio.duration * 100) : 0) + '%';
    mc.classList.toggle('live', playing);
  };
  S.cardGo = function () { App.panels.open('stories'); };
  function ui() {
    if (owns && cur) S.card();
    else if (App.radio && App.radio.ui && !owns) App.radio.ui();
    if (App.panels.current === 'stories' && !App.panels.stack.length) miniUi();
    App.emit('stories');
  }

  // ---------- the panel ----------
  var tab = 'p';
  function mini() {
    if (!cur) return '';
    var playing = audio && !audio.paused, pct = audio.duration ? Math.min(100, audio.currentTime / audio.duration * 100) : 0;
    var left = sleepAt ? Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000)) : 0;
    return '<div class="st-now' + (playing ? ' on' : '') + '" id="stNow"><div class="st-now-t"><b>' + esc(cur.t.n) + '</b><small>' + esc(cur.gn) +
      (cur.q.length > 1 ? ' — الحلقة ' + App.d(cur.i + 1) + ' من ' + App.d(cur.q.length) : '') + '</small></div>' +
      '<div class="st-bar" id="stBar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="st-time"><span id="stCur">' + fmt(audio.currentTime) + '</span><span>' + (audio.duration ? fmt(audio.duration) : '') + '</span></div>' +
      '<div class="st-ctl"><button class="round" id="stPrev" aria-label="السابقة">' + App.icon('prev') + '</button><button class="round" id="stB30" aria-label="رجوع ٣٠ ثانية">' + App.icon('rew') + '</button>' +
      '<button class="round big" id="stPlay" aria-label="تشغيل">' + App.icon(playing ? 'pause' : 'play') + '</button>' +
      '<button class="round" id="stF30" aria-label="تقديم ٣٠ ثانية">' + App.icon('fwd') + '</button><button class="round" id="stNext" aria-label="التالية">' + App.icon('next') + '</button></div>' +
      '<div class="st-opt"><button class="chip" id="stSpd">' + App.d(App.settings.storySpeed || 1) + '×</button>' +
      '<button class="chip' + (sleepAt ? ' on' : '') + '" id="stSlp">' + App.icon('timer') + (sleepAt ? App.d(left) + ' د' : 'مؤقّت النوم') + '</button>' +
      '<button class="chip" id="stYt">' + App.icon('play') + 'على يوتيوب</button></div></div>';
  }
  function bindMini(body) {
    var g = function (id) { return body.querySelector('#' + id); };
    if (!g('stNow')) return;
    g('stPlay').onclick = S.toggle; g('stB30').onclick = function () { S.seek(-30); }; g('stF30').onclick = function () { S.seek(30); };
    g('stPrev').onclick = function () { if (audio.currentTime > 5) { audio.currentTime = 0; } else S.step(-1); }; g('stNext').onclick = function () { S.step(1); };
    g('stSpd').onclick = S.speed;
    g('stSlp').onclick = function () {
      var opts = [15, 30, 45, 60, 0];
      var now = App.settings.sleepMin || 0, nx = opts[(opts.indexOf(now) + 1) % opts.length];
      S.sleep(sleepAt || !now ? nx : 15);
    };
    g('stYt').onclick = function () { S.youtube(cur.gn || cur.t.n); };
    g('stBar').onclick = function (ev) {
      var r = this.getBoundingClientRect(), f = (ev.clientX - r.left) / r.width;
      if (document.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl') f = 1 - f;
      if (audio.duration) { audio.currentTime = Math.max(0, Math.min(1, f)) * audio.duration; save(true); }
    };
  }
  function miniUi() {
    var box = $('stNow');
    if (!box || !cur) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = mini();
    box.parentNode.replaceChild(wrap.firstChild, box);
    bindMini($('sheetBody'));
  }
  S.youtube = function (name) {
    var q = 'قصة ' + name.replace(/ ?(عليه|عليها|رضي).*$/, '') + ' بدر المشاري';
    if (!App.Native.has || App.Native.call('view', YT + encodeURIComponent(q)) !== '1') App.toast('يفتح فقط من داخل الشاشة');
  };

  function card(e, g) {
    var has = g && g.tracks.length;
    return '<button class="st-card' + (has ? ' has' : '') + (e._k === 'c' ? ' c' : '') + '" data-e="' + e.id + '"><span class="st-n">' + esc(e.n.replace(/ (عليه|عليهما|رضي).*$/, '')) + '</span>' +
      '<small>' + esc(e.t) + '</small>' + (has ? '<em>' + App.icon('play') + App.d(g.tracks.length) + '</em>' : '') + '</button>';
  }
  function render(body) {
    var list = tab === 'c' ? KB.companions : tab === 'p' ? KB.prophets : [];
    var others = lib ? lib.order.filter(function (k) { return !lib.groups[k].e; }) : [];
    body.innerHTML =
      '<div id="stTop">' + mini() + '</div>' +
      '<div class="st-acts"><button class="btn primary" id="stAsk">' + App.icon('ask') + 'اسأل رحلة</button><button class="btn" id="stQuiz">' + App.icon('quiz') + 'مسابقة البنات</button>' +
      '<button class="btn" id="stScan">' + App.icon('usb') + 'تحديث المكتبة</button></div>' +
      '<div class="seg st-seg"><button data-t="p" class="' + (tab === 'p' ? 'on' : '') + '">الأنبياء</button><button data-t="c" class="' + (tab === 'c' ? 'on' : '') + '">الصحابة</button>' +
      '<button data-t="o" class="' + (tab === 'o' ? 'on' : '') + '">مقاطعي' + (others.length ? ' ' + App.d(others.length) : '') + '</button></div>' +
      '<div id="stNote"></div><div class="st-grid" id="stGrid">' +
      (tab === 'o' ? others.map(function (k) { var g = lib.groups[k]; return '<button class="st-card has" data-o="' + esc(k) + '"><span class="st-n">' + esc(g.name) + '</span><small>مجلد</small><em>' + App.icon('play') + App.d(g.tracks.length) + '</em></button>'; }).join('') :
        list.map(function (e) { return card(e, lib && lib.groups[e.id]); }).join('')) + '</div>';
    bindMini(body);
    var note = body.querySelector('#stNote');
    if (!App.Native.has) note.innerHTML = '<div class="note">' + App.icon('shield') + ' المقاطع الصوتية تُقرأ من الشاشة نفسها — الموسوعة والمسابقة تعمل في كل مكان.</div>';
    else if (!perm()) note.innerHTML = '<div class="note st-warn">' + App.icon('usb') + ' عشان أقرا المقاطع من الفلاش والذاكرة أحتاج إذن الوصول للملفات.<button class="btn primary" id="stPerm">اسمح</button></div>';
    else if (scanning) note.innerHTML = '<div class="note">' + App.icon('usb') + ' أفحص الفلاش والذاكرة…</div>';
    else if (lib && !lib.count) note.innerHTML = '<div class="note">' + App.icon('usb') + ' ما لقيت مقاطع صوتية. انسخ قصصك (mp3 أو m4a) إلى فلاش أو إلى مجلد اسمه «قصص» في ذاكرة الشاشة، وسمّ كل ملف أو مجلد باسم النبي أو الصحابي، ثم اضغط «تحديث المكتبة». ومن بطاقة أي نبي تقدر تفتح قصصه على يوتيوب.</div>';
    else if (lib) note.innerHTML = '<div class="note">' + App.icon('usb') + ' ' + esc(S.dirText()) + '. اضغط أي بطاقة: القصة مكتوبة ومسموعة ومعها الحلقات إن وجدت.</div>';
    var go = function (fn) { return function () { fn.apply(this, arguments); }; };
    body.querySelector('#stAsk').onclick = function () { S.openAsk(); };
    body.querySelector('#stQuiz').onclick = function () { S.quiz(); };
    body.querySelector('#stScan').onclick = function () { S.scan(function () { if (App.panels.current === 'stories' && !App.panels.stack.length) App.panels.refresh(); }); App.panels.refresh(); };
    var pb = body.querySelector('#stPerm');
    if (pb) pb.onclick = function () {
      App.Native.call('perm', 'ask');
      var n = 0, t = setInterval(function () { n++; if (perm() || n > 24) { clearInterval(t); if (perm()) S.scan(function () { if (App.panels.current === 'stories') App.panels.refresh(); }); } }, 1500);
    };
    body.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; App.panels.refresh(); }; });
    body.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = go(function () { S.entity(b.dataset.e); }); });
    body.querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { folder(b.dataset.o); }; });
  }
  function folder(k) {
    var g = lib && lib.groups[k];
    if (!g) return;
    App.panels.push(g.name, function (body) { episodes(body, g); });
  }
  function episodes(body, g) {
    var pos = App.store.get('st.pos', null);
    body.innerHTML += '<div class="st-eps">' + g.tracks.map(function (t, i) {
      var on = cur && cur.t.p === t.p;
      return '<button class="st-ep' + (on ? ' on' : '') + '" data-i="' + i + '"><span class="st-ep-i">' + App.d(i + 1) + '</span><span class="st-ep-n">' + esc(t.n) + '</span>' +
        (on ? App.icon('play') : (pos && pos.p === t.p && pos.t ? '<small>' + fmt(pos.t) + '</small>' : '')) + '</button>';
    }).join('') + '</div>';
    body.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { S.play(g.id, +b.dataset.i); App.panels.close(); }; });
  }
  var speaking = false;
  function speak(text) {
    if (!App.Native.has && !App.voice.enabled()) { App.toast('القراءة بالصوت تعمل من الشاشة نفسها'); return; }
    if (audio && !audio.paused) audio.pause();
    App.voice.speak(text);
  }
  S.entity = function (id) {
    var e = entities().filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    var g = lib && lib.groups[id];
    App.panels.push(e.n, function (body) {
      body.innerHTML = '<div class="st-ent"><div class="st-ent-h"><b>' + esc(e.n) + '</b><small>' + esc(e.t) + '</small></div>' +
        '<p class="st-sum">' + esc(e.s) + '</p>' +
        '<div class="st-acts"><button class="btn primary" id="enSay">' + App.icon('speak') + 'اقرأها لي</button><button class="btn" id="enAsk">' + App.icon('ask') + 'اسأل عنه</button>' +
        '<button class="btn" id="enYt">' + App.icon('play') + 'اسمعها على يوتيوب</button></div>' +
        (e.f && e.f.length ? '<div class="sec-title">من أخباره</div><ul class="st-facts">' + e.f.map(function (f) { return '<li>' + esc(f[1]) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="note">' + App.icon('shield') + ' هذا ملخص مكتوب من القرآن والسيرة، وليس بصوت بدر المشاري. قصصه بصوته تضيفها إلى الفلاش أو تسمعها من يوتيوب.</div>' +
        (g ? '<div class="sec-title">حلقاتك (' + App.d(g.tracks.length) + ')</div>' : '') + '</div>';
      body.querySelector('#enSay').onclick = function () { speak(e.n + '. ' + e.s); };
      body.querySelector('#enAsk').onclick = function () { S.openAsk(e.n.replace(/ (عليه|عليهما|رضي).*$/, '')); };
      body.querySelector('#enYt').onclick = function () { S.youtube(e.n); };
      if (g) episodes(body, g);
    });
  };

  // ---------- «اسأل رحلة» ----------
  var CHIPS = ['وش قصة نوح؟', 'مين أول مؤذن في الإسلام؟', 'كم عدد الأنبياء؟', 'مين العشرة المبشرين بالجنة؟', 'وش لقب عمر بن الخطاب؟', 'ليش سُمّي عثمان ذو النورين؟', 'قصة يونس والحوت'];
  S.openAsk = function (prefill) {
    App.panels.push('اسأل رحلة', function (body) {
      body.innerHTML = '<div class="st-chat" id="askLog"><div class="st-msg bot">اسألني عن أي نبي أو صحابي بالاسم، مثل: «وش قصة موسى؟» أو «مين أول من آمن؟». أجاوب من موسوعة محفوظة في الشاشة بدون نت، وما أخترع — وإذا ما أعرف أقولك.</div></div>' +
        '<div class="st-askbar"><input id="askIn" class="txt-in" placeholder="اكتب سؤالك" autocomplete="off"><button class="btn primary" id="askGo">' + App.icon('ask') + 'اسأل</button></div>' +
        '<div class="st-chips">' + CHIPS.map(function (c) { return '<button class="chip" data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
      var log = body.querySelector('#askLog'), inp = body.querySelector('#askIn');
      function ask(q) {
        q = (q || inp.value).trim();
        if (!q) return;
        inp.value = '';
        var a = S.answer(q), m = document.createElement('div');
        log.insertAdjacentHTML('beforeend', '<div class="st-msg me">' + esc(q) + '</div>');
        if (a) {
          m.className = 'st-msg bot';
          m.innerHTML = esc(a.t) + '<div class="st-msg-b"><button class="chip" data-s="1">' + App.icon('speak') + 'اقرأها</button>' + (a.e ? '<button class="chip" data-e="' + a.e.id + '">القصة كاملة</button>' : '') + '</div>';
          m.querySelector('[data-s]').onclick = function () { speak(a.t); };
          var ee = m.querySelector('[data-e]'); if (ee) ee.onclick = function () { S.entity(a.e.id); };
          if (App.settings.voice !== false) speak(a.t);
        } else {
          m.className = 'st-msg bot miss';
          m.textContent = 'ما لقيت جواب عندي. أنا موسوعة صغيرة عن ٢٥ نبي والصحابة الكبار — جرّب تذكر الاسم، مثل: «وش قصة يوسف؟».';
        }
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
        body.scrollTop = body.scrollHeight;
      }
      body.querySelector('#askGo').onclick = function () { ask(); };
      inp.onkeydown = function (ev) { if (ev.key === 'Enter') ask(); };
      body.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { ask(b.dataset.q); }; });
      if (prefill) ask('وش قصة ' + prefill + '؟');
    });
  };

  // ---------- مسابقة البنات — بدون حد: تستمر لين تضغط «إنهاء»، وتعيد الخلط لما تخلص الأسئلة ----------
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  S.quiz = function () {
    var pool = [];
    entities().forEach(function (e) { (e.q || []).forEach(function (q) { pool.push(q); }); });
    var order = shuffle(pool), at = 0, asked = 0, score = 0, streak = 0, best = 0, say = App.settings.voice !== false && (App.Native.has || App.voice.enabled());
    function nextQ() {
      if (at >= order.length) { var last = order[order.length - 1]; order = shuffle(pool); if (order.length > 1 && order[0] === last) order.push(order.shift()); at = 0; }
      return order[at++];
    }
    App.panels.push('مسابقة البنات', function (body) {
      function finish() {
        App.voice.stop();
        var pct = asked ? score / asked : 0, msg = !asked ? 'ما جاوبتوا على شي' : pct >= .8 ? 'ممتازات! ' : pct >= .5 ? 'أحسنتم! ' : 'حاولوا مرة ثانية. ';
        body.innerHTML = '<div class="st-quiz done"><div class="st-score">' + App.d(score) + ' / ' + App.d(asked) + '</div><p>' + msg + 'جزاكم الله خيراً</p>' +
          (best > 1 ? '<p class="st-best">أطول سلسلة إجابات صحيحة: ' + App.d(best) + '</p>' : '') +
          '<div class="st-acts"><button class="btn primary" id="qAgain">' + App.icon('quiz') + 'جولة جديدة</button></div></div>';
        if (say && asked) App.voice.speak(msg + 'جاوبتوا صح على ' + score + ' من ' + asked);
        body.querySelector('#qAgain').onclick = function () { App.panels.back(); S.quiz(); };
      }
      function show() {
        var q = nextQ(), opts = shuffle(q[2]);
        body.innerHTML = '<div class="st-quiz"><div class="st-qtop"><span class="st-qn">سؤال ' + App.d(asked + 1) + '</span><span class="st-qs">' + App.icon('check') + App.d(score) + ' صح' +
          (streak > 1 ? ' • ' + App.d(streak) + ' متتالية' : '') + '</span><button class="chip" id="qEnd">إنهاء</button></div><h3>' + esc(q[0]) + '</h3><div class="st-opts">' +
          opts.map(function (o) { return '<button class="st-opt" data-a="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
        if (say) App.voice.speak(q[0] + ' ' + opts.join('، أو '));
        body.querySelector('#qEnd').onclick = finish;
        body.querySelectorAll('.st-opt').forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.a === q[1];
            body.querySelectorAll('.st-opt').forEach(function (x) { x.disabled = true; if (x.dataset.a === q[1]) x.classList.add('ok'); });
            asked++;
            if (ok) { score++; streak++; best = Math.max(best, streak); } else { b.classList.add('bad'); streak = 0; }
            if (say) App.voice.speak(ok ? (streak > 2 ? 'ما شاء الله! ' + streak + ' متتالية' : 'أحسنتم!') : 'الجواب: ' + q[1]);
            setTimeout(function () { if (body.querySelector('.st-quiz:not(.done)')) show(); }, ok ? 1500 : 2600);
          };
        });
      }
      show();
    });
  };

  // ---------- the dashboard's «هل تعلم» ----------
  S.fact = function (now) {
    var all = entities().filter(function (e) { return e.f && e.f.length; });
    if (!all.length) return null;
    var h = Math.floor(now / 3600e3), e = all[h % all.length], f = e.f[Math.floor(h / all.length) % e.f.length];
    return { t: e.n + ': ' + f[1], s: 'من موسوعة الأنبياء والصحابة — بدون نت' };
  };

  // ---------- the panel's definition and start-up ----------
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.stories = { title: 'القصص', render: function (body) {
    render(body);
    if (!lib && !scanning && App.Native.has && perm()) { S.scan(function () { if (App.panels.current === 'stories' && !App.panels.stack.length) App.panels.refresh(); }); App.panels.refresh(); }
  } };

  S.init = function () {
    audio = $('storyAudio');
    if (!audio) return;
    audio.addEventListener('play', function () { owns = true; ui(); });
    audio.addEventListener('pause', function () { save(true); ui(); });
    audio.addEventListener('ended', function () {
      if (cur && cur.q[cur.i + 1]) load(cur.q, cur.i + 1, cur.gid, cur.gn, 0, true);
      else { App.store.set('st.pos', null); cur = null; owns = false; ui(); }
    });
    audio.addEventListener('timeupdate', function () {
      var t = Date.now();
      if (t - lastTick < 900) return;
      lastTick = t; save(false);
      if (owns && cur) S.card();
      var c = $('stCur'); if (c && cur) { c.textContent = fmt(audio.currentTime); var b = document.querySelector('#stBar i'); if (b && audio.duration) b.style.width = Math.min(100, audio.currentTime / audio.duration * 100) + '%'; }
    });
    audio.addEventListener('error', function () {
      if (!cur) return;
      App.toast('تعذّر تشغيل «' + cur.t.n + '»' + (cur.q[cur.i + 1] ? ' — أنتقل للتالي' : ''));
      if (cur.q[cur.i + 1]) setTimeout(function () { S.step(1); }, 900);
    });
    // a story was on when the unit went to sleep: it waits, paused, on the card (never starts by itself)
    var p = App.store.get('st.pos', null);
    if (p && p.p) {
      var q = (p.q || []).map(function (x) { return { p: x[0], n: x[1] }; });
      if (!q.length) q = [{ p: p.p, n: p.n }];
      cur = { q: q, i: Math.min(p.i || 0, q.length - 1), t: q[Math.min(p.i || 0, q.length - 1)], gid: p.g, gn: p.gn };
      audio.src = src(cur.t.p);
      audio.addEventListener('loadedmetadata', function f() { try { if (p.t > 1) audio.currentTime = p.t; } catch (e) { /* ignore */ } audio.removeEventListener('loadedmetadata', f); });
    }
    if (App.settings.sleepMin) App.settings.sleepMin = 0;      // a sleep timer never survives a restart
    setTimeout(function () { if (App.Native.has && perm() && !lib) S.scan(); }, 4000);
  };
})();
