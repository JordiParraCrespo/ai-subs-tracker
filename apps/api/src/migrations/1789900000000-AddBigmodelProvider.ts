import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets `provider_account` hold BigModel GLM Coding Plan subscriptions
 * (`bigmodel`): the same plan Z.AI sells, sold in mainland China by Zhipu on
 * its own site, with its own keys. Added by hand like Z.AI's. The provider
 * CHECK is swapped in one statement, as `AddZaiProvider` did; the table holds
 * a handful of rows per person, so the scan under its lock is brief.
 *
 * No column changes for the unofficial readings either: their source,
 * `unofficial`, fits `usage_snapshot.source` (`varchar(10)`), which has no
 * CHECK.
 */
export class AddBigmodelProvider1789900000000 implements MigrationInterface {
  name = 'AddBigmodelProvider1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex', 'zai', 'bigmodel'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // BigModel accounts cannot satisfy the narrower check; they go with it.
    await queryRunner.query(`DELETE FROM "provider_account" WHERE "provider" = 'bigmodel'`);
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex', 'zai'))
    `);
  }
}
