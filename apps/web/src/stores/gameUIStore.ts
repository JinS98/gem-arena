import { create } from 'zustand';
type CardSource = 'market' | 'reserved';
interface SelectedCard { id: string; source: CardSource }
interface UIState {
  selectedCard: SelectedCard | null;
  selectCard: (id: string, source: CardSource) => void;
  closeCard: () => void;
}

export const useGameUIStore = create<UIState>((set) => ({
  selectedCard: null,
  selectCard: (id, source) => set({ selectedCard: { id, source } }),
  closeCard: () => set({ selectedCard: null }),
}));
