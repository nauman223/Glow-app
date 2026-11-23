import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/ui/icon/icon.component';

/**
 * Press-and-hold Compare (presentational). A pointer shows the original while held; keyboard
 * and assistive activation (a click with no pointer hold) toggles it instead, as `aria-pressed`.
 */
@Component({
  selector: 'app-compare-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="compare"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-pressed]="comparing()"
      (pointerdown)="hold($event)"
      (pointerup)="release()"
      (pointercancel)="release()"
      (pointerleave)="release()"
      (click)="toggle($event)"
      (contextmenu)="$event.preventDefault()"
    >
      <app-icon name="eye" [size]="18" />
      {{ label() }}
    </button>
  `,
  styleUrl: './compare-button.component.scss',
})
export class CompareButtonComponent {
  public readonly label = input.required<string>();
  public readonly ariaLabel = input.required<string>();

  public readonly comparingChange = output<boolean>();

  protected readonly comparing = signal(false);
  private holding = false;

  protected hold(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.holding = true;
    this.set(true);
  }

  protected release(): void {
    if (this.holding) {
      this.holding = false;
      this.set(false);
    }
  }

  /** `detail` is 0 for keyboard and accessibility-service clicks (no pointer press). */
  protected toggle(event: MouseEvent): void {
    if (event.detail === 0) {
      this.set(!this.comparing());
    }
  }

  private set(comparing: boolean): void {
    if (this.comparing() !== comparing) {
      this.comparing.set(comparing);
      this.comparingChange.emit(comparing);
    }
  }
}
