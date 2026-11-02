import type { ErrorDefinition } from '@flama/backend-ddd';

/**
 * Account error catalog, surfaced by the global `AllExceptionsFilter` as
 * problem documents. Someone else's account, and one the owner removed, both
 * read as not found, so ids cannot be probed.
 */
export const AccountErrors = {
  NOT_FOUND: {
    code: 'ACCOUNT_001',
    message: 'Account not found',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
