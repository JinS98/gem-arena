import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../rules/initialState';
import { resolveNobleVisit } from '../rules/nobles';
import { completeTurn, determineWinnerIds } from '../rules/turnEnd';
import type { ServerGameState } from '../types/index';

function game(playerCount: 2 | 3 | 4, firstPlayerIndex = 0): ServerGameState {
  const ids = ['a', 'b', 'c', 'd'].slice(0, playerCount);
  return { ...createInitialGameState(ids, 42), firstPlayerIndex, turnIndex: firstPlayerIndex };
}

function withScore(state: ServerGameState, playerId: string, score: number, cards = 0): ServerGameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId], score,
        purchasedCardIds: state.decks[1].slice(0, cards),
      },
    },
  };
}

function resolved(state: ServerGameState): ServerGameState {
  return { ...state, turnNobleResolved: true };
}

describe('턴 종료와 최종 라운드', () => {
  it('14점 이하에서는 라운드 끝도 게임을 종료하지 않고 다음 턴의 귀족 판정을 초기화한다', () => {
    const state = resolved(withScore({ ...game(3, 1), turnIndex: 0 }, 'a', 14));
    const snapshot = structuredClone(state);
    const next = completeTurn(state, 'a');
    expect(next.phase).toBe('playing');
    expect(next.turnIndex).toBe(1);
    expect(next.turnNobleResolved).toBe(false);
    expect(next.finalRoundTriggeredBy).toBeNull();
    expect(next.winnerIds).toEqual([]);
    expect(next.version).toBe(state.version);
    expect(state).toEqual(snapshot);
  });

  it('무작위 첫 플레이어를 기준으로 현재 라운드의 나머지 턴을 모두 마친다', () => {
    let state = resolved(withScore(game(4, 2), 'c', 15));
    state = completeTurn(state, 'c');
    expect(state.turnIndex).toBe(3);
    expect(state.finalRoundTriggeredBy).toBe('c');
    expect(state.phase).toBe('playing');

    state = completeTurn(resolved(withScore(state, 'd', 16)), 'd');
    expect(state.turnIndex).toBe(0);
    expect(state.finalRoundTriggeredBy).toBe('c');
    state = completeTurn(resolved(state), 'a');
    expect(state.turnIndex).toBe(1);
    state = completeTurn(resolved(state), 'b');
    expect(state.phase).toBe('finished');
    expect(state.turnIndex).toBe(1);
    expect(state.winnerIds).toEqual(['d']);
    expect(state.version).toBe(0);
    expect(() => completeTurn(state, 'b')).toThrow(RangeError);
  });

  it('중간 순서에서 15점에 도달하면 남은 순서까지만 진행한다', () => {
    let state = resolved(withScore({ ...game(3, 1), turnIndex: 2 }, 'c', 15));
    state = completeTurn(state, 'c');
    expect(state.turnIndex).toBe(0);
    expect(state.phase).toBe('playing');
    state = completeTurn(resolved(state), 'a');
    expect(state.phase).toBe('finished');
    expect(state.winnerIds).toEqual(['c']);
  });

  it.each([2, 3, 4] as const)('%i인 게임에서 라운드 마지막 순서가 15점이면 즉시 종료한다', (count) => {
    const firstPlayerIndex = 1;
    const lastIndex = (firstPlayerIndex + count - 1) % count;
    const state = game(count, firstPlayerIndex);
    const actor = state.playerOrder[lastIndex];
    const next = completeTurn(resolved(withScore({ ...state, turnIndex: lastIndex }, actor, 15)), actor);
    expect(next.phase).toBe('finished');
    expect(next.finalRoundTriggeredBy).toBe(actor);
    expect(next.winnerIds).toEqual([actor]);
    expect(next.turnIndex).toBe(lastIndex);
  });

  it('귀족 방문 완료 전에는 15점이어도 턴 종료를 거부한다', () => {
    const state = withScore(game(2), 'a', 15);
    expect(() => completeTurn(state, 'a')).toThrow(RangeError);
    const afterNobleVisit = resolveNobleVisit(state, 'a');
    const next = completeTurn(afterNobleVisit, 'a');
    expect(next.finalRoundTriggeredBy).toBe('a');
    expect(next.phase).toBe('playing');
  });

  it('동점이면 구매 카드 수가 적은 사람을, 그것도 같으면 공동 승자를 반환한다', () => {
    let state = game(4);
    state = withScore(state, 'a', 15, 5);
    state = withScore(state, 'b', 15, 3);
    state = withScore(state, 'c', 14, 1);
    state = withScore(state, 'd', 15, 3);
    expect(determineWinnerIds(state)).toEqual(['b', 'd']);
    expect(determineWinnerIds(withScore(state, 'd', 15, 4))).toEqual(['b']);
    expect(determineWinnerIds(withScore(state, 'c', 16, 9))).toEqual(['c']);
  });

  it('잘못된 단계·행위자·라운드 경계·점수는 원본을 변경하지 않고 거부한다', () => {
    const state = resolved(game(2));
    const actor = state.playerOrder[state.turnIndex];
    const other = state.playerOrder.find((id) => id !== actor)!;
    const snapshot = structuredClone(state);
    expect(() => completeTurn(state, other)).toThrow(RangeError);
    expect(() => completeTurn({ ...state, phase: 'choosingNoble' }, actor)).toThrow(RangeError);
    expect(() => completeTurn({ ...state, turnNobleResolved: false }, actor)).toThrow(RangeError);
    expect(() => completeTurn({ ...state, firstPlayerIndex: 3 }, actor)).toThrow(RangeError);
    expect(() => completeTurn({ ...state, finalRoundTriggeredBy: 'missing' }, actor)).toThrow(RangeError);
    expect(() => completeTurn(withScore(state, actor, -1), actor)).toThrow(RangeError);
    expect(() => determineWinnerIds(withScore(state, other, Number.NaN))).toThrow(RangeError);
    expect(state).toEqual(snapshot);
  });
});
