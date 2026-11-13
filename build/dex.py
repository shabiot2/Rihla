"""Minimal Dalvik assembler + DEX (v035) writer.

Method bodies are written in a smali-like syntax. Registers: vN (absolute) or
pN (parameter N; p0 is `this` for instance methods).
"""
import hashlib
import re
import struct
import zlib

NO_INDEX = 0xFFFFFFFF
ACC_PUBLIC, ACC_PRIVATE, ACC_PROTECTED, ACC_STATIC, ACC_FINAL = 0x1, 0x2, 0x4, 0x8, 0x10
ACC_CONSTRUCTOR = 0x10000


def uleb128(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def sleb128(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        done = (n == 0 and not (b & 0x40)) or (n == -1 and (b & 0x40))
        out.append(b if done else b | 0x80)
        if done:
            return bytes(out)


def split_descs(s):
    out, i = [], 0
    while i < len(s):
        j = i
        while s[j] == '[':
            j += 1
        if s[j] == 'L':
            j = s.index(';', j)
        out.append(s[i:j + 1])
        i = j + 1
    return out


def shorty_of(ret, params):
    f = lambda t: 'L' if t[0] in 'L[' else t
    return f(ret) + ''.join(f(p) for p in params)


def words_of(t):
    return 2 if t in ('J', 'D') else 1


def parse_method_ref(ref):
    m = re.match(r'^(\S+?);->([\w<>$]+)\((.*?)\)(\S+)$', ref.strip())
    if not m:
        raise ValueError('bad method ref: ' + ref)
    return (m.group(1) + ';', m.group(2), tuple(split_descs(m.group(3))), m.group(4))


def parse_field_ref(ref):
    m = re.match(r'^(\S+?);->([\w$]+):(\S+)$', ref.strip())
    if not m:
        raise ValueError('bad field ref: ' + ref)
    return (m.group(1) + ';', m.group(2), m.group(3))


OPS = {
    'nop': (0x00, '10x'),
    'move': (0x01, '12x'), 'move/from16': (0x02, '22x'), 'move-wide': (0x04, '12x'),
    'move-object': (0x07, '12x'), 'move-object/from16': (0x08, '22x'),
    'move-result': (0x0a, '11x'), 'move-result-wide': (0x0b, '11x'),
    'move-result-object': (0x0c, '11x'), 'move-exception': (0x0d, '11x'),
    'return-void': (0x0e, '10x'), 'return': (0x0f, '11x'),
    'return-wide': (0x10, '11x'), 'return-object': (0x11, '11x'),
    'const/4': (0x12, '11n'), 'const/16': (0x13, '21s'), 'const': (0x14, '31i'),
    'const/high16': (0x15, '21h'), 'const-wide/16': (0x16, '21s'),
    'const-wide/32': (0x17, '31i'),
    'const-string': (0x1a, '21c'), 'const-class': (0x1c, '21c'),
    'check-cast': (0x1f, '21c'), 'instance-of': (0x20, '22c'),
    'array-length': (0x21, '12x'), 'new-instance': (0x22, '21c'),
    'new-array': (0x23, '22c'), 'throw': (0x27, '11x'),
    'goto': (0x29, '20t'),  # always emitted as goto/16
    'if-eq': (0x32, '22t'), 'if-ne': (0x33, '22t'), 'if-lt': (0x34, '22t'),
    'if-ge': (0x35, '22t'), 'if-gt': (0x36, '22t'), 'if-le': (0x37, '22t'),
    'if-eqz': (0x38, '21t'), 'if-nez': (0x39, '21t'), 'if-ltz': (0x3a, '21t'),
    'if-gez': (0x3b, '21t'), 'if-gtz': (0x3c, '21t'), 'if-lez': (0x3d, '21t'),
    'aget': (0x44, '23x'), 'aget-object': (0x46, '23x'),
    'aput': (0x4b, '23x'), 'aput-object': (0x4d, '23x'),
    'iget': (0x52, '22c'), 'iget-wide': (0x53, '22c'), 'iget-object': (0x54, '22c'),
    'iget-boolean': (0x55, '22c'),
    'iput': (0x59, '22c'), 'iput-wide': (0x5a, '22c'), 'iput-object': (0x5b, '22c'),
    'iput-boolean': (0x5c, '22c'),
    'sget': (0x60, '21c'), 'sget-wide': (0x61, '21c'), 'sget-object': (0x62, '21c'),
    'sget-boolean': (0x63, '21c'),
    'sput': (0x67, '21c'), 'sput-object': (0x69, '21c'),
    'invoke-virtual': (0x6e, '35c'), 'invoke-super': (0x6f, '35c'),
    'invoke-direct': (0x70, '35c'), 'invoke-static': (0x71, '35c'),
    'invoke-interface': (0x72, '35c'),
    'invoke-virtual/range': (0x74, '3rc'), 'invoke-super/range': (0x75, '3rc'),
    'invoke-direct/range': (0x76, '3rc'), 'invoke-static/range': (0x77, '3rc'),
    'invoke-interface/range': (0x78, '3rc'),
    'int-to-float': (0x82, '12x'),
    'add-int/lit8': (0xd8, '22b'),
}
SIZES = {'10x': 1, '11n': 1, '11x': 1, '12x': 1, '20t': 2, '21t': 2, '21s': 2,
         '21h': 2, '21c': 2, '22c': 2, '22t': 2, '22b': 2, '22x': 2, '23x': 2,
         '31i': 3, '35c': 3, '3rc': 3}
TYPE_OPS = {'const-class', 'check-cast', 'new-instance', 'instance-of', 'new-array'}


class Insn:
    __slots__ = ('name', 'op', 'fmt', 'regs', 'lit', 'kind', 'ref', 'target', 'addr', 'line')

    def __repr__(self):
        return '%04x: %s' % (self.addr, self.line)


class Method:
    def __init__(self, cls, name, params, ret, flags, regs, code):
        self.cls, self.name, self.params, self.ret = cls, name, tuple(params), ret
        self.flags = flags
        self.static = bool(flags & ACC_STATIC)
        self.regs = regs
        self.ins = (0 if self.static else 1) + sum(words_of(p) for p in self.params)
        assert self.ins <= regs, (name, 'ins > regs')
        self.insns, self.labels, self.tries = [], {}, []
        self._parse(code)

    @property
    def key(self):
        return (self.cls, self.name, self.params, self.ret)

    def reg(self, tok):
        tok = tok.strip()
        if tok[0] == 'v':
            n = int(tok[1:])
        elif tok[0] == 'p':
            n = self.regs - self.ins + int(tok[1:])
        else:
            raise ValueError('bad register %r in %s' % (tok, self.name))
        if not 0 <= n < self.regs:
            raise ValueError('register %s out of range in %s' % (tok, self.name))
        return n

    def _parse(self, code):
        addr = 0
        for raw in code.strip().splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith(':'):
                lab = line[1:]
                if lab in self.labels:
                    raise ValueError('dup label ' + lab)
                self.labels[lab] = addr
                continue
            if line.startswith('.catchall'):
                m = re.match(r'^\.catchall\s*\{\s*:(\w+)\s*\.\.\s*:(\w+)\s*\}\s*:(\w+)$', line)
                self.tries.append(m.groups())
                continue
            name, _, rest = line.partition(' ')
            rest = rest.strip()
            if name not in OPS:
                raise ValueError('unknown op %s in %s' % (name, self.name))
            ins = Insn()
            ins.name, ins.line, ins.addr = name, line, addr
            ins.op, ins.fmt = OPS[name]
            ins.regs, ins.lit, ins.kind, ins.ref, ins.target = [], None, None, None, None
            fmt, R = ins.fmt, self.reg
            if fmt in ('35c', '3rc'):
                m = re.match(r'^\{(.*?)\}\s*,\s*(.+)$', rest)
                rl = m.group(1).strip()
                if fmt == '3rc':
                    a, b = [x.strip() for x in rl.split('..')]
                    ins.regs = list(range(R(a), R(b) + 1))
                else:
                    ins.regs = [R(x) for x in rl.split(',')] if rl else []
                ins.kind, ins.ref = 'method', parse_method_ref(m.group(2))
            elif name == 'const-string':
                m = re.match(r'^(\w+)\s*,\s*"(.*)"$', rest)
                ins.regs = [R(m.group(1))]
                ins.kind, ins.ref = 'string', m.group(2).replace('\\"', '"')
            else:
                ops = [x.strip() for x in rest.split(',')] if rest else []
                if fmt == '10x':
                    pass
                elif fmt == '11x':
                    ins.regs = [R(ops[0])]
                elif fmt in ('12x', '22x'):
                    ins.regs = [R(ops[0]), R(ops[1])]
                elif fmt == '23x':
                    ins.regs = [R(o) for o in ops[:3]]
                elif fmt in ('11n', '21s', '31i', '21h'):
                    ins.regs, ins.lit = [R(ops[0])], int(ops[1], 0)
                elif fmt == '22b':
                    ins.regs, ins.lit = [R(ops[0]), R(ops[1])], int(ops[2], 0)
                elif fmt == '20t':
                    ins.target = ops[0].lstrip(':')
                elif fmt == '21t':
                    ins.regs, ins.target = [R(ops[0])], ops[1].lstrip(':')
                elif fmt == '22t':
                    ins.regs, ins.target = [R(ops[0]), R(ops[1])], ops[2].lstrip(':')
                elif fmt in ('21c', '22c'):
                    n = 1 if fmt == '21c' else 2
                    ins.regs = [R(o) for o in ops[:n]]
                    ref = ops[n]
                    if name in TYPE_OPS:
                        ins.kind, ins.ref = 'type', ref
                    else:
                        ins.kind, ins.ref = 'field', parse_field_ref(ref)
                else:
                    raise ValueError(fmt)
            self.insns.append(ins)
            addr += SIZES[fmt]
        self.size = addr
        for ins in self.insns:
            if ins.target is not None and ins.target not in self.labels:
                raise ValueError('missing label %s in %s' % (ins.target, self.name))

    # ---- encoding ----
    def _enc(self, ins, ix):
        op, f, r, lit = ins.op, ins.fmt, ins.regs, ins.lit

        def r4(x):
            assert 0 <= x < 16, ('reg>15', ins)
            return x

        def r8(x):
            assert 0 <= x < 256, ins
            return x

        def off():
            o = self.labels[ins.target] - ins.addr
            assert -32768 <= o < 32768
            return o & 0xFFFF

        def idx():
            k = ins.kind
            v = {'string': ix.s, 'type': ix.t, 'field': ix.f, 'method': ix.m}[k][ins.ref]
            assert v < 0x10000
            return v

        if f == '10x':
            return [op]
        if f == '11n':
            assert -8 <= lit <= 7, ins
            return [op | r4(r[0]) << 8 | (lit & 0xF) << 12]
        if f == '11x':
            return [op | r8(r[0]) << 8]
        if f == '12x':
            return [op | r4(r[0]) << 8 | r4(r[1]) << 12]
        if f == '22x':
            return [op | r8(r[0]) << 8, r[1] & 0xFFFF]
        if f == '23x':
            return [op | r8(r[0]) << 8, r8(r[1]) | r8(r[2]) << 8]
        if f == '20t':
            return [op, off()]
        if f == '21t':
            return [op | r8(r[0]) << 8, off()]
        if f == '22t':
            return [op | r4(r[0]) << 8 | r4(r[1]) << 12, off()]
        if f == '21s':
            assert -32768 <= lit < 32768, ins
            return [op | r8(r[0]) << 8, lit & 0xFFFF]
        if f == '21h':
            assert lit & 0xFFFF == 0 and 0 <= lit < 2 ** 32, ins
            return [op | r8(r[0]) << 8, (lit >> 16) & 0xFFFF]
        if f == '31i':
            v = lit & 0xFFFFFFFF
            return [op | r8(r[0]) << 8, v & 0xFFFF, v >> 16]
        if f == '22b':
            assert -128 <= lit < 128
            return [op | r8(r[0]) << 8, r8(r[1]) | (lit & 0xFF) << 8]
        if f == '21c':
            return [op | r8(r[0]) << 8, idx()]
        if f == '22c':
            return [op | r4(r[0]) << 8 | r4(r[1]) << 12, idx()]
        if f == '35c':
            assert len(r) <= 5, ins
            rr = [r4(x) for x in r] + [0] * (5 - len(r))
            return [op | rr[4] << 8 | len(r) << 12, idx(),
                    rr[0] | rr[1] << 4 | rr[2] << 8 | rr[3] << 12]
        if f == '3rc':
            assert r == list(range(r[0], r[0] + len(r)))
            return [op | len(r) << 8, idx(), r[0]]
        raise ValueError(f)

    def code_item(self, ix):
        units = []
        for ins in self.insns:
            u = self._enc(ins, ix)
            assert len(u) == SIZES[ins.fmt]
            units += u
        assert len(units) == self.size
        tries = []
        for s, e, h in self.tries:
            sa, ea, ha = self.labels[s], self.labels[e], self.labels[h]
            assert ea > sa
            tries.append((sa, ea - sa, ha))
        tries.sort()
        for a, b in zip(tries, tries[1:]):
            assert a[0] + a[1] <= b[0], 'overlapping tries'
        handlers, hoff, uniq = bytearray(), {}, []
        for t in tries:
            if t[2] not in uniq:
                uniq.append(t[2])
        if tries:
            handlers += uleb128(len(uniq))
            for h in uniq:
                hoff[h] = len(handlers)
                handlers += sleb128(0) + uleb128(h)  # catch-all only
        outs = max([len(i.regs) for i in self.insns if i.kind == 'method'] or [0])
        b = struct.pack('<HHHHII', self.regs, self.ins, outs, len(tries), 0, len(units))
        b += struct.pack('<%dH' % len(units), *units)
        if tries:
            if len(units) % 2:
                b += b'\0\0'
            for sa, cnt, h in tries:
                b += struct.pack('<IHH', sa, cnt, hoff[h])
            b += bytes(handlers)
        return b


class ClassDef:
    def __init__(self, name, super_, interfaces=(), flags=ACC_PUBLIC):
        self.name, self.super, self.interfaces, self.flags = name, super_, tuple(interfaces), flags
        self.fields, self.methods = [], []

    def field(self, name, typ, flags=ACC_PUBLIC):
        self.fields.append((name, typ, flags))

    def method(self, name, params, ret, regs, code, flags=ACC_PUBLIC):
        if name == '<init>':
            flags |= ACC_CONSTRUCTOR
        m = Method(self.name, name, params, ret, flags, regs, code)
        self.methods.append(m)
        return m


class Index:
    pass


def build_dex(classes):
    strings, types, protos, fields, methods = set(), set(), set(), set(), set()

    def T(t):
        types.add(t)
        strings.add(t)

    def P(params, ret):
        sh = shorty_of(ret, params)
        strings.add(sh)
        T(ret)
        for p in params:
            T(p)
        protos.add((sh, ret, tuple(params)))

    def F(f):
        T(f[0])
        T(f[2])
        strings.add(f[1])
        fields.add(f)

    def M(m):
        T(m[0])
        strings.add(m[1])
        P(m[2], m[3])
        methods.add(m)

    for c in classes:
        T(c.name)
        T(c.super)
        for i in c.interfaces:
            T(i)
        for n, t, _ in c.fields:
            F((c.name, n, t))
        for m in c.methods:
            M(m.key)
            for ins in m.insns:
                if ins.kind == 'string':
                    strings.add(ins.ref)
                elif ins.kind == 'type':
                    T(ins.ref)
                elif ins.kind == 'field':
                    F(ins.ref)
                elif ins.kind == 'method':
                    M(ins.ref)
    for s in strings:
        assert all(0 < ord(ch) < 0x80 for ch in s), 'non-ascii dex string: %r' % s

    strings = sorted(strings)
    sidx = {s: i for i, s in enumerate(strings)}
    types = sorted(types, key=lambda t: sidx[t])
    tidx = {t: i for i, t in enumerate(types)}
    protos = sorted(protos, key=lambda p: (tidx[p[1]], [tidx[x] for x in p[2]]))
    pidx = {p: i for i, p in enumerate(protos)}
    fields = sorted(fields, key=lambda f: (tidx[f[0]], sidx[f[1]], tidx[f[2]]))
    fidx = {f: i for i, f in enumerate(fields)}

    def pkey(m):
        return (shorty_of(m[3], m[2]), m[3], tuple(m[2]))

    methods = sorted(methods, key=lambda m: (tidx[m[0]], sidx[m[1]], pidx[pkey(m)]))
    midx = {m: i for i, m in enumerate(methods)}
    ix = Index()
    ix.s, ix.t, ix.f, ix.m = sidx, tidx, fidx, midx

    nS, nT, nP, nF, nM, nC = len(strings), len(types), len(protos), len(fields), len(methods), len(classes)
    off = 0x70
    string_ids_off = off; off += 4 * nS
    type_ids_off = off; off += 4 * nT
    proto_ids_off = off; off += 12 * nP
    field_ids_off = off; off += 8 * nF
    method_ids_off = off; off += 8 * nM
    class_defs_off = off; off += 32 * nC
    data_off = off
    assert data_off % 4 == 0
    data = bytearray()

    def pos():
        return data_off + len(data)

    def align4():
        while pos() % 4:
            data.append(0)

    code_offs, ncode, code_sec = {}, 0, None
    for c in classes:
        for m in c.methods:
            align4()
            if code_sec is None:
                code_sec = pos()
            code_offs[id(m)] = pos()
            data.extend(m.code_item(ix))
            ncode += 1

    tl_keys = []
    for p in protos:
        if p[2] and p[2] not in tl_keys:
            tl_keys.append(p[2])
    for c in classes:
        if c.interfaces and c.interfaces not in tl_keys:
            tl_keys.append(c.interfaces)
    tl_offs, tl_sec = {}, None
    for k in tl_keys:
        align4()
        if tl_sec is None:
            tl_sec = pos()
        tl_offs[k] = pos()
        data.extend(struct.pack('<I', len(k)) + b''.join(struct.pack('<H', tidx[t]) for t in k))

    sd_sec, sd_offs = pos(), []
    for s in strings:
        sd_offs.append(pos())
        data.extend(uleb128(len(s)) + s.encode('ascii') + b'\0')

    cd_sec, cd_offs = pos(), {}
    for c in classes:
        cd_offs[c.name] = pos()
        inst = sorted((fidx[(c.name, n, t)], fl) for n, t, fl in c.fields)
        direct = [m for m in c.methods if m.name in ('<init>', '<clinit>') or m.flags & (ACC_STATIC | ACC_PRIVATE)]
        virtual = [m for m in c.methods if m not in direct]
        direct.sort(key=lambda m: midx[m.key])
        virtual.sort(key=lambda m: midx[m.key])
        b = uleb128(0) + uleb128(len(inst)) + uleb128(len(direct)) + uleb128(len(virtual))
        prev = 0
        for fi, fl in inst:
            b += uleb128(fi - prev) + uleb128(fl)
            prev = fi
        for group in (direct, virtual):
            prev = None
            for m in group:
                mi = midx[m.key]
                assert prev is None or mi > prev, 'duplicate/unsorted method'
                b += uleb128(mi - (prev or 0)) + uleb128(m.flags) + uleb128(code_offs[id(m)])
                prev = mi
        data.extend(b)

    align4()
    map_off = pos()
    items = [(0x0000, 1, 0), (0x0001, nS, string_ids_off), (0x0002, nT, type_ids_off),
             (0x0003, nP, proto_ids_off), (0x0004, nF, field_ids_off),
             (0x0005, nM, method_ids_off), (0x0006, nC, class_defs_off),
             (0x2001, ncode, code_sec), (0x1001, len(tl_keys), tl_sec),
             (0x2002, nS, sd_sec), (0x2000, nC, cd_sec), (0x1000, 1, map_off)]
    items = [it for it in items if it[1]]
    data.extend(struct.pack('<I', len(items)))
    for t, n, o in items:
        data.extend(struct.pack('<HHII', t, 0, n, o))

    ids = bytearray()
    for o in sd_offs:
        ids += struct.pack('<I', o)
    for t in types:
        ids += struct.pack('<I', sidx[t])
    for sh, ret, params in protos:
        ids += struct.pack('<III', sidx[sh], tidx[ret], tl_offs[params] if params else 0)
    for cls, name, typ in fields:
        ids += struct.pack('<HHI', tidx[cls], tidx[typ], sidx[name])
    for m in methods:
        ids += struct.pack('<HHI', tidx[m[0]], pidx[pkey(m)], sidx[m[1]])
    for c in classes:
        ids += struct.pack('<8I', tidx[c.name], c.flags, tidx[c.super],
                           tl_offs[c.interfaces] if c.interfaces else 0,
                           NO_INDEX, 0, cd_offs[c.name], 0)
    assert 0x70 + len(ids) == data_off

    file_size = data_off + len(data)
    hdr = bytearray(0x70)
    hdr[0:8] = b'dex\n035\0'
    struct.pack_into('<III', hdr, 32, file_size, 0x70, 0x12345678)
    struct.pack_into('<III', hdr, 44, 0, 0, map_off)
    struct.pack_into('<12I', hdr, 56, nS, string_ids_off, nT, type_ids_off, nP, proto_ids_off,
                     nF, field_ids_off, nM, method_ids_off, nC, class_defs_off)
    struct.pack_into('<II', hdr, 104, len(data), data_off)
    out = hdr + ids + data
    out[12:32] = hashlib.sha1(bytes(out[32:])).digest()
    struct.pack_into('<I', out, 8, zlib.adler32(bytes(out[12:])) & 0xFFFFFFFF)
    return bytes(out)
