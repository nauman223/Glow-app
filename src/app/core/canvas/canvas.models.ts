import { type ImageSize, type PreparedImage } from '@core/image/image.models';
import type * as FabricNamespace from 'fabric';
import type { Canvas, FabricImage } from 'fabric';

/** Type of the lazily imported Fabric module (types only: no runtime import at module level). */
export type FabricModule = typeof FabricNamespace;

/** On-screen size of the canvas element, in CSS pixels. */
export type Viewport = ImageSize;

declare const snapshotBrand: unique symbol;

/**
 * Serialized document state as an immutable JSON string. Adjacent history commands share the
 * same string instance (one command's "after" is the next one's "before"), so a 30-step history
 * costs about 31 snapshots, each a few KB: image pixels are never embedded (see CanvasService).
 */
export type CanvasSnapshot = string & { readonly [snapshotBrand]: true };

/** What tool services get: the canvas plus helpers that keep CanvasService's invariants. */
export interface CanvasContext {
  readonly canvas: Canvas;
  /** The Fabric module, so tools can build objects without importing Fabric themselves. */
  readonly fabric: FabricModule;
  /** Document size in scene units (prepared pixels of the base image). */
  readonly documentSize: ImageSize;
  /** Original pixel size the document maps to, for full-resolution export. */
  readonly sourceSize: ImageSize;
  /** For tools that change the document bounds (crop, expand). */
  readonly resizeDocument: (documentSize: ImageSize, sourceSize: ImageSize) => void;
  /** The only sanctioned way to create image objects (keeps `src` a registered blob: URL). */
  readonly createImage: (image: PreparedImage) => Promise<FabricImage>;
  /** Loads a bundled app image (only `/stickers/…` paths; anything else rejects). */
  readonly createStaticImage: (path: string) => Promise<FabricImage>;
}

export type CanvasMutation = (context: CanvasContext) => void | Promise<void>;

/**
 * `base`: the locked photo; `layer`: an added photo; `stroke`: a free-drawing path (the only
 * objects the Draw eraser may remove); `text` and `sticker`: Text and Stickers tool objects;
 * `frame`: a collage cell frame or border (never listed as a layer, erased or edited).
 */
export const CANVAS_OBJECT_ROLES = ['base', 'layer', 'stroke', 'text', 'sticker', 'frame'] as const;
export type CanvasObjectRole = (typeof CANVAS_OBJECT_ROLES)[number];
