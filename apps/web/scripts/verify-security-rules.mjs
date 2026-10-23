import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, FieldPath,
  getDocFromServer, getDocsFromServer, getFirestore, serverTimestamp,
  setDoc, setLogLevel, updateDoc,
} from 'firebase/firestore';

const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getFirestore: getAdminFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
setLogLevel('silent');

const config = { apiKey: 'demo-api-key', authDomain: 'demo-gem-arena.firebaseapp.com',
  projectId: 'demo-gem-arena', appId: 'demo-gem-arena' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(8), byte => alphabet[byte & 31]).join('');
const apps = [];
let allowedCount = 0;
let deniedCount = 0;

async function client(name, authenticate = true) {
  const app = initializeApp(config, `${name}-${randomBytes(4).toString('hex')}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  const user = authenticate ? (await signInAnonymously(auth)).user : null;
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { user, db };
}

async function allowed(label, operation, check = () => {}) {
  const result = await operation();
  check(result);
  allowedCount++;
  return result;
}

async function denied(label, operation) {
  await assert.rejects(operation, error => {
    assert.equal(error.code, 'permission-denied', `${label}: ${error.message}`);
    return true;
  }, label);
  deniedCount++;
}

function initialPlayer(uid, nickname) {
  return { uid, nickname, ready: false, forfeited: false, joinedAt: serverTimestamp() };
}

try {
  const [host, guest, outsider, anonymous] = await Promise.all([
    client('rules-host'), client('rules-guest'), client('rules-outsider'),
    client('rules-unauthenticated', false),
  ]);
  const admin = getAdminFirestore(initializeAdminApp({ projectId: config.projectId }));
  const roomCode = code();
  const hostRoom = doc(host.db, 'rooms', roomCode);
  const guestRoom = doc(guest.db, 'rooms', roomCode);
  const outsiderRoom = doc(outsider.db, 'rooms', roomCode);
  const anonymousRoom = doc(anonymous.db, 'rooms', roomCode);
  const roomData = (id = roomCode) => ({ roomCode: id, title: '보석 상인의 방', theme: 'default', hostUid: host.user.uid, status: 'waiting',
    capacity: 4, playerOrder: [host.user.uid],
    players: { [host.user.uid]: initialPlayer(host.user.uid, '방장') },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const anonymousCode = code();
  const forgedCode = code();
  const capacityCode = code();
  const nicknameCode = code();
  await denied('비로그인 방 생성', () => setDoc(doc(anonymous.db, 'rooms', anonymousCode), roomData(anonymousCode)));
  await denied('위조 방장 방 생성', () => setDoc(doc(outsider.db, 'rooms', forgedCode), roomData(forgedCode)));
  await denied('잘못된 코드 방 생성', () => setDoc(doc(host.db, 'rooms', 'INVALID1'), roomData('INVALID1')));
  await denied('잘못된 정원 방 생성', () => setDoc(doc(host.db, 'rooms', capacityCode),
    { ...roomData(capacityCode), capacity: 5 }));
  await denied('공백 닉네임 방 생성', () => setDoc(doc(host.db, 'rooms', nicknameCode),
    { ...roomData(nicknameCode), players: { [host.user.uid]: initialPlayer(host.user.uid, '  ') } }));
  const titleCode = code();
  await denied('빈 방 제목 생성', () => setDoc(doc(host.db, 'rooms', titleCode),
    { ...roomData(titleCode), title: ' ' }));
  const badThemeCode = code();
  await denied('알 수 없는 테마로 방 생성', () => setDoc(doc(host.db, 'rooms', badThemeCode),
    { ...roomData(badThemeCode), theme: 'unknown' }));
  const missingTitleCode = code();
  await denied('방 제목 없는 생성', () => setDoc(doc(host.db, 'rooms', missingTitleCode),
    Object.fromEntries(Object.entries(roomData(missingTitleCode)).filter(([key]) => key !== 'title'))));
  await allowed('정상 방 생성', () => setDoc(hostRoom, roomData()));
  await allowed('방장 방 읽기', () => getDocFromServer(hostRoom), snapshot =>
    assert.equal(snapshot.data().hostUid, host.user.uid));
  await denied('비로그인 방 읽기', () => getDocFromServer(anonymousRoom));
  await denied('비참가자 방 읽기', () => getDocFromServer(outsiderRoom));
  await denied('방 목록 조회', () => getDocsFromServer(collection(host.db, 'rooms')));
  const listingRef = admin.doc(`roomListings/${roomCode}`);
  await listingRef.set({ roomCode, title: '보석 상인의 방', hostNickname: '방장', playerCount: 1,
    capacity: 4, createdAt: new Date() });
  await allowed('공개 방 목록 조회', () => getDocsFromServer(collection(outsider.db, 'roomListings')), snapshot =>
    assert.equal(snapshot.docs.find(item => item.id === roomCode)?.data().title, '보석 상인의 방'));
  await denied('비로그인 공개 방 목록 조회', () => getDocsFromServer(collection(anonymous.db, 'roomListings')));
  await denied('공개 방 목록 위조', () => setDoc(doc(host.db, 'roomListings', code()),
    { roomCode, title: '위조된 방' }));
  await denied('방 직접 삭제', () => deleteDoc(hostRoom));
  await denied('방장 변경', () => updateDoc(hostRoom, 'hostUid', guest.user.uid,
    'updatedAt', serverTimestamp()));
  await denied('방장이 임의 참가자 추가', () => updateDoc(hostRoom,
    'playerOrder', arrayUnion(guest.user.uid), 'updatedAt', serverTimestamp()));
  await allowed('방장 테마 변경', () => updateDoc(hostRoom,
    'theme', 'lol', 'updatedAt', serverTimestamp()));
  await denied('알 수 없는 테마 변경', () => updateDoc(hostRoom,
    'theme', 'unknown', 'updatedAt', serverTimestamp()));
  await denied('테마 변경에 방 제목 변경 섞기', () => updateDoc(hostRoom,
    'theme', 'demon-slayer', 'title', '위조', 'updatedAt', serverTimestamp()));

  const guestPath = new FieldPath('players', guest.user.uid);
  await denied('참가하면서 방장 변경', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, '손님'), 'hostUid', guest.user.uid,
    'updatedAt', serverTimestamp()));
  await denied('참가하면서 준비 상태 위조', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    { ...initialPlayer(guest.user.uid, '손님'), ready: true },
    'updatedAt', serverTimestamp()));
  await denied('앞뒤 공백 닉네임 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, ' 손님 '),
    'updatedAt', serverTimestamp()));
  await denied('전각 공백 닉네임 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, '\u3000손님\u3000'),
    'updatedAt', serverTimestamp()));
  await denied('NBSP 닉네임 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, '\u00a0손님\u00a0'),
    'updatedAt', serverTimestamp()));
  await denied('BOM 공백 닉네임 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, '\ufeff손님\ufeff'),
    'updatedAt', serverTimestamp()));
  await allowed('정상 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), guestPath,
    initialPlayer(guest.user.uid, '손님'), 'updatedAt', serverTimestamp()));
  await denied('참가자 테마 변경', () => updateDoc(guestRoom,
    'theme', 'demon-slayer', 'updatedAt', serverTimestamp()));
  await allowed('참가자 방 읽기', () => getDocFromServer(guestRoom), snapshot =>
    assert.deepEqual(snapshot.data().playerOrder, [host.user.uid, guest.user.uid]));
  await denied('중복 참가', () => updateDoc(guestRoom,
    'playerOrder', arrayUnion(guest.user.uid), 'updatedAt', serverTimestamp()));
  await denied('다른 참가자 준비 변경', () => updateDoc(guestRoom,
    new FieldPath('players', host.user.uid, 'ready'), true,
    'updatedAt', serverTimestamp()));
  await denied('준비 변경에 닉네임 변경 섞기', () => updateDoc(guestRoom,
    new FieldPath('players', guest.user.uid, 'ready'), true,
    new FieldPath('players', guest.user.uid, 'nickname'), '위조',
    'updatedAt', serverTimestamp()));
  await allowed('본인 준비', () => updateDoc(hostRoom,
    new FieldPath('players', host.user.uid, 'ready'), true,
    'updatedAt', serverTimestamp()));
  await denied('미준비 참가자 게임 시작', () => updateDoc(hostRoom,
    'status', 'playing', 'startedAt', serverTimestamp(),
    'updatedAt', serverTimestamp()));
  await allowed('참가자 준비', () => updateDoc(guestRoom,
    new FieldPath('players', guest.user.uid, 'ready'), true,
    'updatedAt', serverTimestamp()));
  await denied('참가자가 게임 시작', () => updateDoc(guestRoom,
    'status', 'playing', 'startedAt', serverTimestamp(),
    'updatedAt', serverTimestamp()));
  await allowed('방장이 게임 시작', () => updateDoc(hostRoom,
    'status', 'playing', 'startedAt', serverTimestamp(),
    'updatedAt', serverTimestamp()));
  await denied('시작 후 준비 변경', () => updateDoc(guestRoom,
    new FieldPath('players', guest.user.uid, 'ready'), false,
    'updatedAt', serverTimestamp()));
  await denied('시작 후 테마 변경', () => updateDoc(hostRoom,
    'theme', 'demon-slayer', 'updatedAt', serverTimestamp()));
  await denied('시작 후 참가', () => updateDoc(outsiderRoom,
    'playerOrder', arrayUnion(outsider.user.uid),
    new FieldPath('players', outsider.user.uid),
    initialPlayer(outsider.user.uid, '외부인'),
    'updatedAt', serverTimestamp()));

  const gameRoomCode = code();
  const gameRoom = admin.doc(`rooms/${gameRoomCode}`);
  const members = [host.user.uid, guest.user.uid];
  await gameRoom.set({ roomCode: gameRoomCode, hostUid: host.user.uid,
    status: 'playing', capacity: 4, playerOrder: members,
    players: Object.fromEntries(members.map(uid => [uid,
      { uid, nickname: uid === host.user.uid ? '방장' : '손님',
        ready: true, forfeited: false }])) });
  await Promise.all([
    gameRoom.collection('game').doc('publicState').set({ version: 7, phase: 'playing' }),
    gameRoom.collection('privateState').doc('server').set({ version: 7, decks: { 1: ['SECRET'] } }),
    gameRoom.collection('privatePlayers').doc(host.user.uid).set({ uid: host.user.uid,
      version: 7, reservedCardIds: ['HOST-SECRET'] }),
    gameRoom.collection('privatePlayers').doc(guest.user.uid).set({ uid: guest.user.uid,
      version: 7, reservedCardIds: ['GUEST-SECRET'] }),
    gameRoom.collection('actionReceipts').doc(host.user.uid).collection('actions').doc('action-1')
      .set({ result: { version: 7 } }),
    gameRoom.collection('leaveReceipts').doc(host.user.uid).set({ result: { status: 'forfeited' } }),
  ]);

  const gameDoc = (clientValue, ...segments) => doc(clientValue.db, 'rooms', gameRoomCode, ...segments);
  const gameCollection = (clientValue, ...segments) => collection(clientValue.db, 'rooms', gameRoomCode, ...segments);
  const publicPath = ['game', 'publicState'];
  const ownPath = ['privatePlayers', host.user.uid];
  const otherPath = ['privatePlayers', guest.user.uid];
  const serverPath = ['privateState', 'server'];
  const actionPath = ['actionReceipts', host.user.uid, 'actions', 'action-1'];
  const leavePath = ['leaveReceipts', host.user.uid];

  await allowed('참가자 공개 상태 읽기', () => getDocFromServer(gameDoc(host, ...publicPath)),
    snapshot => assert.equal(snapshot.data().version, 7));
  await allowed('상대 참가자 공개 상태 읽기', () => getDocFromServer(gameDoc(guest, ...publicPath)));
  await allowed('본인 예약 카드 읽기', () => getDocFromServer(gameDoc(host, ...ownPath)),
    snapshot => assert.deepEqual(snapshot.data().reservedCardIds, ['HOST-SECRET']));
  await denied('비로그인 공개 상태 읽기', () => getDocFromServer(gameDoc(anonymous, ...publicPath)));
  await denied('비참가자 공개 상태 읽기', () => getDocFromServer(gameDoc(outsider, ...publicPath)));
  await denied('다른 사람 예약 카드 읽기', () => getDocFromServer(gameDoc(host, ...otherPath)));
  await denied('비참가자 예약 카드 읽기', () => getDocFromServer(gameDoc(outsider, ...ownPath)));
  await denied('공개 상태 목록 조회', () => getDocsFromServer(gameCollection(host, 'game')));
  await denied('예약 카드 목록 조회', () => getDocsFromServer(gameCollection(host, 'privatePlayers')));
  await denied('서버 덱 목록 조회', () => getDocsFromServer(gameCollection(host, 'privateState')));
  await denied('행동 처리 기록 목록 조회', () => getDocsFromServer(gameCollection(host,
    'actionReceipts', host.user.uid, 'actions')));
  await denied('퇴장 처리 기록 목록 조회', () => getDocsFromServer(gameCollection(host, 'leaveReceipts')));
  await denied('서버 덱 읽기', () => getDocFromServer(gameDoc(host, ...serverPath)));
  await denied('행동 처리 기록 읽기', () => getDocFromServer(gameDoc(host, ...actionPath)));
  await denied('퇴장 처리 기록 읽기', () => getDocFromServer(gameDoc(host, ...leavePath)));
  await denied('공개 상태 직접 쓰기', () => setDoc(gameDoc(host, ...publicPath), { version: 999 }));
  await denied('본인 예약 카드 직접 쓰기', () => setDoc(gameDoc(host, ...ownPath), { reservedCardIds: [] }));
  await denied('서버 덱 직접 쓰기', () => setDoc(gameDoc(host, ...serverPath), { decks: {} }));
  await denied('행동 처리 기록 직접 쓰기', () => setDoc(gameDoc(host, ...actionPath), { result: {} }));
  await denied('퇴장 처리 기록 직접 쓰기', () => setDoc(gameDoc(host, ...leavePath), { result: {} }));
  await denied('공개 상태 직접 삭제', () => deleteDoc(gameDoc(host, ...publicPath)));
  await denied('규칙 밖 경로 읽기', () => getDocFromServer(doc(host.db, 'roomCodes', gameRoomCode)));

  await gameRoom.update({ [`players.${host.user.uid}.forfeited`]: true });
  await allowed('기권자 결과 읽기', () => getDocFromServer(gameDoc(host, ...publicPath)),
    snapshot => assert.equal(snapshot.data().version, 7));
  await allowed('기권자 본인 문서 읽기', () => getDocFromServer(gameDoc(host, ...ownPath)));
  await denied('기권자 타인 문서 읽기', () => getDocFromServer(gameDoc(host, ...otherPath)));
  await gameRoom.update({ status: 'finished' });
  await allowed('종료 후 참가자 방 읽기', () => getDocFromServer(gameDoc(host)));
  await allowed('종료 후 공개 상태 읽기', () => getDocFromServer(gameDoc(guest, ...publicPath)));
  await gameRoom.update({ playerOrder: [guest.user.uid] });
  await denied('멤버십 제거 후 방 읽기', () => getDocFromServer(gameDoc(host)));
  await denied('멤버십 제거 후 공개 상태 읽기', () => getDocFromServer(gameDoc(host, ...publicPath)));
  await denied('멤버십 제거 후 본인 문서 읽기', () => getDocFromServer(gameDoc(host, ...ownPath)));

  console.log(`Security Rules 권한 검증 통과: 허용 ${allowedCount}건, 거부 ${deniedCount}건`);
} finally {
  await Promise.all(apps.map(deleteApp));
}
