import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FakeVendors } from '@flama/usage-providers/testing';
import type { ElectronApplication } from '@playwright/test';

/**
 * The fake vendors (`@flama/usage-providers/testing`) behind a socket, for
 * the desktop app: a process the suite cannot hand a `fetch`. `route` stands
 * between the app's main process and the network, from outside: the app under
 * test is the build that ships, with no switch in it for a test to flip.
 *
 * A request to this machine (the API under test) goes through; every other
 * request comes here with the URL the app asked for. So `vendors.requests`
 * and `vendors.audit()` read exactly as they do in a unit test, and a request
 * to any host that is no vendor is in the same record, refused: a run can
 * show that nothing left the machine.
 */

/** Headers the hop from the app to this server adds; the vendor never saw them. */
const HOP_HEADERS = new Set(['host', 'connection', 'accept-encoding']);

export interface FakeVendorServer {
  vendors: FakeVendors;
  /**
   * Routes the app's outbound requests here. Call it before signing in: the
   * collector asks no vendor until the app holds a session.
   */
  route(app: ElectronApplication): Promise<void>;
  close(): Promise<void>;
}

export async function startFakeVendors(): Promise<FakeVendorServer> {
  const vendors = new FakeVendors();
  const server: Server = createServer((req, res) => {
    const target = new URL(req.url ?? '/', 'http://fake').searchParams.get('url') ?? '';
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (!HOP_HEADERS.has(name) && typeof value === 'string') headers[name] = value;
    }
    vendors
      .handle({ url: target, method: req.method, headers })
      .then(async (answer) => {
        if (answer.delayMs > 0) await new Promise((done) => setTimeout(done, answer.delayMs));
        res.writeHead(answer.status, answer.headers);
        res.end([204, 205, 304].includes(answer.status) ? undefined : answer.body);
      })
      // A failed connection, a timeout, or a host that is no vendor: hang up.
      .catch(() => req.socket.destroy());
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    vendors,
    route: (app) =>
      app.evaluate((_electron, fake) => {
        const real = globalThis.fetch.bind(globalThis);
        const local = new Set(['localhost', '127.0.0.1', '[::1]']);
        globalThis.fetch = async (input, init) => {
          const url = new URL(
            typeof input === 'string' || input instanceof URL ? input : input.url,
          );
          if (local.has(url.hostname)) return real(input, init);
          // The fake answers a failed connection by hanging up, which `fetch`
          // reports as the TypeError a real one would.
          return real(`${fake}/vendor?url=${encodeURIComponent(url.href)}`, {
            method: init?.method,
            headers: init?.headers,
            signal: init?.signal,
            redirect: init?.redirect,
          });
        };
      }, base),
    close: () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
