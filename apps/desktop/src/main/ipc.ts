import {
  type AddLoginResult,
  type CollectorStatus,
  DESKTOP_CHANNELS,
  type LiveFeedTarget,
  type ShellIntegration,
} from '@flama/shared/desktop';
import type { ProviderId } from '@flama/shared/subscriptions';
import type { IpcMainInvokeEvent } from 'electron';
import {
  isTrustedSender,
  MAX_ID_LENGTH,
  parseBoundedString,
  parseExternalUrl,
  parseHome,
  parseProvider,
  parseToken,
} from './ipc-validation';

/**
 * One `ipcMain.handle` per invoke channel of `DESKTOP_CHANNELS`, each parsing
 * its arguments before anything runs and refusing a sender that is not the
 * app's own renderer. `collectorChanged` is main → renderer only.
 */

export interface DesktopServices {
  getToken(): Promise<string | null>;
  setToken(token: string | null): Promise<void>;
  collectorStatus(): CollectorStatus;
  collectorRefresh(): Promise<CollectorStatus>;
  addLogin(provider: ProviderId): Promise<AddLoginResult>;
  activate(provider: ProviderId, externalId: string): Promise<void>;
  shellIntegration(): Promise<ShellIntegration>;
  shellInstall(): Promise<ShellIntegration>;
  liveFeedTargets(): Promise<LiveFeedTarget[]>;
  liveFeedInstall(home: string): Promise<LiveFeedTarget[]>;
  liveFeedUninstall(home: string): Promise<LiveFeedTarget[]>;
  openExternal(url: string): Promise<void>;
}

type Handler = (...args: unknown[]) => unknown;

/** The handlers, keyed by channel, with argument parsing applied. Pure: no Electron. */
export function ipcHandlers(services: DesktopServices): Record<string, Handler> {
  return {
    [DESKTOP_CHANNELS.authGetToken]: () => services.getToken(),
    [DESKTOP_CHANNELS.authSetToken]: (token) => services.setToken(parseToken(token)),
    [DESKTOP_CHANNELS.collectorStatus]: () => services.collectorStatus(),
    [DESKTOP_CHANNELS.collectorRefresh]: () => services.collectorRefresh(),
    [DESKTOP_CHANNELS.accountsAddLogin]: (provider) => services.addLogin(parseProvider(provider)),
    [DESKTOP_CHANNELS.accountsActivate]: (provider, externalId) =>
      services.activate(
        parseProvider(provider),
        parseBoundedString(externalId, MAX_ID_LENGTH, 'account id'),
      ),
    [DESKTOP_CHANNELS.shellIntegration]: () => services.shellIntegration(),
    [DESKTOP_CHANNELS.shellInstall]: () => services.shellInstall(),
    [DESKTOP_CHANNELS.liveFeedTargets]: () => services.liveFeedTargets(),
    [DESKTOP_CHANNELS.liveFeedInstall]: (home) => services.liveFeedInstall(parseHome(home)),
    [DESKTOP_CHANNELS.liveFeedUninstall]: (home) => services.liveFeedUninstall(parseHome(home)),
    [DESKTOP_CHANNELS.openExternal]: (url) => services.openExternal(parseExternalUrl(url)),
  };
}

export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ): void;
}

export function registerIpc(
  ipcMain: IpcMainLike,
  services: DesktopServices,
  opts: { rendererOrigin: string; isAppWebContents(id: number): boolean },
): void {
  for (const [channel, handler] of Object.entries(ipcHandlers(services))) {
    ipcMain.handle(channel, (event, ...args) => {
      if (
        !opts.isAppWebContents(event.sender.id) ||
        !isTrustedSender(event.senderFrame?.url, opts.rendererOrigin)
      ) {
        throw new Error('Refused: not the Subtrack renderer.');
      }
      return handler(...args);
    });
  }
}
