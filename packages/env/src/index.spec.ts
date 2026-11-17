import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findWorkspaceRoot, loadEnv, resolveFileVariables } from './index';

let root: string;
let touchedKeys: string[];

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flama-env-'));
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
  return dir;
}

beforeEach(() => {
  root = makeWorkspace();
  touchedKeys = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  for (const key of touchedKeys) {
    delete process.env[key];
  }
});

function write(filename: string, content: string, keys: string[]): void {
  fs.writeFileSync(path.join(root, filename), content);
  touchedKeys.push(...keys);
}

describe('findWorkspaceRoot', () => {
  it('finds a pnpm workspace root from a nested directory', () => {
    expect(findWorkspaceRoot(path.join(root, 'packages', 'nested'))).toBe(root);
  });

  it('finds a package.json with a workspaces field', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flama-env-npm-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );
      fs.mkdirSync(path.join(dir, 'deep'));
      expect(findWorkspaceRoot(path.join(dir, 'deep'))).toBe(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores a package.json without workspaces and keeps walking', () => {
    fs.writeFileSync(
      path.join(root, 'packages', 'nested', 'package.json'),
      JSON.stringify({ name: 'nested' }),
    );
    expect(findWorkspaceRoot(path.join(root, 'packages', 'nested'))).toBe(root);
  });

  it('returns null when no workspace root exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flama-env-none-'));
    try {
      expect(findWorkspaceRoot(dir)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadEnv', () => {
  it('loads .env from the workspace root, from any nested cwd', () => {
    write('.env', 'FLAMA_ENV_TEST_A=from-dotenv\n', ['FLAMA_ENV_TEST_A']);
    const result = loadEnv({ cwd: path.join(root, 'packages', 'nested') });
    expect(result.root).toBe(root);
    expect(result.applied).toContain('FLAMA_ENV_TEST_A');
    expect(process.env.FLAMA_ENV_TEST_A).toBe('from-dotenv');
  });

  it('lets .env.local override .env', () => {
    write('.env', 'FLAMA_ENV_TEST_B=base\n', ['FLAMA_ENV_TEST_B']);
    write('.env.local', 'FLAMA_ENV_TEST_B=local\n', []);
    loadEnv({ cwd: root });
    expect(process.env.FLAMA_ENV_TEST_B).toBe('local');
  });

  it('never overwrites a value already in process.env', () => {
    process.env.FLAMA_ENV_TEST_C = 'real-env';
    touchedKeys.push('FLAMA_ENV_TEST_C');
    write('.env', 'FLAMA_ENV_TEST_C=from-file\n', []);
    const result = loadEnv({ cwd: root });
    expect(process.env.FLAMA_ENV_TEST_C).toBe('real-env');
    expect(result.applied).not.toContain('FLAMA_ENV_TEST_C');
  });

  it('is a no-op outside any workspace', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flama-env-outside-'));
    try {
      expect(loadEnv({ cwd: dir })).toEqual({
        root: null,
        loaded: [],
        applied: [],
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tolerates missing files and reports what it read', () => {
    write('.env.local', 'FLAMA_ENV_TEST_D=only-local\n', ['FLAMA_ENV_TEST_D']);
    const result = loadEnv({ cwd: root });
    expect(result.loaded).toEqual([path.join(root, '.env.local')]);
    expect(process.env.FLAMA_ENV_TEST_D).toBe('only-local');
  });
});

describe('resolveFileVariables', () => {
  function secret(content: string): string {
    const file = path.join(root, 'secret');
    fs.writeFileSync(file, content);
    return file;
  }

  it('sets NAME from the file NAME_FILE names, trailing newline trimmed', () => {
    const env: NodeJS.ProcessEnv = { FLAMA_SECRET_FILE: secret('s3cret\n') };
    expect(resolveFileVariables(env)).toEqual(['FLAMA_SECRET']);
    expect(env.FLAMA_SECRET).toBe('s3cret');
  });

  it('leaves a NAME that is already set alone', () => {
    const env: NodeJS.ProcessEnv = { FLAMA_SECRET: 'real', FLAMA_SECRET_FILE: secret('file') };
    expect(resolveFileVariables(env)).toEqual([]);
    expect(env.FLAMA_SECRET).toBe('real');
  });

  it('throws when the file cannot be read, so a missing secret stops the process', () => {
    const env: NodeJS.ProcessEnv = { FLAMA_SECRET_FILE: path.join(root, 'missing') };
    expect(() => resolveFileVariables(env)).toThrow();
  });

  it('runs as part of loadEnv, for a _FILE set in .env', () => {
    write('.env', `FLAMA_ENV_TEST_F_FILE=${secret('from-file')}\n`, [
      'FLAMA_ENV_TEST_F_FILE',
      'FLAMA_ENV_TEST_F',
    ]);
    loadEnv({ cwd: root });
    expect(process.env.FLAMA_ENV_TEST_F).toBe('from-file');
  });
});
