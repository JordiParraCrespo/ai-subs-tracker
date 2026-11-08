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
 * 2026-11-02; docs.z.ai/devpack/overview and docs.z.ai/devpack/faq, checked
 * 2026-11-04; docs.bigmodel.cn/cn/coding-plan/overview, checked 2026-11-05.
 */

/** Providers the desktop collector reads on the machine and a terminal can switch between. */
export const LOCAL_PROVIDER_IDS = ['claude-code', 'codex'] as const;
export type LocalProviderId = (typeof LOCAL_PROVIDER_IDS)[number];

/** Providers a person adds in the app and tracks by hand (see `ProviderTracking`). */
export const MANUAL_PROVIDER_IDS = ['zai', 'bigmodel'] as const;
export type ManualProviderId = (typeof MANUAL_PROVIDER_IDS)[number];

export const PROVIDER_IDS = [...LOCAL_PROVIDER_IDS, ...MANUAL_PROVIDER_IDS] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, { name: string; vendor: string }> = {
  'claude-code': { name: 'Claude Code', vendor: 'Anthropic' },
  codex: { name: 'Codex', vendor: 'OpenAI' },
  zai: { name: 'GLM Coding Plan', vendor: 'Z.AI' },
  bigmodel: { name: 'GLM Coding Plan', vendor: 'Zhipu BigModel' },
};

/**
 * How ResetOwl learns an account's usage.
 *
 * - `local`: the desktop collector finds the login on the machine
 *   (`@flama/usage-providers`) and reads its limits and tokens.
 * - `manual`: there is no login to find and no documented usage API, so the
 *   person adds the subscription in the app and records its usage by hand.
 *   Z.AI's Coding Plan is an API key used inside other tools; Z.AI documents
 *   no usage endpoint (its usage page is z.ai/manage-apikey/coding-plan/personal/usage).
 *   BigModel is the same plan sold in mainland China by Zhipu, with its own
 *   site, prices and keys.
 *
 * A manual provider may also have an **unofficial usage reader**
 * (`UNOFFICIAL_USAGE_READERS`): an endpoint the vendor's own tools call but
 * does not document. It is opt-in per account, in the desktop app only, with
 * the person's own key kept on the machine; its readings carry the source
 * `unofficial`, and recording by hand stays the fallback.
 */
export type ProviderTracking = 'local' | 'manual';

export function providerTracking(id: ProviderId): ProviderTracking {
  return (MANUAL_PROVIDER_IDS as readonly ProviderId[]).includes(id) ? 'manual' : 'local';
}

export function isManualProvider(id: ProviderId): id is ManualProviderId {
  return providerTracking(id) === 'manual';
}

export interface UnofficialUsageReader {
  /**
   * The HTTPS origin the quota endpoint lives on; the person's key is sent
   * there and nowhere else. The path is the reader's (`@flama/usage-providers`).
   */
  origin: string;
  /** Where the person creates the key the reader needs. */
  keysUrl: string;
  /** Where the vendor shows the same usage to a person, to check it against. */
  usageUrl: string;
}

/**
 * The manual providers whose usage the desktop app can read, opt-in, from an
 * endpoint the vendor does not document: `GET <origin>/api/monitor/usage/quota/limit`,
 * which Z.AI's own `glm-plan-usage` plugin and the Orca and ZCode tools call
 * with a Coding Plan key. Z.AI and BigModel each have their own site and keys.
 */
export const UNOFFICIAL_USAGE_READERS: Partial<Record<ManualProviderId, UnofficialUsageReader>> = {
  zai: {
    origin: 'https://api.z.ai',
    keysUrl: 'https://z.ai/manage-apikey',
    usageUrl: 'https://z.ai/manage-apikey/coding-plan/personal/usage',
  },
  bigmodel: {
    origin: 'https://open.bigmodel.cn',
    keysUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
    usageUrl: 'https://www.bigmodel.cn/coding-plan/personal/usage',
  },
};

/** The unofficial reader a provider has, if any. */
export function unofficialUsageReader(id: ProviderId): UnofficialUsageReader | undefined {
  return isManualProvider(id) ? UNOFFICIAL_USAGE_READERS[id] : undefined;
}

/** Which limit windows a plan meters; a plan without a 5-hour window only has a weekly one. */
export type PlanWindows = 'session+weekly' | 'weekly';

export interface PlanDefinition {
  /** Stable id stored on an account, e.g. `claude-ultra`. */
  id: string;
  provider: ProviderId;
  /** The vendor's current name for it. */
  name: string;
  /**
   * Default monthly price in US cents; an account may override it. Null when
   * the vendor publishes no list price for the tier, so the person must say
   * what they pay — never a guessed number.
   */
  monthlyPriceCents: number | null;
  windows: PlanWindows;
  /** Usage relative to the provider's entry paid plan, when the vendor states one. */
  multiplier?: number;
  /**
   * The allowance per window when the vendor states it as a quantity rather
   * than a percentage, e.g. Z.AI's credits. Informational: limits are still
   * tracked as percent used.
   */
  allowance?: { session: number; weekly: number; unit: 'credits' };
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
  // Z.AI — docs.z.ai/devpack/overview. Credits per window are documented for
  // every tier; the 5-hour credits return 5 hours after they are spent and the
  // weekly ones reset every 7 days from the order. Only Lite's price is
  // published there ("starting at 18 USD per month"); Pro and Max have none
  // in the docs, so their accounts carry the price the person pays.
  {
    id: 'zai-lite',
    provider: 'zai',
    name: 'Lite',
    monthlyPriceCents: 1800,
    windows: 'session+weekly',
    allowance: { session: 2000, weekly: 10000, unit: 'credits' },
    aliases: ['lite', 'glm coding lite'],
  },
  {
    id: 'zai-pro',
    provider: 'zai',
    name: 'Pro',
    monthlyPriceCents: null,
    windows: 'session+weekly',
    allowance: { session: 12000, weekly: 60000, unit: 'credits' },
    aliases: ['pro', 'glm coding pro'],
  },
  {
    id: 'zai-max',
    provider: 'zai',
    name: 'Max',
    monthlyPriceCents: null,
    windows: 'session+weekly',
    allowance: { session: 28000, weekly: 140000, unit: 'credits' },
    aliases: ['max', 'glm coding max'],
  },
  // BigModel — docs.bigmodel.cn/cn/coding-plan/overview. The same credits per
  // window as Z.AI's tiers; the docs publish no price for any tier (the
  // subscription page sells them in CNY), so every account carries the price
  // the person pays, which ResetOwl keeps in US dollars like every other.
  {
    id: 'bigmodel-lite',
    provider: 'bigmodel',
    name: 'Lite',
    monthlyPriceCents: null,
    windows: 'session+weekly',
    allowance: { session: 2000, weekly: 10000, unit: 'credits' },
    aliases: ['lite', 'glm coding lite'],
  },
  {
    id: 'bigmodel-pro',
    provider: 'bigmodel',
    name: 'Pro',
    monthlyPriceCents: null,
    windows: 'session+weekly',
    allowance: { session: 12000, weekly: 60000, unit: 'credits' },
    aliases: ['pro', 'glm coding pro'],
  },
  {
    id: 'bigmodel-max',
    provider: 'bigmodel',
    name: 'Max',
    monthlyPriceCents: null,
    windows: 'session+weekly',
    allowance: { session: 28000, weekly: 140000, unit: 'credits' },
    aliases: ['max', 'glm coding max'],
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

/**
 * The plan a hand-tracked account's vendor says it is on, when that is not
 * the plan the person chose. A manual account's plan is the person's choice,
 * and it sets the limits and the list price; an unofficial reader reports the
 * tier the vendor names (`max`), which is only a hint, so a disagreement is
 * shown for the person to settle and never applied on its own. Undefined when
 * they agree, when nothing was reported, or when the report names no tier the
 * catalog knows. Local providers are left out: their reported names are what
 * the plan defaults to, and a person's override there is deliberate.
 */
export function reportedPlanMismatch(
  provider: ProviderId,
  planId: string | null | undefined,
  reported: string | null | undefined,
): PlanDefinition | undefined {
  if (!isManualProvider(provider) || !planId) return undefined;
  const plan = resolvePlan(provider, reported);
  return plan && plan.id !== planId ? plan : undefined;
}

export function plansFor(provider: ProviderId): PlanDefinition[] {
  return PLANS.filter((plan) => plan.provider === provider);
}
