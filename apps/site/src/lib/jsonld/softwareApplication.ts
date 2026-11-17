import type { SoftwareApplication } from 'schema-dts';

import { siteConfig } from '@/config/site';
import { absolute, localePath } from '@/lib/locale';

import { entityId } from './types';

/** The desktop app: free, for the three platforms electron-builder packages. */
export function softwareApplicationSchema(locale: string): SoftwareApplication {
  return {
    '@type': 'SoftwareApplication',
    '@id': entityId('app'),
    name: 'ResetOwl',
    description: siteConfig.description[locale] ?? siteConfig.description[siteConfig.defaultLocale],
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Windows, Linux',
    downloadUrl: absolute(localePath(locale, '/download/')),
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': entityId('organization') },
  };
}
