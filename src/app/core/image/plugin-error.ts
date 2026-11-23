/** Reads the `code` of a Capacitor plugin rejection (native errors carry one; web ones may not). */
export function readPluginErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : '';
}

/**
 * Plugins report user cancellation as a rejection. Codes cover native; the message check covers
 * the web implementations ("User cancelled photos app") and Share on Android ("Share canceled").
 */
export function isCancellation(error: unknown, cancelCodes: readonly string[]): boolean {
  const code = readPluginErrorCode(error);
  if (code !== null && cancelCodes.includes(code)) {
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  return /cancel/i.test(readErrorMessage(error));
}
