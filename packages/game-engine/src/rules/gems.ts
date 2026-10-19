import type { GemColor, Inventory } from '../types/index';
export const GEM_COLORS: readonly GemColor[] = ['white','blue','green','red','black'];
export function gemCount(gems: Inventory): number { return Object.values(gems).reduce((sum, count) => sum + count, 0); }
export function canTakeGems(bank: Inventory, colors: GemColor[]): boolean {
  if (colors.length === 0 || colors.length > 3) return false;
  if (colors.some(color => !GEM_COLORS.includes(color))) return false;
  if (colors.length === 2 && colors[0] === colors[1]) return bank[colors[0]] >= 4;
  if (new Set(colors).size !== colors.length) return false;
  const availableColors = GEM_COLORS.filter(color => bank[color] > 0).length;
  return (availableColors < 3 || colors.length === 3)
    && colors.length <= availableColors
    && colors.every(color => bank[color] > 0);
}
// 보유량 10개 초과 시 후속 DISCARD_GEMS 단계가 필요합니다.
