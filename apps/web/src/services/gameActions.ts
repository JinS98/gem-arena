import type { GameAction, ServerGameState } from '@gem-arena/engine';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from './firebase';
import { ensureAnonymousSession } from './playerIdentity';

export interface SubmitGameActionRequest {
  roomId: string;
  actionId: string;
  expectedVersion: number;
  action: Exclude<GameAction, { type: 'TIMEOUT' }>;
}

export interface SubmitGameActionResult {
  version: number;
  phase: ServerGameState['phase'];
  turnIndex: number;
}

/** Keep actionId and expectedVersion unchanged when retrying the same request. */
export async function submitGameAction(request: SubmitGameActionRequest): Promise<SubmitGameActionResult> {
  await ensureAnonymousSession();
  const callable = httpsCallable<SubmitGameActionRequest, SubmitGameActionResult>(
    getFirebase().functions, 'submitAction',
  );
  return (await callable(request)).data;
}
