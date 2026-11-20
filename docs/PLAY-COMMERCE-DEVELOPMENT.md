# Google Play commerce development — not a published release

Approved Play application ID: `com.guisarc.arcadview`. Employee GitHub installs keep `com.izcad.viewer`, their local data, offline tools and updater. Google Billing and Google ID SDKs compile only for `-PARCAD_DISTRIBUTION=play`; no app user data is migrated or deleted automatically.

## Build

Use the documented existing Node/JDK21/SDK36/NDK environment:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run android:prepare
Set-Location android
.\gradlew.bat assembleDebug bundleRelease testDebugUnitTest -PARCAD_DISTRIBUTION=play
```

`ARCAD_ACCOUNT_SERVER` must be an HTTPS origin (no trailing path). The default is empty. The verified development artifact passes `-PARCAD_ACCOUNT_SERVER=https://arcad-accounts-staging.gamzagui.workers.dev -PARCAD_ACCOUNT_ENVIRONMENT=staging`. The independent service and setup instructions live next to this checkout in `arcad-services`; the public client does not require its source or secrets to compile. Health reports Google configuration unavailable, so the app displays the preparation state and disables sign-in while preserving viewing.

Native `ARCAD_BILLING_ENABLED` defaults to false and blocks checkout even if a developer calls the plugin directly. It must remain false until approved Play products, license testers and the testing plan are in place. Server payment mode and sales approval are additional gates. No actual sale is authorized by compiling a Billing SDK.

`bundleRelease` is unsigned unless all four existing `IZCAD_KEYSTORE_FILE`, `IZCAD_KEYSTORE_PASSWORD`, `IZCAD_KEY_ALIAS`, `IZCAD_KEY_PASSWORD` settings are supplied through the established external signing mechanism. The existing Android Debug certificate cannot be used as the Play upload key. Do not commit keys, create a Play signing enrollment or accept legal terms automatically.

## Completion boundaries

Play only: aligned/linear measurements complete on the second final pick, angle on the third, object on a valid object pick, closed total length on closure. Open total length and area have an explicit **측정 완료** action. Incomplete points, selection, cancellation and invalid results are not sent for consumption.

The journal DB `arcad-operation-journal` holds full local result candidates, unique operation IDs and approved state. On final save/network failure it keeps the candidate for recovery, rather than charging another UUID. Server cancellation tombstones prevent a delayed request from charging a cancelled job. Completed saved measurements reopen in display-only mode, including without login; resuming starts a new measurement. Original drawing/library/cache/unit/annotation keys are unchanged.

Annotation usage is classified from final document changes. One polyline, shape, text, dimension, point markup, completed move/rotation/offset/extension/grip edit or new ordinary layer is one operation. Selecting, hiding, naming a layer, deleting an object/segment, and Undo/Redo are not new charges. Point-layer creation accompanying a point object does not charge a second time. Direct repeated draft changes are not billed.

Before using a published build, complete authenticated integration tests for every tool, paid/free/pro transitions, pending recovery, document switching, storage exhaustion, session/account switching and long press editing. Current tests and anonymous LDPlayer smoke tests do not constitute those passes.

## Distribution and licensing blockers

Maven POMs for Billing 9.1.0 and Google ID 1.2.1 declare Android Software Development Kit License, not Apache-2.0. The existing app/LibreDWG is GPL. No GPL linking exception or redistribution clearance is assumed. Resolve that question with the relevant rights holders/legal review before any public Play SDK binary distribution. AndroidX Credentials 1.6.0 is Apache-2.0. Existing GitHub APK builds omit the new SDKs.

Release vital lint logs report Kotlin 2.4 metadata from googleid while AGP 8.13's lint expects 2.2. Java/D8 APK and AAB builds succeeded; this warning has not been hidden by disabling lint or blindly upgrading Gradle. A clean, supported lint/tooling combination is required before a release candidate is approved.

No tag, public source push, GitHub visibility change, Play upload, product price or sale has been performed by these changes. The public source-only repository continues to serve the current v2.1.19 employee release. A future Play release needs its exact source tag/archive after approval; do not reuse the old version tag for modified commerce code.
