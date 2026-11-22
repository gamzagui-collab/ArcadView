package com.izcad.viewer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import org.json.JSONObject;

@CapacitorPlugin(name = "AnnotationStorage")
public class AnnotationStoragePlugin extends Plugin {
    private DurableAnnotationStore store;
    @Override public void load() { store = new DurableAnnotationStore(new File(getContext().getFilesDir(), "annotation-documents-v1")); }
    @PluginMethod public void read(PluginCall call) {
        try {
            String json = store.read(call.getString("key"));
            JSObject result = new JSObject(); result.put("json", json == null ? JSONObject.NULL : json); call.resolve(result);
        } catch (Exception error) { call.reject("주석을 복원하지 못했습니다. 원본 저장 자료는 유지됩니다.", "ANNOTATION_READ_FAILED", error); }
    }
    @PluginMethod public void write(PluginCall call) {
        try {
            String json = call.getString("json");
            if (json == null || json.length() > 4_000_000) throw new IllegalArgumentException("Invalid annotation size");
            JSONObject doc = new JSONObject(json);
            if (doc.getInt("version") != 1 || doc.getJSONArray("layers").length() < 1 || doc.getJSONArray("objects").length() > 3000) throw new IllegalArgumentException("Invalid annotation document");
            store.write(call.getString("key"), json);
            call.resolve();
        } catch (Exception error) { call.reject("주석 저장에 실패했습니다. 저장 공간을 확인하고 다시 시도하세요.", "ANNOTATION_WRITE_FAILED", error); }
    }
}
