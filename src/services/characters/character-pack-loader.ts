import { readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import type { CharacterPack, CharacterPlatform, PackProblem } from '../../shared/types/character';
import { isContained, readBoundedFile, readImage, resolveLocalFile, type ImageValidator } from './assets';
import { validateManifest } from './manifest';
export interface LoadedCharacterPack { manifest: CharacterPack; directory: string }
export interface PackLoadResult { packs: LoadedCharacterPack[]; unavailable: PackProblem[] }
export type CharacterLogger = (message: string) => void;
export class CharacterPackLoader {
  constructor(private readonly root: string, private readonly platform: CharacterPlatform | 'unsupported', private readonly validateImage: ImageValidator, private readonly log: CharacterLogger = console.error) {}
  async discover(): Promise<PackLoadResult> {
    const result: PackLoadResult = { packs: [], unavailable: [] };
    const report = (problem: PackProblem) => { result.unavailable.push(problem); this.log(`[characters] ${problem.directory}: ${problem.errors.join('; ')}`); };
    let root: string;
    let entries;
    try { root = await realpath(this.root); entries = await readdir(root, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') report({ directory: 'characters', errors: [String(error)] });
      return result;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      let id: string | undefined;
      try {
        const directory = await realpath(join(root, entry.name));
        if (!isContained(root, directory)) throw new Error('Pack directory escapes characters root');
        const manifestPath = await resolveLocalFile(directory, 'manifest.json');
        const manifest = validateManifest(JSON.parse((await readBoundedFile(manifestPath, 64 * 1024)).toString('utf8')));
        if (!manifest.valid) { report({ directory: entry.name, errors: manifest.errors }); continue; }
        id = manifest.pack.id;
        if (this.platform === 'unsupported' || !manifest.pack.platforms.includes(this.platform)) throw new Error(`Pack does not support ${this.platform}`);
        const errors: string[] = [];
        const resolved = new Set<string>();
        for (const state of CURSOR_STATES) {
          try {
            const image = await readImage(directory, manifest.pack.states[state], this.validateImage);
            const canonical = process.platform === 'win32' ? image.path.toLowerCase() : image.path;
            if (resolved.has(canonical)) errors.push(`State ${state} duplicates another resolved asset`);
            resolved.add(canonical);
          } catch (error) { errors.push(`State ${state}: ${String(error)}`); }
        }
        if (manifest.pack.preview) try { await readImage(directory, manifest.pack.preview, this.validateImage); } catch (error) { errors.push(`Preview: ${String(error)}`); }
        if (errors.length) { report({ directory: entry.name, id, errors }); continue; }
        result.packs.push({ manifest: manifest.pack, directory });
      } catch (error) { report({ directory: entry.name, ...(id && { id }), errors: [String(error)] }); }
    }
    const counts = new Map<string, number>();
    for (const pack of result.packs) counts.set(pack.manifest.id, (counts.get(pack.manifest.id) ?? 0) + 1);
    result.packs = result.packs.filter(pack => {
      if (counts.get(pack.manifest.id)! <= 1) return true;
      report({ directory: pack.manifest.id, id: pack.manifest.id, errors: ['Duplicate character id; all conflicting packs are unavailable'] }); return false;
    });
    return result;
  }
}
