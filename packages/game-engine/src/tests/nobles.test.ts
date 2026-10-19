import { describe, expect, it } from 'vitest';
import { CARD_COLORS, getDevelopmentCard, getNoble } from '../data/catalog';
import { createInitialGameState } from '../rules/initialState';
import { chooseNoble, eligibleNobleIds, resolveNobleVisit } from '../rules/nobles';
import type { CardLevel, GemColor, ServerGameState } from '../types/index';

function setup() {
  const state = createInitialGameState(['alice', 'bob'], 42);
  const actor = state.playerOrder[state.turnIndex];
  const other = state.playerOrder.find((id) => id !== actor)!;
  return { state, actor, other };
}

function requiredColors(nobleId: string): GemColor[] {
  const noble = getNoble(nobleId)!;
  return CARD_COLORS.filter((color) => noble.requirements[color] === 3);
}

function grantBonuses(state: ServerGameState, actor: string, colors: readonly GemColor[]): ServerGameState {
  const deckIds = Object.values(state.decks).flat();
  const chosen: string[] = [];
  for (const color of colors) {
    const matching = deckIds.filter((id) =>
      getDevelopmentCard(id)?.bonusColor === color && !chosen.includes(id)).slice(0, 3);
    if (matching.length !== 3) throw new Error('테스트용 보너스 카드가 부족합니다');
    chosen.push(...matching);
  }
  const owned = new Set(chosen);
  const decks = Object.fromEntries(([1, 2, 3] as const).map((level) =>
    [level, state.decks[level].filter((id) => !owned.has(id))])) as Record<CardLevel, string[]>;
  const score = chosen.reduce((sum, id) => sum + getDevelopmentCard(id)!.points, 0);
  return {
    ...state, decks,
    players: {
      ...state.players,
      [actor]: { ...state.players[actor], purchasedCardIds: chosen, score },
    },
  };
}

describe('귀족 방문', () => {
  it('보유 보석과 예약 카드는 귀족 조건에 포함하지 않는다', () => {
    const { state: initial, actor } = setup();
    const nobleId = initial.availableNobleIds[0];
    const [first, second, third] = requiredColors(nobleId);
    const gems = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 1 };
    gems[first] = 3;
    gems[second] = 3;
    gems[third] = 3;
    const state: ServerGameState = {
      ...initial,
      players: {
        ...initial.players,
        [actor]: {
          ...initial.players[actor], gems,
          reservedCardIds: initial.decks[1].slice(0, 3),
        },
      },
    };
    expect(eligibleNobleIds(state, actor)).toEqual([]);
    const next = resolveNobleVisit(state, actor);
    expect(next.turnNobleResolved).toBe(true);
    expect(next.players[actor].nobleIds).toEqual([]);
    expect(next.availableNobleIds).toEqual(state.availableNobleIds);
    expect(() => resolveNobleVisit(next, actor)).toThrow(RangeError);
  });

  it('조건에 맞는 귀족이 한 명이면 자동 방문하고 3점을 더한다', () => {
    const { state: initial, actor, other } = setup();
    const nobleId = initial.availableNobleIds[0];
    const state = grantBonuses(initial, actor, requiredColors(nobleId));
    const snapshot = structuredClone(state);
    expect(eligibleNobleIds(state, actor)).toEqual([nobleId]);
    const next = resolveNobleVisit(state, actor);
    expect(next.players[actor].nobleIds).toEqual([nobleId]);
    expect(next.players[actor].score).toBe(state.players[actor].score + 3);
    expect(next.availableNobleIds).not.toContain(nobleId);
    expect(next.players[other]).toBe(state.players[other]);
    expect(next.phase).toBe('playing');
    expect(next.turnNobleResolved).toBe(true);
    expect(next.turnIndex).toBe(state.turnIndex);
    expect(next.version).toBe(state.version);
    expect(state).toEqual(snapshot);
    expect(() => resolveNobleVisit(next, actor)).toThrow(RangeError);
  });

  it('여러 귀족 조건을 만족하면 선택을 기다리고 한 명만 받는다', () => {
    const { state: initial, actor } = setup();
    const firstNoble = initial.availableNobleIds[0];
    const secondNoble = initial.availableNobleIds[1];
    const colors = [...new Set([...requiredColors(firstNoble), ...requiredColors(secondNoble)])];
    const state = grantBonuses(initial, actor, colors);
    const eligible = eligibleNobleIds(state, actor);
    expect(eligible).toContain(firstNoble);
    expect(eligible).toContain(secondNoble);
    const pending = resolveNobleVisit(state, actor);
    expect(pending.phase).toBe('choosingNoble');
    expect(pending.turnNobleResolved).toBe(false);
    expect(pending.players[actor].nobleIds).toEqual([]);
    expect(pending.players[actor].score).toBe(state.players[actor].score);
    expect(pending.availableNobleIds).toEqual(state.availableNobleIds);

    const chosen = chooseNoble(pending, actor, { type: 'CHOOSE_NOBLE', nobleId: secondNoble });
    expect(chosen.phase).toBe('playing');
    expect(chosen.turnNobleResolved).toBe(true);
    expect(chosen.players[actor].nobleIds).toEqual([secondNoble]);
    expect(chosen.players[actor].score).toBe(state.players[actor].score + 3);
    expect(chosen.availableNobleIds).toContain(firstNoble);
    expect(chosen.availableNobleIds).not.toContain(secondNoble);
    expect(chosen.availableNobleIds).toHaveLength(state.availableNobleIds.length - 1);
    expect(() => chooseNoble(chosen, actor,
      { type: 'CHOOSE_NOBLE', nobleId: firstNoble })).toThrow(RangeError);
    expect(() => resolveNobleVisit(chosen, actor)).toThrow(RangeError);
  });

  it('선택 단계 밖의 요청, 자격 없는 귀족, 다른 플레이어 선택을 거부한다', () => {
    const { state: initial, actor, other } = setup();
    const nobleId = initial.availableNobleIds[0];
    const state = grantBonuses(initial, actor, requiredColors(nobleId));
    const pending: ServerGameState = { ...state, phase: 'choosingNoble' };
    const snapshot = structuredClone(pending);
    expect(() => chooseNoble(state, actor, { type: 'CHOOSE_NOBLE', nobleId })).toThrow(RangeError);
    expect(() => chooseNoble(pending, other, { type: 'CHOOSE_NOBLE', nobleId })).toThrow(RangeError);
    expect(() => chooseNoble(pending, actor, { type: 'CHOOSE_NOBLE', nobleId: 'missing' })).toThrow(RangeError);
    expect(() => chooseNoble(pending, actor,
      { type: 'CHOOSE_NOBLE', nobleId: initial.availableNobleIds[1] })).toThrow(RangeError);
    expect(pending).toEqual(snapshot);
  });

  it('보석이 10개를 넘으면 귀족 방문보다 반환이 먼저다', () => {
    const { state: initial, actor } = setup();
    const nobleId = initial.availableNobleIds[0];
    const qualified = grantBonuses(initial, actor, requiredColors(nobleId));
    const state: ServerGameState = {
      ...qualified,
      players: {
        ...qualified.players,
        [actor]: {
          ...qualified.players[actor],
          gems: { white: 10, blue: 0, green: 0, red: 0, black: 0, gold: 1 },
        },
      },
    };
    expect(() => resolveNobleVisit(state, actor)).toThrow(RangeError);
    expect(state.players[actor].nobleIds).toEqual([]);
  });

  it('잘못된 공개 귀족 목록은 자격 검사에서 거부한다', () => {
    const { state, actor } = setup();
    expect(() => eligibleNobleIds({ ...state, availableNobleIds: ['missing'] }, actor)).toThrow(RangeError);
    expect(() => eligibleNobleIds({ ...state, availableNobleIds: [state.availableNobleIds[0], state.availableNobleIds[0]] }, actor)).toThrow(RangeError);
  });
});
