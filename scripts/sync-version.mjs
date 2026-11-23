// Syncs the semver version in package.json (the single source of truth) to:
// - src/app/core/config/app-version.ts (shown in Settings)
// - Android versionName / versionCode
// - iOS MARKETING_VERSION / CURRENT_PROJECT_VERSION
// versionCode / build number = major * 10000 + minor * 100 + patch (e.g. 1.2.3 -> 10203).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const resolve = (relativePath) => fileURLToPath(new URL(relativePath, root));

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  throw new Error(`package.json version "${version}" must be plain semver (MAJOR.MINOR.PATCH).`);
}
const [major, minor, patch] = match.slice(1).map(Number);
if (minor > 99 || patch > 99) {
  throw new Error('Minor and patch must be <= 99 to keep build numbers monotonic.');
}
const buildNumber = major * 10000 + minor * 100 + patch;

function update(relativePath, replacements) {
  const path = resolve(relativePath);
  if (!existsSync(path)) {
    process.stdout.write(`skip ${relativePath} (not found)\n`);
    return;
  }
  const original = readFileSync(path, 'utf8');
  let content = original;
  for (const [pattern, replacement] of replacements) {
    // Global patterns keep lastIndex between test() calls; reset so the check is reliable.
    pattern.lastIndex = 0;
    if (!pattern.test(content)) {
      throw new Error(`Pattern ${pattern} not found in ${relativePath}`);
    }
    pattern.lastIndex = 0;
    content = content.replace(pattern, replacement);
  }
  if (content === original) {
    process.stdout.write(`unchanged ${relativePath}\n`);
    return;
  }
  writeFileSync(path, content);
  process.stdout.write(`updated ${relativePath}\n`);
}

update('src/app/core/config/app-version.ts', [
  [/APP_VERSION = '[^']*'/, `APP_VERSION = '${version}'`],
]);

update('android/app/build.gradle', [
  [/versionCode \d+/, `versionCode ${buildNumber}`],
  [/versionName "[^"]*"/, `versionName "${version}"`],
]);

update('ios/App/App.xcodeproj/project.pbxproj', [
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`],
]);

process.stdout.write(`Version ${version} (build ${buildNumber}) synced.\n`);
