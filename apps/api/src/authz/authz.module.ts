import { AuthzModule as AuthzKernelModule } from '@flama/backend-authz';
import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
// flama:begin organizations
// flama:end organizations
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { RoleResource } from '../roles/roles.resource';
import { UserResource } from '../users/users.resource';
// flama:begin organizations
// flama:end organizations
import { FindAuthzCatalogHttpController } from './queries/find-catalog/find-catalog.http.controller';
import { FindAuthzCatalogQueryHandler } from './queries/find-catalog/find-catalog.query-handler';

// Static routes before parameterized ones.
const httpControllers = [
  FindAuthzCatalogHttpController,
  // flama:begin organizations
  // flama:end organizations
];

const queryHandlers: Provider[] = [FindAuthzCatalogQueryHandler];

/**
 * Wires the authorization kernel into the application: every module's resource
 * declarations, and the catalog the role builder and token picker read.
 *
 * With organizations it also owns the access-grant aggregate and the
 * request-scoped infrastructure that reads it (`ScopeResolver`,
 * `AccessScopeInterceptor`) — the grants are the data the resolver reads, so
 * splitting them into a separate module would only buy a circular import.
 *
 * Global for the same reason `RolesModule` is: any feature module's controllers
 * apply `AccessScopeInterceptor`, and importing this everywhere would create
 * cycles with the modules it already depends on.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      RoleOrmEntity,
      // flama:begin organizations
      // flama:end organizations
    ]),
    AuthzKernelModule.forFeature([
      UserResource,
      RoleResource,
      // flama:begin organizations
      // flama:end organizations
    ]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...queryHandlers,
    // flama:begin organizations
    // flama:end organizations
  ],
  exports: [
    TypeOrmModule,
    // flama:begin organizations
    // flama:end organizations
  ],
})
export class AuthzModule {}
