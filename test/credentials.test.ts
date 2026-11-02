import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  KEYCHAIN_BASE_SERVICE,
  keychainServiceFor,
  parseCredentials,
  planLabel,
  readCredentials,
  readIdentity,
} from "../src/providers/claude-code/credentials.js";
import { tempHome, testEnv, writeJson } from "./helpers.js";

const creds = (extra: Record<string, unknown> = {}) => ({
  claudeAiOauth: { accessToken: "sk-ant-oat01-test", expiresAt: 1, subscriptionType: "max", ...extra },
});

describe("parseCredentials", () => {
  it("reads the claudeAiOauth block", () => {
    assert.deepEqual(parseCredentials(JSON.stringify(creds({ rateLimitTier: "default_claude_max_20x" }))), {
      accessToken: "sk-ant-oat01-test",
      expiresAt: 1,
      subscriptionType: "max",
      rateLimitTier: "default_claude_max_20x",
    });
  });
  it("rejects anything without a token", () => {
    assert.equal(parseCredentials("{}"), null);
    assert.equal(parseCredentials("not json"), null);
    assert.equal(parseCredentials(JSON.stringify({ claudeAiOauth: { accessToken: "" } })), null);
  });
});

describe("planLabel", () => {
  it("formats known plans", () => {
    assert.equal(planLabel({ subscriptionType: "max", rateLimitTier: "default_claude_max_20x" }), "Max 20x");
    assert.equal(planLabel({ subscriptionType: "max", rateLimitTier: "default_claude_max_5x" }), "Max 5x");
    assert.equal(planLabel({ subscriptionType: "pro" }), "Pro");
    assert.equal(planLabel({ subscriptionType: "team" }), "Team");
    assert.equal(planLabel({}), undefined);
    assert.equal(planLabel(null), undefined);
  });
});

describe("keychainServiceFor", () => {
  it("uses the bare name for ~/.claude and a hashed suffix otherwise", () => {
    assert.equal(keychainServiceFor("/Users/me/.claude", "/Users/me"), KEYCHAIN_BASE_SERVICE);
    const custom = keychainServiceFor("/Users/me/.claude-work", "/Users/me");
    assert.match(custom, /^Claude Code-credentials-[0-9a-f]{8}$/);
    assert.notEqual(custom, keychainServiceFor("/Users/me/.claude-personal", "/Users/me"));
  });
});

describe("readCredentials", () => {
  it("prefers the credentials file", async () => {
    const home = await tempHome();
    const dir = join(home, ".claude-work");
    await writeJson(join(dir, ".credentials.json"), creds());
    const got = await readCredentials(dir, testEnv(home));
    assert.equal(got?.accessToken, "sk-ant-oat01-test");
  });

  it("falls back to the macOS Keychain with the right service name", async () => {
    const home = await tempHome();
    const dir = join(home, ".claude-work");
    const asked: string[][] = [];
    const env = testEnv(home, {
      platform: "darwin",
      exec: async (cmd, args) => {
        asked.push([cmd, ...args]);
        return JSON.stringify(creds()) + "\n";
      },
    });
    const got = await readCredentials(dir, env);
    assert.equal(got?.accessToken, "sk-ant-oat01-test");
    assert.deepEqual(asked[0], ["security", "find-generic-password", "-s", keychainServiceFor(dir, home), "-w"]);
  });

  it("does not touch the Keychain on other platforms", async () => {
    const home = await tempHome();
    let called = false;
    const env = testEnv(home, { exec: async () => ((called = true), null) });
    assert.equal(await readCredentials(join(home, ".claude"), env), null);
    assert.equal(called, false);
  });
});

describe("readIdentity", () => {
  it("reads ~/.claude.json for the default dir and <dir>/.claude.json otherwise", async () => {
    const home = await tempHome();
    await writeJson(join(home, ".claude.json"), { oauthAccount: { emailAddress: "me@home.dev" } });
    await writeJson(join(home, ".claude-work", ".claude.json"), {
      oauthAccount: { emailAddress: "me@work.dev", organizationName: "Work Inc" },
    });
    assert.deepEqual(await readIdentity(join(home, ".claude"), home), { email: "me@home.dev", organization: undefined });
    assert.deepEqual(await readIdentity(join(home, ".claude-work"), home), {
      email: "me@work.dev",
      organization: "Work Inc",
    });
    assert.deepEqual(await readIdentity(join(home, ".claude-none"), home), {});
  });
});
