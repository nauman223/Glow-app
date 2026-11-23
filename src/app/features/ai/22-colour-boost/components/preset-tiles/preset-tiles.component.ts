import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type ColourBoostPresetId, PRESET_ORDER } from '../../colour-boost.presets';
import { COLOUR_BOOST_STRINGS } from '../../colour-boost.strings';
import { type PresetThumbnails } from '../../colour-boost.service';

interface PresetTile {
  readonly id: ColourBoostPresetId;
  readonly label: string;
  readonly thumbnail: string | null;
  readonly selected: boolean;
}

/**
 * The look tiles of board 22: a preview of the photo in each look, its name below. Toggle
 * buttons (one pressed), like the AI chips; a skeleton shows until the previews are rendered.
 */
@Component({
  selector: 'app-preset-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ScrollFadeDirective],
  imports: [SkeletonComponent],
  host: { role: 'group', '[attr.aria-label]': 'strings.presetsLabel' },
  templateUrl: './preset-tiles.component.html',
  styleUrl: './preset-tiles.component.scss',
})
export class PresetTilesComponent {
  public readonly value = input.required<ColourBoostPresetId>();
  public readonly thumbnails = input.required<PresetThumbnails>();
  public readonly disabled = input(false);

  public readonly selected = output<ColourBoostPresetId>();

  protected readonly strings = COLOUR_BOOST_STRINGS;
  protected readonly tiles = computed<readonly PresetTile[]>(() =>
    PRESET_ORDER.map((id) => ({
      id,
      label: this.strings.presets[id],
      thumbnail: this.thumbnails()[id] ?? null,
      selected: id === this.value(),
    })),
  );

  protected select(id: ColourBoostPresetId): void {
    if (!this.disabled() && id !== this.value()) {
      this.selected.emit(id);
    }
  }
}
