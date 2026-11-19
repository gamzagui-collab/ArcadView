package com.izcad.viewer;

import android.content.Intent;
import android.app.ActivityManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ResultReceiver;
import android.content.Context;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** App-private staging only. The drawing library and user source files are never modified. */
@CapacitorPlugin(name = "DwgConversion")
public class DwgConversionPlugin extends Plugin {
    private static final long LIMIT = 128L * 1024 * 1024;
    private final ConcurrentHashMap<String, File> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, PluginCall> pending = new ConcurrentHashMap<>();

    @Override public void load() {
        getContext().stopService(new Intent(getContext(), DwgConversionService.class));
        // Binary chunks must not pass through Capacitor's verbose argument
        // logger/console history: retaining them would create another memory peak.
        bridge.getWebView().addJavascriptInterface(new ChunkWriter(), "IzCadDwgStaging");
        File root = new File(getContext().getCacheDir(), "dwg-conversions");
        File[] directories = root.listFiles();
        if (directories != null) for (File directory : directories) {
            if (directory.isDirectory() && directory.getName().matches("[0-9a-f-]{36}")) {
                new File(directory, "input.dwg").delete(); new File(directory, "output.dxf").delete(); directory.delete();
            }
        }
    }

    @PluginMethod public void supported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", Build.VERSION.SDK_INT >= 28);
        call.resolve(result);
    }

    @PluginMethod public void begin(PluginCall call) {
        try {
            String token = UUID.randomUUID().toString();
            File directory = new File(getContext().getCacheDir(), "dwg-conversions/" + token);
            if (!directory.mkdirs()) throw new Exception("Cannot create conversion cache.");
            new File(directory, "input.dwg").createNewFile();
            sessions.put(token, directory);
            JSObject result = new JSObject(); result.put("token", token); call.resolve(result);
        } catch (Exception error) { call.reject(error.getMessage(), "FILE_READ_FAILED"); }
    }

    @PluginMethod public void append(PluginCall call) {
        try {
            appendChunk(call.getString("token", ""), call.getString("data", ""));
            call.resolve();
        } catch (Exception error) { call.reject(error.getMessage(), "FILE_READ_FAILED"); }
    }

    private void appendChunk(String token, String encoded) throws Exception {
        File directory = sessions.get(token);
        if (directory == null || pending.containsKey(token) || encoded == null || encoded.length() > 512 * 1024) throw new Exception("Invalid input chunk.");
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        File input = new File(directory, "input.dwg");
        if (input.length() + bytes.length > LIMIT) throw new Exception("Drawing exceeds the size limit.");
        try (FileOutputStream stream = new FileOutputStream(input, true)) { stream.write(bytes); }
    }

    private final class ChunkWriter {
        @JavascriptInterface public String append(String token, String encoded) {
            try { appendChunk(token, encoded); return null; }
            catch (Exception error) { return error.getMessage(); }
        }
    }

    @PluginMethod public void convert(PluginCall call) {
        String token = call.getString("token", "");
        File directory = sessions.get(token);
        if (directory == null || new File(directory, "input.dwg").length() == 0 || pending.putIfAbsent(token, call) != null) {
            call.reject("Invalid conversion session.", "FILE_READ_FAILED"); return;
        }
        ResultReceiver receiver = new ResultReceiver(new Handler(Looper.getMainLooper())) {
            @Override protected void onReceiveResult(int code, Bundle data) {
                PluginCall waiting = pending.remove(token);
                if (waiting == null) return;
                if (code != 0) {
                    JSObject details = new JSObject();
                    try { details = new JSObject(data.getString("details", "{}")); } catch (Exception ignored) { }
                    waiting.reject(data.getString("message", "DWG conversion failed."), data.getString("code", "DWG_CONVERSION_FAILED"), null, details);
                    return;
                }
                File output = new File(directory, "output.dxf");
                JSObject result = new JSObject();
                result.put("uri", Uri.fromFile(output).toString()); result.put("size", output.length());
                result.put("savedView", data.getString("savedView", "null"));
                waiting.resolve(result);
            }
        };
        try {
            Intent intent = new Intent(getContext(), DwgConversionService.class);
            intent.putExtra("token", token); intent.putExtra("receiver", receiver);
            getContext().startService(intent);
        } catch (Exception error) { pending.remove(token); call.reject(error.getMessage(), "DWG_RUNTIME_MISSING"); }
    }

    @PluginMethod public void release(PluginCall call) {
        String token = call.getString("token", "");
        PluginCall waiting = pending.remove(token);
        if (waiting != null) {
            getContext().stopService(new Intent(getContext(), DwgConversionService.class));
            waiting.reject("DWG conversion was cancelled.", "DWG_CONVERSION_FAILED");
        }
        File directory = sessions.remove(token);
        if (directory != null) {
            // Only the two fixed staging files in a directory created by begin().
            new File(directory, "input.dwg").delete(); new File(directory, "output.dxf").delete(); directory.delete();
        }
        resolveWhenStopped(call, 100);
    }

    private void resolveWhenStopped(PluginCall call, int attempts) {
        ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        boolean running = false;
        if (manager.getRunningAppProcesses() != null) for (ActivityManager.RunningAppProcessInfo process : manager.getRunningAppProcesses()) {
            if ((getContext().getPackageName() + ":dwg_converter").equals(process.processName)) running = true;
        }
        if (!running) { call.resolve(); return; }
        if (attempts == 0) { call.reject("DWG converter did not stop.", "DWG_CONVERSION_FAILED"); return; }
        new Handler(Looper.getMainLooper()).postDelayed(() -> resolveWhenStopped(call, attempts - 1), 50);
    }

    @Override protected void handleOnDestroy() {
        getContext().stopService(new Intent(getContext(), DwgConversionService.class));
        for (PluginCall call : pending.values()) call.reject("Application closed.", "DWG_CONVERSION_FAILED");
        pending.clear();
        for (File directory : sessions.values()) {
            new File(directory, "input.dwg").delete(); new File(directory, "output.dxf").delete(); directory.delete();
        }
        sessions.clear();
    }
}
