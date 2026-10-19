import { describe, expect, it } from 'vitest';
import { CARD_COLORS, getDevelopmentCard, getNoble } from '../data/catalog';
import { createInitialGameState } from '../rules/initialState';
import { hasLegalBasicAction, reduceGameAction } from '../rules/reducer';
import type { CardLevel, GemColor, Inventory, ServerGameState } from '../types/index';

const empty: Inventory = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };

function game() {
  const state = createInitialGameState(['a', 'b'], 42);
  const actor = state.playerOrder[state.turnIndex];
  const other = state.playerOrder[(state.turnIndex + 1) % 2];
  return { state, actor, other };
}

function withGems(state: ServerGameState, playerId: string, gems: Inventory): ServerGameState {
  const bank = { ...state.bank };
  for (const color of [...CARD_COLORS, 'gold'] as const) bank[color] -= gems[color];
  return {
    ...state, bank,
    players: { ...state.players, [playerId]: { ...state.players[playerId], gems } },
  };
}

function gemTotals(state: ServerGameState): Inventory {
  const totals = { ...state.bank };
  for (const player of Object.values(state.players)) {
    for (const color of [...CARD_COLORS, 'gold'] as const) totals[color] += player.gems[color];
  }
  return totals;
}

function allCardIds(state: ServerGameState): string[] {
  return [
    ...Object.values(state.market).flat().filter((id): id is string => id !== null),
    ...Object.values(state.decks).flat(),
    ...Object.values(state.players).flatMap((player) =>
      [...player.purchasedCardIds, ...player.reservedCardIds]),
  ].sort();
}

function grantTwoNobles(state: ServerGameState, actor: string): ServerGameState {
  const nobles = state.availableNobleIds.slice(0, 2).map((id) => getNoble(id)!);
  const requiredColors = CARD_COLORS.filter((color) =>
    nobles.some((noble) => noble.requirements[color] > 0));
  const picked: string[] = [];
  for (const color of requiredColors) {
    picked.push(...Object.values(state.decks).flat().filter((id) =>
      getDevelopmentCard(id)?.bonusColor === color).slice(0, 3));
  }
  const owned = new Set(picked);
  const decks = Object.fromEntries(([1, 2, 3] as const).map((level) =>
    [level, state.decks[level].filter((id) => !owned.has(id))])) as Record<CardLevel, string[]>;
  const score = picked.reduce((sum, id) => sum + getDevelopmentCard(id)!.points, 0);
  return {
    ...state, decks,
    players: {
      ...state.players,
      [actor]: { ...state.players[actor], purchasedCardIds: picked, score },
    },
  };
}

function stalledGame(): ServerGameState {
  const { state, actor, other } = game();
  return {
    ...state,
    bank: { ...empty, gold: 5 },
    market: { 1: [null, null, null, null], 2: [null, null, null, null], 3: [null, null, null, null] },
    decks: { 1: [], 2: [], 3: [] },
    availableNobleIds: [],
    players: {
      ...state.players,
      [actor]: { ...state.players[actor], gems: { ...empty, white: 4, blue: 4, green: 2 } },
      [other]: { ...state.players[other], gems: { ...empty, green: 2, red: 4, black: 4 } },
    },
  };
}

describe('게임 행동 reducer', () => {
  it('보석 획득 후 귀족을 판정하고 다음 턴으로 넘기며 원본과 총 보석 수를 보존한다', () => {
    const { state, actor, other } = game();
    const snapshot = structuredClone(state);
    const next = reduceGameAction(state, actor, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] });
    expect(next.version).toBe(1);
    expect(next.phase).toBe('playing');
    expect(next.playerOrder[next.turnIndex]).toBe(other);
    expect(next.turnNobleResolved).toBe(false);
    expect(next.players[actor].gems.white).toBe(1);
    expect(next.bank.white).toBe(state.bank.white - 1);
    expect(gemTotals(next)).toEqual(gemTotals(state));
    expect(allCardIds(next)).toEqual(allCardIds(state));
    expect(state).toEqual(snapshot);
    expect(next.players[other]).toBe(state.players[other]);
  });

  it('초과 보석 반환을 완료할 때까지 턴을 넘기지 않고 반환 행동에도 버전을 한 번 올린다', () => {
    const { state: initial, actor, other } = game();
    const state = withGems(initial, actor, { ...empty, white: 3, blue: 3, green: 3 });
    const gained = reduceGameAction(state, actor, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] });
    expect(gained.phase).toBe('discarding');
    expect(gained.version).toBe(1);
    expect(gained.playerOrder[gained.turnIndex]).toBe(actor);
    expect(gained.players[actor].gems.white + gained.players[actor].gems.blue + gained.players[actor].gems.green).toBe(12);
    const snapshot = structuredClone(gained);
    expect(() => reduceGameAction(gained, actor, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] })).toThrow(RangeError);
    expect(() => reduceGameAction(gained, actor, { type: 'DISCARD_GEMS', gems: { ...empty, white: 1 } })).toThrow(RangeError);
    expect(gained).toEqual(snapshot);
    const next = reduceGameAction(gained, actor,
      { type: 'DISCARD_GEMS', gems: { ...empty, white: 1, blue: 1 } });
    expect(next.version).toBe(2);
    expect(next.phase).toBe('playing');
    expect(next.playerOrder[next.turnIndex]).toBe(other);
    expect(gemTotals(next)).toEqual(gemTotals(initial));
    expect(allCardIds(next)).toEqual(allCardIds(initial));
  });

  it('카드 구매는 점수와 시장을 바꾸고 한 번의 행동으로 턴을 마친다', () => {
    const { state: initial, actor, other } = game();
    const cardId = initial.market[1][0]!;
    const card = getDevelopmentCard(cardId)!;
    const payment: Inventory = { ...empty, ...card.cost };
    const state = withGems(initial, actor, payment);
    const snapshot = structuredClone(state);
    const next = reduceGameAction(state, actor,
      { type: 'BUY_CARD', cardId, source: 'market', payment });
    expect(next.version).toBe(1);
    expect(next.players[actor].purchasedCardIds).toContain(cardId);
    expect(next.players[actor].score).toBe(card.points);
    expect(next.market[1][0]).toBe(state.decks[1][0]);
    expect(next.playerOrder[next.turnIndex]).toBe(other);
    expect(gemTotals(next)).toEqual(gemTotals(state));
    expect(allCardIds(next)).toEqual(allCardIds(state));
    expect(state).toEqual(snapshot);
  });

  it('예약 황금이 10개 한도를 넘으면 반환을 기다린다', () => {
    const { state: initial, actor } = game();
    const state = withGems(initial, actor, { ...empty, white: 4, blue: 4, green: 2 });
    const cardId = state.market[1][0]!;
    const reserved = reduceGameAction(state, actor, { type: 'RESERVE_CARD', cardId });
    expect(reserved.phase).toBe('discarding');
    expect(reserved.players[actor].reservedCardIds).toEqual([cardId]);
    expect(reserved.players[actor].gems.gold).toBe(1);
    expect(reserved.bank.gold).toBe(4);
    const next = reduceGameAction(reserved, actor,
      { type: 'DISCARD_GEMS', gems: { ...empty, gold: 1 } });
    expect(next.version).toBe(2);
    expect(next.phase).toBe('playing');
    expect(gemTotals(next)).toEqual(gemTotals(initial));
    expect(allCardIds(next)).toEqual(allCardIds(initial));
  });

  it('귀족이 둘 이상 가능하면 선택을 기다리고 한 명만 방문한다', () => {
    const { state: initial, actor, other } = game();
    const state = grantTwoNobles(initial, actor);
    const next = reduceGameAction(state, actor, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] });
    expect(next.phase).toBe('choosingNoble');
    expect(next.version).toBe(1);
    expect(next.playerOrder[next.turnIndex]).toBe(actor);
    expect(next.players[actor].nobleIds).toEqual([]);
    expect(() => reduceGameAction(next, actor,
      { type: 'CHOOSE_NOBLE', nobleId: 'missing' })).toThrow(RangeError);
    const nobleId = state.availableNobleIds[0];
    const chosen = reduceGameAction(next, actor, { type: 'CHOOSE_NOBLE', nobleId });
    expect(chosen.version).toBe(2);
    expect(chosen.players[actor].nobleIds).toEqual([nobleId]);
    expect(chosen.players[actor].score).toBe(state.players[actor].score + 3);
    expect(chosen.availableNobleIds).not.toContain(nobleId);
    expect(chosen.playerOrder[chosen.turnIndex]).toBe(other);
  });

  it('합법 행동이 있으면 패스를 거부하고, 모두 연속 패스하면 동점 규칙으로 종료한다', () => {
    const { state: initial, actor } = game();
    expect(hasLegalBasicAction(initial, actor)).toBe(true);
    expect(() => reduceGameAction(initial, actor, { type: 'PASS' })).toThrow(RangeError);
    const state = stalledGame();
    expect(hasLegalBasicAction(state, actor)).toBe(false);
    const first = reduceGameAction(state, actor, { type: 'PASS' });
    expect(first.phase).toBe('playing');
    expect(first.consecutivePasses).toBe(1);
    expect(first.version).toBe(1);
    const secondActor = first.playerOrder[first.turnIndex];
    const finished = reduceGameAction(first, secondActor, { type: 'PASS' });
    expect(finished.phase).toBe('finished');
    expect(finished.consecutivePasses).toBe(2);
    expect(finished.winnerIds).toEqual(state.playerOrder);
    expect(finished.version).toBe(2);
    expect(() => reduceGameAction(finished, actor, { type: 'PASS' })).toThrow(RangeError);
  });

  it('행동이 가능한 카드가 남아 있으면 빈 은행이어도 패스를 거부한다', () => {
    const state = stalledGame();
    const actor = state.playerOrder[state.turnIndex];
    const candidate = getDevelopmentCard('L1-WHITE-05')!;
    const withReserve: ServerGameState = {
      ...state,
      players: {
        ...state.players,
        [actor]: { ...state.players[actor], reservedCardIds: [candidate.id] },
      },
    };
    expect(hasLegalBasicAction(withReserve, actor)).toBe(true);
    expect(() => reduceGameAction(withReserve, actor, { type: 'PASS' })).toThrow(RangeError);
  });

  it('reducer가 15점 도달 뒤 남은 순서를 진행하고 결과를 확정한다', () => {
    const { state: initial, actor, other } = game();
    const state: ServerGameState = {
      ...initial,
      players: {
        ...initial.players,
        [actor]: { ...initial.players[actor], score: 15 },
      },
    };
    const first = reduceGameAction(state, actor, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] });
    expect(first.finalRoundTriggeredBy).toBe(actor);
    expect(first.phase).toBe('playing');
    const finished = reduceGameAction(first, other,
      { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] });
    expect(finished.phase).toBe('finished');
    expect(finished.winnerIds).toEqual([actor]);
    expect(finished.version).toBe(2);
  });

  it('잘못된 턴·단계·버전·행동은 원본을 바꾸지 않고 거부한다', () => {
    const { state, actor, other } = game();
    const snapshot = structuredClone(state);
    const take = { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] as GemColor[] } as const;
    expect(() => reduceGameAction(state, other, take)).toThrow(RangeError);
    expect(() => reduceGameAction({ ...state, phase: 'finished' }, actor, take)).toThrow(RangeError);
    expect(() => reduceGameAction({ ...state, version: Number.MAX_SAFE_INTEGER }, actor, take)).toThrow(RangeError);
    expect(() => reduceGameAction({ ...state, consecutivePasses: -1 }, actor, take)).toThrow(RangeError);
    expect(() => reduceGameAction(withGems(state, actor,
      { ...empty, white: 4, blue: 4, green: 3 }), actor, take)).toThrow(RangeError);
    expect(() => reduceGameAction(state, actor, { type: 'DISCARD_GEMS', gems: empty })).toThrow(RangeError);
    expect(() => reduceGameAction(state, actor, { type: 'CHOOSE_NOBLE', nobleId: 'missing' })).toThrow(RangeError);
    expect(() => reduceGameAction(state, actor,
      { type: 'TAKE_GEMS', colors: ['gold' as GemColor] })).toThrow(RangeError);
    expect(state).toEqual(snapshot);
  });
});
