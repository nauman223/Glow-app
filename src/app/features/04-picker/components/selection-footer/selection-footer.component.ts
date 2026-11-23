import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '@shared/ui/button/button.component';

import { PICKER_STRINGS } from '../../picker.strings';

/**
 * Multi-select footer (screen 04): "N selected" and Continue. While the photos are prepared it
 * shows the progress text instead of the count and Continue shows its loading state.
 */
@Component({
  selector: 'app-selection-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './selection-footer.component.html',
  styleUrl: './selection-footer.component.scss',
})
export class SelectionFooterComponent {
  public readonly count = input.required<number>();
  public readonly max = input.required<number>();
  /** Non-empty while photos are being prepared. */
  public readonly progress = input('');
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly continued = output();

  protected readonly strings = PICKER_STRINGS.collage;
  protected readonly preparing = computed(() => this.progress() !== '');
  protected readonly countText = computed(() =>
    this.preparing() ? this.progress() : this.strings.selected(this.count()),
  );
  protected readonly countLabel = computed(() =>
    this.preparing() ? this.progress() : this.strings.selectedLabel(this.count(), this.max()),
  );
  protected readonly canContinue = computed(() => this.count() > 0 && !this.disabled());
}
