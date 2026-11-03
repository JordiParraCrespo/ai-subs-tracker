#!/usr/bin/env node
/**
 * The screens photographed for a pull request, in one command:
 *
 *   pnpm screens /dashboard /accounts anon:/login
 *   pnpm screens --phone /usage
 *   pnpm screens --empty /dashboard
 *   pnpm screens /accounts spec:edit-dialog
 *
 * Each route is taken light and dark into `.screenshots/` (git-ignored) by the
 * e2e `screens` project (`e2e/tests/screens/screens.spec.ts`), against the
 * stack `stack.mjs up --web` started, signed in as a fresh account that a
 * desktop sync has given two plans. `anon:` takes a route signed out;
 * `--empty` skips the sync, for an empty state; `--phone` adds a 390px width
 * to the 1440px one. `spec:<name>` runs `e2e/tests/screens/local/<name>.spec.ts`
 * beside the routes: a throwaway spec, git-ignored, that reaches a state a
 * route alone cannot (a dialog open, a row expanded) and screenshots it into
 * `.screenshots/`. Every run empties the folder first, so it never mixes two
 * runs, and writes `manifest.json` naming the commit the pictures are of.
 * Chromium is the machine's own where it ships one (`scripts/chromium.mjs`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromiumPath } from '../chromium.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(ROOT, '.screenshots');

const routes = [];
const env = { ...process.env };
for (const arg of process.argv.slice(2)) {
  if (arg === '--phone') env.SCREENS_WIDTHS = '1440,390';
  else if (arg === '--empty') env.SCREENS_EMPTY = '1';
  else if (arg.startsWith('-')) {
    console.error(`screens: unknown option ${arg}`);
    process.exit(2);
  } else routes.push(arg);
}
if (routes.length === 0) {
  console.error('screens: name at least one route, e.g. pnpm screens /dashboard');
  process.exit(2);
}
// flama:begin e2e
const specs = routes.filter((entry) => entry.startsWith('spec:'));
for (const route of specs) {
  const spec = resolve(ROOT, 'e2e/tests/screens/local', `${route.slice('spec:'.length)}.spec.ts`);
  if (!existsSync(spec)) {
    console.error(`screens: ${route} names no spec; write it to ${spec}`);
    process.exit(2);
  }
}
// flama:end e2e

const webUrl = new URL(process.env.WEB_URL ?? 'http://localhost:3000');
const up = await new Promise((done) => {
  const socket = connect({ port: Number(webUrl.port || 80), host: webUrl.hostname });
  socket.once('connect', () => {
    socket.destroy();
    done(true);
  });
  socket.once('error', () => done(false));
});
if (!up) {
  console.error(`screens: nothing on ${webUrl.origin}; run node scripts/stack/stack.mjs up --web`);
  process.exit(1);
}

// flama:begin e2e
// Every run starts empty, so the folder only ever holds pictures of this code.
rmSync(OUT, { recursive: true, force: true });
env.SCREENS = routes.join(',');
const chromium = chromiumPath(env);
if (chromium) env.PLAYWRIGHT_CHROMIUM_PATH = chromium;
const files = [
  'tests/screens/screens.spec.ts',
  ...specs.map((spec) => `tests/screens/local/${spec.slice('spec:'.length)}.spec.ts`),
];
const result = spawnSync('pnpm', ['--filter', '@flama/e2e', 'screens', ...files], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
if (result.status === 0) {
  const shots = resolve(OUT, 'shots.json');
  const taken = existsSync(shots) ? JSON.parse(readFileSync(shots, 'utf8')) : {};
  rmSync(shots, { force: true });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  writeFileSync(
    resolve(OUT, 'manifest.json'),
    `${JSON.stringify({ commit, uncommittedChanges: dirty.trim() !== '', ...taken }, null, 2)}\n`,
  );
  console.log(`screens: ${taken.files?.length ?? 0} pictures in ${OUT}`);
}
process.exit(result.status ?? 1);
// flama:end e2e
