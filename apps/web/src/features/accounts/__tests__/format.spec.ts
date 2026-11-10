import { describe, expect, it } from 'vitest';
import { isWeeklyOnly } from '../lib/format';

describe('isWeeklyOnly', () => {
  it('is a reading with a week and no 5-hour session', () => {
    expect(isWeeklyOnly({ weeklyUsed: 30, sessionUsed: null })).toBe(true);
    expect(isWeeklyOnly({ weeklyUsed: 0, sessionUsed: null })).toBe(true);
    expect(isWeeklyOnly({ weeklyUsed: 30, sessionUsed: 12 })).toBe(false);
  });

  it('is not an account nothing is known of: a lapsed login has no plan shape to report', () => {
    expect(isWeeklyOnly({ weeklyUsed: null, sessionUsed: null })).toBe(false);
  });
});
