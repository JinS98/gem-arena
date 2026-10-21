import { CARD_COLORS, getNoble } from '../data/catalog.js';
import type { GameAction, ServerGameState } from '../types/index.js';
import { excessGemCount } from './gems.js';
import { countCardBonuses } from './payment.js';

export type ChooseNobleAction = Extract<GameAction, { type: 'CHOOSE_NOBLE' }>;

/** Only purchased-card bonuses count toward visible noble requirements. */
export function eligibleNobleIds(state: ServerGameState, playerId: string): string[] {
  if (!Object.hasOwn(state.players, playerId)) throw new RangeError('플레이어가 없습니다');
  if (new Set(state.availableNobleIds).size !== state.availableNobleIds.length) {
    throw new RangeError('공개 귀족 목록에 중복이 있습니다');
  }
  const bonuses = countCardBonuses(state.players[playerId].purchasedCardIds);
  return state.availableNobleIds.filter((id) => {
    const noble = getNoble(id);
    if (!noble) throw new RangeError('존재하지 않는 공개 귀족입니다');
    return CARD_COLORS.every((color) => bonuses[color] >= noble.requirements[color]);
  });
}

function assertCurrentPlayer(state: ServerGameState, playerId: string, phase: 'playing' | 'choosingNoble'): void {
  if (state.phase !== phase || state.turnNobleResolved ||
      state.playerOrder[state.turnIndex] !== playerId || !Object.hasOwn(state.players, playerId)) {
    throw new RangeError('현재 귀족 방문을 처리할 수 없습니다');
  }
  if (excessGemCount(state.players[playerId].gems) > 0) {
    throw new RangeError('초과 보석을 먼저 반환해야 합니다');
  }
}

function claimNoble(state: ServerGameState, playerId: string, nobleId: string): ServerGameState {
  const noble = getNoble(nobleId)!;
  const player = state.players[playerId];
  const nextScore = player.score + noble.points;
  if (player.nobleIds.includes(nobleId) || !Number.isSafeInteger(player.score) ||
      player.score < 0 || !Number.isSafeInteger(nextScore)) {
    throw new RangeError('귀족 보유 또는 점수가 유효하지 않습니다');
  }
  return {
    ...state,
    phase: 'playing',
    turnNobleResolved: true,
    availableNobleIds: state.availableNobleIds.filter((id) => id !== nobleId),
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        nobleIds: [...player.nobleIds, nobleId],
        score: nextScore,
      },
    },
  };
}

/** Run after the basic action and any required gem discard, before advancing the turn. */
export function resolveNobleVisit(state: ServerGameState, playerId: string): ServerGameState {
  assertCurrentPlayer(state, playerId, 'playing');
  const eligible = eligibleNobleIds(state, playerId);
  if (eligible.length === 0) return { ...state, turnNobleResolved: true };
  if (eligible.length === 1) return claimNoble(state, playerId, eligible[0]);
  return { ...state, phase: 'choosingNoble' };
}

/** A player who qualifies for multiple nobles must choose exactly one. */
export function chooseNoble(
  state: ServerGameState, playerId: string, action: ChooseNobleAction,
): ServerGameState {
  assertCurrentPlayer(state, playerId, 'choosingNoble');
  if (!eligibleNobleIds(state, playerId).includes(action.nobleId)) {
    throw new RangeError('선택할 수 없는 귀족입니다');
  }
  return claimNoble(state, playerId, action.nobleId);
}
