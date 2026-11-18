import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { CliVersion, DesktopVersions } from '@flama/shared/desktop';
import type { LocalProviderId } from '@flama/shared/subscriptions';
import { cleanCliEnv } from '@flama/usage-providers';
import { stripTerminal } from './add-login';

/**
 * The versions the settings screen lists: ResetOwl's, the runtime it ships
 * (Electron, Chromium, Node, V8), the operating system's, and each vendor
 * CLI's as `<command> --version` reports it. Running `--version` reads no
 * login and spends no usage.
 */

/** How long a CLI may take to print its version. */
export const VERSION_TIMEOUT_MS = 10_000;
/** Enough for any version line; the rest is not read. */
const MAX_OUTPUT = 4096;

const OS_NAMES: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

/** `macOS 15.1 (arm64)`, from the platform, its version and the CPU. */
export function osLabel(platform: string, systemVersion: string, arch: string): string {
  const name = OS_NAMES[platform as NodeJS.Platform] ?? platform;
  return `${name} ${systemVersion} (${arch})`.replace(/\s+/g, ' ');
}

/**
 * The version in what a CLI printed (`2.1.0 (Claude Code)`, `codex-cli
 * 0.46.0`): the first dotted number, with a pre-release or build suffix;
 * null when there is none.
 */
export function parseCliVersion(output: string): string | null {
  const match = stripTerminal(output).match(/\b\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/);
  return match ? match[0] : null;
}

export interface CliVersionDeps {
  /** The base environment (PATH as the login shell sets it). */
  env: Record<string, string | undefined>;
  spawn?: typeof nodeSpawn;
  timeoutMs?: number;
  platform?: NodeJS.Platform;
}

/** Runs `<command> --version`; null when it is not installed, fails or hangs. */
export function readCliVersion(command: string, deps: CliVersionDeps): Promise<string | null> {
  const spawn = deps.spawn ?? nodeSpawn;
  const platform = deps.platform ?? process.platform;
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    let child: ChildProcess;
    const finish = (version: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(version);
    };
    try {
      child = spawn(command, ['--version'], {
        env: cleanCliEnv(deps.env),
        cwd: tmpdir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // `codex` is an npm shim (`codex.cmd`) on Windows.
        shell: platform === 'win32',
      });
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, deps.timeoutMs ?? VERSION_TIMEOUT_MS);
    const collect = (chunk: Buffer | string) => {
      if (output.length < MAX_OUTPUT) output += String(chunk);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code === 0 ? parseCliVersion(output) : null));
  });
}

export interface VersionsInput {
  app: string;
  /** `process.versions` in the main process. */
  runtime: { electron?: string; chrome?: string; node?: string; v8?: string };
  os: string;
  /** The local providers, in display order, and the command each runs. */
  clis: readonly { provider: LocalProviderId; command: string }[];
  readVersion(command: string): Promise<string | null>;
}

/** Every version at once; the CLIs are asked in parallel. */
export async function collectVersions(input: VersionsInput): Promise<DesktopVersions> {
  const clis: CliVersion[] = await Promise.all(
    input.clis.map(async ({ provider, command }) => ({
      provider,
      command,
      version: await input.readVersion(command).catch(() => null),
    })),
  );
  return {
    app: input.app,
    electron: input.runtime.electron ?? '',
    chrome: input.runtime.chrome ?? '',
    node: input.runtime.node ?? '',
    v8: input.runtime.v8 ?? '',
    os: input.os,
    clis,
  };
}
