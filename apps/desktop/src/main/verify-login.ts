import { resolve } from 'node:path';
import {
  type CodingAgentProvider,
  type DetectedLogin,
  localDay,
  type ProviderEnv,
} from '@flama/usage-providers';
import type { LocalAccount } from './local-logins';

/**
 * Checks a folder a sign-in just wrote, before "Account added" is said. The
 * CLI exiting is not enough: the folder must name an account, and not one
 * already on this machine (often the browser's own, signed in again), which
 * the list would merge away and whose rotating tokens two folders would
 * fight over. Null keeps the folder; a message is why not.
 */
export async function checkNewLogin(
  provider: CodingAgentProvider,
  dir: string,
  known: readonly LocalAccount[],
  env: ProviderEnv,
): Promise<string | null> {
  const externalId = await provider.signedInAs(dir);
  if (!externalId) return `${provider.displayName} finished without signing an account in.`;
  // A collection that ran during the sign-in may have read this very
  // folder already; it is not a duplicate of itself.
  const same = known.find(
    (l) =>
      l.account.provider === provider.id &&
      l.account.externalId === externalId &&
      resolve(l.login.home) !== resolve(dir),
  );
  if (!same) return null;

  // Read from disk only, for the email the message names.
  const mine = await provider
    .read({ provider: provider.id, home: dir, isDefault: false, managed: true }, env, {
      sinceDay: localDay(env.now()),
      fetchLimits: false,
    })
    .catch(() => null);
  const email = mine?.email ?? null;
  const theirs = same.account.email;
  if (email && theirs && email.toLowerCase() !== theirs.toLowerCase()) {
    // Two people in one ChatGPT workspace: one account id today.
    const where = mine?.organization ? ` in ${mine.organization}` : '';
    return `That is ${email}, a seat${where} that ResetOwl cannot yet keep apart from ${theirs}, already added.`;
  }
  return `That is ${email ?? theirs ?? `this ${provider.displayName} account`}, already added.`;
}

/**
 * Checks a login signed in again (`addLogin` with an external id): read the
 * way the collector reads it, from disk only, it must now name the account the
 * person asked to renew. Another account there means the browser was signed
 * in to someone else; the folder holds that one now, and the next collection
 * shows it.
 */
export async function checkRenewedLogin(
  provider: CodingAgentProvider,
  login: DetectedLogin,
  externalId: string,
  env: ProviderEnv,
): Promise<string | null> {
  const account = await provider
    .read(login, env, { sinceDay: localDay(env.now()), fetchLimits: false })
    .catch(() => null);
  // An id made from the folder's path names nobody: nothing is signed in there.
  if (!account || account.externalId.startsWith('home:')) {
    return `${provider.displayName} finished without signing an account in.`;
  }
  if (account.externalId !== externalId) {
    return `${provider.displayName} signed in a different account than the one being renewed. Sign in again with the account this login belongs to.`;
  }
  return null;
}
