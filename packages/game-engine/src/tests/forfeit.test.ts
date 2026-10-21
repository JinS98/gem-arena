import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../rules/initialState';
import { forfeitPlayer } from '../rules/forfeit';
import { completeTurn, determineWinnerIds } from '../rules/turnEnd';
import { reduceGameAction } from '../rules/reducer';
import type { ServerGameState } from '../types/index';

function game(): ServerGameState {
  return { ...createInitialGameState(['a', 'b', 'c'], 42), firstPlayerIndex: 0, turnIndex: 0 };
}

describe('명시적 기권', () => {
  it('자산을 제거하고 보석을 반환하며 현재 턴을 다음 활성 참가자에게 넘긴다', () => {
    const state = game();
    state.players.a.gems.white = 2;
    state.bank.white -= 2;
    state.players.a.reservedCardIds = [state.decks[1][0]];
    state.players.a.purchasedCardIds = [state.decks[2][0]];
    state.players.a.nobleIds = [state.availableNobleIds[0]];
    state.players.a.score = 16;
    const before = structuredClone(state);
    const next = forfeitPlayer(state, 'a');
    expect(next.version).toBe(1);
    expect(next.bank.white).toBe(before.bank.white + 2);
    expect(next.players.a).toMatchObject({ forfeited: true, score: 0,
      purchasedCardIds: [], reservedCardIds: [], nobleIds: [] });
    expect(next.players.a.gems.white).toBe(0);
    expect(next.turnIndex).toBe(1);
    expect(next.phase).toBe('playing');
    expect(state).toEqual(before);
    expect(() => forfeitPlayer(next, 'a')).toThrow(RangeError);
    expect(() => reduceGameAction(next, 'a', { type: 'PASS' })).toThrow(RangeError);
  });

  it('다른 플레이어가 나가면 현재 턴을 유지하고 이후 턴에서 건너뛴다', () => {
    const next = forfeitPlayer(game(), 'b');
    expect(next.turnIndex).toBe(0);
    const afterTurn = completeTurn({ ...next, turnNobleResolved: true }, 'a');
    expect(afterTurn.turnIndex).toBe(2);
  });

  it('한 명만 남으면 즉시 종료하고 기권자는 동점 판정에서 제외한다', () => {
    let state = game();
    state.players.a.score = 20;
    state = forfeitPlayer(state, 'a');
    expect(determineWinnerIds(state)).toEqual(['b', 'c']);
    state = forfeitPlayer(state, 'b');
    expect(state.phase).toBe('finished');
    expect(state.winnerIds).toEqual(['c']);
    expect(() => forfeitPlayer(state, 'c')).toThrow(RangeError);
  });

  it('최종 라운드 마지막 활성 플레이어가 기권하면 남은 플레이어로 종료한다', () => {
    const state = game();
    state.finalRoundTriggeredBy = 'a';
    state.turnIndex = 2;
    state.players.a.score = 15;
    const next = forfeitPlayer(state, 'c');
    expect(next.phase).toBe('finished');
    expect(next.winnerIds).toEqual(['a']);
  });

  it('마지막 좌석이 먼저 기권하면 그 앞 참가자의 턴 종료에서 최종 라운드를 마친다', () => {
    const state = game();
    state.finalRoundTriggeredBy = 'a';
    state.turnIndex = 1;
    state.players.a.score = 15;
    const afterForfeit = forfeitPlayer(state, 'c');
    expect(afterForfeit.phase).toBe('playing');
    const finished = completeTurn({ ...afterForfeit, turnNobleResolved: true }, 'b');
    expect(finished.phase).toBe('finished');
    expect(finished.winnerIds).toEqual(['a']);
  });
});
