# Step 11 — desktop installers

`Build Desktop` in `.github/workflows/build-desktop.yml` runs on pushes to `main` and manual `workflow_dispatch`. Its three jobs use standard Windows/macOS runners, Node 22.20.0 from `.node-version`, `npm ci`, typecheck, unit/storage tests, Electron tests and the production build before packaging. No publishing or secrets are configured.

## Configuration and commands

`electron-builder.json` is the single packaging configuration. `package.json` adds only the missing `dist` script and pins electron-builder 26.15.3; `package-lock.json` locks its dependencies. The package name and all existing scripts remain intact.

```sh
npm ci
npm run typecheck
npm test
npm run test:electron
npm run build
```

After these checks, package on Windows:

```sh
npm run dist -- --win --x64 --publish never
```

Or on macOS:

```sh
npm run dist -- --mac --x64 --publish never
npm run dist -- --mac --arm64 --publish never
```

Windows uses an unsigned x64 NSIS installer with a selectable installation directory. Uninstall preserves local settings. macOS uses separate unsigned Intel and Apple Silicon DMGs. Signing and notarization are disabled for these development builds; no Apple certificates are required. Windows SmartScreen and macOS security warnings may appear for unsigned downloads. See [Windows options](https://www.electron.build/v26/docs/win/) and [macOS options](https://www.electron.build/v26/docs/mac/).

The package includes compiled main/preload bundles, the production renderer, original character assets and the Windows native helper. ASAR is disabled to preserve the existing helper executable's relative filesystem path without changing application code. Validation files, logs, maps and previous release output are excluded. The default Electron packaging icon is retained.

## Outputs

| GitHub Actions artifact | Installer inside (version 0.1.0) |
| --- | --- |
| `AnimeCursor-Windows-x64` | `AnimeCursor-Setup-0.1.0.exe` |
| `AnimeCursor-macOS-x64` | `AnimeCursor-0.1.0-x64.dmg` |
| `AnimeCursor-macOS-arm64` | `AnimeCursor-0.1.0-arm64.dmg` |

Download from **GitHub → Actions → Build Desktop → successful run → Artifacts**. Installers are retained for seven days. No workflow has been pushed or run remotely in this session; it will run once these changes reach `main`, or can then be started manually.

Local outputs go to `release/`. The generated Windows installer is `C:\Users\Abhay Solanki\Downloads\software\release\AnimeCursor-Setup-0.1.0.exe`. Its payload is `release/win-unpacked/AnimeCursor.exe`. The existing portable packaging script remains available. `.gitignore` already contains `node_modules/`, `dist/`, `*.log` and `release/`; generated outputs remain ignored and uncommitted.

Only standard GitHub-hosted runners are used, with no paid service or larger runner. Public repository usage is free; private repositories use the account's included Actions allowance. See [GitHub runner billing](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job).

## Validation and limits

- Typecheck: passed.
- Unit tests: 73 passed, plus storage migration/recovery checks.
- Electron tests: passed, including native PNG decoding and the missing-asset fixture.
- Production build: passed.
- Windows NSIS packaging: passed; installer and unpacked payload generated.
- `node scripts/test-packaged-windows.mjs --executable=release/win-unpacked/AnimeCursor.exe`: passed clean onboarding, persisted relaunch, all 16 original assets, offline Store, native cursor transitions, overlay, close-to-tray and explicit Quit, including a 60-second performance observation. Installer installation/uninstallation was not exercised.
- electron-builder configuration schema: passed, including macOS options.
- Workflow YAML, triggers, targets and check ordering: validated/reviewed.
- Final Git diff and ignored output paths: reviewed.

The existing Windows packaged QA script now also accepts `--executable=release/win-unpacked/AnimeCursor.exe`. It tests the builder payload using an isolated temporary profile and offline sessions through the existing external inspector mechanism. No production test API was added.

macOS DMGs were **not built locally**, and macOS runtime was **not tested on Windows**. GitHub Actions is configured to package them and run available automated checks. Future macOS installation/runtime QA remains necessary. The existing macOS semantic cursor fallback to `extra` is unchanged.

No app UI, cursor logic, Aiko assets, backend, payments, authentication or application network functionality was changed. Dependency installation and packaging-tool downloads use build-time network access only.
