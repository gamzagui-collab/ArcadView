import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.izcad.viewer",
  appName: "Arcad View",
  webDir: "dist",
  plugins: {
    SystemBars: {
      // Capacitor's DARK style means light foreground icons on a dark app.
      // Keep this explicit: DEFAULT follows the phone theme, not the web UI.
      style: "DARK",
      hidden: false,
      insetsHandling: "css",
    },
  },
  android: {
    minWebViewVersion: 64,
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
