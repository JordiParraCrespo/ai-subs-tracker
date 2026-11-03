/**
 * The plans ResetOwl recognises, per coding-agent provider.
 *
 * Plan names and prices move (Anthropic renamed Max 20x to Ultra on
 * 2026-10-30; OpenAI split Pro into three tiers on 2026-09-29), so this is one
 * table of data, not logic spread around the code: a rename is a new row plus
 * an alias, and every reader — the API, the desktop collector, the screens —
 * resolves through `resolvePlan`. An account can always override the price
 * (what it actually pays), and the catalog price is only the default.
 *
 * Sources: claude.com/pricing and learn.chatgpt.com/docs/pricing, checked
 * 2026-11-02.
 */

export const PROVIDER_IDS = ['claude-code', 'codex'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, { name: string; vendor: string }> = {
  'claude-code': { name: 'Claude Code', vendor: 'Anthropic' },
  codex: { name: 'Codex', vendor: 'OpenAI' },
};

/** Which limit windows a plan meters; a plan without a 5-hour window only has a weekly one. */
export type PlanWindows = 'session+weekly' | 'weekly';

export interface PlanDefinition {
  /** Stable id stored on an account, e.g. `claude-ultra`. */
  id: string;
  provider: ProviderId;
  /** The vendor's current name for it. */
  name: string;
  /** Default monthly price in US cents; an account may override it. */
  monthlyPriceCents: number;
  windows: PlanWindows;
  /** Usage relative to the provider's entry paid plan, when the vendor states one. */
  multiplier?: number;
  /** Names a provider reports for this plan, lower-cased, old names included. */
  aliases: readonly string[];
}

export const PLANS: readonly PlanDefinition[] = [
  // Anthropic — claude.com/pricing
  {
    id: 'claude-free',
    provider: 'claude-code',
    name: 'Free',
    monthlyPriceCents: 0,
    windows: 'session+weekly',
    aliases: ['free'],
  },
  {
    id: 'claude-pro',
    provider: 'claude-code',
    name: 'Pro',
    monthlyPriceCents: 2000,
    windows: 'session+weekly',
    multiplier: 1,
    aliases: ['pro', 'claude_pro', 'default_claude_pro'],
  },
  {
    id: 'claude-max',
    provider: 'claude-code',
    name: 'Max',
    monthlyPriceCents: 10000,
    windows: 'session+weekly',
    multiplier: 5,
    aliases: ['max', 'max 5x', 'max_5x', 'claude_max_5x', 'default_claude_max_5x'],
  },
  {
    // Was "Max 20x" until 2026-10-30. Verified accounts have no 5-hour limit.
    id: 'claude-ultra',
    provider: 'claude-code',
    name: 'Ultra',
    monthlyPriceCents: 20000,
    windows: 'weekly',
    multiplier: 10,
    aliases: [
      'ultra',
      'max 20x',
      'max_20x',
      'claude_max_20x',
      'default_claude_max_20x',
      'claude_ultra',
    ],
  },
  {
    id: 'claude-team-standard',
    provider: 'claude-code',
    name: 'Team Standard',
    monthlyPriceCents: 2500,
    windows: 'session+weekly',
    aliases: ['team', 'team standard', 'team_standard'],
  },
  {
    id: 'claude-team-premium',
    provider: 'claude-code',
    name: 'Team Premium',
    monthlyPriceCents: 12500,
    windows: 'session+weekly',
    aliases: ['team premium', 'team_premium'],
  },
  {
    id: 'claude-enterprise',
    provider: 'claude-code',
    name: 'Enterprise',
    monthlyPriceCents: 2000,
    windows: 'session+weekly',
    aliases: ['enterprise'],
  },
  // OpenAI — learn.chatgpt.com/docs/pricing
  {
    id: 'codex-free',
    provider: 'codex',
    name: 'Free',
    monthlyPriceCents: 0,
    windows: 'session+weekly',
    aliases: ['free'],
  },
  {
    id: 'codex-go',
    provider: 'codex',
    name: 'Go',
    monthlyPriceCents: 800,
    windows: 'session+weekly',
    aliases: ['go'],
  },
  {
    id: 'codex-plus',
    provider: 'codex',
    name: 'Plus',
    monthlyPriceCents: 2000,
    windows: 'session+weekly',
    multiplier: 1,
    aliases: ['plus', 'personal (plus)'],
  },
  {
    id: 'codex-pro-100',
    provider: 'codex',
    name: 'Pro $100',
    monthlyPriceCents: 10000,
    windows: 'weekly',
    aliases: ['pro_100', 'pro-100', 'pro lite', 'prolite'],
  },
  {
    // `pro` alone is what `plan_type` reports for every Pro tier today; $200
    // is the default until the account says otherwise.
    id: 'codex-pro-200',
    provider: 'codex',
    name: 'Pro $200',
    monthlyPriceCents: 20000,
    windows: 'weekly',
    aliases: ['pro', 'pro_200', 'pro-200'],
  },
  {
    id: 'codex-pro-500',
    provider: 'codex',
    name: 'Pro $500',
    monthlyPriceCents: 50000,
    windows: 'weekly',
    aliases: ['pro_500', 'pro-500', 'pro max'],
  },
  {
    id: 'codex-business',
    provider: 'codex',
    name: 'Business',
    monthlyPriceCents: 2500,
    windows: 'session+weekly',
    aliases: ['business', 'team'],
  },
  {
    id: 'codex-enterprise',
    provider: 'codex',
    name: 'Enterprise',
    monthlyPriceCents: 0,
    windows: 'session+weekly',
    aliases: ['enterprise', 'edu'],
  },
];

export const PLAN_IDS = PLANS.map((plan) => plan.id);

export function findPlan(id: string | null | undefined): PlanDefinition | undefined {
  return id ? PLANS.find((plan) => plan.id === id) : undefined;
}

/**
 * The plan a provider's own name for it means, or undefined when the name is
 * unknown (a new tier). Matching is case- and separator-insensitive.
 */
export function resolvePlan(provider: ProviderId, reported: string | null | undefined) {
  if (!reported) return undefined;
  const key = reported.trim().toLowerCase();
  const loose = key.replace(/[\s_-]+/g, ' ');
  return PLANS.find(
    (plan) =>
      plan.provider === provider &&
      (plan.id === key ||
        plan.aliases.some((alias) => alias === key || alias.replace(/[\s_-]+/g, ' ') === loose)),
  );
}

export function plansFor(provider: ProviderId): PlanDefinition[] {
  return PLANS.filter((plan) => plan.provider === provider);
}
