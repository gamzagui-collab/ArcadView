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

`ARCAD_ACCOUNT_SERVER` must be an HTTPS origin (no trailing path). The default is empty. The verified development artifact passes `-PARCAD_ACCOUNT_SERVER=https://arcad-accounts-staging.gamzagui.workers.dev -PARCAD_ACCOUNT_ENVIRONMENT=staging`. The independent service and setup instructions live next to this checkout in `arcad-services`; the public client does not require its source or secrets to compile. Staging Google OAuth is configured. Guests need no health, account or usage requests to open drawings or use aligned measurement.

Native `ARCAD_BILLING_ENABLED` defaults to false and blocks checkout even if a developer calls the plugin directly. It must remain false until approved Play products, license testers and the testing plan are in place. Server payment mode and sales approval are additional gates. No actual sale is authorized by compiling a Billing SDK.

`bundleRelease` is unsigned unless all four existing `IZCAD_KEYSTORE_FILE`, `IZCAD_KEYSTORE_PASSWORD`, `IZCAD_KEY_ALIAS`, `IZCAD_KEY_PASSWORD` settings are supplied through the established external signing mechanism. The existing Android Debug certificate cannot be used as the Play upload key. Do not commit keys, create a Play signing enrollment or accept legal terms automatically.

## Completion boundaries

Aligned measurement (`distance` / `measure.aligned`) is always free and unlimited, including guests and offline use. Linear measurement (`linear` / `measure.linear`) is a separate metered tool. Stable IDs in `toolPolicy.ts`, rather than translated labels, determine access. The client bypasses usage calls for aligned results; the server rejects aligned consumption and a database trigger prevents new aligned receipts. Historical receipts remain intact for audit.

In Play builds, selecting another measurement/drawing tool requires Google login. Cancelling returns to CAD; successful login resumes the selected tool without automatically picking points or charging. Valid linear measurements complete on the second final pick, angle on the third, object on a valid object pick, closed total length on closure. Open total length and area have an explicit **측정 완료** action. Incomplete points, selection, cancellation and invalid results are not sent for consumption.

Open-path and area drafts expose only the last edge length, including the panel, compact status, held-point preview and drawing label. Totals, area and perimeter appear only after the completed result is approved and saved. Pausing never reveals a draft total; Undo restores the result's completion state. Finish remains visible above the toolbar while the inspector is collapsed, with a second button inside the measurement panel. Polyline drawing has the same compact Finish action for an open polyline. Employee builds also finish locally without account requests.

Each Google identity receives at most 100 free metered operations per KST month, without rollover. All metered tools use this pool first, then nonexpiring Standard credits. Active Pro uses neither pool. Restarting or logging out/in does not grant another allowance. Guest CAD and aligned measurement need no anonymous server account. Advanced completion needs a server connection; no offline credit synchronization is introduced.

The journal DB `arcad-operation-journal` holds full local result candidates, unique operation IDs and approved state. On final save/network failure it keeps the candidate for recovery, rather than charging another UUID. Server cancellation tombstones prevent a delayed request from charging a cancelled job. Completed saved measurements reopen in display-only mode, including without login; resuming starts a new measurement. Previously pending aligned candidates recover locally without another usage call. Original drawing/library/cache/unit/annotation keys are unchanged. Logout revokes and clears only the secure account session, leaving drawings, annotations and settings available.

Annotation usage is classified from final document changes. One polyline, shape, text, dimension, point markup, completed move/rotation/offset/extension/grip edit or new ordinary layer is one operation. Selecting, hiding, naming a layer, deleting an object/segment, and Undo/Redo are not new charges. Point-layer creation accompanying a point object does not charge a second time. Direct repeated draft changes are not billed.

Before using a published build, complete authenticated integration tests for every tool, paid/free/pro transitions, pending recovery, document switching, storage exhaustion, session/account switching and long press editing. Current tests and anonymous LDPlayer smoke tests do not constitute those passes.

## Distribution and licensing blockers

Maven POMs for Billing 9.1.0 and Google ID 1.2.1 declare Android Software Development Kit License, not Apache-2.0. The existing app/LibreDWG is GPL. No GPL linking exception or redistribution clearance is assumed. Resolve that question with the relevant rights holders/legal review before any public Play SDK binary distribution. AndroidX Credentials 1.6.0 is Apache-2.0. Existing GitHub APK builds omit the new SDKs.

Release vital lint logs report Kotlin 2.4 metadata from googleid while AGP 8.13's lint expects 2.2. Java/D8 APK and AAB builds succeeded; this warning has not been hidden by disabling lint or blindly upgrading Gradle. A clean, supported lint/tooling combination is required before a release candidate is approved.

The v2.1.20 employee release uses the `github` distribution, keeps existing offline tools and publishes matching source to the source-only repository. It omits Play Billing and Google ID SDK binaries; the Play account code in the corresponding source remains development work. No GitHub visibility change, Play upload, product price or sale is included. A future Play release needs its exact source tag/archive after approval; do not reuse the employee version tag for modified commerce code.
