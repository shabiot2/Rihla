/* intro.js — the start-up welcome. The Abu Dana logo assembles itself: light particles rush in, the emblem lands
   with a flare and a bell chord, an orbit of light circles it, the name writes in from the right, a shine sweeps
   across — then the logo slides aside for «رحلة». About six seconds; a tap skips it. */
(function () {
  'use strict';
  var I = App.intro = {};
  var LAND = 1350, OUT = 5300, END = 6000;

  function greeting() {
    var h = new Date().getHours();
    return (h >= 4 && h < 12 ? 'صباح الخير' : 'مساء الخير') + ' — حيّاك الله';
  }

  // ---------- sound: a soft whoosh, then a bell chord with a warm low swell as the emblem lands ----------
  function chime() {
    if (App.settings.introSound === false || !App.audioCtx) return;
    var ctx = App.audioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var t0 = ctx.currentTime + 0.05, sr = ctx.sampleRate, i;
      var master = ctx.createGain();
      master.gain.value = 0.2;
      var conv = ctx.createConvolver(), len = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, len, sr);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      conv.buffer = ir;
      var wet = ctx.createGain();
      wet.gain.value = 0.32;
      master.connect(ctx.destination);
      master.connect(conv); conv.connect(wet); wet.connect(ctx.destination);
      // whoosh: band-passed noise rising toward the landing
      var nb = ctx.createBuffer(1, Math.floor(sr * 1.3), sr), nd = nb.getChannelData(0);
      for (i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      var ns = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      ns.buffer = nb; bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(260, t0 + 0.3);
      bp.frequency.exponentialRampToValueAtTime(4200, t0 + 1.3);
      ng.gain.setValueAtTime(0.0001, t0 + 0.3);
      ng.gain.exponentialRampToValueAtTime(0.45, t0 + 1.22);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
      ns.connect(bp); bp.connect(ng); ng.connect(master);
      ns.start(t0 + 0.3); ns.stop(t0 + 1.6);
      // bell chord: E5 B5 E6 G#6, a fundamental plus a soft octave partial each
      [[659.25, 0], [987.77, 0.07], [1318.5, 0.14], [1661.2, 0.22]].forEach(function (n) {
        [[1, 0.15, 2.8], [2.005, 0.045, 1.3]].forEach(function (p) {
          var o = ctx.createOscillator(), g = ctx.createGain(), at = t0 + LAND / 1000 + n[1];
          o.type = 'sine';
          o.frequency.value = n[0] * p[0];
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(p[1], at + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, at + p[2]);
          o.connect(g); g.connect(master);
          o.start(at); o.stop(at + p[2] + 0.05);
        });
      });
      var lo = ctx.createOscillator(), lg = ctx.createGain();
      lo.type = 'sine'; lo.frequency.value = 82.4;
      lg.gain.setValueAtTime(0.0001, t0 + 1.28);
      lg.gain.exponentialRampToValueAtTime(0.32, t0 + 1.42);
      lg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
      lo.connect(lg); lg.connect(master);
      lo.start(t0 + 1.28); lo.stop(t0 + 3.5);
    } catch (e) { }
  }

  // ---------- light particles: rush into the emblem, burst at the landing, then a slow drifting dust ----------
  function particles(cv, logo) {
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    function target() {
      var r = logo.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.33, s: r.height / 720 };
    }
    var T = target(), R = Math.hypot(W, H) * 0.62, P = [], D = [], i, t0 = performance.now(), land = null;
    var COLS = ['120,190,255', '120,190,255', '120,190,255', '255,255,255', '170,215,255', '80,150,255'];
    for (i = 0; i < 140; i++) {
      var a = Math.random() * Math.PI * 2, rr = R * (0.55 + Math.random() * 0.55);
      P.push({ sx: Math.cos(a) * rr, sy: Math.sin(a) * rr, ox: (Math.random() - 0.5) * 120, oy: (Math.random() - 0.5) * 90,
        d: Math.random() * 0.4, s: 0.8 + Math.random() * 2.2, c: COLS[i % COLS.length],
        va: Math.random() * Math.PI * 2, vs: 140 + Math.random() * 520 });
    }
    for (i = 0; i < 46; i++) {
      D.push({ x: Math.random() * W, y: Math.random() * H, vy: 8 + Math.random() * 26, s: 0.6 + Math.random() * 1.6,
        ph: Math.random() * 6.3, c: Math.random() < 0.75 ? '150,205,255' : '255,255,255' });
    }
    function dot(x, y, s, c, al) {
      if (al <= 0.01) return;
      ctx.fillStyle = 'rgba(' + c + ',' + Math.min(1, al).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
      if (s > 1.6) { ctx.fillStyle = 'rgba(' + c + ',' + (al * 0.18).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, s * 3.2, 0, 6.2832); ctx.fill(); }
    }
    function frame(now) {
      if (!cv.isConnected) return;
      var t = now - t0;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,' + (t < LAND ? 0.2 : 0.3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (t < LAND) T = target();
      else if (!land) land = { x: T.x, y: T.y };
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (t < LAND) {
          var k = Math.max(0, Math.min(1, (t / LAND - p.d) / (1 - p.d)));
          k = k * k * k;                                           // accelerate into the emblem
          dot(T.x + p.sx * (1 - k) + p.ox * T.s * 0.35 * k, T.y + p.sy * (1 - k) + p.oy * T.s * 0.35 * k, p.s, p.c, 0.2 + 0.8 * k);
        } else {
          var s = (t - LAND) / 1000, f = s * (1 - Math.min(1, s) * 0.45);
          dot(land.x + Math.cos(p.va) * p.vs * f, land.y + Math.sin(p.va) * p.vs * f * 0.8, p.s, p.c, 1 - s / 1.5);
        }
      }
      if (land) {                                                   // shockwave ring
        var q = (t - LAND) / 900;
        if (q < 1) {
          ctx.strokeStyle = 'rgba(150,210,255,' + (0.55 * (1 - q)).toFixed(3) + ')';
          ctx.lineWidth = 3 * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(land.x, land.y, 40 + q * Math.min(W, H) * 0.62, 30 + q * Math.min(W, H) * 0.42, 0, 0, 6.2832); ctx.stroke();
        }
      }
      if (t > 2000) {                                               // slow golden-blue dust for the rest
        var fade = Math.min(1, (t - 2000) / 900);
        D.forEach(function (d) {
          d.y -= d.vy / 60;
          if (d.y < -10) d.y = H + 10;
          dot(d.x, d.y, d.s, d.c, fade * (0.18 + 0.22 * Math.sin(t / 380 + d.ph)));
        });
      }
      if (t < END) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  I.play = function () {
    var el = document.createElement('div');
    el.className = 'intro';
    var car = App.car && App.car.title ? App.car.title() : '';
    el.innerHTML =
      '<canvas class="in-fx"></canvas><i class="in-glow"></i>' +
      '<div class="in-stage">' +
      '<div class="in-logo" role="img" aria-label="أبو دانة للبرمجة">' +
      '<i class="lg p-emb"></i><i class="lg p-name"></i><i class="lg p-sub"></i><i class="lg p-lat"></i>' +
      '<svg class="in-orbit" viewBox="0 0 566 720"><ellipse class="orb" cx="292" cy="236" rx="222" ry="96" transform="rotate(-24 292 236)" pathLength="100"/>' +
      '<ellipse class="orb core" cx="292" cy="236" rx="222" ry="96" transform="rotate(-24 292 236)" pathLength="100"/></svg>' +
      '<i class="in-flare"></i><i class="in-shine"></i></div>' +
      '<div class="in-side"><div class="in-wel">' + greeting() + '</div><div class="in-name">رحلة</div>' +
      '<div class="in-sub">' + App.esc([car, App.theme && App.theme.cur ? App.theme.cur.name : '', App.android.name].filter(Boolean).join(' • ')) + '</div>' +
      '<div class="in-by">' + App.brand() + '<span>جميع الحقوق محفوظة © ' + App.d('2026') + ' أبو دانة للبرمجة</span></div></div>' +
      '</div>';
    document.body.appendChild(el);
    var gone = false;
    function out() {
      if (gone) return;
      gone = true;
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); App.emit('introDone'); }, 650);
    }
    el.onclick = out;
    try { particles(el.querySelector('.in-fx'), el.querySelector('.in-logo')); } catch (e) { }
    chime();
    setTimeout(out, OUT);
  };
})();
