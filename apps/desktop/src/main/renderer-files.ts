import { extname, join, normalize, sep } from 'node:path';

/**
 * Maps an `app://resetowl/<path>` request onto the renderer's folder. Pure:
 * `exists` is injected. A path that names no file is a client-side route of
 * the SPA and gets `index.html`, unless it looks like a file (null: a 404);
 * a path that tries to leave the root is null and never reaches the filesystem.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

export function mimeTypeFor(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export interface ResolvedFile {
  file: string;
  isHtml: boolean;
  /** True when the SPA fallback answered (the path named no file). */
  fallback: boolean;
}

export function resolveRendererFile(
  root: string,
  pathname: string,
  exists: (file: string) => boolean,
): ResolvedFile | null {
  const index = join(root, 'index.html');
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { file: index, isHtml: true, fallback: true };
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = join(root, relative);
  const inside = candidate === root || candidate.startsWith(root.endsWith(sep) ? root : root + sep);
  if (!inside) return null;
  if (relative === '' || relative === '.' || !exists(candidate)) {
    // A missing asset stays missing (a 404, not HTML the browser would try to run).
    if (looksLikeAsset(relative)) return null;
    return { file: index, isHtml: true, fallback: true };
  }
  return { file: candidate, isHtml: extname(candidate).toLowerCase() === '.html', fallback: false };
}

/** True for a request that looks like a file (`/assets/x.js`), which must not fall back to HTML. */
export function looksLikeAsset(pathname: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(pathname) && !pathname.endsWith('.html');
}
