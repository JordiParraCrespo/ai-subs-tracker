import type { UserSessionEntity } from '@flama/frontend-consumer';

/** Where the security dialog is: its overview, or one of the flows it opens. */
export type SecurityStep =
  | { kind: 'overview' }
  | { kind: 'password' }
  | { kind: 'two-factor-on' }
  | { kind: 'two-factor-off' }
  | { kind: 'sign-out'; session: UserSessionEntity }
  | { kind: 'sign-out-others'; count: number };
