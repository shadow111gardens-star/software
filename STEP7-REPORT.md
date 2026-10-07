# Phase 1 - Step 7: UI/UX polish

Completed on 2026-10-07. Scope stops at Step 7.

## Final UI

The supplied Home, Settings and Store screenshots guided the dark navy surfaces, purple gradients, 240 px desktop sidebar, outline icons, rounded cards, muted typography and character presentation. The application's real teal Aiko artwork is used throughout; the reference's pink artwork was not substituted or generated.

- Sidebar: Home, Store and Settings only. Running, Paused and Hidden reflect the authoritative companion snapshot. Promotion opens Store; version comes from the actual application (currently 0.1.0).
- Home: status and pause/resume, large active artwork, character picker, appearance preview, appearance sliders, quick actions, installed character management and store promotion.
- Settings: two-column General/Appearance/Behavior and Live Preview/Performance/Advanced/About. Startup and minimized preferences persist. Display/performance capabilities are informational. Unsupported system-login startup, theme switching, gaming detection, click animations and update checks are omitted.
- Store: local hero, search, All/Featured/Free/Premium/Installed filters, Featured/Name/Price sorting, cards and right-side product details. Installed packs have four selectable original state-art previews. Overview/States/Info show exact 16-state metadata. Premium concepts have explicit artwork placeholders; Buy reports purchases coming soon without payment.
- Character management: Home Change Character and Manage open a keyboard-dismissable modal populated from installed products. Store activates through the same existing local flow and CharacterManager.

## Navigation removal

Removed the Characters page file, sidebar entry, AppPage value, renderer branch and every obsolete navigation link. The tray's Open Characters entry is replaced by Open Store; its installed-character selection submenu remains functional. Unit tests reject the removed characters route. No hidden library route remains.

## Design and reusable components

Shared CSS tokens define navy background, surfaces, subtle borders, purple accent, green success, radius and spacing. Consistent SVG outline icons, section headings, action rows, previews, picker, sliders, toggles, badges and cards share this styling. System fonts and all assets remain offline. Visible focus rings, labelled inputs, semantic buttons, checkbox toggles and reduced-motion handling are included.

Sliders and exact numeric inputs save through existing preferences and update the real companion. Cursor Distance changes horizontal offset; the expandable vertical setting preserves the existing independent y offset. Preview uses actual size, opacity and position settings; smoothing affects its position transition. Store artwork preview requests are cached and do not run on every snapshot poll.

The main window opens at up to 1280 x 800, clamped to the primary display work area. Smaller screens retain a sidebar and vertical content scrolling.

## Files

Created:
- src/renderer/components/local-flow/Design.tsx
- src/renderer/components/local-flow/StatePreviews.tsx
- STEP7-REPORT.md

Modified:
- src/renderer/app/AppShell.tsx
- src/renderer/pages/Home.tsx
- src/renderer/pages/Store.tsx
- src/renderer/pages/Settings.tsx
- src/renderer/components/local-flow/Appearance.tsx
- src/renderer/components/local-flow/CharacterCard.tsx
- src/renderer/styles/base.css
- src/shared/types/local-flow.ts
- src/platform/tray/electron-tray-adapter.ts
- src/main/windows/main-window.ts
- src/main/app-flow/validation.ts
- src/services/app/local-app-flow.test.ts

Deleted:
- src/renderer/pages/Characters.tsx

Original character assets and the separate transparent overlay stylesheet were not modified.

## Validation

Passed:
- npm run typecheck
- npm test: 61 tests across character, cursor, companion, state and local-flow suites, plus settings storage checks
- npm run build
- npm run check:flow: offline first launch, onboarding, picker/future pack activation, Store activation, range keyboard commit, exact appearance inputs, startup toggle, settings persistence, mock Buy, search, filters, tray callbacks, close-to-tray, restart, paused restart and Quit cleanup
- npm run smoke: production renderer isolation, original asset decode and denied development override
- npm run smoke:state: all 16 original PNGs render in one overlay; native click-through/no-activate flags and cleanup pass
- npm run smoke:overlay: transparent renderer, click-through/no-activate flags and crash cleanup pass
- SHA-256 comparison: all 16 local character PNG files are byte-identical to the supplied Downloads/aiko originals

The Electron flow test asserts exact renderer dimensions and no horizontal overflow on Home, Settings and Store at 1280 x 800, 1440 x 900 and 1920 x 1080. Its sizing helper compensates for Windows fractional-DPI native client-area rounding. It uses isolated test profiles; normal user preferences are untouched.

Visual QA inspected the captured Home, Settings, Store, picker and detail screens against the references. Design language and structural hierarchy match the requested direction. This is an adaptation to real local functionality, rather than an exact pixel/artwork copy. At smaller sizes, lower cards scroll vertically.

Screenshots:
- dist/validation/flow-home.png
- dist/validation/flow-picker.png
- dist/validation/flow-home-{1280,1440,1920}.png
- dist/validation/flow-settings-{1280,1440,1920}.png
- dist/validation/flow-store-{1280,1440,1920}.png
- dist/validation/flow-product-detail.png

Result JSON files: dist/validation/flow-{first,restart,paused}-result.json.
The future pack visible in some test screenshots is a temporary copy used only to verify extensibility and is removed with the isolated profile.

## Limits and next step

Only Aiko has supplied artwork; the two premium concepts remain placeholders. Advanced display capabilities are supported by existing code, but physical multi-monitor tracking is still untested because only one monitor is available. macOS runtime verification remains outstanding. Native flag tests establish click-through/no-activate behavior; no new manual desktop click-through session was performed in this step.

No remaining blocking UI issues were observed. The next recommended step is a Phase 1 packaging and release-readiness pass: installer/launch/uninstall checks and runtime verification on the intended desktop platforms. Phase 2 backend, accounts, payments and online catalog work was not started.

