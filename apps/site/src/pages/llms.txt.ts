/**
 * llms.txt (https://llmstxt.org): a Markdown index of the site for LLMs and
 * agents — an H1, a summary, then `- [title](url): description` per page, in
 * every locale. The titles and descriptions are the pages' own SEO copy.
 */

import { type CollectionEntry, getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

import { siteConfig } from '@/config/site';
import { useTranslations } from '@/i18n';
import { guideSlug, guidesIn } from '@/lib/guides';
import { absolute, localePath } from '@/lib/locale';

export const GET: APIRoute = async () => {
  const legal = await getCollection('legal');
  const lines = [
    `# ${siteConfig.name[siteConfig.defaultLocale]}`,
    '',
    `> ${siteConfig.description[siteConfig.defaultLocale]}`,
    '',
    `Sitemap: ${absolute('/sitemap-index.xml')}`,
    '',
  ];
  for (const lang of siteConfig.locales) {
    const t = useTranslations(lang);
    const tag = siteConfig.hreflang[lang] ?? lang;
    lines.push(`## ${t('nav.home')} (${tag})`, '');
    lines.push(
      `- [${t('seo.home.title')}](${absolute(localePath(lang, '/'))}): ${t('seo.home.description')}`,
    );
    for (const guide of await guidesIn(lang)) {
      const url = absolute(localePath(lang, `/${guideSlug(guide)}/`));
      lines.push(`- [${guide.data.title}](${url}): ${guide.data.description}`);
    }
    for (const doc of legal.filter((e: CollectionEntry<'legal'>) => e.id.startsWith(`${lang}/`))) {
      const url = absolute(localePath(lang, `/legal/${doc.id.split('/').slice(1).join('/')}/`));
      lines.push(`- [${doc.data.title}](${url})`);
    }
    lines.push('');
  }
  return new Response(`${lines.join('\n').trimEnd()}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
