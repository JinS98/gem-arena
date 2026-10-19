import { getDevelopmentCard } from '../data/catalog';
import type { CardLevel, GameAction, ServerGameState } from '../types/index';
import { excessGemCount, isValidInventory } from './gems';

export type ReserveCardAction = Extract<GameAction, { type: 'RESERVE_CARD' }>;
export interface ReserveCardResult { state: ServerGameState; excess: number }

function isCardLevel(value: unknown): value is CardLevel {
  return value === 1 || value === 2 || value === 3;
}

/** Reserve a public card or the top of a private deck; keep the returned state server-only. */
export function reserveCard(
  state: ServerGameState, playerId: string, action: ReserveCardAction,
): ReserveCardResult {
  if (state.phase !== 'playing' || state.turnNobleResolved || state.playerOrder[state.turnIndex] !== playerId ||
      !Object.hasOwn(state.players, playerId)) {
    throw new RangeError('현재 플레이어의 예약 턴이 아닙니다');
  }
  const player = state.players[playerId];
  if (player.reservedCardIds.length >= 3) throw new RangeError('예약 카드는 최대 3장입니다');
  if (!isValidInventory(state.bank) || !isValidInventory(player.gems) || excessGemCount(player.gems) > 0) {
    throw new RangeError('보석 상태가 유효하지 않습니다');
  }

  const hasCardId = typeof action.cardId === 'string';
  const hasLevel = action.level !== undefined;
  if (hasCardId === hasLevel) throw new RangeError('공개 카드 ID 또는 비공개 덱 단계 하나만 선택해야 합니다');

  let cardId: string;
  let market = state.market;
  let decks = state.decks;
  if (hasCardId) {
    const card = getDevelopmentCard(action.cardId!);
    if (!card) throw new RangeError('존재하지 않는 카드입니다');
    const level = card.level;
    const slot = state.market[level].indexOf(card.id);
    if (slot < 0 || state.market[level].lastIndexOf(card.id) !== slot) {
      throw new RangeError('시장에 없는 카드입니다');
    }
    const [replacementId, ...remainingDeck] = state.decks[level];
    if (replacementId && getDevelopmentCard(replacementId)?.level !== level) {
      throw new RangeError('보충할 카드의 단계가 유효하지 않습니다');
    }
    const nextRow = [...state.market[level]];
    nextRow[slot] = replacementId ?? null;
    market = { ...state.market, [level]: nextRow };
    decks = { ...state.decks, [level]: remainingDeck };
    cardId = card.id;
  } else {
    if (!isCardLevel(action.level)) throw new RangeError('덱 단계가 유효하지 않습니다');
    const level = action.level;
    const [topId, ...remainingDeck] = state.decks[level];
    if (!topId || getDevelopmentCard(topId)?.level !== level) {
      throw new RangeError('예약할 덱 카드가 없습니다');
    }
    cardId = topId;
    decks = { ...state.decks, [level]: remainingDeck };
  }

  const receivesGold = state.bank.gold > 0;
  const bank = { ...state.bank, gold: state.bank.gold - Number(receivesGold) };
  const gems = { ...player.gems, gold: player.gems.gold + Number(receivesGold) };
  return {
    state: {
      ...state,
      bank,
      market,
      decks,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          gems,
          reservedCardIds: [...player.reservedCardIds, cardId],
        },
      },
    },
    excess: excessGemCount(gems),
  };
}
