import { inject, Injectable } from '@angular/core';
import { ImageService } from '@core/image/image.service';
import { ImageRegistryService } from '@core/image/image-registry.service';

/** Picks a photo for the "New background" image swatch, as a bitmap the caller closes. */
@Injectable()
export class BackgroundPhotoService {
  private readonly images = inject(ImageService);
  private readonly registry = inject(ImageRegistryService);

  /** `null` when the user cancelled the picker. */
  public async pick(): Promise<ImageBitmap | null> {
    const result = await this.images.fromCamera('photos');
    if (result.status === 'cancelled') {
      return null;
    }
    const { id, objectUrl } = result.image;
    try {
      const blob = this.registry.blobFor(objectUrl);
      if (blob === null) {
        throw new Error('The picked photo is no longer available');
      }
      return await createImageBitmap(blob);
    } finally {
      // Never adopted by the canvas: free the prepared copy now.
      this.registry.release(id);
    }
  }
}
