import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { type FormValueControl, type ValidationError } from '@angular/forms/signals';
import { FieldErrorsComponent } from '@shared/ui/field-errors/field-errors.component';

export type TextFieldType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'search';

let nextFieldId = 0;

/**
 * Labelled text input that plugs into signal forms: `<app-text-field [formField]="form.email" />`.
 * Errors are shown only after the field has been touched.
 */
@Component({
  selector: 'app-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldErrorsComponent],
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
})
export class TextFieldComponent implements FormValueControl<string> {
  public readonly value = model('');
  public readonly label = input.required<string>();
  public readonly type = input<TextFieldType>('text');
  public readonly hint = input<string | null>(null);
  public readonly placeholder = input('');
  public readonly autocomplete = input('off');

  // Bound automatically by the signal-forms [formField] directive.
  public readonly errors = input<readonly ValidationError[]>([]);
  public readonly disabled = input(false);
  public readonly readonly = input(false);
  public readonly required = input(false);
  public readonly touched = input(false);
  public readonly invalid = input(false);
  public readonly name = input('');
  public readonly touch = output();

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  protected readonly inputId = `app-text-field-${(nextFieldId++).toString()}`;
  protected readonly hintId = `${this.inputId}-hint`;
  protected readonly errorId = `${this.inputId}-error`;
  protected readonly showErrors = computed(() => this.touched() && this.invalid());
  protected readonly describedBy = computed(() => {
    const ids = [
      this.hint() === null ? null : this.hintId,
      this.showErrors() ? this.errorId : null,
    ];
    const joined = ids.filter((id) => id !== null).join(' ');
    return joined === '' ? null : joined;
  });

  public focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.value.set(event.target.value);
    }
  }

  protected onBlur(): void {
    this.touch.emit();
  }
}
