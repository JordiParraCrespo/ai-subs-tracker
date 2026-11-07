import { type ProviderId, unofficialUsageReader } from '@flama/shared/subscriptions';

/** Product names are proper nouns, so they are not translated. */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  zai: 'Z.AI',
  bigmodel: 'BigModel',
};

/**
 * The company behind each product, for views that group spend by who is paid
 * rather than by which tool was used. Z.AI and BigModel are both Zhipu's, but
 * they bill separately and people know them by those names.
 */
export const PROVIDER_VENDORS: Record<ProviderId, string> = {
  'claude-code': 'Anthropic',
  codex: 'OpenAI',
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
