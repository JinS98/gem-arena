import { getDevelopmentCard, NOBLES } from '@gem-arena/engine';
import type { CardLevel, ColorCounts, DevelopmentCard, Inventory, Noble } from '@gem-arena/engine';

export interface PreviewPlayer {
  id: string;
  name: string;
  initials: string;
  score: number;
  gems: Inventory;
  bonuses: ColorCounts;
  purchasedCount: number;
  reservedCount: number;
  isLocal: boolean;
}

function cards(ids: string[]): DevelopmentCard[] {
  return ids.map((id) => {
    const card = getDevelopmentCard(id);
    if (!card) throw new Error(`미리보기 카드가 없습니다: ${id}`);
    return card;
  });
}

/** Public, fixed sample values for the local layout preview only. */
export const previewGame: {
  currentPlayerId: string;
  players: PreviewPlayer[];
  bank: Inventory;
  nobles: Noble[];
  market: Record<CardLevel, DevelopmentCard[]>;
  deckCounts: Record<CardLevel, number>;
} = {
  currentPlayerId: 'player-1',
  players: [
    {
      id: 'player-1', name: '나', initials: '나', score: 7, isLocal: true,
      gems: { white: 1, blue: 0, green: 2, red: 1, black: 0, gold: 0 },
      bonuses: { white: 1, blue: 2, green: 1, red: 1, black: 1 },
      purchasedCount: 6, reservedCount: 1,
    },
    {
      id: 'player-2', name: '서윤', initials: '서', score: 5, isLocal: false,
      gems: { white: 0, blue: 2, green: 1, red: 0, black: 1, gold: 1 },
      bonuses: { white: 1, blue: 0, green: 1, red: 2, black: 1 },
      purchasedCount: 5, reservedCount: 2,
    },
    {
      id: 'player-3', name: '민재', initials: '민', score: 9, isLocal: false,
      gems: { white: 1, blue: 0, green: 0, red: 2, black: 1, gold: 0 },
      bonuses: { white: 2, blue: 1, green: 1, red: 1, black: 2 },
      purchasedCount: 7, reservedCount: 0,
    },
  ],
  bank: { white: 3, blue: 3, green: 2, red: 2, black: 3, gold: 4 },
  nobles: [NOBLES[0], NOBLES[3], NOBLES[6], NOBLES[9]],
  market: {
    1: cards(['L1-WHITE-05', 'L1-BLUE-03', 'L1-GREEN-04', 'L1-RED-07']),
    2: cards(['L2-BLACK-03', 'L2-GREEN-05', 'L2-RED-02', 'L2-WHITE-06']),
    3: cards(['L3-BLUE-02', 'L3-WHITE-04', 'L3-BLACK-03', 'L3-RED-01']),
  },
  deckCounts: { 1: 26, 2: 21, 3: 13 },
};
