/* adhkar.js — أذكار الصباح والمساء with tap counters, daily progress and gentle reminders */
(function () {
  'use strict';
  // m = morning text, e = evening text (when it differs), n = count, s = source, q = Quran, only = 'm' | 'e'
  var LIST = [
    { q: true, n: 1, s: 'آية الكرسي — سورة البقرة: ٢٥٥',
      m: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ: اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ، لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ، لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ، مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ، يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ، وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ، وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ، وَلَا يَئُودُهُ حِفْظُهُمَا، وَهُوَ الْعَلِيُّ الْعَظِيمُ' },
    { q: true, n: 3, s: 'الإخلاص والمعوذتان — رواه أبو داود والترمذي',
      m: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ: قُلْ هُوَ اللَّهُ أَحَدٌ (١) اللَّهُ الصَّمَدُ (٢) لَمْ يَلِدْ وَلَمْ يُولَدْ (٣) وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ (٤)' +
        ' ✦ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ: قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ (١) مِنْ شَرِّ مَا خَلَقَ (٢) وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ (٣) وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ (٤) وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ (٥)' +
        ' ✦ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ: قُلْ أَعُوذُ بِرَبِّ النَّاسِ (١) مَلِكِ النَّاسِ (٢) إِلَٰهِ النَّاسِ (٣) مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ (٤) الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ (٥) مِنَ الْجِنَّةِ وَالنَّاسِ (٦)' },
    { n: 1, s: 'رواه مسلم',
      m: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
      e: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ' },
    { n: 1, s: 'رواه الترمذي',
      m: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
      e: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ' },
    { n: 1, s: 'سيد الاستغفار — رواه البخاري',
      m: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ' },
    { n: 4, s: 'رواه أبو داود',
      m: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
      e: 'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ' },
    { n: 1, s: 'رواه أبو داود',
      m: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
      e: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ' },
    { n: 3, s: 'رواه أبو داود',
      m: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ' },
    { n: 7, s: 'رواه أبو داود',
      m: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ' },
    { n: 1, s: 'رواه أبو داود وابن ماجه',
      m: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي' },
    { n: 1, s: 'رواه أبو داود والترمذي',
      m: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ' },
    { n: 3, s: 'رواه أبو داود والترمذي',
      m: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ' },
    { n: 3, s: 'رواه أبو داود والترمذي',
      m: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا' },
    { n: 1, s: 'رواه الحاكم',
      m: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ' },
    { n: 1, s: 'رواه أحمد',
      m: 'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
      e: 'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ' },
    { only: 'm', n: 3, s: 'رواه مسلم',
      m: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ' },
    { only: 'm', n: 1, s: 'رواه ابن ماجه',
      m: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا' },
    { only: 'e', n: 3, s: 'رواه مسلم',
      m: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ' },
    { n: 10, s: 'رواه الطبراني',
      m: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ' },
    { n: 10, s: 'رواه النسائي',
      m: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ' },
    { n: 100, s: 'رواه مسلم',
      m: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ' },
    { n: 100, s: 'رواه البخاري ومسلم',
      m: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ' }
  ];
  var TITLES = { m: 'أذكار الصباح', e: 'أذكار المساء' };
  var A = App.adhkar = { mode: null };

  function items(mode) { return LIST.filter(function (x) { return !x.only || x.only === mode; }); }
  function text(x, mode) { return mode === 'e' && x.e ? x.e : x.m; }
  function key(mode) { return 'adhkar.' + new Date().toDateString() + '.' + mode; }
  function state(mode) {
    var st = App.store.get(key(mode), null), it = items(mode);
    if (!st || st.length !== it.length) st = it.map(function (x) { return x.n; });
    return st;
  }
  A.autoMode = function () {
    var t = App.prayer.today, now = new Date();
    if (!t) return now.getHours() < 12 ? 'm' : 'e';
    return now >= t[0] && now < t[3] ? 'm' : 'e';      // Fajr → Asr: morning, Asr → Fajr: evening
  };
  A.progress = function (mode) {
    var st = state(mode), it = items(mode), done = 0;
    st.forEach(function (left) { if (left === 0) done++; });
    return { done: done, total: it.length };
  };
  A.open = function (mode) { A.mode = mode || A.autoMode(); App.panels.open('adhkar'); };

  function ring(left, total) {
    var C = 2 * Math.PI * 21, frac = total ? (total - left) / total : 1;
    return '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="21" fill="none" stroke="var(--off)" stroke-width="4"/>' +
      '<circle cx="25" cy="25" r="21" fill="none" stroke="' + (left === 0 ? 'var(--ok)' : 'var(--accent)') + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' +
      (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>';
  }

  function render(body) {
    var mode = A.mode || A.autoMode();
    A.mode = mode;
    var it = items(mode), st = state(mode), f = App.loc.fix;
    var scale = App.settings.adhkarScale || 1;
    var html = '<div class="adh-top"><div class="tabs"><button data-m="m"' + (mode === 'm' ? ' class="on"' : '') + '>' + App.icon('sun') + ' ' + TITLES.m + '</button>' +
      '<button data-m="e"' + (mode === 'e' ? ' class="on"' : '') + '>' + App.icon('moon') + ' ' + TITLES.e + '</button></div>' +
      '<button class="round small" id="aSm">' + '<b style="font-size:1.7vmin">أ-</b></button><button class="round small" id="aLg"><b style="font-size:2.3vmin">أ+</b></button>' +
      '<button class="round small" id="aReset">' + App.icon('reset') + '</button></div>';
    if (f && f.speed > 20) html += '<div class="drive-note">' + App.icon('car') + 'أنت تقود الآن — ردّدها من حفظك، واقرأ النص بعد ما توقف بأمان.</div>';
    var pg = A.progress(mode);
    html += '<div class="adh-prog"><i style="width:' + (100 * pg.done / pg.total).toFixed(1) + '%"></i></div>' +
      '<div class="adh-meta"><span>اضغط على الذكر لعدّ كل مرة</span><span class="num" id="aCount">أنجزت ' + App.d(pg.done) + ' من ' + App.d(pg.total) + '</span></div>';
    html += '<div id="aList" style="--dhs:' + scale + '">' + it.map(function (x, i) {
      var left = st[i];
      return '<div class="dhikr' + (left === 0 ? ' done' : '') + '" data-i="' + i + '"><p class="dh-text' + (x.q ? ' q' : '') + '">' + text(x, mode) + '</p>' +
        '<div class="dh-foot"><small>' + x.s + (x.n > 1 ? ' • ' + App.d(x.n) + ' مرات' : '') + '</small><span class="dh-count">' + ring(left, x.n) +
        '<b class="num">' + (left === 0 ? '✓' : App.d(left)) + '</b></span></div></div>';
    }).join('') + '</div>' +
      (pg.done === pg.total ? '<div class="adh-done"><b>تقبّل الله منك</b><span>أتممت ' + TITLES[mode] + ' اليوم</span></div>' : '');
    body.innerHTML = html;
    body.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { A.mode = b.dataset.m; App.panels.refresh(); }; });
    App.$('aSm').onclick = function () { setScale(-0.1); };
    App.$('aLg').onclick = function () { setScale(0.1); };
    App.$('aReset').onclick = function () { App.store.set(key(mode), null); App.panels.refresh(); App.toast('تمت إعادة العدّ'); };
    App.$('aList').onclick = function (e) {
      var card = e.target.closest('.dhikr');
      if (!card) return;
      var i = +card.dataset.i, s2 = state(mode);
      if (s2[i] === 0) return;
      s2[i]--;
      App.store.set(key(mode), s2);
      card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump');
      card.querySelector('.dh-count').innerHTML = ring(s2[i], it[i].n) + '<b class="num">' + (s2[i] === 0 ? '✓' : App.d(s2[i])) + '</b>';
      if (s2[i] === 0) {
        card.classList.add('done');
        var p2 = A.progress(mode);
        App.$('aCount').textContent = 'أنجزت ' + App.d(p2.done) + ' من ' + App.d(p2.total);
        body.querySelector('.adh-prog i').style.width = (100 * p2.done / p2.total).toFixed(1) + '%';
        var next = card.nextElementSibling;
        while (next && next.classList.contains('done')) next = next.nextElementSibling;
        if (next) setTimeout(function () { body.scrollTop = next.offsetTop - 12; }, 250);
        if (p2.done === p2.total) setTimeout(App.panels.refresh, 400);
      }
    };
  }
  function setScale(d) {
    App.settings.adhkarScale = Math.max(0.8, Math.min(1.7, Math.round(((App.settings.adhkarScale || 1) + d) * 10) / 10));
    App.saveSettings();
    var l = App.$('aList');
    if (l) l.style.setProperty('--dhs', App.settings.adhkarScale);
  }
  App.panelDefs = App.panelDefs || {};
  App.panelDefs.adhkar = { title: 'أذكار الصباح والمساء', render: render };

  // remind once: after Fajr (+20 min) for the morning set, after Asr (+10 min) for the evening set
  function check() {
    if (!App.settings.adhkarRemind || !App.prayer.today) return;
    var t = App.prayer.today, now = new Date();
    [['m', t[0], 20], ['e', t[3], 10]].forEach(function (r) {
      var at = r[1].getTime() + r[2] * 60000, k = 'adhRem.' + now.toDateString() + r[0];
      if (now >= at && now - at < 30 * 60000 && !App.store.get(k, false)) {
        App.store.set(k, true);
        var pg = A.progress(r[0]);
        if (pg.done === pg.total) return;
        App.reminder.show({
          kind: 'الأذكار', icon: r[0] === 'm' ? 'sun' : 'moon', title: TITLES[r[0]],
          sub: 'دقائق من الذكر تبارك يومك — اقرأها وأنت متوقف أو ردّدها من حفظك',
          buttons: [['open', 'ابدأ الآن', 'beads'], ['later', 'لاحقاً', 'close']],
          onButton: function (b) { if (b === 'open') A.open(r[0]); }
        });
      }
    });
  }
  A.init = function () { setInterval(check, 30000); setTimeout(check, 5000); };
})();
