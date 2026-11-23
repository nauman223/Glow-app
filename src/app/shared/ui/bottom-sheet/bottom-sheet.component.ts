import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { Platform } from '@ionic/angular/platform';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type Subscription } from 'rxjs';

import { BOTTOM_SHEET_STRINGS } from './bottom-sheet.strings';
import { SheetDragDirective } from './sheet-drag.directive';

/**
 * Above Ionic's router-outlet handler (0) so an open sheet closes before navigating back,
 * below the dialog (100) so a dialog opened from a sheet closes first.
 */
const SHEET_BACK_BUTTON_PRIORITY = 90;

let nextSheetId = 0;

/**
 * Bottom sheet used by every editor tool panel.
 *
 * - Default (docked) mode: rendered in flow with no scrim, so it sits under the canvas
 *   without covering it; focus moves in on open and back on close.
 * - `modal` mode: fixed above the ad slot with a scrim, `aria-modal` and a focus trap.
 *
 * Slots: `[sheetHeader]` (actions beside the title), default body, `[sheetFooter]`.
 * Closes with the drag handle (drag or activate), Escape, the Android back button and,
 * in modal mode, the scrim.
 */
@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, IconComponent, SheetDragDirective],
  templateUrl: './bottom-sheet.component.html',
  styleUrl: './bottom-sheet.component.scss',
})
export class BottomSheetComponent {
  private readonly platform = inject(Platform);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  public readonly open = model(false);
  /** Visible title; also labels the dialog. */
  public readonly heading = input<string | null>(null);
  /** Accessible name when there is no visible heading (tool panels titled by the top bar). */
  public readonly label = input<string | null>(null);
  public readonly modal = input(false, { transform: booleanAttribute });
  public readonly dismissible = input(true, { transform: booleanAttribute });
  public readonly showClose = input(false, { transform: booleanAttribute });

  public readonly closed = output();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private returnFocusTo: HTMLElement | null = null;

  protected readonly strings = BOTTOM_SHEET_STRINGS;
  protected readonly titleId = `app-sheet-title-${(nextSheetId++).toString()}`;
  protected readonly labelledBy = computed(() => (this.heading() === null ? null : this.titleId));
  protected readonly ariaLabel = computed(() => (this.heading() === null ? this.label() : null));
  protected readonly ariaModal = computed(() => (this.modal() ? 'true' : null));
  protected readonly closeVisible = computed(() => this.showClose() && this.dismissible());

  constructor() {
    let backButtonSubscription: Subscription | null = null;
    effect(() => {
      backButtonSubscription?.unsubscribe();
      backButtonSubscription = this.open()
        ? this.platform.backButton.subscribeWithPriority(SHEET_BACK_BUTTON_PRIORITY, () => {
            this.requestClose();
          })
        : null;
    });
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (isOpen) {
          this.moveFocusIn();
        } else {
          this.restoreFocus();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      backButtonSubscription?.unsubscribe();
      this.restoreFocus();
    });
  }

  protected requestClose(): void {
    if (!this.dismissible() || !this.open()) {
      return;
    }
    this.open.set(false);
    this.closed.emit();
  }

  private moveFocusIn(): void {
    const active = this.document.activeElement;
    this.returnFocusTo = active instanceof HTMLElement ? active : null;
    afterNextRender(
      () => {
        this.panel()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  private restoreFocus(): void {
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    if (target?.isConnected) {
      target.focus();
    }
  }
}
