/**
 * Everything the main process decides once at startup: where the API is,
 * where the screens come from, how it introduces itself, which diagnostic
 * mode it runs in. Pure, so the rules are tested without Electron.
 */

export const DEV_RENDERER_URL = 'http://localhost:3000';
export const LOCAL_API_URL = 'http://127.0.0.1:3001';
export const PRODUCTION_API_URL = 'https://api.resetowl.com';

/** The origin the packaged screens are served from (`protocol.ts`). */
export const APP_SCHEME = 'app';
export const APP_HOST = 'resetowl';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

export type RunMode = 'app' | 'collect-once' | 'smoke';

export interface DesktopConfig {
  version: string;
  platform: NodeJS.Platform;
  /** API origin without a trailing slash. */
  apiUrl: string;
  /** Honest: names ResetOwl, never claude-code or codex. */
  userAgent: string;
  /** A dev server to load instead of the bundled screens, or null. */
  rendererUrl: string | null;
  /** The origin IPC is accepted from: the dev server's, or `app://resetowl`. */
  rendererOrigin: string;
  mode: RunMode;
}

export interface ConfigInput {
  env: Record<string, string | undefined>;
  argv: readonly string[];
  isPackaged: boolean;
  version: string;
  platform: NodeJS.Platform;
}

function cleanUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Expected an http(s) URL, got ${value}`);
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function userAgentFor(version: string, platform: string): string {
  return `resetowl-desktop/${version} (${platform})`;
}

export function resolveConfig(input: ConfigInput): DesktopConfig {
  const { env, argv, isPackaged, version, platform } = input;
  const apiUrl = cleanUrl(
    env.RESETOWL_API_URL?.trim() || (isPackaged ? PRODUCTION_API_URL : LOCAL_API_URL),
  );

  let rendererUrl: string | null = null;
  if (env.RESETOWL_RENDERER_URL?.trim()) rendererUrl = cleanUrl(env.RESETOWL_RENDERER_URL.trim());
  else if (!isPackaged && argv.includes('--dev')) rendererUrl = DEV_RENDERER_URL;

  let mode: RunMode = 'app';
  if (argv.includes('--collect-once')) mode = 'collect-once';
  else if (argv.includes('--smoke')) mode = 'smoke';

  return {
    version,
    platform,
    apiUrl,
    userAgent: userAgentFor(version, platform),
    rendererUrl,
    rendererOrigin: rendererUrl ? new URL(rendererUrl).origin : APP_ORIGIN,
    mode,
  };
}

/** The renderer's Content-Security-Policy for the bundled screens. */
export function contentSecurityPolicy(apiUrl: string): string {
  const api = new URL(apiUrl).origin;
  return [
    "default-src 'self'",
    `connect-src 'self' ${api}`,
    `img-src 'self' data: ${api}`,
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self' data:",
  ].join('; ');
}
