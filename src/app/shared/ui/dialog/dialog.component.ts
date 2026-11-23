import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { Platform } from '@ionic/angular/platform';
import { IconComponent } from '@shared/ui/icon/icon.component';
import { type IconName } from '@shared/ui/icon/icons';
import { type Subscription } from 'rxjs';

/** Higher than Ionic's router-outlet handler (0) and the bottom sheet (90): closes first. */
const DIALOG_BACK_BUTTON_PRIORITY = 100;

let nextDialogId = 0;

/**
 * Centered 28px-radius dialog: hero icon (or `[dialogHero]` content), title, body and a
 * stacked `[dialogActions]` slot. Focus is trapped while open and restored on close;
 * Escape, the backdrop and the Android back button close it when `dismissible`.
 */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, IconComponent],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
})
export class DialogComponent {
  private readonly platform = inject(Platform);

  public readonly open = model(false);
  public readonly heading = input.required<string>();
  /** Icon in the 64px tinted circle above the title; use `[dialogHero]` for custom art instead. */
  public readonly icon = input<IconName | null>(null);
  public readonly dismissible = input(true, { transform: booleanAttribute });

  public readonly closed = output();

  private readonly id = (nextDialogId++).toString();
  protected readonly titleId = `app-dialog-title-${this.id}`;
  protected readonly bodyId = `app-dialog-body-${this.id}`;

  constructor() {
    let backButtonSubscription: Subscription | null = null;
    effect(() => {
      backButtonSubscription?.unsubscribe();
      backButtonSubscription = this.open()
        ? this.platform.backButton.subscribeWithPriority(DIALOG_BACK_BUTTON_PRIORITY, () => {
            this.requestClose();
          })
        : null;
    });
    inject(DestroyRef).onDestroy(() => backButtonSubscription?.unsubscribe());
  }

  protected requestClose(): void {
    if (!this.dismissible() || !this.open()) {
      return;
    }
    this.open.set(false);
    this.closed.emit();
  }

  protected onContainerClick(event: MouseEvent): void {
    // Only clicks on the dimmed area (outside the dialog box) close it.
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }
}
