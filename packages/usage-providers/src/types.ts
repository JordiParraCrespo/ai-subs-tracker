import type { SyncAccount } from '@flama/shared/schemas/accounts';
import type { LocalProviderId } from '@flama/shared/subscriptions';

/**
 * Everything a provider touches outside its own logic, injected so tests run
 * against fake homes, a fake fetch and a fake keychain.
 */
export interface ProviderEnv {
  /** The user's home directory. */
  home: string;
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  now(): Date;
  fetch: typeof fetch;
  /**
   * ResetOwl's own name, `resetowl-desktop/<version>`, for the calls that are
   * ResetOwl's (the Z.AI reader). The coding-agent readers send the client
   * headers Orca sends instead (see each provider's usage call).
   */
  userAgent: string;
  /**
   * Where ResetOwl keeps isolated homes for extra accounts:
   * `<managedRoot>/claude-code/<id>`, `<managedRoot>/codex/<id>`.
   */
  managedRoot: string;
  /**
   * macOS generic-password lookup by service name and, when given, account
   * (`-a`); null when absent or not on macOS.
   */
  readKeychain(service: string, account?: string): Promise<string | null>;
  /**
   * Runs a vendor CLI as a short-lived JSON-RPC server (`codex app-server`)
   * and returns the child; absent where no CLI may run (tests, the browser).
   * The env given is merged over the machine's, with the CLI on its PATH.
   */
  spawnCli?(command: string, args: readonly string[], env: Record<string, string>): CliChild;
}

/** The parts of a spawned CLI a JSON-RPC exchange needs. */
export interface CliChild {
  stdin: {
    write(data: string): unknown;
    on(event: 'error', fn: (err: Error) => void): unknown;
  } | null;
  stdout: { on(event: 'data', fn: (chunk: Buffer) => void): unknown } | null;
  stderr: { on(event: 'data', fn: (chunk: Buffer) => void): unknown } | null;
  on(event: 'error', fn: (err: NodeJS.ErrnoException) => void): unknown;
  on(event: 'close', fn: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  kill(signal?: NodeJS.Signals): unknown;
}

/** One login a provider found on this machine. */
export interface DetectedLogin {
  provider: LocalProviderId;
  /** The login's home: a Claude Code config dir, a Codex home. */
  home: string;
  /** The login a plain terminal uses (`~/.claude`, `$CODEX_HOME` or `~/.codex`). */
  isDefault: boolean;
  /** Lives under `managedRoot`, i.e. ResetOwl signed it in. */
  managed: boolean;
}

/** A process to spawn to sign a new, isolated account in. */
export interface LoginCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
  /**
   * The CLI hands its automatic sign-in link (the one whose callback is on
   * localhost and needs no code) to `$BROWSER`, and prints a manual link
   * that ends in a code to paste back. The caller then points `BROWSER` at a
   * script of its own to capture the first, and offers the printed one as
   * the code path.
   */
  capturesBrowser?: boolean;
  /**
   * Hosts a printed sign-in link must be on to be shown (Codex's
   * `auth.openai.com`); any https link when absent.
   */
  linkHosts?: readonly string[];
}

export interface LoginOptions {
  /**
   * Sign in with a page and a one-time code that can be finished on another
   * device, instead of the browser on this computer (the default).
   */
  deviceCode?: boolean;
}

export interface ReadOptions {
  /** `YYYY-MM-DD`, a local day: tokens from this day on are counted. */
  sinceDay: string;
  /** False skips the network: `snapshot` is null, identity and tokens are still read. */
  fetchLimits: boolean;
}

export interface CodingAgentProvider {
  id: LocalProviderId;
  displayName: string;
  detect(env: ProviderEnv): Promise<DetectedLogin[]>;
  /** Never throws for provider errors: they become the snapshot's status and message. */
  read(login: DetectedLogin, env: ProviderEnv, opts: ReadOptions): Promise<SyncAccount>;
  /**
   * The command that signs a NEW isolated account into `home`: through the
   * browser on this computer, or by device code when `opts.deviceCode`.
   */
  loginCommand(home: string, opts?: LoginOptions): LoginCommand;
  /** Whether the provider offers a device-code sign-in for another device. */
  supportsDeviceCode?: boolean;
  /**
   * Who a login just signed into `home` is, as the `externalId` `read` would
   * give it; null when the folder holds no signed-in account. Run after the
   * login command exits, to tell a real sign-in from a CLI that only exited,
   * and an account already on this machine from a new one.
   */
  signedInAs(home: string): Promise<string | null>;
  /** The env a terminal needs to use this login; `{}` for the default login. */
  launchEnv(login: DetectedLogin): Record<string, string>;
  /**
   * The command the collector runs to let the vendor's own CLI renew a lapsed
   * login of its own (Claude Code's `claude auth status`), spending no usage.
   * ResetOwl runs it but never refreshes a token itself. Absent for a provider
   * whose CLI renews another way (Codex renews inside its usage read, through
   * `codex app-server`) or not on demand (Grok renews when `grok` runs).
   */
  refreshCommand?(login: DetectedLogin): LoginCommand;
}
