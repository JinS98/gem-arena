import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, setLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com', projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const apps = [];
const stops = [];
let subscriptionError = null;

async function client(name) {
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

async function waitFor(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (subscriptionError) throw subscriptionError;
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(`${label}: ${timeout}ms 안에 반영되지 않았습니다`);
}

try {
  const [host, guest] = await Promise.all([client('live-host'), client('live-guest')]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const room = admin.doc(`rooms/${roomCode}`);
  await room.set({
    roomCode, hostUid: host.user.uid, status: 'waiting', capacity: 4,
    playerOrder: [host.user.uid, guest.user.uid],
    players: {
      [host.user.uid]: { uid: host.user.uid, nickname: '방장', ready: true, forfeited: false },
      [guest.user.uid]: { uid: guest.user.uid, nickname: '손님', ready: true, forfeited: false },
    },
  });

  const latest = { hostPublic: null, guestPublic: null, hostPrivate: null, guestPrivate: null };
  const watch = (clientValue, path, key) => {
    stops.push(onSnapshot(doc(clientValue.db, ...path), snapshot => {
      latest[key] = snapshot.exists() ? snapshot.data() : null;
    }, error => { subscriptionError = error; }));
  };
  const publicPath = ['rooms', roomCode, 'game', 'publicState'];
  watch(host, publicPath, 'hostPublic');
  watch(guest, publicPath, 'guestPublic');
  watch(host, ['rooms', roomCode, 'privatePlayers', host.user.uid], 'hostPrivate');
  watch(guest, ['rooms', roomCode, 'privatePlayers', guest.user.uid], 'guestPrivate');

  await room.update({ status: 'playing' });
  await waitFor(() => Object.values(latest).every(value => value?.version === 0), '초기 게임판 구독');
  assert.deepEqual(latest.hostPublic, latest.guestPublic);
  assert.equal(latest.hostPrivate.uid, host.user.uid);
  assert.equal(latest.guestPrivate.uid, guest.user.uid);
  assert.equal('decks' in latest.hostPublic, false);
  assert.equal('reservedCardIds' in latest.hostPublic.players[guest.user.uid], false);

  const actor = latest.hostPublic.playerOrder[latest.hostPublic.turnIndex] === host.user.uid ? host : guest;
  const other = actor === host ? guest : host;
  const action = { roomId: roomCode, actionId: `reserve-${randomBytes(8).toString('hex')}`,
    expectedVersion: 0, action: { type: 'RESERVE_CARD', level: 1 } };
  const result = (await actor.submit(action)).data;
  assert.equal(result.version, 1);
  await waitFor(() => Object.values(latest).every(value => value?.version === 1), '예약 후 양쪽 게임판 구독');
  assert.deepEqual(latest.hostPublic, latest.guestPublic);
  const actorPrivate = actor === host ? latest.hostPrivate : latest.guestPrivate;
  const otherPrivate = actor === host ? latest.guestPrivate : latest.hostPrivate;
  assert.equal(actorPrivate.reservedCardIds.length, 1);
  assert.deepEqual(otherPrivate.reservedCardIds, []);
  assert.equal(latest.hostPublic.players[actor.user.uid].reservedCount, 1);
  assert.equal(JSON.stringify(latest.hostPublic).includes(actorPrivate.reservedCardIds[0]), false);
  await assert.rejects(getDoc(doc(other.db, 'rooms', roomCode, 'privatePlayers', actor.user.uid)),
    error => error.code === 'permission-denied');

  const takeResult = (await other.submit({ roomId: roomCode,
    actionId: `take-${randomBytes(8).toString('hex')}`, expectedVersion: 1,
    action: { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] },
  })).data;
  assert.equal(takeResult.version, 2);
  await waitFor(() => Object.values(latest).every(value => value?.version === 2), '보석 획득 후 양쪽 게임판 구독');
  assert.deepEqual(latest.hostPublic, latest.guestPublic);
  assert.equal(latest.hostPublic.players[other.user.uid].gems.white, 1);
  assert.equal(latest.hostPublic.players[actor.user.uid].reservedCount, 1);
  console.log('방 시작 자동 초기화·두 참가자 실시간 공개/개인 상태·예약 비공개 검증 통과');
} finally {
  stops.forEach(stop => stop());
  await Promise.all(apps.map(deleteApp));
}
