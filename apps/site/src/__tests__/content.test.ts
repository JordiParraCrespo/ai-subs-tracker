import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MODEL_PRICES, PLANS } from '@flama/shared/subscriptions';
import { describe, expect, it } from 'vitest';

import { siteConfig } from '../config/site';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

/**
 * The site's copy, read as source. What these protect is what a search
 * engine and a reader see: both languages saying the same things, links that
 * land, and no price on a page that the plan catalog does not hold.
 */
const ROOT = join(import.meta.dirname, '..');
const GUIDES = join(ROOT, 'content/guides');

const keys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const guides = (locale: string) =>
  readdirSync(join(GUIDES, locale)).map((file) => ({
    slug: file.replace(/\.mdx$/, ''),
    body: readFileSync(join(GUIDES, locale, file), 'utf8'),
  }));

describe('the dictionaries', () => {
  it('give Spanish every key English has, and nothing else', () => {
    // Regression: a key added to en.json alone renders as its dotted path in Spanish.
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
});

describe('the guides', () => {
  it('exist under the same slugs in every locale, so hreflang pairs them', () => {
    const slugs = siteConfig.locales.map((l) =>
      guides(l)
        .map((g) => g.slug)
        .sort(),
    );
    for (const list of slugs) expect(list).toEqual(slugs[0]);
    expect(slugs[0]?.length).toBeGreaterThanOrEqual(5);
  });

  it('link only to pages that exist, in their own locale', () => {
    const slugs = new Set(guides(siteConfig.defaultLocale).map((g) => g.slug));
    const pages = new Set(['', ...slugs, 'legal/privacy', 'legal/terms']);
    for (const locale of siteConfig.locales) {
      const prefix = locale === siteConfig.defaultLocale ? '' : `/${locale}`;
      for (const { slug, body } of guides(locale)) {
        const links = [...body.matchAll(/\]\((\/[^)#]*)\)/g)].map((m) => m[1] as string);
        for (const href of links) {
          // A Spanish page linking to an English URL drops the reader out of their language.
          expect(href.startsWith(`${prefix}/`), `${locale}/${slug}: ${href}`).toBe(true);
          const page = href.slice(prefix.length).replace(/^\/|\/$/g, '');
          expect(pages.has(page), `${locale}/${slug}: ${href}`).toBe(true);
        }
        for (const related of body.match(/^related: \[(.*)\]$/m)?.[1]?.split(',') ?? []) {
          expect(slugs.has(related.trim()), `${locale}/${slug}: related ${related}`).toBe(true);
        }
      }
    }
  });

  it('state no dollar price the plan catalog or the API rates do not hold', () => {
    // Regression: a price typed into prose outlives the catalog row it came from.
    const known = new Set([
      ...PLANS.flatMap((p) => (p.monthlyPriceCents === null ? [] : [p.monthlyPriceCents / 100])),
      ...MODEL_PRICES.flatMap((m) => [m.input, m.output, m.cacheRead]),
    ]);
    for (const locale of siteConfig.locales) {
      for (const { slug, body } of guides(locale)) {
        const prices = [
          ...body.matchAll(/\$(\d[\d,]*(?:\.\d+)?)/g),
          ...body.matchAll(/(\d[\d.]*(?:,\d+)?) \$/g),
        ].map((m) => Number((m[1] as string).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')));
        for (const price of prices) {
          expect(known.has(price), `${locale}/${slug}: $${price}`).toBe(true);
        }
      }
    }
  });
});
