#!/usr/bin/env python3
"""Assemble the Camry Nav APK without the Android SDK.

classes.dex  <- dex.py + app_code.py (hand-written Dalvik), checked by dexcheck.verify
AndroidManifest.xml / resources.arsc <- axml.py
assets/      <- the web UI in ../web
Signing: APK Signature Scheme v1 (JAR) made with the JDK's jarsigner, then transplanted into a
zipalign-style archive (stored entries 4-byte aligned). targetSdk 28 keeps v1 valid and lets the
app switch Wi-Fi / Bluetooth on and off directly.
"""
import hashlib
import re
import os
import struct
import subprocess
import sys
import zipfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dex import build_dex  # noqa: E402
from app_code import build_classes, PKG  # noqa: E402
import dexcheck  # noqa: E402
from axml import E, encode_xml, decode_xml, encode_arsc, decode_arsc  # noqa: E402

ROOT = os.path.dirname(HERE)
WEB = os.path.join(ROOT, 'web')
OUT = os.path.join(ROOT, 'out')
TMP = os.path.join(ROOT, 'tmp')
KEYSTORE = os.path.join(HERE, 'release.p12')
STOREPASS = 'camrynav2026'
ALIAS = 'camry'
APP_NAME = 'مقود'
VERSION_CODE, VERSION_NAME = 3, '2.1'
ICON_PATH = 'res/drawable-xxxhdpi-v4/icon.png'

PERMS = ['INTERNET', 'ACCESS_NETWORK_STATE', 'ACCESS_WIFI_STATE', 'CHANGE_WIFI_STATE',
         'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'BLUETOOTH', 'BLUETOOTH_ADMIN',
         'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN', 'NEARBY_WIFI_DEVICES', 'POST_NOTIFICATIONS']
# every config change handled in-place so the WebView (and an active route) never reloads,
# e.g. when the head unit flips night mode with the headlights
CONFIG_CHANGES = 0x0000FFFF | 0x10000000 | 0x40000000
THEME_NO_TITLE_BAR = 0x01030006   # @android:style/Theme.NoTitleBar (dark, no action bar)


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- dex
def make_dex():
    classes = build_classes()
    warnings = []
    for c in classes:
        for m in c.methods:
            dexcheck.verify(m, warnings)
    for w in warnings:
        log('  verifier note:', w)
    data = build_dex(classes)
    text = dexcheck.disasm(data)
    with open(os.path.join(OUT, 'classes.disasm.txt'), 'w') as f:
        f.write(text)
    # integrity of what we wrote
    assert data[:8] == b'dex\n035\0'
    assert struct.unpack_from('<I', data, 32)[0] == len(data)
    assert struct.unpack_from('<I', data, 8)[0] == zlib.adler32(data[12:]) & 0xFFFFFFFF
    assert data[12:32] == hashlib.sha1(data[32:]).digest()
    nmeth = sum(len(c.methods) for c in classes)
    log('  classes.dex: %d bytes, %d classes, %d methods verified' % (len(data), len(classes), nmeth))
    return data


# ---------------------------------------------------------------- manifest + resources
def make_manifest():
    perms = [E('uses-permission', {'android:name': 'android.permission.' + p}) for p in PERMS]
    root = E('manifest', {'package': PKG, 'android:versionCode': ('dec', VERSION_CODE),
                          'android:versionName': VERSION_NAME}, [
        # Android 13 (API 33) and newer; targetSdk 28 keeps the v1 signature valid and the direct Wi-Fi/BT toggles
        E('uses-sdk', {'android:minSdkVersion': ('dec', 33), 'android:targetSdkVersion': ('dec', 28)}),
    ] + perms + [
        E('application', {'android:label': APP_NAME, 'android:icon': ('ref', 0x7F010000),
                          'android:theme': ('ref', THEME_NO_TITLE_BAR),
                          'android:usesCleartextTraffic': ('bool', True)}, [
            E('activity', {'android:name': PKG + '.Main', 'android:exported': ('bool', True),
                           'android:launchMode': ('dec', 2),            # singleTask
                           'android:configChanges': ('hex', CONFIG_CHANGES),
                           'android:windowSoftInputMode': ('hex', 0x20)},  # adjustPan
              [E('intent-filter', {}, [
                  E('action', {'android:name': 'android.intent.action.MAIN'}),
                  E('category', {'android:name': 'android.intent.category.LAUNCHER'})])]),
        ]),
    ])
    data = encode_xml(root)
    log(decode_xml(data))
    return data


def make_icon():
    png = os.path.join(TMP, 'icon.png')
    subprocess.check_call(['rsvg-convert', '-w', '192', '-h', '192', '-o', png, os.path.join(HERE, 'icon.svg')])
    with open(png, 'rb') as f:
        return f.read()


# ---------------------------------------------------------------- zip
def zip_bytes(entries):
    """entries: [(name, data, compress)] -> zip bytes; stored entries get 4-byte aligned data."""
    out, cd = bytearray(), bytearray()
    dosdate, dostime = (2026 - 1980) << 9 | 11 << 5 | 12, 0
    for name, data, compress in entries:
        nb = name.encode('ascii')
        crc = zlib.crc32(data) & 0xFFFFFFFF
        method, comp = 0, data
        if compress:
            c = zlib.compressobj(9, zlib.DEFLATED, -15)
            z = c.compress(data) + c.flush()
            if len(z) < len(data):
                method, comp = 8, z
        extra = b''
        if method == 0:
            base = len(out) + 30 + len(nb)
            pad = (-(base + 6)) % 4
            extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\0' * pad   # zipalign-style padding field
        off = len(out)
        ver = 20 if method == 8 else 10
        out += struct.pack('<IHHHHHIIIHH', 0x04034B50, ver, 0, method, dostime, dosdate, crc,
                           len(comp), len(data), len(nb), len(extra)) + nb + extra
        if method == 0:
            assert len(out) % 4 == 0
        out += comp
        cd += struct.pack('<IHHHHHHIIIHHHHHII', 0x02014B50, 20, ver, 0, method, dostime, dosdate, crc,
                          len(comp), len(data), len(nb), 0, 0, 0, 0, 0, off) + nb
    cd_off = len(out)
    out += cd
    out += struct.pack('<IHHHHIIH', 0x06054B50, 0, 0, len(entries), len(entries), len(cd), cd_off, 0)
    return bytes(out)


# ---------------------------------------------------------------- signing
def ensure_key():
    if os.path.exists(KEYSTORE):
        return
    subprocess.check_call(['keytool', '-genkeypair', '-storetype', 'PKCS12', '-keystore', KEYSTORE,
                           '-storepass', STOREPASS, '-keypass', STOREPASS, '-alias', ALIAS,
                           '-keyalg', 'RSA', '-keysize', '2048', '-sigalg', 'SHA256withRSA',
                           '-validity', '10950', '-dname', 'CN=Camry Nav, OU=Car, O=Personal, C=SA'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def v1_signature_files(entries):
    """Sign a throw-away jar holding the same entries; JAR signatures cover names + contents only,
    so the META-INF files stay valid inside our own aligned archive."""
    ensure_key()
    tmpjar = os.path.join(TMP, 'unsigned.jar')
    with zipfile.ZipFile(tmpjar, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data, _ in entries:
            z.writestr(name, data)
    signed = os.path.join(TMP, 'signed.jar')
    subprocess.check_call(['jarsigner', '-keystore', KEYSTORE, '-storetype', 'PKCS12', '-storepass', STOREPASS,
                           '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', '-sigfile', 'CAMRY',
                           '-signedjar', signed, tmpjar, ALIAS], stdout=subprocess.DEVNULL)
    with zipfile.ZipFile(signed) as z:
        mf, sf = z.read('META-INF/MANIFEST.MF'), z.read('META-INF/CAMRY.SF')
        extra = [n for n in z.namelist() if n.startswith('META-INF/') and
                 n not in ('META-INF/MANIFEST.MF', 'META-INF/CAMRY.SF', 'META-INF/CAMRY.RSA')]
        assert not extra, extra
    # Re-make the PKCS#7 block without signed attributes (the format apksigner writes). Recent
    # jarsigners add a CMSAlgorithmProtection attribute that older Android verifiers cannot parse.
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.serialization import pkcs7, pkcs12
    with open(KEYSTORE, 'rb') as f:
        key, cert, _ = pkcs12.load_key_and_certificates(f.read(), STOREPASS.encode())
    rsa = pkcs7.PKCS7SignatureBuilder().set_data(sf).add_signer(cert, key, hashes.SHA256()).sign(
        serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.NoAttributes,
                                     pkcs7.PKCS7Options.Binary])
    return [('META-INF/MANIFEST.MF', mf, True), ('META-INF/CAMRY.SF', sf, True), ('META-INF/CAMRY.RSA', rsa, True)]


# ---------------------------------------------------------------- main
def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    log('[1/5] classes.dex')
    dex = make_dex()
    log('[2/5] manifest + resources')
    manifest = make_manifest()
    icon = make_icon()
    arsc = encode_arsc(PKG, [('icon', ICON_PATH)], density=640, sdk=4)
    name, res = decode_arsc(arsc)
    log('  resources.arsc: package %s; %s' % (name, '; '.join(res)))
    log('[3/5] assets')
    entries = [('AndroidManifest.xml', manifest, True), ('classes.dex', dex, True),
               ('resources.arsc', arsc, False), (ICON_PATH, icon, False)]
    for d, _, files in sorted(os.walk(WEB)):
        for fn in sorted(files):
            if fn.startswith('.'):
                continue
            full = os.path.join(d, fn)
            rel = os.path.relpath(full, WEB).replace(os.sep, '/')
            with open(full, 'rb') as f:
                entries.append(('assets/' + rel, f.read(), True))
    log('  %d asset files' % (len(entries) - 4))
    log('[4/5] sign (v1) + align')
    sig = v1_signature_files(entries)
    apk = zip_bytes(sig + entries)
    path = os.path.join(OUT, 'CamryNav.apk')
    with open(path, 'wb') as f:
        f.write(apk)
    log('[5/5] verify')
    # (non-strict: a self-signed certificate is normal for Android apps)
    r = subprocess.run(['jarsigner', '-verify', path], capture_output=True, text=True)
    ok = 'jar verified.' in r.stdout
    # independent check of the detached PKCS#7 over the .SF with OpenSSL, and no signed attributes
    sigdir = os.path.join(TMP, 'sig')
    os.makedirs(sigdir, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for n in ('META-INF/CAMRY.SF', 'META-INF/CAMRY.RSA'):
            with open(os.path.join(sigdir, n.split('/')[1]), 'wb') as f:
                f.write(z.read(n))
    v = subprocess.run(['openssl', 'smime', '-verify', '-inform', 'DER', '-in', os.path.join(sigdir, 'CAMRY.RSA'),
                        '-content', os.path.join(sigdir, 'CAMRY.SF'), '-noverify', '-binary', '-out', os.devnull],
                       capture_output=True, text=True)
    dump = subprocess.run(['openssl', 'cms', '-cmsout', '-print', '-inform', 'DER', '-in',
                           os.path.join(sigdir, 'CAMRY.RSA')], capture_output=True, text=True).stdout
    log('  openssl:', (v.stderr or v.stdout).strip(), '| signed attributes:',
        'none' if re.search(r'signedAttrs:\s*<ABSENT>', dump) else 'PRESENT')
    ok = ok and 'Verification successful' in (v.stderr + v.stdout) and 'object: undefined' not in dump
    log('  jarsigner:', r.stdout.strip().splitlines()[0] if r.stdout.strip() else r.stderr.strip())
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        names = z.namelist()
        assert len(names) == len(set(names))
        for info in z.infolist():
            if info.compress_type == zipfile.ZIP_STORED:
                with open(path, 'rb') as f:
                    f.seek(info.header_offset)
                    h = f.read(30)
                    nl, el = struct.unpack_from('<HH', h, 26)
                    assert (info.header_offset + 30 + nl + el) % 4 == 0, info.filename
        assert z.read('classes.dex') == dex and z.read('resources.arsc') == arsc
    log('  %s  %.1f KB  %d entries  sha256 %s' % (path, len(apk) / 1024, len(names),
                                                   hashlib.sha256(apk).hexdigest()[:16]))
    if not ok:
        raise SystemExit('signature verification failed:\n' + r.stdout + r.stderr)


if __name__ == '__main__':
    main()
