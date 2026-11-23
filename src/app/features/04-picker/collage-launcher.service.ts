import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type CollageTemplateId } from '@core/collage/collage.models';
import { EditorLaunchService } from '@core/editor-launch/editor-launch.service';
import { ImageRegistryService } from '@core/image/image-registry.service';
import { isImageError, type PreparedImage } from '@core/image/image.models';
import { ImageService } from '@core/image/image.service';
import { IMAGE_ERROR_MESSAGES } from '@core/image/image.strings';
import { LoggerService } from '@core/logging/logger.service';
import { MediaLibraryError } from '@core/media/media-library.errors';
import { MediaLibraryService } from '@core/media/media-library.service';
import { MEDIA_ERROR_MESSAGES } from '@core/media/media.strings';
import { ToastService } from '@core/notifications/toast.service';

import { PICKER_STRINGS } from './picker.strings';

interface Progress {
  readonly done: number;
  readonly total: number;
}

/**
 * Multi-select hand-off for a collage: prepares the chosen photos ONE AT A TIME (each original
 * is decoded, downscaled to ≤ 2000 px and released before the next, so peak memory is one full
 * decode), then queues them for the editor. Camera shots taken from the picker are prepared at
 * once and held here, after the library picks. Every prepared image this service still owns
 * (failure, cancelled navigation, leaving the picker) is released from the image registry.
 */
@Injectable()
export class CollageLauncherService {
  private readonly media = inject(MediaLibraryService);
  private readonly images = inject(ImageService);
  private readonly launcher = inject(EditorLaunchService);
  private readonly registry = inject(ImageRegistryService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);

  private readonly capturedState = signal<readonly PreparedImage[]>([]);
  private readonly progressState = signal<Progress | null>(null);
  private readonly capturingState = signal(false);

  public readonly captured = this.capturedState.asReadonly();
  public readonly busy = computed(() => this.progressState() !== null || this.capturingState());
  /** "Preparing photo 2 of 4" while photos are prepared; empty otherwise. */
  public readonly progressLabel = computed(() => {
    const progress = this.progressState();
    return progress === null
      ? ''
      : PICKER_STRINGS.collage.preparing(
          Math.min(progress.done + 1, progress.total),
          progress.total,
        );
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.release(this.capturedState());
    });
  }

  /** Takes a photo for the collage; it counts towards the selection. */
  public async capture(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.capturingState.set(true);
    try {
      const result = await this.images.fromCamera('camera');
      if (result.status === 'selected') {
        this.capturedState.update((images) => [...images, result.image]);
      }
    } catch (error: unknown) {
      this.report(error);
    } finally {
      this.capturingState.set(false);
    }
  }

  /** Library picks (in selection order) or device files, then camera shots → editor. */
  public launchAssets(
    templateId: CollageTemplateId,
    assetIds: readonly string[],
  ): Promise<boolean> {
    return this.launch(
      templateId,
      assetIds.map((id) => async () => this.images.fromBlob(await this.media.loadOriginal(id))),
    );
  }

  public launchFiles(templateId: CollageTemplateId, files: readonly File[]): Promise<boolean> {
    return this.launch(
      templateId,
      files.map((file) => () => this.images.fromFile(file)),
    );
  }

  private async launch(
    templateId: CollageTemplateId,
    sources: readonly (() => Promise<PreparedImage>)[],
  ): Promise<boolean> {
    if (this.busy()) {
      return false;
    }
    const prepared: PreparedImage[] = [];
    const total = sources.length + this.capturedState().length;
    this.progressState.set({ done: 0, total });
    try {
      for (const prepare of sources) {
        prepared.push(await prepare());
        this.progressState.set({ done: prepared.length, total });
      }
      const images = [...prepared, ...this.capturedState()];
      if (images.length === 0) {
        return false;
      }
      const opened = await this.launcher.launchCollage(templateId, images);
      if (opened) {
        // The editor owns them now (released when its canvas is disposed).
        this.capturedState.set([]);
      } else {
        this.release(prepared);
      }
      return opened;
    } catch (error: unknown) {
      this.release(prepared);
      this.report(error);
      return false;
    } finally {
      this.progressState.set(null);
    }
  }

  private release(images: readonly PreparedImage[]): void {
    for (const image of images) {
      this.registry.release(image.id);
    }
  }

  private report(error: unknown): void {
    if (isImageError(error)) {
      this.toasts.show(IMAGE_ERROR_MESSAGES[error.code], { variant: 'danger' });
      return;
    }
    // MediaLibraryService has already logged its own failures.
    if (error instanceof MediaLibraryError) {
      this.toasts.show(MEDIA_ERROR_MESSAGES[error.code], { variant: 'danger' });
      return;
    }
    this.logger.warn('Preparing collage photos failed', error);
    this.toasts.show(PICKER_STRINGS.collage.prepareFailed, { variant: 'danger' });
  }
}
