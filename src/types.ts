/**
 * Shared types. Every provider (Claude Code today; Codex, Cursor, … later)
 * turns an AccountConfig into an AccountSnapshot, and everything downstream
 * (CLI, dashboard, future tray app) only ever deals with snapshots.
 */

export type ProviderId = "claude-code";

export interface AccountConfig {
  /** Stable, URL-safe identifier, e.g. "work". */
  id: string;
  /** Human-friendly name shown in the UI, e.g. "Work (Max 20x)". */
  label: string;
  provider: ProviderId;
  /**
   * Claude Code: the config directory for this subscription — what you pass
   * as CLAUDE_CONFIG_DIR. Defaults to ~/.claude. A leading "~" is expanded.
   */
  configDir?: string;
  /**
   * Claude Code on macOS: override the Keychain service name the OAuth
   * credentials are stored under (auto-detected when omitted).
   */
  keychainService?: string;
}

export interface AppConfig {
  version: 1;
  accounts: AccountConfig[];
}

/** One rate-limit window as reported by the provider, e.g. the 5-hour session. */
export interface UsageWindow {
  /** Raw key from the provider, e.g. "five_hour". */
  key: string;
  /** Display label, e.g. "Session (5h)". */
  label: string;
  /** Percent of the window used, 0–100 (may exceed 100 if over the limit). */
  utilization: number | null;
  /** ISO timestamp at which the window resets, if known. */
  resetsAt: string | null;
}

export interface ExtraUsage {
  enabled: boolean;
  /** Monthly cap, in the provider's credit unit (null = unlimited/unknown). */
  monthlyLimit: number | null;
  usedCredits: number | null;
  utilization: number | null;
}

export interface TokenTotals {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  /** Sum of all four token kinds. */
  total: number;
  /** Number of assistant messages counted. */
  messages: number;
}

/** Activity derived from the provider's local logs on this machine. */
export interface LocalActivity {
  /** Start of the current session window used for `session`. */
  sessionWindowStart: string;
  session: TokenTotals;
  last7Days: TokenTotals;
  /** Last-7-days totals broken down by model id. */
  byModel: Record<string, TokenTotals>;
  lastActivityAt: string | null;
}

export interface AccountIdentity {
  email?: string;
  organization?: string;
  /** e.g. "Max 20x", "Pro". */
  plan?: string;
}

export type AccountStatus =
  /** Limits fetched successfully. */
  | "ok"
  /** Stored login has expired; the provider's own app must refresh it. */
  | "auth_expired"
  /** No login found for this account on this machine. */
  | "no_credentials"
  /** Anything else (network, unexpected response, …). */
  | "error";

export interface AccountSnapshot {
  accountId: string;
  label: string;
  provider: ProviderId;
  identity: AccountIdentity;
  status: AccountStatus;
  /** Human-readable explanation when status !== "ok". */
  message?: string;
  limits: UsageWindow[];
  extraUsage?: ExtraUsage;
  local?: LocalActivity;
  fetchedAt: string;
}

/** Side-effecting dependencies, injectable for tests. */
export interface Env {
  now: () => Date;
  home: string;
  platform: NodeJS.Platform;
  fetch: typeof fetch;
  /** Runs a command and returns stdout, or null if it failed. */
  exec: (cmd: string, args: string[]) => Promise<string | null>;
}

export interface Provider {
  id: ProviderId;
  displayName: string;
  snapshot(account: AccountConfig, env: Env): Promise<AccountSnapshot>;
  /** Find accounts present on this machine that could be tracked. */
  discover?(env: Env): Promise<Array<Omit<AccountConfig, "id">>>;
}
