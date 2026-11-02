import type { ProviderId } from '@flama/shared/subscriptions';
import { claudeCodeProvider } from './claude-code';
import { codexProvider } from './codex';
import type { CodingAgentProvider } from './types';

/** A provider list, refusing two providers with one id. */
export function defineProviders(
  providers: readonly CodingAgentProvider[],
): readonly CodingAgentProvider[] {
  const seen = new Set<ProviderId>();
  for (const provider of providers) {
    if (seen.has(provider.id)) throw new Error(`Duplicate coding-agent provider "${provider.id}"`);
    seen.add(provider.id);
  }
  return Object.freeze([...providers]);
}

/** Every provider Subtrack reads, in display order. */
export const PROVIDERS: readonly CodingAgentProvider[] = defineProviders([
  claudeCodeProvider,
  codexProvider,
]);

export function getProvider(id: ProviderId): CodingAgentProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
