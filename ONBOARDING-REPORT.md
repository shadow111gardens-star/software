# Anime Cursor - complete three-screen onboarding

Completed 2026-10-07.

## UI

Exactly three screens use one shared navy desktop frame, centered three-part progress indicator, Back/Skip placement, purple-pink gradient headings and buttons, ambient blue/purple glow and original Aiko artwork.

1. Welcome: app branding, four features, large original character PNG, decorative glowing cursor/stars/trail, Get Started.
2. Choose Your Companion: selected Aiko card with checkmark and Installed badge, locked Neko/Yuki concept cards, three progress dots and Continue.
3. All Set: readiness heading, three features, original Aiko artwork, speech bubble, heart/stars/trail, Start Companion and helper text.

Neko/Yuki do not have supplied artwork. They use explicit locked artwork-coming-soon placeholders; no replacement character artwork was generated. Matching concept entries were added to the existing local mock catalog so Available in Store accurately refers to preview listings. The Store architecture and purchasing behavior are unchanged.

The existing titlebar remains draggable and retains functional minimize/maximize/close-to-tray controls and the colored window dots. The same native window dimensions are preserved throughout setup.

## Real flow

- First launch: persisted onboardingCompleted false opens screen 1.
- Get Started and Continue advance; Back returns one step.
- Aiko selection uses the existing flow activation and CharacterManager.
- Start Companion selects Aiko, starts the existing real companion, persists completion and enabled state, and opens Home.
- Skip Setup is available on all screens. It permanently persists completion, opens Home, retains an existing character selection (Aiko by default), and starts the companion when the existing automatic-start preference is enabled.
- Future launches use saved character/settings and open Home; onboarding does not reappear.
- Settings > About > Restart Setup explicitly persists completion false, stops the overlay for setup, preserves appearance/character preferences, and opens screen 1.
- Failure to start from Start Companion leaves completion false and reports the error. Skip remains completed even if starting the companion fails, allowing Home to show the error and recovery controls.
- No fourth permissions screen or unrelated permissions were added.
- Main navigation remains Home, Store and Settings only.

The new skip/restart operations use typed, sender-checked preload IPC and the existing serialized local flow/settings store. No dependencies were added.

## Files

Created:
- src/renderer/styles/onboarding.css
- ONBOARDING-REPORT.md

Modified:
- src/renderer/components/local-flow/Onboarding.tsx
- src/renderer/components/local-flow/Design.tsx (shared heart/monitor/lock icons)
- src/renderer/index.html (external onboarding stylesheet, including CSP-compatible development loading)
- src/renderer/pages/Settings.tsx (Restart Setup action)
- src/services/app/local-app-flow.ts
- src/shared/types/local-flow.ts
- src/shared/constants/ipc.ts
- src/preload/index.ts
- src/main/app-flow/ipc.ts
- src/services/catalog/mock-products.ts (Neko/Yuki concept data)
- src/services/app/local-app-flow.test.ts
- src/main/app-flow/validation.ts
- src/main/index.ts (validation phase allowlist only)
- scripts/test-flow-electron.mjs
- README.md

Native cursor tracking/detection, all 16 state mappings, overlay architecture and original PNG files were not changed.

## Validation

Passed:
- npm run typecheck
- npm test: 66 tests plus storage verification
- npm run build
- npm run check:flow: five isolated offline production Electron launches
- npm run smoke:state
- npm run smoke:overlay

Electron validation covers:
- Every onboarding screen, Back in both directions, Continue, selection and Start
- Start -> Home with Aiko active and overlay running
- Full Electron restart -> Home, Aiko preserved and companion running
- Skip from screens 1, 2 and 3 -> persisted completion/Home
- Skip completion preserved across a full Electron restart
- Settings Restart Setup -> screen 1/incomplete persistence
- All three screens at 1280 x 800, 1440 x 900 and 1920 x 1080
- Identical native frame bounds between steps
- No horizontal content overflow; primary buttons and character images fully inside the viewport
- Existing Home/Store/Settings, mock Buy/search/filters, settings changes, future-pack selection, tray controls, paused restart and Quit cleanup

Native smoke verifies all 16 original assets, standard/default -> normal, real custom cursor -> extra and recovery to normal, plus click-through/no-activate native flags. Overlay smoke verifies transparency and crash cleanup. No normal user settings were reset; flow checks use temporary profiles.

Screenshots were inspected against all three supplied references. Layout, colors, hierarchy, buttons, progress, glow and artwork presentation follow the references while preserving the supplied teal Aiko asset. Locked concept placeholders intentionally differ from the reference's unavailable artwork.

## Review artifacts

- dist/validation/flow-onboarding-1-1280.png
- dist/validation/flow-onboarding-2-1280.png
- dist/validation/flow-onboarding-3-1280.png
- Corresponding 1440 and 1920 screenshots for all three steps
- dist/validation/flow-onboarding-result.json
- dist/validation/flow-onboarding-restart-result.json
- dist/validation/flow-first-result.json
- dist/validation/state-result.json

Physical computer reboot was not performed; restart persistence uses the same durable local settings storage and was verified across independent Electron processes. macOS runtime and physical multi-monitor validation remain outstanding. No blocking onboarding issue was observed. Work stops at this onboarding task.

