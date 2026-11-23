import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { BACKGROUND_IDS, type BackgroundId } from '../../remove-background.models';
import { REMOVE_BACKGROUND_STRINGS } from '../../remove-background.strings';

let nextSwatchesId = 0;

/**
 * Board 13b "New background" swatches: transparent, white, violet, gradient, blurred original
 * and a photo of the user's choice. Toggle buttons; the page owns the selection.
 */
@Component({
  selector: 'app-background-swatches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './background-swatches.component.html',
  styleUrl: './background-swatches.component.scss',
})
export class BackgroundSwatchesComponent {
  public readonly value = input.required<BackgroundId>();
  /** The photo, shown blurred in the "Blur original" swatch. */
  public readonly photoSrc = input<string | null>(null);
  public readonly disabled = input(false);
  public readonly selected = output<BackgroundId>();

  protected readonly strings = REMOVE_BACKGROUND_STRINGS;
  protected readonly ids = BACKGROUND_IDS;
  protected readonly labelId = `app-bg-swatches-${(nextSwatchesId++).toString()}`;
}
