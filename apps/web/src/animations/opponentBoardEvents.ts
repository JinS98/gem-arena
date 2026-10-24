import type { PublicGameView } from '@gem-arena/engine';
import { tabletopEvents, type TabletopEvent } from './tabletopEvents.ts';

export type OpponentBoardEvent = Exclude<TabletopEvent, { kind: 'turn' } | { kind: 'finish' }>;

/** Public views only: never fetch another player's private reservation document. */
export function opponentBoardEvents(before: PublicGameView, after: PublicGameView, myUid: string): OpponentBoardEvent[] {
  const events = tabletopEvents(before, after);
  const opponentChangedMarket = events.some(event =>
    (event.kind === 'purchase' || event.kind === 'reserve') && event.playerId !== myUid);
  return events.filter((event): event is OpponentBoardEvent => {
    if (event.kind === 'turn' || event.kind === 'finish') return false;
    if (event.kind === 'refill') return opponentChangedMarket;
    return event.playerId !== myUid;
  });
}
