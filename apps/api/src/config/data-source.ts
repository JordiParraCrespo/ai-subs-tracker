import '@flama/env/load';
import { OutboxMessageSchema } from '@flama/backend-ddd';
import { DataSource } from 'typeorm';
// flama:begin api-tokens
// flama:end api-tokens
import { Account } from '../auth/database/account.orm-entity';
import { Session } from '../auth/database/session.orm-entity';
import { TwoFactor } from '../auth/database/two-factor.orm-entity';
import { Verification } from '../auth/database/verification.orm-entity';
// flama:begin organizations
// flama:end organizations
// flama:begin organizations
// flama:end organizations
import { UserSettingsOrmEntity } from '../profile/database/user-settings.orm-entity';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
// flama:plugins entity-imports

/**
 * Data source used by the TypeORM CLI (`migration:generate` / `migration:run` /
 * `migration:revert`). The runtime app configures TypeORM in `AppModule`.
 *
 * The migrations glob is resolved relative to this file so it works both when
 * run through ts-node (`src/`) and from the compiled output (`dist/`).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'flama',
  password: process.env.DB_PASSWORD || 'flama',
  database: process.env.DB_DATABASE || 'flama',
  entities: [
    UserOrmEntity,
    UserSettingsOrmEntity,
    Session,
    TwoFactor,
    Account,
    Verification,
    // flama:plugins entities
    RoleOrmEntity,
    // flama:begin organizations
    // flama:end organizations
    UserRoleOrmEntity,
    // flama:begin organizations
    // flama:end organizations
    OutboxMessageSchema,
  ],
  migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
});
