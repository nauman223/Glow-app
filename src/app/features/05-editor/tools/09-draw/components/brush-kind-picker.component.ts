import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

import { type BrushKind, type BrushKindOption } from '../draw.models';
import { DRAW_STRINGS } from '../draw.strings';

const BRUSH_KIND_OPTIONS: readonly BrushKindOption[] = [
  { kind: 'brush', label: DRAW_STRINGS.brush, icon: 'draw' },
  { kind: 'marker', label: DRAW_STRINGS.marker, icon: 'marker' },
  { kind: 'neon', label: DRAW_STRINGS.neon, icon: 'ai-sparkle' },
  { kind: 'eraser', label: DRAW_STRINGS.eraser, icon: 'eraser' },
];

interface BrushKindView extends BrushKindOption {
  readonly selected: boolean;
}

/** Four-up brush type selector (Brush / Marker / Neon / Eraser) from the Draw board. */
@Component({
  selector: 'app-brush-kind-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './brush-kind-picker.component.html',
  styleUrl: './brush-kind-picker.component.scss',
})
export class BrushKindPickerComponent {
  public readonly kind = input.required<BrushKind>();
  public readonly kindChange = output<BrushKind>();

  protected readonly strings = DRAW_STRINGS;
  protected readonly options = computed<readonly BrushKindView[]>(() =>
    BRUSH_KIND_OPTIONS.map((option) => ({ ...option, selected: option.kind === this.kind() })),
  );
}
