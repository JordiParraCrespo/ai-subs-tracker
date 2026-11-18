import type { UpdateState } from '@flama/shared/desktop';
import { describe, expect, it } from 'vitest';
import { updateCardView } from '../lib/update-card';

const base: UpdateState = {
  phase: 'idle',
  currentVersion: '0.2.0',
  version: null,
  percent: null,
  checkedAt: null,
  failures: 0,
  manual: false,
  installOnQuit: true,
  dismissed: false,
  updatedFrom: null,
};
const at = (patch: Partial<UpdateState>) => updateCardView({ ...base, ...patch });

describe('updateCardView', () => {
  it('shows nothing in a browser, or when there is nothing to say', () => {
    expect(updateCardView(undefined)).toBeNull();
    for (const phase of ['idle', 'checking', 'up_to_date', 'unsupported'] as const) {
      expect(at({ phase })).toBeNull();
    }
  });

  it('offers a downloaded version until the card is closed', () => {
    expect(at({ phase: 'ready', version: '0.3.0' })).toBe('ready');
    expect(at({ phase: 'ready', version: '0.3.0', dismissed: true })).toBeNull();
  });

  it('keeps a background download quiet and shows one the person asked for', () => {
    expect(at({ phase: 'downloading', version: '0.3.0', percent: 40 })).toBeNull();
    expect(at({ phase: 'downloading', version: '0.3.0', manual: true })).toBe('downloading');
  });

  it('reports a failed download when asked for, or on the second failure in a row', () => {
    expect(at({ phase: 'error', version: '0.3.0', failures: 1 })).toBeNull();
    expect(at({ phase: 'error', version: '0.3.0', failures: 2 })).toBe('failed');
    expect(at({ phase: 'error', version: '0.3.0', failures: 1, manual: true })).toBe('failed');
    // A check that never found a version is Settings' to report, not the card's.
    expect(at({ phase: 'error', failures: 3, manual: true })).toBeNull();
  });

  it('says what was installed on the first launch after an update', () => {
    expect(at({ updatedFrom: '0.1.1' })).toBe('updated');
    expect(at({ updatedFrom: '0.1.1', phase: 'ready', version: '0.3.0' })).toBe('ready');
    expect(at({ updatedFrom: '0.1.1', dismissed: true })).toBeNull();
  });
});
