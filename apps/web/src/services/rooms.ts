import { httpsCallable } from 'firebase/functions';
import { getFirebase } from './firebase';

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
  capacity: number;
}

export interface RoomPlayer {
  uid: string;
  nickname: string;
  seatIndex: number;
  ready: boolean;
}

export async function createRoom(nickname: string): Promise<RoomAccess> {
  const callable = httpsCallable<{ nickname: string }, RoomAccess>(getFirebase().functions, 'createRoom');
  return (await callable({ nickname })).data;
}

export async function joinRoom(roomCode: string, nickname: string): Promise<RoomAccess> {
  const callable = httpsCallable<{ roomCode: string; nickname: string }, RoomAccess>(getFirebase().functions, 'joinRoom');
  return (await callable({ roomCode, nickname })).data;
}

export function roomErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object' && 'details' in error ? error.details : null;
  const reason = details && typeof details === 'object' && 'reason' in details ? details.reason : null;
  switch (reason) {
    case 'INVALID_NICKNAME': return '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.';
    case 'INVALID_ROOM_CODE': return '초대 코드는 영문·숫자 8자리입니다.';
    case 'ROOM_NOT_FOUND': return '일치하는 방이 없습니다. 초대 코드를 확인해 주세요.';
    case 'ROOM_FULL': return '방 정원이 가득 찼습니다.';
    case 'ROOM_NOT_WAITING': return '이미 시작했거나 종료된 방입니다.';
    case 'ALREADY_IN_ROOM': return '이미 이 방에 참가했습니다. 대기실 주소로 다시 들어가 주세요.';
  }
  return '방 요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}
