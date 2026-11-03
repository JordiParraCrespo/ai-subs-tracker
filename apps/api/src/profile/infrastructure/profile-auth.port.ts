import type { IncomingHttpHeaders } from 'node:http';

/** What `changePassword` needs to know, independent of who verifies it. */
export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}

/**
 * The session a password change leaves the caller in. Revoking the other
 * sessions revokes the caller's too and issues a new one; these are what the
 * caller's client needs to hold it: the `Set-Cookie` values a browser keeps,
 * and the bearer token a client without cookies (the desktop app) sends.
 */
export interface ReplacementSession {
  cookies: string[];
  bearerToken: string | null;
}

/**
 * What the profile use cases need done to the caller's own credentials.
 *
 * The application's vocabulary is "change this person's password" and "revoke
 * their sessions". That an identity provider owns the password hashing, and
 * that a cached delegated session has to be evicted alongside a bulk
 * revocation, are both facts about the adapter — a handler names neither.
 */
export interface ProfileAuthPort {
  /** Change the caller's password, verifying the current one first. */
  changePassword(
    headers: IncomingHttpHeaders,
    input: ChangePasswordInput,
  ): Promise<ReplacementSession>;

  /**
   * Revoke one session by its token. The token is never accepted from a
   * client: the caller names a session by id and the repository resolves it.
   */
  revokeSession(headers: IncomingHttpHeaders, token: string): Promise<void>;

  /** Revoke every session except the one this request was made with. */
  revokeOtherSessions(headers: IncomingHttpHeaders, userId: string): Promise<void>;
}
