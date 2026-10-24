import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../rules/initialState';
import { toPrivatePlayerView, toPublicGameView } from '../views/gameViews';
import { reserveCard } from '../rules/reserveCard';
import { buyCard } from '../rules/buyCard';
import { forfeitPlayer } from '../rules/forfeit';
import { getDevelopmentCard } from '../data/catalog';

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

  it('시장 예약은 앞면 ID를 공개하고 덱 예약은 단계와 뒷면만 공개한다', () => {
    const initial = createInitialGameState(['host', 'guest'], 42);
    const uid = initial.playerOrder[initial.turnIndex];
    const faceUpId = initial.market[1][0]!;
    const hiddenId = initial.decks[3][0];
    const first = reserveCard(initial, uid, { type: 'RESERVE_CARD', cardId: faceUpId }).state;
    const state = reserveCard(first, uid, { type: 'RESERVE_CARD', level: 3 }).state;
    const publicView = toPublicGameView(state);
    expect(publicView.players[uid].reservedCards).toEqual([
      { cardId: faceUpId, level: 1 }, { cardId: null, level: 3 },
    ]);
    expect(state.players[uid].publicReservedCardIds).toEqual([faceUpId]);
    expect(JSON.stringify(publicView)).not.toContain(hiddenId);
    expect(toPrivatePlayerView(state, uid).reservedCardIds).toEqual([faceUpId, hiddenId]);
    expect(initial.players[uid].publicReservedCardIds).toEqual([]);
    publicView.players[uid].reservedCards![0].cardId = 'changed';
    expect(state.players[uid].publicReservedCardIds).toEqual([faceUpId]);
  });

  it('공개 여부를 모르는 이전 예약은 안전하게 뒷면으로 표시한다', () => {
    const state = createInitialGameState(['host', 'guest'], 42);
    const id = state.decks[2].shift()!;
    state.players.guest.reservedCardIds = [id];
    delete state.players.guest.publicReservedCardIds;
    expect(toPublicGameView(state).players.guest.reservedCards).toEqual([{ cardId: null, level: 2 }]);
    expect(JSON.stringify(toPublicGameView(state))).not.toContain(id);
  });

  it('예약 구매와 기권 뒤에는 공개 예약 정보도 제거한다', () => {
    const initial = createInitialGameState(['host', 'guest'], 42);
    const uid = initial.playerOrder[initial.turnIndex];
    const cardId = initial.market[1][0]!;
    const reserved = reserveCard(initial, uid, { type: 'RESERVE_CARD', cardId }).state;
    const card = getDevelopmentCard(cardId)!;
    reserved.players[uid].gems = { ...card.cost, gold: 1 };
    const purchased = buyCard(reserved, uid, { type: 'BUY_CARD', cardId, source: 'reserved', payment: { ...card.cost, gold: 0 } });
    expect(purchased.players[uid].publicReservedCardIds).toEqual([]);
    expect(toPublicGameView(purchased).players[uid].reservedCards).toEqual([]);
    const forfeited = forfeitPlayer(reserved, uid);
    expect(forfeited.players[uid].publicReservedCardIds).toEqual([]);
    expect(toPublicGameView(forfeited).players[uid].reservedCards).toEqual([]);
  });
});
