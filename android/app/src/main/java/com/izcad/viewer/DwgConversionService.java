package com.izcad.viewer;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ResultReceiver;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** A disposable browser process isolates WASM's address space from drawing/GPU buffers. */
public class DwgConversionService extends Service {
    private static final String HOST = "izcad-converter.local";
    private static final String TAG = "IzCadDwgConversion";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean finished = new AtomicBoolean();
    private final Object outputLock = new Object();
    private ResultReceiver receiver;
    private WebView webView;
    private File input;
    private File outputFile;
    private FileOutputStream output;
    private long outputBytes;
    private String workerUrl;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (receiver != null || intent == null) return START_NOT_STICKY;
        receiver = intent.getParcelableExtra("receiver");
        try {
            String token = intent.getStringExtra("token");
            if (token == null || !token.matches("[0-9a-f-]{36}")) throw new Exception("Invalid session.");
            File directory = new File(getCacheDir(), "dwg-conversions/" + token);
            input = new File(directory, "input.dwg");
            if (!input.isFile()) throw new Exception("Input cache missing.");
            outputFile = new File(directory, "output.dxf");
            output = new FileOutputStream(outputFile);
            for (String asset : getAssets().list("public/assets")) {
                if (asset.startsWith("dwg.worker-") && asset.endsWith(".js")) workerUrl = "/assets/" + asset;
            }
            if (workerUrl == null || Build.VERSION.SDK_INT < 28) throw new Exception("Conversion runtime unavailable.");
            // Must precede every WebView API in this process. Never share the
            // main viewer's profile, cookies, IndexedDB or renderer address space.
            WebView.setDataDirectorySuffix("dwg_converter");
            WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            webView = new WebView(this);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            webView.addJavascriptInterface(new NativeBridge(), "NativeConversion");
            webView.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onConsoleMessage(ConsoleMessage message) {
                    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, message.message());
                    return true;
                }
            });
            webView.setWebViewClient(new WebViewClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    try {
                        if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || !"GET".equals(request.getMethod())) throw new Exception("Blocked URL.");
                        String path = uri.getPath();
                        if ("/input.dwg".equals(path)) return new WebResourceResponse("application/octet-stream", null, new FileInputStream(input));
                        if ("/index.html".equals(path)) return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream("<!doctype html><script src='/native-dwg-converter.js'></script>".getBytes(StandardCharsets.UTF_8)));
                        if (path == null || path.contains("..") || path.contains("\\")) throw new Exception("Invalid asset path.");
                        String mime = path.endsWith(".wasm") ? "application/wasm" : "application/javascript";
                        return new WebResourceResponse(mime, "UTF-8", getAssets().open("public" + path));
                    } catch (Exception error) {
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                    }
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    finish(1, detail.didCrash() ? "DWG_CONVERSION_FAILED" : "DWG_MEMORY_LIMIT", "The isolated DWG renderer stopped; memory may be exhausted.", "{}", "null");
                    return true;
                }
            });
            Log.i(TAG, "started pid=" + android.os.Process.myPid() + " inputBytes=" + input.length());
            main.postDelayed(() -> finish(1, "DWG_CONVERSION_TIMEOUT", "DWG conversion timed out.", "{}", "null"), DrawingLimits.CONVERSION_TIMEOUT_MS);
            webView.loadUrl("https://" + HOST + "/index.html");
        } catch (Exception error) { finish(1, "DWG_RUNTIME_MISSING", error.toString(), "{}", "null"); }
        return START_NOT_STICKY;
    }

    private final class NativeBridge {
        @JavascriptInterface public String workerUrl() { return workerUrl; }
        @JavascriptInterface public void appendOutput(String encoded) throws Exception {
            if (encoded.length() > 512 * 1024) throw new Exception("Invalid output chunk.");
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            synchronized (outputLock) {
                if (finished.get() || output == null) throw new Exception("Conversion is closed.");
                outputBytes += bytes.length;
                if (outputBytes > DrawingLimits.DXF_BYTES) throw new Exception("Converted drawing exceeds the size limit.");
                output.write(bytes);
            }
        }
        @JavascriptInterface public void complete(String savedView) { finish(0, "", "", "{}", savedView); }
        @JavascriptInterface public void fail(String json) {
            try {
                JSONObject failure = new JSONObject(json), details = new JSONObject();
                details.put("dwg", failure.optJSONObject("diagnostic"));
                finish(1, failure.optString("code", "DWG_CONVERSION_FAILED"), failure.optString("message", "DWG conversion failed."), details.toString(), "null");
            } catch (Exception error) { finish(1, "DWG_CONVERSION_FAILED", error.toString(), "{}", "null"); }
        }
    }

    private void finish(int status, String code, String message, String details, String savedView) {
        main.post(() -> {
            if (!finished.compareAndSet(false, true)) return;
            synchronized (outputLock) { try { if (output != null) output.close(); } catch (Exception ignored) { } output = null; }
            main.removeCallbacksAndMessages(null);
            if (webView != null) { webView.removeJavascriptInterface("NativeConversion"); webView.destroy(); webView = null; }
            Bundle data = new Bundle(); data.putString("code", code); data.putString("message", message);
            data.putString("details", details); data.putString("savedView", savedView);
            if (status == 0 && (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
                try {
                    MessageDigest digest = MessageDigest.getInstance("SHA-256");
                    try (FileInputStream stream = new FileInputStream(outputFile)) {
                        byte[] buffer = new byte[65536]; int count;
                        while ((count = stream.read(buffer)) != -1) digest.update(buffer, 0, count);
                    }
                    StringBuilder hex = new StringBuilder();
                    for (byte value : digest.digest()) hex.append(String.format("%02x", value & 255));
                    Log.i(TAG, "outputSha256=" + hex);
                } catch (Exception error) { Log.w(TAG, "Output hash unavailable."); }
            }
            Log.i(TAG, "finished pid=" + android.os.Process.myPid() + " status=" + status + " outputBytes=" + outputBytes);
            if (receiver != null) receiver.send(status, data);
            stopSelf();
            // Only this private disposable process, never the viewer process.
            main.postDelayed(() -> android.os.Process.killProcess(android.os.Process.myPid()), 50);
        });
    }

    @Override public void onDestroy() {
        if (!finished.get()) finish(1, "DWG_CONVERSION_FAILED", "DWG conversion was cancelled.", "{}", "null");
        super.onDestroy();
    }
}
