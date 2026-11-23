import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { PhotoSceneComponent } from '../photo-scene/photo-scene.component';

/** 02a: two loose photos → one collage. Decorative; the step text carries the meaning. */
@Component({
  selector: 'app-merge-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PhotoSceneComponent],
  host: { 'aria-hidden': 'true' },
  templateUrl: './merge-illustration.component.html',
  styleUrl: './merge-illustration.component.scss',
})
export class MergeIllustrationComponent {}
