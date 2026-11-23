import { type NormalizedPoint } from '../ai-local.models';
import { type AlphaMask, createAlphaMask, keepConnected } from './alpha-mask';
import { colourWeight, learnColours, luma, rgbAt } from './pixel-colours';
import { clamp01 } from './worker-job';

/**
 * Automatic sky selection. MediaPipe has no sky model, so this combines:
 * 1. seeds: the most sky-like cells of the top band (bright, smooth, blue-to-neutral);
 * 2. MagicTouch prompted with those seeds (done by the caller), which follows the sky outline;
 * 3. a colour model learned from the selected sky, which removes non-sky pixels MagicTouch
 *    bled into (or replaces MagicTouch when it rejected the prompt);
 * 4. connectivity: only regions connected to the top edge stay solid sky.
 */
const BAND_FRACTION = 0.3;
const GRID_COLUMNS = 8;
const GRID_ROWS = 3;
/** Seeds passed to MagicTouch (more points make it select a smaller region). */
export const MAX_SEEDS = 3;
const MIN_SEED_SCORE = 0.55;
const MIN_LUMA = 70;
const MAX_GRADIENT = 14;

interface Cell {
  readonly x0: number;
  readonly y0: number;
  readonly width: number;
  readonly height: number;
  readonly step: number;
}

function cellScore(pixels: ImageData, cell: Cell): number {
  const { x0, y0, width: cellWidth, height: cellHeight, step } = cell;
  let lumaSum = 0;
  let blueSum = 0;
  let gradient = 0;
  let count = 0;
  for (let y = y0; y < y0 + cellHeight - step; y += step) {
    for (let x = x0; x < x0 + cellWidth - step; x += step) {
      const here = rgbAt(pixels, x, y);
      const level = luma(here);
      lumaSum += level;
      blueSum += here.b - here.r;
      gradient +=
        Math.abs(level - luma(rgbAt(pixels, x + step, y))) +
        Math.abs(level - luma(rgbAt(pixels, x, y + step)));
      count += 1;
    }
  }
  if (count === 0) {
    return 0;
  }
  const meanLuma = lumaSum / count;
  const meanGradient = gradient / (count * 2);
  if (meanLuma < MIN_LUMA || meanGradient > MAX_GRADIENT) {
    return 0;
  }
  return (
    0.45 * (meanLuma / 255) +
    0.25 * clamp01((blueSum / count + 20) / 80) +
    0.3 * (1 - meanGradient / MAX_GRADIENT)
  );
}

/**
 * Centres of the sky-like cells of the top band, best first; empty when the photo shows no sky.
 * The first MAX_SEEDS prompt MagicTouch; all of them train the colour model.
 */
export function findSkySeeds(pixels: ImageData): readonly NormalizedPoint[] {
  const cellWidth = Math.floor(pixels.width / GRID_COLUMNS);
  const cellHeight = Math.floor((pixels.height * BAND_FRACTION) / GRID_ROWS);
  if (cellWidth < 4 || cellHeight < 4) {
    return [];
  }
  const step = Math.max(1, Math.floor(Math.min(cellWidth, cellHeight) / 12));
  const cells: { readonly point: NormalizedPoint; readonly score: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const x0 = column * cellWidth;
      const y0 = row * cellHeight;
      const score = cellScore(pixels, { x0, y0, width: cellWidth, height: cellHeight, step });
      const point = {
        x: (x0 + cellWidth / 2) / pixels.width,
        y: (y0 + cellHeight / 2) / pixels.height,
      };
      cells.push({ point, score });
    }
  }
  return cells
    .filter((cell) => cell.score >= MIN_SEED_SCORE)
    .sort((first, second) => second.score - first.score)
    .map((cell) => cell.point);
}

/** Combines the MagicTouch mask with the learned sky colours (sizes may differ). */
export function refineSkyMask(
  model: AlphaMask,
  pixels: ImageData,
  seeds: readonly NormalizedPoint[],
): AlphaMask {
  // Model confidence at a PIXEL position.
  const modelAt = (x: number, y: number): number =>
    model.data[
      Math.floor((y * model.height) / pixels.height) * model.width +
        Math.floor((x * model.width) / pixels.width)
    ];
  const prompts = seeds.slice(0, MAX_SEEDS);
  const seedConfidence =
    prompts.reduce(
      (sum, seed) =>
        sum + modelAt(Math.floor(seed.x * pixels.width), Math.floor(seed.y * pixels.height)),
      0,
    ) / Math.max(prompts.length, 1);
  const modelAccepted = seedConfidence >= 0.5;
  const nearSeed = (x: number, y: number): boolean =>
    seeds.some(
      (seed) =>
        Math.abs(x / pixels.width - seed.x) < 0.5 / GRID_COLUMNS &&
        Math.abs(y / pixels.height - seed.y) < BAND_FRACTION / (2 * GRID_ROWS),
    );
  const colours = modelAccepted
    ? learnColours(pixels, (x, y) => y < pixels.height / 2 && modelAt(x, y) >= 0.6)
    : learnColours(pixels, nearSeed);
  const sky = createAlphaMask(model.width, model.height);
  for (let y = 0; y < model.height; y += 1) {
    for (let x = 0; x < model.width; x += 1) {
      const pixel = rgbAt(
        pixels,
        Math.floor((x * pixels.width) / model.width),
        Math.floor((y * pixels.height) / model.height),
      );
      const weight = colourWeight(pixel, colours);
      const index = y * model.width + x;
      sky.data[index] = modelAccepted ? model.data[index] * (0.35 + 0.65 * weight) : weight;
    }
  }
  const seedIndexes = seeds.map(
    (seed) =>
      Math.min(Math.floor(seed.y * model.height), model.height - 1) * model.width +
      Math.min(Math.floor(seed.x * model.width), model.width - 1),
  );
  keepConnected(sky, seedIndexes);
  return sky;
}
