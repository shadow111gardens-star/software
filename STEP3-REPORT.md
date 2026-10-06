# Phase 1 / Step 3 report

Real OS cursor tracking is implemented and validated on Windows. Steps 1 and 2, including the real Aiko pack, remain operational. No overlay or later-step behavior was introduced.

## Files created

- `src/shared/types/cursor.ts`
- `src/platform/cursor/polling-cursor-adapter.ts`
- `src/platform/cursor/electron-screen-source.ts`
- `src/platform/windows/cursor-adapter.ts`
- `src/platform/macos/cursor-adapter.ts`
- `src/services/cursor/cursor-tracking-service.ts`
- `src/services/cursor/cursor.test.ts`
- `src/main/cursor/index.ts`
- `src/main/cursor/live-check.ts`
- `src/renderer/components/CursorDiagnostics.tsx`
- `scripts/test-cursor.mjs`
- `STEP3-REPORT.md`

## Files modified

- `src/platform/types.ts`
- `src/platform/windows/index.ts`
- `src/platform/macos/index.ts`
- `src/shared/types/app.ts`
- `src/shared/constants/ipc.ts`
- `src/preload/index.ts`
- `src/main/index.ts`
- `src/renderer/App.tsx`
- `package.json`
- `README.md`

Dependencies added: none. Generated dist/ output was rebuilt. No character assets were modified.

## Architecture and native implementations

Existing CursorAdapter extended in place with start/stop, current position, subscriptions/unsubscribe and error events. Shared types define CursorPosition, CursorUpdate, CursorTrackingStatus and snapshots. Windows/macOS adapters use an injected shared polling implementation; the platform-independent CursorTrackingService manages lifecycle/error isolation and main-process consumer subscriptions. Windows-specific and macOS-specific source identification stays in their platform directories.

Windows uses Electron's native screen API, which delegates to Chromium GetCursorPos and per-display DIP conversion. macOS uses the same Electron API, backed by NSEvent.mouseLocation and coordinate normalization. Sources: [Electron screen](https://www.electronjs.org/docs/latest/api/screen), [Windows native source](https://raw.githubusercontent.com/chromium/chromium/main/ui/display/win/screen_win.cc), [macOS native source](https://raw.githubusercontent.com/chromium/chromium/main/ui/display/mac/screen_mac.mm).

The macOS implementation is real code, not a placeholder. It typechecks/builds on Windows, but has not been run on a Mac. The code reads location without event taps/global input monitors and requests no permission prompts; actual restricted-session/permission behavior requires Mac validation. No privacy controls are bypassed.

## Coordinates, monitors and update strategy

Absolute desktop DIPs, primary top-left (0,0), x right/y down; negative coordinates are preserved. Samples include timestamp, displayId, per-display scaleFactor and native platform source. No global scale multiplication or single-monitor clipping. Electron resolves the display each sample, including scale changes/hotplug. Physical multi-monitor/mixed-DPI behavior is designed for and unit-tested, but not verified on hardware because this host has one display.

Default polling interval 16 ms, configurable from 8 to 1000 ms through constructor/bootstrap. No busy loop or global input hook. Latest sample timestamp refreshes while stationary; movement/display/scale changes emit main-process events. Native screen offers no cursor-motion event. The renderer only pulls development snapshots at 250 ms with one outstanding request; normal production hides diagnostics/denies controls. Future overlays can consume main-process subscriptions without high-rate IPC. Suspend/resume and app-quit cleanup are wired. Stopped/error snapshots retain only the last known position; status/timestamp identify stale data.

## Validation results

- `npm run test:cursor`: PASS, 13 tests covering adapter start/stop/restart, duplicate starts, subscriptions/unsubscribe, cleanup/disposal, sample copies, negative coordinates, multi-display/scale changes, source mapping, initial/native/stop failures, unsupported platforms, configurable interval and reentrant stop.
- `npm test`: PASS, all 29 character/cursor unit tests plus existing storage checks.
- `npm run test:electron`: PASS, existing native image/preload integration remains intact.
- `npm run build`: PASS, including strict typecheck and Windows/macOS TypeScript compilation.
- `npm run smoke`: PASS, visible production window, React/preload isolation, real Aiko 16-state resolution, cursor status active, stop status stopped.
- `npm run check:cursor`: PASS on Windows; 45.111 seconds, 743 movement updates, 742 distinct positions, 172 updates while window unfocused. Stop cleanup passed: latest timestamp remained frozen after stopping. Start/stop controls were also exercised during the run and tracking resumed.
- Display observed: 1536x864 DIPs, scaleFactor 1.25 (125%). No physical second monitor available.
- User confirmed continuous X/Y updates across Anime Cursor, Windows desktop, File Explorer, Chrome and VS Code while switching focus.
- Main-process CPU time during the full diagnostic run: 2453 ms over 45.111 seconds (about 5.4% of one core average, including diagnostic logging/IPC and initial character/renderer work). This is an initial check, not a steady-state benchmark. Memory was not profiled.
- Lint: not configured, therefore not run.
- Source inspection found no browser mouse tracking, cursor hiding/replacement calls, unsafe renderer settings, backend or new runtime network dependency.

Computer-use automation was attempted using [computer-use skill](C:/Users/Abhay%20Solanki/.codex/plugins/cache/openai-bundled/computer-use/26.930.21537/skills/computer-use/SKILL.md). Its native pipe was unavailable after documented retry/reset, so cross-application verification used the user's manual interaction plus the live main-process recording. No automated per-app UI test is claimed.

## Limitations and next step

macOS runtime, physical negative-monitor layouts/mixed-DPI transitions, exclusive fullscreen applications, secure desktop/lock screens and remote sessions remain unverified. Electron may not surface every underlying native failure as an exception; finite/valid samples and thrown read failures are handled, but secure-desktop behavior is not guaranteed. The real OS cursor remains visible/unmodified; no input capture, overlay, character following, state detection or smoothing exists.

Exact recommended next step: Step 4 transparent overlay foundation, consuming CursorTrackingService in main and preserving these desktop DIP coordinates. Do not begin until requested. Work stops after Step 3.
