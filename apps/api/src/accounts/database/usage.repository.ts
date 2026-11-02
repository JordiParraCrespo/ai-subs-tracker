import type { DailyTokens, UsageSnapshot } from '@flama/shared/schemas/accounts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { AccountMapper } from '../account.mapper';
import { TokenUsageDailyOrmEntity } from './token-usage-daily.orm-entity';
import type { AccountDailyTokens, UsageRepositoryPort, WeeklyPeak } from './usage.repository.port';
import { UsageSnapshotOrmEntity } from './usage-snapshot.orm-entity';

/** TypeORM adapter for account telemetry. */
@Injectable()
export class UsageRepository implements UsageRepositoryPort {
  constructor(
    @InjectRepository(UsageSnapshotOrmEntity)
    private readonly snapshots: Repository<UsageSnapshotOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: AccountMapper,
  ) {}

  async recordSnapshot(
    accountId: string,
    snapshot: UsageSnapshot,
    retentionDays: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(UsageSnapshotOrmEntity)
        .insert(this.mapper.toSnapshotRecord(accountId, snapshot));
      await manager.query(
        `DELETE FROM "usage_snapshot"
          WHERE "accountId" = $1 AND "capturedAt" < now() - make_interval(days => $2)`,
        [accountId, retentionDays],
      );
    });
  }

  async replaceDailyTokens(accountId: string, device: string, rows: DailyTokens[]): Promise<void> {
    if (rows.length === 0) return;
    const records = rows.map((row) => this.mapper.toDailyRecord(accountId, device, row));
    await this.dataSource
      .getRepository(TokenUsageDailyOrmEntity)
      .upsert(records, ['accountId', 'device', 'day', 'model']);
  }

  async latestSnapshots(accountIds: string[]): Promise<Map<string, UsageSnapshot>> {
    const latest = new Map<string, UsageSnapshot>();
    if (accountIds.length === 0) return latest;
    const records = await this.snapshots
      .createQueryBuilder('s')
      .distinctOn(['s.accountId'])
      .where({ accountId: In(accountIds) })
      .orderBy('s.accountId')
      .addOrderBy('s.capturedAt', 'DESC')
      .getMany();
    for (const record of records) latest.set(record.accountId, this.mapper.toSnapshot(record));
    return latest;
  }

  async weeklyPeaks(
    accountIds: string[],
    since: Date,
    now: Date,
  ): Promise<Map<string, WeeklyPeak[]>> {
    const peaks = new Map<string, WeeklyPeak[]>();
    if (accountIds.length === 0) return peaks;
    // Every reading names the reset of the week it belongs to, so a week is
    // the readings that share one `resetsAt`; its peak is what got used.
    const rows: { accountId: string; resetsAt: Date; peak: number }[] = await this.dataSource.query(
      `SELECT s."accountId", (w->>'resetsAt')::timestamptz AS "resetsAt",
              max((w->>'utilization')::numeric)::float8 AS "peak"
         FROM "usage_snapshot" s
         CROSS JOIN LATERAL jsonb_array_elements(s."windows") AS w
        WHERE s."accountId" = ANY($1::uuid[])
          AND w->>'kind' = 'weekly'
          AND w->>'utilization' IS NOT NULL
          AND w->>'resetsAt' IS NOT NULL
          AND (w->>'resetsAt')::timestamptz BETWEEN $2 AND $3
        GROUP BY 1, 2
        ORDER BY 1, 2`,
      [accountIds, since, now],
    );
    for (const row of rows) {
      const list = peaks.get(row.accountId) ?? [];
      list.push({ resetsAt: new Date(row.resetsAt), peakUtilization: Number(row.peak) });
      peaks.set(row.accountId, list);
    }
    return peaks;
  }

  async dailyTokens(accountIds: string[], sinceDay: string): Promise<AccountDailyTokens[]> {
    if (accountIds.length === 0) return [];
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT "accountId", to_char("day", 'YYYY-MM-DD') AS "day", "model",
              sum("input")::float8 AS "input", sum("output")::float8 AS "output",
              sum("cacheWrite")::float8 AS "cacheWrite", sum("cacheRead")::float8 AS "cacheRead",
              sum("messages")::int AS "messages"
         FROM "token_usage_daily"
        WHERE "accountId" = ANY($1::uuid[]) AND "day" >= $2::date
        GROUP BY 1, 2, 3
        ORDER BY 2, 1, 3`,
      [accountIds, sinceDay],
    );
    return rows.map((row) => this.mapper.toAccountDailyTokens(row));
  }
}
