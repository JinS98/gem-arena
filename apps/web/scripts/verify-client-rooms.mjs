import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { arrayUnion, collection, connectFirestoreEmulator, doc, FieldPath, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, setLogLevel, updateDoc } from 'firebase/firestore';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com', projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const apps = [];
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');

async function client(name, signedIn = true) {
  const app = initializeApp(config, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  const user = signedIn ? (await signInAnonymously(auth)).user : null;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { user, db };
}

function create(client, roomCode, nickname = '방장') {
  const uid = client.user.uid;
  return setDoc(doc(client.db, 'rooms', roomCode), {
    roomCode,
    title: '보석 상인의 방',
    hostUid: uid,
    status: 'waiting',
    playerOrder: [uid],
    players: { [uid]: { uid, nickname, ready: false, forfeited: false, joinedAt: serverTimestamp() } },
    capacity: 4,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function join(client, roomCode, nickname = '손님') {
  const uid = client.user.uid;
  return updateDoc(
    doc(client.db, 'rooms', roomCode),
    'playerOrder', arrayUnion(uid),
    new FieldPath('players', uid), { uid, nickname, ready: false, forfeited: false, joinedAt: serverTimestamp() },
    'updatedAt', serverTimestamp(),
  );
}

function ready(client, roomCode, value) {
  return updateDoc(
    doc(client.db, 'rooms', roomCode),
    new FieldPath('players', client.user.uid, 'ready'), value,
    'updatedAt', serverTimestamp(),
  );
}

function start(client, roomCode) {
  return updateDoc(
    doc(client.db, 'rooms', roomCode),
    'status', 'playing',
    'startedAt', serverTimestamp(),
    'updatedAt', serverTimestamp(),
  );
}

const denied = error => error.code === 'permission-denied';

try {
  const [host, guest, third, fourth, fifth, outsider, unauthenticated] = await Promise.all([
    client('host'), client('guest'), client('third'), client('fourth'), client('fifth'), client('outsider'), client('unauthenticated', false),
  ]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const roomCode = code();
  const roomRef = doc(host.db, 'rooms', roomCode);

  await assert.rejects(getDoc(doc(unauthenticated.db, 'rooms', roomCode)), denied);
  await assert.rejects(getDocs(collection(host.db, 'rooms')), denied);
  await assert.rejects(setDoc(doc(outsider.db, 'rooms', code()), { status: 'waiting' }), denied);
  await assert.rejects(create(host, 'INVALID1'), denied);
  await assert.rejects(setDoc(doc(unauthenticated.db, 'rooms', code()), { status: 'waiting' }), denied);

  await create(host, roomCode);
  assert.equal((await getDoc(roomRef)).data().title, '보석 상인의 방');
  assert.equal((await getDoc(roomRef)).data().hostUid, host.user.uid);
  await assert.rejects(getDoc(doc(outsider.db, 'rooms', roomCode)), denied);
  await assert.rejects(setDoc(roomRef, { status: 'playing' }, { merge: true }), denied);
  await assert.rejects(updateDoc(doc(outsider.db, 'rooms', roomCode), 'hostUid', outsider.user.uid), denied);
  await assert.rejects(getDoc(doc(host.db, 'roomCodes', roomCode)), denied);

  await join(guest, roomCode, '방장');
  assert.equal((await getDoc(doc(guest.db, 'rooms', roomCode))).data().players[guest.user.uid].nickname, '방장');
  assert.deepEqual((await getDoc(roomRef)).data().playerOrder, [host.user.uid, guest.user.uid]);
  await assert.rejects(join(guest, roomCode), denied);
  await assert.rejects(updateDoc(doc(outsider.db, 'rooms', roomCode), 'playerOrder', arrayUnion(outsider.user.uid), 'updatedAt', serverTimestamp()), denied);
  await assert.rejects(updateDoc(doc(outsider.db, 'rooms', roomCode), 'status', 'playing'), denied);
  await assert.rejects(join(outsider, 'AAAAAAAA'), error => error.code === 'not-found' || denied(error));

  await join(third, roomCode);
  const lastSeat = await Promise.allSettled([join(fourth, roomCode), join(fifth, roomCode)]);
  assert.equal(lastSeat.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(lastSeat.filter(result => result.status === 'rejected' && denied(result.reason)).length, 1);
  assert.equal((await getDoc(roomRef)).data().playerOrder.length, 4);
  const fourthSeat = lastSeat[0].status === 'fulfilled' ? fourth : fifth;
  await Promise.all([ready(host, roomCode, true), ready(guest, roomCode, true), ready(third, roomCode, true)]);
  await assert.rejects(start(host, roomCode), denied); // Fourth player is not ready.
  await ready(fourthSeat, roomCode, true);
  await start(host, roomCode);
  assert.equal((await getDoc(roomRef)).data().status, 'playing');

  const closedCode = code();
  await create(host, closedCode);
  await admin.doc(`rooms/${closedCode}`).update({ status: 'playing' });
  await assert.rejects(join(outsider, closedCode), denied);

  const readyCode = code();
  await create(host, readyCode);
  await assert.rejects(start(host, readyCode), denied); // One player is not enough.
  await ready(host, readyCode, true);
  assert.equal((await getDoc(doc(host.db, 'rooms', readyCode))).data().players[host.user.uid].ready, true);
  await assert.rejects(ready(host, readyCode, true), denied); // No duplicate transition.
  await assert.rejects(ready(outsider, readyCode, true), denied);
  await join(guest, readyCode);
  await assert.rejects(start(host, readyCode), denied); // Guest is not ready.
  await assert.rejects(start(guest, readyCode), denied); // Only the host starts.
  await assert.rejects(updateDoc(doc(guest.db, 'rooms', readyCode), new FieldPath('players', host.user.uid, 'ready'), false, 'updatedAt', serverTimestamp()), denied);
  await ready(guest, readyCode, true);
  await assert.rejects(start(guest, readyCode), denied);
  await start(host, readyCode);
  assert.equal((await getDoc(doc(guest.db, 'rooms', readyCode))).data().status, 'playing');
  await assert.rejects(start(host, readyCode), denied);
  await assert.rejects(ready(guest, readyCode, false), denied);
  await assert.rejects(join(third, readyCode), denied);

  console.log('방 생성·참가·참가자 읽기·정원·동시 참가·본인 준비·방장 시작 규칙 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
