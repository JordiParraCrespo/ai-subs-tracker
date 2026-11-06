import type { AccountEntity } from '@flama/frontend-consumer';
import { PROVIDER_NAMES } from './providers';

/**
 * How an account is drawn in the design's rows: a two-letter mark on the
 * provider's colour (the design gives Claude plans the brand purple and
 * Codex the neutral disc), "Provider · Plan" as its title, and who it is
 * under it.
 */
export const PROVIDER_COLORS = {
  'claude-code': '#7764d8',
  codex: '#404040',
  zai: '#2f6fde',
  bigmodel: '#3f51b5',
} as const satisfies Record<AccountEntity['provider'], string>;

export function accountMark(account: AccountEntity): { initials: string; color: string } {
  const plan = account.planName?.replace(/[^A-Za-z]/g, '') ?? '';
  const initials =
    account.provider === 'codex'
      ? 'CX'
      : account.provider === 'zai'
        ? `Z${(plan[0] ?? 'L').toUpperCase()}`
        : account.provider === 'bigmodel'
          ? `B${(plan[0] ?? 'L').toUpperCase()}`
          : `C${(plan[0] ?? 'L').toUpperCase()}`;
  return { initials, color: PROVIDER_COLORS[account.provider] };
}

export function accountTitle(account: AccountEntity): string {
  return account.planName
    ? `${PROVIDER_NAMES[account.provider]} · ${account.planName}`
    : PROVIDER_NAMES[account.provider];
}
