/**
 * JSON-LD builders (astro-ignite's), each returning a `schema-dts` object.
 * `<JsonLd schemas={[...]}>` renders them as one `@graph`, so `@id`
 * references across them resolve. Every page includes `siteSchemas(locale)`.
 */
import { organizationSchema } from './organization';
import type { IgniteSchema } from './types';
import { websiteSchema } from './website';

export { type Breadcrumb, breadcrumbListSchema } from './breadcrumbList';
export { faqPageSchema } from './faqPage';
export { softwareApplicationSchema } from './softwareApplication';
export { absoluteUrl, compact, entityId } from './types';
export { type WebPageInput, webPageSchema } from './webPage';
export type { IgniteSchema };
export { organizationSchema, websiteSchema };

export function siteSchemas(locale: string): IgniteSchema[] {
  return [organizationSchema(locale), websiteSchema(locale)];
}
