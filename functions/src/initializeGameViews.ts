import { randomBytes } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  createInitialGameState,
  toPrivatePlayerView,
  toPublicGameView,
} from '@gem-arena/engine';
import { TURN_DURATION_MS } from './turnTiming.js';

const roomCodePattern = /^[A-HJ-NP-Z2-9]{8}$/;

/** Trusted Admin SDK entry point. Do not expose this as a client Callable. */
export async function initializeGameViews(db: Firestore, roomCode: string): Promise<void> {
  if (!roomCodePattern.test(roomCode)) throw new RangeError('유효한 방 코드가 필요합니다');
  const roomRef = db.collection('rooms').doc(roomCode);
  await db.runTransaction(async transaction => {
    const room = await transaction.get(roomRef);
    if (!room.exists || room.get('status') !== 'playing') {
      throw new Error('시작한 방만 초기화할 수 있습니다');
    }
    const playerOrder = room.get('playerOrder');
    if (!Array.isArray(playerOrder) || playerOrder.length < 2 || playerOrder.length > 4) {
      throw new Error('2~4명의 참가자가 필요합니다');
    }
    const seed = randomBytes(4).readUInt32BE(0);
    const state = createInitialGameState(playerOrder, seed);
    const turnDeadlineAt = Date.now() + TURN_DURATION_MS;
    transaction.create(roomRef.collection('privateState').doc('server'), state);
    transaction.create(roomRef.collection('game').doc('publicState'), {
      ...toPublicGameView(state), turnDeadlineAt,
    });
    transaction.update(roomRef, { turnDeadlineAt });
    for (const uid of playerOrder) {
      transaction.create(
        roomRef.collection('privatePlayers').doc(uid),
        toPrivatePlayerView(state, uid),
      );
    }
  });
}
