import type { PrivatePlayerView, PublicGameView } from '@gem-arena/engine';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { ensureAnonymousSession } from './playerIdentity';

export interface MyGameViews {
  publicGame: PublicGameView;
  privatePlayer: PrivatePlayerView;
}

export type GameViewUpdate =
  | { status: 'loading' | 'not-ready'; views: null; fromCache: false }
  | { status: 'ready' | 'syncing'; views: MyGameViews; fromCache: boolean };

/** Publish a new pair only when the public and owner-only document versions match. */
export function subscribeMyGameViews(
  roomCode: string,
  uid: string,
  onChange: (update: GameViewUpdate) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirebase().db;
  let publicGame: PublicGameView | null | undefined;
  let privatePlayer: PrivatePlayerView | null | undefined;
  let publicFromCache = false;
  let privateFromCache = false;
  let lastReady: MyGameViews | null = null;
  let stopped = false;

  function publish() {
    if (stopped) return;
    if (publicGame === undefined || privatePlayer === undefined) {
      onChange({ status: 'loading', views: null, fromCache: false });
    } else if (!publicGame || !privatePlayer) {
      onChange({ status: 'not-ready', views: null, fromCache: false });
    } else if (privatePlayer.uid !== uid) {
      onError(new Error('본인 예약 카드 문서의 소유자가 일치하지 않습니다.'));
    } else if (publicGame.version === privatePlayer.version) {
      lastReady = { publicGame, privatePlayer };
      onChange({ status: 'ready', views: lastReady, fromCache: publicFromCache || privateFromCache });
    } else if (lastReady) {
      onChange({ status: 'syncing', views: lastReady, fromCache: publicFromCache || privateFromCache });
    } else {
      onChange({ status: 'loading', views: null, fromCache: false });
    }
  }

  const stopPublic = onSnapshot(doc(db, 'rooms', roomCode, 'game', 'publicState'),
    { includeMetadataChanges: true }, snapshot => {
      publicGame = snapshot.exists() ? snapshot.data() as PublicGameView : null;
      publicFromCache = snapshot.metadata.fromCache;
      publish();
    }, onError);
  const stopPrivate = onSnapshot(doc(db, 'rooms', roomCode, 'privatePlayers', uid),
    { includeMetadataChanges: true }, snapshot => {
      privatePlayer = snapshot.exists() ? snapshot.data() as PrivatePlayerView : null;
      privateFromCache = snapshot.metadata.fromCache;
      publish();
    }, onError);
  publish();
  return () => {
    stopped = true;
    stopPublic();
    stopPrivate();
  };
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
