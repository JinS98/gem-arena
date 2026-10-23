import assert from 'node:assert/strict';
import test from 'node:test';
import { reduceGameAction } from '@gem-arena/engine';
import { createTabletopDemo, DEMO_ME, demoOpponentAction } from '../data/tabletopDemo.ts';
import { tabletopEvents } from './tabletopEvents.ts';

test('same version, skipped versions and resets never replay effects', () => {
  const before = createTabletopDemo();
  assert.deepEqual(tabletopEvents(before, before), []);
  assert.deepEqual(tabletopEvents(before, { ...before, version: 3 }), []);
  assert.deepEqual(tabletopEvents({ ...before, version: 8 }, before), []);
  assert.deepEqual(tabletopEvents(before, { ...before, version: 1, playerOrder: [...before.playerOrder].reverse() }), []);
});
test('a purchase produces a card flight, payment returns and market refill', () => {
  const before = createTabletopDemo('purchase');
  const action = demoOpponentAction(before);
  assert.equal(action.type, 'BUY_CARD');
  const after = reduceGameAction(before, DEMO_ME, action);
  const events = tabletopEvents(before, after);
  assert.ok(events.some(event => event.kind === 'purchase' && event.cardId === action.cardId));
  assert.ok(events.some(event => event.kind === 'refill'));
  assert.ok(events.some(event => event.kind === 'turn'));
});
test('hidden deck reservation events contain a level and never a hidden card identity', () => {
  const before = createTabletopDemo('reserve');
  const after = reduceGameAction(before, DEMO_ME, { type: 'RESERVE_CARD', level: 3 });
  const event = tabletopEvents(before, after).find(event => event.kind === 'reserve');
  assert.equal(event.cardId, null);
  assert.equal(event.level, 3);
  assert.ok(!JSON.stringify(event).includes(after.players[DEMO_ME].reservedCardIds[0]));
});
