/* voice.js — «الصوت»: one place that speaks for the whole app (prayer reminders, navigation prompts, tasks, stories,
   the quiz). With an ElevenLabs key it speaks in an ElevenLabs voice, and keeps every phrase it has generated on the unit
   (IndexedDB), so a phrase heard once is heard again without internet. Without a key, or offline and not cached yet,
   or if ElevenLabs refuses, it falls back to the unit's own Arabic engine. Nothing to set up: a build made for the owner
   carries the key, scrambled, from a private folder outside the repository (build/build_private.py), and leaves it on the
   unit, so the ordinary updates that follow (which never carry it) keep the voice. The key is never in the source or in
   a published file. Written for «رحلة» by أبو دانة للبرمجة. */
(function () {
  'use strict';
  var V = App.voice = {};
  var API = 'https://api.elevenlabs.io/v1/';
  var DEF_VOICE = 'JBFqnCBsd6RMkjVDRZzb';          // a premade multilingual voice — premade voices work on every plan, the free one included
  var MODEL = 'eleven_multilingual_v2';
  var token = 0, audio = null, url = null, warned = {}, downUntil = 0, usedNative = false, cacheDb = null, mem = {};

  var MASK = 'رحلة-أبو-دانة';                      // must match build/build_private.py
  function builtKey() {                             // the key the owner's build carries (window.RIHLA_VK, from data/vk.js)
    var e = window.RIHLA_VK, o = '';
    if (!e) return '';
    try {
      var b = atob(e);
      for (var i = 0; i < b.length; i++) o += String.fromCharCode(b.charCodeAt(i) ^ ((MASK.charCodeAt(i % MASK.length) + i * 7) & 255));
    } catch (x) { return ''; }
    return /^[\x21-\x7e]{20,}$/.test(o) ? o : '';
  }
  function cfg() {
    var s = App.settings;
    return { key: builtKey() || String(s.elKey || '').trim(), voice: String(s.elVoice || '').trim() || DEF_VOICE, model: s.elModel || MODEL, on: s.elOn !== false };
  }
  V.enabled = function () { var c = cfg(); return !!(c.key && c.on); };
  V.hasKey = function () { return !!cfg().key; };
  // a build that carries the key also leaves it on the unit, so a later update without it keeps the voice
  (function () { var k = builtKey(); if (k && App.settings.elKey !== k) { App.settings.elKey = k; App.saveSettings(); } })();

  // ---------- one-time activation ----------
  // A published build may carry the key sealed: window.RIHLA_VKS = { s: salt, c: the key's 24 bytes XOR the first bytes
  // of PBKDF2-HMAC-SHA256(code, salt, n), n } (base64). The 12-digit code (its last digit a Luhn check, to catch typos)
  // is handed to the owner privately and typed once in Settings; the key it opens is then kept on the unit like any other.
  function bytes64(t) { var b = atob(t), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function digits(t) {
    return String(t || '').replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x6f0); }).replace(/\D/g, '');
  }
  function luhn(d) {
    for (var i = 0, sum = 0; i < d.length; i++) { var n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    return sum % 10 === 0;
  }
  // SHA-256 / HMAC / PBKDF2 in plain JS, for a WebView without crypto.subtle (a few seconds on the head unit, once)
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70,
    0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = [];
  function block(H, m, o) {
    var i, a, b, t1, t2;
    for (i = 0; i < 16; i++) W[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (i = 16; i < 64; i++) {
      a = W[i - 15]; b = W[i - 2];
      W[i] = (((a >>> 7 | a << 25) ^ (a >>> 18 | a << 14) ^ (a >>> 3)) + W[i - 16] + ((b >>> 17 | b << 15) ^ (b >>> 19 | b << 13) ^ (b >>> 10)) + W[i - 7]) | 0;
    }
    var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4], F = H[5], G = H[6], X = H[7];
    for (i = 0; i < 64; i++) {
      t1 = (X + ((E >>> 6 | E << 26) ^ (E >>> 11 | E << 21) ^ (E >>> 25 | E << 7)) + ((E & F) ^ (~E & G)) + K[i] + W[i]) | 0;
      t2 = (((A >>> 2 | A << 30) ^ (A >>> 13 | A << 19) ^ (A >>> 22 | A << 10)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
      X = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
    }
    H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0; H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0;
    H[4] = (H[4] + E) | 0; H[5] = (H[5] + F) | 0; H[6] = (H[6] + G) | 0; H[7] = (H[7] + X) | 0;
  }
  function finish(state, msg, before) {      // SHA-256 of (`before` bytes already in state) + msg
    var H = state.slice(), n = msg.length, len = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(len), bits = (before + n) * 8, i;
    m.set(msg); m[n] = 0x80;
    m[len - 4] = bits >>> 24; m[len - 3] = bits >>> 16 & 255; m[len - 2] = bits >>> 8 & 255; m[len - 1] = bits & 255;
    for (i = 0; i < len; i += 64) block(H, m, i);
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = H[i] >>> 16 & 255; out[4 * i + 2] = H[i] >>> 8 & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }
  function pbkdf2(pw, salt, rounds) {        // PBKDF2-HMAC-SHA256, first 32 bytes
    var k = pw.length > 64 ? finish(IV, pw, 0) : pw, pad = new Uint8Array(64), ist = IV.slice(), ost = IV.slice(), i, r;
    for (i = 0; i < 64; i++) pad[i] = (k[i] || 0) ^ 0x36;
    block(ist, pad, 0);
    for (i = 0; i < 64; i++) pad[i] = (k[i] || 0) ^ 0x5c;
    block(ost, pad, 0);
    var s1 = new Uint8Array(salt.length + 4); s1.set(salt); s1[salt.length + 3] = 1;
    var u = finish(ost, finish(ist, s1, 64), 64), t = u.slice();
    for (r = 1; r < rounds; r++) { u = finish(ost, finish(ist, u, 64), 64); for (i = 0; i < 32; i++) t[i] ^= u[i]; }
    return t;
  }
  function derive(code, salt, rounds, cb) {
    var pw = new Uint8Array(code.length), sub = window.crypto && window.crypto.subtle, i;
    for (i = 0; i < code.length; i++) pw[i] = code.charCodeAt(i);
    function slow() { setTimeout(function () { cb(pbkdf2(pw, salt, rounds)); }, 30); }
    if (!sub || !sub.importKey) return slow();
    sub.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return sub.deriveBits({ name: 'PBKDF2', salt: salt, iterations: rounds, hash: 'SHA-256' }, k, 256);
    }).then(function (b) { cb(new Uint8Array(b)); }, slow);
  }
  V.sealed = function () { var v = window.RIHLA_VKS; return !!(v && v.s && v.c) && !cfg().key; };
  V.unlock = function (text, cb) {             // cb(true) once the key is opened and kept on the unit
    var d = digits(text), v = window.RIHLA_VKS;
    if (!v || d.length !== 12 || !luhn(d)) { cb(false); return; }
    derive(d, bytes64(v.s), v.n || 200000, function (dk) {
      var c = bytes64(v.c), hex = '';
      for (var i = 0; i < c.length; i++) hex += ('0' + (c[i] ^ dk[i]).toString(16)).slice(-2);
      App.settings.elKey = 'sk_' + hex; App.settings.elSealed = true; App.saveSettings();
      cb(true);
    });
  };

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
  function quota(e) { return /quota|credit/i.test((e && e.body) || ''); }
  function spent(e) { return !!(e && (e.status === 402 || quota(e))); }
  function explain(e) {
    if (spent(e)) return 'خلص رصيد ElevenLabs لهالشهر — رحلة تتكلم بصوت الشاشة لين يتجدد';
    if (e && e.status === 401) return 'ElevenLabs رفض المفتاح — رحلة تتكلم بصوت الشاشة';
    if (e && e.status === 429) return 'ElevenLabs مشغول — أحاول لاحقاً';
    if (e && e.status === 404) return 'الصوت مو موجود في الحساب';
    return 'ما اتصلت بـElevenLabs (' + ((e && (e.status || e.message)) || '?') + ')';
  }
  function getBlob(text, c, cb) {                   // cache first, then the network (only when the unit is online)
    var k = hash(c.voice + '|' + c.model + '|' + text);
    getC(k, function (b) {
      if (b) { cb(b); return; }
      if (navigator.onLine === false || Date.now() < downUntil) { cb(null); return; }
      fetchAudio(text, c).then(function (blob) { putC(k, blob); cb(blob); }, function (e) {
        var st = e && e.status;
        if (c.voice !== DEF_VOICE && st >= 400 && st < 500 && st !== 401 && st !== 429 && !quota(e)) {
          // a voice picked by an older version that this account cannot use (a library voice on the free plan, or one
          // that was removed): forget it, and the premade voice takes over
          App.settings.elVoice = ''; App.settings.elVoiceName = ''; App.saveSettings();
          getBlob(text, cfg(), cb); return;
        }
        if (st === 401 && App.settings.elSealed && /invalid_api_key|invalid api key/i.test((e && e.body) || '')) {
          App.settings.elKey = ''; App.settings.elSealed = false; App.saveSettings();
          say('رقم التفعيل غلط — اكتبه مرة ثانية من الإعدادات'); cb(null, e); return;
        }
        if (spent(e) || st === 401 || st === 429 || st === 404) { say(explain(e)); downUntil = Date.now() + (st === 429 ? 120000 : spent(e) ? 6 * 3600000 : 600000); }
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
    if (!V.enabled()) { nativeSpeak(t); o.done && setTimeout(o.done, Math.min(15000, t.length * 70)); return; }
    var list = chunks(t), ready = null;
    function fetchNext(n, cb) { getBlob(list[n], cfg(), cb); }
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

})();
