# Android DWG conversion process isolation

Large DWG conversion and DXF/WebGL preparation have different memory peaks.
On LDPlayer 9 / Chrome WebView 124 x86, recreating LibreDWG's 1 GiB initial
memory after viewing a large drawing failed. Keeping that engine alive during
DXF preparation instead caused a renderer OOM. A smaller initial memory alone
did not make repeated conversions reliable.

On Android API 28+, DWG conversion now runs in an app-private, disposable
`:dwg_converter` process. Its WebView uses a distinct data-directory suffix and
serves only bundled assets and the one staged input through a private HTTPS
origin intercepted locally. No network or broad-storage permission is added.
The service is not exported. It is not a second application or an engine upgrade.

The original conversion worker, LibreDWG 0.9.0 JS/WASM, layer/xclip handling and
saved-view extraction are reused unmodified. File bytes are staged in bounded
256 KiB chunks in app cache. The converter writes a temporary DXF in chunks,
closes its WebView and terminates only its own disposable process. The main app
then reads the DXF through Capacitor's existing local file bridge and uses the
existing parser, renderer, fonts and measurement UI. The main Activity and
renderer are not reloaded or restarted between drawings.

Input chunks use a bounded private staging bridge instead of Capacitor's verbose
argument logger, so binary contents are not retained in its console history or
written to debug Logcat. Control messages and existing application error logging
remain available.

Requests are serialized until the preceding process/cache is released. Abort
stops only the conversion service; timeout and worker/renderer failures reject
with the existing DWG error codes. Cancellation and completion remove only the
two fixed staging files in the generated session directory. Abandoned sessions
are removed on plugin initialization. The drawing library and user originals
are never deleted by this path. App destruction also stops the service.

Android 8 / 8.1 (API 26/27) retain the original worker path because isolated
WebView data directories require API 28. Web builds retain the original worker
path as well. Tests on LDPlayer Android 9 do not certify Android 8 or physical
phones.

Regression validation must include the actual drawings in both orders, repeated
opens in one main app PID without debugger garbage collection, converter process
exit, private cache cleanup, exact converted-DXF hash comparison, original file
hash preservation, cancellation/recovery, and known DXF measurements.

References:

- [Android WebView process data-directory isolation](https://developer.android.com/reference/android/webkit/WebView#setDataDirectorySuffix(java.lang.String))
- [Android WebView renderer lifecycle](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview)
