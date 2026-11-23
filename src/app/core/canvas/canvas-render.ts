import type { FabricObject } from 'fabric';

import { type CanvasContext, type FabricModule } from './canvas.models';

/** Keeps float error from truncating the output one pixel short. */
const SIZE_PAD_PX = 0.25;

export interface DocumentRenderOptions {
  /** Output pixels per document pixel. */
  readonly scale: number;
  /**
   * Fill behind transparent areas (JPEG has no alpha), or `null` to keep transparency. Ignored
   * when the document has its own fill (CanvasService.newDocument).
   */
  readonly background: string | null;
}

function disableCaching(objects: readonly FabricObject[], fabric: FabricModule): () => void {
  const previous = new Map<FabricObject, boolean>();
  const visit = (object: FabricObject): void => {
    previous.set(object, object.objectCaching);
    object.objectCaching = false;
    if (object instanceof fabric.Group) {
      object.getObjects().forEach(visit);
    }
  };
  objects.forEach(visit);
  return () => {
    previous.forEach((caching, object) => {
      object.objectCaching = caching;
    });
  };
}

/**
 * Renders only the document region at `scale` into a new, detached canvas element. While it
 * renders, object caching is off (Fabric caps cache canvases at 4096 px per side, which would
 * blur large exports) and the on-screen clip mask is removed (the crop region does the same job
 * without Fabric's cached, resolution-limited mask). Everything is restored afterwards.
 */
export function renderDocument(
  context: CanvasContext,
  options: DocumentRenderOptions,
): HTMLCanvasElement {
  const { canvas, documentSize, fabric } = context;
  const zoom = canvas.getZoom();
  const [, , , , offsetX, offsetY] = canvas.viewportTransform;
  const clipPath = canvas.clipPath;
  const background = canvas.backgroundColor;
  const restoreCaching = disableCaching(canvas.getObjects(), fabric);
  canvas.clipPath = undefined;
  // A document fill (blank/collage document) already covers every pixel and must win.
  // (`backgroundColor` is '' by default and undefined after restoring a snapshot without one.)
  const ownFill = Boolean(background);
  if (options.background !== null && !ownFill) {
    canvas.backgroundColor = options.background;
  }
  try {
    // Fabric truncates `region × multiplier` (1333 × 1.2 = 1599.6 → 1599 px), so aim at the
    // rounded size: the larger per-axis factor, and a region a quarter pixel past each target.
    // At most a sub-pixel sliver of content is cut on one edge.
    const width = Math.max(1, Math.round(documentSize.width * options.scale));
    const height = Math.max(1, Math.round(documentSize.height * options.scale));
    const multiplier = Math.max(width / documentSize.width, height / documentSize.height);
    return canvas.toCanvasElement(multiplier / zoom, {
      left: offsetX,
      top: offsetY,
      width: ((width + SIZE_PAD_PX) / multiplier) * zoom,
      height: ((height + SIZE_PAD_PX) / multiplier) * zoom,
    });
  } finally {
    canvas.clipPath = clipPath;
    canvas.backgroundColor = background;
    restoreCaching();
  }
}
