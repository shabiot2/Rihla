"""Native shell of the app, written directly as Dalvik code.

Java equivalent (for reference):
  class Main extends Activity implements LocationListener, TextToSpeech.OnInitListener
    - onCreate: fullscreen-less dark WebView loading file:///android_asset/index.html,
      JS + DOM storage + geolocation, prompt() bridge via Chrome, location permission.
    - GPS: LocationManager "gps" updates -> window.onNativeLoc(lat,lon,speed,hasSpeed,
      bearing,hasBearing,accuracy,time,alt)
    - handle(cmd,arg): ping, launch, intent, view, apps, icon, wifi, bt, tts, vol, key, full
  class Chrome extends WebChromeClient
    - geolocation prompt auto-granted, onJsPrompt -> Main.handle (catch-all -> "ERR")
"""
from dex import ClassDef, ACC_PUBLIC, ACC_STATIC

PKG = 'com.carnav.camry'
MAIN = 'Lcom/carnav/camry/Main;'
CHROME = 'Lcom/carnav/camry/Chrome;'
SYS = 'Lcom/carnav/camry/Sys;'
WEB = 'Lcom/carnav/camry/Web;'
GNSS = 'Lcom/carnav/camry/Gnss;'
RCV = 'Lcom/carnav/camry/Rcv;'
ACT = 'Landroid/app/Activity;'
STR = 'Ljava/lang/String;'
SB = 'Ljava/lang/StringBuilder;'
JSO = 'Lorg/json/JSONObject;'
JSA = 'Lorg/json/JSONArray;'

S_EQ = 'invoke-virtual {%s, %s}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z'
APPEND_S = 'invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;'


def build_classes():
    main = ClassDef(MAIN, ACT, ['Landroid/location/LocationListener;',
                                'Landroid/speech/tts/TextToSpeech$OnInitListener;'])
    main.field('wv', 'Landroid/webkit/WebView;')
    main.field('lm', 'Landroid/location/LocationManager;')
    main.field('tts', 'Landroid/speech/tts/TextToSpeech;')
    main.field('fc', 'Landroid/webkit/ValueCallback;')
    main.field('gn', 'Ljava/lang/Object;')
    main.field('rcv', 'Lcom/carnav/camry/Rcv;')

    main.method('<init>', [], 'V', 1, '''
        invoke-direct {p0}, Landroid/app/Activity;-><init>()V
        return-void
    ''')

    main.method('onCreate', ['Landroid/os/Bundle;'], 'V', 7, '''
        invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
        const/4 v0, 1
        invoke-virtual {p0, v0}, Landroid/app/Activity;->requestWindowFeature(I)Z
        invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
        move-result-object v0
        const/16 v1, 0x80
        invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V
        new-instance v0, Landroid/webkit/WebView;
        invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
        iput-object v0, p0, Lcom/carnav/camry/Main;->wv:Landroid/webkit/WebView;
        const v1, 0xff0b0e12
        invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V
        invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
        move-result-object v1
        const/4 v2, 1
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setGeolocationEnabled(Z)V
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V
        invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V
        const/4 v3, 0
        invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V
        invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMixedContentMode(I)V
        const/16 v3, 100
        invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setTextZoom(I)V
        new-instance v3, Ljava/lang/StringBuilder;
        invoke-direct {v3}, Ljava/lang/StringBuilder;-><init>()V
        invoke-virtual {v1}, Landroid/webkit/WebSettings;->getUserAgentString()Ljava/lang/String;
        move-result-object v4
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const-string v4, " CamryNav/3.0 (Android head unit; SDK "
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        sget v4, Landroid/os/Build$VERSION;->SDK_INT:I
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;
        const-string v4, ")"
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v4
        invoke-virtual {v1, v4}, Landroid/webkit/WebSettings;->setUserAgentString(Ljava/lang/String;)V
        new-instance v1, Lcom/carnav/camry/Chrome;
        invoke-direct {v1, p0}, Lcom/carnav/camry/Chrome;-><init>(Lcom/carnav/camry/Main;)V
        invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V
        new-instance v1, Lcom/carnav/camry/Web;
        new-instance v2, Ljava/io/File;
        invoke-virtual {p0}, Landroid/app/Activity;->getFilesDir()Ljava/io/File;
        move-result-object v3
        const-string v4, "tiles"
        invoke-direct {v2, v3, v4}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
        invoke-direct {v1, v2}, Lcom/carnav/camry/Web;-><init>(Ljava/io/File;)V
        invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V
        invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V
        const-string v1, "file:///android_asset/index.html"
        invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
        sget v1, Landroid/os/Build$VERSION;->SDK_INT:I
        const/16 v2, 23
        if-lt v1, v2, :done
        const-string v1, "android.permission.ACCESS_FINE_LOCATION"
        invoke-virtual {p0, v1}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I
        move-result v2
        const-string v3, "android.permission.READ_EXTERNAL_STORAGE"
        if-nez v2, :ask
        invoke-virtual {p0, v3}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I
        move-result v2
        if-eqz v2, :done
        :ask
        const/4 v2, 4
        new-array v2, v2, [Ljava/lang/String;
        const/4 v4, 3
        aput-object v3, v2, v4
        const/4 v3, 0
        aput-object v1, v2, v3
        const-string v1, "android.permission.BLUETOOTH_CONNECT"
        const/4 v3, 2
        aput-object v1, v2, v3
        const-string v1, "android.permission.ACCESS_COARSE_LOCATION"
        const/4 v3, 1
        aput-object v1, v2, v3
        invoke-virtual {p0, v2, v3}, Landroid/app/Activity;->requestPermissions([Ljava/lang/String;I)V
        :done
        return-void
    ''')

    main.method('onResume', [], 'V', 2, '''
        invoke-super {p0}, Landroid/app/Activity;->onResume()V
        invoke-virtual {p0}, Lcom/carnav/camry/Main;->startLoc()V
        const-string v0, "window.onAppResume&&onAppResume()"
        invoke-virtual {p0, v0}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V
        return-void
    ''')

    main.method('onDestroy', [], 'V', 1, '''
        invoke-virtual {p0}, Lcom/carnav/camry/Main;->stopLoc()V
        invoke-super {p0}, Landroid/app/Activity;->onDestroy()V
        return-void
    ''')

    main.method('onBackPressed', [], 'V', 2, '''
        const-string v0, "window.onBackKey&&onBackKey()"
        invoke-virtual {p0, v0}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V
        return-void
    ''')

    main.method('onRequestPermissionsResult', ['I', '[Ljava/lang/String;', '[I'], 'V', 5, '''
        invoke-virtual {p0}, Lcom/carnav/camry/Main;->startLoc()V
        const-string v0, "window.onPerm&&onPerm()"
        invoke-virtual {p0, v0}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V
        return-void
    ''')

    loc = ['new-instance v0, Ljava/lang/StringBuilder;',
           'const-string v1, "window.onNativeLoc&&onNativeLoc("',
           'invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V',
           'const-string v1, ","']
    getters = [('getLatitude', 'D'), ('getLongitude', 'D'), ('getSpeed', 'F'), ('hasSpeed', 'Z'),
               ('getBearing', 'F'), ('hasBearing', 'Z'), ('getAccuracy', 'F'), ('getTime', 'J'),
               ('getAltitude', 'D')]
    for k, (g, t) in enumerate(getters):
        wide = t in 'DJ'
        loc.append('invoke-virtual {p1}, Landroid/location/Location;->%s()%s' % (g, t))
        loc.append(('move-result-wide v2' if wide else 'move-result v2'))
        loc.append('invoke-virtual {v0, v2%s}, Ljava/lang/StringBuilder;->append(%s)Ljava/lang/StringBuilder;'
                   % (', v3' if wide else '', t))
        if k < len(getters) - 1:
            loc.append(APPEND_S)
    loc += ['const-string v1, ")"', APPEND_S,
            'invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;',
            'move-result-object v1',
            'invoke-virtual {p0, v1}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V',
            'return-void']
    main.method('onLocationChanged', ['Landroid/location/Location;'], 'V', 6, '\n'.join(loc))

    main.method('onStatusChanged', [STR, 'I', 'Landroid/os/Bundle;'], 'V', 4, 'return-void')
    main.method('onProviderEnabled', [STR], 'V', 2, 'return-void')
    main.method('onProviderDisabled', [STR], 'V', 2, 'return-void')
    main.method('onInit', ['I'], 'V', 2, 'return-void')

    main.method('js', [STR], 'V', 4, '''
        iget-object v0, p0, Lcom/carnav/camry/Main;->wv:Landroid/webkit/WebView;
        if-eqz v0, :end
        const/4 v1, 0
        invoke-virtual {v0, p1, v1}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
        :end
        return-void
    ''')

    # GPS: updates as fast as the receiver gives them; an immediate position from the last known fix
    # (gps, then network, then passive); and once per start, assisted-GPS (time + XTRA orbit data)
    # so the head unit locks onto satellites much sooner.
    main.method('startLoc', [], 'V', 9, '''
        :try_start
        const-string v0, "location"
        invoke-virtual {p0, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/location/LocationManager;
        iput-object v0, p0, Lcom/carnav/camry/Main;->lm:Landroid/location/LocationManager;
        move-object v1, v0
        const-string v2, "gps"
        const-wide/16 v3, 0
        const/4 v5, 0
        move-object v6, p0
        invoke-virtual/range {v1 .. v6}, Landroid/location/LocationManager;->requestLocationUpdates(Ljava/lang/String;JFLandroid/location/LocationListener;)V
        invoke-virtual {v1, v2}, Landroid/location/LocationManager;->getLastKnownLocation(Ljava/lang/String;)Landroid/location/Location;
        move-result-object v0
        if-nez v0, :have
        const-string v2, "network"
        invoke-virtual {v1, v2}, Landroid/location/LocationManager;->getLastKnownLocation(Ljava/lang/String;)Landroid/location/Location;
        move-result-object v0
        if-nez v0, :have
        const-string v2, "passive"
        invoke-virtual {v1, v2}, Landroid/location/LocationManager;->getLastKnownLocation(Ljava/lang/String;)Landroid/location/Location;
        move-result-object v0
        if-eqz v0, :try_end
        :have
        invoke-virtual {p0, v0}, Lcom/carnav/camry/Main;->onLocationChanged(Landroid/location/Location;)V
        :try_end
        :g_start
        const/4 v7, 0
        sget v0, Landroid/os/Build$VERSION;->SDK_INT:I
        const/16 v2, 24
        if-lt v0, v2, :g_end
        iget-object v0, p0, Lcom/carnav/camry/Main;->gn:Ljava/lang/Object;
        if-nez v0, :g_end
        iget-object v1, p0, Lcom/carnav/camry/Main;->lm:Landroid/location/LocationManager;
        if-eqz v1, :g_end
        invoke-static {p0, v1}, Lcom/carnav/camry/Gnss;->start(Lcom/carnav/camry/Main;Landroid/location/LocationManager;)Ljava/lang/Object;
        move-result-object v0
        iput-object v0, p0, Lcom/carnav/camry/Main;->gn:Ljava/lang/Object;
        const/4 v7, 1
        :g_end
        if-eqz v7, :ret
        :x_start
        iget-object v1, p0, Lcom/carnav/camry/Main;->lm:Landroid/location/LocationManager;
        if-eqz v1, :x_end
        const-string v3, "gps"
        const-string v4, "force_time_injection"
        const/4 v5, 0
        invoke-virtual {v1, v3, v4, v5}, Landroid/location/LocationManager;->sendExtraCommand(Ljava/lang/String;Ljava/lang/String;Landroid/os/Bundle;)Z
        const-string v4, "force_xtra_injection"
        invoke-virtual {v1, v3, v4, v5}, Landroid/location/LocationManager;->sendExtraCommand(Ljava/lang/String;Ljava/lang/String;Landroid/os/Bundle;)Z
        :x_end
        :ret
        return-void
        :handler
        move-exception v0
        goto :g_start
        :g_handler
        move-exception v0
        return-void
        :x_handler
        move-exception v0
        return-void
        .catchall {:try_start .. :try_end} :handler
        .catchall {:g_start .. :g_end} :g_handler
        .catchall {:x_start .. :x_end} :x_handler
    ''')

    main.method('stopLoc', [], 'V', 2, '''
        iget-object v0, p0, Lcom/carnav/camry/Main;->lm:Landroid/location/LocationManager;
        if-eqz v0, :end
        :try_start
        invoke-virtual {v0, p0}, Landroid/location/LocationManager;->removeUpdates(Landroid/location/LocationListener;)V
        :try_end
        :end
        return-void
        :handler
        move-exception v0
        return-void
        .catchall {:try_start .. :try_end} :handler
    ''')

    # ---- command dispatcher ----
    cmds = [('launch', True), ('intent', True), ('view', True), ('apps', False), ('icon', True),
            ('wifi', True), ('bt', True), ('tts', True), ('vol', True), ('key', True), ('full', True),
            ('home', True), ('temp', True), ('sys', True), ('net', True), ('cache', True),
            ('radios', False), ('start', True), ('ls', True), ('perm', True), ('probe', True),
            ('dexscan', True), ('listen', True), ('props', False), ('services', False), ('devs', False), ('pkgs', False)]
    h = ['const-string v0, "ping"', S_EQ % ('v0', 'p1'), 'move-result v1', 'if-eqz v1, :c0',
         'const-string v0, "pong"', 'return-object v0']
    for k, (c, has_arg) in enumerate(cmds):
        h += [':c%d' % k, 'const-string v0, "%s"' % c, S_EQ % ('v0', 'p1'), 'move-result v1',
              'if-eqz v1, :c%d' % (k + 1)]
        if has_arg:
            h.append('invoke-virtual {p0, p2}, Lcom/carnav/camry/Main;->%s(Ljava/lang/String;)Ljava/lang/String;' % c)
        else:
            h.append('invoke-virtual {p0}, Lcom/carnav/camry/Main;->%s()Ljava/lang/String;' % c)
        h += ['move-result-object v0', 'return-object v0']
    h += [':c%d' % len(cmds), 'const-string v0, ""', 'return-object v0']
    main.method('handle', [STR, STR], STR, 5, '\n'.join(h))

    main.method('launch', [STR], STR, 4, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v0
        invoke-virtual {v0, p1}, Landroid/content/pm/PackageManager;->getLaunchIntentForPackage(Ljava/lang/String;)Landroid/content/Intent;
        move-result-object v0
        if-nez v0, :ok
        const-string v1, "0"
        return-object v1
        :ok
        const/high16 v1, 0x10000000
        invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
        invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V
        const-string v1, "1"
        return-object v1
    ''')

    main.method('intent', [STR], STR, 4, '''
        new-instance v0, Landroid/content/Intent;
        invoke-direct {v0, p1}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
        const/high16 v1, 0x10000000
        invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
        invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V
        const-string v1, "1"
        return-object v1
    ''')

    # launch an activity by component "package/class" (radio screens that have no launcher icon of their own)
    main.method('start', [STR], STR, 5, '''
        invoke-static {p1}, Landroid/content/ComponentName;->unflattenFromString(Ljava/lang/String;)Landroid/content/ComponentName;
        move-result-object v1
        if-eqz v1, :bad
        new-instance v0, Landroid/content/Intent;
        invoke-direct {v0}, Landroid/content/Intent;-><init>()V
        invoke-virtual {v0, v1}, Landroid/content/Intent;->setComponent(Landroid/content/ComponentName;)Landroid/content/Intent;
        const/high16 v2, 0x10000000
        invoke-virtual {v0, v2}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
        invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V
        const-string v2, "1"
        return-object v2
        :bad
        const-string v2, "0"
        return-object v2
    ''')

    # every exported activity whose class name mentions radio / fm / tuner -> [{"p","c","l"}]
    main.method('radios', [], STR, 15, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v0
        const/4 v1, 0
        invoke-virtual {v0, v1}, Landroid/content/pm/PackageManager;->getInstalledApplications(I)Ljava/util/List;
        move-result-object v1
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        invoke-interface {v1}, Ljava/util/List;->size()I
        move-result v3
        const/4 v4, 0
        :pk_loop
        if-ge v4, v3, :done
        :try_start
        invoke-interface {v1, v4}, Ljava/util/List;->get(I)Ljava/lang/Object;
        move-result-object v5
        check-cast v5, Landroid/content/pm/ApplicationInfo;
        iget-object v5, v5, Landroid/content/pm/PackageItemInfo;->packageName:Ljava/lang/String;
        const/4 v6, 1
        invoke-virtual {v0, v5, v6}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;
        move-result-object v6
        iget-object v6, v6, Landroid/content/pm/PackageInfo;->activities:[Landroid/content/pm/ActivityInfo;
        if-eqz v6, :try_end
        array-length v7, v6
        const/4 v8, 0
        :ac_loop
        if-ge v8, v7, :try_end
        aget-object v9, v6, v8
        iget-boolean v10, v9, Landroid/content/pm/ComponentInfo;->exported:Z
        if-eqz v10, :ac_next
        iget-object v10, v9, Landroid/content/pm/PackageItemInfo;->name:Ljava/lang/String;
        invoke-virtual {v10}, Ljava/lang/String;->toLowerCase()Ljava/lang/String;
        move-result-object v10
        const-string v11, "radio"
        invoke-virtual {v10, v11}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v11
        if-nez v11, :ac_hit
        const-string v11, "fm"
        invoke-virtual {v10, v11}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v11
        if-nez v11, :ac_hit
        const-string v11, "tuner"
        invoke-virtual {v10, v11}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v11
        if-eqz v11, :ac_next
        :ac_hit
        new-instance v11, Lorg/json/JSONObject;
        invoke-direct {v11}, Lorg/json/JSONObject;-><init>()V
        const-string v12, "p"
        invoke-virtual {v11, v12, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        iget-object v13, v9, Landroid/content/pm/PackageItemInfo;->name:Ljava/lang/String;
        const-string v12, "c"
        invoke-virtual {v11, v12, v13}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v9, v0}, Landroid/content/pm/PackageItemInfo;->loadLabel(Landroid/content/pm/PackageManager;)Ljava/lang/CharSequence;
        move-result-object v13
        invoke-interface {v13}, Ljava/lang/CharSequence;->toString()Ljava/lang/String;
        move-result-object v13
        const-string v12, "l"
        invoke-virtual {v11, v12, v13}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v2, v11}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        :ac_next
        add-int/lit8 v8, v8, 1
        goto :ac_loop
        :try_end
        :pk_next
        add-int/lit8 v4, v4, 1
        goto :pk_loop
        :done
        invoke-virtual {v2}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :handler
        move-exception v10
        goto :pk_next
        .catchall {:try_start .. :try_end} :handler
    ''')

    main.method('view', [STR], STR, 5, '''
        invoke-static {p1}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
        move-result-object v1
        new-instance v0, Landroid/content/Intent;
        const-string v2, "android.intent.action.VIEW"
        invoke-direct {v0, v2, v1}, Landroid/content/Intent;-><init>(Ljava/lang/String;Landroid/net/Uri;)V
        const/high16 v1, 0x10000000
        invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
        invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V
        const-string v1, "1"
        return-object v1
    ''')

    main.method('apps', [], STR, 10, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v0
        new-instance v1, Landroid/content/Intent;
        const-string v2, "android.intent.action.MAIN"
        invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
        const-string v2, "android.intent.category.LAUNCHER"
        invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
        const/4 v2, 0
        invoke-virtual {v0, v1, v2}, Landroid/content/pm/PackageManager;->queryIntentActivities(Landroid/content/Intent;I)Ljava/util/List;
        move-result-object v1
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        invoke-interface {v1}, Ljava/util/List;->size()I
        move-result v3
        const/4 v4, 0
        :loop
        if-ge v4, v3, :done
        invoke-interface {v1, v4}, Ljava/util/List;->get(I)Ljava/lang/Object;
        move-result-object v5
        check-cast v5, Landroid/content/pm/ResolveInfo;
        new-instance v6, Lorg/json/JSONObject;
        invoke-direct {v6}, Lorg/json/JSONObject;-><init>()V
        iget-object v7, v5, Landroid/content/pm/ResolveInfo;->activityInfo:Landroid/content/pm/ActivityInfo;
        iget-object v7, v7, Landroid/content/pm/PackageItemInfo;->packageName:Ljava/lang/String;
        const-string v8, "p"
        invoke-virtual {v6, v8, v7}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        iget-object v7, v5, Landroid/content/pm/ResolveInfo;->activityInfo:Landroid/content/pm/ActivityInfo;
        iget-object v7, v7, Landroid/content/pm/PackageItemInfo;->name:Ljava/lang/String;
        const-string v8, "c"
        invoke-virtual {v6, v8, v7}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v5, v0}, Landroid/content/pm/ResolveInfo;->loadLabel(Landroid/content/pm/PackageManager;)Ljava/lang/CharSequence;
        move-result-object v7
        invoke-static {v7}, Ljava/lang/String;->valueOf(Ljava/lang/Object;)Ljava/lang/String;
        move-result-object v7
        const-string v8, "l"
        invoke-virtual {v6, v8, v7}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v2, v6}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        add-int/lit8 v4, v4, 1
        goto :loop
        :done
        invoke-virtual {v2}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    main.method('icon', [STR], STR, 8, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v0
        invoke-virtual {v0, p1}, Landroid/content/pm/PackageManager;->getApplicationIcon(Ljava/lang/String;)Landroid/graphics/drawable/Drawable;
        move-result-object v0
        const/16 v1, 96
        sget-object v2, Landroid/graphics/Bitmap$Config;->ARGB_8888:Landroid/graphics/Bitmap$Config;
        invoke-static {v1, v1, v2}, Landroid/graphics/Bitmap;->createBitmap(IILandroid/graphics/Bitmap$Config;)Landroid/graphics/Bitmap;
        move-result-object v2
        new-instance v3, Landroid/graphics/Canvas;
        invoke-direct {v3, v2}, Landroid/graphics/Canvas;-><init>(Landroid/graphics/Bitmap;)V
        const/4 v4, 0
        invoke-virtual {v0, v4, v4, v1, v1}, Landroid/graphics/drawable/Drawable;->setBounds(IIII)V
        invoke-virtual {v0, v3}, Landroid/graphics/drawable/Drawable;->draw(Landroid/graphics/Canvas;)V
        new-instance v3, Ljava/io/ByteArrayOutputStream;
        invoke-direct {v3}, Ljava/io/ByteArrayOutputStream;-><init>()V
        sget-object v4, Landroid/graphics/Bitmap$CompressFormat;->PNG:Landroid/graphics/Bitmap$CompressFormat;
        const/16 v5, 100
        invoke-virtual {v2, v4, v5, v3}, Landroid/graphics/Bitmap;->compress(Landroid/graphics/Bitmap$CompressFormat;ILjava/io/OutputStream;)Z
        invoke-virtual {v3}, Ljava/io/ByteArrayOutputStream;->toByteArray()[B
        move-result-object v3
        const/4 v4, 2
        invoke-static {v3, v4}, Landroid/util/Base64;->encodeToString([BI)Ljava/lang/String;
        move-result-object v3
        return-object v3
    ''')

    main.method('wifi', [STR], STR, 6, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getApplicationContext()Landroid/content/Context;
        move-result-object v0
        const-string v1, "wifi"
        invoke-virtual {v0, v1}, Landroid/content/Context;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/net/wifi/WifiManager;
        const-string v1, "on"
        invoke-virtual {v1, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v1
        if-eqz v1, :n1
        const/4 v1, 1
        invoke-virtual {v0, v1}, Landroid/net/wifi/WifiManager;->setWifiEnabled(Z)Z
        :n1
        const-string v1, "off"
        invoke-virtual {v1, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v1
        if-eqz v1, :n2
        const/4 v1, 0
        invoke-virtual {v0, v1}, Landroid/net/wifi/WifiManager;->setWifiEnabled(Z)Z
        :n2
        new-instance v1, Lorg/json/JSONObject;
        invoke-direct {v1}, Lorg/json/JSONObject;-><init>()V
        const-string v2, "on"
        invoke-virtual {v0}, Landroid/net/wifi/WifiManager;->isWifiEnabled()Z
        move-result v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;
        invoke-virtual {v0}, Landroid/net/wifi/WifiManager;->getConnectionInfo()Landroid/net/wifi/WifiInfo;
        move-result-object v0
        if-eqz v0, :n3
        const-string v2, "ssid"
        invoke-virtual {v0}, Landroid/net/wifi/WifiInfo;->getSSID()Ljava/lang/String;
        move-result-object v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v2, "rssi"
        invoke-virtual {v0}, Landroid/net/wifi/WifiInfo;->getRssi()I
        move-result v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        :n3
        invoke-virtual {v1}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    main.method('bt', [STR], STR, 7, '''
        invoke-static {}, Landroid/bluetooth/BluetoothAdapter;->getDefaultAdapter()Landroid/bluetooth/BluetoothAdapter;
        move-result-object v0
        new-instance v1, Lorg/json/JSONObject;
        invoke-direct {v1}, Lorg/json/JSONObject;-><init>()V
        if-nez v0, :has
        const-string v2, "none"
        const/4 v3, 1
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;
        invoke-virtual {v1}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :has
        const-string v2, "on"
        invoke-virtual {v2, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v2
        if-eqz v2, :b1
        invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->enable()Z
        :b1
        const-string v2, "off"
        invoke-virtual {v2, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v2
        if-eqz v2, :b2
        invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->disable()Z
        :b2
        const-string v2, "on"
        invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->isEnabled()Z
        move-result v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;
        const-string v2, "a2dp"
        const/4 v3, 2
        invoke-virtual {v0, v3}, Landroid/bluetooth/BluetoothAdapter;->getProfileConnectionState(I)I
        move-result v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v2, "hfp"
        const/4 v3, 1
        invoke-virtual {v0, v3}, Landroid/bluetooth/BluetoothAdapter;->getProfileConnectionState(I)I
        move-result v3
        invoke-virtual {v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->getBondedDevices()Ljava/util/Set;
        move-result-object v3
        if-eqz v3, :b4
        invoke-interface {v3}, Ljava/util/Set;->iterator()Ljava/util/Iterator;
        move-result-object v3
        :b3
        invoke-interface {v3}, Ljava/util/Iterator;->hasNext()Z
        move-result v4
        if-eqz v4, :b4
        invoke-interface {v3}, Ljava/util/Iterator;->next()Ljava/lang/Object;
        move-result-object v4
        check-cast v4, Landroid/bluetooth/BluetoothDevice;
        invoke-virtual {v4}, Landroid/bluetooth/BluetoothDevice;->getName()Ljava/lang/String;
        move-result-object v4
        invoke-static {v4}, Ljava/lang/String;->valueOf(Ljava/lang/Object;)Ljava/lang/String;
        move-result-object v4
        invoke-virtual {v2, v4}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        goto :b3
        :b4
        const-string v4, "dev"
        invoke-virtual {v1, v4, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v1}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    main.method('tts', [STR], STR, 5, '''
        iget-object v0, p0, Lcom/carnav/camry/Main;->tts:Landroid/speech/tts/TextToSpeech;
        if-nez v0, :ready
        new-instance v0, Landroid/speech/tts/TextToSpeech;
        invoke-direct {v0, p0, p0}, Landroid/speech/tts/TextToSpeech;-><init>(Landroid/content/Context;Landroid/speech/tts/TextToSpeech$OnInitListener;)V
        iput-object v0, p0, Lcom/carnav/camry/Main;->tts:Landroid/speech/tts/TextToSpeech;
        const-string v0, "init"
        return-object v0
        :ready
        new-instance v1, Ljava/util/Locale;
        const-string v2, "ar"
        invoke-direct {v1, v2}, Ljava/util/Locale;-><init>(Ljava/lang/String;)V
        invoke-virtual {v0, v1}, Landroid/speech/tts/TextToSpeech;->setLanguage(Ljava/util/Locale;)I
        const/4 v1, 0
        const/4 v2, 0
        invoke-virtual {v0, p1, v1, v2}, Landroid/speech/tts/TextToSpeech;->speak(Ljava/lang/String;ILjava/util/HashMap;)I
        const-string v0, "1"
        return-object v0
    ''')

    main.method('vol', [STR], STR, 6, '''
        const-string v0, "audio"
        invoke-virtual {p0, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/media/AudioManager;
        const/4 v1, -1
        const-string v2, "up"
        invoke-virtual {v2, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v2
        if-eqz v2, :go
        const/4 v1, 1
        :go
        const/4 v2, 3
        const/4 v3, 1
        invoke-virtual {v0, v2, v1, v3}, Landroid/media/AudioManager;->adjustStreamVolume(III)V
        const-string v0, "1"
        return-object v0
    ''')

    main.method('key', [STR], STR, 6, '''
        invoke-static {p1}, Ljava/lang/Integer;->parseInt(Ljava/lang/String;)I
        move-result v1
        const-string v0, "audio"
        invoke-virtual {p0, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/media/AudioManager;
        new-instance v2, Landroid/view/KeyEvent;
        const/4 v3, 0
        invoke-direct {v2, v3, v1}, Landroid/view/KeyEvent;-><init>(II)V
        invoke-virtual {v0, v2}, Landroid/media/AudioManager;->dispatchMediaKeyEvent(Landroid/view/KeyEvent;)V
        new-instance v2, Landroid/view/KeyEvent;
        const/4 v3, 1
        invoke-direct {v2, v3, v1}, Landroid/view/KeyEvent;-><init>(II)V
        invoke-virtual {v0, v2}, Landroid/media/AudioManager;->dispatchMediaKeyEvent(Landroid/view/KeyEvent;)V
        const-string v0, "1"
        return-object v0
    ''')

    main.method('full', [STR], STR, 5, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
        move-result-object v0
        invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
        move-result-object v1
        const-string v2, "1"
        invoke-virtual {v2, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v2
        if-eqz v2, :off
        const/16 v2, 0x1706
        invoke-virtual {v1, v2}, Landroid/view/View;->setSystemUiVisibility(I)V
        const/16 v2, 0x400
        invoke-virtual {v0, v2}, Landroid/view/Window;->addFlags(I)V
        goto :end
        :off
        const/4 v2, 0
        invoke-virtual {v1, v2}, Landroid/view/View;->setSystemUiVisibility(I)V
        const/16 v2, 0x400
        invoke-virtual {v0, v2}, Landroid/view/Window;->clearFlags(I)V
        :end
        const-string v0, "1"
        return-object v0
    ''')

    # back key with nothing left to close: keep running in the background (GPS/trip continue)
    main.method('home', [STR], STR, 3, '''
        const/4 v0, 1
        invoke-virtual {p0, v0}, Landroid/app/Activity;->moveTaskToBack(Z)Z
        const-string v0, "1"
        return-object v0
    ''')

    # result of the image picker opened for <input type=file> (logo image)
    main.method('onActivityResult', ['I', 'I', 'Landroid/content/Intent;'], 'V', 7, '''
        const/16 v0, 7
        if-ne p1, v0, :done
        iget-object v0, p0, Lcom/carnav/camry/Main;->fc:Landroid/webkit/ValueCallback;
        if-eqz v0, :done
        const/4 v1, 0
        :try_start
        invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
        move-result-object v1
        :try_end
        :join
        invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
        const/4 v1, 0
        iput-object v1, p0, Lcom/carnav/camry/Main;->fc:Landroid/webkit/ValueCallback;
        :done
        return-void
        :handler
        move-exception v2
        const/4 v1, 0
        goto :join
        .catchall {:try_start .. :try_end} :handler
    ''')

    main.method('sys', [STR], STR, 4, '''
        invoke-static {}, Lcom/carnav/camry/Sys;->info()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    main.method('net', [STR], STR, 3, '''
        invoke-static {p0}, Lcom/carnav/camry/Sys;->net(Landroid/app/Activity;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')
    # street-map tile cache: "size" | "prune" (drop tiles older than 29 days) | "clear"
    main.method('cache', [STR], STR, 3, '''
        invoke-static {p0, p1}, Lcom/carnav/camry/Sys;->cache(Landroid/app/Activity;Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    # one directory of the storage / USB drive, for the stories library: [{n: name, d: isDir, s: size}] or "" if unreadable
    main.method('ls', [STR], STR, 3, '''
        invoke-static {p1}, Lcom/carnav/camry/Sys;->ls(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')
    # storage permission: "1" granted, "0" not ("ask" also shows the system prompt; the answer arrives as onPerm())
    main.method('perm', [STR], STR, 5, '''
        sget v0, Landroid/os/Build$VERSION;->SDK_INT:I
        const/16 v1, 23
        if-lt v0, v1, :yes
        const-string v1, "android.permission.READ_EXTERNAL_STORAGE"
        invoke-virtual {p0, v1}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I
        move-result v0
        if-eqz v0, :yes
        const-string v0, "ask"
        invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v0
        if-eqz v0, :no
        const/4 v0, 1
        new-array v0, v0, [Ljava/lang/String;
        const/4 v2, 0
        aput-object v1, v0, v2
        const/4 v2, 2
        invoke-virtual {p0, v0, v2}, Landroid/app/Activity;->requestPermissions([Ljava/lang/String;I)V
        :no
        const-string v0, "0"
        return-object v0
        :yes
        const-string v0, "1"
        return-object v0
    ''')

    # device temperature for the fan/cooling panel (see Sys)
    main.method('temp', [STR], STR, 3, '''
        invoke-static {p0}, Lcom/carnav/camry/Sys;->temp(Landroid/app/Activity;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    # strings inside another app's code (its broadcast actions, device paths, tyre keys) — for «فحص الحساس»
    main.method('dexscan', [STR], STR, 3, '''
        invoke-static {p1}, Lcom/carnav/camry/Sys;->dexscan(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    # listen for broadcasts: arg = JSON array of actions ("" stops); each one arrives as window.onBcast({a, x})
    main.method('listen', [STR], STR, 8, '''
        :try_start
        iget-object v0, p0, Lcom/carnav/camry/Main;->rcv:Lcom/carnav/camry/Rcv;
        if-eqz v0, :fresh
        invoke-virtual {p0, v0}, Landroid/app/Activity;->unregisterReceiver(Landroid/content/BroadcastReceiver;)V
        const/4 v0, 0
        iput-object v0, p0, Lcom/carnav/camry/Main;->rcv:Lcom/carnav/camry/Rcv;
        :fresh
        invoke-virtual {p1}, Ljava/lang/String;->length()I
        move-result v0
        if-eqz v0, :stopped
        new-instance v0, Lorg/json/JSONArray;
        invoke-direct {v0, p1}, Lorg/json/JSONArray;-><init>(Ljava/lang/String;)V
        new-instance v1, Landroid/content/IntentFilter;
        invoke-direct {v1}, Landroid/content/IntentFilter;-><init>()V
        invoke-virtual {v0}, Lorg/json/JSONArray;->length()I
        move-result v2
        const/4 v3, 0
        :loop
        if-ge v3, v2, :reg
        invoke-virtual {v0, v3}, Lorg/json/JSONArray;->getString(I)Ljava/lang/String;
        move-result-object v4
        invoke-virtual {v1, v4}, Landroid/content/IntentFilter;->addAction(Ljava/lang/String;)V
        add-int/lit8 v3, v3, 1
        goto :loop
        :reg
        new-instance v4, Lcom/carnav/camry/Rcv;
        invoke-direct {v4, p0}, Lcom/carnav/camry/Rcv;-><init>(Lcom/carnav/camry/Main;)V
        iput-object v4, p0, Lcom/carnav/camry/Main;->rcv:Lcom/carnav/camry/Rcv;
        invoke-virtual {p0, v4, v1}, Landroid/app/Activity;->registerReceiver(Landroid/content/BroadcastReceiver;Landroid/content/IntentFilter;)Landroid/content/Intent;
        move-result-object v5
        if-eqz v5, :ok
        invoke-virtual {v4, p0, v5}, Lcom/carnav/camry/Rcv;->onReceive(Landroid/content/Context;Landroid/content/Intent;)V
        :ok
        invoke-static {v2}, Ljava/lang/String;->valueOf(I)Ljava/lang/String;
        move-result-object v0
        return-object v0
        :stopped
        const-string v0, "0"
        return-object v0
        :try_end
        :handler
        move-exception v0
        invoke-virtual {v0}, Ljava/lang/Throwable;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''')

    # tyre-sensor check: USB devices on the head unit, one app's components, and settings keys about tyres
    # fixed, read-only shell commands for the car-data check — the WebView can only pick one of these three
    for name, cmd in (('props', 'getprop'), ('services', 'service list'), ('devs', 'ls -l /dev')):
        main.method(name, [], STR, 3, '''
        const-string v0, "%s"
        invoke-static {v0}, Lcom/carnav/camry/Sys;->exec(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''' % cmd)

    # every installed package, hidden system ones included (no launcher icon): [{p, l, s: source APK, f: flags, e: enabled}]
    main.method('pkgs', [], STR, 11, '''
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v0
        const/16 v1, 0x2200
        invoke-virtual {v0, v1}, Landroid/content/pm/PackageManager;->getInstalledPackages(I)Ljava/util/List;
        move-result-object v1
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        invoke-interface {v1}, Ljava/util/List;->size()I
        move-result v3
        const/4 v4, 0
        :loop
        if-ge v4, v3, :done
        invoke-interface {v1, v4}, Ljava/util/List;->get(I)Ljava/lang/Object;
        move-result-object v5
        check-cast v5, Landroid/content/pm/PackageInfo;
        new-instance v6, Lorg/json/JSONObject;
        invoke-direct {v6}, Lorg/json/JSONObject;-><init>()V
        iget-object v7, v5, Landroid/content/pm/PackageInfo;->packageName:Ljava/lang/String;
        const-string v8, "p"
        invoke-virtual {v6, v8, v7}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        iget-object v7, v5, Landroid/content/pm/PackageInfo;->applicationInfo:Landroid/content/pm/ApplicationInfo;
        if-eqz v7, :put
        iget-object v8, v7, Landroid/content/pm/ApplicationInfo;->sourceDir:Ljava/lang/String;
        const-string v9, "s"
        invoke-virtual {v6, v9, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        iget v8, v7, Landroid/content/pm/ApplicationInfo;->flags:I
        const-string v9, "f"
        invoke-virtual {v6, v9, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        iget-boolean v8, v7, Landroid/content/pm/ApplicationInfo;->enabled:Z
        const-string v9, "e"
        invoke-virtual {v6, v9, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;
        invoke-virtual {v0, v7}, Landroid/content/pm/PackageManager;->getApplicationLabel(Landroid/content/pm/ApplicationInfo;)Ljava/lang/CharSequence;
        move-result-object v8
        invoke-static {v8}, Ljava/lang/String;->valueOf(Ljava/lang/Object;)Ljava/lang/String;
        move-result-object v8
        const-string v9, "l"
        invoke-virtual {v6, v9, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :put
        invoke-virtual {v2, v6}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        add-int/lit8 v4, v4, 1
        goto :loop
        :done
        invoke-virtual {v2}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    main.method('probe', [STR], STR, 3, '''
        invoke-static {p0, p1}, Lcom/carnav/camry/Sys;->probe(Landroid/app/Activity;Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''')

    chrome = ClassDef(CHROME, 'Landroid/webkit/WebChromeClient;')
    chrome.field('a', MAIN)
    chrome.method('<init>', [MAIN], 'V', 2, '''
        invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
        iput-object p1, p0, Lcom/carnav/camry/Chrome;->a:Lcom/carnav/camry/Main;
        return-void
    ''')
    chrome.method('onGeolocationPermissionsShowPrompt',
                  [STR, 'Landroid/webkit/GeolocationPermissions$Callback;'], 'V', 5, '''
        const/4 v0, 1
        const/4 v1, 0
        invoke-interface {p2, p1, v0, v1}, Landroid/webkit/GeolocationPermissions$Callback;->invoke(Ljava/lang/String;ZZ)V
        return-void
    ''')
    chrome.method('onJsPrompt', ['Landroid/webkit/WebView;', STR, STR, STR, 'Landroid/webkit/JsPromptResult;'],
                  'Z', 8, '''
        :try_start
        iget-object v0, p0, Lcom/carnav/camry/Chrome;->a:Lcom/carnav/camry/Main;
        invoke-virtual {v0, p3, p4}, Lcom/carnav/camry/Main;->handle(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
        move-result-object v0
        :try_end
        :join
        invoke-virtual {p5, v0}, Landroid/webkit/JsPromptResult;->confirm(Ljava/lang/String;)V
        const/4 v0, 1
        return v0
        :handler
        move-exception v1
        const-string v0, "ERR"
        goto :join
        .catchall {:try_start .. :try_end} :handler
    ''')
    chrome.method('onShowFileChooser', ['Landroid/webkit/WebView;', 'Landroid/webkit/ValueCallback;',
                                        'Landroid/webkit/WebChromeClient$FileChooserParams;'], 'Z', 8, '''
        iget-object v0, p0, Lcom/carnav/camry/Chrome;->a:Lcom/carnav/camry/Main;
        iget-object v1, v0, Lcom/carnav/camry/Main;->fc:Landroid/webkit/ValueCallback;
        if-eqz v1, :fresh
        const/4 v2, 0
        invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
        :fresh
        iput-object p2, v0, Lcom/carnav/camry/Main;->fc:Landroid/webkit/ValueCallback;
        :try_start
        new-instance v1, Landroid/content/Intent;
        const-string v2, "android.intent.action.GET_CONTENT"
        invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
        const-string v2, "android.intent.category.OPENABLE"
        invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
        const-string v2, "image/*"
        invoke-virtual {v1, v2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;
        const/4 v2, 0
        invoke-static {v1, v2}, Landroid/content/Intent;->createChooser(Landroid/content/Intent;Ljava/lang/CharSequence;)Landroid/content/Intent;
        move-result-object v1
        const/4 v2, 7
        invoke-virtual {v0, v1, v2}, Landroid/app/Activity;->startActivityForResult(Landroid/content/Intent;I)V
        :try_end
        const/4 v0, 1
        return v0
        :handler
        move-exception v1
        const/4 v1, 0
        iput-object v1, v0, Lcom/carnav/camry/Main;->fc:Landroid/webkit/ValueCallback;
        invoke-interface {p2, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
        const/4 v0, 1
        return v0
        .catchall {:try_start .. :try_end} :handler
    ''')
    # ---- Sys: static helpers kept apart so newer-API references stay out of Main ----
    sys_ = ClassDef(SYS, 'Ljava/lang/Object;')
    sys_.method('readText', [STR], STR, 3, '''
        :try_start
        new-instance v1, Ljava/io/FileReader;
        invoke-direct {v1, p0}, Ljava/io/FileReader;-><init>(Ljava/lang/String;)V
        new-instance v0, Ljava/io/BufferedReader;
        invoke-direct {v0, v1}, Ljava/io/BufferedReader;-><init>(Ljava/io/Reader;)V
        invoke-virtual {v0}, Ljava/io/BufferedReader;->readLine()Ljava/lang/String;
        move-result-object v1
        invoke-virtual {v0}, Ljava/io/BufferedReader;->close()V
        :try_end
        return-object v1
        :handler
        move-exception v0
        const/4 v0, 0
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)
    # {"z":[{"t":type,"v":"52000"},...], "b": battery tenths of degC, "s": PowerManager thermal status}
    sys_.method('temp', ['Landroid/app/Activity;'], STR, 9, '''
        new-instance v0, Lorg/json/JSONObject;
        invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V
        new-instance v1, Lorg/json/JSONArray;
        invoke-direct {v1}, Lorg/json/JSONArray;-><init>()V
        const/4 v2, 0
        :loop
        const/16 v3, 32
        if-ge v2, v3, :zdone
        const-string v4, "/sys/class/thermal/thermal_zone"
        new-instance v3, Ljava/lang/StringBuilder;
        invoke-direct {v3, v4}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
        invoke-virtual {v3, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;
        invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v3
        const-string v4, "/temp"
        invoke-virtual {v3, v4}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v4
        invoke-static {v4}, Lcom/carnav/camry/Sys;->readText(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v4
        if-eqz v4, :zdone
        const-string v5, "/type"
        invoke-virtual {v3, v5}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v5
        invoke-static {v5}, Lcom/carnav/camry/Sys;->readText(Ljava/lang/String;)Ljava/lang/String;
        move-result-object v5
        new-instance v6, Lorg/json/JSONObject;
        invoke-direct {v6}, Lorg/json/JSONObject;-><init>()V
        const-string v7, "t"
        invoke-virtual {v6, v7, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v7, "v"
        invoke-virtual {v6, v7, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v1, v6}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        :next
        add-int/lit8 v2, v2, 1
        goto :loop
        :zdone
        const-string v3, "z"
        invoke-virtual {v0, v3, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :b_start
        const-string v4, "android.intent.action.BATTERY_CHANGED"
        new-instance v3, Landroid/content/IntentFilter;
        invoke-direct {v3, v4}, Landroid/content/IntentFilter;-><init>(Ljava/lang/String;)V
        const/4 v4, 0
        invoke-virtual {p0, v4, v3}, Landroid/app/Activity;->registerReceiver(Landroid/content/BroadcastReceiver;Landroid/content/IntentFilter;)Landroid/content/Intent;
        move-result-object v3
        if-eqz v3, :b_end
        const-string v4, "temperature"
        const/4 v5, -1
        invoke-virtual {v3, v4, v5}, Landroid/content/Intent;->getIntExtra(Ljava/lang/String;I)I
        move-result v5
        const-string v4, "b"
        invoke-virtual {v0, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        :b_end
        :s_start
        const-string v3, "power"
        invoke-virtual {p0, v3}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v3
        check-cast v3, Landroid/os/PowerManager;
        invoke-virtual {v3}, Landroid/os/PowerManager;->getCurrentThermalStatus()I
        move-result v4
        const-string v5, "s"
        invoke-virtual {v0, v5, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        :s_end
        invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :b_handler
        move-exception v3
        goto :s_start
        :s_handler
        move-exception v3
        goto :s_end
        .catchall {:b_start .. :b_end} :b_handler
        .catchall {:s_start .. :s_end} :s_handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)
    sys_.method('info', [], STR, 4, '''
        new-instance v0, Lorg/json/JSONObject;
        invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V
        :try_start
        const-string v1, "sdk"
        sget v2, Landroid/os/Build$VERSION;->SDK_INT:I
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v1, "release"
        sget-object v2, Landroid/os/Build$VERSION;->RELEASE:Ljava/lang/String;
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v1, "model"
        sget-object v2, Landroid/os/Build;->MODEL:Ljava/lang/String;
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v1, "maker"
        sget-object v2, Landroid/os/Build;->MANUFACTURER:Ljava/lang/String;
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v1, "board"
        sget-object v2, Landroid/os/Build;->BOARD:Ljava/lang/String;
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v1, "device"
        sget-object v2, Landroid/os/Build;->DEVICE:Ljava/lang/String;
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :try_end
        :out
        invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :handler
        move-exception v1
        goto :out
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)
    UA_TILES = 'Rihla/2.3 (Android car head unit)'
    CUT = '-1252800000'          # 14.5 days, applied twice -> tiles live at most 29 days (CARTO allows 30)

    sys_.method('cutoff', [], 'J', 3, '''
        new-instance v0, Ljava/util/concurrent/atomic/AtomicLong;
        invoke-static {}, Ljava/lang/System;->currentTimeMillis()J
        move-result-wide v1
        invoke-direct {v0, v1, v2}, Ljava/util/concurrent/atomic/AtomicLong;-><init>(J)V
        const-wide/32 v1, %s
        invoke-virtual {v0, v1, v2}, Ljava/util/concurrent/atomic/AtomicLong;->addAndGet(J)J
        invoke-virtual {v0, v1, v2}, Ljava/util/concurrent/atomic/AtomicLong;->addAndGet(J)J
        move-result-wide v1
        return-wide v1
    ''' % CUT, flags=ACC_PUBLIC | ACC_STATIC)

    # download url -> file (via a temp file, renamed when complete); true on success
    sys_.method('fetch', [STR, 'Ljava/io/File;'], 'Z', 9, '''
        :try_start
        new-instance v0, Ljava/net/URL;
        invoke-direct {v0, p0}, Ljava/net/URL;-><init>(Ljava/lang/String;)V
        invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;
        move-result-object v0
        check-cast v0, Ljava/net/HttpURLConnection;
        const/16 v1, 6000
        invoke-virtual {v0, v1}, Ljava/net/URLConnection;->setConnectTimeout(I)V
        const/16 v1, 12000
        invoke-virtual {v0, v1}, Ljava/net/URLConnection;->setReadTimeout(I)V
        const-string v1, "User-Agent"
        const-string v2, "%s"
        invoke-virtual {v0, v1, v2}, Ljava/net/URLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V
        invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getResponseCode()I
        move-result v1
        const/16 v2, 200
        if-ne v1, v2, :bad
        invoke-virtual {v0}, Ljava/net/URLConnection;->getInputStream()Ljava/io/InputStream;
        move-result-object v2
        invoke-virtual {p1}, Ljava/io/File;->getParentFile()Ljava/io/File;
        move-result-object v1
        invoke-virtual {v1}, Ljava/io/File;->mkdirs()Z
        new-instance v1, Ljava/lang/StringBuilder;
        invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V
        invoke-virtual {p1}, Ljava/io/File;->getPath()Ljava/lang/String;
        move-result-object v3
        invoke-virtual {v1, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const-string v3, ".part"
        invoke-virtual {v1, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-static {}, Ljava/lang/Thread;->currentThread()Ljava/lang/Thread;
        move-result-object v3
        invoke-virtual {v3}, Ljava/lang/Thread;->getId()J
        move-result-wide v4
        invoke-virtual {v1, v4, v5}, Ljava/lang/StringBuilder;->append(J)Ljava/lang/StringBuilder;
        invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v3
        new-instance v1, Ljava/io/File;
        invoke-direct {v1, v3}, Ljava/io/File;-><init>(Ljava/lang/String;)V
        new-instance v3, Ljava/io/FileOutputStream;
        invoke-direct {v3, v1}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
        const/16 v4, 16384
        new-array v4, v4, [B
        :loop
        invoke-virtual {v2, v4}, Ljava/io/InputStream;->read([B)I
        move-result v5
        if-lez v5, :eof
        const/4 v6, 0
        invoke-virtual {v3, v4, v6, v5}, Ljava/io/FileOutputStream;->write([BII)V
        goto :loop
        :eof
        invoke-virtual {v3}, Ljava/io/FileOutputStream;->close()V
        invoke-virtual {v2}, Ljava/io/InputStream;->close()V
        invoke-virtual {v0}, Ljava/net/HttpURLConnection;->disconnect()V
        invoke-virtual {v1, p1}, Ljava/io/File;->renameTo(Ljava/io/File;)Z
        move-result v0
        return v0
        :bad
        invoke-virtual {v0}, Ljava/net/HttpURLConnection;->disconnect()V
        :try_end
        const/4 v0, 0
        return v0
        :handler
        move-exception v0
        const/4 v0, 0
        return v0
        .catchall {:try_start .. :try_end} :handler
    ''' % UA_TILES, flags=ACC_PUBLIC | ACC_STATIC)

    sys_.method('serve', ['Ljava/io/File;'], 'Landroid/webkit/WebResourceResponse;', 11, '''
        new-instance v0, Ljava/util/HashMap;
        invoke-direct {v0}, Ljava/util/HashMap;-><init>()V
        const-string v1, "Access-Control-Allow-Origin"
        const-string v2, "*"
        invoke-virtual {v0, v1, v2}, Ljava/util/HashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
        const-string v1, "Cache-Control"
        const-string v2, "max-age=86400"
        invoke-virtual {v0, v1, v2}, Ljava/util/HashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
        new-instance v3, Landroid/webkit/WebResourceResponse;
        const-string v4, "image/png"
        const/4 v5, 0
        const/16 v6, 200
        const-string v7, "OK"
        move-object v8, v0
        new-instance v9, Ljava/io/FileInputStream;
        invoke-direct {v9, p0}, Ljava/io/FileInputStream;-><init>(Ljava/io/File;)V
        invoke-direct/range {v3 .. v9}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;Ljava/util/Map;Ljava/io/InputStream;)V
        return-object v3
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # empty 404: the page then shows the built-in Kingdom map at once instead of waiting
    sys_.method('miss', [], 'Landroid/webkit/WebResourceResponse;', 9, '''
        new-instance v0, Ljava/util/HashMap;
        invoke-direct {v0}, Ljava/util/HashMap;-><init>()V
        const-string v1, "Access-Control-Allow-Origin"
        const-string v2, "*"
        invoke-virtual {v0, v1, v2}, Ljava/util/HashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
        new-instance v1, Landroid/webkit/WebResourceResponse;
        const-string v2, "image/png"
        const/4 v3, 0
        const/16 v4, 404
        const-string v5, "Not cached"
        move-object v6, v0
        new-instance v7, Ljava/io/ByteArrayInputStream;
        const/4 v8, 0
        new-array v8, v8, [B
        invoke-direct {v7, v8}, Ljava/io/ByteArrayInputStream;-><init>([B)V
        invoke-direct/range {v1 .. v7}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;Ljava/util/Map;Ljava/io/InputStream;)V
        return-object v1
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # recursive size / prune of the tile folder
    sys_.method('walk', ['Ljava/io/File;', 'Ljava/util/concurrent/atomic/AtomicLong;',
                         'Ljava/util/concurrent/atomic/AtomicInteger;', 'J', 'Z'], 'V', 15, '''
        invoke-virtual {p0}, Ljava/io/File;->listFiles()[Ljava/io/File;
        move-result-object v0
        if-eqz v0, :ret
        array-length v1, v0
        const/4 v2, 0
        :loop
        if-ge v2, v1, :ret
        aget-object v3, v0, v2
        invoke-virtual {v3}, Ljava/io/File;->isDirectory()Z
        move-result v4
        if-eqz v4, :file
        move-object v4, p1
        move-object v5, p2
        move-wide v6, p3
        move v8, p5
        invoke-static/range {v3 .. v8}, Lcom/carnav/camry/Sys;->walk(Ljava/io/File;Ljava/util/concurrent/atomic/AtomicLong;Ljava/util/concurrent/atomic/AtomicInteger;JZ)V
        goto :next
        :file
        invoke-virtual {v3}, Ljava/io/File;->lastModified()J
        move-result-wide v4
        if-eqz p5, :count
        invoke-static {v4, v5, p3, p4}, Ljava/lang/Long;->compare(JJ)I
        move-result v6
        if-gez v6, :count
        invoke-virtual {v3}, Ljava/io/File;->delete()Z
        goto :next
        :count
        invoke-virtual {v3}, Ljava/io/File;->length()J
        move-result-wide v4
        invoke-virtual {p1, v4, v5}, Ljava/util/concurrent/atomic/AtomicLong;->addAndGet(J)J
        invoke-virtual {p2}, Ljava/util/concurrent/atomic/AtomicInteger;->incrementAndGet()I
        :next
        add-int/lit8 v2, v2, 1
        goto :loop
        :ret
        return-void
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    sys_.method('cache', ['Landroid/app/Activity;', STR], STR, 11, '''
        new-instance v0, Ljava/io/File;
        invoke-virtual {p0}, Landroid/app/Activity;->getFilesDir()Ljava/io/File;
        move-result-object v1
        const-string v2, "tiles"
        invoke-direct {v0, v1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
        new-instance v4, Ljava/util/concurrent/atomic/AtomicLong;
        invoke-direct {v4}, Ljava/util/concurrent/atomic/AtomicLong;-><init>()V
        new-instance v5, Ljava/util/concurrent/atomic/AtomicInteger;
        invoke-direct {v5}, Ljava/util/concurrent/atomic/AtomicInteger;-><init>()V
        move-object v3, v0
        const-wide/16 v6, 0
        const/4 v8, 0
        const-string v1, "clear"
        invoke-virtual {v1, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v1
        if-eqz v1, :np
        sget-wide v6, Ljava/lang/Long;->MAX_VALUE:J
        const/4 v8, 1
        goto :go
        :np
        const-string v1, "prune"
        invoke-virtual {v1, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v1
        if-eqz v1, :go
        invoke-static {}, Lcom/carnav/camry/Sys;->cutoff()J
        move-result-wide v6
        const/4 v8, 1
        :go
        invoke-static/range {v3 .. v8}, Lcom/carnav/camry/Sys;->walk(Ljava/io/File;Ljava/util/concurrent/atomic/AtomicLong;Ljava/util/concurrent/atomic/AtomicInteger;JZ)V
        new-instance v0, Lorg/json/JSONObject;
        invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V
        const-string v1, "n"
        invoke-virtual {v5}, Ljava/util/concurrent/atomic/AtomicInteger;->get()I
        move-result v2
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v1, "b"
        invoke-virtual {v4}, Ljava/util/concurrent/atomic/AtomicLong;->get()J
        move-result-wide v2
        invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;
        invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # printable runs (6..200 chars) that mention tyres, fuel, actions, devices, car services -> JSON array; read from
    # every *.dex inside an APK, or from a whole file: a precompiled system app keeps its code in oat/<arch>/*.vdex|odex
    sys_.method('dexscan', [STR], STR, 10, '''
        new-instance v0, Ljava/util/LinkedHashSet;
        invoke-direct {v0}, Ljava/util/LinkedHashSet;-><init>()V
        :try_start
        const-string v1, ".apk"
        invoke-virtual {p0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
        move-result v1
        if-nez v1, :zip
        new-instance v1, Ljava/io/FileInputStream;
        invoke-direct {v1, p0}, Ljava/io/FileInputStream;-><init>(Ljava/lang/String;)V
        invoke-static {v1, v0}, Lcom/carnav/camry/Sys;->runs(Ljava/io/InputStream;Ljava/util/Set;)V
        goto :fin2
        :zip
        new-instance v1, Ljava/util/zip/ZipFile;
        invoke-direct {v1, p0}, Ljava/util/zip/ZipFile;-><init>(Ljava/lang/String;)V
        invoke-virtual {v1}, Ljava/util/zip/ZipFile;->entries()Ljava/util/Enumeration;
        move-result-object v2
        :ent
        invoke-interface {v2}, Ljava/util/Enumeration;->hasMoreElements()Z
        move-result v3
        if-eqz v3, :fin
        invoke-interface {v2}, Ljava/util/Enumeration;->nextElement()Ljava/lang/Object;
        move-result-object v3
        check-cast v3, Ljava/util/zip/ZipEntry;
        invoke-virtual {v3}, Ljava/util/zip/ZipEntry;->getName()Ljava/lang/String;
        move-result-object v4
        const-string v5, ".dex"
        invoke-virtual {v4, v5}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
        move-result v5
        if-eqz v5, :ent
        invoke-virtual {v1, v3}, Ljava/util/zip/ZipFile;->getInputStream(Ljava/util/zip/ZipEntry;)Ljava/io/InputStream;
        move-result-object v4
        invoke-static {v4, v0}, Lcom/carnav/camry/Sys;->runs(Ljava/io/InputStream;Ljava/util/Set;)V
        goto :ent
        :fin
        invoke-virtual {v1}, Ljava/util/zip/ZipFile;->close()V
        :fin2
        :try_end
        goto :out
        :handler
        move-exception v1
        :out
        new-instance v1, Lorg/json/JSONArray;
        invoke-direct {v1, v0}, Lorg/json/JSONArray;-><init>(Ljava/util/Collection;)V
        invoke-virtual {v1}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
        move-result-object v1
        return-object v1
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # printable runs of one stream into the set (through keep), then close it
    sys_.method('runs', ['Ljava/io/InputStream;', 'Ljava/util/Set;'], 'V', 8, '''
        new-instance v0, Ljava/io/BufferedInputStream;
        const v1, 0x10000
        invoke-direct {v0, p0, v1}, Ljava/io/BufferedInputStream;-><init>(Ljava/io/InputStream;I)V
        new-instance v1, Ljava/lang/StringBuilder;
        invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V
        :rd
        invoke-virtual {v0}, Ljava/io/BufferedInputStream;->read()I
        move-result v2
        if-ltz v2, :eof
        const/16 v3, 0x20
        if-lt v2, v3, :brk
        const/16 v3, 0x7e
        if-gt v2, v3, :brk
        invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->appendCodePoint(I)Ljava/lang/StringBuilder;
        goto :rd
        :brk
        invoke-static {v1, p1}, Lcom/carnav/camry/Sys;->keep(Ljava/lang/StringBuilder;Ljava/util/Set;)V
        goto :rd
        :eof
        invoke-static {v1, p1}, Lcom/carnav/camry/Sys;->keep(Ljava/lang/StringBuilder;Ljava/util/Set;)V
        invoke-virtual {v0}, Ljava/io/BufferedInputStream;->close()V
        return-void
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # stdout of a fixed shell command, at most 256 KB (Main passes only constants: getprop, service list, ls -l /dev)
    sys_.method('exec', [STR], STR, 9, '''
        new-instance v0, Ljava/lang/StringBuilder;
        invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V
        :try_start
        invoke-static {}, Ljava/lang/Runtime;->getRuntime()Ljava/lang/Runtime;
        move-result-object v1
        invoke-virtual {v1, p0}, Ljava/lang/Runtime;->exec(Ljava/lang/String;)Ljava/lang/Process;
        move-result-object v1
        invoke-virtual {v1}, Ljava/lang/Process;->getInputStream()Ljava/io/InputStream;
        move-result-object v2
        new-instance v3, Ljava/io/BufferedReader;
        new-instance v4, Ljava/io/InputStreamReader;
        invoke-direct {v4, v2}, Ljava/io/InputStreamReader;-><init>(Ljava/io/InputStream;)V
        invoke-direct {v3, v4}, Ljava/io/BufferedReader;-><init>(Ljava/io/Reader;)V
        :loop
        invoke-virtual {v3}, Ljava/io/BufferedReader;->readLine()Ljava/lang/String;
        move-result-object v4
        if-eqz v4, :done
        invoke-virtual {v0}, Ljava/lang/StringBuilder;->length()I
        move-result v5
        const v6, 0x40000
        if-ge v5, v6, :done
        invoke-virtual {v0, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const/16 v5, 0xa
        invoke-virtual {v0, v5}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;
        goto :loop
        :done
        invoke-virtual {v3}, Ljava/io/BufferedReader;->close()V
        invoke-virtual {v1}, Ljava/lang/Process;->destroy()V
        :try_end
        goto :out
        :handler
        move-exception v1
        const-string v2, "error: "
        invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v1}, Ljava/lang/Object;->toString()Ljava/lang/String;
        move-result-object v1
        invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        :out
        invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    sys_.method('keep', ['Ljava/lang/StringBuilder;', 'Ljava/util/Set;'], 'V', 8, '''
        invoke-virtual {p0}, Ljava/lang/StringBuilder;->length()I
        move-result v0
        const/4 v1, 6
        if-lt v0, v1, :clear
        const/16 v1, 200
        if-gt v0, v1, :clear
        invoke-interface {p1}, Ljava/util/Set;->size()I
        move-result v1
        const/16 v2, 8000
        if-ge v1, v2, :clear
        invoke-virtual {p0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v1
        invoke-virtual {v1}, Ljava/lang/String;->toLowerCase()Ljava/lang/String;
        move-result-object v2
        const-string v3, "landroid"
        invoke-virtual {v2, v3}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
        move-result v4
        if-nez v4, :clear
        const-string v3, "lkotlin"
        invoke-virtual {v2, v3}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
        move-result v4
        if-nez v4, :clear
        const-string v3, "tpms"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "tire"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "tyre"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "pressure"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "/dev/"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "action"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "broadcast"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "reglink"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "serial"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "canbus"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "content://"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "fuel"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "consum"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "vehicle"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "mcu"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "canbox"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "carinfo"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "car_info"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "mileage"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "odometer"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "yunovo"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "oil"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "tty"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, "uart"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        const-string v3, ".aidl"
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v4
        if-nez v4, :add
        goto :clear
        :add
        invoke-interface {p1, v1}, Ljava/util/Set;->add(Ljava/lang/Object;)Z
        :clear
        const/4 v0, 0
        invoke-virtual {p0, v0}, Ljava/lang/StringBuilder;->setLength(I)V
        return-void
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # ComponentInfo[] -> ["name [exported] @authority", ...]
    sys_.method('names', ['[Landroid/content/pm/ComponentInfo;'], 'Lorg/json/JSONArray;', 8, '''
        new-instance v0, Lorg/json/JSONArray;
        invoke-direct {v0}, Lorg/json/JSONArray;-><init>()V
        if-eqz p0, :done
        array-length v1, p0
        const/4 v2, 0
        :loop
        if-ge v2, v1, :done
        aget-object v3, p0, v2
        new-instance v4, Ljava/lang/StringBuilder;
        invoke-direct {v4}, Ljava/lang/StringBuilder;-><init>()V
        iget-object v5, v3, Landroid/content/pm/PackageItemInfo;->name:Ljava/lang/String;
        invoke-virtual {v4, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        iget-boolean v5, v3, Landroid/content/pm/ComponentInfo;->exported:Z
        if-eqz v5, :priv
        const-string v5, " [exported]"
        invoke-virtual {v4, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        :priv
        instance-of v5, v3, Landroid/content/pm/ProviderInfo;
        if-eqz v5, :add
        check-cast v3, Landroid/content/pm/ProviderInfo;
        const-string v5, " @"
        invoke-virtual {v4, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        iget-object v5, v3, Landroid/content/pm/ProviderInfo;->authority:Ljava/lang/String;
        invoke-virtual {v4, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        :add
        invoke-virtual {v4}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v5
        invoke-virtual {v0, v5}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        add-int/lit8 v2, v2, 1
        goto :loop
        :done
        return-object v0
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # rows of content://settings/<table> whose key mentions tpms / tire / tyre / press -> "table: key = value"
    sys_.method('scanSettings', ['Landroid/app/Activity;', STR, 'Lorg/json/JSONArray;'], 'V', 12, '''
        :try_start
        invoke-virtual {p0}, Landroid/app/Activity;->getContentResolver()Landroid/content/ContentResolver;
        move-result-object v0
        new-instance v1, Ljava/lang/StringBuilder;
        invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V
        const-string v2, "content://settings/"
        invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v1, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v1
        invoke-static {v1}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
        move-result-object v1
        const/4 v2, 0
        invoke-virtual {v0, v1, v2, v2, v2}, Landroid/content/ContentResolver;->query(Landroid/net/Uri;[Ljava/lang/String;Landroid/os/Bundle;Landroid/os/CancellationSignal;)Landroid/database/Cursor;
        move-result-object v0
        if-eqz v0, :out
        :loop
        invoke-interface {v0}, Landroid/database/Cursor;->moveToNext()Z
        move-result v1
        if-eqz v1, :close
        const-string v1, "name"
        invoke-interface {v0, v1}, Landroid/database/Cursor;->getColumnIndex(Ljava/lang/String;)I
        move-result v1
        if-ltz v1, :close
        invoke-interface {v0, v1}, Landroid/database/Cursor;->getString(I)Ljava/lang/String;
        move-result-object v2
        if-eqz v2, :loop
        invoke-virtual {v2}, Ljava/lang/String;->toLowerCase()Ljava/lang/String;
        move-result-object v3
        const-string v4, "tpms"
        invoke-virtual {v3, v4}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v5
        if-nez v5, :hit
        const-string v4, "tire"
        invoke-virtual {v3, v4}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v5
        if-nez v5, :hit
        const-string v4, "tyre"
        invoke-virtual {v3, v4}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v5
        if-nez v5, :hit
        const-string v4, "press"
        invoke-virtual {v3, v4}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v5
        if-nez v5, :hit
        goto :loop
        :hit
        const-string v4, "value"
        invoke-interface {v0, v4}, Landroid/database/Cursor;->getColumnIndex(Ljava/lang/String;)I
        move-result v4
        new-instance v5, Ljava/lang/StringBuilder;
        invoke-direct {v5}, Ljava/lang/StringBuilder;-><init>()V
        invoke-virtual {v5, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const-string v6, ": "
        invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v5, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const-string v6, " = "
        invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        if-ltz v4, :noval
        invoke-interface {v0, v4}, Landroid/database/Cursor;->getString(I)Ljava/lang/String;
        move-result-object v6
        invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        :noval
        invoke-virtual {v5}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v6
        invoke-virtual {p2, v6}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        goto :loop
        :close
        invoke-interface {v0}, Landroid/database/Cursor;->close()V
        :out
        return-void
        :try_end
        :handler
        move-exception v0
        return-void
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # {"usb":[{n,v,p,c,i,ic,m,pr}], "pk":{p,ver,src,svc,rcv,prv,perm}, "set":["system: key = value"]}
    sys_.method('probe', ['Landroid/app/Activity;', STR], STR, 14, '''
        new-instance v0, Lorg/json/JSONObject;
        invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V
        :u_try
        const-string v1, "usb"
        invoke-virtual {p0, v1}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v1
        check-cast v1, Landroid/hardware/usb/UsbManager;
        invoke-virtual {v1}, Landroid/hardware/usb/UsbManager;->getDeviceList()Ljava/util/HashMap;
        move-result-object v1
        invoke-virtual {v1}, Ljava/util/HashMap;->values()Ljava/util/Collection;
        move-result-object v1
        invoke-interface {v1}, Ljava/util/Collection;->iterator()Ljava/util/Iterator;
        move-result-object v1
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        :u_loop
        invoke-interface {v1}, Ljava/util/Iterator;->hasNext()Z
        move-result v3
        if-eqz v3, :u_done
        invoke-interface {v1}, Ljava/util/Iterator;->next()Ljava/lang/Object;
        move-result-object v3
        check-cast v3, Landroid/hardware/usb/UsbDevice;
        new-instance v4, Lorg/json/JSONObject;
        invoke-direct {v4}, Lorg/json/JSONObject;-><init>()V
        const-string v5, "n"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getDeviceName()Ljava/lang/String;
        move-result-object v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v5, "v"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getVendorId()I
        move-result v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v5, "p"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getProductId()I
        move-result v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v5, "c"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getDeviceClass()I
        move-result v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        const-string v5, "i"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getInterfaceCount()I
        move-result v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        if-eqz v6, :u_names
        const/4 v6, 0
        invoke-virtual {v3, v6}, Landroid/hardware/usb/UsbDevice;->getInterface(I)Landroid/hardware/usb/UsbInterface;
        move-result-object v6
        invoke-virtual {v6}, Landroid/hardware/usb/UsbInterface;->getInterfaceClass()I
        move-result v6
        const-string v5, "ic"
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;
        :u_names
        const-string v5, "m"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getManufacturerName()Ljava/lang/String;
        move-result-object v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v5, "pr"
        invoke-virtual {v3}, Landroid/hardware/usb/UsbDevice;->getProductName()Ljava/lang/String;
        move-result-object v6
        invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v2, v4}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        goto :u_loop
        :u_done
        const-string v5, "usb"
        invoke-virtual {v0, v5, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :u_end
        goto :k_start
        :u_err
        move-exception v1
        :k_start
        invoke-virtual {p1}, Ljava/lang/String;->length()I
        move-result v1
        if-eqz v1, :s_start
        :k_try
        invoke-virtual {p0}, Landroid/app/Activity;->getPackageManager()Landroid/content/pm/PackageManager;
        move-result-object v1
        const/16 v2, 0x100e
        invoke-virtual {v1, p1, v2}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;
        move-result-object v2
        new-instance v3, Lorg/json/JSONObject;
        invoke-direct {v3}, Lorg/json/JSONObject;-><init>()V
        const-string v4, "p"
        invoke-virtual {v3, v4, p1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "ver"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->versionName:Ljava/lang/String;
        invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "src"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->applicationInfo:Landroid/content/pm/ApplicationInfo;
        iget-object v5, v5, Landroid/content/pm/ApplicationInfo;->sourceDir:Ljava/lang/String;
        invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "svc"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->services:[Landroid/content/pm/ServiceInfo;
        check-cast v5, [Landroid/content/pm/ComponentInfo;
        invoke-static {v5}, Lcom/carnav/camry/Sys;->names([Landroid/content/pm/ComponentInfo;)Lorg/json/JSONArray;
        move-result-object v5
        invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "rcv"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->receivers:[Landroid/content/pm/ActivityInfo;
        check-cast v5, [Landroid/content/pm/ComponentInfo;
        invoke-static {v5}, Lcom/carnav/camry/Sys;->names([Landroid/content/pm/ComponentInfo;)Lorg/json/JSONArray;
        move-result-object v5
        invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "prv"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->providers:[Landroid/content/pm/ProviderInfo;
        check-cast v5, [Landroid/content/pm/ComponentInfo;
        invoke-static {v5}, Lcom/carnav/camry/Sys;->names([Landroid/content/pm/ComponentInfo;)Lorg/json/JSONArray;
        move-result-object v5
        invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v4, "perm"
        iget-object v5, v2, Landroid/content/pm/PackageInfo;->requestedPermissions:[Ljava/lang/String;
        if-eqz v5, :k_put
        new-instance v6, Lorg/json/JSONArray;
        invoke-direct {v6, v5}, Lorg/json/JSONArray;-><init>(Ljava/lang/Object;)V
        invoke-virtual {v3, v4, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :k_put
        const-string v4, "pk"
        invoke-virtual {v0, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :k_end
        goto :s_start
        :k_err
        move-exception v1
        :s_start
        new-instance v1, Lorg/json/JSONArray;
        invoke-direct {v1}, Lorg/json/JSONArray;-><init>()V
        const-string v2, "system"
        invoke-static {p0, v2, v1}, Lcom/carnav/camry/Sys;->scanSettings(Landroid/app/Activity;Ljava/lang/String;Lorg/json/JSONArray;)V
        const-string v2, "global"
        invoke-static {p0, v2, v1}, Lcom/carnav/camry/Sys;->scanSettings(Landroid/app/Activity;Ljava/lang/String;Lorg/json/JSONArray;)V
        const-string v2, "secure"
        invoke-static {p0, v2, v1}, Lcom/carnav/camry/Sys;->scanSettings(Landroid/app/Activity;Ljava/lang/String;Lorg/json/JSONArray;)V
        :f_try
        const-string v2, "set"
        invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :f_end
        :f_err
        move-exception v0
        const-string v0, "{}"
        return-object v0
        .catchall {:u_try .. :u_end} :u_err
        .catchall {:k_try .. :k_end} :k_err
        .catchall {:f_try .. :f_end} :f_err
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    sys_.method('ls', [STR], STR, 12, '''
        :try_start
        new-instance v0, Ljava/io/File;
        invoke-direct {v0, p0}, Ljava/io/File;-><init>(Ljava/lang/String;)V
        invoke-virtual {v0}, Ljava/io/File;->listFiles()[Ljava/io/File;
        move-result-object v1
        if-eqz v1, :none
        new-instance v2, Lorg/json/JSONArray;
        invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V
        array-length v3, v1
        const/4 v4, 0
        :loop
        if-ge v4, v3, :out
        aget-object v5, v1, v4
        new-instance v6, Lorg/json/JSONObject;
        invoke-direct {v6}, Lorg/json/JSONObject;-><init>()V
        const-string v7, "n"
        invoke-virtual {v5}, Ljava/io/File;->getName()Ljava/lang/String;
        move-result-object v8
        invoke-virtual {v6, v7, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        const-string v7, "d"
        invoke-virtual {v5}, Ljava/io/File;->isDirectory()Z
        move-result v8
        invoke-virtual {v6, v7, v8}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;
        const-string v7, "s"
        invoke-virtual {v5}, Ljava/io/File;->length()J
        move-result-wide v8
        invoke-virtual {v6, v7, v8, v9}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;
        invoke-virtual {v2, v6}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;
        add-int/lit8 v4, v4, 1
        goto :loop
        :out
        invoke-virtual {v2}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
        move-result-object v0
        return-object v0
        :none
        const-string v0, ""
        return-object v0
        :try_end
        :handler
        move-exception v0
        const-string v0, ""
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    sys_.method('net', ['Landroid/app/Activity;'], STR, 3, '''
        :try_start
        const-string v0, "connectivity"
        invoke-virtual {p0, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/net/ConnectivityManager;
        invoke-virtual {v0}, Landroid/net/ConnectivityManager;->getActiveNetworkInfo()Landroid/net/NetworkInfo;
        move-result-object v0
        if-eqz v0, :off
        invoke-virtual {v0}, Landroid/net/NetworkInfo;->isConnected()Z
        move-result v1
        if-eqz v1, :off
        const-string v0, "1"
        return-object v0
        :off
        const-string v0, "0"
        return-object v0
        :try_end
        :handler
        move-exception v0
        const-string v0, "1"
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''', flags=ACC_PUBLIC | ACC_STATIC)

    # ---- Web: WebViewClient that keeps viewed street-map tiles on the device (max 29 days) ----
    web = ClassDef(WEB, 'Landroid/webkit/WebViewClient;')
    web.field('dir', 'Ljava/io/File;')
    web.method('<init>', ['Ljava/io/File;'], 'V', 2, '''
        invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
        iput-object p1, p0, Lcom/carnav/camry/Web;->dir:Ljava/io/File;
        return-void
    ''')
    web.method('shouldInterceptRequest', ['Landroid/webkit/WebView;', 'Landroid/webkit/WebResourceRequest;'],
               'Landroid/webkit/WebResourceResponse;', 11, '''
        :try_start
        invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
        move-result-object v0
        invoke-virtual {v0}, Landroid/net/Uri;->getHost()Ljava/lang/String;
        move-result-object v1
        if-eqz v1, :pass
        const-string v2, "basemaps.cartocdn.com"
        invoke-virtual {v1, v2}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
        move-result v2
        if-eqz v2, :pass
        invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getMethod()Ljava/lang/String;
        move-result-object v2
        const-string v3, "GET"
        invoke-virtual {v3, v2}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
        move-result v2
        if-eqz v2, :pass
        invoke-virtual {v0}, Landroid/net/Uri;->getPath()Ljava/lang/String;
        move-result-object v2
        if-eqz v2, :pass
        const-string v3, ".."
        invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
        move-result v3
        if-nez v3, :pass
        new-instance v3, Ljava/io/File;
        iget-object v4, p0, Lcom/carnav/camry/Web;->dir:Ljava/io/File;
        invoke-direct {v3, v4, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
        invoke-virtual {v3}, Ljava/io/File;->lastModified()J
        move-result-wide v4
        invoke-static {}, Lcom/carnav/camry/Sys;->cutoff()J
        move-result-wide v6
        invoke-static {v4, v5, v6, v7}, Ljava/lang/Long;->compare(JJ)I
        move-result v4
        if-gtz v4, :serve
        invoke-virtual {v0}, Landroid/net/Uri;->toString()Ljava/lang/String;
        move-result-object v4
        invoke-static {v4, v3}, Lcom/carnav/camry/Sys;->fetch(Ljava/lang/String;Ljava/io/File;)Z
        move-result v4
        if-nez v4, :serve
        invoke-static {}, Lcom/carnav/camry/Sys;->miss()Landroid/webkit/WebResourceResponse;
        move-result-object v0
        return-object v0
        :serve
        invoke-static {v3}, Lcom/carnav/camry/Sys;->serve(Ljava/io/File;)Landroid/webkit/WebResourceResponse;
        move-result-object v0
        return-object v0
        :try_end
        :pass
        const/4 v0, 0
        return-object v0
        :handler
        move-exception v0
        const/4 v0, 0
        return-object v0
        .catchall {:try_start .. :try_end} :handler
    ''')

    # ---- Gnss: satellites seen / used by the head unit's GPS (API 24+) ----
    gnss = ClassDef(GNSS, 'Landroid/location/GnssStatus$Callback;')
    gnss.field('m', MAIN)
    gnss.method('<init>', [MAIN], 'V', 2, '''
        invoke-direct {p0}, Landroid/location/GnssStatus$Callback;-><init>()V
        iput-object p1, p0, Lcom/carnav/camry/Gnss;->m:Lcom/carnav/camry/Main;
        return-void
    ''')
    gnss.method('onSatelliteStatusChanged', ['Landroid/location/GnssStatus;'], 'V', 7, '''
        invoke-virtual {p1}, Landroid/location/GnssStatus;->getSatelliteCount()I
        move-result v0
        const/4 v1, 0
        const/4 v2, 0
        :loop
        if-ge v2, v0, :done
        invoke-virtual {p1, v2}, Landroid/location/GnssStatus;->usedInFix(I)Z
        move-result v3
        if-eqz v3, :skip
        add-int/lit8 v1, v1, 1
        :skip
        add-int/lit8 v2, v2, 1
        goto :loop
        :done
        new-instance v3, Ljava/lang/StringBuilder;
        const-string v4, "window.onGnss&&onGnss("
        invoke-direct {v3, v4}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
        invoke-virtual {v3, v1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;
        const-string v4, ","
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v3, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;
        const-string v4, ")"
        invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v4
        iget-object v3, p0, Lcom/carnav/camry/Gnss;->m:Lcom/carnav/camry/Main;
        invoke-virtual {v3, v4}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V
        return-void
    ''')
    gnss.method('start', [MAIN, 'Landroid/location/LocationManager;'], 'Ljava/lang/Object;', 3, '''
        new-instance v0, Lcom/carnav/camry/Gnss;
        invoke-direct {v0, p0}, Lcom/carnav/camry/Gnss;-><init>(Lcom/carnav/camry/Main;)V
        invoke-virtual {p1, v0}, Landroid/location/LocationManager;->registerGnssStatusCallback(Landroid/location/GnssStatus$Callback;)Z
        return-object v0
    ''', flags=ACC_PUBLIC | ACC_STATIC)
    rcv = ClassDef(RCV, 'Landroid/content/BroadcastReceiver;')
    rcv.field('m', MAIN)
    rcv.method('<init>', [MAIN], 'V', 2, '''
        invoke-direct {p0}, Landroid/content/BroadcastReceiver;-><init>()V
        iput-object p1, p0, Lcom/carnav/camry/Rcv;->m:Lcom/carnav/camry/Main;
        return-void
    ''')
    rcv.method('onReceive', ['Landroid/content/Context;', 'Landroid/content/Intent;'], 'V', 12, '''
        new-instance v0, Lorg/json/JSONObject;
        invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V
        :try_start
        const-string v1, "a"
        invoke-virtual {p2}, Landroid/content/Intent;->getAction()Ljava/lang/String;
        move-result-object v2
        invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        new-instance v1, Lorg/json/JSONObject;
        invoke-direct {v1}, Lorg/json/JSONObject;-><init>()V
        const-string v2, "x"
        invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        invoke-virtual {p2}, Landroid/content/Intent;->getExtras()Landroid/os/Bundle;
        move-result-object v2
        if-eqz v2, :send
        invoke-virtual {v2}, Landroid/os/Bundle;->keySet()Ljava/util/Set;
        move-result-object v3
        invoke-interface {v3}, Ljava/util/Set;->iterator()Ljava/util/Iterator;
        move-result-object v3
        :loop
        invoke-interface {v3}, Ljava/util/Iterator;->hasNext()Z
        move-result v4
        if-eqz v4, :send
        invoke-interface {v3}, Ljava/util/Iterator;->next()Ljava/lang/Object;
        move-result-object v4
        check-cast v4, Ljava/lang/String;
        invoke-virtual {v2, v4}, Landroid/os/Bundle;->get(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v5
        invoke-static {v5}, Lorg/json/JSONObject;->wrap(Ljava/lang/Object;)Ljava/lang/Object;
        move-result-object v6
        if-nez v6, :put
        invoke-static {v5}, Ljava/lang/String;->valueOf(Ljava/lang/Object;)Ljava/lang/String;
        move-result-object v6
        :put
        invoke-virtual {v1, v4, v6}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        goto :loop
        :try_end
        :handler
        move-exception v1
        :h_start
        const-string v2, "err"
        invoke-virtual {v1}, Ljava/lang/Throwable;->toString()Ljava/lang/String;
        move-result-object v1
        invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
        :h_end
        goto :send
        :h_err
        move-exception v1
        :send
        new-instance v1, Ljava/lang/StringBuilder;
        const-string v2, "window.onBcast&&onBcast("
        invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
        invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
        move-result-object v2
        invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        const-string v2, ")"
        invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
        invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
        move-result-object v1
        iget-object v2, p0, Lcom/carnav/camry/Rcv;->m:Lcom/carnav/camry/Main;
        invoke-virtual {v2, v1}, Lcom/carnav/camry/Main;->js(Ljava/lang/String;)V
        return-void
        .catchall {:try_start .. :try_end} :handler
        .catchall {:h_start .. :h_end} :h_err
    ''')

    return [main, chrome, sys_, web, gnss, rcv]
