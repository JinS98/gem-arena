import { describe, expect, it } from 'vitest';
import { canTakeGems, discardExcessGems, excessGemCount, gemCount, takeGems } from '../rules/gems';
import type { GemColor, Inventory } from '../types/index';

const bank: Inventory = { white: 4, blue: 2, green: 1, red: 0, black: 3, gold: 5 };
const empty: Inventory = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };

describe('보석 획득 규칙', () => {
  it('서로 다른 세 종류를 획득할 수 있다', () => expect(canTakeGems(bank, ['white', 'blue', 'green'])).toBe(true));

  it('세 종류 이상 남아 있으면 한두 종류만 받을 수 없다', () => {
    expect(canTakeGems(bank, ['white'])).toBe(false);
    expect(canTakeGems(bank, ['white', 'blue'])).toBe(false);
  });

  it('남은 색이 두 종류 또는 한 종류뿐이면 한두 종류를 받는다', () => {
    const twoColors = { ...bank, green: 0, black: 0 };
    const oneColor = { ...twoColors, blue: 0 };
    expect(canTakeGems(twoColors, ['white', 'blue'])).toBe(true);
    expect(canTakeGems(twoColors, ['white'])).toBe(true);
    expect(canTakeGems(oneColor, ['white'])).toBe(true);
  });

  it('은행에 없는 색상은 획득할 수 없다', () => expect(canTakeGems(bank, ['red'])).toBe(false));

  it('같은 색상 두 개는 은행에 4개 이상 있어야 한다', () => {
    expect(canTakeGems({ ...bank, white: 3 }, ['white', 'white'])).toBe(false);
    expect(canTakeGems(bank, ['white', 'white'])).toBe(true);
  });

  it('황금 보석을 일반 획득 행동으로 가져올 수 없다', () =>
    expect(canTakeGems(bank, ['gold' as GemColor])).toBe(false));

  it('총 보유량과 초과 수량에 황금도 포함한다', () => {
    expect(gemCount(bank)).toBe(15);
    expect(excessGemCount({ ...empty, white: 9, gold: 2 })).toBe(1);
  });

  it('세 색 획득은 은행에서 플레이어로 정확히 이동하며 입력을 바꾸지 않는다', () => {
    const result = takeGems(bank, empty, ['white', 'blue', 'green']);
    expect(result.bank).toEqual({ ...bank, white: 3, blue: 1, green: 0 });
    expect(result.gems).toEqual({ ...empty, white: 1, blue: 1, green: 1 });
    expect(result.excess).toBe(0);
    expect(bank.white).toBe(4);
    expect(empty.white).toBe(0);
  });

  it('같은 색 두 개 획득과 재고 경계값을 적용한다', () => {
    expect(takeGems(bank, empty, ['white', 'white']).gems.white).toBe(2);
    expect(() => takeGems({ ...bank, white: 3 }, empty, ['white', 'white'])).toThrow(RangeError);
  });

  it('잘못된 색 조합과 보석 수량은 상태를 바꾸지 않고 거부한다', () => {
    for (const colors of [[], ['white'], ['white', 'white', 'white'], ['white', 'blue', 'blue'], ['gold']]) {
      expect(() => takeGems(bank, empty, colors as GemColor[])).toThrow(RangeError);
    }
    expect(() => takeGems({ ...bank, white: -1 }, empty, ['white', 'blue', 'green'])).toThrow(RangeError);
    expect(() => takeGems(bank, { ...empty, white: 0.5 }, ['white', 'blue', 'green'])).toThrow(RangeError);
    expect(canTakeGems({ ...bank, gold: Number.NaN }, ['white', 'blue', 'green'])).toBe(false);
    expect(bank.white).toBe(4);
    expect(empty.white).toBe(0);
  });

  it('10개를 넘으면 초과 수량을 알리고 황금을 포함해 정확히 반환한다', () => {
    const held = { ...empty, white: 8, gold: 1 };
    const taken = takeGems(bank, held, ['white', 'blue', 'green']);
    expect(taken.excess).toBe(2);
    expect(gemCount(taken.gems)).toBe(12);
    const returned = { ...empty, white: 1, gold: 1 };
    const discarded = discardExcessGems(taken.bank, taken.gems, returned);
    expect(gemCount(discarded.gems)).toBe(10);
    expect(discarded.gems.gold).toBe(0);
    expect(discarded.bank.white).toBe(bank.white);
    expect(discarded.bank.gold).toBe(bank.gold + 1);
    expect(taken.gems.gold).toBe(1);
  });

  it('11~13개 경계에서 초과분을 계산한다', () => {
    for (const [heldCount, excess] of [[8, 1], [9, 2], [10, 3]]) {
      const taken = takeGems(bank, { ...empty, white: heldCount }, ['white', 'blue', 'green']);
      expect(taken.excess).toBe(excess);
      expect(gemCount(taken.gems)).toBe(10 + excess);
    }
  });

  it('초과가 없거나 반환량이 적거나 많고, 보유량보다 많이 반환하면 거부한다', () => {
    const held = { ...empty, white: 10, gold: 1 };
    expect(() => discardExcessGems(bank, empty, { ...empty, white: 1 })).toThrow(RangeError);
    expect(() => discardExcessGems(bank, held, empty)).toThrow(RangeError);
    expect(() => discardExcessGems(bank, held, { ...empty, white: 2 })).toThrow(RangeError);
    expect(() => discardExcessGems(bank, held, { ...empty, blue: 1 })).toThrow(RangeError);
    expect(() => discardExcessGems(bank, held, { ...empty, gold: -1, white: 2 })).toThrow(RangeError);
    expect(held.white).toBe(10);
    expect(bank.white).toBe(4);
  });
});
