import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, setLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { createInitialGameState, getDevelopmentCard, reduceGameAction, toPrivatePlayerView, toPublicGameView } from '../../../packages/game-engine/dist/index.js';

// This script always targets local emulators, never a production project.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
await fetch('http://127.0.0.1:9099/', { signal: AbortSignal.timeout(2500) });
const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
const submitters = new Map();
const submitGameAction = async (admin, uid, request) => {
  const state = (await admin.doc(`rooms/${request.roomId}/privateState/server`).get()).data();
  if (state.version === request.expectedVersion) reduceGameAction(state, uid, request.action);
  try { return (await submitters.get(uid)(request)).data; }
  catch (error) { throw new Error(`Version ${request.expectedVersion} ${request.action.type}: ${error.message}`, { cause: error }); }
};
const config = { apiKey: 'demo-api-key', projectId: 'demo-gem-arena', appId: 'opponent-reservations-test' };
const apps = [];
setLogLevel('silent');
async function client(name) {
  const app = initializeApp(config, `${name}-${randomBytes(3).toString('hex')}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = (await signInAnonymously(auth)).user;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  submitters.set(user.uid, httpsCallable(functions, 'submitAction', { timeout: 10000 }));
  return { uid: user.uid, db };
}
const adminApp = initializeAdminApp({ projectId: config.projectId }, `reservations-${Date.now()}`);
const admin = getAdminFirestore(adminApp);
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const room = admin.doc(`rooms/${code}`);
try {
  const [owner, viewer, outsider] = await Promise.all([client('owner'), client('viewer'), client('outsider')]);
  const state = createInitialGameState([owner.uid, viewer.uid], 20261024);
  state.firstPlayerIndex = 0; state.turnIndex = 0;
  const marketId = [...state.market[1]].sort((a, b) => Object.values(getDevelopmentCard(a).cost).reduce((s, n) => s + n, 0) - Object.values(getDevelopmentCard(b).cost).reduce((s, n) => s + n, 0))[0];
  const cost = getDevelopmentCard(marketId).cost;
  state.players[owner.uid].gems = { ...cost, gold: 0 };
  for (const [color, count] of Object.entries(cost)) state.bank[color] -= count;
  const hiddenId = state.decks[3][0];
  const batch = admin.batch();
  batch.set(room, { roomCode: code, hostUid: owner.uid, status: 'playing', capacity: 4,
    turnDeadlineAt: Date.now() + 180000, playerOrder: state.playerOrder,
    players: Object.fromEntries(state.playerOrder.map(uid => [uid, { uid, nickname: uid === owner.uid ? '예약자' : '확인자', ready: true, forfeited: false }])) });
  batch.set(room.collection('privateState').doc('server'), state);
  batch.set(room.collection('game').doc('publicState'), toPublicGameView(state));
  for (const uid of state.playerOrder) batch.set(room.collection('privatePlayers').doc(uid), toPrivatePlayerView(state, uid));
  await batch.commit();
  const request = (version, action) => ({ roomId: code, actionId: randomBytes(12).toString('hex'), expectedVersion: version, action });
  const publicDoc = () => getDoc(doc(viewer.db, 'rooms', code, 'game', 'publicState'));
  await submitGameAction(admin, owner.uid, request(0, { type: 'RESERVE_CARD', cardId: marketId }));
  assert.deepEqual((await publicDoc()).data().players[owner.uid].reservedCards, [{ cardId: marketId, level: 1 }]);
  const availableGem = async () => Object.entries((await room.collection('privateState').doc('server').get()).data().bank).filter(([color, count]) => color !== 'gold' && count > 0).slice(0, 3).map(([color]) => color);
  await submitGameAction(admin, viewer.uid, request(1, { type: 'TAKE_GEMS', colors: await availableGem() }));
  const reserveHidden = request(2, { type: 'RESERVE_CARD', level: 3 });
  await submitGameAction(admin, owner.uid, reserveHidden);
  await submitGameAction(admin, owner.uid, reserveHidden); // Retry cannot duplicate public metadata.
  const published = (await publicDoc()).data();
  assert.deepEqual(published.players[owner.uid].reservedCards, [{ cardId: marketId, level: 1 }, { cardId: null, level: 3 }]);
  assert.ok(!JSON.stringify(published).includes(hiddenId));
  assert.deepEqual((await getDoc(doc(owner.db, 'rooms', code, 'privatePlayers', owner.uid))).data().reservedCardIds, [marketId, hiddenId]);
  const denied = error => error.code === 'permission-denied';
  await assert.rejects(getDoc(doc(viewer.db, 'rooms', code, 'privatePlayers', owner.uid)), denied);
  await assert.rejects(getDoc(doc(outsider.db, 'rooms', code, 'game', 'publicState')), denied);
  await assert.rejects(setDoc(doc(viewer.db, 'rooms', code, 'game', 'publicState'), published), denied);
  await submitGameAction(admin, viewer.uid, request(3, { type: 'TAKE_GEMS', colors: await availableGem() }));
  await submitGameAction(admin, owner.uid, request(4, { type: 'BUY_CARD', cardId: marketId, source: 'reserved', payment: { ...cost, gold: 0 } }));
  assert.deepEqual((await publicDoc()).data().players[owner.uid].reservedCards, [{ cardId: null, level: 3 }]);
  console.log('PASS market face-up / deck face-down, private access denied, retry deduplication and purchase removal');
} finally {
  await admin.recursiveDelete(room);
  await Promise.all(apps.map(deleteApp));
  await deleteAdminApp(adminApp);
}
