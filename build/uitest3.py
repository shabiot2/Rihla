"""v3 screenshots: every skin at the head-unit sizes, plus the panels. Uses the mocked bridge of uitest.py.
usage: python3 build/uitest3.py OUTDIR [skins|sizes|panels|one KEY WxH]"""
import os
import sys
import datetime
sys.path.insert(0, os.path.dirname(__file__))
import uitest  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/camry/out'
os.makedirs(OUT, exist_ok=True)
uitest.OUT = OUT

# a moment that suits each world (Riyadh time)
WHEN = {
    'orbit': (2026, 11, 16, 20, 34), 'dune': (2026, 11, 16, 16, 38), 'neon': (2026, 11, 16, 21, 12),
    'luxe': (2026, 11, 16, 13, 7), 'pure': (2026, 11, 16, 10, 21), 'girls': (2026, 11, 16, 16, 2), 'glass': (2026, 11, 16, 18, 41), 'live': (2026, 11, 16, 21, 12),
    'friday': (2026, 11, 20, 10, 46), 'national': (2026, 9, 23, 9, 15), 'founding': (2027, 2, 22, 19, 25),
}
ORDER = ['orbit', 'live', 'dune', 'neon', 'luxe', 'pure', 'girls', 'glass', 'friday', 'national', 'founding']


SP = '/tmp/claude-0/-home-claude/1696dbce-1f1f-58f1-a7e0-73ec14da2a1a/scratchpad'


def settle(p):
    p.wait_for_timeout(900)


def with_photo(p):
    """a synthetic stand-in picture (never the family's real photo)"""
    d = open(SP + '/testphoto.b64').read()
    p.evaluate("d => { localStorage.setItem('cn.photos', JSON.stringify([d])); App.emit('skin', App.theme.key); }", d)
    p.wait_for_timeout(1300)


def shot(key, w, h, name=None, actions=settle, extra=None):
    st = {'onboarded': 3, 'theme': key, 'briefing': False, 'autoFriday': key == 'friday', 'autoOccasion': False}
    st.update(extra or {})
    errs, _ = uitest.run(w, h, name or ('skin_%s_%dx%d' % (key, w, h)), actions, settings=st, clock=WHEN[key])
    print(key, w, h, 'OK' if not errs else errs[:4])


if __name__ == '__main__':
    which = sys.argv[2] if len(sys.argv) > 2 else 'skins'
    if which == 'skins':
        for k in ORDER:
            shot(k, 1280, 720)
    elif which == 'sizes':
        for k in ORDER:
            for wh in [(1024, 600), (800, 480), (720, 1280)]:
                shot(k, wh[0], wh[1])
    elif which == 'glass':
        shot('glass', 1280, 720, 'skin_glass_empty')
        shot('glass', 1280, 720, 'skin_glass_photo', with_photo)
        shot('glass', 720, 1280, 'skin_glass_photo_portrait', with_photo)
        shot('glass', 1024, 600, 'skin_glass_photo_1024', with_photo)
        shot('girls', 1280, 720, 'skin_girls_photo', with_photo)
    elif which == 'quiz':
        def many(p):
            p.evaluate("App.settings.voice=false")
            p.click('.dk[data-panel="stories"]'); p.wait_for_timeout(500)
            p.click('#stQuiz'); p.wait_for_timeout(400)
            for i in range(14):
                p.click('.st-opt >> nth=0'); p.wait_for_timeout(2700)
            n = p.inner_text('.st-qn')
            print('after 14 answers ->', n, '| end btn:', p.locator('#qEnd').count())
            p.click('#qEnd'); p.wait_for_timeout(400)
        shot('girls', 1280, 720, 'quiz_endless', many)
    elif which == 'settings':
        def st(p):
            p.evaluate("App.settings.elKey = 'sk_' + 'a'.repeat(48)")
            p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(500)
            p.evaluate("document.getElementById('sElOn').scrollIntoView({block: 'center'})"); p.wait_for_timeout(300)
        shot('orbit', 1280, 720, 'settings_el', st)
    elif which == 'tires':
        def empty(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(600)
        shot('orbit', 1280, 720, 'tires_empty', empty)

        def seeded(p):
            p.evaluate("App.tires.record([35, 34, 28.5, 36], true); App.store.set('tires', {log: [{t: Date.now()-40*864e5, v:[33,33,32,33]}, {t: Date.now()-12*864e5, v:[35,35,34,35]}].concat(App.store.get('tires').log)}); App.emit('tires')")
            p.wait_for_timeout(300)
        def view(p):
            seeded(p); p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(600)
        def editing(p):
            seeded(p); p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tyLog'); p.wait_for_timeout(300)
            p.click('.ty-t.rl [data-d="1"]'); p.click('.ty-t.rl [data-d="1"]'); p.wait_for_timeout(300)
        def home(p):
            seeded(p); p.wait_for_timeout(600)
        shot('orbit', 1280, 720, 'tires_view', view)
        shot('orbit', 1280, 720, 'tires_edit', editing)
        shot('pure', 1280, 720, 'tires_view_pure', view)
        shot('girls', 1280, 720, 'tires_view_girls', view)
        shot('luxe', 1024, 600, 'tires_view_1024', view)
        shot('glass', 720, 1280, 'tires_view_portrait', view)
        shot('orbit', 1280, 720, 'tires_home', home)
    elif which == 'tirebar':
        def later(p):
            p.evaluate("App.home && App.home.smart && 0"); p.wait_for_timeout(300)
        shot('orbit', 1280, 720, 'tirebar_orbit')
        shot('glass', 1280, 720, 'tirebar_glass')
        shot('pure', 800, 480, 'tirebar_800')
    elif which == 'probe':
        def pr(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tySet'); p.wait_for_timeout(400)
            p.click('#tyProbe'); p.wait_for_timeout(500)
        shot('orbit', 1280, 720, 'probe', pr)
        def sens(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tyApp'); p.wait_for_timeout(500)
            print('launched:', [c for c in p.evaluate('window.__calls') if c[0] == 'launch'])
        shot('orbit', 1280, 720, 'sensor_launch', sens)
    elif which == 'probe2':
        def v(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            print('probe button:', p.locator('#tyProbe2').count())
            p.click('#tyProbe2'); p.wait_for_timeout(500)
            print('probe panel:', p.locator('.pb').count())
        shot('orbit', 1280, 720, 'probe2', v)
        def deep(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tyProbe2'); p.wait_for_timeout(900)
            p.evaluate("onBcast({a:'com.reglink.vehicleinfo.ACTION_TPMS_UPDATE', x:{fl:2.7, fr:2.6, rl:2.6, rr:2.8, unit:'bar'}})")
            p.wait_for_timeout(300)
            print('listen calls:', [c[1][:60] for c in p.evaluate('window.__calls') if c[0] == 'listen'])
        shot('orbit', 1280, 720, 'probe_deep', deep)
        def w(p):
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
        shot('orbit', 1280, 720, 'tires_panel_323', w)
    elif which == 'send':
        def sd(p):
            p.evaluate("""window.__posted = null; window.fetch = function (url, o) { window.__posted = [url, (o.body || '').length];
              return Promise.resolve({ ok: true, text: function () { return Promise.resolve('https://paste.rs/AbC1x'); } }); };
              Object.defineProperty(navigator, 'onLine', {get: function () { return true; }});""")
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tyProbe2'); p.wait_for_timeout(900)
            p.click('#pbSend'); p.wait_for_timeout(500)
            print('posted:', p.evaluate('window.__posted'), '| code:', p.inner_text('#pbCode'))
        shot('orbit', 1280, 720, 'send', sd)
        def sd2(p):   # paste.rs refuses twice: the other site takes it, the reason shows, and a big check still goes ~40 KB
            p.evaluate("""window.__posted = []; window.fetch = function (url, o) { window.__posted.push([url, (o.body || '').length]);
              if (/paste\\.rs/.test(url)) return Promise.resolve({ ok: false, status: 429, text: function () { return Promise.resolve(''); } });
              return Promise.resolve({ ok: true, text: function () { return Promise.resolve('https://dpaste.com/XY12'); } }); };
              Object.defineProperty(navigator, 'onLine', {get: function () { return true; }});""")
            p.evaluate("window.__bigScan = Array.from({length: 9000}, (_, i) => 'com.reglink.tpms.Thing' + i + '.tire_pressure_value')")
            p.click('.st-b[data-panel="tires"]'); p.wait_for_timeout(500)
            p.click('#tyProbe2'); p.wait_for_timeout(1500)
            p.click('#pbSend'); p.wait_for_timeout(6500)
            print('posted:', p.evaluate('window.__posted'), '| code:', p.inner_text('#pbCode'))
        shot('orbit', 1280, 720, 'send2', sd2)
    elif which == 'live':
        import itertools
        for k in ['naqsh', 'jazan', 'fifa', 'desert', 'city', 'aurora', 'warp', 'sea', 'rain', 'flow', 'dunes']:
            def pick(p, k=k):
                p.evaluate("App.settings.liveBg='%s'; App.saveSettings(); App.live.set('%s', true)" % (k, k)); p.wait_for_timeout(1500)
            shot('live', 1280, 720, 'live_' + k, pick)
        def fuel(p):
            p.evaluate("App.cdata.ingest({a:'x', x:{instantFuel: 13.4, avgFuelConsumption: 11.8, rangeKm: 420}})"); p.wait_for_timeout(1300)
        shot('live', 1280, 720, 'live_fuel', fuel)
        def full(p):
            p.evaluate("App.live.set('jazan', true)"); p.wait_for_timeout(600)
            p.click('#lvFull'); p.wait_for_timeout(1400)
        shot('live', 1280, 720, 'live_full_jazan', full)
        def full2(p):
            p.evaluate("App.live.set('fifa', true)"); p.wait_for_timeout(600)
            p.click('#lvFull'); p.wait_for_timeout(1400)
        shot('live', 1280, 720, 'live_full_fifa', full2)
        def full3(p):
            p.evaluate("App.live.set('naqsh', true)"); p.wait_for_timeout(2600)
            p.click('#lvFull'); p.wait_for_timeout(900)
        shot('live', 1280, 720, 'live_full_naqsh', full3)
        def picker(p):
            p.click('#lvBg'); p.wait_for_timeout(1800)
        shot('live', 1280, 720, 'live_picker', picker)
        shot('live', 1024, 600, 'live_1024')
        shot('live', 720, 1280, 'live_portrait')
    elif which == 'one':
        w, h = [int(x) for x in sys.argv[4].split('x')] if len(sys.argv) > 4 else (1280, 720)
        shot(sys.argv[3], w, h)
    elif which == 'panels':
        def opener(sel):
            def a(p):
                settle(p)
                p.click(sel)
                p.wait_for_timeout(900)
            return a
        shot('orbit', 1280, 720, 'panel_settings', opener('.dk[data-panel="settings"]'))
        shot('girls', 1280, 720, 'panel_stories', opener('.dk[data-panel="stories"]'))
        shot('luxe', 1280, 720, 'panel_prayer', opener('.dk[data-panel="prayer"]'))
        shot('glass', 1280, 720, 'panel_stories_glass', opener('.dk[data-panel="stories"]'))

        def entity(p):
            opener('.dk[data-panel="stories"]')(p)
            p.click('.st-card[data-e="nuh"]')
            p.wait_for_timeout(700)
        shot('girls', 1280, 720, 'panel_entity', entity)

        def ask(p):
            opener('.dk[data-panel="stories"]')(p)
            p.click('#stAsk')
            p.wait_for_timeout(400)
            p.fill('#askIn', 'وش لقب عمر بن الخطاب؟')
            p.click('#askGo')
            p.wait_for_timeout(300)
            p.fill('#askIn', 'كم عمر النبي')
            p.click('#askGo')
            p.fill('#askIn', 'مين اللي ابتلعه الحوت')
            p.click('#askGo')
            p.fill('#askIn', 'ما هي أسماء الخلفاء')
            p.click('#askGo')
            p.wait_for_timeout(500)
        shot('orbit', 1280, 720, 'panel_ask', ask)

        def quiz(p):
            opener('.dk[data-panel="stories"]')(p)
            p.click('#stQuiz')
            p.wait_for_timeout(600)
        shot('girls', 1280, 720, 'panel_quiz', quiz)
