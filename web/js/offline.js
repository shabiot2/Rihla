/* offline.js — internet status, the street-map cache (viewed tiles kept on the device for up to 29 days),
   the "offline maps" panel, and the "you are in district X" chip on the map. */
(function () {
  'use strict';
  var O = App.net = { online: true };
  App.offline = false;
  var NAV_APPS = [['app.organicmaps', 'Organic Maps'], ['net.osmand', 'OsmAnd'], ['net.osmand.plus', 'OsmAnd+'],
    ['com.mapswithme.maps.pro', 'MAPS.ME'], ['com.sygic.aura', 'Sygic'], ['com.here.app.maps', 'HERE WeGo']];

  function set(on) {
    if (on === O.online) return;
    O.online = on;
    App.offline = !on;
    document.body.classList.toggle('is-offline', !on);
    App.$('netChip').classList.toggle('hidden', on);
    if (App.map) { if (on) App.map.retryTiles(); else App.map.invalidate(); }
    App.emit('net', on);
    App.toast(on ? 'رجع الاتصال بالإنترنت' : 'بدون إنترنت — خريطة المملكة والـGPS والراديو شغّالة', 3500);
  }
  function check() {
    var on;
    if (App.Native.has) on = App.Native.call('net', '') !== '0';
    else on = navigator.onLine !== false;
    set(on);
  }
  O.check = check;

  O.cacheInfo = function () {
    var j = App.Native.has ? App.Native.json('cache', 'size') : null;
    return j && j.n != null ? j : { n: 0, b: 0 };
  };
  function mb(b) { return App.d((b / 1048576).toFixed(b < 10485760 ? 1 : 0)); }
  function installedNavApps() {
    var apps = App.Native.has ? App.system.apps() : [];
    return NAV_APPS.filter(function (n) { return apps.some(function (a) { return a.p === n[0]; }); });
  }
  O.navApps = installedNavApps;

  // ---------- panel ----------
  function render(body) {
    var c = O.cacheInfo(), apps = installedNavApps(), k = App.base.counts() || { reg: 13, cit: 4581, dis: 3731, air: 0 };
    function n(x) { return App.d(x.toLocaleString('en-US')); }
    body.innerHTML =
      '<div class="big-status on">' + App.icon('map') + '<div class="txt"><b>خريطة المملكة المدمجة' +
      (App.base.ready ? ' — جاهزة' : ' — جارٍ التحميل…') + '</b><small>داخل التطبيق وتشتغل بدون إنترنت: الحدود، ' + n(k.reg) + ' منطقة، ' +
      n(k.cit) + ' مدينة وقرية، ' + n(k.dis) + ' حي بأسمائها، الطرق الرئيسية، السكك' + (k.air ? '، ' + n(k.air) + ' مطار' : ' والمطارات') + '</small></div></div>' +
      (App.offline ? '<div class="drive-note">' + App.icon('nonet') + 'أنت الحين بدون إنترنت — الخريطة المدمجة والشوارع المحفوظة والـGPS شغّالة</div>' : '') +
      '<div class="btn-row" style="margin-bottom:1.6vmin"><button class="btn primary" id="oShow">' + App.icon('map') + 'اعرض خريطة المملكة</button>' +
      '<button class="btn" id="oStreets">' + App.icon('layers') + 'رجّع خريطة الشوارع</button></div>' +
      '<div class="sec"><div class="sec-title">الشوارع المحفوظة على الشاشة</div>' +
      '<div class="set-row"><div class="txt"><b class="num">' + App.d(c.n) + ' قطعة خريطة • ' + mb(c.b) + ' ميقا</b>' +
      '<small>كل مكان تشوفه على الخريطة وأنت متصل يُحفظ تلقائياً ويشتغل بدون نت لمدة ' + App.d(29) +
      ' يوم، بعدها يتجدد (حسب شروط مزوّد خرائط الشوارع)</small></div>' +
      '<button class="btn" id="oClear">' + App.icon('trash') + 'مسح</button></div></div>' +
      '<div class="sec"><div class="sec-title">البحث والملاحة بدون نت</div>' +
      '<div class="note" style="margin-bottom:1vmin">بدون نت تقدر تبحث عن أي مدينة أو حي بالمملكة، و«رحلة» يرشدك بالاتجاه المباشر والمسافة. ' +
      'وإذا حسبت المسار وأنت متصل، يكمل معك بالتوجيه الصوتي حتى لو انقطع النت.</div>' +
      (apps.length ? '<div class="btn-row">' + apps.map(function (a) {
        return '<button class="btn" data-app="' + a[0] + '">' + App.icon('route') + App.esc(a[1]) + '</button>';
      }).join('') + '</div>' :
        '<div class="note">للتوجيه التفصيلي شارع بشارع بدون نت: ثبّت تطبيق <b>Organic Maps</b> المجاني من متجر Play وحمّل فيه خريطة السعودية مرة وحدة، ' +
        'وبعدها زر «تطبيق ملاحة آخر» في أي مكان يفتح المسار فيه مباشرة.</div>') + '</div>';
    App.$('oShow').onclick = function () { App.settings.mapStyle = 'ksa'; App.saveSettings(); App.panels.close(); App.map.invalidate(); App.toast('خريطة المملكة المدمجة'); };
    App.$('oStreets').onclick = function () { App.settings.mapStyle = 'auto'; App.saveSettings(); App.panels.close(); App.map.invalidate(); App.toast('خريطة الشوارع (تلقائي)'); };
    App.$('oClear').onclick = function () {
      if (App.Native.has) App.Native.call('cache', 'clear');
      App.toast('تم مسح الشوارع المحفوظة');
      App.panels.refresh();
    };
    body.querySelectorAll('[data-app]').forEach(function (b) { b.onclick = function () { App.Native.call('launch', b.dataset.app); }; });
  }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.offline = { title: 'الخرائط بدون نت', render: render };
  // from inside another panel: open as a sub-page so «back» returns there
  O.open = function () {
    if (App.panels.current && App.panels.current !== 'offline') App.panels.push(App.panelDefs.offline.title, render);
    else App.panels.open('offline');
  };

  // ---------- "you are in" chip ----------
  function where() {
    var el = App.$('whereChip'), f = App.loc.fix;
    var show = App.base.ready && f && !(App.nav && App.nav.active) && Date.now() - f.t < 30000;
    var txt = show ? App.base.whereText(f.lat, f.lon) : '';
    el.classList.toggle('hidden', !txt);
    if (txt && el._t !== txt) { el._t = txt; el.querySelector('span').textContent = txt; }
  }

  O.init = function () {
    check();
    setInterval(check, 8000);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    App.$('netChip').onclick = function () { App.panels.open('offline'); };
    App.$('whereChip').onclick = function () { App.panels.open('offline'); };
    if (App.Native.has) setTimeout(function () { App.Native.call('cache', 'prune'); }, 15000);
    App.base.load();
    App.on('baseReady', where);
    setInterval(where, 4000);
  };
})();
