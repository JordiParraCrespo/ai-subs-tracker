import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createDashboardServer, createUsageCache } from "../src/server/server.js";
import { fakeFetch, NOW, tempHome, testEnv, writeJson } from "./helpers.js";

async function homeWithConfig() {
  const home = await tempHome();
  const cfgDir = join(home, "cfg");
  process.env.AISUBS_CONFIG_DIR = cfgDir;
  await writeJson(join(cfgDir, "accounts.json"), {
    version: 1,
    accounts: [{ id: "w", label: "Work", provider: "claude-code", configDir: join(home, ".claude-work") }],
  });
  await writeJson(join(home, ".claude-work", ".credentials.json"), {
    claudeAiOauth: { accessToken: "tok", expiresAt: NOW.getTime() + 3_600_000 },
  });
  return home;
}

describe("usage cache", () => {
  it("reuses results within the TTL and rate-limits forced refreshes", async () => {
    const home = await homeWithConfig();
    const { fn, calls } = fakeFetch({ five_hour: { utilization: 10, resets_at: null } });
    let t = NOW.getTime();
    const get = createUsageCache(testEnv(home, { fetch: fn, now: () => new Date(t) }), { ttlMs: 60_000, minRefreshMs: 15_000 });

    await Promise.all([get(), get(), get()]);
    assert.equal(calls.length, 1, "concurrent requests share one fetch");
    t += 5_000;
    await get(true);
    assert.equal(calls.length, 1, "forced refresh within 15s is ignored");
    t += 15_000;
    await get(true);
    assert.equal(calls.length, 2);
    t += 30_000;
    await get();
    assert.equal(calls.length, 2, "still within TTL");
    t += 60_000;
    await get();
    assert.equal(calls.length, 3);
  });
});

describe("dashboard server", () => {
  it("serves the page and the JSON API", async () => {
    const home = await homeWithConfig();
    const server = createDashboardServer(
      testEnv(home, { fetch: fakeFetch({ five_hour: { utilization: 33, resets_at: null } }).fn }),
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const page = await fetch(base + "/");
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<title>AI Subs Tracker<\/title>/);

      const api = await fetch(base + "/api/usage");
      const body = (await api.json()) as { snapshots: Array<{ label: string; limits: Array<{ utilization: number }> }> };
      assert.equal(body.snapshots[0]?.label, "Work");
      assert.equal(body.snapshots[0]?.limits[0]?.utilization, 33);

      assert.equal((await fetch(base + "/nope")).status, 404);
    } finally {
      server.close();
    }
  });
});
