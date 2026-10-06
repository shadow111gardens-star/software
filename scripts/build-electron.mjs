import { resolve, sep } from 'node:path';
import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
if (process.platform === 'win32') {
  const nativeOutput = resolve('dist/native/windows');
  await mkdir(nativeOutput, { recursive: true });
  const compiler = resolve(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  await promisify(execFile)(compiler, ['/nologo', '/target:exe', '/optimize+', `/out:${resolve(nativeOutput, 'cursor-context.exe')}`, resolve('src/platform/windows/native/CursorContext.cs')], { windowsHide: true });
}
await build({ entryPoints: { main: 'src/main/index.ts', preload: 'src/preload/index.ts', 'overlay-preload': 'src/preload/overlay.ts' }, outdir: 'dist/electron', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', external: ['electron'], sourcemap: true });

await mkdir('dist/assets', { recursive: true });
const charactersOutput = resolve('dist/assets/characters');
if (!charactersOutput.startsWith(resolve('dist') + sep)) throw new Error('Unsafe assets output path');
await rm(charactersOutput, { recursive: true, force: true });
await cp('src/assets/characters', 'dist/assets/characters', { recursive: true, dereference: false });
