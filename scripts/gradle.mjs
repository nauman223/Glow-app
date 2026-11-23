// Runs the Android Gradle wrapper with the given arguments on any OS (gradlew.bat on Windows).
//
//   node scripts/gradle.mjs assembleRelease -PGLOW_RELEASE_TEST=true
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const isWindows = process.platform === 'win32';
const wrapper = isWindows ? 'gradlew.bat' : './gradlew';

const result = spawnSync(wrapper, process.argv.slice(2), {
  cwd: androidDir,
  stdio: 'inherit',
  // .bat files can only be started through the shell on Windows.
  shell: isWindows,
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
