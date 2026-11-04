import { describe, expect, it } from 'vitest';
import { manualSnapshot } from '../domain/manual-usage.factory';

const AT = new Date('2026-11-04T10:00:00Z');

describe('manualSnapshot', () => {
  // Z.AI's 5-hour credits come back 5 hours after they were spent, so a
  // reading cannot hold for longer than that.
  it('expires the 5-hour reading 5 hours after it was taken', () => {
    const snapshot = manualSnapshot(
      { sessionUtilization: 80, weeklyUtilization: null, weeklyResetsAt: null },
      AT,
    );
    expect(snapshot.windows).toEqual([
      expect.objectContaining({
        kind: 'session',
        utilization: 80,
        resetsAt: '2026-11-04T15:00:00.000Z',
        windowMinutes: 300,
      }),
    ]);
  });

  it('leaves the weekly reset unknown rather than guessing the order date', () => {
    const snapshot = manualSnapshot(
      { sessionUtilization: null, weeklyUtilization: 20, weeklyResetsAt: null },
      AT,
    );
    expect(snapshot.windows).toEqual([
      expect.objectContaining({ kind: 'weekly', utilization: 20, resetsAt: null }),
    ]);
    expect(snapshot).toMatchObject({ source: 'manual', capturedAt: AT.toISOString() });
  });
});
