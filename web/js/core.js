/* core.js — shared helpers: event bus, native bridge, settings, formatting, geo */
var App = window.App = {};
(function () {
  'use strict';

  App.$ = function (id) { return document.getElementById(id); };
  App.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  App.icon = function (name, cls) {
    return '<svg class="ic ' + (cls || '') + '"><use href="#i-' + name + '"/></svg>';
  };

  // ---------- event bus ----------
  var handlers = {};
  App.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  App.emit = function (ev, data) {
    (handlers[ev] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { if (window.console) console.error(ev, e); }
    });
  };

  // ---------- native bridge (prompt() is intercepted by the Android shell) ----------
  var Native = App.Native = {
    has: false,
    call: function (cmd, arg) {
      if (!Native.has && cmd !== 'ping') return null;
      try { return window.prompt(cmd, arg == null ? '' : String(arg)); } catch (e) { return null; }
    },
    json: function (cmd, arg) {
      var r = Native.call(cmd, arg);
      if (!r || r === 'ERR') return null;
      try { return JSON.parse(r); } catch (e) { return null; }
    }
  };
  Native.has = /CamryNav/.test(navigator.userAgent) && Native.call('ping') === 'pong';
  // Android version: from the bridge when it answers, else from the user agent
  App.android = (function () {
    var info = Native.has ? Native.json('sys') : null, m;
    if (!info) {
      m = /SDK (\d+)/.exec(navigator.userAgent) || /Android (\d+(?:\.\d+)?)/.exec(navigator.userAgent);
      info = m ? (/SDK/.test(m[0]) ? { sdk: +m[1] } : { release: m[1] }) : {};
    }
    var SDK2REL = { 33: '13', 34: '14', 35: '15', 36: '16', 37: '17' };
    if (!info.release && info.sdk) info.release = SDK2REL[info.sdk] || ('API ' + info.sdk);
    if (!info.sdk && info.release) { var r = parseInt(info.release, 10); info.sdk = r >= 13 ? r + 20 : 0; }
    info.name = info.release ? 'أندرويد ' + info.release : 'غير معروف';
    info.supported = !info.sdk || info.sdk >= 33;
    return info;
  })();

  // ---------- storage + settings ----------
  App.store = {
    get: function (k, def) {
      try { var v = localStorage.getItem('cn.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: function (k, v) {
      try { localStorage.setItem('cn.' + k, JSON.stringify(v)); } catch (e) { /* storage full */ }
    }
  };
  var DEFAULTS = {
    digits: 'latn', clock24: false, mapStyle: 'auto', headingUp: true,
    speedLimit: 120, speedAlert: true, voice: true, adhanChime: true,
    offsets: [0, 0, 0, 0, 0, 0], radioApp: '', btApp: '', fanApp: '', favs: [],
    theme: 'silver', customAccent: '#56c8f5', autoOccasion: true, themeLocked: false, car: null, onboarded: 0,
    prePrayer: 10, adhkarRemind: true, adhkarScale: 1, briefing: true, fanAlert: true, fanLimit: 75, maint: {}, odo: null,
    home: null, work: null, recents: [], full: false, stations: [], lastStation: null
  };
  App.settings = Object.assign({}, DEFAULTS, App.store.get('settings', {}));
  App.saveSettings = function () { App.store.set('settings', App.settings); App.emit('settings'); };

  // ---------- formatting ----------
  var AR = '٠١٢٣٤٥٦٧٨٩';
  App.d = function (s) {
    s = String(s);
    return App.settings.digits === 'arab' ? s.replace(/[0-9]/g, function (c) { return AR[c]; }).replace(/\./g, '٫') : s;
  };
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  App.pad = pad;
  App.hm = function (date) {
    var h = date.getHours();
    if (!App.settings.clock24) h = h % 12 || 12;
    return App.d(h + ':' + pad(date.getMinutes()));
  };
  App.ampm = function (date) { return App.settings.clock24 ? '' : (date.getHours() < 12 ? 'ص' : 'م'); };
  App.hmFull = function (date) { var a = App.ampm(date); return App.hm(date) + (a ? ' ' + a : ''); };
  App.countdown = function (ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return App.d((h ? h + ':' + pad(m) : m) + ':' + pad(sec));
  };
  App.ll = function (lat, lon, n) {
    n = n || 5;
    return '⁦' + lat.toFixed(n) + ', ' + lon.toFixed(n) + '⁩';
  };
  App.fmtDist = function (m) {
    if (!isFinite(m)) return '--';
    if (m < 950) return App.d(m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10) + ' م';
    var km = m / 1000;
    return App.d(km < 10 ? km.toFixed(1) : Math.round(km)) + ' كم';
  };
  App.fmtDur = function (sec) {
    if (!isFinite(sec)) return '--';
    var min = Math.round(sec / 60);
    if (min < 60) return App.d(Math.max(1, min)) + ' د';
    return App.d(Math.floor(min / 60)) + ' س ' + App.d(min % 60) + ' د';
  };

  // ---------- geo ----------
  var RAD = Math.PI / 180, ER = 6371008.8;
  App.geo = {
    dist: function (aLat, aLon, bLat, bLon) {
      var dLat = (bLat - aLat) * RAD, dLon = (bLon - aLon) * RAD;
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 2 * ER * Math.asin(Math.min(1, Math.sqrt(h)));
    },
    bearing: function (aLat, aLon, bLat, bLon) {
      var y = Math.sin((bLon - aLon) * RAD) * Math.cos(bLat * RAD);
      var x = Math.cos(aLat * RAD) * Math.sin(bLat * RAD) -
        Math.sin(aLat * RAD) * Math.cos(bLat * RAD) * Math.cos((bLon - aLon) * RAD);
      return (Math.atan2(y, x) / RAD + 360) % 360;
    },
    // equirectangular projection to metres around a reference latitude
    xy: function (lat, lon, refLat) {
      return { x: lon * RAD * ER * Math.cos(refLat * RAD), y: lat * RAD * ER };
    },
    dir8: function (deg) {
      var n = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
      return n[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
    }
  };

  // ---------- network ----------
  App.fetchJSON = function (url, timeout) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, timeout || 12000);
      fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        if (!done) { done = true; clearTimeout(timer); resolve(j); }
      }).catch(function (e) {
        if (!done) { done = true; clearTimeout(timer); reject(e); }
      });
    });
  };

  // ---------- UI helpers ----------
  App.toast = function (msg, ms) {
    var t = App.$('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  };

  // shared reminder card (task reminders, prayer reminders, overheating…)
  var rmSeq = 0;
  App.reminder = {
    show: function (o) {
      var box = App.$('reminder'), ctx = {}, tok = ++rmSeq;
      box._tok = tok;
      box.innerHTML = '<div class="rm-k">' + App.icon(o.icon || 'bell') + App.esc(o.kind || 'تذكير') + '</div>' +
        '<div class="rm-t">' + App.esc(o.title) + '</div><div class="rm-s">' + App.esc(o.sub || '') + '</div>' +
        '<div class="btn-row">' + (o.buttons || []).map(function (b, i) {
          return '<button class="btn' + (i === 0 ? ' primary' : '') + '" data-b="' + b[0] + '"' + (b[3] ? ' disabled' : '') + '>' +
            App.icon(b[2]) + b[1] + '</button>';
        }).join('') + '</div>';
      box.classList.remove('hidden');
      clearTimeout(box._h);
      function hide() { if (box._tok === tok) box.classList.add('hidden'); }
      box._h = setTimeout(hide, o.timeout || 120000);
      box.querySelectorAll('[data-b]').forEach(function (el) {
        el.onclick = function () { hide(); if (o.onButton) o.onButton(el.dataset.b, ctx); };
      });
      if (o.onShow) {
        o.onShow(ctx, function (t) { if (box._tok === tok) box.querySelector('.rm-s').textContent = t; },
          function (k) { var el = box.querySelector('[data-b="' + k + '"]'); if (el && box._tok === tok) el.disabled = false; });
      }
      if (o.chime !== false) App.beep([[880, 160], [1175, 260]], 0.22);
    },
    hide: function () { App.$('reminder').classList.add('hidden'); }
  };
  App.durText = function (ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return App.d(m) + ' دقيقة';
    var h = Math.floor(m / 60), r = m % 60;
    return App.d(h) + ' ساعة' + (r ? ' و' + App.d(r) + ' دقيقة' : '');
  };

  var actx = null;
  App.audioCtx = function () {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
    return actx;
  };
  // tones: [[freq, durationMs], ...]
  App.beep = function (tones, vol) {
    var ctx = App.audioCtx();
    if (!ctx) return;
    var t = ctx.currentTime + 0.02;
    tones.forEach(function (tn) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = tn[0];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + tn[1] / 1000);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + tn[1] / 1000 + 0.05);
      t += tn[1] / 1000 * 0.85;
    });
  };
  document.addEventListener('pointerdown', function () { App.audioCtx(); }, { once: true });
})();
