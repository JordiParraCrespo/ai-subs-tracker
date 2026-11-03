import { isAbsolute } from 'node:path';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';

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

/** A pasted sign-in code: one line of printable text, never a second command. */
export function parseLoginCode(value: unknown): string {
  const code = parseBoundedString(value, MAX_LOGIN_CODE_LENGTH, 'sign-in code').trim();
  if (!code || !/^[\x21-\x7e]+$/.test(code)) throw new IpcArgumentError('Invalid sign-in code.');
  return code;
}

export function parseProvider(value: unknown): ProviderId {
  if (typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as ProviderId;
  }
  throw new IpcArgumentError('Unknown provider.');
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
    // `app://subtrack` is a standard scheme, so URL gives it an origin of its own.
    const origin = url.origin !== 'null' ? url.origin : `${url.protocol}//${url.host}`;
    return origin === rendererOrigin;
  } catch {
    return false;
  }
}
