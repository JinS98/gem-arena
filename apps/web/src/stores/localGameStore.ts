import { create } from 'zustand';
import { canTakeGems, createInitialGameState, excessGemCount, hasLegalBasicAction, reduceGameAction } from '@gem-arena/engine';
import type { CardLevel, Gem, GemColor, Inventory, ServerGameState } from '@gem-arena/engine';
import type { PlayerDisplay } from '../data/playerDisplay';
import type { GameTheme } from '../components/GameTheme';

export type GemMode = 'different' | 'pair';
export type LocalGamePhase = 'awaitingStart' | 'selecting' | 'discarding' | 'choosingNoble' | 'completed' | 'finished';
export const TURN_DURATION_MS = 3 * 60 * 1000;

const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const returnedCount = (gems: Inventory) => Object.values(gems).reduce((sum, count) => sum + count, 0);

function fromEngineState(state: ServerGameState) {
  const currentPlayerId = state.playerOrder[state.turnIndex];
  const player = state.players[currentPlayerId];
  return { bank: state.bank, gems: player.gems, market: state.market,
    decks: state.decks, purchasedCardIds: player.purchasedCardIds,
    reservedCardIds: player.reservedCardIds, score: player.score, currentPlayerId };
}

function localPlayers(count: 2 | 3 | 4): PlayerDisplay[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `local-player-${index + 1}`, name: `플레이어 ${index + 1}`, initials: String(index + 1),
    score: 0, gems: emptyInventory(),
    bonuses: { white: 0, blue: 0, green: 0, red: 0, black: 0 },
    purchasedCount: 0, reservedCount: 0, isLocal: false,
  }));
}

function newLocalGame(count: 2 | 3 | 4) {
  const players = localPlayers(count);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return { ...initialLocalState(createInitialGameState(players.map((player) => player.id), seed), players),
    phase: 'awaitingStart' as LocalGamePhase, turnDeadlineAt: null };
}

interface LocalGameState extends ReturnType<typeof fromEngineState> {
  theme: GameTheme;
  setTheme: (theme: GameTheme) => void;
  game: ServerGameState;
  players: PlayerDisplay[];
  mode: GemMode;
  phase: LocalGamePhase;
  selectedColors: GemColor[];
  returned: Inventory;
  notice: string;
  turnDeadlineAt: number | null;
  turnWarningPlayed: boolean;
  markTurnWarning: () => boolean;
  expireTurn: () => void;
  setMode: (mode: GemMode) => void;
  selectColor: (color: GemColor) => void;
  changeReturn: (color: Gem, delta: -1 | 1) => void;
  takeSelected: () => void;
  confirmReturn: () => void;
  chooseNoble: (nobleId: string) => boolean;
  advanceTurn: () => void;
  purchaseCard: (cardId: string, source: 'market' | 'reserved', payment: Inventory) => boolean;
  reserveMarketCard: (cardId: string) => boolean;
  reserveDeckCard: (level: CardLevel) => boolean;
  passTurn: () => boolean;
  startNewGame: (count: 2 | 3 | 4) => void;
  beginGame: () => void;
  restart: () => void;
}

function initialLocalState(game: ServerGameState, players: PlayerDisplay[]) {
  return {
    game, players, ...fromEngineState(game),
    mode: 'different' as GemMode, phase: 'awaitingStart' as LocalGamePhase,
    selectedColors: [] as GemColor[], returned: emptyInventory(), notice: '',
    turnDeadlineAt: null as number | null,
    turnWarningPlayed: false,
  };
}

function uiPhase(game: ServerGameState): LocalGamePhase {
  if (game.phase === 'discarding') return 'discarding';
  if (game.phase === 'choosingNoble') return 'choosingNoble';
  if (game.phase === 'finished') return 'finished';
  return 'completed';
}

function applyAction(
  state: LocalGameState, action: Parameters<typeof reduceGameAction>[2], notice: string,
) {
  const next = reduceGameAction(state.game, state.currentPlayerId, action);
  return { game: next, ...fromEngineState(next), phase: uiPhase(next),
    selectedColors: [] as GemColor[], returned: emptyInventory(), notice,
    turnDeadlineAt: next.phase !== 'finished' && next.turnIndex === state.game.turnIndex
      ? state.turnDeadlineAt : null };
}

export const useLocalGameStore = create<LocalGameState>((set, get) => ({
  ...newLocalGame(2),
  theme: 'default',
  setTheme: (theme) => set({ theme }),
  markTurnWarning: () => {
    const state = get();
    if (state.turnDeadlineAt === null || state.turnWarningPlayed ||
        state.phase === 'completed' || state.phase === 'finished') return false;
    set({ turnWarningPlayed: true });
    return true;
  },
  expireTurn: () => {
    const state = get();
    if (state.turnDeadlineAt === null ||
        Date.now() < state.turnDeadlineAt || state.phase === 'completed' || state.phase === 'finished') return;
    try {
      const next = applyAction(state, { type: 'TIMEOUT' }, '3분이 지나 이번 턴을 자동으로 마쳤습니다.');
      if (next.phase === 'completed' && next.game.phase === 'playing') {
        const nextPlayer = state.players.find((player) => player.id === next.currentPlayerId)?.name ?? '다음 플레이어';
        set({ ...next, phase: 'selecting', turnDeadlineAt: Date.now() + TURN_DURATION_MS,
          turnWarningPlayed: false, notice: `3분이 지나 ${nextPlayer}님의 차례로 자동 전환됐습니다.` });
      } else {
        set({ ...next, turnDeadlineAt: null });
      }
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '턴을 자동으로 마치지 못했습니다.', turnDeadlineAt: null });
    }
  },
  setMode: (mode) => set((state) => state.phase === 'selecting'
    ? { mode, selectedColors: [], notice: '' } : {}),
  selectColor: (color) => set((state) => {
    if (state.phase !== 'selecting' || state.bank[color] === 0) return {};
    if (state.mode === 'pair') {
      return state.bank[color] >= 4
        ? { selectedColors: state.selectedColors[0] === color ? [] : [color], notice: '' } : {};
    }
    if (state.selectedColors.includes(color)) {
      return { selectedColors: state.selectedColors.filter((item) => item !== color), notice: '' };
    }
    if (state.selectedColors.length >= 3) return {};
    return { selectedColors: [...state.selectedColors, color], notice: '' };
  }),
  changeReturn: (color, delta) => set((state) => {
    if (state.phase !== 'discarding') return {};
    const nextCount = state.returned[color] + delta;
    const excess = excessGemCount(state.gems);
    if (nextCount < 0 || nextCount > state.gems[color] ||
        (delta > 0 && returnedCount(state.returned) >= excess)) return {};
    return { returned: { ...state.returned, [color]: nextCount }, notice: '' };
  }),
  takeSelected: () => {
    const state = get();
    if (state.phase !== 'selecting') return;
    const colors = state.mode === 'pair' && state.selectedColors.length === 1
      ? [state.selectedColors[0], state.selectedColors[0]] : state.selectedColors;
    if (!canTakeGems(state.bank, colors)) {
      set({ notice: '은행 수량과 획득 규칙에 맞게 보석을 선택하세요.' });
      return;
    }
    try {
      const next = applyAction(state, { type: 'TAKE_GEMS', colors }, '보석을 받았습니다.');
      set({ ...next, notice: next.phase === 'discarding'
        ? `보석을 받았습니다. 초과한 ${excessGemCount(next.gems)}개를 반환하세요.` : next.notice });
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '보석을 받을 수 없습니다.' });
    }
  },
  confirmReturn: () => {
    const state = get();
    if (state.phase !== 'discarding') return;
    try {
      set(applyAction(state, { type: 'DISCARD_GEMS', gems: state.returned }, '초과 보석을 반환했습니다.'));
    } catch {
      set({ notice: '초과한 수량만큼 보유 보석을 선택해 반환하세요.' });
    }
  },
  purchaseCard: (cardId, source, payment) => {
    const state = get();
    if (state.phase !== 'selecting') {
      set({ notice: '이번 턴은 이미 진행 중이거나 완료됐습니다.' });
      return false;
    }
    try {
      set(applyAction(state, { type: 'BUY_CARD', cardId, source, payment },
        '카드를 구매했습니다. 점수와 영구 할인이 반영됐습니다.'));
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '카드를 구매할 수 없습니다.' });
      return false;
    }
  },
  reserveMarketCard: (cardId) => {
    const state = get();
    if (state.phase !== 'selecting') {
      set({ notice: '이번 턴은 이미 진행 중이거나 완료됐습니다.' });
      return false;
    }
    try {
      const next = applyAction(state, { type: 'RESERVE_CARD', cardId },
        '카드를 예약했습니다. 은행에 황금이 남아 있었다면 1개를 받았습니다.');
      set({ ...next, notice: next.phase === 'discarding'
        ? `카드를 예약했습니다. 초과 보석 ${excessGemCount(next.gems)}개를 반환하세요.` : next.notice });
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '카드를 예약할 수 없습니다.' });
      return false;
    }
  },
  reserveDeckCard: (level) => {
    const state = get();
    if (state.phase !== 'selecting') return false;
    try {
      const next = applyAction(state, { type: 'RESERVE_CARD', level }, '덱 맨 위 카드를 예약했습니다.');
      set({ ...next, notice: next.phase === 'discarding'
        ? `카드를 예약했습니다. 초과 보석 ${excessGemCount(next.gems)}개를 반환하세요.` : next.notice });
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '덱 카드를 예약할 수 없습니다.' });
      return false;
    }
  },
  passTurn: () => {
    const state = get();
    if (state.phase !== 'selecting' || hasLegalBasicAction(state.game, state.currentPlayerId)) return false;
    try {
      set(applyAction(state, { type: 'PASS' }, '가능한 기본 행동이 없어 패스했습니다.'));
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '패스할 수 없습니다.' });
      return false;
    }
  },
  chooseNoble: (nobleId) => {
    const state = get();
    if (state.phase !== 'choosingNoble') return false;
    try {
      set(applyAction(state, { type: 'CHOOSE_NOBLE', nobleId }, '귀족 방문으로 3점을 얻었습니다.'));
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '이 귀족을 선택할 수 없습니다.' });
      return false;
    }
  },
  advanceTurn: () => set((state) => state.phase === 'completed' && state.game.phase === 'playing'
    ? { phase: 'selecting', turnDeadlineAt: Date.now() + TURN_DURATION_MS,
      turnWarningPlayed: false,
      notice: `${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? '플레이어'}님의 차례입니다.` } : {}),
  startNewGame: (count) => {
    if (count !== 2 && count !== 3 && count !== 4) return;
    set({ ...newLocalGame(count), notice: `${count}인 로컬 게임이 준비됐습니다. 게임 시작을 누르면 첫 턴이 시작됩니다.` });
  },
  beginGame: () => set((state) => state.phase === 'awaitingStart'
    ? { phase: 'selecting', turnDeadlineAt: Date.now() + TURN_DURATION_MS,
      turnWarningPlayed: false, notice: `${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? '첫 번째 플레이어'}님의 차례입니다.` } : {}),
  restart: () => set(newLocalGame(get().players.length as 2 | 3 | 4)),
}));
