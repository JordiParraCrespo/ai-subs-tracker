import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../playwright.config';

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Reports two logins the way the desktop collector does: a Claude Code Ultra
 * account well behind pace, and a Codex Plus account whose week resets in a
 * few hours with most of it left — the one Tokenmaxx should pick.
 */
export async function syncTwoAccounts(api: APIRequestContext) {
  return api.post(`${API_URL}/api/v1/accounts/sync`, {
    data: {
      device: { name: 'e2e-laptop', platform: 'linux' },
      accounts: [
        {
          provider: 'claude-code',
          externalId: 'e2e-claude',
          email: 'work@example.com',
          organization: null,
          reportedPlan: 'default_claude_max_20x',
          location: '~/.claude',
          snapshot: {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status: 'ok',
            message: null,
            windows: [
              {
                key: 'seven_day',
                kind: 'weekly',
                label: 'Weekly',
                utilization: 30,
                resetsAt: hoursFromNow(80),
                windowMinutes: 10080,
              },
            ],
            extraUsage: null,
          },
          dailyTokens: [
            {
              day: today(),
              model: 'claude-opus-5-5',
              input: 100_000,
              output: 50_000,
              cacheWrite: 0,
              cacheRead: 1_000_000,
              messages: 40,
            },
          ],
        },
        {
          provider: 'codex',
          externalId: 'e2e-codex',
          email: 'home@example.com',
          organization: null,
          reportedPlan: 'plus',
          location: '~/.codex',
          snapshot: {
            capturedAt: new Date().toISOString(),
            source: 'poll',
            status: 'ok',
            message: null,
            windows: [
              {
                key: 'secondary',
                kind: 'weekly',
                label: 'Weekly',
                utilization: 20,
                resetsAt: hoursFromNow(6),
                windowMinutes: 10080,
              },
            ],
            extraUsage: null,
          },
          dailyTokens: [],
        },
      ],
    },
  });
}
