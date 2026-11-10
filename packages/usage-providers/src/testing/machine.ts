import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LocalProviderId } from '@flama/shared/subscriptions';
import type { DetectedLogin, ProviderEnv } from '../types';
import {
  claudeAssistantLine,
  codexSessionLines,
  fakeJwt,
  jsonl,
  writeJson,
  writeText,
} from './files';

/**
 * A computer with coding-agent logins on it, written to a throwaway home the
 * way the vendors' own CLIs leave them: Claude Code config dirs, Codex homes
 * and Grok homes, each with its login, its identity and the transcripts its
 * tokens are counted from. Nothing here is a real credential, and a machine
 * never reaches a vendor by itself: `env()` refuses the network unless it is
 * given a `fetch` (a `FakeVendors`').
 */

/** How a login's access token stands when the machine is read. */
export type TokenState =
  /** Good for another hour. */
  | 'valid'
  /** Lapsed, with a refresh token the vendor's CLI can renew it with. */
  | 'renewable'
  /** Lapsed with nothing to renew it: signed out. */
  | 'lapsed'
  /** No login in the folder at all. */
  | 'none';

export interface MachineLogin {
  provider: LocalProviderId;
  /** The login as the provider's `detect` reports it. */
  login: DetectedLogin;
  /** The secret the provider sends its vendor; never anywhere else. */
  credential: string;
  /** The `externalId` a read of this login gives. */
  externalId: string;
  email: string;
}

export interface TokenUse {
  /** When the turn happened; an hour before the machine's `now` when absent. */
  at?: Date;
  model?: string;
  input?: number;
  output?: number;
  cacheRead?: number;
}

interface LoginOptions {
  /** Names the login: its email is `<name>@<provider>.test` unless `email` says otherwise. */
  name: string;
  email?: string;
  /** A login ResetOwl signed in itself, under the managed root, in a folder of this name. */
  managed?: string;
  token?: TokenState;
  /** How long a `valid` token stays good, in milliseconds; an hour (a day for Grok) when absent. */
  validFor?: number;
  /** Turns to write into the login's transcripts. */
  used?: TokenUse[];
}

export interface ClaudeLoginOptions extends LoginOptions {
  /** A second config dir beside the default: `.claude-<dir>`. */
  dir?: string;
  subscriptionType?: string;
  rateLimitTier?: string;
  organization?: string;
}

export interface CodexLoginOptions extends LoginOptions {
  plan?: string;
  /** The end of the paid period, as the id token carries it. */
  activeUntil?: Date;
  /** A home with only `OPENAI_API_KEY`: no plan, no limits. */
  apiKeyOnly?: boolean;
}

export type GrokLoginOptions = Omit<LoginOptions, 'used'>;

const HOUR = 3_600_000;

export class FakeMachine {
  readonly logins: MachineLogin[] = [];
  private turn = 0;

  private constructor(
    readonly home: string,
    readonly managedRoot: string,
    private readonly clock: () => Date,
  ) {}

  /**
   * A machine with nothing on it. `now` is its clock: a date fixes it, a
   * function is read each time, and absent it is the real one.
   */
  static async create(
    opts: { now?: Date | (() => Date); managedRoot?: string } = {},
  ): Promise<FakeMachine> {
    const home = await mkdtemp(join(tmpdir(), 'resetowl-machine-'));
    const now = opts.now;
    const clock = typeof now === 'function' ? now : now ? () => now : () => new Date();
    return new FakeMachine(home, opts.managedRoot ?? join(home, 'managed'), clock);
  }

  /** Every credential on the machine: what must never appear in a sync or a log. */
  get credentials(): string[] {
    return this.logins.map((login) => login.credential);
  }

  /** A `ProviderEnv` over this machine; the network is refused unless `fetch` is given. */
  env(overrides: Partial<ProviderEnv> = {}): ProviderEnv {
    return {
      home: this.home,
      platform: 'linux',
      env: {},
      now: this.clock,
      fetch: (async () => {
        throw new TypeError('network disabled: give FakeMachine.env a fetch');
      }) as typeof fetch,
      userAgent: 'resetowl-desktop/test',
      managedRoot: this.managedRoot,
      readKeychain: async () => null,
      ...overrides,
    };
  }

  /** Removes the home. */
  async dispose(): Promise<void> {
    await rm(this.home, { recursive: true, force: true });
  }

  /** A Claude Code login: `~/.claude`, `~/.claude-<dir>`, or a managed folder. */
  async claude(opts: ClaudeLoginOptions): Promise<MachineLogin> {
    const now = this.clock().getTime();
    const isDefault = !opts.dir && !opts.managed;
    const dir = opts.managed
      ? join(this.managedRoot, 'claude-code', opts.managed)
      : join(this.home, opts.dir ? `.claude-${opts.dir}` : '.claude');
    const email = opts.email ?? `${opts.name}@claude.test`;
    const credential = `claude-token-${opts.name}`;
    const state = opts.token ?? 'valid';
    if (state !== 'none') {
      await writeJson(join(dir, '.credentials.json'), {
        claudeAiOauth: {
          accessToken: credential,
          expiresAt: state === 'valid' ? now + (opts.validFor ?? HOUR) : now - 60_000,
          ...(state === 'lapsed'
            ? {}
            : {
                refreshToken: `claude-refresh-${opts.name}`,
                refreshTokenExpiresAt: now + 30 * 24 * HOUR,
              }),
          subscriptionType: opts.subscriptionType ?? 'pro',
          ...(opts.rateLimitTier ? { rateLimitTier: opts.rateLimitTier } : {}),
        },
      });
    }
    // The default dir's identity lives beside it, in ~/.claude.json.
    await writeJson(isDefault ? join(this.home, '.claude.json') : join(dir, '.claude.json'), {
      oauthAccount: {
        accountUuid: `claude-${opts.name}`,
        emailAddress: email,
        ...(opts.organization ? { organizationName: opts.organization } : {}),
      },
    });
    if (opts.used?.length) {
      await writeText(
        join(dir, 'projects', 'project', `${opts.name}.jsonl`),
        jsonl(
          ...opts.used.map((use) => {
            this.turn += 1;
            return claudeAssistantLine({
              ts: (use.at ?? new Date(now - HOUR)).toISOString(),
              model: use.model,
              id: `msg-${opts.name}-${this.turn}`,
              requestId: `req-${opts.name}-${this.turn}`,
              input: use.input,
              output: use.output,
              cacheRead: use.cacheRead,
            });
          }),
        ),
      );
    }
    return this.add({
      provider: 'claude-code',
      login: { provider: 'claude-code', home: dir, isDefault, managed: Boolean(opts.managed) },
      credential,
      externalId: `claude-${opts.name}`,
      email,
    });
  }

  /** A Codex login: `~/.codex`, or a managed home. */
  async codex(opts: CodexLoginOptions): Promise<MachineLogin> {
    const now = this.clock().getTime();
    const dir = opts.managed
      ? join(this.managedRoot, 'codex', opts.managed)
      : join(this.home, '.codex');
    const email = opts.email ?? `${opts.name}@codex.test`;
    const credential = `codex-token-${opts.name}`;
    const state = opts.token ?? 'valid';
    if (opts.apiKeyOnly) {
      await writeJson(join(dir, 'auth.json'), { OPENAI_API_KEY: `sk-test-${opts.name}` });
    } else if (state !== 'none') {
      await writeJson(join(dir, 'auth.json'), {
        OPENAI_API_KEY: null,
        tokens: {
          id_token: fakeJwt({
            email,
            'https://api.openai.com/auth': {
              chatgpt_plan_type: opts.plan ?? 'plus',
              chatgpt_account_id: `codex-${opts.name}`,
              ...(opts.activeUntil
                ? { chatgpt_subscription_active_until: opts.activeUntil.toISOString() }
                : {}),
            },
          }),
          // Codex keeps no expiry on disk: a login without an access token is the lapsed one.
          ...(state === 'valid' ? { access_token: credential } : {}),
          account_id: `codex-${opts.name}`,
        },
      });
    }
    for (const [index, use] of (opts.used ?? []).entries()) {
      const at = use.at ?? new Date(now - HOUR);
      const day = [
        String(at.getFullYear()),
        String(at.getMonth() + 1).padStart(2, '0'),
        String(at.getDate()).padStart(2, '0'),
      ];
      await writeText(
        join(dir, 'sessions', ...day, `rollout-${opts.name}-${index}.jsonl`),
        jsonl(
          ...codexSessionLines({
            ts: at.toISOString(),
            sessionId: `session-${opts.name}-${index}`,
            model: use.model,
            input: use.input,
            cachedInput: use.cacheRead,
            output: use.output,
          }),
        ),
      );
    }
    return this.add({
      provider: 'codex',
      login: {
        provider: 'codex',
        home: dir,
        isDefault: !opts.managed,
        managed: Boolean(opts.managed),
      },
      credential: opts.apiKeyOnly ? `sk-test-${opts.name}` : credential,
      externalId: opts.apiKeyOnly || state === 'none' ? '' : `codex-${opts.name}`,
      email,
    });
  }

  /** A Grok Build login: `~/.grok`, or a managed home. */
  async grok(opts: GrokLoginOptions): Promise<MachineLogin> {
    const now = this.clock().getTime();
    const dir = opts.managed
      ? join(this.managedRoot, 'grok', opts.managed)
      : join(this.home, '.grok');
    const email = opts.email ?? `${opts.name}@grok.test`;
    const credential = `grok-session-${opts.name}`;
    const state = opts.token ?? 'valid';
    await writeJson(
      join(dir, 'auth.json'),
      state === 'none'
        ? // What `grok logout` leaves: the issuer, with no session in it.
          { 'https://accounts.x.ai/sign-in': {} }
        : {
            'https://accounts.x.ai/sign-in': {
              key: credential,
              user_id: `grok-${opts.name}`,
              email,
              team_id: `team-${opts.name}`,
              // Grok Build renews its own session; ResetOwl cannot, so both lapsed states read alike.
              expires_at: new Date(
                state === 'valid' ? now + (opts.validFor ?? 24 * HOUR) : now - 60_000,
              ).toISOString(),
            },
          },
    );
    return this.add({
      provider: 'grok',
      login: {
        provider: 'grok',
        home: dir,
        isDefault: !opts.managed,
        managed: Boolean(opts.managed),
      },
      credential,
      externalId: `grok-${opts.name}`,
      email,
    });
  }

  private add(login: MachineLogin): MachineLogin {
    this.logins.push(login);
    return login;
  }
}
