import type { ErrorDefinition } from '@flama/frontend-core';

export const AccountsErrors = {
  FETCH_FAILED: {
    code: 'ACCOUNTS_CLIENT_001',
    message: 'Failed to load your accounts',
  },
  UPDATE_FAILED: {
    code: 'ACCOUNTS_CLIENT_002',
    message: 'Failed to save the account',
  },
  ACTIVATE_FAILED: {
    code: 'ACCOUNTS_CLIENT_003',
    message: 'Failed to switch accounts',
  },
  ARCHIVE_FAILED: {
    code: 'ACCOUNTS_CLIENT_004',
    message: 'Failed to remove the account',
  },
  USAGE_FAILED: {
    code: 'ACCOUNTS_CLIENT_005',
    message: 'Failed to load token usage',
  },
  CREATE_FAILED: {
    code: 'ACCOUNTS_CLIENT_006',
    message: 'Failed to add the subscription',
  },
  RECORD_USAGE_FAILED: {
    code: 'ACCOUNTS_CLIENT_007',
    message: 'Failed to record the usage',
  },
} as const satisfies Record<string, ErrorDefinition>;
