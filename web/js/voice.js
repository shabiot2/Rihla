/* voice.js — «الصوت»: one place that speaks for the whole app (prayer reminders, navigation prompts, tasks, stories,
   the quiz). With an ElevenLabs key it speaks in an ElevenLabs voice, and keeps every phrase it has generated on the unit
   (IndexedDB), so a phrase heard once is heard again without internet. Without a key, or offline and not cached yet,
   or if ElevenLabs refuses, it falls back to the unit's own Arabic engine. The key is typed by the owner in Settings and
   stays on the unit (localStorage); it is never in the code. Written for «رحلة» by أبو دانة للبرمجة. */
(function () {
  'use strict';
  var V = App.voice = {};
  var API = 'https://api.elevenlabs.io/v1/';
  var DEF_VOICE = 'JBFqnCBsd6RMkjVDRZzb';          // a premade multilingual voice; the owner can pick any other in Settings
  var MODEL = 'eleven_multilingual_v2';
  var token = 0, audio = null, url = null, warned = {}, downUntil = 0, usedNative = false, cacheDb = null, mem = {};

  function cfg() {
    var s = App.settings;
    return { key: String(s.elKey || '').trim(), voice: String(s.elVoice || '').trim() || DEF_VOICE, model: s.elModel || MODEL, on: s.elOn !== false };
  }
  V.enabled = function () { var c = cfg(); return !!(c.key && c.on); };

  // what is sent to be spoken: the symbols a voice would stumble on become the words they stand for
  V.clean = function (t) {
    return String(t || '')
      .replace(/ﷺ|\(ص\)|﴿|﴾/g, function (m) { return m === 'ﷺ' || m === '(ص)' ? ' صلى الله عليه وسلم ' : ' '; })
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, ' ')
      .replace(/[«»"]/g, ' ').replace(/\s*[—–]\s*/g, '، ').replace(/\s+/g, ' ').trim();
  };
  function chunks(t) {                              // short pieces: the first one starts sooner, and common pieces are reused from the cache
    var out = [], parts = t.split(/(?<=[.!؟?:\n])\s+/), cur = '';
    parts.forEach(function (p) {
      if ((cur + ' ' + p).length > 380 && cur) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p;
    });
    if (cur) out.push(cur);
    return out;
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + '.' + s.length; }

  // ---------- the cache ----------
  function openDb(cb) {
    if (cacheDb !== null) { cb(cacheDb || null); return; }
    try {
      var r = indexedDB.open('rihla-voice', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('a'); };
      r.onsuccess = function () { cacheDb = r.result; cb(cacheDb); prune(); };
      r.onerror = function () { cacheDb = false; cb(null); };
    } catch (e) { cacheDb = false; cb(null); }
  }
  function getC(k, cb) {
    if (mem[k]) { cb(mem[k]); return; }
    openDb(function (db) {
      if (!db) { cb(null); return; }
      try { var q = db.transaction('a').objectStore('a').get(k); q.onsuccess = function () { cb(q.result ? q.result.b : null); }; q.onerror = function () { cb(null); }; } catch (e) { cb(null); }
    });
  }
  function putC(k, blob) {
    mem[k] = blob;
    openDb(function (db) { if (db) try { db.transaction('a', 'readwrite').objectStore('a').put({ b: blob, t: Date.now() }, k); } catch (e) { /* the memory copy remains */ } });
  }
  function prune() {                                // keep the newest 600 phrases
    try {
      var st = cacheDb.transaction('a', 'readwrite').objectStore('a'), c = st.count();
      c.onsuccess = function () {
        if (c.result <= 600) return;
        var all = [], cur = st.openCursor();
        cur.onsuccess = function () {
          var x = cur.result;
          if (x) { all.push([x.key, x.value.t || 0]); x.continue(); return; }
          all.sort(function (a, b) { return a[1] - b[1]; }).slice(0, all.length - 500).forEach(function (e) { st.delete(e[0]); });
        };
      };
    } catch (e) { /* ignore */ }
  }
  V.cacheCount = function (cb) {
    openDb(function (db) {
      if (!db) { cb(Object.keys(mem).length); return; }
      try { var c = db.transaction('a').objectStore('a').count(); c.onsuccess = function () { cb(c.result); }; c.onerror = function () { cb(0); }; } catch (e) { cb(0); }
    });
  };
  V.clearCache = function (cb) {
    mem = {};
    openDb(function (db) { if (db) try { var t = db.transaction('a', 'readwrite'); t.objectStore('a').clear(); t.oncomplete = function () { cb && cb(); }; } catch (e) { cb && cb(); } else cb && cb(); });
  };

  // ---------- ElevenLabs ----------
  function say(msg) { if (!warned[msg]) { warned[msg] = 1; App.toast(msg); } }
  function fetchAudio(text, c) {
    return new Promise(function (ok, no) {
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); no(new Error('timeout')); }, 9000);
      fetch(API + 'text-to-speech/' + encodeURIComponent(c.voice) + '?output_format=mp3_44100_64', {
        method: 'POST', signal: ctl && ctl.signal,
        headers: { 'xi-api-key': c.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text, model_id: c.model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } })
      }).then(function (r) {
        clearTimeout(to);
        if (!r.ok) {
          return r.text().then(function (b) {
            var e = new Error('HTTP ' + r.status); e.status = r.status; e.body = b; throw e;
          });
        }
        return r.blob();
      }).then(function (b) { ok(b); }, function (e) { clearTimeout(to); no(e); });
    });
  }
  function explain(e) {
    var m = (e && e.body) || '';
    if (e && e.status === 401) return 'مفتاح ElevenLabs غير صحيح';
    if (e && (e.status === 402 || /quota|credit/i.test(m))) return 'انتهى رصيد ElevenLabs — أرجع لصوت الشاشة';
    if (e && e.status === 429) return 'ElevenLabs مشغول — أحاول لاحقاً';
    if (e && e.status === 404) return 'رقم الصوت غير موجود في حسابك';
    return 'ما اتصلت بـElevenLabs (' + ((e && (e.status || e.message)) || '?') + ')';
  }
  function getBlob(text, c, cb) {                   // cache first, then the network (only when the unit is online)
    var k = hash(c.voice + '|' + c.model + '|' + text);
    getC(k, function (b) {
      if (b) { cb(b); return; }
      if (navigator.onLine === false || Date.now() < downUntil) { cb(null); return; }
      fetchAudio(text, c).then(function (blob) { putC(k, blob); cb(blob); }, function (e) {
        if (e && (e.status === 401 || e.status === 402 || e.status === 429 || e.status === 404)) { say(explain(e)); downUntil = Date.now() + (e.status === 429 ? 120000 : 600000); }
        cb(null, e);
      });
    });
  }

  // ---------- playing ----------
  function nativeSpeak(t) {
    if (!App.Native.has) return;
    usedNative = true;
    App.Native.call('tts', t);
  }
  V.stop = function () {
    token++;
    if (audio) { try { audio.pause(); } catch (e) { /* ignore */ } audio.onended = audio.onerror = null; }
    if (url) { URL.revokeObjectURL(url); url = null; }
    if (usedNative && App.Native.has) { App.Native.call('tts', ''); usedNative = false; }
  };
  // speak(text, { done: fn }) — done runs when the whole text has been spoken (or when it could not be)
  V.speak = function (text, o) {
    o = o || {};
    V.stop();
    var t = V.clean(text), my = token;
    if (!t) { o.done && o.done(); return; }
    var c = cfg();
    if (!V.enabled()) { nativeSpeak(t); o.done && setTimeout(o.done, Math.min(15000, t.length * 70)); return; }
    var list = chunks(t), i = 0, ready = null;
    function fetchNext(n, cb) { getBlob(list[n], c, cb); }
    function fallback(from) { nativeSpeak(list.slice(from).join(' ')); o.done && setTimeout(o.done, Math.min(15000, list.slice(from).join(' ').length * 70)); }
    function playFrom(n, blob) {
      if (my !== token) return;
      if (!blob) { fallback(n); return; }
      if (!audio) audio = new Audio();
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      audio.onended = function () {
        if (my !== token) return;
        if (n + 1 >= list.length) { o.done && o.done(); return; }
        if (ready && ready.n === n + 1 && ready.blob !== undefined) { var r = ready; ready = null; playFrom(r.n, r.blob); }
        else fetchNext(n + 1, function (b) { playFrom(n + 1, b); });
      };
      audio.onerror = function () { if (my === token) fallback(n); };
      audio.src = url;
      audio.play().catch(function () { if (my === token) fallback(n); });
      if (n + 1 < list.length) fetchNext(n + 1, function (b) { if (my === token) ready = { n: n + 1, blob: b }; });   // the next piece is fetched while this one plays
    }
    fetchNext(0, function (b) { playFrom(0, b); });
  };
  V.isSpeaking = function () { return !!(audio && !audio.paused && !audio.ended); };

  // ---------- Settings helpers ----------
  V.test = function (cb) {
    var c = cfg();
    if (!c.key) { cb('اكتب مفتاح ElevenLabs أولاً'); return; }
    fetchAudio('بسم الله. هذا صوت ElevenLabs من رحلة.', c).then(function (b) {
      var k = hash(c.voice + '|' + c.model + '|بسم الله. هذا صوت ElevenLabs من رحلة.'); putC(k, b);
      if (!audio) audio = new Audio();
      V.stop(); url = URL.createObjectURL(b); audio.src = url; audio.play().catch(function () { });
      cb('اشتغل ✔ — تسمع الصوت الحين');
    }, function (e) { cb(explain(e)); });
  };
  V.voices = function (cb) {
    var c = cfg();
    if (!c.key) { cb(null, 'اكتب مفتاح ElevenLabs أولاً'); return; }
    fetch(API + 'voices', { headers: { 'xi-api-key': c.key } }).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }).then(function (j) { cb(j.voices || []); }, function (e) { cb(null, explain(e)); });
  };
  V.preview = function (u) { if (!audio) audio = new Audio(); V.stop(); audio.src = u; audio.play().catch(function () { }); };
})();
