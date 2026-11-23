import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditorLaunchService } from '@core/editor-launch/editor-launch.service';
import { ImageRegistryService } from '@core/image/image-registry.service';
import { isImageError, type PreparedImage } from '@core/image/image.models';
import { ImageService } from '@core/image/image.service';
import { IMAGE_ERROR_MESSAGES } from '@core/image/image.strings';
import { LoggerService } from '@core/logging/logger.service';
import { MediaLibraryError } from '@core/media/media-library.errors';
import { type MediaAsset } from '@core/media/media-library.models';
import { MediaLibraryService } from '@core/media/media-library.service';
import { MEDIA_ERROR_MESSAGES } from '@core/media/media.strings';
import { ToastService } from '@core/notifications/toast.service';

import { readAiFollowUp } from './picker.models';
import { PICKER_STRINGS } from './picker.strings';

/** What is being prepared: a library asset id, or a photo from the camera / a file input. */
type PendingSource =
  | { readonly kind: 'asset'; readonly id: string }
  | { readonly kind: 'camera' }
  | { readonly kind: 'file' };

/**
 * Turns the user's choice into a PreparedImage and hands it to the editor (plus the AI screen
 * to open over it, when the picker came from the Home "AI tools" sheet). Only one photo is
 * prepared at a time, so double taps and taps on other tiles are ignored while busy.
 * Provided by the picker page (reads its route).
 */
@Injectable()
export class PhotoOpenerService {
  private readonly media = inject(MediaLibraryService);
  private readonly images = inject(ImageService);
  private readonly launcher = inject(EditorLaunchService);
  private readonly registry = inject(ImageRegistryService);
  private readonly toasts = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly followUp = readAiFollowUp(inject(ActivatedRoute).snapshot);

  private readonly pendingState = signal<PendingSource | null>(null);

  public readonly busy = computed(() => this.pendingState() !== null);
  /** Library asset currently being prepared, for the tile's busy overlay. */
  public readonly pendingAssetId = computed(() => {
    const pending = this.pendingState();
    return pending?.kind === 'asset' ? pending.id : null;
  });
  public readonly statusMessage = computed(() => (this.busy() ? PICKER_STRINGS.opening : ''));

  /** Resolves true when the editor opened. */
  public openAsset(asset: MediaAsset): Promise<boolean> {
    return this.run({ kind: 'asset', id: asset.id }, async () =>
      this.images.fromBlob(await this.media.loadOriginal(asset.id)),
    );
  }

  public openFile(file: File): Promise<boolean> {
    return this.run({ kind: 'file' }, () => this.images.fromFile(file));
  }

  public openCamera(): Promise<boolean> {
    return this.run({ kind: 'camera' }, async () => {
      const result = await this.images.fromCamera('camera');
      return result.status === 'selected' ? result.image : null;
    });
  }

  private async run(
    source: PendingSource,
    prepare: () => Promise<PreparedImage | null>,
  ): Promise<boolean> {
    if (this.pendingState() !== null) {
      return false;
    }
    this.pendingState.set(source);
    try {
      const image = await prepare();
      return image === null ? false : await this.launch(image);
    } catch (error: unknown) {
      this.report(error);
      return false;
    } finally {
      this.pendingState.set(null);
    }
  }

  private async launch(image: PreparedImage): Promise<boolean> {
    let opened = false;
    try {
      opened = await this.launcher.launch(image, this.followUp ?? undefined);
      return opened;
    } finally {
      // The editor never received it, so nothing else will release its object URL.
      if (!opened) {
        this.registry.release(image.id);
      }
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
    this.logger.warn('Opening the photo failed', error);
    this.toasts.show(PICKER_STRINGS.openFailed, { variant: 'danger' });
  }
}
