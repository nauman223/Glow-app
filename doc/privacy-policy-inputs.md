# Privacy policy inputs (facts, not legal text)

What Glow (Android, `com.nadev.glow`) does with data, for whoever writes the privacy policy and
fills in the Play Data safety form. Each line was checked against the code on 2026-11-20 (file
references in brackets). Items marked **OPEN** must be confirmed by the owner before publishing.

## Summary

- No accounts, no sign-in, no names, emails or phone numbers are collected.
- No analytics or crash reporting SDK of Glow's own. App logs stay on the device
  (`core/logging/logger.service.ts`; production logs warnings and errors only).
- Photos are processed on the device, except for the **cloud AI** tools, which upload one photo
  only when the user taps the tool's button.
- Third parties that receive data: Google (AdMob ads, consent, Play Billing), the developer's own
  AI proxy and the AI provider(s) behind it (**OPEN**). WhatsApp receives stickers only when the
  user adds a pack.

## Data inventory

| Data                                                                            | Where it goes                                                | Why                                                       | When                                                              | Retention                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Photos the user picks or takes                                                  | Stay on the device                                           | Editing                                                   | Always                                                            | Until the user deletes the project / photo                                             |
| Photo for a cloud AI tool                                                       | Glow AI proxy (`glow-api.xenex-media.com.au`)                | Run the AI edit (enhance, restore, ...)                   | Only after the user taps the tool's button                        | Proxy contract: deleted within 1 hour, no training, no backups of image data           |
| Mask / options for that job                                                     | Same proxy, same request                                     | Tell the AI what to edit                                  | Same                                                              | Same                                                                                   |
| Installation ID (random UUID)                                                   | Glow API host only (AI jobs and catalog files)               | Rate limiting / abuse prevention                          | Every request to the Glow API host                                | On the device until uninstall; server retention: **OPEN** (contract allows it in logs) |
| IP address, request time, sizes                                                 | Glow API host (inherent to any HTTPS request)                | Delivery, abuse prevention                                | Every request to the Glow API host                                | **OPEN** (contract: no full IPs in logs beyond abuse prevention needs)                 |
| Advertising ID, device and app info, IP, ad interactions, diagnostics           | Google AdMob (Google Mobile Ads SDK) and UMP                 | Show and measure ads, frequency capping, fraud prevention | Free users, after the consent step; never requested for Pro users | Google's policies                                                                      |
| Consent choices (GDPR / US states)                                              | Google UMP, stored on the device                             | Ad consent                                                | Before the first ad (free users)                                  | On the device; reopened from Settings → "Ad personalisation" where required            |
| Purchase of Glow Pro (order, token)                                             | Google Play Billing                                          | Sell and verify the one-time purchase                     | When the user buys or the app re-checks Pro                       | Google Play; the app keeps only a cached "is Pro" flag                                 |
| Stickers the user makes                                                         | Device; WhatsApp reads them via a local provider             | WhatsApp sticker export                                   | Only when the user taps "Add to WhatsApp"                         | On the device until the pack is deleted; in WhatsApp per WhatsApp's policies           |
| Projects (Recent projects)                                                      | Device; Android Auto Backup to the user's own Google account | Restore on a new phone                                    | Android's backup schedule, if the user has backup on              | User's Google backup (Glow cannot read it)                                             |
| Settings (theme, onboarding done, credits, rewarded unlock expiries, ad pacing) | Device only (not backed up)                                  | App behaviour                                             | Always                                                            | Until uninstall                                                                        |

## Details

### Cloud AI uploads

- Features: enhance, hairstyle, remove people, restore, cartoon, expand, remove text, headshot
  (`features/ai/ai.routes.ts`, `data.cloudFeature`).
- What is sent: the photo re-encoded as JPEG (max 1.5 MP, quality 0.9), so **no EXIF metadata
  (no GPS, no camera data)**; for some tools a black-and-white PNG mask; a small JSON of options
  (`core/ai-cloud/ai-cloud.service.ts`, `ai-cloud-image.ts`). Header `X-Installation-Id`.
- When: only after the user taps the action button; a one-time notice explains the upload first
  (`features/ai/_cloud/cloud-upload-notice.service.ts`).
- Transport: HTTPS only (Android blocks cleartext; the web CSP allows only the two Glow API hosts).
- The app logs only feature, duration, bytes uploaded and outcome, on the device.
- Server side (the developer's proxy, `doc/ai-proxy-contract.md` section 9): delete uploads,
  masks and results as soon as the job is done and in any case within 1 hour; no training by the
  developer or the AI provider; minimal logs.
- **OPEN**: which AI provider(s) the proxy uses, their country / data location, and whether
  zero-retention terms are in place. The policy must name them.

### Installation ID

- A random UUID made on the device on first use (`crypto.randomUUID`), stored in app
  preferences (`core/installation/installation-id.service.ts`). Not linked to the advertising ID,
  the Google account or any personal data.
- Sent only to the Glow API host, never to other hosts
  (`core/http/interceptors/installation-id.interceptor.ts`).
- Purpose: per-install rate limits and credit checks on the AI proxy.
- Reset by uninstalling or clearing app data. Not backed up (deliberately).

### Advertising (Google AdMob, UMP)

- Google Mobile Ads SDK (`@capacitor-community/admob`): banner, interstitial, rewarded and native
  ads for free users. The Android manifest includes the `AD_ID` permission (from the SDK).
- The consent form (Google UMP) is requested before ads load; ad requests are tagged as **not
  child-directed** and **not under the age of consent** (`core/ads/ads-runtime.service.ts`).
- Pro users: once Google Play has confirmed Pro (or the cached Pro flag says so), the app does
  not initialise ads or request consent. On a fresh install, ads can start before the first
  store check finishes. The SDK is part of every build, and its startup provider runs when the
  app starts (standard for the SDK).
- Data collected by the SDK is as described in Google's "Google Mobile Ads SDK data disclosure"
  (advertising ID, IP, app and device info, ad interactions, diagnostics). Link to Google's
  policy (`https://policies.google.com/technologies/partner-sites`).

### Purchases (Google Play Billing)

- One-time product `glow_pro_lifetime` through `@capgo/native-purchases`. Payment details are
  handled by Google Play; the app never sees them.
- The app asks Play for owned purchases on start and on resume, and acknowledges new purchases.
  It stores only a cached "Pro" flag on the device; the store is the source of truth.

### WhatsApp stickers

- Sticker packs are written to app-internal storage. An Android content provider lets **only
  WhatsApp** (permission `com.whatsapp.sticker.READ` plus a caller check) read the pack, after the
  user taps "Add to WhatsApp" and confirms in WhatsApp. Nothing is sent to WhatsApp's servers by
  Glow itself.

### Device permissions

| Permission                                 | Used for                                         | When asked                  |
| ------------------------------------------ | ------------------------------------------------ | --------------------------- |
| Photos (`READ_MEDIA_IMAGES`, 14+ partial)  | Show the user's photos in the picker             | When the picker opens       |
| Storage read (Android 12 and lower)        | Same, on older Android                           | When the picker opens       |
| Storage write (Android 8–9 only)           | Save the edited photo to the Pictures/Glow album | At the first save           |
| Camera                                     | Take a photo to edit                             | When "Take photo" is tapped |
| Internet, network state                    | Cloud AI, catalog, ads, billing; offline banner  | Not a prompt                |
| Billing                                    | Glow Pro purchase                                | Not a prompt                |
| Advertising ID (`AD_ID`, from the ads SDK) | Ads                                              | Not a prompt                |
| Vibrate                                    | Haptic feedback                                  | Not a prompt                |

### Remote content the app downloads

- `GET /catalog/themes.json` and `/catalog/flags.json` from the Glow API host (themes, feature
  switches, ad pacing). Carries the installation ID header like any Glow API request.
- No other remote code or content; fonts, models and stickers ship inside the app.

### Children

- Not designed for children; Play target audience should exclude under-13s. Ad requests are
  tagged not child-directed.

### User rights / deletion

- No account exists. Uninstalling or "Clear storage" removes all local data, the installation ID
  and cached settings. Cloud uploads are deleted automatically by the proxy. Purchases are
  managed in Google Play. Saved photos in Pictures/Glow are ordinary gallery photos the user can
  delete.
- **OPEN**: a contact email for privacy requests (required by Play).
