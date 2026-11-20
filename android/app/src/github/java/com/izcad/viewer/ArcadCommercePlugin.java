package com.izcad.viewer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Existing employee builds retain their offline tools and updater. */
@CapacitorPlugin(name = "ArcadCommerce")
public final class ArcadCommercePlugin extends Plugin {
    @PluginMethod public void getConfig(PluginCall call) {
        JSObject out = new JSObject(); out.put("enabled", false); out.put("server", ""); out.put("distribution", "github"); call.resolve(out);
    }
}
