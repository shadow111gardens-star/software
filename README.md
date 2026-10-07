# Anime Cursor

Step 11 adds Windows NSIS and macOS DMG packaging with the **Build Desktop** GitHub Actions workflow. See [DESKTOP_BUILDS.md](DESKTOP_BUILDS.md) for commands, artifacts, validation and unsigned development build limitations.

Phase 1, Steps 1 through 10: offline desktop foundation, local character assets, real OS cursor tracking, transparent overlay the 16-state cursor engine and local application flow. Electron main, bundled sandbox-compatible preload, React renderer, shared settings types, and local storage are separate modules.

## Commands

- `npm ci` installs locked dependencies (internet required for initial installation).
- `npm run dev` builds main/preload once and starts Vite plus Electron. Restart after main/preload edits; renderer changes use Vite HMR.
- `npm run typecheck` checks strict TypeScript.
- `npm run build` creates production files in `dist/`.
- `npm start` opens the production build.
- `npm test` runs character, cursor, companion, state-engine and local-flow unit tests plus storage checks.
- `npm run test:electron` verifies real image decoding and all 16 assets through the sandboxed preload bridge using temporary technical fixtures.
- `npm run test:cursor` runs cursor lifecycle, coordinate, display and error-handling tests.
- `npm run check:cursor` opens an unpackaged diagnostic window for 45 seconds, logs real desktop samples, checks stop cleanup, and exits. Move the mouse and switch apps during the check.
- `npm run check:storage` verifies persistence and settings validation in a temporary directory.
- `npm run smoke` opens the production window, checks React/preload/renderer isolation, then exits.

No lint configuration exists. Windows portable packaging uses the existing Electron runtime: run npm run build, then node scripts/package-windows.mjs. Open release/AnimeCursor-win32-x64/AnimeCursor.exe with the complete folder intact. This is an unsigned portable application, not an installer; code signing and macOS runtime validation remain unavailable. See PHASE_A_TESTING.md for the final QA matrix and limitations.

Settings persist as validated JSON under Electron's per-user `userData/settings/settings.json`, through a serialized, atomic-write service. Schema version 1 wraps the shared AppSettings model. Missing files receive defaults; legacy, empty, malformed and partial documents are repaired field by field. Original documents are preserved as settings.recovered-*.json, and settings.json.bak keeps the preceding successful commit for malformed-JSON recovery. Valid values survive repair. The authoritative main-process memory cache applies validated appearance changes immediately; writes are serialized, flushed and atomically renamed. First launch shows exactly three onboarding screens. Start Companion selects Aiko, saves completion and opens Home. Skip Setup also saves completion and opens Home; it preserves an existing selection and starts the companion when automatic startup is enabled. Settings > Restart Setup explicitly resets completion, stops the overlay during setup, and opens screen 1 while preserving appearance preferences. Later launches automatically start the companion only when onboarding is complete, companionEnabled is true and automatic start is enabled. Start minimized is an application launch preference, not Windows login startup.

Windows/macOS cursor adapters and overlay are implemented. A shared Electron TrayAdapter provides Windows tray and macOS status-item actions. OS login startup remains unavailable. No cursor icon is changed, hidden, replaced, or drawn.

Renderer has no Node access. IPC is restricted to the main window's top frame and specific typed operations. Permissions, new windows, navigation, and remote requests are denied. Development allows only the local Vite server. Production requires no network.

The character system discovers and validates `dist/assets/characters/*/manifest.json` at startup. Source packs belong under `src/assets/characters/`; build/dev startup copies those packs to runtime output. Pack filenames are preserved. See `src/assets/characters/README.md` for the contract and limits.

Exactly 16 states are defined once in `src/shared/constants/cursor-states.ts`. `CharacterPackLoader` rejects invalid, incomplete, undecodable, incompatible or duplicate packs individually. `CharacterManager` selects one valid active pack and persists it through the existing settings store. Aiko is a bootstrap preference, not engine logic; the next deterministic fallback is the first character id in lexical order. Runtime asset failure logs its cause and falls back to normal, then null if normal also fails.

Renderer access uses `window.animeCursor.characters`: list/catalog, get, has, active, activate, and getStateAsset. Assets return PNG/JPEG data URLs instead of absolute paths. The Characters page uses this existing manager through the shared local-flow service. Diagnostics are grouped under Settings > Advanced during development.

Aiko is installed with the 16 user-supplied PNGs and `aiko/manifest.json`. Original image bytes and filenames are preserved. The manifest uses the supplied image order for the 16 state mappings. `npm run smoke` decodes every installed state asset in the sandboxed renderer. Unit-test fixtures remain temporary technical images. Step 5 switches the active pack's state assets in the existing overlay.

## Real cursor tracking

`WindowsCursorAdapter` and `MacOSCursorAdapter` use Electron's main-process `screen.getCursorScreenPoint()`, backed by Chromium's Windows `GetCursorPos` and macOS `NSEvent.mouseLocation`. These read the global OS cursor regardless of application focus. No browser pointer events, global input hooks, event taps, or input interception are used. Electron exposes no cursor-motion event on screen, so a controlled polling timer is used rather than installing a global hook.

One shared polling implementation and `CursorTrackingService` manage start/stop, duplicate-start protection, error reporting, subscriptions, and disposal. Default interval is 16 ms, configurable through the adapter constructor / `createCursorTracking(intervalMs)` from 8 to 1000 ms. Samples refresh the latest timestamp; movement, display or scale changes emit updates to main-process subscribers. Stationary samples produce no movement callbacks. Overlay positioning uses the shared cache/subscription in main without movement IPC.

Coordinates are absolute desktop **device-independent pixels (DIPs)**, with the primary display's top-left at (0,0), x increasing right and y down. Left/above displays can have negative x/y. `displayId`, `scaleFactor`, `timestamp` (Unix milliseconds), and source accompany each sample. Electron performs Windows physical-pixel conversion and macOS coordinate normalization. Do not multiply absolute desktop coordinates by a monitor's scale factor; that breaks mixed-scale layouts. Use Electron's screen/DIP conversion APIs behind the adapters if physical coordinates are needed later. Display identity and scale are refreshed from Electron on every sample, so topology changes do not use a stale monitor cache.

The service starts after Electron is ready, stops on suspend, resumes only if it was active before suspend, and disposes polling/subscriptions and power-monitor listeners on app quit. A stopped/error snapshot can retain the last position; consumers must check status and timestamp rather than treat it as live. Explicit subscriber removers/unsubscribe stop individual consumers; disposal removes all consumers. Failed native reads stop tracking and report an error; start can be retried. Unsupported platforms report unsupported without fabricated coordinates.

Only development and explicit unpackaged validation runs expose cursor snapshots and start/stop controls through the sender-checked preload bridge. The development panel polls at most 4 times per second, with one outstanding request; there is no 60 Hz IPC stream. Normal `npm start` and packaged production hide the panel and deny debug controls. Production tracking itself still runs in main. Semantic detection is separate from movement; speed and direction never select a semantic state.

macOS implementation compiles and uses the same native location-only API. It installs no event tap or global input monitor and requests no Accessibility/Input Monitoring permission. Runtime and permission behavior must still be verified on a Mac, especially under managed/restricted sessions. No privacy restrictions are bypassed. OS lock screens, Windows secure desktop, exclusive capture/relative-pointer games, remote sessions and platform-native failures may restrict or alter the reported position; Electron may not surface every native failure as an exception. No application-specific guarantee is made for those environments.

Windows cursor tracking checks passed at 125% scaling, including movement while unfocused and user-confirmed testing across desktop, Explorer, Chrome and VS Code. Physical multi-monitor/mixed-DPI and macOS runtime tests remain outstanding. See the Step 4 and Step 5 reports for overlay/state validation. Recommended next step, only when requested: Step 7 - UI/UX Polish.

## Transparent companion overlay

Run `npm run build` then `npm start`, and complete the three-screen onboarding, then use Home or the tray to control the companion. Stop destroys the overlay; Hide pauses movement while retaining the same window; Show resumes it. Quit app cleans up both windows and tracking. Closing the main window leaves a running companion alive; launching Anime Cursor again reopens its controls through the existing single-instance mechanism.

A separate sandboxed renderer shows the active state image from CharacterManager. Its small transparent, frameless, non-focusable BrowserWindow ignores mouse events and uses floating always-on-top ordering. Main handles aspect sizing, configurable offset/smoothing and current-display edge clamping in logical/DIP coordinates. The real OS cursor remains unchanged. State, character and settings changes reuse the same window.

- `npm run test:companion`: geometry, smoothing, lifecycle, errors and cleanup unit tests.
- `npm run smoke:overlay`: production Electron transparency, image, Windows flags, isolation, restart, main-window independence and crash-cleanup checks.
- `npm run check:overlay`: builds and opens a 60-second interactive cursor/overlay check, then verifies cleanup and exits. Test clicking, dragging, scrolling and text selection beneath the character while switching applications. Output is saved in `dist/validation/`.

See [STEP4-REPORT.md](STEP4-REPORT.md) for the original overlay implementation and [STEP5-REPORT.md](STEP5-REPORT.md) for current state-engine behavior and validation.

## 16-state cursor engine

Windows matches the global cursor handle from GetCursorInfo to predefined handles from LoadCursorW. A small read-only C# helper samples semantics every 50 ms, reporting changes plus a one-second heartbeat; its position fields are ignored. Electron remains the sole cursor-position source. Recognized native cursors use their matching state; only the recognized default arrow uses normal. Unknown/custom/ambiguous/hidden cursors, stale samples and native failures use extra. Mac semantic detection currently supplies no reliable native classification, so it uses extra without guessing. All 16 states remain available through development overrides.

On Windows, `build:electron` also compiles `src/platform/windows/native/CursorContext.cs` to `dist/native/windows/cursor-context.exe` using the installed .NET Framework 4.x compiler. No npm native dependency or network operation is added. Windows runtime needs .NET Framework 4.x; future installer packaging must ship the helper outside an ASAR archive.

Use `npm run dev`, finish onboarding, then open Settings > Advanced > Development diagnostics. The State diagnostics panel supports AUTO, each authoritative state and Cycle 16 states. Overrides are memory-only, reset on Stop and denied in normal production launches. Returning to AUTO immediately restores the latest reliable platform state. Production exposes no state test panel.

- `npm run test:state`: state priority, validation, fallback, caching, asynchronous races and lifecycle tests.
- `npm run smoke:state`: renders and verifies all 16 original assets in one production overlay through explicit unpackaged test mode; checks AUTO, native flags and restart cleanup.
- `npm run check:state`: builds, verifies all 16 assets, then opens a 60-second AUTO test for real application contexts. Logs and screenshots go to `dist/validation/`.

Step 6 is implemented; Step 7 and later steps remain outside the current scope.

References: [Electron screen API](https://www.electronjs.org/docs/latest/api/screen), [Chromium Windows screen source](https://raw.githubusercontent.com/chromium/chromium/main/ui/display/win/screen_win.cc), [Chromium macOS screen source](https://raw.githubusercontent.com/chromium/chromium/main/ui/display/mac/screen_mac.mm).


## Local app flow

Welcome - Choose companion - Start Companion opens the real overlay and then Home. Home, Characters, Store and Settings share one main-process LocalAppFlow; React receives snapshots and delegates actions. Installed packs appear automatically after discovery at app launch. Supplied Aiko artwork is unchanged.

Pause stops/destroys the companion overlay and semantic engine, and saves companionEnabled=false. Resume starts it safely without duplicate services. Hide retains the enabled companion and its window; Show restores its current character/state. Appearance changes update the existing overlay. Settings save on field blur.

The local Store has installed packs plus two clearly marked premium concepts with no artwork. Search, filters and details work locally. Buy displays "Purchases will be available soon. No payment was made." There are no accounts, payments, downloads or entitlements. All 16 detail state names use CURSOR_STATES.

Close hides the main window and leaves the tray and enabled companion alive. Tray actions reopen the app, show/hide or pause/resume the companion, change installed characters, open Settings, and Quit. Explicit Quit drains accepted settings writes and cleans up services/resources. Hide/Show survives launches as companionVisible. Pause/Resume persists companionEnabled and its canonical inverse companionPaused; resuming a previously hidden companion keeps it hidden. Hidden startup never shows the overlay window. Navigation returns to Home on launch.

- `npm run test:flow`: local-flow, migration, persistence, catalog, failure and cleanup unit checks.
- `npm run check:flow`: builds, then runs five isolated production Electron launches with network disabled. Exercises onboarding, UI controls, tray callbacks, close/reopen, appearance/selection persistence, enabled/paused relaunch and explicit Quit. A temporary second pack proves generic selection; it never enters the shipped catalog. Screenshots/results go to `dist/validation/`.

See [STEP6-REPORT.md](STEP6-REPORT.md) for implementation files, validation evidence and remaining platform checks. Stop at Step 6; Step 7 is not implemented.

Step 8 persists onboarding completion, activeCharacterId, companionEnabled/Visible/Paused, characterSize, cursorOffset x/y, opacity, smoothing, startCompanionAutomatically and startMinimized. Installed manifests remain the character source of truth; no PNG bytes, cursor coordinates, semantic cursor states, handles or runtime/debug objects enter settings. Disk migration lives in src/services/storage/app-state.ts. Storage and Electron validation use temporary profiles and do not modify real userData. No network service or dependency was added.

Step 9 completes the local Character Store: All/Featured/Free/Premium/Installed filters, case-insensitive search, sorting, installed character activation, locked concept cards and a product panel with all 16 original Aiko state previews. Every premium Buy opens the same Purchases coming soon dialog and leaves catalog ownership and persisted preferences unchanged. `npm run check:flow` includes network-disabled Store QA, all premium card/detail Buy buttons, zero HTTP/HTTPS requests or checkout windows, original PNG comparisons, three responsive sizes and an empty-installed-catalog fixture. See STEP9-REPORT.md for details.

Production HTML uses connect-src none and contains no development-server address. The Vite development policy is unchanged. The Windows packaged QA script pauses the executable using Electron's stock Node inspector, injects an isolated temporary userData path before startup, and tests the unchanged packaged application offline; it adds no production test API. Run node scripts/test-packaged-windows.mjs for packaged QA, or append --development while Vite is running to check the development code path.
