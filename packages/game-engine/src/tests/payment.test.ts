import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_CARDS } from '../data/catalog';
import { canPayForCard, countCardBonuses, payForCard, remainingCardCost } from '../rules/payment';
import type { ColorCounts, Inventory } from '../types/index';

const cost: ColorCounts = { white: 3, blue: 2, green: 0, red: 0, black: 0 };
const bonuses: ColorCounts = { white: 1, blue: 1, green: 0, red: 0, black: 0 };
const emptyPayment: Inventory = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
const held: Inventory = { ...emptyPayment, white: 2, blue: 1, gold: 2 };
const bank: Inventory = { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 };

describe('카드 비용과 결제', () => {
  it('구매한 카드만 색별 영구 할인으로 계산한다', () => {
    const whiteCards = DEVELOPMENT_CARDS.filter((card) => card.bonusColor === 'white');
    const blueCard = DEVELOPMENT_CARDS.find((card) => card.bonusColor === 'blue')!;
    expect(countCardBonuses([whiteCards[0].id, whiteCards[1].id, blueCard.id])).toEqual({
      white: 2, blue: 1, green: 0, red: 0, black: 0,
    });
    expect(countCardBonuses([])).toEqual({ white: 0, blue: 0, green: 0, red: 0, black: 0 });
  });

  it('중복 또는 존재하지 않는 구매 카드 ID를 거부한다', () => {
    const id = DEVELOPMENT_CARDS[0].id;
    expect(() => countCardBonuses([id, id])).toThrow(RangeError);
    expect(() => countCardBonuses(['missing'])).toThrow(RangeError);
  });

  it('색별 할인을 적용하고 초과 할인은 비용 0으로 멈춘다', () => {
    expect(remainingCardCost(cost, bonuses)).toEqual({ white: 2, blue: 1, green: 0, red: 0, black: 0 });
    expect(remainingCardCost(cost, { ...bonuses, white: 9, blue: 9 })).toEqual({
      white: 0, blue: 0, green: 0, red: 0, black: 0,
    });
    expect(cost.white).toBe(3);
  });

  it('일반 보석과 황금을 혼합해 남은 비용을 정확히 결제한다', () => {
    const payment = { ...emptyPayment, white: 1, gold: 2 };
    expect(canPayForCard(cost, bonuses, held, payment)).toBe(true);
    const result = payForCard(bank, held, cost, bonuses, payment);
    expect(result.bank).toEqual({ ...bank, white: 5, gold: 7 });
    expect(result.gems).toEqual({ ...held, white: 1, gold: 0 });
    expect(bank.white).toBe(4);
    expect(held.white).toBe(2);
    expect(payment.white).toBe(1);
  });

  it('일반 보석이 충분해도 같은 색 대신 황금을 쓸 수 있다', () => {
    expect(canPayForCard(cost, bonuses, { ...held, gold: 3 }, { ...emptyPayment, gold: 3 })).toBe(true);
    expect(canPayForCard(cost, bonuses, held, { ...emptyPayment, white: 2, blue: 1 })).toBe(true);
  });

  it('할인으로 비용이 0이면 아무 보석도 받거나 낼 수 없다', () => {
    const freeBonuses = { ...bonuses, white: 3, blue: 2 };
    expect(canPayForCard(cost, freeBonuses, held, emptyPayment)).toBe(true);
    expect(canPayForCard(cost, freeBonuses, held, { ...emptyPayment, gold: 1 })).toBe(false);
    expect(payForCard(bank, held, cost, freeBonuses, emptyPayment)).toEqual({ bank, gems: held });
  });

  it('부족·초과·잘못된 색·보유량 초과 결제를 거부한다', () => {
    const richHeld = { ...held, white: 3, blue: 2, green: 1, gold: 4 };
    const badPayments = [
      { ...emptyPayment, white: 1, gold: 1 },
      { ...emptyPayment, white: 1, gold: 3 },
      { ...emptyPayment, white: 3 },
      { ...emptyPayment, green: 1, gold: 3 },
      { ...emptyPayment, white: 2, blue: 1, gold: 1 },
      { ...emptyPayment, white: 1, gold: 2.5 },
      { ...emptyPayment, white: -1, gold: 4 },
    ];
    for (const payment of badPayments) {
      expect(canPayForCard(cost, bonuses, richHeld, payment)).toBe(false);
      expect(() => payForCard(bank, richHeld, cost, bonuses, payment)).toThrow(RangeError);
    }
    expect(canPayForCard(cost, bonuses, { ...held, gold: 1 },
      { ...emptyPayment, white: 1, gold: 2 })).toBe(false);
    expect(bank.white).toBe(4);
    expect(held.gold).toBe(2);
  });

  it('비용·할인·보유량·결제량의 잘못된 형태를 거부한다', () => {
    const validPayment = { ...emptyPayment, white: 2, blue: 1 };
    expect(canPayForCard({ ...cost, gold: 1 } as ColorCounts, bonuses, held, validPayment)).toBe(false);
    expect(canPayForCard(cost, { ...bonuses, white: -1 }, held, validPayment)).toBe(false);
    expect(canPayForCard(cost, bonuses, { ...held, gold: Number.NaN }, validPayment)).toBe(false);
    expect(canPayForCard(cost, bonuses, held, { ...validPayment, extra: 1 } as Inventory)).toBe(false);
    expect(() => remainingCardCost({ ...cost, blue: 0.5 }, bonuses)).toThrow(RangeError);
  });
});
