#!/usr/bin/env python3
"""build_private.py — the owner's own build of «رحلة» (نسخة بناتي): the web app plus a private folder that lives
OUTSIDE this repository. Nothing private is ever written into the repository; the private files only go into the APK.

    python3 build/build_private.py PRIVATE_DIR OUT_APK [--sealed | --no-key]

PRIVATE_DIR may hold:
  data/*.js        scripts added to the page before core.js (data/family.js — the family photos). A file that the
                   public app already has (ksa.js, kb.js…) is never taken from here, so an old copy cannot replace it.
  elevenlabs.key   an ElevenLabs API key. By default it goes into the APK scrambled (data/vk.js), so the natural
                   voice works with nothing to set up, and the app keeps it on the unit. Such an APK is handed to the
                   owner directly and never published.
                   --sealed is for a build that is published: the key goes in sealed with a 12-digit code (PBKDF2-
                   HMAC-SHA256, 200,000 rounds; the last digit is a Luhn check). The code is kept in voice.code in
                   PRIVATE_DIR and handed to the owner privately; he types it once in Settings. Without it the sealed
                   bytes say nothing about the key — every code opens to a key of the same shape.
                   --no-key leaves the key out.

Written for «رحلة» by أبو دانة للبرمجة.
"""
import base64
import hashlib
import json
import os
import re
import secrets
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_apk as b  # noqa: E402

MASK = 'رحلة-أبو-دانة'   # must match builtKey() in web/js/voice.js
ROUNDS = 200000           # PBKDF2 rounds for --sealed (voice.js reads them from the sealed data)
CORE = '<script src="js/core.js"></script>'


def scramble(key):
    return base64.b64encode(bytes(ord(ch) ^ ((ord(MASK[i % len(MASK)]) + i * 7) & 255)
                                  for i, ch in enumerate(key))).decode()


def unscramble(text):
    raw = base64.b64decode(text)
    return ''.join(chr(c ^ ((ord(MASK[i % len(MASK)]) + i * 7) & 255)) for i, c in enumerate(raw))


def luhn_digit(payload):
    total = 0
    for i, ch in enumerate(reversed(payload)):
        n = int(ch)
        if i % 2 == 0:
            n = n * 2 - 9 if n > 4 else n * 2
        total += n
    return str((10 - total % 10) % 10)


def luhn_ok(code):
    return code.isdigit() and luhn_digit(code[:-1]) == code[-1]


def new_code():
    p = ''.join(str(secrets.randbelow(10)) for _ in range(11))
    return p + luhn_digit(p)


def seal(key, code, salt=None):
    m = re.fullmatch(r'sk_([0-9a-f]{48})', key)
    if not m:
        sys.exit('--sealed needs a key of the form sk_ + 48 hex digits')
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', code.encode(), salt, ROUNDS, 32)
    sealed = bytes(a ^ b for a, b in zip(bytes.fromhex(m.group(1)), dk))
    return {'s': base64.b64encode(salt).decode(), 'c': base64.b64encode(sealed).decode(), 'n': ROUNDS}


def prepare(priv, web, key='plain'):
    """key: 'plain' (scrambled, for a build handed over directly), 'sealed' (for a published build) or None."""
    """Copy the private pieces into a copy of the web folder; returns the scripts added."""
    added = []
    data = os.path.join(priv, 'data')
    if os.path.isdir(data):
        for f in sorted(os.listdir(data)):
            if f.endswith('.js') and f != 'vk.js' and not os.path.exists(os.path.join(web, 'data', f)):
                shutil.copy(os.path.join(data, f), os.path.join(web, 'data', f))
                added.append('data/' + f)
    kf = os.path.join(priv, 'elevenlabs.key')
    if key and os.path.exists(kf):
        mode, key = key, open(kf, encoding='utf-8').read().strip()
        if not re.fullmatch(r'[\x21-\x7e]{20,200}', key):
            sys.exit('elevenlabs.key does not look like an API key')
        if mode == 'sealed':
            cf = os.path.join(priv, 'voice.code')
            if not os.path.exists(cf):
                with open(cf, 'w') as f:
                    f.write(new_code())
                os.chmod(cf, 0o600)
            code = open(cf).read().strip()
            assert luhn_ok(code) and len(code) == 12
            line = 'window.RIHLA_VKS = %s;\n' % json.dumps(seal(key, code))
        else:
            s = scramble(key)
            assert unscramble(s) == key
            line = "window.RIHLA_VK = '%s';\n" % s
        assert key not in line and key[3:] not in line and 'sk_' not in line
        with open(os.path.join(web, 'data', 'vk.js'), 'w', encoding='utf-8') as f:
            f.write(line)
        added.append('data/vk.js' + (' (sealed)' if mode == 'sealed' else ''))
    idx = os.path.join(web, 'index.html')
    page = open(idx, encoding='utf-8').read()
    if CORE not in page:
        sys.exit('index.html has no core.js script tag')
    page = page.replace(CORE, ''.join('<script src="%s"></script>\n' % a.split(' ')[0] for a in added) + CORE, 1)
    with open(idx, 'w', encoding='utf-8') as f:
        f.write(page)
    return added


def main():
    args = [a for a in sys.argv[1:] if a not in ('--no-key', '--sealed')]
    if len(args) != 2:
        sys.exit(__doc__)
    priv, out_apk = os.path.abspath(args[0]), os.path.abspath(args[1])
    if os.path.commonpath([priv, b.ROOT]) == b.ROOT:
        sys.exit('the private folder must be outside the repository')
    tmp = tempfile.mkdtemp(prefix='rihla_private_')
    try:
        web = os.path.join(tmp, 'web')
        shutil.copytree(b.WEB, web)
        mode = None if '--no-key' in sys.argv else 'sealed' if '--sealed' in sys.argv else 'plain'
        added = prepare(priv, web, key=mode)
        b.WEB, b.OUT, b.TMP = web, os.path.join(tmp, 'out'), os.path.join(tmp, 'tmp')
        b.main()
        shutil.copy(os.path.join(b.OUT, 'Rihla.apk'), out_apk)
        print('private build ->', out_apk, '| added:', ', '.join(added) or 'nothing')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
