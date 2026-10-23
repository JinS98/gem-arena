import { arrayUnion, doc, FieldPath, getDoc, serverTimestamp, setDoc, updateDoc,
  type DocumentReference } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { ensureAnonymousSession } from './playerIdentity';
import { httpsCallable } from 'firebase/functions';
import { nicknameError, normalizeNickname } from './nickname';
import { GAME_THEMES, type GameTheme } from '../components/GameTheme';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{8}$/;
const roomCapacity = 4;
const roomRequestTimeoutMs = 8000;

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

async function ensureFirestoreEmulator(): Promise<void> {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true') return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    await fetch('http://127.0.0.1:8080/', { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
  } catch {
    throw new RoomActionError('EMULATOR_UNAVAILABLE');
  } finally {
    window.clearTimeout(timer);
  }
}

export async function withRoomRequestTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([request, new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(new RoomActionError('REQUEST_TIMEOUT')), roomRequestTimeoutMs);
    })]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function isRoomConnectionError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const details = error && typeof error === 'object' && 'details' in error ? error.details : null;
  const reason = details && typeof details === 'object' && 'reason' in details ? details.reason : null;
  return code === 'unavailable' || reason === 'EMULATOR_UNAVAILABLE' || reason === 'REQUEST_TIMEOUT';
}

export interface RoomAccess {
  roomId: string;
  roomCode: string;
  seatIndex: number;
}

export interface WaitingRoom {
  roomCode: string;
  title?: string;
  theme?: GameTheme;
  hostUid: string;
  status: 'waiting' | 'playing' | 'finished';
  playerOrder: string[];
  players: Record<string, RoomPlayer>;
  capacity: number;
  startedAt?: unknown;
}

export interface RoomListing {
  roomCode: string;
  title: string;
  theme?: GameTheme;
  hostNickname: string;
  playerCount: number;
  capacity: number;
}

export function roomTitleError(value: string): string | null {
  const title = value.trim();
  const length = Array.from(title).length;
  if (length < 2 || length > 32 || /[\r\n\u0000-\u001f\u007f]/u.test(title)) {
    return '방 제목은 줄바꿈 없이 2~32자로 입력해 주세요.';
  }
  return null;
}

export interface RoomPlayer {
  uid: string;
  nickname: string;
  ready: boolean;
  forfeited: boolean;
}

export async function leaveRoom(roomCode: string): Promise<{ status: 'left' | 'forfeited'; gameFinished?: boolean }> {
  const code = roomCode.trim().toUpperCase();
  if (!codePattern.test(code)) throw new RoomActionError('INVALID_ROOM_CODE');
  await ensureAnonymousSession();
  const callable = httpsCallable<{ roomId: string }, { status: 'left' | 'forfeited'; gameFinished?: boolean }>(
    getFirebase().functions, 'leaveRoom',
  );
  return (await callable({ roomId: code })).data;
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

export async function createRoom(nickname: string, title: string): Promise<RoomAccess> {
  const name = validNickname(nickname);
  if (roomTitleError(title)) throw new RoomActionError('INVALID_ROOM_TITLE');
  await ensureFirestoreEmulator();
  const uid = (await ensureAnonymousSession()).uid;
  const { db } = getFirebase();
  const roomCode = generateRoomCode();
  await setDoc(doc(db, 'rooms', roomCode), {
    roomCode,
    title: title.trim(),
    theme: 'default',
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
  await ensureFirestoreEmulator();
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

export async function setRoomTheme(roomCode: string, theme: GameTheme): Promise<void> {
  if (!GAME_THEMES.includes(theme)) throw new RoomActionError('INVALID_THEME');
  const uid = (await ensureAnonymousSession()).uid;
  const room = await currentRoom(roomCode, uid);
  if (room.status !== 'waiting') throw new RoomActionError('ROOM_NOT_WAITING');
  if (room.hostUid !== uid) throw new RoomActionError('NOT_HOST');
  if ((room.theme ?? 'default') === theme) return;
  await updateDoc(roomReference(roomCode), 'theme', theme, 'updatedAt', serverTimestamp());
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
    case 'EMULATOR_UNAVAILABLE': return '로컬 Firestore 에뮬레이터에 연결할 수 없습니다. npm run emulators를 실행한 뒤 다시 시도해 주세요.';
    case 'REQUEST_TIMEOUT': return '방 요청이 8초 넘게 응답하지 않았습니다. 연결을 확인한 뒤 같은 버튼으로 결과를 다시 확인해 주세요.';
    case 'ROOM_CODE_COLLISION': return '초대 코드를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'ROOM_UNAVAILABLE': return '방을 찾지 못했거나, 정원이 찼거나, 이미 시작된 방입니다. 코드를 확인해 주세요.';
    case 'INVALID_NICKNAME': return '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.';
    case 'INVALID_ROOM_TITLE': return '방 제목은 줄바꿈 없이 2~32자로 입력해 주세요.';
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
