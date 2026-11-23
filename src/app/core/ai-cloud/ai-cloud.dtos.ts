/**
 * Wire format of the cloud AI proxy (see doc/ai-proxy-contract.md).
 *
 * SPEC-GIVEN: `POST /ai/{feature}` (multipart: `image` + `options`) → AiSubmitResponseDto and
 * `GET /ai/jobs/{jobId}` → AiJobStatusDto. Everything else here (the error body, the `mask`
 * part and every per-feature options DTO) is PROPOSED, version 1: confirm with the backend
 * before changing. Unknown response fields are ignored; options the server does not know must
 * be ignored by the server, so additive options need no version bump.
 */

export interface AiSubmitResponseDto {
  /** Opaque, URL-safe id: `[A-Za-z0-9_-]{1,128}`. */
  readonly jobId: string;
}

export type AiJobStatusValue = 'queued' | 'running' | 'done' | 'failed';

export interface AiJobStatusDto {
  readonly status: AiJobStatusValue;
  /** `done` only: same-origin result URL (absolute or root-relative), under `/ai/`. */
  readonly resultUrl?: string;
  /** `failed` only: short, user-safe English sentence. */
  readonly error?: string;
}

/** PROPOSED: body of every 4xx/5xx response. */
export interface AiErrorBodyDto {
  /** Machine-readable, kebab-case, e.g. `feature-disabled`, `no-credits`, `no-face-found`. */
  readonly code: string;
  /** Short, user-safe English sentence. */
  readonly message: string;
  /** 429/503: seconds to wait (mirrors the `Retry-After` header). */
  readonly retryAfterSec?: number;
}

/** PROPOSED. Board 24: `scale` 1 is "Off" (clean-up only, same size). */
export interface EnhanceOptionsDto {
  readonly scale: 1 | 2 | 4;
  readonly sharpen: boolean;
  readonly denoise: boolean;
  readonly fixLighting: boolean;
  readonly restoreFaces: boolean;
}

/**
 * PROPOSED. Boards 26 and 32: `auto` lets the server find people / text; `mask` sends a `mask`
 * part (PNG, same size as `image`, white = remove, black = keep).
 */
export interface RemoveObjectsOptionsDto {
  readonly detect: 'auto' | 'mask';
}

export type ExpandAspectDto = '9:16' | '1:1' | '16:9' | 'wallpaper';

/** PROPOSED. Board 31: target aspect, or explicit margins as fractions of the image size. */
export interface ExpandOptionsDto {
  readonly aspect?: ExpandAspectDto;
  readonly margins?: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  /** Optional description of the new content ("more sea and sky"), ≤ 200 chars. */
  readonly prompt?: string;
}

/**
 * PROPOSED. Board 29 (toggles in board order: Fix scratches & tears, always on server-side;
 * Colourise; Sharpen faces; Remove fading). `strength` 0-100. An omitted flag means `false`.
 */
export interface RestoreOptionsDto {
  readonly colorize?: boolean;
  readonly strength?: number;
  readonly sharpenFaces?: boolean;
  readonly removeFading?: boolean;
}

/**
 * PROPOSED. Board 30: `style` is a server catalog id (e.g. `toon-3d`, `anime`); `likeness`
 * 0-100 (integer; how closely the result keeps the face, server default 70).
 */
export interface CartoonOptionsDto {
  readonly style: string;
  readonly likeness?: number;
}

/** PROPOSED. Board 25: `style` id (`bob`, `pixie`...), `colour` `#RRGGBB`, `length` 0-100. */
export interface HairstyleOptionsDto {
  readonly style: string;
  readonly colour?: string;
  readonly length?: number;
}

/** PROPOSED. Board 34: background id (`studio-grey`...), outfit id (`blazer`, `keep`...). */
export interface HeadshotOptionsDto {
  readonly style: string;
  readonly background?: string;
}

/** Options DTO per feature slug. */
export interface AiCloudOptionsDtoMap {
  readonly enhance: EnhanceOptionsDto;
  readonly 'remove-people': RemoveObjectsOptionsDto;
  readonly 'remove-text': RemoveObjectsOptionsDto;
  readonly expand: ExpandOptionsDto;
  readonly restore: RestoreOptionsDto;
  readonly cartoon: CartoonOptionsDto;
  readonly hairstyle: HairstyleOptionsDto;
  readonly headshot: HeadshotOptionsDto;
}
