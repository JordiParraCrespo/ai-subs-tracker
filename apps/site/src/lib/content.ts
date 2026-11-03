/**
 * The page's copy and the figures in its product preview.
 *
 * The preview is an illustration of the Overview and Tokenmaxx screens, not
 * anyone's data: the plan names and prices are the catalog's
 * (`packages/shared/src/subscriptions/plans.ts`), the rest is made up and
 * labelled as an example where it renders. Kept here, apart from the markup,
 * so a copy change is a diff of sentences.
 */

/** Value of a month's usage at API prices, in dollars, oldest first. */
export const apiValue = [1520, 1575, 1630, 1710, 1770, 1850, 1940, 2020, 2090, 2180, 2290, 2412];

export const apiValueLabels = apiValue.map((_, i) =>
  new Date(Date.UTC(2025, 11 + i, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }),
);

export const formatDollars = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

export const previewStats = [
  { label: 'Plans cost', value: '$420/mo' },
  { label: 'At API prices', value: '$2,412', tone: 'positive' as const },
  { label: 'Expired unused', value: '$18' },
];

/** The Tokenmaxx queue: the most headroom per hour before its reset first. */
export const useNext = [
  {
    initials: 'CU',
    color: '#d97757',
    title: 'Claude Ultra · work',
    subtitle: 'Weekly window resets in 26h',
    value: '58%',
  },
  {
    initials: 'CX',
    color: '#10a37f',
    title: 'Codex Pro $100 · personal',
    subtitle: 'Weekly window resets in 3d',
    value: '71%',
  },
  {
    initials: 'CM',
    color: '#c15f3c',
    title: 'Claude Max · side project',
    subtitle: '5-hour window resets in 2h',
    value: '12%',
  },
  {
    initials: 'CP',
    color: '#0e7a61',
    title: 'ChatGPT Plus · Codex',
    subtitle: 'Weekly window resets in 6d',
    value: '94%',
  },
  {
    initials: 'CP',
    color: '#b5573a',
    title: 'Claude Pro · spare',
    subtitle: 'Weekly window resets in 5d',
    value: '100%',
  },
] as const;

export const features = [
  {
    icon: 'gauge',
    title: 'Every limit at a glance',
    text: 'The 5-hour and weekly windows of each Claude Code and Codex login, read from the providers themselves.',
  },
  {
    icon: 'list-ordered',
    title: 'The account to use next',
    text: 'Ranked by headroom per hour before each reset, so the allowance that expires first gets used first.',
  },
  {
    icon: 'receipt',
    title: 'Worth at API prices',
    text: 'Tokens counted from the CLIs’ own transcripts and priced per model, so you see what each plan is worth.',
  },
  {
    icon: 'terminal',
    title: 'Switch in one click',
    text: 'Mark an account in use and the opt-in shell snippet points claude and codex in your terminal at it.',
  },
  {
    icon: 'calendar',
    title: 'Renewals and waste',
    text: 'A calendar of when each plan bills, and how much paid allowance expired unused last month.',
  },
  {
    icon: 'app-window',
    title: 'Right in the tray',
    text: 'The account to use next sits in your menu bar, refreshed every ten minutes in the background.',
  },
] as const;

export type FeatureIcon = (typeof features)[number]['icon'];

export const steps = [
  {
    n: '01',
    title: 'Install the desktop app',
    text: 'Subtrack finds the Claude Code and Codex logins already on your computer.',
  },
  {
    n: '02',
    title: 'Add your other accounts',
    text: 'Each one signs into its own folder with the provider’s own CLI, so no login signs another out.',
  },
  {
    n: '03',
    title: 'Follow the queue',
    text: 'Work on the account at the top until it runs low. The tray tells you when to switch.',
  },
] as const;

export const staysLocal = [
  'Provider tokens and refresh tokens',
  'Your prompts, code and transcripts',
  'Your shell and Claude settings, unless you opt in',
];

export const reachesApi = [
  'Account emails and plan names',
  'Limit percentages and reset times',
  'Token counts per model and day',
];
