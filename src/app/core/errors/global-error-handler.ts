import { type ErrorHandler, inject, Injectable } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { ToastService } from '@core/notifications/toast.service';

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** Catches every uncaught error, logs it and shows a friendly, non-blocking message. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly toasts = inject(ToastService);

  public handleError(error: unknown): void {
    this.logger.error('Uncaught error', error);
    this.toasts.show(UNEXPECTED_ERROR_MESSAGE, { variant: 'danger' });
  }
}
