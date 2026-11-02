import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getProvider } from "./providers/index.js";
import type { AccountConfig, AppConfig, Env } from "./types.js";

const APP_NAME = "ai-subs-tracker";

/** Per-OS app config dir. Override with AISUBS_CONFIG_DIR. */
export function appConfigDir(home: string, platform: NodeJS.Platform, envVars = process.env): string {
  if (envVars.AISUBS_CONFIG_DIR) return envVars.AISUBS_CONFIG_DIR;
  if (platform === "darwin") return join(home, "Library", "Application Support", APP_NAME);
  if (platform === "win32") return join(envVars.APPDATA ?? join(home, "AppData", "Roaming"), APP_NAME);
  return join(envVars.XDG_CONFIG_HOME ?? join(home, ".config"), APP_NAME);
}

export function configPath(env: Pick<Env, "home" | "platform">): string {
  return join(appConfigDir(env.home, env.platform), "accounts.json");
}

export function emptyConfig(): AppConfig {
  return { version: 1, accounts: [] };
}

export function validateConfig(data: unknown): AppConfig {
  const accounts = (data as { accounts?: unknown } | null)?.accounts;
  if (!Array.isArray(accounts)) throw new Error("Config is missing an `accounts` array");
  const seen = new Set<string>();
  for (const a of accounts as AccountConfig[]) {
    if (!a || typeof a.id !== "string" || !a.id) throw new Error("Every account needs an `id`");
    if (seen.has(a.id)) throw new Error(`Duplicate account id "${a.id}"`);
    seen.add(a.id);
    if (!getProvider(a.provider)) throw new Error(`Account "${a.id}" has unknown provider "${a.provider}"`);
    if (typeof a.label !== "string" || !a.label) a.label = a.id;
  }
  return { version: 1, accounts: accounts as AccountConfig[] };
}

/** Returns null when no config file exists yet. */
export async function loadConfig(path: string): Promise<AppConfig | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    return validateConfig(JSON.parse(raw));
  } catch (err) {
    throw new Error(`Invalid config at ${path}: ${(err as Error).message}`);
  }
}

export async function saveConfig(path: string, config: AppConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", "utf8");
  await rename(tmp, path);
}

/** "Work Max 20x!" → "work-max-20x", made unique against existing ids. */
export function makeId(label: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const base =
    label
      .toLowerCase()
      .replace(/@.*$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "account";
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}
