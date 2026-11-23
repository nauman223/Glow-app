import { readPluginErrorCode } from '@core/image/plugin-error';

import { type GlowStickersValidationReason } from './glow-stickers.plugin';

export type WhatsAppStickerErrorCode =
  | 'unsupported'
  | 'whatsapp-not-installed'
  | 'encode-failed'
  | 'sticker-too-large'
  | 'pack-full'
  | 'validation-failed'
  | 'not-found'
  | 'io-error'
  | 'invalid-argument'
  | 'unknown';

/** Every WhatsAppStickersService failure. User-facing text: WHATSAPP_ERROR_MESSAGES[code]. */
export class WhatsAppStickerError extends Error {
  public override readonly name = 'WhatsAppStickerError';

  constructor(
    public readonly code: WhatsAppStickerErrorCode,
    /** Native VALIDATION_FAILED reason, for logs and diagnostics. */
    public readonly reason: GlowStickersValidationReason | null = null,
    options?: ErrorOptions,
  ) {
    super(`WhatsApp sticker error: ${code}${reason === null ? '' : ` (${reason})`}`, options);
  }
}

const NATIVE_CODES: Readonly<Record<string, WhatsAppStickerErrorCode>> = {
  INVALID_ARGUMENT: 'invalid-argument',
  NOT_FOUND: 'not-found',
  IO_ERROR: 'io-error',
  WHATSAPP_NOT_INSTALLED: 'whatsapp-not-installed',
  VALIDATION_FAILED: 'validation-failed',
};

const REASON_CODES: Partial<Record<GlowStickersValidationReason, WhatsAppStickerErrorCode>> = {
  sticker_file_size: 'sticker-too-large',
  sticker_count: 'pack-full',
};

const VALIDATION_REASONS: ReadonlySet<string> = new Set<GlowStickersValidationReason>([
  'sticker_format',
  'sticker_dimensions',
  'sticker_file_size',
  'sticker_animated',
  'tray_format',
  'tray_dimensions',
  'tray_file_size',
  'tray_missing',
  'emoji',
  'sticker_count',
  'too_few_stickers',
  'pack_limit',
  'name',
  'publisher',
]);

function isValidationReason(value: unknown): value is GlowStickersValidationReason {
  return typeof value === 'string' && VALIDATION_REASONS.has(value);
}

/** Capacitor puts the plugin's reject `data` object on the error as `data`. */
function readReason(error: unknown): GlowStickersValidationReason | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) {
    return null;
  }
  const { data } = error;
  if (typeof data !== 'object' || data === null || !('reason' in data)) {
    return null;
  }
  return isValidationReason(data.reason) ? data.reason : null;
}

export function toWhatsAppStickerError(error: unknown): WhatsAppStickerError {
  if (error instanceof WhatsAppStickerError) {
    return error;
  }
  const code = readPluginErrorCode(error);
  const mapped = code === null ? undefined : NATIVE_CODES[code];
  const reason = mapped === 'validation-failed' ? readReason(error) : null;
  const refined = reason === null ? undefined : REASON_CODES[reason];
  return new WhatsAppStickerError(refined ?? mapped ?? 'unknown', reason, { cause: error });
}
