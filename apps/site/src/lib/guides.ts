import { type CollectionEntry, getCollection } from 'astro:content';

/**
 * The guides (`src/content/guides/<locale>/<slug>.mdx`): the pillar page and
 * its cluster. Every locale carries every slug, so a guide's URL differs only
 * by the locale prefix and hreflang pairs them one to one.
 */
export type Guide = CollectionEntry<'guides'>;

export const guideSlug = (entry: Guide) => entry.id.split('/').slice(1).join('/');

export async function guidesIn(locale: string): Promise<Guide[]> {
  const all = await getCollection('guides', (e: Guide) => e.id.startsWith(`${locale}/`));
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function guideBySlug(locale: string, slug: string): Promise<Guide | undefined> {
  return (await guidesIn(locale)).find((g) => guideSlug(g) === slug);
}
