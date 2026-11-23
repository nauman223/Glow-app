import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ONBOARDING_STRINGS } from '../../onboarding.strings';
import { PhotoSceneComponent } from '../photo-scene/photo-scene.component';

/** 02c: a beach photo with neon strokes, stickers and a text caption drawn on top. */
@Component({
  selector: 'app-draw-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoSceneComponent],
  host: { 'aria-hidden': 'true' },
  templateUrl: './draw-illustration.component.html',
  styleUrl: './draw-illustration.component.scss',
})
export class DrawIllustrationComponent {
  protected readonly caption = ONBOARDING_STRINGS.illustration.caption;
}
