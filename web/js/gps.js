/* gps.js — location intake (native GPS first, WebView geolocation fallback), speed, trip computer */
(function () {
  'use strict';
  var L = App.loc = {
    fix: null,          // {lat, lon, speed(km/h), heading, acc, alt, t, src}
    lastNative: 0,
    heading: null,
    trip: App.store.get('trip', { dist: 0, moving: 0, max: 0, start: Date.now() })
  };
  var prev = null, watchId = null, overSince = 0, lastWarnBeep = 0;

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

    // trip computer
    if (prev && dt > 0 && dt < 10 && kmh > 2 && (acc || 0) < 60 && moved < dt * 90) {
      L.trip.dist += moved;
      App.emit('moved', moved);
      L.trip.moving += dt;
      if (kmh > L.trip.max && kmh < 300) L.trip.max = kmh;
    }
    var fix = { lat: lat, lon: lon, speed: kmh, heading: heading, acc: acc, alt: alt, t: now, src: src };
    prev = fix;
    L.fix = fix;
    App.emit('loc', fix);
  }

  // satellites from the head unit's GPS receiver (Android 7+)
  window.onGnss = function (used, total) { L.sats = { used: used, total: total, t: Date.now() }; };

  // called by the Android shell (see app_code.py)
  window.onNativeLoc = function (lat, lon, spd, hasSpd, brg, hasBrg, acc, time, alt) {
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

  L.resetTrip = function () {
    L.trip = { dist: 0, moving: 0, max: 0, start: Date.now() };
    App.store.set('trip', L.trip);
    updateTrip();
    App.toast('تم تصفير عداد الرحلة');
  };

  function updateTrip() {
    var t = L.trip;
    App.$('tripDist').textContent = App.d((t.dist / 1000).toFixed(t.dist < 100000 ? 1 : 0));
    App.$('tripAvg').textContent = App.d(t.moving > 30 ? Math.round(t.dist / t.moving * 3.6) : 0);
    App.$('tripMax').textContent = App.d(Math.round(t.max));
    var m = Math.floor(t.moving / 60);
    App.$('tripTime').textContent = App.d(Math.floor(m / 60) + ':' + App.pad(m % 60));
  }

  // status refresh (1 Hz): gauge text, gps icon, speed warning
  function tick() {
    var f = L.fix, now = Date.now();
    var age = f ? (now - f.t) / 1000 : 1e9;
    var stale = age > 6;
    var kmh = f && !stale ? f.speed : 0;
    var sat = L.sats && now - L.sats.t < 15000 ? L.sats : null;
    var satTxt = sat ? App.d(sat.used) + '/' + App.d(sat.total) + ' قمر' : '';
    var text = !f ? 'جارٍ البحث عن إشارة GPS…' + (sat ? ' (' + App.d(sat.total) + ' قمر مرئي)' : '') :
      stale ? 'إشارة GPS ضعيفة' + (sat ? ' • ' + satTxt : '') :
      (f.src === 'gps' ? 'GPS السيارة' : 'موقع تقريبي') + (satTxt ? ' • ' + satTxt : '') + ' • ±' + App.d(Math.round(f.acc || 0)) + ' م';
    App.gauge.set(kmh, { heading: f && !stale && kmh > 3 ? f.heading : null, text: text });
    var ic = App.$('stGps');
    ic.setAttribute('class', 'ic st ' + (!f || stale ? 'acc blink' : (f.acc < 30 ? 'ok' : 'on')));

    var lim = App.settings.speedLimit, warn = App.$('speedWarn');
    if (App.settings.speedAlert && kmh > lim + 2) {
      if (!overSince) overSince = now;
      if (now - overSince > 2000) {
        warn.textContent = App.d(lim);
        warn.classList.remove('hidden');
        if (now - lastWarnBeep > 8000) { lastWarnBeep = now; App.beep([[1046, 180], [1046, 180]], 0.35); }
      }
    } else {
      overSince = 0;
      warn.classList.add('hidden');
    }
    updateTrip();
    if (now % 10000 < 1000) App.store.set('trip', L.trip);
  }

  L.start = function () {
    startWeb();
    setInterval(tick, 1000);
    tick();
    var g = App.$('gauge'), timer;
    g.addEventListener('pointerdown', function () { timer = setTimeout(L.resetTrip, 1500); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (e) {
      g.addEventListener(e, function () { clearTimeout(timer); });
    });
  };
})();
