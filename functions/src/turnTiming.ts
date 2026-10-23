import type { ServerGameState } from '@gem-arena/engine';

export const TURN_DURATION_MS = 3 * 60 * 1000;

export function nextTurnDeadline(
  previous: ServerGameState,
  next: ServerGameState,
  currentDeadline: number | undefined,
  now: number,
): number | null {
  if (next.phase === 'finished') return null;
  if (previous.turnIndex !== next.turnIndex || !Number.isFinite(currentDeadline)) {
    return now + TURN_DURATION_MS;
  }
  return currentDeadline!;
}
