import { type ImageSize } from '@core/image/image.models';
import type { FabricImage, filters } from 'fabric';

import { type FabricModule } from '../canvas.models';
import {
  channelMatrix,
  type ColorMatrix,
  composeColorMatrices,
  contrastMatrix,
  isIdentityMatrix,
  saturateMatrix,
} from './color-matrix';
import { presetMatrix } from './filter-presets';
import { type AdjustModel, type ImageEdits } from './image-edits.models';
import { createVignetteFilter, type VignetteParams } from './vignette-filter';

/** Fabric Blur is a fraction of the image size; 100 on the slider is 5 % of it. */
const MAX_BLUR = 0.05;
/** Weight of the 4-neighbour sharpening kernel at 100. */
const MAX_SHARPEN = 0.8;
/** Darkening at the corners at 100. */
const MAX_VIGNETTE = 0.85;

export interface FilterBuildOptions {
  /**
   * Live preview on the Canvas 2D fallback: skip the convolution filters (blur, sharpen), which
   * cost hundreds of ms per frame on the CPU. They are applied in full on release.
   */
  readonly draft: boolean;
}

/**
 * Brightness, contrast, saturation, exposure and warmth as one colour matrix. All five are affine
 * per channel (Fabric's own Brightness and Contrast filters are too), so folding them with the
 * preset gives the same pixels as separate filters in a single GPU pass.
 */
function adjustMatrix(adjust: AdjustModel): ColorMatrix {
  const unit = (value: number): number => value / 100;
  const contrast = unit(adjust.contrast);
  const warmth = unit(adjust.warmth);
  const exposureGain = 2 ** unit(adjust.exposure);
  return composeColorMatrices([
    channelMatrix([exposureGain, exposureGain, exposureGain]),
    channelMatrix([1, 1, 1], unit(adjust.brightness) * 0.25),
    contrastMatrix(contrast >= 0 ? 1 + contrast : 1 + contrast * 0.75),
    saturateMatrix(1 + unit(adjust.saturation)),
    channelMatrix([1 + warmth * 0.12, 1 + warmth * 0.02, 1 - warmth * 0.12]),
  ]);
}

/** Preset first, then Adjust on top (so e.g. Warmth tints a B&W look). */
export function editsColorMatrix(edits: ImageEdits): ColorMatrix {
  const preset =
    edits.preset === null ? null : presetMatrix(edits.preset.id, edits.preset.intensity);
  return composeColorMatrices(
    preset === null ? [adjustMatrix(edits.adjust)] : [preset, adjustMatrix(edits.adjust)],
  );
}

function sharpenKernel(amount: number): number[] {
  const edge = -amount;
  return [0, edge, 0, edge, 1 + 4 * amount, edge, 0, edge, 0];
}

/**
 * The single model → Fabric filters mapping. Order: colour (one ColorMatrix), Blur, sharpen
 * (Convolute), vignette. `vignette` is the image's framing (see vignetteFrame); `null` skips it.
 */
export function buildImageFilters(
  fabric: FabricModule,
  edits: ImageEdits,
  vignette: Omit<VignetteParams, 'strength'> | null,
  options: FilterBuildOptions,
): filters.BaseFilter<string>[] {
  const { adjust } = edits;
  const result: filters.BaseFilter<string>[] = [];
  const matrix = editsColorMatrix(edits);
  if (!isIdentityMatrix(matrix)) {
    result.push(new fabric.filters.ColorMatrix({ matrix, colorsOnly: true }));
  }
  if (!options.draft && adjust.blur > 0) {
    result.push(new fabric.filters.Blur({ blur: (adjust.blur / 100) * MAX_BLUR }));
  }
  if (!options.draft && adjust.sharpen > 0) {
    const kernel = sharpenKernel((adjust.sharpen / 100) * MAX_SHARPEN);
    result.push(new fabric.filters.Convolute({ matrix: kernel, opaque: false }));
  }
  if (vignette !== null && adjust.vignette > 0) {
    const strength = (adjust.vignette / 100) * MAX_VIGNETTE;
    result.push(createVignetteFilter(fabric, { ...vignette, strength }));
  }
  return result;
}

/**
 * Where the vignette is centred, in the image's texture space. The base photo is framed by the
 * document (which a crop moves and resizes); a layer is framed by itself.
 */
export function vignetteFrame(
  fabric: FabricModule,
  image: FabricImage,
  document: ImageSize | null,
): Omit<VignetteParams, 'strength'> {
  const { width, height } = image;
  const sceneWidth = width * Math.abs(image.scaleX);
  const sceneHeight = height * Math.abs(image.scaleY);
  if (document === null) {
    const halfDiagonal = Math.hypot(sceneWidth, sceneHeight) / 2;
    return {
      centerX: 0.5,
      centerY: 0.5,
      scaleX: sceneWidth / halfDiagonal,
      scaleY: sceneHeight / halfDiagonal,
    };
  }
  const toLocal = fabric.util.invertTransform(image.calcTransformMatrix());
  const centre = new fabric.Point(document.width / 2, document.height / 2).transform(toLocal);
  const halfDiagonal = Math.hypot(document.width, document.height) / 2;
  return {
    centerX: centre.x / width + 0.5,
    centerY: centre.y / height + 0.5,
    scaleX: sceneWidth / halfDiagonal,
    scaleY: sceneHeight / halfDiagonal,
  };
}
