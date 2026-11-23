# Glow release checklist

For the app owner. Work through it top to bottom before the first Play Store release (and
re-check the per-feature tests before every release). Items marked **(engineer)** need someone
comfortable with a terminal; everything else is done in a browser.

## 1. Brand and store assets

- [ ] Put the final app icon (1024×1024 PNG, no transparency at the edges) at
      `resources/icon.png`. **(engineer)** Run `npm run assets`, then build and check the icon on a
      phone (round and square launchers, light and dark wallpaper).
- [ ] Store listing: app name, short and full description, feature graphic (1024×500), phone
      screenshots. Use the boards in the design pack (`Glow-Design/images/`) as the basis, but
      screenshots must show the real app, so take them from a release build on a 412×915-like phone.
- [ ] Privacy policy and terms of service pages are live (HTTPS) on your website.
      The policy must cover: Google AdMob and the advertising ID, the consent message (UMP),
      photo uploads for cloud AI (only on tap, deleted after processing, which AI provider),
      Google Play purchases, the anonymous installation ID, Android backup of projects.
      Hand [privacy-policy-inputs.md](privacy-policy-inputs.md) to whoever writes it.

## 2. Accounts, IDs and secrets

- [ ] AdMob: create the Android app and 4 ad units (banner, interstitial, rewarded, native
      advanced). In Privacy & messaging, create and **publish** the GDPR message and the US
      states message. Link the AdMob app to the Play listing once the app is published.
- [ ] Publish `app-ads.txt` (from AdMob) at the root of the developer website shown in Play
      Console, e.g. `https://your-site.example/app-ads.txt`.
- [ ] GitHub → repository → Settings → Environments → `production` → secrets:
      `GLOW_ADMOB_APP_ID`, `GLOW_ADMOB_BANNER_ID`, `GLOW_ADMOB_INTERSTITIAL_ID`,
      `GLOW_ADMOB_REWARDED_ID`, `GLOW_ADMOB_NATIVE_ID`, `GLOW_PRIVACY_POLICY_URL`,
      `GLOW_TERMS_URL`, `GLOW_KEYSTORE_BASE64`, `GLOW_KEYSTORE_PASSWORD`, `GLOW_KEY_ALIAS`,
      `GLOW_KEY_PASSWORD`. Never put any of these in the code or in a chat.
- [ ] **(engineer)** Create the upload keystore once, store it and its passwords in a password
      manager plus an offline backup, base64 it into `GLOW_KEYSTORE_BASE64`. Never commit it:

      ```bash
      keytool -genkeypair -v -keystore glow-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias glow
      ```

- [ ] Play Console: create the app (`com.nadev.glow`), enrol in **Play App Signing** (Google
      keeps the app signing key; your keystore becomes the upload key).
- [ ] Play Console → Monetise → In-app products: create the one-time product
      `glow_pro_lifetime`, set the real price (the design's $2.99 is a placeholder), activate it.
- [ ] Play Console → Settings → License testing: add the Google accounts of your testers.
- [ ] Pick the final Pro price and the native ad copy (open decisions).

## 3. Backend (AI proxy)

- [ ] The proxy is deployed at `https://glow-api.xenex-media.com.au` and follows
      [ai-proxy-contract.md](ai-proxy-contract.md): every cloud feature slug works, job polling,
      result download, error codes, rate limits per installation ID **and per IP**, daily spend
      kill switch.
- [ ] Privacy promises are true on the server: uploads, masks and results deleted within 1 hour,
      no training, minimal logs, AI provider set to zero data retention where possible.
- [ ] `/catalog/themes.json` and `/catalog/flags.json` are served (and match the copies bundled
      in `public/catalog/`). To switch a cloud feature off without an app update, set it to
      `false` in `flags.json`.

## 4. Build and upload

- [ ] **(engineer)** Bump `version` in `package.json`, run `npm run version:sync`, commit, tag
      `vX.Y.Z`, push. The "Release (Android AAB)" workflow builds and signs the AAB.
- [ ] Download the `glow-release-aab` artifact and upload it to **Internal testing** in Play
      Console. Add testers, open the opt-in link on each tester's phone, install from Play.
- [ ] Billing only works in that Play-installed build (not a sideloaded APK).

## 5. Play Console forms

- [ ] **Data safety**: answer from the table in the README ("Play Console: Data safety").
      Yes to: photos (cloud AI, not shared), device IDs (advertising ID via AdMob; installation
      ID), purchase history, app interactions and diagnostics (AdMob SDK). Encrypted in transit:
      yes. No account, so no account deletion.
- [ ] **Advertising ID** declaration: yes, used for advertising (AdMob).
- [ ] **Ads**: yes, the app contains ads.
- [ ] **Content rating** questionnaire (photo editor, no user-to-user content, no gambling).
- [ ] **Target audience**: 13+ or 18+ only; do **not** select ages under 13. The app is not
      child-directed (AdMob requests say so).
- [ ] **App access**: all features available without login.
- [ ] Privacy policy URL in the store listing (same URL as the secret).

## 6. Content checks

- [ ] Passport photo, Pakistan preset: 35 × 45 mm, white background, head height target 33 mm
      is **unverified** (the official DGIP page could not be read). Check against
      onlinemrp.dgip.gov.pk or a passport office, and re-check UK, US and Schengen rules.
- [ ] An open-source licences screen (Apache 2.0 notice for the MediaPipe models, Roboto
      licence) exists in the app. **(engineer: not built yet.)**
- [ ] Bundled stickers, skies and fonts are original or properly licensed (they are generated in
      `scripts/`; Roboto licence in `public/fonts/`).

## 7. Device test matrix

Test the Play-installed internal testing build on:

| Device                     | Why                                              |
| -------------------------- | ------------------------------------------------ |
| Android 8.0 (API 26)       | minimum version; old save path (asks permission) |
| Android 10 (API 29)        | first version with MediaStore saving             |
| Android 13 (API 33)        | photo permission split (READ_MEDIA_IMAGES)       |
| Android 14 (API 34)        | "Select photos" partial access                   |
| Android 16 (API 36)        | target version: edge-to-edge, predictive back    |
| A 3–4 GB RAM phone         | memory: large photos, AI tools, collage          |
| Any phone with TalkBack on | accessibility pass (every button is announced)   |

## 8. What to verify per feature

On each device above (the full list on at least one, the starred items on all):

- [ ] \* First launch: splash, onboarding once, ad consent message appears before any ad.
- [ ] \* Pick a photo (all photos, an album, "Select photos" on Android 14), take a photo with
      the camera, and deny each permission once (the app explains and recovers).
- [ ] Editor: crop, adjust, filters, draw, layers (reorder), collage, text (keyboard does not
      cover the input), stickers; undo/redo; leave and reopen from Recent projects.
- [ ] \* Export: JPEG and PNG, each size preset; the photo appears in the gallery album "Glow";
      share to another app; free users see the watermark, Pro users don't.
- [ ] On-device AI (works in airplane mode): remove background (+ HD cutout via ad), colour
      boost, natural beauty, replace sky, portrait blur, passport photo, relight, sticker maker,
      one-tap themes.
- [ ] Sticker maker → "Add to WhatsApp" (WhatsApp and WhatsApp Business), pack appears in
      WhatsApp.
- [ ] Cloud AI: enhance (2× and 4× via ad), hairstyle, remove people, restore, cartoon,
      expand, remove text, headshot. One-time upload notice on first use; credits go down only
      on success; airplane mode shows a clear error and keeps the credit.
- [ ] \* Ads: banner on Home, Editor, Export, Themes, Settings and never over the photo or
      buttons; interstitial after every 3rd save at most every 2 minutes; rewarded ads unlock
      packs for 24 h; native ad on the export success screen. Settings → "Ad personalisation"
      reopens the consent form (EU tester; the row only shows where the law requires it).
- [ ] \* Glow Pro: buy with a licence tester, ads and watermark disappear; uninstall,
      reinstall, Pro is restored automatically; refund in Play Console, Pro goes away on resume.
- [ ] \* Back button / back gesture: closes open panels and dialogs first, then goes back,
      exits only from Home.
- [ ] Theme: Dark, Light, System; status bar icons readable in each.
- [ ] Settings: version number, privacy policy and terms open in the browser.
- [ ] New phone: back up (Settings → Google → Backup), restore on a second phone: Recent
      projects come back; credits, unlocks and ad consent do not; Pro comes back from Play.
- [ ] TalkBack: every screen can be used without looking; buttons have names; dialogs keep
      focus inside.
