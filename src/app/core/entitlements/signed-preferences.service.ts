import { inject, Injectable } from '@angular/core';
import { InstallationIdService } from '@core/installation/installation-id.service';
import { type PreferenceKey, PreferencesService } from '@core/storage/preferences.service';

/**
 * Mixed into the signing key. It ships in the bundle, so it is not a secret: together with the
 * per-install id it only makes a value copied from another install, or edited by hand, fail.
 */
const APP_KEY_CONSTANT = 'glow.ledger.v1.6f3c1e9a';
const FORMAT_PREFIX = 'v1';

export type SignedRead<T> =
  | { readonly status: 'empty' }
  | { readonly status: 'ok'; readonly value: T }
  /** Bad signature, wrong install, or a payload that failed validation. */
  | { readonly status: 'tampered' };

/**
 * Preferences values that are obfuscated (base64url JSON) and tamper-evident (HMAC-SHA-256 over
 * the stored key and payload, keyed by the installation id + an app constant). Stored as
 * `v1.<payload>.<signature>`.
 *
 * Honest limit: everything needed to recompute the signature is on the device, so this deters
 * casual editing of SharedPreferences only. Anything worth money (AI credits) must be enforced
 * by the AI proxy, which receives the installation id with every job.
 */
@Injectable({ providedIn: 'root' })
export class SignedPreferencesService {
  private readonly preferences = inject(PreferencesService);
  private readonly installation = inject(InstallationIdService);
  private keyPromise: Promise<CryptoKey> | null = null;

  public async read<T>(
    key: PreferenceKey,
    isValid: (value: unknown) => value is T,
  ): Promise<SignedRead<T>> {
    const stored = await this.preferences.get(key);
    if (stored === null) {
      return { status: 'empty' };
    }
    const parts = stored.split('.');
    if (parts.length !== 3 || parts[0] !== FORMAT_PREFIX) {
      return { status: 'tampered' };
    }
    const [, payload, signature] = parts as [string, string, string];
    const expected = await this.sign(key, payload);
    if (!constantTimeEqual(expected, signature)) {
      return { status: 'tampered' };
    }
    const value = parseJson(fromBase64Url(payload));
    return isValid(value) ? { status: 'ok', value } : { status: 'tampered' };
  }

  public async write(key: PreferenceKey, value: unknown): Promise<void> {
    const payload = toBase64Url(JSON.stringify(value));
    const signature = await this.sign(key, payload);
    await this.preferences.set(key, `${FORMAT_PREFIX}.${payload}.${signature}`);
  }

  private async sign(key: PreferenceKey, payload: string): Promise<string> {
    const cryptoKey = await this.hmacKey();
    const data = new TextEncoder().encode(`${key}|${payload}`);
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return bytesToBase64Url(new Uint8Array(mac));
  }

  private hmacKey(): Promise<CryptoKey> {
    this.keyPromise ??= this.installation
      .ready()
      .then((installationId) =>
        crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(`${APP_KEY_CONSTANT}:${installationId}`),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        ),
      );
    return this.keyPromise;
  }
}

function parseJson(text: string | null): unknown {
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toBase64Url(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function fromBase64Url(encoded: string): string | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
