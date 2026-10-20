import { create } from 'zustand';
import { canTakeGems, CARD_COLORS, createInitialGameState, DEVELOPMENT_CARDS, excessGemCount, hasLegalBasicAction, reduceGameAction } from '@gem-arena/engine';
import type { CardLevel, Gem, GemColor, Inventory, ServerGameState } from '@gem-arena/engine';
import { previewGame } from '../data/previewGame';
import type { PreviewPlayer } from '../data/previewGame';

export type GemMode = 'different' | 'pair';
export type GemPracticePhase = 'selecting' | 'discarding' | 'choosingNoble' | 'completed' | 'finished';

const localGems = previewGame.players.find((player) => player.isLocal)!.gems;
const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const returnedCount = (gems: Inventory) => Object.values(gems).reduce((sum, count) => sum + count, 0);
const initialPurchased = ['L1-WHITE-06', 'L2-BLUE-06', 'L1-BLUE-01', 'L2-GREEN-01', 'L1-RED-05', 'L1-BLACK-05'];
const initialReserved = ['L1-BLACK-01'];
const levels: CardLevel[] = [1, 2, 3];

function initialGame(): ServerGameState {
  const market = { 1: previewGame.market[1].map((card) => card.id),
    2: previewGame.market[2].map((card) => card.id),
    3: previewGame.market[3].map((card) => card.id) };
  const used = new Set([...levels.flatMap((level) => market[level]), ...initialPurchased, ...initialReserved]);
  const players: ServerGameState['players'] = {};
  for (const [seatIndex, preview] of previewGame.players.entries()) {
    const purchasedCardIds = preview.isLocal ? [...initialPurchased] : [];
    const reservedCardIds = preview.isLocal ? [...initialReserved] : [];
    if (!preview.isLocal) {
      for (const color of CARD_COLORS) {
        for (let count = 0; count < preview.bonuses[color]; count++) {
          const card = DEVELOPMENT_CARDS.find((candidate) => candidate.bonusColor === color && !used.has(candidate.id));
          if (!card) throw new Error('로컬 샘플 카드를 구성할 수 없습니다');
          purchasedCardIds.push(card.id);
          used.add(card.id);
        }
      }
      for (let count = 0; count < preview.reservedCount; count++) {
        const card = DEVELOPMENT_CARDS.find((candidate) => !used.has(candidate.id));
        if (!card) throw new Error('로컬 예약 카드를 구성할 수 없습니다');
        reservedCardIds.push(card.id);
        used.add(card.id);
      }
    }
    players[preview.id] = { uid: preview.id, seatIndex, gems: { ...preview.gems },
      purchasedCardIds, reservedCardIds, nobleIds: [], score: preview.score };
  }
  const decks = { 1: [] as string[], 2: [] as string[], 3: [] as string[] };
  for (const level of levels) {
    decks[level] = DEVELOPMENT_CARDS.filter((card) => card.level === level && !used.has(card.id))
      .map((card) => card.id);
  }
  return {
    phase: 'playing', version: 0, firstPlayerIndex: 0, turnIndex: 0,
    turnNobleResolved: false, consecutivePasses: 0,
    playerOrder: previewGame.players.map((player) => player.id), players,
    bank: { ...previewGame.bank }, market, decks,
    availableNobleIds: previewGame.nobles.map((noble) => noble.id),
    finalRoundTriggeredBy: null, winnerIds: [],
  };
}

/** This full engine state is only generated sample data for /game/demo. */
function fromEngineState(state: ServerGameState) {
  const currentPlayerId = state.playerOrder[state.turnIndex];
  const player = state.players[currentPlayerId];
  return { bank: state.bank, gems: player.gems, market: state.market,
    decks: state.decks, purchasedCardIds: player.purchasedCardIds,
    reservedCardIds: player.reservedCardIds, score: player.score, currentPlayerId };
}

function nobleFinishGame(): ServerGameState {
  const base = initialGame();
  const decks = { 1: [...base.decks[1]], 2: [...base.decks[2]], 3: [...base.decks[3]] };
  const extraIds: string[] = [];
  const neededBonuses = { white: 2, green: 2, red: 1, black: 2 } as const;
  for (const color of ['white', 'green', 'red', 'black'] as const) {
    for (let count = 0; count < neededBonuses[color]; count++) {
      const card = DEVELOPMENT_CARDS.find((candidate) => candidate.bonusColor === color &&
        decks[candidate.level].includes(candidate.id));
      if (!card) throw new Error('귀족 샘플 카드를 구성할 수 없습니다');
      extraIds.push(card.id);
      decks[card.level] = decks[card.level].filter((id) => id !== card.id);
    }
  }
  const id = previewGame.currentPlayerId;
  return { ...base, decks, firstPlayerIndex: 1,
    availableNobleIds: [previewGame.nobles[0].id, previewGame.nobles[1].id, previewGame.nobles[3].id],
    players: { ...base.players, [id]: { ...base.players[id],
      purchasedCardIds: [...base.players[id].purchasedCardIds, ...extraIds], score: 11 } } };
}

type DemoScenario = 'standard' | 'nobleFinish' | 'discard' | 'finalRound' | 'fullGame';

function localPlayers(count: 2 | 3 | 4): PreviewPlayer[] {
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
  return initialPractice(createInitialGameState(players.map((player) => player.id), seed), 'fullGame', players);
}

interface DemoGemState extends ReturnType<typeof fromEngineState> {
  game: ServerGameState;
  players: PreviewPlayer[];
  scenario: DemoScenario;
  mode: GemMode;
  phase: GemPracticePhase;
  selectedColors: GemColor[];
  returned: Inventory;
  notice: string;
  setMode: (mode: GemMode) => void;
  selectColor: (color: GemColor) => void;
  changeReturn: (color: Gem, delta: -1 | 1) => void;
  takeSelected: () => void;
  confirmReturn: () => void;
  loadDiscardExample: () => void;
  loadNobleExample: () => void;
  loadFinalRoundExample: () => void;
  chooseNoble: (nobleId: string) => boolean;
  advanceTurn: () => void;
  purchaseCard: (cardId: string, source: 'market' | 'reserved', payment: Inventory) => boolean;
  reserveMarketCard: (cardId: string) => boolean;
  reserveDeckCard: (level: CardLevel) => boolean;
  passTurn: () => boolean;
  startNewGame: (count: 2 | 3 | 4) => void;
  restart: () => void;
  reset: () => void;
}

function initialPractice(
  game = initialGame(), scenario: DemoScenario = 'standard', players: PreviewPlayer[] = previewGame.players,
) {
  return {
    game, scenario, players, ...fromEngineState(game),
    mode: 'different' as GemMode, phase: 'selecting' as GemPracticePhase,
    selectedColors: [] as GemColor[], returned: emptyInventory(), notice: '',
  };
}

function uiPhase(game: ServerGameState): GemPracticePhase {
  if (game.phase === 'discarding') return 'discarding';
  if (game.phase === 'choosingNoble') return 'choosingNoble';
  if (game.phase === 'finished') return 'finished';
  return 'completed';
}

function applyAction(
  state: DemoGemState, action: Parameters<typeof reduceGameAction>[2], notice: string,
) {
  const next = reduceGameAction(state.game, state.currentPlayerId, action);
  return { game: next, ...fromEngineState(next), phase: uiPhase(next),
    selectedColors: [] as GemColor[], returned: emptyInventory(), notice };
}

export const useDemoGemStore = create<DemoGemState>((set, get) => ({
  ...initialPractice(),
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
  loadDiscardExample: () => {
    const bank = { ...previewGame.bank, white: previewGame.bank.white - 2,
      blue: previewGame.bank.blue - 2, black: previewGame.bank.black - 1 };
    const gems = { ...localGems, white: localGems.white + 2,
      blue: localGems.blue + 2, black: localGems.black + 1 };
    const base = initialGame();
    const id = previewGame.currentPlayerId;
    const game = { ...base, bank, players: { ...base.players,
      [id]: { ...base.players[id], gems } } };
    set({ ...initialPractice(game, 'discard'),
      notice: '보석 9개 상황입니다. 세 색을 받아 반환을 연습하세요.' });
  },
  purchaseCard: (cardId, source, payment) => {
    const state = get();
    if (state.phase !== 'selecting') {
      set({ notice: '이번 연습 턴은 이미 진행 중이거나 완료됐습니다.' });
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
      set({ notice: '이번 연습 턴은 이미 진행 중이거나 완료됐습니다.' });
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
  loadNobleExample: () => {
    set({ ...initialPractice(nobleFinishGame(), 'nobleFinish'),
      notice: '1단계 빨간 개발 카드를 구매하세요. 귀족 한 명을 선택하면 15점으로 게임이 종료됩니다.' });
  },
  loadFinalRoundExample: () => {
    const base = initialGame();
    const first = base.playerOrder[0];
    const last = base.playerOrder[2];
    const game: ServerGameState = { ...base, turnIndex: 2, finalRoundTriggeredBy: first,
      players: { ...base.players, [first]: { ...base.players[first], score: 15 },
        [last]: { ...base.players[last], score: 14 } } };
    set({ ...initialPractice(game, 'finalRound'),
      notice: '최종 라운드 마지막 차례입니다. 행동을 마치면 승자가 결정됩니다.' });
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
    ? { phase: 'selecting', notice: `${state.players.find((player) => player.id === state.currentPlayerId)?.name ?? '플레이어'}님의 차례입니다.` } : {}),
  startNewGame: (count) => {
    if (count !== 2 && count !== 3 && count !== 4) return;
    set({ ...newLocalGame(count), notice: `${count}인 로컬 게임을 시작했습니다.` });
  },
  restart: () => {
    const state = get();
    set(state.scenario === 'fullGame' ? newLocalGame(state.players.length as 2 | 3 | 4) : initialPractice());
  },
  reset: () => set(initialPractice()),
}));
