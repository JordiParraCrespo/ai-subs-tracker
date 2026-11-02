import type {
  ExtraUsage,
  LimitWindow,
  SnapshotSource,
  SnapshotStatus,
} from '@flama/shared/schemas/accounts';
import type { ProviderId, RankableAccount } from '@flama/shared/subscriptions';

export interface WeeklyPeak {
  resetsAt: Date;
  peakUtilization: number;
}

export interface UsageReading {
  capturedAt: Date;
  source: SnapshotSource;
  status: SnapshotStatus;
  message: string | null;
  windows: readonly LimitWindow[];
  extraUsage: ExtraUsage | null;
}

/**
 * One coding-agent login the person tracks: its plan and price, and the last
 * reading of its limit windows. `RankableAccount` is what the tokenmaxx
 * ranking reads, so the screens and the desktop tray rank the same objects.
 */
export class AccountEntity implements RankableAccount {
  constructor(
    public readonly id: string,
    public readonly provider: ProviderId,
    public readonly externalId: string,
    public readonly displayName: string,
    public readonly label: string | null,
    public readonly email: string | null,
    public readonly organization: string | null,
    public readonly location: string | null,
    public readonly reportedPlan: string | null,
    public readonly planId: string | null,
    public readonly planName: string | null,
    public readonly planOverridden: boolean,
    public readonly monthlyPriceCents: number,
    public readonly priceOverridden: boolean,
    /** The day of the month the plan bills, when the person set it. */
    public readonly renewalDay: number | null,
    public readonly isActive: boolean,
    public readonly lastSyncedAt: Date | null,
    public readonly createdAt: Date,
    public readonly latest: UsageReading | null,
    public readonly weeklyPeaks: readonly WeeklyPeak[],
  ) {}

  get status(): SnapshotStatus | null {
    return this.latest?.status ?? null;
  }

  get windows(): readonly LimitWindow[] {
    return this.latest?.windows ?? [];
  }

  window(kind: LimitWindow['kind']): LimitWindow | undefined {
    return this.windows.find((w) => w.kind === kind && w.utilization !== null);
  }

  /** Two letters for the avatar: the label's or the email's. */
  get initials(): string {
    const source = (this.label ?? this.email ?? this.externalId).replace(/@.*/, '');
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
    return letters.toUpperCase();
  }
}

export interface TokenTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  messages: number;
  apiCostCents: number;
}

/** Tokens across the person's accounts, priced at API rates. Plain data, not entities. */
export interface UsageSummary {
  days: number;
  since: string;
  totals: TokenTotals;
  byModel: (TokenTotals & { model: string; label: string | null })[];
  byAccount: (TokenTotals & { accountId: string })[];
  daily: (TokenTotals & { day: string })[];
  /** Every account, day and model, priced: what the usage screen filters and groups. */
  rows: (TokenTotals & { accountId: string; day: string; model: string })[];
}
