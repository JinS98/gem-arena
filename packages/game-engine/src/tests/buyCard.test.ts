import { describe, expect, it } from 'vitest';
import { CARD_COLORS, DEVELOPMENT_CARDS, getDevelopmentCard } from '../data/catalog';
import { buyCard } from '../rules/buyCard';
import { createInitialGameState } from '../rules/initialState';
import { countCardBonuses, remainingCardCost } from '../rules/payment';
import type { Inventory, ServerGameState } from '../types/index';

function setup() {
  const state = createInitialGameState(['alice', 'bob'], 42);
  const actor = state.playerOrder[state.turnIndex];
  const other = state.playerOrder.find((id) => id !== actor)!;
  const cardId = state.market[1][0]!;
  const card = getDevelopmentCard(cardId)!;
  return { state, actor, other, cardId, card };
}

function fundPlayer(state: ServerGameState, actor: string, payment: Inventory): ServerGameState {
  const bank = { ...state.bank };
  for (const gem of [...CARD_COLORS, 'gold'] as const) {
    bank[gem] -= payment[gem];
    if (bank[gem] < 0) throw new Error('테스트 은행에 보석이 부족합니다');
  }
  return {
    ...state,
    bank,
    players: {
      ...state.players,
      [actor]: { ...state.players[actor], gems: { ...payment } },
    },
  };
}

describe('카드 구매 상태 갱신', () => {
  it('시장 카드 구매 시 보석·점수·소유 카드·시장·덱을 함께 갱신한다', () => {
    const { state: initial, actor, other, cardId, card } = setup();
    const payment: Inventory = { ...card.cost, gold: 0 };
    const state = fundPlayer(initial, actor, payment);
    const snapshot = structuredClone(state);
    const replacement = state.decks[1][0];

    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment });
    expect(next.players[actor].gems).toEqual({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
    expect(next.bank).toEqual(initial.bank);
    expect(next.players[actor].purchasedCardIds).toEqual([cardId]);
    expect(next.players[actor].score).toBe(card.points);
    expect(next.market[1][0]).toBe(replacement);
    expect(next.market[1]).toHaveLength(4);
    expect(next.decks[1]).toEqual(state.decks[1].slice(1));
    expect(next.players[other]).toBe(state.players[other]);
    expect(next.version).toBe(state.version);
    expect(next.turnIndex).toBe(state.turnIndex);
    const allCardIds = [
      ...Object.values(next.market).flat().filter((id): id is string => id !== null),
      ...Object.values(next.decks).flat(),
      ...Object.values(next.players).flatMap((player) =>
        [...player.purchasedCardIds, ...player.reservedCardIds]),
    ];
    expect(allCardIds).toHaveLength(DEVELOPMENT_CARDS.length);
    expect(new Set(allCardIds).size).toBe(DEVELOPMENT_CARDS.length);
    expect(state).toEqual(snapshot);
  });

  it('황금 결제를 구매 상태에도 정확히 반영한다', () => {
    const { state: initial, actor, cardId, card } = setup();
    const color = CARD_COLORS.find((candidate) => card.cost[candidate] > 0)!;
    const payment: Inventory = { ...card.cost, gold: 0 };
    payment[color]--;
    payment.gold = 1;
    const state = fundPlayer(initial, actor, payment);
    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment });
    expect(next.bank).toEqual(initial.bank);
    expect(next.players[actor].gems.gold).toBe(0);
    expect(next.players[actor].purchasedCardIds).toContain(cardId);
  });

  it('기존 구매 카드의 할인만 먼저 적용하고 이번 카드의 점수를 더한다', () => {
    const { state: initial, actor, cardId, card } = setup();
    const paidColor = CARD_COLORS.find((color) => card.cost[color] > 0)!;
    const bonusId = Object.values(initial.decks).flat().find((id) =>
      getDevelopmentCard(id)?.bonusColor === paidColor)!;
    const bonusCard = getDevelopmentCard(bonusId)!;
    const stateWithBonus: ServerGameState = {
      ...initial,
      decks: { ...initial.decks, [bonusCard.level]: initial.decks[bonusCard.level].filter((id) => id !== bonusId) },
      players: {
        ...initial.players,
        [actor]: {
          ...initial.players[actor],
          purchasedCardIds: [bonusId], score: bonusCard.points,
        },
      },
    };
    const payment: Inventory = {
      ...remainingCardCost(card.cost, countCardBonuses([bonusId])), gold: 0,
    };
    const state = fundPlayer(stateWithBonus, actor, payment);
    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment });
    expect(next.players[actor].purchasedCardIds).toEqual([bonusId, cardId]);
    expect(next.players[actor].score).toBe(bonusCard.points + card.points);
    expect(next.players[actor].gems.white + next.players[actor].gems.blue +
      next.players[actor].gems.green + next.players[actor].gems.red +
      next.players[actor].gems.black).toBe(0);
  });

  it('본인 예약 카드를 구매하면 예약 목록에서만 제거한다', () => {
    const { state: initial, actor } = setup();
    const cardId = initial.decks[1][0];
    const card = getDevelopmentCard(cardId)!;
    const reserved: ServerGameState = {
      ...initial,
      decks: { ...initial.decks, 1: initial.decks[1].slice(1) },
      players: {
        ...initial.players,
        [actor]: { ...initial.players[actor], reservedCardIds: [cardId] },
      },
    };
    const payment: Inventory = { ...card.cost, gold: 0 };
    const state = fundPlayer(reserved, actor, payment);
    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'reserved', cardId, payment });
    expect(next.players[actor].reservedCardIds).toEqual([]);
    expect(next.players[actor].purchasedCardIds).toEqual([cardId]);
    expect(next.market).toBe(state.market);
    expect(next.decks).toBe(state.decks);
    expect(next.bank).toEqual(initial.bank);
  });

  it('덱이 소진되면 구매한 시장 칸을 비워 둔다', () => {
    const { state: initial, actor, cardId, card } = setup();
    const payment: Inventory = { ...card.cost, gold: 0 };
    const state = fundPlayer({ ...initial, decks: { ...initial.decks, 1: [] } }, actor, payment);
    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment });
    expect(next.market[1]).toHaveLength(4);
    expect(next.market[1][0]).toBeNull();
    expect(next.decks[1]).toEqual([]);
  });

  it('잘못된 턴·단계·출처와 타인의 예약 카드를 거부한다', () => {
    const { state: initial, actor, other, cardId, card } = setup();
    const payment: Inventory = { ...card.cost, gold: 0 };
    const state = fundPlayer(initial, actor, payment);
    const action = { type: 'BUY_CARD', source: 'market', cardId, payment } as const;
    expect(() => buyCard(state, other, action)).toThrow(RangeError);
    expect(() => buyCard({ ...state, phase: 'discarding' }, actor, action)).toThrow(RangeError);
    expect(() => buyCard({ ...state, turnNobleResolved: true }, actor, action)).toThrow(RangeError);
    expect(() => buyCard(state, actor, { ...action, source: 'reserved' })).toThrow(RangeError);
    expect(() => buyCard(state, actor, { ...action, cardId: 'missing' })).toThrow(RangeError);
    const reservedByOther: ServerGameState = {
      ...state,
      players: { ...state.players, [other]: { ...state.players[other], reservedCardIds: [state.decks[1][0]] } },
    };
    expect(() => buyCard(reservedByOther, actor, {
      ...action, source: 'reserved', cardId: state.decks[1][0],
    })).toThrow(RangeError);
  });

  it('부족한 결제와 동일 카드의 중복 구매를 거부하며 실패 상태를 변경하지 않는다', () => {
    const { state: initial, actor, cardId, card } = setup();
    const payment: Inventory = { ...card.cost, gold: 0 };
    const state = fundPlayer(initial, actor, payment);
    const snapshot = structuredClone(state);
    const empty: Inventory = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    expect(() => buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment: empty })).toThrow(RangeError);
    expect(state).toEqual(snapshot);
    const next = buyCard(state, actor, { type: 'BUY_CARD', source: 'market', cardId, payment });
    expect(() => buyCard(next, actor, { type: 'BUY_CARD', source: 'market', cardId, payment })).toThrow(RangeError);
  });
});
