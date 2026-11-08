import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets `provider_account` hold Grok Build logins (`grok`): xAI's coding
 * agent, signed in with an X Subscription or SuperGrok account and read by
 * the desktop collector like Claude Code and Codex. The provider CHECK is
 * swapped in one statement, as `AddBigmodelProvider` did; the table holds a
 * handful of rows per person, so the scan under its lock is brief.
 */
export class AddGrokProvider1790200000000 implements MigrationInterface {
  name = 'AddGrokProvider1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex', 'grok', 'zai', 'bigmodel'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Grok accounts cannot satisfy the narrower check; they go with it.
    await queryRunner.query(`DELETE FROM "provider_account" WHERE "provider" = 'grok'`);
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_provider",
        ADD CONSTRAINT "CHK_provider_account_provider"
          CHECK ("provider" IN ('claude-code', 'codex', 'zai', 'bigmodel'))
    `);
  }
}
