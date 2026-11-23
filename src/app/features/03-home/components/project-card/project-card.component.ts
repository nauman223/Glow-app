import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

/** Display data for one Recent projects card (prepared by the container). */
export interface ProjectCardView {
  readonly id: string;
  readonly title: string;
  readonly dateLabel: string;
  readonly openLabel: string;
  readonly optionsLabel: string;
  readonly thumbnailUrl: string | null;
}

/**
 * Thumbnail, title, date and a 3-dot options button (screen 03). Presentational. The thumbnail is
 * a plain lazy `<img>`: its source is a local file/object URL that NgOptimizedImage cannot
 * optimize, and it is already a 320 px JPEG.
 */
@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { '[class.project-card-host--fluid]': 'fluid()' },
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
})
export class ProjectCardComponent {
  public readonly project = input.required<ProjectCardView>();
  /** Fills its grid cell (See all sheet) instead of the fixed 140 px row width. */
  public readonly fluid = input(false, { transform: booleanAttribute });
  public readonly disabled = input(false, { transform: booleanAttribute });

  public readonly opened = output<string>();
  public readonly optionsRequested = output<string>();
}
