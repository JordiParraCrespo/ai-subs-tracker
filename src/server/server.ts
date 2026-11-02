import { createServer, type Server } from "node:http";
import { collectSnapshots, resolveAccounts } from "../collect.js";
import type { AccountSnapshot, Env } from "../types.js";
import { DASHBOARD_HTML } from "./dashboard.js";

export interface UsagePayload {
  snapshots: AccountSnapshot[];
  discovered: boolean;
  configPath: string;
  generatedAt: string;
}

export interface ServerOptions {
  /** How long a result is reused before hitting the APIs again. */
  ttlMs?: number;
  /** Floor for manual refreshes, so the refresh button can't hammer the API. */
  minRefreshMs?: number;
}

/**
 * Caches the latest payload and collapses concurrent requests into one fetch.
 * The usage endpoint is rate limited, so we never call it more than once per
 * `minRefreshMs` regardless of how many tabs are open.
 */
export function createUsageCache(env: Env, opts: ServerOptions = {}) {
  const ttl = opts.ttlMs ?? 60_000;
  const minRefresh = opts.minRefreshMs ?? 15_000;
  let last: { at: number; payload: UsagePayload } | null = null;
  let inflight: Promise<UsagePayload> | null = null;

  async function load(): Promise<UsagePayload> {
    const { accounts, discovered, configPath } = await resolveAccounts(env);
    const snapshots = await collectSnapshots(accounts, env);
    return { snapshots, discovered, configPath, generatedAt: env.now().toISOString() };
  }

  return async function get(force = false): Promise<UsagePayload> {
    const now = env.now().getTime();
    if (last) {
      const age = now - last.at;
      if (age < (force ? minRefresh : ttl)) return last.payload;
    }
    inflight ??= load()
      .then((payload) => {
        last = { at: env.now().getTime(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

export function createDashboardServer(env: Env, opts: ServerOptions = {}): Server {
  const getUsage = createUsageCache(env, opts);

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(DASHBOARD_HTML);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/usage") {
        const payload = await getUsage(url.searchParams.has("refresh"));
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(payload));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });
}
