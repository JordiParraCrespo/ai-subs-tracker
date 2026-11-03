import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ShellIntegration } from '@flama/shared/desktop';
import { pointerPath } from './pointers';

/**
 * Makes `claude` and `codex` in a terminal follow the account marked active
 * in Subtrack: two shell functions that read the pointer file and, when it
 * names a home, run the CLI with `CLAUDE_CONFIG_DIR` / `CODEX_HOME` set for
 * that one command. An empty pointer runs the plain CLI (the default login).
 *
 * Written to an rc file only when the person asks (`install`), inside
 * markers so a second install replaces the block and removing it is one
 * delete.
 */

export const BEGIN_MARKER = '# >>> subtrack >>>';
export const END_MARKER = '# <<< subtrack <<<';

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
    '# Added by Subtrack: `claude` and `codex` use the account marked active in the app.',
    '# Remove this block to undo it.',
    'function claude {',
    `  local _subtrack_home; _subtrack_home="$(cat ${claude} 2>/dev/null)"`,
    '  if [ -n "$_subtrack_home" ]; then',
    '    CLAUDE_CONFIG_DIR="$_subtrack_home" command claude "$@"',
    '  else',
    '    command claude "$@"',
    '  fi',
    '}',
    'function codex {',
    `  local _subtrack_home; _subtrack_home="$(cat ${codex} 2>/dev/null)"`,
    '  if [ -n "$_subtrack_home" ]; then',
    '    CODEX_HOME="$_subtrack_home" command codex "$@"',
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
    '# Added by Subtrack: `claude` and `codex` use the account marked active in the app.',
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

/** `content` with the Subtrack block replaced by `snippet`, or appended when absent. */
export function upsertBlock(content: string, snippet: string): string {
  const start = content.indexOf(BEGIN_MARKER);
  const end = start === -1 ? -1 : content.indexOf(END_MARKER, start);
  if (start !== -1 && end !== -1) {
    return content.slice(0, start) + snippet + content.slice(end + END_MARKER.length);
  }
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
  const installed = rcFile ? (await readText(rcFile)).includes(BEGIN_MARKER) : false;
  return { snippet, rcFile, installed };
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
