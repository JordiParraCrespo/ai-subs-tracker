import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { DESKTOP_CHANNELS, type LiveFeedTarget } from '@flama/shared/desktop';
import { syncAccountsSchema } from '@flama/shared/schemas/accounts';
import { LOCAL_PROVIDER_IDS, type LocalProviderId } from '@flama/shared/subscriptions';
import {
  type DetectedLogin,
  getProvider,
  nodeProviderEnv,
  type ProviderEnv,
  parseClaudeStatusline,
  readZaiQuota,
} from '@flama/usage-providers';
import {
  app,
  type BrowserWindow,
  ipcMain,
  autoUpdater as nativeAutoUpdater,
  net,
  safeStorage,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { type LoginHandle, loginShellPath, startLogin, syncAfterLogin } from './add-login';
import { postReading, postSync, type SyncedAccount } from './api-client';
import { Collector, type Timers } from './collector';
import { resolveConfig } from './config';
import { registerIpc } from './ipc';
import { APP_NAME, migratePointers, userDataDir } from './legacy';
import {
  installLiveFeed,
  type LiveFeedServer,
  liveFeedTarget,
  startLiveFeedServer,
  statuslineScript,
  uninstallLiveFeed,
} from './live-feed';
import { buildSyncInput, type LocalAccount, readLocalAccounts, sinceDayFor } from './local-logins';
import { resolveLocale } from './locale';
import { pointerTargets, readPointer, writePointer } from './pointers';
import { runRefresh } from './renew-login';
import {
  installShellIntegration,
  migrateShellIntegration,
  type ShellEnv,
  shellIntegration,
} from './shell-integration';
import { createTokenStore } from './token-store';
import { createTray, type TrayController } from './tray';
import { createUpdatePrefsStore, type UpdateEngine, Updater } from './updater';
import { createReaderKeyStore, UsageReaders } from './usage-readers';
import { checkNewLogin, checkRenewedLogin } from './verify-login';
import { createMainWindow, registerAppScheme, rendererRoot, serveRenderer } from './window';

/**
 * The main process: wires the modules beside this file to Electron. Three
 * modes: the app (window, tray, collector, live feed, updater), `--collect-once`
 * (print the sync payload and exit) and `--smoke` (load the window, print
 * `SMOKE_OK <title>`, exit).
 */

const log = (line: string) => console.error(`[resetowl] ${line}`);
const timers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

app.setName(APP_NAME);
// Windows groups the taskbar button and pins under this id; it must be the
// installer's (`appId` in electron-builder.json) or the pinned shortcut shows
// a second button with Electron's icon.
if (process.platform === 'win32') app.setAppUserModelId('com.resetowl.desktop');
// An install from when the app was called Subtrack keeps its folder: the
// logins it added live there, and moving them would sign them out (legacy.ts).
app.setPath('userData', userDataDir(app.getPath('appData'), existsSync));

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

/**
 * PATH as the login shell sets it, for the vendor CLIs ResetOwl runs (`claude
 * auth status`, `codex app-server`, a sign-in): an app started from the Dock
 * gets a bare PATH. Looked up once; until it is known, no CLI is started.
 */
let cliPath: Promise<string | undefined> | null = null;
let cliEnvNow: Record<string, string | undefined> | null = null;
function cliEnv(): Promise<Record<string, string | undefined>> {
  if (!cliPath) cliPath = loginShellPath(process.env.SHELL, process.env.PATH);
  return cliPath.then((path) => {
    cliEnvNow = { ...process.env, PATH: path };
    return cliEnvNow;
  });
}

/**
 * The machine as the providers see it. Requests go through Electron's own
 * network stack once the app is ready (Chromium's User-Agent and the system
 * proxy, as Orca sends them); vendor CLIs run with the login shell's PATH.
 */
function providerEnv(): ProviderEnv {
  return nodeProviderEnv({
    managedRoot,
    userAgent: config.userAgent,
    ...(app.isReady() ? { fetch: (input, init) => net.fetch(String(input), init) } : {}),
    ...(cliEnvNow ? { cliEnv: cliEnvNow } : {}),
  });
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
    await cliEnv();
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

/**
 * `electron-updater` as `updater.ts` needs it: the release feed is
 * `publish` in electron-builder.json (baked into the package as
 * app-update.yml), requests name ResetOwl, and its log joins ours.
 */
function createUpdateEngine(): UpdateEngine {
  const engine = autoUpdater;
  engine.autoDownload = true;
  engine.allowPrerelease = false;
  engine.requestHeaders = { 'User-Agent': config.userAgent };
  const line = (m: unknown) => log(`updater: ${m instanceof Error ? m.message : String(m)}`);
  engine.logger = { info: line, warn: line, error: line, debug: () => undefined };
  let installOnQuit = engine.autoInstallOnAppQuit;
  return {
    supported: engine.isUpdaterActive(),
    async check() {
      await engine.checkForUpdates();
    },
    install({ relaunch, wired }) {
      // macOS: with the property off, quitAndInstall hands a download that was
      // never given to Squirrel over itself (and waits for it); with it on, it
      // assumes the hand-off happened and would wait forever. Windows and
      // Linux ignore it here. Read synchronously, so it is restored at once.
      if (!wired) engine.autoInstallOnAppQuit = false;
      engine.autoRunAppAfterInstall = relaunch;
      // Silent on Windows (no installer wizard).
      engine.quitAndInstall(true, relaunch);
      engine.autoInstallOnAppQuit = installOnQuit;
    },
    setInstallOnQuit(on) {
      installOnQuit = on;
      engine.autoInstallOnAppQuit = on;
    },
  };
}

async function main(): Promise<void> {
  await app.whenReady();
  const assetsDir = join(__dirname, 'assets');
  const iconPath = join(assetsDir, 'icon.png');
  // Unpackaged, macOS shows Electron's own icon in the dock; packaged, the
  // bundle's .icns is already the owl.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(iconPath);
  if (!config.rendererUrl)
    serveRenderer(rendererRoot(app.isPackaged, process.resourcesPath, __dirname), config.apiUrl);

  let win: BrowserWindow | null = null;
  /** The add-account sign-in in flight, which the screens can type a code into or stop. */
  let login: LoginHandle | null = null;
  /** Bumped by every start and cancel, so a cancel during the PATH lookup still holds. */
  let loginGeneration = 0;
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

  // Take over what an install named Subtrack left, before anything reads it.
  try {
    const moved = await migratePointers(home);
    if (moved.length) log(`copied the active pointers for ${moved.join(', ')} to ~/.resetowl`);
    if (await migrateShellIntegration(shellEnv)) log('updated the shell integration block');
  } catch (err) {
    log(`migration skipped: ${err instanceof Error ? err.message : String(err)}`);
  }

  const tokens = createTokenStore({
    file: join(userData, 'session.bin'),
    encryptor: safeStorage,
    fs: { readFile, writeFile, rm },
    log,
  });

  const readers = new UsageReaders({
    store: createReaderKeyStore({
      file: join(userData, 'usage-readers.json'),
      encryptor: safeStorage,
      fs: { readFile, writeFile, rm },
      log,
    }),
    read: (provider, apiKey) => readZaiQuota(providerEnv(), { provider, apiKey }),
    post: (accountId, input, token) =>
      postReading({
        apiUrl: config.apiUrl,
        token,
        accountId,
        input,
        userAgent: config.userAgent,
        fetch,
      }),
    now: () => new Date(),
    log,
  });

  const readPointers = async () => {
    const out: Partial<Record<LocalProviderId, string>> = {};
    for (const id of LOCAL_PROVIDER_IDS) out[id] = await readPointer(home, id);
    return out;
  };

  /**
   * Lets a provider's own CLI renew a login read as `auth_stale`. ResetOwl
   * never refreshes a token itself; `claude auth status` does, as a side
   * effect, spending no usage. Returns the login read again, or null when the
   * CLI could not run (the stale reading stays, and the collector backs off).
   */
  async function renewLogin(login: DetectedLogin, sinceDay: string): Promise<LocalAccount | null> {
    const provider = getProvider(login.provider);
    const cmd = provider?.refreshCommand?.(login);
    if (!provider || !cmd) return null;
    const env = providerEnv();
    const outcome = await runRefresh(cmd, { env: await cliEnv(), log });
    if (outcome === 'renewed') {
      return { login, account: await provider.read(login, env, { sinceDay, fetchLimits: true }) };
    }
    if (outcome === 'signed_out') {
      // The CLI reports the login gone: keep identity and token counts, but
      // mark it auth_expired so the screens ask the person to sign in again.
      const account = await provider.read(login, env, { sinceDay, fetchLimits: false });
      const run = cmd.env.CLAUDE_CONFIG_DIR
        ? `CLAUDE_CONFIG_DIR=${cmd.env.CLAUDE_CONFIG_DIR} ${cmd.command}`
        : cmd.command;
      return {
        login,
        account: {
          ...account,
          snapshot: {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status: 'auth_expired',
            message: `The ${provider.displayName} login was signed out. Run \`${run}\` to sign in again.`,
            windows: [],
            extraUsage: null,
          },
        },
      };
    }
    return null;
  }

  const collector = new Collector({
    read: (opts) => readLocalAccounts(providerEnv(), opts),
    renew: renewLogin,
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
    readers,
    device: { name: hostname(), platform: process.platform },
    now: () => new Date(),
    timers,
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

  const sendUpdateState = (state: ReturnType<Updater['current']>) => {
    if (win && !win.isDestroyed()) win.webContents.send(DESKTOP_CHANNELS.updatesChanged, state);
    tray?.setUpdate(state.phase === 'ready' ? state.version : null);
  };
  // No updater in the smoke run: it would reach the release feed.
  const updater = new Updater({
    engine:
      config.mode === 'app'
        ? createUpdateEngine()
        : {
            supported: false,
            check: async () => undefined,
            install: () => undefined,
            setInstallOnQuit: () => undefined,
          },
    prefs: createUpdatePrefsStore({
      file: join(userData, 'updates.json'),
      fs: { readFile, writeFile },
    }),
    currentVersion: app.getVersion(),
    timers,
    now: () => new Date(),
    onState: sendUpdateState,
    log,
  });
  if (config.mode === 'app') {
    autoUpdater.on('checking-for-update', () => updater.handle({ type: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      updater.handle({ type: 'available', version: info.version }),
    );
    autoUpdater.on('update-not-available', () => updater.handle({ type: 'not-available' }));
    autoUpdater.on('download-progress', (progress) =>
      updater.handle({ type: 'progress', percent: progress.percent }),
    );
    autoUpdater.on('update-downloaded', (info) =>
      updater.handle({ type: 'downloaded', version: info.version }),
    );
    autoUpdater.on('error', (err) =>
      updater.handle({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
    );
  }

  /**
   * Restarts into the downloaded version. Nothing is stopped here: the
   * install quits the app only once it has worked (electron-updater emits
   * `before-quit-for-update`, then quits), and `before-quit` stops the rest.
   * A failed install leaves everything running and reports an error.
   */
  let quittingForUpdate = false;
  if (config.mode === 'app') {
    nativeAutoUpdater.on('before-quit-for-update', () => {
      quittingForUpdate = true;
      // Past the window's hide-on-close, which would otherwise hold the quit.
      quitting = true;
    });
  }
  const installUpdate = () => {
    updater.install(true);
  };

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
      throw new Error('That folder is not a Claude Code login ResetOwl found.');
    }
    return target;
  };

  const showWindow = () => {
    if (!win || win.isDestroyed()) win = openWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  // The system's languages, best first. Linux builds of Electron may list
  // none; the locale Chromium chose (from LANG) stands in for them there.
  const preferred = app.getPreferredSystemLanguages();
  const systemLocales = preferred.length > 0 ? preferred : [app.getLocale()];
  let shownLocale = resolveLocale(systemLocales);

  const openWindow = () => {
    const created = createMainWindow(
      config,
      join(__dirname, 'preload.js'),
      iconPath,
      systemLocales,
    );
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
      async addLogin(provider, options) {
        const impl = getProvider(provider);
        if (!impl) return { ok: false, message: 'Unknown provider.' };
        // Signing a found account in again: its folder must be one the
        // collector read, never a path the renderer named.
        const renewing = options.externalId
          ? collector
              .localAccounts()
              .find(
                (l) =>
                  l.account.provider === provider && l.account.externalId === options.externalId,
              )
          : undefined;
        if (options.externalId && !renewing) {
          return { ok: false, message: 'That account is not signed in on this computer.' };
        }
        // One login at a time: a second "Add" stops the first, whose folder
        // is then removed like any sign-in that did not finish.
        login?.cancel();
        const generation = ++loginGeneration;
        const env = await cliEnv();
        // Back, a close or another pick while the shell answered: never start.
        if (generation !== loginGeneration) return { ok: false, message: 'Sign-in cancelled.' };
        const handle = startLogin({
          managedRoot,
          provider,
          home: renewing?.login.home,
          command: (dir) => {
            const cmd = impl.loginCommand(dir, { deviceCode: options.deviceCode === true });
            // Claude Code's default login is always `~/.claude`, selected with
            // no CLAUDE_CONFIG_DIR (setting it would change the macOS Keychain
            // item). Codex's and Grok's default may be an inherited
            // CODEX_HOME / GROK_HOME, which cleanCliEnv strips, so they keep
            // the explicit home the login was found in.
            return renewing && provider === 'claude-code'
              ? { ...cmd, env: impl.launchEnv(renewing.login) }
              : cmd;
          },
          check: (dir) =>
            renewing
              ? checkRenewedLogin(
                  impl,
                  renewing.login,
                  renewing.account.externalId,
                  collector.localAccounts(),
                  providerEnv(),
                )
              : checkNewLogin(impl, dir, collector.localAccounts(), providerEnv()),
          onProgress: (progress) => {
            if (win && !win.isDestroyed())
              win.webContents.send(DESKTOP_CHANNELS.accountsLoginProgress, progress);
          },
          env,
          log,
        });
        login = handle;
        const result = await handle.result;
        if (login === handle) login = null;
        return syncAfterLogin(result, { sync: () => collector.runNow(), timers, log });
      },
      submitLoginCode: (code) => login?.submitCode(code),
      cancelLogin: () => {
        loginGeneration++;
        login?.cancel();
      },
      async activate(provider, externalId) {
        const item = collector
          .localAccounts()
          .find((l) => l.account.provider === provider && l.account.externalId === externalId);
        if (!item) return; // not on this machine
        await writePointer(home, item.login);
        await collector.pointersChanged();
      },
      async usageReaderConnect(accountId, provider, apiKey) {
        const result = await readers.connect(accountId, provider, apiKey, await tokens.get());
        collector.readersChanged();
        return result;
      },
      async usageReaderDisconnect(accountId) {
        await readers.disconnect(accountId);
        collector.readersChanged();
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
      setLocale(locale) {
        if (config.mode === 'smoke') log(`screens show: ${locale}`);
        if (locale === shownLocale) return;
        shownLocale = locale;
        tray?.setLocale(locale);
      },
      updatesState: () => updater.current(),
      updatesCheck: () => updater.check(),
      updatesInstall: installUpdate,
      updatesSetInstallOnQuit: (on) => updater.setInstallOnQuit(on),
      updatesDismiss: () => updater.dismiss(),
    },
    {
      rendererOrigin: config.rendererOrigin,
      isAppWebContents: (id) => !!win && !win.isDestroyed() && win.webContents.id === id,
    },
  );

  if (config.mode === 'smoke') {
    // The app's window, so its IPC is answered as it is in the app.
    win = openWindow();
    runSmoke(win);
    return;
  }

  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('before-quit', (event) => {
    if (!quittingForUpdate && updater.needsInstallOnQuit()) {
      // Install on quit, turned on after the download finished: install it
      // ourselves (without starting it again), then quit. If the install
      // fails, quit anyway after a moment rather than stay open.
      event.preventDefault();
      quittingForUpdate = true;
      quitting = true;
      updater.install(false);
      setTimeout(() => app.quit(), 10_000).unref();
      return;
    }
    quitting = true;
    collector.stop();
    updater.stop();
    // The CLI runs in a process group of its own, which a quit would not end.
    login?.cancel();
    void liveServer?.close();
  });
  app.on('window-all-closed', () => {
    if (!tray) app.quit();
  });

  try {
    tray = createTray({
      assetsDir,
      locale: shownLocale,
      onRefresh: () => void collector.refresh(),
      onOpen: showWindow,
      onInstallUpdate: installUpdate,
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

  // The first read waits for the login shell's PATH, so `codex app-server`
  // can run from it; the lookup gives up after five seconds.
  void cliEnv().then(() => collector.start());
  void updater.start();
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
      .executeJavaScript('typeof window.resetowl === "object" ? window.resetowl.apiUrl : "missing"')
      .catch(() => 'error');
    process.stdout.write(`SMOKE_OK ${win.webContents.getTitle()} (bridge: ${bridge})\n`);
    app.exit(0);
  });
}
