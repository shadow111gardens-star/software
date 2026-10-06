import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import type { CharacterPack } from '../../shared/types/character';
export type ManifestResult = { valid: true; pack: CharacterPack } | { valid: false; errors: string[] };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function isJson(value: unknown, depth = 0): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => isJson(item, depth + 1));
  return record(value) && Object.values(value).every(item => isJson(item, depth + 1));
}
export function isLocalAssetPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    !value.startsWith('/') && !/[\\:\x00-\x1f?#%]/.test(value) &&
    value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..') && /\.(png|jpe?g)$/i.test(value);
}
export function validateManifest(value: unknown): ManifestResult {
  if (!record(value)) return { valid: false, errors: ['Manifest must be a JSON object'] };
  const errors: string[] = [];
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id) || value.id.length > 128) errors.push('id must be a lowercase slug (maximum 128 characters)');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 128) errors.push('name must be nonempty (maximum 128 characters)');
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (typeof value.version !== 'string' || value.version.length > 128 || !semver.test(value.version)) errors.push('version must be valid semantic versioning');
  for (const key of ['description', 'author'] as const) if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 4096)) errors.push(`${key} must be a string (maximum 4096 characters)`);
  if (value.preview !== undefined && !isLocalAssetPath(value.preview)) errors.push('preview must be a safe relative PNG/JPEG path');
  if (!Array.isArray(value.platforms) || value.platforms.length === 0 || value.platforms.some(p => p !== 'windows' && p !== 'macos') || new Set(value.platforms).size !== value.platforms.length) errors.push('platforms must contain unique windows/macos values');
  if (value.metadata !== undefined && (!record(value.metadata) || !isJson(value.metadata))) errors.push('metadata must be a JSON object');
  if (!record(value.states)) errors.push('states must be an object');
  else {
    const states = value.states;
    for (const state of CURSOR_STATES) if (!Object.hasOwn(states, state) || !isLocalAssetPath(states[state])) errors.push(`State ${state} requires a safe relative PNG/JPEG path`);
    for (const state of Object.keys(states)) if (!(CURSOR_STATES as readonly string[]).includes(state)) errors.push(`Unknown state: ${state}`);
    const mappings = Object.values(states).filter((path): path is string => typeof path === 'string').map(path => path.toLowerCase());
    if (new Set(mappings).size !== mappings.length) errors.push('Duplicate state asset mappings');
  }
  if (errors.length) return { valid: false, errors };
  const pack = value as unknown as CharacterPack;
  return { valid: true, pack: { id: pack.id, name: pack.name, version: pack.version, platforms: [...pack.platforms], states: { ...pack.states }, metadata: pack.metadata ?? {}, ...(pack.description !== undefined && { description: pack.description }), ...(pack.author !== undefined && { author: pack.author }), ...(pack.preview !== undefined && { preview: pack.preview }) } };
}
