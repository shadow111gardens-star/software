# Phase 1 — Step 5: 16-state cursor engine

Implemented the local state pipeline using the existing cursor service, CharacterManager, Aiko artwork and overlay. The real cursor is never changed. No backend, online catalog, accounts, payments, UI polish or Step 6 work was added. No npm dependencies changed.

## Files created

- `src/shared/types/state.ts` — normalized semantic sample, cursor context, diagnostics and adapter contracts.
- `src/engine/state/state-detector.ts` — reliable semantic detection and normal fallback.
- `src/engine/state/state-manager.ts` — current state, deterministic priority, deduplicated subscriptions, reset and manual override.
- `src/engine/state/state.test.ts` — 11 state/resolver/controller tests.
- `src/services/state/cursor-state-engine.ts` — context construction and lifecycle using existing tracking/cache/frame updates.
- `src/services/characters/character-state-resolver.ts` — cached CharacterManager resolution; existing fallback retained.
- `src/platform/windows/cursor-resource-map.ts` — Win32 cursor resource mapping.
- `src/platform/windows/semantic-cursor-adapter.ts` — bounded native helper protocol, normalization, heartbeat/error handling and cleanup.
- `src/platform/windows/native/CursorContext.cs` — read-only global cursor handle sampler.
- `src/platform/macos/semantic-cursor-adapter.ts` — explicit unavailable semantic adapter returning normal fallback.
- `src/main/state/index.ts` — platform factory and restricted development IPC.
- `src/main/state/validation.ts` — real Electron all-state/live checks.
- `src/renderer/components/StateDiagnostics.tsx` — temporary override/AUTO/cycle diagnostics.
- `scripts/test-state.mjs` — isolated test bundling/runner.
- `STEP5-REPORT.md` — this report.

## Files modified

- `src/services/companion/companion-controller.ts` — state-engine lifecycle and in-place asset switching; character/settings refresh preserves state/window.
- `src/services/companion/companion.test.ts` — update-capable fixture and in-place refresh expectations.
- `src/services/cursor/cursor-tracking-service.ts` — lifecycle-status subscription, including tracking stop/error while overlay is hidden.
- `src/platform/types.ts` — overlay content update contract.
- `src/shared/types/overlay.ts`, `src/shared/types/app.ts`, `src/shared/constants/ipc.ts` — strict CursorState content and narrow state/update IPC types.
- `src/main/windows/overlay-window.ts` — revisioned image updates, acknowledgement, timeouts and pending-operation cleanup.
- `src/main/companion/index.ts`, `src/main/index.ts` — one engine injection, gated state controls and validation startup.
- `src/main/companion/validation.ts` — accepts valid automatic semantic states in the existing overlay checks.
- `src/preload/index.ts`, `src/preload/overlay.ts` — restricted state controls and image update subscription; raw Electron events are not exposed.
- `src/renderer/overlay/main.ts` — off-DOM decode, atomic image replacement and stale-revision protection.
- `src/renderer/App.tsx`, `src/renderer/components/CompanionControls.tsx` — Step 5 diagnostics and current snapshot state.
- `scripts/build-electron.mjs` — Windows native helper compilation.
- `package.json` — state unit/smoke/live commands; dependency versions and lockfile unchanged.
- `README.md` — current behavior, native prerequisites and commands.

Generated build output includes the 5 KB Windows helper and all-state captures under `dist/validation/states/`. Original character PNGs/manifests were not modified.

## Architecture

The native platform adapter provides a normalized semantic sample. CursorStateEngine combines it with the existing CursorTrackingService cache to create CursorContext. Context includes current/previous DIP positions, movement delta/distance/speed, tracking status, semantic source/reliability/error and timestamps. No native handles, Win32 identifiers or physical coordinates enter the shared state engine.

StateDetector resolves context; StateManager stores one valid state and notifies only on actual state changes. CharacterStateResolver asks the existing CharacterManager for the active character/state. CompanionController sends that resolved image to the same overlay renderer/window. There is one cursor-position source, one manager/resolver per companion controller and one overlay. The React main application never reads native APIs.

Movement information is descriptive only. Neither movement direction, speed, screen coordinates, elapsed timers nor application names select text/link/resize/busy or any other semantic state. No browser mouse/pointer events are used for detection.

## Exact supported states and Windows mapping

The unchanged authoritative CURSOR_STATES constant defines exactly these 16 identifiers:

| State | Reliable predefined Win32 match |
| --- | --- |
| normal | IDC_ARROW / 32512 |
| help | IDC_HELP / 32651 |
| working | IDC_APPSTARTING / 32650 |
| busy | IDC_WAIT / 32514 |
| precision | IDC_CROSS / 32515 |
| text | IDC_IBEAM / 32513 |
| handwriting | Pen resource / 32631, when available |
| unavailable | IDC_NO / 32648 |
| move | IDC_SIZEALL / 32646 |
| horizontal | IDC_SIZEWE / 32644 |
| diagonal | IDC_SIZENWSE / 32642 |
| alternate | IDC_UPARROW / 32516 |
| vertical | IDC_SIZENS / 32645 |
| diagonalSecondary | IDC_SIZENESW / 32643 |
| link | IDC_HAND / 32649 |
| extra | No unambiguous predefined mapping; development verification only |

The helper reads the global handle/visibility via GetCursorInfo and compares against shared predefined handles returned by LoadCursorW. It reloads those handles during sampling so it does not retain a stale theme-handle table. Multiple matching identifiers are treated as unknown. The Win32 position fields are discarded. These APIs are read-only for this use; no ShowCursor, SetCursor, SetSystemCursor, input hooks or synthetic input are used. See Microsoft's [GetCursorInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorinfo), [LoadCursorW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-loadcursorw) and [cursor reference](https://learn.microsoft.com/en-us/windows/win32/menurc/about-cursors).

The hidden helper samples at 20 Hz, emits changes plus a one-second heartbeat, and exits when its owning Electron process exits. Stop terminates it directly. Malformed protocol, unexpected exit or stale heartbeat safely disables detection until restart; native read failures use normal and log a useful error. No PowerShell host remains running in production. Windows build uses the installed .NET Framework 4.x compiler; runtime needs .NET Framework 4.x. Installer packaging must place the helper outside ASAR. Installer work is out of scope.

macOS has a separate adapter with the same normalized contract. It explicitly supplies no reliable global semantic information, so AUTO is normal. It does not misuse the app's own NSCursor as another process's cursor or request input-monitoring privileges. macOS runtime testing was not performed.

## Priority, override and invalid input

1. Inactive/error/unsupported tracking resolves to normal and pauses semantic sampling.
2. During active tracking, a development override has priority over automatic detection.
3. AUTO accepts only a valid, reliable, error-free platform state with a fresh timestamp.
4. Missing, hidden, custom, ambiguous, unsupported, invalid or stale semantic information falls back to normal.

There is a single actual cursor-handle signal, so no arbitrary multi-signal tie-breaking is needed. diagonal and diagonalSecondary remain distinct. Unknown inputs never reach CharacterManager as arbitrary strings. IPC rejects invalid overrides; internal invalid override values normalize to normal. Stop resets manager state and override, removes state/status subscribers, and destroys the overlay. Repeated subscription of the same listener is deduplicated.

The development panel provides AUTO, all 16 selections, a repeatable cycle and diagnostics for current state/source/override, character/resolved state slot, cursor and tracking status. It refreshes at most four times per second with no overlapping read loop. Overrides remain in memory and are not written to settings. Normal production launches and packaged builds deny override operations and return no diagnostic snapshot. Explicit unpackaged validation flags temporarily enable the same test controls.

## Character resolution and overlay integration

The resolver keys successful assets by active character id/version/state. It performs no disk work on unchanged frames and reuses successful assets on repeated transitions. Null/fallback results are not permanently cached. CharacterManager alone implements missing/corrupt-state fallback to normal, then null; the resolver does not duplicate that logic. Cache is cleared for character/settings refresh. Future character packs require no state-engine changes.

The overlay subscribes through its narrow preload, decodes each new image off-DOM, then replaces the image atomically. Its window, click-through flags, z-order and focus behavior remain unchanged. Sequence guards prevent slow earlier resolutions/decodes from overwriting later transitions. Pending decode acknowledgements time out and are rejected on destruction. Missing normal fallback or renderer failure logs an error and cleans up gracefully.

State changes preserve the displayed top-left except when a larger image requires work-area edge clamping; aspect sizing/padding adapt to the actual new image. Movement smoothing continues independently in main. Character/settings changes also reuse the window and retain the current state/override. Hidden overlays retain their image/window and pause movement; tracking lifecycle notifications still reset state and pause native sampling. Showing resumes normal frame processing.

## Tests and validation

- `npm test`: all 52 unit tests passed (character, cursor, companion and 11 state tests), plus storage validation.
- State tests cover all 16 values/no 17th, both diagonals, invalid/unreliable/stale/error fallback, no movement-based guessing, change-only events, duplicate subscriptions, reset, manual/AUTO priority, per-character caching, delegated fallback/retry, all-state switching with one window, position preservation, character refresh, stop/restart/status cleanup, hidden tracking-stop behavior and asynchronous resolution races.
- `npm run typecheck`: passed.
- `npm run build`: passed, including native helper, separate secure preloads and both renderer entries.
- `npm run smoke:state`: passed with all 16 original Aiko images; each rendered data URL matched CharacterManager exactly and all natural dimensions were valid. The same BrowserWindow id persisted across the complete sequence. AUTO, invalid override rejection, stop/restart and final cleanup passed.
- Development state smoke against Vite: passed, including the exact AUTO-plus-16-options panel.
- `npm run smoke`: passed; normal production diagnostic snapshot was null and override was denied.
- `npm run smoke:overlay`: passed transparency, focus/window configuration, main-window independence and intentional renderer-crash recovery/cleanup.
- `npm run test:electron`: passed existing real decoder/16-state IPC tests and missing-state normal fallback.
- All-state screenshots were captured; normal, text, horizontal, diagonalSecondary and extra captures were visually inspected. Transparent-corner alpha and original source matching were checked for every state.
- Native Windows extended flags remained layered, click-through and non-activating after all state switches. No cursor-context helper remained after completed validation runs.
- A 60-second live Windows run recorded state changes and application focus changes. Reliable native normal and text samples were observed; a later production smoke also captured a reliable native link sample. The live tester also used development overrides, so its unfiltered historical transition list is not evidence of automatic detection for every listed state. The validator now excludes override events from AUTO counts and explicitly finishes in AUTO.

Expected negative-test logs include invalid override rejection, production override denial, intentional renderer crash and the existing missing fixture asset. They are assertions of recovery/security behavior, not unhandled failures. The latest short smoke replaces `dist/validation/state-result.json`; a zero AUTO transition count in that short stationary check does not contradict the earlier live run.

## Performance observations and limitations

The helper binary was 5120 bytes. During the live check its working set was approximately 14–15 MB and process CPU was about 0.25 seconds at the later read. These are spot observations, not a long-duration benchmark. Main/renderer total CPU, memory and GPU costs were not profiled for this step. Sampling uses sleeps, change-only notifications and bounded data; movement causes no image-resolution IPC or React renders. Asset cache memory grows with the active pack's resolved states and is cleared on refresh.

Custom/copied cursor handles, application-drawn/software cursors, some animated/theme variants, hidden/suppressed cursors, secure desktops and nonstandard application cursor implementations can remain normal. Extra has no automatic mapping. Short cursor changes between 50 ms samples can be missed. The engine supports all assets; it does not claim every application exposes all 16 semantic states.

Windows was tested on one monitor at 125% scaling. Physical multi-monitor/mixed-DPI and other scale settings remain unverified; geometry continues to use the Step 4 DIP implementation. macOS automatic semantics intentionally fall back to normal, and macOS runtime remains untested. Manual confirmation of real-cursor visibility, click/drag/scroll/text-selection beneath the artwork and perceived movement/flicker across applications is still pending. Native flag checks support intended interaction behavior but do not replace that user test.

## Exact next step

Recommended only when requested: **Phase 1 — Step 6: Local App Flow**. Resolve remaining platform/manual QA during subsequent validation. No Step 6 or later work was performed. Work stops at Step 5.
