import { AppError } from '@flama/backend-core';
import { EmailService } from '@flama/backend-email';
import { I18nService, type LocalizedFormatter } from '@flama/backend-i18n';
import { QUEUE_NAMES } from '@flama/shared';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { type Job, RateLimitError } from 'bullmq';
import type { LocaleResolverPort } from '../../profile/application/locale-resolver.port';
import { LOCALE_RESOLVER } from '../../profile/profile.di-tokens';
import { EmailJobMapper, type EmailLocaleTarget } from '../email-job.mapper';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    @Inject(LOCALE_RESOLVER)
    private readonly locales: LocaleResolverPort,
    private readonly mapper: EmailJobMapper,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);
    try {
      await this.send(job);
    } catch (error) {
      const waitMs = retryAfterMs(error);
      if (waitMs === undefined) throw error;
      // The provider said "not now": hold the whole queue until it resets and
      // put this job back without spending an attempt (integrations.md).
      this.logger.warn({ message: 'Email provider rate limit; holding the queue', waitMs });
      await this.worker.rateLimit(waitMs);
      throw new RateLimitError();
    }
  }

  private async send(job: Job): Promise<void> {
    switch (job.name) {
      case 'password-reset': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendPasswordReset(
          target.to,
          this.mapper.toPasswordReset(job.data, t),
        );
        break;
      }
      case 'email-verification': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendEmailVerification(
          target.to,
          this.mapper.toEmailVerification(job.data, t),
        );
        break;
      }
      case 'welcome': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendWelcome(target.to, this.mapper.toWelcome(job.data, t));
        break;
      }
      case 'invitation': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendInvitation(target.to, this.mapper.toInvitation(job.data, t));
        break;
      }
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }

  /**
   * The language to write in. A job that names the recipient's user id reads
   * their saved preference; one that only has an address (an invitation) is
   * matched to an account by that address, and a stranger gets the default.
   */
  private async formatter(target: EmailLocaleTarget): Promise<LocalizedFormatter> {
    const resolved = target.userId
      ? await this.locales.resolveForRecipient(target.userId)
      : await this.locales.resolveForEmailRecipient(target.to);
    return this.i18n.for(resolved.locale, resolved.timeZone);
  }
}

/** How long a provider's rate-limit refusal (a 429 `AppError`) asks us to wait. */
function retryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof AppError) || error.getStatus() !== 429) return undefined;
  const seconds = error.extensions.retryAfterSeconds;
  return typeof seconds === 'number' ? seconds * 1000 : 60_000;
}
