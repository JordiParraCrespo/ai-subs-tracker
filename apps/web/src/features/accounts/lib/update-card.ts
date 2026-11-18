import type { UpdateState } from '@flama/shared/desktop';

/** What the bottom card shows, if anything. */
export type UpdateCardView = 'ready' | 'downloading' | 'failed' | 'updated';

/**
 * The card's one rule: it speaks up when there is something to do, and keeps
 * a background check quiet. A downloaded version always shows (until closed);
 * a download only while the person is following one they asked for; a failed
 * download when they asked, or after a second failure in a row; and, on the
 * first launch after an update, the version it replaced.
 */
export function updateCardView(state: UpdateState | undefined): UpdateCardView | null {
  if (!state || state.dismissed) return null;
  if (state.phase === 'ready' && state.version) return 'ready';
  if (state.phase === 'downloading' && state.manual && state.version) return 'downloading';
  if (state.phase === 'error' && state.version && (state.manual || state.failures >= 2)) {
    return 'failed';
  }
  if (state.updatedFrom) return 'updated';
  return null;
}
