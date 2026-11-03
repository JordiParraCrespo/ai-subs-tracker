import { siteConfig } from '@/config/site';

/** The locale a request is in, the default when Astro reports none. */
export function currentLocale(locale: string | undefined): string {
  return locale && siteConfig.locales.includes(locale) ? locale : siteConfig.defaultLocale;
}

/** A path with any locale prefix taken off: `/es/codex-pricing/` → `/codex-pricing/`. */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] && siteConfig.locales.includes(segments[0])) segments.shift();
  const path = `/${segments.join('/')}`;
  return path === '/' ? path : `${path.replace(/\/$/, '')}/`;
}

/** `path` in `locale`: the default locale at `/`, the others under `/<lang>/`. */
export function localePath(locale: string, path: string): string {
  const clean = stripLocale(path);
  if (locale === siteConfig.defaultLocale) return clean;
  return clean === '/' ? `/${locale}/` : `/${locale}${clean}`;
}

/** An absolute URL on the canonical origin. */
export function absolute(path: string): string {
  return new URL(path, siteConfig.url).href;
}
