import { spawn } from 'node:child_process';
import electron from 'electron';
const env = { ...process.env };
// Tool hosts can inherit this flag; the desktop launcher must run Electron as an app.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', ...process.argv.slice(2)], { env, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
