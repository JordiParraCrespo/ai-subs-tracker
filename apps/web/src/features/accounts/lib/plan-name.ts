import { type ProviderId, resolvePlan } from '@flama/shared/subscriptions';

/**
 * A provider's own name for a plan, made readable: the catalog name when one
 * of its aliases matches (`default_claude_max_20x` is Ultra, which was Max 20x
 * until the rename), else the raw id humanised, so a tier the catalog does not
 * know yet still reads as words and never as an internal id.
 */
export function reportedPlanName(provider: ProviderId, reported: string | null): string | null {
  if (!reported?.trim()) return null;
  const plan = resolvePlan(provider, reported);
  if (plan) return plan.name;
  const words = reported
    .trim()
    .replace(/^default[\s_-]+/i, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .join(' ');
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
