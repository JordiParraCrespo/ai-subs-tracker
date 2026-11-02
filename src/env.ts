import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Env } from "./types.js";

export function defaultEnv(): Env {
  return {
    now: () => new Date(),
    home: homedir(),
    platform: process.platform,
    fetch: globalThis.fetch.bind(globalThis),
    exec: (cmd, args) =>
      new Promise((res) => {
        execFile(cmd, args, { timeout: 10_000, windowsHide: true }, (err, stdout) => {
          res(err ? null : stdout);
        });
      }),
  };
}

/** Inverse of expandPath for display/storage: "/Users/me/.claude-work" → "~/.claude-work". */
export function tildify(p: string, home: string): string {
  const rel = relative(home, p);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return p;
  return `~/${rel.split(sep).join("/")}`;
}

/** Expand a leading "~" and make the path absolute. */
export function expandPath(p: string, home: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(home, p.slice(2));
  return isAbsolute(p) ? p : resolve(p);
}
