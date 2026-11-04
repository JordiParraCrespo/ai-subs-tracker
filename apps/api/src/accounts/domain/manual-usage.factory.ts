import type { LimitWindow, UsageSnapshot } from '@flama/shared/schemas/accounts';

/** What the person read off the vendor's usage page. */
export interface ManualUsage {
  /** Percent of the 5-hour allowance used, or null to leave it out. */
  sessionUtilization: number | null;
  /** Percent of the weekly allowance used, or null to leave it out. */
  weeklyUtilization: number | null;
  /** When the vendor says the weekly allowance resets, if the person gave it. */
  weeklyResetsAt: Date | null;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/**
 * A reading the person recorded, as the same snapshot a collector would send,
 * so the screens and the Tokenmaxx ranking read it like any other.
 *
 * Z.AI's 5-hour credits are a rolling window: each credit comes back 5 hours
 * after it was spent (docs.z.ai/devpack/overview). The latest any credit
 * counted in this reading can return is 5 hours after it was taken, so that is
 * its reset. The weekly window resets on a 7-day cycle from the order, which
 * only the vendor's page shows; without it the reset is left unknown.
 */
export function manualSnapshot(usage: ManualUsage, at: Date): UsageSnapshot {
  const windows: LimitWindow[] = [];
  if (usage.sessionUtilization !== null) {
    windows.push({
      key: 'five_hour',
      kind: 'session',
      label: '5-hour',
      utilization: usage.sessionUtilization,
      resetsAt: new Date(at.getTime() + FIVE_HOURS_MS).toISOString(),
      windowMinutes: 300,
    });
  }
  if (usage.weeklyUtilization !== null) {
    windows.push({
      key: 'weekly',
      kind: 'weekly',
      label: 'Weekly',
      utilization: usage.weeklyUtilization,
      resetsAt: usage.weeklyResetsAt?.toISOString() ?? null,
      windowMinutes: 7 * 24 * 60,
    });
  }
  return {
    capturedAt: at.toISOString(),
    source: 'manual',
    status: 'ok',
    message: null,
    windows,
    extraUsage: null,
  };
}
