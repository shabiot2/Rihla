"""Checks for the hand-written Dalvik code.

1) verify(): a small abstract interpreter that mirrors the ART verifier rules our
   code relies on (register types, wide pairs, uninitialised refs, invoke args,
   move-result pairing, returns, exception handlers, fall-through).
2) disasm(): re-parses the produced .dex bytes and disassembles every method, so
   the binary encoding can be compared with the source.
"""
import struct
import zlib
import hashlib

from dex import OPS, SIZES, words_of

OBJ = 'Ljava/lang/Object;'
SUPER = {
    'Landroid/content/pm/ApplicationInfo;': 'Landroid/content/pm/PackageItemInfo;',
    'Landroid/content/pm/ActivityInfo;': 'Landroid/content/pm/ComponentInfo;',
    'Landroid/content/pm/ComponentInfo;': 'Landroid/content/pm/PackageItemInfo;',
    'Landroid/content/pm/PackageItemInfo;': 'Ljava/lang/Object;',
    'Landroid/content/pm/PackageInfo;': 'Ljava/lang/Object;',
    'Landroid/content/ComponentName;': 'Ljava/lang/Object;',
    'Lcom/carnav/camry/Main;': 'Landroid/app/Activity;',
    'Lcom/carnav/camry/Chrome;': 'Landroid/webkit/WebChromeClient;',
    'Landroid/app/Activity;': 'Landroid/view/ContextThemeWrapper;',
    'Landroid/view/ContextThemeWrapper;': 'Landroid/content/ContextWrapper;',
    'Landroid/content/ContextWrapper;': 'Landroid/content/Context;',
    'Landroid/webkit/WebView;': 'Landroid/widget/AbsoluteLayout;',
    'Landroid/widget/AbsoluteLayout;': 'Landroid/view/ViewGroup;',
    'Landroid/view/ViewGroup;': 'Landroid/view/View;',
    'Landroid/webkit/JsPromptResult;': 'Landroid/webkit/JsResult;',
    'Landroid/content/pm/ActivityInfo;': 'Landroid/content/pm/ComponentInfo;',
    'Landroid/content/pm/ComponentInfo;': 'Landroid/content/pm/PackageItemInfo;',
    'Ljava/io/ByteArrayOutputStream;': 'Ljava/io/OutputStream;',
    'Landroid/graphics/Bitmap$Config;': 'Ljava/lang/Enum;',
    'Landroid/graphics/Bitmap$CompressFormat;': 'Ljava/lang/Enum;',
    'Landroid/view/KeyEvent;': 'Landroid/view/InputEvent;',
    'Landroid/os/Bundle;': 'Landroid/os/BaseBundle;',
    'Lcom/carnav/camry/Sys;': 'Ljava/lang/Object;',
    'Landroid/os/Build;': 'Ljava/lang/Object;',
    'Lcom/carnav/camry/Web;': 'Landroid/webkit/WebViewClient;',
    'Lcom/carnav/camry/Gnss;': 'Landroid/location/GnssStatus$Callback;',
    'Lcom/carnav/camry/Rcv;': 'Landroid/content/BroadcastReceiver;',
    'Landroid/location/GnssStatus$Callback;': 'Ljava/lang/Object;',
    'Landroid/location/GnssStatus;': 'Ljava/lang/Object;',
    'Ljava/net/HttpURLConnection;': 'Ljava/net/URLConnection;',
    'Ljava/net/URLConnection;': 'Ljava/lang/Object;',
    'Ljava/net/URL;': 'Ljava/lang/Object;',
    'Ljava/io/File;': 'Ljava/lang/Object;',
    'Ljava/io/FileOutputStream;': 'Ljava/io/OutputStream;',
    'Ljava/io/FileInputStream;': 'Ljava/io/InputStream;',
    'Ljava/io/ByteArrayInputStream;': 'Ljava/io/InputStream;',
    'Ljava/io/InputStream;': 'Ljava/lang/Object;',
    'Ljava/util/HashMap;': 'Ljava/util/AbstractMap;',
    'Ljava/util/AbstractMap;': 'Ljava/lang/Object;',
    'Ljava/util/concurrent/atomic/AtomicLong;': 'Ljava/lang/Number;',
    'Ljava/util/concurrent/atomic/AtomicInteger;': 'Ljava/lang/Number;',
    'Ljava/lang/Number;': 'Ljava/lang/Object;',
    'Landroid/webkit/WebResourceResponse;': 'Ljava/lang/Object;',
    'Landroid/net/ConnectivityManager;': 'Ljava/lang/Object;',
    'Landroid/net/NetworkInfo;': 'Ljava/lang/Object;',
    'Ljava/lang/Thread;': 'Ljava/lang/Object;',
    'Ljava/io/FileReader;': 'Ljava/io/InputStreamReader;',
    'Ljava/io/InputStreamReader;': 'Ljava/io/Reader;',
    'Ljava/io/BufferedReader;': 'Ljava/io/Reader;',
    'Ljava/io/Reader;': 'Ljava/lang/Object;',
    'Landroid/content/IntentFilter;': 'Ljava/lang/Object;',
    'Landroid/os/PowerManager;': 'Ljava/lang/Object;',
    'Landroid/content/BroadcastReceiver;': 'Ljava/lang/Object;',
    'Landroid/content/pm/ComponentInfo;': 'Landroid/content/pm/PackageItemInfo;',
    'Landroid/content/pm/ServiceInfo;': 'Landroid/content/pm/ComponentInfo;',
    'Landroid/content/pm/ProviderInfo;': 'Landroid/content/pm/ComponentInfo;',
    'Landroid/content/pm/PackageInfo;': 'Ljava/lang/Object;',
    'Landroid/hardware/usb/UsbManager;': 'Ljava/lang/Object;',
    'Landroid/hardware/usb/UsbDevice;': 'Ljava/lang/Object;',
    'Landroid/hardware/usb/UsbInterface;': 'Ljava/lang/Object;',
    'Landroid/content/ContentResolver;': 'Ljava/lang/Object;',
    'Landroid/os/CancellationSignal;': 'Ljava/lang/Object;',
    'Ljava/util/zip/ZipFile;': 'Ljava/lang/Object;',
    'Ljava/util/zip/ZipEntry;': 'Ljava/lang/Object;',
    'Ljava/io/BufferedInputStream;': 'Ljava/io/FilterInputStream;',
    'Ljava/io/FilterInputStream;': 'Ljava/io/InputStream;',
    'Ljava/util/LinkedHashSet;': 'Ljava/util/HashSet;',
    'Ljava/util/HashSet;': 'Ljava/util/AbstractSet;',
    'Ljava/util/AbstractSet;': 'Ljava/util/AbstractCollection;',
    'Ljava/util/AbstractCollection;': 'Ljava/lang/Object;',
}
for _c in ['Landroid/content/Context;', 'Landroid/view/View;', 'Landroid/webkit/WebChromeClient;',
           'Landroid/webkit/WebViewClient;', 'Landroid/webkit/WebSettings;', 'Landroid/webkit/JsResult;',
           'Landroid/view/Window;', 'Landroid/location/LocationManager;', 'Landroid/location/Location;',
           'Ljava/lang/StringBuilder;', 'Ljava/lang/String;', 'Landroid/content/Intent;', 'Landroid/net/Uri;',
           'Landroid/content/pm/PackageManager;', 'Landroid/content/pm/ResolveInfo;',
           'Landroid/content/pm/PackageItemInfo;', 'Lorg/json/JSONArray;', 'Lorg/json/JSONObject;',
           'Landroid/graphics/Bitmap;', 'Landroid/graphics/Canvas;', 'Landroid/graphics/drawable/Drawable;',
           'Ljava/io/OutputStream;', 'Ljava/lang/Enum;', 'Landroid/net/wifi/WifiManager;',
           'Landroid/net/wifi/WifiInfo;', 'Landroid/bluetooth/BluetoothAdapter;',
           'Landroid/bluetooth/BluetoothDevice;', 'Landroid/speech/tts/TextToSpeech;', 'Ljava/util/Locale;',
           'Landroid/media/AudioManager;', 'Landroid/view/InputEvent;', 'Ljava/lang/Throwable;',
           'Landroid/os/BaseBundle;', 'Ljava/lang/Integer;', 'Landroid/util/Base64;']:
    SUPER.setdefault(_c, OBJ)
IFACE = {'Landroid/location/LocationListener;', 'Landroid/speech/tts/TextToSpeech$OnInitListener;',
         'Ljava/lang/CharSequence;', 'Ljava/util/List;', 'Ljava/util/Set;', 'Ljava/util/Iterator;',
         'Landroid/webkit/ValueCallback;', 'Landroid/webkit/GeolocationPermissions$Callback;',
         'Ljava/util/Map;', 'Landroid/webkit/WebResourceRequest;', 'Landroid/database/Cursor;',
         'Ljava/util/Collection;', 'Ljava/util/Enumeration;'}
IMPLS = {'Lcom/carnav/camry/Main;': {'Landroid/location/LocationListener;',
                                     'Landroid/speech/tts/TextToSpeech$OnInitListener;'},
         'Ljava/lang/String;': {'Ljava/lang/CharSequence;'},
         'Ljava/util/HashMap;': {'Ljava/util/Map;'},
         'Ljava/util/LinkedHashSet;': {'Ljava/util/Set;', 'Ljava/util/Collection;'},
         'Ljava/util/HashSet;': {'Ljava/util/Set;', 'Ljava/util/Collection;'}}

U, X, K0, K, I, F = ('U',), ('X',), ('K0',), ('K',), ('I',), ('F',)
INTS = set('ZBSCI')


def chain(c):
    out = [c]
    while c in SUPER:
        c = SUPER[c]
        out.append(c)
    return out


class VerifyError(Exception):
    pass


def assignable(src, dst, warn):
    if src == dst or dst == OBJ:
        return True
    if dst.startswith('[') or src.startswith('['):
        return src == dst
    if dst in IFACE:
        if any(dst in IMPLS.get(c, ()) for c in chain(src)):
            return True
        if src in IFACE:
            warn('interface %s used as %s' % (src, dst))
            return True
        warn('cannot confirm %s implements %s' % (src, dst))
        return True
    if src not in SUPER:
        raise VerifyError('unknown hierarchy for %s (need %s)' % (src, dst))
    return dst in chain(src)


def merge(a, b):
    if a == b:
        return a
    if 'U' in (a[0], b[0]) or 'X' in (a[0], b[0]):
        return X
    s = {a[0], b[0]}
    if s <= {'K0', 'K', 'I'}:
        return I if 'I' in s else K
    if s <= {'K0', 'K', 'F'}:
        return F
    if a[0] == 'R' and b[0] == 'K0' and a[2]:
        return a
    if b[0] == 'R' and a[0] == 'K0' and b[2]:
        return b
    if a[0] == 'R' and b[0] == 'R' and a[2] and b[2]:
        ca, cb = chain(a[1]) if a[1] in SUPER else [a[1], OBJ], chain(b[1]) if b[1] in SUPER else [b[1], OBJ]
        for c in ca:
            if c in cb:
                return ('R', c, True, None)
        return ('R', OBJ, True, None)
    pairs = [{'JL', 'WL'}, {'JH', 'WH'}, {'DL', 'WL'}, {'DH', 'WH'}]
    for p in pairs:
        if s <= p:
            return (sorted(s - {'WL', 'WH'})[0],) if s - {'WL', 'WH'} else a
    return X


def verify(m, warnings):
    """Raise VerifyError on problems; append soft warnings."""
    name = '%s->%s' % (m.cls, m.name)

    def warn(msg):
        warnings.append('%s: %s' % (name, msg))

    by_addr = {i.addr: i for i in m.insns}
    order = [i.addr for i in m.insns]
    nxt = {a: (order[k + 1] if k + 1 < len(order) else None) for k, a in enumerate(order)}
    handlers = {}
    for s, e, h in m.tries:
        sa, ea, ha = m.labels[s], m.labels[e], m.labels[h]
        for a in order:
            if sa <= a < ea:
                handlers.setdefault(a, []).append(ha)
        if by_addr[ha].name != 'move-exception':
            raise VerifyError('%s: handler at %x must start with move-exception' % (name, ha))

    regs = [U] * m.regs
    p = m.regs - m.ins
    if not m.static:
        is_ctor = m.name == '<init>'
        regs[p] = ('R', m.cls, not is_ctor, 'this' if is_ctor else None)
        p += 1
    for t in m.params:
        if t in INTS:
            regs[p] = I
        elif t == 'F':
            regs[p] = F
        elif t in 'JD':
            regs[p], regs[p + 1] = (t + 'L',), (t + 'H',)
        else:
            regs[p] = ('R', t, True, None)
        p += words_of(t)

    states = {0: (tuple(regs), None)}
    work = [0]

    def push(addr, st):
        if addr is None:
            raise VerifyError('%s: falls off end of code' % name)
        if addr not in by_addr:
            raise VerifyError('%s: branch into middle of insn %x' % (name, addr))
        old = states.get(addr)
        if old is None:
            states[addr] = st
            work.append(addr)
            return
        r = tuple(merge(a, b) for a, b in zip(old[0], st[0]))
        res = old[1] if old[1] == st[1] else 'X'
        if (r, res) != old:
            states[addr] = (r, res)
            work.append(addr)

    steps = 0
    while work:
        steps += 1
        if steps > 20000:
            raise VerifyError(name + ': no fixpoint')
        addr = work.pop()
        ins = by_addr[addr]
        r = list(states[addr][0])
        pend = states[addr][1]
        where = '%s @%04x %s' % (name, addr, ins.line)

        def bad(msg):
            raise VerifyError('%s: %s' % (where, msg))

        def get(i):
            return r[i]

        def put(i, v):
            old = r[i]
            if old[0] in ('JH', 'DH', 'WH') and i > 0:
                r[i - 1] = X
            if old[0] in ('JL', 'DL', 'WL') and i + 1 < len(r):
                r[i + 1] = X
            r[i] = v

        def need_int(i):
            if get(i)[0] not in ('K0', 'K', 'I'):
                bad('v%d not int: %s' % (i, get(i)))

        def need_float(i):
            if get(i)[0] not in ('K0', 'K', 'F'):
                bad('v%d not float: %s' % (i, get(i)))

        def need_ref(i, cls=None, allow_uninit=False):
            t = get(i)
            if t[0] == 'K0':
                return t
            if t[0] != 'R':
                bad('v%d not a reference: %s' % (i, t))
            if not t[2] and not allow_uninit:
                bad('v%d uninitialised ref used' % i)
            if cls and t[2] and not assignable(t[1], cls, warn):
                bad('v%d type %s not assignable to %s' % (i, t[1], cls))
            return t

        def need_arg(i, t):
            if t in INTS:
                need_int(i)
            elif t == 'F':
                need_float(i)
            elif t in 'JD':
                lo, hi = get(i)[0], get(i + 1)[0]
                if lo not in (t + 'L', 'WL') or hi not in (t + 'H', 'WH'):
                    bad('v%d/v%d not a %s pair: %s %s' % (i, i + 1, t, lo, hi))
            else:
                need_ref(i, t)

        n = ins.name
        if pend is not None and not n.startswith('move-result'):
            pass  # result simply discarded
        if n.startswith('move-result') and pend is None:
            bad('move-result without invoke result')
        succ = [] if n.startswith(('return', 'throw', 'goto')) else [nxt[addr]]
        exc_state = (tuple(r), None)
        new_pend = None
        R0 = ins.regs[0] if ins.regs else None

        if n == 'move-exception':
            if addr not in [m.labels[h] for _, _, h in m.tries]:
                bad('move-exception outside handler start')
            put(R0, ('R', 'Ljava/lang/Throwable;', True, None))
        elif n in ('move-object', 'move-object/from16'):
            t = get(ins.regs[1])
            if t[0] not in ('R', 'K0'):
                bad('move-object of non-ref')
            put(R0, t)
        elif n in ('move', 'move/from16'):
            t = get(ins.regs[1])
            if t[0] not in ('K0', 'K', 'I', 'F'):
                bad('move of non-cat1 %s' % (t,))
            put(R0, t)
        elif n == 'move-result':
            if pend in INTS:
                put(R0, I)
            elif pend == 'F':
                put(R0, F)
            else:
                bad('move-result for %s' % pend)
        elif n == 'move-result-wide':
            if pend not in ('J', 'D'):
                bad('move-result-wide for %s' % pend)
            put(R0, (pend + 'L',))
            put(R0 + 1, (pend + 'H',))
        elif n == 'move-result-object':
            if pend is None or pend[0] not in 'L[':
                bad('move-result-object for %s' % pend)
            put(R0, ('R', pend, True, None))
        elif n == 'return-void':
            if m.ret != 'V':
                bad('return-void in non-void method')
            if m.name == '<init>' and any(x[0] == 'R' and x[3] == 'this' and not x[2] for x in r):
                bad('constructor returns without calling super')
        elif n == 'return':
            if m.ret in INTS:
                need_int(R0)
            elif m.ret == 'F':
                need_float(R0)
            else:
                bad('return type mismatch')
        elif n == 'return-object':
            need_ref(R0, m.ret)
        elif n == 'return-wide':
            if m.ret not in ('J', 'D'):
                bad('return-wide in non-wide method')
            need_arg(R0, m.ret)
        elif n == 'move-wide':
            lo, hi = get(ins.regs[1]), get(ins.regs[1] + 1)
            if lo[0] not in ('JL', 'DL', 'WL') or hi[0] not in ('JH', 'DH', 'WH'):
                bad('move-wide of non-pair %s %s' % (lo, hi))
            put(R0, lo)
            put(R0 + 1, hi)
        elif n == 'array-length':
            arr = need_ref(ins.regs[1])
            if arr[0] == 'R' and not arr[1].startswith('['):
                bad('array-length of non-array')
            put(R0, I)
        elif n == 'aget-object':
            arr = need_ref(ins.regs[1])
            need_int(ins.regs[2])
            if arr[0] == 'R' and not arr[1].startswith('[L'):
                bad('aget-object from non-object array')
            put(R0, ('R', arr[1][1:] if arr[0] == 'R' else OBJ, True, None))
        elif n.startswith('const-wide'):
            put(R0, ('WL',))
            put(R0 + 1, ('WH',))
        elif n.startswith('const') and n not in ('const-string', 'const-class'):
            put(R0, K0 if ins.lit == 0 else K)
        elif n == 'const-string':
            put(R0, ('R', 'Ljava/lang/String;', True, None))
        elif n == 'new-instance':
            put(R0, ('R', ins.ref, False, addr))
        elif n == 'check-cast':
            need_ref(R0)
            put(R0, ('R', ins.ref, True, None))
        elif n == 'instance-of':
            need_ref(ins.regs[1])
            put(R0, I)
        elif n == 'new-array':
            need_int(ins.regs[1])
            put(R0, ('R', ins.ref, True, None))
        elif n == 'aput-object':
            need_ref(ins.regs[0])
            arr = need_ref(ins.regs[1])
            if arr[0] == 'R' and not arr[1].startswith('['):
                bad('aput-object into non-array')
            need_int(ins.regs[2])
        elif n.startswith('iget') or n.startswith('iput'):
            fc, fname, ft = ins.ref
            obj = get(ins.regs[1])
            if obj[0] == 'R' and not obj[2]:
                if not (obj[3] == 'this' and fc == m.cls and n.startswith('iput')):
                    bad('field access on uninitialised object')
            else:
                need_ref(ins.regs[1], fc)
            if n.startswith('iget'):
                if n == 'iget-object':
                    put(R0, ('R', ft, True, None))
                elif n in ('iget', 'iget-boolean'):
                    put(R0, F if ft == 'F' else I)
                else:
                    bad('unsupported ' + n)
            else:
                need_arg(R0, ft)
        elif n == 'sget-wide':
            fc, fname, ft = ins.ref
            if ft not in ('J', 'D'):
                bad('sget-wide of %s' % ft)
            put(R0, (ft + 'L',))
            put(R0 + 1, (ft + 'H',))
        elif n.startswith('sget'):
            fc, fname, ft = ins.ref
            if ft in ('J', 'D'):
                bad('%s of wide field' % n)
            put(R0, ('R', ft, True, None) if n == 'sget-object' else (F if ft == 'F' else I))
        elif n.startswith('if-'):
            if n.endswith('z'):
                if get(R0)[0] not in ('K0', 'K', 'I', 'R'):
                    bad('if-z on %s' % (get(R0),))
            else:
                need_int(ins.regs[0])
                need_int(ins.regs[1])
            succ.append(m.labels[ins.target])
        elif n == 'goto':
            succ = [m.labels[ins.target]]
        elif n == 'add-int/lit8':
            need_int(ins.regs[1])
            put(R0, I)
        elif n == 'int-to-float':
            need_int(ins.regs[1])
            put(R0, F)
        elif n.startswith('invoke'):
            cls, mname, params, ret = ins.ref
            static = n.startswith('invoke-static')
            want = (0 if static else 1) + sum(words_of(t) for t in params)
            if len(ins.regs) != want:
                bad('arg words %d != %d' % (len(ins.regs), want))
            k = 0
            if not static:
                recv = ins.regs[0]
                t = get(recv)
                if mname == '<init>':
                    if not n.startswith('invoke-direct'):
                        bad('<init> via non-direct invoke')
                    if t[0] != 'R' or t[2]:
                        bad('<init> on initialised/non-ref')
                    if t[3] == 'this':
                        if cls not in (m.cls, SUPER.get(m.cls)):
                            bad('this.<init> must target self or superclass')
                    elif t[1] != cls:
                        bad('<init> class mismatch %s vs %s' % (t[1], cls))
                    uid = t[3]
                    for j in range(len(r)):
                        if r[j][0] == 'R' and r[j][3] == uid and not r[j][2]:
                            r[j] = ('R', r[j][1], True, None)
                else:
                    if n.startswith('invoke-super') and SUPER.get(m.cls) != cls:
                        bad('invoke-super must name the direct superclass')
                    if n.startswith('invoke-interface') and cls not in IFACE:
                        bad('invoke-interface on non-interface %s' % cls)
                    if not n.startswith('invoke-interface') and cls in IFACE:
                        bad('invoke-virtual on interface %s' % cls)
                    need_ref(recv, cls)
                k = 1
            for t in params:
                need_arg(ins.regs[k], t)
                k += words_of(t)
            new_pend = None if ret == 'V' else ret
        elif n == 'nop':
            pass
        else:
            bad('checker does not model ' + n)

        for h in handlers.get(addr, []):
            push(h, exc_state)
        for s in succ:
            push(s, (tuple(r), new_pend))
    unreached = [a for a in order if a not in states]
    if unreached:
        warn('unreachable code at %s' % ', '.join('%04x' % a for a in unreached))
    return True


# ---------------- binary re-parse + disassembly ----------------
def _uleb(b, o):
    r = s = 0
    while True:
        x = b[o]
        o += 1
        r |= (x & 0x7F) << s
        s += 7
        if not x & 0x80:
            return r, o


def disasm(dexbytes):
    b = dexbytes
    assert b[:8] == b'dex\n035\0'
    assert struct.unpack_from('<I', b, 8)[0] == zlib.adler32(b[12:]) & 0xFFFFFFFF, 'checksum'
    assert b[12:32] == hashlib.sha1(b[32:]).digest(), 'sha1'
    assert struct.unpack_from('<I', b, 32)[0] == len(b), 'file_size'
    (nS, oS, nT, oT, nP, oP, nF, oF, nM, oM, nC, oC) = struct.unpack_from('<12I', b, 56)

    def string(i):
        so = struct.unpack_from('<I', b, oS + 4 * i)[0]
        ln, so = _uleb(b, so)
        e = b.index(b'\0', so)
        s = b[so:e].decode('ascii')
        assert len(s) == ln
        return s

    strs = [string(i) for i in range(nS)]
    assert strs == sorted(strs), 'strings unsorted'
    types = [strs[struct.unpack_from('<I', b, oT + 4 * i)[0]] for i in range(nT)]

    def tlist(off):
        if not off:
            return ()
        n = struct.unpack_from('<I', b, off)[0]
        return tuple(types[struct.unpack_from('<H', b, off + 4 + 2 * k)[0]] for k in range(n))

    protos = []
    for i in range(nP):
        sh, rt, po = struct.unpack_from('<III', b, oP + 12 * i)
        protos.append((strs[sh], types[rt], tlist(po)))
    fields = []
    for i in range(nF):
        c, t, nm = struct.unpack_from('<HHI', b, oF + 8 * i)
        fields.append('%s->%s:%s' % (types[c], strs[nm], types[t]))
    meths = []
    for i in range(nM):
        c, pi, nm = struct.unpack_from('<HHI', b, oM + 8 * i)
        sh, rt, ps = protos[pi]
        meths.append('%s->%s(%s)%s' % (types[c], strs[nm], ''.join(ps), rt))
    rev = {v: k for k, v in OPS.items()}
    out = []
    for ci in range(nC):
        (cidx, acc, sup, itf, src, ann, cdo, sv) = struct.unpack_from('<8I', b, oC + 32 * ci)
        out.append('.class %s extends %s implements %s' % (types[cidx], types[sup], ','.join(tlist(itf))))
        o = cdo
        sf, o = _uleb(b, o)
        inf, o = _uleb(b, o)
        dm, o = _uleb(b, o)
        vm, o = _uleb(b, o)
        fi = 0
        for _ in range(sf + inf):
            d, o = _uleb(b, o)
            fl, o = _uleb(b, o)
            fi += d
            out.append('  .field %s flags=%x' % (fields[fi], fl))
        for cnt in (dm, vm):
            mi = 0
            for _ in range(cnt):
                d, o = _uleb(b, o)
                fl, o = _uleb(b, o)
                co, o = _uleb(b, o)
                mi += d
                rs, ins_, outs, tries, dbg, n = struct.unpack_from('<HHHHII', b, co)
                out.append('  .method %s flags=%x regs=%d ins=%d outs=%d tries=%d' % (meths[mi], fl, rs, ins_, outs, tries))
                u = struct.unpack_from('<%dH' % n, b, co + 16)
                a = 0
                while a < n:
                    op = u[a] & 0xFF
                    cands = [k for k, v in OPS.items() if v[0] == op]
                    if not cands:
                        raise AssertionError('bad opcode %02x' % op)
                    nm = cands[0]
                    fmt = OPS[nm][1]
                    sz = SIZES[fmt]
                    w = u[a:a + sz]
                    txt = nm
                    if fmt == '35c':
                        cntr = w[0] >> 12
                        rr = [w[2] & 15, w[2] >> 4 & 15, w[2] >> 8 & 15, w[2] >> 12, w[0] >> 8 & 15][:cntr]
                        txt += ' {%s}, %s' % (', '.join('v%d' % x for x in rr), meths[w[1]])
                    elif fmt == '3rc':
                        txt += ' {v%d .. v%d}, %s' % (w[2], w[2] + (w[0] >> 8) - 1, meths[w[1]])
                    elif fmt == '21c':
                        ref = strs[w[1]] if nm == 'const-string' else (
                            types[w[1]] if nm in ('check-cast', 'new-instance', 'const-class') else fields[w[1]])
                        txt += ' v%d, %s' % (w[0] >> 8, repr(ref) if nm == 'const-string' else ref)
                    elif fmt == '22c':
                        ref = types[w[1]] if nm in ('new-array', 'instance-of') else fields[w[1]]
                        txt += ' v%d, v%d, %s' % (w[0] >> 8 & 15, w[0] >> 12, ref)
                    elif fmt in ('21t', '20t', '22t'):
                        offv = w[1] - 0x10000 if w[1] & 0x8000 else w[1]
                        regs_t = {'21t': 'v%d, ' % (w[0] >> 8), '20t': '',
                                  '22t': 'v%d, v%d, ' % (w[0] >> 8 & 15, w[0] >> 12)}[fmt]
                        txt += ' %s->%04x' % (regs_t, a + offv)
                    elif fmt == '11n':
                        lit = w[0] >> 12
                        txt += ' v%d, %d' % (w[0] >> 8 & 15, lit - 16 if lit & 8 else lit)
                    elif fmt in ('11x',):
                        txt += ' v%d' % (w[0] >> 8)
                    elif fmt == '12x':
                        txt += ' v%d, v%d' % (w[0] >> 8 & 15, w[0] >> 12)
                    elif fmt in ('21s', '21h'):
                        txt += ' v%d, 0x%04x' % (w[0] >> 8, w[1])
                    elif fmt == '31i':
                        txt += ' v%d, 0x%08x' % (w[0] >> 8, w[1] | w[2] << 16)
                    elif fmt == '22b':
                        txt += ' v%d, v%d, %d' % (w[0] >> 8, w[1] & 0xFF, (w[1] >> 8) - (256 if w[1] & 0x8000 else 0))
                    elif fmt == '23x':
                        txt += ' v%d, v%d, v%d' % (w[0] >> 8, w[1] & 0xFF, w[1] >> 8)
                    out.append('    %04x: %s' % (a, txt))
                    a += sz
                if tries:
                    to = co + 16 + 2 * n + (2 if n % 2 else 0)
                    hl = to + 8 * tries
                    for k in range(tries):
                        sa, cntt, ho = struct.unpack_from('<IHH', b, to + 8 * k)
                        sz_, oo = _uleb(b, hl + ho)
                        sz_ = sz_ - 128 if sz_ & 0x40 else sz_
                        ca, oo = _uleb(b, oo)
                        out.append('    .try %04x..%04x catchall -> %04x (size=%d)' % (sa, sa + cntt, ca, sz_))
    return '\n'.join(out)
