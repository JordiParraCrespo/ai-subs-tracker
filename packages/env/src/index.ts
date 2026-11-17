import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export interface LoadEnvOptions {
  /** Directory to start the workspace-root search from. Defaults to `process.cwd()`. */
  cwd?: string;
}

export interface LoadEnvResult {
  /** The workspace root that was found, or `null` if none (in which case nothing was loaded). */
  root: string | null;
  /** Absolute paths of the env files that existed and were read, in load order. */
  loaded: string[];
  /** Keys that were written into `process.env` (keys already present are never touched). */
  applied: string[];
}

const FILE_SUFFIX = '_FILE';

/**
 * Resolve `<NAME>_FILE` variables: for each one whose `<NAME>` is unset, read
 * the file it names and set `<NAME>` to its contents, trailing newline
 * trimmed. This is the Docker secrets convention (Postgres' own image reads
 * `POSTGRES_PASSWORD_FILE` the same way), so a secret can be a file mounted
 * into the container instead of a value in its environment, where
 * `docker inspect` and every child process would see it. A `<NAME>` that is
 * already set wins, like any real variable. A `_FILE` naming a file that
 * cannot be read throws: a missing secret must stop the process, not let it
 * start on a default.
 */
export function resolveFileVariables(env: NodeJS.ProcessEnv = process.env): string[] {
  const applied: string[] = [];
  for (const [fileKey, filePath] of Object.entries(env)) {
    if (!fileKey.endsWith(FILE_SUFFIX) || fileKey.length === FILE_SUFFIX.length || !filePath) {
      continue;
    }
    const key = fileKey.slice(0, -FILE_SUFFIX.length);
    if (env[key] !== undefined) {
      continue;
    }
    env[key] = fs.readFileSync(filePath, 'utf8').replace(/\r?\n$/, '');
    applied.push(key);
  }
  return applied;
}

/**
 * Walk up from `startDir` looking for the monorepo root: the first directory
 * containing a `pnpm-workspace.yaml`, or a `package.json` that declares
 * `workspaces`. Returns `null` when the filesystem root is reached without a
 * match — callers outside any workspace get a no-op, not an error.
 */
export function findWorkspaceRoot(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
          workspaces?: unknown;
        };
        if (packageJson.workspaces) {
          return dir;
        }
      } catch {
        // Unparseable package.json — keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Load the workspace root's `.env`, then `.env.local` on top of it, into
 * `process.env`. Two precedence rules, in order:
 *
 * 1. A value already in `process.env` is never overwritten — real environment
 *    variables always win over the files, so the same code is correct in CI
 *    and in production containers where config comes from the environment.
 * 2. Between the files, `.env.local` overrides `.env` (that is also why
 *    `vercel env pull`, which writes `.env.local`, silently wins over `.env`).
 *
 * There is one `.env`, at the root of the repo; per-package `.env` files are
 * deliberately not looked for. Then every `<NAME>_FILE` is resolved into
 * `<NAME>` (`resolveFileVariables`), whether it came from the environment or
 * a file. Safe to call more than once.
 */
export function loadEnv(options: LoadEnvOptions = {}): LoadEnvResult {
  const root = findWorkspaceRoot(options.cwd);
  if (root === null) {
    return { root: null, loaded: [], applied: resolveFileVariables() };
  }

  const loaded: string[] = [];
  let merged: Record<string, string> = {};
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    merged = { ...merged, ...parse(fs.readFileSync(filePath, 'utf8')) };
    loaded.push(filePath);
  }

  const applied: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied.push(key);
    }
  }
  applied.push(...resolveFileVariables());

  return { root, loaded, applied };
}
