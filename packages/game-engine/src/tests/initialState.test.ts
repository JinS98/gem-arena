import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_CARDS, NOBLES } from '../data/catalog';
import { createInitialGameState } from '../rules/initialState';

describe('게임 초기화', () => {
  it.each([
    [2, 4, 3], [3, 5, 4], [4, 7, 5],
  ])('%i명일 때 은행·공개 귀족·플레이어를 초기화한다', (playerCount, gemsPerColor, nobleCount) => {
    const ids = Array.from({ length: playerCount }, (_, index) => `player-${index}`);
    const state = createInitialGameState(ids, 42);
    expect(state.phase).toBe('playing');
    expect(state.version).toBe(0);
    expect(state.turnNobleResolved).toBe(false);
    expect(state.consecutivePasses).toBe(0);
    expect(state.playerOrder).toEqual(ids);
    expect(state.turnIndex).toBeGreaterThanOrEqual(0);
    expect(state.turnIndex).toBeLessThan(playerCount);
    expect(state.firstPlayerIndex).toBe(state.turnIndex);
    expect(state.bank).toEqual({
      white: gemsPerColor, blue: gemsPerColor, green: gemsPerColor,
      red: gemsPerColor, black: gemsPerColor, gold: 5,
    });
    expect(state.availableNobleIds).toHaveLength(nobleCount);
    expect(new Set(state.availableNobleIds).size).toBe(nobleCount);
    expect(state.availableNobleIds.every((id) => NOBLES.some((noble) => noble.id === id))).toBe(true);
    ids.forEach((uid, seatIndex) => {
      expect(state.players[uid]).toEqual({
        uid, seatIndex, gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
        purchasedCardIds: [], reservedCardIds: [], publicReservedCardIds: [], nobleIds: [], score: 0, forfeited: false,
      });
    });
    expect(state.finalRoundTriggeredBy).toBeNull();
    expect(state.winnerIds).toEqual([]);
  });

  it('단계별 시장에 4장씩 공개하고 모든 카드를 한 번씩만 배치한다', () => {
    const state = createInitialGameState(['a', 'b'], 0);
    for (const [level, expectedDeckSize] of [[1, 36], [2, 26], [3, 16]] as const) {
      expect(state.market[level]).toHaveLength(4);
      expect(state.decks[level]).toHaveLength(expectedDeckSize);
      const expectedIds = DEVELOPMENT_CARDS.filter((card) => card.level === level).map((card) => card.id).sort();
      const actualIds = [...state.market[level], ...state.decks[level]];
      expect(new Set(actualIds).size).toBe(expectedIds.length);
      expect(actualIds.sort()).toEqual(expectedIds);
    }
  });

  it('동일 입력·시드는 동일 결과를, 다른 시드는 다른 셔플을 만든다', () => {
    const ids = ['a', 'b', 'c'];
    expect(createInitialGameState(ids, 1234)).toEqual(createInitialGameState(ids, 1234));
    expect(createInitialGameState(ids, 1234).decks).not.toEqual(createInitialGameState(ids, 1235).decks);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('반환 상태끼리 플레이어 보석과 덱을 공유하지 않는다', () => {
    const first = createInitialGameState(['a', 'b'], 42);
    const second = createInitialGameState(['a', 'b'], 42);
    first.players.a.gems.white = 1;
    first.decks[1].pop();
    expect(first.players.b.gems.white).toBe(0);
    expect(second.players.a.gems.white).toBe(0);
    expect(second.decks[1]).toHaveLength(36);
    expect(DEVELOPMENT_CARDS).toHaveLength(90);
  });

  it('잘못된 인원·중복/빈 ID·시드를 거부한다', () => {
    for (const ids of [[], ['a'], ['a', 'b', 'c', 'd', 'e'], ['a', 'a'], ['a', ' ']]) {
      expect(() => createInitialGameState(ids, 1)).toThrow(RangeError);
    }
    for (const seed of [-1, 0.5, Number.NaN, 0x100000000]) {
      expect(() => createInitialGameState(['a', 'b'], seed)).toThrow(RangeError);
    }
    expect(() => createInitialGameState(['a', 'b'], 0xffffffff)).not.toThrow();
  });
});
