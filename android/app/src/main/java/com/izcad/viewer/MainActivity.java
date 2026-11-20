package com.izcad.viewer;

import android.os.Bundle;
import android.content.Intent;
import android.os.Build;
import android.content.pm.ApplicationInfo;
import android.webkit.WebView;
import android.webkit.RenderProcessGoneDetail;
import android.view.ViewGroup;
import android.widget.Toast;
import com.getcapacitor.WebViewListener;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean recoveringRenderer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncomingDrawingPlugin.class);
        registerPlugin(DwgConversionPlugin.class);
        registerPlugin(AppUpdatesPlugin.class);
        registerPlugin(ArcadCommercePlugin.class);
        super.onCreate(savedInstanceState);
        bridge.addWebViewListener(new WebViewListener() {
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (recoveringRenderer) return true;
                recoveringRenderer = true;
                android.util.Log.w("ArcadMemoryRecovery", "Viewer renderer stopped; returning to library without reopening the drawing. crash=" + detail.didCrash());
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
                // A file VIEW intent must not reopen the same failing drawing.
                setIntent(new Intent(MainActivity.this, MainActivity.class).setAction(Intent.ACTION_MAIN));
                getWindow().getDecorView().post(() -> {
                    Toast.makeText(MainActivity.this, "도면 표시가 중단되어 초기 화면으로 복구합니다. 다른 앱을 닫은 뒤 다시 시도하세요.", Toast.LENGTH_LONG).show();
                    recreate();
                });
                return true;
            }
        });
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
