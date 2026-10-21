import type { CardLevel, ColorCounts, DevelopmentCard, GemColor, Noble } from '../types/index.js';

export const CARD_COLORS = ['white', 'blue', 'green', 'red', 'black'] as const satisfies readonly GemColor[];

// Each cost is relative to the bonus color, then rotated through the five colors.
// These are original Gem Arena card values, not a transcription of another deck.
type CardPattern = readonly [points: number, cost: readonly [number, number, number, number, number]];
const CARD_PATTERNS: Record<CardLevel, readonly CardPattern[]> = {
  1: [
    [0, [0, 1, 1, 1, 0]], [0, [0, 0, 2, 1, 1]],
    [0, [0, 2, 0, 2, 1]], [0, [0, 1, 3, 0, 1]],
    [1, [0, 2, 2, 0, 0]], [1, [0, 0, 0, 4, 0]],
    [1, [0, 0, 2, 2, 2]], [0, [0, 3, 1, 1, 0]],
  ],
  2: [
    [1, [0, 2, 2, 2, 1]], [1, [0, 3, 2, 2, 0]],
    [2, [0, 2, 3, 3, 0]], [2, [0, 0, 5, 0, 3]],
    [2, [0, 4, 0, 4, 1]], [3, [0, 0, 0, 5, 3]],
  ],
  3: [
    [3, [0, 3, 3, 5, 3]], [4, [0, 4, 5, 4, 3]],
    [4, [0, 0, 7, 0, 3]], [5, [0, 0, 0, 7, 3]],
  ],
};

function colorCounts(values: readonly number[]): ColorCounts {
  return Object.freeze(Object.fromEntries(CARD_COLORS.map((color, index) => [color, values[index]]))) as ColorCounts;
}

function makeCards(): readonly DevelopmentCard[] {
  const cards: DevelopmentCard[] = [];
  for (const level of [1, 2, 3] as const) {
    for (const [colorIndex, bonusColor] of CARD_COLORS.entries()) {
      CARD_PATTERNS[level].forEach(([points, relativeCost], patternIndex) => {
        const cost = colorCounts(CARD_COLORS.map((_, index) => relativeCost[(index - colorIndex + 5) % 5]));
        cards.push(Object.freeze({
          id: `L${level}-${bonusColor.toUpperCase()}-${String(patternIndex + 1).padStart(2, '0')}`,
          level, bonusColor, points, cost,
        }));
      });
    }
  }
  return Object.freeze(cards);
}

export const DEVELOPMENT_CARDS = makeCards();

// One noble for each three-color combination. Only purchased-card bonuses count.
function makeNobles(): readonly Noble[] {
  const nobles: Noble[] = [];
  for (let first = 0; first < CARD_COLORS.length; first++) {
    for (let second = first + 1; second < CARD_COLORS.length; second++) {
      for (let third = second + 1; third < CARD_COLORS.length; third++) {
        const requiredColors = [CARD_COLORS[first], CARD_COLORS[second], CARD_COLORS[third]];
        nobles.push(Object.freeze({
          id: `N-${requiredColors.map((color) => color.toUpperCase()).join('-')}`,
          points: 3,
          requirements: colorCounts(CARD_COLORS.map((color) => requiredColors.includes(color) ? 3 : 0)),
        }));
      }
    }
  }
  return Object.freeze(nobles);
}

export const NOBLES = makeNobles();

const cardsById = new Map(DEVELOPMENT_CARDS.map((card) => [card.id, card]));
const noblesById = new Map(NOBLES.map((noble) => [noble.id, noble]));

export function getDevelopmentCard(id: string): DevelopmentCard | undefined {
  return cardsById.get(id);
}

export function getNoble(id: string): Noble | undefined {
  return noblesById.get(id);
}
