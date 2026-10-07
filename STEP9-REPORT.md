# Step 9 — Local Store mock

Completed within Phase 1. The Store remains entirely local. No payment, checkout, backend, authentication, entitlement, download or network service was introduced.

## Architecture and catalog

The existing `LocalCatalogService` supplies typed `LocalProduct` entries through the secure preload/IPC flow API. Installed pack metadata and artwork come from CharacterManager; local premium concepts come from `mock-products.ts`. The existing product model provides id, characterId, name, description, local preview, price/currency, free/featured/installed/concept flags, platforms, version and state count. Premium is derived from `isFree`; installed ownership comes from valid local packs.

Aiko is free, installed, featured and backed by its 16 original PNGs. Neko and Yuki are premium, locked, not installed and have no invented artwork. Sakura Companion and Midnight Idol remain explicitly identified local mock concepts. Missing artwork uses a clean locked placeholder. Installed packs with missing previews show an unavailable-preview message rather than being labelled locked concepts.

Main navigation remains Home, Store and Settings. Store activation uses the existing flow → CharacterManager → Step 8 storage path; no second selection system was added.

## Store experience

- Exact header: “Character Store” and “Discover new companions for your cursor.”
- Local, case-insensitive search; All, Featured, Free, Premium and Installed filters; existing Featured/Name/Price sorting.
- Cards show artwork or placeholders, names, descriptions, FREE/PREMIUM, FEATURED/INSTALLED badges, active/locked status, state count and premium prices.
- Clicking the artwork/name, card surface or Details opens that product in the selected detail panel. Buttons have separate actions; cards have hover and selected borders/glow.
- Installed products offer Use Character, including an already-active Aiko. Activation remains persisted across relaunches.
- Empty search shows “No characters found” and “Try a different search.” An empty Installed filter shows “No installed characters yet.”

The detail panel includes a large selected-state preview, product name/description, installation status, price where applicable, primary action and Overview/States/Info content. It scrolls independently to keep previews usable within the desktop window.

## Exact 16-state previews

The preview grid uses the existing canonical `CURSOR_STATES` list:

`normal`, `help`, `working`, `busy`, `precision`, `text`, `handwriting`, `unavailable`, `move`, `horizontal`, `diagonal`, `alternate`, `vertical`, `diagonalSecondary`, `link`, `extra`.

Aiko displays the real asset for every state, fetched through the existing character bridge. Selecting a tile updates the large preview. Both diagonal states remain distinct. Valid local previews are cached for repeat browsing; failed reads can retry. A fallback image is never labelled as a different requested state. Premium concepts show the same 16 planned names with locked placeholders, without requesting nonexistent packs or substituting Aiko artwork.

## Buy behavior

Every premium card and detail Buy uses the same existing validated IPC mock action. The catalog service returns “Purchases coming soon” and changes no data. The renderer opens a native modal dialog containing:

- “Purchases coming soon”
- “Premium character purchases will be available in a future update.”
- “Got it”

The dialog also supports Escape and native modal focus behavior. Dismissing it returns to the Store. No purchase record, entitlement, ownership change, checkout window, download or settings write is created by Buy.

## Files changed

- `src/renderer/pages/Store.tsx` — header, browsing, empty states and product detail.
- `src/renderer/components/local-flow/CharacterCard.tsx` — clickable cards, badges, statuses and actions.
- `src/renderer/components/local-flow/StatePreviews.tsx` — all 16 local state previews and locked placeholders.
- `src/renderer/components/local-flow/PurchaseNotice.tsx` — shared coming-soon modal.
- `src/renderer/app/local-flow-context.tsx` — display/dismiss the mock purchase notice.
- `src/renderer/app/AppShell.tsx` — remove the redundant purchase toast; error feedback remains.
- `src/renderer/styles/base.css` — scoped Store card, detail, preview and modal styling.
- `src/services/catalog/local-catalog.ts` — exact mock Buy response.
- `src/services/app/local-app-flow.test.ts` — catalog/filter/search/immutable-Buy regression tests.
- `src/main/app-flow/store-validation.ts` — offline Electron Store UI verification.
- `src/main/app-flow/validation.ts` — integrate Store QA, synchronize existing numeric-input QA and verify empty Installed UI.
- `src/main/index.ts`, `scripts/test-flow-electron.mjs` — isolated empty-catalog validation phase.
- `README.md`, `STEP9-REPORT.md` — documentation.

Native cursor tracking/detection, state resolution, transparent overlay, character asset loading, Aiko PNGs, onboarding flow, Home page and settings storage implementation were not changed.

## Validation results

All required commands passed:

- `npm run typecheck`.
- `npm test`: 72 unit tests plus expanded storage checks; zero failures.
- `npm run test:electron`: all 16 original assets decode through sandboxed IPC; selection and deliberate missing-asset recovery pass.
- `npm run build`: production Electron/native helper and renderer build pass.
- `npm run smoke`: ready UI, original assets, renderer isolation and rejected production debug override pass.

Additional automated desktop UI QA passed through `node scripts/test-flow-electron.mjs` (also included in `npm run check:flow`):

- Six isolated Electron launches with networking disabled: onboarding, onboarding restart, full UI/Store QA, persisted restart, paused restart and empty installed catalog.
- Every filter matches its expected catalog subset; searches for AIKO and nEkO return the correct products; unmatched and cleared searches work.
- All 16 Aiko preview data URLs match the original local PNG bytes, decode successfully and remain separate. Tiles can be selected through the scrolling preview grid.
- Use Character selects Aiko through CharacterManager; the following process launches restore Aiko and prior appearance/companion preferences.
- Every premium card Buy and every premium detail Buy displays the exact notice. Catalog and settings remain unchanged apart from the explicitly tested Aiko activation.
- Store interactions make **zero HTTP/HTTPS requests** and open **zero checkout windows**, measured using Electron request/window observers while sessions are offline.
- Product details fit, search remains accessible and there is no horizontal overflow at 1280×800, 1440×900 and 1920×1080. Existing Home/Settings layout checks also pass.
- Screenshots were reviewed; overlapping loading labels found during review were corrected. Final screenshots contain decoded artwork.

Evidence: `dist/validation/store-result.json`, `store-1280.png`, `store-1440.png`, `store-1920.png`, `flow-store-empty-result.json` and other flow relaunch results. Screenshots from the normal Store QA contain a clearly labelled temporary second installed pack to test generic local-pack behavior; it is not shipped or added to the user's catalog.

Tests use temporary storage/profile/character directories and do not change real userData. Desktop UI QA was automated through the app-owned Electron harness; the physical network adapter was not disabled, and macOS/multiple monitors were not tested.

Stopped after Step 9.
