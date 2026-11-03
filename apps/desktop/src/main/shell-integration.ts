import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ShellIntegration } from '@flama/shared/desktop';
import { LEGACY_BEGIN_MARKER, LEGACY_END_MARKER } from './legacy';
import { pointerPath } from './pointers';

/**
 * Makes `claude` and `codex` in a terminal follow the account marked active
 * in ResetOwl: two shell functions that read the pointer file and, when it
 * names a home, run the CLI with `CLAUDE_CONFIG_DIR` / `CODEX_HOME` set for
 * that one command. An empty pointer runs the plain CLI (the default login).
 *
 * Written to an rc file only when the person asks (`install`), inside
 * markers so a second install replaces the block and removing it is one
 * delete.
 */

export const BEGIN_MARKER = '# >>> resetowl >>>';
export const END_MARKER = '# <<< resetowl <<<';

/** Single-quotes a path for sh. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The bash/zsh block, markers included. `function name {` dodges an alias of the same name. */
export function posixSnippet(home: string): string {
  const claude = shQuote(pointerPath(home, 'claude-code'));
  const codex = shQuote(pointerPath(home, 'codex'));
  return [
    BEGIN_MARKER,
    '# Added by ResetOwl: `claude` and `codex` use the account marked active in the app.',
    '# Remove this block to undo it.',
    'function claude {',
    `  local _resetowl_home; _resetowl_home="$(cat ${claude} 2>/dev/null)"`,
    '  if [ -n "$_resetowl_home" ]; then',
    '    CLAUDE_CONFIG_DIR="$_resetowl_home" command claude "$@"',
    '  else',
    '    command claude "$@"',
    '  fi',
    '}',
    'function codex {',
    `  local _resetowl_home; _resetowl_home="$(cat ${codex} 2>/dev/null)"`,
    '  if [ -n "$_resetowl_home" ]; then',
    '    CODEX_HOME="$_resetowl_home" command codex "$@"',
    '  else',
    '    command codex "$@"',
    '  fi',
    '}',
    END_MARKER,
  ].join('\n');
}

/** The PowerShell equivalent, for a profile the person edits themselves. */
export function powershellSnippet(home: string): string {
  const fn = (name: string, file: string, variable: string) =>
    [
      `function ${name} {`,
      `  $exe = Get-Command ${name} -CommandType Application | Select-Object -First 1`,
      `  $h = (Get-Content -Raw -ErrorAction SilentlyContinue ${psQuote(file)})`,
      '  if ($h -and $h.Trim()) {',
      `    $prev = $env:${variable}; $env:${variable} = $h.Trim()`,
      `    try { & $exe @args } finally { $env:${variable} = $prev }`,
      '  } else { & $exe @args }',
      '}',
    ].join('\n');
  return [
    BEGIN_MARKER,
    '# Added by ResetOwl: `claude` and `codex` use the account marked active in the app.',
    fn('claude', pointerPath(home, 'claude-code'), 'CLAUDE_CONFIG_DIR'),
    fn('codex', pointerPath(home, 'codex'), 'CODEX_HOME'),
    END_MARKER,
  ].join('\n');
}

/** The rc file for the login shell, or null when it is not bash or zsh (or on Windows). */
export function rcFileFor(
  home: string,
  shell: string | undefined,
  platform: NodeJS.Platform,
  zdotdir?: string,
): string | null {
  if (platform === 'win32' || !shell) return null;
  const name = basename(shell);
  if (name === 'zsh') return join(zdotdir || home, '.zshrc');
  if (name === 'bash') return join(home, '.bashrc');
  return null;
}

/** Where our block sits: the current markers, or the ones a Subtrack install wrote. */
function findBlock(content: string): { start: number; end: number } | null {
  for (const [begin, end] of [
    [BEGIN_MARKER, END_MARKER],
    [LEGACY_BEGIN_MARKER, LEGACY_END_MARKER],
  ] as const) {
    const start = content.indexOf(begin);
    const stop = start === -1 ? -1 : content.indexOf(end, start);
    if (start !== -1 && stop !== -1) return { start, end: stop + end.length };
  }
  return null;
}

/**
 * `content` with the ResetOwl block replaced by `snippet` (a block an install
 * named Subtrack wrote counts as ours), or appended when absent.
 */
export function upsertBlock(content: string, snippet: string): string {
  const block = findBlock(content);
  if (block) return content.slice(0, block.start) + snippet + content.slice(block.end);
  if (content.length === 0) return `${snippet}\n`;
  const sep = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${sep}${snippet}\n`;
}

export interface ShellEnv {
  home: string;
  platform: NodeJS.Platform;
  shell: string | undefined;
  zdotdir?: string;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

export async function shellIntegration(env: ShellEnv): Promise<ShellIntegration> {
  const rcFile = rcFileFor(env.home, env.shell, env.platform, env.zdotdir);
  const snippet = env.platform === 'win32' ? powershellSnippet(env.home) : posixSnippet(env.home);
  const installed = rcFile ? findBlock(await readText(rcFile)) !== null : false;
  return { snippet, rcFile, installed };
}

/**
 * Rewrites a block a Subtrack install left in the rc file into the current
 * one, so `claude` and `codex` read the moved pointers. Nothing is written
 * when there is no old block: installing stays the person's choice.
 */
export async function migrateShellIntegration(env: ShellEnv): Promise<boolean> {
  const rcFile = rcFileFor(env.home, env.shell, env.platform, env.zdotdir);
  if (!rcFile) return false;
  const before = await readText(rcFile);
  if (!before.includes(LEGACY_BEGIN_MARKER) || before.includes(BEGIN_MARKER)) return false;
  const snippet = env.platform === 'win32' ? powershellSnippet(env.home) : posixSnippet(env.home);
  await writeFile(rcFile, upsertBlock(before, snippet));
  return true;
}

/** Writes the block into the rc file; a no-op (installed: false) when there is none. */
export async function installShellIntegration(env: ShellEnv): Promise<ShellIntegration> {
  const current = await shellIntegration(env);
  if (!current.rcFile) return current;
  const before = await readText(current.rcFile);
  const after = upsertBlock(before, current.snippet);
  if (after !== before) await writeFile(current.rcFile, after);
  return { ...current, installed: true };
}
