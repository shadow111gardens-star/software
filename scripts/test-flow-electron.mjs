import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
const temporary = await mkdtemp(join(tmpdir(), 'anime-cursor-flow-check-'));
try {
  const profile = join(temporary, 'profile'); await mkdir(join(profile, 'characters'), { recursive: true });
  await cp('dist/assets/characters/aiko', join(profile, 'characters/aiko'), { recursive: true });
  await cp('dist/assets/characters/aiko', join(profile, 'characters/test-future'), { recursive: true });
  const manifest = JSON.parse(await readFile(join(profile, 'characters/test-future/manifest.json'), 'utf8'));
  manifest.id = 'test-future'; manifest.name = 'Future pack (temporary test fixture)';
  await writeFile(join(profile, 'characters/test-future/manifest.json'), JSON.stringify(manifest));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  for (const phase of ['first', 'restart', 'paused']) {
    const code = await new Promise((accept, reject) => {
      const child = spawn(electron, ['.', `--flow-check=${phase}`, `--flow-profile=${profile}`], { env, stdio: 'inherit', windowsHide: true });
      const timeout = setTimeout(() => { child.kill(); reject(new Error(`Flow ${phase} timed out`)); }, 90000);
      child.on('error', error => { clearTimeout(timeout); reject(error); }); child.on('exit', code => { clearTimeout(timeout); accept(code ?? 1); });
    });
    if (code !== 0) throw new Error(`Flow ${phase} exited with ${code}`);
  }
  console.info('PASS: isolated first launch, UI actions, tray callbacks, persisted relaunch, paused relaunch, offline mode and Quit cleanup');
} finally {
  if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep) || !temporary.includes('anime-cursor-flow-check-')) throw new Error('Unsafe flow profile cleanup');
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
