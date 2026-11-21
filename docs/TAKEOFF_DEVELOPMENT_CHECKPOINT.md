# Arcad View concrete takeoff development checkpoint

## Current: 2.1.34 (62) — adaptive bottom toolbar, local testing only

- Start: clean feature/concrete-takeoff at6febf0523baf37320626bbabed6fbccea32765d2, public2.1.33/code61. Current source commit: `git rev-parse HEAD`. No older ZIP/reset/stash used. Latest official tag/release remainsv2.1.33; this UI request does not publish a new tag/release.
- Previous release was successfully published: https://github.com/gamzagui-collab/ArcadView/releases/tag/v2.1.33, Actions44895389137, commit6febf05. APK/source598 files, automatic60→61 install and original data verified; complete post-publication evidence ../artifacts/takeoff-release2133/final-report.json.
- User requested roomy screens place the drawing status card into the lowest toolbar row and let the center tools grow instead of always scrolling. Narrow screens still scroll only the middle tools, with reset/cancel/history fixed. No popup-tool-panel redesign.
- `ToolbarStatus.tsx` measures actual tool/button/status widths against the viewer's available width, observes size/content changes and portals only status controls to the shared `viewer-status-slot`. No editor/draft/history remount. Applies to normal annotations, measurement and takeoff, independent of screen orientation. A16px reserve prevents marginal clipping. Wider status text or Finish controls can return above the toolbar when needed.
- Toolbar grows to content within the available width; tools have explicit64px width so intrinsic flex layout includes every button. Only the tool strip shrinks/scrolls. Existing modest inertia stays. Inline status adopts footer separators/background; narrow fallback and Finish/Pause callbacks stay.
- Actual LDPlayer-8 / emulator-5570, Android9/WebView124, native1200x516 CSS/DPR2: all5 main tools fit (client332/scroll332), status joins the bottom row. Tested select/polyline/measurement/takeoff at1200x516,360x616,700x900,800x400,480x800 and back;26 combinations total. Both orientations supported by available space. One-point drafts survive docking/undocking; all Finish controls retained; real mouse/touch-style horizontal drag scrolls narrow tools while reset/cancel stay fixed. Actual COVER109,211 and BASE472,260 entities open.
- Extra widths use WebView viewport emulation; no physical tablet/phone claim. Android screencap confirms CAD is visible. CDP Page.captureScreenshot omits the composited WebGL surface on this emulator; those screenshots verify DOM layout only. native-cover-display.png captures the real CAD + toolbar.
- 481 existing automated tests PASS (443 Vitest/38 Node); TypeScript and both Debug/Release build PASS; Android22 tests PASS. No redundant unit tests added for this layout-only change. Signed local Release assets/runtime/fonts/all4ABIs/16KB alignment verify.
- Fresh baseline includes employee33 files/188,521,125 bytes,29 protected annotation/unit/options settings and1 takeoff document/schema2. Full original file SHA256s, all protected settings and entire takeoff document match after QA. No QA objects/files committed. No data migration, drawing engine, account/token/identity or updater policy change.
- Token APK stays on PC at2.1.33/code61 per user instruction; no Play/token APK rebuilt/uploaded and no server/account actions. Public employee distribution remainsv2.1.33. For a future new official binary use a code higher than installed local62 as needed; do not overwrite the existingv2.1.33 tag/assets.
- Workspace evidence: ../artifacts/toolbar-adaptive/{before-employee.json,layout-qa.json,final-preservation.json,automated-tests.log,android-github.log,release-verification.log,native-cover-display.png,final-report.json}. Repro helpers: ../.diagnostics/build-toolbar-adaptive.ps1 -Release -Install; toolbar-adaptive-qa.mjs; toolbar-adaptive-preservation.mjs. Helpers use only explicitserial5570 and existing employee signature; no uninstall. Final local APK/version/hash and source commit are in final-report.json. ProCad/other emulator instances untouched.


## Historical publication checkpoint: 2.1.33 (61) — employee release candidate, 2026-11-21 Asia/Seoul

- User explicitly authorized official GitHub APK + matching source publication and retention of existing updates/data. Google Play publication remains out of scope.
- Initial state: clean `feature/concrete-takeoff`, HEAD `77523caec40aa9c46f8c1b3b4c281b31d5fd2079`, local2.1.33/code60. Latest public release/main of both repositories was2.1.30/code57 at `d61b27f03d4ce6e9d1b827f7e1213dbb492030bc`; no existing v2.1.33 tag. No reset/stash or old ZIP used.
- Final package/versionName remains2.1.33; release-config Android code61 allows updates from previous internal60 and public57. Existing employee signing certificate/package and GitHub update endpoints are unchanged. Current source commit: `git rev-parse HEAD`; the release asset `release-info.json` records the exact binary/source commit.
- New focus control **도면 객체에서 색상 선택** closes the panel and accepts a CAD tap. Empty pixels retry; cancel/tool reset exits. Original CAD hidden disables picking. It adds the original RGB to keepColors without creating a takeoff object or consuming tokens.
- `cadColorPick.ts`: fixed25x25 offscreen render using a cloned orthographic camera, original per-draw uniforms, existing instance/XCLIP/hatch shaders, transparent background and a12px nearest-pixel radius. SVG markup is excluded; masked original fragments are rejected. Renderer/camera/clear/focus state is restored in finally, and the target is disposed. No reconversion, geometry mutation, continuous GPU readback or drawing-size allocation.
- Selected object's **적산 레이어** dropdown changes only layerId through `moveTakeoffToLayer`. Coordinates/specifications/labels/active drawing layer remain intact. Existing region/type visibility is honored, hidden destinations clear selection with an explanation. Regional/displayed totals update; full volume is unchanged. Same persistence/history provides Undo/Redo/reopen.
- DB/document schema remains2; no new migration. Existing v1-to-v2 takeoff migration remains. Original files, general annotation storage and commerce/OAuth are untouched.
- Automated **443 Vitest +38 Node =481 PASS**, both Android debug variants22 tests PASS. Added original RGB/black/empty/masked pixels, original-color sampling/restoration on errors, transfer/hidden target/history/reopen tests and distribution-only APK workflow guard. TypeScript build and signed local Release asset/font/WASM/4ABI/16KB checks pass.
- LDPlayer9.5.15.1 instanceLDPlayer-8 / emulator-5570, Android9/WebView124, native CSS1200x516 in this run: actual touch RGB selection under purple takeoff boundary returns original green, not gray/overlay; blank retries and cancel works. Wall/slab transfer only changes layerId; hidden transfer/Undo/Redo/reveal totals0.000/22.800m3; actual process stop/restart/reopen restores all fields and22.800m3.
- Actual COVER109,211 and BASE472,260 entities: create wall, toggle compact labels, hide/reveal original with overlays retained, pick a visible original CAD color (#808080/#00ffff) and save it. Original prior documents restored. Measurement geometry contains some clipped-out endpoints; selecting those correctly returns no visible color. Tests use a rendered CAD pixel instead.
- Additional rendered DXF: two block instances including30-degree rotation return#0000ff; solid hatch interior returns#00ff00 while focus is gray.
- After guarded removal of only uniquely identified QA files/objects: employee33 files/188,521,125 bytes/27 protected settings/1 takeoff document, staging3 files/38,881,883 bytes/6 settings/1 takeoff document match fresh baselines. Every original file SHA256, annotation/units setting and entire takeoff document matches. Existing staging authenticated session survives update/restart, FREE76/paid0/debt0 unchanged; billing remains disabled. No new interactive login or payment.
- Release workflow now skips APK jobs in ArcadView-Source; identical source tags do not build APKs there. ArcadView retains its existing tested draft recovery, four verified release assets, public corresponding-source check and automatic updater.
- Publication procedure after this tested checkpoint: commit; `powershell -File scripts/publish-version.ps1` pushes matching source/tag first, then distribution main/tag; monitor Android Actions to a published release; anonymously download/verify all four assets and signatures/version; test real AppUpdates detection/download/Android upgrade from the previous internal60 without uninstall; compare preserved data again. These post-publication outcomes are recorded in the workspace final report, not claimed as already passed here.
- Evidence and final report: `../artifacts/takeoff-release2133/` (core-qa.json, dwg-qa.json, block-hatch-qa.json, staging-session.json, final-preservation.json, automated-tests-final.log, build logs, later final-report.json). Helpers under `../.diagnostics/takeoff-release-*`; employee CDP16601, staging16602, always explicit ADB serial. SDK36/JDK21 and both existing signing keys reused. ProCad/other emulator instances untouched.
- Remaining after release: physical phone/tablet field validation. This work does not claim testing on physical hardware, store rollout or actual takeoff charging.


## Historical internal checkpoint: 2.1.33 (60) — 2026-11-21, Asia/Seoul

- Baseline clean feature/concrete-takeoff at933d074cb118c2f3c2add05103c8daa6b86a2c54, package2.1.32/code59. New unpublished development version2.1.33/code60. No remote push/tag/release or Play publication.
- Object labels now show one 10px volume line in a22px-high box (typical64–80px width; prior box49px high with two-line formula). Short IDs appear only on selected objects. Full formula remains in SVG title, and specifications remain accessible in selected-object editing. Label drag behavior/world coordinates unchanged.
- Always-available 물량 toggle beside compact takeoff status hides all object label boxes/text/leaders/IDs while keeping paths/fills/handles and totals. Toggle state is saved per drawing. Individual label.visibility and manual positions remain intact, including across global off/on and restart.
- Schema/DB remain2. Optional options.labelsVisible defaults to true when absent in old documents; new documents explicitly save true. Invalid values are rejected. No original drawing, account, ordinary annotation, geometry/specification or billing changes.
- Automated **438 Vitest +37 Node=475 PASS**, Android22 PASS. New tests check label size/full formula, legacy missing flag, global/per-object visibility, unchanged geometry/totals and saved toggle state.
- LDPlayer actual input:3 small labels; global off/on, per-object hidden state, small-label dragging, real process restart/reopen and restored hidden state; total22.800m3 unchanged. Actual COVER109,211 and BASE472,260 entities:22px label and toggle preserve takeoff graphics. Original test overlays restored/removed afterward.
- Phone-portrait360x616 and tablet960x600 WebView viewport emulation confirm toggle and Finish fit during drawing; native640x336 restored. These emulated checks do not claim physical tablet validation.
- Staging update preserves authenticated Google session after restart, free76/paid0, usage0, billing disabled. No new interactive sign-in or purchase run.
- Existing employee33 files/27 settings/1 takeoff document and staging3 files/6 settings/0 takeoff documents match initial backups after QA cleanup. All original file SHA256s and takeoff data preserved.
- Build/verification uses ../.diagnostics/build-takeoff-labels.ps1 -Install -Release, original JDK21/SDK36/signing. Debug and signed local Release assets/fonts/WASM/ABI/alignment match; Release inspection remains disabled. Version override60.
- Evidence/APKs/source/final hashes: ../artifacts/takeoff-labels/final-report.json. QA helpers: takeoff-labels-qa.mjs, takeoff-labels-resume-qa.mjs, takeoff-labels-dwg-qa.mjs, takeoff-labels-responsive.mjs, takeoff-labels-play-qa.mjs, takeoff-labels-cleanup.mjs. All are workspace-only. Initial restart harness was too early for the home library button; waiting for readiness and reopening through the actual home button resolved it without app changes.
- Current final feature commit: git rev-parse HEAD. Public distribution remains unchanged; publication needs separate approval. Physical device field testing remains next.

## Historical checkpoint: 2.1.32

### Current: 2.1.32 (59) — 2026-11-21, Asia/Seoul

- Baseline for this update: clean feature/concrete-takeoff at 61c563a54e39a1704c0d019e1b1fe0bf522f7fbb, version2.1.31/code58. Branch reused; no reset/stash/user-work overwrite. New package/lock/release-config version2.1.32/code59.
- Current source commit: use git rev-parse HEAD. Final APK/source hashes and commit are in ../artifacts/takeoff-layout/final-report.json.
- Internal build only. No push/tag/public GitHub release/Google Play rollout authorized. Keep existing public release/update service unchanged. ProCad remains excluded.

#### UX and layer changes

- Header 44 CSS px excluding safe inset; total card width174 expanded /166 collapsed and 34px collapsed height. Clear fold/unfold chevron; saved state. New documents start collapsed. Existing saved fold preference retained.
- Portrait compact status is at left10, Undo/Redo above it. Landscape width>=620 puts compact status via React portal after the cancel X. Main takeoff toolbar uses available width up to920, with middle tools still scrolling on narrow screens. Ordinary drawing mode keeps its original toolbar ownership.
- Panel starts closed; main tools and focus-color controls are at the top. Less-frequent unit/snap/member visibility settings fold below them. Unknown units open settings and still block finalization.
- Focus means colors only: all CAD gray unless its exact original display color is selected in the visible palette. Legacy keepLayers values are retained in data but do not preserve CAD colors anymore. Shared shader uniforms/callbacks are restored after each draw/when leaving focus.
- Original CAD toggle uses canvas opacity and skips WebGL render, preserving pointer events, overlays and two-finger pan. DrawingViewer uses empty CAD targets for normal picks and move-contact snaps while original is hidden. Takeoff and visible ordinary-annotation snaps still work. Leaving takeoff restores CAD; stored hide preference applies next entry.
- Layer window has shared Drawing/Takeoff tabs. Ordinary annotations retain their own storage/visibility and appear or hide in takeoff. Takeoff region layers have id/name/visibility, selected layer, counts/length/area/volume, rename/add/delete confirmation. One region can contain wall/beam/slab types. Type colors remain independent. Badge displays current takeoff layer and compact button shows its name.
- New TakeoffLayerRow keeps a local name draft until blur/Enter, avoiding async storage locks dropping typed characters. Layer selection, visibility and deletion use the same takeoff history, with quantity/geometry restored by Undo/Redo.

#### Schema2 and preservation

- DB arcad-concrete-takeoff **v2**, document schemaVersion2. New fields: layers[], activeLayerId, each object.layerId, options.cadVisible. Three kind groups still exist and ordinary 3-layer limit is unchanged.
- IDB upgrade cursor migrates all v1 documents in the version-change transaction. Every legacy object enters takeoff-default / 적산1; coordinates/specs/IDs/labels/identity/unit/previous visibility/quantities remain intact. Any invalid document aborts the entire upgrade, retaining v1 data; no partial overwrite or deletion.
- Aggregate totals contain member groups and region layers. Full total includes hidden data. Displayed volume intersects region visibility AND member visibility. Hidden regions do not render or contribute snap targets.
- Existing employee state before update: 33 drawings,27 protected settings,1 v1 takeoff document. Original file SHA256/settings and expected v1->v2 takeoff content match after testing/QA cleanup. Staging:3 drawings/6 settings, existing Google session preserved. Baselines and QA backups are local, outside source ZIP.

#### Verified

- Automated: **436 Vitest +37 Node =473 PASS**, Android unit tests22 PASS. Includes regional quantities/hide/Undo, v1 model migration, atomic DB upgrade and rollback on corrupt legacy input. Existing geometry, CAD/runtime, safe-area and release tests pass.
- Actual LDPlayer-8 / emulator-5570, Android9/WebView124: two regions 2동1·2호=19.200m3, 2동3·4·5호=3.600m3, total22.800m3. Layer hide keeps total and removes hidden geometry/snaps; drawing-tab visibility remains applied; delete/Undo/Redo and selected-region total pass. Real process restart restores regions/names/specs/coordinates/options/quantities.
- Actual WebGL: all original colors gray when none selected; selecting red keeps red only, other CAD colors gray. Original-only hide retains takeoff/ordinary overlays, disables hidden CAD snaps and keeps touch pan. Exit/restore does not reload geometry.
- Actual COVER109,211 entities and BASE472,260 entities: create temporary takeoff wall, hide CAD retaining label/line, restore CAD without reconversion. QA overlay removed and prior takeoff document restored with guards.
- Actual native portrait360x616 and landscape640x336: header44, collapsed summary166x34, status/dock positions correct. Native LDPlayer rotation button through computer-use skill, then original landscape restored.
- Tablet960x600: WebView CDP viewport emulation only, not physical tablet hardware. Card remains narrow, toolbar expands to920, all tools fit, status stays after X. Native viewport restored.
- Staging updated to2.1.32(59) using its pre-existing debug cert; authenticated Google session survives real restart; free76->76, paid0->0, usage0, billing remains disabled. No new interactive sign-in/purchase tested.
- Android Debug/signed local Release builds and artifact asset/font/WASM/ABI/16KB alignment verification pass. Release launch/signature/non-debuggable WebView checked; final Debug restored for continued local inspection.
- QA script corrections: a normal-polyline test point was under its existing status card (moved unobscured); generated DXF omitted layer tables, so shader-color assertions were corrected to inspect colors rather than undefined layer names. Neither required a CAD math change.

#### Reproduce / artifacts

Workspace helpers: ../.diagnostics/build-takeoff-layout.ps1 -Install -Release; takeoff-layout-qa.mjs (fresh full run), takeoff-layout-resume2-qa.mjs (continuation evidence), takeoff-layout-history-qa.mjs, takeoff-layout-responsive.mjs, takeoff-layout-tablet.mjs, takeoff-layout-dwg-qa.mjs, takeoff-layout-play-qa.mjs, takeoff-layout-cleanup.mjs. All test data is uniquely named/guarded. Do not rerun cleanup against unknown object IDs. Scripts/evidence remain outside public source.

From repo, with existing JDK21/SDK36/signing environment:

```powershell
npm.cmd test
npm.cmd run android:prepare
.\android\gradlew.bat -p android assembleDebug testDebugUnitTest assembleRelease -PIZCAD_VERSION_CODE=59 -PARCAD_DISTRIBUTION=github --console=plain
node scripts/verify-android-release.mjs android/app/build/outputs/apk/release/app-release.apk
```

No credential/engine/library version changes. Current Android versionCode59 is larger than prior local58/public57; public release links remain unchanged. Full source ZIP comes from the final local commit, excluding drawings/keys/APKs. Physical phone/tablet hardware validation remains next; takeoff billing/publication still require separate approval.

### Historical checkpoint: 2.1.31 (schema1)

The following records describe the previous build. Use the current schema2 and version59 instructions above for new work.

#### Project and version — 2026-11-21 (Asia/Seoul)

- Repository: D:/GUI_Arc/GUI_Arc_Arc view/izCAD. Preserve its izCAD DWG/DXF engine. The sibling ProCad project is excluded.
- Baseline: clean main, HEAD d61b27f03d4ce6e9d1b827f7e1213dbb492030bc, package/versionName 2.1.30, Android versionCode 57, latest local/public tag/release v2.1.30. No tracked unfinished user changes existed. Do not replace with old v2.1.19 ZIP.
- Current branch: feature/concrete-takeoff; development version **2.1.31 (58)** in package.json, package-lock.json, release-config.json and generated Android metadata. Run git rev-parse HEAD for final local commit; parent is the baseline above.
- No push/tag/public GitHub release/Play rollout authorized. CHANGELOG marks this unpublished. Public release notes/download links remain v2.1.30. Internal APK/source/evidence: ../artifacts/takeoff-development/.

#### Implementation complete

- src/takeoff/model.ts: independent wall/beam/slab groups, original world coordinates and mm specifications, derived quantities. Reuses pathLength, polygonArea and UNIT_METERS. mm/cm/m/in/ft; unknown unit blocks finalization. Validates finite ranges, duplicate/short edges, zero area, polygon crossings/overlaps. Polygon closure is implicit in storage. Immutable geometry quantity cache avoids revalidation per pan frame.
- src/components/TakeoffEditor.tsx: snapped path/polygon, Finish then specification confirmation, prior-spec proposals, height m/mm, spec edit, vertex drag/insertion/removal, rigid movement, label drag/hide, deletion and independent UndoHistory. No commerce gate or usage calls.
- src/takeoff/overlay.ts + takeoff.css: bright rails/dark halo/hollow circles/small white centers, translucent slab fill, screen-size formula labels and short IDs. Path labels use cumulative half-length; concave polygon label uses an interior scanline. Compact tools and collapsible top-right full/visible totals; portrait/landscape layout.
- src/takeoff/cadFocus.ts: display-only per-draw shader uniform overrides; keep chosen CAD layers OR colors, gray others; restore shared materials/callbacks on exit. No DWG conversion/geometry mutation, original colors/XCLIP/layer visibility/snap retained.
- DrawingViewer.ts: annotation input ownership isolates ordinary and takeoff editors; supplemental takeoff snapping only in active takeoff editing. Existing CAD projection/geometry/move-contact snaps reused.
- DrawingCanvas.tsx/App.tsx/ViewerToolbar.tsx: scrolling takeoff action, active command/history routing, original identity metadata, safe mode exits. Ordinary three-layer limit remains independent.

#### Storage and policy

- Separate IndexedDB **arcad-concrete-takeoff v1**, store documents keyPath drawing.key; nonunique drawingName index. No migration/deletion of ordinary drawing/library/account data.
- Identity reuses original DWG v1 fingerprint from drawingUnitPreferences: versioned size header plus ordered 1 MiB SHA-256 chunk hashes, then SHA-256. Every byte participates. Generated DXF retains original identity. Name/timestamp do not determine identity.
- Store schema, original drawing metadata, source unit, groups/colors/visibility, object IDs/coordinates/specifications/labels, previous specs and display options. Derived values are never persisted separately.
- Same-name/different-content asks confirmation; old data stays with original fingerprint. Acknowledgment is durably saved even for an empty new document and survives restart.
- Transaction completion is save ACK. Only then promote state/totals. Failure retains prior values and displays retry/cancel. Corrupt/unsupported data fails without overwriting.
- Local arcad:takeoff-completed post-save event is an isolated future hook. No real debit, authentication gate or billing integration. Actual Play billing remains disabled; OAuth/Cloudflare/server DB/signing keys unchanged.
- QA data on actual DWGs used arbitrary test specifications, NOT an actual project BOQ. Only known QA fingerprints/object IDs were backed up and removed afterward. Final employee library **33 files / 188,521,125 bytes**, all file SHA-256 values and **27 exact settings** match baseline. Staging's 3 drawings/session/journal preserved.

#### Automated verification

- Baseline 415 Vitest + 37 Node = 452 PASS.
- Final **432 Vitest (71 files) + 37 Node = 469 PASS**, including 17 new takeoff cases. final-tests.log.
- W01 20m*3m*200mm=12.000m3, W02 10m*3.2m*250mm=8.000m3; wall 30m/20.000m3. B01 12m*300mm*600mm=2.160m3. S01 40m2*180mm=7.200m3. Overall **29.360m3**.
- Unit conversions, winding/closure/multiple segments/large coordinates, concave label, self intersections/invalid input, spec/vertex/delete/history/hide totals, storage reopen/isolation/revisions/quota/write failures, no billing request, shared shader restoration and handle placement covered.
- Android testDebugUnitTest **22 PASS**: 8 block pruning, 7 incoming filenames, 7 update rules. android-github.log and Android test-results XML.
- android:prepare (TypeScript/Vite/Capacitor/source checks), assembleDebug + signed local assembleRelease PASS. Artifact verifier: exact production web assets, offline fonts/WASM/licenses, no source maps, four native ABIs and 16KB ELF/ZIP alignment PASS. Gradle deprecation/Vite chunk warnings are retained in logs; no dependency upgrades were performed.

#### LDPlayer verification (actual device, separate from unit tests)

- LDPlayer9 **9.5.15.1**, instance **LDPlayer-8**, ADB **emulator-5570**, Android9/API28, WebView124. Portrait1080x1920/CSS360x616 DPR3; landscape CSS640x336. All ADB explicitly target this serial. Do not touch LDPlayer-9 or ProCad.
- core-results.json / known-quantities.json / restart-restoration.json: UI points+specs yield 29.360m3; hide leaves full total; real process kill/restart restores geometry/specs/labels/totals.
- edit-results.json: specifications, insertion/removal/vertex/label/rigid move, deletion/Undo/Redo; injected quota failure retains saved state and visible retry; self-crossing rejected; actual WebGL layer/color filter and original restoration; no JS errors or usage calls.
- dwg-results.json: actual izcad-cover.dwg **109,211 entities** and izcad-base.dwg **472,260 entities**. Create 2 walls/beam/slab, CAD endpoint/perpendicular snaps, computed/rounded totals, two-finger pan/projection registration, filter without reconversion, actual restart/reopen equality. COVER sample 1.0815162885677485->1.082m3; BASE 0.15008001957715986->0.150m3. Test overlays cleaned afterward.
- identity-results.json: same-name changed-content confirmation, old data preserved, durable acknowledgment, unknown units block, explicit units and change confirmation/cancel/recompute/Undo, restart restore.
- regression-results.json: normal aligned CAD measurement 12,000mm; ordinary numeric polyline+Undo/Redo; 3 ordinary layers separate from 3 takeoff groups; correct active history. Ordinary settings/operation journal restored.
- responsive-results.json and 06-/07- screenshots: real portrait/landscape layouts inside viewport above toolbar. Native rotate button through computer-use skill; original portrait restored. Android user_rotation setting alone did not rotate LDPlayer and was restored; native toolbar resolved the test.
- play-results.json: staging com.guisarc.arcadview updated without uninstall, existing Google session authenticates after real process restart. Free **76->76**, paid **0->0**, plan/session digest/3 drawings/measurement journal preserved. 12m3 takeoff produces **zero usage requests**. Billing false. **Fresh interactive Google sign-in/account selection NOT RUN** (existing authenticated session reused). No purchase activated/tested.
- cleanup-results.json: original employee files/settings byte-identical; only task-owned QA data removed. No physical phone or Play rollout tested.

#### Resolved issues from QA

- Label leader's transparent bounds intercepted vertices -> hit-test actual label rect.
- Offscreen labels left empty SVG hit targets -> only create actual visible label groups and guard missing label rectangles. New overlay culling regression and actual LDPlayer offscreen-label vertex drag/Undo/pan-back pass (offscreen-label-results.json), with no JavaScript errors.
- Bottom-clamped movement cross covered a vertex -> fallback non-overlapping above/side position.
- Stale ordinary Undo state crossed modes -> owner/history callback guard with correct restoration.
- Revision acknowledgment repeated after restart -> persist new empty document.
- Ordinary measurement regression tap hit bottom status UI -> recenter fixture and verify 12,000mm via actual unobscured endpoints; no CAD math change.
- Initial staging replacement correctly failed UPDATE_INCOMPATIBLE because installed app used another existing debug cert. No uninstall/reset. Reused existing default user debug key and installed matching signed debug artifact; data/session preserved. No key generated/modified.

#### Reproduction and artifacts

- Node24.18/npm11.16; JDK21 ../.build-tools/jdk21/jdk-21.0.13+9; SDK/API36 D:/GUI_Arc/tools/android-official-release-v020/sdk; existing ../.build-tools/gradle-home.
- From repo: npm.cmd test; npm.cmd run android:prepare; then with existing environment/signing configured:

```powershell
.\android\gradlew.bat -p android assembleDebug testDebugUnitTest assembleRelease -PIZCAD_VERSION_CODE=58 -PARCAD_DISTRIBUTION=github --console=plain
node scripts/verify-android-release.mjs android/app/build/outputs/apk/release/app-release.apk
```

- Workspace helper ../.diagnostics/build-takeoff.ps1 -Release sets existing environment and saves logs/APKs; -Install uses adb -s emulator-5570 install -r only, never uninstall. Debug inspection only; Release WebView debugging disabled.
- Employee com.izcad.viewer existing cert SHA256 60e2731fb432e7ed0cde34f255ea42a9faea115131346cbf08ff0b8b5afaccd1. Staging com.guisarc.arcadview existing user debug cert SHA256 ebb661dde5bf5020e5bddc56952e93a040baf0193d90f2186c5262e5934e9be8. Play upload key/DPAPI material excluded. Do not uninstall on signature mismatch.
- CDP employee16601/staging16602; after restart forward to localabstract:webview_devtools_remote_<confirmed package PID>.
- Workspace-only helpers: takeoff-qa.mjs, takeoff-edit-qa.mjs, takeoff-dwg-qa.mjs, takeoff-identity-qa.mjs, takeoff-play-qa.mjs, takeoff-regression-qa.mjs, takeoff-landscape-qa.mjs, takeoff-cleanup-qa.mjs; ld-cdp.mjs/guest-policy-common.mjs. They are outside app source. Start a new QA baseline for a fresh run and update dependent artifact keys; never run reset/cleanup against unknown IDs.
- Final APK/source paths, hashes, feature commit and complete test summary: **../artifacts/takeoff-development/final-report.json**. Source ZIP is the full local committed version; no drawings, keys or session secrets.

#### Next work

- Core requested scope implemented and locally verified. Read docs/CONCRETE_TAKEOFF.md and CHANGELOG2.1.31.
- Physical phone field trial: long-press snaps, dense labels, large object counts, keyboard/rotation, storage pressure and project-specific depth conventions.
- Intentional limits: no automatic intersection/overlap/opening deduction, complex label collision avoidance, JSON/cloud backup, reinforcing/BIM, new payment or CAD engine replacement. Result is pre-deduction approximate concrete volume.
- Agree separately on takeoff entitlement/debit policy before connecting the completion hook. Obtain explicit approval before public GitHub release or Google Play publication.
