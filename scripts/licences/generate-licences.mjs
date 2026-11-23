// Generates the open-source licences shown in Settings → Open-source licences:
//   public/licenses/index.json          one entry per bundled third-party component
//   public/licenses/texts/<hash>.txt    the licence texts, de-duplicated by content
// Sources: node_modules/<pkg>/package.json + LICENSE, the font licence files in public/fonts,
// and the MediaPipe models listed in public/models/MODELS.md. No dependencies; output is
// deterministic, so re-running without changes produces no diff.
// Run after adding, removing or upgrading a runtime dependency, font or model:
//   npm run licences
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MIT_TEMPLATE, detectLicence, normaliseText, repositoryUrl } from './licence-texts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'public', 'licenses');
const TEXT_DIR = join(OUT_DIR, 'texts');
const ANGULAR_LICENSES = join(ROOT, 'dist', 'glow', '3rdpartylicenses.txt');

/** `dependencies` that never reach the app (AOT compiles templates at build time). */
const BUILD_ONLY = new Set(['@angular/compiler']);
/** Transitive packages that are bundled (they appear in Angular's 3rdpartylicenses.txt). */
const TRANSITIVE = ['@ionic/core', '@capacitor/synapse'];
/** Packages published without a licence file: the same project's licence file covers them. */
const LICENCE_FILE_FROM = { '@ionic/angular': '@ionic/core' };
/** Extra context shown with an entry. */
const NOTES = {
  '@mediapipe/tasks-vision':
    'Includes the MediaPipe vision WebAssembly runtime (vision_wasm_module_internal). Copyright The MediaPipe Authors.',
};

const FONTS = [
  { id: 'font-roboto', name: 'Roboto', file: 'public/fonts/LICENSE-Roboto.txt' },
  { id: 'font-bebas-neue', name: 'Bebas Neue', file: 'public/fonts/editor/LICENSE-BebasNeue.txt' },
  { id: 'font-lobster', name: 'Lobster', file: 'public/fonts/editor/LICENSE-Lobster.txt' },
  { id: 'font-montserrat', name: 'Montserrat', file: 'public/fonts/editor/LICENSE-Montserrat.txt' },
  { id: 'font-pacifico', name: 'Pacifico', file: 'public/fonts/editor/LICENSE-Pacifico.txt' },
  {
    id: 'font-playfair-display',
    name: 'Playfair Display',
    file: 'public/fonts/editor/LICENSE-PlayfairDisplay.txt',
  },
];

const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/';
const MODELS = [
  {
    file: 'selfie_segmenter.tflite',
    name: 'MediaPipe Selfie Segmenter',
    path: 'image_segmenter/selfie_segmenter/float16/1/',
  },
  {
    file: 'selfie_multiclass_256x256.tflite',
    name: 'MediaPipe Multiclass Selfie Segmenter',
    path: 'image_segmenter/selfie_multiclass_256x256/float32/1/',
  },
  {
    file: 'deeplab_v3.tflite',
    name: 'DeepLab v3 (MediaPipe image segmenter)',
    path: 'image_segmenter/deeplab_v3/float32/1/',
    notice: 'Copyright The TensorFlow Authors. Trained on PASCAL VOC 2012.',
  },
  {
    file: 'magic_touch.tflite',
    name: 'MediaPipe MagicTouch',
    path: 'interactive_segmenter/magic_touch/float32/1/',
  },
  {
    file: 'face_landmarker.task',
    name: 'MediaPipe Face Landmarker',
    path: 'face_landmarker/face_landmarker/float16/1/',
  },
];

const warnings = [];
const texts = new Map();

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Stores a licence text once and returns its path relative to public/licenses. */
function storeText(text) {
  const body = normaliseText(text);
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
  texts.set(hash, body);
  return `texts/${hash}.txt`;
}

function licenceFile(pkgDir) {
  const name = readdirSync(pkgDir).find((entry) =>
    /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(entry),
  );
  return name === undefined ? null : join(pkgDir, name);
}

/** The Apache 2.0 terms (without the appendix), taken from rxjs's LICENSE.txt. */
function apacheText() {
  const source = readFileSync(join(ROOT, 'node_modules', 'rxjs', 'LICENSE.txt'), 'utf8');
  const end = source.indexOf('END OF TERMS AND CONDITIONS');
  if (end < 0) {
    throw new Error('rxjs LICENSE.txt no longer contains the Apache 2.0 terms');
  }
  return source.slice(0, end + 'END OF TERMS AND CONDITIONS'.length);
}

function packageEntry(name) {
  const pkgDir = join(ROOT, 'node_modules', ...name.split('/'));
  const pkg = readJson(join(pkgDir, 'package.json'));
  const declared = typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN';
  const sibling = LICENCE_FILE_FROM[name];
  const file =
    licenceFile(pkgDir) ??
    (sibling === undefined ? null : licenceFile(join(ROOT, 'node_modules', ...sibling.split('/'))));
  let text;
  if (file !== null) {
    text = readFileSync(file, 'utf8');
  } else if (declared === 'MIT') {
    const holder =
      typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? `${name} authors`);
    text = MIT_TEMPLATE.replace('<holder>', holder.replace(/\s*<[^>]*>/, ''));
    warnings.push(`${name}: no licence file; generated the MIT text for "${holder}"`);
  } else if (declared === 'Apache-2.0') {
    text = apacheText();
  } else {
    throw new Error(`${name}: no licence file and no template for "${declared}"`);
  }
  const detected = detectLicence(text);
  if (detected !== null && detected !== declared) {
    warnings.push(`${name}: package.json says ${declared}, the licence file is ${detected}`);
  }
  return {
    id: `pkg-${name.replace(/^@/, '').replace(/\//g, '-')}`,
    name,
    version: pkg.version,
    group: 'library',
    licence: detected ?? declared,
    ...(NOTES[name] === undefined ? {} : { notice: NOTES[name] }),
    ...(repositoryUrl(pkg) === null ? {} : { url: repositoryUrl(pkg) }),
    text: storeText(text),
  };
}

function fontEntry(font) {
  const text = readFileSync(join(ROOT, font.file), 'utf8');
  const url = /\((https?:\/\/[^)\s]+)\)/.exec(text)?.[1];
  return {
    id: font.id,
    name: font.name,
    group: 'font',
    licence: detectLicence(text) ?? 'UNKNOWN',
    ...(url === undefined ? {} : { url }),
    text: storeText(text),
  };
}

function modelEntries(apache) {
  const apacheFile = storeText(apache);
  return MODELS.filter((model) => {
    const present = existsSync(join(ROOT, 'public', 'models', model.file));
    if (!present) {
      warnings.push(`model ${model.file} is not bundled; skipped`);
    }
    return present;
  }).map((model) => ({
    id: `model-${model.file.replace(/\.[a-z]+$/, '').replace(/_/g, '-')}`,
    name: `${model.name} (${model.file})`,
    group: 'model',
    licence: 'Apache-2.0',
    notice: model.notice ?? 'Copyright Google LLC.',
    url: `${MODEL_BASE}${model.path}${model.file}`,
    text: apacheFile,
  }));
}

/** Warns about packages Angular bundled that this list does not cover. */
function crossCheck(names) {
  if (!existsSync(ANGULAR_LICENSES)) {
    warnings.push(
      'dist/glow/3rdpartylicenses.txt not found; run `npm run build:prod` to cross-check',
    );
    return;
  }
  const bundled = readFileSync(ANGULAR_LICENSES, 'utf8').matchAll(/^Package: (.+)$/gm);
  for (const [, name] of bundled) {
    if (!names.has(name.trim())) {
      warnings.push(`${name.trim()} is in the production bundle but not in the licences list`);
    }
  }
}

const apache = apacheText();
const rootPkg = readJson(join(ROOT, 'package.json'));
const names = new Set([
  ...Object.keys(rootPkg.dependencies).filter((name) => !BUILD_ONLY.has(name)),
  ...TRANSITIVE,
]);
crossCheck(names);
const libraries = [...names].sort((a, b) => a.localeCompare(b)).map(packageEntry);
const components = [...FONTS.map(fontEntry), ...modelEntries(apache), ...libraries];

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(TEXT_DIR, { recursive: true });
for (const [hash, body] of texts) {
  writeFileSync(join(TEXT_DIR, `${hash}.txt`), body);
}
writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ components }, null, 2)}\n`);

const licences = [...new Set(components.map((entry) => entry.licence))].sort();
console.log(
  `Wrote ${components.length} components (${licences.join(', ')}), ${texts.size} licence texts.`,
);
for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}
