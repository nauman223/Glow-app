# Glow: device test report

**Dates:** 2026-11-20 and 2026-11-23
**Build:** dev build (Google test ad IDs), `com.nadev.glow` 0.1.0
**Result:** 24 issues fixed and re-checked on an emulator. Every Definition of Done check passes, plus `cap sync` and `assembleDebug`.

---

## 1. Test setup

| Pass | Emulator | Screen | Android | Purpose |
|---|---|---|---|---|
| 1 (2026-11-20) | `Medium_Phone` (emulator-5558) | 412 × 915 dp (design size) | 17 (API 37) | Every screen and flow at the design size |
| 2 (2026-11-23) | `Glow_Test_Small` (emulator-5560), new | 360 × 640 dp, 320 dpi, 3 GB RAM | 16 (API 36) | Smallest common phone; short-screen layouts |

- Both emulators use software rendering (`-gpu swiftshader_indirect`).
- The `Pixel_10_Pro` and `Samsung` emulators were not used.
- **How the app was driven:** the debug WebView was controlled through Chrome DevTools Protocol, with real touch events. Native dialogs (permissions, settings) were handled through `adb` and `uiautomator`. Each change was checked with screenshots, DOM measurements and logcat.
- **Test photos:** nine 2400 × 1600 JPEGs and one 48 MP photo, loaded into `Pictures/GlowTest`.

---

## 2. Issues fixed

### Pass 1: design size (412 × 915 dp)

| # | Area | Problem | Fix | File(s) |
|---|---|---|---|---|
| 1 | Ads | Home froze: the banner's effect looped forever | The banner request is made idempotent and runs outside the signal tracking | `shared/ui/ad-banner-slot/ad-banner-slot.component.ts`, `core/ads/banner-ads.service.ts` |
| 2 | Ads | The banner stayed visible after leaving a page | Leaving a page now always updates the banner request | same as #1 |
| 3 | On-device AI | Remove BG returned a 100 % mask: the GPU failed silently | Implausible GPU results (a full mask, or no faces) are retried on the CPU | `core/ai-local/worker/vision-tasks.ts`, `segment-op.ts`, `face-op.ts` |
| 4 | Navigation | Android Back on an AI screen went to Home and threw away the editor | Back asks the root outlet `canGoBack()` and leaves Ionic's pop alone | `core/platform/app-lifecycle.service.ts`, `app.ts` |
| 5 | Export | Exports were 1 px short (2400 × 1599) | The renderer targets the rounded size exactly | `core/canvas/canvas-render.ts` |
| 6 | Crop | A 1:1 crop came out 1332 × 1333 | Snapping keeps the aspect ratio to the nearest pixel | `tools/06-crop/crop-geometry.ts` |
| 7 | Picker | Thumbnails were blurry (fixed at 256 px) | Thumbnails are sized to tile width × screen density, between 256 and 1024 px | `core/media/media-backend.ts` |
| 8 | Collage | A background swatch was half hidden under the Image button | The swatches get their own row | `tools/11-collage/collage-panel.component.*` |
| 9 | Buttons | `block` buttons didn't fill the width (Go Pro's Unlock Pro) | Block buttons stretch inside centring parents | `shared/ui/button/button.component.scss` |

### Pass 2: small screen (360 × 640 dp)

| # | Area | Problem | Fix | File(s) |
|---|---|---|---|---|
| 10 | AI screens | **No photo shown** on Enhance, Sticker maker and others: `100cqb` resolved to 0 in Android WebView | Each stage's size container is now an absolutely positioned `__fit` layer | `_shell/components/ai-result-stage`, `13b…/cutout-stage`, `31-expand/…/expand-stage`, `35-relight/…/relight-stage`, `36-sticker-maker/…/sticker-stage` |
| 11 | AI screens | The options panel squeezed the photo to nothing, and option rows overlapped | The photo keeps `min(32dvh, 280px)`; the options scroll inside a list that isn't height-limited | `_shell/components/ai-screen/ai-screen.component.*` |
| 12 | Editor panels | The AI tools sheet rose behind the top bar; its first row couldn't be reached | Docked sheets are capped by the viewport (`100dvh` − top bar − 144 px of stage) and scroll | `shared/ui/bottom-sheet/bottom-sheet.component.scss` |
| 13 | Modal sheets | The "Saved!" sheet's top was cut off | Its maximum height now also subtracts the ad band | same as #12 |
| 14 | History | After a tool's **Cancel**, Redo brought back what was cancelled | `revertTo` discards the undone commands and notifies the removal listener | `core/history/history.service.ts` |
| 15 | Text tool | Typing into a new text appended to "Your text" (on Android the selection collapses when the keyboard opens) | A new text starts as an empty field with a placeholder; the canvas still shows "Your text" | `tools/12-text/text-panel.component.*` |
| 16 | Export | Save / Share were below the fold | The action block is sticky; the Quality card is more compact | `features/14-export/export.page.*` |
| 17 | Go Pro | Unlock Pro was below the fold | Sticky actions and a smaller hero on short screens | `features/18-go-pro/go-pro.page.scss` |
| 18 | Picker | After a permanent denial there was no way back except manual directions | New **Open settings** button, backed by the native `GlowMedia.openAppSettings()`. The photos load automatically when the user returns | `GlowMediaPlugin.java`, `core/media/*`, `features/04-picker/*` |
| 19 | Onboarding | The text and Next button were cut off, and the illustrations were clipped | A 240 px stage with scaled art on short screens; each slide clips its own glow | `features/02-onboarding/onboarding.page.scss` |
| 20 | Home | "Choose photo" wrapped onto two lines | Block buttons use smaller side padding | `shared/ui/button/button.component.scss` |
| 21 | Home | Large empty gap above Templates on a fresh install | An empty Recent projects section is hidden | `03-home/components/recent-projects/*` |
| 22 | All horizontal rows | No sign that a row scrolls (exactly five tools fit at 360 dp) | New shared `ScrollFadeDirective` fades whichever edge has more content; applied to all 20 scrollers | `shared/ui/scroll-fade/`, `styles/components/_scroll-fade.scss` |
| 23 | Remove BG | The brush-size slider was squeezed to ~40 px | New opt-in `wrap` input on `app-ai-option-row`; the slider moves to its own line | `_shell/components/ai-option-row/*`, `13b-remove-background/*` |
| 24 | Cloud AI | Upload size shown as 1500 × 999 | The size is rounded, and floored only when rounding would pass the 1.5 MP cap | `core/ai-cloud/ai-cloud-image.ts` |

---

## 3. What was checked and works

- **First run:** splash, onboarding (3 slides, Skip, Get Started), Home.
- **Picker:**
  - The permission prompt, Allow, permanent denial, Open settings, and coming back.
  - Albums, the photo grid and pull-to-refresh.
- **Editor:**
  - Crop (ratios, rotate, flip, straighten), Adjust, Filters, Draw (strokes, Apply, Cancel), Text, Stickers.
  - Layers: reorder controls, Duplicate, Delete, opacity, blend mode.
  - Collage (layouts, border, radius, background), undo/redo, and the autosave + reopen project.
- **Export:**
  - Format, quality, all four sizes; the output size exactly matches what the screen shows.
  - Save to `Pictures/Glow`, the success sheet with its native test ad, and Share.
- **On-device AI:**
  - Portrait blur, Remove BG, Colour boost, Natural beauty (no-face state), Relight (Apply returns to the editor as an undoable step), Replace sky, Passport, Sticker maker, One-tap themes.
- **Cloud AI:** all 8 screens open, show 0 credits, and upload nothing until the action is tapped.
- **Monetisation:**
  - Banner test ads, UMP consent ("not required").
  - The rewarded-unlock dialog (Unlock Pro skies) and Go Pro.
- **Settings:** Dark / Light / System, the open-source licences page, the version.
- **Android Back:**
  - Closes a panel or sheet first.
  - Then goes back one page at a time: AI screen → editor → picker → Home.
  - Then minimises the app on Home.

---

## 4. Not verified

| Item | Why | What to do |
|---|---|---|
| On-device AI result quality | The emulator's software GPU gives wrong masks. The multiclass segmenter on GPU crashed the emulator itself (with CPU only, Colour boost works) | Test Remove BG, Sticker maker, Replace sky, Colour boost and Natural beauty on a real phone |
| A full "Watch ad" → reward → unlock | Someone else used the emulator during the pass-1 test | Test on a device with test ads |
| TalkBack | Not run | Test the new **Open settings** button, the sticky Unlock Pro and Save buttons, and focus order in the sheets |
| Cloud AI results | The backend proxy doesn't exist yet | Test once the proxy is deployed (`doc/ai-proxy-contract.md`) |
| The Text tool with a full on-screen keyboard | The small test emulator showed Gboard's compact stylus toolbar | Test on a device |

---

## 5. Build checks (final)

| Check | Result |
|---|---|
| `npm run lint` | Pass, 0 warnings |
| `npm run lint:styles` | Pass, 0 warnings |
| `npm run format:check` | Pass |
| `npm run type-check` | Pass (app + worker) |
| `npm run build:prod` | Pass, no budget errors. Initial bundle **516.5 kB** (145.4 kB transfer); this triggers the existing 500 kB *warning* |
| `npx cap sync android` | Pass |
| `gradlew assembleDebug` | Pass |

---

## 6. Features you could add next

From a comparison of the spec, every design board and the code, ranked by user value against effort.

### Top 8

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | Home quick-tool chips (Collage, Layers, Draw, Crop, Filters, Text) | In the design; Home only has "AI tools" | S |
| 2 | Before/after hold in the editor | Compare exists only in Adjust | S |
| 3 | Placeholders for empty collage cells | Empty cells are invisible on the canvas | S |
| 4 | Direct share buttons (WhatsApp, Instagram, Facebook) on Export success | In the design; there's only one generic Share | S |
| 5 | HEIC photo import | Samsung and iPhone photos are currently rejected | S–M |
| 6 | Canvas pinch-zoom and pan | Precise drawing, brushes and masks | M |
| 7 | True full-resolution export plus a 4K preset | Go Pro promises "4K export"; the largest size today is 2K | M |
| 8 | Highlights, shadows and grain, then curves and HSL | Adjustment depth users expect from Snapseed or Lightroom | S–M |

None of these needs a new package or backend work.

### Other design gaps

- **Settings:** no default export format, "Save original copy" toggle, or Rate / Share / Contact items.
- **Layers:** "Add layer" can only add a photo (no text, sticker or empty layer).
- **Portrait blur:** no bokeh shapes, no tap-to-focus.
- **Sticker maker:** no text captions.
- **Remove text:** no on-device text finder.
- **Restore:** "Fix scratches" is always on (the DTO has no field for it).
- **Headshot:** "4 variations" needs a v2 AI contract.

### Release items

- The app icon source `resources/icon.png` is missing; there's no store graphic or screenshots.
- None of the AI proxy DTOs is confirmed with the backend.

---

## 7. Decisions needed

1. **Bundle budget:** the initial bundle is 516.5 kB against the 500 kB warning limit. I recommend raising the warning to 560 kB.
2. **Commit:** nothing is committed to git yet.
3. **Licences:** whether to add the native Android library licences (AdMob, UMP, Billing, AndroidX) to the licences screen.
4. **Security policy:** whether to remove the dev API host from the production CSP.
5. **Accessibility audit:** whether to rerun it.
6. **Next features:** which ones from section 6 to plan and design.
