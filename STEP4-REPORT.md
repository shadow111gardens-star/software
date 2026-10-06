# Phase 1 — Step 4: Transparent character overlay

Implemented the local transparent companion foundation. Only the active character's **normal** state is rendered. No backend, state detection, final UI, or dependencies were added.

## Files created

- `src/shared/types/overlay.ts` — typed content, bounds, lifecycle and preload contracts.
- `src/engine/character/overlay-geometry.ts` — aspect sizing, anchoring, smoothing and display edge handling.
- `src/services/companion/companion-controller.ts` — single-overlay lifecycle and movement orchestration.
- `src/main/windows/overlay-window.ts` — secure Electron overlay adapter and restricted renderer IPC.
- `src/platform/macos/overlay-behavior.ts` — workspace/fullscreen behavior isolated for macOS.
- `src/main/companion/index.ts` — existing character/cursor/settings dependencies and control IPC.
- `src/main/companion/validation.ts` — real Electron smoke/live verification.
- `src/preload/overlay.ts` — image/readiness bridge only.
- `src/renderer/overlay/index.html`, `main.ts`, `overlay.css` — dedicated single-image renderer.
- `src/renderer/components/CompanionControls.tsx` — minimal Start/Stop/Show/Hide/Quit controls.
- `src/services/companion/companion.test.ts`, `scripts/test-companion.mjs` — 12 meaningful tests.
- `STEP4-REPORT.md` — this report.

## Files modified

- `src/main/index.ts` — controller integration, settings/character refresh, independent main-window lifecycle and validation entry points.
- `src/main/characters/ipc.ts` — notify companion after active character changes.
- `src/platform/types.ts`, `src/platform/windows/index.ts`, `src/platform/macos/index.ts` — concrete overlay capability/adapter contract.
- `src/shared/types/app.ts`, `src/shared/constants/ipc.ts`, `src/preload/index.ts` — typed, sender-checked companion controls.
- `src/renderer/App.tsx`, `src/renderer/styles/base.css` — minimal controls and readable button sizing.
- `src/renderer/index.html`, `src/renderer/main.tsx` — external stylesheet loading compatible with strict CSP in development and production.
- `scripts/build-electron.mjs`, `vite.config.ts` — separate sandbox preload and renderer build entry.
- `package.json` — companion test and overlay validation commands; dependency versions unchanged.
- `README.md` — current behavior and commands.

## Architecture and window configuration

CharacterManager resolves the current active pack and its normal image. CompanionController reads the existing validated settings, uses the existing CursorTrackingService, and drives ElectronOverlayAdapter. There is no second native cursor poll or character loader. A separate DOM-only renderer decodes the original image before showing it; movement causes no React renders or position IPC.

BrowserWindow is small, hidden until Start, frameless, transparent (`#00000000`), non-resizable, non-focusable, skipTaskbar, without shadow and without a parent. `showInactive()` avoids activation. `setIgnoreMouseEvents(true)` receives no forwarded mouse events. Always-on-top uses the modest `floating` level. CSS makes body/html transparent, removes margins and scrollbars, and applies two logical pixels of padding. No cursor API hides, changes or replaces the real system cursor.

The overlay has its own sandboxed preload/session. Context isolation, web security and sandbox remain enabled; Node integration is disabled. Permission requests, navigation, new windows and remote requests are denied. Only local files/data images and the exact local Vite server in development are permitted. The preload exposes content/readiness/failure reporting only; IPC checks registered overlay webContents and top-frame identity.

## Position, sizing and smoothing

The anchor is the outer window's top-left: raw cursor plus configured offset (default 20,20 DIPs). The image starts two DIPs inside it. characterSize controls its longest dimension (default 96); aspect ratio and all original transparent padding remain intact. For the 1268×1241 normal image, default artwork is 96×93 inside a 100×97 window. Image dimensions come from decoding the active asset, not Aiko-specific constants.

Main updates at 16 ms, consuming the shared authoritative cursor cache. Exponential interpolation uses elapsed time; default smoothing 0.5 gives a 30 ms time constant. Display transitions and jumps over 512 DIPs snap. Settled positions skip setBounds; hidden overlays stop movement timers/subscriptions. Smoothing is followed by work-area clamping so interpolation cannot leave the image beyond visible bounds.

Current-display workArea is selected from Electron screen using the global cursor point. Bounds flip left/above near right/bottom edges, then clamp inward. Left/above monitors and negative coordinates are supported. Sizing shrinks for unusually small work areas. Cursor, bounds, offsets and CSS dimensions remain logical/DIP; no absolute coordinate is multiplied by a scale factor. Electron handles native monitor scaling.

## Lifecycle

Concurrent Start requests share one operation. A generation guard cancels asynchronous startup; Stop destroys the window and clears movement timers/subscriptions. Hide/Show reuse one window. Tracking is stopped by the companion only when the companion started it; otherwise the shared app service stays available. App quit disposes the companion and cursor service. Load/preload failure, unexpected close or renderer crash destroys the overlay and reports an error; Start can retry.

Main-window close/hide leaves an active companion independent. Re-launching the existing single-instance app reopens the main controls. Explicit Quit cleans up the application. Existing character activation/settings saves refresh a running companion cleanly and preserve hidden status. companionEnabled is not used for automatic startup in this step.

## Validation results

- Strict TypeScript: passed through `npm run build`.
- Production build: passed, including both renderer entries and separate overlay preload.
- `npm test`: all 41 character/cursor/companion unit tests passed, plus storage validation. Twelve companion tests cover geometry/aspect/offset/edges/negative coordinates, smoothing, duplicate prevention, cancellation, stop/restart, hide/show, generic normal assets, character/settings refresh, errors and cleanup.
- Existing `npm run test:electron` and `npm run smoke`: passed.
- `npm run smoke:overlay`: passed in production. The same validation with `--development` passed against Vite.
- Real Electron decoded the original normal image, verified transparent computed styles and captured pixels with zero alpha in transparent corners and visible artwork alpha. Screenshot was inspected.
- Windows native extended flags were checked read-only on the overlay handle: layered, click-through (`WS_EX_TRANSPARENT`) and non-activating (`WS_EX_NOACTIVATE`) all true. Window focusability, visibility, always-on-top, no shadow and renderer isolation assertions passed.
- Hide/show, Stop/destroy, restart with one overlay, main hide/close independence, intentionally forced renderer crash/error cleanup, recovery and final cursor/window cleanup all passed. The intentional crash log is expected in these checks.
- A 60-second Windows live run recorded 298 overlay bound changes with moving real cursor at 125% scaling. One display: 1536×864 logical bounds, 1536×816 work area. This run did not record updates while the main window was unfocused.

The latest smoke run overwrites `dist/validation/overlay-result.json`; its zero movement count is expected for the short lifecycle check. The live-run observations above are from the preceding 60-second check.

## Performance and limitations

The live run used approximately 4.69 seconds of main-process CPU over 62.57 seconds including startup and validation (~7.5% of one core). This is a diagnostic observation, not an idle or long-session benchmark; renderer/GPU CPU and total memory were not measured. There is one existing native polling source plus a controlled interpolation timer, no busy loop, no per-frame image decoding, and no movement IPC. Idle frames skip actual window repositioning. Longer idle/moving CPU and memory profiling remains useful before final QA.

Manual clicking, scrolling, dragging and text selection beneath the character across Chrome, VS Code, Explorer and desktop are awaiting user confirmation. Native flags support the intended click-through/non-focusable behavior but do not replace that interaction test. The earlier Step 3 cross-app confirmation verified cursor tracking, not this overlay. Real cursor visibility and perceived smoothness likewise require visual confirmation during normal use.

Only one physical monitor at 125% was available. Negative/display-transition geometry is unit-tested; physical multi-monitor, mixed-DPI and 100/150/175% checks remain unverified. macOS compiles but has not been runtime-tested. Secure desktops, lock screens and exclusive fullscreen environments are platform-controlled. No tray/final settings UI is implemented; runtime controls are deliberately minimal.

## Recommended next step

After the remaining manual overlay checks, request **Phase 1 — Step 5: 16-State Engine**. Step 5 has not been implemented. Work stops at Step 4.
