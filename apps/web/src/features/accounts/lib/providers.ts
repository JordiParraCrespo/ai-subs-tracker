import { type ProviderId, unofficialUsageReader } from '@flama/shared/subscriptions';

/** Product names are proper nouns, so they are not translated. */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  zai: 'Z.AI',
  bigmodel: 'BigModel',
};

export const PROVIDER_ORDER: readonly ProviderId[] = ['claude-code', 'codex', 'zai', 'bigmodel'];

/**
 * Where the vendor shows a hand-tracked plan's usage to a person: Z.AI's
 * billing page (docs.z.ai/devpack/overview), BigModel's usage statistics
 * (docs.bigmodel.cn/cn/coding-plan/overview).
 */
export function usagePageUrl(provider: ProviderId): string | undefined {
  return unofficialUsageReader(provider)?.usageUrl;
}
