import { create } from 'zustand';
import { buyCard, canTakeGems, DEVELOPMENT_CARDS, discardExcessGems, excessGemCount, reserveCard, takeGems } from '@gem-arena/engine';
import type { CardLevel, Gem, GemColor, Inventory, ServerGameState } from '@gem-arena/engine';
import { previewGame } from '../data/previewGame';

export type GemMode = 'different' | 'pair';
export type GemPracticePhase = 'selecting' | 'discarding' | 'completed';

const localGems = previewGame.players.find((player) => player.isLocal)!.gems;
const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const returnedCount = (gems: Inventory) => Object.values(gems).reduce((sum, count) => sum + count, 0);
const initialPurchased = ['L1-WHITE-06', 'L2-BLUE-06', 'L1-BLUE-01', 'L2-GREEN-01', 'L1-RED-05', 'L1-BLACK-05'];
const initialReserved = ['L1-BLACK-01'];
const levels: CardLevel[] = [1, 2, 3];

interface DemoCards {
  market: Record<CardLevel, (string | null)[]>;
  decks: Record<CardLevel, string[]>;
  purchasedCardIds: string[];
  reservedCardIds: string[];
  score: number;
}

function initialCards(): DemoCards {
  const market = { 1: previewGame.market[1].map((card) => card.id),
    2: previewGame.market[2].map((card) => card.id),
    3: previewGame.market[3].map((card) => card.id) };
  const used = new Set([...levels.flatMap((level) => market[level]), ...initialPurchased, ...initialReserved]);
  const decks = { 1: [] as string[], 2: [] as string[], 3: [] as string[] };
  for (const level of levels) {
    decks[level] = DEVELOPMENT_CARDS.filter((card) => card.level === level && !used.has(card.id))
      .slice(0, previewGame.deckCounts[level]).map((card) => card.id);
  }
  return { market, decks, purchasedCardIds: [...initialPurchased],
    reservedCardIds: [...initialReserved], score: 7 };
}

/** The private deck here is generated sample data for /game/demo, never a live room state. */
function asEngineState(state: DemoGemState): ServerGameState {
  const id = previewGame.currentPlayerId;
  return {
    phase: 'playing', version: 0, firstPlayerIndex: 0, turnIndex: 0,
    turnNobleResolved: false, consecutivePasses: 0, playerOrder: [id],
    players: { [id]: { uid: id, seatIndex: 0, gems: state.gems,
      purchasedCardIds: state.purchasedCardIds, reservedCardIds: state.reservedCardIds,
      nobleIds: [], score: state.score } },
    bank: state.bank, market: state.market, decks: state.decks,
    availableNobleIds: [], finalRoundTriggeredBy: null, winnerIds: [],
  };
}

function fromEngineState(state: ServerGameState) {
  const player = state.players[previewGame.currentPlayerId];
  return { bank: state.bank, gems: player.gems, market: state.market,
    decks: state.decks, purchasedCardIds: player.purchasedCardIds,
    reservedCardIds: player.reservedCardIds, score: player.score };
}

interface DemoGemState extends DemoCards {
  bank: Inventory;
  gems: Inventory;
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
  purchaseCard: (cardId: string, source: 'market' | 'reserved', payment: Inventory) => boolean;
  reserveMarketCard: (cardId: string) => boolean;
  reset: () => void;
}

function initialPractice() {
  return {
    ...initialCards(),
    bank: { ...previewGame.bank }, gems: { ...localGems },
    mode: 'different' as GemMode, phase: 'selecting' as GemPracticePhase,
    selectedColors: [] as GemColor[], returned: emptyInventory(), notice: '',
  };
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
    const transfer = takeGems(state.bank, state.gems, colors);
    set({
      bank: transfer.bank, gems: transfer.gems, selectedColors: [],
      returned: emptyInventory(),
      phase: transfer.excess > 0 ? 'discarding' : 'completed',
      notice: transfer.excess > 0
        ? `보석을 받았습니다. 초과한 ${transfer.excess}개를 반환하세요.`
        : '보석을 받았습니다. 이번 연습 턴이 끝났습니다.',
    });
  },
  confirmReturn: () => {
    const state = get();
    if (state.phase !== 'discarding') return;
    try {
      const transfer = discardExcessGems(state.bank, state.gems, state.returned);
      set({
        bank: transfer.bank, gems: transfer.gems,
        returned: emptyInventory(), phase: 'completed',
        notice: '초과 보석을 반환했습니다. 이번 연습 턴이 끝났습니다.',
      });
    } catch {
      set({ notice: '초과한 수량만큼 보유 보석을 선택해 반환하세요.' });
    }
  },
  loadDiscardExample: () => {
    const bank = { ...previewGame.bank, white: previewGame.bank.white - 2,
      blue: previewGame.bank.blue - 2, black: previewGame.bank.black - 1 };
    const gems = { ...localGems, white: localGems.white + 2,
      blue: localGems.blue + 2, black: localGems.black + 1 };
    set({ ...initialPractice(), bank, gems,
      notice: '보석 9개 상황입니다. 세 색을 받아 반환을 연습하세요.' });
  },
  purchaseCard: (cardId, source, payment) => {
    const state = get();
    if (state.phase !== 'selecting') {
      set({ notice: '이번 연습 턴은 이미 진행 중이거나 완료됐습니다.' });
      return false;
    }
    try {
      const next = buyCard(asEngineState(state), previewGame.currentPlayerId,
        { type: 'BUY_CARD', cardId, source, payment });
      set({ ...fromEngineState(next), selectedColors: [], phase: 'completed',
        notice: '카드를 구매했습니다. 점수와 영구 할인이 반영됐습니다.' });
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
      const result = reserveCard(asEngineState(state), previewGame.currentPlayerId,
        { type: 'RESERVE_CARD', cardId });
      set({ ...fromEngineState(result.state), selectedColors: [], returned: emptyInventory(),
        phase: result.excess > 0 ? 'discarding' : 'completed',
        notice: result.excess > 0
          ? `카드를 예약하고 황금을 받았습니다. 초과 보석 ${result.excess}개를 반환하세요.`
          : '카드를 예약했습니다. 은행에 황금이 남아 있었다면 1개를 받았습니다.' });
      return true;
    } catch (error) {
      set({ notice: error instanceof Error ? error.message : '카드를 예약할 수 없습니다.' });
      return false;
    }
  },
  reset: () => set(initialPractice()),
}));
