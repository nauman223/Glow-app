/**
 * Public types of the on-device AI engine. Shared by the main thread and the vision worker, so
 * this file must stay free of Angular, DOM-only APIs and MediaPipe imports.
 */

/**
 * - `person`: everyone in the photo (selfie segmenter, fast).
 * - `person-parts`: selected parts of people (multiclass segmenter: hair, skin, clothes...).
 * - `object-at-point`: the object under one or more tapped points (MagicTouch).
 * - `sky`: automatic sky selection (MagicTouch prompted in the sky + colour refinement).
 * - `auto`: the main subject, any of the 20 PASCAL VOC classes (DeepLab v3), falling back to the
 *   object at the image centre when nothing is found.
 */
export type SegmentMode = 'person' | 'person-parts' | 'object-at-point' | 'sky' | 'auto';

export const PERSON_PARTS = ['hair', 'body-skin', 'face-skin', 'clothes', 'accessories'] as const;
export type PersonPart = (typeof PERSON_PARTS)[number];

/** Model files bundled under `public/models` (see MODELS.md). */
export type VisionModelId = 'selfie' | 'selfie-multiclass' | 'deeplab' | 'magic-touch' | 'face';

export type VisionDelegate = 'GPU' | 'CPU';

/** A point in normalized image coordinates (0-1, origin top-left). */
export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in normalized image coordinates. */
export interface NormalizedRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface SegmentOptions {
  readonly mode: SegmentMode;
  /** `object-at-point` only (required, 1 or more): the tapped point(s). */
  readonly points?: readonly NormalizedPoint[];
  /** `person-parts` only: parts to include; defaults to every part (the whole person). */
  readonly parts?: readonly PersonPart[];
  /** Edge feather radius in OUTPUT pixels (0 = none). Default 2. */
  readonly featherPx?: number;
  /**
   * Optional 0-1 confidence threshold: edges are hardened around it (smoothstep) before the
   * feather. `null` or absent keeps the model's soft confidence.
   */
  readonly threshold?: number | null;
}

/**
 * A segmentation mask at the INPUT image's resolution: white pixels whose alpha is the
 * confidence (0-255). Use it directly with Canvas 2D compositing (`destination-in`, etc.).
 * The receiver owns `bitmap` and must `close()` it when done.
 */
export interface AiMask {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
  /** Mean confidence over the image (0-1); ~0 means nothing was found. */
  readonly coverage: number;
  /** Bounding box of the pixels with confidence ≥ 0.5, or `null` when there are none. */
  readonly bounds: NormalizedRect | null;
  readonly model: VisionModelId;
  readonly delegate: VisionDelegate;
  readonly durationMs: number;
}

export interface FaceLandmarksOptions {
  /** 1-5. Default 1. */
  readonly maxFaces?: number;
}

/** Number of landmarks per face (MediaPipe Face Mesh V2: 468 mesh points + 10 iris points). */
export const FACE_LANDMARK_COUNT = 478;

export interface DetectedFace {
  /** `x, y, z` triples (FACE_LANDMARK_COUNT of them), normalized like MediaPipe's landmarks. */
  readonly landmarks: Float32Array;
  /** Bounding box of the landmarks, clamped to the image. */
  readonly box: NormalizedRect;
}

export interface FaceLandmarksResult {
  readonly faces: readonly DetectedFace[];
  readonly width: number;
  readonly height: number;
  readonly delegate: VisionDelegate;
  readonly durationMs: number;
}

export type VisionOp = 'segment' | 'face-landmarks';

/** Coarse progress, enough for an accessible status line ("Loading the AI model…"). */
export type AiProgressStage = 'starting' | 'loading-model' | 'inferring' | 'refining';

export interface AiProgress {
  readonly op: VisionOp;
  readonly stage: AiProgressStage;
}

/**
 * - `unsupported`: the device lacks a required capability (Web Worker, OffscreenCanvas, WASM).
 * - `model-load-failed`: the runtime or a model file could not be loaded (corrupt install).
 * - `inference-failed`: the model ran and failed (GPU and CPU both tried).
 * - `invalid-input`: bad options or an empty image.
 * - `cancelled`: aborted by the caller or superseded by a newer call of the same op.
 * - `worker-failed`: the worker crashed (often out of memory); the next call starts a new one.
 */
export type AiLocalErrorCode =
  | 'unsupported'
  | 'model-load-failed'
  | 'inference-failed'
  | 'invalid-input'
  | 'cancelled'
  | 'worker-failed';
