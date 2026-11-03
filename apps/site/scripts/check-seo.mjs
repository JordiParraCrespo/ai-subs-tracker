#!/usr/bin/env node
/**
 * Reads every built page in dist/ and fails the build on an SEO regression:
 *
 * - exactly one <h1>;
 * - a <title> of at most 70 characters and a meta description of 70–160;
 * - a canonical link to the page's own URL;
 * - hreflang alternates that include the page itself and are reciprocal
 *   (each alternate's own page links back), plus x-default;
 * - JSON-LD that parses, with a BreadcrumbList on every guide;
 * - no inline executable script (the CSP admits none).
 *
 * The 404 page is noindex and only held to the first and last rules.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const ORIGIN = 'https://subtrackhq.com';
const errors = [];
const fail = (page, message) => errors.push(`${page}: ${message}`);

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });

const urlOf = (file) => {
  const rel = relative(DIST, file).replace(/index\.html$/, '');
  return `${ORIGIN}/${rel}`;
};

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const pages = new Map();
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, 'utf8');
  pages.set(urlOf(file), { file, html });
}

for (const [url, { file, html }] of pages) {
  const page = relative(DIST, file);
  const h1s = html.match(/<h1\b/g)?.length ?? 0;
  if (h1s !== 1) fail(page, `${h1s} <h1> elements`);
  for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
    const type = attr(tag, 'type');
    if (!attr(tag, 'src') && type !== 'application/ld+json') fail(page, `inline script ${tag}`);
  }
  if (page === '404.html') continue;

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  if (!title || title.length > 70) fail(page, `title is ${title.length} characters`);
  const description =
    html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.replace(/&#39;/g, "'") ?? '';
  if (description.length < 70 || description.length > 160)
    fail(page, `description is ${description.length} characters`);

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical !== url) fail(page, `canonical ${canonical} is not ${url}`);

  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)];
  const hrefs = alternates.filter(([, lang]) => lang !== 'x-default').map(([, , href]) => href);
  if (!hrefs.includes(url)) fail(page, 'hreflang does not include the page itself');
  if (!alternates.some(([, lang]) => lang === 'x-default')) fail(page, 'no x-default');
  for (const href of hrefs) {
    const other = pages.get(href);
    if (!other) fail(page, `hreflang points at ${href}, which was not built`);
    else if (!other.html.includes(`href="${url}"`)) fail(page, `${href} does not link back`);
  }

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)) {
    try {
      const types = JSON.parse(json)['@graph'].map((n) => n['@type']);
      const guide =
        !page.startsWith('index') && !/^[a-z]{2}\/index/.test(page) && !page.includes('legal');
      if (guide && !types.includes('BreadcrumbList')) fail(page, 'guide without BreadcrumbList');
    } catch (error) {
      fail(page, `JSON-LD does not parse: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(`SEO check: ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  process.exit(1);
}
console.log(`SEO check: ${pages.size} pages pass.`);
