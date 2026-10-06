import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
const temporary = await mkdtemp(join(tmpdir(), 'anime-cursor-electron-runner-'));
try {
  const output = join(temporary, 'test.cjs');
  await build({ entryPoints: ['src/services/characters/characters.electron-test.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((accept, reject) => {
    const child = spawn(electron, [output], { env, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => accept(code ?? 1));
  });
  process.exitCode = code;
} finally {
  if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test directory');
  await rm(temporary, { recursive: true, force: true });
}
