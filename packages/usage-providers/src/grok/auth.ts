import { join } from 'node:path';
import { isRecord, readJson, str } from '../lib/util';

/**
 * What Grok Build keeps in `<GROK_HOME>/auth.json` after `grok login`: an
 * object keyed by issuer (`https://auth.x.ai`, `https://auth.x.ai::<client>`,
 * or an alternate issuer), each entry
 * `{ key, user_id, email, team_id, expires_at, oidc_client_id, ... }` where
 * `key` is the session token.
 *
 * Read only: the session is the CLI's to renew (`grok` refreshes it on use),
 * so ResetOwl never rewrites the file. Which entry is read follows Orca's
 * reader, which works against xAI today: the default xAI OAuth issuer wins,
 * and an alternate issuer is a fallback only when the file has no default
 * entry at all.
 */
export interface GrokAuth {
  accessToken: string;
  userId: string | null;
  email: string | null;
  teamId: string | null;
  expiresAt: Date | null;
}

/** The default xAI OAuth issuer, preferred over stale alternate issuers. */
export const PREFERRED_GROK_ISSUER = 'https://auth.x.ai';

/** A session this close to its expiry counts as lapsed. */
export const GROK_TOKEN_SKEW_MS = 5 * 60_000;

function isPreferredIssuer(key: string): boolean {
  return key === PREFERRED_GROK_ISSUER || key.startsWith(`${PREFERRED_GROK_ISSUER}::`);
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
 * Whether the session can still be used: more than five minutes from its
 * expiry. A session with no expiry is inconclusive and counts as fresh; the
 * billing endpoint can still reject it.
 */
export function isGrokSessionFresh(auth: Pick<GrokAuth, 'expiresAt'>, now: Date): boolean {
  if (!auth.expiresAt) return true;
  return auth.expiresAt.getTime() - now.getTime() > GROK_TOKEN_SKEW_MS;
}

/**
 * The session to read with: the first fresh default-issuer entry, else the
 * first lapsed one (the CLI renews it on its next run), else, only when the
 * file names no default issuer at all, the first alternate issuer's. Null for
 * a file with no token: a `grok logout` leaves the keys behind empty, and a
 * tokenless default entry does not bring an alternate issuer back.
 */
export function parseGrokAuth(data: Record<string, unknown>, now: Date): GrokAuth | null {
  let preferredSeen = false;
  let lapsedPreferred: GrokAuth | null = null;
  let fallback: GrokAuth | null = null;
  for (const [issuer, value] of Object.entries(data)) {
    const preferred = isPreferredIssuer(issuer);
    preferredSeen ||= preferred;
    const entry = entryFrom(value);
    if (!entry) continue;
    if (preferred) {
      if (isGrokSessionFresh(entry, now)) return entry;
      lapsedPreferred ??= entry;
      continue;
    }
    fallback ??= entry;
  }
  return lapsedPreferred ?? (preferredSeen ? null : fallback);
}

export async function readGrokAuth(home: string, now: Date): Promise<GrokAuth | null> {
  const data = await readJson(join(home, 'auth.json'));
  return data ? parseGrokAuth(data, now) : null;
}
