import { describe, expect, it } from 'vitest';
import { reportedPlanName } from '../lib/plan-name';

/**
 * The edit dialog's "As reported" option read `default_claude_max_20x`: the
 * provider's raw id. These hold it to the catalog name, and to words when the
 * catalog does not know the tier.
 */
describe('reportedPlanName', () => {
  it('resolves a provider id through the catalog aliases', () => {
    expect(reportedPlanName('claude-code', 'default_claude_max_20x')).toBe('Ultra');
    expect(reportedPlanName('claude-code', 'default_claude_max_5x')).toBe('Max');
    expect(reportedPlanName('codex', 'plus')).toBe('Plus');
  });

  it('humanises a tier the catalog does not know instead of showing the raw id', () => {
    expect(reportedPlanName('claude-code', 'default_claude_galaxy_50x')).toBe('Claude galaxy 50x');
  });

  it('has nothing to say when nothing was reported', () => {
    expect(reportedPlanName('codex', null)).toBeNull();
    expect(reportedPlanName('codex', '  ')).toBeNull();
  });
});
