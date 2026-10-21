import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, disableNetwork, doc, enableNetwork, getDoc, getFirestore,
  onSnapshot } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com',
  projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const apps = [];

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
  return { user, db, leave: httpsCallable(functions, 'leaveRoom'),
    submit: httpsCallable(functions, 'submitAction') };
}

async function waitFor(check, label) {
  for (let count = 0; count < 200; count++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error(`${label}: 상태가 반영되지 않았습니다`);
}

const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
const player = value => ({ uid: value.user.uid, nickname: value.user.uid.slice(0, 8),
  ready: true, forfeited: false });
async function makeRoom(roomCode, members, status = 'waiting') {
  const order = members.map(member => member.user.uid);
  const ref = admin.doc(`rooms/${roomCode}`);
  await ref.set({ roomCode, hostUid: order[0], status: 'waiting', capacity: 4,
    playerOrder: order, players: Object.fromEntries(members.map(member =>
      [member.user.uid, player(member)])) });
  if (status === 'playing') {
    await ref.update({ status: 'playing' });
    await waitFor(async () => (await ref.collection('privateState').doc('server').get()).exists,
      '게임 초기화');
  }
  return ref;
}

try {
  const [a, b, c, outsider] = await Promise.all(['a', 'b', 'c', 'outsider'].map(client));
  const waitingCode = code();
  const waiting = await makeRoom(waitingCode, [a, b, c]);
  await assert.rejects(outsider.leave({ roomId: waitingCode }), error =>
    error.details?.reason === 'NOT_ROOM_MEMBER');
  await assert.rejects(a.leave({ roomId: 'bad' }), error =>
    error.details?.reason === 'INVALID_ROOM_CODE');
  assert.equal((await a.leave({ roomId: waitingCode })).data.status, 'left');
  let room = (await waiting.get()).data();
  assert.deepEqual(room.playerOrder, [b.user.uid, c.user.uid]);
  assert.equal(room.hostUid, b.user.uid);
  assert.equal(room.players[a.user.uid], undefined);
  assert.equal((await a.leave({ roomId: waitingCode })).data.status, 'left');
  assert.deepEqual((await waiting.get()).data().playerOrder, [b.user.uid, c.user.uid]);
  await assert.rejects(getDoc(doc(a.db, 'rooms', waitingCode)), error =>
    error.code === 'permission-denied');
  await waiting.update({ playerOrder: [b.user.uid, c.user.uid, a.user.uid],
    players: { ...room.players, [a.user.uid]: player(a) } });
  assert.equal((await a.leave({ roomId: waitingCode })).data.status, 'left');
  assert.deepEqual((await waiting.get()).data().playerOrder, [b.user.uid, c.user.uid]);
  await b.leave({ roomId: waitingCode });
  await c.leave({ roomId: waitingCode });
  room = (await waiting.get()).data();
  assert.equal(room.status, 'finished');
  assert.deepEqual(room.playerOrder, []);

  const playingCode = code();
  const playing = await makeRoom(playingCode, [a, b, c], 'playing');
  const serverRef = playing.collection('privateState').doc('server');
  const initial = (await serverRef.get()).data();
  const current = [a, b, c].find(member => member.user.uid === initial.playerOrder[initial.turnIndex]);
  const others = [a, b, c].filter(member => member !== current);
  const takeRequest = { roomId: playingCode, actionId: `take-${randomBytes(8).toString('hex')}`,
    expectedVersion: 0, action: { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] } };
  const take = (await current.submit(takeRequest)).data;
  assert.equal(take.version, 1);
  let observed = { version: -1, fromCache: false };
  let subscriptionError = null;
  const stop = onSnapshot(doc(current.db, 'rooms', playingCode, 'game', 'publicState'),
    { includeMetadataChanges: true }, snapshot => {
      observed = { version: snapshot.data()?.version ?? -1, fromCache: snapshot.metadata.fromCache };
    }, error => { subscriptionError = error; });
  await waitFor(() => observed.version === 1 && !observed.fromCache, '연결된 구독');
  await disableNetwork(current.db);
  await waitFor(() => observed.fromCache, '오프라인 캐시 전환');
  const offlineState = (await serverRef.get()).data();
  const nextActor = [a, b, c].find(member =>
    member.user.uid === offlineState.playerOrder[offlineState.turnIndex]);
  assert.notEqual(nextActor, current);
  const whileOffline = (await nextActor.submit({ roomId: playingCode,
    actionId: `offline-${randomBytes(8).toString('hex')}`, expectedVersion: 1,
    action: { type: 'TAKE_GEMS', colors: ['white', 'red', 'black'] } })).data;
  assert.equal(whileOffline.version, 2);
  assert.equal(observed.version, 1);
  await enableNetwork(current.db);
  await waitFor(() => observed.version === 2 && !observed.fromCache, '같은 UID의 재연결');
  if (subscriptionError) throw subscriptionError;
  stop();
  const before = (await serverRef.get()).data();
  const result = (await current.leave({ roomId: playingCode })).data;
  assert.equal(result.status, 'forfeited');
  assert.equal(result.version, 3);
  const after = (await serverRef.get()).data();
  assert.equal(after.players[current.user.uid].forfeited, true);
  assert.equal(after.players[current.user.uid].gems.white, 0);
  assert.equal(after.bank.white, before.bank.white + 1);
  assert.notEqual(after.playerOrder[after.turnIndex], current.user.uid);
  assert.equal((await playing.get()).data().players[current.user.uid].forfeited, true);
  assert.equal((await playing.collection('game').doc('publicState').get()).data().version, 3);
  assert.equal((await playing.collection('privatePlayers').doc(current.user.uid).get()).data().version, 3);
  assert.equal((await current.leave({ roomId: playingCode })).data.version, 3);
  assert.equal((await serverRef.get()).data().version, 3);
  await assert.rejects(getDoc(doc(current.db, 'rooms', playingCode, 'leaveReceipts', current.user.uid)),
    error => error.code === 'permission-denied');
  assert.deepEqual((await current.submit(takeRequest)).data, take);
  await assert.rejects(current.submit({ roomId: playingCode, actionId: 'after-forfeit',
    expectedVersion: 3, action: { type: 'PASS' } }), error =>
    error.details?.reason === 'NOT_ROOM_MEMBER');
  await assert.rejects(outsider.leave({ roomId: playingCode }), error =>
    error.details?.reason === 'NOT_ROOM_MEMBER');
  await others[0].leave({ roomId: playingCode });
  assert.equal((await serverRef.get()).data().phase, 'finished');
  assert.deepEqual((await serverRef.get()).data().winnerIds, [others[1].user.uid]);
  assert.equal((await playing.get()).data().status, 'finished');
  assert.equal((await current.leave({ roomId: playingCode })).data.status, 'forfeited');
  const raceCode = code();
  const raceRoom = await makeRoom(raceCode, [a, b], 'playing');
  const raceServer = raceRoom.collection('privateState').doc('server');
  const raceInitial = (await raceServer.get()).data();
  const raceActor = [a, b].find(member =>
    member.user.uid === raceInitial.playerOrder[raceInitial.turnIndex]);
  const raceRequest = { roomId: raceCode, actionId: `race-${randomBytes(8).toString('hex')}`,
    expectedVersion: 0, action: { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] } };
  const [actionOutcome, leaveOutcome] = await Promise.allSettled([
    raceActor.submit(raceRequest), raceActor.leave({ roomId: raceCode }),
  ]);
  assert.equal(leaveOutcome.status, 'fulfilled');
  assert.equal(leaveOutcome.value.data.status, 'forfeited');
  const actionCommitted = actionOutcome.status === 'fulfilled';
  if (!actionCommitted) {
    assert.equal(actionOutcome.reason.details?.reason, 'NOT_ROOM_MEMBER');
  }
  const expectedVersion = actionCommitted ? 2 : 1;
  assert.equal((await raceServer.get()).data().version, expectedVersion);
  assert.equal((await raceRoom.collection('game').doc('publicState').get()).data().version,
    expectedVersion);
  assert.equal((await raceRoom.get()).data().players[raceActor.user.uid].forfeited, true);
  const raceReceipt = await raceRoom.collection('actionReceipts').doc(raceActor.user.uid)
    .collection('actions').doc(raceRequest.actionId).get();
  assert.equal(raceReceipt.exists, actionCommitted);
  if (actionCommitted) {
    assert.deepEqual((await raceActor.submit(raceRequest)).data, actionOutcome.value.data);
  }
  assert.equal((await raceActor.leave({ roomId: raceCode })).data.version, expectedVersion);
  assert.equal((await raceServer.get()).data().version, expectedVersion);
  console.log('대기실 퇴장·방장 승계·오프라인 재구독·기권·중복·권한·남은 한 명 승리 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
