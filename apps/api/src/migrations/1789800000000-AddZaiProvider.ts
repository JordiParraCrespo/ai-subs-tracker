import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets `provider_account` hold Z.AI Coding Plan subscriptions (`zai`), which a
 * person adds by hand rather than the desktop collector syncing them. The
 * provider CHECK is swapped for one that admits the new id, in one statement.
 * Re-adding a CHECK scans the table under its lock, which is fine here:
 * `provider_account` holds a handful of rows per person (the high-volume
 * table is `usage_snapshot`, untouched). No column changes: a hand-added account is a row like any other, its
 * `externalId` a `manual:<uuid>` no login can ever report.
 */
export class AddZaiProvider1789800000000 implements MigrationInterface {
  name = 'AddZaiProvider1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex', 'zai'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Z.AI accounts cannot satisfy the narrower check; they go with it.
    await queryRunner.query(`DELETE FROM "provider_account" WHERE "provider" = 'zai'`);
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex'))
    `);
  }
}
