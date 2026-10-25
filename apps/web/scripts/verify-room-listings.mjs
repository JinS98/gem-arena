import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { arrayUnion, collection, connectFirestoreEmulator, doc, FieldPath, getDocs,
  getFirestore, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com',
  projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const apps = [];
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');

async function client(name) {
  const app = initializeApp(config, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  const user = (await signInAnonymously(auth)).user;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { user, db };
}

async function waitFor(read, predicate, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`${label}: 20초 안에 반영되지 않았습니다.`);
}

try {
  const [host, guest] = await Promise.all([client('listing-host'), client('listing-guest')]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const roomRef = doc(host.db, 'rooms', roomCode);
  const listingRef = admin.doc(`roomListings/${roomCode}`);
  const uid = host.user.uid;
  await setDoc(roomRef, { roomCode, title: '금빛 보석 대전', theme: 'default', hostUid: uid, status: 'waiting',
    capacity: 4, playerOrder: [uid],
    players: { [uid]: { uid, nickname: '방장', ready: false, forfeited: false, joinedAt: serverTimestamp() } },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const created = await waitFor(() => listingRef.get(), snapshot => snapshot.exists, '방 목록 생성');
  assert.equal(created.get('title'), '금빛 보석 대전');
  assert.equal(created.get('theme'), 'default');
  assert.equal(created.get('hostNickname'), '방장');
  assert.equal(created.get('playerCount'), 1);
  assert.equal(created.get('players'), undefined);
  const visible = await getDocs(query(collection(guest.db, 'roomListings'), orderBy('createdAt', 'desc')));
  assert.equal(visible.docs.find(item => item.id === roomCode)?.data().title, '금빛 보석 대전');

  await updateDoc(roomRef, 'theme', 'demon-slayer', 'updatedAt', serverTimestamp());
  await waitFor(() => listingRef.get(), snapshot => snapshot.get('theme') === 'demon-slayer', '테마 반영');

  await updateDoc(roomRef, 'theme', 'hidden', 'updatedAt', serverTimestamp());
  await waitFor(() => listingRef.get(), snapshot => snapshot.get('theme') === 'hidden', '히든테마 반영');

  const guestUid = guest.user.uid;
  await updateDoc(doc(guest.db, 'rooms', roomCode), 'playerOrder', arrayUnion(guestUid),
    new FieldPath('players', guestUid),
    { uid: guestUid, nickname: '손님', ready: false, forfeited: false, joinedAt: serverTimestamp() },
    'updatedAt', serverTimestamp());
  await waitFor(() => listingRef.get(), snapshot => snapshot.get('playerCount') === 2, '참가 인원 반영');

  await admin.doc(`rooms/${roomCode}`).update({ status: 'playing' });
  await waitFor(() => listingRef.get(), snapshot => !snapshot.exists, '시작한 방 목록 제거');
  console.log('방 제목·공개 목록·참가 인원·게임 시작 시 목록 제거 검증 통과');
} finally {
  await Promise.all(apps.map(deleteApp));
}
