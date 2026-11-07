/**
 * Pay-as-you-go API prices, used to answer "what would this plan usage have
 * cost at API prices". It is an estimate: the vendors' bills are the
 * authority, and an unknown model is priced at nothing rather than guessed.
 *
 * USD per million tokens. A model id is matched by the first rule whose
 * pattern it contains (lower-cased), so dated or suffixed ids
 * (`claude-sonnet-5-5-20260901`, `gpt-6.1-sol-codex`) still resolve; order
 * matters where one pattern is a prefix of another. Every model Claude Code
 * offers has a rule of its own, so none is shown or priced as its family.
 *
 * Sources (checked 2026-11-07): Anthropic's model table; OpenAI's published
 * rates as reported by pricing trackers (openai.com/api/pricing blocks
 * automated reads). Cache writes default to 1.25x input where the vendor
 * states no separate rate.
 */
export interface ModelPrice {
  /** Substring of the model id this rule matches. */
  match: string;
  label: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const anthropic = (
  match: string,
  label: string,
  input: number,
  output: number,
  cacheRead = input * 0.1,
): ModelPrice => ({ match, label, input, output, cacheWrite: input * 1.25, cacheRead });

const openai = (
  match: string,
  label: string,
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite = input * 1.25,
): ModelPrice => ({ match, label, input, output, cacheWrite, cacheRead });

export const MODEL_PRICES: readonly ModelPrice[] = [
  anthropic('fable-5-1', 'Claude Fable 5.1', 10, 50, 0.25),
  anthropic('mythos-5-1', 'Claude Mythos 5.1', 10, 50, 0.25),
  anthropic('mythos', 'Claude Mythos 5', 10, 50),
  anthropic('fable', 'Claude Fable 5', 10, 50),
  anthropic('opus-5-5', 'Claude Opus 5.5', 4, 20, 0.2),
  anthropic('opus-5', 'Claude Opus 5', 5, 25),
  anthropic('opus-4-8', 'Claude Opus 4.8', 5, 25),
  anthropic('opus-4-7', 'Claude Opus 4.7', 5, 25),
  anthropic('opus-4-6', 'Claude Opus 4.6', 5, 25),
  anthropic('opus-4-5', 'Claude Opus 4.5', 5, 25),
  anthropic('opus-4-1', 'Claude Opus 4.1', 15, 75),
  anthropic('opus-4', 'Claude Opus 4', 15, 75),
  anthropic('sonnet-5-5', 'Claude Sonnet 5.5', 2, 10, 0.2),
  anthropic('sonnet-5', 'Claude Sonnet 5', 2, 10),
  anthropic('sonnet-4-6', 'Claude Sonnet 4.6', 3, 15),
  anthropic('sonnet-4-5', 'Claude Sonnet 4.5', 3, 15),
  anthropic('sonnet-4', 'Claude Sonnet 4', 3, 15),
  anthropic('haiku-5-5', 'Claude Haiku 5.5', 0.1, 0.5, 0.01),
  anthropic('haiku-4-5', 'Claude Haiku 4.5', 1, 5),
  openai('astra', 'GPT-6 Astra', 10, 50, 1, 12.5),
  openai('terra', 'GPT-6.1 Terra', 1, 5, 0.05, 1.25),
  openai('sol', 'GPT-6.1 Sol', 2, 10, 0.1, 2.5),
  openai('luna', 'GPT-6 Luna', 0.1, 0.5, 0.01),
];

export function priceFor(model: string): ModelPrice | undefined {
  const id = model.toLowerCase();
  return MODEL_PRICES.find((rule) => id.includes(rule.match));
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** What these tokens would have cost on the API, in US cents; 0 for an unknown model. */
export function apiCostCents(model: string, tokens: TokenCounts): number {
  const price = priceFor(model);
  if (!price) return 0;
  const dollars =
    (tokens.input * price.input +
      tokens.output * price.output +
      tokens.cacheWrite * price.cacheWrite +
      tokens.cacheRead * price.cacheRead) /
    1_000_000;
  return dollars * 100;
}
