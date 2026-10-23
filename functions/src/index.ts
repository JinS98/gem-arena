import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeGameViews } from './initializeGameViews.js';
import { syncRoomListing } from './syncRoomListing.js';
export { submitAction } from './submitAction.js';
export { leaveRoom } from './leaveRoom.js';
export { expireTurn, sweepExpiredTurns } from './expireTurn.js';

export const roomListingUpdated = onDocumentWritten({
  document: 'rooms/{roomCode}', region: 'asia-northeast3',
}, event => syncRoomListing(getFirestore(getApps()[0] ?? initializeApp()), event.params.roomCode));

/** Start the trusted game state after the room host's validated waiting → playing write. */
export const roomStarted = onDocumentUpdated({
  document: 'rooms/{roomCode}', region: 'asia-northeast3',
}, async event => {
  if (event.data?.before.data()?.status !== 'waiting' ||
      event.data?.after.data()?.status !== 'playing') return;
  const db = getFirestore(getApps()[0] ?? initializeApp());
  try {
    await initializeGameViews(db, event.params.roomCode);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 6 || code === 'already-exists') {
      const roomRef = db.collection('rooms').doc(event.params.roomCode);
      const [server, publicView] = await Promise.all([
        roomRef.collection('privateState').doc('server').get(),
        roomRef.collection('game').doc('publicState').get(),
      ]);
      if (server.exists && publicView.exists) return;
    }
    throw error;
  }
});
