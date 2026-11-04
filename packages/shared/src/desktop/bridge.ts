import type { LocalProviderId } from '../subscriptions/plans';

/**
 * The contract between the ResetOwl desktop shell (`apps/desktop`, Electron)
 * and the screens it hosts (`apps/web`'s build). The preload script exposes
 * one object implementing `DesktopBridge` as `window.resetowl`; the web app
 * finds it there and only there, so the same build runs in a browser (no
 * bridge: no local features) and in the desktop app.
 *
 * Types only, plus the IPC channel names both sides agree on. Nothing here
 * carries a provider credential: the bridge moves the API session token (the
 * app's own) and descriptions of local logins.
 */

/** A login the collector found on this machine. */
export interface LocalLogin {
  provider: LocalProviderId;
  externalId: string;
  email: string | null;
  /** The config folder (`~/.claude`) or Codex home it lives in. */
  home: string;
  isDefault: boolean;
  /** True for a login ResetOwl created in its own folder ("Add account"). */
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

/**
 * What a login in flight has printed that the person can use: the link to
 * sign in at (Claude Code's manual link, Codex's device page) and Codex's
 * one-time code. Either is null until the CLI prints it.
 */
export interface LoginProgress {
  link: string | null;
  code: string | null;
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
  /** Absolute API origin, e.g. `https://api.resetowl.com`. */
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
    /**
     * Signs a new account into its own folder by running the provider's CLI
     * login; resolves when the CLI exits. One login runs at a time.
     */
    addLogin(provider: LocalProviderId): Promise<AddLoginResult>;
    /** What the running login printed: its link and, for Codex, its code. */
    onLoginProgress(listener: (progress: LoginProgress) => void): () => void;
    /** Types a code the person pasted into the running login's prompt. */
    submitLoginCode(code: string): Promise<void>;
    /** Stops the running login; `addLogin` then resolves as cancelled. */
    cancelLogin(): Promise<void>;
    /** Points terminals at the login with this provider and external id. */
    activate(provider: LocalProviderId, externalId: string): Promise<void>;
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

/**
 * The origin the desktop app serves its screens from (`app://resetowl/`). The
 * API admits it for CORS and as a trusted auth origin, so this one value is
 * what both sides must agree on.
 */
export const DESKTOP_RENDERER_ORIGIN = 'app://resetowl';

/**
 * The origin desktop builds served the screens from while the app was called
 * Subtrack. The API keeps admitting it so an install that has not updated yet
 * can still sign in; drop it once no such build is in use.
 */
export const LEGACY_DESKTOP_RENDERER_ORIGIN = 'app://subtrack';

/** IPC channel names, `resetowl:<area>:<verb>`. */
export const DESKTOP_CHANNELS = {
  authGetToken: 'resetowl:auth:get-token',
  authSetToken: 'resetowl:auth:set-token',
  collectorStatus: 'resetowl:collector:status',
  collectorRefresh: 'resetowl:collector:refresh',
  collectorChanged: 'resetowl:collector:changed',
  accountsAddLogin: 'resetowl:accounts:add-login',
  accountsLoginProgress: 'resetowl:accounts:login-progress',
  accountsLoginCode: 'resetowl:accounts:login-code',
  accountsLoginCancel: 'resetowl:accounts:login-cancel',
  accountsActivate: 'resetowl:accounts:activate',
  shellIntegration: 'resetowl:shell:integration',
  shellInstall: 'resetowl:shell:install',
  liveFeedTargets: 'resetowl:live-feed:targets',
  liveFeedInstall: 'resetowl:live-feed:install',
  liveFeedUninstall: 'resetowl:live-feed:uninstall',
  openExternal: 'resetowl:open-external',
} as const;
