# Local character packs

Aiko is installed under `aiko/` with the 16 user-supplied PNGs. Original filenames and image bytes are preserved. Its manifest maps the supplied image order to the exact 16 states, including separate diagonal assets. No placeholder artwork has been created.

Add one subdirectory per pack, containing manifest.json and its real PNG/JPEG images. Paths are relative to the pack directory and can retain existing filenames/subdirectories. The manifest requires id (lowercase slug), name, semantic version, platforms (windows and/or macos), and states. Optional fields: description, author, preview, metadata (JSON object).

The exact state identifiers live in src/shared/constants/cursor-states.ts. Each must map to a distinct existing, decodable PNG/JPEG file. diagonal and diagonalSecondary are separate states. Files must remain inside the pack directory, including symlink targets; images are limited to 5 MiB and manifests to 64 KiB.

Run npm run build (or restart npm run dev) after adding/changing source packs. The build copies this directory to dist/assets/characters; runtime discovery reads that local directory without network access. New packs need no manager changes. Aiko is only a bootstrap default preference.

See `aiko/manifest.json` for the installed pack and its preserved filenames. Preview is optional, but must resolve when declared.
