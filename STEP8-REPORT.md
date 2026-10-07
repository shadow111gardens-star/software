# Step 8 — Offline local storage and persistence

Implemented within Phase 1. No backend, account, payment, download, sync or network dependency was added.

## Storage architecture

The main process owns `LocalSettingsStore` in Electron's `userData/settings` directory. The renderer continues to use the existing sandboxed preload and validated IPC bridge. The versioned `PersistedAppState` reuses shared `AppSettings`; it does not duplicate product types.

Reads validate and repair preferences before character selection, app flow, renderer initialization and automatic overlay startup. CharacterManager remains responsible for installed pack discovery and valid selection: a missing selection falls back to Aiko, then another valid local pack according to its existing deterministic policy.

Validated changes enter a main-process memory cache immediately. Appearance refresh consumes that cache while persistence runs. Writes are serialized; each writes a unique temporary file, flushes it, closes it and atomically renames it. `settings.json.bak` contains the preceding successfully committed state. Save failures reject the operation and roll the cache back to the durable state; temporary files are cleaned up. Quit drains accepted app-flow operations.

## Persisted fields

- `onboardingCompleted`, `activeCharacterId`.
- `companionEnabled`, `companionVisible`, `companionPaused`.
- `characterSize`, `cursorOffset.x/y` (existing cursor distance representation), `opacity`, `smoothing`.
- `startCompanionAutomatically`, `startMinimized`.

Pause is the canonical inverse of enabled, matching the existing Pause/Resume product behavior. Visibility is independent and remains saved while paused. A hidden companion starts without showing the overlay; Resume retains the hidden preference until Show is chosen. Existing first-install defaults are retained, with onboarding gating startup.

Installed manifests and original PNGs remain on disk in the character system. No image bytes, cursor positions, semantic cursor states, cursor handles, timers, Electron/renderer objects or debug data enter settings.

## Schema and recovery

Schema version 1 uses `{ version: 1, settings: AppSettings }`. `app-state.ts` is the migration boundary for unversioned legacy settings and future additions. Known fields in older versioned documents are recovered, and missing/invalid fields receive existing defaults independently, including each cursor offset axis. Contradictory pause/enabled values are normalized. Runtime and unknown fields are discarded.

Missing files are initialized. Empty or malformed JSON recovers a valid previous backup when available, otherwise defaults. Partial documents preserve valid fields. Original damaged or migrated documents are saved once as `settings.recovered-<timestamp>-<uuid>.json` before replacement. Repairs produce canonical version 1 JSON and useful diagnostics without an alarming dialog.

## Files changed

- `src/services/storage/app-state.ts` — typed schema and migration/repair boundary.
- `src/services/storage/settings-store.ts` — cached reads, recovery, backup, atomic serialized writes and rollback.
- `src/shared/types/app.ts`, `src/shared/constants/settings.ts` — visibility/pause fields, defaults and canonical validation.
- `src/services/app/local-app-flow.ts` — persistent Hide/Show, restoration and live appearance application.
- `src/services/companion/companion-controller.ts` — hidden startup without a visible flash.
- `src/services/companion/companion.test.ts`, `src/services/characters/characters.test.ts` — regression coverage and recovery diagnostics.
- `scripts/check-storage.mjs` — isolated migration, recovery, persistence, concurrency and failed-write checks.
- `src/main/index.ts`, `scripts/run-electron.mjs` — isolated smoke/validation profiles, cleaned up after process exit.
- `src/main/app-flow/validation.ts` — offline hidden/paused relaunch checks with Aiko and synchronized UI editing.
- `README.md`, `STEP8-REPORT.md` — persistence behavior and verification documentation.

## Verification

All required checks passed:

- `npm run typecheck`.
- `npm test`: 67 unit tests (16 character, 13 cursor, 13 companion, 13 state, 12 flow), plus expanded storage checks.
- `npm run test:electron`: native PNG decode, all 16 IPC assets, selection and deliberate missing-asset recovery.
- `npm run build`: production Electron/native helper and renderer build.
- `npm run smoke`: production sandbox, assets, ready UI and denied development override.

Additional checks passed:

- Five independent offline Electron processes exercise fresh onboarding, Start/Skip, restart without onboarding, Settings → Restart Setup, Home/Store/Settings controls, tray actions, close-to-tray and explicit Quit.
- Appearance restores at size 132, offset x 38/y 20, opacity 0.65 and smoothing 0.2. Aiko remains active. Hidden startup restores, pause survives another process restart, Resume remains hidden and Show persists visibility.
- Main UI layout checks at 1280×800, 1440×900 and 1920×1080 have no horizontal overflow.
- `npm run smoke:state`: all 16 assets; real native default/text/help/link/precision recognition; custom SVG cursor resolves to extra with the original extra asset; default returns to normal.
- `npm run smoke:overlay`: transparent, native click-through/no-activation flags and deliberate renderer-crash cleanup.
- SHA-256 comparison: all 16 shipped Aiko PNGs match the user's original files byte for byte.

Storage tests use temporary directories. Electron validation uses isolated temporary profiles, including smoke checks; the user's real app data is not used for these tests. Runtime UI QA was automated through the app-owned Electron validation harness. Physical power-loss, an OS reboot, multiple monitors and macOS were not tested.

Stopped after Step 8.
