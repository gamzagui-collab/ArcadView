package com.izcad.viewer;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "TakeoffExport")
public class TakeoffExportPlugin extends Plugin {
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private byte[] pending;
    private String pendingName;

    @PluginMethod
    public synchronized void save(PluginCall call) {
        if (pending != null) { call.reject("다른 Excel 저장이 진행 중입니다.", "EXPORT_BUSY"); return; }
        try {
            String encoded = call.getString("data");
            if (encoded == null || encoded.length() > ExportFileRules.MAX_BASE64_CHARS) {
                throw new IllegalArgumentException("Export size exceeded");
            }
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (!ExportFileRules.validArchive(bytes)) throw new IllegalArgumentException("Invalid XLSX export");
            pendingName = ExportFileRules.safeName(call.getString("name"));
            pending = bytes;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .putExtra(Intent.EXTRA_TITLE, pendingName);
            startActivityForResult(call, intent, "destination");
        } catch (Exception | OutOfMemoryError error) {
            pending = null; pendingName = null;
            call.reject("Excel 저장을 시작하지 못했습니다. 파일 크기와 저장 앱을 확인하세요.", "EXPORT_START");
        }
    }

    @ActivityCallback
    private synchronized void destination(PluginCall call, ActivityResult result) {
        final byte[] bytes = pending;
        final String name = pendingName;
        if (call == null) { pending = null; pendingName = null; return; }
        if (result.getResultCode() != Activity.RESULT_OK) {
            pending = null; pendingName = null;
            JSObject response = new JSObject(); response.put("cancelled", true); call.resolve(response); return;
        }
        final Uri uri = result.getData() == null ? null : result.getData().getData();
        if (bytes == null || uri == null || !"content".equals(uri.getScheme())) {
            pending = null; pendingName = null;
            call.reject("저장 위치를 확인하지 못했습니다. 다시 내보내 주세요.", "EXPORT_DESTINATION"); return;
        }
        writer.execute(() -> {
            try {
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IllegalStateException("No output stream");
                    output.write(bytes); output.flush();
                }
                JSObject response = new JSObject(); response.put("cancelled", false); response.put("name", name); response.put("bytes", bytes.length); call.resolve(response);
            } catch (Exception | OutOfMemoryError error) {
                // ACTION_CREATE_DOCUMENT creates a new document. Remove only
                // that incomplete export; it never points at a source DWG.
                try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
                call.reject("Excel을 저장하지 못했습니다. 저장 공간과 위치를 확인하세요.", "EXPORT_WRITE");
            } finally {
                synchronized (TakeoffExportPlugin.this) { if (pending == bytes) { pending = null; pendingName = null; } }
            }
        });
    }

    @Override protected synchronized void handleOnDestroy() {
        pending = null; pendingName = null; writer.shutdownNow(); super.handleOnDestroy();
    }
}
