/**
 * Every vendor ResetOwl asks about usage, faked in one place: Anthropic's
 * usage endpoint, ChatGPT's `wham/usage`, Grok Build's billing view and the
 * Z.AI / BigModel quota endpoint. A test scripts what each credential is
 * answered (`set`), hands `vendors.fetch` to a `ProviderEnv`, and afterwards
 * reads `vendors.requests` or runs `vendors.audit()`, which checks the rules
 * the product promises: an honest client name, no vendor client headers, and
 * every credential only at the vendor that issued it.
 *
 * `handle` is the same fake behind a real socket, for a process that cannot
 * be handed a `fetch` (the Electron app under Playwright).
 */

export const VENDORS = {
  anthropic: { origin: 'https://api.anthropic.com', path: '/api/oauth/usage', scheme: 'Bearer' },
  openai: { origin: 'https://chatgpt.com', path: '/backend-api/wham/usage', scheme: 'Bearer' },
  xai: { origin: 'https://cli-chat-proxy.grok.com', path: '/v1/billing', scheme: 'Bearer' },
  zai: { origin: 'https://api.z.ai', path: '/api/monitor/usage/quota/limit', scheme: null },
  bigmodel: {
    origin: 'https://open.bigmodel.cn',
    path: '/api/monitor/usage/quota/limit',
    scheme: null,
  },
} as const;

export type VendorId = keyof typeof VENDORS;
export const VENDOR_IDS = Object.keys(VENDORS) as VendorId[];

/** What a vendor answers one request with. */
export type Reply =
  | { kind: 'json'; status: number; body: unknown; delayMs?: number }
  | { kind: 'text'; status: number; body: string; contentType: string; delayMs?: number }
  | { kind: 'network'; message: string }
  | { kind: 'timeout' };

export const reply = {
  /** A JSON answer; 200 unless `status` says otherwise. */
  json: (body: unknown, status = 200, delayMs?: number): Reply => ({
    kind: 'json',
    status,
    body,
    delayMs,
  }),
  /** A bare status with a small JSON error body, as the vendors send. */
  status: (status: number): Reply => ({
    kind: 'json',
    status,
    body: { error: { message: `HTTP ${status}` } },
  }),
  /** A body that is not JSON: an HTML error page, a truncated answer, nothing at all. */
  text: (body: string, status = 200, contentType = 'text/html'): Reply => ({
    kind: 'text',
    status,
    body,
    contentType,
  }),
  /** The connection fails, as `fetch` reports it. */
  network: (message = 'fetch failed'): Reply => ({ kind: 'network', message }),
  /** The request outlives its timeout, as an aborted `fetch` reports it. */
  timeout: (): Reply => ({ kind: 'timeout' }),
};

export interface VendorRequest {
  /** The vendor whose endpoint was asked; null for any other URL. */
  vendor: VendorId | null;
  url: string;
  method: string;
  /** Header names lowercased. */
  headers: Record<string, string>;
  /** The credential sent, without its `Bearer ` prefix; null when none was. */
  credential: string | null;
}

export interface HandledResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  delayMs: number;
}

/** A request the fake refuses to answer, thrown to the caller as `fetch` would. */
export class VendorNetworkError extends TypeError {}

/** Client headers of the vendors' own CLIs, which ResetOwl must never send. */
const IMPERSONATION_HEADERS = [
  /^originator$/,
  /^openai-beta$/,
  /^x-grok-client-/,
  /^x-stainless-/,
  /^x-app$/,
  /^x-claude-code-/,
  /^chatgpt-account-id$/,
  /^anthropic-dangerous-/,
];
/** `ChatGPT-Account-Id` names the account asked about, not the client; allowed at OpenAI only. */
const ALLOWED_AT: Partial<Record<VendorId, RegExp[]>> = { openai: [/^chatgpt-account-id$/] };

type HeadersLike = ConstructorParameters<typeof Headers>[0];

function lowercaseHeaders(init: HeadersLike | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(init).forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function vendorOf(url: URL): VendorId | null {
  for (const id of VENDOR_IDS) {
    const vendor = VENDORS[id];
    if (url.origin === vendor.origin && url.pathname === vendor.path) return id;
  }
  return null;
}

export class FakeVendors {
  /** Every request made, in order, answered or not. */
  readonly requests: VendorRequest[] = [];
  private readonly scripts = new Map<string, Reply[]>();
  private readonly owners = new Map<string, VendorId>();

  /**
   * What `vendor` answers `credential` with: each reply once, in order, and
   * the last one from then on. A credential never set is answered 401, as a
   * vendor answers a token it does not know.
   */
  set(vendor: VendorId, credential: string, ...replies: Reply[]): this {
    if (replies.length === 0) throw new Error('FakeVendors.set needs at least one reply');
    this.scripts.set(`${vendor}\u0000${credential}`, [...replies]);
    this.owners.set(credential, vendor);
    return this;
  }

  /** Requests that reached `vendor`'s endpoint. */
  requestsTo(vendor: VendorId): VendorRequest[] {
    return this.requests.filter((request) => request.vendor === vendor);
  }

  /** Forgets the requests made so far; the scripts stay. */
  clearRequests(): void {
    this.requests.length = 0;
  }

  /** Answers one request; throws `VendorNetworkError` where a real `fetch` would reject. */
  async handle(input: {
    url: string;
    method?: string;
    headers?: HeadersLike;
  }): Promise<HandledResponse> {
    const url = new URL(input.url);
    const vendor = vendorOf(url);
    const headers = lowercaseHeaders(input.headers);
    const authorization = headers.authorization ?? null;
    const scheme = vendor ? VENDORS[vendor].scheme : 'Bearer';
    const credential =
      authorization === null
        ? null
        : scheme && authorization.startsWith(`${scheme} `)
          ? authorization.slice(scheme.length + 1)
          : authorization;
    this.requests.push({
      vendor,
      url: url.href,
      method: (input.method ?? 'GET').toUpperCase(),
      headers,
      credential,
    });
    if (!vendor) throw new VendorNetworkError(`fake vendors: no such endpoint ${url.href}`);

    const script = credential ? this.scripts.get(`${vendor}\u0000${credential}`) : undefined;
    const next = script ? (script.length > 1 ? script.shift() : script[0]) : reply.status(401);
    if (!next) throw new Error('unreachable: a script is never empty');
    if (next.kind === 'network') throw new VendorNetworkError(next.message);
    if (next.kind === 'timeout') {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    }
    return next.kind === 'json'
      ? {
          status: next.status,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(next.body),
          delayMs: next.delayMs ?? 0,
        }
      : {
          status: next.status,
          headers: { 'content-type': next.contentType },
          body: next.body,
          delayMs: next.delayMs ?? 0,
        };
  }

  /** A `fetch` over the fake, for `ProviderEnv.fetch`. */
  readonly fetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const handled = await this.handle({
      url: request ? request.url : String(input),
      method: init?.method ?? request?.method,
      headers: init?.headers ?? request?.headers,
    });
    if (handled.delayMs > 0) await new Promise((done) => setTimeout(done, handled.delayMs));
    // A null-body status (204, 304) refuses a body, as the platform's own Response does.
    const body = [204, 205, 304].includes(handled.status) ? null : handled.body;
    return new Response(body, { status: handled.status, headers: handled.headers });
  };

  /**
   * What the requests made so far got wrong, one line each; empty when they
   * kept every promise. `userAgent` is the name the caller was given.
   */
  audit(opts: { userAgent?: RegExp } = {}): string[] {
    const userAgent = opts.userAgent ?? /^resetowl-desktop\//;
    const problems: string[] = [];
    for (const request of this.requests) {
      const where = `${request.method} ${request.url}`;
      if (!request.vendor) {
        problems.push(`${where}: not a vendor usage endpoint`);
        // A credential sent anywhere else is the worst case; say whose it was.
        const owner = request.credential ? this.owners.get(request.credential) : undefined;
        if (owner) problems.push(`${where}: carries a credential issued by ${owner}`);
        continue;
      }
      if (request.method !== 'GET') problems.push(`${where}: a usage read must be a GET`);
      if (!userAgent.test(request.headers['user-agent'] ?? '')) {
        problems.push(`${where}: User-Agent "${request.headers['user-agent'] ?? ''}" is not ours`);
      }
      const allowed = ALLOWED_AT[request.vendor] ?? [];
      for (const name of Object.keys(request.headers)) {
        if (allowed.some((pattern) => pattern.test(name))) continue;
        if (IMPERSONATION_HEADERS.some((pattern) => pattern.test(name))) {
          problems.push(`${where}: sends the vendor client header "${name}"`);
        }
      }
      const owner = request.credential ? this.owners.get(request.credential) : undefined;
      if (owner && owner !== request.vendor) {
        problems.push(`${where}: carries a credential issued by ${owner}`);
      }
    }
    return problems;
  }
}
