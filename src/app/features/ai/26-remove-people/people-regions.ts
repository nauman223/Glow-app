import { type NormalizedPoint, type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type Context2D, context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import {
  createSurface,
  fitLongSide,
  releaseSurface,
  type Surface,
} from '@core/image/image-surface';
import { type CloudMaskRegions } from '@features/ai/_cloud/components/cloud-mask-brush/cloud-mask';

import { labelBlobs, type LabelledGrid } from './people-blobs';

/** Working grid: about 5 source px per cell at 2000 px, enough to tell people apart. */
const GRID_LONG_SIDE = 384;
/** Mask confidence (alpha) that counts as a person. */
const ALPHA_INSIDE = 128;
/** Smaller blobs are noise (a hand at the edge, a poster): 0.2 % of the photo. */
const MIN_AREA_FRACTION = 0.002;
const MAX_PEOPLE = 8;
/** Cells added around a person: the eraser needs the outline and a margin (~1 % long side). */
const GROW_CELLS = 3;
/** A tap this many cells from a person still selects it. */
const TAP_SLOP_CELLS = 6;
/** The drawn box is this much (of the photo) larger than the person on each side. */
const BOX_MARGIN = 0.015;

export interface DetectedPerson {
  /** Region id (CloudMask selection), 1-based, left to right. */
  readonly id: number;
  readonly box: NormalizedRect;
}

/**
 * The people found in a person mask, one region per separate blob (people who touch or overlap
 * become one region). Draws the selected people, grown by a small margin, for CloudMask.
 */
export class PeopleRegions implements CloudMaskRegions {
  private cache: { readonly key: string; readonly surface: Surface } | null = null;

  public readonly people: readonly DetectedPerson[];

  constructor(private readonly grid: LabelledGrid) {
    this.people = grid.blobs.map((blob, index) => ({ id: index + 1, box: padded(blob.box) }));
  }

  public draw(
    context: Context2D,
    size: ImageSize,
    selected: ReadonlySet<number>,
    colour: string,
  ): void {
    const key = `${colour}|${[...selected].sort((a, b) => a - b).join(',')}`;
    if (this.cache?.key !== key) {
      this.dispose();
      this.cache = { key, surface: this.paint(selected, colour) };
    }
    context.drawImage(this.cache.surface, 0, 0, size.width, size.height);
  }

  /** The person under (or near) a tap, else the smallest box holding it, else `null`. */
  public regionAt(point: NormalizedPoint): number | null {
    const { width, height } = this.grid.size;
    const cx = Math.min(width - 1, Math.floor(point.x * width));
    const cy = Math.min(height - 1, Math.floor(point.y * height));
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let y = Math.max(0, cy - TAP_SLOP_CELLS); y <= cy + TAP_SLOP_CELLS && y < height; y += 1) {
      for (
        let x = Math.max(0, cx - TAP_SLOP_CELLS);
        x <= cx + TAP_SLOP_CELLS && x < width;
        x += 1
      ) {
        const label = this.grid.labels[y * width + x];
        const distance = (x - cx) ** 2 + (y - cy) ** 2;
        if (label !== 0 && distance < bestDistance) {
          best = label;
          bestDistance = distance;
        }
      }
    }
    return best ?? this.boxAt(point);
  }

  public dispose(): void {
    if (this.cache !== null) {
      releaseSurface(this.cache.surface);
      this.cache = null;
    }
  }

  private boxAt(point: NormalizedPoint): number | null {
    const holding = this.people
      .filter(({ box }) => point.x >= box.left && point.x <= box.right)
      .filter(({ box }) => point.y >= box.top && point.y <= box.bottom)
      .sort((first, second) => boxArea(first.box) - boxArea(second.box));
    return holding.at(0)?.id ?? null;
  }

  /** The selected people at grid size, grown by GROW_CELLS, opaque in `colour`. */
  private paint(selected: ReadonlySet<number>, colour: string): Surface {
    const { size, labels } = this.grid;
    const surface = createSurface(size);
    const context = context2d(surface);
    const image = context.createImageData(size.width, size.height);
    for (let cell = 0; cell < labels.length; cell += 1) {
      if (selected.has(labels[cell])) {
        grow(image, cell % size.width, Math.floor(cell / size.width));
      }
    }
    context.putImageData(image, 0, 0);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = colour;
    context.fillRect(0, 0, size.width, size.height);
    return surface;
  }
}

/** Finds the people in a person mask (AiMask.bitmap: white, alpha = confidence). */
export function findPeople(mask: ImageBitmap): PeopleRegions {
  const size = fitLongSide({ width: mask.width, height: mask.height }, GRID_LONG_SIDE);
  const surface = createSurface(size);
  try {
    const context = context2d(surface, { willReadFrequently: true });
    context.drawImage(mask, 0, 0, size.width, size.height);
    const pixels = context.getImageData(0, 0, size.width, size.height).data;
    const inside = new Uint8Array(size.width * size.height);
    for (let cell = 0; cell < inside.length; cell += 1) {
      inside[cell] = pixels[cell * 4 + 3] >= ALPHA_INSIDE ? 1 : 0;
    }
    const minArea = Math.max(4, Math.round(MIN_AREA_FRACTION * inside.length));
    return new PeopleRegions(labelBlobs(inside, size, minArea, MAX_PEOPLE));
  } finally {
    releaseSurface(surface);
  }
}

function grow(image: ImageData, x: number, y: number): void {
  const { width, height, data } = image;
  for (let ny = Math.max(0, y - GROW_CELLS); ny <= Math.min(height - 1, y + GROW_CELLS); ny += 1) {
    for (let nx = Math.max(0, x - GROW_CELLS); nx <= Math.min(width - 1, x + GROW_CELLS); nx += 1) {
      data[(ny * width + nx) * 4 + 3] = 255;
    }
  }
}

function padded(box: NormalizedRect): NormalizedRect {
  return {
    left: Math.max(0, box.left - BOX_MARGIN),
    top: Math.max(0, box.top - BOX_MARGIN),
    right: Math.min(1, box.right + BOX_MARGIN),
    bottom: Math.min(1, box.bottom + BOX_MARGIN),
  };
}

function boxArea(box: NormalizedRect): number {
  return (box.right - box.left) * (box.bottom - box.top);
}
