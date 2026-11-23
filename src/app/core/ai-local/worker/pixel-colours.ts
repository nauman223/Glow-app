/** Small RGB statistics over ImageData (used by the sky detection). */

const MIN_COLOUR_STD = 10;
/** Colour distance is measured in units of STD_SCALE standard deviations. */
const STD_SCALE = 3;

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Mean and standard deviation per channel. */
export interface ColourModel {
  readonly mean: Rgb;
  readonly std: Rgb;
}

export function rgbAt({ data, width }: ImageData, x: number, y: number): Rgb {
  const offset = (y * width + x) * 4;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

export function luma({ r, g, b }: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Colour statistics of the pixels `include` accepts (sampled every other pixel). */
export function learnColours(
  pixels: ImageData,
  include: (x: number, y: number) => boolean,
): ColourModel {
  const sum = [0, 0, 0];
  const squares = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < pixels.height; y += 2) {
    for (let x = 0; x < pixels.width; x += 2) {
      if (include(x, y)) {
        const { r, g, b } = rgbAt(pixels, x, y);
        [r, g, b].forEach((value, channel) => {
          sum[channel] += value;
          squares[channel] += value * value;
        });
        count += 1;
      }
    }
  }
  const total = Math.max(count, 1);
  const mean = sum.map((value) => value / total);
  const std = squares.map((value, channel) =>
    Math.max(MIN_COLOUR_STD, Math.sqrt(Math.max(value / total - mean[channel] ** 2, 0))),
  );
  return {
    mean: { r: mean[0], g: mean[1], b: mean[2] },
    std: { r: std[0], g: std[1], b: std[2] },
  };
}

/** 1 for the model's mean colour, falling off as a Gaussian of the normalized distance. */
export function colourWeight({ r, g, b }: Rgb, { mean, std }: ColourModel): number {
  const distance =
    ((r - mean.r) / (STD_SCALE * std.r)) ** 2 +
    ((g - mean.g) / (STD_SCALE * std.g)) ** 2 +
    ((b - mean.b) / (STD_SCALE * std.b)) ** 2;
  return Math.exp(-distance / 2);
}
