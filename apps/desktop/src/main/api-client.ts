import type {
  LimitWindow,
  SnapshotSource,
  SnapshotStatus,
  SyncAccountsInput,
} from '@flama/shared/schemas/accounts';
import type { ProviderId } from '@flama/shared/subscriptions';

/**
 * The slice of the API the main process calls: one sync endpoint, with the
 * bearer token the screens handed over. A network failure throws; an HTTP
 * answer is a result, so the collector can tell "signed out" from "down".
 */

/** The fields of `AccountResponseDto` the main process reads. */
export interface SyncedAccount {
  id: string;
  provider: ProviderId;
  externalId: string;
  displayName: string;
  isActive: boolean;
  latest: {
    status: SnapshotStatus;
    windows: LimitWindow[];
    /** Where the reading came from and when; the tray drops a hand-recorded one once it expires. */
    source?: SnapshotSource;
    capturedAt?: string;
  } | null;
}

export type SyncResult =
  | { kind: 'ok'; accounts: SyncedAccount[] }
  | { kind: 'unauthorized' }
  | { kind: 'http_error'; status: number; message: string };

export class NetworkError extends Error {
  override name = 'NetworkError';
}

const TIMEOUT_MS = 30_000;

export async function postSync(opts: {
  apiUrl: string;
  token: string;
  input: SyncAccountsInput;
  userAgent: string;
  fetch: typeof fetch;
}): Promise<SyncResult> {
  let res: Response;
  try {
    res = await opts.fetch(`${opts.apiUrl}/api/v1/accounts/sync`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': opts.userAgent,
      },
      body: JSON.stringify(opts.input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : String(err));
  }
  if (res.status === 401) return { kind: 'unauthorized' };
  if (!res.ok) {
    let message = `The API answered ${res.status}.`;
    try {
      const body = (await res.json()) as { title?: unknown; detail?: unknown };
      const text = typeof body.detail === 'string' ? body.detail : body.title;
      if (typeof text === 'string' && text) message = text.slice(0, 300);
    } catch {
      // not a problem document
    }
    return { kind: 'http_error', status: res.status, message };
  }
  const body: unknown = await res.json().catch(() => []);
  return { kind: 'ok', accounts: Array.isArray(body) ? (body as SyncedAccount[]) : [] };
}
