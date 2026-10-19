import { CARD_COLORS, getDevelopmentCard } from '../data/catalog';
import type { ColorCounts, Inventory } from '../types/index';
import { isValidInventory } from './gems';
import type { GemTransferResult } from './gems';

function isValidColorCounts(value: unknown): value is ColorCounts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = value as Record<string, unknown>;
  return Object.keys(counts).length === CARD_COLORS.length && CARD_COLORS.every((color) =>
    Object.hasOwn(counts, color) && Number.isSafeInteger(counts[color]) && (counts[color] as number) >= 0) &&
    Number.isSafeInteger(CARD_COLORS.reduce((sum, color) => sum + (counts[color] as number), 0));
}

/** Only purchased cards contribute permanent discounts. */
export function countCardBonuses(purchasedCardIds: readonly string[]): ColorCounts {
  if (!Array.isArray(purchasedCardIds) || new Set(purchasedCardIds).size !== purchasedCardIds.length) {
    throw new RangeError('구매 카드 ID 목록이 유효하지 않습니다');
  }
  const bonuses: ColorCounts = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
  for (const id of purchasedCardIds) {
    const card = typeof id === 'string' ? getDevelopmentCard(id) : undefined;
    if (!card) throw new RangeError('존재하지 않는 구매 카드 ID입니다');
    bonuses[card.bonusColor]++;
  }
  return bonuses;
}

/** Discount each color independently; excess discounts never produce gems. */
export function remainingCardCost(cost: ColorCounts, bonuses: ColorCounts): ColorCounts {
  if (!isValidColorCounts(cost) || !isValidColorCounts(bonuses)) {
    throw new RangeError('카드 비용과 할인은 일반 보석 5색의 0 이상 정수여야 합니다');
  }
  return {
    white: Math.max(0, cost.white - bonuses.white),
    blue: Math.max(0, cost.blue - bonuses.blue),
    green: Math.max(0, cost.green - bonuses.green),
    red: Math.max(0, cost.red - bonuses.red),
    black: Math.max(0, cost.black - bonuses.black),
  };
}

/** Gold can cover any unpaid color, even when that color is held as a regular gem. */
export function canPayForCard(
  cost: ColorCounts, bonuses: ColorCounts, held: Inventory, payment: Inventory,
): boolean {
  if (!isValidColorCounts(cost) || !isValidColorCounts(bonuses) ||
      !isValidInventory(held) || !isValidInventory(payment)) return false;
  const remaining = remainingCardCost(cost, bonuses);
  if (payment.gold > held.gold) return false;
  let goldNeeded = 0;
  for (const color of CARD_COLORS) {
    if (payment[color] > remaining[color] || payment[color] > held[color]) return false;
    goldNeeded += remaining[color] - payment[color];
  }
  return Number.isSafeInteger(goldNeeded) && payment.gold === goldNeeded;
}

/** Return paid gems to the bank without changing the supplied inventories. */
export function payForCard(
  bank: Inventory, held: Inventory, cost: ColorCounts, bonuses: ColorCounts, payment: Inventory,
): GemTransferResult {
  if (!isValidInventory(bank) || !canPayForCard(cost, bonuses, held, payment)) {
    throw new RangeError('카드 비용을 정확히 결제할 수 없습니다');
  }
  const nextBank = { ...bank };
  const nextGems = { ...held };
  for (const color of [...CARD_COLORS, 'gold'] as const) {
    nextBank[color] += payment[color];
    nextGems[color] -= payment[color];
  }
  if (!isValidInventory(nextBank)) throw new RangeError('은행 수량이 안전한 정수 범위를 넘습니다');
  return { bank: nextBank, gems: nextGems };
}
