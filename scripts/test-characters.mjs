import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
const temporary = await mkdtemp(join(tmpdir(), 'anime-cursor-tests-'));
try {
  const output = join(temporary, 'characters.test.cjs');
  await build({ entryPoints: ['src/services/characters/characters.test.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs' });
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  await rm(temporary, { recursive: true, force: true });
}
