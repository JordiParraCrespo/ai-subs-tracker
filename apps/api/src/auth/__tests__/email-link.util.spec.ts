import { describe, expect, it } from 'vitest';
import { browserLinkFor } from '../infrastructure/email-link.util';

const WEB = 'https://app.resetowl.com';
const link = (callbackURL: string) =>
  `https://api.resetowl.com/api/auth/reset-password/tok123?callbackURL=${encodeURIComponent(callbackURL)}`;
const callbackOf = (url: string) => new URL(url).searchParams.get('callbackURL');

describe('browserLinkFor', () => {
  // The regression: a reset asked from the desktop app emailed a link that
  // redirected to app://resetowl/reset-password, which no browser can open.
  it('moves a desktop callback onto the web app, keeping path and query', () => {
    const out = browserLinkFor(link('app://resetowl/reset-password?from=desktop'), WEB);
    expect(callbackOf(out)).toBe('https://app.resetowl.com/reset-password?from=desktop');
    expect(new URL(out).pathname).toBe('/api/auth/reset-password/tok123');
  });

  it('moves the pre-rename desktop origin too', () => {
    expect(callbackOf(browserLinkFor(link('app://subtrack/reset-password'), WEB))).toBe(
      'https://app.resetowl.com/reset-password',
    );
  });

  it('leaves a web callback, a missing one and an unparsable link alone', () => {
    const web = link('https://app.resetowl.com/reset-password');
    expect(browserLinkFor(web, WEB)).toBe(web);
    const bare = 'https://api.resetowl.com/api/auth/verify-email?token=t';
    expect(browserLinkFor(bare, WEB)).toBe(bare);
    expect(browserLinkFor('not a url', WEB)).toBe('not a url');
  });
});
