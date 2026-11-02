import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { USAGE_URL, UsageApiError, fetchUsage, parseUsage } from "../src/providers/claude-code/usage-api.js";
import { fakeFetch } from "./helpers.js";

describe("parseUsage", () => {
  it("maps known windows in a stable order and skips nulls", () => {
    const { windows } = parseUsage({
      seven_day: { utilization: 15, resets_at: "2026-11-06T09:00:00+00:00" },
      five_hour: { utilization: 37.4, resets_at: "2026-11-02T14:00:00.000Z" },
      seven_day_oauth_apps: null,
      seven_day_opus: { utilization: 0, resets_at: null },
    });
    assert.deepEqual(
      windows.map((w) => [w.key, w.label, w.utilization, w.resetsAt]),
      [
        ["five_hour", "Session (5h)", 37.4, "2026-11-02T14:00:00.000Z"],
        ["seven_day", "Weekly · all models", 15, "2026-11-06T09:00:00.000Z"],
        ["seven_day_opus", "Weekly · Opus", 0, null],
      ],
    );
  });

  it("keeps unknown windows with a generated label", () => {
    const { windows } = parseUsage({ thirty_day_fable: { utilization: 5, resets_at: null } });
    assert.equal(windows[0]?.label, "Thirty Day Fable");
  });

  it("parses extra usage separately", () => {
    const { windows, extraUsage } = parseUsage({
      extra_usage: { is_enabled: true, monthly_limit: 5000, used_credits: 1234, utilization: 24.68 },
    });
    assert.equal(windows.length, 0);
    assert.deepEqual(extraUsage, { enabled: true, monthlyLimit: 5000, usedCredits: 1234, utilization: 24.68 });
  });

  it("survives garbage", () => {
    assert.deepEqual(parseUsage(null).windows, []);
    assert.deepEqual(parseUsage("nope").windows, []);
    assert.deepEqual(parseUsage({ five_hour: { utilization: "x", resets_at: "not a date" } }).windows, [
      { key: "five_hour", label: "Session (5h)", utilization: null, resetsAt: null },
    ]);
  });
});

describe("fetchUsage", () => {
  it("sends the bearer token and beta header", async () => {
    const { fn, calls } = fakeFetch({ five_hour: { utilization: 1, resets_at: null } });
    await fetchUsage("tok", fn);
    assert.equal(calls[0]?.url, USAGE_URL);
    assert.equal(calls[0]?.headers.Authorization, "Bearer tok");
    assert.equal(calls[0]?.headers["anthropic-beta"], "oauth-2025-04-20");
  });

  it("flags 401 as an auth error", async () => {
    const { fn } = fakeFetch({ error: "unauthorized" }, 401);
    await assert.rejects(fetchUsage("tok", fn), (err: unknown) => err instanceof UsageApiError && err.isAuthError);
  });

  it("flags 429 as a non-auth error", async () => {
    const { fn } = fakeFetch({}, 429);
    await assert.rejects(
      fetchUsage("tok", fn),
      (err: unknown) => err instanceof UsageApiError && !err.isAuthError && /rate limited/.test(err.message),
    );
  });
});
