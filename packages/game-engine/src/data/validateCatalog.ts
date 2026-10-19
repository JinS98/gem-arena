import { CARD_COLORS } from './catalog';
import type { CardLevel, GemColor } from '../types/index';

export interface CatalogIssue { path: string; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkCounts(value: unknown, path: string, issues: CatalogIssue[]): void {
  if (!isRecord(value) || Object.keys(value).length !== CARD_COLORS.length ||
      !CARD_COLORS.every((color) => Object.hasOwn(value, color))) {
    issues.push({ path, message: '일반 보석 5색의 수량이 정확히 필요합니다' });
    return;
  }
  for (const color of CARD_COLORS) {
    if (!Number.isSafeInteger(value[color]) || (value[color] as number) < 0) {
      issues.push({ path: `${path}.${color}`, message: '0 이상의 안전한 정수여야 합니다' });
    }
  }
}

function checkId(value: unknown, path: string, seen: Set<string>, issues: CatalogIssue[]): void {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({ path, message: '비어 있지 않은 ID가 필요합니다' });
  } else if (seen.has(value)) {
    issues.push({ path, message: '중복 ID입니다' });
  } else {
    seen.add(value);
  }
}

/** Validate untrusted or edited card data before using it to create a game. */
export function validateCatalog(cards: readonly unknown[], nobles: readonly unknown[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seen = new Set<string>();
  const seenNobleRequirements = new Set<string>();
  const expectedPerColor: Record<CardLevel, number> = { 1: 8, 2: 6, 3: 4 };
  const counts = new Map<string, number>();

  if (cards.length !== 90) issues.push({ path: 'cards', message: '카드는 90장이어야 합니다' });
  if (nobles.length !== 10) issues.push({ path: 'nobles', message: '귀족은 10명이어야 합니다' });

  cards.forEach((value, index) => {
    const path = `cards[${index}]`;
    if (!isRecord(value)) {
      issues.push({ path, message: '카드는 객체여야 합니다' });
      return;
    }
    checkId(value.id, `${path}.id`, seen, issues);
    const level = value.level;
    const bonusColor = value.bonusColor;
    if (level !== 1 && level !== 2 && level !== 3) {
      issues.push({ path: `${path}.level`, message: '단계는 1, 2, 3 중 하나여야 합니다' });
    }
    if (!CARD_COLORS.includes(bonusColor as GemColor)) {
      issues.push({ path: `${path}.bonusColor`, message: '일반 보석 색이어야 합니다' });
    }
    if (typeof level === 'number' && expectedPerColor[level as CardLevel] &&
        typeof bonusColor === 'string' && CARD_COLORS.includes(bonusColor as GemColor)) {
      const key = `${level}:${bonusColor}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (!Number.isSafeInteger(value.points) || (value.points as number) < 0 || (value.points as number) > 5) {
      issues.push({ path: `${path}.points`, message: '점수는 0~5의 정수여야 합니다' });
    }
    checkCounts(value.cost, `${path}.cost`, issues);
  });

  for (const level of [1, 2, 3] as const) {
    for (const color of CARD_COLORS) {
      if ((counts.get(`${level}:${color}`) ?? 0) !== expectedPerColor[level]) {
        issues.push({ path: `cards.${level}.${color}`, message: `${expectedPerColor[level]}장이 필요합니다` });
      }
    }
  }

  nobles.forEach((value, index) => {
    const path = `nobles[${index}]`;
    if (!isRecord(value)) {
      issues.push({ path, message: '귀족은 객체여야 합니다' });
      return;
    }
    checkId(value.id, `${path}.id`, seen, issues);
    if (value.points !== 3) issues.push({ path: `${path}.points`, message: '귀족 점수는 3점이어야 합니다' });
    checkCounts(value.requirements, `${path}.requirements`, issues);
    const nobleRequirements = value.requirements;
    if (isRecord(nobleRequirements) && CARD_COLORS.every((color) =>
        Number.isSafeInteger(nobleRequirements[color]))) {
      const requirements = CARD_COLORS.map((color) => nobleRequirements[color]);
      if (requirements.filter((count) => count === 3).length !== 3 ||
          requirements.some((count) => count !== 0 && count !== 3)) {
        issues.push({ path: `${path}.requirements`, message: '서로 다른 세 색에 3개씩 요구해야 합니다' });
      } else {
        const signature = requirements.join(',');
        if (seenNobleRequirements.has(signature)) {
          issues.push({ path: `${path}.requirements`, message: '중복 귀족 조건입니다' });
        }
        seenNobleRequirements.add(signature);
      }
    }
  });

  return issues;
}
