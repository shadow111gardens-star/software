import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This portable build requires Windows x64');
const root = resolve('release');
const output = join(root, 'AnimeCursor-win32-x64');
if (!output.startsWith(root + sep)) throw new Error('Unsafe package output');
await mkdir(root, { recursive: true });
await rm(output, { recursive: true, force: true });
await cp('node_modules/electron/dist', output, { recursive: true });
await rm(join(output, 'resources/default_app.asar'), { force: true });
await rename(join(output, 'electron.exe'), join(output, 'AnimeCursor.exe'));
const application = join(output, 'resources/app');
await mkdir(application, { recursive: true });
for (const directory of ['electron', 'renderer', 'assets', 'native']) {
  await cp(join('dist', directory), join(application, 'dist', directory), { recursive: true });
}
const source = JSON.parse(await readFile('package.json', 'utf8'));
for (const page of ['index.html', 'overlay/index.html']) {
  const html = await readFile(join(application, 'dist/renderer', page), 'utf8');
  if (/localhost|127\.0\.0\.1|\/@vite|:5173/.test(html)) throw new Error('Development resource in production HTML: ' + page);
  if (!html.includes("connect-src 'none'")) throw new Error('Production connection policy is not offline: ' + page);
}
await writeFile(join(application, 'package.json'), JSON.stringify({ name: source.name, productName: 'Anime Cursor', version: source.version, main: 'dist/electron/main.cjs', description: source.description }, null, 2));
// No dependency folder is needed: main/preloads and renderer are bundled; Electron is supplied above.
const executable = join(output, 'AnimeCursor.exe');
const hash = createHash('sha256').update(await readFile(executable)).digest('hex');
await writeFile(join(root, 'windows-build.json'), JSON.stringify({ product: 'Anime Cursor', version: source.version, platform: 'win32', arch: 'x64', electron: JSON.parse(await readFile('node_modules/electron/package.json', 'utf8')).version, executable, executableSHA256: hash, format: 'unsigned portable directory', created: new Date().toISOString() }, null, 2));
console.info('PASS: portable Windows package at ' + executable);
