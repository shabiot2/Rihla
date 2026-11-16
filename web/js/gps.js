/* gps.js — location intake (native GPS first, WebView geolocation as fallback). No speedometer any more:
   the position feeds the prayer times, the city, nearby places and the GPS odometer for maintenance. */
(function () {
  'use strict';
  var L = App.loc = {
    fix: null,          // {lat, lon, speed(km/h), heading, acc, alt, t, src}
    lastNative: 0,
    heading: null
  };
  var prev = null, watchId = null;

  function handle(lat, lon, mps, hasSpeed, bearing, hasBearing, acc, alt, src) {
    if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) return;
    var now = Date.now();
    var kmh = hasSpeed && isFinite(mps) && mps >= 0 ? mps * 3.6 : null;
    var moved = 0, dt = 0;
    if (prev) {
      moved = App.geo.dist(prev.lat, prev.lon, lat, lon);
      dt = (now - prev.t) / 1000;
      if (kmh == null && dt > 0.4 && dt < 6) kmh = moved / dt * 3.6;
    }
    if (kmh == null) kmh = 0;
    if (kmh > 320) kmh = prev ? prev.speed : 0;          // outlier
    if (kmh < 1.5) kmh = 0;                                // stationary jitter
    var heading = L.heading;
    if (hasBearing && kmh > 3 && isFinite(bearing)) heading = bearing;
    else if (prev && moved > 6 && kmh > 3) heading = App.geo.bearing(prev.lat, prev.lon, lat, lon);
    L.heading = heading;
    // distance driven (the maintenance odometer in tasks.js listens to this)
    if (prev && dt > 0 && dt < 10 && kmh > 2 && (acc || 0) < 60 && moved < dt * 90) App.emit('moved', moved);
    var fix = { lat: lat, lon: lon, speed: kmh, heading: heading, acc: acc, alt: alt, t: now, src: src };
    prev = fix;
    L.fix = fix;
    App.emit('loc', fix);
  }
  // a remembered position (from before the engine started)
  function lastKnown(lat, lon, acc, alt, time) {
    if (L.fix && L.fix.src !== 'last') return;
    L.fix = { lat: lat, lon: lon, speed: 0, heading: L.heading, acc: acc, alt: alt, t: Date.now(), src: 'last', when: time };
    App.emit('loc', L.fix);
  }

  // satellites from the head unit's GPS receiver (Android 7+)
  window.onGnss = function (used, total) { L.sats = { used: used, total: total, t: Date.now() }; };

  // called by the Android shell (see app_code.py)
  window.onNativeLoc = function (lat, lon, spd, hasSpd, brg, hasBrg, acc, time, alt) {
    if (time > 0 && Date.now() - time > 120000) { lastKnown(lat, lon, acc, alt, time); return; }
    L.lastNative = Date.now();
    handle(lat, lon, spd, hasSpd, brg, hasBrg, acc, alt, 'gps');
  };

  function startWeb() {
    if (!navigator.geolocation || watchId != null) return;
    try {
      watchId = navigator.geolocation.watchPosition(function (p) {
        if (Date.now() - L.lastNative < 4000) return;      // native GPS has priority
        var c = p.coords;
        handle(c.latitude, c.longitude, c.speed, c.speed != null && !isNaN(c.speed), c.heading,
          c.heading != null && !isNaN(c.heading), c.accuracy, c.altitude, 'web');
      }, function () { watchId = null; }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    } catch (e) { watchId = null; }
  }
  window.onPerm = function () {
    if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { } watchId = null; }
    startWeb();
  };

  // a one-line description of the GPS state (settings / «where am I»)
  L.status = function () {
    var f = L.fix, now = Date.now(), sat = L.sats && now - L.sats.t < 15000 ? L.sats : null;
    var stale = !f || f.src === 'last' || now - f.t > 6000;
    if (!f) return 'جارٍ البحث عن إشارة GPS…' + (sat ? ' (' + App.d(sat.total) + ' قمر مرئي)' : '');
    if (f.src === 'last') return 'آخر موقع معروف — جارٍ التقاط الأقمار';
    if (stale) return 'إشارة GPS ضعيفة';
    return (f.src === 'gps' ? 'GPS السيارة' : 'موقع تقريبي') + (sat ? ' • ' + App.d(sat.used) + '/' + App.d(sat.total) + ' قمر' : '') +
      ' • ±' + App.d(Math.round(f.acc || 0)) + ' م';
  };
  L.start = function () { startWeb(); };
})();
