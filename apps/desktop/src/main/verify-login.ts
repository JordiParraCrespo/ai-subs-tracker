import { resolve } from 'node:path';
import type { CodingAgentProvider, ProviderEnv } from '@flama/usage-providers';

/**
 * Checks a folder a sign-in just wrote, before "Account added" is said: it
 * must hold a login the provider can use, and not one this machine already
 * has. Two folders of one account would show as one (the list keeps one
 * login per account) and, since the providers rotate refresh tokens, could
 * sign each other out. Null keeps the folder; a message is why not.
 */
export async function checkNewLogin(
  provider: CodingAgentProvider,
  home: string,
  env: ProviderEnv,
): Promise<string | null> {
  if (!provider.identify) return null;
  const mine = await provider.identify(home, env);
  if (!mine.ok) return mine.problem;

  const others = (await provider.detect(env).catch(() => [])).filter(
    (login) => resolve(login.home) !== resolve(home),
  );
  for (const other of others) {
    const theirs = await provider.identify(other.home, env).catch(() => null);
    if (!theirs?.ok || theirs.externalId !== mine.externalId) continue;
    const who = mine.email ?? theirs.email ?? 'this account';
    if (mine.email && theirs.email && mine.email.toLowerCase() !== theirs.email.toLowerCase()) {
      // One ChatGPT workspace, two people: synced under one key today.
      const where = mine.organization ? ` in ${mine.organization}` : '';
      return `That is ${mine.email}, a seat${where} that ResetOwl cannot yet keep apart from ${theirs.email}, already added.`;
    }
    return `That is ${who}, already added.`;
  }
  return null;
}
