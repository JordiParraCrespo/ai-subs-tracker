import { useProfile } from '@flama/frontend-core/react';

/**
 * The signed-in person's name, for the accounts nobody else was named on: the
 * plain fields, since a persisted query loses the entity's getters; the email
 * when there is no name, and an empty string while it loads.
 */
export function useOwnerName(): string {
  const { data: user } = useProfile();
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
}
