import { join } from 'node:path';
import { isRecord, type JsonRecord, readJson, str } from '../lib/util';

/**
 * What Codex keeps in `<CODEX_HOME>/auth.json` after `codex login`:
 * `{ OPENAI_API_KEY, tokens: { id_token, access_token, refresh_token, account_id } }`.
 *
 * Read only; the refresh token is never touched, so Codex's own login is
 * never rotated out from under it.
 */
export interface CodexAuth {
  /** `chatgpt` when signed in with ChatGPT, `api_key` with only an API key. */
  mode: 'chatgpt' | 'api_key';
  accessToken: string | null;
  accountId: string | null;
  email: string | null;
  planType: string | null;
  organization: string | null;
}

const AUTH_CLAIM = 'https://api.openai.com/auth';
const PROFILE_CLAIM = 'https://api.openai.com/profile';

/** The payload of a JWT, decoded without verification (it is only read for display). */
export function decodeJwtPayload(token: string): JsonRecord | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const data: unknown = JSON.parse(json);
    return isRecord(data) ? data : null;
  } catch {
    return null;
  }
}

export function parseCodexAuth(data: JsonRecord): CodexAuth | null {
  const tokens = isRecord(data.tokens) ? data.tokens : null;
  const accessToken = str(tokens?.access_token) ?? str(tokens?.accessToken);
  const idToken = str(tokens?.id_token) ?? str(tokens?.idToken);
  if (!tokens || (!accessToken && !idToken)) {
    return str(data.OPENAI_API_KEY)
      ? {
          mode: 'api_key',
          accessToken: null,
          accountId: null,
          email: null,
          planType: null,
          organization: null,
        }
      : null;
  }
  const payload = idToken ? decodeJwtPayload(idToken) : null;
  const auth = isRecord(payload?.[AUTH_CLAIM]) ? (payload[AUTH_CLAIM] as JsonRecord) : null;
  const profile = isRecord(payload?.[PROFILE_CLAIM])
    ? (payload[PROFILE_CLAIM] as JsonRecord)
    : null;
  return {
    mode: 'chatgpt',
    accessToken,
    accountId:
      str(tokens.account_id) ??
      str(tokens.accountId) ??
      str(auth?.chatgpt_account_id) ??
      str(payload?.chatgpt_account_id),
    email: str(payload?.email) ?? str(profile?.email),
    planType: str(auth?.chatgpt_plan_type),
    organization: str(auth?.workspace_name) ?? str(profile?.workspace_name),
  };
}

export async function readCodexAuth(home: string): Promise<CodexAuth | null> {
  const data = await readJson(join(home, 'auth.json'));
  return data ? parseCodexAuth(data) : null;
}
