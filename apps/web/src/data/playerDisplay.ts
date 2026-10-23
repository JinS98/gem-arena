import type { ColorCounts, Inventory } from '@gem-arena/engine';

export interface PlayerDisplay {
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
