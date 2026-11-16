/* main.js — boot, weather, Android back/resume hooks */
(function () {
  'use strict';
  var WCODES = [[0, 'صحو'], [3, 'غائم جزئياً'], [48, 'ضباب'], [57, 'رذاذ'], [67, 'أمطار'], [77, 'ثلوج'], [82, 'زخات مطر'], [86, 'ثلوج'], [99, 'عواصف رعدية']];

  function weather() {
    var f = App.loc.fix || App.prayer.loc;
    if (App.offline) return;
    App.fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + f.lat.toFixed(3) + '&longitude=' + f.lon.toFixed(3) +
      '&current=temperature_2m,weather_code&timezone=auto', 10000).then(function (j) {
        var c = j.current || {}, desc = '';
        for (var i = 0; i < WCODES.length; i++) if (c.weather_code <= WCODES[i][0]) { desc = WCODES[i][1]; break; }
        App.$('weather').innerHTML = '<b class="num">' + App.d(Math.round(c.temperature_2m)) + '°</b> <span>' + desc + '</span>';
        App.weatherNow = { t: Math.round(c.temperature_2m), desc: desc };
      }).catch(function () { });
  }

  window.onBackKey = function () {
    var pa = App.$('prayerAlert');
    if (!pa.classList.contains('hidden')) { pa.classList.add('hidden'); return; }
    var rm = App.$('reminder'), bf = App.$('briefing');
    if (!rm.classList.contains('hidden')) { rm.classList.add('hidden'); return; }
    if (!bf.classList.contains('hidden')) { bf.classList.add('hidden'); return; }
    if (App.$('welcome')) return;
    if (App.panels.current) { if (App.panels.stack.length) App.panels.back(); else App.panels.close(); return; }
    App.Native.call('home');   // nothing left to close: send the app to the background (GPS and stories keep running)
  };
  window.onAppResume = function () {
    App.system.status();
    if (App.settings.full) App.Native.call('full', '1');
    if (App.panels.current === 'wifi' || App.panels.current === 'bt') App.panels.refresh();
    if (App.home) App.home.cpLabel();
  };

  function boot() {
    App.theme.init();
    App.prayer.recalc();
    App.nav.init();
    App.radio.init();
    App.system.init();
    App.on('net', function (on) { App.system.status(); if (on) weather(); });
    App.net.init();
    App.prayer.init();
    App.home.init();
    if (App.stories) App.stories.init();
    App.adhkar.init();
    App.tasks.init();
    App.fan.init();
    App.loc.start();
    weather();
    setInterval(weather, 20 * 60000);
    var gotFix = false;
    App.on('loc', function (f) {
      App.prayer.setLocation(f.lat, f.lon, false);
      if (!gotFix) { gotFix = true; weather(); }
    });
    if (App.settings.full) App.Native.call('full', '1');
    if (App.settings.voice) App.Native.call('tts', '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
