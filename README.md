# Glow

> Coding rules, dependency policy and the Definition of Done are in [CLAUDE.md](CLAUDE.md).
> The full product and engineering spec is [doc/Glow_Ionic_Prompt.md](doc/Glow_Ionic_Prompt.md).
> Before a store release, work through [doc/release-checklist.md](doc/release-checklist.md).

Android-first photo editor: merge and layer photos, collage, draw, crop/adjust/filter, text and
stickers, on-device AI (background removal, portrait blur, sky, beauty, passport photos, ...)
and cloud AI (enhance, restore, cartoon, expand, ...). Monetised with AdMob, a one-time
"Glow Pro" purchase and rewarded-ad credits/unlocks.

Angular 22 (standalone, zoneless, signals) + Ionic 9 (app shell only) + Capacitor 8.
UI is Bootstrap 5.3 (SCSS source, no Bootstrap JS) and custom SCSS. The editor uses Fabric.js;
on-device AI uses MediaPipe Tasks Vision in a Web Worker.

| Tool                   | Version                                             |
| ---------------------- | --------------------------------------------------- |
| Node                   | 22 LTS (`.nvmrc`)                                   |
| npm                    | 10                                                  |
| Angular                | 22.2                                                |
| TypeScript             | 6.0 (Angular 22.2 and typescript-eslint need < 6.1) |
| Ionic                  | 9.0                                                 |
| Capacitor              | 8.6                                                 |
| Bootstrap              | 5.3.9                                               |
| Fabric.js              | 7.4                                                 |
| MediaPipe tasks-vision | 1.2                                                 |
| AdMob plugin           | `@capacitor-community/admob` 8.2.1 (pinned)         |
| In-app purchase plugin | `@capgo/native-purchases` 8.9                       |
| Android                | min API 26, target/compile API 36, JDK 21           |
| iOS                    | 15+ (kept buildable, not polished)                  |

## Features

Screen numbers come from the design pack and are used in folder names
(`src/app/features/<nn>-<name>`).

| Area                         | What it does                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Splash, 02 Onboarding     | First-run intro (shown once).                                                                                                                                                                                                                         |
| 03 Home                      | Choose / take a photo, AI tools sheet, Recent projects (autosaved editor drafts), collage templates.                                                                                                                                                  |
| 04 Picker                    | Custom photo grid with albums and multi-select (in-repo `GlowMedia` plugin on Android), partial "Select photos" access on Android 14+.                                                                                                                |
| 05 Editor                    | Fabric canvas with undo/redo (30 snapshots), autosave to Recent projects. Tools: 06 Crop, 07 Adjust, 08 Filters, 09 Draw, 10 Layers, 11 Collage, 12 Text, 13 Stickers, AI tools.                                                                      |
| On-device AI (offline)       | 13b Remove background (HD cutout via rewarded ad), 22 Colour boost, 23 Natural beauty, 27 Replace sky, 28 Portrait blur, 33 Passport photo (Pakistan, UK, US, Schengen, custom), 35 Relight, 36 Sticker maker (+ WhatsApp export), 37 One-tap themes. |
| Cloud AI (uploads on tap)    | 24 Enhance (2x/4x), 25 Hairstyle, 26 Remove people, 29 Restore, 30 Cartoon, 31 Expand, 32 Remove text, 34 Headshot.                                                                                                                                   |
| 14 Export, 15 Export success | JPEG or PNG, size presets (Original, 2K, 1080p, Small), save to `Pictures/Glow`, share; watermark for free users; native ad on success.                                                                                                               |
| 18 Go Pro                    | One-time `glow_pro_lifetime` purchase and restore.                                                                                                                                                                                                    |
| 19 Settings                  | Theme (Dark / Light / System), Pro status, ad privacy (UMP) when required, version, open-source licences, privacy policy and terms links.                                                                                                             |

Every entry point is data-driven (`features/03-home/home.config.ts`,
`features/ai/_shell/ai-features.ts`) and AI screens can be switched off remotely with the feature
flags (see [Catalog](#catalog-themes-and-feature-flags)).

## Setup

```bash
nvm use            # or install Node 22.22.3+
npm ci             # also installs the Husky git hooks
npm start          # http://localhost:4200 (development environment, Google test ads)
```

Android development needs Android Studio (JDK 21 and Android SDK 36).

## Scripts

| Script                   | What it does                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm start`              | Dev server (development environment)                                                                     |
| `npm run build:dev`      | Development build                                                                                        |
| `npm run build:prod`     | Production build to `dist/glow/browser`; fails on budget errors                                          |
| `npm run lint`           | ESLint for TS and templates, zero warnings allowed                                                       |
| `npm run lint:fix`       | ESLint with auto-fix                                                                                     |
| `npm run lint:styles`    | Stylelint for SCSS                                                                                       |
| `npm run format`         | Prettier write                                                                                           |
| `npm run format:check`   | Prettier check (CI)                                                                                      |
| `npm run type-check`     | `tsc --noEmit` for the app and the vision worker (`tsconfig.worker.json`)                                |
| `npm run analyze`        | Production build with stats; load `dist/glow/browser-stats.json` in https://esbuild.github.io/analyze/   |
| `npm run version:sync`   | Copy `package.json` version to the app, Android and iOS                                                  |
| `npm run licences`       | Regenerate `public/licenses/` (Settings → Open-source licences) after a dependency, font or model change |
| `npm run cap:sync`       | Production build + `cap sync`                                                                            |
| `npm run cap:android`    | Sync and open Android Studio                                                                             |
| `npm run cap:ios`        | Sync and open Xcode (macOS only)                                                                         |
| `npm run assets`         | Generate native icons/splash from `resources/` (run on demand)                                           |
| `ionic:serve` / `:build` | Used by the Ionic CLI for live reload (see below)                                                        |

Helper scripts (run by hand, not part of the build):

| Script                                       | What it does                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `scripts/inject-env.mjs [--require]`         | CI: writes AdMob unit IDs, legal URLs and an optional API base URL into `environment.ts`           |
| `scripts/sync-version.mjs`                   | Behind `npm run version:sync`                                                                      |
| `scripts/skygen/`                            | Regenerates the procedural sky images in `public/skies/` ([README](scripts/skygen/README.md))      |
| `scripts/stickers/generate-pro-stickers.mjs` | Regenerates the Pro sticker pack ([README](scripts/stickers/README.md))                            |
| `scripts/stickers/check-stickers.py`         | Safety check for bundled sticker SVGs (no scripts, external refs, ...); run after editing stickers |

## Git hooks and commits

- **pre-commit**: lint-staged runs ESLint, Stylelint and Prettier on staged files.
- **pre-push**: `type-check` and `lint`.
- **commit-msg**: Conventional Commits enforced by commitlint (`feat:`, `fix:`, `chore:`, ...).
- Branching: trunk-based. Short-lived branches off `main`, merged by PR after CI passes.

## Project structure

```
src/app/
  core/       singletons: http (ApiClient, interceptors, ApiError), installation id, logging,
              theme, platform, routing, storage, canvas, image, history, export, project,
              media, ads, pro, credits, entitlements, ai-local (MediaPipe worker), ai-cloud,
              catalog, whatsapp, editor-launch
  shared/ui/  presentational components (button, icon, toast, dialog, sheet, slider, ...)
  features/   one folder per screen, named with the design's screen numbers; AI screens in
              features/ai/ (_shell = on-device, _cloud = cloud)
  layout/     shell pieces (offline banner)
src/styles/   abstracts, base, components, themes, main.scss (single entry point)
public/       fonts (Roboto), models (MediaPipe), catalog (bundled JSON), skies, stickers
android/app/src/main/java/com/nadev/glow/
  media/      GlowMedia plugin        stickers/   GlowStickers plugin + StickerContentProvider
```

Path aliases: `@core/*`, `@shared/*`, `@features/*`, `@layout/*`, `@env/*`, `@styles/*`.

## In-repo native plugins (Android)

Registered in `MainActivity` (local plugins are not auto-discovered by `cap sync`).

- **GlowMedia** (`media/`, TS side `core/media`): lists albums and photos with thumbnails for the
  picker (the community media plugin's `getMedias` is iOS only) and saves exports to the public
  `Pictures/Glow` album through MediaStore (Android 10+; Android 8-9 write the file directly and
  ask for `WRITE_EXTERNAL_STORAGE` at save time). Saved photos survive an uninstall. iOS uses
  `@capacitor-community/media`.
- **GlowStickers** (`stickers/`, TS side `core/whatsapp`): WhatsApp sticker packs. Packs are
  stored in app-internal storage (`files/sticker-packs/`) and served to WhatsApp by an exported,
  read-only `StickerContentProvider` (authority `com.nadev.glow.stickercontentprovider`), gated
  by `com.whatsapp.sticker.READ` plus a caller-UID check. A pack needs 3–30 stickers, each a
  512×512 WebP of at most 100 KB. "Add to WhatsApp" uses the `ENABLE_STICKER_PACK` intent.

## On-device AI models

Bundled in the app (works offline) and loaded lazily by the vision worker
(`src/app/core/ai-local/worker/`). Details, checksums and sources:
[public/models/MODELS.md](public/models/MODELS.md).

| File                               | Size    | Used for                           |
| ---------------------------------- | ------- | ---------------------------------- |
| `selfie_segmenter.tflite`          | 0.25 MB | person cutout (default)            |
| `selfie_multiclass_256x256.tflite` | 16.4 MB | hair / skin / clothes parts        |
| `deeplab_v3.tflite`                | 2.8 MB  | auto subject                       |
| `magic_touch.tflite`               | 6.2 MB  | tap-to-select objects, sky         |
| `face_landmarker.task`             | 3.8 MB  | face landmarks (beauty, passport)  |
| MediaPipe WASM runtime             | 14.7 MB | `/mediapipe/wasm` (`angular.json`) |

All models are Google MediaPipe models under the **Apache License 2.0**. Their notices, the font
licences and the npm runtime dependencies are listed in Settings → Open-source licences
(`npm run licences` regenerates `public/licenses/`). Photos processed by these tools never leave the
device.

## Cloud AI

Cloud screens upload one photo (JPEG, at most 1.5 MP, re-encoded, so no EXIF/GPS metadata) and
optionally a mask, **only after the user taps the action button**, to the Glow AI proxy:
`POST /ai/{feature}` → `{ jobId }`, then `GET /ai/jobs/{jobId}` every 2 s (120 s ceiling).
The first upload shows a one-time notice. Each request carries the anonymous
`X-Installation-Id` (only to the proxy host). The contract, including the privacy obligations
(delete within 1 hour, no training) and rate limits, is
[doc/ai-proxy-contract.md](doc/ai-proxy-contract.md). AI provider keys live only in the proxy.

- Hosts: dev `https://glow-api-dev.xenex-media.com.au`, prod `https://glow-api.xenex-media.com.au`.
  Both are in the CSP `connect-src` (`src/index.html`); `scripts/inject-env.mjs` refuses an
  API override to any other host.
- Credits: free users earn 1 credit per rewarded ad (at most `dailyEarnCap` a day) and spend 1
  per job; failed or cancelled jobs never cost a credit. Pro is unlimited up to
  `proFairUseDailyCap` jobs a day. The proxy must enforce limits server-side.
- Kill switch: set `aiFeatures.<slug>: false` in `flags.json` to hide a screen.

## Catalog (themes and feature flags)

`GET /catalog/themes.json` (One-tap themes) and `GET /catalog/flags.json` (AI feature switches,
ad pacing, credit caps) are read stale-while-revalidate: last good copy (app storage), else the
bundled fallback in `public/catalog/`, then refreshed from the network. A bad payload never
replaces a good one, so the app works offline and before the backend exists. Keep the bundled
files in step with what the server serves at release time. Formats:
`src/app/core/catalog/catalog.dtos.ts`.

## Environments and secrets

`src/environments/environment*.ts` hold public config only (they ship in the bundle).
Never put secrets in them; AI provider keys live only in the backend proxy.

- **Development** (`environment.development.ts`): dev API, Google's public test ad units.
- **Production** (`environment.ts`): prod API; ad unit IDs and legal URLs are empty in git
  and injected at build time by `scripts/inject-env.mjs` from CI secrets.

`node scripts/inject-env.mjs --require` fails the build if any release value is missing.

## Monetisation

### AdMob

1. In AdMob, create the Android app and four ad units: adaptive **banner**, **interstitial**,
   **rewarded**, **native advanced** (the export-success card; Glow uses the plugin's small
   template: headline, body, call to action).
2. Privacy & messaging: create and publish a **GDPR consent message** (and the US state
   regulations message). The app asks for consent (UMP) before the first ad request and shows
   "Ad personalisation" in Settings when the UMP SDK says privacy options are required. Requests are
   sent with `tagForChildDirectedTreatment: false` and `tagForUnderAgeOfConsent: false` (the app
   is not for children).
3. Add these GitHub Actions secrets (environment `production`):

   | Secret                       | Value                               |
   | ---------------------------- | ----------------------------------- |
   | `GLOW_ADMOB_APP_ID`          | `ca-app-pub-…~…` (Android manifest) |
   | `GLOW_ADMOB_BANNER_ID`       | banner unit id                      |
   | `GLOW_ADMOB_INTERSTITIAL_ID` | interstitial unit id                |
   | `GLOW_ADMOB_REWARDED_ID`     | rewarded unit id                    |
   | `GLOW_ADMOB_NATIVE_ID`       | native advanced unit id             |

4. Locally, debug builds use Google's test app id automatically. A release build without a
   real `GLOW_ADMOB_APP_ID` fails (`verifyReleaseConfig` in `android/app/build.gradle`), so the
   test id can never ship.
5. Publish `app-ads.txt` on the developer website listed in Play Console.

Placement rules: banner on Home, Editor, Export, Themes and Settings (hidden while a tool panel
is open); interstitial every 3rd save, at least 2 minutes apart; rewarded ads for 24 h Pro pack
unlocks, HD cutout, 4× upscale and AI credits; native ad on export success. No ads for Pro.
Pacing values come from `flags.json`.

### Glow Pro (in-app purchase)

1. In Play Console → Monetise → Products → In-app products, create a **one-time** product
   with id `glow_pro_lifetime` and activate it. (The design's $2.99 is a placeholder.)
2. Add licence testers (Play Console → Settings → License testing) to buy without charge.
3. Billing only works in a build installed from a Play testing track (internal testing is
   enough), signed by Play, with the tester's account on the device.
4. Entitlement is always re-checked with the store (on start and on resume), and a completed
   purchase is acknowledged (Play refunds unacknowledged purchases after 3 days). Local state is
   a cache only. Pro removes ads, the watermark and PRO badges.

## Native builds

### Live reload on a device (Ionic CLI)

```bash
ionic cap run android -l --external
```

- Needs the global Ionic CLI (`npm i -g @ionic/cli`) and the phone on the same network.
- The `ionic:serve` / `ionic:build` scripts go through `scripts/ng-passthrough.mjs`, because
  the Ionic CLI always passes `--project=app` while this Angular project is named `glow`.
- If the phone can't connect, allow Node.js through Windows Firewall on private networks.

### Android

```bash
npm run cap:android
```

- Package `com.nadev.glow`, min API 26, target/compile 36, edge-to-edge (Capacitor 8
  `SystemBars` passes the insets to `env(safe-area-inset-*)`).
- HTTPS only: cleartext disabled (`network_security_config.xml`), system CAs only.
- WebView debugging is on for debug builds and off for release (Capacitor follows the
  `debuggable` flag; nothing in `capacitor.config.ts` overrides it).
- Backup: only Recent projects (`files/projects/`) go to Android Auto Backup / device transfer;
  preferences (installation id, signed credits and unlocks) are excluded on purpose
  (`res/xml/data_extraction_rules.xml`, `res/xml/backup_rules.xml`).
- Release builds use R8 (`minifyEnabled`, `shrinkResources`). Plugin classes are kept by
  Capacitor's consumer rules; see `android/app/proguard-rules.pro`. After adding a plugin or an
  in-repo plugin method, build a release and check `app/build/outputs/mapping/release/seeds.txt`.
- Local release test (unsigned output, never commit the dummy id):

  ```powershell
  $env:GLOW_ADMOB_APP_ID = 'ca-app-pub-0000000000000000~0000000000'
  npm run build:prod; npx cap sync android
  cd android; .\gradlew.bat --no-daemon bundleRelease assembleRelease
  ```

- Size (Nov 2026 release build): AAB 40.7 MB (includes 4 MB of R8 mapping that Play strips),
  universal APK 39.3 MB. Models are 28 MB of that and the WASM runtime 4.2 MB compressed.
  Native code is tiny (CameraX JNI helpers, 16 KB page aligned), so per-ABI splits gain nothing.

### Release (signed AAB)

The `Release (Android AAB)` workflow runs on a `vX.Y.Z` tag or manually:

1. Bump `version` in `package.json`, run `npm run version:sync`, commit, tag `vX.Y.Z`, push.
2. The workflow audits runtime deps, injects secrets (`inject-env.mjs --require`), builds,
   runs `npx cap sync android`, decodes the keystore, runs `bundleRelease` (R8) with JDK 21 and
   uploads the `.aab` and `mapping.txt` as artifacts.
3. Upload the AAB to the Play Console internal testing track, test, then promote.

Signing secrets: `GLOW_KEYSTORE_BASE64` (base64 of the `.jks`), `GLOW_KEYSTORE_PASSWORD`,
`GLOW_KEY_ALIAS`, `GLOW_KEY_PASSWORD`, plus `GLOW_PRIVACY_POLICY_URL` and `GLOW_TERMS_URL`.
Never commit `*.jks` / `*.keystore` (git-ignored). Enrol in Play App Signing (the workflow's key
is then the upload key).

### iOS (macOS + Xcode required)

```bash
npm run cap:ios
```

Kept buildable only. Minimum iOS 15; bundle id `com.nadev.glow`. Replace the test
`GADApplicationIdentifier` in `Info.plist` before any iOS release.

## CI

- `.github/workflows/ci.yml` (every PR and push to `main`): `npm audit --omit=dev`, lint, style
  lint, format check, type check (app + worker), production build, then an Android debug
  `assembleDebug` job (Gradle cached) that catches native breakage.
- `.github/workflows/release-android.yml`: see [Release](#release-signed-aab).
- Actions are pinned to full commit SHAs (tag in a trailing comment).

## Versioning

`package.json` `version` is the single source. After bumping it run `npm run version:sync`.
Build number = `major*10000 + minor*100 + patch` (Android `versionCode`, iOS
`CURRENT_PROJECT_VERSION`).

## App icons and splash

The source image is `resources/icon.png` (overlapping violet→cyan frames, to be provided).
Vector versions are in the design pack (`svg/brand/`). Then run `npm run assets`.

## Play Console: Data safety

Facts behind these answers: [doc/privacy-policy-inputs.md](doc/privacy-policy-inputs.md).

| Data type                             | Collected | Shared | Purpose                                          | Notes                                                                                                          |
| ------------------------------------- | --------- | ------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Photos (user-selected images)         | Yes       | No\*   | App functionality (cloud AI tools)               | Only when the user taps a cloud AI action; sent over HTTPS; deleted after processing (≤ 1 h, per the contract) |
| Device or other IDs (advertising ID)  | Yes       | Yes    | Advertising (AdMob)                              | Collected by the Google Mobile Ads SDK; not for Pro users                                                      |
| Device or other IDs (installation ID) | Yes       | No     | App functionality, fraud prevention              | Random anonymous UUID sent to the AI proxy for rate limiting                                                   |
| Purchase history                      | Yes       | No     | App functionality                                | Glow Pro entitlement via Google Play Billing                                                                   |
| App interactions                      | Yes       | Yes    | Advertising, analytics, fraud prevention (AdMob) | As declared by the Google Mobile Ads SDK                                                                       |
| Diagnostics (crash logs, performance) | Yes       | Yes    | Analytics, fraud prevention (AdMob)              | As declared by the Google Mobile Ads SDK; Glow itself has no crash reporting or analytics                      |

\* Photos go to the developer's own proxy, which passes them to an AI provider acting on the
developer's behalf (a service provider, which Play does not count as "sharing"). Confirm the
provider's terms (no retention, no training) and name it in the privacy policy.

- Data is encrypted in transit: **yes**.
- Users can request deletion: no account exists; AI uploads are deleted automatically.
- On-device AI, the classic tools, projects and exports never leave the device. Android Auto
  Backup of projects goes to the user's own Google account and is not "collection" by Glow.
- WhatsApp sticker export happens on the device, only when the user taps "Add to WhatsApp".
- The privacy policy must cover AdMob / the advertising ID, UMP consent, cloud uploads and the
  AI provider, and Play Billing.

## Testing

This project intentionally has no test runner or test files. Quality is enforced through
strict TypeScript, strict templates, ESLint (type-checked rules), Stylelint and CI.
