import { z } from 'zod';
import { PROVIDER_IDS } from '../subscriptions/plans';

/**
 * The wire contract between the desktop collector, the API and the screens.
 *
 * An account is one login to one coding-agent provider (a Claude Code config
 * folder, a Codex home). The desktop app reads it locally and sends what it
 * read — identity, limit windows, token counts — never a credential.
 */

export const providerIdSchema = z.enum(PROVIDER_IDS);

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

/** `poll`: the collector asked the provider; `live`: a running session reported it. */
export const SNAPSHOT_SOURCES = ['poll', 'live'] as const;
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

export const syncAccountSchema = z.object({
  provider: providerIdSchema,
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
  planId: z.string().min(1).max(60).nullable().optional(),
  monthlyPriceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const usageSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>;

/**
 * The account editor's fields as typed: an empty label or plan means "use what
 * the provider reports", an empty price means "the plan's list price". The
 * form maps these onto `updateAccountSchema`.
 */
export const editAccountFormSchema = z.object({
  label: z.string().trim().max(80),
  planId: z.string().max(60),
  price: z
    .string()
    .trim()
    .regex(/^(\d{1,5}(\.\d{1,2})?)?$/),
});
export type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;
