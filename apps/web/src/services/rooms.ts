import { arrayUnion, doc, FieldPath, getDoc, serverTimestamp, setDoc, updateDoc,
  type DocumentReference } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { ensureAnonymousSession } from './playerIdentity';
import { httpsCallable } from 'firebase/functions';
import { nicknameError, normalizeNickname } from './nickname';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const roomCapacity = 4;

class RoomActionError extends Error {
  details: { reason: string };

  constructor(reason: string) {
    super(reason);
    this.details = { reason };
  }
}

function validNickname(value: string): string {
  if (nicknameError(value)) throw new RoomActionError('INVALID_NICKNAME');
  return normalizeNickname(value);
}

function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, byte => alphabet[byte & 31]).join('');
}

export interface RoomAccess {
  roomId: string;
  roomCode: string;
  seatIndex: number;
}

export interface WaitingRoom {
  roomCode: string;
  hostUid: string;
  status: 'waiting' | 'playing' | 'finished';
  playerOrder: string[];
  players: Record<string, RoomPlayer>;
  capacity: number;
  startedAt?: unknown;
}

export interface RoomPlayer {
  uid: string;
  nickname: string;
  ready: boolean;
  forfeited: boolean;
}

export async function leaveRoom(roomCode: string): Promise<'left' | 'forfeited'> {
  const code = roomCode.trim().toUpperCase();
  if (!codePattern.test(code)) throw new RoomActionError('INVALID_ROOM_CODE');
  await ensureAnonymousSession();
  const callable = httpsCallable<{ roomId: string }, { status: 'left' | 'forfeited' }>(
    getFirebase().functions, 'leaveRoom',
  );
  return (await callable({ roomId: code })).data.status;
}

function roomReference(roomCode: string) {
  const code = roomCode.trim().toUpperCase();
  if (!codePattern.test(code)) throw new RoomActionError('INVALID_ROOM_CODE');
  return doc(getFirebase().db, 'rooms', code);
}

async function currentRoom(roomCode: string, uid: string): Promise<WaitingRoom> {
  const snapshot = await getDoc(roomReference(roomCode));
  if (!snapshot.exists()) throw new RoomActionError('ROOM_NOT_FOUND');
  const room = snapshot.data() as WaitingRoom;
  if (!room.players?.[uid]) throw new RoomActionError('NOT_ROOM_MEMBER');
  return room;
}

async function existingMemberAccess(roomRef: DocumentReference, code: string, uid: string): Promise<RoomAccess | null> {
  try {
    const snapshot = await getDoc(roomRef);
    if (!snapshot.exists()) return null;
    const room = snapshot.data() as WaitingRoom;
    if (!room.players?.[uid]) return null;
    if (room.players[uid].forfeited) throw new RoomActionError('FORFEITED');
    return { roomId: code, roomCode: code, seatIndex: room.playerOrder.indexOf(uid) };
  } catch (error) {
    if (error instanceof RoomActionError) throw error;
    if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
      return null;
    }
    throw error;
  }
}

export async function createRoom(nickname: string): Promise<RoomAccess> {
  const name = validNickname(nickname);
  const uid = (await ensureAnonymousSession()).uid;
  const { db } = getFirebase();
  const roomCode = generateRoomCode();
  await setDoc(doc(db, 'rooms', roomCode), {
    roomCode,
    hostUid: uid,
    status: 'waiting',
    playerOrder: [uid],
    players: { [uid]: { uid, nickname: name, ready: false, forfeited: false, joinedAt: serverTimestamp() } },
    capacity: roomCapacity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { roomId: roomCode, roomCode, seatIndex: 0 };
}

export async function joinRoom(roomCode: string, nickname: string): Promise<RoomAccess> {
  const code = roomCode.trim().toUpperCase();
  if (!codePattern.test(code)) throw new RoomActionError('INVALID_ROOM_CODE');
  const uid = (await ensureAnonymousSession()).uid;
  const roomRef = doc(getFirebase().db, 'rooms', code);
  if (nicknameError(nickname)) {
    const existing = await existingMemberAccess(roomRef, code, uid);
    if (existing) return existing;
    throw new RoomActionError('INVALID_NICKNAME');
  }
  const name = normalizeNickname(nickname);
  try {
    // The rule checks the old and new document atomically, including the four-seat limit.
    // A new player cannot read the room until this write has made them a member.
    await updateDoc(
      roomRef,
      'playerOrder', arrayUnion(uid),
      new FieldPath('players', uid), { uid, nickname: name, ready: false, forfeited: false, joinedAt: serverTimestamp() },
      'updatedAt', serverTimestamp(),
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
      const existing = await existingMemberAccess(roomRef, code, uid);
      if (existing) return existing;
      throw new RoomActionError('ROOM_UNAVAILABLE');
    }
    throw error;
  }
  const room = (await getDoc(roomRef)).data() as WaitingRoom;
  return { roomId: code, roomCode: code, seatIndex: room.playerOrder.indexOf(uid) };
}

export async function setReady(roomCode: string, ready: boolean): Promise<void> {
  const uid = (await ensureAnonymousSession()).uid;
  const room = await currentRoom(roomCode, uid);
  if (room.status !== 'waiting') throw new RoomActionError('ROOM_NOT_WAITING');
  if (room.players[uid].ready === ready) return;
  await updateDoc(
    roomReference(roomCode),
    new FieldPath('players', uid, 'ready'), ready,
    'updatedAt', serverTimestamp(),
  );
}

export async function startGame(roomCode: string): Promise<void> {
  const uid = (await ensureAnonymousSession()).uid;
  const room = await currentRoom(roomCode, uid);
  if (room.status !== 'waiting') throw new RoomActionError('ROOM_NOT_WAITING');
  if (room.hostUid !== uid) throw new RoomActionError('NOT_HOST');
  if (room.playerOrder.length < 2) throw new RoomActionError('NEED_PLAYERS');
  if (!room.playerOrder.every(playerId => room.players[playerId]?.ready)) {
    throw new RoomActionError('NOT_ALL_READY');
  }
  await updateDoc(
    roomReference(roomCode),
    'status', 'playing',
    'startedAt', serverTimestamp(),
    'updatedAt', serverTimestamp(),
  );
}

export function roomErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'permission-denied') return 'Firestore 규칙에서 방 요청을 거부했습니다. 최신 규칙을 게시했는지 확인해 주세요.';
  if (code === 'unavailable') return 'Firestore 연결을 확인하고 다시 시도해 주세요.';
  const details = error && typeof error === 'object' && 'details' in error ? error.details : null;
  const reason = details && typeof details === 'object' && 'reason' in details ? details.reason : null;
  switch (reason) {
    case 'ROOM_CODE_COLLISION': return '초대 코드를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'ROOM_UNAVAILABLE': return '방을 찾지 못했거나, 정원이 찼거나, 이미 시작된 방입니다. 코드를 확인해 주세요.';
    case 'INVALID_NICKNAME': return '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.';
    case 'INVALID_ROOM_CODE': return '초대 코드는 영문·숫자 8자리입니다.';
    case 'ROOM_NOT_FOUND': return '일치하는 방이 없습니다. 초대 코드를 확인해 주세요.';
    case 'ROOM_FULL': return '방 정원이 가득 찼습니다.';
    case 'ROOM_NOT_WAITING': return '이미 시작했거나 종료된 방입니다.';
    case 'FORFEITED': return '이미 기권한 방에는 다시 참가할 수 없습니다. 게임 결과는 기존 방 주소에서 확인할 수 있습니다.';
    case 'NOT_ROOM_MEMBER': return '이 방의 참가자가 아닙니다.';
    case 'NOT_HOST': return '방장만 게임을 시작할 수 있습니다.';
    case 'NEED_PLAYERS': return '게임 시작에는 최소 2명이 필요합니다.';
    case 'NOT_ALL_READY': return '모든 참가자가 준비해야 시작할 수 있습니다.';
    case 'GAME_NOT_READY': return '게임 상태를 준비 중입니다. 잠시 후 다시 시도해 주세요.';
    case 'GAME_FINISHED': return '이미 종료된 게임입니다.';
    case 'GAME_STATE_MISMATCH': return '방과 게임 상태가 일치하지 않습니다. 다시 시도해 주세요.';
  }
  return '방 요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}
