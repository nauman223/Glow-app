# Glow: project rules for Claude

These rules apply to every session in this repo. Act as a senior Angular + Ionic engineer:
production-grade, fully typed, review-ready code. No placeholder, "TODO", or demo-quality code
unless the user asks for it. The full spec is `doc/Glow_Ionic_Prompt.md`; this file records it
plus the decisions made since. If a rule here conflicts with a new instruction from the user,
follow the user and offer to update this file.

## Project facts (decided)

- App: **Glow**, Android-first photo editor. App ID `com.nadev.glow` (permanent; used in
  `capacitor.config.ts`, Android `applicationId` and the iOS bundle id).
- Platforms: Android first (Capacitor); iOS kept buildable, no polish. No PWA, no SSR.
- Min OS: Android API 26, iOS 15. Deep links: none. No accounts, no auth.
- Backend: cloud AI proxy `POST /ai/{feature}` → `{ jobId }`, `GET /ai/jobs/{jobId}` →
  `{ status, resultUrl?, error? }`; static catalog `GET /catalog/themes.json`,
  `GET /catalog/flags.json`. Base URLs: dev `https://glow-api-dev.xenex-media.com.au`, prod
  `https://glow-api.xenex-media.com.au`. Ask before changing any DTO.
- Anonymous installation id (`crypto.randomUUID`, Preferences) sent as `X-Installation-Id` to
  the proxy host only.
- Design: `C:\Users\USER\Downloads\Tookit\Glow-Design` (boards in `html/` and `images/`,
  tokens in `code/_tokens.scss`, icons in `svg/`). Screen numbers from the design are used in
  route and folder names. Match the design exactly on a 412×915 viewport.
- Brand: bg #121212, surface #1E1E1E, surface-2 #2A2A2A, primary #7C4DFF, primary-soft
  #3B2391, accent #00E5FF, text #FFF, muted #B3B3B3, divider #2C2C2C, pro #FFD166, success
  #2EE59D. Danger is split: `--app-danger` #FF8A80 for text/UI, `--app-danger-strong` #FF3B6B
  for AI "remove" highlights only. Roboto 400/500/700/900 self-hosted. Dark is the default
  theme; Settings offers Dark / Light / System.
- Touch targets: **48 dp minimum** (`touch-target` mixin, `--app-touch-min`).
- Build phases (in order): 1 core loop, 2 classic tools, 3 layers & collage, 4 on-device AI,
  5 monetisation, 6 cloud AI, 7 polish/release. Build one feature at a time.
- Versions: Angular 22.2, Ionic 9.0, Capacitor 8.6, TypeScript 6.0 (Angular 22.2 and
  typescript-eslint require < 6.1; do not move to TS 7), Bootstrap 5.3.9, Fabric 7.4,
  MediaPipe tasks-vision 1.2, Node 22 LTS (`.nvmrc`), npm 10.

## Dependency policy (strict)

- Never add a package without asking first: name, why, bundle size, cost of the native
  alternative. Wait for approval.
- Approved runtime deps: Angular (core, common, router, forms, platform-browser),
  `@angular/cdk` (only for a specific need: layers drag-drop, a11y, virtual scroll),
  `@ionic/angular` (shell only), `@capacitor/core|android|ios`, `@capacitor/app|camera|
filesystem|share|preferences|status-bar|splash-screen|haptics|network|keyboard`,
  `@capacitor-community/admob` (**pinned 8.2.1**: 8.3.x adds a 14.8 MB native-UI engine dep),
  `@capacitor-community/media`, `@capgo/native-purchases` (Glow Pro IAP; the spec's
  `@capacitor-community/in-app-purchases` does not exist), `fabric`, `@mediapipe/tasks-vision`,
  `bootstrap` (SCSS only), `rxjs`.
- In-repo Capacitor plugin `GlowMedia` (Android, `android/app/src/main/java/com/nadev/glow/media/`,
  approved 2026-11-16): saves exports to the public `Pictures/Glow` (the community media
  plugin saves to app-specific storage that Android deletes on uninstall), lists albums and
  photos and makes thumbnails for the screen 04 picker (the community plugin's `getMedias` is
  iOS only). `@capacitor-community/media` stays for the iOS path.
- In-repo Capacitor plugin `GlowStickers` (Android, `android/app/src/main/java/com/nadev/glow/stickers/`,
  approved and built 2026-11-17): WhatsApp sticker packs via an exported read-only
  `StickerContentProvider` (authority `com.nadev.glow.stickercontentprovider`, gated by
  `com.whatsapp.sticker.READ` plus a caller-UID check) and the ENABLE_STICKER_PACK intent. TS side:
  `core/whatsapp` (`WhatsAppStickersService`; packs need 3–30 512×512 WebP stickers ≤ 100 KB).
- Approved dev deps: Angular CLI/build, TypeScript, `@capacitor/cli`, ESLint + angular-eslint +
  typescript-eslint + eslint-config-prettier, Prettier, Stylelint +
  stylelint-config-standard-scss, Husky, lint-staged, commitlint. `@capacitor/assets` runs on
  demand via `npm run assets` (not installed: its dependency tree has critical CVEs).
- Forbidden: jQuery, Bootstrap JS, ng-bootstrap, ngx-bootstrap, Popper, lodash,
  moment/date-fns, Angular Material, icon packs, UI kits, NgRx/Akita/any state library,
  animation libraries, HTTP wrappers, utility libraries, bundle analyzers, Firebase SDK,
  Konva, Cropper.js, Pica, any image library beyond Fabric and MediaPipe, and
  `@angular/animations` (deprecated in v22; use `animate.enter` / `animate.leave` + CSS).
- Use native APIs: Intl, `structuredClone`, signals, CSS transitions, inline SVG,
  Canvas/OffscreenCanvas + WebGL for pixel work.

## Testing

- Do NOT write tests or create `*.spec.ts` files. No test runner. Schematics have `skipTests: true`.
- Quality comes from strict TypeScript, strict templates, ESLint (type-checked), Stylelint and CI.

## UI rules

- Allowed Ionic components only: `ion-app`, `ion-router-outlet`, `ion-content`, `ion-header`,
  `ion-toolbar`, `ion-refresher`, `ion-infinite-scroll`. Import each from its own entry point
  (e.g. `@ionic/angular/ion-content`), never the barrel.
- Every other UI element (buttons, bottom sheets, drawers, sliders, colour picker, dialogs,
  toasts, skeletons) is an Angular standalone component with Bootstrap classes + custom SCSS.
  Reuse `src/app/shared/ui/*` before creating anything new.
- Ionic CSS: only `core.css` and `structure.css` (configured in `angular.json`).
- Bootstrap: SCSS source only, only the partials in use (`src/styles/main.scss`). Customize via
  variables in `abstracts/_variables.scss`. To use a new utility class, add its key to the
  `$utilities` list in `abstracts/_bootstrap-config.scss`. To use a new Bootstrap component,
  add its partial import to `main.scss`.
- Styles: tokens as CSS custom properties (`--app-*` in `themes/`, plus `--ad-height`). Dark
  mode via `data-bs-theme` (ThemeService). Component styles stay scoped; components
  `@use 'abstracts/mixins'`.
- Mobile-first: safe-area insets, 48 dp touch targets, no hover-only interactions, logical CSS
  properties only (no left/right).
- Ad banner slot reserves 61 dp when shown and collapses to 0 (`--ad-height`); it never
  overlaps the canvas or primary actions, and the layout never jumps.
- Icons: the design's 24×24 stroke set in `shared/ui/icon/icons.ts`, rendered with `<app-icon>`.
- No inline styles in templates. No `!important` (Stylelint enforces it).
- Accessibility: WCAG AA contrast, aria labels on every icon button, focus trapping in
  dialogs/drawers, keyboard support, `prefers-reduced-motion`. Skeleton loaders, not spinners.

## Architecture

- `core/` singletons (http, logging, theme, platform, routing, storage, notifications,
  installation, and later canvas, image, history, export, project, ads, pro, credits,
  ai-local, ai-cloud, catalog); `shared/ui/` presentational components;
  `features/<name>/` pages, components, services, models, `<name>.strings.ts`; `layout/`.
- Path aliases: `@core/*`, `@shared/*`, `@features/*`, `@layout/*`, `@env/*`, `@styles/*`.
- Standalone components only. `ChangeDetectionStrategy.OnPush` everywhere. Zoneless.
- DI with `inject()`, never constructor injection.
- Smart (page/container) vs dumb (presentational: inputs/outputs only) components.
- State: one signal-based store per feature (private writable signals, public readonly
  signals/computed, mutation methods). `resource()` / `httpResource()` are stable (v22).
  RxJS only for real streams. Clean up with `takeUntilDestroyed`.
- Canvas: `CanvasService` alone owns the Fabric canvas; each tool is a service returning a
  reversible command; `HistoryService` keeps ≤ 30 `toJSON()` snapshots; images are downscaled
  to ≤ 2000 px on the long side, and exported with `multiplier` for full resolution. Fabric
  and MediaPipe load only in lazy chunks; MediaPipe runs in a Web Worker (WASM is served from
  `/mediapipe/wasm`, copied by `angular.json`).
- Forms: signal forms (`@angular/forms/signals`), `<app-text-field>`, `<app-field-errors>`.
- Feature folders carry the design's screen numbers (`features/05-editor`,
  `features/05-editor/tools/09-draw`, `features/19-settings`); URLs stay readable (`/editor`)
  and live in `APP_ROUTES`. The editor toolbar and Home sections are data-driven registries:
  show only built features, never dead buttons.
- Photo hand-off to the editor goes through `EditorLaunchService` (`core/editor-launch`).
- Export: "Original" = canvas content scaled to the source size (photos are 2000 px copies;
  re-decoding originals at export is deferred). Size presets: Original, 2K 2048, 1080p 1920,
  Small 1280 px long side.
- Routing: lazy `loadComponent` for every route, a `title` on every route, functional guards,
  `data: { preload: true }` only on likely-next routes. Android back: close panel/drawer/
  dialog first, then navigate; exit only from home. Editor drafts autosave to Recent projects
  (`core/project`), so leaving the editor saves first and shows "Discard changes?" only if that
  save failed (decided 2026-11-17).
- User-facing strings live in a `<feature>.strings.ts` constants file (ready for i18n).

## API layer

- Components never touch `HttpClient`. Feature services call `ApiClient` (`core/http`).
- Separate DTO interfaces from domain models, with explicit mapper functions.
- Every failure is an `ApiError`. Interceptor order: error → retry → installation-id →
  timeout. Retries: GET/HEAD only, never 4xx, 3 attempts max, exponential backoff.
  Timeouts: 15 s default, AI uploads 60 s, job polling every 2 s with a 120 s ceiling and cancel.
- AI failures never consume a credit. Log `feature`, `durationMs`, `bytesUp`, `outcome`.

## Monetisation

- Ads: UMP consent before the first ad; banner on Home, Editor, Export, Themes, Settings
  (hidden while a tool panel is open); interstitial every 3rd save, ≥ 2 min apart; rewarded for
  Pro packs (24 h), HD cutout, 4× upscale, AI credits; native ad on export success. No ads for
  Pro. Dev builds use Google test IDs; prod IDs come from CI secrets only.
- Pro: one-time `glow_pro_lifetime`; entitlement verified through the store, never trusted
  from local storage alone. Removes ads, watermark and PRO badges.

## Security

- No secrets in the codebase or environment files; AI provider keys live only in the proxy.
- `@capacitor/preferences` holds non-sensitive settings only (theme, onboarding flag,
  installation id, obfuscated credits, pack unlock expiries).
- Keep the CSP in `src/index.html` strict. HTTPS only; cleartext disabled on Android.
- Never upload an image unless the user tapped the feature's action button.

## Code quality

- No `any`. Interfaces/types for every model, request and response. `readonly` wherever possible.
- Explicit member accessibility (`public`/`protected`/`private`).
- Components under 200 lines; small focused functions; meaningful names (no `d`, `tmp`, `res2`).
- No logic in templates beyond simple bindings. Control flow syntax only (`@if`, `@for` with
  `track` by a unique id, `@switch`, `@defer`).
- No `console.*` outside `core/logging/logger.service.ts`; use `LoggerService`.
- JSDoc only where intent isn't obvious. Match the style and comment density of existing code.

## Performance

- Lazy routes, `@defer` for heavy UI, virtual scroll for the photo picker, cache and
  de-duplicate requests, debounce sliders (~50 ms) and apply heavy filters on release, canvas
  pointer handling outside change detection and throttled to animation frames,
  `fabric.textureSize = 4096`, revoke object URLs and dispose Fabric images on leave.
- Budgets (`angular.json`): initial warning 500 kB / error 900 kB; component styles 4 kB / 8 kB.
  Never let a change cause a budget error.

## Workflow and Definition of Done

Before saying a change is done, run and report:

```bash
npm run lint          # zero warnings
npm run lint:styles   # zero warnings
npm run format:check
npm run type-check
npm run build:prod    # no budget errors
```

When native code or plugins change, also run `npm run cap:sync`.

- Give full file paths. Briefly explain key decisions (why this pattern, what it prevents).
- If a requirement is unclear, ask before assuming.
- After each step, list what the user needs to run or verify, including TalkBack checks.
- Commits: Conventional Commits, enforced by commitlint. Commit only when the user asks.
- After bumping the version in `package.json`, run `npm run version:sync`.

## Open decisions (ask the user when relevant)

- Privacy policy and terms URLs (env `legal.*`, injected by CI for release).
- Real AdMob app id and unit ids (CI secrets), Pro price (design shows $2.99 placeholder),
  native ad copy, passport sizes checked against official rules.
- Brand source image `resources/icon.png` (the user will provide it).
- Cloud AI feature slugs for `POST /ai/{feature}` (confirm when building phase 6).
- Approve `eslint-plugin-simple-import-sort` (dev only) for full import ordering?
