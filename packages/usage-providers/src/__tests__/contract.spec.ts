import { limitWindowSchema } from '@flama/shared/schemas/accounts';
import { describe, expect, it } from 'vitest';
import { parseClaudeStatusline, parseClaudeUsage } from '../claude-code/usage-api';
import { reportedRenewal } from '../codex';
import { parseCodexUsage } from '../codex/usage-api';
import { fitWindow, isoOrNull, snapshot, toIso } from '../lib/util';
import { parseZaiQuota } from '../zai/quota';
import { NOW } from './helpers';

/**
 * The cases the battle suite found, pinned. Each was a value a vendor could
 * send that reached the API as a window its schema refuses, which fails the
 * sync for every account on the machine, not only the one it came from.
 */
describe('a reading always fits the sync contract', () => {
  it('names a window whose key the vendor left empty', () => {
    const { windows } = parseClaudeUsage({ '': { utilization: 5 }, '   ': { utilization: 6 } });
    const built = snapshot(NOW, 'ok', null, windows).windows;
    expect(built.map((w) => [w.key, w.label])).toEqual([
      ['limit', 'limit'],
      ['limit', 'limit'],
    ]);
    const live = parseClaudeStatusline({ rate_limits: { '': { utilization: 5 } } });
    expect(live?.[0]).toMatchObject({ key: 'limit', label: 'limit' });
  });

  it('drops a reset no calendar holds, and keeps the usage beside it', () => {
    expect(toIso('+275760-09-13T00:00:00.000Z')).toBeNull();
    expect(toIso(-1)).toBeNull();
    expect(toIso(8.64e15)).toBeNull();
    expect(isoOrNull(new Date(Number.NaN))).toBeNull();
    expect(toIso('2026-11-05T00:00:00Z')).toBe('2026-11-05T00:00:00.000Z');
    // A relative reset used to throw a RangeError out of the parser.
    const far = parseCodexUsage(
      { rate_limit: { primary_window: { used_percent: 40, reset_after_seconds: 1e21 } } },
      NOW,
    );
    expect(far.windows[0]).toMatchObject({ utilization: 40, resetsAt: null });
    const past = parseCodexUsage(
      { rate_limit: { primary_window: { used_percent: 40, reset_after_seconds: -6.4e10 } } },
      NOW,
    );
    expect(past.windows[0]?.resetsAt).toBeNull();
  });

  it('drops a window length that is not a length', () => {
    const base = { key: 'k', kind: 'other', label: 'K', utilization: 1, resetsAt: null } as const;
    expect(fitWindow({ ...base, windowMinutes: 1e308 }).windowMinutes).toBeNull();
    expect(fitWindow({ ...base, windowMinutes: 0 }).windowMinutes).toBeNull();
    expect(fitWindow({ ...base, windowMinutes: -5 }).windowMinutes).toBeNull();
    expect(fitWindow({ ...base, windowMinutes: 299.6 }).windowMinutes).toBe(300);
    expect(fitWindow({ ...base, windowMinutes: 10_080 }).windowMinutes).toBe(10_080);
    const zai = parseZaiQuota(
      {
        success: true,
        data: { limits: [{ type: 'TOKENS_LIMIT', unit: 1, number: 1.4e14, percentage: 3 }] },
      },
      NOW,
    );
    for (const window of snapshot(NOW, 'ok', null, zai?.windows ?? []).windows) {
      expect(limitWindowSchema.parse(window)).toEqual(window);
    }
  });

  it('reports no billing day from a paid period that ends in no real year', () => {
    const auth = {
      mode: 'chatgpt',
      accessToken: null,
      accountId: null,
      email: null,
      planType: null,
      organization: null,
    } as const;
    expect(
      reportedRenewal({
        ...auth,
        subscriptionActiveUntil: new Date(8.64e15),
        subscriptionLastChecked: null,
      }),
    ).toBeNull();
    expect(
      reportedRenewal({
        ...auth,
        subscriptionActiveUntil: new Date('2026-11-20T10:00:00'),
        subscriptionLastChecked: new Date(8.64e15),
      }),
    ).toEqual({ day: 20, checkedAt: null });
  });
});
