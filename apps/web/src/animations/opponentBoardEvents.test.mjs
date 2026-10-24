import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleNobleIds, reduceGameAction, toPublicGameView } from '@gem-arena/engine';
import { createTabletopDemo, DEMO_ME, demoOpponentAction } from '../data/tabletopDemo.ts';
import { opponentBoardEvents } from './opponentBoardEvents.ts';

const observer = 'demo-noah';
const events = (before, after, uid = observer) => opponentBoardEvents(toPublicGameView(before), toPublicGameView(after), uid);
test('opponent purchase includes bonus, payment and refill; own purchase never duplicates', () => {
  const before = createTabletopDemo('purchase');
  const action = demoOpponentAction(before);
  assert.equal(action.type, 'BUY_CARD');
  const after = reduceGameAction(before, DEMO_ME, action);
  const result = events(before, after);
  assert.ok(result.some(event => event.kind === 'purchase' && event.playerId === DEMO_ME));
  assert.ok(result.some(event => event.kind === 'refill'));
  assert.deepEqual(events(before, after, DEMO_ME), []);
});
test('same-color pair retains both chips and recipient identity', () => {
  const before = createTabletopDemo('reserve');
  const after = reduceGameAction(before, DEMO_ME, { type: 'TAKE_GEMS', colors: ['white', 'white'] });
  const result = events(before, after);
  assert.deepEqual(result, [{ kind: 'gem', playerId: DEMO_ME, color: 'white', count: 2, incoming: true }]);
});
test('opponent excess returns move the confirmed number of chips to the bank', () => {
  const before = createTabletopDemo('discard');
  const after = reduceGameAction(before, DEMO_ME, { type: 'DISCARD_GEMS', gems: { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 } });
  assert.deepEqual(events(before, after), [{ kind: 'gem', playerId: DEMO_ME, color: 'white', count: 2, incoming: false }]);
});
test('opponent noble visit identifies the public noble and correct score recipient', () => {
  const before = createTabletopDemo('noble');
  const nobleId = eligibleNobleIds(before, DEMO_ME)[0];
  const after = reduceGameAction(before, DEMO_ME, { type: 'CHOOSE_NOBLE', nobleId });
  assert.ok(events(before, after).some(event => event.kind === 'noble' && event.nobleId === nobleId && event.playerId === DEMO_ME));
});
test('hidden deck reservation only exposes deck level and gold reward', () => {
  const before = createTabletopDemo('reserve');
  const after = reduceGameAction(before, DEMO_ME, { type: 'RESERVE_CARD', level: 3 });
  const result = events(before, after);
  assert.ok(result.some(event => event.kind === 'reserve' && event.cardId === null && event.level === 3));
  assert.ok(!JSON.stringify(result).includes(after.players[DEMO_ME].reservedCardIds[0]));
});
test('initial-like, repeated, skipped and out-of-order versions never animate', () => {
  const before = createTabletopDemo();
  const after = reduceGameAction(before, DEMO_ME, demoOpponentAction(before));
  assert.deepEqual(events(before, before), []);
  assert.deepEqual(events(after, before), []);
  assert.deepEqual(events(before, { ...after, version: 3 }), []);
});
