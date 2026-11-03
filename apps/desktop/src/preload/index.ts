import {
  type CollectorStatus,
  DESKTOP_CHANNELS,
  type DesktopBridge,
  type LoginProgress,
} from '@flama/shared/desktop';
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';

/**
 * Exposes `window.resetowl` (the `DesktopBridge`) to the screens. Sandboxed:
 * no Node, no fs — every call is an `ipcRenderer.invoke` the main process
 * validates. The static fields arrive as `--resetowl-bridge=<base64 JSON>`
 * in `process.argv` (`webPreferences.additionalArguments`).
 */

interface StaticInfo {
  version: string;
  platform: string;
  apiUrl: string;
}

function readStaticInfo(): StaticInfo {
  const arg = process.argv.find((a) => a.startsWith('--resetowl-bridge='));
  const fallback: StaticInfo = { version: '0.0.0', platform: process.platform, apiUrl: '' };
  if (!arg) return fallback;
  try {
    const parsed = JSON.parse(atob(arg.slice('--resetowl-bridge='.length))) as Partial<StaticInfo>;
    return {
      version: String(parsed.version ?? fallback.version),
      platform: String(parsed.platform ?? fallback.platform),
      apiUrl: String(parsed.apiUrl ?? ''),
    };
  } catch {
    return fallback;
  }
}

const info = readStaticInfo();
const invoke = <T>(channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const bridge: DesktopBridge = {
  version: info.version,
  platform: info.platform,
  apiUrl: info.apiUrl,
  auth: {
    getToken: () => invoke(DESKTOP_CHANNELS.authGetToken),
    setToken: (token) => invoke(DESKTOP_CHANNELS.authSetToken, token),
  },
  collector: {
    status: () => invoke(DESKTOP_CHANNELS.collectorStatus),
    refresh: () => invoke(DESKTOP_CHANNELS.collectorRefresh),
    onStatus(listener) {
      const handler = (_event: IpcRendererEvent, status: CollectorStatus) => listener(status);
      ipcRenderer.on(DESKTOP_CHANNELS.collectorChanged, handler);
      return () => {
        ipcRenderer.removeListener(DESKTOP_CHANNELS.collectorChanged, handler);
      };
    },
  },
  accounts: {
    addLogin: (provider) => invoke(DESKTOP_CHANNELS.accountsAddLogin, provider),
    onLoginProgress(listener) {
      const handler = (_event: IpcRendererEvent, progress: LoginProgress) => listener(progress);
      ipcRenderer.on(DESKTOP_CHANNELS.accountsLoginProgress, handler);
      return () => ipcRenderer.removeListener(DESKTOP_CHANNELS.accountsLoginProgress, handler);
    },
    submitLoginCode: (code) => invoke(DESKTOP_CHANNELS.accountsLoginCode, code),
    cancelLogin: () => invoke(DESKTOP_CHANNELS.accountsLoginCancel),
    activate: (provider, externalId) =>
      invoke(DESKTOP_CHANNELS.accountsActivate, provider, externalId),
  },
  shell: {
    integration: () => invoke(DESKTOP_CHANNELS.shellIntegration),
    install: () => invoke(DESKTOP_CHANNELS.shellInstall),
  },
  liveFeed: {
    targets: () => invoke(DESKTOP_CHANNELS.liveFeedTargets),
    install: (home) => invoke(DESKTOP_CHANNELS.liveFeedInstall, home),
    uninstall: (home) => invoke(DESKTOP_CHANNELS.liveFeedUninstall, home),
  },
  openExternal: (url) => invoke(DESKTOP_CHANNELS.openExternal, url),
};

contextBridge.exposeInMainWorld('resetowl', Object.freeze(bridge));
