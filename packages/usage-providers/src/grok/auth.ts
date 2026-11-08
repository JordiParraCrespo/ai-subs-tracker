import { join } from 'node:path';
import { isRecord, readJson, str } from '../lib/util';

/**
 * What Grok Build keeps in `<GROK_HOME>/auth.json` after `grok login`: an
 * object keyed by issuer (`https://accounts.x.ai/sign-in`, older logins
 * `https://auth.x.ai`, an enterprise IdP), each entry
 * `{ key, user_id, email, team_id, expires_at, ... }` where `key` is the
 * session token. The CLI's own docs describe reading `key` to call its chat
 * proxy.
 *
 * Read only: the session is the CLI's to renew (tokens last 7 days and
 * `grok` refreshes them on use), so ResetOwl never rewrites the file.
 */
export interface GrokAuth {
  accessToken: string;
  userId: string | null;
  email: string | null;
  teamId: string | null;
  expiresAt: Date | null;
}

/** xAI's own sign-in, preferred over an alternate issuer in the same file. */
const XAI_ISSUERS = ['https://accounts.x.ai', 'https://auth.x.ai'];

function isXaiIssuer(key: string): boolean {
  return XAI_ISSUERS.some(
    (issuer) => key === issuer || key.startsWith(`${issuer}/`) || key.startsWith(`${issuer}::`),
  );
}

function entryFrom(value: unknown): GrokAuth | null {
  if (!isRecord(value)) return null;
  const accessToken = str(value.key);
  if (!accessToken) return null;
  const expires = str(value.expires_at);
  const expiresAt = expires ? new Date(expires) : null;
  return {
    accessToken,
    userId: str(value.user_id),
    email: str(value.email),
    teamId: str(value.team_id),
    expiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
  };
}

/**
 * The session to read with: xAI's own sign-in when the file has one (the
 * freshest, if there are several), else the first other issuer's. Null for a
 * file with no token (a `grok logout` leaves the keys behind empty).
 */
export function parseGrokAuth(data: Record<string, unknown>): GrokAuth | null {
  let preferred: GrokAuth | null = null;
  let fallback: GrokAuth | null = null;
  for (const [issuer, value] of Object.entries(data)) {
    const entry = entryFrom(value);
    if (!entry) continue;
    if (isXaiIssuer(issuer)) {
      const later = (entry.expiresAt?.getTime() ?? 0) > (preferred?.expiresAt?.getTime() ?? 0);
      if (!preferred || later) preferred = entry;
    } else {
      fallback ??= entry;
    }
  }
  return preferred ?? fallback;
}

export async function readGrokAuth(home: string): Promise<GrokAuth | null> {
  const data = await readJson(join(home, 'auth.json'));
  return data ? parseGrokAuth(data) : null;
}
