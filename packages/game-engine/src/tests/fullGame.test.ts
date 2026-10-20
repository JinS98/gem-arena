import { describe, expect, it } from 'vitest';
import { CARD_COLORS, DEVELOPMENT_CARDS, getDevelopmentCard } from '../data/catalog';
import { canTakeGems, excessGemCount } from '../rules/gems';
import { createInitialGameState } from '../rules/initialState';
import { eligibleNobleIds } from '../rules/nobles';
import { countCardBonuses, remainingCardCost } from '../rules/payment';
import { hasLegalBasicAction, reduceGameAction } from '../rules/reducer';
import { determineWinnerIds } from '../rules/turnEnd';
import type { GemColor, GameAction, Inventory, ServerGameState } from '../types/index';

const gems = [...CARD_COLORS, 'gold'] as const;
const empty = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

function chooseAction(state: ServerGameState): GameAction {
  const actor = state.playerOrder[state.turnIndex];
  const player = state.players[actor];
  if (state.phase === 'choosingNoble') {
    return { type: 'CHOOSE_NOBLE', nobleId: eligibleNobleIds(state, actor)[0] };
  }
  if (state.phase === 'discarding') {
    const returned = empty();
    let excess = excessGemCount(player.gems);
    for (const gem of [...CARD_COLORS, 'gold'] as const) {
      returned[gem] = Math.min(player.gems[gem], excess);
      excess -= returned[gem];
    }
    return { type: 'DISCARD_GEMS', gems: returned };
  }

  const bonuses = countCardBonuses(player.purchasedCardIds);
  const offered = [
    ...Object.values(state.market).flat().filter((id): id is string => id !== null)
      .map((id) => ({ id, source: 'market' as const })),
    ...player.reservedCardIds.map((id) => ({ id, source: 'reserved' as const })),
  ];
  const candidates = offered.map(({ id, source }) => {
    const card = getDevelopmentCard(id)!;
    const cost = remainingCardCost(card.cost, bonuses);
    const missing = CARD_COLORS.reduce((sum, color) =>
      sum + Math.max(0, cost[color] - player.gems[color]), 0);
    return { card, source, cost, missing };
  });
  const affordable = candidates.filter(({ missing }) => missing <= player.gems.gold)
    .sort((a, b) => b.card.points - a.card.points ||
      a.card.level - b.card.level || a.card.id.localeCompare(b.card.id));
  if (affordable.length > 0) {
    const choice = affordable[0];
    const payment = empty();
    for (const color of CARD_COLORS) payment[color] = Math.min(choice.cost[color], player.gems[color]);
    payment.gold = CARD_COLORS.reduce((sum, color) => sum + choice.cost[color] - payment[color], 0);
    return { type: 'BUY_CARD', cardId: choice.card.id, source: choice.source, payment };
  }

  const available = CARD_COLORS.filter((color) => state.bank[color] > 0);
  if (available.length > 0) {
    const target = candidates.sort((a, b) =>
      a.missing - b.missing || b.card.points - a.card.points ||
      a.card.level - b.card.level)[0];
    const colors = [...available].sort((a, b) => {
      const aNeed = Math.max(0, (target?.cost[a] ?? 0) - player.gems[a]);
      const bNeed = Math.max(0, (target?.cost[b] ?? 0) - player.gems[b]);
      return bNeed - aNeed || player.gems[a] - player.gems[b];
    }).slice(0, 3) as GemColor[];
    if (canTakeGems(state.bank, colors)) return { type: 'TAKE_GEMS', colors };
  }

  const reservable = Object.values(state.market).flat().find((id) => id !== null);
  if (player.reservedCardIds.length < 3 && reservable) return { type: 'RESERVE_CARD', cardId: reservable };
  if (!hasLegalBasicAction(state, actor)) return { type: 'PASS' };
  throw new Error('합법적인 기본 행동을 선택하지 못했습니다');
}

function checkInvariants(state: ServerGameState, playerCount: number): void {
  const regularSupply = { 2: 4, 3: 5, 4: 7 }[playerCount as 2 | 3 | 4];
  for (const gem of gems) {
    expect(state.bank[gem] + Object.values(state.players)
      .reduce((total, player) => total + player.gems[gem], 0)).toBe(gem === 'gold' ? 5 : regularSupply);
  }
  const cardIds = [
    ...Object.values(state.market).flat().filter((id): id is string => id !== null),
    ...Object.values(state.decks).flat(),
    ...Object.values(state.players).flatMap((player) =>
      [...player.purchasedCardIds, ...player.reservedCardIds]),
  ];
  expect(cardIds.length).toBe(DEVELOPMENT_CARDS.length);
  expect(new Set(cardIds).size).toBe(cardIds.length);
  for (const player of Object.values(state.players)) {
    expect(player.reservedCardIds.length).toBeLessThanOrEqual(3);
    if (state.phase !== 'discarding' || state.playerOrder[state.turnIndex] !== player.uid) {
      expect(excessGemCount(player.gems)).toBe(0);
    }
  }
}

describe('2~4인 로컬 게임 완주', () => {
  for (const count of [2, 3, 4] as const) {
    it(`${count}명이 초기 상태부터 최종 결과까지 진행한다`, () => {
      let state = createInitialGameState(Array.from({ length: count }, (_, index) => `player-${index + 1}`), 1800 + count);
      checkInvariants(state, count);
      let actions = 0;
      const seen = new Set<GameAction['type']>();
      while (state.phase !== 'finished' && actions < 1500) {
        const actor = state.playerOrder[state.turnIndex];
        const action = actions === 0 ? { type: 'RESERVE_CARD' as const, level: 1 as const } : chooseAction(state);
        const next = reduceGameAction(state, actor, action);
        seen.add(action.type);
        expect(next.version).toBe(state.version + 1);
        checkInvariants(next, count);
        state = next;
        actions++;
      }
      expect(state.phase).toBe('finished');
      expect(actions).toBeLessThan(1500);
      expect(state.finalRoundTriggeredBy).not.toBeNull();
      expect(Math.max(...Object.values(state.players).map((player) => player.score))).toBeGreaterThanOrEqual(15);
      expect(state.winnerIds).toEqual(determineWinnerIds(state));
      expect(state.winnerIds.length).toBeGreaterThan(0);
      expect(seen).toContain('BUY_CARD');
      expect(seen).toContain('TAKE_GEMS');
      expect(seen).toContain('RESERVE_CARD');
    });
  }
});
