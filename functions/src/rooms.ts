import { randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

if (!getApps().length) initializeApp();

const db = getFirestore();
const region = 'asia-northeast3';
const roomCapacity = 4;
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeLength = 8;
const codePattern = new RegExp(`^[${codeAlphabet}]{${codeLength}}$`);
const createInput = z.object({ nickname: z.string() });
const joinInput = z.object({ roomCode: z.string(), nickname: z.string() });

interface RoomDocument {
  roomCode: string;
  hostUid: string;
  status: 'waiting' | 'playing' | 'finished';
  playerOrder: string[];
  capacity: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

class CodeCollision extends Error {}

function fail(code: ConstructorParameters<typeof HttpsError>[0], reason: string, message: string): never {
  throw new HttpsError(code, message, { reason });
}

function requireUid(uid: string | undefined): string {
  if (!uid) fail('unauthenticated', 'UNAUTHENTICATED', '로그인이 필요합니다.');
  return uid;
}

function parseNickname(value: unknown): string {
  if (typeof value !== 'string') fail('invalid-argument', 'INVALID_NICKNAME', '닉네임은 2~16자로 입력해 주세요.');
  const nickname = value.trim();
  const length = Array.from(nickname).length;
  if (length < 2 || length > 16) fail('invalid-argument', 'INVALID_NICKNAME', '닉네임은 2~16자로 입력해 주세요.');
  return nickname;
}

function parseRoomCode(value: unknown): string {
  if (typeof value !== 'string') fail('invalid-argument', 'INVALID_ROOM_CODE', '초대 코드 형식이 올바르지 않습니다.');
  const code = value.trim().toUpperCase();
  if (!codePattern.test(code)) fail('invalid-argument', 'INVALID_ROOM_CODE', '초대 코드는 영문·숫자 8자리입니다.');
  return code;
}

function generateRoomCode(): string {
  return Array.from(randomBytes(codeLength), byte => codeAlphabet[byte & 31]).join('');
}

export const createRoom = onCall({ region }, async request => {
  const uid = requireUid(request.auth?.uid);
  const parsed = createInput.safeParse(request.data);
  const nickname = parseNickname(parsed.success ? parsed.data.nickname : undefined);
  const roomRef = db.collection('rooms').doc();
  const playerRef = roomRef.collection('players').doc(uid);

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const codeRef = db.collection('roomCodes').doc(roomCode);
    try {
      await db.runTransaction(async transaction => {
        const existing = await transaction.get(codeRef);
        if (existing.exists) throw new CodeCollision();
        const now = Timestamp.now();
        const room: RoomDocument = {
          roomCode,
          hostUid: uid,
          status: 'waiting',
          playerOrder: [uid],
          capacity: roomCapacity,
          createdAt: now,
          updatedAt: now,
        };
        transaction.create(codeRef, { roomId: roomRef.id, createdAt: now });
        transaction.create(roomRef, room);
        transaction.create(playerRef, { uid, nickname, seatIndex: 0, ready: false, forfeited: false, joinedAt: now });
      });
      return { roomId: roomRef.id, roomCode, seatIndex: 0 };
    } catch (error) {
      if (error instanceof CodeCollision) continue;
      throw error;
    }
  }
  fail('resource-exhausted', 'ROOM_CODE_COLLISION', '초대 코드를 만들지 못했습니다. 다시 시도해 주세요.');
});

export const joinRoom = onCall({ region }, async request => {
  const uid = requireUid(request.auth?.uid);
  const parsed = joinInput.safeParse(request.data);
  const nickname = parseNickname(parsed.success ? parsed.data.nickname : undefined);
  const roomCode = parseRoomCode(parsed.success ? parsed.data.roomCode : undefined);
  const codeRef = db.collection('roomCodes').doc(roomCode);

  return db.runTransaction(async transaction => {
    const code = await transaction.get(codeRef);
    const roomId = code.get('roomId');
    if (!code.exists || typeof roomId !== 'string') fail('not-found', 'ROOM_NOT_FOUND', '일치하는 방을 찾지 못했습니다.');

    const roomRef = db.collection('rooms').doc(roomId);
    const playerRef = roomRef.collection('players').doc(uid);
    const [roomSnapshot, playerSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerRef),
    ]);
    if (!roomSnapshot.exists) fail('not-found', 'ROOM_NOT_FOUND', '일치하는 방을 찾지 못했습니다.');

    const room = roomSnapshot.data() as RoomDocument;
    if (playerSnapshot.exists || room.playerOrder.includes(uid)) {
      fail('already-exists', 'ALREADY_IN_ROOM', '이미 이 방에 참가했습니다.');
    }
    if (room.status !== 'waiting') fail('failed-precondition', 'ROOM_NOT_WAITING', '이미 시작했거나 종료된 방입니다.');
    if (room.playerOrder.length >= roomCapacity) fail('resource-exhausted', 'ROOM_FULL', '방 정원이 가득 찼습니다.');

    const seatIndex = room.playerOrder.length;
    const now = Timestamp.now();
    transaction.create(playerRef, { uid, nickname, seatIndex, ready: false, forfeited: false, joinedAt: now });
    transaction.update(roomRef, { playerOrder: [...room.playerOrder, uid], updatedAt: now });
    return { roomId, roomCode, seatIndex };
  });
});
