import { getDevelopmentCard } from '../data/catalog.js';
import type { GameAction, ServerGameState } from '../types/index.js';
import { countCardBonuses, payForCard } from './payment.js';

export type BuyCardAction = Extract<GameAction, { type: 'BUY_CARD' }>;

/** Apply a purchase to private game state without advancing the turn or version. */
export function buyCard(state: ServerGameState, playerId: string, action: BuyCardAction): ServerGameState {
  if (state.phase !== 'playing' || state.turnNobleResolved || state.playerOrder[state.turnIndex] !== playerId ||
      !Object.hasOwn(state.players, playerId)) {
    throw new RangeError('현재 플레이어의 구매 턴이 아닙니다');
  }

  const player = state.players[playerId];
  const card = typeof action.cardId === 'string' ? getDevelopmentCard(action.cardId) : undefined;
  if (!card || player.purchasedCardIds.includes(card.id)) {
    throw new RangeError('구매할 수 없는 카드입니다');
  }

  const level = card.level;
  const marketSlot = state.market[level].indexOf(card.id);
  if (action.source === 'market') {
    if (marketSlot < 0 || state.market[level].lastIndexOf(card.id) !== marketSlot) {
      throw new RangeError('시장에 없는 카드입니다');
    }
  } else if (action.source === 'reserved') {
    if (player.reservedCardIds.filter((id) => id === card.id).length !== 1 || marketSlot >= 0) {
      throw new RangeError('본인 예약 카드가 아닙니다');
    }
  } else {
    throw new RangeError('카드 출처가 유효하지 않습니다');
  }

  const bonuses = countCardBonuses(player.purchasedCardIds);
  const transfer = payForCard(state.bank, player.gems, card.cost, bonuses, action.payment);
  const nextScore = player.score + card.points;
  if (!Number.isSafeInteger(player.score) || player.score < 0 || !Number.isSafeInteger(nextScore)) {
    throw new RangeError('플레이어 점수가 유효하지 않습니다');
  }

  let market = state.market;
  let decks = state.decks;
  if (action.source === 'market') {
    const [replacementId, ...remainingDeck] = state.decks[level];
    if (replacementId && getDevelopmentCard(replacementId)?.level !== level) {
      throw new RangeError('보충할 카드의 단계가 유효하지 않습니다');
    }
    const nextRow = [...state.market[level]];
    nextRow[marketSlot] = replacementId ?? null;
    market = { ...state.market, [level]: nextRow };
    decks = { ...state.decks, [level]: remainingDeck };
  }

  return {
    ...state,
    bank: transfer.bank,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        gems: transfer.gems,
        purchasedCardIds: [...player.purchasedCardIds, card.id],
        reservedCardIds: action.source === 'reserved'
          ? player.reservedCardIds.filter((id) => id !== card.id)
          : player.reservedCardIds,
        score: nextScore,
      },
    },
    market,
    decks,
  };
}
