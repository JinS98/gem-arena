import type { PrivatePlayerView, PublicGameView } from '@gem-arena/engine';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { ensureAnonymousSession } from './playerIdentity';

export interface MyGameViews {
  publicGame: PublicGameView;
  privatePlayer: PrivatePlayerView;
}

/** Missing documents mean the trusted game initializer has not published them yet. */
export async function readMyGameViews(roomCode: string): Promise<MyGameViews | null> {
  const uid = (await ensureAnonymousSession()).uid;
  const db = getFirebase().db;
  const [publicSnapshot, privateSnapshot] = await Promise.all([
    getDoc(doc(db, 'rooms', roomCode, 'game', 'publicState')),
    getDoc(doc(db, 'rooms', roomCode, 'privatePlayers', uid)),
  ]);
  if (!publicSnapshot.exists() || !privateSnapshot.exists()) return null;
  return {
    publicGame: publicSnapshot.data() as PublicGameView,
    privatePlayer: privateSnapshot.data() as PrivatePlayerView,
  };
}
