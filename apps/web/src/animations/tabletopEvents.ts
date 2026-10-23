import type { CardLevel, Gem, Inventory } from '@gem-arena/engine';

export interface TabletopSnapshot {
  version: number;
  phase: string;
  turnIndex: number;
  playerOrder: string[];
  bank: Inventory;
  market: Record<CardLevel, (string | null)[]>;
  deckCounts?: Record<CardLevel, number>;
  decks?: Record<CardLevel, string[]>;
  players: Record<string, {
    gems: Inventory; purchasedCardIds: string[]; nobleIds: string[]; score: number;
    reservedCount?: number; reservedCardIds?: string[]; forfeited?: boolean;
  }>;
}

export type TabletopEvent =
  | { kind: 'gem'; playerId: string; color: Gem; count: number; incoming: boolean }
  | { kind: 'purchase'; playerId: string; cardId: string }
  | { kind: 'reserve'; playerId: string; cardId: string | null; level?: CardLevel }
  | { kind: 'noble'; playerId: string; nobleId: string }
  | { kind: 'refill'; level: CardLevel; slot: number; cardId: string }
  | { kind: 'turn'; playerId: string }
  | { kind: 'finish' };

const colors: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const levels: CardLevel[] = [3, 2, 1];

/** Only adjacent confirmed states produce effects. Reconnects and resets snap to state. */
export function tabletopEvents(before: TabletopSnapshot, after: TabletopSnapshot): TabletopEvent[] {
  if (after.version !== before.version + 1 ||
      before.playerOrder.join('|') !== after.playerOrder.join('|')) return [];
  const events: TabletopEvent[] = [];
  const removedCards = levels.flatMap(level => before.market[level].filter(id => id && !after.market[level].includes(id)));
  for (const playerId of after.playerOrder) {
    const previous = before.players[playerId];
    const player = after.players[playerId];
    if (!previous || !player) continue;
    for (const color of colors) {
      const delta = player.gems[color] - previous.gems[color];
      if (delta) events.push({ kind: 'gem', playerId, color, count: Math.abs(delta), incoming: delta > 0 });
    }
    for (const cardId of player.purchasedCardIds) {
      if (!previous.purchasedCardIds.includes(cardId)) events.push({ kind: 'purchase', playerId, cardId });
    }
    const previousReserved = previous.reservedCount ?? previous.reservedCardIds?.length ?? 0;
    const reserved = player.reservedCount ?? player.reservedCardIds?.length ?? 0;
    if (reserved > previousReserved) {
      // Public market identity is safe; never infer a hidden deck reservation.
      const cardId = removedCards.find(id => id && !player.purchasedCardIds.includes(id)) ?? null;
      const level = cardId ? undefined : levels.find(level =>
        (before.deckCounts?.[level] ?? before.decks?.[level].length ?? 0) >
        (after.deckCounts?.[level] ?? after.decks?.[level].length ?? 0));
      events.push({ kind: 'reserve', playerId, cardId, level });
    }
    for (const nobleId of player.nobleIds) {
      if (!previous.nobleIds.includes(nobleId)) events.push({ kind: 'noble', playerId, nobleId });
    }
  }
  for (const level of levels) after.market[level].forEach((cardId, slot) => {
    if (cardId && cardId !== before.market[level][slot]) events.push({ kind: 'refill', level, slot, cardId });
  });
  if (after.phase === 'finished' && before.phase !== 'finished') events.push({ kind: 'finish' });
  else if (after.turnIndex !== before.turnIndex) events.push({ kind: 'turn', playerId: after.playerOrder[after.turnIndex] });
  return events;
}
