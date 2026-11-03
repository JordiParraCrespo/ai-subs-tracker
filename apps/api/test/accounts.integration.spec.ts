import { randomUUID } from 'node:crypto';
import { OutboxService } from '@flama/backend-ddd';
import type { UsageSnapshot } from '@flama/shared/schemas/accounts';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { AccountMapper } from '../src/accounts/account.mapper';
import { AccountOrmEntity } from '../src/accounts/database/account.orm-entity';
import { AccountRepository } from '../src/accounts/database/account.repository';
import { TokenUsageDailyOrmEntity } from '../src/accounts/database/token-usage-daily.orm-entity';
import { UsageRepository } from '../src/accounts/database/usage.repository';
import { UsageSnapshotOrmEntity } from '../src/accounts/database/usage-snapshot.orm-entity';
import { AccountEntity } from '../src/accounts/domain/account.entity';
import { loadMigrations } from './run-migrations';

/**
 * The accounts adapters against a real Postgres built by the migration chain:
 * one login per (user, provider, externalId), one active account per provider,
 * snapshot retention, the latest reading per account, weekly peaks read out of
 * the jsonb windows, and token totals replaced per device and summed across
 * devices. The handlers' decisions are their own unit specs.
 */
describe('the accounts repositories (integration)', () => {
  let pgContainer: StartedTestContainer;
  let dataSource: DataSource;
  let accounts: AccountRepository;
  let usage: UsageRepository;
  const mapper = new AccountMapper();

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:18-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    dataSource = new DataSource({
      type: 'postgres',
      url: `postgres://test:test@${pgContainer.getHost()}:${pgContainer.getMappedPort(5432)}/test`,
      entities: [AccountOrmEntity, UsageSnapshotOrmEntity, TokenUsageDailyOrmEntity],
      migrations: await loadMigrations(),
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    accounts = new AccountRepository(
      dataSource.getRepository(AccountOrmEntity),
      dataSource,
      mapper,
      new OutboxService(dataSource),
    );
    usage = new UsageRepository(
      dataSource.getRepository(UsageSnapshotOrmEntity),
      dataSource,
      mapper,
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pgContainer?.stop();
  });

  async function newUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES ($1, 'T', $2, 'T', 'U')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  const register = (
    userId: string,
    externalId: string,
    provider: 'claude-code' | 'codex' = 'claude-code',
  ) =>
    AccountEntity.register(randomUUID(), {
      userId,
      provider,
      externalId,
      email: null,
      organization: null,
      reportedPlan: 'max',
      location: null,
      at: new Date(),
    });

  const snapshot = (capturedAt: Date, weekly: number, resetsAt: Date): UsageSnapshot => ({
    capturedAt: capturedAt.toISOString(),
    source: 'poll',
    status: 'ok',
    message: null,
    windows: [
      {
        key: 'seven_day',
        kind: 'weekly',
        label: 'Weekly',
        utilization: weekly,
        resetsAt: resetsAt.toISOString(),
        windowMinutes: 10080,
      },
    ],
    extraUsage: null,
  });

  it('refuses a second row for the same login of the same person', async () => {
    const userId = await newUser();
    await accounts.insert(register(userId, 'login-1'));
    await expect(accounts.insert(register(userId, 'login-1'))).rejects.toThrow();
    // Someone else may have the same login id: the uniqueness is per person.
    await expect(accounts.insert(register(await newUser(), 'login-1'))).resolves.toBeUndefined();
  });

  it('keeps one active account per provider, switching in one write', async () => {
    const userId = await newUser();
    const first = register(userId, 'a');
    const second = register(userId, 'b');
    const codex = register(userId, 'c', 'codex');
    await accounts.insert([first, second, codex]);

    first.activate(new Date());
    codex.activate(new Date());
    await accounts.saveAll([first, codex]);
    // Activating `second` without switching `first` off breaks the partial unique index…
    second.activate(new Date());
    await expect(accounts.save(second)).rejects.toThrow();
    // …and the switch the handler makes, in one transaction, holds.
    first.deactivate();
    await accounts.saveAll([second, first]);

    const active = (await accounts.findForUser(userId))
      .filter((a) => a.isActive)
      .map((a) => a.externalId);
    expect(active.sort()).toEqual(['b', 'c']);
  });

  it('answers the latest reading per account and drops readings past the retention', async () => {
    const userId = await newUser();
    const account = register(userId, 'reader');
    await accounts.insert(account);
    const reset = new Date(Date.now() + 86_400_000);
    await usage.recordSnapshot(
      account.id,
      snapshot(new Date(Date.now() - 200 * 86_400_000), 10, reset),
      90,
    );
    await usage.recordSnapshot(account.id, snapshot(new Date(Date.now() - 60_000), 40, reset), 90);
    await usage.recordSnapshot(account.id, snapshot(new Date(), 55, reset), 90);

    const latest = await usage.latestSnapshots([account.id]);
    expect(latest.get(account.id)?.windows[0].utilization).toBe(55);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM "usage_snapshot" WHERE "accountId" = $1`,
      [account.id],
    );
    expect(count).toBe(2);
  });

  it('reads the peak of each week that has reset, from the jsonb windows', async () => {
    const userId = await newUser();
    const account = register(userId, 'peaks');
    await accounts.insert(account);
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 2 * 86_400_000);
    const thisWeek = new Date(now.getTime() + 5 * 86_400_000);
    await usage.recordSnapshot(
      account.id,
      snapshot(new Date(lastWeek.getTime() - 7_200_000), 70, lastWeek),
      90,
    );
    await usage.recordSnapshot(
      account.id,
      snapshot(new Date(lastWeek.getTime() - 3_600_000), 82, lastWeek),
      90,
    );
    await usage.recordSnapshot(account.id, snapshot(now, 20, thisWeek), 90);

    const peaks = await usage.weeklyPeaks(
      [account.id],
      new Date(now.getTime() - 30 * 86_400_000),
      now,
    );
    // The week still running is not a peak yet.
    expect(peaks.get(account.id)).toEqual([{ resetsAt: lastWeek, peakUtilization: 82 }]);
  });

  it("replaces a device's token totals and sums devices", async () => {
    const userId = await newUser();
    const account = register(userId, 'tokens');
    await accounts.insert(account);
    const day = new Date().toISOString().slice(0, 10);
    const row = (input: number) => ({
      day,
      model: 'claude-opus-5-5',
      input,
      output: 1,
      cacheWrite: 0,
      cacheRead: 0,
      messages: 1,
    });
    await usage.replaceDailyTokens(account.id, 'laptop', [row(100)]);
    await usage.replaceDailyTokens(account.id, 'laptop', [row(150)]);
    await usage.replaceDailyTokens(account.id, 'desktop', [row(50)]);

    const rows = await usage.dailyTokens([account.id], day);
    expect(rows).toEqual([
      expect.objectContaining({ accountId: account.id, day, input: 200, messages: 2 }),
    ]);
  });
});
