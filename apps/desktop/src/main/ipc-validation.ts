import { isAbsolute } from 'node:path';
import {
  LOCAL_PROVIDER_IDS,
  type LocalProviderId,
  type ManualProviderId,
  UNOFFICIAL_USAGE_READERS,
} from '@flama/shared/subscriptions';
import { type Locale, resolveLocale } from './locale';

/**
 * Argument checks for every IPC handler: the renderer is web content, so
 * nothing it sends is trusted. Each parser throws `IpcArgumentError`.
 */

export class IpcArgumentError extends Error {
  override name = 'IpcArgumentError';
}

export const MAX_TOKEN_LENGTH = 4096;
export const MAX_ID_LENGTH = 200;
export const MAX_PATH_LENGTH = 1024;
export const MAX_URL_LENGTH = 2048;
/** A sign-in code pasted from a provider's page; Claude's is well under this. */
export const MAX_LOGIN_CODE_LENGTH = 512;
/** A GLM Coding Plan key is well under this. */
export const MAX_API_KEY_LENGTH = 512;

/** A pasted sign-in code: one line of printable text, never a second command. */
export function parseLoginCode(value: unknown): string {
  const code = parseBoundedString(value, MAX_LOGIN_CODE_LENGTH, 'sign-in code').trim();
  if (!code || !/^[\x21-\x7e]+$/.test(code)) throw new IpcArgumentError('Invalid sign-in code.');
  return code;
}

/** A provider with a login on this machine; a hand-tracked one (Z.AI) has none. */
export function parseProvider(value: unknown): LocalProviderId {
  if (typeof value === 'string' && (LOCAL_PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as LocalProviderId;
  }
  throw new IpcArgumentError('Unknown provider.');
}

/** A hand-tracked provider whose usage can be read with a key (Z.AI, BigModel). */
export function parseReaderProvider(value: unknown): ManualProviderId {
  if (typeof value === 'string' && Object.hasOwn(UNOFFICIAL_USAGE_READERS, value)) {
    return value as ManualProviderId;
  }
  throw new IpcArgumentError('Unknown provider.');
}

/** A ResetOwl account id: a UUID, the only thing a key is filed under. */
export function parseAccountId(value: unknown): string {
  const id = parseBoundedString(value, 36, 'account id').toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new IpcArgumentError('Invalid account id.');
  }
  return id;
}

/** A pasted Coding Plan key: one line of printable text, sent as a header value. */
export function parseApiKey(value: unknown): string {
  const key = parseBoundedString(value, MAX_API_KEY_LENGTH, 'API key').trim();
  if (key.length < 8 || !/^[\x21-\x7e]+$/.test(key)) throw new IpcArgumentError('Invalid API key.');
  return key;
}

export function parseBoundedString(value: unknown, max: number, what = 'value'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new IpcArgumentError(`Invalid ${what}.`);
  }
  return value;
}

export function parseToken(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const token = parseBoundedString(value, MAX_TOKEN_LENGTH, 'token');
  if (/\s/.test(token)) throw new IpcArgumentError('Invalid token.');
  return token;
}

export function parseHome(value: unknown): string {
  const home = parseBoundedString(value, MAX_PATH_LENGTH, 'folder');
  if (!isAbsolute(home) || home.includes('\0')) throw new IpcArgumentError('Invalid folder.');
  return home;
}

/** Only http(s) leaves the app; `file:`, `javascript:` and custom schemes do not. */
export function parseExternalUrl(value: unknown): string {
  const raw = parseBoundedString(value, MAX_URL_LENGTH, 'URL');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new IpcArgumentError('Invalid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new IpcArgumentError('Only http(s) links open outside the app.');
  }
  return url.toString();
}

/** True when the frame that sent a message is the app's own renderer. */
export function isTrustedSender(frameUrl: string | undefined, rendererOrigin: string): boolean {
  if (!frameUrl) return false;
  try {
    const url = new URL(frameUrl);
    // `app://resetowl` is a standard scheme, so URL gives it an origin of its own.
    const origin = url.origin !== 'null' ? url.origin : `${url.protocol}//${url.host}`;
    return origin === rendererOrigin;
  } catch {
    return false;
  }
}

/** A language tag from the screens (`es`, `es-ES`), as the supported locale it names. */
export function parseLocale(value: unknown): Locale {
  if (
    typeof value !== 'string' ||
    value.length > 35 ||
    !/^[A-Za-z]{2,8}([-_][A-Za-z0-9]{1,8})*$/.test(value)
  ) {
    throw new IpcArgumentError('Invalid language.');
  }
  return resolveLocale([value]);
}
