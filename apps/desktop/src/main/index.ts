import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { DESKTOP_CHANNELS, type LiveFeedTarget } from '@flama/shared/desktop';
import { syncAccountsSchema } from '@flama/shared/schemas/accounts';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import {
  getProvider,
  nodeProviderEnv,
  type ProviderEnv,
  parseClaudeStatusline,
} from '@flama/usage-providers';
import { app, type BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { addLogin, loginShellPath } from './add-login';
import { postSync, type SyncedAccount } from './api-client';
import { Collector } from './collector';
import { resolveConfig } from './config';
import { registerIpc } from './ipc';
import { parseExternalUrl } from './ipc-validation';
import {
  installLiveFeed,
  type LiveFeedServer,
  liveFeedTarget,
  startLiveFeedServer,
  statuslineScript,
  uninstallLiveFeed,
} from './live-feed';
import { buildSyncInput, readLocalAccounts, sinceDayFor } from './local-logins';
import { pointerTargets, readPointer, writePointer } from './pointers';
import { installShellIntegration, type ShellEnv, shellIntegration } from './shell-integration';
import { createTokenStore } from './token-store';
import { createTray, type TrayController } from './tray';
import { createMainWindow, registerAppScheme, rendererRoot, serveRenderer } from './window';

/**
 * The main process: wires the modules beside this file to Electron. Three
 * modes: the app (window, tray, collector, live feed), `--collect-once`
 * (print the sync payload and exit) and `--smoke` (load the window, print
 * `SMOKE_OK <title>`, exit).
 */

const log = (line: string) => console.error(`[subtrack] ${line}`);

app.setName('Subtrack');
app.setPath('userData', join(app.getPath('appData'), 'Subtrack'));

const config = resolveConfig({
  env: process.env,
  argv: process.argv,
  isPackaged: app.isPackaged,
  version: app.getVersion(),
  platform: process.platform,
});
const userData = app.getPath('userData');
const managedRoot = join(userData, 'accounts');
const home = homedir();

function providerEnv(): ProviderEnv {
  return nodeProviderEnv({ managedRoot, userAgent: config.userAgent });
}

if (config.mode === 'collect-once') {
  // No window. On Linux without a display, pass `--ozone-platform=headless`
  // on the command line (too late to set from here).
  void collectOnce();
} else {
  registerAppScheme();
  if (config.mode === 'smoke' || app.requestSingleInstanceLock()) {
    void main();
  } else {
    app.quit();
  }
}

/** Prints what a sync would send (identity, limits, token counts — never a credential). */
async function collectOnce(): Promise<void> {
  try {
    const accounts = await readLocalAccounts(providerEnv(), {
      sinceDay: sinceDayFor(new Date()),
      fetchLimitsFor: () => true,
    });
    const input = syncAccountsSchema.parse(
      buildSyncInput(accounts, { name: hostname(), platform: process.platform }),
    );
    process.stdout.write(`${JSON.stringify(input, null, 2)}\n`);
    app.exit(0);
  } catch (err) {
    log(`collect-once failed: ${err instanceof Error ? err.message : String(err)}`);
    app.exit(1);
  }
}

async function main(): Promise<void> {
  await app.whenReady();
  if (!config.rendererUrl)
    serveRenderer(rendererRoot(app.isPackaged, process.resourcesPath, __dirname), config.apiUrl);

  let win: BrowserWindow | null = null;
  let tray: TrayController | null = null;
  let quitting = false;
  let lastSynced: SyncedAccount[] | null = null;
  let liveServer: LiveFeedServer | null = null;
  const scriptPath = join(userData, 'statusline.sh');
  const shellEnv: ShellEnv = {
    home,
    platform: process.platform,
    shell: process.env.SHELL,
    zdotdir: process.env.ZDOTDIR,
  };

  const tokens = createTokenStore({
    file: join(userData, 'session.bin'),
    encryptor: safeStorage,
    fs: { readFile, writeFile, rm },
    log,
  });

  const readPointers = async () => {
    const out: Partial<Record<ProviderId, string>> = {};
    for (const id of PROVIDER_IDS) out[id] = await readPointer(home, id);
    return out;
  };

  const collector = new Collector({
    read: (opts) => readLocalAccounts(providerEnv(), opts),
    readPointers,
    async applyActive(server, local) {
      const targets = pointerTargets(
        server,
        local.map((l) => ({ ...l.login, externalId: l.account.externalId })),
      );
      for (const login of targets) await writePointer(home, login);
    },
    sync: (input, token) =>
      postSync({ apiUrl: config.apiUrl, token, input, userAgent: config.userAgent, fetch }),
    tokens,
    device: { name: hostname(), platform: process.platform },
    now: () => new Date(),
    timers: {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
    },
    onStatus(status) {
      if (win && !win.isDestroyed())
        win.webContents.send(DESKTOP_CHANNELS.collectorChanged, status);
    },
    onSynced(accounts, partial) {
      if (partial && lastSynced) {
        const byId = new Map(lastSynced.map((a) => [a.id, a]));
        for (const a of accounts) byId.set(a.id, a);
        lastSynced = [...byId.values()];
      } else {
        lastSynced = [...accounts];
      }
      tray?.update(lastSynced);
    },
    log,
  });

  const claudeHomes = () =>
    collector
      .status()
      .logins.filter((l) => l.provider === 'claude-code')
      .map((l) => l.home);

  const liveTargets = (): Promise<LiveFeedTarget[]> =>
    Promise.all(claudeHomes().map((h) => liveFeedTarget(h, scriptPath)));

  const knownClaudeHome = (candidate: string) => {
    const target = resolve(candidate);
    if (!claudeHomes().some((h) => resolve(h) === target)) {
      throw new Error('That folder is not a Claude Code login Subtrack found.');
    }
    return target;
  };

  const showWindow = () => {
    if (!win || win.isDestroyed()) win = openWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  const openWindow = () => {
    const created = createMainWindow(config, join(__dirname, 'preload.js'));
    created.on('close', (event) => {
      if (!quitting && tray && config.mode === 'app') {
        event.preventDefault();
        created.hide();
      }
    });
    return created;
  };

  registerIpc(
    ipcMain,
    {
      getToken: () => tokens.get(),
      async setToken(token) {
        const previous = await tokens.get();
        await tokens.set(token);
        if (token !== previous) await collector.tokenChanged(token);
      },
      collectorStatus: () => collector.status(),
      collectorRefresh: () => collector.refresh(),
      async addLogin(provider) {
        const impl = getProvider(provider);
        if (!impl) return { ok: false, message: 'Unknown provider.' };
        const path = await loginShellPath(process.env.SHELL, process.env.PATH);
        const result = await addLogin({
          managedRoot,
          provider,
          command: (dir) => impl.loginCommand(dir),
          openUrl: (url) => {
            try {
              void shell.openExternal(parseExternalUrl(url));
            } catch {
              // not a URL we open
            }
          },
          env: { ...process.env, PATH: path },
          log,
        });
        if (result.ok) void collector.runNow();
        return result;
      },
      async activate(provider, externalId) {
        const item = collector
          .localAccounts()
          .find((l) => l.account.provider === provider && l.account.externalId === externalId);
        if (!item) return; // not on this machine
        await writePointer(home, item.login);
        await collector.pointersChanged();
      },
      shellIntegration: () => shellIntegration(shellEnv),
      shellInstall: () => installShellIntegration(shellEnv),
      liveFeedTargets: liveTargets,
      async liveFeedInstall(dir) {
        await installLiveFeed(knownClaudeHome(dir), scriptPath);
        return liveTargets();
      },
      async liveFeedUninstall(dir) {
        await uninstallLiveFeed(knownClaudeHome(dir), scriptPath);
        return liveTargets();
      },
      openExternal: (url) => shell.openExternal(url),
    },
    {
      rendererOrigin: config.rendererOrigin,
      isAppWebContents: (id) => !!win && !win.isDestroyed() && win.webContents.id === id,
    },
  );

  if (config.mode === 'smoke') {
    runSmoke(openWindow());
    return;
  }

  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('before-quit', () => {
    quitting = true;
    collector.stop();
    void liveServer?.close();
  });
  app.on('window-all-closed', () => {
    if (!tray) app.quit();
  });

  try {
    tray = createTray({
      assetsDir: join(__dirname, 'assets'),
      onRefresh: () => void collector.refresh(),
      onOpen: showWindow,
      onQuit: () => app.quit(),
    });
  } catch (err) {
    log(`no tray on this system: ${String(err)}`);
  }

  win = openWindow();

  try {
    liveServer = await startLiveFeedServer((configDir, body) => {
      const windows = parseClaudeStatusline(body);
      if (windows) void collector.sendLive(configDir, windows);
    });
    await mkdir(userData, { recursive: true });
    await writeFile(scriptPath, statuslineScript(liveServer.port, liveServer.secret), {
      mode: 0o700,
    });
    await chmod(scriptPath, 0o700);
  } catch (err) {
    log(`live feed unavailable: ${String(err)}`);
  }

  void collector.start();
}

function runSmoke(win: BrowserWindow): void {
  const fail = (why: string) => {
    log(`smoke failed: ${why}`);
    app.exit(1);
  };
  const timer = setTimeout(() => fail('timed out after 30s'), 30_000);
  win.webContents.once('did-fail-load', (_event, code, description) => {
    clearTimeout(timer);
    fail(`${code} ${description}`);
  });
  win.webContents.once('did-finish-load', async () => {
    clearTimeout(timer);
    const bridge = await win.webContents
      .executeJavaScript('typeof window.subtrack === "object" ? window.subtrack.apiUrl : "missing"')
      .catch(() => 'error');
    process.stdout.write(`SMOKE_OK ${win.webContents.getTitle()} (bridge: ${bridge})\n`);
    app.exit(0);
  });
}
