import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, setLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  CARD_COLORS, canTakeGems, countCardBonuses, eligibleNobleIds, excessGemCount,
  getDevelopmentCard, hasLegalBasicAction, reduceGameAction, remainingCardCost,
  toPrivatePlayerView, toPublicGameView,
} from '../../../packages/game-engine/dist/index.js';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com',
  projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const empty = () => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function chooseAction(state) {
  const actor = state.playerOrder[state.turnIndex];
  const player = state.players[actor];
  if (state.phase === 'choosingNoble') {
    return { type: 'CHOOSE_NOBLE', nobleId: eligibleNobleIds(state, actor)[0] };
  }
  if (state.phase === 'discarding') {
    const gems = empty();
    let excess = excessGemCount(player.gems);
    for (const color of [...CARD_COLORS, 'gold']) {
      gems[color] = Math.min(player.gems[color], excess);
      excess -= gems[color];
    }
    return { type: 'DISCARD_GEMS', gems };
  }
  const bonuses = countCardBonuses(player.purchasedCardIds);
  const offered = [
    ...Object.values(state.market).flat().filter(Boolean).map(id => ({ id, source: 'market' })),
    ...player.reservedCardIds.map(id => ({ id, source: 'reserved' })),
  ];
  const candidates = offered.map(({ id, source }) => {
    const card = getDevelopmentCard(id);
    const cost = remainingCardCost(card.cost, bonuses);
    const missing = CARD_COLORS.reduce((sum, color) =>
      sum + Math.max(0, cost[color] - player.gems[color]), 0);
    return { card, source, cost, missing };
  });
  const affordable = candidates.filter(({ missing }) => missing <= player.gems.gold)
    .sort((a, b) => b.card.points - a.card.points ||
      a.card.level - b.card.level || a.card.id.localeCompare(b.card.id));
  if (affordable.length) {
    const choice = affordable[0];
    const payment = empty();
    for (const color of CARD_COLORS) payment[color] = Math.min(choice.cost[color], player.gems[color]);
    payment.gold = CARD_COLORS.reduce((sum, color) => sum + choice.cost[color] - payment[color], 0);
    return { type: 'BUY_CARD', cardId: choice.card.id, source: choice.source, payment };
  }
  const available = CARD_COLORS.filter(color => state.bank[color] > 0);
  if (available.length) {
    const target = candidates.sort((a, b) =>
      a.missing - b.missing || b.card.points - a.card.points || a.card.level - b.card.level)[0];
    const colors = [...available].sort((a, b) => {
      const aNeed = Math.max(0, (target?.cost[a] ?? 0) - player.gems[a]);
      const bNeed = Math.max(0, (target?.cost[b] ?? 0) - player.gems[b]);
      return bNeed - aNeed || player.gems[a] - player.gems[b];
    }).slice(0, 3);
    if (canTakeGems(state.bank, colors)) return { type: 'TAKE_GEMS', colors };
  }
  const reservable = Object.values(state.market).flat().find(Boolean);
  if (player.reservedCardIds.length < 3 && reservable) {
    return { type: 'RESERVE_CARD', cardId: reservable };
  }
  if (!hasLegalBasicAction(state, actor)) return { type: 'PASS' };
  throw new Error(`버전 ${state.version}: 합법적인 행동을 선택하지 못했습니다`);
}

async function client(name, apps) {
  const app = initializeApp(config, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = (await signInAnonymously(auth)).user;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { user, db, submit: httpsCallable(functions, 'submitAction') };
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(25);
  }
  throw new Error(`${label}: ${timeout}ms 안에 구독 상태가 일치하지 않았습니다`);
}

async function complete(playerCount, admin) {
  const apps = [];
  const stops = [];
  let subscriptionError = null;
  const started = performance.now();
  try {
    const roomCode = code();
    const players = await Promise.all(Array.from({ length: playerCount }, (_, index) =>
      client(`complete-${playerCount}-${index}-${roomCode}`, apps)));
    const ids = players.map(player => player.user.uid);
    const room = admin.doc(`rooms/${roomCode}`);
    await room.set({ roomCode, hostUid: ids[0], status: 'waiting', capacity: 4,
      playerOrder: ids, players: Object.fromEntries(ids.map((uid, index) =>
        [uid, { uid, nickname: `참가자 ${index + 1}`, ready: true, forfeited: false }])) });

    const latest = players.map(() => ({ public: null, private: null, publicReads: 0,
      privateReads: 0, publicBytes: 0, privateBytes: 0 }));
    for (const [index, player] of players.entries()) {
      const watch = (path, kind) => onSnapshot(doc(player.db, ...path), snapshot => {
        if (snapshot.metadata.fromCache || !snapshot.exists()) return;
        const value = snapshot.data();
        const entry = latest[index];
        // Metadata-only events are not additional document deliveries.
        if (entry[kind]?.version === value.version) return;
        entry[kind] = value;
        entry[`${kind}Reads`]++;
        entry[`${kind}Bytes`] += Buffer.byteLength(JSON.stringify(value));
      }, error => { subscriptionError = error; });
      stops.push(watch(['rooms', roomCode, 'game', 'publicState'], 'public'));
      stops.push(watch(['rooms', roomCode, 'privatePlayers', player.user.uid], 'private'));
    }
    await room.update({ status: 'playing' });
    await waitFor(() => {
      if (subscriptionError) throw subscriptionError;
      return latest.every(entry => entry.public?.version === 0 && entry.private?.version === 0);
    }, `${playerCount}인 시작`);
    let state = (await room.collection('privateState').doc('server').get()).data();
    assert.equal(state.version, 0);
    assert.deepEqual(Object.values(state.players).map(player => player.gems),
      Array.from({ length: playerCount }, empty));
    const actionTimes = [];
    const syncTimes = [];
    const seen = new Set();
    let checkedPrivacy = false;
    while (state.phase !== 'finished' && state.version < 1500) {
      const uid = state.playerOrder[state.turnIndex];
      const actor = players.find(player => player.user.uid === uid);
      const action = state.version === 0 ? { type: 'RESERVE_CARD', level: 1 } : chooseAction(state);
      const expected = reduceGameAction(state, uid, action);
      const request = { roomId: roomCode, actionId: `turn-${state.version}`,
        expectedVersion: state.version, action };
      const sentAt = performance.now();
      const result = (await actor.submit(request)).data;
      const acceptedAt = performance.now();
      assert.equal(result.version, expected.version);
      assert.equal(result.phase, expected.phase);
      actionTimes.push(acceptedAt - sentAt);
      seen.add(action.type);
      await waitFor(() => {
        if (subscriptionError) throw subscriptionError;
        return latest.every(entry => entry.public?.version === expected.version &&
          entry.private?.version === expected.version);
      }, `${playerCount}인 버전 ${expected.version}`);
      syncTimes.push(performance.now() - sentAt);
      for (const [index, entry] of latest.entries()) {
        const { turnDeadlineAt, ...publicView } = entry.public;
        assert.deepEqual(publicView, toPublicGameView(expected));
        if (expected.phase === 'finished') assert.equal(turnDeadlineAt, null);
        else assert.ok(Number.isSafeInteger(turnDeadlineAt) && turnDeadlineAt > Date.now());
        assert.deepEqual(entry.private, toPrivatePlayerView(expected, ids[index]));
      }
      if (!checkedPrivacy && action.type === 'RESERVE_CARD') {
        const reservedId = expected.players[uid].reservedCardIds[0];
        assert.ok(reservedId);
        assert.equal(JSON.stringify(latest[0].public).includes(reservedId), false);
        for (const [index, viewer] of players.entries()) {
          if (viewer.user.uid === uid) continue;
          await assert.rejects(getDoc(doc(viewer.db, 'rooms', roomCode, 'privatePlayers', uid)),
            error => error.code === 'permission-denied');
          assert.equal(latest[index].private.reservedCardIds.includes(reservedId), false);
        }
        checkedPrivacy = true;
      }
      state = expected;
    }
    assert.equal(state.phase, 'finished');
    assert.ok(state.winnerIds.length > 0);
    assert.ok(checkedPrivacy);
    for (const type of ['RESERVE_CARD', 'TAKE_GEMS', 'BUY_CARD']) assert.ok(seen.has(type), type);
    assert.equal((await room.get()).get('status'), 'finished');
    assert.deepEqual((await room.collection('privateState').doc('server').get()).data(), state);
    const sample = values => {
      const sorted = [...values].sort((a, b) => a - b);
      return { medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
        p95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]),
        maxMs: Math.round(sorted.at(-1)) };
    };
    return { players: playerCount, roomCode, actions: state.version, winnerSeats: state.winnerIds.map(id => ids.indexOf(id) + 1),
      durationSec: Math.round((performance.now() - started) / 1000), callable: sample(actionTimes), synced: sample(syncTimes),
      observedClientDocuments: latest.reduce((sum, entry) => sum + entry.publicReads + entry.privateReads, 0),
      expectedClientDocuments: 2 * playerCount * (state.version + 1),
      observedPayloadBytes: latest.reduce((sum, entry) => sum + entry.publicBytes + entry.privateBytes, 0),
      transactionReadsLowerBound: 3 * state.version + 1,
      estimatedAppWrites: (playerCount + 3) * state.version + playerCount + 5,
      actionTypes: [...seen].sort() };
  } finally {
    stops.forEach(stop => stop());
    await Promise.all(apps.map(deleteApp));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const counts = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [2, 3, 4];
  if (counts.some(count => ![2, 3, 4].includes(count))) throw new Error('인원은 2, 3, 4만 가능합니다');
  for (const count of counts) {
    const result = await complete(count, admin);
    console.log(JSON.stringify(result));
  }
}
