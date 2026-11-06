import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who uses an account. An account is a login a provider knows by an email,
 * and one person often holds several (a personal and a work email, a Claude
 * and a Codex login), so grouping the People page by email counted logins,
 * not people. The owner names the person in their own words; NULL is the
 * owner themself, which is every existing row, so nothing is backfilled.
 *
 * A name, not a reference: the people sharing one owner's subscriptions are
 * not users of this app, and a table of them would hold nothing but the name.
 * No index: the column is read with the owner's handful of accounts and never
 * filtered on. A nullable column add with a CHECK every existing row (NULL)
 * passes: no rewrite and only a brief lock.
 */
export class AddAccountPerson1790000000000 implements MigrationInterface {
  name = 'AddAccountPerson1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        ADD COLUMN "person" varchar(80),
        ADD CONSTRAINT "CHK_provider_account_person"
          CHECK ("person" IS NULL OR char_length("person") > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "provider_account"
        DROP CONSTRAINT "CHK_provider_account_person",
        DROP COLUMN "person"
    `);
  }
}
