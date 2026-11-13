"""Render the car UI in headless Chrome with a mocked Android bridge + network, take screenshots."""
import io
import os
import json
import math
import random
import sys
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

WEB = 'file:///home/claude/camry/web/index.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/camry/out'

BRIDGE = r"""
window.__calls = []; window.__noIntro = !/intro=1/.test(location.search);
window.prompt = function (cmd, arg) {
  window.__calls.push([cmd, arg]);
  switch (cmd) {
    case 'ping': return 'pong';
    case 'apps': return JSON.stringify([
      {p:'com.google.android.apps.maps', l:'Maps'}, {p:'com.waze', l:'Waze'}, {p:'com.syu.radio', l:'Radio'},
      {p:'com.syu.bt', l:'Bluetooth'}, {p:'com.spotify.music', l:'Spotify'}, {p:'com.google.android.youtube', l:'YouTube'},
      {p:'com.android.settings', l:'الإعدادات'}, {p:'com.whatsapp', l:'WhatsApp'}, {p:'com.anghami', l:'أنغامي'},
      {p:'com.carnav.camry', l:'مقود'}, {p:'com.syu.fancontrol', l:'Fan'}]);
    case 'icon': return 'ERR';
    case 'wifi': return JSON.stringify({on:true, ssid:'"iPhone"', rssi:-58});
    case 'bt': return JSON.stringify({on:true, a2dp:2, hfp:2, dev:['iPhone', 'Galaxy S24']});
    case 'sys': return JSON.stringify({sdk:35, release:'15', model:'Camry XV70 Head Unit', maker:'Navigation Brand', board:'ums512', device:'ums512_1h10'});
    case 'temp': return JSON.stringify({z:[{t:'soc_thermal', v:'52000'}, {t:'cpu-big0', v:'57400'}, {t:'battery', v:'31000'}, {t:'pa_therm', v:'41000'}], b:310, s:0});
    case 'net': return window.__net || '1';
    case 'cache': return arg === 'size' ? JSON.stringify({n:1834, b:48234567}) : JSON.stringify({n:0, b:0});
    default: return '1';
  }
};
"""


def tile_png(z, x, y, dark):
    rnd = random.Random(z * 1000003 + x * 7919 + y)
    bg = (32, 35, 41) if dark else (236, 231, 222)
    road = (60, 64, 72) if dark else (255, 255, 255)
    major = (90, 84, 70) if dark else (252, 214, 140)
    im = Image.new('RGB', (256, 256), bg)
    d = ImageDraw.Draw(im)
    for _ in range(3):
        if rnd.random() < .5:
            d.rectangle([rnd.randint(0, 200), rnd.randint(0, 200), rnd.randint(200, 256), rnd.randint(200, 256)],
                        fill=(214, 228, 205) if not dark else (36, 44, 40))
    for i in range(0, 256, 64):
        d.line([(i, 0), (i, 256)], fill=road, width=5)
        d.line([(0, i), (256, i)], fill=road, width=5)
    d.line([(0, 0), (256, 256)], fill=major, width=10)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return b.getvalue()


def osrm_route(lat, lon):
    pts, cur = [], (lon, lat)
    for k in range(60):
        pts.append([cur[0], cur[1]])
        cur = (cur[0] + 0.0004, cur[1] + 0.0004 if k < 30 else cur[1])
    steps = [
        {'maneuver': {'type': 'depart', 'location': pts[0]}, 'name': 'طريق الملك فهد', 'distance': 2000},
        {'maneuver': {'type': 'turn', 'modifier': 'right', 'location': pts[30]}, 'name': 'شارع العليا', 'distance': 1000},
        {'maneuver': {'type': 'arrive', 'location': pts[-1]}, 'name': '', 'distance': 0}]
    return {'code': 'Ok', 'routes': [{'distance': 5200, 'duration': 420,
                                      'geometry': {'coordinates': pts}, 'legs': [{'steps': steps}]}]}


STATE = {'offline': False}


def handle(route):
    url = route.request.url
    if STATE['offline'] and not url.startswith('file:'):
        if 'basemaps.cartocdn.com' in url:          # what the native cache answers for a tile it never saw
            return route.fulfill(status=404, content_type='text/plain', body='Not cached')
        return route.abort('internetdisconnected')
    if 'basemaps.cartocdn.com' in url or 'arcgisonline' in url:
        parts = url.split('?')[0].replace('@2x', '').rsplit('/', 3)
        z, x, y = int(parts[1]), int(parts[2]), int(parts[3].split('.')[0])
        return route.fulfill(status=200, content_type='image/png', body=tile_png(z, x, y, 'dark_all' in url))
    if 'open-meteo' in url:
        return route.fulfill(status=200, content_type='application/json',
                             body=json.dumps({'current': {'temperature_2m': 31.4, 'weather_code': 1}}))
    if 'nominatim' in url and 'reverse' in url:
        return route.fulfill(status=200, content_type='application/json',
                             body=json.dumps({'address': {'city': 'الرياض'}}))
    if 'route/v1/driving' in url:
        q = url.split('driving/')[1].split('?')[0].split(';')[0].split(',')
        return route.fulfill(status=200, content_type='application/json',
                             body=json.dumps(osrm_route(float(q[1]), float(q[0]))))
    if 'interpreter' in url:
        import urllib.parse as up
        q = up.unquote(url)
        m = __import__('re').search(r'around:\d+,([\d.]+),([\d.]+)', q)
        lat, lon = (float(m.group(1)), float(m.group(2))) if m else (24.7136, 46.6753)
        names = ['جامع الملك فهد', 'مسجد الراجحي', 'جامع الإمام تركي', 'مسجد النور', 'مسجد الهدى', 'جامع العليا']
        els = [{'type': 'node', 'id': i, 'lat': lat + 0.004 * (i + 1) * (1 if i % 2 else -1), 'lon': lon + 0.003 * (i + 1),
                'tags': {'name': n, 'amenity': 'place_of_worship', 'religion': 'muslim', 'addr:street': 'طريق الملك عبدالعزيز'}}
               for i, n in enumerate(names)]
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'elements': els}))
    if 'mp3quran' in url:
        return route.fulfill(status=200, content_type='application/json',
                             body=json.dumps({'radios': [{'name': 'ياسر الدوسري', 'url': 'https://backup.qurango.net/radio/yasser_aldosari'}]}))
    if url.startswith('file:'):
        return route.continue_()
    return route.abort()


def run(w, h, name, actions, settings=None, clock=None, net='1', hero=False):
    if os.environ.get("FORCE_WH"): w, h = [int(x) for x in os.environ["FORCE_WH"].split("x")]
    STATE['offline'] = net == '0'
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1,
                            user_agent='Mozilla/5.0 (Linux; Android 10) Chrome/120 Mobile CamryNav/2.1 (Android head unit; SDK 35)',
                            timezone_id='Asia/Riyadh', locale='ar-SA')
        ctx.add_init_script(BRIDGE + ("window.__net='0';" if net == '0' else '') + ('' if hero else 'window.__noHero=true;'))
        st = {'onboarded': 2}
        st.update(settings or {})
        ctx.add_init_script('if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");'
                            'localStorage.clear();localStorage.setItem("cn.settings", %s);'
                            'localStorage.setItem("cn.brief." + new Date().toDateString(), "true");}' % json.dumps(json.dumps(st)))
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append('pageerror: %s' % e))
        page.on('console', lambda m: errors.append('console.%s: %s' % (m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.route('**/*', handle)
        if clock:
            import datetime
            page.clock.install(time=datetime.datetime(*clock))
        page.goto(WEB)
        page.wait_for_timeout(600)
        actions(page)
        page.screenshot(path='%s/%s.png' % (OUT, name))
        calls = page.evaluate('window.__calls.map(c => c[0]).join(",")')
        b.close()
        if STATE['offline']:     # uncached street tiles answer 404 offline — expected, not an error
            errors = [e for e in errors if 'status of 404' not in e and 'ERR_INTERNET_DISCONNECTED' not in e]
        return errors, calls


def drive(page, n=8, lat=24.7136, lon=46.6753, kmh=87.0, hdg=45.0):
    for i in range(n):
        d = kmh / 3.6 * 1.0 * i
        la = lat + d * math.cos(math.radians(hdg)) / 111320
        lo = lon + d * math.sin(math.radians(hdg)) / (111320 * math.cos(math.radians(lat)))
        page.evaluate('onNativeLoc(%f,%f,%f,true,%f,true,6.0,%d,612.0)' % (la, lo, kmh / 3.6, hdg, 0))
        page.wait_for_timeout(1000)


if __name__ == '__main__':
    which = sys.argv[2] if len(sys.argv) > 2 else 'main'
    if which == 'main':
        print(run(1024, 600, 'ui_1024x600', lambda p: drive(p)))
    elif which == 'nav':
        def a(p):
            drive(p, 3)
            p.evaluate("App.nav.start({lat:24.73, lon:46.70, name:'برج المملكة'})")
            p.wait_for_timeout(5000)
            drive(p, 4, lat=24.7148, lon=46.6765)
        print(run(1280, 720, 'ui_nav_1280x720', a))
    elif which == 'radio':
        def a(p):
            p.click('.dk[data-panel="radio"]')
            p.wait_for_timeout(1200)
        print(run(1024, 600, 'ui_radio', a))
    elif which == 'settings':
        def a(p):
            p.click('.dk[data-panel="settings"]')
            p.wait_for_timeout(800)
        print(run(1024, 600, 'ui_settings', a))
    elif which == 'apps':
        def a(p):
            p.click('.dk[data-panel="apps"]')
            p.wait_for_timeout(800)
        print(run(1024, 600, 'ui_apps', a))
    elif which == 'bt':
        def a(p):
            p.click('.dk[data-panel="bt"]')
            p.wait_for_timeout(800)
        print(run(1024, 600, 'ui_bt', a))
    elif which == 'search':
        def a(p):
            p.click('#searchBar')
            p.wait_for_timeout(800)
        print(run(1024, 600, 'ui_search', a))
    elif which == 'portrait':
        print(run(720, 1280, 'ui_portrait', lambda p: drive(p, 4)))
    elif which == 'wifi':
        def a(p):
            p.click('.dk[data-panel="wifi"]')
            p.wait_for_timeout(800)
        print(run(1024, 600, 'ui_wifi', a))
    elif which == 'theme':
        th = sys.argv[3]
        extra = {'theme': th, 'autoOccasion': False}
        if th == 'custom': extra['customAccent'] = sys.argv[4] if len(sys.argv) > 4 else '#d64bff'
        if th == 'royal': extra['car'] = {'brand': 'جي إم سي', 'model': 'يوكن', 'body': 'suv', 'color': 'white'}
        if th == 'match': extra['car'] = {'brand': 'تويوتا', 'model': 'هايلكس', 'body': 'pickup', 'color': 'gray'}
        print(run(1024, 600, 'ui_theme_' + th, lambda p: drive(p, 4), extra))
    elif which == 'welcome':
        def a(p):
            p.wait_for_timeout(900)
        print(run(1024, 600, 'ui_welcome', a, {'onboarded': 0}))
    elif which == 'welcome2':
        def a(p):
            p.wait_for_timeout(900); p.click('#wNext'); p.wait_for_timeout(600)
        print(run(1024, 600, 'ui_welcome2', a, {'onboarded': 0}))
    elif which == 'prayer':
        def a(p):
            drive(p, 3); p.click('#prayerCard'); p.wait_for_timeout(1500)
        print(run(1024, 600, 'ui_prayer', a))
    elif which == 'alert':
        def a(p):
            drive(p, 2); p.evaluate('App.prayer.alertNow(2)'); p.wait_for_timeout(1500)
        print(run(1024, 600, 'ui_alert', a))
    elif which == 'mosques':
        def a(p):
            drive(p, 2); p.evaluate('App.prayer.nearestMosques().then(App.prayer.showMosquesOnMap)'); p.wait_for_timeout(2500)
        print(run(1024, 600, 'ui_mosques', a))
    elif which == 'adhkar':
        def a(p):
            p.click('.dk[data-panel="adhkar"]'); p.wait_for_timeout(500)
            for _ in range(3): p.click('.dhikr[data-i="1"]'); p.wait_for_timeout(120)
            p.wait_for_timeout(600)
        print(run(1024, 600, 'ui_adhkar', a))
    elif which == 'tasks':
        def a(p):
            p.evaluate("App.tasks.add('صيدلية — دواء الوالدة', null, Date.now()+3600e3);App.tasks.add('تعبئة بنزين', 'fuel');"
                       "App.tasks.add('توصيل الأولاد للمدرسة', null, Date.now()+86400e3).rep=true;var d=App.tasks.add('سحب من الصراف');d.done=true;")
            p.click('.dk[data-panel="tasks"]'); p.wait_for_timeout(900)
        print(run(1024, 600, 'ui_tasks', a, {'odo': None}))
    elif which == 'car':
        def a(p):
            p.click('#carChip'); p.wait_for_timeout(900)
        print(run(1024, 600, 'ui_car', a, {'odo': {'base': 84250, 'at': 0}, 'maint': {'oil': {'last': 80100, 'every': 5000}, 'wash': {'last': 0, 'every': 7},
                                              'registration': {'due': '2027-01-05'}, 'insurance': {'due': '2026-12-01'}}}))
    elif which == 'fan':
        def a(p):
            p.wait_for_timeout(500); p.click('.dk[data-panel="fan"]'); p.wait_for_timeout(1500)
        print(run(1024, 600, 'ui_fan', a))
    elif which == 'brief':
        def a(p):
            p.evaluate('App.tasks.add("صيدلية")'); p.evaluate('App.tasks.showBriefing()'); p.wait_for_timeout(900)
        print(run(1024, 600, 'ui_brief', a))
    elif which == 'national':
        def a(p):
            p.wait_for_timeout(2600)
        print(run(1024, 600, 'ui_national_day', a, {}, clock=(2026, 9, 23, 18, 30)))
    elif which == 'founding':
        def a(p):
            drive(p, 3)
        print(run(1024, 600, 'ui_founding_day', a, {}, clock=(2027, 2, 22, 10, 15)))
    elif which == 'intro':
        def a(p):
            p.goto(WEB + '?intro=1'); p.wait_for_timeout(1900)
        print(run(1280, 720, 'ui_intro', a, {'theme': 'silver', 'autoOccasion': False}))
    elif which == 'tasks2':
        def a(p):
            p.evaluate("App.tasks.add('صيدلية — دواء الوالدة', null, Date.now()+3600e3);App.tasks.add('تعبئة بنزين', 'fuel');"
                       "App.tasks.add('توصيل الأولاد للمدرسة', null, Date.now()+86400e3).rep=true;var d=App.tasks.add('سحب من الصراف');d.done=true;")
            p.click('.dk[data-panel="tasks"]'); p.wait_for_timeout(700)
            p.evaluate("document.getElementById('sheetBody').scrollTop=400"); p.wait_for_timeout(300)
        print(run(1024, 600, 'ui_tasks2', a))
    elif which == 'pick':
        def a(p):
            p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(500)
            p.click('.theme-card[data-theme="founding"]'); p.wait_for_timeout(400)
            k = p.evaluate('App.theme.key + "|" + getComputedStyle(document.documentElement).getPropertyValue("--accent")')
            print('picked:', k)
            p.click('.sw[data-c="#ff4fa3"]'); p.wait_for_timeout(300)
            print('custom:', p.evaluate('App.theme.key + "|" + getComputedStyle(document.documentElement).getPropertyValue("--accent")'))
            p.click('#sheetClose'); p.click('#carChip'); p.wait_for_timeout(400); p.click('#cEdit'); p.wait_for_timeout(300)
            p.click('[data-c="red"]'); p.fill('#cModel', 'تاهو'); p.dispatch_event('#cModel', 'change'); p.wait_for_timeout(300)
            print('car:', p.evaluate('JSON.stringify(App.car.get())'))
        print(run(1024, 600, 'ui_pick', a))
    elif which == 'logo':
        def a(p):
            p.click('#carChip'); p.wait_for_timeout(500); p.click('#cEdit'); p.wait_for_timeout(400)
            p.set_input_files('#cFile', '/home/claude/camry/tmp/test_logo.jpg'); p.wait_for_timeout(1200)
            print('mode:', p.evaluate('App.car.logoMode()'), 'alpha:', p.evaluate('App.car.logo().a'),
                  'kb:', p.evaluate('Math.round(App.car.logo().d.length/1024)'))
            p.screenshot(path='%s/ui_logo_editor.png' % OUT)
            p.click('#cMode [data-m="accent"]'); p.wait_for_timeout(200)
            p.click('#cMode [data-m="chrome"]'); p.wait_for_timeout(200)
            p.click('#sheetClose'); p.wait_for_timeout(300)
            p.click('#carChip'); p.wait_for_timeout(700)
            p.screenshot(path='%s/ui_logo_hero.png' % OUT)
            p.click('#sheetClose'); drive(p, 4)
        print(run(1024, 600, 'ui_logo_main', a))
    elif which == 'logointro':
        def a(p):
            p.click('#carChip'); p.wait_for_timeout(400); p.click('#cEdit'); p.wait_for_timeout(300)
            p.set_input_files('#cFile', '/home/claude/camry/tmp/test_logo.jpg'); p.wait_for_timeout(1000)
            p.goto(WEB + '?intro=1'); p.wait_for_timeout(1700)
        print(run(1024, 600, 'ui_logo_intro', a, {'theme': 'founding', 'autoOccasion': False}))
    elif which == 'about':
        def a(p):
            p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(500)
            p.evaluate("document.getElementById('sheetBody').scrollTop=1e5"); p.wait_for_timeout(300)
        print(run(1024, 600, 'ui_about', a))
    elif which == 'plan':
        def a(p):
            drive(p, 2)
            p.evaluate("App.tasks.add('صيدلية — دواء الوالدة', 'pharmacy');App.tasks.add('تعبئة بنزين', 'fuel');App.tasks.add('خبز للبيت', 'bakery')")
            p.evaluate('App.tasks.planErrands()'); p.wait_for_timeout(2500)
            print('plan:', p.evaluate('App.tasks.plan.length'))
            # arrive at the first stop: the assistant should offer the next one
            p.evaluate("App.nav.active={dest:App.tasks.plan[0].p};App.nav.stop(true)"); p.wait_for_timeout(700)
            p.screenshot(path='%s/ui_plan_arrive.png' % OUT)
            p.evaluate("App.reminder.hide()"); p.evaluate('App.tasks.planErrands()'); p.wait_for_timeout(1500)
        print(run(1024, 600, 'ui_plan', a))
    elif which == 'unit':
        # the user's head unit: 1280x720, driving, then settings bottom
        def a(p):
            drive(p, 4)
        print(run(1280, 720, 'unit_main', a))
        def b(p):
            p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(500)
            p.evaluate("document.getElementById('sheetBody').scrollTop=1e5"); p.wait_for_timeout(300)
        print(run(1280, 720, 'unit_settings', b))
        def c(p):
            p.wait_for_timeout(900)
        print(run(1280, 720, 'unit_welcome', c, {'onboarded': 0}))
        def d(p):
            drive(p, 3); p.click('#prayerCard'); p.wait_for_timeout(1500)
        print(run(1280, 720, 'unit_prayer', d, {'theme': 'royal', 'autoOccasion': False}))
    elif which == 'offline':
        # no internet: built-in Kingdom map under the missing street tiles, «you are in» chip, satellites
        def a(p):
            p.evaluate('onGnss(9,14)')
            drive(p, 20)
            p.wait_for_timeout(1500)
            print('offline:', p.evaluate('App.offline'), 'base:', p.evaluate('App.base.ready'),
                  'where:', p.evaluate("document.querySelector('#whereChip span').textContent"),
                  'fix:', p.evaluate("document.getElementById('gFix').textContent"),
                  'city:', p.evaluate("document.getElementById('pcCity').textContent"),
                  'baseMode:', p.evaluate('App.map.baseMode'), 'z:', p.evaluate('App.map.z.toFixed(2)'),
                  'stNet:', p.evaluate("document.getElementById('stNet').getAttribute('class')"))
        print(run(1280, 720, 'off_main', a, net='0'))
        def b(p):
            drive(p, 2)
            p.evaluate('App.map.follow=false; App.map.rot=0; App.map.lookAt(24.2, 44.8, 5.25)'); p.wait_for_timeout(1500)
        print(run(1280, 720, 'off_kingdom', b, {'mapStyle': 'ksa'}, net='0'))
        def c(p):
            drive(p, 2)
            p.evaluate('App.map.follow=false; App.map.rot=0; App.map.lookAt(21.55, 39.17, 12.2)'); p.wait_for_timeout(1500)
        print(run(1280, 720, 'off_jeddah', c, {'mapStyle': 'ksa'}, net='0'))
    elif which == 'offsearch':
        def a(p):
            drive(p, 2)
            p.click('#searchBar'); p.wait_for_timeout(500)
            p.fill('#sInput', 'الملقا'); p.press('#sInput', 'Enter'); p.wait_for_timeout(700)
            print('results:', p.evaluate("[...document.querySelectorAll('#sResults .row b')].slice(0,5).map(b=>b.textContent).join(' | ')"))
        print(run(1280, 720, 'off_search', a, net='0'))
        def b(p):
            drive(p, 2)
            p.click('#searchBar'); p.wait_for_timeout(500)
            p.fill('#sInput', 'ابها'); p.press('#sInput', 'Enter'); p.wait_for_timeout(700)
            p.click('#sResults .row'); p.wait_for_timeout(700)
        print(run(1280, 720, 'off_place', b, net='0'))
    elif which == 'offnav':
        def a(p):
            p.evaluate('onGnss(11,16)')
            drive(p, 3, hdg=10)
            p.evaluate("App.nav.start({lat:24.7743, lon:46.7386, name:'حي النرجس', sub:'الرياض'})")
            p.wait_for_timeout(1200)
            drive(p, 3, lat=24.7148, lon=46.6765, hdg=10)
            print('direct:', p.evaluate('!!(App.nav.active && App.nav.active.direct)'),
                  'card:', p.evaluate("document.getElementById('ncInstr').textContent"),
                  'dist:', p.evaluate("document.getElementById('ncDist').textContent"))
        print(run(1280, 720, 'off_nav', a, net='0'))
    elif which == 'offradio':
        def a(p):
            p.click('.dk[data-panel="radio"]'); p.wait_for_timeout(900)
            p.screenshot(path='%s/off_radio.png' % OUT)
            p.click('#rCarGo'); p.wait_for_timeout(4200)
            print('launches:', p.evaluate("JSON.stringify(window.__calls.filter(c => c[0]==='launch').map(c => c[1]))"))
            p.click('#sheetClose'); p.wait_for_timeout(300)
            p.click('#mcNext'); p.wait_for_timeout(200)
            print('card:', p.evaluate("document.getElementById('mcName').textContent + ' | ' + document.getElementById('mcSub').textContent + ' | ' + document.getElementById('mcGo').textContent"))
            print('keys:', p.evaluate("JSON.stringify(window.__calls.filter(c => c[0]==='key').map(c => c[1]))"))
            drive(p, 3)
        print(run(1280, 720, 'off_radio_main', a, {'radioApp': 'com.syu.radio'}, net='0'))
    elif which == 'offpanel':
        def a(p):
            p.click('#netChip'); p.wait_for_timeout(900)
        print(run(1280, 720, 'off_panel', a, net='0'))
        def b(p):
            p.click('.dk[data-panel="radio"]'); p.wait_for_timeout(1200)
        print(run(1280, 720, 'on_radio', b, {'radioApp': 'com.syu.radio'}))
    elif which == 'dash':
        def a(p):
            p.evaluate('onGnss(10,15)')
            drive(p, 6)
            print('big:', p.evaluate("document.body.classList.contains('map-big')"),
                  'place:', p.evaluate("document.getElementById('icPlace').textContent + ' | ' + document.getElementById('icSub').textContent"),
                  'map:', p.evaluate("JSON.stringify(document.getElementById('map').getBoundingClientRect())"))
        print(run(1280, 720, 'dash_1280', a))
        print(run(1024, 600, 'dash_1024', lambda p: drive(p, 4)))
        print(run(800, 480, 'dash_800', lambda p: drive(p, 4)))
        print(run(720, 1280, 'dash_portrait', lambda p: drive(p, 4)))
        def b(p):
            drive(p, 3); p.click('#btnBig'); p.wait_for_timeout(900)
            print('big after click:', p.evaluate("document.body.classList.contains('map-big')"),
                  'saved:', p.evaluate('App.settings.mapBig'))
        print(run(1280, 720, 'dash_bigmap', b))
        def c(p):
            drive(p, 2)
            p.evaluate("App.nav.start({lat:24.73, lon:46.70, name:'برج المملكة'})"); p.wait_for_timeout(4500)
            drive(p, 2, lat=24.7148, lon=46.6765)
            print('nav big:', p.evaluate("document.body.classList.contains('map-big')"))
            p.screenshot(path='%s/dash_nav.png' % OUT)
            p.evaluate('App.nav.stop()'); p.wait_for_timeout(600)
            print('after stop big:', p.evaluate("document.body.classList.contains('map-big')"))
        print(run(1280, 720, 'dash_navstop', c))
        def d(p):
            drive(p, 2); p.click('.dk[data-panel="radio"]'); p.wait_for_timeout(900)
        print(run(1280, 720, 'dash_panel', d))
        def e(p):
            p.evaluate("App.radio.play({n:'إذاعة القرآن الكريم - السعودية', u:'https://stream.radiojar.com/0tpy1h0kxtzuv'})")
            drive(p, 3)
        print(run(1280, 720, 'dash_online_radio', e, {'theme': 'royal', 'autoOccasion': False}))
    elif which == 'friday':
        def a(p):
            p.wait_for_timeout(2600)
            p.screenshot(path='%s/fri_greeting.png' % OUT)
            drive(p, 6)
            print('theme:', p.evaluate('App.theme.key'), 'chip:', p.evaluate("document.getElementById('occChip').textContent"),
                  'dhuhr:', p.evaluate("document.querySelectorAll('#prayerList li span')[2].textContent"),
                  'reminder:', p.evaluate("document.getElementById('reminder').classList.contains('hidden') ? '-' : document.querySelector('#reminder .rm-t').textContent"))
        print(run(1280, 720, 'fri_dash', a, {}, clock=(2026, 11, 20, 10, 30), hero=True))
        def b(p):
            p.wait_for_timeout(7500)
            p.click('.dk[data-panel="adhkar"]'); p.wait_for_timeout(500)
            p.click('[data-m="f"]'); p.wait_for_timeout(500)
            p.click('.sunna[data-s="g"]'); p.wait_for_timeout(200)
            for _ in range(13): p.click('.sunna[data-s="s"] .salawat'); p.wait_for_timeout(60)
            p.wait_for_timeout(400)
            print('state:', p.evaluate("JSON.stringify(App.store.get('fri.' + App.fridayKey(), null))"))
        print(run(1280, 720, 'fri_sunan', b, {}, clock=(2026, 11, 20, 8, 40)))
        def c(p):
            p.wait_for_timeout(7000)
            print('kahf reminder:', p.evaluate("document.getElementById('reminder').classList.contains('hidden') ? '-' : document.querySelector('#reminder .rm-t').textContent"))
            p.click('#reminder [data-b="play"]'); p.wait_for_timeout(600)
            print('playing:', p.evaluate('App.radio.cur && App.radio.cur.n'), '|', p.evaluate("document.getElementById('mcName').textContent"))
        print(run(1280, 720, 'fri_kahf', c, {}, clock=(2026, 11, 20, 8, 40)))
        def d(p):
            drive(p, 3)
            print('thu night:', p.evaluate('App.theme.key'), p.evaluate("document.getElementById('occChip').textContent"))
        print(run(1280, 720, 'fri_thursday_night', d, {}, clock=(2026, 11, 19, 20, 15)))
        def e(p):
            drive(p, 3)
            print('saturday:', p.evaluate('App.theme.key'), p.evaluate("document.getElementById('occChip').classList.contains('hidden')"))
        print(run(1280, 720, 'fri_saturday', e, {}, clock=(2026, 11, 21, 10, 0)))
        def f(p):
            p.wait_for_timeout(7000); p.click('.dk[data-panel="settings"]'); p.wait_for_timeout(700)
        print(run(1280, 720, 'fri_settings', f, {}, clock=(2026, 11, 20, 16, 30)))
        print(run(720, 1280, 'fri_portrait', lambda p: (p.wait_for_timeout(7000), drive(p, 3)), {}, clock=(2026, 11, 20, 16, 30)))
    elif which == 'size':
        w, h = [int(x) for x in sys.argv[3].split('x')]
        print(run(w, h, 'ui_%dx%d' % (w, h), lambda p: drive(p, 4)))
