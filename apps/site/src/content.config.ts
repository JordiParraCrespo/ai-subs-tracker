/**
 * Content collections (astro-ignite's layout: `<collection>/<locale>/<slug>`).
 *
 * - `guides`: the pillar page and its cluster. Title ≤70 and description
 *   70–160 characters, so every page's search snippet fits; `faq` renders as
 *   a visible FAQ and as FAQPage structured data; `related` names other
 *   guides' slugs for the internal links at the end.
 * - `legal`: privacy and terms.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const guides = defineCollection({
  loader: glob({ pattern: '*/*.mdx', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(70).max(160),
    /** The page's h1; the title is what the search result shows. */
    heading: z.string().min(1),
    eyebrow: z.string().min(1),
    lede: z.string().min(1),
    /** Its card in the guide hub. */
    summary: z.string().min(1).max(180),
    order: z.number().int(),
    /** When the facts on the page were last checked against the vendors. */
    checked: z.coerce.date(),
    faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).default([]),
    related: z.array(z.string()).default([]),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '*/*.mdx', base: './src/content/legal' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    lastUpdated: z.coerce.date(),
    version: z.string().default('1.0'),
  }),
});

export const collections = { guides, legal };
