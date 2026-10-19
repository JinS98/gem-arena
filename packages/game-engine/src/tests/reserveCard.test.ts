import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_CARDS } from '../data/catalog';
import { discardExcessGems, gemCount } from '../rules/gems';
import { createInitialGameState } from '../rules/initialState';
import { reserveCard } from '../rules/reserveCard';
import type { Inventory, ServerGameState } from '../types/index';

function setup() {
  const state = createInitialGameState(['alice', 'bob'], 42);
  const actor = state.playerOrder[state.turnIndex];
  const other = state.playerOrder.find((id) => id !== actor)!;
  return { state, actor, other };
}

function allCardIds(state: ServerGameState): string[] {
  return [
    ...Object.values(state.market).flat().filter((id): id is string => id !== null),
    ...Object.values(state.decks).flat(),
    ...Object.values(state.players).flatMap((player) =>
      [...player.purchasedCardIds, ...player.reservedCardIds]),
  ];
}

describe('카드 예약 상태 갱신', () => {
  it('공개 카드를 예약하고 같은 시장 칸을 보충하며 황금 1개를 준다', () => {
    const { state, actor, other } = setup();
    const snapshot = structuredClone(state);
    const cardId = state.market[1][0]!;
    const topId = state.decks[1][0];
    const result = reserveCard(state, actor, { type: 'RESERVE_CARD', cardId });
    const next = result.state;
    expect(next.players[actor].reservedCardIds).toEqual([cardId]);
    expect(next.players[actor].gems.gold).toBe(1);
    expect(next.bank.gold).toBe(state.bank.gold - 1);
    expect(next.market[1][0]).toBe(topId);
    expect(next.decks[1]).toEqual(state.decks[1].slice(1));
    expect(next.players[actor].score).toBe(0);
    expect(next.players[other]).toBe(state.players[other]);
    expect(next.turnIndex).toBe(state.turnIndex);
    expect(next.version).toBe(state.version);
    expect(result.excess).toBe(0);
    expect(allCardIds(next)).toHaveLength(DEVELOPMENT_CARDS.length);
    expect(new Set(allCardIds(next)).size).toBe(DEVELOPMENT_CARDS.length);
    expect(state).toEqual(snapshot);
    expect(() => reserveCard(next, actor, { type: 'RESERVE_CARD', cardId })).toThrow(RangeError);
  });

  it('덱 맨 위를 비공개 예약하면 시장과 다른 플레이어 목록에 정체가 나타나지 않는다', () => {
    const { state, actor, other } = setup();
    const topId = state.decks[2][0];
    const next = reserveCard(state, actor, { type: 'RESERVE_CARD', level: 2 }).state;
    expect(next.players[actor].reservedCardIds).toEqual([topId]);
    expect(next.players[other].reservedCardIds).not.toContain(topId);
    expect(Object.values(next.market).flat()).not.toContain(topId);
    expect(next.market).toBe(state.market);
    expect(next.decks[2]).toEqual(state.decks[2].slice(1));
    expect(new Set(allCardIds(next)).size).toBe(DEVELOPMENT_CARDS.length);
  });

  it('예약 3장 한도를 지키고 한도 도달 시 원본을 바꾸지 않는다', () => {
    const { state: initial, actor } = setup();
    const twoReserved: ServerGameState = {
      ...initial,
      decks: { ...initial.decks, 1: initial.decks[1].slice(2) },
      players: {
        ...initial.players,
        [actor]: { ...initial.players[actor], reservedCardIds: initial.decks[1].slice(0, 2) },
      },
    };
    const third = reserveCard(twoReserved, actor, {
      type: 'RESERVE_CARD', cardId: twoReserved.market[1][0]!,
    }).state;
    expect(third.players[actor].reservedCardIds).toHaveLength(3);
    const snapshot = structuredClone(third);
    expect(() => reserveCard(third, actor, { type: 'RESERVE_CARD', level: 1 })).toThrow(RangeError);
    expect(third).toEqual(snapshot);
  });

  it('황금 재고가 0이어도 카드 예약은 성공한다', () => {
    const { state: initial, actor } = setup();
    const state = { ...initial, bank: { ...initial.bank, gold: 0 } };
    const result = reserveCard(state, actor, { type: 'RESERVE_CARD', level: 1 });
    expect(result.state.players[actor].reservedCardIds).toHaveLength(1);
    expect(result.state.players[actor].gems.gold).toBe(0);
    expect(result.state.bank.gold).toBe(0);
    expect(result.excess).toBe(0);
  });

  it('황금을 받아 10개를 넘으면 초과 반환량을 알려준다', () => {
    const { state: initial, actor } = setup();
    const gems: Inventory = { white: 9, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
    const state = {
      ...initial,
      players: { ...initial.players, [actor]: { ...initial.players[actor], gems } },
    };
    const result = reserveCard(state, actor, { type: 'RESERVE_CARD', level: 1 });
    expect(result.excess).toBe(1);
    expect(gemCount(result.state.players[actor].gems)).toBe(11);
    const returned: Inventory = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
    const settled = discardExcessGems(result.state.bank, result.state.players[actor].gems, returned);
    expect(gemCount(settled.gems)).toBe(10);
  });

  it('공개 카드 예약 후 덱이 비면 해당 시장 칸만 비운다', () => {
    const { state: initial, actor } = setup();
    const state = { ...initial, decks: { ...initial.decks, 1: [] } };
    const cardId = state.market[1][0]!;
    const next = reserveCard(state, actor, { type: 'RESERVE_CARD', cardId }).state;
    expect(next.market[1]).toHaveLength(4);
    expect(next.market[1][0]).toBeNull();
    expect(next.players[actor].reservedCardIds).toEqual([cardId]);
  });

  it('잘못된 대상·턴·보석 상태와 빈 덱 예약을 거부한다', () => {
    const { state, actor, other } = setup();
    const cardId = state.market[1][0]!;
    const snapshot = structuredClone(state);
    const actions = [
      { type: 'RESERVE_CARD', cardId, level: 1 },
      { type: 'RESERVE_CARD' },
      { type: 'RESERVE_CARD', cardId: 'missing' },
      { type: 'RESERVE_CARD', level: 4 },
    ] as const;
    for (const action of actions) {
      expect(() => reserveCard(state, actor, action as Parameters<typeof reserveCard>[2])).toThrow(RangeError);
    }
    expect(() => reserveCard(state, other, { type: 'RESERVE_CARD', cardId })).toThrow(RangeError);
    expect(() => reserveCard({ ...state, phase: 'discarding' }, actor,
      { type: 'RESERVE_CARD', cardId })).toThrow(RangeError);
    expect(() => reserveCard({ ...state, turnNobleResolved: true }, actor,
      { type: 'RESERVE_CARD', cardId })).toThrow(RangeError);
    expect(() => reserveCard({ ...state, bank: { ...state.bank, gold: -1 } }, actor,
      { type: 'RESERVE_CARD', cardId })).toThrow(RangeError);
    expect(() => reserveCard({ ...state, decks: { ...state.decks, 2: [] } }, actor,
      { type: 'RESERVE_CARD', level: 2 })).toThrow(RangeError);
    expect(state).toEqual(snapshot);
  });
});
