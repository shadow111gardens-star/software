# Step 5 correction: extra is the unclassified native cursor fallback

Completed 2026-10-07. No new UI polish or later-phase work was performed.

The state list remains exactly 16. The two diagonal states remain distinct.

## Resolution

- Fresh, reliable native match among the 15 known semantic states: use the matching state.
- Recognized standard/default cursor: normal.
- Unknown, custom, unrecognized, unsupported, ambiguous, stale, failed or unavailable native cursor information: extra.
- Speed and direction never choose a semantic state.
- Development override: any of the existing 16 states; AUTO restores native detection.
- Initial/reset state is extra because no reliable cursor classification is available. Stop clears overrides and destroys the overlay.
- The separate missing/corrupt artwork fallback in CharacterManager remains unchanged; it is not the semantic cursor fallback.

Diagnostics now expose detectedState and reason independently of overrides:
Detected state: extra
Reason: unrecognized/unsupported cursor

## Changes

Modified state-detector.ts, state-manager.ts, shared/types/state.ts, Windows semantic-cursor-adapter.ts logs, StateDiagnostics.tsx, state.test.ts and the state/flow validation cleanup assertions. Added src/main/state/native-classification-validation.ts. Updated README.md and STEP5-REPORT.md to document the corrected fallback.

The Windows read-only GetCursorInfo/LoadCursor helper remains the native semantic source. No cursor hiding, OS cursor replacement, movement classification or new state was introduced. The macOS adapter currently lacks reliable global semantic classification and therefore resolves to extra.

## Validation

Passed:
- npm run typecheck
- npm test: 63 tests plus settings storage checks
- npm run build: production build
- npm run smoke:state
- node scripts/test-flow-electron.mjs: isolated offline onboarding, companion actions, persisted restart, paused restart, tray and Quit cleanup

Unit tests verify every known Win32 cursor resource, unknown/custom resource handling, unreliable/stale/error contexts, standard normal, all 16 manual overrides, and movement independence.

The live Windows native test creates cursor fixtures only inside the application's window and samples the actual OS cursor through the existing native helper. It verifies:
- default -> normal
- text -> text
- help -> help
- pointer -> link
- crosshair -> precision
- custom SVG cursor -> extra, source windows-unknown-cursor, unreliable semantic sample
- return to default -> normal

For each live case, the overlay image source matches the actual Aiko state asset byte-for-byte via its original data URL. The custom case uses Aiko's existing extra PNG. All 16 manual states render in the same overlay window. Native layered, click-through and no-activate flags pass. Standard native cursor recognition requires CURSOR_SHOWING in the helper; runtime cursor visibility behavior was not modified.

The fixture is removed and the original pointer position is restored after the native check. No system-wide cursor scheme is changed. Native classification details are recorded in dist/validation/state-result.json under nativeClassification.

Physical multi-monitor and macOS runtime verification remain untested. Work stops after this correction.

