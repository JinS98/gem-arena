import type { Gem, GemColor, Inventory } from '../types/index.js';

export const GEM_COLORS: readonly GemColor[] = ['white', 'blue', 'green', 'red', 'black'];
const GEMS: readonly Gem[] = [...GEM_COLORS, 'gold'];
const GEM_LIMIT = 10;

export function isValidInventory(value: unknown): value is Inventory {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = value as Record<string, unknown>;
  return Object.keys(counts).length === GEMS.length && GEMS.every((gem) =>
    Object.hasOwn(counts, gem) && Number.isSafeInteger(counts[gem]) && (counts[gem] as number) >= 0) &&
    Number.isSafeInteger(GEMS.reduce((sum, gem) => sum + (counts[gem] as number), 0));
}

function assertInventory(value: unknown): asserts value is Inventory {
  if (!isValidInventory(value)) throw new RangeError('보석 수량은 6종 모두 0 이상의 정수여야 합니다');
}

export function gemCount(gems: Inventory): number {
  assertInventory(gems);
  return GEMS.reduce((sum, gem) => sum + gems[gem], 0);
}

export function excessGemCount(gems: Inventory): number {
  return Math.max(0, gemCount(gems) - GEM_LIMIT);
}

export function canTakeGems(bank: Inventory, colors: readonly GemColor[]): boolean {
  if (!isValidInventory(bank) || !Array.isArray(colors) || colors.length === 0 || colors.length > 3) return false;
  const selected = colors as readonly GemColor[];
  if (selected.some((color) => !GEM_COLORS.includes(color))) return false;
  if (selected.length === 2 && selected[0] === selected[1]) return bank[selected[0]] >= 4;
  if (new Set(selected).size !== selected.length) return false;

  const availableColors = GEM_COLORS.filter((color) => bank[color] > 0).length;
  return (availableColors < 3 || selected.length === 3)
    && selected.length <= availableColors
    && selected.every((color) => bank[color] > 0);
}

export interface GemTransferResult { bank: Inventory; gems: Inventory }
export interface GemTakeResult extends GemTransferResult { excess: number }

/** Transfer a legal take from the bank; the caller handles the turn phase. */
export function takeGems(bank: Inventory, gems: Inventory, colors: readonly GemColor[]): GemTakeResult {
  assertInventory(gems);
  if (!canTakeGems(bank, colors)) throw new RangeError('가져올 수 없는 보석 조합입니다');

  const nextBank = { ...bank };
  const nextGems = { ...gems };
  for (const color of colors) {
    nextBank[color]--;
    nextGems[color]++;
    if (!Number.isSafeInteger(nextGems[color])) throw new RangeError('보석 수량이 안전한 정수 범위를 넘습니다');
  }
  return { bank: nextBank, gems: nextGems, excess: excessGemCount(nextGems) };
}

/** Return exactly the excess gems after a take or gold-token reservation. */
export function discardExcessGems(bank: Inventory, gems: Inventory, returned: Inventory): GemTransferResult {
  assertInventory(bank);
  assertInventory(gems);
  assertInventory(returned);
  const excess = excessGemCount(gems);
  if (excess === 0 || gemCount(returned) !== excess ||
      GEMS.some((gem) => returned[gem] > gems[gem] ||
        !Number.isSafeInteger(bank[gem] + returned[gem]))) {
    throw new RangeError('초과한 보석만 정확히 반환해야 합니다');
  }

  const nextBank = { ...bank };
  const nextGems = { ...gems };
  for (const gem of GEMS) {
    nextBank[gem] += returned[gem];
    nextGems[gem] -= returned[gem];
  }
  return { bank: nextBank, gems: nextGems };
}
