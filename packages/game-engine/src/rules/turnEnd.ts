import type { ServerGameState } from '../types/index.js';

function assertTurnOrder(state: ServerGameState): void {
  const { playerOrder, firstPlayerIndex, turnIndex } = state;
  if (playerOrder.length < 2 || playerOrder.length > 4 ||
      new Set(playerOrder).size !== playerOrder.length ||
      !Number.isInteger(firstPlayerIndex) || firstPlayerIndex < 0 || firstPlayerIndex >= playerOrder.length ||
      !Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= playerOrder.length ||
      playerOrder.some((id) => !Object.hasOwn(state.players, id))) {
    throw new RangeError('턴 순서가 유효하지 않습니다');
  }
}

/** Return co-winners in turn order: highest score, then fewest purchased cards. */
export function determineWinnerIds(state: ServerGameState): string[] {
  assertTurnOrder(state);
  let bestScore = -1;
  let fewestCards = Infinity;
  let winnerIds: string[] = [];
  for (const id of state.playerOrder) {
    const player = state.players[id];
    if (!Number.isSafeInteger(player.score) || player.score < 0 ||
        !Array.isArray(player.purchasedCardIds)) {
      throw new RangeError('플레이어 점수 또는 구매 카드가 유효하지 않습니다');
    }
    const cardCount = player.purchasedCardIds.length;
    if (player.score > bestScore || (player.score === bestScore && cardCount < fewestCards)) {
      bestScore = player.score;
      fewestCards = cardCount;
      winnerIds = [id];
    } else if (player.score === bestScore && cardCount === fewestCards) {
      winnerIds.push(id);
    }
  }
  return winnerIds;
}

/** Complete a resolved turn; the reducer owns action sequencing and version changes. */
export function completeTurn(state: ServerGameState, playerId: string): ServerGameState {
  if (state.phase !== 'playing' || !state.turnNobleResolved) {
    throw new RangeError('귀족 방문을 마친 진행 중인 턴만 종료할 수 있습니다');
  }
  assertTurnOrder(state);
  if (state.playerOrder[state.turnIndex] !== playerId ||
      (state.finalRoundTriggeredBy !== null && !state.playerOrder.includes(state.finalRoundTriggeredBy))) {
    throw new RangeError('현재 플레이어 또는 최종 라운드 상태가 유효하지 않습니다');
  }
  const score = state.players[playerId].score;
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new RangeError('현재 플레이어 점수가 유효하지 않습니다');
  }

  const finalRoundTriggeredBy = state.finalRoundTriggeredBy ?? (score >= 15 ? playerId : null);
  const lastIndex = (state.firstPlayerIndex + state.playerOrder.length - 1) % state.playerOrder.length;
  if (finalRoundTriggeredBy !== null && state.turnIndex === lastIndex) {
    return {
      ...state,
      phase: 'finished',
      finalRoundTriggeredBy,
      winnerIds: determineWinnerIds(state),
    };
  }
  return {
    ...state,
    turnIndex: (state.turnIndex + 1) % state.playerOrder.length,
    turnNobleResolved: false,
    finalRoundTriggeredBy,
  };
}
