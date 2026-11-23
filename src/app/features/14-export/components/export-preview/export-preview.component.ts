import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EXPORT_PAGE_STRINGS } from '../../export.strings';

/** Rounded preview of the document with its output pixel size underneath. */
@Component({
  selector: 'app-export-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-preview.component.html',
  styleUrl: './export-preview.component.scss',
})
export class ExportPreviewComponent {
  public readonly src = input<string | null>(null);
  public readonly sizeLabel = input<string>('');
  public readonly clamped = input(false, { transform: booleanAttribute });

  protected readonly strings = EXPORT_PAGE_STRINGS;
}
