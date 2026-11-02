import type { ProviderId } from '@flama/shared/subscriptions';

/** Product names are proper nouns, so they are not translated. */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
};

export const PROVIDER_ORDER: readonly ProviderId[] = ['claude-code', 'codex'];
