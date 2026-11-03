/**
 * The API session token — ResetOwl's own, never a provider credential —
 * encrypted at rest with the OS keystore (Electron's `safeStorage`) in
 * `userData/session.bin`. Without a keystore it stays in memory and the
 * person signs in again next launch. The token is never logged.
 */

export interface Encryptor {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface TokenFs {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer, opts: { mode: number }): Promise<void>;
  rm(path: string, opts: { force: boolean }): Promise<void>;
}

export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}

export function createTokenStore(deps: {
  file: string;
  encryptor: Encryptor;
  fs: TokenFs;
  log: (line: string) => void;
}): TokenStore {
  const { file, encryptor, fs, log } = deps;
  let loaded = false;
  let token: string | null = null;
  let warned = false;

  const available = () => {
    const ok = encryptor.isEncryptionAvailable();
    if (!ok && !warned) {
      warned = true;
      log('safeStorage is not available: the session is kept in memory only.');
    }
    return ok;
  };

  return {
    async get() {
      if (loaded) return token;
      loaded = true;
      if (!available()) return token;
      try {
        const value = encryptor.decryptString(await fs.readFile(file));
        token = value.length > 0 ? value : null;
      } catch {
        token = null;
      }
      return token;
    },
    async set(next) {
      loaded = true;
      token = next && next.length > 0 ? next : null;
      if (token === null) {
        await fs.rm(file, { force: true }).catch(() => undefined);
        return;
      }
      if (!available()) return;
      await fs.writeFile(file, encryptor.encryptString(token), { mode: 0o600 });
    },
  };
}
