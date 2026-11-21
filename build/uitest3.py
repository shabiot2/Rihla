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
    'luxe': (2026, 11, 16, 13, 7), 'pure': (2026, 11, 16, 10, 21), 'girls': (2026, 11, 16, 16, 2), 'glass': (2026, 11, 16, 18, 41),
    'friday': (2026, 11, 20, 10, 46), 'national': (2026, 9, 23, 9, 15), 'founding': (2027, 2, 22, 19, 25),
}
ORDER = ['orbit', 'dune', 'neon', 'luxe', 'pure', 'girls', 'glass', 'friday', 'national', 'founding']


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
            p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(500)
            p.evaluate("document.getElementById('sElKey').scrollIntoView()"); p.wait_for_timeout(300)
        shot('orbit', 1280, 720, 'settings_el', st)
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
