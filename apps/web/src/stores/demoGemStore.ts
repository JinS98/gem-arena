import { create } from 'zustand';
import { canTakeGems, discardExcessGems, excessGemCount, takeGems } from '@gem-arena/engine';
import type { Gem, GemColor, Inventory } from '@gem-arena/engine';
import { previewGame } from '../data/previewGame';

export type GemMode = 'different' | 'pair';
export type GemPracticePhase = 'selecting' | 'discarding' | 'completed';

const localGems = previewGame.players.find((player) => player.isLocal)!.gems;
const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const returnedCount = (gems: Inventory) => Object.values(gems).reduce((sum, count) => sum + count, 0);

interface DemoGemState {
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
  reset: () => void;
}

function initialPractice() {
  return {
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
  reset: () => set(initialPractice()),
}));
