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
  /** Usage is recorded by hand only where no collector reads it. */
  USAGE_READ_AUTOMATICALLY: {
    code: 'ACCOUNT_002',
    message: 'This account’s usage is read from the machine, not recorded by hand',
    httpStatus: 409,
  },
  /** A hand-tracked subscription has no login on the machine for a terminal to use. */
  NOT_SWITCHABLE: {
    code: 'ACCOUNT_003',
    message: 'This account is not used from a terminal',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
