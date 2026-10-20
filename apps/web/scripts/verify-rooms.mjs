import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, setLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com', projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const apps = [];

async function client(name, signedIn = true) {
  const app = initializeApp(config, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = signedIn ? (await signInAnonymously(auth)).user : null;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return {
    user,
    db,
    create: httpsCallable(functions, 'createRoom'),
    join: httpsCallable(functions, 'joinRoom'),
  };
}

function rejected(code, reason) {
  return error => error.code === `functions/${code}` && error.details?.reason === reason;
}

try {
  const [host, guest, third, fourth, fifth, outsider] = await Promise.all([
    client('host'), client('guest'), client('third'), client('fourth'), client('fifth'), client('outsider'),
  ]);
  const unauthenticated = await client('unauthenticated', false);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));

  await assert.rejects(unauthenticated.create({ nickname: '방장' }), rejected('unauthenticated', 'UNAUTHENTICATED'));
  await assert.rejects(host.create({ nickname: 'a' }), rejected('invalid-argument', 'INVALID_NICKNAME'));
  await assert.rejects(host.create({ nickname: '😀'.repeat(17) }), rejected('invalid-argument', 'INVALID_NICKNAME'));

  const created = (await host.create({ nickname: '  방장  ' })).data;
  assert.match(created.roomCode, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(created.seatIndex, 0);
  const roomRef = doc(host.db, 'rooms', created.roomId);
  const hostRoom = await getDoc(roomRef);
  assert.equal(hostRoom.data().hostUid, host.user.uid);
  assert.equal(hostRoom.data().status, 'waiting');
  const hostPlayer = await getDoc(doc(host.db, 'rooms', created.roomId, 'players', host.user.uid));
  assert.equal(hostPlayer.data().nickname, '방장');
  await assert.rejects(getDoc(doc(outsider.db, 'rooms', created.roomId)), error => error.code === 'permission-denied');
  await assert.rejects(getDocs(collection(outsider.db, 'rooms', created.roomId, 'players')), error => error.code === 'permission-denied');
  await assert.rejects(getDoc(doc(host.db, 'roomCodes', created.roomCode)), error => error.code === 'permission-denied');
  await assert.rejects(setDoc(roomRef, { status: 'playing' }, { merge: true }), error => error.code === 'permission-denied');

  await assert.rejects(guest.join({ roomCode: 'BAD', nickname: '손님' }), rejected('invalid-argument', 'INVALID_ROOM_CODE'));
  await assert.rejects(guest.join({ roomCode: 'AAAAAAAA', nickname: '손님' }), rejected('not-found', 'ROOM_NOT_FOUND'));
  await assert.rejects(unauthenticated.join({ roomCode: created.roomCode, nickname: '손님' }), rejected('unauthenticated', 'UNAUTHENTICATED'));

  const joined = (await guest.join({ roomCode: created.roomCode.toLowerCase(), nickname: '  방장  ' })).data;
  assert.equal(joined.roomId, created.roomId);
  assert.equal(joined.seatIndex, 1);
  assert.equal((await getDoc(doc(guest.db, 'rooms', created.roomId))).data().roomCode, created.roomCode);
  assert.equal((await getDoc(doc(host.db, 'rooms', created.roomId, 'players', guest.user.uid))).data().nickname, '방장');
  await assert.rejects(guest.join({ roomCode: created.roomCode, nickname: '손님' }), rejected('already-exists', 'ALREADY_IN_ROOM'));

  assert.equal((await third.join({ roomCode: created.roomCode, nickname: '셋째' })).data.seatIndex, 2);
  assert.equal((await fourth.join({ roomCode: created.roomCode, nickname: '넷째' })).data.seatIndex, 3);
  await assert.rejects(fifth.join({ roomCode: created.roomCode, nickname: '다섯째' }), rejected('resource-exhausted', 'ROOM_FULL'));
  assert.equal((await getDocs(collection(guest.db, 'rooms', created.roomId, 'players'))).size, 4);

  const second = (await host.create({ nickname: '방장' })).data;
  assert.notEqual(second.roomCode, created.roomCode);
  await admin.doc(`rooms/${second.roomId}`).update({ status: 'playing' });
  await assert.rejects(fifth.join({ roomCode: second.roomCode, nickname: '다섯째' }), rejected('failed-precondition', 'ROOM_NOT_WAITING'));

  const race = (await host.create({ nickname: '방장' })).data;
  await guest.join({ roomCode: race.roomCode, nickname: '둘째' });
  await third.join({ roomCode: race.roomCode, nickname: '셋째' });
  const lastSeat = await Promise.allSettled([
    fourth.join({ roomCode: race.roomCode, nickname: '넷째' }),
    fifth.join({ roomCode: race.roomCode, nickname: '다섯째' }),
  ]);
  assert.equal(lastSeat.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(lastSeat.filter(result => result.status === 'rejected' && rejected('resource-exhausted', 'ROOM_FULL')(result.reason)).length, 1);
  assert.equal((await getDocs(collection(host.db, 'rooms', race.roomId, 'players'))).size, 4);

  console.log('방 생성·코드 참가·멤버 읽기·비회원/직접 쓰기 거부·중복/정원/상태·동시 참가 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
