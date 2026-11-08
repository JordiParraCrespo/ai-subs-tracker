import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserWindow, protocol, shell } from 'electron';
import {
  APP_HOST,
  APP_ORIGIN,
  APP_SCHEME,
  contentSecurityPolicy,
  type DesktopConfig,
} from './config';
import { mimeTypeFor, resolveRendererFile } from './renderer-files';

/**
 * The window and the `app://resetowl/` origin it loads the screens from. The
 * scheme is standard and secure, so the screens get a real origin (storage,
 * fetch, CORS) without a local web server.
 */

/** Must run before `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Serves `root` on `app://resetowl/`, index.html for any route, a CSP on HTML. */
export function serveRenderer(root: string, apiUrl: string): void {
  const csp = contentSecurityPolicy(apiUrl);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
    const resolved = resolveRendererFile(root, url.pathname, isFile);
    if (!resolved) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(resolved.file);
      const headers: Record<string, string> = {
        'content-type': mimeTypeFor(resolved.file),
        'x-content-type-options': 'nosniff',
      };
      if (resolved.isHtml) {
        headers['content-security-policy'] = csp;
        headers['cache-control'] = 'no-cache';
      }
      return new Response(body, { status: 200, headers });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/** `process.resourcesPath/renderer` when packaged, else `apps/web/dist`. */
export function rendererRoot(isPackaged: boolean, resourcesPath: string, distDir: string): string {
  return isPackaged ? join(resourcesPath, 'renderer') : join(distDir, '..', '..', 'web', 'dist');
}

function isHttp(url: string): boolean {
  try {
    const { protocol: p } = new URL(url);
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin !== 'null' ? parsed.origin : `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * `iconPath` is the window's icon on Windows and on Linux under X11; macOS
 * takes the bundle's icon (the dock's in development is set in `index.ts`),
 * and a Wayland desktop takes the icon of the `.desktop` file whose name
 * matches `desktopName` in package.json.
 */
export function createMainWindow(
  config: DesktopConfig,
  preloadPath: string,
  iconPath: string,
  systemLocales: readonly string[],
): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'ResetOwl',
    icon: iconPath,
    backgroundColor: '#0b0b0c',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: [
        `--resetowl-bridge=${Buffer.from(
          JSON.stringify({
            version: config.version,
            platform: config.platform,
            apiUrl: config.apiUrl,
            systemLocales,
          }),
        ).toString('base64')}`,
      ],
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (originOf(url) === config.rendererOrigin) return;
    event.preventDefault();
    if (isHttp(url)) void shell.openExternal(url);
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.once('ready-to-show', () => win.show());

  void win.loadURL(config.rendererUrl ?? `${APP_ORIGIN}/`);
  return win;
}
