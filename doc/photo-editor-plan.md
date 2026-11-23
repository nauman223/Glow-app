# Layera — Photo Editor App Build Plan (v2, aligned to the Android screen designs)

> App name (from design): **Layera** · Tagline: *Edit · Merge · Create*
> Stack: Ionic 8 · Angular (standalone) · Capacitor 6 · Fabric.js · MediaPipe (on-device AI) · Cloud AI API (generative features) · AdMob
> Design source: "Photo Editor — Android Screens" artifact — 37 numbered screens + shared components
> Theme (from design): bg `#121212`, surface `#1E1E1E`, primary `#7C4DFF`, accent `#00E5FF`, Pro badge `#FFD166`, success `#2EE59D`, Roboto

---

## 0. What changed from v1

The design adds a whole **AI tools** layer on top of the classic editor (16 AI/creative screens). That changes three things:

| v1 assumption | v2 reality |
|---|---|
| Everything on-device, no backend | Classic tools + ~6 AI tools stay on-device; ~10 generative AI tools **need a cloud API** |
| Ads only | Ads + Pro one-time IAP + rewarded-ad credits for AI generations |
| 3-week build | Phased: ship **Classic + On-device AI** first (≈5 weeks), add **Cloud AI** per feature afterwards |

**Decision to make before Phase 5:** which cloud AI provider (see §7) and how many free AI generations per day the rewarded ad buys. The $25–50 budget covers Play Console + first month of API usage only if free generations are capped.

---

## 1. Environment Setup

| Item | Version / Note |
|---|---|
| Node.js | LTS (20.x) |
| Ionic CLI | `npm i -g @ionic/cli` |
| Android Studio | Latest stable, SDK API 34+, build tools |
| JDK | 17 |
| Test device | Physical mid-range Android (3–4 GB RAM), USB debugging on |

```bash
ionic start layera blank --type=angular --capacitor
cd layera
# editor engine
npm i fabric cropperjs pica
# capacitor core plugins
npm i @capacitor/camera @capacitor/filesystem @capacitor/share @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences @capacitor/haptics @capacitor/app
npm i @capacitor-community/media            # show saved image in gallery
npm i @capacitor-community/admob            # Google ads
npm i @capacitor-community/in-app-purchases # Go Pro (or RevenueCat)
# on-device AI
npm i @mediapipe/tasks-vision               # segmentation, face landmarks
ionic cap add android
```

**AndroidManifest.xml**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.INTERNET" />   <!-- ads + cloud AI -->
<!-- inside <application> -->
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"/>
```

---

## 2. Project Structure

```
src/app/
├── core/
│   ├── services/
│   │   ├── canvas.service.ts        # Fabric canvas wrapper (single source of truth)
│   │   ├── image.service.ts         # pick/capture, downscale, load to canvas
│   │   ├── history.service.ts       # undo/redo stack (canvas.toJSON snapshots)
│   │   ├── export.service.ts        # toDataURL → Filesystem → Media gallery → Share
│   │   ├── project.service.ts       # Recent projects (canvas JSON + thumbnail in Filesystem)
│   │   ├── ads.service.ts           # AdMob banner / interstitial / rewarded / native + UMP consent
│   │   ├── pro.service.ts           # isPro, IAP purchase/restore, unlock expiry per pack
│   │   ├── credits.service.ts       # AI generation credits (earned via rewarded ads, free for Pro)
│   │   ├── ai-local.service.ts      # MediaPipe: selfie/person segmentation, face landmarks
│   │   └── ai-cloud.service.ts      # HTTP client for generative features (upload → poll → result)
│   ├── guards/
│   │   └── pro-or-credit.guard.ts   # gate AI screens: Pro, has credit, or show Rewarded dialog
│   └── models/
│       └── editor.models.ts         # Tool, Layer, Filter, Theme, AiJob types
├── features/
│   ├── splash/                      # 01
│   ├── onboarding/                  # 02a–c
│   ├── home/                        # 03 (hero, AI-tools chip, recents, templates, banner)
│   ├── picker/                      # 04 (multi-select with numbered badges)
│   ├── editor/                      # 05 (canvas + scrollable tool bar + banner)
│   │   └── tools/
│   │       ├── crop/                # 06
│   │       ├── adjust/              # 07
│   │       ├── filters/             # 08 (+ Pro pack tile → rewarded)
│   │       ├── draw/                # 09
│   │       ├── layers/              # 10 (side drawer)
│   │       ├── collage/             # 11
│   │       ├── text/                # 12
│   │       ├── stickers/            # 13 (+ Pro tab → rewarded)
│   │       └── remove-bg/           # 13b (on-device + HD cutout via rewarded)
│   ├── ai/                          # AI hub + one page per feature
│   │   ├── ai-hub/                  # grid of AI tools (entry from Home "AI tools" chip)
│   │   ├── color-boost/             # 22  on-device
│   │   ├── beauty/                  # 23  on-device
│   │   ├── enhance/                 # 24  cloud (2× free / 4× Pro or rewarded)
│   │   ├── hairstyle/               # 25  cloud
│   │   ├── remove-people/           # 26  cloud (inpaint)
│   │   ├── sky-replace/             # 27  on-device mask + local sky assets
│   │   ├── portrait-blur/           # 28  on-device
│   │   ├── restore-old/             # 29  cloud
│   │   ├── cartoon/                 # 30  cloud
│   │   ├── expand/                  # 31  cloud (outpaint)
│   │   ├── remove-text/             # 32  cloud (inpaint)
│   │   ├── passport-photo/          # 33  on-device (segmentation + presets + print sheet)
│   │   ├── headshot/                # 34  cloud
│   │   ├── relight/                 # 35  on-device (WebGL/canvas light overlay)
│   │   ├── sticker-maker/           # 36  on-device (segmentation + outline + WhatsApp export)
│   │   └── themes/                  # 37  on-device (LUT/filter presets, remote JSON catalog)
│   ├── export/                      # 14, 15 (success sheet + native ad)
│   ├── paywall/                     # 18
│   └── settings/                    # 19
└── shared/
    ├── components/                  # status-bar-safe-area, ad-banner-slot, before-after-slider,
    │                                # bottom-sheet-panel, slider, colour-picker, pro-badge, tool-button
    └── pipes/
```

---

## 3. Screen → Feature → Implementation Map

### 3a. Onboarding & Home
| # | Screen | Implementation |
|---|---|---|
| 01 | Splash | `@capacitor/splash-screen` + animated logo; preload AdMob SDK & MediaPipe model in background |
| 02 | Onboarding ×3 | `ion-slides`/Swiper, "Skip", store `onboarded=true` in Preferences |
| 03 | Home | Hero card (Choose photo / Take photo), chips row (AI tools, Collage, Layers, Draw, Crop, Filters, Text), Recent projects (project.service), Templates grid, **AdMob banner** |
| 04 | Photo picker | Custom grid over `@capacitor/camera` `pickImages()` (multi) — numbered selection badges, Camera tile |

### 3b. Classic editor (Fabric.js)
| # | Screen | Implementation |
|---|---|---|
| 05 | Editor main | Top bar: back, undo/redo, layers badge, Export. Checkerboard canvas, selection handles. Scrollable tool bar: Crop, Remove BG, Adjust, Filters, Draw, Layers, Text, Stickers, Collage. **Banner hidden while a tool panel is open** |
| 06 | Crop & rotate | Aspect chips (Free, 1:1, 4:3, 16:9, 9:16, Original), rotate L/R, flip H/V, straighten slider — Cropper.js or Fabric `clipPath` |
| 07 | Adjust | Chips: Brightness, Contrast, Saturation, Exposure, Warmth, Sharpen, Blur, Vignette → Fabric WebGL filters; press-and-hold Compare |
| 08 | Filters | Preset tiles (Original, Vivid, B&W, Vintage, Film, Cool, Warm, Fade, Noir, Pop) + intensity; **Pro pack tile → rewarded** |
| 09 | Draw | Brush / Marker / Neon / Eraser, size + opacity, 10-colour palette + custom picker; `PencilBrush`, eraser via `destination-out` |
| 10 | Layers panel | Side drawer: drag-reorder, thumbnail, visibility, lock; selected-layer opacity, blend mode, Duplicate/Flip/Delete |
| 11 | Collage | Layouts (1+1 V/H, 3-grid, 2×2, 1+2, freestyle), border + corner-radius sliders, background swatches/image |
| 12 | Text | `fabric.IText`; tabs Font / Style / Colour / Shadow; fonts bundled locally (Roboto, Lobster, Montserrat, Pacifico, Bebas, Playfair) |
| 13 | Stickers | Category tabs (Emoji, Shapes, Love, Summer, **Pro**); SVG assets; Pro tab → rewarded dialog |
| 13b | Remove background | **On-device** MediaPipe ImageSegmenter (Auto / Person / Object), Erase/Restore refine brush with size, new background (transparent, white, violet, gradient, blur original, custom image), before/after slider. **"HD cutout with fine hair edges" → rewarded ad → cloud matting** |

### 3c. AI feature screens — on-device (free, no API cost)
| # | Screen | Implementation |
|---|---|---|
| 22 | Colour boost | Auto-levels + saturation/vibrance curve on canvas; strength slider; before/after |
| 23 | Natural beauty | MediaPipe FaceLandmarker → face mask; looks Natural/Soft/Glow; tools Smooth skin, Even tone, Remove spots (local blur-inpaint), Brighten eyes, Whiten teeth, Lighting; per-tool slider |
| 27 | Replace the sky | Segment sky (ImageSegmenter class "sky" or luminance+position heuristic) → composite bundled sky images (sunset, blue, night, storm…) with edge feather + colour-match |
| 28 | Portrait blur | Person segmentation mask → Gaussian/bokeh blur on background, blur-strength slider, edge feather |
| 33 | Passport & ID photos | Segment person → white/blue/grey/red background; size presets (Pakistan 35×45, UK 35×45, USA 2×2in, Schengen, Custom); crown/chin guide lines + face-fit check list; "Save photo" and "Print sheet 4×6" (tile N copies onto a 4×6 canvas at 300 dpi) |
| 35 | Relight | Draggable light source + radial gradient with `screen` blend; presets Golden hour / Studio / Window / Neon / Rim light; Intensity + Temperature sliders |
| 36 | Sticker maker | Segmentation cut-out → white outline (dilate mask, outline slider), add Text/Emoji/Shadow, "My pack (n of 30)", **Add to WhatsApp** (WhatsApp sticker intent: 512×512 WebP + tray icon — needs a small native Capacitor plugin), Save to pack |
| 37 | One-tap themes | Named filter stacks (Winter frost, Festive lights, Retro 90s, Cyber neon, Golden glow, Monsoon mood…); "Trending / New / PRO" badges; catalog loaded from a remote JSON so new themes "drop" without an app update; **banner** |

### 3d. AI feature screens — cloud generative (cost per call → credits/Pro)
| # | Screen | Model type | UX from design |
|---|---|---|---|
| 24 | Improve quality (Enhance) | Super-resolution + face restore (e.g. Real-ESRGAN / GFPGAN / CodeFormer) | Upscale Off / 2× / **4× PRO**; toggles Sharpen, Reduce noise, Fix lighting, Restore faces; before/after; "Free 4× for this photo → Watch ad" |
| 25 | Hairstyle try-on | Hair-edit / face-preserving img2img | Styles Bob, Pixie, Long waves, Curly (PRO), Bun, Undercut (PRO); 7 colours; Length slider; Compare; "Save look" |
| 26 | Remove people | Person detection + inpainting (LaMa-style) | Auto detect (numbered boxes), Brush, Lasso; per-person chips; brush size; "Remove" |
| 29 | Restore old photos | Scratch removal + colourise + face restore | before/after; toggles Colourise / Fix scratches / Sharpen faces; rewarded per image |
| 30 | Cartoon yourself | Style-transfer img2img | Styles Cartoon, Sketch, 3D toon, Comic (PRO), Watercolour (PRO), Pixel (PRO); Likeness slider; **"Watch ad & create"** |
| 31 | Expand the photo | Outpainting | Targets Story 9:16, Square 1:1, Wide 16:9, Wallpaper; optional prompt; shows "AI-generated" regions |
| 32 | Remove text | OCR/text detection + inpainting | Auto-detect text boxes + brush; "Remove" |
| 34 | Professional headshot | Face-preserving portrait generation | Scenes Studio grey / Office / Outdoor / Navy / Warm; Outfit Blazer / Suit / Shirt / Keep mine; **PRO: 4 variations**; "Generate" |

**Common cloud-AI flow (one reusable component):**
`select options → check credit/Pro (guard) → [rewarded ad if needed] → upload downscaled JPEG → progress sheet (skeleton + "Usually 10–20 s") → result in before/after → Apply (adds as new layer) / Save`. Always show "AI-generated" label where the design does, add retry + "report result".

### 3e. Export, ads & monetisation
| # | Screen | Implementation |
|---|---|---|
| 14 | Export | Preview + resolution, Format JPG/PNG, Quality slider + estimated size, Size chips, "Remove watermark" (Pro), Save to gallery / Share, **banner**; watermark for free users |
| 15 | Export success | Checkmark, share targets (WhatsApp, Instagram, Facebook, More), Edit another / Back to home, **native ad card** |
| 16 | Interstitial | After every 3rd save, ≥2 min apart; preloaded |
| 17 | Rewarded unlock dialog | "Watch ad / Go Pro / Not now"; reused for filter packs, sticker packs, HD cutout, 4× upscale, generative features |
| 18 | Go Pro | One-time lifetime purchase; benefits list; Restore purchase; Terms/Privacy |
| 19 | Settings | Theme, default export format, save original copy; Upgrade to Pro; Ad personalisation (UMP), Privacy, Terms; About (version, rate, share, contact); **banner** (hidden for Pro) |

### 3f. Brand & Play Store (20, 21a, 21b)
Adaptive icon (overlapping violet→cyan frames), 1024×500 feature graphic, 6 screenshots: "Merge photos in seconds", "Layer photo on photo", "Draw with neon brushes", "Pro filters", "Add text & stickers", "Export in 4K" — export directly from the design artifact.

### 3g. Shared components (StatusBar, NavBar, AdBanner, Photo)
`ad-banner-slot` reserves 61 dp and collapses to 0 when hidden (Pro or tool panel open) so layout never jumps; status-bar / nav-bar safe areas via `env(safe-area-inset-*)`.

---

## 4. Milestones

### Phase 0 — Scaffold & design system (Week 1, days 1–3)
- [ ] Ionic project, Capacitor Android, run on device
- [ ] Global theme tokens from design (colours, Roboto, 16 dp radius, pill buttons, bottom-sheet component)
- [ ] Routing: splash → onboarding → home → picker → editor → export; ai hub + 16 ai routes
- [ ] Shared components: bottom-sheet-panel, before-after-slider, ad-banner-slot, pro-badge
- [ ] Icons + splash via `@capacitor/assets`

### Phase 1 — Core loop: Load → Draw → Save (Week 1–2)
- [ ] image.service: gallery multi-pick (numbered), camera, downscale ≤ 2000 px
- [ ] canvas.service: Fabric init, DPR-aware sizing, fit-to-screen, selection handles
- [ ] Draw tool (Brush/Marker/Neon/Eraser, size, opacity, palette)
- [ ] export.service: JPG/PNG, quality, size chips, save to Pictures/Layera, share sheet
- [ ] Export success sheet
- ✅ **Checkpoint: "doodle on a photo and save" works end-to-end**

### Phase 2 — Classic editing tools (Week 2–3)
- [ ] Crop & rotate (aspect chips, flips, straighten)
- [ ] Adjust (8 adjustments, Compare)
- [ ] Filters (10 presets + intensity)
- [ ] Undo / redo / reset (history.service)
- [ ] Text (6 bundled fonts, style, colour, shadow)
- [ ] Stickers (4 free categories)
- [ ] Recent projects (save canvas JSON + thumbnail, reopen)

### Phase 3 — Layers, collage & on-device AI (Week 3–4)
- [ ] Layers drawer (reorder, opacity, blend, lock, duplicate, flip, delete)
- [ ] Multi-image layers with pinch/rotate gestures
- [ ] Collage templates + border/radius/background
- [ ] MediaPipe ImageSegmenter + FaceLandmarker loaded once (ai-local.service), warm-up on splash
- [ ] Remove background (auto/person/object, refine brush, new backgrounds)
- [ ] Portrait blur · Sticker maker (incl. WhatsApp export plugin) · Passport & ID photo (+ 4×6 print sheet)
- [ ] Natural beauty · Colour boost · Relight · Replace the sky · One-tap themes (remote catalog)
- ✅ **Checkpoint: feature-complete offline app**

### Phase 4 — Ads, Pro & credits (Week 4–5)
- [ ] AdMob account, 4 ad units, test IDs, UMP consent
- [ ] ads.service: banner (Home, Editor, Export, Themes, Settings), interstitial (3rd save, 2-min cap), rewarded, native (success sheet)
- [ ] pro.service: one-time IAP, restore, hide all ads + watermark when Pro
- [ ] credits.service: rewarded ad → +1 AI credit (or 24 h pack unlock); daily cap; Pro = unlimited (fair-use cap)
- [ ] Rewarded unlock dialog wired to: Pro filters, Pro stickers, HD cutout, 4× upscale, every cloud AI feature
- [ ] Watermark on free exports; "Remove watermark" toggle = Pro
- ✅ **Checkpoint: ads showing with test IDs, no overlap with canvas, Pro removes them**

### Phase 5 — Cloud AI features (Week 5–7, one feature at a time, each behind a remote feature flag)
- [ ] ai-cloud.service: upload (JPEG ≤ 1.5 MP), job polling, timeout/retry, cost logging
- [ ] Minimal backend proxy (Cloudflare Worker / Firebase Function, free tier) so API keys are **never in the APK**; rate-limit by device ID
- [ ] Enhance (2× free, 4× rewarded/Pro) → Remove people → Remove text → Expand → Restore old → Cartoon → Hairstyle → Headshot
- [ ] Each: progress sheet, before/after, Apply as layer, "AI-generated" label, retry, report
- ✅ **Checkpoint: every design screen reachable and functional**

### Phase 6 — Polish & performance (Week 7)
- [ ] Throttle pointer events, `requestRenderAll` batching, dispose images on leave
- [ ] 48 MP photo memory test; export full-res via `multiplier`
- [ ] Loading/empty states, haptics, back-button + "Discard changes?" guard
- [ ] Accessibility: 48 dp touch targets, labels on icon buttons (as in design)

### Phase 7 — Release (Week 8)
- [ ] Privacy policy (ads, advertising ID, **images uploaded for AI features and deleted after processing**)
- [ ] Play Console Data safety: ads = yes, photos uploaded = yes (for AI features), device ID
- [ ] Real ad unit IDs, remove test devices; `app-ads.txt`
- [ ] Signed AAB, listing (icon, feature graphic, 6 screenshots, description)
- [ ] Internal → closed beta (collect AI cost per user) → production
- [ ] Link AdMob ↔ Play Console

---

## 5. Performance rules (Android WebView)
1. Never put the original photo on the canvas — downscale to ≤ 2000 px; export with `multiplier`.
2. Working canvas ≤ screen × DPR; `fabric.textureSize = 4096` for WebGL filters.
3. Debounce sliders (~50 ms); heavy filters apply on release.
4. MediaPipe: load models once, run in a Web Worker, downscale input to 512–1024 px for masks, upscale mask with bilinear + feather.
5. Cloud AI: upload ≤ 1.5 MP JPEG q85, show progress, never block the UI thread.
6. Test on a 3–4 GB RAM device.

---

## 6. Monetisation — Google AdMob + Pro

### Costs (budget $25–50)
| Item | Cost |
|---|---|
| Google Play developer account | US$25 one-time |
| AdMob, Firebase/Cloudflare free tier (proxy + feature flags) | Free |
| Privacy policy hosting (GitHub Pages) | Free |
| Cloud AI API usage | Pay-per-use (~$0.002–0.05 / image) — cap free usage, see §7 |
| **Total up-front** | **~US$25** |

### Ad placement map (matches the design's orange sticky note)
| Screen | Ad unit | Rule |
|---|---|---|
| Home | Anchored adaptive banner | Always (hidden for Pro) |
| Editor main | Banner | Hidden while any tool panel is open |
| Export | Banner | Always (hidden for Pro) |
| After save | Interstitial | Every 3rd save, min 2 min apart |
| Export success | Native ad (medium) | Always (hidden for Pro) |
| Filters / Stickers Pro packs | Rewarded video | Unlocks pack for 24 h |
| Remove background HD cutout | Rewarded video | Per image (free for Pro) |
| AI Enhance 4× upscale | Rewarded video | Per image (free for Pro) |
| Restore old / Cartoon / other cloud AI | Rewarded video | Per generation = 1 credit (free for Pro, fair-use cap) |
| One-tap themes | Banner | Always (hidden for Pro) |
| Settings | Banner | Always (hidden for Pro) |

### Setup steps
1. AdMob console → Add app (Android, not yet published) → copy **App ID**
2. Create ad units: `banner_main`, `interstitial_save`, `rewarded_unlock`, `native_success`
3. `environment.ts` — test IDs in dev, real IDs in prod:
   ```ts
   adUnits: {
     banner:       'ca-app-pub-3940256099942544/6300978111',  // test
     interstitial: 'ca-app-pub-3940256099942544/1033173712',  // test
     rewarded:     'ca-app-pub-3940256099942544/5224354917',  // test
     native:       'ca-app-pub-3940256099942544/2247696110',  // test
   }
   ```

### `ads.service.ts` responsibilities
```ts
initialize()              // AdMob.initialize() + UMP consent form before first ad
showBanner()/hideBanner() // BOTTOM_CENTER adaptive; sets --ad-height so layout shrinks, never overlaps canvas
prepareInterstitial()     // preload on start & after each show
maybeShowInterstitial()   // saveCount % 3 === 0 && now - lastShown > 120_000 && !isPro
showRewarded(reason)      // reason: 'pack:<id>' | 'hd-cutout' | 'upscale4x' | 'ai-credit'
                          // on reward → pro.service.unlockPack(id, 24h) or credits.service.add(1)
```

### `pro.service.ts` / `credits.service.ts`
- Pro: lifetime IAP (`layera_pro_lifetime`, suggest $2.99–4.99); restore on first launch; `isPro$` observable hides ads, watermark, and PRO badges
- Credits: `Preferences` key `ai_credits` + daily earn cap (e.g. 5/day) so ad revenue ≥ API cost; Pro gets N generations/day fair-use cap (e.g. 30)

### Policy must-dos
- Never click your own ads; register test devices in dev
- No ads over the canvas; no layout shift when a banner loads; interstitials only at natural breaks
- UMP consent (GDPR/EEA) before loading ads; declare advertising ID in Data safety
- Rewarded ads must deliver exactly what the dialog promised

### Revenue expectations (rough)
- Banner eCPM ~$0.3–1 · Interstitial ~$3–8 · Rewarded ~$10–20 (Pakistan/South Asia traffic is at the lower end; US/EU higher)
- A rewarded view ≈ $0.01–0.02 → it covers roughly **one** cheap AI call. Generative calls (headshot, hairstyle, cartoon) cost more than one ad pays → keep them **Pro-first**, with rewarded as a limited taster (e.g. 1/day)

---

## 7. Cloud AI — provider decision & cost model

| Option | Pros | Cons |
|---|---|---|
| **Replicate** / **fal.ai** (hosted open models: Real-ESRGAN, GFPGAN, LaMa, SDXL inpaint/outpaint, IP-Adapter/InstantID for headshots) | Pay-per-second, no server, many models, free credits to start | Cold starts (5–20 s), per-model quality varies |
| Google Vertex AI (Imagen edit/outpaint) | Reliable, Firebase integration | Higher cost, region limits |
| Self-hosted on a GPU VM | Cheapest at scale | Not within budget now |

**Recommendation:** Start with Replicate/fal via a tiny proxy function. Order of cheapest → most expensive: Enhance (upscale) < Remove text/people (inpaint) < Expand (outpaint) < Restore old < Cartoon < Hairstyle < Headshot.
Track `cost_per_feature` in the proxy; disable a feature with a remote flag if cost/revenue goes negative.

---

## 8. Open Decisions
- [ ] Package id (`com.xenexmedia.layera` ?)
- [ ] Pro price (one-time $2.99 / $3.99 / $4.99) — design shows one-time lifetime
- [ ] Free AI credits per day via rewarded ad (suggest 3–5) and Pro fair-use cap
- [ ] Which cloud AI provider (§7); which generative features ship in v1.0 vs v1.1
- [ ] Watermark design for free exports
- [ ] iOS later (Capacitor makes it config-only, but needs a Mac + $99/yr)

---

## 9. Backlog (not in the design yet)
- Batch export · Frames & borders · Blur/pixelate region · Video-to-GIF · Cloud project sync (Pro)
