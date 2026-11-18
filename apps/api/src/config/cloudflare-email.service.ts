import { UpstreamLimiter } from '@flama/backend-core';
import type { ErrorDefinition } from '@flama/backend-ddd';
import {
  EmailService,
  type EmailVerificationEmailParams,
  type InvitationEmailParams,
  type PasswordResetEmailParams,
  renderEmailVerificationEmail,
  renderInvitationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  type WelcomeEmailParams,
} from '@flama/backend-email';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export const CloudflareEmailErrors = {
  /** Cloudflare refused a send for its rate; the email queue waits it out. */
  RATE_LIMITED: {
    code: 'EMAIL_001',
    message: 'The email service is rate limiting us',
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;

const API = 'https://api.cloudflare.com/client/v4/accounts';
/** Cloudflare's `email.sending.error.throttled`. */
const THROTTLED = 10004;

interface CloudflareEnvelope {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: {
    message_id?: string;
    permanent_bounces?: string[];
    suppressed_recipients?: string[];
  } | null;
}

/**
 * Sends the API's transactional email through Cloudflare Email Sending's REST
 * API (`POST /accounts/{account}/email/sending/send`).
 *
 * The budget (`.agents/rules/integrations.md`): Cloudflare counts sends per
 * account — a daily quota that starts conservative and grows with the
 * account's standing, and a monthly allowance on Workers Paid (3,000, then
 * billed). It publishes no per-second rate. It says "stop" with a `429` whose
 * body carries code 10004 (`email.sending.error.throttled`); no `Retry-After`
 * is documented, so the limiter's default pause applies. One email job is one
 * call, against the one bucket, the account.
 *
 * Every other refusal is thrown as a plain error naming Cloudflare's code, so
 * the job fails and its reason is in the log; the token never is.
 */
@Injectable()
export class CloudflareEmailService extends EmailService {
  private readonly logger = new Logger(CloudflareEmailService.name);
  private readonly limiter = new UpstreamLimiter(
    'Cloudflare Email',
    CloudflareEmailErrors.RATE_LIMITED,
    undefined,
    { maxInFlight: 4, maxQueued: 100, maxWaitMs: 30_000 },
  );
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly from: string | { address: string; name: string };

  constructor(configService: ConfigService) {
    super();
    const accountId = configService.get<string>('cloudflareEmail.accountId');
    const apiToken = configService.get<string>('cloudflareEmail.apiToken');
    if (!accountId || !apiToken) {
      throw new Error(
        'EMAIL_PROVIDER=cloudflare needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_TOKEN (or CLOUDFLARE_EMAIL_TOKEN_FILE).',
      );
    }
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.from = sender(configService.getOrThrow<string>('email.from'));
  }

  async sendPasswordReset(to: string, params: PasswordResetEmailParams): Promise<void> {
    await this.send(to, params.subject, await renderPasswordResetEmail(params));
  }

  async sendEmailVerification(to: string, params: EmailVerificationEmailParams): Promise<void> {
    await this.send(to, params.subject, await renderEmailVerificationEmail(params));
  }

  async sendWelcome(to: string, params: WelcomeEmailParams): Promise<void> {
    await this.send(to, params.subject, await renderWelcomeEmail(params));
  }

  async sendInvitation(to: string, params: InvitationEmailParams): Promise<void> {
    await this.send(to, params.subject, await renderInvitationEmail(params));
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const { response, errorBody } = await this.limiter.exchange(
      `account:${this.accountId}`,
      () =>
        fetch(`${API}/${this.accountId}/email/sending/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: this.from, to, subject, html }),
        }),
      (body) => ({ limited: codesOf(body).includes(THROTTLED) }),
    );

    if (!response.ok) {
      const errors = parse(errorBody ?? '')?.errors ?? [];
      const reason = errors.map((e) => `${e.code ?? '?'} ${e.message ?? ''}`.trim()).join('; ');
      throw new Error(
        `Cloudflare refused "${subject}" (HTTP ${response.status}${reason ? `: ${reason}` : ''})`,
      );
    }

    const result = parse(await response.text())?.result;
    if (result?.permanent_bounces?.length) {
      this.logger.warn(`"${subject}" bounced permanently for ${to}`);
    } else if (result?.suppressed_recipients?.length) {
      this.logger.warn(`"${subject}" not sent: ${to} is on Cloudflare's suppression list`);
    } else {
      this.logger.log(`Sent "${subject}" (id: ${result?.message_id ?? 'unknown'})`);
    }
  }
}

/** `EMAIL_FROM` as Cloudflare takes it: `Name <address>` becomes `{ address, name }`. */
function sender(from: string): string | { address: string; name: string } {
  const named = /^\s*(.+?)\s*<([^>]+)>\s*$/.exec(from);
  return named ? { address: named[2], name: named[1].replace(/^"|"$/g, '') } : from.trim();
}

function parse(body: string): CloudflareEnvelope | undefined {
  try {
    return JSON.parse(body) as CloudflareEnvelope;
  } catch {
    return undefined;
  }
}

function codesOf(body: string): number[] {
  return (parse(body)?.errors ?? []).map((e) => e.code ?? 0);
}
