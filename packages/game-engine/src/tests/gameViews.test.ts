import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../rules/initialState';
import { toPrivatePlayerView, toPublicGameView } from '../views/gameViews';

describe('공개·개인 게임 뷰 분리', () => {
  it('덱 순서와 다른 사람의 예약 카드 ID를 공개 뷰에 넣지 않는다', () => {
    const state = createInitialGameState(['host', 'guest'], 42);
    const secretDeckCard = state.decks[1][0];
    const secretReservedCard = state.decks[2][0];
    state.decks[2].shift();
    state.players.guest.reservedCardIds.push(secretReservedCard);

    const publicView = toPublicGameView(state);
    const hostPrivate = toPrivatePlayerView(state, 'host');
    const guestPrivate = toPrivatePlayerView(state, 'guest');

    expect(publicView.deckCounts[1]).toBe(state.decks[1].length);
    expect(publicView.players.guest.reservedCount).toBe(1);
    expect(JSON.stringify(publicView)).not.toContain(secretDeckCard);
    expect(JSON.stringify(publicView)).not.toContain(secretReservedCard);
    expect(JSON.stringify(hostPrivate)).not.toContain(secretReservedCard);
    expect(guestPrivate.reservedCardIds).toEqual([secretReservedCard]);
    expect(() => toPrivatePlayerView(state, 'outsider')).toThrow(RangeError);
  });

  it('반환한 뷰의 변경이 원본 서버 상태에 영향을 주지 않는다', () => {
    const state = createInitialGameState(['host', 'guest'], 42);
    const publicView = toPublicGameView(state);
    const privateView = toPrivatePlayerView(state, 'host');
    publicView.playerOrder.pop();
    publicView.market[1][0] = null;
    publicView.players.host.gems.white = 99;
    privateView.reservedCardIds.push('fake');
    expect(state.playerOrder).toHaveLength(2);
    expect(state.market[1][0]).not.toBeNull();
    expect(state.players.host.gems.white).toBe(0);
    expect(state.players.host.reservedCardIds).toEqual([]);
  });
});
