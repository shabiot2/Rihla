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
APP_NAME = 'رحلة'
VERSION_CODE, VERSION_NAME = 26, '3.5.6'
ICON_PATH = 'res/drawable-xxxhdpi-v4/icon.png'

PERMS = ['INTERNET', 'ACCESS_NETWORK_STATE', 'ACCESS_WIFI_STATE', 'CHANGE_WIFI_STATE',
         'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'BLUETOOTH', 'BLUETOOTH_ADMIN',
         'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN', 'NEARBY_WIFI_DEVICES', 'POST_NOTIFICATIONS',
         'ACCESS_LOCATION_EXTRA_COMMANDS', 'READ_EXTERNAL_STORAGE']
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
        # installs on any Android 5+ (head units often report a newer version than they run);
        # targetSdk 28 keeps the direct Wi-Fi/BT toggles
        E('uses-sdk', {'android:minSdkVersion': ('dec', 21), 'android:targetSdkVersion': ('dec', 28)}),
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
        assert sf.startswith(b'Signature-Version: 1.0\r\n')
        sf = sf.replace(b'Signature-Version: 1.0\r\n', b'Signature-Version: 1.0\r\nX-Android-APK-Signed: 2\r\n', 1)
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


# ---------------------------------------------------------------- APK Signature Scheme v2
def _lp(b):
    return struct.pack('<I', len(b)) + b


def _chunked_sha256(sections):
    digests = []
    for sec in sections:
        for i in range(0, len(sec), 1 << 20):
            c = sec[i:i + (1 << 20)]
            digests.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(digests)) + b''.join(digests)).digest()


def v2_sign(apk):
    """Insert an APK Signing Block (v2, RSA PKCS#1 v1.5 + SHA-256, algorithm 0x0103)."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.serialization import pkcs12
    with open(KEYSTORE, 'rb') as f:
        key, cert, _ = pkcs12.load_key_and_certificates(f.read(), STOREPASS.encode())
    eocd = apk.rfind(b'PK\x05\x06')
    assert eocd > 0 and len(apk) - eocd == 22
    cd_size, cd_off = struct.unpack_from('<II', apk, eocd + 12)
    assert cd_off + cd_size == eocd
    before, cd, eocd_b = apk[:cd_off], apk[cd_off:eocd], bytearray(apk[eocd:])
    # for the digest the EOCD points at the signing block, i.e. the old CD offset (unchanged here)
    digest = _chunked_sha256([before, cd, bytes(eocd_b)])
    cert_der = cert.public_bytes(serialization.Encoding.DER)
    signed_data = _lp(_lp(struct.pack('<I', 0x0103) + _lp(digest))) + _lp(_lp(cert_der)) + _lp(b'')
    sig = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = _lp(signed_data) + _lp(_lp(struct.pack('<I', 0x0103) + _lp(sig))) + _lp(pub)
    v2 = _lp(_lp(signer))
    pair = struct.pack('<Q', 4 + len(v2)) + struct.pack('<I', 0x7109871a) + v2
    block_size = len(pair) + 8 + 16                        # pairs + trailing size + magic
    block = struct.pack('<Q', block_size) + pair + struct.pack('<Q', block_size) + b'APK Sig Block 42'
    struct.pack_into('<I', eocd_b, 16, cd_off + len(block))
    out = before + block + cd + bytes(eocd_b)
    # self-check: recompute as a verifier would
    e2 = out.rfind(b'PK\x05\x06')
    co = struct.unpack_from('<I', out, e2 + 16)[0]
    assert out[co - 16:co] == b'APK Sig Block 42'
    bs = struct.unpack_from('<Q', out, co - 24)[0]
    bstart = co - bs - 8
    assert struct.unpack_from('<Q', out, bstart)[0] == bs
    e_copy = bytearray(out[e2:]); struct.pack_into('<I', e_copy, 16, bstart)
    assert _chunked_sha256([out[:bstart], out[co:e2], bytes(e_copy)]) == digest
    key.public_key().verify(sig, signed_data, padding.PKCS1v15(), hashes.SHA256())
    return out


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
    apk = v2_sign(zip_bytes(sig + entries))
    path = os.path.join(OUT, 'Rihla.apk')
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
