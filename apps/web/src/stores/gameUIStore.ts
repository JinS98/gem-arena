import { create } from 'zustand';
import type { DevelopmentCard } from '@gem-arena/engine';
type CardId = DevelopmentCard['id'];
interface UIState { selectedCardId: CardId | null; selectCard: (id: CardId | null) => void }
export const useGameUIStore = create<UIState>(set => ({selectedCardId: null, selectCard: id => set({selectedCardId:id})}));
