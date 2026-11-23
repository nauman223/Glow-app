import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Placeholder "photos" from the design (06 Components · Photo placeholder). */
export type PhotoScene = 'lake' | 'portrait' | 'forest' | 'selfie' | 'beach';

const VIEW_BOXES: Readonly<Record<PhotoScene, string>> = {
  lake: '0 0 400 300',
  portrait: '0 0 300 400',
  forest: '0 0 400 300',
  selfie: '0 0 300 400',
  beach: '0 0 400 300',
};

let nextInstanceId = 0;

/**
 * Decorative vector stand-in for a photo, so the onboarding illustrations stay a few KB with
 * no raster assets. Its colours are picture content (like the brand SVG), not UI tokens.
 * Fills its host, cropping like `object-fit: cover`.
 */
@Component({
  selector: 'app-photo-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-photo-scene', 'aria-hidden': 'true' },
  templateUrl: './photo-scene.component.html',
  styleUrl: './photo-scene.component.scss',
})
export class PhotoSceneComponent {
  public readonly scene = input.required<PhotoScene>();

  private readonly gradientId = `app-photo-scene-${String(nextInstanceId++)}`;

  protected readonly viewBox = computed(() => VIEW_BOXES[this.scene()]);
  protected readonly gradient = { id: this.gradientId, url: `url(#${this.gradientId})` };
}
