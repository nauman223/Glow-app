import { context2d } from '@core/ai-local/mask-compositing';
import { type ImageSize } from '@core/image/image.models';
import { createSurface, releaseSurface, type Surface } from '@core/image/image-surface';

import { type CutoutScene, paintBackground } from './cutout-render';

function sameSize(surface: Surface, size: ImageSize): boolean {
  return surface.width === size.width && surface.height === size.height;
}

/**
 * Draws the live preview into the stage canvas once per animation frame while the user paints:
 * the background is cached at preview size, so a frame is three drawImage calls (background,
 * photo, mask) instead of a full render.
 */
export class CutoutPreview {
  private background: Surface | null = null;
  private subject: Surface | null = null;

  /** Call when the background (or the photo behind it) changes. */
  public invalidate(): void {
    if (this.background !== null) {
      releaseSurface(this.background);
      this.background = null;
    }
  }

  public draw(target: HTMLCanvasElement, scene: CutoutScene): void {
    const size: ImageSize = { width: target.width, height: target.height };
    if (size.width === 0 || size.height === 0) {
      return;
    }
    if (this.background === null || !sameSize(this.background, size)) {
      this.invalidate();
      this.background = createSurface(size);
      paintBackground(context2d(this.background), scene, size);
    }
    if (this.subject === null || !sameSize(this.subject, size)) {
      if (this.subject !== null) {
        releaseSurface(this.subject);
      }
      this.subject = createSurface(size);
    }
    const subjectContext = context2d(this.subject);
    subjectContext.globalCompositeOperation = 'source-over';
    subjectContext.clearRect(0, 0, size.width, size.height);
    subjectContext.drawImage(scene.image, 0, 0, size.width, size.height);
    subjectContext.globalCompositeOperation = 'destination-in';
    subjectContext.drawImage(scene.mask, 0, 0, size.width, size.height);

    const context = target.getContext('2d');
    if (context === null) {
      return;
    }
    context.clearRect(0, 0, size.width, size.height);
    context.drawImage(this.background, 0, 0);
    context.drawImage(this.subject, 0, 0);
  }

  public dispose(): void {
    this.invalidate();
    if (this.subject !== null) {
      releaseSurface(this.subject);
      this.subject = null;
    }
  }
}
