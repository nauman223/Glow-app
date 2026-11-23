// Writes release-only values (AdMob unit IDs, optional API/legal overrides) into
// src/environments/environment.ts from environment variables, so they are never committed.
// Used by CI before `npm run build:prod`. Locally it is a no-op unless the variables are set.
//
//   node scripts/inject-env.mjs            -> inject whatever variables are set
//   node scripts/inject-env.mjs --require  -> also fail if any release variable is missing
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../src/environments/environment.ts', import.meta.url));
const indexHtml = fileURLToPath(new URL('../src/index.html', import.meta.url));

/** Environment property (as written in environment.ts) -> CI variable that supplies it. */
const mappings = [
  { property: 'bannerUnitId', variable: 'GLOW_ADMOB_BANNER_ID', requiredForRelease: true },
  {
    property: 'interstitialUnitId',
    variable: 'GLOW_ADMOB_INTERSTITIAL_ID',
    requiredForRelease: true,
  },
  { property: 'rewardedUnitId', variable: 'GLOW_ADMOB_REWARDED_ID', requiredForRelease: true },
  { property: 'nativeUnitId', variable: 'GLOW_ADMOB_NATIVE_ID', requiredForRelease: true },
  { property: 'privacyPolicyUrl', variable: 'GLOW_PRIVACY_POLICY_URL', requiredForRelease: true },
  { property: 'termsUrl', variable: 'GLOW_TERMS_URL', requiredForRelease: true },
  { property: 'baseUrl', variable: 'GLOW_API_BASE_URL', requiredForRelease: false },
];

const requireAll = process.argv.includes('--require');
const adUnitPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
const httpsPattern = /^https:\/\/[^\s'"\\]+$/;

/**
 * HTTPS origins allowed by the CSP `connect-src` in src/index.html. The CSP is static (it ships in
 * the bundle), so an API override to any other host would build fine and then fail every request
 * at runtime. Parsed from the file so there is no second list to keep in step.
 */
function cspConnectOrigins() {
  const html = readFileSync(indexHtml, 'utf8');
  const directive = /connect-src\s+([^;"]+)/.exec(html);
  if (!directive) {
    throw new Error('No CSP connect-src directive found in src/index.html.');
  }
  return directive[1]
    .split(/\s+/)
    .filter((source) => source.startsWith('https://'))
    .map((source) => new URL(source).origin);
}

/** Extra check for values that are hosts the app will call. */
function assertAllowedApiOrigin(variable, value) {
  const allowed = cspConnectOrigins();
  const { origin } = new URL(value);
  if (!allowed.includes(origin)) {
    throw new Error(
      `${variable} origin ${origin} is not allowed by the CSP connect-src in src/index.html ` +
        `(allowed: ${allowed.join(', ')}). Add the host to the CSP first.`,
    );
  }
}

let content = readFileSync(target, 'utf8');
const missing = [];
let injected = 0;

for (const { property, variable, requiredForRelease } of mappings) {
  const value = process.env[variable]?.trim();
  if (!value) {
    if (requiredForRelease) missing.push(variable);
    continue;
  }
  const isAdUnit = property.endsWith('UnitId');
  if (isAdUnit ? !adUnitPattern.test(value) : !httpsPattern.test(value)) {
    throw new Error(`${variable} has an invalid format for ${property}.`);
  }
  if (property === 'baseUrl') {
    assertAllowedApiOrigin(variable, value);
  }
  const pattern = new RegExp(`(\\b${property}:\\s*)'[^']*'`);
  if (!pattern.test(content)) {
    throw new Error(
      `Property "${property}" not found in environment.ts; update scripts/inject-env.mjs.`,
    );
  }
  content = content.replace(pattern, `$1'${value}'`);
  injected += 1;
}

if (requireAll && missing.length > 0) {
  throw new Error(`Missing release variables: ${missing.join(', ')}`);
}

writeFileSync(target, content);
process.stdout.write(`inject-env: ${injected} value(s) injected, ${missing.length} not set.\n`);
