import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The Cloudflare Email Sending driver's settings, read when
 * `EMAIL_PROVIDER=cloudflare`. Both are optional here so every other driver
 * boots without them; the driver itself refuses to start without either.
 */
const schema = z.object({
  /** The Cloudflare account the sending domain is onboarded on. */
  accountId: z.string().optional(),
  /** An API token that may send email and nothing else (`CLOUDFLARE_EMAIL_TOKEN_FILE` in production). */
  apiToken: z.string().optional(),
});

export const cloudflareEmailConfig = registerAs('cloudflareEmail', () =>
  parseEnv('cloudflareEmail', schema, {
    accountId: 'CLOUDFLARE_ACCOUNT_ID',
    apiToken: 'CLOUDFLARE_EMAIL_TOKEN',
  }),
);
