# Windows / LDPlayer 9 debugging

Run commands from the izCAD project directory. This workflow preserves the
installed app's data and never uninstalls apps, clears data/logcat, kills the
shared ADB server, or selects an unrelated phone.

## Local setup

Reuse Node.js >=22, npm, JDK 21, SDK platform 36 and platform-tools. The official
README's `npm ci`, `npm test`, `npm run android:prepare`, and Gradle
`assembleDebug` workflow remains unchanged. Run `npm ci` after changing the lock
file; the debug command installs dependencies only when node_modules is absent.

Start one LDPlayer instance and enable its ADB local connection. If necessary,
specify an instance index from `ldconsole.exe list2`. No port is calculated from
the index: the script asks the LDPlayer console for the actual serial.

Create `.android-ld-debug.local.json` (ignored by Git) for machine-specific paths:

```json
{
  "InstanceIndex": 8,
  "LdPlayerHome": "C:\\LDPlayer\\LDPlayer9",
  "SdkRoot": "C:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk",
  "JdkHome": "C:\\path\\to\\jdk-21",
  "ReportRoot": "D:\\path\\to\\debug-results"
}
```

Each setting can also be supplied as a PowerShell parameter. Without a configured
index, exactly one LDPlayer instance must be running. `-Serial` is an additional
guard: it must match the selected LDPlayer's own reported serial. A stopped or
disconnected instance fails before installation; `-Launch` explicitly starts the
selected existing instance. The script does not change LDPlayer settings.

## Repeatable build / install / launch

```powershell
npm.cmd run android:ld-debug
npm.cmd run android:ld-debug -- -InstanceIndex 8 -CaptureSeconds 10
# Reuse the existing Debug APK without rebuilding:
npm.cmd run android:ld-debug -- -InstanceIndex 8 -SkipBuild
```

The default build version code is at least 7 and greater than an installed
version; `-VersionCode` can explicitly select a code. Installation uses `adb -s
<confirmed-serial> install -r`. Signature conflicts and downgrades stop the run;
they are never handled by uninstalling or resetting the app.

Reports include `result.json`, per-command full output, APK hash/metadata,
Activity/package dumps, global and process Logcat, `screen.png`, WebView state
and console/error events. Long console output is abbreviated; command files
retain the full output. Logcat is read without clearing the shared buffer. The
process PID is checked after startup and an observation delay; this detects
failures during that window, not every possible later crash. Historical buffered
WebView errors may be replayed when CDP attaches; event timestamps are retained.

`Status: PASS` means the build/install/launch/debug collection workflow completed.
It does **not** certify CAD content or measurement accuracy. `WebViewErrorCount`
and `webview.json` must also be reviewed. Failed commands return a nonzero exit
code and still write a failure report. No-device and mismatched-serial failures
must never be bypassed with a generic ADB install command.

## WebView / Chrome DevTools

MainActivity applies WebView debugging **after** Capacitor initializes it, using
the installed Android application's `FLAG_DEBUGGABLE`. Release explicitly sets
`debuggable false` and the bundled Capacitor configuration keeps WebView debugging
false. No internet permission, external development server, or mixed content is
enabled. Both variants use the same offline bundled assets.

With a Debug APK running on the confirmed device, open
`chrome://inspect/#devices` in desktop Chrome and inspect the izCAD WebView.
The script also connects directly to the app's per-PID DevTools socket via an
ephemeral ADB loopback forward and removes its own forward afterwards.

To capture a longer WebView session, create a forward for the **current** app PID
and run `node scripts/android-webview-probe.mjs <port> <output-directory> <seconds>`.
Keep Logcat running separately with the explicit confirmed serial. Application
console, WebAssembly errors, WebGL failures and JavaScript exceptions can then
be correlated by timestamps. Never reuse a socket after reinstall/restart: the
PID can change.

## CAD verification

Generate an original, shareable DXF fixture without touching a field drawing:

```powershell
node scripts/create-debug-dxf.mjs C:\path\to\izcad-known-geometry.dxf
```

It contains a 1000 x 500 mm closed rectangle (perimeter 3000 mm; area 500000 mm²),
a Korean label, an inserted circle block, a solid hatch and an initially hidden
red-line layer. Copy a fixture to the **confirmed** emulator and select it using
the app's Add files / Android file picker. Use endpoint snapping to measure the
1000 mm edge; use object measurement to verify perimeter and area. Also test
polygon area, zoom, pan, reopen and error recovery. The app currently has no
interactive layer visibility control: initial layer visibility can be checked,
but toggling layers must be recorded as unavailable.

For a DWG, preserve the source file and record its SHA-256 before/after testing.
Separate file read, LibreDWG WASM startup, DWG-to-DXF conversion, DXF parsing,
WebGL rendering, and actual content/measurement validation. Preserve screenshots
and logs. A worker success or a live process alone does not prove a complete
drawing. Check representative text, blocks, hatches and known dimensions against
the authoring CAD application before marking a field drawing compatible.

Real-phone GPU/memory/storage behavior and newer Android versions still require
their own tests. This setup does not produce a Play-ready signed release bundle.

For DWG memory isolation on Android API 28+, see [DWG conversion memory](DWG_MEMORY.md).
The main app stays running while a private conversion process exits after each
file. Its intentional teardown logs must be distinguished from a crash of the
main app PID. After repeated-file tests, check that `:dwg_converter` is absent,
the private conversion cache is empty, and the main app PID has not changed.
