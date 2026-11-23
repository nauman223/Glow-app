import { type Box, createTileBuffers, guidedFilterTile, type MattingPixels } from './guided-filter';

/**
 * HD cutout edges: a colour guided filter run at the photo's full resolution. The segmentation
 * model sees a ≤ 1024 px copy and its mask is upscaled, so fine detail such as hair is lost;
 * here the upscaled mask is the filter input and the full-size photo is the guide. The edge
 * snaps to real colour boundaries and thin strands that match the subject's colours get
 * coverage back.
 *
 * Only tiles where the mask changes are filtered (elsewhere the filter returns the mask
 * unchanged), yielding to the main thread every few milliseconds so the UI stays responsive.
 */

export interface MattingStats {
  readonly tiles: number;
  readonly refinedTiles: number;
  /** Longest stretch of work between two yields to the main thread. */
  readonly longestSliceMs: number;
}

/** Edge length of a processing tile; the filter reads 2 × radius further around it. */
const TILE = 128;
/** Window radius: 1/100 of the long side (20 px at 2000 px), clamped: how far strands reach. */
const RADIUS_FRACTION = 1 / 100;
const MIN_RADIUS = 4;
const MAX_RADIUS = 24;
/** Work time before yielding to the main thread (keeps frames under ~16 ms). */
const SLICE_MS = 10;

/** Window radius used for an image of this size. */
export function mattingRadius(width: number, height: number): number {
  const radius = Math.round(Math.max(width, height) * RADIUS_FRACTION);
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius));
}

/** A fresh task without the 4 ms clamp nested `setTimeout(0)` calls get. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (): void => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/** Refines `pixels.mask` in place. Throws the abort reason when `signal` is aborted. */
export async function refineMaskEdges(
  pixels: MattingPixels,
  signal: AbortSignal,
): Promise<MattingStats> {
  const { width, height, mask } = pixels;
  const radius = mattingRadius(width, height);
  const source = new Uint8Array(width * height);
  for (let index = 0; index < source.length; index += 1) {
    source[index] = mask[index * 4 + 3];
  }
  const buffers = createTileBuffers(TILE + radius * 4);
  let tiles = 0;
  let refinedTiles = 0;
  let longestSliceMs = 0;
  let sliceStart = performance.now();
  for (let top = 0; top < height; top += TILE) {
    for (let left = 0; left < width; left += TILE) {
      const tile: Box = {
        left,
        top,
        right: Math.min(width, left + TILE),
        bottom: Math.min(height, top + TILE),
      };
      const region = grow(tile, radius * 2, width, height);
      tiles += 1;
      if (!isUniform(source, width, region)) {
        guidedFilterTile(pixels, source, tile, region, radius, buffers);
        refinedTiles += 1;
      }
      const elapsed = performance.now() - sliceStart;
      if (elapsed >= SLICE_MS) {
        longestSliceMs = Math.max(longestSliceMs, elapsed);
        await yieldToMain();
        signal.throwIfAborted();
        sliceStart = performance.now();
      }
    }
  }
  longestSliceMs = Math.max(longestSliceMs, performance.now() - sliceStart);
  return { tiles, refinedTiles, longestSliceMs };
}

function grow(box: Box, by: number, width: number, height: number): Box {
  return {
    left: Math.max(0, box.left - by),
    top: Math.max(0, box.top - by),
    right: Math.min(width, box.right + by),
    bottom: Math.min(height, box.bottom + by),
  };
}

/** True when the mask has one value everywhere in `region` (the filter would not change it). */
function isUniform(source: Uint8Array, width: number, region: Box): boolean {
  const first = source[region.top * width + region.left];
  for (let y = region.top; y < region.bottom; y += 1) {
    const end = y * width + region.right;
    for (let index = y * width + region.left; index < end; index += 1) {
      if (source[index] !== first) {
        return false;
      }
    }
  }
  return true;
}
