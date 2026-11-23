import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { ScrollFadeDirective } from '@shared/ui/scroll-fade/scroll-fade.directive';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  /** Rendered before the label (e.g. the lock on a Pro tab). */
  readonly icon?: IconName;
  /** Gold label for a Pro pack tab. */
  readonly pro?: boolean;
  /** Read after the label by screen readers only (e.g. "locked" on a locked Pro tab). */
  readonly srSuffix?: string;
}

interface TabView<T extends string> extends TabItem<T> {
  readonly domId: string;
  readonly selected: boolean;
}

/** `fill`: equal columns (Text board); `scroll`: content-width tabs that scroll (Stickers). */
export type TabStripLayout = 'fill' | 'scroll';

export function tabDomId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

export function tabPanelDomId(prefix: string): string {
  return `${prefix}-panel`;
}

/**
 * WAI-ARIA tablist with automatic activation: arrow keys (mirrored in RTL), Home and End move
 * focus and selection. The caller renders one `role="tabpanel"` with id `tabPanelDomId(prefix)`
 * labelled by `tabDomId(prefix, selected)`.
 */
@Component({
  selector: 'app-tab-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ScrollFadeDirective],
  templateUrl: './tab-strip.component.html',
  styleUrl: './tab-strip.component.scss',
})
export class TabStripComponent<T extends string> {
  public readonly tabs = input.required<readonly TabItem<T>[]>();
  public readonly selected = model.required<T>();
  public readonly prefix = input.required<string>();
  public readonly label = input.required<string>();
  public readonly layout = input<TabStripLayout>('fill');

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected readonly scrollable = computed(() => this.layout() === 'scroll');
  protected readonly panelId = computed(() => tabPanelDomId(this.prefix()));
  protected readonly views = computed<readonly TabView<T>[]>(() =>
    this.tabs().map((tab) => ({
      ...tab,
      domId: tabDomId(this.prefix(), tab.id),
      selected: tab.id === this.selected(),
    })),
  );

  protected select(id: T): void {
    this.selected.set(id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    const rtl = event.target instanceof Element && event.target.matches(':dir(rtl)');
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let target: number | null = null;
    if (event.key === forward) {
      target = (index + 1) % tabs.length;
    } else if (event.key === backward) {
      target = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = tabs.length - 1;
    }
    const tab = target === null ? undefined : tabs[target];
    if (target === null || tab === undefined) {
      return;
    }
    event.preventDefault();
    this.select(tab.id);
    this.buttons()[target]?.nativeElement.focus();
  }
}
