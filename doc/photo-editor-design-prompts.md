# Photo Editor — Android Screen Design Prompts

Use these with any AI UI generator (Google Stitch, Figma AI / Make, Uizard, Galileo, Midjourney, ChatGPT/Claude image tools). Paste the **Global Style Block** first, then one screen prompt at a time.

---

## 0. Global Style Block (prepend to every prompt)

```
Design a native Android mobile app screen for a photo editor app called "[APP NAME]".
Platform: Android 14, Material Design 3 (Material You), portrait, 1080x2400 px (Pixel 8), 
status bar and 3-button/gesture nav bar visible.
Visual style: dark editor theme by default — background #121212, surface #1E1E1E, 
primary accent #7C4DFF (violet), secondary accent #00E5FF (cyan), text #FFFFFF / #B3B3B3.
Typography: Roboto / Google Sans, large rounded headings, 14sp body.
Components: rounded 16dp cards, pill buttons, bottom sheets with drag handle, 
icon toolbars with labels, Material sliders, FAB where noted.
Tone: modern, minimal, pro-creative (like Snapseed / Picsart), high contrast for use outdoors.
Ads: this app is monetised with Google AdMob. Where an ad placeholder is specified, 
draw a clearly labelled grey rectangle "AdMob Banner 320x50" (anchored adaptive banner) 
that never overlaps the canvas or primary actions. Ads must look native but separated 
from editing controls with a 1dp divider.
Output: high-fidelity UI mockup, clean, no device frame, realistic placeholder photos (landscape, portrait, selfie).
```

---

## 1. Splash Screen
```
[Global Style Block]
Screen: Splash.
Centered app logo (abstract overlapping photo layers forming a rounded square, violet→cyan gradient), 
app name below in bold, small tagline "Edit · Merge · Create". 
Subtle radial gradient glow behind logo, dark background. No ads. Minimal, 1-second brand moment.
```

## 2. Onboarding (3 slides)
```
[Global Style Block]
Screen: Onboarding carousel, 3 slides, page indicator dots, "Skip" top-right, "Next"/"Get Started" pill button bottom.
Slide 1: "Merge photos" — illustration of two photos combining into a collage.
Slide 2: "Layer & blend" — photo stacked on photo with opacity slider.
Slide 3: "Draw & decorate" — brush strokes, text and stickers on a photo.
Each slide: large illustration top 60%, headline + 1-line description bottom. No ads.
```

## 3. Home / Start Screen
```
[Global Style Block]
Screen: Home.
Top app bar: app logo left, settings gear right.
Hero section: large primary card "Start editing" with camera + gallery icons and two pill buttons 
"Choose photo" and "Take photo".
Quick actions row (horizontal chips with icons): Collage, Layers, Draw, Crop, Filters, Text.
Section "Recent projects": horizontal scroll of 3 thumbnail cards with date and a 3-dot menu.
Section "Templates": grid of 4 collage layout cards (2-grid, 3-grid, 4-grid, freestyle).
Bottom: AdMob Banner 320x50 anchored above the nav bar, full-width, labelled.
```

## 4. Photo Picker (Gallery)
```
[Global Style Block]
Screen: Photo picker bottom sheet (90% height) over the Home screen.
Header: "Select photos", album dropdown "Camera ▾", close X.
Grid: 3 columns of square photo thumbnails, selected items show a violet numbered badge (1, 2, 3) 
for multi-select ordering. Camera tile as first item with a camera icon.
Footer: selected count "3 selected" and a primary pill button "Continue". No ads inside picker.
```

## 5. Editor — Main Canvas
```
[Global Style Block]
Screen: Editor (main). This is the core screen.
Top bar (48dp): back arrow, undo + redo icons (redo disabled/greyed), layers icon with badge "2", 
and a primary pill button "Export" right.
Canvas area: fills the middle, checkerboard transparent background, a landscape photo centered 
with Material-style selection handles (corner circles, rotate handle on top) visible on the photo.
Bottom tool bar (72dp, horizontally scrollable, icon + label): Crop, Adjust, Filters, Draw, Layers, Text, Stickers, Collage.
Below tool bar: AdMob Banner 320x50 anchored at the very bottom, separated with a divider — 
it must not cover the canvas or the tool bar.
```

## 6. Editor — Crop & Rotate
```
[Global Style Block]
Screen: Editor with Crop tool active.
Canvas shows a photo with a crop overlay: rule-of-thirds grid, draggable corner and edge handles, 
dimmed area outside crop.
Bottom sheet (contextual panel) replaces tool bar: 
Row 1 aspect-ratio chips: Free, 1:1, 4:3, 16:9, 9:16, Original (1:1 selected).
Row 2: rotate-left, rotate-right, flip-horizontal, flip-vertical icon buttons, and a straighten slider (−45° to 45°, value "0°").
Panel footer: "Cancel" text button left, "Apply" primary pill right.
AdMob banner hidden while a tool panel is open (note this in the mockup with a tiny caption).
```

## 7. Editor — Adjust
```
[Global Style Block]
Screen: Editor with Adjust tool active.
Canvas shows photo with live preview.
Bottom sheet: horizontal scroll of adjustment chips with icons: Brightness, Contrast, Saturation, 
Exposure, Warmth, Sharpen, Blur, Vignette (Brightness selected, highlighted violet).
Below chips: one large Material slider (−100 to +100) with the current value "+20" in a bubble, 
a small "reset" icon at the end. "Compare" eye icon (press-and-hold to see original).
Footer: Cancel / Apply.
```

## 8. Editor — Filters
```
[Global Style Block]
Screen: Editor with Filters tool active.
Canvas photo with "Vintage" filter applied.
Bottom sheet: horizontal scroll of filter preview tiles (80x80 thumbnails of the user's photo) 
with names below: Original, Vivid, B&W, Vintage, Film, Cool, Warm, Fade, Noir, Pop. 
"Vintage" selected with violet border; an intensity slider below (0–100, "80").
Last tile: a locked "Pro" filter pack tile with a small "Watch ad to unlock" badge (rewarded ad entry point).
Footer: Cancel / Apply.
```

## 9. Editor — Draw
```
[Global Style Block]
Screen: Editor with Draw tool active.
Canvas photo with a few freehand cyan brush strokes and a highlighter stroke drawn on it.
Bottom sheet: Row 1 — tool toggles: Brush, Marker, Neon, Eraser (Brush selected). 
Row 2 — brush size slider with live circle preview, opacity slider.
Row 3 — colour palette row of 10 circles + a "+" custom colour picker (eyedropper icon).
Floating "clear all" icon top-right of canvas. Footer: Cancel / Apply.
```

## 10. Editor — Layers Panel
```
[Global Style Block]
Screen: Editor with Layers panel open as a right-side drawer (70% width) over a dimmed canvas.
Header "Layers", "+" add-layer icon.
List of layer rows (drag handle ⋮⋮, 48dp thumbnail, name, eye visibility toggle, lock icon):
  1. "Sticker – star" 
  2. "Text – Summer 2026"
  3. "Photo 2" (selected, violet highlight)
  4. "Photo 1 – background"
Selected-layer controls at bottom of drawer: Opacity slider "75%", Blend mode dropdown "Multiply ▾", 
buttons Duplicate, Flip, Delete (red).
```

## 11. Editor — Collage / Merge Templates
```
[Global Style Block]
Screen: Editor with Collage tool active.
Canvas shows a 2×2 collage of 4 different photos with white 8dp borders and rounded corners.
Bottom sheet: Row 1 — layout thumbnails (horizontal scroll): 1+1 vertical, 1+1 horizontal, 3-grid, 2×2, 
1+2, freestyle — 2×2 selected.
Row 2 — sliders: Border "8", Corner radius "12". Row 3 — background colour swatches + "Image" option.
Footer: Cancel / Apply.
```

## 12. Editor — Text
```
[Global Style Block]
Screen: Editor with Text tool active.
Canvas photo with an editable text object "Summer 2026" in bold white with soft shadow, 
selection box and handles around it, blinking caret.
Bottom sheet: Tabs — Font, Style, Colour, Shadow. Font tab shown: horizontal scroll of font chips 
(Roboto, Lobster, Montserrat, Pacifico, Bebas, Playfair). 
Style row: Bold, Italic, Align-left/center/right, letter-spacing slider.
Keyboard shown at the bottom (Android Gboard dark).
```

## 13. Editor — Stickers
```
[Global Style Block]
Screen: Editor with Stickers tool active.
Canvas photo with a sun sticker and a speech-bubble sticker placed on it, one selected with handles.
Bottom sheet: category tabs — Emoji, Shapes, Love, Summer, Pro (lock icon). 
Grid of 4 columns of flat sticker thumbnails.
Pro tab shows a dialog hint "Watch a short ad to unlock this pack" with a play-circle icon (rewarded ad).
Footer: Done.
```

## 14. Export / Save
```
[Global Style Block]
Screen: Export.
Top bar: back arrow, title "Export".
Large preview of final image (rounded 16dp, centered) with resolution label "3000 × 2000 px".
Option cards:
  • Format: segmented control JPG | PNG (JPG selected)
  • Quality: slider "90%" with estimated size "1.8 MB"
  • Size: chips Original, Large (2K), Medium (1080p), Small
  • Toggle "Remove watermark" with a small "Pro" badge
Primary full-width pill button "Save to gallery", secondary outlined "Share".
Bottom: AdMob Banner 320x50. 
Note in mockup: an interstitial ad is shown after the 3rd save.
```

## 15. Export Success
```
[Global Style Block]
Screen: Export success bottom sheet over the Export screen.
Big animated checkmark in violet circle, "Saved to Pictures/[APP NAME]".
Row of share targets (WhatsApp, Instagram, Facebook, More…).
Buttons: "Edit another" (primary), "Back to home" (text).
Below: a Native Ad card (AdMob native, medium: image, headline, body, CTA button, "Ad" badge) 
styled to match the app's cards.
```

## 16. Interstitial Ad State
```
[Global Style Block]
Screen: Full-screen interstitial ad placeholder (AdMob) shown between Export and Success.
Grey full-screen rectangle labelled "AdMob Interstitial", a small close X top-right with a 5-second countdown, 
"Ad" badge top-left. Draw it exactly as Google's interstitial template so developers understand placement.
```

## 17. Rewarded Ad Unlock Dialog
```
[Global Style Block]
Screen: Material 3 dialog over the Filters screen.
Icon: gift/play-circle. Title "Unlock Pro Filters". Body "Watch a short video to unlock this pack for 24 hours."
Buttons: "Watch ad" (primary, with play icon), "Go Pro – remove ads" (outlined), "Not now" (text).
```

## 18. Go Pro / Remove Ads (Paywall)
```
[Global Style Block]
Screen: Pro upgrade screen (one-time purchase).
Hero: gradient header with crown icon, "Go Pro".
Benefit list with check icons: No ads, All filter packs, All sticker packs, No watermark, 4K export.
Price card: "One-time $2.99 · lifetime" selected (violet border). 
Primary button "Unlock Pro", small text "Restore purchase" and "Terms · Privacy". Close X top-left.
```

## 19. Settings
```
[Global Style Block]
Screen: Settings.
List sections: 
  General — Theme (Dark/Light/System), Default export format, Save original copy toggle.
  Pro — "Upgrade to Pro" row with crown icon and chevron.
  Ads & Privacy — "Ad personalisation / GDPR consent" (opens UMP form), Privacy policy, Terms.
  About — Version 1.0.0, Rate app, Share app, Contact.
Bottom: AdMob Banner 320x50 (hidden for Pro users – add a tiny caption).
```

## 20. App Icon
```
Design an Android adaptive app icon for a photo editor app "[APP NAME]".
Foreground: two overlapping rounded photo frames with a small brush stroke across them, 
violet (#7C4DFF) to cyan (#00E5FF) gradient, white highlights.
Background: dark navy #1A1A2E. Flat, Material You style, works in circle, squircle and rounded-square masks.
Provide 512x512 Play Store icon and adaptive foreground/background layers.
```

## 21. Play Store Feature Graphic & Screenshots
```
Design a Google Play feature graphic 1024x500 for "[APP NAME]" photo editor: 
dark gradient background, phone mockup showing the Editor screen with layers, 
headline "Merge · Layer · Draw", small "Free" badge.
Then 6 Play Store screenshots 1080x1920, each a phone mockup with a 3–5 word caption at top:
"Merge photos in seconds", "Layer photo on photo", "Draw with neon brushes", 
"Pro filters", "Add text & stickers", "Export in 4K".
```

---

## Ad placement summary (for the designer and the developer)

| Screen | Ad unit | Rule |
|---|---|---|
| Home | Anchored adaptive banner | Always (hidden for Pro) |
| Editor main | Anchored adaptive banner | Hidden while any tool panel is open |
| Export | Anchored adaptive banner | Always (hidden for Pro) |
| After Save | Interstitial | Every 3rd save, min 2 min apart |
| Export success | Native ad (medium) | Always (hidden for Pro) |
| Filters / Stickers Pro packs | Rewarded video | On demand, unlocks pack 24h |
| Settings | Anchored adaptive banner | Always (hidden for Pro) |
