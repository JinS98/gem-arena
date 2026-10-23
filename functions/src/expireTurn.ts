import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { reduceGameAction, toPrivatePlayerView, toPublicGameView, type ServerGameState } from '@gem-arena/engine';
import { TURN_DURATION_MS } from './turnTiming.js';

const roomCodePattern = /^[A-HJ-NP-Z2-9]{8}$/;

/** Both callers use the same transaction, so an expired turn advances once. */
export async function expireGameTurn(db: Firestore, roomCode: string): Promise<boolean> {
  const roomRef = db.collection('rooms').doc(roomCode);
  const serverRef = roomRef.collection('privateState').doc('server');
  const publicRef = roomRef.collection('game').doc('publicState');
  return db.runTransaction(async transaction => {
    const [roomSnapshot, stateSnapshot] = await transaction.getAll(roomRef, serverRef);
    if (!roomSnapshot.exists || !stateSnapshot.exists || roomSnapshot.get('status') !== 'playing') return false;
    const deadline = roomSnapshot.get('turnDeadlineAt');
    const now = Date.now();
    if (typeof deadline !== 'number' || now < deadline) return false;
    const state = stateSnapshot.data() as ServerGameState;
    if (state.phase === 'finished') return false;
    const currentUid = state.playerOrder[state.turnIndex];
    const nextState = reduceGameAction(state, currentUid, { type: 'TIMEOUT' });
    const turnDeadlineAt = nextState.phase === 'finished' ? null : now + TURN_DURATION_MS;
    transaction.set(serverRef, nextState);
    transaction.set(publicRef, { ...toPublicGameView(nextState), turnDeadlineAt });
    transaction.update(roomRef, { turnDeadlineAt,
      ...(nextState.phase === 'finished' ? { status: 'finished' } : {}) });
    for (const uid of nextState.playerOrder) {
      transaction.set(roomRef.collection('privatePlayers').doc(uid), toPrivatePlayerView(nextState, uid));
    }
    return true;
  });
}

export const expireTurn = onCall({ region: 'asia-northeast3' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const roomId = request.data?.roomId;
  if (typeof roomId !== 'string' || !roomCodePattern.test(roomId)) {
    throw new HttpsError('invalid-argument', '잘못된 방 코드입니다.');
  }
  const db = getFirestore(getApps()[0] ?? initializeApp());
  const room = await db.collection('rooms').doc(roomId).get();
  if (!room.exists || !room.get('playerOrder')?.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', '방 참가자만 턴 만료를 확인할 수 있습니다.');
  }
  return { advanced: await expireGameTurn(db, roomId) };
});

export async function sweepExpiredGameTurns(db: Firestore, now: number = Date.now()): Promise<number> {
  const expired = await db.collection('rooms').where('turnDeadlineAt', '<=', now).limit(100).get();
  const results = await Promise.all(expired.docs.map(room => expireGameTurn(db, room.id)));
  return results.filter(Boolean).length;
}

/** A safety net when every player's browser is closed at the deadline. */
export const sweepExpiredTurns = onSchedule({ schedule: 'every 1 minutes', region: 'asia-northeast3' }, async () => {
  const db = getFirestore(getApps()[0] ?? initializeApp());
  await sweepExpiredGameTurns(db);
});
