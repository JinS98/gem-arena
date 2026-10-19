import { DEVELOPMENT_CARDS, NOBLES } from '../data/catalog';
import type { CardLevel, Inventory, PlayerState, ServerGameState } from '../types/index';

const MAX_SEED = 0xffffffff;
const GEMS_PER_COLOR: Record<number, number> = { 2: 4, 3: 5, 4: 7 };

function makeInventory(regularGems = 0, gold = 0): Inventory {
  return {
    white: regularGems, blue: regularGems, green: regularGems,
    red: regularGems, black: regularGems, gold,
  };
}

// The caller supplies and stores the seed. This generator must remain stable so
// an initial game can be reconstructed from the same inputs.
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function shuffle<T>(source: readonly T[], random: () => number): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Build private server state. Never send its decks to a client. */
export function createInitialGameState(playerIds: readonly string[], seed: number): ServerGameState {
  if (playerIds.length < 2 || playerIds.length > 4 ||
      playerIds.some((id) => typeof id !== 'string' || id.trim() === '') ||
      new Set(playerIds).size !== playerIds.length) {
    throw new RangeError('서로 다른 2~4명의 플레이어 ID가 필요합니다');
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError('시드는 0~4294967295의 정수여야 합니다');
  }

  const random = seededRandom(seed);
  const market = {} as ServerGameState['market'];
  const decks = {} as ServerGameState['decks'];
  for (const level of [1, 2, 3] as const satisfies readonly CardLevel[]) {
    const shuffledIds = shuffle(
      DEVELOPMENT_CARDS.filter((card) => card.level === level).map((card) => card.id), random,
    );
    market[level] = shuffledIds.slice(0, 4);
    decks[level] = shuffledIds.slice(4);
  }

  const players: Record<string, PlayerState> = Object.fromEntries(
    playerIds.map((uid, seatIndex) => [uid, {
      uid, seatIndex, gems: makeInventory(), purchasedCardIds: [],
      reservedCardIds: [], nobleIds: [], score: 0,
    }]),
  );

  const firstPlayerIndex = Math.floor(random() * playerIds.length);
  return {
    phase: 'playing', version: 0, turnNobleResolved: false,
    firstPlayerIndex, turnIndex: firstPlayerIndex,
    playerOrder: [...playerIds], players,
    bank: makeInventory(GEMS_PER_COLOR[playerIds.length], 5),
    market, decks,
    availableNobleIds: shuffle(NOBLES.map((noble) => noble.id), random).slice(0, playerIds.length + 1),
    finalRoundTriggeredBy: null, winnerIds: [],
  };
}
