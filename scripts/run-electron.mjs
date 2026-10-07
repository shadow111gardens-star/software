import { spawn } from 'node:child_process';
import electron from 'electron';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const env = { ...process.env };
// Tool hosts can inherit this flag; the desktop launcher must run Electron as an app.
delete env.ELECTRON_RUN_AS_NODE;
const args = process.argv.slice(2);
const testing = args.some(value => ['--smoke-test', '--overlay-smoke', '--state-smoke', '--cursor-check', '--overlay-check', '--state-check'].includes(value));
const profile = testing ? await mkdtemp(join(tmpdir(), 'anime-cursor-validation-')) : null;
if (profile) args.push('--validation-profile=' + profile);
const child = spawn(electron, ['.', ...args], { env, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', async code => { process.exitCode = code ?? 1; if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
