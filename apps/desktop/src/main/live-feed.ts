import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { LiveFeedTarget } from '@flama/shared/desktop';

/**
 * The live feed (opt-in, reversible): Claude Code runs a status-line command
 * after each turn and hands it a JSON blob that includes `rate_limits`.
 * Subtrack's command is a tiny sh script that posts that blob to a server on
 * 127.0.0.1 (random port, random bearer secret, both baked into the script
 * each launch) and prints an empty line, so the person's status bar shows
 * nothing extra. When the app is not running `curl` fails silently within
 * two seconds.
 *
 * It is installed into `<home>/settings.json` only where there is no status
 * line already — someone else's is never replaced — and uninstalled only
 * when the one there is ours.
 */

export const STATUSLINE_PATH = '/statusline/claude';
export const CONFIG_DIR_HEADER = 'x-claude-config-dir';
const MAX_BODY_BYTES = 256 * 1024;

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function statuslineScript(port: number, secret: string): string {
  return [
    '#!/bin/sh',
    '# Subtrack live feed: forwards Claude Code status-line JSON (which carries the',
    '# rate-limit windows) to the Subtrack app on this machine. Prints an empty line,',
    '# so nothing shows in the status bar. Remove `statusLine` from settings.json',
    '# (or use "Live feed" in Subtrack) to turn it off.',
    `curl -s -m 2 -o /dev/null -X POST \\`,
    `  -H ${shQuote(`Authorization: Bearer ${secret}`)} \\`,
    `  -H 'Content-Type: application/json' \\`,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion, not a template
    '  -H "X-Claude-Config-Dir: ${CLAUDE_CONFIG_DIR:-$HOME/.claude}" \\',
    '  --data-binary @- \\',
    `  ${shQuote(`http://127.0.0.1:${port}${STATUSLINE_PATH}`)} >/dev/null 2>&1 || true`,
    'echo',
    '',
  ].join('\n');
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when this `statusLine` value runs our script. */
/**
 * The status-line command for the script: single-quoted, because Claude Code
 * runs it through a shell and the macOS path has a space in it
 * (`~/Library/Application Support/Subtrack/statusline.sh`).
 */
export function statusLineCommand(scriptPath: string): string {
  return `'${scriptPath.replaceAll("'", `'\\''`)}'`;
}

/** Ours in either form: quoted, or the bare path earlier builds wrote. */
export function isOurStatusLine(value: unknown, scriptPath: string): boolean {
  return (
    isRecord(value) &&
    value.type === 'command' &&
    (value.command === statusLineCommand(scriptPath) || value.command === scriptPath)
  );
}

async function readSettings(home: string): Promise<{ data: Json; raw: string | null }> {
  let raw: string;
  try {
    raw = await readFile(join(home, 'settings.json'), 'utf8');
  } catch {
    return { data: {}, raw: null };
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error(`${home}/settings.json is not a JSON object`);
  return { data: parsed, raw };
}

function indentOf(raw: string | null): number {
  const match = raw?.match(/\n( +)"/);
  return match?.[1]?.length ?? 2;
}

export async function liveFeedTarget(home: string, scriptPath: string): Promise<LiveFeedTarget> {
  try {
    const { data } = await readSettings(home);
    const installed = isOurStatusLine(data.statusLine, scriptPath);
    return { home, installed, available: installed || data.statusLine === undefined };
  } catch {
    // Unreadable JSON: never touch it.
    return { home, installed: false, available: false };
  }
}

/** Adds our status line when there is none; anything else is left exactly as it was. */
export async function installLiveFeed(home: string, scriptPath: string): Promise<LiveFeedTarget> {
  const target = await liveFeedTarget(home, scriptPath);
  if (target.installed || !target.available) return target;
  const { data, raw } = await readSettings(home);
  const next = { ...data, statusLine: { type: 'command', command: statusLineCommand(scriptPath) } };
  await writeFile(join(home, 'settings.json'), `${JSON.stringify(next, null, indentOf(raw))}\n`);
  return { home, installed: true, available: true };
}

/** Removes the status line only when it is ours. */
export async function uninstallLiveFeed(home: string, scriptPath: string): Promise<LiveFeedTarget> {
  const target = await liveFeedTarget(home, scriptPath);
  if (!target.installed) return target;
  const { data, raw } = await readSettings(home);
  const { statusLine: _ours, ...rest } = data;
  await writeFile(join(home, 'settings.json'), `${JSON.stringify(rest, null, indentOf(raw))}\n`);
  return { home, installed: false, available: true };
}

export interface LiveFeedServer {
  port: number;
  secret: string;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolveBody(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolveBody(null));
  });
}

function sameSecret(header: string | undefined, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Listens on 127.0.0.1:<random>; `onPayload` gets the config dir and the raw JSON. */
export async function startLiveFeedServer(
  onPayload: (configDir: string, body: string) => void,
): Promise<LiveFeedServer> {
  const secret = randomBytes(32).toString('hex');
  const server: Server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== STATUSLINE_PATH) {
      res.writeHead(404).end();
      return;
    }
    if (!sameSecret(req.headers.authorization, secret)) {
      res.writeHead(401).end();
      return;
    }
    const configDir = req.headers[CONFIG_DIR_HEADER];
    const body = await readBody(req);
    if (typeof configDir !== 'string' || !configDir || body === null) {
      res.writeHead(400).end();
      return;
    }
    res.writeHead(204).end();
    onPayload(configDir, body);
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const { port } = server.address() as AddressInfo;
  return {
    port,
    secret,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
