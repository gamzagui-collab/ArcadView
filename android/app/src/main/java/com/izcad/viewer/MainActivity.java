package com.izcad.viewer;

import android.os.Bundle;
import android.content.Intent;
import android.os.Build;
import android.content.pm.ApplicationInfo;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncomingDrawingPlugin.class);
        registerPlugin(DwgConversionPlugin.class);
        registerPlugin(AppUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
        // Capacitor's bundled config stays secure for release. Override only
        // after it creates the WebView, using the installed variant's flag.
        WebView.setWebContentsDebuggingEnabled(
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0
        );
        // The web interface is always dark, including on phones in light mode.
        // SystemBars keeps the same appearance after configuration changes;
        // applying it here also covers the time before the web page is visible.
        WindowInsetsControllerCompat systemBars = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        systemBars.setAppearanceLightStatusBars(false);
        systemBars.setAppearanceLightNavigationBars(false);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // Keep the most recent file intent for Android activity recreation.
        if (intent != null) {
            setIntent(intent);
        }
        super.onNewIntent(intent);
    }
}
