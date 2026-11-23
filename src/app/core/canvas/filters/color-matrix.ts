import type { TMatColorMatrix } from 'fabric';

/**
 * 4×5 colour matrices in Fabric's ColorMatrix layout: rows R, G, B, A; columns R, G, B, A and a
 * constant offset in the 0-1 range. Every colour operation used by Adjust and the filter presets
 * is affine per pixel, so a whole stack folds into ONE matrix (one WebGL pass) and blending a
 * preset by intensity is a plain interpolation towards identity.
 */
export type ColorMatrix = TMatColorMatrix;

/** Rec. 709 luma weights, as used by the CSS Filter Effects matrices. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export const IDENTITY_MATRIX: ColorMatrix = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];

function toMatrix(values: readonly number[]): ColorMatrix {
  if (values.length !== IDENTITY_MATRIX.length) {
    throw new Error('A colour matrix has 20 entries');
  }
  return [...values] as ColorMatrix;
}

/** Matrix for "apply `first`, then `second`". */
export function multiplyColorMatrices(second: ColorMatrix, first: ColorMatrix): ColorMatrix {
  const result: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 5; column++) {
      let sum = column === 4 ? second[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) {
        sum += second[row * 5 + k] * first[k * 5 + column];
      }
      result.push(sum);
    }
  }
  return toMatrix(result);
}

/** Folds matrices given in application order into one. */
export function composeColorMatrices(matrices: readonly ColorMatrix[]): ColorMatrix {
  return matrices.reduce((total, next) => multiplyColorMatrices(next, total), IDENTITY_MATRIX);
}

/** Linear blend from identity (`amount` 0) to `matrix` (`amount` 1). */
export function mixWithIdentity(matrix: ColorMatrix, amount: number): ColorMatrix {
  return toMatrix(
    matrix.map(
      (value, index) => IDENTITY_MATRIX[index] + (value - IDENTITY_MATRIX[index]) * amount,
    ),
  );
}

export function isIdentityMatrix(matrix: ColorMatrix): boolean {
  return matrix.every((value, index) => Math.abs(value - IDENTITY_MATRIX[index]) < 1e-6);
}

/** Builds a matrix from three [r, g, b, offset] rows; alpha passes through. */
function rgbMatrix(rows: readonly (readonly [number, number, number, number])[]): ColorMatrix {
  const values = rows.flatMap(([red, green, blue, offset]) => [red, green, blue, 0, offset]);
  return toMatrix([...values, 0, 0, 0, 1, 0]);
}

/** Per-channel gain plus offset (brightness, exposure, warmth). */
export function channelMatrix(gains: readonly [number, number, number], offset = 0): ColorMatrix {
  const [red, green, blue] = gains;
  return rgbMatrix([
    [red, 0, 0, offset],
    [0, green, 0, offset],
    [0, 0, blue, offset],
  ]);
}

/** CSS `contrast(amount)`: scales around mid-grey. */
export function contrastMatrix(amount: number): ColorMatrix {
  return channelMatrix([amount, amount, amount], 0.5 - 0.5 * amount);
}

/** CSS `saturate(amount)`; `grayscale(a)` is `saturate(1 - a)`. */
export function saturateMatrix(amount: number): ColorMatrix {
  const s = amount;
  return rgbMatrix([
    [LUMA_R + (1 - LUMA_R) * s, LUMA_G - LUMA_G * s, LUMA_B - LUMA_B * s, 0],
    [LUMA_R - LUMA_R * s, LUMA_G + (1 - LUMA_G) * s, LUMA_B - LUMA_B * s, 0],
    [LUMA_R - LUMA_R * s, LUMA_G - LUMA_G * s, LUMA_B + (1 - LUMA_B) * s, 0],
  ]);
}

/** CSS `sepia(amount)`. */
export function sepiaMatrix(amount: number): ColorMatrix {
  const keep = 1 - Math.min(Math.max(amount, 0), 1);
  return rgbMatrix([
    [0.393 + 0.607 * keep, 0.769 - 0.769 * keep, 0.189 - 0.189 * keep, 0],
    [0.349 - 0.349 * keep, 0.686 + 0.314 * keep, 0.168 - 0.168 * keep, 0],
    [0.272 - 0.272 * keep, 0.534 - 0.534 * keep, 0.131 + 0.869 * keep, 0],
  ]);
}

/** CSS `hue-rotate(degrees)`. */
export function hueRotateMatrix(degrees: number): ColorMatrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return rgbMatrix([
    [
      0.213 + cos * 0.787 - sin * 0.213,
      0.715 - cos * 0.715 - sin * 0.715,
      0.072 - cos * 0.072 + sin * 0.928,
      0,
    ],
    [
      0.213 - cos * 0.213 + sin * 0.143,
      0.715 + cos * 0.285 + sin * 0.14,
      0.072 - cos * 0.072 - sin * 0.283,
      0,
    ],
    [
      0.213 - cos * 0.213 - sin * 0.787,
      0.715 - cos * 0.715 + sin * 0.715,
      0.072 + cos * 0.928 + sin * 0.072,
      0,
    ],
  ]);
}

/**
 * Applies `matrix` to RGBA bytes in place (alpha untouched), exactly as Fabric's ColorMatrix
 * does on its Canvas 2D path. Used for the small filter thumbnails.
 */
export function applyColorMatrixToPixels(data: Uint8ClampedArray, matrix: ColorMatrix): void {
  const m = matrix;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    data[index] = red * m[0] + green * m[1] + blue * m[2] + m[4] * 255;
    data[index + 1] = red * m[5] + green * m[6] + blue * m[7] + m[9] * 255;
    data[index + 2] = red * m[10] + green * m[11] + blue * m[12] + m[14] * 255;
  }
}
