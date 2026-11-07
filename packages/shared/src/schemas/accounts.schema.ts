import { z } from 'zod';
import {
  findPlan,
  LOCAL_PROVIDER_IDS,
  MANUAL_PROVIDER_IDS,
  PROVIDER_IDS,
} from '../subscriptions/plans';

/**
 * The wire contract between the desktop collector, the API and the screens.
 *
 * An account is one login to one coding-agent provider (a Claude Code config
 * folder, a Codex home). The desktop app reads it locally and sends what it
 * read — identity, limit windows, token counts — never a credential.
 */

export const providerIdSchema = z.enum(PROVIDER_IDS);
/** A provider the desktop collector reads; only these arrive by sync. */
export const localProviderIdSchema = z.enum(LOCAL_PROVIDER_IDS);
/** A provider a person adds and tracks by hand. */
export const manualProviderIdSchema = z.enum(MANUAL_PROVIDER_IDS);

/** What a limit window meters; `weekly_model` is a weekly cap on one model family. */
export const WINDOW_KINDS = ['session', 'weekly', 'weekly_model', 'monthly', 'other'] as const;
export type WindowKind = (typeof WINDOW_KINDS)[number];

export const limitWindowSchema = z.object({
  /** The provider's own key, e.g. `five_hour`, `seven_day_opus`, `primary`. */
  key: z.string().min(1).max(80),
  kind: z.enum(WINDOW_KINDS),
  label: z.string().min(1).max(80),
  /** Percent used, 0–100; may exceed 100 when the provider lets usage overrun. */
  utilization: z.number().min(0).max(1000).nullable(),
  resetsAt: z.iso.datetime({ offset: true }).nullable(),
  windowMinutes: z.number().int().positive().nullable(),
});
export type LimitWindow = z.infer<typeof limitWindowSchema>;

export const extraUsageSchema = z.object({
  enabled: z.boolean(),
  monthlyLimit: z.number().nullable(),
  usedCredits: z.number().nullable(),
  utilization: z.number().nullable(),
  currency: z.string().max(8).nullable(),
});
export type ExtraUsage = z.infer<typeof extraUsageSchema>;

export const SNAPSHOT_STATUSES = [
  'ok',
  'auth_expired',
  'no_credentials',
  'rate_limited',
  'error',
] as const;
export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number];

/**
 * `poll`: the collector asked the provider; `live`: a running session
 * reported it; `manual`: the person recorded it (providers with no usage API);
 * `unofficial`: the desktop app read it, opt-in, from an endpoint the vendor
 * does not document (`UNOFFICIAL_USAGE_READERS`), so the screens say so.
 * At most 10 characters: the column is `varchar(10)`.
 */
export const SNAPSHOT_SOURCES = ['poll', 'live', 'manual', 'unofficial'] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const usageSnapshotSchema = z.object({
  capturedAt: z.iso.datetime({ offset: true }),
  source: z.enum(SNAPSHOT_SOURCES),
  status: z.enum(SNAPSHOT_STATUSES),
  message: z.string().max(500).nullable(),
  windows: z.array(limitWindowSchema).max(20),
  extraUsage: extraUsageSchema.nullable(),
});
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;

/** One model's tokens on one local day, as the provider's own logs record them. */
export const dailyTokensSchema = z.object({
  day: z.iso.date(),
  model: z.string().min(1).max(120),
  input: z.number().int().min(0),
  output: z.number().int().min(0),
  cacheWrite: z.number().int().min(0),
  cacheRead: z.number().int().min(0),
  messages: z.number().int().min(0),
});
export type DailyTokens = z.infer<typeof dailyTokensSchema>;

/**
 * When the provider says the plan bills, read from the login on the machine
 * (Codex's `id_token` carries the end of the paid period). Only the day of the
 * month travels, in the machine's local time: the period end in a token goes
 * stale until the CLI next refreshes it, but the day a plan bills does not
 * move. `checkedAt` is when the provider last confirmed the subscription.
 */
export const reportedRenewalSchema = z.object({
  day: z.number().int().min(1).max(31),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ReportedRenewal = z.infer<typeof reportedRenewalSchema>;

export const syncAccountSchema = z.object({
  provider: localProviderIdSchema,
  /** Stable id of the login at the provider (account uuid, ChatGPT account id). */
  externalId: z.string().min(1).max(200),
  email: z.string().max(320).nullable(),
  organization: z.string().max(200).nullable(),
  /** The plan as the provider names it (`max`, `default_claude_max_20x`, `pro`). */
  reportedPlan: z.string().max(80).nullable(),
  /** Where the login lives on that machine, shown to tell two logins apart. */
  location: z.string().max(300).nullable(),
  snapshot: usageSnapshotSchema.nullable(),
  dailyTokens: z.array(dailyTokensSchema).max(1000),
  /** Absent from collectors older than it, and null when the login says nothing. */
  reportedRenewal: reportedRenewalSchema.nullable().optional(),
});
export type SyncAccount = z.infer<typeof syncAccountSchema>;

export const syncAccountsSchema = z.object({
  device: z.object({
    name: z.string().min(1).max(120),
    platform: z.string().min(1).max(40),
  }),
  accounts: z.array(syncAccountSchema).max(50),
});
export type SyncAccountsInput = z.infer<typeof syncAccountsSchema>;

/** The fields a person edits on an account; `null` clears an override. */
export const updateAccountSchema = z.object({
  label: z.string().trim().min(1).max(80).nullable().optional(),
  /**
   * Who uses the account, in the person's own words ("Ana", "Me"); `null`
   * is the signed-in person. An account is a login a provider knows by an
   * email; several of them can belong to one person.
   */
  person: z.string().trim().min(1).max(80).nullable().optional(),
  planId: z.string().min(1).max(60).nullable().optional(),
  monthlyPriceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  renewalDay: z.number().int().min(1).max(31).nullable().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * A subscription the person adds by hand, for a provider ResetOwl cannot read
 * on the machine (Z.AI). No credential: only what the person would write on a
 * list of what they pay for. The plan is required (it is what is tracked);
 * the price is required when the vendor publishes no list price for it.
 */
export const createAccountSchema = z
  .object({
    provider: manualProviderIdSchema,
    label: z.string().trim().min(1).max(80),
    email: z.email().max(320).nullable().optional(),
    planId: z.string().min(1).max(60),
    monthlyPriceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
    renewalDay: z.number().int().min(1).max(31).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    const plan = findPlan(input.planId);
    if (plan?.provider !== input.provider) {
      ctx.addIssue({ code: 'custom', path: ['planId'], params: { i18nKey: 'validation.choice' } });
      return;
    }
    if (plan.monthlyPriceCents === null && (input.monthlyPriceCents ?? null) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['monthlyPriceCents'],
        // The plan has no published price: the person says what they pay.
        params: { i18nKey: 'validation.required' },
      });
    }
  });
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * A usage reading the person copied from the vendor's own usage page, for an
 * account tracked by hand. Percentages of each window used; `weeklyResetsAt`
 * is when the vendor says the weekly allowance resets.
 */
export const recordUsageSchema = z
  .object({
    sessionUtilization: z.number().min(0).max(100).nullable(),
    weeklyUtilization: z.number().min(0).max(100).nullable(),
    weeklyResetsAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((input) => input.sessionUtilization !== null || input.weeklyUtilization !== null, {
    path: ['weeklyUtilization'],
    params: { i18nKey: 'validation.required' },
  });
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;

/**
 * A reading the desktop app took from a manual provider's unofficial usage
 * endpoint, with the person's key on their machine. The windows carry the
 * vendor's real reset times; `reportedPlan` is the tier the vendor named
 * (`lite`, `pro`, `max`), kept for information. Never a credential.
 */
export const reportUsageReadingSchema = z.object({
  reportedPlan: z.string().max(80).nullable(),
  snapshot: usageSnapshotSchema.extend({
    source: z.literal('unofficial'),
    status: z.literal('ok'),
    windows: z.array(limitWindowSchema).min(1).max(20),
  }),
});
export type ReportUsageReadingInput = z.infer<typeof reportUsageReadingSchema>;

export const usageSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>;

/**
 * The account editor's fields as typed: an empty label or plan means "use what
 * the provider reports", an empty person means "the signed-in person", an empty price means "the plan's list price", an
 * empty renewal day means "not set". The
 * form maps these onto `updateAccountSchema`.
 */
export const editAccountFormSchema = z.object({
  label: z.string().trim().max(80),
  person: z.string().trim().max(80),
  planId: z.string().max(60),
  price: z
    .string()
    .trim()
    .regex(/^(\d{1,5}(\.\d{1,2})?)?$/),
  /** Empty, or a day of the month: 1 to 31. */
  renewalDay: z
    .string()
    .trim()
    .regex(/^([1-9]|[12]\d|3[01])?$/),
});
export type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;

const percentField = z
  .string()
  .trim()
  .regex(/^((100(\.0{1,2})?)|(\d{1,2}(\.\d{1,2})?))?$/);

/**
 * The add-a-subscription form for a manual provider, as typed. An empty
 * email or renewal day means "not set"; an empty price means the plan's list
 * price, which a plan without one does not allow.
 */
export const addManualAccountFormSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    email: z.union([z.literal(''), z.email().max(320)]),
    planId: z.string().min(1).max(60),
    price: editAccountFormSchema.shape.price,
    renewalDay: editAccountFormSchema.shape.renewalDay,
  })
  .refine((values) => values.price !== '' || findPlan(values.planId)?.monthlyPriceCents != null, {
    path: ['price'],
    params: { i18nKey: 'validation.required' },
  });
export type AddManualAccountFormValues = z.infer<typeof addManualAccountFormSchema>;

/**
 * The record-usage form as typed: percentages 0–100 (empty skips the window)
 * and the weekly reset as a local `datetime-local` value (empty: unknown).
 */
export const recordUsageFormSchema = z
  .object({
    session: percentField,
    weekly: percentField,
    weeklyResetsAt: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/),
  })
  .refine((values) => values.session !== '' || values.weekly !== '', {
    path: ['weekly'],
    params: { i18nKey: 'validation.required' },
  });
export type RecordUsageFormValues = z.infer<typeof recordUsageFormSchema>;

/**
 * The key a person pastes to turn on an unofficial usage reader (desktop
 * only). One line of printable text: it travels as a header value, to the
 * vendor and nowhere else.
 */
export const usageReaderKeyFormSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(8)
    .max(512)
    .regex(/^[\x21-\x7e]+$/),
});
export type UsageReaderKeyFormValues = z.infer<typeof usageReaderKeyFormSchema>;
