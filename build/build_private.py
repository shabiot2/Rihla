#!/usr/bin/env python3
"""build_private.py — the owner's own build of «رحلة» (نسخة بناتي): the web app plus a private folder that lives
OUTSIDE this repository. Nothing private is ever written into the repository; the private files only go into the APK.

    python3 build/build_private.py PRIVATE_DIR OUT_APK [--no-key]

PRIVATE_DIR may hold:
  data/*.js        scripts added to the page before core.js (data/family.js — the family photos). A file that the
                   public app already has (ksa.js, kb.js…) is never taken from here, so an old copy cannot replace it.
  elevenlabs.key   an ElevenLabs API key. It goes into the APK scrambled (data/vk.js), so the natural voice works
                   with nothing to set up on the unit, and the app keeps it on the unit. Such an APK is handed to the
                   owner directly, never published; the published builds use --no-key and keep the voice all the same.

Written for «رحلة» by أبو دانة للبرمجة.
"""
import base64
import os
import re
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_apk as b  # noqa: E402

MASK = 'رحلة-أبو-دانة'   # must match builtKey() in web/js/voice.js
CORE = '<script src="js/core.js"></script>'


def scramble(key):
    return base64.b64encode(bytes(ord(ch) ^ ((ord(MASK[i % len(MASK)]) + i * 7) & 255)
                                  for i, ch in enumerate(key))).decode()


def unscramble(text):
    raw = base64.b64decode(text)
    return ''.join(chr(c ^ ((ord(MASK[i % len(MASK)]) + i * 7) & 255)) for i, c in enumerate(raw))


def prepare(priv, web, key=True):
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
        key = open(kf, encoding='utf-8').read().strip()
        if not re.fullmatch(r'[\x21-\x7e]{20,200}', key):
            sys.exit('elevenlabs.key does not look like an API key')
        s = scramble(key)
        assert unscramble(s) == key and key not in s
        with open(os.path.join(web, 'data', 'vk.js'), 'w', encoding='utf-8') as f:
            f.write("window.RIHLA_VK = '%s';\n" % s)
        added.append('data/vk.js')
    idx = os.path.join(web, 'index.html')
    page = open(idx, encoding='utf-8').read()
    if CORE not in page:
        sys.exit('index.html has no core.js script tag')
    page = page.replace(CORE, ''.join('<script src="%s"></script>\n' % a for a in added) + CORE, 1)
    with open(idx, 'w', encoding='utf-8') as f:
        f.write(page)
    return added


def main():
    args = [a for a in sys.argv[1:] if a != '--no-key']
    if len(args) != 2:
        sys.exit(__doc__)
    priv, out_apk = os.path.abspath(args[0]), os.path.abspath(args[1])
    if os.path.commonpath([priv, b.ROOT]) == b.ROOT:
        sys.exit('the private folder must be outside the repository')
    tmp = tempfile.mkdtemp(prefix='rihla_private_')
    try:
        web = os.path.join(tmp, 'web')
        shutil.copytree(b.WEB, web)
        added = prepare(priv, web, key='--no-key' not in sys.argv)
        b.WEB, b.OUT, b.TMP = web, os.path.join(tmp, 'out'), os.path.join(tmp, 'tmp')
        b.main()
        shutil.copy(os.path.join(b.OUT, 'Rihla.apk'), out_apk)
        print('private build ->', out_apk, '| added:', ', '.join(added) or 'nothing')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
