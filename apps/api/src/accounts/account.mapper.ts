import type { Mapper } from '@flama/backend-ddd';
import type {
  CreateAccountInput,
  DailyTokens,
  LimitWindow,
  RecordUsageInput,
  SyncAccount,
  UsageSnapshot,
} from '@flama/shared/schemas/accounts';
import { apiCostCents, priceFor } from '@flama/shared/subscriptions';
import { Injectable } from '@nestjs/common';
import { AccountOrmEntity } from './database/account.orm-entity';
import { TokenUsageDailyOrmEntity } from './database/token-usage-daily.orm-entity';
import type { AccountDailyTokens, WeeklyPeak } from './database/usage.repository.port';
import { UsageSnapshotOrmEntity } from './database/usage-snapshot.orm-entity';
import { AccountEntity, type ManualAccountInput, type Sighting } from './domain/account.entity';
import type { ManualUsage } from './domain/manual-usage.factory';
import { AccountResponseDto, UsageSnapshotResponseDto } from './dtos/account.response.dto';
import type {
  TokenTotalsResponseDto,
  UsageSummaryResponseDto,
} from './dtos/usage-summary.response.dto';

type Totals = Omit<TokenTotalsResponseDto, never>;

const emptyTotals = (): Totals => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  messages: 0,
  apiCostCents: 0,
});

function addInto(target: Totals, row: DailyTokens): void {
  target.input += row.input;
  target.output += row.output;
  target.cacheWrite += row.cacheWrite;
  target.cacheRead += row.cacheRead;
  target.messages += row.messages;
  target.apiCostCents += apiCostCents(row.model, row);
}

const rounded = <T extends Totals>(totals: T): T => ({
  ...totals,
  apiCostCents: Math.round(totals.apiCostCents),
});

/** Every shape an account, its readings and its token counts take. */
@Injectable()
export class AccountMapper implements Mapper<AccountEntity, AccountOrmEntity, AccountResponseDto> {
  toPersistence(entity: AccountEntity): AccountOrmEntity {
    const record = new AccountOrmEntity();
    const props = entity.getProps();
    record.id = props.id;
    record.userId = props.userId;
    record.provider = props.provider;
    record.externalId = props.externalId;
    record.email = props.email;
    record.organization = props.organization;
    record.reportedPlan = props.reportedPlan;
    record.location = props.location;
    record.label = props.label;
    record.planId = props.planId;
    record.monthlyPriceCents = props.monthlyPriceCents;
    record.renewalDay = props.renewalDay;
    record.reportedRenewalDay = props.reportedRenewalDay;
    record.renewalCheckedAt = props.renewalCheckedAt;
    record.isActive = props.isActive;
    record.activatedAt = props.activatedAt;
    record.lastSyncedAt = props.lastSyncedAt;
    record.archivedAt = props.archivedAt;
    record.createdAt = props.createdAt;
    record.updatedAt = props.updatedAt;
    return record;
  }

  toDomain(record: AccountOrmEntity): AccountEntity {
    return AccountEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        userId: record.userId,
        provider: record.provider,
        externalId: record.externalId,
        email: record.email,
        organization: record.organization,
        reportedPlan: record.reportedPlan,
        location: record.location,
        label: record.label,
        planId: record.planId,
        monthlyPriceCents: record.monthlyPriceCents,
        renewalDay: record.renewalDay,
        reportedRenewalDay: record.reportedRenewalDay,
        renewalCheckedAt: record.renewalCheckedAt,
        isActive: record.isActive,
        activatedAt: record.activatedAt,
        lastSyncedAt: record.lastSyncedAt,
        archivedAt: record.archivedAt,
      },
    });
  }

  toResponse(entity: AccountEntity): AccountResponseDto {
    return this.toAccountResponse(entity, undefined, []);
  }

  toAccountResponse(
    entity: AccountEntity,
    latest: UsageSnapshot | undefined,
    peaks: WeeklyPeak[],
  ): AccountResponseDto {
    const plan = entity.plan;
    const dto = new AccountResponseDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.externalId = entity.externalId;
    dto.displayName = entity.displayName;
    dto.label = entity.label;
    dto.email = entity.email;
    dto.organization = entity.organization;
    dto.location = entity.location;
    dto.reportedPlan = entity.reportedPlan;
    dto.planId = plan?.id ?? null;
    dto.planName = plan?.name ?? null;
    dto.planOverridden = entity.planId !== null;
    dto.monthlyPriceCents = entity.effectivePriceCents;
    dto.priceOverridden = entity.monthlyPriceCents !== null;
    dto.renewalDay = entity.renewalDay;
    dto.renewalDayOverridden = entity.renewalDayOverridden;
    dto.renewalCheckedAt = entity.renewalCheckedAt?.toISOString() ?? null;
    dto.isActive = entity.isActive;
    dto.lastSyncedAt = entity.lastSyncedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.latest = latest ? Object.assign(new UsageSnapshotResponseDto(), latest) : null;
    dto.weeklyPeaks = peaks.map((peak) => ({
      resetsAt: peak.resetsAt.toISOString(),
      peakUtilization: peak.peakUtilization,
    }));
    return dto;
  }

  toSighting(input: SyncAccount, at: Date): Sighting {
    return {
      email: input.email,
      organization: input.organization,
      reportedPlan: input.reportedPlan,
      location: input.location,
      reportedRenewal: input.reportedRenewal
        ? {
            day: input.reportedRenewal.day,
            checkedAt: input.reportedRenewal.checkedAt
              ? new Date(input.reportedRenewal.checkedAt)
              : null,
          }
        : null,
      at,
    };
  }

  /** The create request, with its optional fields made explicit: absent means not set. */
  toManualAccountInput(userId: string, body: CreateAccountInput): ManualAccountInput {
    return {
      userId,
      provider: body.provider,
      label: body.label,
      email: body.email ?? null,
      planId: body.planId,
      monthlyPriceCents: body.monthlyPriceCents ?? null,
      renewalDay: body.renewalDay ?? null,
    };
  }

  /** A recorded reading as the domain takes it: the weekly reset as an instant. */
  toManualUsage(body: RecordUsageInput): ManualUsage {
    return {
      sessionUtilization: body.sessionUtilization,
      weeklyUtilization: body.weeklyUtilization,
      weeklyResetsAt: body.weeklyResetsAt ? new Date(body.weeklyResetsAt) : null,
    };
  }

  /**
   * A reading the desktop's unofficial reader sent, as stored: its source
   * pinned to `unofficial` and stamped when it arrived, so a desktop clock
   * that is off cannot file it in the future.
   */
  toUnofficialSnapshot(snapshot: UsageSnapshot, at: Date): UsageSnapshot {
    return { ...snapshot, source: 'unofficial', capturedAt: at.toISOString() };
  }

  /** The tier a vendor named in a reading, as a sighting that changes nothing else. */
  toReadingSighting(reportedPlan: string, at: Date): Sighting {
    return {
      email: null,
      organization: null,
      reportedPlan,
      location: null,
      reportedRenewal: null,
      at,
    };
  }

  toSnapshotRecord(accountId: string, snapshot: UsageSnapshot): Partial<UsageSnapshotOrmEntity> {
    return {
      accountId,
      capturedAt: new Date(snapshot.capturedAt),
      source: snapshot.source,
      status: snapshot.status,
      message: snapshot.message,
      windows: snapshot.windows,
      extraUsage: snapshot.extraUsage,
    };
  }

  toSnapshot(record: UsageSnapshotOrmEntity): UsageSnapshot {
    return {
      capturedAt: record.capturedAt.toISOString(),
      source: record.source,
      status: record.status,
      message: record.message,
      windows: record.windows as LimitWindow[],
      extraUsage: record.extraUsage,
    };
  }

  toDailyRecord(accountId: string, device: string, row: DailyTokens): TokenUsageDailyOrmEntity {
    const record = new TokenUsageDailyOrmEntity();
    record.accountId = accountId;
    record.device = device;
    record.day = row.day;
    record.model = row.model;
    record.input = String(row.input);
    record.output = String(row.output);
    record.cacheWrite = String(row.cacheWrite);
    record.cacheRead = String(row.cacheRead);
    record.messages = row.messages;
    return record;
  }

  toAccountDailyTokens(row: Record<string, unknown>): AccountDailyTokens {
    return {
      accountId: String(row.accountId),
      day: String(row.day),
      model: String(row.model),
      input: Number(row.input ?? 0),
      output: Number(row.output ?? 0),
      cacheWrite: Number(row.cacheWrite ?? 0),
      cacheRead: Number(row.cacheRead ?? 0),
      messages: Number(row.messages ?? 0),
    };
  }

  toUsageSummary(rows: AccountDailyTokens[], days: number, since: string): UsageSummaryResponseDto {
    const totals = emptyTotals();
    const byModel = new Map<string, Totals>();
    const byAccount = new Map<string, Totals>();
    const daily = new Map<string, Totals>();
    for (const row of rows) {
      addInto(totals, row);
      for (const [map, key] of [
        [byModel, row.model],
        [byAccount, row.accountId],
        [daily, row.day],
      ] as const) {
        const bucket = map.get(key) ?? emptyTotals();
        addInto(bucket, row);
        map.set(key, bucket);
      }
    }
    const byCost = (a: Totals, b: Totals) => b.apiCostCents - a.apiCostCents;
    return {
      days,
      since,
      totals: rounded(totals),
      byModel: [...byModel]
        .map(([model, t]) => rounded({ ...t, model, label: priceFor(model)?.label ?? null }))
        .sort(byCost),
      byAccount: [...byAccount].map(([accountId, t]) => rounded({ ...t, accountId })).sort(byCost),
      daily: [...daily]
        .map(([day, t]) => rounded({ ...t, day }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      rows: rows.map((row) => {
        const priced = emptyTotals();
        addInto(priced, row);
        return rounded({ ...priced, accountId: row.accountId, day: row.day, model: row.model });
      }),
    };
  }
}
