# Phase 1 / Step 2 report

Step 2 is complete: the generic local Character Asset System is implemented and the real Aiko pack is installed and validated. The user subsequently supplied 16 PNG assets from Downloads/aiko; those files were copied unchanged with their original filenames, and a manifest was created from the supplied order and visible icons. No artwork was generated or edited.

## Inspection

Reused Electron/React/strict TypeScript/Vite, npm lockfile, the secure preload bridge, and LocalSettingsStore from Step 1. At the initial inspection, no previous character engine, manifests, asset files, or repository AGENTS.md were present. No working application files were deleted.

## Files created

- `src/shared/constants/cursor-states.ts`
- `src/shared/types/character.ts`
- `src/services/characters/manifest.ts`
- `src/services/characters/assets.ts`
- `src/services/characters/character-pack-loader.ts`
- `src/services/characters/character-manager.ts`
- `src/services/characters/characters.test.ts`
- `src/services/characters/characters.electron-test.ts`
- `src/main/characters/index.ts`
- `src/main/characters/ipc.ts`
- `src/renderer/components/CharacterDiagnostics.tsx`
- `src/assets/characters/README.md`
- `scripts/test-characters.mjs`
- `scripts/test-characters-electron.mjs`
- `STEP2-REPORT.md`

## Files modified

- `src/shared/types/app.ts`
- `src/shared/constants/ipc.ts`
- `src/preload/index.ts`
- `src/main/index.ts`
- `src/renderer/App.tsx`
- `scripts/build-electron.mjs`
- `package.json`
- `README.md`

Generated production output was rebuilt under ignored dist/. Dependencies added: none.

## Asset and manifest status

- Real assets detected: 16 user-supplied PNGs. Aiko manifest: valid, version 1.0.0, compatible with Windows/macOS. All images are under the 5 MiB limit. SHA-256 comparisons confirmed all copied source images are identical to the originals.
- Installed production catalog: 1 valid pack (Aiko), 0 invalid packs, active character aiko. A second application launch restored the persisted selection.
- The shared CURSOR_STATES constant contains exactly the required 16 identifiers. diagonal and diagonalSecondary remain distinct.
- All 16 real Aiko state mappings resolved without fallback and decoded successfully in the sandboxed production Electron renderer. The smoke test now checks every installed pack, in addition to the existing fixture integration tests.
- Fixtures are temporary one-pixel PNGs used only by tests, not installed character artwork.

## Implementation

CharacterPackLoader discovers one directory per pack, validates metadata, semantic version, platform compatibility, exact state completeness, duplicate paths/ids, path containment, file existence, PNG/JPEG signatures, and decoded image validity. Broken packs are logged and unavailable individually. Images are bounded at 5 MiB and manifests at 64 KiB. PNG/JPEG are the initial supported formats, aligned with Electron nativeImage's documented cross-platform support: https://www.electronjs.org/docs/latest/api/native-image#supported-formats

CharacterManager lists/looks up packs, selects one active character, persists through the existing settings store, restores selection, and falls back to the configured bootstrap default or first lexical id. Aiko is only the bootstrap preference outside the generic manager. Settings writes synchronize active selection rather than creating a second storage system. Returned models are defensive copies.

Asset access rechecks files at request time and returns image data URLs through a typed, sender-checked IPC API. Missing/undecodable state images log the cause, return normal with an explicit fallback flag, then return null if normal also fails. React has no filesystem or Electron access. The minimal diagnostics section reports availability, active selection, and state resolution; no polished Characters/Store UI was built.

Build and development startup copy source packs to dist/assets/characters while preserving names. Adding a pack needs only its real assets and manifest, followed by build/restart, without manager changes.

## Validation

- `npm run typecheck`: PASS (also runs in production build).
- `npm test`: PASS, 16 character tests plus existing storage checks. Covers state completeness, strict manifests, exact filenames, all states, persistence/restart, future packs, invalid/missing/corrupt assets, fallback, duplicate packs, platform/preview errors, directory/asset symlink escapes and aliases, defensive copies, bounded reads, and settings synchronization.
- `npm run test:electron`: PASS. Actual Electron native image decoding, all 16 data URLs transferred over preload and decoded in a sandboxed Chromium renderer, active selection, and runtime normal fallback. The intentionally deleted help fixture logged its expected ENOENT error.
- `npm run build`: PASS.
- `npm run smoke`: PASS on two separate launches with real Aiko assets. Production window visible, React ready, Aiko active, all 16 assets decoded, preload operational, require/process absent, no preload errors.
- Lint: not configured; not run.
- No new packages, backend, remote APIs, network runtime dependencies, cursor tracking, overlay, state engine, or later-step functionality introduced. Existing production network restrictions are unchanged.

## Remaining issues and next step

No remaining Aiko integration issues were detected on Windows. macOS runtime validation remains unperformed on this Windows host. Recommended next step, only when requested: Step 3 Real Cursor Tracking behind the existing platform adapters. Step 3 was not started.

## Real Aiko pack files added

- `src/assets/characters/aiko/manifest.json`
- `src/assets/characters/aiko/Chibi Teal Idol with Play Icon.png`
- `src/assets/characters/aiko/Puzzled Chibi Miku Sticker.png`
- `src/assets/characters/aiko/Chibi Miku Back View with Loading Ring.png`
- `src/assets/characters/aiko/Tired Chibi Miku with Hourglass.png`
- `src/assets/characters/aiko/Chibi Miku with Turquoise Plus Sign.png`
- `src/assets/characters/aiko/Chibi Miku Typing with Floating I.png`
- `src/assets/characters/aiko/Grumpy Cyan Chibi Artist Sticker.png`
- `src/assets/characters/aiko/Grumpy Aqua Chibi with No Symbol.png`
- `src/assets/characters/aiko/Bored Chibi Miku with Cyan Arrows.png`
- `src/assets/characters/aiko/Chibi Teal Twin-Tail Idol Sticker.png`
- `src/assets/characters/aiko/Smug Chibi Mermaid-Tailed Idol.png`
- `src/assets/characters/aiko/Chibi Cyan Anime Girl Sticker.png`
- `src/assets/characters/aiko/Sleeping Teal-Haired Chibi Sticker.png`
- `src/assets/characters/aiko/Bored Chibi Cyan Twin-Tail Sticker.png`
- `src/assets/characters/aiko/Chibi Aqua Idol with Play Button.png`
- `src/assets/characters/aiko/Chibi Miku with Floating Teal Cursor.png`

## State-to-file mapping

The mapping follows the image order supplied by the user and the visible icons. Both diagonal directions retain separate files. The first image is also the preview.

| State | Original filename |
| --- | --- |
| normal | Chibi Teal Idol with Play Icon.png |
| help | Puzzled Chibi Miku Sticker.png |
| working | Chibi Miku Back View with Loading Ring.png |
| busy | Tired Chibi Miku with Hourglass.png |
| precision | Chibi Miku with Turquoise Plus Sign.png |
| text | Chibi Miku Typing with Floating I.png |
| handwriting | Grumpy Cyan Chibi Artist Sticker.png |
| unavailable | Grumpy Aqua Chibi with No Symbol.png |
| move | Bored Chibi Miku with Cyan Arrows.png |
| horizontal | Chibi Teal Twin-Tail Idol Sticker.png |
| diagonal | Smug Chibi Mermaid-Tailed Idol.png |
| alternate | Chibi Cyan Anime Girl Sticker.png |
| vertical | Sleeping Teal-Haired Chibi Sticker.png |
| diagonalSecondary | Bored Chibi Cyan Twin-Tail Sticker.png |
| link | Chibi Aqua Idol with Play Button.png |
| extra | Chibi Miku with Floating Teal Cursor.png |
