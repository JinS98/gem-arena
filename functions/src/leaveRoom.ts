import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { forfeitPlayer, toPrivatePlayerView, toPublicGameView, type ServerGameState } from '@gem-arena/engine';
import { z } from 'zod';

const requestSchema = z.object({ roomId: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/) }).strict();
export type LeaveRoomResult = { status: 'left' | 'forfeited'; version?: number };

export class LeaveRoomError extends Error {
  constructor(readonly reason: string, readonly status: 'permission-denied' | 'failed-precondition' | 'not-found' | 'invalid-argument') {
    super(reason);
  }
}

/** Explicit departure only. Closing a tab does not call this function. */
export async function leaveGameRoom(db: Firestore, uid: string | undefined, rawRequest: unknown): Promise<LeaveRoomResult> {
  if (!uid) throw new LeaveRoomError('UNAUTHENTICATED', 'permission-denied');
  const parsed = requestSchema.safeParse(rawRequest);
  if (!parsed.success) throw new LeaveRoomError('INVALID_ROOM_CODE', 'invalid-argument');
  const roomRef = db.collection('rooms').doc(parsed.data.roomId);
  const serverRef = roomRef.collection('privateState').doc('server');
  const publicRef = roomRef.collection('game').doc('publicState');
  const receiptRef = roomRef.collection('leaveReceipts').doc(uid);

  return db.runTransaction(async transaction => {
    const [roomSnapshot, stateSnapshot, receiptSnapshot] = await transaction.getAll(roomRef, serverRef, receiptRef);
    if (!roomSnapshot.exists) throw new LeaveRoomError('ROOM_NOT_FOUND', 'not-found');
    const room = roomSnapshot.data();
    if (receiptSnapshot.exists && (!room?.players?.[uid] || room.players[uid].forfeited === true)) {
      return receiptSnapshot.data()?.result as LeaveRoomResult;
    }
    if (!room || !Array.isArray(room.playerOrder) || !room.playerOrder.includes(uid) || !room.players?.[uid]) {
      throw new LeaveRoomError('NOT_ROOM_MEMBER', 'permission-denied');
    }
    if (room.status === 'waiting') {
      const playerOrder = room.playerOrder.filter((id: string) => id !== uid);
      const players = { ...room.players };
      delete players[uid];
      transaction.update(roomRef, {
        playerOrder, players,
        hostUid: room.hostUid === uid ? (playerOrder[0] ?? '') : room.hostUid,
        status: playerOrder.length === 0 ? 'finished' : 'waiting',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(receiptRef, { result: { status: 'left' } });
      return { status: 'left' };
    }
    if (!stateSnapshot.exists || (room.status !== 'playing' && room.status !== 'finished')) {
      throw new LeaveRoomError('GAME_NOT_READY', 'failed-precondition');
    }
    const state = stateSnapshot.data() as ServerGameState;
    if (!Array.isArray(state.playerOrder) || state.playerOrder.length !== room.playerOrder.length ||
        !state.playerOrder.every((id, index) => id === room.playerOrder[index])) {
      throw new LeaveRoomError('GAME_STATE_MISMATCH', 'failed-precondition');
    }
    if (room.players[uid].forfeited === true) return { status: 'forfeited', version: state.version };
    if (state.phase === 'finished' || room.status === 'finished') {
      throw new LeaveRoomError('GAME_FINISHED', 'failed-precondition');
    }
    let nextState: ServerGameState;
    try {
      nextState = forfeitPlayer(state, uid);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new LeaveRoomError('INVALID_GAME_STATE', 'failed-precondition');
    }
    transaction.update(roomRef, {
      players: { ...room.players, [uid]: { ...room.players[uid], forfeited: true } },
      ...(nextState.phase === 'finished' ? { status: 'finished' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(serverRef, nextState);
    transaction.set(publicRef, toPublicGameView(nextState));
    for (const playerId of nextState.playerOrder) {
      transaction.set(roomRef.collection('privatePlayers').doc(playerId), toPrivatePlayerView(nextState, playerId));
    }
    transaction.set(receiptRef, { result: { status: 'forfeited', version: nextState.version } });
    return { status: 'forfeited', version: nextState.version };
  });
}

export const leaveRoom = onCall({ region: 'asia-northeast3' }, async request => {
  try {
    return await leaveGameRoom(getFirestore(getApps()[0] ?? initializeApp()), request.auth?.uid, request.data);
  } catch (error) {
    if (error instanceof LeaveRoomError) {
      throw new HttpsError(error.reason === 'UNAUTHENTICATED' ? 'unauthenticated' : error.status,
        error.reason, { reason: error.reason });
    }
    throw error;
  }
});
