#!/usr/bin/env python3
"""Build web/data/ksa.js: an offline vector map of Saudi Arabia for the app.

Sources (bundled under their own licences, see web/data/LICENSES.txt):
  * Natural Earth 1:10m (public domain): land, country borders, highways, railways, airports
  * homaily/Saudi-Arabia-Regions-Cities-and-Districts (GPL-2.0, from the National Address portal):
    13 regions, 4,580 cities/villages, 3,730 districts with Arabic names and boundaries

Geometry is pre-projected to Web Mercator "world pixels" (256 px at z0) scaled by 2**Q and stored as
delta-encoded integers, then simplified per layer (Douglas-Peucker) for small size and fast drawing.
"""
import json
import math
import os
import sys

Q = 17                                   # 1 unit ~ 1.2 m at the equator
SC = 256 * (1 << Q)
NE = '/home/claude/data/ne/geojson/'
KSA = '/home/claude/data/ksa/json/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'data', 'ksa.js')
BB = (33.8, 15.2, 56.8, 32.8)            # lon/lat window: the Kingdom plus a margin of its neighbours


def mx(lon):
    return int(round((lon + 180.0) / 360.0 * SC))


def my(lat):
    s = math.sin(math.radians(max(-85.0, min(85.0, lat))))
    return int(round((0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * SC))


BBX = (mx(BB[0]), my(BB[3]), mx(BB[2]), my(BB[1]))   # x0, y0 (north), x1, y1 (south)


def proj(ring, latlon=False):
    return [(mx(p[1]), my(p[0])) if latlon else (mx(p[0]), my(p[1])) for p in ring]


def dp(pts, tol):
    """Iterative Douglas-Peucker on integer points."""
    n = len(pts)
    if n < 3:
        return pts[:]
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    t2 = tol * tol
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
                ex, ey = ax + t * dx - px, ay + t * dy - py
                d = ex * ex + ey * ey
            if d > best:
                best, bi = d, i
        if best > t2 and bi > 0:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def clip_poly(ring, box):
    """Sutherland-Hodgman against an axis-aligned box (for filled polygons)."""
    x0, y0, x1, y1 = box

    def clip(pts, inside, inter):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out

    def ix(a, b, x):
        t = (x - a[0]) / float(b[0] - a[0])
        return (x, int(round(a[1] + t * (b[1] - a[1]))))

    def iy(a, b, y):
        t = (y - a[1]) / float(b[1] - a[1])
        return (int(round(a[0] + t * (b[0] - a[0]))), y)

    p = ring
    p = clip(p, lambda q: q[0] >= x0, lambda a, b: ix(a, b, x0))
    p = clip(p, lambda q: q[0] <= x1, lambda a, b: ix(a, b, x1))
    p = clip(p, lambda q: q[1] >= y0, lambda a, b: iy(a, b, y0))
    p = clip(p, lambda q: q[1] <= y1, lambda a, b: iy(a, b, y1))
    return p


def clip_line(pts, box):
    """Split a polyline into the runs that fall inside the box (Liang-Barsky per segment)."""
    x0, y0, x1, y1 = box
    runs, cur = [], []

    def seg(a, b):
        t0, t1 = 0.0, 1.0
        dx, dy = b[0] - a[0], b[1] - a[1]
        for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dy, a[1] - y0), (dy, y1 - a[1])):
            if p == 0:
                if q < 0:
                    return None
            else:
                r = q / float(p)
                if p < 0:
                    if r > t1:
                        return None
                    t0 = max(t0, r)
                else:
                    if r < t0:
                        return None
                    t1 = min(t1, r)
        return ((int(round(a[0] + t0 * dx)), int(round(a[1] + t0 * dy))),
                (int(round(a[0] + t1 * dx)), int(round(a[1] + t1 * dy))), t0 > 0, t1 < 1)

    for i in range(len(pts) - 1):
        s = seg(pts[i], pts[i + 1])
        if s is None:
            if len(cur) > 1:
                runs.append(cur)
            cur = []
            continue
        a, b, cut_a, cut_b = s
        if not cur or cut_a:
            if len(cur) > 1:
                runs.append(cur)
            cur = [a]
        cur.append(b)
        if cut_b:
            runs.append(cur)
            cur = []
    if len(cur) > 1:
        runs.append(cur)
    return runs


def enc(pts):
    """Delta-encode [(x,y),...] -> [x0,y0,dx,dy,...]."""
    out, px, py = [], 0, 0
    for x, y in pts:
        out += [x - px, y - py]
        px, py = x, y
    return out


def dedupe(pts):
    out = []
    for p in pts:
        if not out or p != out[-1]:
            out.append(p)
    return out


def rings_of(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon':
        return [c]
    if t == 'MultiPolygon':
        return c
    return []


def lines_of(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'LineString':
        return [c]
    if t == 'MultiLineString':
        return c
    return []


def centroid(ring):
    a = cx = cy = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-9:
        xs, ys = zip(*ring)
        return int(sum(xs) / n), int(sum(ys) / n)
    return int(cx / (3 * a)), int(cy / (3 * a))


def main():
    data = {'v': 1, 'Q': Q}
    stats = {}

    # ---- land (filled), clipped to the window ----
    land = []
    for f in json.load(open(NE + 'ne_10m_land.geojson', encoding='utf-8'))['features']:
        for poly in rings_of(f['geometry']):
            out = []
            for k, ring in enumerate(poly):
                r = dedupe(clip_poly(dp(proj(ring), 120), BBX))
                if len(r) >= 4:
                    out.append(enc(r))
                elif k == 0:
                    break
            if out:
                land.append(out)
    data['land'] = land

    # ---- country borders (lines), the Kingdom separately ----
    brd, ksa_outline = [], []
    for f in json.load(open(NE + 'ne_10m_admin_0_countries.geojson', encoding='utf-8'))['features']:
        is_ksa = f['properties'].get('ADM0_A3') == 'SAU'
        for poly in rings_of(f['geometry']):
            ring = proj(poly[0])
            for run in clip_line(dp(ring, 100), BBX):
                run = dedupe(run)
                if len(run) > 1:
                    (ksa_outline if is_ksa else brd).append(enc(run))
    data['brd'] = brd
    data['ksa'] = ksa_outline

    # ---- roads / railways ----
    roads = []
    for f in json.load(open(NE + 'ne_10m_roads.geojson', encoding='utf-8'))['features']:
        p = f['properties']
        if not f['geometry'] or p.get('type') == 'Ferry Route':
            continue
        kind = 0 if p.get('type') == 'Major Highway' or p.get('expressway') == 1 else (1 if p.get('type') == 'Road' else 2)
        rank = int(p.get('scalerank') or 9)
        for line in lines_of(f['geometry']):
            for run in clip_line(dp(proj(line), 40), BBX):
                run = dedupe(run)
                if len(run) > 1:
                    roads.append([kind, rank, enc(run)])
    data['roads'] = roads
    rail = []
    for f in json.load(open(NE + 'ne_10m_railroads.geojson', encoding='utf-8'))['features']:
        if not f['geometry']:
            continue
        for line in lines_of(f['geometry']):
            for run in clip_line(dp(proj(line), 40), BBX):
                run = dedupe(run)
                if len(run) > 1:
                    rail.append(enc(run))
    data['rail'] = rail

    # ---- airports ----
    air = []
    for f in json.load(open(NE + 'ne_10m_airports.geojson', encoding='utf-8'))['features']:
        lon, lat = f['geometry']['coordinates'][:2]
        x, y = mx(lon), my(lat)
        if BBX[0] <= x <= BBX[2] and BBX[1] <= y <= BBX[3]:
            p = f['properties']
            air.append([p.get('name_ar') or p.get('name'), x, y, p.get('iata_code') or ''])
    data['air'] = air

    # ---- regions (13) ----
    regions = json.load(open(KSA + 'regions.json', encoding='utf-8'))
    reg = []
    for r in sorted(regions, key=lambda r: r['region_id']):
        rings = []
        for ring in r['boundaries']:
            pr = dedupe(dp(proj(ring, latlon=True), 160))
            if len(pr) >= 4:
                rings.append(enc(pr))
        cy, cx = r['center']
        reg.append([r['region_id'], r['name_ar'], r['name_en'], mx(cx), my(cy), rings])
    data['reg'] = reg
    capitals = {r['capital_city_id'] for r in regions}

    # ---- districts ----
    dists = json.load(open(KSA + 'districts.json', encoding='utf-8'))
    per_city = {}
    for d in dists:
        per_city[d['city_id']] = per_city.get(d['city_id'], 0) + 1
    dis = []
    for d in dists:
        rings, cxy = [], None
        for ring in d['boundaries'] or []:
            pr = dedupe(dp(proj(ring, latlon=True), 10))
            if len(pr) >= 4:
                if cxy is None:
                    cxy = centroid(pr)
                rings.append(enc(pr))
        if not rings:
            continue
        name = d['name_ar'].strip()
        dis.append([d['city_id'], name, d['name_en'], cxy[0], cxy[1], rings])
    data['dis'] = dis

    # ---- cities / towns / villages ----
    MAJOR = {'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'حائل',
             'الهفوف', 'الجبيل', 'أبها', 'نجران', 'ينبع', 'الخبر', 'جازان', 'القطيف', 'عرعر', 'سكاكا', 'الخرج', 'عنيزة',
             'الظهران', 'حفر الباطن', 'الباحة', 'القريات', 'الرس', 'بيشة', 'المجمعة', 'الدوادمي', 'القنفذة', 'رابغ', 'الأحساء'}
    cities = json.load(open(KSA + 'cities.json', encoding='utf-8'))
    # several villages share a big city's name (e.g. another «الهفوف» in Riyadh region): only the real one is
    # promoted — the one with the most districts, then the lowest id (the dataset lists big cities first)
    major_id = {}
    for c in cities:
        name = c['name_ar'].strip()
        if name in MAJOR:
            key = (-per_city.get(c['city_id'], 0), c['city_id'])
            if name not in major_id or key < major_id[name][0]:
                major_id[name] = (key, c['city_id'])
    major_ids = {v[1] for v in major_id.values()}
    cit = []
    for c in cities:
        lat, lon = c['center']
        name = c['name_ar'].strip()
        rank = 0 if (c['city_id'] in capitals or c['city_id'] in major_ids) else (1 if per_city.get(c['city_id'], 0) >= 3 else 2)
        cit.append([c['city_id'], name, c['name_en'], mx(lon), my(lat), rank, c['region_id']])
    data['cit'] = cit

    for k in ('land', 'brd', 'ksa', 'roads', 'rail', 'air', 'reg', 'dis', 'cit'):
        stats[k] = (len(data[k]), len(json.dumps(data[k], ensure_ascii=False, separators=(',', ':'))) // 1024)
    js = '/* offline map of Saudi Arabia — generated by build/ksa_data.py; see data/LICENSES.txt */\n' \
         'App.ksaData=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    for k, (n, kb) in stats.items():
        print('%-6s %6d features %7d KB' % (k, n, kb))
    print('total %.1f MB -> %s' % (len(js.encode('utf-8')) / 1048576, os.path.normpath(OUT)))


if __name__ == '__main__':
    sys.exit(main())
