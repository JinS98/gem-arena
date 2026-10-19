import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_CARDS, getDevelopmentCard, getNoble, NOBLES } from '../data/catalog';
import { validateCatalog } from '../data/validateCatalog';

describe('게임 카드·귀족 목록', () => {
  it('90장 카드와 10명 귀족이 모두 유효하고 단계별로 균형 있게 구성된다', () => {
    expect(DEVELOPMENT_CARDS).toHaveLength(90);
    expect(NOBLES).toHaveLength(10);
    expect(validateCatalog(DEVELOPMENT_CARDS, NOBLES)).toEqual([]);
    expect(DEVELOPMENT_CARDS.filter((card) => card.level === 1)).toHaveLength(40);
    expect(DEVELOPMENT_CARDS.filter((card) => card.level === 2)).toHaveLength(30);
    expect(DEVELOPMENT_CARDS.filter((card) => card.level === 3)).toHaveLength(20);
  });

  it('고정 ID로 동일한 카드·귀족을 조회하고 모르는 ID는 찾지 못한다', () => {
    const card = DEVELOPMENT_CARDS[0];
    const noble = NOBLES[0];
    expect(getDevelopmentCard(card.id)).toBe(card);
    expect(getNoble(noble.id)).toBe(noble);
    expect(getDevelopmentCard('missing')).toBeUndefined();
    expect(getNoble('missing')).toBeUndefined();
  });

  it('중복 ID, 음수 비용, 황금 비용, 누락된 카드가 검출된다', () => {
    const invalidCards = DEVELOPMENT_CARDS.map((card) => ({ ...card, cost: { ...card.cost } }));
    invalidCards[1].id = invalidCards[0].id;
    invalidCards[2].cost.red = -1;
    const withGold = { ...invalidCards[3], cost: { ...invalidCards[3].cost, gold: 1 } };
    const issues = validateCatalog([...invalidCards.slice(0, 3), withGold, ...invalidCards.slice(4, -1)], NOBLES);
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'cards', 'cards[1].id', 'cards[2].cost.red', 'cards[3].cost',
    ]));
  });

  it('귀족의 잘못된 요구량과 중복 ID를 검출한다', () => {
    const invalidNobles = NOBLES.map((noble) => ({ ...noble, requirements: { ...noble.requirements } }));
    invalidNobles[0].requirements.white = 4;
    invalidNobles[1].id = DEVELOPMENT_CARDS[0].id;
    const paths = validateCatalog(DEVELOPMENT_CARDS, invalidNobles).map((issue) => issue.path);
    expect(paths).toContain('nobles[0].requirements');
    expect(paths).toContain('nobles[1].id');
  });

  it('서로 다른 ID라도 귀족 조건이 중복되면 검출한다', () => {
    const invalidNobles = [...NOBLES];
    invalidNobles[1] = { ...NOBLES[1], requirements: NOBLES[0].requirements };
    expect(validateCatalog(DEVELOPMENT_CARDS, invalidNobles)).toContainEqual({
      path: 'nobles[1].requirements', message: '중복 귀족 조건입니다',
    });
  });
});
