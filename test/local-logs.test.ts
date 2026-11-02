import assert from "node:assert/strict";
import { utimes } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { aggregate, parseLine, scanLocalActivity } from "../src/providers/claude-code/local-logs.js";
import { NOW, assistantLine, tempHome, writeJson } from "./helpers.js";

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe("parseLine", () => {
  it("extracts usage from assistant lines", () => {
    const e = parseLine(assistantLine({ ts: hoursAgo(1), id: "m1", requestId: "r1", input: 10, output: 20, cacheRead: 5 }));
    assert.equal(e?.input, 10);
    assert.equal(e?.output, 20);
    assert.equal(e?.cacheRead, 5);
    assert.equal(e?.dedupeKey, "m1:r1");
  });
  it("ignores non-usage, synthetic and malformed lines", () => {
    assert.equal(parseLine(JSON.stringify({ type: "user", message: { content: "hi" } })), null);
    assert.equal(parseLine(assistantLine({ ts: hoursAgo(1), model: "<synthetic>" })), null);
    assert.equal(parseLine('{"usage": oops'), null);
    assert.equal(parseLine(assistantLine({ ts: "not a date" })), null);
  });
});

describe("aggregate", () => {
  it("splits session vs 7-day totals, dedupes, and groups by model", () => {
    const lines = [
      assistantLine({ ts: hoursAgo(1), id: "a", requestId: "1", input: 100, output: 50, model: "claude-opus-4-1" }),
      assistantLine({ ts: hoursAgo(1), id: "a", requestId: "1", input: 100, output: 50, model: "claude-opus-4-1" }), // dup
      assistantLine({ ts: hoursAgo(10), id: "b", requestId: "2", input: 1000 }),
      assistantLine({ ts: hoursAgo(24 * 8), id: "c", requestId: "3", input: 99999 }), // too old
    ];
    const act = aggregate(
      lines.map((l) => parseLine(l)!),
      NOW,
      new Date(NOW.getTime() - 5 * 3600_000),
    );
    assert.equal(act.session.total, 150);
    assert.equal(act.session.messages, 1);
    assert.equal(act.last7Days.total, 1150);
    assert.equal(act.last7Days.messages, 2);
    assert.equal(act.byModel["claude-opus-4-1"]?.total, 150);
    assert.equal(act.byModel["claude-sonnet-4-5"]?.total, 1000);
    assert.equal(act.lastActivityAt, hoursAgo(1));
  });
});

describe("scanLocalActivity", () => {
  it("returns null when there is no projects dir", async () => {
    assert.equal(await scanLocalActivity(join(await tempHome(), ".claude"), NOW, NOW), null);
  });

  it("walks nested project folders and skips stale files", async () => {
    const dir = join(await tempHome(), ".claude");
    const fresh = join(dir, "projects", "-Users-me-repo", "s1.jsonl");
    const stale = join(dir, "projects", "-Users-me-old", "s0.jsonl");
    await writeJson(fresh, [assistantLine({ ts: hoursAgo(2), input: 7, output: 3 }), "not json", ""].join("\n"));
    await writeJson(stale, assistantLine({ ts: hoursAgo(2), input: 1_000_000 }));
    const recent = new Date(NOW.getTime() - 2 * 3600_000);
    const old = new Date(NOW.getTime() - 30 * 24 * 3600_000);
    await utimes(fresh, recent, recent);
    await utimes(stale, old, old);
    const act = await scanLocalActivity(dir, NOW, new Date(NOW.getTime() - 5 * 3600_000));
    assert.equal(act?.last7Days.total, 10, "stale file is skipped by mtime");
    assert.equal(act?.session.total, 10);
  });
});
