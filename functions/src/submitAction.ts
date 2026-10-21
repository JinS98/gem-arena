import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  reduceGameAction,
  toPrivatePlayerView,
  toPublicGameView,
  type GameAction,
  type ServerGameState,
} from '@gem-arena/engine';
import { z } from 'zod';

const roomId = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);
const gemColor = z.enum(['white', 'blue', 'green', 'red', 'black']);
const gemCount = z.number().int().nonnegative().safe();
const inventory = z.object({
  white: gemCount, blue: gemCount, green: gemCount,
  red: gemCount, black: gemCount, gold: gemCount,
}).strict();
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TAKE_GEMS'), colors: z.array(gemColor).min(1).max(3) }).strict(),
  z.object({
    type: z.literal('BUY_CARD'), cardId: z.string().min(1).max(64),
    source: z.enum(['market', 'reserved']), payment: inventory,
  }).strict(),
  z.object({
    type: z.literal('RESERVE_CARD'), cardId: z.string().min(1).max(64).optional(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  }).strict(),
  z.object({ type: z.literal('DISCARD_GEMS'), gems: inventory }).strict(),
  z.object({ type: z.literal('CHOOSE_NOBLE'), nobleId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal('PASS') }).strict(),
]);
const requestSchema = z.object({
  roomId,
  actionId: z.string().min(1).max(128),
  expectedVersion: z.number().int().nonnegative().safe(),
  action,
}).strict();

export type SubmitActionRequest = z.infer<typeof requestSchema>;
export interface SubmitActionResult { version: number; phase: ServerGameState['phase']; turnIndex: number }

export class GameActionError extends Error {
  constructor(readonly reason: string, readonly status: 'permission-denied' | 'failed-precondition' | 'not-found' | 'invalid-argument') {
    super(reason);
  }
}

/** Trusted server path. Auth UID must come from verified request.auth, never request data. */
export async function submitGameAction(
  db: Firestore, uid: string | undefined, rawRequest: unknown,
): Promise<SubmitActionResult> {
  if (!uid) throw new GameActionError('UNAUTHENTICATED', 'permission-denied');
  const parsed = requestSchema.safeParse(rawRequest);
  if (!parsed.success) throw new GameActionError('INVALID_ACTION', 'invalid-argument');
  const { roomId: code, expectedVersion, action: requestedAction } = parsed.data;
  const roomRef = db.collection('rooms').doc(code);
  const serverRef = roomRef.collection('privateState').doc('server');
  const publicRef = roomRef.collection('game').doc('publicState');

  return db.runTransaction(async transaction => {
    const [roomSnapshot, stateSnapshot] = await transaction.getAll(roomRef, serverRef);
    if (!roomSnapshot.exists) throw new GameActionError('ROOM_NOT_FOUND', 'not-found');
    const room = roomSnapshot.data();
    if (!room || !Array.isArray(room.playerOrder) ||
        !room.playerOrder.includes(uid) || !room.players?.[uid] || room.players[uid].forfeited === true) {
      throw new GameActionError('NOT_ROOM_MEMBER', 'permission-denied');
    }
    if (room.status !== 'playing' || !stateSnapshot.exists) {
      throw new GameActionError('GAME_NOT_STARTED', 'failed-precondition');
    }
    const state = stateSnapshot.data() as ServerGameState;
    if (!Array.isArray(state.playerOrder) ||
        state.playerOrder.length !== room.playerOrder.length ||
        !state.playerOrder.every((playerId, index) => playerId === room.playerOrder[index])) {
      throw new GameActionError('GAME_STATE_MISMATCH', 'failed-precondition');
    }
    if (state.phase === 'finished') throw new GameActionError('GAME_FINISHED', 'failed-precondition');
    if (state.version !== expectedVersion) {
      throw new GameActionError('VERSION_CONFLICT', 'failed-precondition');
    }
    if (state.playerOrder[state.turnIndex] !== uid) {
      throw new GameActionError('NOT_YOUR_TURN', 'permission-denied');
    }

    let nextState: ServerGameState;
    try {
      nextState = reduceGameAction(state, uid, requestedAction as GameAction);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new GameActionError('INVALID_ACTION', 'invalid-argument');
    }

    transaction.set(serverRef, nextState);
    transaction.set(publicRef, toPublicGameView(nextState));
    for (const playerId of nextState.playerOrder) {
      transaction.set(
        roomRef.collection('privatePlayers').doc(playerId),
        toPrivatePlayerView(nextState, playerId),
      );
    }
    return { version: nextState.version, phase: nextState.phase, turnIndex: nextState.turnIndex };
  });
}

export const submitAction = onCall({ region: 'asia-northeast3' }, async request => {
  const app = getApps()[0] ?? initializeApp();
  try {
    return await submitGameAction(getFirestore(app), request.auth?.uid, request.data);
  } catch (error) {
    if (error instanceof GameActionError) {
      const code = error.reason === 'UNAUTHENTICATED' ? 'unauthenticated' : error.status;
      throw new HttpsError(code, error.reason, { reason: error.reason });
    }
    throw error;
  }
});
