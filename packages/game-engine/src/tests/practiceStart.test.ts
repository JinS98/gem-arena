import { describe, expect, it } from 'vitest';
import { getDevelopmentCard } from '../data/catalog';
import { createInitialGameState } from '../rules/initialState';
import { reduceGameAction } from '../rules/reducer';
import type { Gem } from '../types';

const gems: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const regularSupply: Record<number, number> = { 2: 4, 3: 5, 4: 7 };

describe('emulator practice start', () => {
  it.each([2, 3, 4])('gives each of %i players a purchasable card and room to take gems', (count) => {
    const ids = Array.from({ length: count }, (_, index) => `player-${index}`);
    const state = createInitialGameState(ids, 42, { practiceStart: true });
    const active = state.playerOrder[state.turnIndex];
    const affordableCardId = state.market[1].find((id) => id?.endsWith('-01'));
    if (!affordableCardId) throw new Error('Practice market has no affordable level-one card');
    const card = getDevelopmentCard(affordableCardId);
    if (!card) throw new Error('Practice card is missing from the catalog');

    for (const uid of ids) {
      expect(state.players[uid].gems).toEqual({ white: 2, blue: 1, green: 1, red: 1, black: 1, gold: 1 });
      for (const color of ['white', 'blue', 'green', 'red', 'black'] as const) {
        expect(state.players[uid].gems[color]).toBeGreaterThanOrEqual(card.cost[color]);
      }
    }
    for (const gem of gems) {
      expect(state.bank[gem]).toBeGreaterThanOrEqual(gem === 'gold' ? 5 : 4);
      const total = state.bank[gem] + ids.reduce((sum, uid) => sum + state.players[uid].gems[gem], 0);
      expect(total).toBe(gem === 'gold' ? 5 + count : regularSupply[count] + 5);
    }

    const bought = reduceGameAction(state, active, {
      type: 'BUY_CARD', cardId: affordableCardId, source: 'market',
      payment: { ...card.cost, gold: 0 },
    });
    expect(bought.players[active].purchasedCardIds).toContain(affordableCardId);

    const collected = reduceGameAction(state, active, {
      type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'],
    });
    expect(collected.players[active].gems.white).toBe(3);
    expect(collected.players[active].gems.blue).toBe(2);
    expect(collected.players[active].gems.green).toBe(2);
    expect(collected.phase).toBe('playing');
  });
});
