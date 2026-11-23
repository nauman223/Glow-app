import { CdkDragHandle } from '@angular/cdk/drag-drop';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { type CanvasLayer, type LayerStep } from '@core/canvas/layers/layer.models';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { LAYERS_STRINGS } from '../layers.strings';

/**
 * One Layers drawer row (presentational): drag handle, 48px thumbnail, name, visibility and
 * lock toggles. Reordering without dragging: "Move up" / "Move down" buttons that are visually
 * hidden until focused (keyboard) and always reachable by TalkBack swipe navigation.
 */
@Component({
  selector: 'app-layer-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDragHandle, IconComponent],
  templateUrl: './layer-row.component.html',
  styleUrl: './layer-row.component.scss',
  host: { '[class.layer-row--selected]': 'selected()' },
})
export class LayerRowComponent {
  public readonly layer = input.required<CanvasLayer>();
  public readonly name = input.required<string>();
  public readonly thumbnail = input<string | null>(null);
  public readonly selected = input(false, { transform: booleanAttribute });
  public readonly canMoveUp = input(false, { transform: booleanAttribute });
  public readonly canMoveDown = input(false, { transform: booleanAttribute });

  public readonly selectRequested = output();
  public readonly visibilityToggled = output();
  public readonly lockToggled = output();
  public readonly moveRequested = output<LayerStep>();

  protected readonly strings = LAYERS_STRINGS;
  protected readonly isText = computed(() => this.layer().kind === 'text');
  protected readonly isBase = computed(() => this.layer().role === 'base');
  protected readonly movable = computed(() => !this.isBase());
  protected readonly visibilityLabel = computed(() =>
    this.layer().visible ? this.strings.hide(this.name()) : this.strings.show(this.name()),
  );
  protected readonly lockLabel = computed(() => {
    const name = this.name();
    if (this.isBase()) {
      return this.strings.alwaysLocked(name);
    }
    return this.layer().locked ? this.strings.unlock(name) : this.strings.lock(name);
  });
}
