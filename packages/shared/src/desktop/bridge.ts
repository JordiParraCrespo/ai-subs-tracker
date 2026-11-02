import type { ProviderId } from '../subscriptions/plans';

/**
 * The contract between the Subtrack desktop shell (`apps/desktop`, Electron)
 * and the screens it hosts (`apps/web`'s build). The preload script exposes
 * one object implementing `DesktopBridge` as `window.subtrack`; the web app
 * finds it there and only there, so the same build runs in a browser (no
 * bridge: no local features) and in the desktop app.
 *
 * Types only, plus the IPC channel names both sides agree on. Nothing here
 * carries a provider credential: the bridge moves the API session token (the
 * app's own) and descriptions of local logins.
 */

/** A login the collector found on this machine. */
export interface LocalLogin {
  provider: ProviderId;
  externalId: string;
  email: string | null;
  /** The config folder (`~/.claude`) or Codex home it lives in. */
  home: string;
  isDefault: boolean;
  /** True for a login Subtrack created in its own folder ("Add account"). */
  managed: boolean;
  /** True when terminals using the shell integration use this login. */
  active: boolean;
}

export type CollectorPhase = 'idle' | 'collecting' | 'syncing' | 'signed_out' | 'error';

export interface CollectorStatus {
  phase: CollectorPhase;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  logins: LocalLogin[];
}

export interface AddLoginResult {
  ok: boolean;
  /** Why it did not work, e.g. the CLI is not installed. */
  message: string | null;
}

export interface ShellIntegration {
  /** The snippet to source; makes `claude` / `codex` follow the active account. */
  snippet: string;
  /** The rc file it would be written to, or null when the shell is unknown. */
  rcFile: string | null;
  installed: boolean;
}

export interface LiveFeedTarget {
  /** A Claude Code config folder. */
  home: string;
  installed: boolean;
  /** False when that folder already has a status line of its own, which is never replaced. */
  available: boolean;
}

export interface DesktopBridge {
  version: string;
  platform: string;
  /** Absolute API origin, e.g. `https://api.subtrack.app`. */
  apiUrl: string;
  auth: {
    getToken(): Promise<string | null>;
    /** Stores (or clears, with null) the API session token, encrypted at rest. */
    setToken(token: string | null): Promise<void>;
  };
  collector: {
    status(): Promise<CollectorStatus>;
    /** Reads every local login and syncs now. */
    refresh(): Promise<CollectorStatus>;
    onStatus(listener: (status: CollectorStatus) => void): () => void;
  };
  accounts: {
    /** Signs a new account into its own folder by running the provider's CLI login. */
    addLogin(provider: ProviderId): Promise<AddLoginResult>;
    /** Points terminals at the login with this provider and external id. */
    activate(provider: ProviderId, externalId: string): Promise<void>;
  };
  shell: {
    integration(): Promise<ShellIntegration>;
    install(): Promise<ShellIntegration>;
  };
  liveFeed: {
    targets(): Promise<LiveFeedTarget[]>;
    install(home: string): Promise<LiveFeedTarget[]>;
    uninstall(home: string): Promise<LiveFeedTarget[]>;
  };
  openExternal(url: string): Promise<void>;
}

/** IPC channel names, `subtrack:<area>:<verb>`. */
export const DESKTOP_CHANNELS = {
  authGetToken: 'subtrack:auth:get-token',
  authSetToken: 'subtrack:auth:set-token',
  collectorStatus: 'subtrack:collector:status',
  collectorRefresh: 'subtrack:collector:refresh',
  collectorChanged: 'subtrack:collector:changed',
  accountsAddLogin: 'subtrack:accounts:add-login',
  accountsActivate: 'subtrack:accounts:activate',
  shellIntegration: 'subtrack:shell:integration',
  shellInstall: 'subtrack:shell:install',
  liveFeedTargets: 'subtrack:live-feed:targets',
  liveFeedInstall: 'subtrack:live-feed:install',
  liveFeedUninstall: 'subtrack:live-feed:uninstall',
  openExternal: 'subtrack:open-external',
} as const;
