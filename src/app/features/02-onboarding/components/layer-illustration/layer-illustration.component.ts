import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ONBOARDING_STRINGS } from '../../onboarding.strings';
import { PhotoSceneComponent } from '../photo-scene/photo-scene.component';

/** 02b: a selfie layer at 60% opacity over a forest photo, with a static opacity control. */
@Component({
  selector: 'app-layer-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoSceneComponent],
  host: { 'aria-hidden': 'true' },
  templateUrl: './layer-illustration.component.html',
  styleUrl: './layer-illustration.component.scss',
})
export class LayerIllustrationComponent {
  protected readonly strings = ONBOARDING_STRINGS.illustration;
}
