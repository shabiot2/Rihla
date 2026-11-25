#!/usr/bin/env python3
"""voicetest.py — checks the «no settings» ElevenLabs voice end to end, with a made-up key and a stand-in for
ElevenLabs: the private build puts the key in scrambled, the app sends it, a voice this account cannot use falls
back to the premade one, a spent month falls back to the unit's own voice, and the public build shows no voice rows.

    python3 build/voicetest.py
"""
import io
import json
import os
import secrets
import shutil
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_private  # noqa: E402
import uitest  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

DEF_VOICE = 'JBFqnCBsd6RMkjVDRZzb'


def silent_wav():
    b = io.BytesIO()
    with wave.open(b, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b'\0\0' * 800)
    return b.getvalue()


def page_for(web, key_seen, settings):
    p = sync_playwright().start()
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}, locale='ar-SA', timezone_id='Asia/Riyadh',
                        user_agent='Mozilla/5.0 (Linux; Android 10) Chrome/120 Mobile CamryNav/2.1 (Android head unit; SDK 35)')
    ctx.add_init_script(uitest.BRIDGE + 'window.__noHero=true;')
    st = {'onboarded': 3, 'maps': True, 'briefing': False, 'autoOccasion': False}
    st.update(settings)
    ctx.add_init_script('localStorage.clear();localStorage.setItem("cn.settings", %s);'
                        'localStorage.setItem("cn.brief." + new Date().toDateString(), "true");' % json.dumps(json.dumps(st)))
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    wav = silent_wav()

    def handle(route):
        u, r = route.request.url, route.request
        if 'api.elevenlabs.io' in u:
            voice = u.split('text-to-speech/')[1].split('?')[0]
            text = json.loads(r.post_data or '{}').get('text', '')
            key_seen.append((voice, r.headers.get('xi-api-key'), text))
            if voice != DEF_VOICE:
                return route.fulfill(status=402, content_type='application/json', body=json.dumps(
                    {'detail': {'status': 'free_users_not_allowed', 'message': 'Free users cannot use library voices via the API.'}}))
            if 'رصيد' in text:
                return route.fulfill(status=401, content_type='application/json', body=json.dumps(
                    {'detail': {'status': 'quota_exceeded', 'message': 'This request exceeds your quota.'}}))
            return route.fulfill(status=200, content_type='audio/wav', body=wav)
        if u.startswith('file:'):
            return route.continue_()
        return uitest.handle(route)
    pg.route('**/*', handle)
    pg.goto('file://' + os.path.join(web, 'index.html'))
    pg.wait_for_timeout(700)
    return p, b, pg, errors


def main():
    tmp = tempfile.mkdtemp(prefix='rihla_voicetest_')
    ok = True
    try:
        key = 'sk_' + secrets.token_hex(24)
        priv = os.path.join(tmp, 'private'); os.makedirs(priv)
        open(os.path.join(priv, 'elevenlabs.key'), 'w').write(key)
        web = os.path.join(tmp, 'web')
        shutil.copytree(os.path.join(HERE, '..', 'web'), web)
        added = build_private.prepare(priv, web)
        vk = open(os.path.join(web, 'data', 'vk.js')).read()
        print('private web:', added, '| key in plain text:', key in vk)
        ok &= added == ['data/vk.js'] and key not in vk and 'sk_' not in vk

        # 1) the owner's build: a voice an older version picked that the free plan cannot use
        seen = []
        p, b, pg, errors = page_for(web, seen, {'elVoice': 'LibraryVoice0001', 'elVoiceName': 'مكتبة'})
        print('enabled with no settings:', pg.evaluate('App.voice.enabled()'))
        ok &= pg.evaluate('App.voice.enabled()') is True
        kept = pg.evaluate('App.store.get("settings", {}).elKey') == key
        print('key left on the unit for later updates:', kept)
        ok &= kept
        pg.evaluate("App.voice.speak('بسم الله، هذا صوت رحلة')"); pg.wait_for_timeout(1500)
        voices = [v for v, _, _ in seen]
        print('voices asked:', voices, '| key sent right:', all(k == key for _, k, _ in seen),
              '| picked voice forgotten:', pg.evaluate('App.settings.elVoice') == '')
        ok &= voices[:2] == ['LibraryVoice0001', DEF_VOICE] and all(k == key for _, k, _ in seen)
        ok &= pg.evaluate('App.settings.elVoice') == ''
        # 2) the month is spent: a toast, and the unit's own voice reads it
        pg.evaluate("window.__calls.length = 0; App.voice.speak('خلص الرصيد؟ هذي جملة جديدة')"); pg.wait_for_timeout(1500)
        toast = pg.evaluate("(document.querySelector('.toast, #toast') || {}).textContent || ''")
        native = pg.evaluate("window.__calls.filter(c => c[0] === 'tts' && c[1]).length")
        print('spent -> toast:', repr(toast.strip()[:60]), '| unit voice used:', native > 0)
        ok &= 'رصيد' in toast and native > 0
        # 3) one switch in Settings, and nothing else
        pg.click('.dk[data-panel="settings"]'); pg.wait_for_timeout(500)
        rows = pg.evaluate("['sElOn','sElKey','sElVoices','sElTest','sElClear'].filter(id => document.getElementById(id))")
        print('settings rows:', rows)
        ok &= rows == ['sElOn']
        ok &= not errors
        if errors:
            print('page errors:', errors[:3])
        b.close(); p.stop()

        # 4) the public build: no key, no voice rows
        seen = []
        p, b, pg, errors = page_for(os.path.join(HERE, '..', 'web'), seen, {})
        pg.click('.dk[data-panel="settings"]'); pg.wait_for_timeout(500)
        pub = pg.evaluate("[App.voice.enabled(), !!document.getElementById('sElOn')]")
        print('public build -> voice on / row shown:', pub)
        ok &= pub == [False, False] and not errors
        b.close(); p.stop()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('VOICE TEST', 'OK' if ok else 'FAILED')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
