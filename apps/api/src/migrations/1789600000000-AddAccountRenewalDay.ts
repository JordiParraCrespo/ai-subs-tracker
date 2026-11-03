import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The day of the month an account's plan bills, which no provider reports:
 * the person sets it, and the Renewals calendar reads it. Nullable, so a
 * plan without one is simply not on the calendar. A plain column add with a
 * NULL default and a CHECK that every existing row (all NULL) passes, so it
 * takes no rewrite and only a brief lock.
 */
export class AddAccountRenewalDay1789600000000 implements MigrationInterface {
  name = 'AddAccountRenewalDay1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        ADD COLUMN "renewalDay" smallint,
        ADD CONSTRAINT "CHK_provider_account_renewal_day"
          CHECK ("renewalDay" IS NULL OR "renewalDay" BETWEEN 1 AND 31)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_renewal_day",
        DROP COLUMN "renewalDay"
    `);
  }
}
