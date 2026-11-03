import type { FAQPage } from 'schema-dts';

import { absoluteUrl } from './types';

/** FAQPage for the questions a guide shows: only ones visible on the page. */
export function faqPageSchema(url: string, faq: { q: string; a: string }[]): FAQPage {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(url)}#faq`,
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
