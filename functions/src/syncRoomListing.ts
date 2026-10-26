import type { Firestore } from 'firebase-admin/firestore';

/** Keep the lobby's public projection in sync without exposing room membership data. */
export async function syncRoomListing(db: Firestore, roomCode: string): Promise<void> {
  const roomRef = db.collection('rooms').doc(roomCode);
  const listingRef = db.collection('roomListings').doc(roomCode);
  await db.runTransaction(async transaction => {
    // Reading the current room in a transaction also handles repeated or delayed events.
    const snapshot = await transaction.get(roomRef);
    const room = snapshot.data();
    if (!room || room.status !== 'waiting') {
      transaction.delete(listingRef);
      return;
    }

    const playerOrder = Array.isArray(room.playerOrder) ? room.playerOrder : [];
    const hostNickname = room.players?.[room.hostUid]?.nickname;
    transaction.set(listingRef, {
      roomCode,
      title: typeof room.title === 'string' && room.title.trim()
        ? room.title : `${typeof hostNickname === 'string' ? hostNickname : '플레이어'}의 방`,
      theme: ['default', 'lol', 'demon-slayer'].includes(room.theme) ? room.theme : 'default',
      hostNickname: typeof hostNickname === 'string' ? hostNickname : '플레이어',
      playerCount: playerOrder.length,
      capacity: room.capacity,
      createdAt: room.createdAt ?? snapshot.createTime,
    });
  });
}
