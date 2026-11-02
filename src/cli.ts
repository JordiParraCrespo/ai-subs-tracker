#!/usr/bin/env node
import { execFile } from "node:child_process";
import { parseArgs } from "node:util";
import { collectSnapshots, discoverAccounts, resolveAccounts } from "./collect.js";
import { configPath, emptyConfig, loadConfig, makeId, saveConfig } from "./config.js";
import { defaultEnv, expandPath } from "./env.js";
import { PROVIDERS, getProvider } from "./providers/index.js";
import { renderSnapshots } from "./render-terminal.js";
import { createDashboardServer } from "./server/server.js";
import type { AccountConfig, Env, ProviderId } from "./types.js";

const HELP = `aisubs — see how much of each AI subscription you have left

Usage:
  aisubs [status] [--json]          Show usage for every tracked account
  aisubs serve [--port 4317] [--open]
                                    Local dashboard at http://127.0.0.1:4317
  aisubs discover [--save]          Find Claude Code logins on this machine
  aisubs accounts list
  aisubs accounts add --label <name> [--config-dir <dir>] [--id <id>]
                      [--provider claude-code] [--keychain-service <name>]
  aisubs accounts remove <id>
  aisubs help

Each Claude Code subscription is a separate config dir, i.e. what you pass as
CLAUDE_CONFIG_DIR (default ~/.claude). Log in to each one once with
  CLAUDE_CONFIG_DIR=~/.claude-work claude
and then add it here.`;

function fail(msg: string): never {
  console.error(`aisubs: ${msg}`);
  process.exit(1);
}

async function cmdStatus(env: Env, json: boolean): Promise<void> {
  const { accounts, discovered, configPath: path } = await resolveAccounts(env);
  if (accounts.length === 0) {
    if (json) return console.log(JSON.stringify({ snapshots: [] }, null, 2));
    console.log("No Claude Code logins found. Add one with:\n  aisubs accounts add --label Work --config-dir ~/.claude-work");
    return;
  }
  const snapshots = await collectSnapshots(accounts, env);
  if (json) {
    console.log(JSON.stringify({ snapshots, discovered, configPath: path }, null, 2));
    return;
  }
  const color = process.stdout.isTTY === true && !process.env.NO_COLOR;
  process.stdout.write(renderSnapshots(snapshots, { color, now: env.now() }));
  if (discovered) {
    console.log(`(auto-discovered — run \`aisubs discover --save\` to keep these in ${path})`);
  }
  if (snapshots.some((s) => s.status !== "ok")) process.exitCode = 2;
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  execFile(cmd, args, () => {});
}

async function cmdServe(env: Env, port: number, host: string, open: boolean): Promise<void> {
  const server = createDashboardServer(env);
  server.on("error", (err) => fail(err.message));
  server.listen(port, host, () => {
    const url = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`;
    console.log(`AI Subs Tracker dashboard: ${url}  (Ctrl+C to stop)`);
    if (open) openBrowser(url);
  });
}

async function cmdDiscover(env: Env, save: boolean): Promise<void> {
  const path = configPath(env);
  const config = (await loadConfig(path)) ?? emptyConfig();
  const known = new Set(config.accounts.map((a) => expandPath(a.configDir ?? "~/.claude", env.home)));
  const found = (await discoverAccounts(env, config.accounts.map((a) => a.id))).filter(
    (a) => !known.has(expandPath(a.configDir ?? "~/.claude", env.home)),
  );
  if (found.length === 0) {
    console.log("No new Claude Code logins found.");
    return;
  }
  for (const a of found) console.log(`  ${a.id.padEnd(20)} ${a.label.padEnd(30)} ${a.configDir ?? "~/.claude"}`);
  if (save) {
    config.accounts.push(...found);
    await saveConfig(path, config);
    console.log(`Saved ${found.length} account(s) to ${path}`);
  } else {
    console.log("\nRun `aisubs discover --save` to track these.");
  }
}

async function cmdAccounts(env: Env, args: string[]): Promise<void> {
  const [sub, ...rest] = args;
  const path = configPath(env);
  const config = (await loadConfig(path)) ?? emptyConfig();

  if (!sub || sub === "list") {
    if (config.accounts.length === 0) return console.log(`No accounts configured (${path}).`);
    for (const a of config.accounts) {
      console.log(`  ${a.id.padEnd(20)} ${a.label.padEnd(30)} ${a.provider.padEnd(12)} ${a.configDir ?? "~/.claude"}`);
    }
    console.log(`\nConfig: ${path}`);
    return;
  }

  if (sub === "add") {
    const { values } = parseArgs({
      args: rest,
      options: {
        label: { type: "string" },
        id: { type: "string" },
        provider: { type: "string", default: "claude-code" },
        "config-dir": { type: "string" },
        "keychain-service": { type: "string" },
      },
    });
    if (!values.label) fail("--label is required");
    if (!getProvider(values.provider!)) {
      fail(`unknown provider "${values.provider}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
    }
    const ids = config.accounts.map((a) => a.id);
    const id = values.id ?? makeId(values.label, ids);
    if (ids.includes(id)) fail(`an account with id "${id}" already exists`);
    const account: AccountConfig = {
      id,
      label: values.label,
      provider: values.provider as ProviderId,
      ...(values["config-dir"] ? { configDir: values["config-dir"] } : {}),
      ...(values["keychain-service"] ? { keychainService: values["keychain-service"] } : {}),
    };
    config.accounts.push(account);
    await saveConfig(path, config);
    console.log(`Added "${account.label}" (${id}).`);
    return;
  }

  if (sub === "remove" || sub === "rm") {
    const id = rest[0] ?? fail("usage: aisubs accounts remove <id>");
    const before = config.accounts.length;
    config.accounts = config.accounts.filter((a) => a.id !== id);
    if (config.accounts.length === before) fail(`no account with id "${id}"`);
    await saveConfig(path, config);
    console.log(`Removed ${id}.`);
    return;
  }

  fail(`unknown accounts subcommand "${sub}"`);
}

async function main(argv: string[]): Promise<void> {
  const env = defaultEnv();
  const [cmd = "status", ...rest] = argv;

  switch (cmd) {
    case "status":
    case "--json": {
      const { values } = parseArgs({ args: cmd === "--json" ? argv : rest, options: { json: { type: "boolean" } } });
      return cmdStatus(env, values.json ?? false);
    }
    case "serve": {
      const { values } = parseArgs({
        args: rest,
        options: {
          port: { type: "string", default: "4317" },
          host: { type: "string", default: "127.0.0.1" },
          open: { type: "boolean", default: false },
        },
      });
      const port = Number(values.port);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) fail(`invalid port "${values.port}"`);
      return cmdServe(env, port, values.host!, values.open!);
    }
    case "discover": {
      const { values } = parseArgs({ args: rest, options: { save: { type: "boolean" } } });
      return cmdDiscover(env, values.save ?? false);
    }
    case "accounts":
      return cmdAccounts(env, rest);
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    default:
      fail(`unknown command "${cmd}". Run \`aisubs help\`.`);
  }
}

main(process.argv.slice(2)).catch((err) => fail(err instanceof Error ? err.message : String(err)));
