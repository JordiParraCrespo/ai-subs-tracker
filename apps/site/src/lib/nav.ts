import type { TranslationKey } from '@/i18n';

import { localePath } from './locale';

/** The header's links: two home-page sections and the guide hub. */
export function headerNav(locale: string): { href: string; key: TranslationKey }[] {
  const home = localePath(locale, '/');
  return [
    { href: `${home}#features`, key: 'nav.features' },
    { href: `${home}#how`, key: 'nav.how' },
    { href: localePath(locale, '/claude-code-usage-tracker/'), key: 'nav.guides' },
  ];
}
