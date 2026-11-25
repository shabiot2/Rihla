/* live.js — «حيّ»: moving backgrounds drawn on one canvas (eight worlds to pick from), that speed up with the
   car when GPS knows the speed, and the fuel-economy card fed by the car's own data (car.js).
   House rules for the head unit's A53: ~30 fps, every gradient and silhouette pre-rendered once per size,
   per frame only blits and a few hundred cheap strokes; paused while a panel covers the screen or the app hides. */
(function () {
  'use strict';
  var L = App.live = {};
  var TAU = Math.PI * 2;

  // ---------- helpers ----------
  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function layer(w, h, draw) {
    var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    draw(c.getContext('2d'), c.width, c.height); return c;
  }
  function glow(r, rgb, core) {
    return layer(r * 2, r * 2, function (g) {
      var x = g.createRadialGradient(r, r, 0, r, r, r);
      x.addColorStop(0, 'rgba(' + rgb + ',1)'); x.addColorStop(core || .22, 'rgba(' + rgb + ',.45)'); x.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = x; g.fillRect(0, 0, r * 2, r * 2);
    });
  }
  function vgrad(g, y0, y1, stops) {
    var x = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s) { x.addColorStop(s[0], s[1]); });
    return x;
  }
  function stars(g, W, H, n, seed, a) {
    var R = rng(seed);
    for (var i = 0; i < n; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.2 + R() * (a || .7)).toFixed(2) + ')';
      g.beginPath(); g.arc(R() * W, R() * H, R() < .1 ? 1.5 : .8, 0, TAU); g.fill();
    }
  }
  // a smooth ridge whose shape repeats every `period` px (so a strip can scroll and wrap)
  function ridge(g, W, y, amp, color, seed, bottom, period) {
    var R = rng(seed), P = period || W, k1 = 1 + Math.floor(R() * 2), k2 = 2 + Math.floor(R() * 3), p1 = R() * TAU, p2 = R() * TAU;
    g.fillStyle = color; g.beginPath(); g.moveTo(0, bottom);
    for (var x = 0; x <= W + 8; x += 8) {
      var t = x / P * TAU;
      g.lineTo(x, y - amp * (0.62 * Math.sin(t * k1 + p1) + 0.38 * Math.sin(t * k2 + p2)));
    }
    g.lineTo(W + 8, bottom); g.closePath(); g.fill();
  }
  function jagged(g, W, y, amp, color, seed, bottom) {
    var R = rng(seed), h = 0;
    g.fillStyle = color; g.beginPath(); g.moveTo(0, bottom); g.lineTo(0, y);
    for (var x = 0; x <= W + 20; x += 20 + R() * 30) { h += (R() - .5) * amp * .7; h = Math.max(-amp, Math.min(amp, h)); g.lineTo(x, y - Math.abs(h) - amp * .3 * R()); }
    g.lineTo(W + 20, bottom); g.closePath(); g.fill();
  }

  // ---------- the eight worlds ----------
  var SC = {};

  SC.desert = { name: 'طريق الصحراء', sub: 'ليل ونجوم وطريق ممتد', acc: [255, 186, 92],
    init: function (W, H) {
      var hz = Math.round(H * .56), vx = W * .5;
      var bg = layer(W, H, function (g) {
        g.fillStyle = vgrad(g, 0, hz, [[0, '#050716'], [.55, '#17143a'], [1, '#4a2846']]); g.fillRect(0, 0, W, hz);
        var hg = g.createRadialGradient(vx, hz, 0, vx, hz, W * .5);
        hg.addColorStop(0, 'rgba(255,150,90,.5)'); hg.addColorStop(1, 'rgba(255,150,90,0)'); g.fillStyle = hg; g.fillRect(0, 0, W, hz);
        stars(g, W, hz * .85, Math.round(W * H / 6000), 11);
        g.drawImage(glow(Math.round(H * .11), '255,236,200', .18), W * .78 - H * .11, H * .16 - H * .11);
        g.fillStyle = '#fff3dc'; g.beginPath(); g.arc(W * .78, H * .16, H * .032, 0, TAU); g.fill();
        ridge(g, W, hz - H * .015, H * .05, '#2b1c33', 17, hz + 2);
        ridge(g, W, hz + H * .005, H * .03, '#1c1324', 29, hz + 4);
        g.fillStyle = vgrad(g, hz, H, [[0, '#1c1320'], [1, '#09070d']]); g.fillRect(0, hz, W, H - hz);
        g.fillStyle = '#0c0c13'; g.beginPath();
        g.moveTo(vx - W * .006, hz); g.lineTo(vx + W * .006, hz); g.lineTo(vx + W * .62, H); g.lineTo(vx - W * .62, H); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,220,170,.5)'; g.lineWidth = 2; g.beginPath();
        g.moveTo(vx - W * .004, hz); g.lineTo(vx - W * .56, H); g.moveTo(vx + W * .004, hz); g.lineTo(vx + W * .56, H); g.stroke();
      });
      return { bg: bg, hz: hz, vx: vx, off: 0, lamp: glow(48, '255,190,110') };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      S.off = (S.off + dt * (0.1 + v * 0.8)) % 1;
      var hz = S.hz, vx = S.vx, D = H - hz, i, p0, p1, y0, y1, w0, w1;
      for (i = 0; i < 12; i++) {
        p0 = (i + S.off) / 12; p1 = Math.min(1, p0 + .035);
        y0 = hz + D * Math.pow(p0, 2.2); y1 = hz + D * Math.pow(p1, 2.2);
        w0 = 1 + 12 * Math.pow(p0, 2.2); w1 = 1 + 12 * Math.pow(p1, 2.2);
        g.fillStyle = 'rgba(255,230,180,' + (0.2 + .75 * p0).toFixed(2) + ')';
        g.beginPath(); g.moveTo(vx - w0 / 2, y0); g.lineTo(vx + w0 / 2, y0); g.lineTo(vx + w1 / 2, y1); g.lineTo(vx - w1 / 2, y1); g.fill();
      }
      for (i = 0; i < 6; i++) {
        var p = ((i + S.off * 2) / 6) % 1, q = Math.pow(p, 2.2), y = hz + D * q, x = (W * .6 + 12) * q, h = 4 + H * .26 * q, s = .12 + q * 1.5;
        for (var side = -1; side <= 1; side += 2) {
          var px = vx + side * (x + 6);
          g.fillStyle = 'rgba(14,11,20,' + (0.35 + q * .65).toFixed(2) + ')'; g.fillRect(px - 1 - q * 2, y - h, 2 + q * 4, h);
          g.globalAlpha = .2 + q * .8; g.drawImage(S.lamp, px - 48 * s, y - h - 48 * s, 96 * s, 96 * s); g.globalAlpha = 1;
        }
      }
    } };

  SC.city = { name: 'المدينة', sub: 'أبراج وأضواء وطريق سريع', acc: [90, 200, 255],
    init: function (W, H) {
      var base = Math.round(H * .72), wins = [], R = rng(7), towerX = W * .62, towerTop = base - H * .52;
      var bg = layer(W, H, function (g) {
        g.fillStyle = vgrad(g, 0, base, [[0, '#03040f'], [.7, '#121640'], [1, '#2a2350']]); g.fillRect(0, 0, W, H);
        stars(g, W, H * .35, Math.round(W * H / 14000), 3, .5);
        var cg = g.createRadialGradient(W * .5, base, 0, W * .5, base, W * .55);
        cg.addColorStop(0, 'rgba(255,140,90,.28)'); cg.addColorStop(1, 'rgba(255,140,90,0)'); g.fillStyle = cg; g.fillRect(0, 0, W, base);
        [['#121543', .12, .28, 0], ['#0b0d2d', .1, .42, 1], ['#06071a', .06, .24, 1]].forEach(function (Lr, li) {
          var x = -10;
          while (x < W) {
            var bw = W * (.025 + R() * .045), bh = H * (Lr[1] + R() * (Lr[2] - Lr[1]));
            if (li === 1 && Math.abs(x - towerX) < bw) { bw = W * .03; bh = base - towerTop; }
            g.fillStyle = Lr[0]; g.fillRect(x, base - bh, bw, bh + 2);
            if (Lr[3]) for (var wy = base - bh + 8; wy < base - 6; wy += 9) for (var wx = x + 4; wx < x + bw - 5; wx += 8) {
              if (R() < .3) {
                var c = R() < .7 ? '255,214,150' : '160,215,255', a = .45 + R() * .5;
                g.fillStyle = 'rgba(' + c + ',' + a.toFixed(2) + ')'; g.fillRect(wx, wy, 3, 4);
                if (R() < .08 && wins.length < 160) wins.push([wx, wy, Lr[0]]);
              }
            }
            x += bw + W * .004;
          }
        });
        g.fillStyle = '#04050c'; g.fillRect(0, base, W, H - base);
        g.fillStyle = 'rgba(120,140,220,.35)'; g.fillRect(0, base, W, 2);
        g.fillStyle = 'rgba(255,255,255,.08)';
        for (var lx = 0; lx < W; lx += 46) g.fillRect(lx, base + (H - base) * .5, 22, 2);
      });
      var cars = [], lanes = [.2, .38, .64, .82];
      for (var i = 0; i < 28; i++) cars.push({ l: i % 4, x: R() * W, sp: .08 + R() * .1, len: 18 + R() * 40 });
      return { bg: bg, base: base, wins: wins, off: {}, cars: cars, lanes: lanes, tx: towerX + W * .015, ty: towerTop - 6, red: glow(14, '255,60,60') };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      if (S.wins.length) {
        for (var k = 0; k < 2; k++) { var n = (Math.random() * S.wins.length) | 0; S.off[n] = !S.off[n]; }
        for (var key in S.off) if (S.off[key]) { var w = S.wins[key]; g.fillStyle = w[2]; g.fillRect(w[0], w[1], 3, 4); }
      }
      if (Math.sin(t * 3) > .2) g.drawImage(S.red, S.tx - 14, S.ty - 14);
      var D = H - S.base;
      g.globalCompositeOperation = 'lighter';
      S.cars.forEach(function (c) {
        var dir = c.l < 2 ? -1 : 1, y = S.base + D * S.lanes[c.l];
        c.x += dir * c.sp * W * dt * (0.35 + v * 1.4);
        if (c.x < -60) c.x = W + 60; if (c.x > W + 60) c.x = -60;
        var col = dir < 0 ? '255,70,70' : '255,240,210';
        g.strokeStyle = 'rgba(' + col + ',.22)'; g.lineWidth = 7; g.beginPath(); g.moveTo(c.x, y); g.lineTo(c.x - dir * c.len, y); g.stroke();
        g.strokeStyle = 'rgba(' + col + ',.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(c.x, y); g.lineTo(c.x - dir * c.len * .7, y); g.stroke();
      });
      g.globalCompositeOperation = 'source-over';
    } };

  SC.aurora = { name: 'الشفق', sub: 'ستائر ضوء فوق الجبال', acc: [90, 255, 170],
    init: function (W, H) {
      var bg = layer(W, H, function (g) {
        g.fillStyle = vgrad(g, 0, H, [[0, '#01040c'], [.6, '#04131f'], [1, '#072421']]); g.fillRect(0, 0, W, H);
        stars(g, W, H * .7, Math.round(W * H / 5000), 23, .8);
      });
      var fg = layer(W, H, function (g) {
        jagged(g, W, H * .78, H * .1, '#06121a', 41, H + 2);
        jagged(g, W, H * .86, H * .07, '#030a10', 57, H + 2);
      });
      function strip(rgb) {
        return layer(6, 256, function (g) {
          g.fillStyle = vgrad(g, 0, 256, [[0, 'rgba(' + rgb + ',0)'], [.65, 'rgba(' + rgb + ',.4)'], [.93, 'rgba(' + rgb + ',.95)'], [1, 'rgba(' + rgb + ',0)']]);
          g.fillRect(0, 0, 6, 256);
        });
      }
      return { bg: bg, fg: fg, rib: [
        { s: strip('90,255,170'), y: H * .42, a: H * .07, k: 2.2, w: .25, h: H * .3, ph: 0 },
        { s: strip('70,215,255'), y: H * .34, a: H * .06, k: 3.1, w: -.18, h: H * .24, ph: 2 },
        { s: strip('185,120,255'), y: H * .28, a: H * .05, k: 1.6, w: .12, h: H * .2, ph: 4 }] };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      g.globalCompositeOperation = 'lighter';
      var tt = t * (1 + v * .6);
      S.rib.forEach(function (r) {
        for (var x = -10; x < W + 10; x += 10) {
          var u = x / W, y = r.y + r.a * Math.sin(u * r.k * TAU * .5 + tt * r.w + r.ph) + r.a * .5 * Math.sin(u * 7.3 - tt * .4 + r.ph);
          var h = r.h * (.6 + .4 * Math.sin(u * 5.1 + tt * .3 + r.ph));
          g.globalAlpha = Math.max(0, .35 + .3 * Math.sin(u * 9.7 - tt * .7 + r.ph));
          g.drawImage(r.s, x, y - h, 12, h);
        }
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(S.fg, 0, 0);
    } };

  SC.warp = { name: 'فضاء', sub: 'نجوم تمر جنبك — تسرع مع السيارة', acc: [150, 175, 255],
    init: function (W, H) {
      var R = rng(5), st = [];
      for (var i = 0; i < 440; i++) st.push({ x: R() * 2 - 1, y: R() * 2 - 1, z: .05 + R() * .95 });
      var bg = layer(W, H, function (g) {
        var x = g.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .45, W * .7);
        x.addColorStop(0, '#0d1033'); x.addColorStop(1, '#010208'); g.fillStyle = x; g.fillRect(0, 0, W, H);
        g.globalAlpha = .5; g.drawImage(glow(Math.round(H * .4), '120,80,220', .1), W * .15, H * .1); g.drawImage(glow(Math.round(H * .3), '60,140,255', .1), W * .6, H * .45); g.globalAlpha = 1;
      });
      return { bg: bg, st: st, R: R };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      var cx = W * .5, cy = H * .45, F = W * .32, sp = (.07 + v * .55) * dt;
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#dfe6ff';
      S.st.forEach(function (s) {
        var pz = s.z; s.z -= sp;
        if (s.z <= .02) { s.x = S.R() * 2 - 1; s.y = S.R() * 2 - 1; s.z = 1; return; }
        var x = cx + s.x / s.z * F, y = cy + s.y / s.z * F, px = cx + s.x / pz * F, py = cy + s.y / pz * F;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) { s.z = 1; s.x = S.R() * 2 - 1; s.y = S.R() * 2 - 1; return; }
        g.globalAlpha = Math.min(1, .3 + (1 - s.z) * 1.2); g.lineWidth = 1 + (1 - s.z) * 2.4;
        g.beginPath(); g.moveTo(px, py); g.lineTo(x + 1, y + 1); g.stroke();
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } };

  SC.sea = { name: 'البحر', sub: 'غروب على الكورنيش', acc: [255, 150, 100],
    init: function (W, H) {
      var hz = Math.round(H * .58), sx = W * .5, sr = H * .085;
      var bg = layer(W, H, function (g) {
        g.fillStyle = vgrad(g, 0, hz, [[0, '#1a1946'], [.55, '#743a6a'], [.85, '#e86d5c'], [1, '#ffb070']]); g.fillRect(0, 0, W, hz);
        g.drawImage(glow(Math.round(H * .3), '255,170,110', .15), sx - H * .3, hz - H * .3);
        g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(sx, hz - sr * .35, sr, 0, TAU); g.fill();
        g.fillStyle = vgrad(g, hz, H, [[0, '#4a2d5c'], [.4, '#231b46'], [1, '#090b1e']]); g.fillRect(0, hz, W, H - hz);
        g.fillStyle = '#2a1838';   // far shore with a few lights
        g.fillRect(0, hz - 6, W * .22, 6); g.fillRect(W * .8, hz - 8, W * .2, 8);
        g.fillStyle = 'rgba(255,215,150,.8)';
        for (var i = 0; i < 18; i++) g.fillRect((i < 9 ? i * W * .022 : W * .8 + (i - 9) * W * .021) + 4, hz - 4, 2, 2);
        g.fillStyle = '#0d0716';   // a palm on the right
        g.beginPath(); g.moveTo(W * .9, H); g.quadraticCurveTo(W * .88, H * .62, W * .93, H * .4); g.lineTo(W * .935, H * .405); g.quadraticCurveTo(W * .895, H * .62, W * .915, H); g.fill();
        for (var f = 0; f < 7; f++) {
          var an = -2.7 + f * .62; g.beginPath(); g.moveTo(W * .932, H * .4);
          g.quadraticCurveTo(W * .932 + Math.cos(an) * W * .06, H * .4 + Math.sin(an) * H * .08 - H * .03, W * .932 + Math.cos(an) * W * .1, H * .4 + Math.sin(an) * H * .1 + H * .04);
          g.lineTo(W * .932 + Math.cos(an) * W * .095, H * .4 + Math.sin(an) * H * .1 + H * .05);
          g.quadraticCurveTo(W * .932 + Math.cos(an) * W * .05, H * .4 + Math.sin(an) * H * .06, W * .932, H * .41); g.fill();
        }
      });
      return { bg: bg, hz: hz, sx: sx, birds: [{ x: .2, y: .2, s: 1 }, { x: .27, y: .24, s: .8 }, { x: .31, y: .19, s: .7 }] };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      var hz = S.hz, D = H - hz, sp = .6 + v;
      for (var i = 1; i < 16; i++) {
        var q = Math.pow(i / 16, 1.7), y = hz + D * q, amp = 1 + q * 5;
        g.strokeStyle = 'rgba(255,190,160,' + (0.05 + .1 * (1 - q)).toFixed(3) + ')'; g.lineWidth = 1 + q * 1.5;
        g.beginPath();
        for (var x = 0; x <= W; x += 24) { var yy = y + Math.sin(x * (0.02 / (q + .2)) + t * sp * 1.5 + i) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
        g.stroke();
      }
      var seed = Math.floor(t * 6), R = rng(seed + 1);
      g.fillStyle = 'rgba(255,220,170,.85)';
      for (var k = 0; k < 46; k++) {
        var qq = R(), yk = hz + 4 + D * Math.pow(qq, 1.5), spread = W * (.015 + .09 * qq), xk = S.sx + (R() - .5) * 2 * spread;
        if (R() < .7) g.fillRect(xk, yk, 3 + qq * 14, 1 + qq * 1.5);
      }
      g.strokeStyle = 'rgba(30,15,35,.8)'; g.lineWidth = 2;
      S.birds.forEach(function (b, n) {
        b.x += dt * .012 * (1 + n * .2); if (b.x > 1.1) b.x = -.1;
        var bx = b.x * W, by = b.y * H + Math.sin(t + n) * 4, wg = Math.sin(t * 6 + n) * 4 * b.s, s = 9 * b.s;
        g.beginPath(); g.moveTo(bx - s, by - wg); g.quadraticCurveTo(bx - s * .4, by - s * .3, bx, by); g.quadraticCurveTo(bx + s * .4, by - s * .3, bx + s, by - wg); g.stroke();
      });
    } };

  SC.rain = { name: 'مطر', sub: 'قطرات على الزجاج وأضواء بعيدة', acc: [120, 190, 255],
    init: function (W, H) {
      var R = rng(13);
      var bg = layer(W, H, function (g) { g.fillStyle = vgrad(g, 0, H, [[0, '#060812'], [1, '#121a2e']]); g.fillRect(0, 0, W, H); });
      var bok = layer(W * 1.5, H, function (g, w) {
        var cols = ['255,170,90', '255,120,80', '120,190,255', '255,225,160', '200,120,255'];
        for (var i = 0; i < 46; i++) {
          var r = H * (.03 + R() * .09), x = R() * w, y = H * (.25 + R() * .6), c = cols[(R() * cols.length) | 0];
          var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + c + ',.32)'); gr.addColorStop(.75, 'rgba(' + c + ',.18)'); gr.addColorStop(1, 'rgba(' + c + ',0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
      });
      var drop = layer(24, 24, function (g) {
        var gr = g.createRadialGradient(9, 8, 1, 12, 12, 12);
        gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.35, 'rgba(180,200,230,.25)'); gr.addColorStop(.85, 'rgba(10,15,30,.35)'); gr.addColorStop(1, 'rgba(10,15,30,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(12, 12, 11, 0, TAU); g.fill();
      });
      var drops = [], lines = [];
      for (var i = 0; i < 80; i++) drops.push({ x: R() * W, y: R() * H, r: 2 + R() * 6, sl: R() < .22 ? 40 + R() * 90 : 0 });
      for (var j = 0; j < 90; j++) lines.push({ x: R() * W, y: R() * H, l: 10 + R() * 22, s: 500 + R() * 400 });
      return { bg: bg, bok: bok, drop: drop, drops: drops, lines: lines, R: R };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.bg, 0, 0);
      var off = (t * 6) % (W * .5);
      g.drawImage(S.bok, -off, 0); if (W * 1.5 - off < W) g.drawImage(S.bok, W * 1.5 - off, 0);
      var slant = .15 + v * .5;
      g.strokeStyle = 'rgba(190,210,255,.13)'; g.lineWidth = 1; g.beginPath();
      S.lines.forEach(function (l) {
        l.y += l.s * dt; l.x -= l.s * dt * slant; if (l.y > H) { l.y = -20; l.x = S.R() * W * 1.3; }
        g.moveTo(l.x, l.y); g.lineTo(l.x + l.l * slant, l.y - l.l);
      });
      g.stroke();
      S.drops.forEach(function (d) {
        if (d.sl) {
          d.y += d.sl * dt * (1 + v); g.fillStyle = 'rgba(200,215,240,.12)'; g.fillRect(d.x - d.r * .25, d.y - d.r * 6, d.r * .5, d.r * 6);
          if (d.y > H + 10) { d.y = -10; d.x = S.R() * W; }
        }
        g.drawImage(S.drop, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      });
    } };

  SC.flow = { name: 'انسياب', sub: 'خيوط ضوء تتمايل', acc: [190, 120, 255], trails: true,
    init: function (W, H) {
      var R = rng(31), ps = [];
      for (var i = 0; i < 480; i++) ps.push({ x: R() * W, y: R() * H, c: i % 3 });
      return { ps: ps, R: R, fresh: true };
    },
    frame: function (g, S, W, H, t, dt, v) {
      if (S.fresh) { g.fillStyle = '#06041a'; g.fillRect(0, 0, W, H); S.fresh = false; }
      g.fillStyle = 'rgba(6,4,26,.1)'; g.fillRect(0, 0, W, H);
      var sp = 48 * (.55 + v * 1.2) * dt, cols = ['rgba(190,120,255,.6)', 'rgba(80,210,255,.55)', 'rgba(255,110,200,.5)'];
      g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.4;
      for (var c = 0; c < 3; c++) {
        g.strokeStyle = cols[c]; g.beginPath();
        for (var i = c; i < S.ps.length; i += 3) {
          var p = S.ps[i], a = (Math.sin(p.x * .0034 + t * .15) + Math.cos(p.y * .0041 - t * .12)) * Math.PI;
          var nx = p.x + Math.cos(a) * sp, ny = p.y + Math.sin(a) * sp;
          g.moveTo(p.x, p.y); g.lineTo(nx, ny); p.x = nx; p.y = ny;
          if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || S.R() < .004) { p.x = S.R() * W; p.y = S.R() * H; }
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    } };

  SC.dunes = { name: 'كثبان الضحى', sub: 'قافلة تمشي على الرمال', acc: [240, 160, 70], bright: true,
    init: function (W, H) {
      var hz = Math.round(H * .55), R = rng(19);
      var sky = layer(W, H, function (g) {
        g.fillStyle = vgrad(g, 0, hz + H * .1, [[0, '#5fa8e6'], [.65, '#cfe7f5'], [1, '#f7dcae']]); g.fillRect(0, 0, W, H);
        g.drawImage(glow(Math.round(H * .22), '255,250,220', .2), W * .8 - H * .22, H * .17 - H * .22);
        g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(W * .8, H * .17, H * .045, 0, TAU); g.fill();
      });
      function strip(y, amp, c1, c2, seed, camels) {
        return layer(W * 2, H, function (g, w) {
          var gr = vgrad(g, y - amp, H, [[0, c1], [1, c2]]);
          ridge(g, w, y, amp, gr, seed, H + 2, W);
          if (camels) {
            g.fillStyle = '#5a3418';
            for (var k = 0; k < 2; k++) for (var n = 0; n < 4; n++) {
              var cx = W * (.18 + k + n * .045), u = cx / W * TAU, rr = rng(seed);
              var k1 = 1 + Math.floor(rr() * 2), k2 = 2 + Math.floor(rr() * 3), p1 = rr() * TAU, p2 = rr() * TAU;
              var cy = y - amp * (0.62 * Math.sin(u * k1 + p1) + 0.38 * Math.sin(u * k2 + p2)), s = H * .022;
              g.beginPath(); g.ellipse(cx, cy - s * 1.3, s * 1.1, s * .55, 0, 0, TAU); g.fill();
              g.beginPath(); g.ellipse(cx - s * .1, cy - s * 1.85, s * .45, s * .4, 0, 0, TAU); g.fill();
              g.fillRect(cx + s * .8, cy - s * 2.2, s * .28, s * .9); g.fillRect(cx + s * .85, cy - s * 2.35, s * .55, s * .25);
              g.fillRect(cx - s * .8, cy - s * 1.1, s * .16, s * 1.1); g.fillRect(cx + s * .55, cy - s * 1.1, s * .16, s * 1.1);
            }
          }
        });
      }
      var strips = [
        { c: strip(hz, H * .05, '#efc58a', '#e3ad6c', 3, false), sp: 5 },
        { c: strip(hz + H * .1, H * .06, '#e3a663', '#cf8a49', 7, true), sp: 13 },
        { c: strip(hz + H * .24, H * .07, '#d38d4b', '#b56f35', 9, false), sp: 30 }];
      var sand = [];
      for (var i = 0; i < 70; i++) sand.push({ x: R() * W, y: hz + R() * (H - hz), s: 30 + R() * 60 });
      return { sky: sky, strips: strips, sand: sand, R: R };
    },
    frame: function (g, S, W, H, t, dt, v) {
      g.drawImage(S.sky, 0, 0);
      var m = .35 + v * 1.6;
      S.strips.forEach(function (s) {
        s.o = ((s.o || 0) + s.sp * m * dt) % W;
        g.drawImage(s.c, -s.o, 0);
      });
      g.fillStyle = 'rgba(255,240,215,.45)';
      S.sand.forEach(function (p) {
        p.x -= p.s * m * dt; p.y += Math.sin(t * 2 + p.x * .02) * .3;
        if (p.x < -4) { p.x = W + 4; p.y = H * .55 + S.R() * H * .45; }
        g.fillRect(p.x, p.y, 2, 1.5);
      });
    } };

  var KEYS = ['desert', 'city', 'aurora', 'warp', 'sea', 'rain', 'flow', 'dunes'];
  L.scenes = SC; L.keys = KEYS;

  // ---------- engine ----------
  var cv = null, g = null, W = 0, H = 0, S = null, key = null, raf = 0, last = 0, running = false, paused = false, sp = 0, autoT = 0;
  function cur() { var k = App.settings.liveBg; return SC[k] ? k : 'desert'; }
  function speedFactor() {
    if (App.settings.liveSpeed === false) return 0;
    var f = App.loc && App.loc.fix, s = f && f.src !== 'last' && Date.now() - f.t < 6000 ? f.speed || 0 : 0;
    sp += (s - sp) * .05;
    return Math.min(2, Math.max(0, sp / 60));
  }
  function size() {
    if (!cv) return;
    var w = window.innerWidth, h = window.innerHeight;
    if (w === W && h === H && S) return;
    W = cv.width = w; H = cv.height = h; S = SC[key].init(W, H);
  }
  // the accent follows the world on screen; only values set here are ever removed (the glass skin tints too)
  var tinted = {};
  function tint() {
    var a = SC[key].acc, rgb = a.join(', ');
    tinted = { '--accent': 'rgb(' + rgb + ')', '--accent-rgb': rgb, '--pri-a': 'rgb(' + a.map(function (x) { return Math.min(255, x + 30); }).join(', ') + ')', '--pri-b': 'rgb(' + rgb + ')' };
    for (var p in tinted) document.body.style.setProperty(p, tinted[p]);
  }
  function bright() { var fx = App.$('fx'); if (fx) fx.classList.toggle('lv-bright', !!SC[key].bright); }
  function untint() {
    var st = document.body.style;
    for (var p in tinted) if (st.getPropertyValue(p).trim() === tinted[p]) st.removeProperty(p);
    tinted = {};
  }
  function loop(ts) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (paused || document.hidden || ts - last < 32) return;
    var dt = last ? Math.min(.1, (ts - last) / 1000) : .033; last = ts;
    if (App.settings.liveAuto && Date.now() - autoT > 30 * 60000) { autoT = Date.now(); L.set(KEYS[(KEYS.indexOf(key) + 1) % KEYS.length], true); return; }
    try { SC[key].frame(g, S, W, H, ts / 1000, dt, speedFactor()); } catch (e) { running = false; }
  }
  L.start = function () {
    cv = document.getElementById('liveCv');
    if (!cv) return;
    g = cv.getContext('2d'); key = cur(); S = null; W = H = 0; size(); tint(); bright();
    if (!autoT) autoT = Date.now();
    if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
  };
  L.stop = function () { running = false; cancelAnimationFrame(raf); cv = g = S = null; untint(); };
  L.set = function (k, quiet) {
    if (!SC[k]) return;
    App.settings.liveBg = k; App.saveSettings();
    if (running) { key = k; S = null; W = H = 0; size(); tint(); bright(); }
    if (!quiet) App.toast('الخلفية: ' + SC[k].name);
  };

  // ---------- picker ----------
  function thumb(k, w, h) {
    return layer(w, h, function (tg) {
      var st = SC[k].init(w, h);
      for (var i = 0; i < 24; i++) SC[k].frame(tg, st, w, h, 3 + i * .05, .05, .4);
    });
  }
  L.picker = function () {
    App.panels.push('الخلفيات الحية', function (body) {
      var s = App.settings, k0 = cur();
      body.innerHTML = '<div class="lv-grid">' + KEYS.map(function (k) {
        return '<button class="lv-card' + (k === k0 ? ' on' : '') + '" data-k="' + k + '"><span class="lv-th" id="lvTh_' + k + '"></span>' +
          '<b>' + SC[k].name + '</b><small>' + SC[k].sub + '</small></button>';
      }).join('') + '</div>' +
        '<div class="set-row"><div class="txt"><b>تتحرك مع سرعة السيارة</b><small>كل ما زادت السرعة (من الـGPS) زادت حركة الخلفية</small></div>' +
        '<button class="switch' + (s.liveSpeed !== false ? ' on' : '') + '" id="lvSpd" aria-label="مع السرعة"></button></div>' +
        '<div class="set-row"><div class="txt"><b>تبديل تلقائي</b><small>خلفية جديدة كل نص ساعة</small></div>' +
        '<button class="switch' + (s.liveAuto ? ' on' : '') + '" id="lvAuto" aria-label="تبديل تلقائي"></button></div>';
      KEYS.forEach(function (k, i) {
        setTimeout(function () { var el = App.$('lvTh_' + k); if (el && !el.firstChild) { var c = thumb(k, 240, 135); el.appendChild(c); } }, 40 + i * 60);
      });
      body.querySelectorAll('.lv-card').forEach(function (b) {
        b.onclick = function () {
          L.set(b.dataset.k);
          body.querySelectorAll('.lv-card').forEach(function (x) { x.classList.toggle('on', x === b); });
        };
      });
      App.$('lvSpd').onclick = function () { s.liveSpeed = s.liveSpeed === false; App.saveSettings(); this.classList.toggle('on', s.liveSpeed !== false); };
      App.$('lvAuto').onclick = function () { s.liveAuto = !s.liveAuto; App.saveSettings(); this.classList.toggle('on', !!s.liveAuto); autoT = Date.now(); };
    });
  };

  // ---------- fuel economy card (km/L, from the car) ----------
  var GMAX = 25;
  function fuelPaint() {
    var el = App.$('wFuel');
    if (!el || App.theme.key !== 'live') return;
    var f = App.cdata && App.cdata.fuel, fresh = App.cdata && App.cdata.fresh(), has = App.cdata && App.cdata.hasSource();
    var now = f && (f.inst != null ? f.inst : f.avg), arc = App.$('fuArc');
    var frac = now != null ? Math.max(0, Math.min(1, now / GMAX)) : 0;
    arc.setAttribute('stroke-dasharray', (frac * 100).toFixed(1) + ' 100');
    var dot = App.$('fuDot'), a = Math.PI * (1 - frac);
    dot.setAttribute('cx', (110 + 90 * Math.cos(a)).toFixed(1)); dot.setAttribute('cy', (108 - 90 * Math.sin(a)).toFixed(1));
    dot.style.opacity = now != null ? 1 : 0;
    App.$('fuNow').textContent = now != null ? App.d(now.toFixed(1)) : '—';
    App.$('fuAvg').textContent = f && f.avg != null ? App.d(f.avg.toFixed(1)) : '—';
    App.$('fuRange').textContent = f && f.range != null ? App.d(Math.round(f.range)) + ' كم' : '—';
    var tag = App.$('fuTag');
    tag.textContent = fresh ? 'مباشر من السيارة' : f ? 'آخر قراءة' : has ? 'بانتظار السيارة' : 'اربط بيانات السيارة';
    tag.className = 'w-tag' + (fresh ? ' ok' : '');
    el.classList.toggle('stale', !fresh);
  }
  function fuelInfo() {
    App.panels.push('استهلاك البنزين', function (body) {
      var has = App.cdata.hasSource();
      body.innerHTML = '<div class="big-status' + (has ? ' on' : '') + '">' + App.icon('fuel') + '<div class="txt"><b>' +
        (App.cdata.fresh() ? 'القراءة توصل مباشرة من السيارة' : has ? 'رحلة تسمع لبيانات السيارة — بانتظار الاستهلاك' : 'رحلة ما تعرف للحين وين بيانات السيارة في شاشتك') +
        '</b><small>الاستهلاك اللحظي والمتوسط والمسافة المتبقية تطلع في العداد من كمبيوتر السيارة. توصل للشاشة عن طريق تطبيقات الشاشة نفسها (مثل Car Manager)، ورحلة تلتقطها إذا الشاشة تبثّها.</small></div></div>' +
        '<div class="note">للربط: افتح «فحص بيانات السيارة» تحت، وافتح Car Manager أو TPMS دقيقة، وارجع اضغط «إرسال الفحص بالنت» وأرسل الرمز في المحادثة — أكمّل الربط على بياناتك بالضبط.</div>' +
        '<div class="btn-row"><button class="btn primary" id="fuProbe">' + App.icon('search') + 'فحص بيانات السيارة</button></div>';
      App.$('fuProbe').onclick = function () { if (App.tires && App.tires.probe) App.tires.probe(); };
    });
  }

  // ---------- wiring ----------
  L.init = function () {
    var b = App.$('lvBg'); if (b) b.onclick = L.picker;
    var fu = App.$('wFuel'); if (fu) fu.onclick = fuelInfo;
    App.on('skin', function (k) {
      if (k !== 'live') { if (running) L.stop(); return; }
      setTimeout(function () { L.start(); fuelPaint(); }, 0);
    });
    App.on('panel', function (n) { paused = !!n; });
    App.on('car', fuelPaint);
    window.addEventListener('resize', function () { if (running) size(); });
    setInterval(fuelPaint, 5000);
    if (App.theme.key === 'live') { L.start(); fuelPaint(); }
  };
})();
