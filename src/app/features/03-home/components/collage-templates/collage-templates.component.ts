import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { type CollageTemplate, type CollageTemplateId } from '@core/collage/collage.models';
import { COLLAGE_TEMPLATE_STRINGS } from '@core/collage/collage.strings';
import { COLLAGE_TEMPLATES } from '@core/collage/collage-templates';
import { APP_ROUTES } from '@core/config/app.constants';
import { CollageTemplateIconComponent } from '@features/05-editor/tools/11-collage/components/collage-template-icon.component';
import { PICKER_COLLAGE_QUERY_KEY } from '@features/04-picker/picker.models';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';

import { type TemplatesSection } from '../../home.config';
import { HOME_STRINGS } from '../../home.strings';

interface TemplateCard {
  readonly template: CollageTemplate;
  readonly caption: string;
  readonly label: string;
}

function toCard(template: CollageTemplate): TemplateCard {
  return {
    template,
    caption: COLLAGE_TEMPLATE_STRINGS.captions[template.id],
    label: HOME_STRINGS.templates.openLabel(COLLAGE_TEMPLATE_STRINGS.names[template.id]),
  };
}

/**
 * Home "Templates" (screen 03): the featured collage layouts as cards, and "See all" (a sheet
 * with every layout). Choosing one opens the picker in multi-select for that layout.
 */
@Component({
  selector: 'app-collage-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, CollageTemplateIconComponent],
  templateUrl: './collage-templates.component.html',
  styleUrl: './collage-templates.component.scss',
})
export class CollageTemplatesComponent {
  private readonly router = inject(Router);

  public readonly section = input.required<TemplatesSection>();

  protected readonly strings = HOME_STRINGS.templates;
  protected readonly allOpen = signal(false);
  protected readonly allCards = COLLAGE_TEMPLATES.map(toCard);
  protected readonly cards = computed(() =>
    this.section().featured.flatMap((id) =>
      this.allCards.filter((card) => card.template.id === id),
    ),
  );

  protected showAll(): void {
    this.allOpen.set(true);
  }

  protected open(id: CollageTemplateId): void {
    this.allOpen.set(false);
    void this.router.navigate([APP_ROUTES.picker], {
      queryParams: { [PICKER_COLLAGE_QUERY_KEY]: id },
    });
  }
}
