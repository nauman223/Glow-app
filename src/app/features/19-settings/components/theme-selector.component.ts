import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type ThemeMode } from '@core/theme/theme.service';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';

import { SETTINGS_STRINGS } from '../settings.strings';

interface ThemeOption {
  readonly mode: ThemeMode;
  readonly label: string;
  readonly icon: IconName;
}

const OPTIONS: readonly ThemeOption[] = [
  { mode: 'dark', label: SETTINGS_STRINGS.themeOptions.dark, icon: 'moon' },
  { mode: 'light', label: SETTINGS_STRINGS.themeOptions.light, icon: 'brightness' },
  { mode: 'system', label: SETTINGS_STRINGS.themeOptions.system, icon: 'contrast' },
];

/** Presentational radio group for choosing the theme. */
@Component({
  selector: 'app-theme-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './theme-selector.component.html',
  styleUrl: './theme-selector.component.scss',
})
export class ThemeSelectorComponent {
  public readonly mode = input.required<ThemeMode>();
  public readonly modeChange = output<ThemeMode>();

  protected readonly options = OPTIONS;
  protected readonly legend = SETTINGS_STRINGS.themeLegend;
}
