#!/usr/bin/env node
/**
 * Writes the page's HTML into the built `index.html`.
 *
 * `vite build` leaves `<!--app-->` where the page goes and `vite build --ssr`
 * bundles `src/entry-server.tsx`; this renders that bundle once and puts the
 * markup in place, so the site is readable — and indexable — before a byte of
 * script runs. The client entry then hydrates the same tree. The server bundle
 * is removed afterwards: nothing serves it, and it must not ship in `dist/`.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(app, 'dist', 'index.html');
const serverDir = join(app, 'dist-server');

const { render } = await import(pathToFileURL(join(serverDir, 'entry-server.js')).href);
const template = readFileSync(htmlPath, 'utf8');
if (!template.includes('<!--app-->')) {
  console.error('prerender: dist/index.html has no <!--app--> placeholder');
  process.exit(1);
}
writeFileSync(htmlPath, template.replace('<!--app-->', render()));
rmSync(serverDir, { recursive: true, force: true });
console.log('prerender: wrote dist/index.html');
