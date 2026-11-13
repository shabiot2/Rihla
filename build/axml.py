"""Binary Android XML (AXML) encoder/decoder and a minimal resources.arsc writer."""
import struct

ANDROID_NS = 'http://schemas.android.com/apk/res/android'

# android:attr resource ids (from the platform's public.xml)
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
    'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'usesCleartextTraffic': 0x010104ec,
    'windowSoftInputMode': 0x0101022b, 'maxSdkVersion': 0x01010271,
}
TYPE_REFERENCE, TYPE_STRING, TYPE_INT_DEC, TYPE_INT_HEX, TYPE_INT_BOOLEAN = 0x01, 0x03, 0x10, 0x11, 0x12


class E:
    """XML element: E(tag, {attr: value}, [children]). Attribute keys 'android:x' or plain.
    Values: str -> string, ('ref', id), ('dec', n), ('hex', n), ('bool', b)."""

    def __init__(self, tag, attrs=None, children=()):
        self.tag, self.attrs, self.children = tag, dict(attrs or {}), list(children)


def _string_pool(strings):
    offs, data = [], bytearray()
    for s in strings:
        offs.append(len(data))
        u = s.encode('utf-16-le')
        n = len(u) // 2
        assert n < 0x8000
        data += struct.pack('<H', n) + u + b'\0\0'
    while len(data) % 4:
        data += b'\0'
    hdr = 28
    strings_start = hdr + 4 * len(strings)
    size = strings_start + len(data)
    out = struct.pack('<HHIIIIII', 0x0001, hdr, size, len(strings), 0, 0, strings_start, 0)
    out += b''.join(struct.pack('<I', o) for o in offs) + bytes(data)
    assert len(out) == size
    return out


def encode_xml(root):
    # collect attribute names with ids first (resource map), then all other strings
    res_names, others = [], []

    def walk(e):
        for k in e.attrs:
            ns, _, nm = k.rpartition(':')
            if ns == 'android':
                if nm not in res_names:
                    res_names.append(nm)
            elif nm not in others:
                others.append(nm)
        if e.tag not in others:
            others.append(e.tag)
        for v in e.attrs.values():
            if isinstance(v, str) and v not in others:
                others.append(v)
        for c in e.children:
            walk(c)

    walk(root)
    res_names.sort(key=lambda n: ATTR_IDS[n])
    others = ['android', ANDROID_NS] + [s for s in others if s not in ('android', ANDROID_NS)]
    strings = res_names + [s for s in others if s not in res_names]
    si = {s: i for i, s in enumerate(strings)}

    pool = _string_pool(strings)
    rmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(res_names)) + b''.join(
        struct.pack('<I', ATTR_IDS[n]) for n in res_names)

    nodes = bytearray()
    line = [1]

    def node(typ, body):
        nodes.extend(struct.pack('<HHIII', typ, 16, 16 + len(body), line[0], 0xFFFFFFFF) + body)
        line[0] += 1

    node(0x0100, struct.pack('<II', si['android'], si[ANDROID_NS]))

    def emit(e):
        attrs = []
        for k, v in e.attrs.items():
            ns, _, nm = k.rpartition(':')
            nsi = si[ANDROID_NS] if ns == 'android' else 0xFFFFFFFF
            if isinstance(v, str):
                raw, typ, data = si[v], TYPE_STRING, si[v]
            else:
                kind, val = v
                raw = 0xFFFFFFFF
                typ, data = {'ref': (TYPE_REFERENCE, val), 'dec': (TYPE_INT_DEC, val),
                             'hex': (TYPE_INT_HEX, val),
                             'bool': (TYPE_INT_BOOLEAN, 0xFFFFFFFF if val else 0)}[kind]
            rid = ATTR_IDS[nm] if ns == 'android' else 0x7FFFFFFF
            attrs.append((rid, nm, struct.pack('<IIIHBBI', nsi, si[nm], raw, 8, 0, typ, data & 0xFFFFFFFF)))
        attrs.sort(key=lambda a: (a[0], a[1]))
        body = struct.pack('<IIHHHHHH', 0xFFFFFFFF, si[e.tag], 20, 20, len(attrs), 0, 0, 0)
        body += b''.join(a[2] for a in attrs)
        node(0x0102, body)
        for c in e.children:
            emit(c)
        node(0x0103, struct.pack('<II', 0xFFFFFFFF, si[e.tag]))

    emit(root)
    node(0x0101, struct.pack('<II', si['android'], si[ANDROID_NS]))
    body = pool + rmap + bytes(nodes)
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body


def decode_xml(b):
    """Decode AXML back to readable text (for verification)."""
    t, hs, size = struct.unpack_from('<HHI', b, 0)
    assert t == 3 and size == len(b)
    o = 8
    strings, rmap, out, depth = [], [], [], 0
    while o < len(b):
        typ, hsz, csz = struct.unpack_from('<HHI', b, o)
        if typ == 0x0001:
            n, _, flags, ss, _ = struct.unpack_from('<IIIII', b, o + 8)
            for k in range(n):
                so = o + ss + struct.unpack_from('<I', b, o + 28 + 4 * k)[0]
                ln = struct.unpack_from('<H', b, so)[0]
                strings.append(b[so + 2:so + 2 + 2 * ln].decode('utf-16-le'))
        elif typ == 0x0180:
            rmap = list(struct.unpack_from('<%dI' % ((csz - 8) // 4), b, o + 8))
        elif typ == 0x0102:
            ns, name, ast, asz, cnt = struct.unpack_from('<IIHHH', b, o + 16)
            parts = []
            for k in range(cnt):
                a = o + 16 + ast + k * asz
                ans, an, raw, _, _, at, ad = struct.unpack_from('<IIIHBBI', b, a)
                rid = ' #%08x' % rmap[an] if an < len(rmap) else ''
                val = strings[ad] if at == TYPE_STRING else '(0x%02x)0x%x' % (at, ad)
                parts.append('%s%s%s=%r' % ('android:' if ans != 0xFFFFFFFF else '', strings[an], rid, val))
            out.append('  ' * depth + '<%s %s>' % (strings[name], ' '.join(parts)))
            depth += 1
        elif typ == 0x0103:
            depth -= 1
        o += csz
    return '\n'.join(out)


def encode_arsc(package, entries, density=0, sdk=0):
    """resources.arsc with one 'drawable' type in a single configuration.
    entries: [(key, 'res/drawable-xxxhdpi-v4/x.png')]; density e.g. 640 (xxxhdpi), 0 = default."""
    values = _string_pool([p for _, p in entries])
    type_pool = _string_pool(['drawable'])
    key_pool = _string_pool([k for k, _ in entries])
    n = len(entries)
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4 * n, 1, 0, 0, n) + b'\0' * (4 * n)
    config = bytearray(struct.pack('<I', 64) + b'\0' * 60)
    struct.pack_into('<H', config, 14, density)   # ResTable_config.density
    struct.pack_into('<H', config, 24, sdk)       # ResTable_config.sdkVersion
    config = bytes(config)
    hdr_size = 20 + len(config)
    entries_start = hdr_size + 4 * n
    ent = b''
    offs = b''
    for i in range(n):
        offs += struct.pack('<I', len(ent))
        ent += struct.pack('<HHI', 8, 0, i) + struct.pack('<HBBI', 8, 0, TYPE_STRING, i)
    tchunk = struct.pack('<HHIBBHII', 0x0201, hdr_size, entries_start + len(ent), 1, 0, 0, n,
                         entries_start) + config + offs + ent
    name = package.encode('utf-16-le')
    name = name + b'\0' * (256 - len(name))
    pkg_hdr = 288
    type_off = pkg_hdr
    key_off = type_off + len(type_pool)
    body = type_pool + key_pool + spec + tchunk
    pkg = struct.pack('<HHII', 0x0200, pkg_hdr, pkg_hdr + len(body), 0x7F) + name + struct.pack(
        '<IIIII', type_off, 1, key_off, n, 0) + body
    assert len(pkg) == pkg_hdr + len(body)
    total = 12 + len(values) + len(pkg)
    return struct.pack('<HHII', 0x0002, 12, total, 1) + values + pkg


def decode_arsc(b):
    """Small reader used to double-check the table we wrote."""
    def pool(o):
        n, _, flags, ss, _ = struct.unpack_from('<IIIII', b, o + 8)
        out = []
        for k in range(n):
            so = o + ss + struct.unpack_from('<I', b, o + 28 + 4 * k)[0]
            ln = struct.unpack_from('<H', b, so)[0]
            out.append(b[so + 2:so + 2 + 2 * ln].decode('utf-16-le'))
        return out
    t, hs, size, npk = struct.unpack_from('<HHII', b, 0)
    assert t == 2 and hs == 12 and size == len(b) and npk == 1
    vals = pool(12)
    po = 12 + struct.unpack_from('<I', b, 16)[0]
    pt, phs, psize, pid = struct.unpack_from('<HHII', b, po)
    assert pt == 0x200 and phs == 288 and po + psize == len(b)
    name = b[po + 12:po + 12 + 256].decode('utf-16-le').rstrip('\0')
    tso, _, kso, _, _ = struct.unpack_from('<IIIII', b, po + 268)
    types, keys = pool(po + tso), pool(po + kso)
    o = po + kso + struct.unpack_from('<I', b, po + kso + 4)[0]
    res = []
    while o < po + psize:
        ct, chs, csz = struct.unpack_from('<HHI', b, o)
        assert csz % 4 == 0 and chs % 4 == 0 and o % 4 == 0
        if ct == 0x0201:
            tid, _, _, cnt, est = struct.unpack_from('<BBHII', b, o + 8)
            cfg = b[o + 20:o + 20 + 64]
            dens, sdk = struct.unpack_from('<H', cfg, 14)[0], struct.unpack_from('<H', cfg, 24)[0]
            for k in range(cnt):
                eo = struct.unpack_from('<I', b, o + chs + 4 * k)[0]
                es, ef, key = struct.unpack_from('<HHI', b, o + est + eo)
                vs, _, vt, vd = struct.unpack_from('<HBBI', b, o + est + eo + es)
                res.append('0x%02x%02x%04x %s/%s density=%d sdk=%d -> %s' % (
                    pid, tid, k, types[tid - 1], keys[key], dens, sdk, vals[vd] if vt == TYPE_STRING else vd))
        o += csz
    return name, res
