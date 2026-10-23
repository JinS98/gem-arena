import { CARD_COLORS, canPayForCard, countCardBonuses, createInitialGameState, getDevelopmentCard, getNoble, remainingCardCost } from '@gem-arena/engine';
import type { DevelopmentCard, GameAction, Gem, Inventory, ServerGameState } from '@gem-arena/engine';

export const DEMO_ME = 'demo-me';
export const demoPlayers = [
  { id: DEMO_ME, name: '나', initials: '나' },
  { id: 'demo-aria', name: '아리아', initials: 'A' },
  { id: 'demo-leon', name: '레온', initials: 'L' },
  { id: 'demo-noah', name: '노아', initials: 'N' },
];
export const demoScenarios = {
  explore: { label: '자유 플레이', hint: '카드와 보석을 눌러보세요. 상대 차례는 ‘상대 행동 보기’로 진행할 수 있어요.' },
  purchase: { label: '카드 구매', hint: '1단계 카드를 누르고 구매해 보세요. 결제 칩 반환 → 카드 획득 → 새 카드 보충을 볼 수 있어요.' },
  reserve: { label: '카드 예약', hint: '시장 카드나 단계별 덱을 예약해 보세요. 카드 이동과 황금 칩 획득을 볼 수 있어요.' },
  discard: { label: '보석 반환', hint: '초과한 보석 2개를 선택해 은행으로 반환해 보세요.' },
  noble: { label: '귀족 방문', hint: '강조된 귀족 중 한 명을 선택해 보세요. 귀족 획득과 점수 상승을 볼 수 있어요.' },
} as const;
export type DemoScenario = keyof typeof demoScenarios;
export const emptyDemoGems = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

/** Isolated, explicitly prepared midgame fixtures. No Firebase or existing local store. */
export function createTabletopDemo(scenario: DemoScenario = 'explore'): ServerGameState {
  const game = createInitialGameState(demoPlayers.map(player => player.id), 20261023);
  game.firstPlayerIndex = 0;
  game.turnIndex = 0;
  function grant(playerId: string, color: typeof CARD_COLORS[number], count: number) {
    const owned = countCardBonuses(game.players[playerId].purchasedCardIds)[color];
    const candidates = game.decks[1].map(id => getDevelopmentCard(id)!).filter(card => card.bonusColor === color)
      .sort((a, b) => a.points - b.points).slice(0, Math.max(0, count - owned));
    for (const card of candidates) {
      game.decks[1] = game.decks[1].filter(id => id !== card.id);
      game.players[playerId].purchasedCardIds.push(card.id);
      game.players[playerId].score += card.points;
    }
  }
  // Five different permanent discounts make the first purchase easy to explore.
  for (const color of CARD_COLORS) grant(DEMO_ME, color, 1);
  grant('demo-aria', 'blue', 2);
  grant('demo-leon', 'red', 2);
  grant('demo-noah', 'green', 1);
  const inventories: Record<string, Inventory> = {
    [DEMO_ME]: { white: 1, blue: 2, green: 1, red: 2, black: 1, gold: 1 },
    'demo-aria': { white: 1, blue: 1, green: 1, red: 0, black: 0, gold: 0 },
    'demo-leon': { white: 0, blue: 1, green: 0, red: 1, black: 1, gold: 0 },
    'demo-noah': { white: 1, blue: 0, green: 1, red: 0, black: 1, gold: 0 },
  };
  if (scenario === 'reserve') inventories[DEMO_ME] = { white: 1, blue: 1, green: 1, red: 1, black: 1, gold: 0 };
  if (scenario === 'discard') {
    inventories[DEMO_ME] = { white: 2, blue: 3, green: 2, red: 2, black: 2, gold: 1 };
    game.phase = 'discarding';
  }
  if (scenario === 'noble') {
    const nobles = game.availableNobleIds.slice(0, 2).map(id => getNoble(id)!);
    for (const color of CARD_COLORS) grant(DEMO_ME, color, Math.max(...nobles.map(noble => noble.requirements[color])));
    game.phase = 'choosingNoble';
  }
  for (const player of demoPlayers) {
    game.players[player.id].gems = inventories[player.id];
    for (const color of [...CARD_COLORS, 'gold'] as Gem[]) game.bank[color] -= inventories[player.id][color];
  }
  return game;
}

export function demoPayment(card: DevelopmentCard, game: ServerGameState, uid = game.playerOrder[game.turnIndex]): Inventory {
  const player = game.players[uid];
  const cost = remainingCardCost(card.cost, countCardBonuses(player.purchasedCardIds));
  const payment = emptyDemoGems();
  for (const color of CARD_COLORS) {
    payment[color] = Math.min(cost[color], player.gems[color]);
    payment.gold += cost[color] - payment[color];
  }
  return payment;
}

/** Opponents run the same reducer as the viewer, without network simulation. */
export function demoOpponentAction(game: ServerGameState): GameAction {
  const player = game.players[game.playerOrder[game.turnIndex]];
  if (game.phase === 'discarding') {
    let excess = Object.values(player.gems).reduce((sum, value) => sum + value, 0) - 10;
    const gems = emptyDemoGems();
    for (const color of [...CARD_COLORS, 'gold'] as Gem[]) {
      gems[color] = Math.min(player.gems[color], excess);
      excess -= gems[color];
    }
    return { type: 'DISCARD_GEMS', gems };
  }
  if (game.phase === 'choosingNoble') return { type: 'TIMEOUT' };
  const bonuses = countCardBonuses(player.purchasedCardIds);
  for (const cardId of [...player.reservedCardIds, ...game.market[1], ...game.market[2], ...game.market[3]]) {
    if (!cardId) continue;
    const card = getDevelopmentCard(cardId)!;
    const payment = demoPayment(card, game);
    if (canPayForCard(card.cost, bonuses, player.gems, payment)) {
      return { type: 'BUY_CARD', cardId, source: player.reservedCardIds.includes(cardId) ? 'reserved' : 'market', payment };
    }
  }
  const colors = CARD_COLORS.filter(color => game.bank[color] > 0).slice(0, 3);
  if (colors.length) return { type: 'TAKE_GEMS', colors };
  const cardId = game.market[1].find(Boolean);
  if (cardId && player.reservedCardIds.length < 3) return { type: 'RESERVE_CARD', cardId };
  return { type: 'TIMEOUT' };
}
