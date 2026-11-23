# Glow cloud AI proxy: API contract (v1)

For the backend developers who build the Glow AI proxy (for example a Cloudflare Worker or a
Firebase Function). The Glow app (Android first, iOS buildable) is already built against this
contract. AI provider keys live **only** in the proxy, never in the app.

Every item is marked:

- **SPEC**: given by the product spec; do not change it without the app team.
- **PROPOSED**: designed by the app team for v1. The app already sends or expects it. Send
  objections before launch; after launch, changes must stay backwards compatible.

App-side code: `src/app/core/ai-cloud/` (DTOs in `ai-cloud.dtos.ts`, rules in
`ai-cloud.mappers.ts` and `ai-cloud.errors.ts`) and `src/app/features/ai/_cloud/`.

## 1. Hosts

| Environment | Base URL (SPEC)                               |
| ----------- | --------------------------------------------- |
| Development | `https://glow-api-dev.xenex-media.com.au`     |
| Production  | `https://glow-api.xenex-media.com.au`         |

- HTTPS only (TLS 1.2+). The app blocks cleartext and only connects to these two hosts (its CSP).
- The same host also serves the static catalog `GET /catalog/themes.json` and
  `GET /catalog/flags.json` (SPEC; format in `src/app/core/catalog/catalog.dtos.ts`).

## 2. Request headers

| Header              | Sent on               | Status   | Meaning                                                    |
| ------------------- | --------------------- | -------- | ---------------------------------------------------------- |
| `X-Installation-Id` | every request         | SPEC     | Anonymous random UUID v4 per install. Rate limits and credits are keyed on it. No accounts. |
| `Content-Type`      | `POST /ai/{feature}`  | SPEC     | `multipart/form-data; boundary=…`                          |
| `Accept`            | every request         | -        | `application/json, text/plain, */*` (browser default)      |

The installation id is not secret and can be forged; treat it as a rate-limit key only.

**PROPOSED, not sent by app v1:** `X-Glow-Pro-Token: <Google Play purchase token>` for the one-time
product `glow_pro_lifetime`. The proxy would verify it with the Google Play Developer API
(`purchases.products.get`, package `com.nadev.glow`) and cache the answer per token. Until it
exists, the server cannot tell Pro users apart, so give every installation the same server limit
and keep it generous enough for Pro fair use (30 jobs a day, see §8).

## 3. Endpoints

### 3.1 Submit a job: `POST /ai/{feature}` (SPEC)

Multipart form fields:

| Part      | Status   | Content                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------- |
| `image`   | SPEC     | `image.jpg`, `image/jpeg`, **≤ 1.5 megapixels** (long side about 1500 px), quality 0.9, sRGB, no EXIF, no transparency (filled white). |
| `options` | SPEC     | Text field: a JSON object, see §4. Unknown keys must be ignored.                   |
| `mask`    | PROPOSED | `mask.png`, `image/png`, exactly the size of `image`, opaque: white (255) = area to edit/remove, black (0) = keep. Only for `remove-people` / `remove-text` with `"detect": "mask"`. |

Response `202 Accepted` (or `200`), JSON (SPEC):

```json
{ "jobId": "j_7Qm2vX9c" }
```

`jobId` must match `^[A-Za-z0-9_-]{1,128}$` (the app puts it into the URL as is and refuses
anything else). Make it unguessable (at least 96 random bits) and bind it to the submitting
installation id.

The app sends this request **once**: it never retries a POST (a retry could run and bill a job
twice). Timeout on the app side: 60 s for the whole upload and response.

`{feature}` slugs (decided 2026-11-17):

| Slug            | Board | Feature                    |
| --------------- | ----- | -------------------------- |
| `enhance`       | 24    | Improve photo quality / upscale |
| `hairstyle`     | 25    | Hairstyle try-on           |
| `remove-people` | 26    | Remove people              |
| `restore`       | 29    | Restore old photos         |
| `cartoon`       | 30    | Cartoon yourself           |
| `expand`        | 31    | Expand (outpaint)          |
| `remove-text`   | 32    | Remove text / date stamps  |
| `headshot`      | 34    | Professional headshot      |

### 3.2 Job status: `GET /ai/jobs/{jobId}` (SPEC)

```json
{ "status": "queued" }
{ "status": "running" }
{ "status": "done", "resultUrl": "/ai/jobs/j_7Qm2vX9c/result" }
{ "status": "failed", "error": "We couldn't find a face in this photo." }
```

- `status`: `queued` | `running` | `done` | `failed` (SPEC). Anything else is treated as an
  invalid response.
- `resultUrl`: required when `done` (see §5).
- `error`: optional when `failed`; a short, **user-safe English sentence** (the app shows it).
  Never put stack traces, provider names or internal ids in it.
- Send `Cache-Control: no-store`.
- Unknown or expired job (or a job of another installation): `404` (the app shows "the AI
  couldn't finish").

### 3.3 Result download: `GET {resultUrl}` (PROPOSED: `GET /ai/jobs/{jobId}/result`)

- Body: the image bytes. `Content-Type`: `image/jpeg`, `image/png` (use PNG only when the
  result needs transparency) or `image/webp`. Anything else is refused.
- Limits the app enforces: ≤ 40 MB and ≤ 64 megapixels decoded. A 4× upscale of a 1.5 MP upload
  is 24 MP: use JPEG quality around 0.9 for it.
- Short-lived: available for at least 10 minutes after `done`, deleted within 1 hour.
- Same `X-Installation-Id` check as the status endpoint. `Cache-Control: private, no-store`.

### 3.4 Cancelling

The app cancels by aborting its requests (the user tapped Cancel, or left the screen). It does
not call a cancel endpoint in v1. **PROPOSED for later:** `DELETE /ai/jobs/{jobId}` → `204`, to
stop paid provider work early.

## 4. Options per feature (all PROPOSED)

`options` is always a JSON object. Ids such as styles are validated server-side; an unknown id
returns `422` with `code: "invalid-option"`.

| Feature         | Options                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `enhance`       | `{ "scale": 1 \| 2 \| 4, "sharpen": bool, "denoise": bool, "fixLighting": bool, "restoreFaces": bool }`. `scale: 1` = clean-up only, same size. 4× is a Pro / rewarded feature in the app. |
| `remove-people` | `{ "detect": "auto" \| "mask" }`: `auto` = the server finds people; `mask` = remove the white area of the `mask` part. |
| `remove-text`   | `{ "detect": "auto" \| "mask" }`: same for text, captions and date stamps.                       |
| `expand`        | `{ "aspect"?: "9:16" \| "1:1" \| "16:9" \| "wallpaper", "margins"?: { "top", "right", "bottom", "left" }, "prompt"?: string }`. Exactly one of `aspect` / `margins`. Margins are fractions of the image size (0–2). `wallpaper` = the phone's 9:19.5. `prompt` ≤ 200 chars, optional. Output: the original pixels centred, new content around them. |
| `restore`       | `{ "colorize"?: bool, "strength"?: 0–100, "sharpenFaces"?: bool, "removeFading"?: bool }` (default `false`, `60`, `false`, `false`). Scratch/tear repair is always on. Board 29 toggle order: Fix scratches & tears, Colourise, Sharpen faces, Remove fading; the app sends all three flags (board default `true`). |
| `cartoon`       | `{ "style": string, "likeness"?: 0–100 }`, e.g. `toon-3d`, `anime`, `comic`, `sketch` (server catalog). `likeness` (integer, default `70`): how closely the result keeps the face; 0 = loosest, 100 = closest. |
| `hairstyle`     | `{ "style": string, "colour"?: "#RRGGBB", "length"?: 0–100 }`, e.g. `bob`, `pixie`, `long-waves`, `curly`, `bun`. |
| `headshot`      | `{ "style": string, "background"?: string }`: outfit `blazer` \| `suit` \| `shirt` \| `keep`; background `studio-grey` \| `office` \| `outdoor` \| `navy` \| `warm`. One result per job in v1. |

Results should keep the input's aspect ratio (except `expand`) and be at least the input size
(`enhance`: input × `scale`).

## 5. `resultUrl` rule (PROPOSED, security, enforced by the app)

The app accepts a `resultUrl` **only** when, resolved against the base URL, it is:

1. on the **same origin** as the API base URL (`https`, same host, same port), and
2. its path starts with **`/ai/`**, and
3. it has no user name or password.

Root-relative (`/ai/jobs/j_1/result`) and same-origin absolute URLs are both fine. Anything else
(another host or a CDN, `//host/…`, `http:`, `data:`, signed storage URLs) is rejected as an
invalid result and the job fails. Reasons: the app's Content-Security-Policy only allows the API
hosts, the installation id must never be sent elsewhere, and the app must never fetch an
arbitrary host chosen by a response. To serve from storage, stream it through the proxy.

## 6. Errors

### 6.1 Error body (PROPOSED)

Every 4xx/5xx response is JSON:

```json
{ "code": "rate-limited", "message": "Too many requests. Please wait a minute.", "retryAfterSec": 60 }
```

- `code`: kebab-case `[a-z0-9-]{1,64}`.
- `message`: short, user-safe English. The app shows it for `400/401/403/415/422`, `402`, and as
  the `error` of a failed job; for other statuses it uses its own wording.
- `retryAfterSec`: for `429` / `503`; mirror it in the `Retry-After` header (seconds form).

### 6.2 Status codes and what the app does

| Status                         | When                                                     | App behaviour                                       |
| ------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `202`/`200`                    | accepted / status / result                               | continue                                            |
| `400`, `415`, `422`            | bad image or options (`invalid-image`, `invalid-option`, `no-face-found`) | "This photo can't be processed" + server message; no retry button |
| `401`, `403`                   | missing/blocked installation id                          | same as above                                       |
| `402`                          | no server-side credits / fair use left (`no-credits`)    | "No credits left" + server message                  |
| `404` on `POST /ai/{feature}`  | unknown feature slug, or not deployed                    | "Cloud AI isn't available right now", retry         |
| `404`/`410` on jobs/result     | job unknown, expired or of another installation          | "The AI couldn't finish", retry                     |
| `413`                          | upload too large                                         | "This photo is too large"                           |
| `429`                          | rate limited                                             | "Please wait N s and try again" (from `Retry-After`) |
| `500`                          | unexpected error                                         | "The AI couldn't finish", retry                     |
| `502`, `503`, `504`, `501`, `405` | provider down, **feature switched off** (use `503` with `code: "feature-disabled"`), maintenance | "Cloud AI isn't available right now", retry |
| network error / DNS failure    | host unreachable while the phone is online              | "Cloud AI isn't available right now", retry         |

Polls and downloads (GET) are retried by the app on network errors, timeouts and 5xx (up to 3
attempts, exponential backoff); 4xx is never retried. **A failed, cancelled or timed-out job never
costs the user a credit in the app**; do the same server-side (see §8).

## 7. Timing (SPEC)

- Upload + submit response: within **60 s** (app timeout).
- The app polls `GET /ai/jobs/{id}` **every 2 s**, starting 2 s after the submit response.
- It gives up **120 s** after the submit response (the user sees "This is taking too long").
  Jobs should normally finish in **10–20 s** (the app tells the user "Usually 10–20 s").
- Each poll and the download have their own app timeout (15 s per poll, 60 s for the download).
- When the user cancels or the app gives up, the job may still finish; discard its result on
  expiry and do not bill it.

## 8. Rate limiting and credits (REQUIRED before launch, server-side enforcement)

The app keeps a local credit balance (signed, but on the device): it is **only a UX hint**. A
rooted device, a changed clock or a hooked WebView can fake credits and rewarded-ad grants, and
anyone can script the proxy with random installation ids. Every AI job costs real money, so the
proxy **must** enforce limits itself before the app is released. The numbers below are
suggestions; the enforcement is not optional.

**Required (abuse and cost control, independent of the installation id):**

- Global daily spend budget per feature, with an automatic kill switch (`503 feature-disabled`)
  when it is reached.
- Per-IP (and ideally per-ASN) submit limits, so rotating installation ids gives no extra quota.
- Reject installation ids that aren't well-formed UUIDs; treat a never-seen id as a new, low-trust
  client (strict limits until it has history).
- **Recommended:** Google Play Integrity attestation bound to the installation id, verified on
  submit. The app doesn't send it in v1; add it to the app before relying on it.

**Per installation id:**

- Free installation: credits are earned only by rewarded ads, at most `credits.dailyEarnCap` (5)
  a local day (unspent credits carry over). Suggested server limit: 10 jobs/day, plus a burst
  limit (for example 3 submits a minute).
- Pro (once `X-Glow-Pro-Token` exists): `credits.proFairUseDailyCap` (30) jobs a day.
- `enhance` with `scale: 4` for free users is unlocked by a rewarded ad, which the server cannot
  verify in v1. **PROPOSED for later:** AdMob server-side verification (SSV) callbacks to issue
  a one-time grant per installation.
- Count a job against limits only when it reaches `done`. Failed jobs are free.
- Global kill switch per feature: set `aiFeatures.<slug>: false` in `/catalog/flags.json` (the
  app hides the feature and blocks its screen), and answer `503 feature-disabled` meanwhile for
  apps with an older copy of the flags.

## 9. Privacy obligations (SPEC + PROPOSED)

- The app uploads only after the user taps the feature's button, and shows a one-time notice:
  "Your photo is uploaded securely to process it and deleted afterwards." The proxy must make
  that true:
  - Delete uploads, masks and results as soon as the job is done and the result fetched, and in
    any case within **1 hour**. No backups of image data.
  - **No training** on user images, by you or the AI provider. Use provider settings / contracts
    with zero data retention where available; list the providers in the privacy policy.
  - Do not log image bytes, EXIF, prompts with personal data, or full IPs beyond what abuse
    prevention needs. Logs may hold: installation id (or a hash), feature, timings, sizes,
    outcome, status code.
- The app logs only `feature`, `durationMs`, `bytesUp`, `outcome`, never image data.

## 10. CORS (PROPOSED)

The app runs in a WebView, so every response (including errors) needs CORS headers for these
origins:

| Origin                  | Where                                            |
| ----------------------- | ------------------------------------------------ |
| `https://localhost`     | Android app (Capacitor)                          |
| `capacitor://localhost` | iOS app                                          |
| `http://localhost:4200` | developers' `ng serve` (development host only)   |

Preflight (`OPTIONS`): allow methods `GET, POST, OPTIONS` and request header `X-Installation-Id`
(`Content-Type: multipart/form-data` is a simple header). On every response send
`Access-Control-Allow-Origin: <the matching origin>`, `Vary: Origin` and
`Access-Control-Expose-Headers: Retry-After` (otherwise the app cannot read it). No cookies or
credentials are used.

## 11. Checklist for the proxy

- [ ] `POST /ai/{feature}` for the 8 slugs, multipart `image` + `options` (+ `mask`), returns `{ jobId }`.
- [ ] `GET /ai/jobs/{jobId}` returns the 4 statuses; `resultUrl` same origin under `/ai/`.
- [ ] Result endpoint serves `image/jpeg|png|webp`, short-lived, bound to the installation id.
- [ ] Error body `{ code, message, retryAfterSec? }`; `429` + `Retry-After`; `503 feature-disabled`.
- [ ] Per-installation rate limits and job counting on `done` only.
- [ ] Global daily spend budget per feature with an automatic kill switch, and per-IP limits
      (§8). Required before launch: installation ids can be forged.
- [ ] Uploads and results deleted within 1 hour; no training; minimal logs.
- [ ] CORS for `https://localhost`, `capacitor://localhost` (and `http://localhost:4200` on dev).
