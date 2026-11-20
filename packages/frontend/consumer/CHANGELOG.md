# @flama/frontend-consumer

## 1.0.0

### Major Changes

- 4ea785b: Personal API tokens leave the starter; the API keeps the scope machinery behind a `SCOPED_CREDENTIAL` port, and `@flama/shared` derives its flag exports from whatever catalog it declares, now none.
- 4ea785b: Organizations are an optional starter feature (`organizations`).

  - `@flama/frontend-consumer`: the organization hooks and `organizationsKeys`
    move from `@flama/frontend-consumer/react` to
    `@flama/frontend-consumer/organizations`.
  - `@flama/auth`: adds `organizationClientPlugin()`.

### Minor Changes

- 4ea785b: Bring every user-facing error into the RFC 7807 catalog.

  The organization and admin façades threw bare `HttpException`s carrying Better
  Auth's `{ message, code }` body, expecting the code to survive. It did not:
  `AllExceptionsFilter` reads a `code` from `AppError` alone, so ~46 call sites
  answered with a codeless problem document whose `title` was only the status
  phrase ("Conflict"). The auth guards had the same gap.

  - **`@flama/backend-core`** — new `ApiAuthProblemResponses()` documents the
    401/403 every guarded route can produce, applied once per controller class.
    A test now pins the deliberate rule that a bare `HttpException` carries no
    `code`.
  - **`apps/api`** — new `AuthErrors` (`AUTH_001`/`AUTH_002`), `OrganizationErrors`
    (`ORG_001`–`ORG_016`) and `AdminErrors` (`ADMIN_001`–`ADMIN_008`) catalogs.
    `betterAuthInvoker` folds Better Auth's ~85 upstream codes onto them, keeping
    the original as an `upstreamCode` extension member. Guards throw catalog
    errors instead of Nest's codeless ones; `PoliciesGuard` now reports a missing
    principal as 401 rather than 403.
  - **`@flama/translations`** — new `errors` namespace with a message per code in
    both locales, so clients stop rendering the server's English `detail`.
  - **`@flama/frontend-core`** — new `createErrorMessageResolver` translating a
    failure from its problem `code`.
  - **`@flama/frontend-consumer`** — the organizations repository no longer
    swallows a failed read into an empty list.
  - **`@flama/api-client`** — regenerated; the documented failures now reach the
    OpenAPI document.

- 0fbe635: Put Codex plans on the Renewals calendar without asking. The Codex reader takes the end of the paid period from the `id_token` in `auth.json` (`chatgpt_subscription_active_until`, an undocumented claim, read locally with no new request) and syncs only its day of the month, in the machine's local time, with when ChatGPT last checked the subscription (`reportedRenewal` on `POST /v1/accounts/sync`, optional so older collectors still sync). The token is reissued only when Codex refreshes its login, so the date itself can be a period or more behind; the day a plan bills does not move. The API keeps it beside the person's own day (`reportedRenewalDay`, `renewalCheckedAt`): `renewalDay` is the person's, else the reported one, and `renewalDayOverridden` says which. The edit form leaves the field empty for a reported day and shows it as the placeholder, so clearing an override falls back to the login, and Next 30 days says where a reported day came from. Claude Code reports no billing day and keeps "Set day".
- 4ea785b: Hold the frontend to its architecture, and move what both platforms need into
  the kernel.

  `@flama/frontend-core` gains `./format` (the `Intl` date helpers, moved from
  the web kit), `useLocale`, `useAbilityState`/`useAbility` (moved from the web
  kit's shell), `useRespondToConsent` with an optional
  `IAuthClient.respondToConsent`, `HookMutationOptions`, `personInitials` and
  `UserEntity.initials`. `usersKeys.list()` appends its params only when a facet
  is set. The web kit re-exports what moved, so `@flama/frontend-web` callers
  keep their imports.

  `@flama/frontend-consumer` gains `slugify`, `toCreateOrganizationDto` and
  `useAcceptInvitationAsNewcomer`; its mutation hooks type `options` as
  `HookMutationOptions`, so a caller can no longer pass a `mutationFn`.

  `@flama/frontend-web` gains `SectionNav` and `PasswordChecklist`; `i18n`
  becomes a middle concern. `@flama/frontend-mobile` gains `SignOutButton`,
  `ScreenErrorFallback` takes an optional title, message and retrying state, and
  `newPasswordSchema` moves to `@flama/shared/schemas/auth` (removed from the
  mobile kit's exports); `config` becomes a middle concern.

- ef55a1e: Read a GLM Coding Plan's usage automatically, opt-in, and track BigModel plans. `bigmodel` joins `zai` as a manual provider, with its Lite, Pro and Max plans (no published price: the account carries the one paid, in US dollars). In the desktop app, a Z.AI or BigModel account can turn on an unofficial usage reader: the person's Coding Plan key, encrypted with `safeStorage`, reads `/api/monitor/usage/quota/limit` on the vendor's own site (undocumented; the endpoint the vendor's usage plugin calls) and the desktop sends the 5-hour, weekly and monthly MCP windows to the new `POST /v1/accounts/:id/readings`, never the key. Readings carry the source `unofficial`, the screens say so, and they lapse like hand-typed ones; recording by hand stays the fallback.
- 4ea785b: `organizationsKeys` has one function per level. Members: `members()` (`MEMBER_LISTS_KEY`, unchanged) → `memberLists()` → `memberList(orgId, filters)`, which replaces `members(orgId, filters)` and `membersAll()`; the key is `['organizations', 'members', 'list', orgId, { search?, roleIds? }]`. Invitations: `invitations()` → `invitationLists()` → `invitationList(orgId)`, which replaces `invitations(orgId)` (was `['organizations', orgId, 'invitations']`), plus `myInvitations()` under `invitations()`. `useOrganizationMembers` and `useOrganizationInvitations` take `undefined` for an organization that isn't known yet and fetch with `skipToken`. `useRegister` also invalidates `profileKeys.me()`. Mutation hooks go through `withCacheOnSuccess`, so a caller's `onSuccess` no longer replaces their cache update.
- e33f950: Subtrack's first version: the `accounts` API (sync, list, edit, activate, archive, usage by model and day), the Claude Code and Codex readers in `@flama/usage-providers`, the Overview, Accounts, Tokenmaxx and Usage screens on the ported dashboard design system, and the Electron desktop app that collects local logins and syncs them.
- 4ea785b: Two-factor authentication: Better Auth's `twoFactor` plugin (an authenticator app plus single-use backup codes), optional per user. The `AddTwoFactor` migration adds `user."twoFactorEnabled"` and the `twoFactor` table, and the profile reports the enrolment and whether the account has a password sign-in (`hasPassword`, computed from Better Auth's `account` table); an account made through a social provider is not offered two-factor, which only guards password sign-in. A password sign-in on an account with it on rejects with `TwoFactorRequiredError`, which the web and mobile login screens answer with a code step (`TwoFactorChallengeForm` in each kit, `useVerifyTwoFactor`). The web profile sets it up behind the switch that was read-only, with a QR code, and turns it off or replaces the backup codes. `IAuthClient` gains `verifyTwoFactor`, `enableTwoFactor`, `confirmTwoFactor`, `disableTwoFactor` and `generateBackupCodes`, so every app's client implements them. `TWO_FACTOR_ISSUER` names the account in authenticator apps.
- 4ea785b: Describe scope and permission-catalog responses properly in OpenAPI, so the
  generated client carries their real types.

  Several response DTOs described themselves loosely enough that the generated
  client lost the type and every consumer had to cast it back:

  - Scope arrays (`ApiTokenResponseDto.scopes`, `PermissionCatalogResponseDto.grantable`,
    `CurrentCredentialResponseDto.grantedScopes` / `effectiveScopes`) were declared
    `type: [String]` and generated as `string[]`. They now declare `enum: SCOPES`,
    so the client sees the same 20-member union the request DTO already used.
  - `PermissionCatalogResponseDto.groups` was an untyped object array and generated
    as `Record<string, any>[]`. The catalog now has real DTOs — `PermissionGroupDto`,
    `ScopeLevelsDto`, `ScopeLevelDto`, `ScopePolicyDto` — mirroring `PermissionGroup`
    from `@flama/shared`, so drift between the two becomes a compile error.
  - `GET /v1/users` declared no response schema at all and generated as `any`, taking
    the whole paginated list with it. It now returns `PaginatedUsersResponseDto`
    (with `PaginationMetaDto`).

  The wire format is unchanged — only its description. `@flama/frontend-consumer`'s
  api-tokens repository drops the casts this forced (including a `dto as never`
  that was disabling type checking on the create-token request body) and reads
  the generated DTOs directly. In `@flama/frontend-core`,
  `UsersRepository.findAll` / `UsersService.findAll` widen their `role` filter
  from `'admin' | 'user'` to `Role`, matching the database-backed roles the API
  actually accepts.

  The root `generate:openapi` script ran `nest build` from the repo root, where
  there is no Nest workspace, so `pnpm generate:api-client` always failed; it now
  delegates to `@flama/api`.

- deed06d: Track a Z.AI Coding Plan by hand. `zai` joins the providers as the first manual one: its Lite, Pro and Max plans (credits per window from Z.AI's docs; only Lite's $18 price is published, so Pro and Max take the price paid), `POST /v1/accounts` to add one and `POST /v1/accounts/:id/usage` to record its 5-hour and weekly usage. The desktop collector, sync and terminal switching stay Claude Code and Codex only. A `Select` inside a dialog now opens above it.

### Patch Changes

- 4ea785b: Every dependency moves to its latest release, majors included: Expo SDK 58
  (React Native 0.88, React 19.3), NestJS 12, TypeORM 1, Zod 4, bullmq 6,
  ioredis 6, CASL 7, nestjs-zod 5, nestjs-pino 5, react-native-gesture-handler 3,
  better-auth 1.7. Versions on the mobile side are the ones SDK 58 lists, so
  `expo install --check` is clean.

  What a consumer has to move with:

  - **Zod 4.** The schemas in `@flama/shared` are Zod 4 schemas, and
    `createZodErrorMap` returns a Zod 4 error map (`core.$ZodErrorMap`), passed
    as `error`, not `errorMap`. The kits' `zod` peer is `^4`.
  - **NestJS 12** in every backend package, and `typeorm` `^1` as
    `@flama/backend-authz`'s peer.
  - **nestjs-zod 5** has no `patchNestJsSwagger`: the API runs the document
    through `cleanupOpenApiDoc` instead. The document now carries each schema's
    bounds and defaults, and Zod 4's `uuid()` is the RFC check, so a lookalike id
    such as `11111111-1111-1111-1111-111111111111` no longer passes.
  - **CommonJS packages resolve `node16`.** CASL 7 publishes its types only
    through `exports`, which the deprecated `node` resolution never read.
  - **React Native 0.88** types its strict API by default; the mobile tsconfigs
    select the legacy types with `react-native-legacy-deep-imports`, which
    NativeWind's `className` augmentation still targets.

  `@flama/shared` gains a `flama-source` export condition pointing at its
  TypeScript source. `apps/web` resolves it, because a CommonJS `require('zod')`
  pulls in all of Zod 4, every locale included, beside the copy the frontend
  packages import as ESM: 94KB gzipped on first load.

- 4ea785b: Every query hook that returns entities goes through the new `useEntityQuery` in `@flama/frontend-core/react`, which fixes `structuralSharing` to `shareEntities` so a refetch that changed nothing keeps each unchanged entity's identity.
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [69128f7]
- Updated dependencies [0fbe635]
- Updated dependencies [4ea785b]
- Updated dependencies [47d4885]
- Updated dependencies [67d26cb]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [ef55a1e]
- Updated dependencies [5028983]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [773192b]
- Updated dependencies [e0c087f]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [e33f950]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [4ea785b]
- Updated dependencies [deed06d]
  - @flama/api-client@1.0.0
  - @flama/shared@1.0.0
  - @flama/frontend-core@1.0.0
