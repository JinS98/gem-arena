import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_COLORS, canPayForCard, countCardBonuses, eligibleNobleIds, getDevelopmentCard, reduceGameAction } from '@gem-arena/engine';
import { createTabletopDemo, DEMO_ME, demoOpponentAction, demoPayment, demoScenarios } from './tabletopDemo.ts';

test('demo scenes keep cards unique and conserve the physical bank', () => {
  for (const scene of Object.keys(demoScenarios)) {
    const game = createTabletopDemo(scene);
    const ids = [...Object.values(game.market).flat().filter(Boolean), ...Object.values(game.decks).flat(),
      ...Object.values(game.players).flatMap(player => [...player.purchasedCardIds, ...player.reservedCardIds])];
    assert.equal(ids.length, new Set(ids).size, scene);
    for (const color of [...CARD_COLORS, 'gold']) {
      assert.ok(game.bank[color] >= 0, `${scene}: ${color}`);
      assert.equal(game.bank[color] + Object.values(game.players).reduce((sum, player) => sum + player.gems[color], 0), color === 'gold' ? 5 : 7);
    }
  }
});
test('purchase scene offers legal purchases with the real engine', () => {
  const game = createTabletopDemo('purchase');
  const bonuses = countCardBonuses(game.players[DEMO_ME].purchasedCardIds);
  const card = game.market[1].map(getDevelopmentCard).find(card => canPayForCard(card.cost, bonuses, game.players[DEMO_ME].gems, demoPayment(card, game)));
  assert.ok(card);
  const after = reduceGameAction(game, DEMO_ME, { type: 'BUY_CARD', cardId: card.id, source: 'market', payment: demoPayment(card, game) });
  assert.ok(after.players[DEMO_ME].purchasedCardIds.includes(card.id));
  assert.ok(!after.market[1].includes(card.id));
});
test('noble scene allows a real choice between at least two nobles', () => {
  const game = createTabletopDemo('noble');
  const eligible = eligibleNobleIds(game, DEMO_ME);
  assert.ok(eligible.length >= 2);
  const after = reduceGameAction(game, DEMO_ME, { type: 'CHOOSE_NOBLE', nobleId: eligible[0] });
  assert.equal(after.players[DEMO_ME].score, game.players[DEMO_ME].score + 3);
});
test('opponent demonstration can advance complete games in every scene', () => {
  for (const scene of Object.keys(demoScenarios)) {
    let game = createTabletopDemo(scene);
    for (let turn = 0; turn < 250 && game.phase !== 'finished'; turn++) {
      const before = game;
      game = reduceGameAction(game, game.playerOrder[game.turnIndex], demoOpponentAction(game));
      assert.equal(game.version, before.version + 1, scene);
    }
    assert.equal(game.phase, 'finished', `${scene} did not finish`);
  }
});
