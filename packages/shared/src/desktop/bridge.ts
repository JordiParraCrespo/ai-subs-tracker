import type { SnapshotStatus } from '../schemas/accounts.schema';
import type { LocalProviderId, ManualProviderId } from '../subscriptions/plans';

/**
 * The contract between the ResetOwl desktop shell (`apps/desktop`, Electron)
 * and the screens it hosts (`apps/web`'s build). The preload script exposes
 * one object implementing `DesktopBridge` as `window.resetowl`; the web app
 * finds it there and only there, so the same build runs in a browser (no
 * bridge: no local features) and in the desktop app.
 *
 * Types only, plus the IPC channel names both sides agree on. Nothing here
 * carries a provider credential back to the screens: the bridge moves the API
 * session token (the app's own) and descriptions of local logins. The one key
 * that crosses it goes the other way: a Coding Plan key the person pastes to
 * turn on an unofficial usage reader, which the main process keeps encrypted
 * and never hands back.
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

/**
 * An account whose usage the desktop app reads from the vendor's unofficial
 * endpoint (opt-in, `UNOFFICIAL_USAGE_READERS`). Describes the key, never
 * holds it.
 */
export interface UsageReaderState {
  /** The ResetOwl account id the key belongs to. */
  accountId: string;
  provider: ManualProviderId;
  /** When the last reading reached ResetOwl. */
  lastReadAt: string | null;
  /** The last attempt's outcome; null before the first. */
  status: SnapshotStatus | null;
  /** Why the last attempt failed, in words for the person. */
  message: string | null;
}

export interface ConnectUsageReaderResult {
  ok: boolean;
  /** Why the key was not kept: refused by the vendor, no keystore, … */
  message: string | null;
  reader: UsageReaderState | null;
}

export type CollectorPhase = 'idle' | 'collecting' | 'syncing' | 'signed_out' | 'error';

export interface CollectorStatus {
  phase: CollectorPhase;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  logins: LocalLogin[];
  /** The accounts read from an unofficial usage endpoint on this machine. */
  readers: UsageReaderState[];
}

/** How a new account signs in. */
export interface AddLoginOptions {
  /**
   * Sign in with a page and a one-time code, to finish on another device
   * (Codex and Grok Build); otherwise through the browser on this computer.
   */
  deviceCode?: boolean;
}

export interface AddLoginResult {
  ok: boolean;
  /** Why it did not work, e.g. the CLI is not installed. */
  message: string | null;
}

/**
 * What a login in flight has given the person to use. Each is null until the
 * CLI hands it over.
 */
export interface LoginProgress {
  /**
   * The link that finishes the sign-in by itself once it is opened in a
   * browser on this computer: Claude Code's automatic link (its callback is
   * on localhost), the sign-in page Codex or Grok Build printed (in the device
   * flow, the page to enter the code on).
   */
  link: string | null;
  /**
   * Claude Code's manual link. It ends at claude.com showing a code, and
   * nothing finishes until that code is pasted back (`submitLoginCode`).
   */
  codeLink: string | null;
  /** The device flow's one-time code (Codex, Grok Build), to enter on its page. */
  code: string | null;
  /** When the CLI is stopped if the sign-in has not finished, ISO 8601. */
  deadline: string | null;
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
  /**
   * The operating system's preferred languages, best first (BCP 47, e.g.
   * `['es-ES', 'en-US']`). The screens start from these when the person has
   * not picked a language on this device.
   */
  systemLocales: readonly string[];
  /**
   * Tells the app which language the screens show, so its own text (the
   * tray) reads the same. Unsupported tags fall back to English.
   */
  setLocale(locale: string): Promise<void>;
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
    addLogin(provider: LocalProviderId, options?: AddLoginOptions): Promise<AddLoginResult>;
    /** What the running login gave so far: its links, Codex's code, its deadline. */
    onLoginProgress(listener: (progress: LoginProgress) => void): () => void;
    /** Types a code the person pasted into the running login's prompt. */
    submitLoginCode(code: string): Promise<void>;
    /** Stops the running login; `addLogin` then resolves as cancelled. */
    cancelLogin(): Promise<void>;
    /** Points terminals at the login with this provider and external id. */
    activate(provider: LocalProviderId, externalId: string): Promise<void>;
  };
  usageReaders: {
    /**
     * Turns on the unofficial usage reader for a hand-tracked account: reads
     * once with `apiKey` and keeps the key (encrypted with the OS keystore)
     * only when that worked. The key is sent only to the provider's own site.
     */
    connect(
      accountId: string,
      provider: ManualProviderId,
      apiKey: string,
    ): Promise<ConnectUsageReaderResult>;
    /** Forgets the key; the account goes back to readings recorded by hand. */
    disconnect(accountId: string): Promise<void>;
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
  usageReaderConnect: 'resetowl:usage-reader:connect',
  usageReaderDisconnect: 'resetowl:usage-reader:disconnect',
  shellIntegration: 'resetowl:shell:integration',
  shellInstall: 'resetowl:shell:install',
  liveFeedTargets: 'resetowl:live-feed:targets',
  liveFeedInstall: 'resetowl:live-feed:install',
  liveFeedUninstall: 'resetowl:live-feed:uninstall',
  openExternal: 'resetowl:open-external',
  setLocale: 'resetowl:locale:set',
} as const;
