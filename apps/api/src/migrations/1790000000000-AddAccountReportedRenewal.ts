import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The billing day a provider's login reports (Codex's token carries the end of
 * the paid period), kept beside the one the person sets so theirs always wins
 * and clearing it falls back to the reported one; and when the provider last
 * confirmed the subscription. Both nullable plain column adds with a CHECK
 * every existing row (all NULL) passes: no rewrite, only a brief lock.
 */
export class AddAccountReportedRenewal1790000000000 implements MigrationInterface {
  name = 'AddAccountReportedRenewal1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        ADD COLUMN "reportedRenewalDay" smallint,
        ADD COLUMN "renewalCheckedAt" timestamptz,
        ADD CONSTRAINT "CHK_provider_account_reported_renewal_day"
          CHECK ("reportedRenewalDay" IS NULL OR "reportedRenewalDay" BETWEEN 1 AND 31)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_reported_renewal_day",
        DROP COLUMN "renewalCheckedAt",
        DROP COLUMN "reportedRenewalDay"
    `);
  }
}
