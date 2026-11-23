import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  type AiMask,
  type DetectedFace,
  type NormalizedRect,
} from '@core/ai-local/ai-local.models';
import { AiLocalService } from '@core/ai-local/ai-local.service';
import { blurredCopy } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { fitLongSide, releaseSurface } from '@core/image/image-surface';
import { LoggerService } from '@core/logging/logger.service';
import {
  encodePixels,
  readAlpha,
  readPixels,
  timed,
} from '@features/ai/22-colour-boost/pixel-buffer';
import { AiFeatureError } from '@features/ai/_shell/ai-session.models';
import { AiSessionService } from '@features/ai/_shell/ai-session.service';
import { type AiSourceImage } from '@features/ai/_shell/ai-source.service';

import {
  type BeautyStyleId,
  type BeautyToolId,
  type BeautyValues,
  DEFAULT_STYLE,
  DEFAULT_TOOL,
  STYLE_VALUES,
} from './beauty-options';
import { retouchPixels } from './beauty-render';
import { faceHeightPx, regionWeights, sortByArea } from './face-regions';
import { NATURAL_BEAUTY_STRINGS } from './natural-beauty.strings';

const PREVIEW_LONG_SIDE = 1080;
const MAX_FACES = 5;
const SKIN_FEATHER_PX = 3;
/** Blur radii as fractions of the largest face's height: pores, blemishes, skin tone. */
const FINE_RADIUS = 0.012;
const MID_RADIUS = 0.03;
const BROAD_RADIUS = 0.08;

interface FaceAnalysis {
  readonly faces: readonly DetectedFace[];
  readonly skin: AiMask;
}

/**
 * Natural beauty (board 23). Faces (landmarks, up to five) and skin (multiclass segmenter) are
 * found once; every option change only re-renders. Retouching applies to every face found.
 */
@Injectable()
export class NaturalBeautyService {
  private readonly ai = inject(AiLocalService);
  private readonly session = inject(AiSessionService);
  private readonly logger = inject(LoggerService);
  private readonly styleState = signal<BeautyStyleId>(DEFAULT_STYLE);
  private readonly toolState = signal<BeautyToolId>(DEFAULT_TOOL);
  private readonly valuesState = signal<BeautyValues>(STYLE_VALUES[DEFAULT_STYLE]);
  private readonly faceBoxesState = signal<readonly NormalizedRect[]>([]);
  private analysis: FaceAnalysis | null = null;

  public readonly style = this.styleState.asReadonly();
  public readonly tool = this.toolState.asReadonly();
  public readonly values = this.valuesState.asReadonly();
  /** Boxes of the faces found (normalized to the source), largest first. */
  public readonly faceBoxes = this.faceBoxesState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.analysis?.skin.bitmap.close();
      this.analysis = null;
    });
  }

  public start(): Promise<void> {
    return this.session.start({ scope: 'target' }, (source, signal) =>
      this.refresh(source, signal),
    );
  }

  public selectStyle(style: BeautyStyleId): void {
    this.styleState.set(style);
    this.valuesState.set(STYLE_VALUES[style]);
    this.rerun();
  }

  public selectTool(tool: BeautyToolId): void {
    this.toolState.set(tool);
  }

  public previewValue(value: number): void {
    this.valuesState.update((values) => ({ ...values, [this.toolState()]: value }));
  }

  public commitValue(value: number): void {
    this.previewValue(value);
    this.rerun();
  }

  public renderResult(source: AiSourceImage): Promise<Blob> {
    return this.render(source, Math.max(source.width, source.height));
  }

  private rerun(): void {
    void this.session.run((source, signal) => this.refresh(source, signal));
  }

  private async refresh(source: AiSourceImage, signal: AbortSignal): Promise<void> {
    this.analysis ??= await this.analyse(source, signal);
    const preview = await this.render(source, PREVIEW_LONG_SIDE);
    if (!signal.aborted) {
      this.session.showResult(preview);
    }
  }

  private async analyse(source: AiSourceImage, signal: AbortSignal): Promise<FaceAnalysis> {
    const [landmarkJob, skinJob] = await Promise.allSettled([
      this.ai.faceLandmarks(source.bitmap, { maxFaces: MAX_FACES }, { signal }),
      this.ai.segment(
        source.bitmap,
        { mode: 'person-parts', parts: ['face-skin', 'body-skin'], featherPx: SKIN_FEATHER_PX },
        { signal },
      ),
    ]);
    if (landmarkJob.status === 'rejected') {
      // Free the half that succeeded before failing.
      if (skinJob.status === 'fulfilled') {
        skinJob.value.bitmap.close();
      }
      const reason: unknown = landmarkJob.reason;
      throw reason;
    }
    if (skinJob.status === 'rejected') {
      const reason: unknown = skinJob.reason;
      throw reason;
    }
    const landmarks = landmarkJob.value;
    const skin = skinJob.value;
    if (landmarks.faces.length === 0) {
      skin.bitmap.close();
      throw new AiFeatureError(
        NATURAL_BEAUTY_STRINGS.noFaceTitle,
        NATURAL_BEAUTY_STRINGS.noFaceMessage,
      );
    }
    const faces = sortByArea(landmarks.faces);
    this.faceBoxesState.set(faces.map((face) => face.box));
    return { faces, skin };
  }

  private retouch(source: AiSourceImage, size: ImageSize, analysis: FaceAnalysis): ImageData {
    const faceHeight = faceHeightPx(analysis.faces[0], size);
    const blur = (fraction: number): ImageData => {
      const surface = blurredCopy(source.bitmap, size, Math.max(1, fraction * faceHeight));
      const pixels = readPixels(surface, size);
      releaseSurface(surface);
      return pixels;
    };
    return retouchPixels({
      pixels: readPixels(source.bitmap, size),
      fine: blur(FINE_RADIUS),
      mid: blur(MID_RADIUS),
      broad: blur(BROAD_RADIUS),
      weights: {
        skin: readAlpha(analysis.skin.bitmap, size),
        protect: regionWeights(analysis.faces, 'protect', size),
        eyes: regionWeights(analysis.faces, 'eyes', size),
        mouth: regionWeights(analysis.faces, 'mouth', size),
        face: regionWeights(analysis.faces, 'face', size),
      },
      values: this.valuesState(),
    });
  }

  private render(source: AiSourceImage, longSide: number): Promise<Blob> {
    const analysis = this.analysis;
    if (analysis === null) {
      return Promise.reject(new Error('Natural beauty has no faces yet'));
    }
    const size = fitLongSide(source, longSide);
    const { value, ms } = timed(() => this.retouch(source, size, analysis));
    this.logger.debug('Natural beauty rendered', { ...size, durationMs: ms });
    return encodePixels(value, source.hasAlpha);
  }
}
