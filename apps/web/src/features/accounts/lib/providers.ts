import type { ProviderId } from '@flama/shared/subscriptions';

/** Product names are proper nouns, so they are not translated. */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  zai: 'Z.AI',
};

export const PROVIDER_ORDER: readonly ProviderId[] = ['claude-code', 'codex', 'zai'];

/** Where Z.AI shows a Coding Plan's usage (docs.z.ai/devpack/overview); ResetOwl cannot read it. */
export const ZAI_USAGE_URL = 'https://z.ai/manage-apikey/billing';
