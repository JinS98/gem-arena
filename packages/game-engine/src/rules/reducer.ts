import { CARD_COLORS, getDevelopmentCard } from '../data/catalog';
import type { GameAction, ServerGameState } from '../types/index';
import { buyCard } from './buyCard';
import { discardExcessGems, excessGemCount, isValidInventory, takeGems } from './gems';
import { chooseNoble, resolveNobleVisit } from './nobles';
import { countCardBonuses, remainingCardCost } from './payment';
import { reserveCard } from './reserveCard';
import { completeTurn, determineWinnerIds } from './turnEnd';

/** Whether this player has any legal basic action other than PASS. */
export function hasLegalBasicAction(state: ServerGameState, playerId: string): boolean {
  const player = state.players[playerId];
  if (!player) throw new RangeError('플레이어가 없습니다');
  if (!isValidInventory(state.bank) || !isValidInventory(player.gems)) {
    throw new RangeError('보석 상태가 유효하지 않습니다');
  }
  if (CARD_COLORS.some((color) => state.bank[color] > 0)) return true;
  if (player.reservedCardIds.length < 3 &&
      (Object.values(state.market).some((row) => row.some((id) => id !== null)) ||
       Object.values(state.decks).some((deck) => deck.length > 0))) return true;

  const bonuses = countCardBonuses(player.purchasedCardIds);
  const offeredIds = [...Object.values(state.market).flat().filter((id): id is string => id !== null),
    ...player.reservedCardIds];
  return offeredIds.some((id) => {
    const card = getDevelopmentCard(id);
    if (!card) throw new RangeError('구매 가능한 카드 ID가 유효하지 않습니다');
    const remaining = remainingCardCost(card.cost, bonuses);
    const goldNeeded = CARD_COLORS.reduce((sum, color) =>
      sum + Math.max(0, remaining[color] - player.gems[color]), 0);
    return goldNeeded <= player.gems.gold;
  });
}

function finishResolvedTurn(state: ServerGameState, playerId: string): ServerGameState {
  if (state.phase === 'choosingNoble') return state;
  if (state.consecutivePasses >= state.playerOrder.length) {
    return { ...state, phase: 'finished', winnerIds: determineWinnerIds(state) };
  }
  return completeTurn(state, playerId);
}

function finishAfterBasicAction(state: ServerGameState, playerId: string, excess: number): ServerGameState {
  if (excess > 0) return { ...state, phase: 'discarding' };
  return finishResolvedTurn(resolveNobleVisit(state, playerId), playerId);
}

/** Apply one authorized action to private state; caller handles identity, version conflicts and idempotency. */
export function reduceGameAction(
  state: ServerGameState, playerId: string, action: GameAction,
): ServerGameState {
  if (!Number.isSafeInteger(state.version) || state.version < 0 ||
      state.version === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('게임 버전이 유효하지 않습니다');
  }
  if (!Number.isSafeInteger(state.consecutivePasses) || state.consecutivePasses < 0 ||
      state.consecutivePasses >= state.playerOrder.length) {
    throw new RangeError('연속 패스 수가 유효하지 않습니다');
  }
  if (state.phase !== 'playing' && state.phase !== 'discarding' && state.phase !== 'choosingNoble') {
    throw new RangeError('행동할 수 없는 게임 단계입니다');
  }
  if (state.playerOrder[state.turnIndex] !== playerId || !Object.hasOwn(state.players, playerId)) {
    throw new RangeError('현재 플레이어가 아닙니다');
  }
  if (state.phase === 'playing' && excessGemCount(state.players[playerId].gems) > 0) {
    throw new RangeError('초과 보석 반환 단계가 필요합니다');
  }
  if (!action || typeof action !== 'object') throw new RangeError('행동이 유효하지 않습니다');

  let next: ServerGameState;
  if (state.phase === 'discarding') {
    if (action.type !== 'DISCARD_GEMS') throw new RangeError('초과 보석을 먼저 반환해야 합니다');
    const transfer = discardExcessGems(state.bank, state.players[playerId].gems, action.gems);
    const afterDiscard: ServerGameState = {
      ...state,
      phase: 'playing',
      bank: transfer.bank,
      players: {
        ...state.players,
        [playerId]: { ...state.players[playerId], gems: transfer.gems },
      },
    };
    next = finishResolvedTurn(resolveNobleVisit(afterDiscard, playerId), playerId);
  } else if (state.phase === 'choosingNoble') {
    if (action.type !== 'CHOOSE_NOBLE') throw new RangeError('귀족을 먼저 선택해야 합니다');
    next = finishResolvedTurn(chooseNoble(state, playerId, action), playerId);
  } else {
    if (state.turnNobleResolved) throw new RangeError('이미 완료된 턴입니다');
    switch (action.type) {
      case 'TAKE_GEMS': {
        const transfer = takeGems(state.bank, state.players[playerId].gems, action.colors);
        next = finishAfterBasicAction({
          ...state,
          consecutivePasses: 0,
          bank: transfer.bank,
          players: {
            ...state.players,
            [playerId]: { ...state.players[playerId], gems: transfer.gems },
          },
        }, playerId, transfer.excess);
        break;
      }
      case 'BUY_CARD':
        next = finishAfterBasicAction({
          ...buyCard(state, playerId, action), consecutivePasses: 0,
        }, playerId, 0);
        break;
      case 'RESERVE_CARD': {
        const result = reserveCard(state, playerId, action);
        next = finishAfterBasicAction({ ...result.state, consecutivePasses: 0 }, playerId, result.excess);
        break;
      }
      case 'PASS': {
        if (hasLegalBasicAction(state, playerId)) throw new RangeError('합법적인 행동이 있어 패스할 수 없습니다');
        const visited = resolveNobleVisit(state, playerId);
        const scored = visited.players[playerId].score !== state.players[playerId].score ||
          visited.phase === 'choosingNoble';
        next = finishResolvedTurn({
          ...visited,
          consecutivePasses: scored ? 0 : state.consecutivePasses + 1,
        }, playerId);
        break;
      }
      default:
        throw new RangeError('현재 단계에서 사용할 수 없는 행동입니다');
    }
  }
  return { ...next, version: state.version + 1 };
}
