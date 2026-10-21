import type { CardLevel, Inventory, ServerGameState } from '../types/index.js';

export interface PublicPlayerView {
  uid: string;
  seatIndex: number;
  gems: Inventory;
  purchasedCardIds: string[];
  nobleIds: string[];
  score: number;
  reservedCount: number;
}

export interface PublicGameView {
  phase: ServerGameState['phase'];
  version: number;
  firstPlayerIndex: number;
  turnIndex: number;
  playerOrder: string[];
  players: Record<string, PublicPlayerView>;
  bank: Inventory;
  market: ServerGameState['market'];
  deckCounts: Record<CardLevel, number>;
  availableNobleIds: string[];
  finalRoundTriggeredBy: string | null;
  winnerIds: string[];
}

export interface PrivatePlayerView {
  uid: string;
  version: number;
  reservedCardIds: string[];
}

/** Explicit allowlist: never spread ServerGameState into a client view. */
export function toPublicGameView(state: ServerGameState): PublicGameView {
  const players: PublicGameView['players'] = {};
  for (const uid of state.playerOrder) {
    const player = state.players[uid];
    if (!player) throw new RangeError(`플레이어 상태가 없습니다: ${uid}`);
    players[uid] = {
      uid: player.uid,
      seatIndex: player.seatIndex,
      gems: { ...player.gems },
      purchasedCardIds: [...player.purchasedCardIds],
      nobleIds: [...player.nobleIds],
      score: player.score,
      reservedCount: player.reservedCardIds.length,
    };
  }
  return {
    phase: state.phase,
    version: state.version,
    firstPlayerIndex: state.firstPlayerIndex,
    turnIndex: state.turnIndex,
    playerOrder: [...state.playerOrder],
    players,
    bank: { ...state.bank },
    market: {
      1: [...state.market[1]],
      2: [...state.market[2]],
      3: [...state.market[3]],
    },
    deckCounts: {
      1: state.decks[1].length,
      2: state.decks[2].length,
      3: state.decks[3].length,
    },
    availableNobleIds: [...state.availableNobleIds],
    finalRoundTriggeredBy: state.finalRoundTriggeredBy,
    winnerIds: [...state.winnerIds],
  };
}

export function toPrivatePlayerView(state: ServerGameState, uid: string): PrivatePlayerView {
  if (!state.playerOrder.includes(uid) || !state.players[uid]) {
    throw new RangeError('게임 참가자가 아닙니다');
  }
  return {
    uid,
    version: state.version,
    reservedCardIds: [...state.players[uid].reservedCardIds],
  };
}
