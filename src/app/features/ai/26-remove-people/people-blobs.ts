import { type NormalizedRect } from '@core/ai-local/ai-local.models';
import { type ImageSize } from '@core/image/image.models';

/** One kept blob of the grid: its size in cells and its box (normalized). */
export interface GridBlob {
  readonly area: number;
  readonly box: NormalizedRect;
}

/** A binary grid split into blobs. */
export interface LabelledGrid {
  readonly size: ImageSize;
  /** Per cell: 0 = background, otherwise the 1-based index into `blobs`. */
  readonly labels: Uint8Array;
  readonly blobs: readonly GridBlob[];
}

interface RawBlob {
  readonly label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Splits a binary grid (`inside[i] !== 0`) into 8-connected blobs, keeps the `maxBlobs` largest
 * of at least `minArea` cells and numbers them 1..n from left to right, so "Person 1" is the
 * leftmost on the photo. Iterative flood fill over typed arrays: a few ms for a 384 px grid.
 */
export function labelBlobs(
  inside: Uint8Array,
  size: ImageSize,
  minArea: number,
  maxBlobs: number,
): LabelledGrid {
  const raw = new Int32Array(inside.length);
  const stack = new Int32Array(inside.length);
  const found: RawBlob[] = [];
  for (let start = 0; start < inside.length; start += 1) {
    if (inside[start] !== 0 && raw[start] === 0) {
      found.push(flood(inside, raw, stack, size, start, found.length + 1));
    }
  }
  const kept = found
    .filter((blob) => blob.area >= minArea)
    .sort((first, second) => second.area - first.area)
    .slice(0, maxBlobs)
    .sort((first, second) => first.minX - second.minX);
  const remap = new Uint8Array(found.length + 1);
  kept.forEach((blob, index) => {
    remap[blob.label] = index + 1;
  });
  const labels = new Uint8Array(inside.length);
  for (let cell = 0; cell < raw.length; cell += 1) {
    labels[cell] = remap[raw[cell]];
  }
  return {
    size,
    labels,
    blobs: kept.map((blob) => ({
      area: blob.area,
      box: {
        left: blob.minX / size.width,
        top: blob.minY / size.height,
        right: (blob.maxX + 1) / size.width,
        bottom: (blob.maxY + 1) / size.height,
      },
    })),
  };
}

/** Marks every cell connected to `start` with `label` (cells are marked when pushed). */
function flood(
  inside: Uint8Array,
  raw: Int32Array,
  stack: Int32Array,
  { width, height }: ImageSize,
  start: number,
  label: number,
): RawBlob {
  const blob: RawBlob = { label, area: 0, minX: width, minY: height, maxX: 0, maxY: 0 };
  let top = 0;
  stack[top] = start;
  top += 1;
  raw[start] = label;
  while (top > 0) {
    top -= 1;
    const cell = stack[top];
    const x = cell % width;
    const y = (cell - x) / width;
    blob.area += 1;
    blob.minX = Math.min(blob.minX, x);
    blob.maxX = Math.max(blob.maxX, x);
    blob.minY = Math.min(blob.minY, y);
    blob.maxY = Math.max(blob.maxY, y);
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
        const next = ny * width + nx;
        if (inside[next] !== 0 && raw[next] === 0) {
          raw[next] = label;
          stack[top] = next;
          top += 1;
        }
      }
    }
  }
  return blob;
}
