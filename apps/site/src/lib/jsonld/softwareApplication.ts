import type { SoftwareApplication } from 'schema-dts';

import { links, siteConfig } from '@/config/site';

import { entityId } from './types';

/** The desktop app: free, for the three platforms electron-builder packages. */
export function softwareApplicationSchema(locale: string): SoftwareApplication {
  return {
    '@type': 'SoftwareApplication',
    '@id': entityId('app'),
    name: 'Subtrack',
    description: siteConfig.description[locale] ?? siteConfig.description[siteConfig.defaultLocale],
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Windows, Linux',
    downloadUrl: links.download,
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': entityId('organization') },
  };
}
