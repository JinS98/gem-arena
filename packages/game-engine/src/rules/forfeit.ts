import type { Gem, Inventory, ServerGameState } from '../types/index.js';
import { determineWinnerIds, nextActiveTurnIndex } from './turnEnd.js';

const gems: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const emptyGems = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

/** Remove a player from an ongoing game without returning cards or nobles to circulation. */
export function forfeitPlayer(state: ServerGameState, playerId: string): ServerGameState {
  if (!['playing', 'discarding', 'choosingNoble'].includes(state.phase) ||
      !state.playerOrder.includes(playerId) || !state.players[playerId] ||
      state.players[playerId].forfeited === true ||
      !Number.isSafeInteger(state.version) || state.version < 0 ||
      state.version === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('기권할 수 없는 게임 상태입니다');
  }
  const player = state.players[playerId];
  const bank = { ...state.bank };
  for (const gem of gems) {
    if (!Number.isSafeInteger(player.gems[gem]) || player.gems[gem] < 0 ||
        !Number.isSafeInteger(bank[gem]) || bank[gem] < 0) {
      throw new RangeError('보석 상태가 유효하지 않습니다');
    }
    bank[gem] += player.gems[gem];
  }
  const players = {
    ...state.players,
    [playerId]: {
      ...player, forfeited: true, gems: emptyGems(), purchasedCardIds: [],
      reservedCardIds: [], publicReservedCardIds: [], nobleIds: [], score: 0,
    },
  };
  const remaining = state.playerOrder.filter(uid => players[uid].forfeited !== true);
  const currentForfeited = state.playerOrder[state.turnIndex] === playerId;
  const next: ServerGameState = {
    ...state, players, bank, version: state.version + 1, consecutivePasses: 0,
    ...(currentForfeited ? { phase: 'playing' as const, turnNobleResolved: false } : {}),
  };
  if (remaining.length === 1) {
    return { ...next, phase: 'finished', winnerIds: remaining, turnIndex: state.playerOrder.indexOf(remaining[0]) };
  }
  if (currentForfeited) {
    // Completing the last remaining turn of a final round ends the game.
    const roundLast = Array.from({ length: state.playerOrder.length }, (_, offset) =>
      (state.firstPlayerIndex + offset) % state.playerOrder.length).filter(index =>
      state.players[state.playerOrder[index]].forfeited !== true).at(-1);
    if (state.finalRoundTriggeredBy !== null && state.turnIndex === roundLast) {
      return { ...next, phase: 'finished', winnerIds: determineWinnerIds(next) };
    }
    return { ...next, turnIndex: nextActiveTurnIndex(next, state.turnIndex) };
  }
  return next;
}
