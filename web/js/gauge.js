/* gauge.js — silver-bezel GPS speedometer (SVG) */
(function () {
  'use strict';
  var MAX = 240, START = 135, SWEEP = 270, CX = 150, CY = 150;
  var NS = 'http://www.w3.org/2000/svg';
  var G = App.gauge = { shown: 0, target: 0 };
  var el = {};

  function pt(a, r) { a = a * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
  function ang(v) { return START + SWEEP * Math.min(MAX, Math.max(0, v)) / MAX; }

  G.init = function (host) {
    var C = 2 * Math.PI * 118;
    var ticks = '', labels = '';
    for (var v = 0; v <= MAX; v += 10) {
      var major = v % 20 === 0, a = ang(v);
      var p1 = pt(a, major ? 128 : 132), p2 = pt(a, 139);
      ticks += '<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) +
        '" y2="' + p2[1].toFixed(1) + '" stroke="' + (major ? '#e8ecef' : '#6d7882') + '" stroke-width="' +
        (major ? 3 : 1.6) + '" stroke-linecap="round"/>';
      if (major) {
        var lp = pt(a, 102);
        labels += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 5).toFixed(1) + '" class="g-lbl">' + v + '</text>';
      }
    }
    host.innerHTML =
      '<svg viewBox="0 0 300 300">' +
      '<defs>' +
      '<linearGradient id="gBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bezel-0)"/><stop offset=".35" style="stop-color:var(--bezel-1)"/>' +
      '<stop offset=".55" style="stop-color:var(--bezel-2)"/><stop offset=".8" style="stop-color:var(--bezel-3)"/><stop offset="1" style="stop-color:var(--bezel-4)"/></linearGradient>' +
      '<radialGradient id="gFace" cx=".5" cy=".42" r=".62"><stop offset="0" style="stop-color:var(--face-a)"/><stop offset=".75" style="stop-color:var(--face-b)"/><stop offset="1" style="stop-color:var(--face-c)"/></radialGradient>' +
      '<linearGradient id="gArc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:var(--gauge-a)"/><stop offset="1" style="stop-color:var(--gauge-b)"/></linearGradient>' +
      '<linearGradient id="gNeedleGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a949d"/><stop offset=".4" stop-color="#e9edf0"/><stop offset=".66" stop-color="#ffffff"/><stop offset=".68" stop-color="#ff4b4f"/><stop offset="1" stop-color="#ff7376"/></linearGradient>' +
      '<radialGradient id="gInner" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--card-a)"/><stop offset=".8" style="stop-color:var(--card-b)"/><stop offset="1" style="stop-color:var(--card-c)"/></radialGradient>' +
      '</defs>' +
      '<circle cx="150" cy="150" r="146" fill="url(#gFace)" stroke="url(#gBezel)" stroke-width="5"/>' +
      '<circle cx="150" cy="150" r="140.5" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="1.5"/>' +
      '<circle cx="150" cy="150" r="118" fill="none" stroke="#1b232c" stroke-width="9" stroke-dasharray="' +
      (C * 0.75).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(135 150 150)" stroke-linecap="round"/>' +
      // soft halo under the progress arc (a wide translucent stroke: cheaper than an SVG blur on head units)
      '<circle id="gHalo" cx="150" cy="150" r="118" fill="none" stroke-opacity=".22" stroke-width="19" stroke-dasharray="0 ' +
      C.toFixed(1) + '" transform="rotate(135 150 150)" stroke-linecap="round"/>' +
      '<circle id="gProg" cx="150" cy="150" r="118" fill="none" stroke="url(#gArc)" stroke-width="9" stroke-dasharray="0 ' +
      C.toFixed(1) + '" transform="rotate(135 150 150)" stroke-linecap="round"/>' +
      ticks + labels +
      '<path id="gLimit" d="M0 0" fill="#ff4b4f"/>' +
      '<circle cx="150" cy="150" r="60" fill="url(#gInner)" stroke="rgba(255,255,255,.07)" stroke-width="1.2"/>' +
      '<circle cx="150" cy="150" r="56" fill="none" stroke="url(#gBezel)" stroke-opacity=".35" stroke-width=".8"/>' +
      // floating pointer: lives in the ring between the centre dial and the labels, never crosses the digits
      '<g id="gNeedle" transform="rotate(135 150 150)">' +
      '<path d="M211 145.6 L240 148.3 Q245 150 240 151.7 L211 154.4 Q208 150 211 145.6 Z" fill="url(#gNeedleGrad)" stroke="rgba(0,0,0,.55)" stroke-width=".8"/>' +
      '</g>' +
      '<text id="gHead" x="150" y="122" class="g-head"></text>' +
      '<text id="gSpeed" x="150" y="170" class="g-speed">0</text>' +
      '<text x="150" y="190" class="g-unit">كم/س</text>' +
      '<text id="gFix" x="150" y="262" class="g-fix"></text>' +
      '</svg>';
    var st = document.createElement('style');
    st.textContent = '#gHalo{stroke:var(--halo)}.g-lbl{fill:var(--text);fill-opacity:.82;font-size:14px;font-weight:700;text-anchor:middle;font-family:var(--f-disp)}' +
      '.g-speed{fill:var(--text);font-size:56px;font-weight:800;text-anchor:middle;font-family:var(--f-disp);letter-spacing:-.5px}' +
      '.g-speed.over{fill:#ff6b6e}' +
      '.g-unit{fill:var(--muted);font-size:13px;font-weight:700;text-anchor:middle;font-family:var(--f-ui)}' +
      '.g-head{fill:var(--accent);font-size:12.5px;font-weight:700;text-anchor:middle;font-family:var(--f-ui)}' +
      '.g-fix{fill:var(--dim);font-size:12px;text-anchor:middle;font-family:var(--f-ui)}';
    host.appendChild(st);
    el.prog = host.querySelector('#gProg');
    el.halo = host.querySelector('#gHalo');
    el.needle = host.querySelector('#gNeedle');
    el.speed = host.querySelector('#gSpeed');
    el.head = host.querySelector('#gHead');
    el.fix = host.querySelector('#gFix');
    el.limit = host.querySelector('#gLimit');
    el.C = C;
    G.setLimit(App.settings.speedLimit);
    requestAnimationFrame(loop);
  };

  G.setLimit = function (lim) {
    var a = ang(lim), p1 = pt(a - 2.2, 147), p2 = pt(a + 2.2, 147), p3 = pt(a, 140);
    el.limit.setAttribute('d', 'M' + p1.join(' ') + ' L' + p2.join(' ') + ' L' + p3.join(' ') + 'Z');
  };

  G.set = function (kmh, info) {
    G.target = Math.max(0, kmh || 0);
    if (info) {
      // LRM marks keep "45°" as one left-to-right unit inside the Arabic line
      el.head.textContent = info.heading == null ? '' : App.geo.dir8(info.heading) + ' \u200E' + App.d(Math.round(info.heading)) + '°\u200E';
      el.fix.textContent = info.text || '';
    }
  };

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.1, (ts - last) / 1000 || 0.016);
    last = ts;
    var diff = G.target - G.shown;
    if (Math.abs(diff) > 0.05) {
      G.shown += diff * Math.min(1, dt * 11);          // snappy: ~0.25 s to settle on a new GPS speed
      var v = G.shown;
      el.needle.setAttribute('transform', 'rotate(' + ang(v).toFixed(2) + ' 150 150)');
      var dash = (el.C * 0.75 * Math.min(v, MAX) / MAX).toFixed(1) + ' ' + el.C.toFixed(1);
      el.prog.setAttribute('stroke-dasharray', dash);
      el.halo.setAttribute('stroke-dasharray', dash);
      var shownInt = Math.round(v);
      if (el.speed._v !== shownInt) {
        el.speed._v = shownInt;
        el.speed.textContent = App.d(shownInt);
        var over = App.settings.speedAlert && shownInt > App.settings.speedLimit;
        el.speed.setAttribute('class', 'g-speed' + (over ? ' over' : ''));
        el.prog.setAttribute('stroke', over ? '#ff4b4f' : 'url(#gArc)');
        el.halo.style.stroke = over ? '#ff4b4f' : '';
      }
    }
    requestAnimationFrame(loop);
  }
  App.on('settings', function () { if (el.limit) G.setLimit(App.settings.speedLimit); });
})();
