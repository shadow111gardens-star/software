# Anime Cursor — Phase A Testing

## Environment

- Date: 2026-10-07.
- Windows runtime: Microsoft Windows 11 Home Single Language, build 10.0.26300, x64.
- Build Node: v22.20.0. Electron: 44.5.1. Application: 0.1.0.
- Build environment: Windows PowerShell, existing locked npm dependencies, TypeScript/esbuild/Vite and the existing .NET Windows cursor helper.
- Physical display: one monitor; Electron bounds 1536×864 DIP, work area 1536×816 DIP, scale factor 1.25 (125%).
- All test storage and application profiles are temporary. Real userData and original Aiko artwork were not modified.

## Test Scope

Windows development, built application and actual portable packaged executable were tested. Scope includes three-screen onboarding, Home/Store/Settings, local character selection, persistent settings, native global cursor tracking, the exact 16-state engine, transparent overlay, tray lifetime and Quit, offline Store interactions, production assets and paths. Multi-display geometry, negative coordinates and 100/125/150% scaling were checked by unit tests and code inspection; physical runtime used one display at 125%.

No new product feature or Phase B integration was added.

## Bugs Found and Fixed

Production HTML retained `ws://127.0.0.1:5173` in both main and overlay Content Security Policies. The production session already blocked remote connections, and the packaged app loaded file URLs, but the development address contradicted the production output requirement.

The small build-only Vite transform now emits `connect-src 'none'` for both production HTML entries. Development keeps its existing local HMR policy. Packaging verifies that both output pages contain no localhost, 127.0.0.1, Vite-client or port-5173 reference. The full automated suite, production build, UI flow and packaged smoke were re-run after this fix.

No other product bug was reproduced. QA tooling was corrected to match onboarding buttons by their accessible labels, configure an isolated profile at the application-entry debugger breakpoint, and close the inspector before awaiting process exit. During a performance attempt, an external interaction changed an appearance preference; the repeat observation hides the main window to prevent interaction while preserving the unchanged-settings assertion. These were test setup issues, not changes to product behavior or weakened expectations.

## Complete Application QA

PASS through isolated Electron UI automation:

- Fresh launch opens exactly three onboarding screens. Get Started, Continue, Back in both directions, Start Companion and Skip Setup work.
- Start and Skip redirect to Home and persist completion. Relaunch opens Home without onboarding. Settings → Restart Setup opens screen 1 and retains appearance settings.
- Home, Store, Settings and main navigation work. There is no Characters navigation page.
- Home/Settings appearance inputs apply and persist size, both distance axes, opacity and smoothing. Automatic startup and start-minimized preferences restore.
- Hide/Show, Pause/Resume and enabled state persist. A saved hidden companion starts without a visible flash; Resume preserves hidden preference until Show.
- Main Close hides to tray while the overlay remains alive. Tray show/hide, pause/resume, installed-character selection, Settings and Store actions work. Explicit Quit drains settings writes, stops tracking/state services, removes the overlay/tray and exits.
- Performance/Advanced display existing information rather than fake settings. About/version and Restart Setup/Quit actions work. No separate full-settings reset feature exists; only the implemented Restart Setup behavior was tested.

## 16-State Test Matrix

Runtime PASS below means a real Windows cursor was produced by the local CSS fixture, physically sampled using native GetCursorInfo, resolved automatically, and matched to the original overlay asset. It does not claim that every cursor was manually triggered in another application.

| State | Trigger / Context | Expected | Result |
|---|---|---|---|
| normal | Standard default arrow | normal | PASS — native runtime and original asset |
| help | Help cursor | help | PASS — native runtime and original asset |
| working | Progress / working cursor | working | PASS — native runtime and original asset |
| busy | Wait cursor | busy | PASS — native runtime and original asset |
| precision | Crosshair | precision | PASS — native runtime and original asset |
| text | Text / I-beam | text | PASS — native runtime and original asset |
| handwriting | Windows pen resource 32631 | handwriting | Not manually reproducible — verified by automated test/code-path; overlay asset PASS |
| unavailable | Not-allowed cursor | unavailable | PASS — native runtime and original asset |
| move | Move cursor | move | PASS — native runtime and original asset |
| horizontal | East/west resize | horizontal | PASS — native runtime and original asset |
| diagonal | Northwest/southeast resize | diagonal | PASS — native runtime and original asset |
| alternate | Windows up-arrow resource 32516 | alternate | Not manually reproducible — verified by automated test/code-path; overlay asset PASS |
| vertical | North/south resize | vertical | PASS — native runtime and original asset |
| diagonalSecondary | Northeast/southwest resize | diagonalSecondary | PASS — native runtime and original asset |
| link | Hand / link cursor | link | PASS — native runtime and original asset |
| extra | Custom SVG / unsupported cursor | extra | PASS — native runtime; unrecognized/unsupported diagnostic and original extra asset |

Exactly 16 states exist. All 16 manual overrides, original overlay images and sandboxed image decodes pass. Both diagonals remain separate. The native fixture returns to default arrow and normal after custom and resize cursors. Unknown, custom, unreliable and stale samples resolve to extra, never silently to normal. Mouse speed/direction is diagnostic data and is not a semantic state rule. State switches retain one overlay window; revision checks prevent stale image results from replacing newer content.

## Character Assets

All 16 manifest mappings exist, decode and resolve without fallback. Store previews and native overlay checks compare data URLs with the expected local asset. SHA-256 comparisons confirm that every source and packaged Aiko PNG matches the user's original Downloads/aiko files byte for byte. Packaged assets also load after process restart. Missing/invalid packs and missing selected characters receive the existing deterministic CharacterManager fallback; deliberate missing-image recovery is covered by Electron tests.

## Cursor Tracking Test

Windows adapters use Electron's native `screen.getCursorScreenPoint()` and nearest-display information. Renderer mouse events do not provide coordinates. The semantic helper separately reads GetCursorInfo and discards its coordinate fields.

Current runtime checks verify physical pointer movement across native fixture contexts, overlay following, native state transitions and continued operation when the main window is hidden. Earlier in this project the user explicitly confirmed continuous X/Y updates on the Windows desktop, File Explorer, Chrome and VS Code while changing application focus. That confirmation is retained as prior manual evidence, not represented as a fresh manual retest in this step. Other external desktop applications were not specifically identified or manually tested here.

## Overlay Test

PASS: transparent captured corner with visible character pixels; frameless, always-on-top, non-focusable, skip-taskbar window; transparent renderer background; Windows layered/click-through/no-activate flags. It does not take focus, alter the real OS cursor, or block native pointer interaction. State/character/settings changes reuse the window. Stop/restart creates only the required replacement; main Close leaves the active overlay alive. Deliberate renderer crash is detected, cleans up, and permits recovery. Quit stops native services and removes windows/tray.

## Multi-Monitor Test

One physical display was tested. Two-monitor runtime, alternate physical arrangements and mixed-monitor DPI were unavailable. Unit tests cover left/above monitors, negative coordinates, monitor changes, nearest-display metadata, clamping, corner/edge flips and all nine representative positions per logical display at 100/125/150% scaling. Electron already returns DIP coordinates, so shared code never multiplies global coordinates by scale factor.

Result: single-monitor runtime PASS; multi-monitor automated/code review PASS; physical multi-monitor runtime NOT TESTED.

## DPI and Screen Boundaries

125% physical Windows scaling was verified. 100% and 150% were not switched on the physical monitor. Automated geometry checks preserve size and keep bounds within primary/left/above work areas at all three scale factors, including top, bottom, left, right and corners. Physical multi-monitor edge traversal and runtime tests at 100/150% remain unverified.

## Windows Test

Development mode was tested with the real Vite server and development flag in an isolated profile: fresh onboarding, completion, restart, original local assets, Store, overlay, native default/text/link/horizontal/vertical transitions, close-to-tray and Quit pass. Production mode and the actual packaged executable use local `file:` URLs for both main and overlay, have development diagnostics disabled, and pass the same critical functionality offline. The packaged app runs without node_modules, npm, a source checkout or a development server in its application directory.

## macOS Check

**macOS architecture/code-path reviewed. macOS runtime NOT TESTED. No macOS artifact was produced.**

- Platform detection selects darwin separately from win32; unsupported platforms report unsupported capabilities.
- `MacOSCursorAdapter` reads native Electron screen coordinates through the shared polling adapter. Shared tracking/state/character/storage services do not call Win32 APIs.
- Windows semantic sampling and the compiled read-only helper are isolated under `src/platform/windows`; helper execution occurs only through the Windows adapter. The build invokes the Windows compiler only on win32.
- macOS overlay behavior is isolated in `src/platform/macos/overlay-behavior.ts`: all workspaces/fullscreen visibility and Mission Control hiding are applied only on darwin.
- Tray code uses a macOS template image and platform-specific click behavior. App activation and tray-owned lifetime have explicit Electron handlers.
- Paths use join/resolve/pathToFileURL and Electron userData; asset locations are relative to the bundled main, not a hardcoded Windows workspace. Windows-specific PowerShell fixtures and compiler paths remain confined to Windows build/QA paths.
- macOS global semantic cursor classification is currently unavailable: `MacOSSemanticCursorAdapter` deliberately returns an unreliable/null sample. The resolver consequently uses extra instead of inventing another application's cursor shape. Completing native macOS semantics requires a platform implementation; the core services need not be rewritten.

## Offline Test

PASS using Electron network-disabled sessions. Six independent application-flow launches verify fresh onboarding, restart/Skip/Restart Setup, Home/Settings, persistence, Store search/all filters/product detail/all 16 previews, installed activation, every premium Buy and empty Installed UI. Store observers record zero HTTP/HTTPS requests and zero checkout windows. Buy only shows Purchases coming soon; no purchase, entitlement, download or preference change occurs.

The packaged executable's main and overlay sessions are also forced offline before startup through an external inspector harness. Clean onboarding, saved relaunch, native cursor context changes, overlay, assets and Store still work. The physical network adapter was not disabled; session-level offline emulation and request blocking were used.

## Local Storage and Settings

PASS: schema version 1, first-install defaults, durable writes, serialized atomic replacement, previous-commit backup, legacy migration, per-field repair, empty/invalid/missing documents, invalid selection fallback, immediate cache updates and failed-save rollback. Runtime cursor state/positions/handles and PNG bytes are excluded. Relaunch checks restore character, size, offset, opacity, smoothing, visibility, pause, startup/minimized and onboarding state. Tests use temporary directories and leave real app data untouched.

## Production Build

Commands: `npm run build`, then `node scripts/package-windows.mjs`.

Output: `release/AnimeCursor-win32-x64/AnimeCursor.exe` and its complete runtime/resources folder. `release/windows-build.json` records version, architecture, Electron version and executable SHA-256. Packaging uses the existing installed Electron runtime and bundled output; no new packaging framework or npm checklist command was introduced. The project previously had no installer configuration.

This is an **unsigned Windows x64 portable application**, not an installer. Keep the complete folder intact. Local assets, preloads and native helper reside under resources/app/dist. The packaged app reports `app.isPackaged === true`, restores storage, starts its overlay and native helper, transitions cursor states and exits cleanly. Both production HTML pages contain no development-server reference and enforce connect-src none; loaded resources are file URLs. The existing main bundle retains a gated development implementation, but packaged mode disables that branch.

Packaged smoke: `node scripts/test-packaged-windows.mjs`. The external stock Node inspector pauses at application entry solely to configure temporary userData and offline sessions before startup. No QA bypass/API was added to the production app. A second independent launch verifies persistent Home startup without onboarding.

## Automated Checks

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 73 tests plus storage checks |
| `npm run test:electron` | PASS |
| Lint | N/A — no script/configuration exists; none invented |
| `npm run build` | PASS |
| `npm run smoke` | PASS |
| `npm run smoke:overlay` | PASS |
| `npm run smoke:state` | PASS — 16 assets, 14 runtime semantic states, flags/cleanup |
| Offline app-flow / Store QA | PASS — six isolated processes |
| Windows development-mode QA | PASS |
| Portable production build | PASS |
| Actual packaged clean launch and restart | PASS |

Evidence is retained under `dist/validation`, including state, overlay, Store, flow, development and packaged Windows results, screenshots and `dist/test-phase-a.log`. Expected error output includes deliberate missing assets, denied production debug overrides and deliberately crashed renderer tests; these checks finish successfully.

## Performance Observation

The packaged app was observed for 60 seconds after asset/Store/native-state checks, with its main window hidden and overlay active. Four process CPU/working-set samples were collected. Window ids remained unchanged, renderer reload count stayed zero, and the settings document remained byte-identical. This supports absence of runaway work during the observation; it is not a multi-hour leak test. Measured Electron-process CPU summed to at most 0.70% across the post-baseline samples. Combined working sets changed from 781.1 MiB to 546.8 MiB during this observation. These metrics exclude the separate .NET helper and do not establish a long-term leak guarantee. Detailed samples are in `dist/validation/packaged-windows-result.json`.

## Files Changed in Step 10

`vite.config.ts` (production-only CSP correction); `scripts/package-windows.mjs` (existing-runtime portable packaging and output checks); `scripts/test-packaged-windows.mjs` (external packaged/development QA and performance observation); `src/main/state/native-classification-validation.ts` (expanded native cursor fixture); `src/services/companion/companion.test.ts` (DPI/edge geometry coverage); `README.md`; `PHASE_A_TESTING.md`. Product state logic, artwork, persistence and UI flows were not rewritten.

## Known Limitations

- macOS runtime/build untested; global semantic classification is not implemented there and deliberately resolves to extra.
- One physical display at 125%; two-monitor hardware and physical 100/150% scaling were unavailable.
- Handwriting and alternate cursor contexts were not reliably reproduced live; mapping and overlay artwork have automated coverage.
- The deliverable is unsigned and portable; no installer, code signing or automatic OS-login startup was implemented.
- External-app manual tracking confirmation comes from the earlier user check; this step's fresh native tests use controlled fixtures and hidden-window observation.
- Performance observation is 60 seconds, not a long-duration memory-leak, power-loss or OS-reboot test.

## Final Phase A Status

**PASS WITH KNOWN LIMITATIONS.** Critical Windows functionality, automated checks, offline operation and the real portable production build pass. Unverified hardware and macOS behavior are explicitly separated from verified results. Phase B was not started.
