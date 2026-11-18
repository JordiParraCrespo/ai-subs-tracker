import { DESKTOP_RENDERER_ORIGIN, LEGACY_DESKTOP_RENDERER_ORIGIN } from '@flama/shared/desktop';

const DESKTOP_ORIGINS = new Set<string>([DESKTOP_RENDERER_ORIGIN, LEGACY_DESKTOP_RENDERER_ORIGIN]);

/**
 * The link an auth email carries, made to open in a browser.
 *
 * Better Auth's emailed link is the API's own URL with the page to land on
 * afterwards in `callbackURL`, which is the origin the request came from. Asked
 * from the desktop app that is `app://resetowl/…`: the app's private scheme,
 * which no browser and no operating system can open, so the link in the email
 * dead-ends at "no app can open this". The web app at `frontendUrl` has the
 * same routes (`/reset-password`, the verification landing), so a desktop
 * `callbackURL` is moved onto it, path and query kept. Any other link is
 * returned as it came: Better Auth has already held it to `trustedOrigins`.
 */
export function browserLinkFor(url: string, frontendUrl: string): string {
  let link: URL;
  let callback: URL;
  try {
    link = new URL(url);
    const raw = link.searchParams.get('callbackURL');
    if (!raw) return url;
    callback = new URL(raw);
  } catch {
    return url;
  }
  // Node gives a non-special scheme the origin "null" (only Electron registers
  // `app:` as standard), so the origin is spelled from its parts.
  if (!DESKTOP_ORIGINS.has(`${callback.protocol}//${callback.host}`)) return url;

  const web = new URL(`${callback.pathname}${callback.search}${callback.hash}`, frontendUrl);
  link.searchParams.set('callbackURL', web.toString());
  return link.toString();
}
