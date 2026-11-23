import { HttpContextToken } from '@angular/common/http';

/** Per-request timeout override in ms. `null` means use the environment default. */
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number | null>(() => null);

/** Number of retries for idempotent requests (2 retries = 3 attempts in total). */
export const MAX_RETRIES = new HttpContextToken<number>(() => 2);
