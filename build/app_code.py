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
        const-string v4, " CamryNav/2.1 (Android head unit; SDK "
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
        new-instance v1, Landroid/webkit/WebViewClient;
        invoke-direct {v1}, Landroid/webkit/WebViewClient;-><init>()V
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
        if-eqz v2, :done
        const/4 v2, 3
        new-array v2, v2, [Ljava/lang/String;
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

    main.method('startLoc', [], 'V', 8, '''
        :try_start
        const-string v0, "location"
        invoke-virtual {p0, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
        move-result-object v0
        check-cast v0, Landroid/location/LocationManager;
        iput-object v0, p0, Lcom/carnav/camry/Main;->lm:Landroid/location/LocationManager;
        move-object v1, v0
        const-string v2, "gps"
        const-wide/16 v3, 500
        const/4 v5, 0
        move-object v6, p0
        invoke-virtual/range {v1 .. v6}, Landroid/location/LocationManager;->requestLocationUpdates(Ljava/lang/String;JFLandroid/location/LocationListener;)V
        invoke-virtual {v1, v2}, Landroid/location/LocationManager;->getLastKnownLocation(Ljava/lang/String;)Landroid/location/Location;
        move-result-object v0
        if-eqz v0, :try_end
        invoke-virtual {p0, v0}, Lcom/carnav/camry/Main;->onLocationChanged(Landroid/location/Location;)V
        :try_end
        return-void
        :handler
        move-exception v0
        return-void
        .catchall {:try_start .. :try_end} :handler
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
            ('home', True), ('temp', True), ('sys', True)]
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

    # device temperature for the fan/cooling panel (see Sys)
    main.method('temp', [STR], STR, 3, '''
        invoke-static {p0}, Lcom/carnav/camry/Sys;->temp(Landroid/app/Activity;)Ljava/lang/String;
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
    return [main, chrome, sys_]
