import { inject, Injectable } from '@angular/core';
import { type CanvasContext } from '@core/canvas/canvas.models';
import { renderDocument } from '@core/canvas/canvas-render';
import { CanvasService } from '@core/canvas/canvas.service';
import { MAX_PREPARED_LONG_SIDE } from '@core/image/image.models';
import {
  createSurface,
  drawScaled,
  encodeSurface,
  fitLongSide,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';

import { type AiSourcePixels, type AiTarget, findTargetImage } from './ai-canvas-target';

export type AiSourceScope = 'target' | 'document';

export interface AiSourceOptions {
  /** `target` (default): the selected photo layer, else the base photo. `document`: flattened. */
  readonly scope?: AiSourceScope;
  /** Target scope only; default `edited` (see AiSourcePixels). */
  readonly pixels?: AiSourcePixels;
  /** Long side cap; default and maximum 2000 px (the canvas never holds larger images). */
  readonly maxLongSide?: number;
}

/** The pixels an AI screen works on. The receiver closes `bitmap` (AiSessionService does). */
export interface AiSourceImage {
  readonly target: AiTarget;
  readonly bitmap: ImageBitmap;
  /** Encoded copy for the "before" image (PNG when the source has transparency, else JPEG). */
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
}

const BEFORE_JPEG_QUALITY = 0.92;
const ALPHA_PROBE_SIZE = 64;

interface RenderedSource {
  readonly surface: Surface;
  readonly target: AiTarget;
}

function renderFlattened(context: CanvasContext, maxLongSide: number): RenderedSource {
  const longSide = Math.max(context.documentSize.width, context.documentSize.height);
  const surface = renderDocument(context, {
    scale: Math.min(1, maxLongSide / longSide),
    background: null,
  });
  return { surface, target: { kind: 'document' } };
}

function renderTarget(
  context: CanvasContext,
  pixels: AiSourcePixels,
  maxLongSide: number,
): RenderedSource {
  const found = findTargetImage(context, pixels);
  if (found === null) {
    throw new Error('There is no photo to work on');
  }
  const size = fitLongSide(found.size, maxLongSide);
  return { surface: drawScaled(found.element, size, true), target: found.target };
}

/** True when any pixel of a small probe copy is not fully opaque. */
function hasTransparency(surface: Surface): boolean {
  const probe = createSurface({ width: ALPHA_PROBE_SIZE, height: ALPHA_PROBE_SIZE });
  const context =
    probe instanceof HTMLCanvasElement
      ? probe.getContext('2d', { willReadFrequently: true })
      : probe.getContext('2d', { willReadFrequently: true });
  try {
    if (context === null) {
      return false;
    }
    context.drawImage(surface, 0, 0, ALPHA_PROBE_SIZE, ALPHA_PROBE_SIZE);
    const { data } = context.getImageData(0, 0, ALPHA_PROBE_SIZE, ALPHA_PROBE_SIZE);
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) {
        return true;
      }
    }
    return false;
  } finally {
    releaseSurface(probe);
  }
}

/**
 * Renders what an AI screen works on from the LIVE editor canvas (the editor stays alive under
 * the AI route, like Export). Pixels are copied inside the canvas queue, so a pending command
 * is applied first and nothing changes mid-copy.
 */
@Injectable({ providedIn: 'root' })
export class AiSourceService {
  private readonly canvas = inject(CanvasService);

  public async render(options: AiSourceOptions = {}): Promise<AiSourceImage> {
    const maxLongSide = Math.min(
      options.maxLongSide ?? MAX_PREPARED_LONG_SIDE,
      MAX_PREPARED_LONG_SIDE,
    );
    const { surface, target } = await this.canvas.withCanvas((context): RenderedSource =>
      options.scope === 'document'
        ? renderFlattened(context, maxLongSide)
        : renderTarget(context, options.pixels ?? 'edited', maxLongSide),
    );
    try {
      const hasAlpha = hasTransparency(surface);
      const [bitmap, blob] = await Promise.all([
        createImageBitmap(surface),
        encodeSurface(surface, hasAlpha ? 'image/png' : 'image/jpeg', BEFORE_JPEG_QUALITY),
      ]);
      return { target, bitmap, blob, width: surface.width, height: surface.height, hasAlpha };
    } finally {
      releaseSurface(surface);
    }
  }
}
