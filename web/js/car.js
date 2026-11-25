/* car.js — data that comes from the car itself, through the head unit.
   The screen's own apps (TPMS, Car Manager) receive the car's CAN data; when they share it as Android
   broadcasts, Rihla listens to the same broadcasts (the action names come from «فحص الحساس») and picks the
   values it understands. Nothing here invents numbers: no broadcast, no reading. */
(function () {
  'use strict';
  var C = App.cdata = { fuel: null };
  var RANGE = /range|remain|dte|endur|left_?km|km_?left/;

  function num(v) {
    var x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }

  // fuel economy from whatever keys the broadcast carries: km/L kept as is, L/100km turned into km/L
  C.ingest = function (o) {
    if (!o || !o.x || typeof o.x !== 'object') return;
    var f = {}, hit = false;
    (function walk(obj, pre, depth) {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k], key = (pre + k).toLowerCase();
        if (v && typeof v === 'object' && !Array.isArray(v)) { if (depth < 2) walk(v, key + '.', depth + 1); return; }
        var x = num(v);
        if (x == null) return;
        var fuelKey = /fuel|oil_?cons|consum|economy|kml|km_?l\b|l_?100|mpg/.test(key);
        if (RANGE.test(key) && (fuelKey || /km|range|mile|dte/.test(key))) { if (x >= 0 && x < 2000) { f.range = x; hit = true; } return; }
        if (!fuelKey) return;
        var kml = /100/.test(key) ? (x > 0 ? 100 / x : null) : (/mpg/.test(key) ? x * 0.425 : x);
        if (kml == null || kml <= 0 || kml > 60) return;
        if (/inst|cur|now|real|moment|live/.test(key)) f.inst = kml;
        else if (/avg|aver|mean|trip/.test(key)) f.avg = kml;
        else if (f.inst == null) f.inst = kml;
        hit = true;
      });
    })(o.x, '', 0);
    if (!hit) return;
    C.fuel = Object.assign({}, C.fuel || {}, f, { t: Date.now(), src: o.a });
    App.emit('car');
  };

  // keep listening to the screen's car broadcasts all the time (the list is saved by «فحص الحساس»)
  C.listen = function () {
    var acts = App.store.get('carActs', null);
    if (App.Native.has && acts && acts.length) App.Native.call('listen', JSON.stringify(acts));
  };
  C.hasSource = function () { var a = App.store.get('carActs', null); return !!(a && a.length); };
  C.fresh = function () { return C.fuel && Date.now() - C.fuel.t < 20000; };

  C.init = function () { C.listen(); };
})();
