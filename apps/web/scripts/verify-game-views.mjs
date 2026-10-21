import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, setLogLevel } from 'firebase/firestore';

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
  return { user, db };
}

const denied = error => error.code === 'permission-denied';

try {
  const [host, guest, outsider, unauthenticated] = await Promise.all([
    client('views-host'), client('views-guest'), client('views-outsider'), client('views-unauthenticated', false),
  ]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const room = admin.doc(`rooms/${roomCode}`);
  await room.set({
    roomCode,
    hostUid: host.user.uid,
    status: 'waiting',
    capacity: 4,
    playerOrder: [host.user.uid, guest.user.uid],
    players: { [host.user.uid]: { ready: true }, [guest.user.uid]: { ready: true } },
  });

  await assert.rejects(initializeGameViews(admin, roomCode), /시작한 방/);
  assert.equal((await room.collection('privateState').doc('server').get()).exists, false);
  await room.update({ status: 'playing' });
  try {
    await initializeGameViews(admin, roomCode);
  } catch (error) {
    // A running Functions emulator may win the same create-only initialization race.
    if (error.code !== 6 && error.code !== 'already-exists') throw error;
    const [existingServer, existingPublic, existingHost, existingGuest] = await Promise.all([
      room.collection('privateState').doc('server').get(),
      room.collection('game').doc('publicState').get(),
      room.collection('privatePlayers').doc(host.user.uid).get(),
      room.collection('privatePlayers').doc(guest.user.uid).get(),
    ]);
    assert.ok([existingServer, existingPublic, existingHost, existingGuest].every(snapshot => snapshot.exists));
  }
  await assert.rejects(initializeGameViews(admin, roomCode)); // Create-only and atomic.

  const server = (await room.collection('privateState').doc('server').get()).data();
  const published = (await room.collection('game').doc('publicState').get()).data();
  assert.equal(server.decks[1].length, published.deckCounts[1]);
  assert.equal('decks' in published, false);
  assert.equal('reservedCardIds' in published.players[guest.user.uid], false);

  const publicPath = ['rooms', roomCode, 'game', 'publicState'];
  const serverPath = ['rooms', roomCode, 'privateState', 'server'];
  const ownPath = ['rooms', roomCode, 'privatePlayers', host.user.uid];
  const guestPath = ['rooms', roomCode, 'privatePlayers', guest.user.uid];

  assert.equal((await getDoc(doc(host.db, ...publicPath))).data().version, 0);
  assert.equal((await getDoc(doc(guest.db, ...publicPath))).data().version, 0);
  await assert.rejects(getDoc(doc(outsider.db, ...publicPath)), denied);
  await assert.rejects(getDoc(doc(unauthenticated.db, ...publicPath)), denied);
  await assert.rejects(getDoc(doc(host.db, ...serverPath)), denied);
  await assert.rejects(getDoc(doc(guest.db, ...serverPath)), denied);

  await room.collection('privatePlayers').doc(guest.user.uid).update({ reservedCardIds: ['SECRET-CARD-ID'] });
  assert.deepEqual((await getDoc(doc(guest.db, ...guestPath))).data().reservedCardIds, ['SECRET-CARD-ID']);
  assert.deepEqual((await getDoc(doc(host.db, ...ownPath))).data().reservedCardIds, []);
  await assert.rejects(getDoc(doc(host.db, ...guestPath)), denied);
  await assert.rejects(getDoc(doc(guest.db, ...ownPath)), denied);
  await assert.rejects(getDoc(doc(outsider.db, ...ownPath)), denied);
  await assert.rejects(getDocs(collection(host.db, 'rooms', roomCode, 'privatePlayers')), denied);
  assert.equal(JSON.stringify((await getDoc(doc(host.db, ...publicPath))).data()).includes('SECRET-CARD-ID'), false);

  await assert.rejects(setDoc(doc(host.db, ...publicPath), { version: 999 }), denied);
  await assert.rejects(setDoc(doc(host.db, ...guestPath), { reservedCardIds: [] }), denied);
  await assert.rejects(setDoc(doc(host.db, ...serverPath), { decks: {} }), denied);

  await room.update({ playerOrder: [host.user.uid] });
  await assert.rejects(getDoc(doc(guest.db, ...publicPath)), denied);
  await assert.rejects(getDoc(doc(guest.db, ...guestPath)), denied);
  assert.equal((await getDoc(doc(host.db, ...publicPath))).exists(), true);

  console.log('공개 뷰·본인 예약 카드 읽기 및 서버 전용 덱·타인 예약 카드 접근 차단 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
