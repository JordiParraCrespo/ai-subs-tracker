import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Subtrack's data: the coding-agent accounts a person tracks, readings of
 * their limit windows, and daily token counts.
 *
 * `provider_account` — one login to one provider, owned by one user. Unique
 * on (user, provider, externalId): the desktop collector upserts on it. At
 * most one active account per user and provider, by a partial unique index.
 * Removing an account archives it (`archivedAt`) rather than deleting it, so
 * the next sync from a machine that still has the login does not bring it
 * back; its history goes with it only when the user is deleted.
 *
 * `usage_snapshot` — append-only, the high-volume table here (one row per
 * account per sync, a few hundred a day for a heavy user). `bigint` identity
 * key so inserts stay at the right edge of the index. Read as the latest row
 * per account and as weekly peaks over the last month, both served by
 * ("accountId", "capturedAt" DESC). Retention: 90 days, deleted per account
 * by the sync that writes it. A partitioning candidate past tens of millions.
 *
 * `token_usage_daily` — per account, device, local day and model; the sync
 * replaces a device's totals for the days it sends, so it is idempotent.
 * Read by account and day range, which the primary key serves.
 */
export class AddProviderAccounts1789500000000 implements MigrationInterface {
  name = 'AddProviderAccounts1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "provider_account" (
        "id"                uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"            uuid NOT NULL,
        "provider"          character varying(40) NOT NULL,
        "externalId"        character varying(200) NOT NULL,
        "email"             character varying(320),
        "organization"      character varying(200),
        "reportedPlan"      character varying(80),
        "location"          character varying(300),
        "label"             character varying(80),
        "planId"            character varying(60),
        "monthlyPriceCents" integer,
        "isActive"          boolean NOT NULL DEFAULT false,
        "activatedAt"       timestamptz,
        "lastSyncedAt"      timestamptz,
        "archivedAt"        timestamptz,
        "createdAt"         timestamptz NOT NULL DEFAULT now(),
        "updatedAt"         timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_account" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_provider_account_login" UNIQUE ("userId", "provider", "externalId"),
        CONSTRAINT "CHK_provider_account_provider" CHECK ("provider" IN ('claude-code', 'codex')),
        CONSTRAINT "CHK_provider_account_price" CHECK ("monthlyPriceCents" IS NULL OR "monthlyPriceCents" >= 0),
        CONSTRAINT "FK_provider_account_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_provider_account_active"
        ON "provider_account" ("userId", "provider") WHERE "isActive"
    `);

    await queryRunner.query(`
      CREATE TABLE "usage_snapshot" (
        "id"         bigint GENERATED ALWAYS AS IDENTITY,
        "accountId"  uuid NOT NULL,
        "capturedAt" timestamptz NOT NULL,
        "source"     character varying(10) NOT NULL,
        "status"     character varying(20) NOT NULL,
        "message"    character varying(500),
        "windows"    jsonb NOT NULL DEFAULT '[]',
        "extraUsage" jsonb,
        "createdAt"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usage_snapshot" PRIMARY KEY ("id"),
        CONSTRAINT "FK_usage_snapshot_account"
          FOREIGN KEY ("accountId") REFERENCES "provider_account"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_usage_snapshot_account_captured"
        ON "usage_snapshot" ("accountId", "capturedAt" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "token_usage_daily" (
        "accountId"  uuid NOT NULL,
        "device"     character varying(120) NOT NULL,
        "day"        date NOT NULL,
        "model"      character varying(120) NOT NULL,
        "input"      bigint NOT NULL DEFAULT 0,
        "output"     bigint NOT NULL DEFAULT 0,
        "cacheWrite" bigint NOT NULL DEFAULT 0,
        "cacheRead"  bigint NOT NULL DEFAULT 0,
        "messages"   integer NOT NULL DEFAULT 0,
        "updatedAt"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_usage_daily" PRIMARY KEY ("accountId", "device", "day", "model"),
        CONSTRAINT "FK_token_usage_daily_account"
          FOREIGN KEY ("accountId") REFERENCES "provider_account"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "token_usage_daily"`);
    await queryRunner.query(`DROP TABLE "usage_snapshot"`);
    await queryRunner.query(`DROP TABLE "provider_account"`);
  }
}
