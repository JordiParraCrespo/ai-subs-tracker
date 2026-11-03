import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a person calls their set of subscriptions, shown above their name in
 * the sidebar. A nullable column add on `user_settings`: no default, no
 * rewrite, a brief lock, and every existing row reads as "no name yet".
 */
export class AddWorkspaceName1789700000000 implements MigrationInterface {
  name = 'AddWorkspaceName1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        ADD COLUMN "workspaceName" character varying(80),
        ADD CONSTRAINT "CHK_user_settings_workspace_name"
          CHECK ("workspaceName" IS NULL OR length(btrim("workspaceName")) > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        DROP CONSTRAINT "CHK_user_settings_workspace_name",
        DROP COLUMN "workspaceName"
    `);
  }
}
