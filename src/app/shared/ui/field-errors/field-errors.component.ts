import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type ValidationError } from '@angular/forms/signals';

const DEFAULT_MESSAGES: Readonly<Partial<Record<string, string>>> = {
  required: 'This field is required.',
  email: 'Enter a valid email address.',
  minLength: 'This value is too short.',
  maxLength: 'This value is too long.',
  min: 'This value is too small.',
  max: 'This value is too large.',
  pattern: 'This value is not in the expected format.',
};

const FALLBACK_MESSAGE = 'This value is not valid.';

/** Renders signal-form validation errors with consistent, human-readable messages. */
@Component({
  selector: 'app-field-errors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (message of messages(); track message) {
      <div class="invalid-feedback d-block">{{ message }}</div>
    }
  `,
})
export class FieldErrorsComponent {
  public readonly errors = input<readonly ValidationError[]>([]);

  protected readonly messages = computed(() => {
    const unique = new Set(
      this.errors().map(
        (error) => error.message ?? DEFAULT_MESSAGES[error.kind] ?? FALLBACK_MESSAGE,
      ),
    );
    return [...unique];
  });
}
