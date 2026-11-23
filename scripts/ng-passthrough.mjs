// Bridge for the Ionic CLI (`ionic serve`, `ionic cap run -l`, `ionic build`).
// The Ionic CLI always appends `--project=app`, but this workspace's Angular project is
// `glow`, so that flag is dropped and every other argument is forwarded to `ng`.
// Usage: node scripts/ng-passthrough.mjs <serve|build> [...args]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ngBin = require.resolve('@angular/cli/bin/ng.js');

const [command, ...rest] = process.argv.slice(2);
if (command !== 'serve' && command !== 'build') {
  throw new Error(`Unsupported command "${String(command)}". Expected "serve" or "build".`);
}

const forwarded = [];
for (let index = 0; index < rest.length; index++) {
  const arg = rest[index];
  if (arg.startsWith('--project=')) {
    continue;
  }
  if (arg === '--project') {
    index++;
    continue;
  }
  forwarded.push(arg);
}

const child = spawn(process.execPath, [ngBin, command, ...forwarded], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
