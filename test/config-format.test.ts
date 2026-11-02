import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appConfigDir, loadConfig, makeId, saveConfig, validateConfig } from "../src/config.js";
import { formatDuration, formatResetsIn, formatTokens, severity } from "../src/format.js";
import { renderSnapshots } from "../src/render-terminal.js";
import { NOW, tempHome, writeJson } from "./helpers.js";

describe("config", () => {
  it("picks a per-OS directory", () => {
    assert.equal(appConfigDir("/h", "darwin", {}), join("/h", "Library", "Application Support", "ai-subs-tracker"));
    assert.equal(appConfigDir("/h", "linux", {}), join("/h", ".config", "ai-subs-tracker"));
    assert.equal(appConfigDir("/h", "linux", { XDG_CONFIG_HOME: "/x" }), join("/x", "ai-subs-tracker"));
    assert.equal(appConfigDir("/h", "win32", { APPDATA: "C:\\AppData" }), join("C:\\AppData", "ai-subs-tracker"));
    assert.equal(appConfigDir("/h", "linux", { AISUBS_CONFIG_DIR: "/custom" }), "/custom");
  });

  it("round-trips and validates", async () => {
    const path = join(await tempHome(), "cfg", "accounts.json");
    assert.equal(await loadConfig(path), null);
    await saveConfig(path, { version: 1, accounts: [{ id: "a", label: "A", provider: "claude-code" }] });
    assert.equal((await loadConfig(path))?.accounts[0]?.label, "A");
    await writeJson(path, { accounts: [{ id: "a", provider: "nope" }] });
    await assert.rejects(loadConfig(path), /unknown provider/);
    assert.throws(() => validateConfig({ accounts: [{ id: "a", provider: "claude-code" }, { id: "a", provider: "claude-code" }] }), /Duplicate/);
  });

  it("makes unique slug ids", () => {
    assert.equal(makeId("Work Max 20x!", []), "work-max-20x");
    assert.equal(makeId("me@work.dev", ["me"]), "me-2");
    assert.equal(makeId("!!!", []), "account");
  });
});

describe("format", () => {
  it("formats tokens and durations", () => {
    assert.equal(formatTokens(999), "999");
    assert.equal(formatTokens(1234), "1.2k");
    assert.equal(formatTokens(8_400_000), "8.4M");
    assert.equal(formatTokens(250_000_000), "250M");
    assert.equal(formatDuration(30_000), "<1m");
    assert.equal(formatDuration(134 * 60_000), "2h 14m");
    assert.equal(formatDuration(3 * 86_400_000 + 4 * 3_600_000), "3d 4h");
    assert.equal(formatResetsIn(null, NOW), "");
    assert.equal(formatResetsIn(new Date(NOW.getTime() - 1).toISOString(), NOW), "resetting now");
    assert.deepEqual([severity(null), severity(49), severity(50), severity(80)], ["low", "low", "medium", "high"]);
  });

  it("renders a plain-text summary", () => {
    const out = renderSnapshots(
      [
        {
          accountId: "w",
          label: "Work",
          provider: "claude-code",
          identity: { email: "me@work.dev", plan: "Max 20x" },
          status: "ok",
          limits: [{ key: "five_hour", label: "Session (5h)", utilization: 50, resetsAt: new Date(NOW.getTime() + 3_600_000).toISOString() }],
          fetchedAt: NOW.toISOString(),
        },
      ],
      { color: false, now: NOW, barWidth: 10 },
    );
    assert.match(out, /● Work {2}me@work\.dev · Max 20x/);
    assert.match(out, /Session \(5h\) {2}█████░░░░░ {2}50% {2}resets in 1h/);
  });
});
