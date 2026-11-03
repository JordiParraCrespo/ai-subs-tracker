// flama:begin api-tokens
// flama:end api-tokens
import { accountsKeys } from './accounts.queries';
import { profileKeys } from './profile.queries';

/**
 * Consumer features that never reach the persisted query cache: a profile is
 * not a thing to leave in a browser's storage, and accounts are entities with
 * methods (JSON would rehydrate them as bare objects) that refetch every
 * minute anyway. A consumer app passes this to
 * `createQueryPersistOptions`.
 */
export const CONSUMER_NON_PERSISTED_FEATURES: readonly string[] = [
  // flama:begin api-tokens
  // flama:end api-tokens
  profileKeys.all[0],
  accountsKeys.all[0],
];
