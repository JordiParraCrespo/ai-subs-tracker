import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { collectSnapshots, discoverAccounts } from "../src/collect.js";
import { claudeCode } from "../src/providers/claude-code/index.js";
import type { AccountConfig } from "../src/types.js";
import { NOW, assistantLine, fakeFetch, tempHome, testEnv, writeJson } from "./helpers.js";

const FUTURE = NOW.getTime() + 3600_000;
const account = (configDir?: string): AccountConfig => ({ id: "work", label: "Work", provider: "claude-code", configDir });

async function loggedInHome(expiresAt = FUTURE) {
  const home = await tempHome();
  const dir = join(home, ".claude-work");
  await writeJson(join(dir, ".credentials.json"), {
    claudeAiOauth: { accessToken: "tok", expiresAt, subscriptionType: "max", rateLimitTier: "default_claude_max_5x" },
  });
  await writeJson(join(dir, ".claude.json"), { oauthAccount: { emailAddress: "me@work.dev" } });
  return { home, dir };
}

describe("claude-code provider", () => {
  it("combines limits, identity and local activity", async () => {
    const { home, dir } = await loggedInHome();
    await writeJson(
      join(dir, "projects", "p", "s.jsonl"),
      assistantLine({ ts: new Date(NOW.getTime() - 3600_000).toISOString(), input: 40, output: 2 }),
    );
    const { fn } = fakeFetch({
      five_hour: { utilization: 62, resets_at: new Date(NOW.getTime() + 2 * 3600_000).toISOString() },
      seven_day: { utilization: 20, resets_at: null },
    });
    const snap = await claudeCode.snapshot(account("~/.claude-work"), testEnv(home, { fetch: fn }));
    assert.equal(snap.status, "ok");
    assert.deepEqual(snap.identity, { email: "me@work.dev", organization: undefined, plan: "Max 5x" });
    assert.deepEqual(snap.limits.map((w) => w.utilization), [62, 20]);
    // session window = five_hour reset − 5h = NOW − 3h, so the 1h-old message counts
    assert.equal(snap.local?.sessionWindowStart, new Date(NOW.getTime() - 3 * 3600_000).toISOString());
    assert.equal(snap.local?.session.total, 42);
  });

  it("does not call the API with an expired token", async () => {
    const { home } = await loggedInHome(NOW.getTime() - 1);
    const { fn, calls } = fakeFetch({});
    const snap = await claudeCode.snapshot(account(join(home, ".claude-work")), testEnv(home, { fetch: fn }));
    assert.equal(snap.status, "auth_expired");
    assert.match(snap.message ?? "", /CLAUDE_CONFIG_DIR=.*\.claude-work claude/);
    assert.equal(calls.length, 0);
  });

  it("reports a 401 as auth_expired", async () => {
    const { home } = await loggedInHome();
    const snap = await claudeCode.snapshot(account("~/.claude-work"), testEnv(home, { fetch: fakeFetch({}, 401).fn }));
    assert.equal(snap.status, "auth_expired");
  });

  it("reports missing logins", async () => {
    const home = await tempHome();
    const snap = await claudeCode.snapshot(account(), testEnv(home));
    assert.equal(snap.status, "no_credentials");
    assert.match(snap.message ?? "", /Run `claude` and log in/);
  });

  it("turns network failures into an error status", async () => {
    const { home } = await loggedInHome();
    const fetch = (async () => {
      throw new Error("ENOTFOUND api.anthropic.com");
    }) as typeof globalThis.fetch;
    const [snap] = await collectSnapshots([account("~/.claude-work")], testEnv(home, { fetch }));
    assert.equal(snap?.status, "error");
    assert.match(snap?.message ?? "", /ENOTFOUND/);
  });
});

describe("discovery", () => {
  it("finds ~/.claude and ~/.claude-* dirs with logins, using emails as labels", async () => {
    const { home } = await loggedInHome();
    await writeJson(join(home, ".claude", "settings.json"), {});
    await writeJson(join(home, ".claude-empty", "README"), "nothing here");
    await writeJson(join(home, ".clauderc"), "not a dir");
    const found = await discoverAccounts(testEnv(home));
    assert.deepEqual(
      found.map((a) => [a.id, a.label, a.configDir]),
      [
        ["claude", "Claude", undefined],
        ["me", "me@work.dev", "~/.claude-work"],
      ],
    );
  });
});
