/* main.js — boot, clock & dates, weather, Android back/resume hooks */
(function () {
  'use strict';
  var WCODES = [[0, 'صحو'], [3, 'غائم جزئياً'], [48, 'ضباب'], [57, 'رذاذ'], [67, 'أمطار'], [77, 'ثلوج'], [82, 'زخات مطر'], [86, 'ثلوج'], [99, 'عواصف رعدية']];

  function clock() {
    var now = new Date();
    var ap = App.ampm(now);
    App.$('clock').innerHTML = App.hm(now) + (ap ? '<small>' + ap + '</small>' : '');
    if (clock._day !== now.toDateString() || clock._dig !== App.settings.digits) {
      clock._day = now.toDateString();
      clock._dig = App.settings.digits;
      App.$('dateHijri').textContent = App.hijriText(now);
      var g;
      try {
        g = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-' + (App.settings.digits === 'arab' ? 'arab' : 'latn'),
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      } catch (e) { g = now.toLocaleDateString(); }
      App.$('dateGreg').textContent = g;
    }
    App.prayer.tick(now);
  }

  function weather() {
    var f = App.loc.fix || App.prayer.loc;
    App.fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + f.lat.toFixed(3) + '&longitude=' + f.lon.toFixed(3) +
      '&current=temperature_2m,weather_code&timezone=auto', 10000).then(function (j) {
        var c = j.current || {}, desc = '';
        for (var i = 0; i < WCODES.length; i++) if (c.weather_code <= WCODES[i][0]) { desc = WCODES[i][1]; break; }
        App.$('weather').innerHTML = '<b class="num">' + App.d(Math.round(c.temperature_2m)) + '°</b> ' + desc;
        App.weatherNow = { t: Math.round(c.temperature_2m), desc: desc };
      }).catch(function () { });
  }

  window.onBackKey = function () {
    var ctx = App.$('ctxMenu');
    if (!ctx.classList.contains('hidden')) { ctx.classList.add('hidden'); return; }
    var pa = App.$('prayerAlert');
    if (!pa.classList.contains('hidden')) { pa.classList.add('hidden'); return; }
    var rm = App.$('reminder'), bf = App.$('briefing');
    if (!rm.classList.contains('hidden')) { rm.classList.add('hidden'); return; }
    if (!bf.classList.contains('hidden')) { bf.classList.add('hidden'); return; }
    if (App.$('welcome')) return;
    if (App.panels.current) { if (App.panels.stack.length) App.panels.back(); else App.panels.close(); return; }
    if (!App.map.follow) { App.map.recenter(); return; }
    App.Native.call('home');   // nothing left to close: send the app to the background (GPS keeps running)
  };
  window.onAppResume = function () {
    App.system.status();
    if (App.settings.full) App.Native.call('full', '1');
    if (App.panels.current === 'wifi' || App.panels.current === 'bt') App.panels.refresh();
  };

  function boot() {
    App.theme.init();
    App.map.init(App.$('map'));
    App.gauge.init(App.$('gauge'));
    App.prayer.recalc();
    App.nav.init();
    App.radio.init();
    App.system.init();
    App.prayer.init();
    App.adhkar.init();
    App.tasks.init();
    App.fan.init();
    App.loc.start();
    clock();
    setInterval(clock, 1000);
    weather();
    setInterval(weather, 20 * 60000);
    var gotFix = false;
    App.on('loc', function (f) {
      App.prayer.setLocation(f.lat, f.lon, false);
      if (!gotFix) { gotFix = true; weather(); }
    });
    App.on('settings', function () { clock._dig = null; clock(); App.map.invalidate(); });
    if (App.settings.full) App.Native.call('full', '1');
    if (App.settings.voice) App.Native.call('tts', '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
