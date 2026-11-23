import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { SkeletonComponent } from '@shared/ui/skeleton/skeleton.component';

import { type PassportCheck } from '../passport-checks';
import { type PassportGuides } from '../passport-geometry';
import { PASSPORT_STRINGS } from '../passport-photo.strings';

/**
 * Stage of board 33: the 300 dpi ID photo at its print aspect with the crown/chin lines and the
 * head oval over it (overlay only, never saved), and the photo checklist beside it.
 */
@Component({
  selector: 'app-passport-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonComponent],
  host: {
    '[style.--photo-aspect]': 'aspect()',
    '[style.--crown]': 'guides()?.crown',
    '[style.--chin]': 'guides()?.chin',
    '[style.--oval-x]': 'guides()?.ovalX',
    '[style.--oval-y]': 'guides()?.ovalY',
    '[style.--oval-w]': 'guides()?.ovalWidth',
    '[style.--oval-h]': 'guides()?.ovalHeight',
  },
  templateUrl: './passport-preview.component.html',
  styleUrl: './passport-preview.component.scss',
})
export class PassportPreviewComponent {
  public readonly src = input<string | null>(null);
  public readonly widthMm = input.required<number>();
  public readonly heightMm = input.required<number>();
  public readonly guides = input<PassportGuides | null>(null);
  public readonly checks = input<readonly PassportCheck[]>([]);
  public readonly busy = input(false);

  protected readonly strings = PASSPORT_STRINGS;
  protected readonly aspect = computed(() => this.widthMm() / this.heightMm());
  protected readonly items = computed(() =>
    this.checks().map((check) => ({
      ...check,
      label: this.strings.checks[check.id],
    })),
  );
}
