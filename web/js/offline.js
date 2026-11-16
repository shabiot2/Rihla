/* offline.js — internet status, and the built-in Kingdom data (cities / districts) that answers
   «which city am I in» and the prayer-city search without internet. */
(function () {
  'use strict';
  var O = App.net = { online: true };
  App.offline = false;

  function set(on) {
    if (on === O.online) return;
    O.online = on;
    App.offline = !on;
    document.body.classList.toggle('is-offline', !on);
    App.$('netChip').classList.toggle('hidden', on);
    App.emit('net', on);
    App.toast(on ? 'رجع الاتصال بالإنترنت' : 'بدون إنترنت — الصلاة والـGPS والراديو والقصص المحفوظة شغّالة', 3500);
  }
  function check() {
    var on;
    if (App.Native.has) on = App.Native.call('net', '') !== '0';
    else on = navigator.onLine !== false;
    set(on);
  }
  O.check = check;

  O.init = function () {
    check();
    setInterval(check, 8000);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    App.$('netChip').onclick = function () { App.panels.open('wifi'); };
    // v2.x kept street-map tiles on the device; the map is gone, so free that space once
    if (App.Native.has && !App.store.get('tilesCleared', false)) {
      setTimeout(function () { App.Native.call('cache', 'clear'); App.store.set('tilesCleared', true); }, 20000);
    }
    // the Kingdom data loads after the welcome, so start-up stays smooth
    setTimeout(App.base.load, 6000);
  };
})();
