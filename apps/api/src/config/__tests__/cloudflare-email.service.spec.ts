import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareEmailService } from '../cloudflare-email.service';

const params = {
  locale: 'en',
  subject: 'Reset your password',
  preview: 'Reset',
  brandName: 'ResetOwl',
  footer: 'Footer',
  heading: 'Reset',
  body: 'Body',
  actionLabel: 'Reset',
  url: 'https://app.resetowl.com/reset?token=t',
  helperText: 'Helper',
  fallbackLabel: 'Fallback',
  closingText: 'Bye',
};

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
}

const settings = {
  'cloudflareEmail.accountId': 'acc-1',
  'cloudflareEmail.apiToken': 'token-1',
  'email.from': 'noreply@resetowl.com',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('CloudflareEmailService', () => {
  it('refuses to start without the account or the token', () => {
    expect(() => new CloudflareEmailService(configWith({ 'email.from': 'a@b.c' }))).toThrow(
      /CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_TOKEN/,
    );
  });

  it("posts the rendered email to the account's send endpoint with the token", async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply(200, {
        success: true,
        errors: [],
        result: { message_id: 'm1', delivered: ['ana@example.com'] },
      }),
    );
    vi.stubGlobal('fetch', fetch);

    await new CloudflareEmailService(configWith(settings)).sendPasswordReset(
      'ana@example.com',
      params,
    );

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/email/sending/send');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'noreply@resetowl.com',
      to: 'ana@example.com',
      subject: 'Reset your password',
    });
    expect(body.html).toContain('https://app.resetowl.com/reset?token=t');
  });

  // A refusal that resolved quietly would mark the job done and lose the email.
  it('throws on a refusal, naming the code but never the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply(403, {
          success: false,
          errors: [{ code: 10203, message: 'email.sending.error.email.sending_disabled' }],
          result: null,
        }),
      ),
    );

    const sending = new CloudflareEmailService(configWith(settings)).sendPasswordReset(
      'ana@example.com',
      params,
    );
    await expect(sending).rejects.toThrow(/HTTP 403: 10203/);
    await expect(sending).rejects.not.toThrow(/token-1/);
  });

  it("turns Cloudflare's throttle into the 429 problem and stops calling until the pause ends", async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply(429, {
        success: false,
        errors: [{ code: 10004, message: 'email.sending.error.throttled' }],
        result: null,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const service = new CloudflareEmailService(configWith(settings));

    await expect(
      service.sendWelcome('ana@example.com', {
        ...params,
        eyebrow: '',
        greeting: '',
        supportText: '',
        signoff: '',
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_001',
      extensions: expect.objectContaining({ retryAfterSeconds: expect.any(Number) }),
    });
    await expect(service.sendPasswordReset('ben@example.com', params)).rejects.toMatchObject({
      code: 'EMAIL_001',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends a named sender as the address and the name', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, { success: true, errors: [], result: {} }));
    vi.stubGlobal('fetch', fetch);
    const config = configWith({ ...settings, 'email.from': 'ResetOwl <noreply@resetowl.com>' });

    await new CloudflareEmailService(config).sendPasswordReset('ana@example.com', params);

    expect(JSON.parse(fetch.mock.calls[0][1].body).from).toEqual({
      address: 'noreply@resetowl.com',
      name: 'ResetOwl',
    });
  });
});
