# Phase 1 - Step 6: Local App Flow

Completed on Windows, 2026-10-06. Scope stops at Step 6. No backend, authentication, payments, downloads, online catalog, new npm dependencies or new character artwork were added.

## Application behavior

- **Onboarding:** Welcome - Choose companion - Start Companion. The installed library comes from CharacterManager; Aiko is initially selected when available. Starting enables the real companion, starts the existing semantic engine/overlay, saves completion and opens Home. Empty libraries and failed startup show messages and leave onboarding incomplete.
- **Home:** shows actual character, Active/Paused/Hidden/error status, saved enabled state and overlay visibility. Pause/Resume and Hide/Show operate the real controller. Quick actions navigate to Characters and Settings. Appearance fields save on blur and update the existing overlay.
- **Characters:** generic installed library, All/Installed/Free/Premium filters and Activate. Activation uses CharacterManager, persists selection, keeps running/hidden/paused behavior and preserves the current semantic state when switching an active overlay. Future valid packs appear after discovery on launch.
- **Store:** local service metadata, Featured/All/Free/Premium filters, case-insensitive search, detail dialog and exactly the authoritative 16 state names. Installed packs can activate. Two premium concepts have explicit missing-artwork placeholders and planned state slots. Buy only displays "Purchases will be available soon. No payment was made." It changes neither settings nor ownership.
- **Settings:** automatic companion start when the app opens, start minimized after onboarding, size, horizontal/vertical cursor distance, opacity, smoothing, enabled state, pause/resume and hide/show. Performance guidance explains the existing smoothing option. Advanced diagnostics appear only in development/explicit unpackaged checks. About shows version and local status, credits and Quit. Launch behavior is not OS login startup.
- **Tray/status item:** the existing TrayAdapter contract is implemented once with Electron Tray for Windows and macOS. Show/Hide App, Show/Hide Companion, Pause/Resume, installed-character selection, Open Characters, Settings and Quit use the same domain state as the UI. The icon is a tiny code-native glyph independent of character artwork; macOS uses a template status icon.
- **Close/Quit:** closing hides the main window, retaining the tray and enabled companion. Reopening uses that same main window. Explicit Quit drains accepted mutations, destroys the overlay and tray, stops semantic and cursor services, clears subscriptions/timers and exits.

Pause stops/destroys the companion and saves companionEnabled=false. Hide retains its enabled state and overlay window, suppressing visibility/movement; Show restores it. These are distinct actions. Resume uses the existing duplicate-start protections. Global cursor-position tracking remains the single existing main-process service; pause stops companion movement/state work rather than creating a new tracking system.

## Persistence and state

LocalAppFlow serializes domain mutations through the existing CharacterManager, CompanionController and LocalSettingsStore. Home, Characters, Settings, legacy diagnostic controls and tray all delegate to that flow. React receives a small shared snapshot with one non-overlapping 500 ms poll and an in-flight mutation guard; image previews are retrieved once separately. Position following remains in main and does not use this polling channel.

Persisted fields: activeCharacterId, companionEnabled, characterSize, cursorOffset.x/y, opacity, smoothing, onboardingCompleted, startCompanionAutomatically and startMinimized. Existing settings without new flags migrate in memory to onboarding=false, automatic start=true, minimized=false while retaining prior appearance values. Completing onboarding saves the new flags. Invalid settings are rejected and existing malformed files are preserved.

Onboarding is shown until saved completion. Later launches open Home, respecting start-minimized. Automatic companion startup requires completed onboarding, saved enabled=true and automatic start=true. A paused companion remains paused after restart. Hide and navigation are session-only; enabled automatic startup restores a visible companion on relaunch. No boot/login startup integration is added.

## Files created

| Area | Files |
| --- | --- |
| Shared contract | `src/shared/types/local-flow.ts` |
| Domain/catalog | `src/services/app/local-app-flow.ts`, `src/services/catalog/local-catalog.ts`, `src/services/catalog/mock-products.ts` |
| Main integration | `src/main/app-flow/ipc.ts`, `src/main/app-flow/foundation-validation.ts`, `src/main/app-flow/validation.ts` |
| Tray | `src/platform/tray/electron-tray-adapter.ts` |
| Renderer shell/state | `src/renderer/app/AppShell.tsx`, `src/renderer/app/local-flow-context.tsx` |
| Components | `src/renderer/components/local-flow/Appearance.tsx`, `CharacterCard.tsx`, `Onboarding.tsx` in that directory |
| Pages | `src/renderer/pages/Home.tsx`, `Characters.tsx`, `Store.tsx`, `Settings.tsx` |
| Tests/runners | `src/services/app/local-app-flow.test.ts`, `scripts/test-flow.mjs`, `scripts/test-flow-electron.mjs` |
| Documentation | `STEP6-REPORT.md` |

## Files modified

- `src/main/index.ts`: startup restoration, shared flow, tray lifetime, close-to-tray, centralized Quit and isolated offline flow validation.
- `src/main/windows/main-window.ts`: desktop dimensions and saved initial visibility.
- `src/main/characters/index.ts`, `src/main/characters/ipc.ts`: optional isolated test root and shared activation delegate.
- `src/main/companion/index.ts`: lifecycle ownership and legacy controls delegate to flow.
- `src/main/state/validation.ts`: diagnostics assertion accounts for the panel now living under Settings after onboarding; all 16 rendering assertions remain.
- `src/platform/types.ts`, `src/platform/windows/index.ts`, `src/platform/macos/index.ts`: tray contract/capabilities.
- `src/preload/index.ts`, `src/shared/types/app.ts`, `src/shared/constants/ipc.ts`, `src/shared/constants/settings.ts`: narrow typed flow bridge and backward-compatible settings flags.
- `src/renderer/App.tsx`, `src/renderer/styles/base.css`: functional desktop shell, navigation, onboarding, focus states and responsive layout.
- `package.json`: local-flow unit/integration commands and aggregate tests. Dependencies unchanged.
- `README.md`: current flow, lifecycle, settings and commands.

Original Aiko PNGs, filenames, state mappings and authoritative CURSOR_STATES are unchanged. The integration runner creates a second temporary copy of Aiko under a separate test id solely to prove generic switching; it removes the isolated profile after all launches and never modifies the installed/source pack or the user's normal settings.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed strict TypeScript |
| `npm test` | Passed 61 unit tests: 16 characters, 13 cursor, 12 companion, 11 states, 9 flow; storage checks also passed |
| `npm run build` | Passed Electron/preload/native-helper and Vite production builds |
| `npm run smoke` | Passed production renderer/preload isolation, real Aiko 16-image decode, denied state overrides and real tray creation |
| `npm run check:flow` | Passed three production Electron launches using one isolated local profile with network disabled from startup |
| `npm run smoke:state` | Passed all 16 original states in one overlay, same window, AUTO/native Windows detection, click-through flags, fallback validation and cleanup |
| `npm run smoke:overlay` | Passed transparency, Windows click-through/no-activate flags, renderer isolation, close independence, restart and intentional renderer-crash cleanup |

The flow check exercises actual DOM controls for onboarding, Hide/Show, Pause/Resume, generic character activation, size=132, offset.x=38, opacity=.65, smoothing=.2, navigation, premium filters/search, mock Buy and the 16-state detail dialog. It checks the development selector has exactly AUTO plus 16 states. It validates settings against the main-process services and real overlay bounds. Closing through preload hides rather than destroys the main window and leaves the companion running. Actual Electron MenuItem callbacks test tray reopen/settings, hide/show app, companion actions, switching and Quit.

Relaunch 2 restores completed onboarding, the second selected character, all appearance values and hidden main-window launch preference, automatically starts one companion, then pauses it. Relaunch 3 retains the paused enabled=false state and creates no active companion. Every explicit Quit reaches will-quit with companion/cursor stopped, state normal and tray destroyed. Renderer require/process are undefined. A remote fetch is rejected, and both renderer sessions were offline before window/service startup.

Layout checks cover 1280 x 800, 1440 x 900 and 1920 x 1080, with no horizontal document overflow. Screenshot inspection covers welcome, character selection, Home, Characters, Settings, Store and product details. The tested Windows display uses 125% scaling.

Artifacts: `dist/validation/flow-first-result.json`, `flow-restart-result.json`, `flow-paused-result.json`, `flow-*.png`, `state-result.json`, `overlay-result.json` and the 16 images under `states/`. These are generated validation output, not shipped character assets.

## Remaining checks and limits

No failing typecheck, unit test, build or tested Windows flow remains. macOS status-item/runtime behavior is implemented but untested on this Windows machine. Physical multi-monitor/mixed-DPI testing remains outstanding from earlier steps. Tray actions were tested via actual Electron menu callbacks; physical clicking/right-clicking the Windows notification-area popup is still a manual check. Offline validation uses Electron's offline network emulation plus production request restrictions; the machine's physical network adapter was not disabled. Premium concept products intentionally have no artwork/assets and cannot be installed or purchased. No installer/signing work or OS login startup was introduced.

Tray lifecycle follows the official [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) and [tray tutorial](https://www.electronjs.org/docs/latest/tutorial/tray).

## Exact next step

**Phase 1 - Step 7 - UI/UX Polish**, only after the user requests it. Step 6 is complete; do not proceed to Steps 7-10, backend or real payments automatically.
