import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, setLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
const { initializeGameViews } = requireFunctions('./lib/initializeGameViews.js');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com', projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const apps = [];

async function client(name, authenticate = true) {
  const app = initializeApp(config, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = authenticate ? (await signInAnonymously(auth)).user : null;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { user, db, submit: httpsCallable(functions, 'submitAction') };
}

const input = (version, action) => ({
  roomId: roomCode, actionId: `action-${randomBytes(8).toString('hex')}`,
  expectedVersion: version, action,
});
const reasonIs = (code, reason) => error =>
  error.code === `functions/${code}` && error.details?.reason === reason;

try {
  const [host, guest, outsider, anonymous] = await Promise.all([
    client('actions-host'), client('actions-guest'), client('actions-outsider'), client('actions-anonymous', false),
  ]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const room = admin.doc(`rooms/${roomCode}`);
  await room.set({
    roomCode, hostUid: host.user.uid, status: 'playing', capacity: 4,
    playerOrder: [host.user.uid, guest.user.uid],
    players: {
      [host.user.uid]: { uid: host.user.uid, ready: true, forfeited: false },
      [guest.user.uid]: { uid: guest.user.uid, ready: true, forfeited: false },
    },
  });
  await initializeGameViews(admin, roomCode);
  const initial = (await room.collection('privateState').doc('server').get()).data();
  const actor = initial.playerOrder[initial.turnIndex] === host.user.uid ? host : guest;
  const other = actor === host ? guest : host;
  const take = { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] };

  await assert.rejects(anonymous.submit(input(0, take)), reasonIs('unauthenticated', 'UNAUTHENTICATED'));
  await assert.rejects(outsider.submit(input(0, take)), reasonIs('permission-denied', 'NOT_ROOM_MEMBER'));
  await assert.rejects(other.submit(input(0, take)), reasonIs('permission-denied', 'NOT_YOUR_TURN'));
  await assert.rejects(actor.submit(input(0, { type: 'TIMEOUT' })), reasonIs('invalid-argument', 'INVALID_ACTION'));
  await assert.rejects(actor.submit({ ...input(0, take), actionId: 'bad/id' }), reasonIs('invalid-argument', 'INVALID_ACTION'));
  await assert.rejects(actor.submit(input(0, { type: 'TAKE_GEMS', colors: ['white', 'white', 'blue'] })), reasonIs('invalid-argument', 'INVALID_ACTION'));
  await assert.rejects(actor.submit(input(99, take)), reasonIs('failed-precondition', 'VERSION_CONFLICT'));
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 0);

  const firstInput = input(0, take);
  const result = (await actor.submit(firstInput)).data;
  assert.equal(result.version, 1);
  assert.equal(result.phase, 'playing');
  assert.equal(result.turnIndex, (initial.turnIndex + 1) % 2);
  const server = (await room.collection('privateState').doc('server').get()).data();
  const published = (await getDoc(doc(actor.db, 'rooms', roomCode, 'game', 'publicState'))).data();
  assert.equal(server.version, 1);
  assert.equal(published.version, 1);
  assert.equal(published.players[actor.user.uid].gems.white, 1);
  assert.equal(published.players[actor.user.uid].gems.blue, 1);
  assert.equal(published.players[actor.user.uid].gems.green, 1);
  assert.equal((await room.collection('privatePlayers').doc(actor.user.uid).get()).data().version, 1);
  assert.equal((await room.collection('privatePlayers').doc(other.user.uid).get()).data().version, 1);
  assert.deepEqual((await actor.submit(firstInput)).data, result);
  await assert.rejects(
    actor.submit({ ...firstInput, action: { type: 'TAKE_GEMS', colors: ['red', 'black', 'green'] } }),
    reasonIs('failed-precondition', 'ACTION_ID_REUSED'),
  );
  await assert.rejects(
    actor.submit({ ...firstInput, expectedVersion: 1 }),
    reasonIs('failed-precondition', 'ACTION_ID_REUSED'),
  );
  const receipt = room.collection('actionReceipts').doc(actor.user.uid).collection('actions').doc(firstInput.actionId);
  assert.deepEqual((await receipt.get()).data().result, result);
  await assert.rejects(
    getDoc(doc(actor.db, 'rooms', roomCode, 'actionReceipts', actor.user.uid, 'actions', firstInput.actionId)),
    error => error.code === 'permission-denied',
  );
  await assert.rejects(
    setDoc(doc(actor.db, 'rooms', roomCode, 'actionReceipts', actor.user.uid, 'actions', firstInput.actionId), { result: {} }),
    error => error.code === 'permission-denied',
  );
  await assert.rejects(actor.submit(input(0, take)), reasonIs('failed-precondition', 'VERSION_CONFLICT'));

  const reserveResult = (await other.submit(input(1, { type: 'RESERVE_CARD', level: 1 }))).data;
  assert.equal(reserveResult.version, 2);
  const reserved = (await room.collection('privatePlayers').doc(other.user.uid).get()).data();
  const secondPublic = (await getDoc(doc(actor.db, 'rooms', roomCode, 'game', 'publicState'))).data();
  assert.equal(reserved.reservedCardIds.length, 1);
  assert.equal(secondPublic.players[other.user.uid].reservedCount, 1);
  assert.equal(JSON.stringify(secondPublic).includes(reserved.reservedCardIds[0]), false);
  await assert.rejects(
    getDoc(doc(actor.db, 'rooms', roomCode, 'privatePlayers', other.user.uid)),
    error => error.code === 'permission-denied',
  );

  const sameInput = input(2, take);
  const [sameA, sameB] = await Promise.all([actor.submit(sameInput), actor.submit(sameInput)]);
  assert.deepEqual(sameA.data, sameB.data);
  assert.equal(sameA.data.version, 3);
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 3);
  assert.equal((await room.collection('actionReceipts').doc(actor.user.uid)
    .collection('actions').doc(sameInput.actionId).get()).exists, true);

  const competingA = input(3, { type: 'TAKE_GEMS', colors: ['red', 'black', 'white'] });
  const competingB = input(3, { type: 'RESERVE_CARD', level: 2 });
  const competing = await Promise.allSettled([other.submit(competingA), other.submit(competingB)]);
  assert.equal(competing.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(competing.filter(outcome => outcome.status === 'rejected' &&
    reasonIs('failed-precondition', 'VERSION_CONFLICT')(outcome.reason)).length, 1);
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 4);
  const receiptA = await room.collection('actionReceipts').doc(other.user.uid)
    .collection('actions').doc(competingA.actionId).get();
  const receiptB = await room.collection('actionReceipts').doc(other.user.uid)
    .collection('actions').doc(competingB.actionId).get();
  assert.equal(Number(receiptA.exists) + Number(receiptB.exists), 1);
  assert.deepEqual((await actor.submit(firstInput)).data, result);
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 4);

  // The server commits, but the client loses the response and resends the exact request.
  const lostResponse = input(4, take);
  const committed = (await actor.submit(lostResponse)).data;
  const retried = (await actor.submit(lostResponse)).data;
  assert.deepEqual(retried, committed);
  assert.equal(retried.version, 5);
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 5);
  assert.equal((await room.collection('game').doc('publicState').get()).data().version, 5);

  await room.update({ status: 'waiting' });
  await assert.rejects(actor.submit(input(5, take)), reasonIs('failed-precondition', 'GAME_NOT_STARTED'));
  assert.equal((await room.collection('privateState').doc('server').get()).data().version, 5);
  console.log('submitAction 인증·턴·규칙·멱등성·동시 요청 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
