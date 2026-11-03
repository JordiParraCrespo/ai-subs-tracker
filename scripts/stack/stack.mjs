#!/usr/bin/env node
/**
 * The stack the e2e suites run against, stood up in one command:
 *
 *   node scripts/stack/stack.mjs up [--web] [--no-build] [--no-api]
 *   node scripts/stack/stack.mjs status
 *   node scripts/stack/stack.mjs down [--api | --keep-console]
 *   node scripts/stack/stack.mjs api-port-free
 *
 * `up` is Postgres and Redis, the API built from this checkout and migrated
 * and, with `--web`, the screens (Vite over this checkout's source) — the
 * steps `e2e/README.md` lists under "Running it", in order. The desktop app is
 * not a daemon: its suite (`e2e:desktop`) launches it against this stack.
 *
 * It leaves the checkout's own setup alone:
 *
 * - `.env` is never written. What the stack needs on top of it (mail to the
 *   log, which is where the suites read it) is handed to the API as
 *   environment, which wins over `.env` (`@flama/env`). A checkout with no
 *   `.env` gets `.env.example`'s defaults the same way, never as a file.
 * - Postgres and Redis already listening are used, not replaced; only a
 *   Compose project this script started (`resetowl-stack`) is stopped.
 *
 * Everything it starts is recorded in `.stack/`, with a log per process;
 * `down` stops exactly that, and `down --api` only the API it started, which
 * is how `pnpm ci:local` swaps in the API it built; `down --keep-console`
 * stops nothing while a console that `up --web` started is up, which is how
 * it leaves the screenshots' stack in place. `up --no-api` stops short of the
 * API: the services, so they can start while the API is still being built.
 * `api-port-free` fails when something the stack did not start answers on the
 * API's port.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = resolve(process.env.STACK_DIR ?? join(ROOT, '.stack'));
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
// flama:begin web
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
// flama:end web
const COMPOSE = [
  'compose',
  '--project-name',
  'resetowl-stack',
  '-f',
  join(ROOT, 'docker', 'docker-compose.dev.yml'),
];
const IMAGES = ['postgres:18-alpine', 'redis:8-alpine'];
/**
 * Docker Hub answers anonymous pulls from a shared address (a cloud sandbox,
 * CI) with 429. These serve the same official images; a pull from one is
 * retagged to the name the Compose file asks for.
 */
const MIRRORS = ['mirror.gcr.io/library/', 'public.ecr.aws/docker/library/'];
const isRoot = process.getuid?.() === 0;

const stateFile = join(STATE, 'state.json');

function log(message) {
  console.log(`stack: ${message}`);
}

function fail(message) {
  console.error(`stack: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...options });
}

function succeeds(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return { pids: {}, compose: false };
  }
}

function writeState(state) {
  mkdirSync(STATE, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * A long-lived process in its own process group, logging to `.stack/<name>.log`.
 * `down` stops the group: `pnpm` puts a child between the pid and the server.
 */
function daemon(name, command, args, env = {}) {
  mkdirSync(STATE, { recursive: true });
  const out = join(STATE, `${name}.log`);
  writeFileSync(out, '');
  const child = spawn('sh', ['-c', 'exec "$@" >>"$0" 2>&1', out, command, ...args], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...env },
  });
  child.unref();
  const state = readState();
  state.pids[name] = child.pid;
  writeState(state);
  return out;
}

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

async function httpOk(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitFor(what, check, { timeout = 60_000, logFile } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  const tail =
    logFile && existsSync(logFile) ? `\n${readFileSync(logFile, 'utf8').slice(-2_000)}` : '';
  fail(`${what} did not come up within ${timeout / 1000}s${tail}`);
}

// --------------------------------------------------------------- Postgres, Redis

/** Whether this call had to start the daemon. */
async function ensureDocker() {
  if (succeeds('docker', ['info'])) return false;
  // A cloud sandbox ships the daemon without starting it, or none at all.
  if (!isRoot || !succeeds('sh', ['-c', 'command -v dockerd'])) {
    fail(
      'neither Postgres (5432) and Redis (6379) nor a Docker daemon is running here. ' +
        'Start Docker, or start a local Postgres and Redis with a `flama` role and database ' +
        "matching .env.example's DB_* (`service postgresql start`, `service redis-server start`), " +
        'and run this again',
    );
  }
  log('starting dockerd');
  const out = daemon('dockerd', 'dockerd', []);
  await waitFor('dockerd', () => succeeds('docker', ['info']), { timeout: 30_000, logFile: out });
  return true;
}

function ensureImage(image) {
  if (succeeds('docker', ['image', 'inspect', image])) return;
  if (succeeds('docker', ['pull', '-q', image])) return;
  for (const mirror of MIRRORS) {
    if (succeeds('docker', ['pull', '-q', `${mirror}${image}`])) {
      run('docker', ['tag', `${mirror}${image}`, image]);
      log(`pulled ${image} from ${mirror}`);
      return;
    }
  }
  fail(`could not pull ${image} from Docker Hub or its mirrors`);
}

/**
 * Which of Postgres and Redis are already listening: `both` is someone's
 * running pair, used as it is; `neither` is ours to start; one without the
 * other is someone else's half-running setup, and starting a Compose project
 * beside it would leave two half-stacks, so the script refuses.
 */
async function infrastructure() {
  const postgres = await portOpen(5432);
  const redis = await portOpen(6379);
  if (postgres && redis) return 'both';
  if (!postgres && !redis) return 'neither';
  fail(
    `${postgres ? 'Postgres (5432)' : 'Redis (6379)'} is listening but ${
      postgres ? 'Redis (6379)' : 'Postgres (5432)'
    } is not; start or stop the other one yourself, then run this again`,
  );
}

async function startInfrastructure() {
  if ((await infrastructure()) === 'both') {
    log('Postgres and Redis are already listening; using them');
    return;
  }
  if (await ensureDocker()) {
    // A daemon that just started brings back containers set to restart —
    // `pnpm docker:dev`'s among them — and those may be the ones listening.
    for (let i = 0; i < 20 && !((await portOpen(5432)) && (await portOpen(6379))); i += 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if ((await infrastructure()) === 'both') {
      log('Postgres and Redis came back with the daemon; using them');
      return;
    }
  }
  for (const image of IMAGES) ensureImage(image);
  run('docker', [...COMPOSE, 'up', '-d', '--pull', 'never', 'postgres', 'redis']);
  writeState({ ...readState(), compose: true });
  // Over TCP: on a fresh volume the image first runs a socket-only server to
  // initialise the database, which answers pg_isready and then goes away.
  await waitFor('Postgres', () =>
    succeeds('docker', [
      ...COMPOSE,
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-h',
      '127.0.0.1',
      '-U',
      'flama',
    ]),
  );
  log('Postgres and Redis are up');
}

// ------------------------------------------------------------------- the API

function parseEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    // Verbatim, as `.env` would carry it: the API decodes its own escapes.
    if (match) env[match[1]] = match[2];
  }
  return env;
}

/**
 * What the API runs with on top of the checkout's `.env`. Mail goes to the
 * console, so the API's log (`.stack/api.log`) is the suites' mailbox. A
 * checkout with no `.env` gets `.env.example`'s defaults as environment; a
 * default is injected only for a key the shell does not set, or it would
 * silently replace the developer's value.
 */
function apiEnv() {
  const defaults = existsSync(join(ROOT, '.env')) ? {} : parseEnv(join(ROOT, '.env.example'));
  for (const key of Object.keys(process.env)) delete defaults[key];
  return { ...defaults, EMAIL_PROVIDER: 'console' };
}

const API_HEALTH = `${API_URL}/api/v1/health`;

async function startApi() {
  const env = apiEnv();
  run('pnpm', ['--filter', '@flama/api', 'migration:run'], { env: { ...process.env, ...env } });
  const out = daemon('api', 'node', ['apps/api/dist/main.js'], env);
  await waitFor('the API', () => httpOk(API_HEALTH), { logFile: out });
  log(`API on ${API_URL} (log: ${out})`);
}

// flama:begin web
async function startWeb() {
  const port = new URL(WEB_URL).port || '80';
  const out = daemon('web', 'pnpm', [
    '--filter',
    '@flama/web',
    'exec',
    'vite',
    '--port',
    port,
    '--strictPort',
  ]);
  await waitFor('the screens', () => httpOk(WEB_URL), { timeout: 120_000, logFile: out });
  log(`screens on ${WEB_URL} (log: ${out})`);
}
// flama:end web

// -------------------------------------------------------------------- commands

async function up(flags) {
  await startInfrastructure();
  // Asked once: what is already answering is left alone, and what is not is
  // built — in one turbo run — and started. Vite serves the app's own source
  // but resolves the workspace packages it imports from their `dist/`, so it
  // needs its dependencies built as much as the API does.
  const startsApi = !flags.has('--no-api') && !(await httpOk(API_HEALTH));
  const filters = startsApi ? ['--filter=@flama/api...'] : [];
  // flama:begin web
  const startsWeb = flags.has('--web') && !(await httpOk(WEB_URL));
  if (startsWeb) filters.push('--filter=@flama/web^...');
  // flama:end web
  if (filters.length && !flags.has('--no-build'))
    run('pnpm', ['turbo', 'run', 'build', ...filters], { stdio: 'inherit' });
  if (startsApi) await startApi();
  else if (flags.has('--no-api')) log('services up; the API is not started (--no-api)');
  else log(`the API is already answering on ${API_URL}; leaving it`);
  // flama:begin web
  if (startsWeb) await startWeb();
  // flama:end web
  log(`up. The API's log is ${join(STATE, 'api.log')}, where the suites read it`);
}

/**
 * Whether any process in the group is still running. A zombie is not: it has
 * exited and waits only for whoever inherited it to reap it, and counting it
 * would hold `down` for the full grace period.
 */
function groupAlive(pgid) {
  try {
    return run('ps', ['-A', '-o', 'pgid=,stat='])
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .some(([group, stat]) => Number(group) === pgid && stat && !stat.startsWith('Z'));
  } catch {
    return false;
  }
}

/** Stop a recorded process group and wait for it to go, killing it at 20 s. */
async function stop(pid) {
  if (!groupAlive(pid)) return;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    return;
  }
  for (let i = 0; i < 40 && groupAlive(pid); i += 1) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (groupAlive(pid)) process.kill(-pid, 'SIGKILL');
}

async function down(flags) {
  const state = readState();
  // A console this stack serves (`up --web`, for the screenshots) is in use:
  // `down --keep-console` then leaves the whole stack up, with whatever API it
  // runs now. `pnpm ci:local` ends with it.
  if (flags.has('--keep-console') && state.pids.web && groupAlive(state.pids.web)) {
    log('the screens are up on this stack; leaving the stack up');
    return;
  }
  if (flags.has('--api')) {
    if (state.pids.api) await stop(state.pids.api);
    delete state.pids.api;
    if (existsSync(stateFile)) writeState(state);
    log('the API is down; the rest of the stack is left as it was');
    return;
  }
  for (const name of ['web', 'api']) {
    if (state.pids[name]) await stop(state.pids[name]);
  }
  if (state.compose && succeeds('docker', ['info'])) run('docker', [...COMPOSE, 'down']);
  // Last, and waited for: a daemon still shutting down refuses the next `up`.
  if (state.pids.dockerd) await stop(state.pids.dockerd);
  rmSync(stateFile, { force: true });
  log('down');
}

async function status() {
  const rows = [
    ['postgres', await portOpen(5432)],
    ['redis', await portOpen(6379)],
    ['api', await httpOk(API_HEALTH)],
    // flama:begin web
    ['web', await httpOk(WEB_URL)],
    // flama:end web
  ];
  for (const [name, isUp] of rows) console.log(`${isUp ? 'up  ' : 'down'}  ${name}`);
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest);
// A failed step is one line naming the command and what it printed, not a
// stack trace from inside this script.
process.on('uncaughtException', (error) => {
  const output = [error.stderr, error.stdout].filter(Boolean).join('').trim();
  fail(`${error.message.split('\n')[0]}${output ? `\n${output.slice(-2_000)}` : ''}`);
});
switch (command) {
  case 'up':
    await up(flags);
    break;
  case 'status':
    await status();
    break;
  case 'down':
    await down(flags);
    break;
  case 'api-port-free': {
    const ours = readState().pids.api;
    if (await httpOk(API_HEALTH)) {
      if (ours && groupAlive(ours)) {
        log(`the API on ${API_URL} is this stack's`);
        break;
      }
      fail(
        `${API_HEALTH} answers, and the stack did not start it; stop that API and run this again`,
      );
    }
    log(`nothing answers on ${API_URL}`);
    break;
  }
  default:
    console.error(
      'usage: stack.mjs up [--web] [--no-build] [--no-api] | status | down [--api | --keep-console] | api-port-free',
    );
    process.exit(2);
}
